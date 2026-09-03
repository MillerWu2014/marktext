import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  findQuoteDomRange,
  prepareQuoteSearch,
  rectsForQuoteRange
} from '@/util/commentQuoteDom'

describe('findQuoteDomRange', () => {
  it('returns null for an empty quote', () => {
    const root = document.createElement('div')
    root.textContent = 'hello world'
    expect(findQuoteDomRange(prepareQuoteSearch(root), '', 0)).toBeNull()
  })

  it('returns null when the quote is missing from the DOM', () => {
    const root = document.createElement('div')
    root.textContent = 'hello world'
    expect(findQuoteDomRange(prepareQuoteSearch(root), 'nope', 0)).toBeNull()
  })

  it('locates a unique quote inside a single text node', () => {
    const root = document.createElement('div')
    root.textContent = 'hello world'
    const match = findQuoteDomRange(prepareQuoteSearch(root), 'world', 0)
    expect(match).not.toBeNull()
    expect(match!.plainTextStart).toBe('hello world'.indexOf('world'))
    expect(match!.startNode).toBe(root.firstChild)
    expect(match!.startOffset).toBe('hello '.length)
    expect(match!.endOffset).toBe('hello world'.length)
  })

  it('picks the duplicate quote closest to the hint offset', () => {
    // 'ab' at 0 and 7; hint 8 is nearer the second occurrence.
    const root = document.createElement('div')
    root.textContent = 'ab_____ab'
    const match = findQuoteDomRange(prepareQuoteSearch(root), 'ab', 8)
    expect(match!.plainTextStart).toBe(7)
  })

  it('prefers the later duplicate on a tied distance', () => {
    // 'ab' at 0 and 4; hint 2 is equidistant from both.
    const root = document.createElement('div')
    root.textContent = 'abxxab'
    const match = findQuoteDomRange(prepareQuoteSearch(root), 'ab', 2)
    expect(match!.plainTextStart).toBe(4)
  })

  it('maps a markdown offset onto the matching DOM occurrence when table syntax inflates the hint', () => {
    // GFM pipes/alignment make markdown offsets much larger than concatenated
    // cell text. Treating the markdown hint as a DOM offset picks the last
    // 'foo' even when the comment was created on the first cell.
    const markdown = '| header | col |\n| --- | --- |\n| foo | x |\n| y | foo |'
    const first = markdown.indexOf('foo')
    const second = markdown.lastIndexOf('foo')
    const root = document.createElement('div')
    root.textContent = 'headercolfooxyfoo'
    const index = prepareQuoteSearch(root)

    expect(findQuoteDomRange(index, 'foo', first, markdown)!.plainTextStart).toBe(
      'headercol'.length
    )
    expect(findQuoteDomRange(index, 'foo', second, markdown)!.plainTextStart).toBe(
      'headercolfooxy'.length
    )
  })

  it('ignores chrome text outside .mu-content when locating a quote', () => {
    const root = document.createElement('div')
    const chrome = document.createElement('div')
    chrome.className = 'mu-front-button'
    chrome.textContent = 'foo'
    const content = document.createElement('span')
    content.className = 'mu-content'
    content.textContent = 'bar foo'
    root.append(chrome, content)

    const match = findQuoteDomRange(prepareQuoteSearch(root), 'foo', 0)
    expect(match!.startNode).toBe(content.firstChild)
    expect(match!.plainTextStart).toBe('bar '.length)
  })

  it('reuses one prepared index for several quotes', () => {
    const root = document.createElement('div')
    root.textContent = 'alpha beta gamma'
    const index = prepareQuoteSearch(root)

    expect(findQuoteDomRange(index, 'alpha', 0)!.plainTextStart).toBe(0)
    expect(findQuoteDomRange(index, 'gamma', 0)!.plainTextStart).toBe('alpha beta '.length)
  })

  it('spans a match across two adjacent text nodes', () => {
    const root = document.createElement('div')
    const first = document.createTextNode('hello ')
    const second = document.createTextNode('world')
    root.appendChild(first)
    root.appendChild(second)

    const match = findQuoteDomRange(prepareQuoteSearch(root), 'lo wor', 0)
    expect(match).not.toBeNull()
    expect(match!.startNode).toBe(first)
    expect(match!.startOffset).toBe(3)
    expect(match!.endNode).toBe(second)
    expect(match!.endOffset).toBe(3)
  })
})

