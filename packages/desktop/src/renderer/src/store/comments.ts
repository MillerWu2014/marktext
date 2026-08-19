import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { bindComments, extractQuoteContext, followComment } from 'common/comments'
import type { CommentStatus, ICommentThread } from '@shared/types/comments'
import bus from '../bus'
import { deepClone } from '@/util'
import { applyCommentsDirtyToTab } from './commentsDirty'

interface DraftSelection {
  text: string
  markdown: string
  startOffset: number
  endOffset: number
}

interface CommentDraft {
  id: string
  authorName: string
  selection: DraftSelection
}

const sortThreads = (threads: ICommentThread[]): ICommentThread[] =>
  [...threads].sort((a, b) => {
    const sa = a.orphaned ? Number.MAX_SAFE_INTEGER : a.startOffset
    const sb = b.orphaned ? Number.MAX_SAFE_INTEGER : b.startOffset
    return sa - sb
  })

interface CommentsDirtyEditorStore {
  tabs: Array<{ id: string; isSaved?: boolean }>
  currentFile?: { id: string; isSaved?: boolean } | null
}

export const syncCommentsDirty = (
  editorStore: CommentsDirtyEditorStore,
  tabId: string,
  dirty: boolean
): void => {
  if (!dirty) return
  const tab = editorStore.tabs.find((t) => t.id === tabId)
  applyCommentsDirtyToTab(tab, dirty)
  if (editorStore.currentFile?.id === tabId) {
    applyCommentsDirtyToTab(editorStore.currentFile, dirty)
  }
}

