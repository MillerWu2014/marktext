# Format-toolbar New Comment button

Approved add-on to the Word-like comments feature. The inline format toolbar (select-text float) gets a **New Comment** action at the far right, after Eliminate. Clicking it uses the existing desktop New Comment path. Markdown and Muya serialize stay unchanged.

## Goal

In WYSIWYG, select text → the format toolbar appears → a comment icon at the right end starts a comment on that selection, same as context menu / shortcut.

## Locked decisions

| Topic | Choice |
|---|---|
| Approach | Toolbar button is an **action**, not a format. It emits an event; desktop runs existing `beginNewComment`. |
| Placement | **A** — last item, after Eliminate. The toolbar’s existing last-item divider sits between Eliminate and New Comment. |
| Persistence | Unchanged sidecar `*.md.comments.json` |
| Markdown | Do not insert comment syntax or Muya JSON marks |
| Source mode | No change — this toolbar does not show |

## Behavior

1. Button appears only when the format toolbar already would (WYSIWYG, non-empty selection).
2. Click restores the selection (same as other toolbar items), emits `muya-new-comment`, then **hides** the toolbar (same as link/image).
3. Desktop `editor.vue` listens and `bus.emit('edit:new-comment')`, which is already handled in `app.vue` (`createDraft`, open pane, composer).
4. Do **not** call `content.format('comment')`.
5. Tooltip: Muya i18n key `New Comment` plus the platform shortcut already used for the command:
   - macOS `⌘+Alt+M`
   - Windows `Ctrl+Alt+M`
   - Linux `Ctrl+Shift+Alt+M`
6. Icon: 40×40 PNG silhouette in the same family as other format icons (`packages/muya/src/assets/icons/…/2.png`), speech-bubble / comment shape, black background, light gray-blue glyph.

## Out of scope

- Source-mode toolbar button
- Changing shortcut bindings
- New persistence or card UI
