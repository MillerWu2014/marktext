export interface QuoteDomRange {
  startNode: Text
  startOffset: number
  endNode: Text
  endOffset: number
  plainTextStart: number
}

interface TextSegment {
  node: Text
  start: number
  end: number
}

const collectTextSegments = (root: Element): TextSegment[] => {
  const segments: TextSegment[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let pos = 0
  let node: Node | null
  while ((node = walker.nextNode())) {
    const textNode = node as Text
    const len = textNode.data.length
    if (len === 0) continue
    segments.push({ node: textNode, start: pos, end: pos + len })
    pos += len
  }
  return segments
}

const offsetToPoint = (segments: TextSegment[], offset: number): { node: Text; offset: number } => {
  for (const seg of segments) {
    if (offset >= seg.start && offset <= seg.end) {
      return { node: seg.node, offset: Math.min(offset - seg.start, seg.node.data.length) }
    }
  }
  const last = segments[segments.length - 1]
  if (!last) {
    throw new Error('No text segments')
  }
  return { node: last.node, offset: last.node.data.length }
}

const indexesOf = (haystack: string, needle: string): number[] => {
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

export const findQuoteDomRange = (
  root: Element,
  quote: string,
  hintOffset: number
): QuoteDomRange | null => {
  if (!quote) return null
  const segments = collectTextSegments(root)
  if (!segments.length) return null

  const fullText = segments.map((s) => s.node.data).join('')
  const hits = indexesOf(fullText, quote)
  if (!hits.length) return null

  let best = hits[0]
  if (best === undefined) return null
  let bestDist = Math.abs(best - hintOffset)
  for (const hit of hits) {
    const dist = Math.abs(hit - hintOffset)
    if (dist <= bestDist) {
      best = hit
      bestDist = dist
    }
  }

  const matchStart = best
  const matchEnd = best + quote.length
  const start = offsetToPoint(segments, matchStart)
  const end = offsetToPoint(segments, matchEnd)

  return {
    startNode: start.node,
    startOffset: start.offset,
    endNode: end.node,
    endOffset: end.offset,
    plainTextStart: matchStart
  }
}

export const setDomSelectionForRange = (match: QuoteDomRange): void => {
  const range = document.createRange()
  range.setStart(match.startNode, match.startOffset)
  range.setEnd(match.endNode, match.endOffset)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

export interface UnderlineRect {
  key: string
  commentId: string
  startOffset: number
  endOffset: number
  style: Record<string, string>
}

export const rectsForQuoteRange = (
  match: QuoteDomRange,
  commentId: string,
  markdownStart: number,
  markdownEnd: number,
  overlayEl: HTMLElement
): UnderlineRect[] => {
  const range = document.createRange()
  range.setStart(match.startNode, match.startOffset)
  range.setEnd(match.endNode, match.endOffset)
  const overlayRect = overlayEl.getBoundingClientRect()
  const clientRects = Array.from(range.getClientRects())
  range.detach()

  return clientRects.map((rect, index) => ({
    key: `${commentId}-${index}`,
    commentId,
    startOffset: markdownStart,
    endOffset: markdownEnd,
    style: {
      left: `${rect.left - overlayRect.left}px`,
      top: `${rect.top - overlayRect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    }
  }))
}
