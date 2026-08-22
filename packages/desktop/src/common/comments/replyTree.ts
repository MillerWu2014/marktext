import type { ICommentReply } from '@shared/types/comments'

export interface ReplyTreeNode {
  reply: ICommentReply
  children: ICommentReply[]
}

const normalizeParentId = (parentId: unknown): string | undefined => {
  if (typeof parentId !== 'string') return undefined
  const trimmed = parentId.trim()
  return trimmed || undefined
}

const firstLevelAncestorId = (
  reply: ICommentReply,
  byId: Map<string, ICommentReply>
): string | undefined => {
  let current = reply
  const seen = new Set<string>()
  while (true) {
    if (seen.has(current.id)) return undefined
    seen.add(current.id)
    const pid = normalizeParentId(current.parentId)
    if (!pid || pid === current.id) {
      return current.id === reply.id ? undefined : current.id
    }
    const parent = byId.get(pid)
    if (!parent) {
      return current.id === reply.id ? undefined : current.id
    }
    current = parent
  }
}

export const buildReplyTree = (replies: ICommentReply[]): ReplyTreeNode[] => {
  const byId = new Map(replies.map((item) => [item.id, item]))
  const childrenByAncestor = new Map<string, ICommentReply[]>()
  const roots: ICommentReply[] = []
  for (const item of replies) {
    const ancestorId = firstLevelAncestorId(item, byId)
    if (!ancestorId) {
      roots.push(item)
      continue
    }
    const siblings = childrenByAncestor.get(ancestorId) ?? []
    siblings.push(item)
    childrenByAncestor.set(ancestorId, siblings)
  }
  return roots.map((item) => ({
    reply: item,
    children: childrenByAncestor.get(item.id) ?? []
  }))
}

export const clampReplyParentId = (
  replies: ICommentReply[],
  clickedId: string | undefined
): string | undefined => {
  if (!clickedId) return undefined
  const byId = new Map(replies.map((item) => [item.id, item]))
  const clicked = byId.get(clickedId)
  if (!clicked) return undefined
  const pid = normalizeParentId(clicked.parentId)
  if (!pid) return clicked.id
  const parent = byId.get(pid)
  if (!parent || pid === clicked.id) return undefined
  return firstLevelAncestorId(clicked, byId)
}

export const replyDescendantIds = (replies: ICommentReply[], rootId: string): string[] => {
  const childrenByParent = new Map<string, string[]>()
  for (const item of replies) {
    const pid = normalizeParentId(item.parentId)
    if (!pid) continue
    const childIds = childrenByParent.get(pid) ?? []
    childIds.push(item.id)
    childrenByParent.set(pid, childIds)
  }
  const out: string[] = []
  const stack = [rootId]
  const seen = new Set<string>()
  while (stack.length) {
    const id = stack.pop()
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    const childIds = childrenByParent.get(id)
    if (!childIds) continue
    for (const childId of childIds) {
      stack.push(childId)
    }
  }
  return out
}
