# Nested comment replies

Approved add-on to the Word-like comments feature. Replies stay in the same card and sidecar `version: 1` file. They gain a two-level tree: a reply can sit under the root comment, or under another reply, and nothing nests deeper than that.

This amends [2026-08-19-markdown-comments-design.md](./2026-08-19-markdown-comments-design.md). Markdown, Muya serialize, IPC channel names, and sidecar filename rules are unchanged.

## Goal

On an existing comment card, reply to the root comment or to a specific reply. The pane shows a two-level indent tree. Deleting a reply that has children asks for confirmation, then deletes that reply and its descendants.

## Locked decisions

| Topic | Choice |
|---|---|
| Nesting | **A** — Word-style, max **2** reply levels (root → reply → reply-to-reply) |
| Storage | Flat `replies[]` plus optional `parentId` |
| Sidecar version | Stay at `1`. Missing `parentId` means a first-level reply |
| Depth overflow | A reply to a second-level reply keeps `parentId` on that first-level ancestor (same level, not a third indent) |
| Delete with children | Confirm, then **cascade** (the reply and every descendant) |
| Delete without children | No confirm (same as the original “delete a reply” rule) |
| Edit a reply body | Out of scope this round (root comment **Edit** stays) |
| New window / new card | No. Replies stay on the original thread card |

## Sidecar (`version: 1`)

`ICommentReply` gains one optional field:

```ts
parentId?: string
```

Rules:

- First-level reply: omit `parentId` (do not write `null`).
- Second-level reply: `parentId` is the **first-level** reply’s `id`.
- Unknown extra keys on a reply are still preserved on save.
- Existing sidecars without `parentId` load as a flat first-level list.

Do not bump `version`. Do not rewrite `parentId` on load. Invalid `parentId` values (missing parent, self-parent, cycle) stay on disk until that thread is dirtied by a user edit; the UI treats those replies as first-level.

### JSON example

```json
{
  "version": 1,
  "comments": [
    {
      "id": "thread-1",
      "replies": [
        {
          "id": "r1",
          "author": { "name": "Ada" },
          "createdAt": "2026-08-22T08:00:00.000Z",
          "updatedAt": "2026-08-22T08:00:00.000Z",
          "body": "Please check the numbers."
        },
        {
          "id": "r2",
          "parentId": "r1",
          "author": { "name": "Ada" },
          "createdAt": "2026-08-22T08:05:00.000Z",
          "updatedAt": "2026-08-22T08:05:00.000Z",
          "body": "Finance sent the sheet."
        }
      ]
    }
  ]
}
```

(Other thread fields omitted.)

## Tree algorithm

Pure helpers live in `packages/desktop/src/common/comments/` (no Vue, no Electron), exported from the existing `common/comments` barrel. Unit-tested.

**Effective first-level ancestor.** Walk `parentId` with a seen-set. Stop at the first reply whose parent is missing, empty, self, or not in the list. If the walk hits a cycle, the starting reply is first-level.

**Display tree.** Partition the flat array into:

- roots: replies whose ancestor walk does not find a valid parent
- children of `id`: replies whose first-level ancestor is `id`

Preserve sidecar array order within each group. A stored third-level `parentId` (pointing at a second-level reply) displays as a sibling of that second-level reply, under the same first-level parent.

**Clamp on insert.** `addReply` receives the id of the row the user clicked (or `undefined` for the root **Reply** button):

| Clicked row | Stored `parentId` |
|---|---|
| Root comment | omitted |
| First-level reply | that reply’s `id` |
| Second-level reply | that reply’s first-level ancestor `id` |
| Missing / cyclic parent | omitted |

New replies still append to the flat `replies` array.

**Descendants for delete.** Using raw `parentId` (not the display ancestor): the deleted id, plus every reply that walks to it, iteratively, with cycle guards. That way a stored deeper chain still comes down with its parent.

## UI

