import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const invoke = vi.fn()

vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      electron?: { ipcRenderer: { invoke: (...a: unknown[]) => unknown; send: () => void; on: () => void } }
      path?: { sep: string; dirname: (p: string) => string }
      marktext?: { env?: { windowId?: number } }
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', dirname: (p: string) => p }
  w.window.electron ??= {
    ipcRenderer: { invoke: (...a: unknown[]) => invoke(...a), send: () => {}, on: () => {} }
  }
  w.window.marktext ??= { env: { windowId: 1 } }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import { useCommentsStore, syncCommentsDirty, tryPersistForPath } from '@/store/comments'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import { getBlankFileState } from '@/store/help'

const selection = { text: 'budget', markdown: 'the budget before', startOffset: 4, endOffset: 10 }

describe('comments lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    invoke.mockReset()
    invoke.mockResolvedValue(null)
  })

  it('marks the editor tab unsaved when comments become dirty', () => {
    const editorStore = useEditorStore()
    const tab = getBlankFileState([], 'utf8', 'lf', 'doc')
    tab.isSaved = true
    editorStore.tabs.push(tab)
    editorStore.currentFile = tab

    const commentsStore = useCommentsStore()
    commentsStore.createDraft({ tabId: tab.id, sourceCode: false, authorName: 'Ada', selection })
    commentsStore.commitDraft(tab.id, 'please check')

    expect(tab.isSaved).toBe(false)
    expect(editorStore.currentFile?.isSaved).toBe(false)
  })

  it('does not force saved when comments are clean but markdown may still be dirty', () => {
    const editorStore = useEditorStore()
    const tab = getBlankFileState([], 'utf8', 'lf', 'doc')
    tab.isSaved = false
    editorStore.tabs.push(tab)
    editorStore.currentFile = tab

    syncCommentsDirty(editorStore, tab.id, false)

    expect(tab.isSaved).toBe(false)
  })

  it('tryPersistForPath returns false when invoke rejects', async() => {
    invoke.mockRejectedValueOnce(new Error('disk full'))
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    store.commitDraft('t1', 'body')

    const ok = await tryPersistForPath('t1', '/docs/notes.md')

    expect(ok).toBe(false)
  })

  it('marks a thread orphaned when the quote disappears', () => {
    const store = useCommentsStore()
    store.createDraft({
      tabId: 't1',
      sourceCode: false,
      authorName: 'Ada',
      selection: { text: 'budget', markdown: 'the budget before', startOffset: 4, endOffset: 10 }
    })
    store.commitDraft('t1', 'body')
    store.followMarkdown('t1', 'the before')
    expect(store.threadsForTab('t1')[0]?.orphaned).toBe(true)
  })

  it('restores sidecar comments when session tabs are restored', async() => {
    invoke.mockImplementation((channel: string) => {
      if (channel === 'mt::comments::load') {
        return Promise.resolve({
          version: 1,
          comments: [
            {
              id: 'c1',
              status: 'open',
              orphaned: false,
              quote: 'budget',
              prefix: 'the ',
              suffix: ' before',
              startOffset: 4,
              endOffset: 10,
              createdAt: '2026-08-19T00:00:00.000Z',
              updatedAt: '2026-08-19T00:00:00.000Z',
              author: { name: 'Ada' },
              body: 'please check',
              replies: []
            }
          ]
        })
      }
      return Promise.resolve(null)
    })

    const editorStore = useEditorStore()
    const commentsStore = useCommentsStore()
    const layoutStore = useLayoutStore()

    editorStore.RESTORE_BUFFERED_STATE({
      tabs: [
        {
          id: 'old-id',
          pathname: '/docs/notes.md',
          filename: 'notes.md',
          markdown: 'the budget before',
          isSaved: true
        }
      ],
      currentFileId: 'old-id'
    })

    await vi.waitFor(() => {
      const tabId = editorStore.currentFile?.id
      expect(tabId).toBeTruthy()
      expect(commentsStore.threadsForTab(tabId as string)).toHaveLength(1)
    })
    expect(layoutStore.showCommentsPane).toBe(true)
  })
})
