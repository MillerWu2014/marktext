import { type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { t } from '../../i18n'
import { SEPARATOR } from './menuItems'
import {
  tableColumnMenuEntries,
  type TableColumnProbeResult
} from '@shared/types/tableColumnMenu'

export const getTableColumnMenuItems = (
  probe: TableColumnProbeResult | null
): MenuItemConstructorOptions[] => {
  return tableColumnMenuEntries(probe).map((entry) => {
    if (entry.kind === 'separator') return SEPARATOR
    const item: MenuItemConstructorOptions = {
      id: entry.id,
      label: t(entry.labelKey),
      click(_menuItem, targetWindow) {
        if (targetWindow) {
          ;(targetWindow as BrowserWindow).webContents.send('mt::cm-table-column', entry.action)
        }
      }
    }
    if (entry.type === 'radio') {
      item.type = 'radio'
      item.checked = entry.checked === true
    }
    return item
  })
}
