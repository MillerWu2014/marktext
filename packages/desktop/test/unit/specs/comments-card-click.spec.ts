import { describe, expect, it } from 'vitest'
import { isCommentCardControlTarget } from '@/util/commentCardClick'

describe('isCommentCardControlTarget', () => {
  it('ignores clicks that originate in a textarea or button', () => {
    const card = document.createElement('div')
    const textarea = document.createElement('textarea')
    const button = document.createElement('button')
    card.append(textarea, button)

    expect(isCommentCardControlTarget(textarea)).toBe(true)
    expect(isCommentCardControlTarget(button)).toBe(true)
    expect(isCommentCardControlTarget(card)).toBe(false)
    expect(isCommentCardControlTarget(null)).toBe(false)
  })
})