describe('rectsForQuoteRange', () => {
  // jsdom doesn't implement layout, so Range.prototype has no getClientRects
  // at all; stub it directly rather than spying on a non-existent method.
  const originalGetClientRects = Range.prototype.getClientRects

  afterEach(() => {
    Range.prototype.getClientRects = originalGetClientRects
  })

  it('maps client rects into overlay-relative left/top/width/height', () => {
    const root = document.createElement('div')
    root.textContent = 'hello world'
    const match = findQuoteDomRange(prepareQuoteSearch(root), 'world', 0)!

    const fakeRect = { left: 100, top: 50, width: 30, height: 16 } as DOMRect
    Range.prototype.getClientRects = vi.fn(() => [fakeRect] as unknown as DOMRectList)

    const overlay = document.createElement('div')
    overlay.getBoundingClientRect = () => ({ left: 10, top: 20, width: 0, height: 0 }) as DOMRect

    const rects = rectsForQuoteRange(match, 'c1', 6, 11, overlay)
    expect(rects).toHaveLength(1)
    expect(rects[0]).toMatchObject({
      key: 'c1-0',
      commentId: 'c1',
      startOffset: 6,
      endOffset: 11,
      style: { left: '90px', top: '30px', width: '30px', height: '16px' }
    })
  })

  it('returns one rect per client rect when a quote wraps onto multiple lines', () => {
    const root = document.createElement('div')
    root.textContent = 'hello world'
    const match = findQuoteDomRange(prepareQuoteSearch(root), 'world', 0)!

    const rectA = { left: 0, top: 0, width: 10, height: 16 } as DOMRect
    const rectB = { left: 0, top: 16, width: 20, height: 16 } as DOMRect
    Range.prototype.getClientRects = vi.fn(() => [rectA, rectB] as unknown as DOMRectList)

    const overlay = document.createElement('div')
    overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect

    const rects = rectsForQuoteRange(match, 'c1', 6, 11, overlay)
    expect(rects.map((r) => r.key)).toEqual(['c1-0', 'c1-1'])
  })

  it('drops collapsed and out-of-cell table ghost rects from getClientRects', () => {
    const cell = document.createElement('span')
    cell.className = 'mu-content'
    cell.textContent = '机型 (IATA)'
    const root = document.createElement('div')
    root.appendChild(cell)
    const match = findQuoteDomRange(prepareQuoteSearch(root), '机型 (IATA)', 0)!

    cell.getBoundingClientRect = () =>
      ({ left: 24, top: 92, right: 110, bottom: 110, width: 86, height: 18 }) as DOMRect

    const ghostHeader = { left: 400, top: 40, width: 48, height: 0, right: 448, bottom: 40 } as DOMRect
    const ghostColumn = { left: 400, top: 40, width: 80, height: 16, right: 480, bottom: 56 } as DOMRect
    const quote = { left: 24, top: 92, width: 86, height: 18, right: 110, bottom: 110 } as DOMRect
    Range.prototype.getClientRects = vi.fn(
      () => [ghostHeader, ghostColumn, quote] as unknown as DOMRectList
    )

    const overlay = document.createElement('div')
    overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect

    const rects = rectsForQuoteRange(match, 'c1', 0, 8, overlay)
    expect(rects).toHaveLength(1)
    expect(rects[0]!.style).toMatchObject({ left: '24px', top: '92px', width: '86px', height: '18px' })
  })
})
