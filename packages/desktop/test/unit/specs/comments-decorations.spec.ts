import { describe, expect, it } from 'vitest'
import {
  activeLeaderCommentId,
  pickLeaderBox,
  shouldDrawUnderline
} from 'common/comments/leader'
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

  it('ignores collapsed table ghost rects and prefers the box nearest the card', () => {
    const ghostHeader = { left: 420, top: 40, width: 48, height: 0 }
    const ghostColumn = { left: 400, top: 40, width: 80, height: 1 }
    const quote = { left: 24, top: 92, width: 86, height: 18 }
    const card = { left: 640, top: 88, width: 220, height: 72 }
    expect(pickLeaderBox([ghostHeader, ghostColumn, quote], card)).toEqual(quote)
  })

  it('drops a collapsed header ghost even when that ghost is closer to the card', () => {
    // Screenshot case: wash sits on the cell quote, but the first getClientRects
    // box is a 0-height fragment on a header like 取值.
    const ghost = { left: 400, top: 88, width: 48, height: 0 }
    const quote = { left: 24, top: 200, width: 86, height: 18 }
    const card = { left: 640, top: 80, width: 220, height: 72 }
    expect(pickLeaderBox([ghost, quote], card)).toEqual(quote)
  })

  it('on a vertical tie picks the tighter box so a full-row table rect loses to the glyph box', () => {
    const row = { left: 20, top: 90, width: 480, height: 18 }
    const glyph = { left: 24, top: 90, width: 86, height: 18 }
    const card = { left: 640, top: 88, width: 220, height: 72 }
    expect(pickLeaderBox([row, glyph], card)).toEqual(glyph)
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
