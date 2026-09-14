import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { on: () => {}, emit: () => {}, handle: () => {} },
  BrowserWindow: { fromWebContents: () => undefined, getAllWindows: () => [] }
}))
vi.mock('electron-log', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))

import COMMANDS from 'common/commands/constants'
import keybindingsLinux from 'main_renderer/keyboard/keybindingsLinux'
import keybindingsWindows from 'main_renderer/keyboard/keybindingsWindows'
import keybindingsDarwin from 'main_renderer/keyboard/keybindingsDarwin'
import { isEqualAccelerator } from 'common/keybinding'
import viewTemplate from 'main_renderer/menu/templates/view'

const accelerator = (bindings: Map<string, string>, command: string): string => {
  const value = bindings.get(command)
  if (!value) throw new Error(`No accelerator bound for ${command}`)
  return value
}

describe('editor zoom commands', () => {
  it('defines editor-only zoom command ids distinct from window zoom', () => {
    expect(COMMANDS.VIEW_EDITOR_ZOOM_IN).toBe('view.editor-zoom-in')
    expect(COMMANDS.VIEW_EDITOR_ZOOM_OUT).toBe('view.editor-zoom-out')
    expect(COMMANDS.VIEW_EDITOR_ZOOM_RESET).toBe('view.editor-zoom-reset')
    expect(COMMANDS.WINDOW_ZOOM_IN).toBe('window.zoomIn')
    expect(COMMANDS.WINDOW_ZOOM_OUT).toBe('window.zoomOut')
  })

  it('binds presentation accelerators that avoid heading and paragraph shortcuts', () => {
    expect(isEqualAccelerator(accelerator(keybindingsDarwin, 'view.editor-zoom-in'), 'Command+Shift+=')).toBe(true)
    expect(isEqualAccelerator(accelerator(keybindingsDarwin, 'view.editor-zoom-out'), 'Command+Shift+-')).toBe(true)
    expect(isEqualAccelerator(accelerator(keybindingsDarwin, 'view.editor-zoom-reset'), 'Command+Shift+0')).toBe(true)

    expect(isEqualAccelerator(accelerator(keybindingsWindows, 'view.editor-zoom-in'), 'Ctrl+Shift+Plus')).toBe(true)
    expect(isEqualAccelerator(accelerator(keybindingsWindows, 'view.editor-zoom-out'), 'Ctrl+Shift+-')).toBe(true)
    expect(isEqualAccelerator(accelerator(keybindingsWindows, 'view.editor-zoom-reset'), 'Ctrl+Alt+0')).toBe(true)

    expect(isEqualAccelerator(accelerator(keybindingsLinux, 'view.editor-zoom-in'), 'Ctrl+Shift+Plus')).toBe(true)
    expect(isEqualAccelerator(accelerator(keybindingsLinux, 'view.editor-zoom-out'), 'Ctrl+Alt+-')).toBe(true)
    expect(isEqualAccelerator(accelerator(keybindingsLinux, 'view.editor-zoom-reset'), 'Ctrl+Alt+0')).toBe(true)
  })

  it('exposes the commands on the View menu', () => {
    const keybindings = {
      getAccelerator: (id: string) => id
    }
    const menu = viewTemplate(keybindings as never)
    const labels = JSON.stringify(menu)
    expect(labels).toContain('menu.view.editorZoomIn')
    expect(labels).toContain('menu.view.editorZoomOut')
    expect(labels).toContain('menu.view.editorActualSize')
    expect(labels).toContain('view.editor-zoom-in')
    expect(labels).toContain('view.editor-zoom-out')
    expect(labels).toContain('view.editor-zoom-reset')
  })
})
