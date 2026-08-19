import { describe, expect, it } from 'vitest'
import COMMANDS from 'common/commands/constants'
import keybindingsLinux from 'main_renderer/keyboard/keybindingsLinux'
import keybindingsWindows from 'main_renderer/keyboard/keybindingsWindows'
import keybindingsDarwin from 'main_renderer/keyboard/keybindingsDarwin'
import { isEqualAccelerator } from 'common/keybinding'

const accelerator = (bindings: Map<string, string>, command: string): string => {
  const value = bindings.get(command)
  if (!value) throw new Error(`No accelerator bound for ${command}`)
  return value
}

describe('comments commands', () => {
  it('defines edit.new-comment and view.toggle-comments command ids', () => {
    expect(COMMANDS.EDIT_NEW_COMMENT).toBe('edit.new-comment')
    expect(COMMANDS.VIEW_TOGGLE_COMMENTS).toBe('view.toggle-comments')
  })

  it('binds platform accelerators for new comment and toggle comments', () => {
    expect(isEqualAccelerator(accelerator(keybindingsLinux, 'edit.new-comment'), 'Ctrl+Shift+Alt+M')).toBe(true)
    expect(isEqualAccelerator(accelerator(keybindingsWindows, 'edit.new-comment'), 'Ctrl+Alt+M')).toBe(true)
    expect(isEqualAccelerator(accelerator(keybindingsDarwin, 'edit.new-comment'), 'Command+Alt+M')).toBe(true)

    expect(isEqualAccelerator(accelerator(keybindingsLinux, 'view.toggle-comments'), 'Ctrl+Shift+Alt+C')).toBe(true)
    expect(isEqualAccelerator(accelerator(keybindingsWindows, 'view.toggle-comments'), 'Ctrl+Shift+Alt+C')).toBe(true)
    expect(isEqualAccelerator(accelerator(keybindingsDarwin, 'view.toggle-comments'), 'Command+Shift+Alt+C')).toBe(true)
  })
})
