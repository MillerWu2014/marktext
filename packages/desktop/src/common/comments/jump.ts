import type { LeaderBox } from './leader'

// Overlay underlines live in `.comment-decorations`, a sibling of the real
// scroller (`.editor-component`). `scrollIntoView` on those nodes walks
// overflow:hidden ancestors (`.editor-with-tabs` / `.container`) and slides
// the whole editor out of view — blank canvas after a TOC jump + card click.

export const scrollTopToRevealY = (
  scrollTop: number,
  viewportY: number,
  originY: number
): number => Math.max(0, scrollTop + viewportY - originY)

export const pickQuoteScrollBox = (boxes: LeaderBox[]): LeaderBox | null => {
  const usable = boxes.filter((box) => box.width >= 1 && box.height >= 1)
  if (!usable.length) return null
  return usable.reduce((best, box) => {
    if (box.top < best.top) return box
    if (box.top === best.top && box.width < best.width) return box
    return best
  })
}

export const commentJumpScrollTop = (
  scrollTop: number,
  boxes: LeaderBox[],
  originY: number
): number | null => {
  const box = pickQuoteScrollBox(boxes)
  if (!box) return null
  return scrollTopToRevealY(scrollTop, box.top, originY)
}

export const resetAncestorScroll = (from: Element | null, stopClass: string): void => {
  let el: HTMLElement | null = from instanceof HTMLElement ? from : from?.parentElement ?? null
  while (el) {
    el.scrollTop = 0
    if (el.classList.contains(stopClass)) break
    el = el.parentElement
  }
}
