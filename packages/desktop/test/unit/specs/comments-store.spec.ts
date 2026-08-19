import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const invoke = vi.fn()

vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      electron?: { ipcRenderer: { invoke: (...a: unknown[]) => unknown; send: () => void; on: () => void } }
      path?: { sep: string; dirname: (p: string) => string }
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', dirname: (p: string) => p }
  w.window.electron ??= {
    ipcRenderer: { invoke: (...a: unknown[]) => invoke(...a), send: () => {}, on: () => {} }
  }
})

import { useCommentsStore } from '@/store/comments'

const selection = { text: 'budget', markdown: 'the budget before', startOffset: 4, endOffset: 10 }

describe('useCommentsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    invoke.mockReset()
    invoke.mockResolvedValue(null)
  })

  it('rejects createDraft without selected text', () => {
    const store = useCommentsStore()
    expect(store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection: { ...selection, text: '  ' } })).toBeNull()
    expect(store.isDirty('t1')).toBe(false)
  })

  it('rejects createDraft in source mode', () => {
    const store = useCommentsStore()
    expect(store.createDraft({ tabId: 't1', sourceCode: true, authorName: 'Ada', selection })).toBeNull()
  })

  it('discards an empty draft without dirtying', () => {
    const store = useCommentsStore()
    const draft = store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    expect(draft).not.toBeNull()
    store.discardDraft('t1')
    expect(store.threadsForTab('t1')).toHaveLength(0)
    expect(store.isDirty('t1')).toBe(false)
  })

  it('commits a body, dirties, and lists the thread', () => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    const id = store.commitDraft('t1', 'please check')
    expect(id).toBeTruthy()
    expect(store.threadsForTab('t1')[0]?.body).toBe('please check')
    expect(store.isDirty('t1')).toBe(true)
  })

  it('adds a reply, resolves, reopens', () => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    const id = store.commitDraft('t1', 'body')!
    store.addReply('t1', id, 'Ada', 'ok')
    expect(store.threadsForTab('t1')[0]?.replies).toHaveLength(1)
    store.setStatus('t1', id, 'resolved')
    expect(store.threadsForTab('t1')[0]?.status).toBe('resolved')
    store.setStatus('t1', id, 'open')
    expect(store.threadsForTab('t1')[0]?.status).toBe('open')
  })

  it('deleteThread with replies requires confirm', () => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    const id = store.commitDraft('t1', 'body')!
    store.addReply('t1', id, 'Ada', 'ok')
    expect(store.deleteThread('t1', id, false)).toEqual({ needsConfirm: true })
    expect(store.threadsForTab('t1')).toHaveLength(1)
    expect(store.deleteThread('t1', id, true)).toEqual({ needsConfirm: false })
    expect(store.threadsForTab('t1')).toHaveLength(0)
  })

  it('switchTab swaps the visible list', () => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 'a', sourceCode: false, authorName: 'Ada', selection })
    store.commitDraft('a', 'one')
    store.createDraft({ tabId: 'b', sourceCode: false, authorName: 'Ada', selection })
    store.commitDraft('b', 'two')
    store.switchTab('a')
    expect(store.visibleThreads.map((t) => t.body)).toEqual(['one'])
    store.switchTab('b')
    expect(store.visibleThreads.map((t) => t.body)).toEqual(['two'])
  })

  it('persistForPath saves when comments exist and removes when empty', async() => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    store.commitDraft('t1', 'body')
    await store.persistForPath('t1', '/docs/notes.md')
    expect(invoke).toHaveBeenCalledWith('mt::comments::save', '/docs/notes.md', expect.objectContaining({ version: 1 }))
    store.deleteThread('t1', store.threadsForTab('t1')[0]!.id, true)
    await store.persistForPath('t1', '/docs/notes.md')
    expect(invoke).toHaveBeenCalledWith('mt::comments::remove', '/docs/notes.md')
  })

  it('sends a structured-cloneable sidecar payload over IPC', async() => {
    invoke.mockImplementation((...args: unknown[]) => {
      structuredClone(args)
      return Promise.resolve(null)
    })
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    store.commitDraft('t1', 'body')
    await expect(store.persistForPath('t1', '/docs/notes.md')).resolves.toBeUndefined()
    expect(invoke).toHaveBeenCalledWith(
      'mt::comments::save',
      '/docs/notes.md',
      expect.objectContaining({ version: 1 })
    )
  })

  it('leaves a corrupt sidecar on disk when the user never created comments', async() => {
    const store = useCommentsStore()
    invoke.mockRejectedValueOnce(new Error('unreadable'))
    await expect(store.loadForTab('t1', '/docs/notes.md', 'the budget before')).rejects.toThrow(
      'unreadable'
    )
    invoke.mockReset()
    invoke.mockResolvedValue(null)

    await store.persistForPath('t1', '/docs/notes.md')

    expect(invoke).not.toHaveBeenCalled()
  })

  it('skips persist for a comment-free tab that never went dirty', async() => {
    const store = useCommentsStore()
    await store.loadForTab('t1', '/docs/notes.md', 'the budget before')
    invoke.mockReset()
    invoke.mockResolvedValue(null)

    await store.persistForPath('t1', '/docs/notes.md')

    expect(invoke).not.toHaveBeenCalled()
  })

  it('keeps an untitled tab in memory instead of loading a sidecar', async() => {
    const store = useCommentsStore()
    await store.loadForTab('t1', '', 'the budget before')
    expect(invoke).not.toHaveBeenCalled()
    expect(store.threadsForTab('t1')).toEqual([])
  })

  it('force-saves a clean tab that still has comments', async() => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    store.commitDraft('t1', 'body')
    await store.persistForPath('t1', '/docs/notes.md')
    invoke.mockReset()
    invoke.mockResolvedValue(null)

    await store.persistForPath('t1', '/docs/other.md', { force: true })

    expect(invoke).toHaveBeenCalledWith('mt::comments::save', '/docs/other.md', expect.objectContaining({ version: 1 }))
  })

  it('force-persist of an empty clean tab neither saves nor removes', async() => {
    const store = useCommentsStore()
    await store.loadForTab('t1', '/docs/notes.md', 'the budget before')
    invoke.mockReset()
    invoke.mockResolvedValue(null)

    await store.persistForPath('t1', '/docs/other.md', { force: true })

    expect(invoke).not.toHaveBeenCalled()
  })

  it('editThreadBody updates the body, bumps updatedAt, and dirties', () => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    const id = store.commitDraft('t1', 'body')!
    const before = store.threadsForTab('t1')[0]!.updatedAt
    store.clearDirty('t1')

    store.editThreadBody('t1', id, 'revised body')

    const thread = store.threadsForTab('t1')[0]!
    expect(thread.body).toBe('revised body')
    expect(Date.parse(thread.updatedAt)).toBeGreaterThanOrEqual(Date.parse(before))
    expect(store.isDirty('t1')).toBe(true)
  })

  it('commitDraft trims the body and keeps the draft id', () => {
    const store = useCommentsStore()
    const draftId = store.createDraft({
      tabId: 't1',
      sourceCode: false,
      authorName: 'Ada',
      selection
    })
    const id = store.commitDraft('t1', '  please check  ')
    expect(id).toBe(draftId)
    expect(store.threadsForTab('t1')[0]?.body).toBe('please check')
  })

  it('addReply ignores a whitespace-only body', () => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    const id = store.commitDraft('t1', 'body')!
    store.addReply('t1', id, 'Ada', '   ')
    expect(store.threadsForTab('t1')[0]?.replies).toHaveLength(0)
  })
})
