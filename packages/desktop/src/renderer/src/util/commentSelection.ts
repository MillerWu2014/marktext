export interface SourceCursorPosition {
  line: number
  ch: number
}

export interface SourceCursor {
  anchor: SourceCursorPosition | null
  focus: SourceCursorPosition | null
}

export interface CommentDraftSelection {
  text: string
  markdown: string
  startOffset: number
  endOffset: number
}

export interface CommentSelectionEditor {
  getSelection: () => { isCollapsed: boolean } | null
  getMarkdown: () => string
  getCursorOffset: () => SourceCursor | null
}

export const lineChToOffset = (markdown: string, pos: SourceCursorPosition): number => {
  let line = 0
  let i = 0
  while (i < markdown.length && line < pos.line) {
    if (markdown.charCodeAt(i) === 10) line++
    i++
  }
  if (line !== pos.line) return markdown.length
  const lineEnd = markdown.indexOf('\n', i)
  const lineLen = (lineEnd === -1 ? markdown.length : lineEnd) - i
  return i + Math.max(0, Math.min(pos.ch, lineLen))
}

export const selectionOffsetsFromCursor = (
  markdown: string,
  cursor: SourceCursor
): { startOffset: number; endOffset: number } | null => {
  if (!cursor.anchor || !cursor.focus) return null
  const a = lineChToOffset(markdown, cursor.anchor)
  const b = lineChToOffset(markdown, cursor.focus)
  const startOffset = Math.min(a, b)
  const endOffset = Math.max(a, b)
  if (startOffset === endOffset) return null
  return { startOffset, endOffset }
}

export const commentSelectionFromEditor = (
  editor: CommentSelectionEditor
): CommentDraftSelection | null => {
  const sel = editor.getSelection()
  if (!sel || sel.isCollapsed) return null
  const markdown = editor.getMarkdown()
  // `indexOf(visible text)` always hits the first markdown occurrence; that
  // inflated offset then snaps underlines onto the last DOM duplicate.
  const cursor = editor.getCursorOffset()
  const offsets = cursor ? selectionOffsetsFromCursor(markdown, cursor) : null
  if (!offsets) return null
  const text = markdown.slice(offsets.startOffset, offsets.endOffset)
  if (!text.trim()) return null
  return { text, markdown, ...offsets }
}
