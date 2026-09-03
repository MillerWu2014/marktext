<template>
  <div
    ref="overlayRef"
    class="comment-decorations"
  >
    <div
      v-for="rect in underlineRects"
      :key="rect.key"
      class="mt-comment-underline"
      :class="{ selected: rect.commentId === selectedId }"
      :style="rect.style"
      :data-comment-id="rect.commentId"
      :data-start="rect.startOffset"
      :data-end="rect.endOffset"
      @click.stop="handleUnderlineClick"
    />
  </div>
  <!-- `.editor-body` spans the document and the comments pane; the editor's own
       ancestors set `overflow: hidden`, which would clip the leader. -->
  <teleport
    v-if="leaderD"
    to=".editor-body"
  >
    <svg class="comment-leader">
      <path :d="leaderD" />
    </svg>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { activeLeaderCommentId, leaderPath, pickLeaderBox, shouldDrawUnderline } from 'common/comments/leader'
import { pickOverlappingComment } from 'common/comments'
import type { ICommentThread } from '@shared/types/comments'
import { useCommentsStore } from '@/store/comments'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import {
  findQuoteDomRange,
  prepareQuoteSearch,
  rectsForQuoteRange,
  setDomSelectionForRange,
  type UnderlineRect
} from '@/util/commentQuoteDom'

const props = defineProps<{
  editor: { domNode?: HTMLElement; on?: (event: string, cb: () => void) => void; off?: (event: string, cb: () => void) => void } | null
}>()

const commentsStore = useCommentsStore()
const editorStore = useEditorStore()
const layoutStore = useLayoutStore()

const { filter, selectedId, hoveredId, visibleThreads } = storeToRefs(commentsStore)
const { currentFile } = storeToRefs(editorStore)
const { showCommentsPane } = storeToRefs(layoutStore)

const overlayRef = ref<HTMLDivElement | null>(null)
const underlineRects = ref<UnderlineRect[]>([])
const leaderD = ref('')

const activeTabId = computed(() => currentFile.value?.id ?? null)

const threadsToDraw = computed((): ICommentThread[] => {
  const tabId = activeTabId.value
  if (!tabId) return []
  return commentsStore.threadsForTab(tabId).filter((thread) =>
    shouldDrawUnderline(thread, filter.value, selectedId.value)
  )
})

const getEditorRoot = (): Element | null => {
  const domNode = props.editor?.domNode
  if (!domNode) return null
  return domNode.querySelector('.mu-editor') ?? domNode
}

const getScrollContainer = (): HTMLElement | null => props.editor?.domNode ?? null

const recomputeUnderlines = (): void => {
  const root = getEditorRoot()
  const overlay = overlayRef.value
  if (!root || !overlay) {
    underlineRects.value = []
    leaderD.value = ''
    return
  }

  const searchIndex = prepareQuoteSearch(root)
  const markdown = currentFile.value?.markdown ?? ''
  const rects: UnderlineRect[] = []
  for (const thread of threadsToDraw.value) {
    const match = findQuoteDomRange(searchIndex, thread.quote, thread.startOffset, markdown)
    if (!match) continue
    rects.push(
      ...rectsForQuoteRange(match, thread.id, thread.startOffset, thread.endOffset, overlay)
    )
  }
  underlineRects.value = rects
  recomputeLeader()
}

const recomputeLeader = (): void => {
  const overlay = overlayRef.value
  const leaderHost = document.querySelector('.editor-body')
  if (!overlay || !leaderHost || !showCommentsPane.value) {
    leaderD.value = ''
    return
  }

  const leaderId = activeLeaderCommentId(selectedId.value, hoveredId.value)
  if (!leaderId) {
    leaderD.value = ''
    return
  }

  const tabId = activeTabId.value
  if (!tabId) {
    leaderD.value = ''
    return
  }

  const thread = commentsStore.threadsForTab(tabId).find((t) => t.id === leaderId)
  if (!thread || thread.orphaned) {
    leaderD.value = ''
    return
  }

  const underlineEls = overlay.querySelectorAll(`[data-comment-id="${leaderId}"]`)
  const cardEl = document.querySelector(`.comment-card[data-comment-id="${leaderId}"]`)
  if (!underlineEls.length || !cardEl) {
    leaderD.value = ''
    return
  }

  // The leader lives in `.editor-body`, so both endpoints are expressed in that
  // element's coordinate space rather than the editor overlay's.
  const hostRect = leaderHost.getBoundingClientRect()
  const cRect = cardEl.getBoundingClientRect()
  const picked = pickLeaderBox(
    Array.from(underlineEls, (el) => {
      const rect = el.getBoundingClientRect()
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    }),
    { left: cRect.left, top: cRect.top, width: cRect.width, height: cRect.height }
  )
  if (!picked || cRect.width === 0) {
    leaderD.value = ''
    return
  }

  const from = {
    x: picked.left + picked.width - hostRect.left,
    y: picked.top + picked.height / 2 - hostRect.top
  }
  const to = {
    x: cRect.left - hostRect.left,
    y: cRect.top + cRect.height / 2 - hostRect.top
  }

  leaderD.value = leaderPath(from, to)
}

