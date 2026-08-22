export const isCommentCardControlTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('textarea, button, input') !== null
