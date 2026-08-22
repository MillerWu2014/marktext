# Format-toolbar New Comment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]` ) syntax for tracking.

**Goal:** Add a New Comment action icon as the last item on the WYSIWYG inline format toolbar; click emits `muya-new-comment` and the desktop reuses `edit:new-comment`.

**Architecture:** Muya toolbar config gains a non-format `comment` entry. `_selectItem` special-cases it (emit + hide, never `format()`). Desktop `editor.vue` forwards the event onto the existing bus. No sidecar or store changes.

**Tech Stack:** TypeScript, Muya snabbdom toolbar, Vue 3 desktop editor, Vitest.

## Global Constraints

- Do not serialize comments into markdown or Muya JSON state.
- Do not call `content.format('comment')`.
- Placement is last, after Eliminate (`type: 'clear'`).
- Event name is exactly `muya-new-comment`.
- Desktop forwards with `bus.emit('edit:new-comment')` only.
- Tooltip key is `New Comment`; shortcuts: macOS `⌘+Alt+M`, Windows `Ctrl+Alt+M`, Linux `Ctrl+Shift+Alt+M`.
- Icon file is `packages/muya/src/assets/icons/format_comment/2.png` (40×40 PNG).
- Muya style: 4-space indent. Desktop style: 2-space, no semicolons, single quotes.

## File map

| Path | Role |
|---|---|
| `packages/muya/src/assets/icons/format_comment/2.png` | Toolbar glyph |
| `packages/muya/src/ui/inlineFormatToolbar/config.ts` | Append `comment` entry + platform shortcut |
| `packages/muya/src/ui/inlineFormatToolbar/index.ts` | `_selectItem` action branch |
| `packages/muya/src/ui/inlineFormatToolbar/index.css` | Widen picker for one extra item |
| `packages/muya/src/locales/*.ts` | `New Comment` string |
| `packages/muya/src/ui/inlineFormatToolbar/__tests__/config.spec.ts` | Last item is `comment` |
| `packages/muya/src/block/base/__tests__/formatToggle.spec.ts` | Click emits, hides, does not rewrite text |
| `packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue` | Subscribe and forward |

---

### Task 1: Toolbar action + desktop wire-up

**Files:** listed above.

- [ ] **Step 1: Failing tests**

Add to `config.spec.ts`:

```ts
it('places comment after eliminate as the last toolbar item', () => {
  expect(icons.at(-2)?.type).toBe('clear')
  expect(icons.at(-1)?.type).toBe('comment')
  expect(icons.at(-1)?.icon).toBeTruthy()
})
```

Add to `formatToggle.spec.ts` (same `_selectItem` harness as the link test):

```ts
it('selecting comment emits muya-new-comment, hides, and does not format', () => {
  const muya = bootMuya('abc\n')
  const content = muya.editor.scrollPage!.firstContentInDescendant() as Format
  const original = content.text
  const emitSpy = vi.spyOn(muya.eventCenter, 'emit')
  // ... set _block, status, selection as in the link test ...
  internals._selectItem(makeFakeEvent(), { type: 'comment', icon: '' })
  expect(content.text).toBe(original)
  expect(emitSpy).toHaveBeenCalledWith('muya-new-comment')
  expect(hideSpy).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run tests, expect FAIL**

```bash
pnpm -C packages/muya exec vitest run src/ui/inlineFormatToolbar/__tests__/config.spec.ts src/block/base/__tests__/formatToggle.spec.ts
```

- [ ] **Step 3: Implement**

`config.ts`: import icon; append `{ type: 'comment', tooltip: 'New Comment', shortcut: commentShortcut(), icon }`. `commentShortcut()` uses existing `isOsx` / `isWin` (Linux is the remaining case).

`index.ts` `_selectItem`: after restoring selection, if `item.type === 'comment'`, `eventCenter.emit('muya-new-comment')`, `hide()`, return.

`index.css`: `.mu-format-picker { width: 300px; }` (was 265px; one extra 35px slot).

Locales: add `'New Comment'` next to `'Eliminate'` in all 10 `packages/muya/src/locales/*.ts`. zh-CN: `新建评论` (same as desktop menu).

`editor.vue`: after Muya init, `editor.value.on('muya-new-comment', handleMuyaNewComment)` where the handler is `bus.emit('edit:new-comment')`. `bus.off` / `editor.off` on unmount.

- [ ] **Step 4: Run tests, expect PASS** (same command as Step 2)

- [ ] **Step 5: Commit**

`feat(comments): add New Comment action on the format toolbar`
