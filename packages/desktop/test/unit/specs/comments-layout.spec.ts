import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string }
      electron?: { ipcRenderer: { send: () => void; on: () => void } }
      marktext?: { env?: { windowId?: number } }
    }
    localStorage?: Storage
  }
  w.window ??= {}
  w.window.path ??= { sep: '/' }
  w.window.electron ??= { ipcRenderer: { send: () => {}, on: () => {} } }
  w.window.marktext ??= { env: { windowId: 1 } }
})

import { useLayoutStore } from '@/store/layout'

describe('comments pane layout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('defaults closed with zero effective width', () => {
    const store = useLayoutStore()
    expect(store.showCommentsPane).toBe(false)
    expect(store.effectiveCommentsPaneWidth).toBe(0)
  })

  it('opens to at least 220px and persists width', () => {
    const store = useLayoutStore()
    store.SET_COMMENTS_PANE(true)
    expect(store.showCommentsPane).toBe(true)
    expect(store.effectiveCommentsPaneWidth).toBeGreaterThanOrEqual(220)
    store.SET_COMMENTS_PANE_WIDTH(400)
    expect(localStorage.getItem('comments-pane-width')).toBe('400')
    expect(store.effectiveCommentsPaneWidth).toBe(400)
  })

  it('TOGGLE_COMMENTS_PANE flips visibility without persisting open state', () => {
    const store = useLayoutStore()
    store.TOGGLE_COMMENTS_PANE()
    expect(store.showCommentsPane).toBe(true)
    store.TOGGLE_COMMENTS_PANE()
    expect(store.showCommentsPane).toBe(false)
  })
})