const handleUnderlineClick = (event: MouseEvent): void => {
  const target = event.currentTarget as HTMLElement
  const offset = parseInt(target.dataset.start ?? '0', 10)
  const tabId = activeTabId.value
  if (!tabId) return

  const threads = commentsStore.threadsForTab(tabId).filter((t) => !t.orphaned)
  const hit = pickOverlappingComment(threads, offset)
  if (!hit) return

  commentsStore.select(hit.id)

  const root = getEditorRoot()
  if (!root) return
  const match = findQuoteDomRange(
    prepareQuoteSearch(root),
    hit.quote,
    hit.startOffset,
    currentFile.value?.markdown ?? ''
  )
  if (match) {
    setDomSelectionForRange(match)
  }
}

let scrollContainer: HTMLElement | null = null
let scrollListener: (() => void) | null = null
let commentsList: HTMLElement | null = null
let commentsListScrollListener: (() => void) | null = null
let jsonChangeListener: (() => void) | null = null
let resizeListener: (() => void) | null = null
let rafId: number | null = null

const scheduleRecompute = (): void => {
  tryAttachCommentsList()
  if (rafId != null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    recomputeUnderlines()
  })
}

const tryAttachCommentsList = (): void => {
  if (commentsList) return
  const list = document.querySelector('.comments-pane .comments-list')
  if (!list) return
  commentsList = list as HTMLElement
  commentsListScrollListener = () => scheduleRecompute()
  commentsList.addEventListener('scroll', commentsListScrollListener, { passive: true })
}

const attachListeners = (): void => {
  detachListeners()

  scrollContainer = getScrollContainer()
  scrollListener = () => scheduleRecompute()
  scrollContainer?.addEventListener('scroll', scrollListener, { passive: true })

  tryAttachCommentsList()

  if (props.editor?.on) {
    jsonChangeListener = () => scheduleRecompute()
    props.editor.on('json-change', jsonChangeListener)
  }

  resizeListener = () => scheduleRecompute()
  window.addEventListener('resize', resizeListener, { passive: true })
}

const detachListeners = (): void => {
  if (scrollContainer && scrollListener) {
    scrollContainer.removeEventListener('scroll', scrollListener)
  }
  scrollContainer = null
  scrollListener = null

  if (commentsList && commentsListScrollListener) {
    commentsList.removeEventListener('scroll', commentsListScrollListener)
  }
  commentsList = null
  commentsListScrollListener = null

  if (props.editor?.off && jsonChangeListener) {
    props.editor.off('json-change', jsonChangeListener)
  }
  jsonChangeListener = null

  if (resizeListener) {
    window.removeEventListener('resize', resizeListener)
    resizeListener = null
  }

  if (rafId != null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

watch(
  () => props.editor,
  () => {
    attachListeners()
    scheduleRecompute()
  }
)

watch([threadsToDraw, selectedId, hoveredId, filter, visibleThreads], () => {
  scheduleRecompute()
})

watch(showCommentsPane, () => {
  tryAttachCommentsList()
  scheduleRecompute()
})

onMounted(() => {
  attachListeners()
  scheduleRecompute()
})

onBeforeUnmount(() => {
  detachListeners()
})

defineExpose({
  recomputeUnderlines,
  getEditorRoot
})
</script>

<style scoped>
.comment-decorations {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 5;
}

.comment-leader {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  z-index: 6;
}

.comment-leader path {
  fill: none;
  stroke: var(--themeColor, var(--editorColor80));
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}

.mt-comment-underline {
  position: absolute;
  pointer-events: auto;
  cursor: pointer;
  box-sizing: border-box;
  border-bottom: 2px solid var(--themeColor);
  background: transparent;
}

.mt-comment-underline.selected {
  background: var(--themeColor10);
}
</style>
