import {
  isTableColumnAction,
  type TableColumnAction,
  type TableColumnAlign,
  type TableColumnProbeResult
} from '@shared/types/tableColumnMenu'

export const TABLE_CELL_SELECTOR = 'td.mu-table-cell'
export const BLOCK_DOM_PROPERTY = '__MUYA_BLOCK__'

type TableCursorBlock = {
  setCursor: (start: number, end: number) => void
}

export type TableCellBlock = {
  blockName?: string
  align?: string
  columnOffset: number
  table: {
    insertColumn: (offset: number) => TableCursorBlock | null | undefined
    removeColumn: (offset: number) => TableCursorBlock | null | undefined
    alignColumn: (offset: number, value: string) => void
  }
}

type ElementsFromPoint = (x: number, y: number) => Element[]

let pendingCell: HTMLElement | null = null

const defaultElementsFromPoint: ElementsFromPoint = (x, y) => {
  if (typeof document.elementsFromPoint !== 'function') return []
  return [...document.elementsFromPoint(x, y)]
}

const normalizeAlign = (value: string | undefined): TableColumnAlign | 'none' => {
  if (value === 'left' || value === 'center' || value === 'right') return value
  return 'none'
}

export const findTableCellAtPoint = (
  x: number,
  y: number,
  elementsFromPoint: ElementsFromPoint = defaultElementsFromPoint
): HTMLElement | null => {
  for (const el of elementsFromPoint(x, y)) {
    if (!(el instanceof Element) || typeof el.closest !== 'function') continue
    const cell = el.closest(TABLE_CELL_SELECTOR)
    if (cell instanceof HTMLElement) return cell
  }
  return null
}

export const probeTableColumnContext = (
  x: number,
  y: number,
  elementsFromPoint?: ElementsFromPoint
): TableColumnProbeResult | null => {
  const cell = findTableCellAtPoint(x, y, elementsFromPoint ?? defaultElementsFromPoint)
  pendingCell = cell
  if (!cell) return null
  return {
    inTable: true,
    align: normalizeAlign(cell.dataset.align)
  }
}

export const runTableColumnAction = (block: TableCellBlock, action: TableColumnAction): void => {
  const offset = block.columnOffset
  if (action.type === 'insert') {
    const cursor = block.table.insertColumn(action.side === 'left' ? offset : offset + 1)
    cursor?.setCursor(0, 0)
    return
  }
  if (action.type === 'remove') {
    const cursor = block.table.removeColumn(offset)
    cursor?.setCursor(0, 0)
    return
  }
  // Context-menu align is an absolute set. The engine's alignColumn toggles
  // back to `none` when the same value is applied twice; skip that so a
  // checked radio does not clear the column.
  if (block.align === action.align) return
  block.table.alignColumn(offset, action.align)
}

const cellBlockFromElement = (el: HTMLElement): TableCellBlock | null => {
  const block = (el as HTMLElement & { [BLOCK_DOM_PROPERTY]?: TableCellBlock })[BLOCK_DOM_PROPERTY]
  if (!block || block.blockName !== 'table.cell' || !block.table) return null
  return block
}

export const applyTableColumnAction = (action: unknown): void => {
  if (!isTableColumnAction(action)) return
  const cell = pendingCell
  pendingCell = null
  if (!cell?.isConnected) return
  const block = cellBlockFromElement(cell)
  if (!block) return
  runTableColumnAction(block, action)
}

export const attachTableColumnContextBridge = (): void => {
  window.marktext ??= {}
  window.marktext.probeTableColumnContext = probeTableColumnContext
}

export const detachTableColumnContextBridge = (): void => {
  pendingCell = null
  if (window.marktext) {
    delete window.marktext.probeTableColumnContext
  }
}
