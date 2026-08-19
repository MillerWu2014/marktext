export const formatRelativeTime = (iso: string, now: Date = new Date()): string => {
  const then = new Date(iso).getTime()
  const diffMs = now.getTime() - then
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  if (diffMs < hour) {
    const mins = Math.max(1, Math.round(diffMs / 60000))
    return `${mins}m ago`
  }
  if (diffMs < day) {
    return `${Math.round(diffMs / hour)}h ago`
  }
  if (diffMs < 2 * day) return 'yesterday'
  return new Date(iso).toISOString().slice(0, 10)
}
