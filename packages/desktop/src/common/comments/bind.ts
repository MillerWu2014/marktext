import {
  QUOTE_CONTEXT_CHARS,
  type ICommentThread
} from '@shared/types/comments'

export const indexesOf = (haystack: string, needle: string): number[] => {
  if (!needle) return []
  const out: number[] = []
  let from = 0
  while (from <= haystack.length) {
    const i = haystack.indexOf(needle, from)
    if (i === -1) break
    out.push(i)
    from = i + Math.max(needle.length, 1)
  }
  return out
}

// Prefers the later hit on a tied distance, so re-binding after an edit favors
// the occurrence closest to (and no earlier than necessary from) where the
// comment last pointed.
export const closestHitOffset = (hits: number[], hintOffset: number): number => {
  let best = hits[0]!
  let bestDist = Math.abs(best - hintOffset)
  for (const hit of hits) {
    const dist = Math.abs(hit - hintOffset)
    if (dist <= bestDist) {
      best = hit
      bestDist = dist
    }
  }
  return best
}

// Markdown offsets and concatenated `.mu-content` offsets are different
// coordinate spaces (GFM pipes, markers, blank lines). When both haystacks
// contain the same number of quote hits, map by occurrence index so a comment
// on the first "foo" does not snap to the last one.
export const alignedQuoteHit = (
  haystack: string,
  quote: string,
  hintOffset: number,
  sourceHaystack?: string
): number | null => {
  const hits = indexesOf(haystack, quote)
  if (!hits.length) return null
  if (!sourceHaystack) return closestHitOffset(hits, hintOffset)

  const sourceHits = indexesOf(sourceHaystack, quote)
  if (!sourceHits.length) return closestHitOffset(hits, hintOffset)

  const sourceIndex = sourceHits.indexOf(closestHitOffset(sourceHits, hintOffset))
  const mapped = sourceIndex >= 0 ? hits[sourceIndex] : undefined
  if (sourceHits.length === hits.length && mapped != null) {
    return mapped
  }

  const scaled = sourceHaystack.length
    ? Math.round(hintOffset * (haystack.length / sourceHaystack.length))
    : hintOffset
  return closestHitOffset(hits, scaled)
}

export const extractQuoteContext = (
  markdown: string,
  startOffset: number,
  endOffset: number
): Pick<ICommentThread, 'quote' | 'prefix' | 'suffix' | 'startOffset' | 'endOffset'> => {
  const start = Math.max(0, Math.min(startOffset, markdown.length))
  const end = Math.max(start, Math.min(endOffset, markdown.length))
  return {
    quote: markdown.slice(start, end),
    prefix: markdown.slice(Math.max(0, start - QUOTE_CONTEXT_CHARS), start),
    suffix: markdown.slice(end, Math.min(markdown.length, end + QUOTE_CONTEXT_CHARS)),
    startOffset: start,
    endOffset: end
  }
}

const applyOffsets = (comment: ICommentThread, markdown: string, start: number, end: number): ICommentThread => ({
  ...comment,
  ...extractQuoteContext(markdown, start, end),
  orphaned: false
})

export const bindComment = (markdown: string, comment: ICommentThread): ICommentThread => {
  const wrapped = `${comment.prefix}${comment.quote}${comment.suffix}`
  if (comment.quote && comment.prefix && comment.suffix) {
    const wrappedHits = indexesOf(markdown, wrapped)
    if (wrappedHits.length === 1) {
      const start = wrappedHits[0]! + comment.prefix.length
      return applyOffsets(comment, markdown, start, start + comment.quote.length)
    }
  }

  const quoteHits = indexesOf(markdown, comment.quote)
  if (quoteHits.length) {
    const best = closestHitOffset(quoteHits, comment.startOffset)
    return applyOffsets(comment, markdown, best, best + comment.quote.length)
  }

  return { ...comment, orphaned: true }
}

export const followComment = (markdown: string, comment: ICommentThread): ICommentThread => {
  const rebound = bindComment(markdown, comment)
  if (!rebound.orphaned) return rebound
  if (!comment.prefix || !comment.suffix) return { ...comment, orphaned: true }

  const prefixAt = markdown.indexOf(comment.prefix)
  if (prefixAt === -1) return { ...comment, orphaned: true }
  const afterPrefix = prefixAt + comment.prefix.length
  const suffixAt = markdown.indexOf(comment.suffix, afterPrefix)
  if (suffixAt === -1 || suffixAt === afterPrefix) return { ...comment, orphaned: true }
  return applyOffsets(comment, markdown, afterPrefix, suffixAt)
}

export const bindComments = (
  markdown: string,
  comments: ICommentThread[]
): ICommentThread[] => comments.map((c) => bindComment(markdown, c))

export const pickOverlappingComment = (
  comments: ICommentThread[],
  offset: number
): ICommentThread | null => {
  const hits = comments.filter(
    (c) => !c.orphaned && offset >= c.startOffset && offset < c.endOffset
  )
  if (!hits.length) return null
  hits.sort((a, b) => {
    const da = a.endOffset - a.startOffset
    const db = b.endOffset - b.startOffset
    if (da !== db) return db - da
    return a.startOffset - b.startOffset
  })
  return hits[hits.length - 1] ?? null
}