export const useCommentsStore = defineStore('comments', () => {
  const byTab = ref<Record<string, ICommentThread[]>>({})
  const drafts = ref<Record<string, CommentDraft>>({})
  const dirtyTabs = ref<Record<string, boolean>>({})
  const activeTabId = ref<string | null>(null)
  const filter = ref<'open' | 'resolved'>('open')
  const selectedId = ref<string | null>(null)
  const hoveredId = ref<string | null>(null)

  const ensureTab = (tabId: string): ICommentThread[] => {
    if (!byTab.value[tabId]) {
      byTab.value[tabId] = []
    }
    return byTab.value[tabId]
  }

  const markDirty = (tabId: string): void => {
    dirtyTabs.value[tabId] = true
    bus.emit('comments:dirty', tabId)
  }

  const clearDirty = (tabId: string): void => {
    delete dirtyTabs.value[tabId]
  }

  const isDirty = (tabId: string): boolean => !!dirtyTabs.value[tabId]

  const threadsForTab = (tabId: string): ICommentThread[] => byTab.value[tabId] ?? []

  const threadsForActiveTab = computed(() =>
    activeTabId.value ? threadsForTab(activeTabId.value) : []
  )

  const visibleThreads = computed(() => {
    if (!activeTabId.value) return []
    let threads = threadsForTab(activeTabId.value)
    threads =
      filter.value === 'open'
        ? threads.filter((t) => t.status === 'open')
        : threads.filter((t) => t.status === 'resolved')
    return sortThreads(threads)
  })

  const draftForTab = (tabId: string): ICommentThread | null => {
    const draft = drafts.value[tabId]
    if (!draft) return null
    const ctx = extractQuoteContext(
      draft.selection.markdown,
      draft.selection.startOffset,
      draft.selection.endOffset
    )
    return {
      id: draft.id,
      status: 'open',
      orphaned: false,
      ...ctx,
      createdAt: '',
      updatedAt: '',
      author: { name: draft.authorName },
      body: '',
      replies: []
    }
  }

  const createDraft = (opts: {
    tabId: string
    sourceCode: boolean
    authorName: string
    selection: DraftSelection
  }): string | null => {
    if (opts.sourceCode) return null
    if (!opts.selection.text.trim()) return null
    const id = crypto.randomUUID()
    drafts.value[opts.tabId] = {
      id,
      authorName: opts.authorName,
      selection: opts.selection
    }
    return id
  }

  const commitDraft = (tabId: string, body: string): string | null => {
    const draft = drafts.value[tabId]
    const trimmed = body.trim()
    if (!draft || !trimmed) return null

    const ctx = extractQuoteContext(
      draft.selection.markdown,
      draft.selection.startOffset,
      draft.selection.endOffset
    )
    const now = new Date().toISOString()
    const thread: ICommentThread = {
      id: draft.id,
      status: 'open',
      orphaned: false,
      ...ctx,
      createdAt: now,
      updatedAt: now,
      author: { name: draft.authorName },
      body: trimmed,
      replies: []
    }
    ensureTab(tabId).push(thread)
    delete drafts.value[tabId]
    markDirty(tabId)
    return thread.id
  }

  const discardDraft = (tabId: string): void => {
    delete drafts.value[tabId]
  }

  const findThread = (tabId: string, threadId: string): ICommentThread | undefined =>
    threadsForTab(tabId).find((t) => t.id === threadId)

  const addReply = (
    tabId: string,
    threadId: string,
    authorName: string,
    body: string
  ): void => {
    const trimmed = body.trim()
    if (!trimmed) return
    const thread = findThread(tabId, threadId)
    if (!thread) return
    const now = new Date().toISOString()
    thread.replies.push({
      id: crypto.randomUUID(),
      author: { name: authorName },
      createdAt: now,
      updatedAt: now,
      body: trimmed
    })
    thread.updatedAt = now
    markDirty(tabId)
  }

  const editThreadBody = (tabId: string, threadId: string, body: string): void => {
    const thread = findThread(tabId, threadId)
    if (!thread) return
    thread.body = body
    thread.updatedAt = new Date().toISOString()
    markDirty(tabId)
  }

  const setStatus = (tabId: string, threadId: string, status: CommentStatus): void => {
    const thread = findThread(tabId, threadId)
    if (!thread) return
    thread.status = status
    thread.updatedAt = new Date().toISOString()
    markDirty(tabId)
  }

  const deleteThread = (
    tabId: string,
    threadId: string,
    confirmed: boolean
  ): { needsConfirm: boolean } => {
    const threads = threadsForTab(tabId)
    const index = threads.findIndex((t) => t.id === threadId)
    if (index === -1) return { needsConfirm: false }
    const thread = threads[index]!
    if (thread.replies.length > 0 && !confirmed) {
      return { needsConfirm: true }
    }
    threads.splice(index, 1)
    markDirty(tabId)
    return { needsConfirm: false }
  }

  const deleteReply = (tabId: string, threadId: string, replyId: string): void => {
    const thread = findThread(tabId, threadId)
    if (!thread) return
    const index = thread.replies.findIndex((r) => r.id === replyId)
    if (index === -1) return
    thread.replies.splice(index, 1)
    thread.updatedAt = new Date().toISOString()
    markDirty(tabId)
  }

  const switchTab = (tabId: string | null): void => {
    activeTabId.value = tabId
  }

  const setFilter = (value: 'open' | 'resolved'): void => {
    filter.value = value
  }

  const select = (id: string | null): void => {
    selectedId.value = id
  }

  const hover = (id: string | null): void => {
    hoveredId.value = id
  }

  const loadForTab = async(
    tabId: string,
    pathname: string,
    markdown: string
  ): Promise<void> => {
    // An untitled tab has no sidecar to read and no path to derive one from.
    if (!pathname) {
      byTab.value[tabId] = []
      clearDirty(tabId)
      return
    }
    try {
      const file = await window.electron.ipcRenderer.invoke('mt::comments::load', pathname)
      if (!file) {
        byTab.value[tabId] = []
      } else {
        byTab.value[tabId] = bindComments(markdown, file.comments)
      }
      clearDirty(tabId)
    } catch (err) {
      byTab.value[tabId] = []
      clearDirty(tabId)
      throw err
    }
  }

  // A clean tab is never written: that keeps a corrupt sidecar (loaded as an
  // empty list) on disk until the user creates comments, and stops a plain
  // markdown save from touching a file that holds no comments.
  const persistForPath = async(
    tabId: string,
    pathname: string,
    opts?: { force?: boolean }
  ): Promise<void> => {
    if (!pathname) return
    const dirty = isDirty(tabId)
    if (!opts?.force && !dirty) return
    const threads = threadsForTab(tabId)
    if (threads.length === 0) {
      if (!dirty) return
      await window.electron.ipcRenderer.invoke('mt::comments::remove', pathname)
      clearDirty(tabId)
    } else {
      // Pinia keeps threads as Vue proxies; Electron IPC structured-clone
      // cannot copy them (DataCloneError), so send a plain snapshot.
      await window.electron.ipcRenderer.invoke(
        'mt::comments::save',
        pathname,
        deepClone({ version: 1 as const, comments: threads })
      )
      clearDirty(tabId)
    }
  }

  const unloadTab = (tabId: string): void => {
    delete byTab.value[tabId]
    delete drafts.value[tabId]
    clearDirty(tabId)
    if (activeTabId.value === tabId) {
      activeTabId.value = null
    }
  }

  const followMarkdown = (tabId: string, markdown: string): void => {
    const threads = ensureTab(tabId)
    let becameOrphaned = false
    for (let i = 0; i < threads.length; i++) {
      const before = threads[i]!
      const after = followComment(markdown, before)
      threads[i] = after
      if (!before.orphaned && after.orphaned) {
        becameOrphaned = true
      }
    }
    if (becameOrphaned) {
      markDirty(tabId)
    }
  }

  return {
    filter,
    selectedId,
    hoveredId,
    visibleThreads,
    threadsForActiveTab,
    threadsForTab,
    isDirty,
    markDirty,
    clearDirty,
    createDraft,
    commitDraft,
    discardDraft,
    addReply,
    editThreadBody,
    setStatus,
    deleteThread,
    deleteReply,
    switchTab,
    setFilter,
    select,
    hover,
    draftForTab,
    loadForTab,
    persistForPath,
    unloadTab,
    followMarkdown
  }
})

export const tryPersistForPath = async(
  tabId: string,
  pathname: string,
  opts?: { force?: boolean }
): Promise<boolean> => {
  try {
    await useCommentsStore().persistForPath(tabId, pathname, opts)
    return true
  } catch (err) {
    console.error('Failed to persist comments sidecar', err)
    return false
  }
}
