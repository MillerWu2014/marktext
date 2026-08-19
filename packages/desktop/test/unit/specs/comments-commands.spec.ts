import { describe, expect, it } from 'vitest'
import COMMANDS from 'common/commands/constants'
import keybindingsLinux from 'main_renderer/keyboard/keybindingsLinux'
import keybindingsWindows from 'main_renderer/keyboard/keybindingsWindows'
import keybindingsDarwin from 'main_renderer/keyboard/keybindingsDarwin'
import { isEqualAccelerator } from 'common/keybinding'

describe('comments commands', () => {
  it('defines edit.new-comment and view.toggle-comments command ids', () => {
    expect(COMMANDS.EDIT_NEW_COMMENT).toBe('edit.new-comment')
    expect(COMMANDS.VIEW_TOGGLE_COMMENTS).toBe('view.toggle-comments')
  })

  it('binds platform accelerators for new comment and toggle comments', () => {
    expect(isEqualAccelerator(keybindingsLinux.get('edit.new-comment'), 'Ctrl+Shift+M')).toBe(true)
    expect(isEqualAccelerator(keybindingsWindows.get('edit.new-comment'), 'Ctrl+Alt+M')).toBe(true)
    expect(isEqualAccelerator(keybindingsDarwin.get('edit.new-comment'), 'Command+Alt+M')).toBe(true)

    expect(isEqualAccelerator(keybindingsLinux.get('view.toggle-comments'), 'Ctrl+Shift+Alt+C')).toBe(true)
    expect(isEqualAccelerator(keybindingsWindows.get('view.toggle-comments'), 'Ctrl+Shift+Alt+C')).toBe(true)
    expect(isEqualAccelerator(keybindingsDarwin.get('view.toggle-comments'), 'Command+Shift+Alt+C')).toBe(true)
  })
})
