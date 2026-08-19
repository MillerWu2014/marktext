import { describe, expect, it } from 'vitest'
import { activeLeaderCommentId, shouldDrawUnderline } from 'common/comments/leader'
import type { ICommentThread } from '@shared/types/comments'

const t = (id: string, extra: Partial<ICommentThread> = {}): ICommentThread => ({
  id,
  status: 'open',
  orphaned: false,
  quote: 'x',
  prefix: '',
  suffix: '',
  startOffset: 0,
  endOffset: 1,
  createdAt: '',
  updatedAt: '',
  author: { name: 'Ada' },
  body: '',
  replies: [],
  ...extra
})

describe('comment decorations', () => {
  it('draws a leader for hover over selection', () => {
    expect(activeLeaderCommentId('sel', 'hov')).toBe('hov')
    expect(activeLeaderCommentId('sel', null)).toBe('sel')
    expect(activeLeaderCommentId(null, null)).toBeNull()
  })

  it('hides underlines for resolved unless that card is selected in the resolved filter', () => {
    const resolved = t('r', { status: 'resolved' })
    const open = t('o')
    const orphaned = t('x', { orphaned: true })
    expect(shouldDrawUnderline(open, 'open', null)).toBe(true)
    expect(shouldDrawUnderline(resolved, 'open', null)).toBe(false)
    expect(shouldDrawUnderline(resolved, 'resolved', 'r')).toBe(true)
    expect(shouldDrawUnderline(resolved, 'resolved', null)).toBe(false)
    expect(shouldDrawUnderline(orphaned, 'open', 'x')).toBe(false)
  })
})
