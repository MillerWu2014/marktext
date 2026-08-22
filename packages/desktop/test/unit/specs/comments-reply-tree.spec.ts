import { describe, expect, it } from 'vitest'
import {
  buildReplyTree,
  clampReplyParentId,
  replyDescendantIds
} from 'common/comments'
import type { ICommentReply } from '@shared/types/comments'

const reply = (partial: Partial<ICommentReply> & Pick<ICommentReply, 'id'>): ICommentReply => ({
  author: { name: 'Ada' },
  createdAt: '2026-08-22T00:00:00.000Z',
  updatedAt: '2026-08-22T00:00:00.000Z',
  body: 'body',
  ...partial
})

describe('buildReplyTree', () => {
  it('keeps a flat list as first-level roots in array order', () => {
    const r1 = reply({ id: 'a', body: 'one' })
    const r2 = reply({ id: 'b', body: 'two' })
    expect(buildReplyTree([r1, r2])).toEqual([
      { reply: r1, children: [] },
      { reply: r2, children: [] }
    ])
  })

  it('nests a reply under its parentId', () => {
    const r1 = reply({ id: 'a', body: 'l1' })
    const r2 = reply({ id: 'b', parentId: 'a', body: 'l2' })
    const tree = buildReplyTree([r1, r2])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.reply.id).toBe('a')
    expect(tree[0]!.children.map((child) => child.id)).toEqual(['b'])
  })

  it('shows a third-level stored parent as a second-level sibling', () => {
    const r1 = reply({ id: 'a', body: 'l1' })
    const r2 = reply({ id: 'b', parentId: 'a', body: 'l2' })
    const r3 = reply({ id: 'c', parentId: 'b', body: 'l3' })
    const tree = buildReplyTree([r1, r2, r3])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.reply.id).toBe('a')
    expect(tree[0]!.children.map((child) => child.id)).toEqual(['b', 'c'])
  })

  it('treats a missing parent as first-level', () => {
    const r1 = reply({ id: 'a', parentId: 'gone', body: 'orphan' })
    expect(buildReplyTree([r1])).toEqual([{ reply: r1, children: [] }])
  })

  it('treats a parentId cycle as first-level', () => {
    const r1 = reply({ id: 'a', parentId: 'b', body: 'one' })
    const r2 = reply({ id: 'b', parentId: 'a', body: 'two' })
    const tree = buildReplyTree([r1, r2])
    expect(tree.map((node) => node.reply.id)).toEqual(['a', 'b'])
    expect(tree.every((node) => node.children.length === 0)).toBe(true)
  })
})

describe('clampReplyParentId', () => {
  const r1 = reply({ id: 'a', body: 'l1' })
  const r2 = reply({ id: 'b', parentId: 'a', body: 'l2' })
  const list = [r1, r2]

  it('omits parentId for a root click', () => {
    expect(clampReplyParentId(list, undefined)).toBeUndefined()
  })

  it('uses the clicked first-level id', () => {
    expect(clampReplyParentId(list, 'a')).toBe('a')
  })

  it('clamps a second-level click to the first-level ancestor', () => {
    expect(clampReplyParentId(list, 'b')).toBe('a')
  })

  it('omits parentId when the clicked id is missing', () => {
    expect(clampReplyParentId(list, 'missing')).toBeUndefined()
  })

  it('omits parentId when the clicked row has a cyclic parent', () => {
    const cyclic = [
      reply({ id: 'a', parentId: 'b', body: 'one' }),
      reply({ id: 'b', parentId: 'a', body: 'two' })
    ]
    expect(clampReplyParentId(cyclic, 'a')).toBeUndefined()
  })
})

describe('replyDescendantIds', () => {
  it('returns only the leaf id for a reply with no children', () => {
    const r1 = reply({ id: 'a', body: 'leaf' })
    expect(replyDescendantIds([r1], 'a')).toEqual(['a'])
  })

  it('includes raw-parentId descendants of the start id', () => {
    const r1 = reply({ id: 'a', body: 'l1' })
    const r2 = reply({ id: 'b', parentId: 'a', body: 'l2' })
    const r3 = reply({ id: 'c', parentId: 'b', body: 'l3' })
    expect(new Set(replyDescendantIds([r1, r2, r3], 'a'))).toEqual(new Set(['a', 'b', 'c']))
  })

  it('does not loop forever on a parentId cycle', () => {
    const r1 = reply({ id: 'a', parentId: 'b', body: 'one' })
    const r2 = reply({ id: 'b', parentId: 'a', body: 'two' })
    const ids = replyDescendantIds([r1, r2], 'a')
    expect(ids).toContain('a')
    expect(ids.length).toBeLessThanOrEqual(2)
  })
})