Still one card per thread. Structure:

```
[ quote / author / root body ]
[ L1 reply ]
  [ composer if replying to this L1 ]
  [ L2 reply ]
    [ composer if replying to this L2 ]
[ composer if replying to the root ]
[ Edit | Reply | Resolve | Delete ]
```

- Indent: 12px per reply level, plus a left rule using the same token as the quote bar (`--editorColor20`).
- Nested `ul` / `li` so the structure is not indent-only.
- Each reply row: author, relative time, body, **Reply**, **Delete**.
- Root **Reply** still creates a first-level reply. While a composer is open on this card, hide that root **Reply** button (same as today) and show the composer **Reply** submit control next to the textarea.
- One composer per card. Opening **Reply** on another row blurs the current textarea first (filled → submit, empty → cancel), then opens the new composer under the clicked row.
- Submit / blur / Enter / Escape stay as in the reply-submit fix: filled blur or Enter or the composer **Reply** button commits; empty blur cancels; Escape discards.
- Placeholder stays `comments.reply`.

Source mode: tree, reply, and delete work; New Comment stays disabled.

## Delete

**Root comment Delete:** unchanged. Any replies → confirm `comments.deleteConfirm`, then remove the thread.

**Reply Delete:**

1. Compute descendant set (includes the reply itself).
2. If the set size is `1` (no children): remove it, no dialog.
3. If size `> 1` and the caller has not confirmed: return `{ needsConfirm: true }`, mutate nothing.
4. After confirm: remove every id in the set, dirty the tab.

The card uses the same `window.confirm` pattern as thread delete: call with `confirmed: false`, if `needsConfirm` then `window.confirm(t('comments.deleteReplyConfirm'))`, then call again with `confirmed: true`.

Confirm copy (new key `comments.deleteReplyConfirm`):

- `en`: `Delete this reply and its nested replies?`
- `zh-CN`: `删除此回复及其回复？`
- Other locales: English for this round.

Store signature matches the thread helper:

```ts
deleteReply(tabId, threadId, replyId, confirmed: boolean): { needsConfirm: boolean }
```

(Today `deleteReply` is `void` and has no UI; this change both adds the UI and the confirm flag.)

## Architecture

No new IPC. Main-process sidecar IO already round-trips JSON objects; `parentId` rides along.

| Module | Change |
|---|---|
| `shared/types/comments.ts` | `parentId?: string` on `ICommentReply` |
| `common/comments/replyTree.ts` (new) | ancestor walk, display tree, insert clamp, descendant ids |
| Pinia `comments` store | `addReply(..., parentId?: string)`; `deleteReply` confirm + cascade |
| `CommentCard.vue` | nested list, per-reply Reply/Delete, composer anchored to the target row |

`[key: string]: unknown` on replies remains, so extra keys still survive `deepClone` + save.

## Failure / edge cases

| Case | Behavior |
|---|---|
| Old sidecar, no `parentId` | Flat first-level list |
| `parentId` points at a missing id | Show as first-level; do not rewrite until the thread is dirtied for another reason |
| Cycle | Show involved replies as first-level |
| Reply to second-level | Store under the first-level ancestor |
| Empty composer blur | Cancel, no row added |
| Cascade delete | One confirm, then the whole subtree |

## Testing

Unit tests (Vitest, desktop package):

- Display tree: order, two-level grouping, third-level stored parent displays as second-level sibling
- Clamp on insert for root / L1 / L2 / missing parent
- Cycle and missing parent → first-level
- `deleteReply` leaf: no confirm, one row gone
- `deleteReply` with children: confirm required; after confirm, parent and descendants gone
- `addReply` writes `parentId` only for second-level

No new Playwright spec this round (pane is not covered by e2e today).

## Out of scope

- Editing a reply body
- Collapse / expand branches
- More than two reply levels
- Sidecar `version: 2`
- Per-reply resolve
- A separate window or card per reply
