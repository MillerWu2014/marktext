# Nested Comment Replies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give comment replies a two-level tree (optional `parentId` on the existing `version: 1` sidecar) with per-row Reply/Delete and cascade-delete of nested replies.

**Architecture:** Pure tree helpers in `packages/desktop/src/common/comments/replyTree.ts` (no Vue/Electron). Pinia `addReply` clamps `parentId` on insert; `deleteReply` confirms then removes a raw-parentId subtree. `CommentCard.vue` renders `buildReplyTree` as nested lists and anchors the existing reply composer to the clicked row.

**Tech Stack:** TypeScript (strict), Vue 3, Pinia, Vitest 4. Desktop style: 2-space indent, no semicolons, single quotes. Commands from repo root unless noted: `pnpm -C packages/desktop exec vitest run <spec>`.

## Global Constraints

- Sidecar stays `version: 1`. Do not rewrite `parentId` on load.
- First-level replies omit `parentId` (do not write `null`).
- Max two reply indent levels; a reply to a second-level row stores `parentId` of the first-level ancestor.
- Delete a leaf reply: no confirm. Delete a reply with descendants: `window.confirm` then cascade.
- Do not add reply-body editing, collapse/expand, or a new card/window per reply.
- Do not change markdown, Muya serialize, or IPC channel names.
- `en` and `zh-CN` get real confirm copy; other locales use the English string this round.
- Visual indent: 12px per level plus a left rule using `--editorColor20`.

## File map

| Path | Role |
|---|---|
| `packages/desktop/src/shared/types/comments.ts` | Add `parentId?: string` on `ICommentReply` |
| `packages/desktop/src/common/comments/replyTree.ts` | Ancestor walk, display tree, insert clamp, descendant ids |
| `packages/desktop/src/common/comments/index.ts` | Re-export `replyTree` |
| `packages/desktop/src/renderer/src/store/comments.ts` | `addReply` parentId; `deleteReply` confirm + cascade |
| `packages/desktop/src/renderer/src/components/comments/CommentCard.vue` | Nested list, per-reply actions, targeted composer |
| `packages/desktop/static/locales/*.json` | `comments.deleteReplyConfirm` |
| `packages/desktop/test/unit/specs/comments-reply-tree.spec.ts` | Tree helper tests |
| `packages/desktop/test/unit/specs/comments-store.spec.ts` | Store parentId + cascade tests |

---

### Task 1: Types and reply tree helpers

**Files:**
- Modify: `packages/desktop/src/shared/types/comments.ts`
- Create: `packages/desktop/src/common/comments/replyTree.ts`
- Modify: `packages/desktop/src/common/comments/index.ts`
- Test: `packages/desktop/test/unit/specs/comments-reply-tree.spec.ts`

**Interfaces:**
- Consumes: `ICommentReply` from `@shared/types/comments`
- Produces:
  - `ICommentReply.parentId?: string`
  - `ReplyTreeNode { reply: ICommentReply; children: ICommentReply[] }`
  - `buildReplyTree(replies: ICommentReply[]): ReplyTreeNode[]`
  - `clampReplyParentId(replies: ICommentReply[], clickedId: string | undefined): string | undefined`
  - `replyDescendantIds(replies: ICommentReply[], rootId: string): string[]`

- [ ] **Step 1: Write the failing test**

Create `packages/desktop/test/unit/specs/comments-reply-tree.spec.ts` with a `reply()` fixture (`id`, `author.name: 'Ada'`, ISO timestamps, `body`, optional `parentId`) and tests:

- Flat list with no `parentId` → one node per reply, empty `children`, original array order
- `r2.parentId = r1` → one root `r1` whose `children` is `[r2]`
- Third-level `r3.parentId = r2` (and `r2.parentId = r1`) → `r3` is a child of `r1` (sibling of `r2`), order `[r2, r3]`
- `parentId` pointing at a missing id → that reply is a root
- Cycle `a.parentId = b`, `b.parentId = a` → both roots
- `clampReplyParentId(list, undefined)` → `undefined`
- `clampReplyParentId(list, r1.id)` when r1 is first-level → `r1.id`
- `clampReplyParentId(list, r2.id)` when r2 is under r1 → `r1.id`
- `clampReplyParentId(list, 'missing')` → `undefined`
- `replyDescendantIds` of a leaf → `[leafId]`
- `replyDescendantIds` of r1 with r2 and r3 under it (raw parentId chain) → set `{r1,r2,r3}`
- Cycle in descendants does not infinite-loop (returns a finite list including the start id)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-reply-tree.spec.ts`

Expected: FAIL resolving `common/comments` exports / `buildReplyTree` is not a function.

- [ ] **Step 3: Write minimal implementation**

On `ICommentReply`, add `parentId?: string` **above** the index signature.

`replyTree.ts` (no Vue, no Electron):

- Treat missing / non-string / empty `parentId` as no parent.
- `firstLevelAncestorId` (module-private): walk `parentId` with a seen-set. If the walk hits a cycle, the **starting** reply is first-level (`undefined` ancestor). Stop at the first reply whose parent is missing, empty, self, or not in the map; if that stop is the start reply, ancestor is `undefined`, else it is that stop reply’s `id`.
- `buildReplyTree`: one pass in array order; replies with no ancestor are roots; others append to `children` of their first-level ancestor.
- `clampReplyParentId`: `undefined` / missing clicked id → `undefined`. If the clicked reply is a valid first-level (no parent), return its `id`. If it has a valid parent chain, return `firstLevelAncestorId(clicked)` (so a second-level click stores the first-level id). Missing or cyclic parent on the clicked row → `undefined`.
- `replyDescendantIds`: include `rootId`, then iteratively add replies whose **raw** `parentId` is already in the set; seen-set prevents cycles. Do not use the display ancestor here.

Export from `packages/desktop/src/common/comments/index.ts`: `export * from './replyTree'`

- [ ] **Step 4: Run tests and make sure they pass**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-reply-tree.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/shared/types/comments.ts \
  packages/desktop/src/common/comments/replyTree.ts \
  packages/desktop/src/common/comments/index.ts \
  packages/desktop/test/unit/specs/comments-reply-tree.spec.ts
git commit -m "feat(comments): add two-level reply tree helpers"
```

---

### Task 2: Pinia store parentId and cascade delete

**Files:**
- Modify: `packages/desktop/src/renderer/src/store/comments.ts`
- Test: `packages/desktop/test/unit/specs/comments-store.spec.ts`

**Interfaces:**
- Consumes: `clampReplyParentId`, `replyDescendantIds` from `common/comments`
- Produces:
  - `addReply(tabId: string, threadId: string, authorName: string, body: string, parentId?: string): void`
  - `deleteReply(tabId: string, threadId: string, replyId: string, confirmed: boolean): { needsConfirm: boolean }`

- [ ] **Step 1: Write the failing tests** (append to `comments-store.spec.ts`)

```ts
it('addReply omits parentId for a root reply and sets it for a nested reply', () => {
  const store = useCommentsStore()
  store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
  const id = store.commitDraft('t1', 'body')!
  store.addReply('t1', id, 'Ada', 'first')
  const firstId = store.threadsForTab('t1')[0]!.replies[0]!.id
  expect(store.threadsForTab('t1')[0]!.replies[0]!.parentId).toBeUndefined()
  store.addReply('t1', id, 'Ada', 'nested', firstId)
  expect(store.threadsForTab('t1')[0]!.replies[1]!.parentId).toBe(firstId)
  store.addReply('t1', id, 'Ada', 'clamped', store.threadsForTab('t1')[0]!.replies[1]!.id)
  expect(store.threadsForTab('t1')[0]!.replies[2]!.parentId).toBe(firstId)
})

it('deleteReply leaf needs no confirm; nested requires confirm then cascades', () => {
  const store = useCommentsStore()
  store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
  const id = store.commitDraft('t1', 'body')!
  store.addReply('t1', id, 'Ada', 'first')
  const firstId = store.threadsForTab('t1')[0]!.replies[0]!.id
  store.addReply('t1', id, 'Ada', 'child', firstId)
  expect(store.deleteReply('t1', id, firstId, false)).toEqual({ needsConfirm: true })
  expect(store.threadsForTab('t1')[0]!.replies).toHaveLength(2)
  expect(store.deleteReply('t1', id, firstId, true)).toEqual({ needsConfirm: false })
  expect(store.threadsForTab('t1')[0]!.replies).toHaveLength(0)
  store.addReply('t1', id, 'Ada', 'leaf')
  const leafId = store.threadsForTab('t1')[0]!.replies[0]!.id
  expect(store.deleteReply('t1', id, leafId, false)).toEqual({ needsConfirm: false })
  expect(store.threadsForTab('t1')[0]!.replies).toHaveLength(0)
})
```

Existing `addReply('t1', id, 'Ada', 'ok')` calls stay valid (optional last arg).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-store.spec.ts`

Expected: FAIL — `parentId` undefined on nested reply; `deleteReply` return type / cascade.

- [ ] **Step 3: Write minimal implementation**

Import `clampReplyParentId` and `replyDescendantIds` from `common/comments`.

`addReply`: after building the reply object, `const clamped = clampReplyParentId(thread.replies, parentId)`; if `clamped` is a string, set `reply.parentId = clamped`; otherwise omit the key. Append as today.

`deleteReply`: if thread or reply id missing, `{ needsConfirm: false }` and do not dirty. `ids = replyDescendantIds(thread.replies, replyId)`. If `ids.length > 1 && !confirmed`, return `{ needsConfirm: true }` with no mutation. Else `thread.replies = thread.replies.filter(r => !ids.includes(r.id))`, bump `updatedAt`, `markDirty`, return `{ needsConfirm: false }`.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-store.spec.ts`

