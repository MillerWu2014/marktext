import type { ICommentThread } from '@shared/types/comments'

export const activeLeaderCommentId = (
  selectedId: string | null,
  hoveredId: string | null
): string | null => hoveredId ?? selectedId

export const shouldDrawUnderline = (
  thread: ICommentThread,
  filter: 'open' | 'resolved',
  selectedId: string | null
): boolean => {
  if (thread.orphaned) return false
  if (thread.status === 'open') return true
  return filter === 'resolved' && selectedId === thread.id
}

export const leaderPath = (
  from: { x: number; y: number },
  to: { x: number; y: number }
): string => `M ${from.x} ${from.y} C ${from.x + 40} ${from.y}, ${to.x - 40} ${to.y}, ${to.x} ${to.y}`
