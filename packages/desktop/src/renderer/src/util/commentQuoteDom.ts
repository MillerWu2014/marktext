import { alignedQuoteHit } from 'common/comments/bind'

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

// A single walk over the editor DOM, reusable for every comment in one
// recompute pass. Walking per comment is O(threads × DOM nodes).
export interface QuoteSearchIndex {
  segments: TextSegment[]
  fullText: string
}

// KaTeX / ruby previews live inside `.mu-content` but are not source text;
// including them inflates the concatenated string and shifts later matches.
const SKIP_PREVIEW_CLASSES = ['mu-math-render', 'mu-ruby-render'] as const

const isInsideClass = (node: Node, className: string, root: Element): boolean => {
  let el: Node | null = node instanceof Element ? node : node.parentNode
  while (el && el !== root) {
    if (el instanceof Element && el.classList.contains(className)) return true
    el = el.parentNode
  }
  return false
}

const appendTextSegments = (scope: Element, segments: TextSegment[], startPos: number): number => {
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
  let pos = startPos
  let node: Node | null
  while ((node = walker.nextNode())) {
    const current = node
    if (SKIP_PREVIEW_CLASSES.some((cls) => isInsideClass(current, cls, scope))) continue
    const textNode = current as Text
    const len = textNode.data.length
    if (len === 0) continue
    segments.push({ node: textNode, start: pos, end: pos + len })
    pos += len
  }
  return pos
}

const collectTextSegments = (root: Element): TextSegment[] => {
  const segments: TextSegment[] = []
  const contents = root.querySelectorAll('.mu-content')
  if (contents.length) {
    let pos = 0
    contents.forEach((el) => {
      if (el.parentElement?.closest('.mu-content')) return
      pos = appendTextSegments(el, segments, pos)
    })
    return segments
  }
  appendTextSegments(root, segments, 0)
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

export const prepareQuoteSearch = (root: Element): QuoteSearchIndex => {
  const segments = collectTextSegments(root)
  return { segments, fullText: segments.map((s) => s.node.data).join('') }
}

export const findQuoteDomRange = (
  index: QuoteSearchIndex,
  quote: string,
  hintOffset: number,
  markdown?: string
): QuoteDomRange | null => {
  if (!quote) return null
  const { segments, fullText } = index
  if (!segments.length) return null

  const matchStart = alignedQuoteHit(fullText, quote, hintOffset, markdown)
  if (matchStart == null) return null
  const matchEnd = matchStart + quote.length
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

const rectRight = (rect: DOMRect): number => rect.left + rect.width
const rectBottom = (rect: DOMRect): number => rect.top + rect.height

const rectsOverlap = (a: DOMRect, b: DOMRect): boolean =>
  a.left < rectRight(b) && rectRight(a) > b.left && a.top < rectBottom(b) && rectBottom(a) > b.top

// Chromium/WebKit emit extra Range.getClientRects() boxes inside tables
// (collapsed fragments, other columns). Keep only boxes that actually cover
// the quote's text nodes. Fall back rather than drawing nothing.
export const filterQuoteClientRects = (clientRects: DOMRect[], textBoxes: DOMRect[]): DOMRect[] => {
  const sized = clientRects.filter((rect) => rect.width >= 1 && rect.height >= 1)
  const clipped = textBoxes.length
    ? sized.filter((rect) => textBoxes.some((box) => rectsOverlap(rect, box)))
    : sized
  if (clipped.length) return clipped
  if (sized.length) return sized
  return clientRects
}

const textBoxesForMatch = (match: QuoteDomRange): DOMRect[] => {
  const boxes: DOMRect[] = []
  const startEl = match.startNode.parentElement
  const endEl = match.endNode.parentElement
  if (startEl) boxes.push(startEl.getBoundingClientRect())
  if (endEl && endEl !== startEl) boxes.push(endEl.getBoundingClientRect())
  return boxes
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
  const clientRects = filterQuoteClientRects(Array.from(range.getClientRects()), textBoxesForMatch(match))
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
