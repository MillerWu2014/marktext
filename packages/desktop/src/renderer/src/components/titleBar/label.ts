// Title bar shows the basename without directories. Parent directories used
// to appear as the last three path segments; deep trees made the chrome
// unreadable. The visible name also drops the last extension (`.md`).
export const titleBarAncestors = (
  _pathname: string | undefined,
  _separator: string
): string[] => []

export const titleBarDisplayName = (filename: string | undefined): string => {
  if (!filename) return ''
  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0) return filename
  return filename.slice(0, lastDot)
}
