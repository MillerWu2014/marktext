<template>
  <div
    v-show="showCommentsPane"
    class="comments-pane"
    :style="{ width: `${displayWidth}px` }"
    @click.self="clearSelection"
  >
    <div
      ref="dragBar"
      class="drag-handle"
    />
    <header class="comments-header">
      <span class="comments-title">Comments</span>
      <span class="open-count">{{ openCount }}</span>
      <button
        type="button"
        class="close-button"
        aria-label="Close comments pane"
        @click="closePane"
      >
        <CloseIcon />
      </button>
    </header>
    <div class="filter-chips">
      <button
        type="button"
        class="filter-chip"
        :class="{ active: filter === 'open' }"
        @click="setFilter('open')"
      >
        Open
      </button>
      <button
        type="button"
        class="filter-chip"
        :class="{ active: filter === 'resolved' }"
        @click="setFilter('resolved')"
      >
        Resolved
      </button>
    </div>
    <div
      class="comments-list"
      @click="clearSelectionOnListBackground"
    >
      <comment-card
        v-if="draftThread && tabId"
        :thread="draftThread"
        :tab-id="tabId"
        is-composer
      />
      <comment-card
        v-for="thread in visibleThreads"
        :key="thread.id"
        :thread="thread"
        :tab-id="tabId!"
      />
      <p
        v-if="showEmptyCopy"
        class="empty-copy"
      >
        Select text, then New Comment
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Close as CloseIcon } from '@element-plus/icons-vue'
import { useLayoutStore } from '@/store/layout'
import { useCommentsStore } from '@/store/comments'
import { useEditorStore } from '@/store/editor'
import CommentCard from './CommentCard.vue'

const layoutStore = useLayoutStore()
const commentsStore = useCommentsStore()
const editorStore = useEditorStore()

const dragBar = ref<HTMLDivElement | null>(null)
const paneViewWidth = ref(280)

const { showCommentsPane, commentsPaneWidth } = storeToRefs(layoutStore)
const { filter, visibleThreads, selectedId } = storeToRefs(commentsStore)
const { currentFile } = storeToRefs(editorStore)

const tabId = computed(() => currentFile.value?.id)

const draftThread = computed(() => {
  const id = tabId.value
  return id ? commentsStore.draftForTab(id) : null
})

const openCount = computed(() => {
  const id = tabId.value
  if (!id) return 0
  return commentsStore.threadsForTab(id).filter((t) => t.status === 'open').length
})

const showEmptyCopy = computed(
  () => !draftThread.value && visibleThreads.value.length === 0
)

const displayWidth = computed(() => {
  const w = paneViewWidth.value
  return w < 220 ? 220 : w
})

watch(
  tabId,
  (id) => {
    commentsStore.switchTab(id ?? null)
  },
  { immediate: true }
)

watch(selectedId, (id) => {
  if (!id) return
  nextTick(() => {
    const card = document.querySelector(`.comment-card[data-comment-id="${id}"]`)
    card?.scrollIntoView({ block: 'nearest' })
  })
})

watch(commentsPaneWidth, (width) => {
  paneViewWidth.value = width
})

const { setFilter } = commentsStore

const clearSelection = (): void => {
  commentsStore.select(null)
}

const clearSelectionOnListBackground = (event: MouseEvent): void => {
  if (event.target === event.currentTarget) {
    commentsStore.select(null)
  }
}

const closePane = (): void => {
  layoutStore.SET_COMMENTS_PANE(false)
}

onMounted(() => {
  paneViewWidth.value = commentsPaneWidth.value

  nextTick(() => {
    const dragBarEl = dragBar.value
    if (!dragBarEl) return

    let startX = 0
    let currentWidth = commentsPaneWidth.value
    let startWidth = currentWidth

    const mouseUpHandler = (): void => {
      document.removeEventListener('mousemove', mouseMoveHandler, false)
      document.removeEventListener('mouseup', mouseUpHandler, false)
      layoutStore.SET_COMMENTS_PANE_WIDTH(currentWidth < 220 ? 220 : currentWidth)
    }

    const mouseMoveHandler = (event: MouseEvent): void => {
      const offset = startX - event.clientX
      currentWidth = startWidth + offset
      paneViewWidth.value = currentWidth
    }

    const mouseDownHandler = (event: MouseEvent): void => {
      startX = event.clientX
      startWidth = commentsPaneWidth.value
      document.addEventListener('mousemove', mouseMoveHandler, false)
      document.addEventListener('mouseup', mouseUpHandler, false)
    }

    dragBarEl.addEventListener('mousedown', mouseDownHandler, false)
  })
})
</script>

<style scoped>
.comments-pane {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  flex-grow: 0;
  height: 100%;
  min-width: 220px;
  position: relative;
  background: var(--sideBarBgColor);
  color: var(--editorColor);
  border-left: 1px solid var(--editorColor10);
}

.drag-handle {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 3px;
  cursor: col-resize;
}

.drag-handle:hover {
  border-left: 2px solid var(--iconColor);
}

.comments-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 8px 14px;
  border-bottom: 1px solid var(--editorColor10);
}

.comments-title {
  font-weight: 600;
  flex: 1;
}

.open-count {
  font-size: 12px;
  color: var(--editorColor50);
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  background: transparent;
  color: var(--editorColor);
  cursor: pointer;
}

.close-button:hover {
  color: var(--themeColor);
}

.filter-chips {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
}

.filter-chip {
  padding: 4px 10px;
  border: 1px solid var(--editorColor20);
  border-radius: 12px;
  background: transparent;
  color: var(--editorColor);
  font-size: 12px;
  cursor: pointer;
}

.filter-chip.active {
  border-color: var(--themeColor);
  color: var(--themeColor);
  background: var(--themeColor10);
}

.comments-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px 12px;
  min-height: 0;
}

.empty-copy {
  margin: 16px 4px;
  font-size: 13px;
  color: var(--editorColor50);
  text-align: center;
}
</style>
