<template>
  <div
    class="comment-card"
    :data-comment-id="thread.id"
    :class="{
      selected: isSelected,
      hovered: isHovered
    }"
    @click="handleCardClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <blockquote class="comment-quote">
      {{ thread.quote }}
    </blockquote>
    <div class="comment-meta">
      <span class="comment-author">{{ thread.author.name }}</span>
      <span
        v-if="thread.createdAt"
        class="comment-time"
      >{{ formatRelativeTime(thread.createdAt) }}</span>
    </div>
    <textarea
      v-if="isComposer || editing"
      ref="bodyInput"
      v-model="bodyText"
      class="comment-body-input"
      rows="3"
      @blur="handleBodyBlur"
    />
    <p
      v-else
      class="comment-body"
    >
      {{ thread.body }}
    </p>
    <ul
      v-if="thread.replies.length"
      class="comment-replies"
    >
      <li
        v-for="reply in thread.replies"
        :key="reply.id"
        class="comment-reply"
      >
        <span class="reply-author">{{ reply.author.name }}</span>
        <span
          v-if="reply.createdAt"
          class="reply-time"
        >{{ formatRelativeTime(reply.createdAt) }}</span>
        <p class="reply-body">{{ reply.body }}</p>
      </li>
    </ul>
    <textarea
      v-if="replying"
      v-model="replyText"
      class="reply-input"
      rows="2"
      placeholder="Reply"
      @keydown.enter.exact.prevent="submitReply"
      @blur="cancelReply"
    />
    <div
      v-if="!isComposer"
      class="comment-actions"
    >
      <button
        type="button"
        class="action-button"
        @click.stop="startEdit"
      >
        Edit
      </button>
      <button
        type="button"
        class="action-button"
        @click.stop="startReply"
      >
        Reply
      </button>
      <button
        type="button"
        class="action-button"
        @click.stop="toggleStatus"
      >
        {{ thread.status === 'open' ? 'Resolve' : 'Reopen' }}
      </button>
      <button
        type="button"
        class="action-button"
        @click.stop="handleDelete"
      >
        Delete
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { formatRelativeTime } from 'common/comments'
import type { ICommentThread } from '@shared/types/comments'
import bus from '@/bus'
import { useCommentsStore } from '@/store/comments'

const props = defineProps<{
  thread: ICommentThread
  tabId: string
  isComposer?: boolean
}>()

const commentsStore = useCommentsStore()
const { selectedId, hoveredId } = storeToRefs(commentsStore)

const bodyInput = ref<HTMLTextAreaElement | null>(null)
const bodyText = ref(props.thread.body)
const editing = ref(false)
const replying = ref(false)
const replyText = ref('')

const isComposer = computed(() => props.isComposer ?? false)
const isSelected = computed(() => selectedId.value === props.thread.id)
const isHovered = computed(() => hoveredId.value === props.thread.id)

watch(
  () => props.thread.body,
  (value) => {
    if (!editing.value && !isComposer.value) {
      bodyText.value = value
    }
  }
)

watch(
  isComposer,
  (composer) => {
    if (composer) {
      bodyText.value = ''
      nextTick(() => {
        bodyInput.value?.focus()
      })
    }
  },
  { immediate: true }
)

const handleCardClick = (): void => {
  commentsStore.select(props.thread.id)
  if (!isComposer.value) {
    bus.emit('comments:scroll-to', {
      startOffset: props.thread.startOffset,
      endOffset: props.thread.endOffset,
      quote: props.thread.quote
    })
  }
}

const handleMouseEnter = (): void => {
  commentsStore.hover(props.thread.id)
}

const handleMouseLeave = (): void => {
  commentsStore.hover(null)
}

const handleBodyBlur = (): void => {
  if (isComposer.value) {
    if (!bodyText.value.trim()) {
      commentsStore.discardDraft(props.tabId)
    } else {
      commentsStore.commitDraft(props.tabId, bodyText.value)
    }
    return
  }
  if (editing.value) {
    props.thread.body = bodyText.value
    commentsStore.markDirty(props.tabId)
    editing.value = false
  }
}

const startEdit = (): void => {
  editing.value = true
  bodyText.value = props.thread.body
  nextTick(() => {
    bodyInput.value?.focus()
  })
}

const startReply = (): void => {
  replying.value = true
  replyText.value = ''
}

const cancelReply = (): void => {
  if (!replyText.value.trim()) {
    replying.value = false
  }
}

const submitReply = (): void => {
  const text = replyText.value.trim()
  if (!text) return
  commentsStore.addReply(props.tabId, props.thread.id, props.thread.author.name, text)
  replyText.value = ''
  replying.value = false
}

const toggleStatus = (): void => {
  const next = props.thread.status === 'open' ? 'resolved' : 'open'
  commentsStore.setStatus(props.tabId, props.thread.id, next)
}

const handleDelete = (): void => {
  const result = commentsStore.deleteThread(props.tabId, props.thread.id, false)
  if (result.needsConfirm) {
    if (window.confirm('Delete this comment and all replies?')) {
      commentsStore.deleteThread(props.tabId, props.thread.id, true)
    }
    return
  }
  if (selectedId.value === props.thread.id) {
    commentsStore.select(null)
  }
}
</script>

<style scoped>
.comment-card {
  padding: 10px;
  margin-bottom: 8px;
  border: 1px solid var(--editorColor10);
  border-radius: 6px;
  background: var(--editorBgColor);
  cursor: pointer;
}

.comment-card.selected {
  border-color: var(--themeColor);
}

.comment-card.hovered:not(.selected) {
  border-color: var(--themeColor50);
}

.comment-quote {
  margin: 0 0 8px;
  padding-left: 8px;
  border-left: 2px solid var(--editorColor20);
  font-size: 12px;
  color: var(--editorColor50);
  font-style: italic;
}

.comment-meta {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 6px;
  font-size: 12px;
}

.comment-author {
  font-weight: 600;
  color: var(--editorColor);
}

.comment-time,
.reply-time {
  color: var(--editorColor50);
}

.comment-body,
.reply-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--editorColor);
}

.comment-body-input,
.reply-input {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 6px;
  padding: 6px 8px;
  border: 1px solid var(--editorColor20);
  border-radius: 4px;
  background: var(--sideBarBgColor);
  color: var(--editorColor);
  font-size: 13px;
  resize: vertical;
}

.comment-body-input:focus,
.reply-input:focus {
  outline: none;
  border-color: var(--themeColor);
}

.comment-replies {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}

.comment-reply {
  padding: 6px 0;
  border-top: 1px solid var(--editorColor10);
  font-size: 12px;
}

.reply-author {
  font-weight: 600;
  margin-right: 6px;
}

.comment-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.action-button {
  padding: 2px 8px;
  border: 1px solid var(--editorColor20);
  border-radius: 4px;
  background: transparent;
  color: var(--editorColor);
  font-size: 11px;
  cursor: pointer;
}

.action-button:hover {
  border-color: var(--themeColor);
  color: var(--themeColor);
}
</style>
