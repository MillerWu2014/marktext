export const applyCommentsDirtyToTab = (
  tab: { isSaved?: boolean } | null | undefined,
  dirty: boolean
): void => {
  if (!tab || !dirty) return
  tab.isSaved = false
}
