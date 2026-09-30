// Title bar shows the filename only. Parent directories used to appear as
// the last three path segments; deep trees made the chrome unreadable.
export const titleBarAncestors = (
  _pathname: string | undefined,
  _separator: string
): string[] => []
