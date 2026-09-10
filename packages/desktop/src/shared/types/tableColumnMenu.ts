export type TableColumnAlign = 'left' | 'center' | 'right'

export type TableColumnAction =
  | { type: 'insert'; side: 'left' | 'right' }
  | { type: 'remove' }
  | { type: 'align'; align: TableColumnAlign }

export interface TableColumnProbeResult {
  inTable: true
  align: TableColumnAlign | 'none'
}

export const isTableColumnAction = (value: unknown): value is TableColumnAction => {
  if (!value || typeof value !== 'object') return false
  const action = value as { type?: unknown; side?: unknown; align?: unknown }
  if (action.type === 'insert') return action.side === 'left' || action.side === 'right'
  if (action.type === 'remove') return true
  if (action.type === 'align') {
    return action.align === 'left' || action.align === 'center' || action.align === 'right'
  }
  return false
}

export const isTableColumnProbeResult = (value: unknown): value is TableColumnProbeResult => {
  if (!value || typeof value !== 'object') return false
  const probe = value as { inTable?: unknown; align?: unknown }
  return (
    probe.inTable === true &&
    (probe.align === 'none' ||
      probe.align === 'left' ||
      probe.align === 'center' ||
      probe.align === 'right')
  )
}

export interface TableColumnMenuItemEntry {
  kind: 'item'
  id: string
  labelKey: string
  action: TableColumnAction
  checked?: boolean
  type?: 'radio'
}

export type TableColumnMenuEntry =
  | { kind: 'separator' }
  | TableColumnMenuItemEntry

export const tableColumnMenuEntries = (
  probe: TableColumnProbeResult | null
): TableColumnMenuEntry[] => {
  if (!probe) return []

  const align = probe.align
  return [
    {
      kind: 'item',
      id: 'insertColumnLeftMenuItem',
      labelKey: 'contextMenu.insertColumnLeft',
      action: { type: 'insert', side: 'left' }
    },
    {
      kind: 'item',
      id: 'insertColumnRightMenuItem',
      labelKey: 'contextMenu.insertColumnRight',
      action: { type: 'insert', side: 'right' }
    },
    {
      kind: 'item',
      id: 'deleteColumnMenuItem',
      labelKey: 'contextMenu.deleteColumn',
      action: { type: 'remove' }
    },
    { kind: 'separator' },
    {
      kind: 'item',
      id: 'alignColumnLeftMenuItem',
      labelKey: 'contextMenu.alignColumnLeft',
      action: { type: 'align', align: 'left' },
      type: 'radio',
      checked: align === 'left'
    },
    {
      kind: 'item',
      id: 'alignColumnCenterMenuItem',
      labelKey: 'contextMenu.alignColumnCenter',
      action: { type: 'align', align: 'center' },
      type: 'radio',
      checked: align === 'center'
    },
    {
      kind: 'item',
      id: 'alignColumnRightMenuItem',
      labelKey: 'contextMenu.alignColumnRight',
      action: { type: 'align', align: 'right' },
      type: 'radio',
      checked: align === 'right'
    },
    { kind: 'separator' }
  ]
}
