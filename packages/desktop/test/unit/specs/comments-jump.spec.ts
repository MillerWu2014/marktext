import { describe, expect, it } from 'vitest'
import {
  commentJumpScrollTop,
  pickQuoteScrollBox,
  resetAncestorScroll,
  scrollTopToRevealY
} from 'common/comments/jump'

describe('comment jump scroll', () => {
  it('moves the editor container by viewport Y minus the TOC origin, not a parent overlay', () => {
    // Quote is 2500px below the viewport after a TOC jump to the top.
    expect(scrollTopToRevealY(0, 2500, 320)).toBe(2180)
  })

  it('is idempotent so a double-click does not stack a second jump', () => {
    const originY = 320
    const first = scrollTopToRevealY(0, 2500, originY)
    // After the first jump the quote sits at originY in the viewport.
    expect(scrollTopToRevealY(first, originY, originY)).toBe(first)
  })

  it('clamps a quote already above the origin so we do not invert the container', () => {
    expect(scrollTopToRevealY(0, 50, 320)).toBe(0)
  })

  it('picks the topmost real quote box and ignores collapsed table ghosts', () => {
    const ghost = { left: 400, top: 40, width: 48, height: 0 }
    const quote = { left: 24, top: 2500, width: 86, height: 18 }
    expect(pickQuoteScrollBox([ghost, quote])).toEqual(quote)
  })

  it('computes the editor scrollTop from filtered quote boxes', () => {
    const ghost = { left: 400, top: 40, width: 48, height: 0 }
    const quote = { left: 24, top: 2500, width: 86, height: 18 }
    expect(commentJumpScrollTop(0, [ghost, quote], 320)).toBe(2180)
  })

  it('zeros overflow-hidden ancestors of the overlay so a prior scrollIntoView blank recovers', () => {
    const body = document.createElement('div')
    body.className = 'editor-body'
    const tabs = document.createElement('div')
    tabs.className = 'editor-with-tabs'
    const container = document.createElement('div')
    container.className = 'container'
    const overlay = document.createElement('div')
    overlay.className = 'comment-decorations'
    body.append(tabs)
    tabs.append(container)
    container.append(overlay)
    document.body.append(body)

    tabs.scrollTop = 800
    container.scrollTop = 400

    resetAncestorScroll(overlay, 'editor-body')

    expect(tabs.scrollTop).toBe(0)
    expect(container.scrollTop).toBe(0)
    body.remove()
  })
})
