import { describe, expect, it } from 'vitest'
import {
  alignedQuoteHit,
  bindComment,
  bindComments,
  extractQuoteContext,
  followComment,
  formatRelativeTime,
  oldSidecarPathAfterRename,
  pickOverlappingComment,
  sidecarPath
} from 'common/comments'
import type { ICommentThread } from '@shared/types/comments'

const thread = (partial: Partial<ICommentThread> = {}): ICommentThread => ({
  id: 'c1',
  status: 'open',
  orphaned: false,
  quote: 'budget',
  prefix: 'the ',
  suffix: ' before',
  startOffset: 4,
  endOffset: 10,
  createdAt: '2026-08-19T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
  author: { name: 'Ada' },
  body: 'check this',
  replies: [],
  ...partial
})

describe('sidecarPath', () => {
  it('appends .comments.json to the markdown path', () => {
    expect(sidecarPath('/docs/notes.md')).toBe('/docs/notes.md.comments.json')
  })

  it('returns old and new sidecar paths after Save As', () => {
    expect(oldSidecarPathAfterRename('/a/old.md', '/b/new.md')).toEqual({
      oldSidecar: '/a/old.md.comments.json',
      newSidecar: '/b/new.md.comments.json'
    })
  })
})

describe('extractQuoteContext', () => {
  it('captures up to 32 chars of prefix and suffix', () => {
    const md = 'aaa the budget before Friday zzz'
    const start = md.indexOf('budget')
    const end = start + 'budget'.length
    expect(extractQuoteContext(md, start, end)).toEqual({
      quote: 'budget',
      prefix: 'aaa the ',
      suffix: ' before Friday zzz',
      startOffset: start,
      endOffset: end
    })
  })
})

describe('bindComment', () => {
  it('binds a unique prefix+quote+suffix match', () => {
    const one = 'Please review the budget before Friday.'
    const t = thread({
      quote: 'review the budget',
      prefix: 'Please ',
      suffix: ' before Friday.',
      startOffset: 0
    })
    const bound = bindComment(one, t)
    expect(bound.orphaned).toBe(false)
    expect(one.slice(bound.startOffset, bound.endOffset)).toBe('review the budget')
  })

  it('falls back to a unique quote match', () => {
    const one = 'xxx budget yyy'
    const bound = bindComment(one, thread({ prefix: 'nope ', suffix: ' nope' }))
    expect(bound.orphaned).toBe(false)
    expect(bound.startOffset).toBe(one.indexOf('budget'))
  })

  it('picks the quote closest to startOffset when duplicates exist', () => {
    const mdDup = 'budget one then budget two'
    const second = mdDup.lastIndexOf('budget')
    const bound = bindComment(mdDup, thread({ prefix: '', suffix: '', startOffset: second }))
    expect(bound.startOffset).toBe(second)
  })

  it('maps a markdown hint onto the matching occurrence in a shorter haystack', () => {
    const markdown = '| header | col |\n| --- | --- |\n| foo | x |\n| y | foo |'
    const first = markdown.indexOf('foo')
    const cells = 'headercolfooxyfoo'
    expect(alignedQuoteHit(cells, 'foo', first, markdown)).toBe(cells.indexOf('foo'))
    expect(alignedQuoteHit(cells, 'foo', markdown.lastIndexOf('foo'), markdown)).toBe(
      cells.lastIndexOf('foo')
    )
  })

  it('marks missing quotes orphaned', () => {
    const bound = bindComment('nothing here', thread())
    expect(bound.orphaned).toBe(true)
  })
})

describe('followComment', () => {
  it('keeps a match when surrounding text is unchanged', () => {
    const md = 'the budget before'
    const bound = followComment(md, thread({ startOffset: 4, endOffset: 10 }))
    expect(bound.orphaned).toBe(false)
    expect(bound.quote).toBe('budget')
  })

  it('updates the quote when the interior text changes but bookends remain', () => {
    const original = thread({
      quote: 'budget review',
      prefix: 'the ',
      suffix: ' before',
      startOffset: 4,
      endOffset: 17
    })
    const md = 'the budget and timeline before'
    const bound = followComment(md, original)
    expect(bound.orphaned).toBe(false)
    expect(bound.quote).toBe('budget and timeline')
  })

  it('orphans when the quoted span is gone', () => {
    const bound = followComment('the before', thread())
    expect(bound.orphaned).toBe(true)
  })
})

describe('bindComments', () => {
  it('rebinds every thread against the document', () => {
    const md = 'the budget before'
    const [a] = bindComments(md, [thread()])
    expect(a!.orphaned).toBe(false)
  })
})

describe('pickOverlappingComment', () => {
  it('picks the tightest range, then the later one', () => {
    const a = thread({ id: 'a', startOffset: 0, endOffset: 10, orphaned: false })
    const b = thread({ id: 'b', startOffset: 2, endOffset: 6, orphaned: false })
    const c = thread({ id: 'c', startOffset: 2, endOffset: 6, orphaned: false })
    expect(pickOverlappingComment([a, b, c], 4)?.id).toBe('c')
  })
})

describe('formatRelativeTime', () => {
  it('formats hours-ago and yesterday', () => {
    const now = new Date('2026-08-19T12:00:00.000Z')
    expect(formatRelativeTime('2026-08-19T10:00:00.000Z', now)).toBe('2h ago')
    expect(formatRelativeTime('2026-08-18T12:00:00.000Z', now)).toBe('yesterday')
  })
})
