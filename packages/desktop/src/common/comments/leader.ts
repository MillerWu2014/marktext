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

export interface LeaderBox {
  left: number
  top: number
  width: number
  height: number
}

// Range.getClientRects() inside a table often prepends collapsed or
// column-header ghosts. Drop those, then pick the box whose vertical
// center is nearest the card; a vertical tie prefers the tighter box
// so a full-row cell rect loses to the glyph box.
export const pickLeaderBox = (boxes: LeaderBox[], card: LeaderBox): LeaderBox | null => {
  const usable = boxes.filter((box) => box.width >= 1 && box.height >= 1)
  if (!usable.length) return null

  const cardMid = card.top + card.height / 2
  return usable.reduce((best, box) => {
    const bestDist = Math.abs(best.top + best.height / 2 - cardMid)
    const dist = Math.abs(box.top + box.height / 2 - cardMid)
    if (dist < bestDist) return box
    if (dist === bestDist && box.width < best.width) return box
    return best
  })
}

export const leaderPath = (
  from: { x: number; y: number },
  to: { x: number; y: number }
): string => `M ${from.x} ${from.y} C ${from.x + 40} ${from.y}, ${to.x - 40} ${to.y}, ${to.x} ${to.y}`
