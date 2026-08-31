import { describe, expect, it } from 'vitest'
import {
  commentSelectionFromEditor,
  selectionOffsetsFromCursor
} from '@/util/commentSelection'

describe('selectionOffsetsFromCursor', () => {
  it('maps a source cursor onto the selected duplicate, not indexOf', () => {
    const markdown = 'foo then foo again'
    const second = markdown.lastIndexOf('foo')
    expect(markdown.indexOf('foo')).not.toBe(second)

    const offsets = selectionOffsetsFromCursor(markdown, {
      anchor: { line: 0, ch: second },
      focus: { line: 0, ch: second + 3 }
    })
    expect(offsets).toEqual({ startOffset: second, endOffset: second + 3 })
  })

  it('orders a backward selection so start is before end', () => {
    const markdown = 'hello world'
    const offsets = selectionOffsetsFromCursor(markdown, {
      anchor: { line: 0, ch: 11 },
      focus: { line: 0, ch: 6 }
    })
    expect(offsets).toEqual({ startOffset: 6, endOffset: 11 })
  })

  it('counts newlines when converting line/ch to an offset', () => {
    const markdown = 'alpha\n\nbeta'
    const offsets = selectionOffsetsFromCursor(markdown, {
      anchor: { line: 2, ch: 0 },
      focus: { line: 2, ch: 4 }
    })
    expect(offsets).toEqual({ startOffset: 'alpha\n\n'.length, endOffset: markdown.length })
  })
})

describe('commentSelectionFromEditor', () => {
  const editor = (markdown: string, start: number, end: number) => {
    const toLineCh = (offset: number) => {
      const line = markdown.slice(0, offset).split('\n').length - 1
      const ch = offset - (markdown.lastIndexOf('\n', offset - 1) + 1)
      return { line, ch }
    }
    return {
      getSelection: () => ({ isCollapsed: start === end }),
      getMarkdown: () => markdown,
      getCursorOffset: () => ({
        anchor: toLineCh(start),
        focus: toLineCh(end)
      })
    }
  }

  it('stores offsets for the selected occurrence of duplicate text', () => {
    const markdown = 'review foo then review foo again'
    const second = markdown.lastIndexOf('foo')
    const selection = commentSelectionFromEditor(editor(markdown, second, second + 3))
    expect(selection).not.toBeNull()
    expect(selection!.startOffset).toBe(second)
    expect(selection!.endOffset).toBe(second + 3)
    expect(selection!.text).toBe('foo')
    expect(selection!.startOffset).not.toBe(markdown.indexOf('foo'))
  })

  it('returns null when the selection is collapsed', () => {
    expect(commentSelectionFromEditor(editor('hello', 1, 1))).toBeNull()
  })
})
