import { describe, expect, it } from 'vitest'
import {
  EDITOR_ZOOM_DEFAULT,
  EDITOR_ZOOM_MAX,
  EDITOR_ZOOM_MIN,
  EDITOR_ZOOM_STEP,
  clampEditorZoom,
  editorZoomStyle,
  nextEditorZoom
} from '@/util/editorZoom'

describe('clampEditorZoom', () => {
  it('returns the default for non-finite input', () => {
    expect(clampEditorZoom(Number.NaN)).toBe(EDITOR_ZOOM_DEFAULT)
    expect(clampEditorZoom(Number.POSITIVE_INFINITY)).toBe(EDITOR_ZOOM_DEFAULT)
  })

  it('clamps to the presentation range and snaps to 12.5% steps', () => {
    expect(clampEditorZoom(0.1)).toBe(EDITOR_ZOOM_MIN)
    expect(clampEditorZoom(4)).toBe(EDITOR_ZOOM_MAX)
    expect(clampEditorZoom(1.13)).toBe(1.125)
  })
})

describe('nextEditorZoom', () => {
  it('resets to 100% regardless of the current factor', () => {
    expect(nextEditorZoom(2.5, 'reset')).toBe(EDITOR_ZOOM_DEFAULT)
    expect(nextEditorZoom(EDITOR_ZOOM_MIN, 'reset')).toBe(EDITOR_ZOOM_DEFAULT)
  })

  it('steps by 12.5% and stops at the presentation bounds', () => {
    expect(nextEditorZoom(1, 'in')).toBe(1 + EDITOR_ZOOM_STEP)
    expect(nextEditorZoom(1, 'out')).toBe(1 - EDITOR_ZOOM_STEP)
    expect(nextEditorZoom(EDITOR_ZOOM_MAX, 'in')).toBe(EDITOR_ZOOM_MAX)
    expect(nextEditorZoom(EDITOR_ZOOM_MIN, 'out')).toBe(EDITOR_ZOOM_MIN)
  })
})

describe('editorZoomStyle', () => {
  it('uses Chromium zoom so the editor layout grows instead of leaving a scaled gap', () => {
    expect(editorZoomStyle(1.5)).toEqual({ zoom: 1.5 })
    expect(editorZoomStyle(0.2)).toEqual({ zoom: EDITOR_ZOOM_MIN })
  })
})
