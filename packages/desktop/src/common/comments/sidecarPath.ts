export const sidecarPath = (markdownPath: string): string => `${markdownPath}.comments.json`

export const oldSidecarPathAfterRename = (
  oldMarkdownPath: string,
  newMarkdownPath: string
): { oldSidecar: string; newSidecar: string } => ({
  oldSidecar: sidecarPath(oldMarkdownPath),
  newSidecar: sidecarPath(newMarkdownPath)
})