Expected: PASS (including existing persist / deleteThread tests)

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/src/store/comments.ts \
  packages/desktop/test/unit/specs/comments-store.spec.ts
git commit -m "feat(comments): nest addReply and cascade deleteReply"
```

---

### Task 3: Comment card tree UI

**Files:**
- Modify: `packages/desktop/src/renderer/src/components/comments/CommentCard.vue`

**Interfaces:**
- Consumes: `buildReplyTree` from `common/comments`; store `addReply(..., parentId?)` and `deleteReply(..., confirmed)`
- Produces: nested `ul`/`li` on the card; composer under the clicked row; per-reply Reply/Delete

No `@vue/test-utils` in this package — do not add an SFC mount test. Behavior is specified below; verify with `pnpm exec eslint` on the file plus existing unit tests.

- [ ] **Step 1: Render `buildReplyTree(thread.replies)`**

Replace the flat `v-for="reply in thread.replies"` with nested lists:

```
ul.comment-replies
  li.comment-reply.comment-reply-l1  (each tree node)
    meta, body, Reply, Delete
    composer if replying to this L1 id
    ul.comment-replies.comment-replies-nested (if children)
      li.comment-reply.comment-reply-l2
        meta, body, Reply, Delete
        composer if replying to this L2 id
composer if replying to the root (parent id unset)
root actions: Edit, Reply (hidden while any composer open), Resolve, Delete
```

L1/L2 rows: 12px extra padding-left per level and `border-left: 2px solid var(--editorColor20)`. Nested `ul` has `list-style: none`.

- [ ] **Step 2: Target the composer**

Replace boolean-only targeting with `replyParentId: string | undefined` (undefined = root Reply). `startReply(clickedId?: string)`:

- Same target already open → focus the textarea
- Different composer already open → `submitReply()` if text, else `cancelReply()`, then open the new target empty
- `submitReply` captures `replyParentId` **before** clearing, then `addReply(tabId, threadId, authorName, text, parentId)`
- Hide root Reply while `replying` is true; keep the composer submit button next to the textarea
- Per-reply Delete calls `deleteReply(..., false)` then `window.confirm(t('comments.deleteReplyConfirm'))` + `deleteReply(..., true)` when `needsConfirm` (same pattern as thread delete)
- `@click.stop` on reply action buttons; `isCommentCardControlTarget` already ignores `button`/`textarea`

Keep blur/Enter/Escape/`preventReplyBlurOnSubmit` from the reply-submit fix.

- [ ] **Step 3: Lint the card**

Run: `pnpm exec eslint packages/desktop/src/renderer/src/components/comments/CommentCard.vue`

Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/renderer/src/components/comments/CommentCard.vue
git commit -m "feat(comments): render nested replies and per-row reply actions"
```

---

### Task 4: i18n for cascade-delete confirm

**Files:**
- Modify: every `packages/desktop/static/locales/*.json` that is not `*.min.json` (`de`, `en`, `es`, `fr`, `ja`, `ko`, `pt`, `tr`, `zh-CN`, `zh-TW`)
- Generate: matching `*.min.json` via `pnpm run minify-locales`

**Interfaces:**
- Consumes: none
- Produces: `comments.deleteReplyConfirm`

- [ ] **Step 1: Add the key after `deleteConfirm`**

- `en` and all non-zh-CN locales: `"deleteReplyConfirm": "Delete this reply and its nested replies?"`
- `zh-CN`: `"deleteReplyConfirm": "删除此回复及其回复？"`

- [ ] **Step 2: Minify**

Run: `pnpm run minify-locales`

Expected: each source locale gets a rewritten `.min.json`.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/static/locales
git commit -m "feat(comments): add nested-reply delete confirm copy"
```

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| `parentId?: string`, version 1, omit on L1 | 1, 2 |
| Display tree, third-level as L2 sibling | 1, 3 |
| Clamp on insert (root / L1 / L2 / missing) | 1, 2 |
| Cycle / missing parent as first-level | 1 |
| Cascade delete with confirm; leaf no confirm | 2, 3, 4 |
| Nested `ul`/`li`, 12px indent, quote-bar color | 3 |
| Composer under clicked row; one composer per card | 3 |
| Per-reply Reply / Delete; no reply-body edit | 3 |
| i18n en + zh-CN + English fallbacks | 4 |
| Unit tests listed in spec | 1, 2 |
| No e2e this round | — |

## Execution

The user asked to implement immediately after spec approval. Execute this plan inline in the same session (executing-plans), task by task with TDD and a commit after each task.
