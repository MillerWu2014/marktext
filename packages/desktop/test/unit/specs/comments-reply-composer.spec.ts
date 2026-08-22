import { describe, expect, it } from 'vitest'
import { decideReplyComposerAction } from '@/util/commentReplyComposer'

describe('decideReplyComposerAction', () => {
  it('submits a filled reply on blur, matching the new-comment composer', () => {
    expect(decideReplyComposerAction('looks good', 'blur')).toBe('submit')
  })

  it('cancels an empty reply on blur', () => {
    expect(decideReplyComposerAction('   ', 'blur')).toBe('cancel')
  })

  it('submits on Enter when the box has text', () => {
    expect(decideReplyComposerAction('looks good', 'enter')).toBe('submit')
  })

  it('keeps an empty box open on Enter', () => {
    expect(decideReplyComposerAction('  ', 'enter')).toBe('keep')
  })

  it('keeps the box open on Enter during IME composition', () => {
    expect(decideReplyComposerAction('好', 'enter', true)).toBe('keep')
  })

  it('discards on Escape even when the box has text', () => {
    expect(decideReplyComposerAction('looks good', 'escape')).toBe('cancel')
  })
})
