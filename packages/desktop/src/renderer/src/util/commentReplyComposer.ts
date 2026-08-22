export type ReplyComposerEvent = 'blur' | 'enter' | 'escape'
export type ReplyComposerDecision = 'submit' | 'cancel' | 'keep'

export const decideReplyComposerAction = (
  text: string,
  event: ReplyComposerEvent,
  isComposing = false
): ReplyComposerDecision => {
  if (event === 'escape') return 'cancel'
  if (event === 'enter') {
    if (isComposing) return 'keep'
    return text.trim() ? 'submit' : 'keep'
  }
  return text.trim() ? 'submit' : 'cancel'
}
