export const EDITOR_ZOOM_MIN = 0.5
export const EDITOR_ZOOM_MAX = 3
export const EDITOR_ZOOM_STEP = 0.125
export const EDITOR_ZOOM_DEFAULT = 1

export type EditorZoomDirection = 'in' | 'out' | 'reset'

export const clampEditorZoom = (factor: number): number => {
  if (!Number.isFinite(factor)) return EDITOR_ZOOM_DEFAULT
  const quantized = Math.round(factor / EDITOR_ZOOM_STEP) * EDITOR_ZOOM_STEP
  const clamped = Math.min(EDITOR_ZOOM_MAX, Math.max(EDITOR_ZOOM_MIN, quantized))
  return Number(clamped.toFixed(3))
}

export const nextEditorZoom = (
  current: number,
  direction: EditorZoomDirection
): number => {
  if (direction === 'reset') return EDITOR_ZOOM_DEFAULT
  const base = Number.isFinite(current) ? current : EDITOR_ZOOM_DEFAULT
  const delta = direction === 'in' ? EDITOR_ZOOM_STEP : -EDITOR_ZOOM_STEP
  return clampEditorZoom(base + delta)
}

// Chromium `zoom` participates in layout, so scroll height grows with the
// content. `transform: scale` would leave a blank band and desync scrolling.
export const editorZoomStyle = (factor: number): { zoom: number } => ({
  zoom: clampEditorZoom(factor)
})
