# Word-like Markdown Comments

Approved design for a right-hand comments pane in MarkText. Markdown files stay clean; comments live in a sidecar file.

## Goal

In WYSIWYG mode, select a span of body text, create a comment, and see it in a dedicated column on the far right. Annotated text is underlined. A dashed leader links the active underline to its card. Clicking a card selects the related body text.

## Locked decisions

| Topic | Choice |
|---|---|
| Persistence | Sidecar `*.md.comments.json` next to the markdown file |
| Anchoring | Follow small edits; if the quote is gone, mark Orphaned |
| Card features | Author, timestamp, replies, resolve / reopen, edit, delete |
| Editor modes | Full UX in WYSIWYG; source mode shows the list only |
| Create | Context menu “New Comment” + `Ctrl+Alt+M` / `Cmd+Alt+M` |
| Author | OS username; optional display name in preferences |
| Pane | Independent toggle, default closed; auto-open on create |
| Implementation | Desktop overlay + in-session live anchors (approach 1) |
| Leaders | Draw a dashed connector only for the hovered or selected comment |

## Out of scope (first version)

- Source-mode create, underlines, or leaders
- Multi-user accounts, presence, or sidecar merge
- Export / print / PDF including comments
- Commenting on a selection that contains no text (image-only)
- Two-window conflict resolution beyond whatever MarkText already does for the markdown file

## Current layout (unchanged except the new column)

Today the editor window is:

```
[ left sidebar: files / search / TOC ]  [ middle: markdown body ]
```

Target:

```
[ left sidebar ]  [ middle: markdown body ]  [ right: comments pane ]
```

The left sidebar (`packages/desktop/src/renderer/src/components/sideBar`) is unchanged. Comments are not a `rightColumn` tab of that sidebar.

## Architecture

Comments are a desktop-app feature. They must not change Muya’s markdown parse or serialize path, CommonMark/GFM fixtures, or export HTML.

```
main process          preload             renderer
────────────          ───────             ────────
sidecar load/save     typed IPC           Pinia comments store
OS username           bridge              CommentsPane (Vue)
                      context menu        underline decorations
                                          SVG leader overlay
                                          Muya: selection / scroll / change
```

- **Main:** read/write/delete the sidecar. Renderer is sandboxed and must not touch the disk.
- **Renderer:** own UI state, decorations, and live anchors.
- **Muya:** expose or reuse selection, scroll-into-view, and content-change notifications. Do not add comment marks to the JSON state or to markdown output.

### Modules

| Module | Responsibility |
|---|---|
| `packages/desktop/src/shared/types/comments.ts` | Shared TypeScript types for sidecar JSON and IPC |
| `packages/desktop/src/common/comments/` | Pure bind/rebind algorithm and sidecar filename helper (unit-tested, no Electron) |
| `packages/desktop/src/main/comments/` | Load / save / remove sidecar. Load never writes. Save overwrites only when the renderer sends a valid `CommentsFile`. |
| Pinia `comments` store | Per-tab comments, dirty flag, selection, filters. Switching tabs swaps the pane to that tab’s list. |
| `components/comments/` | Pane, card, SVG leaders, underline overlay |
| Layout store | `showCommentsPane`, `commentsPaneWidth` |
| Preferences | `commentAuthorName` |
| Menus / keybindings | Toggle pane, New Comment |

## Sidecar file

For a document at `/path/notes.md`, the sidecar is `/path/notes.md.comments.json`.

- No comments and no draft → do not create the file.
- After save, if the in-memory list is empty → delete the sidecar if it exists.
- Untitled tabs keep comments in memory until the first successful Save As.

### JSON schema (`version: 1`)

```json
{
  "version": 1,
  "comments": [
    {
      "id": "uuid",
      "status": "open",
      "orphaned": false,
      "quote": "review the budget",
      "prefix": "then ",
      "suffix": " before Friday",
      "startOffset": 84,
      "endOffset": 101,
      "createdAt": "2026-08-19T07:00:00.000Z",
      "updatedAt": "2026-08-19T07:00:00.000Z",
      "author": { "name": "Ada" },
      "body": "Need the latest numbers from finance.",
      "replies": [
        {
          "id": "uuid",
          "author": { "name": "Ada" },
          "createdAt": "2026-08-19T08:00:00.000Z",
          "updatedAt": "2026-08-19T08:00:00.000Z",
          "body": "Finance sent the sheet."
        }
      ]
    }
  ]
}
```

Field rules:

- `status` is `"open"` or `"resolved"`.
- `quote` is the selected body text at last successful bind (plain text, no markdown markers).
- `prefix` / `suffix` are up to 32 characters of surrounding plain text, used to disambiguate duplicate quotes.
- `startOffset` / `endOffset` are UTF-16 offsets into the full markdown string at last save; they are hints, not the source of truth.
- `orphaned` is recomputed on load and after rebind. It is stored so a file can be opened and show Orphaned cards even before the editor finishes binding.
- Unknown future keys are preserved on save (do not strip them).
- `version` other than `1` is treated as unreadable (same as corrupt), so a newer writer cannot be silently downgraded.

## Anchoring

### On open (sidecar → editor)

Rebind each comment against the current document text, in this order:

1. Unique match of `prefix + quote + suffix`.
2. Unique match of `quote`.
3. Multiple matches of `quote`: pick the match whose start index is closest to `startOffset`.
4. Otherwise set `orphaned: true`. Do not draw an underline or leader.

Cross-block selections are stored as one concatenated `quote` (spaces/newlines preserved as in the selected plain text).

### While the tab is open

Keep a live range per non-orphaned comment (Muya cursor pair: block + offset, or an equivalent range that survives the editor’s own re-renders).

On content change:

- If the range still covers text, update `quote` / `prefix` / `suffix` / offsets from the live range.
- If the range is empty or its blocks are gone, set `orphaned: true` and drop the underline.

This is how small edits “follow the words” inside a session. After close/reopen, only the sidecar algorithm above applies.

### Overlap

Two comments may cover overlapping spans. Both keep underlines. Only the selected or hovered comment gets the wash + leader.

## IPC

Add invoke channels (names are required):

- `mt::comments::load` `(pathname: string) → CommentsFile | null`
  - Missing file → `null`.
  - Unreadable JSON or `version !== 1` → throw a typed error the renderer shows as a notification. Do not write the file.
- `mt::comments::save` `(pathname: string, file: CommentsFile) → void`
  - Writes atomically (write temp + rename) next to the markdown file.
- `mt::comments::remove` `(pathname: string) → void`
  - Deletes the sidecar; missing file is success.
- `mt::comments::author-name` `() → string`
  - `os.userInfo().username`, falling back to `"User"` if the OS call fails.

Register them in `packages/desktop/src/shared/types/ipc.ts` and the preload bridge. Path arguments must be absolute. The main helper derives the sidecar path; the renderer never invents a different filename scheme.

Load runs when a markdown tab opens. Save/remove run from the existing document save path so markdown and comments share one user-facing Save.

Rename / Save As: after the markdown path changes, save the sidecar at the new path and remove the old sidecar if this window wrote it.

## Dirty state

Creating, editing, replying, resolving, reopening, or deleting a comment marks the tab unsaved even if the markdown text did not change. Discarding an empty draft does not mark dirty.

If markdown save succeeds and sidecar save fails: keep the tab unsaved for comments, show a notification, do not revert the markdown save.

## UI

### Comments pane

- Independent of the left sidebar. Place it inside `editor-middle`, to the right of `editor-with-tabs`, so the title bar stays above both the document and the pane. Default closed. Default width 280px, minimum 220px, user-resizable; persist width in `localStorage` (`comments-pane-width`).
- `showCommentsPane` lives on the layout store. Default `false`. Not restored as “always on” across launches. Closing the pane while a new composer is still empty discards that draft.
- Header: title, open-count, close control.
- Filter chips: Open (default), Resolved. Open hides resolved cards. Resolved shows only resolved. Orphaned open comments still appear under Open.
- Cards follow document order (bind start offset). Orphaned cards without an offset sort last.
- Empty pane: short copy pointing at “select text, then New Comment”.

### Underline and leader

- Every bound, non-resolved, non-orphaned comment: colored underline on the quote.
- Selected comment: underline plus a light wash.
- Resolved comments: no underline and no leader unless the filter is Resolved and that card is selected (then underline + wash + leader so jump-to-text still has a target).
- Leader: SVG overlay, dashed stroke, from the right end of the underline to the left edge of the card. At most one leader: the hovered comment if the pointer is over a card or underline, otherwise the selected comment. No hover and no selection → no leader.
- Click underline → select that comment (if several overlap, pick the tightest range, then the later one).
- Click card → scroll the quote into view, select it in the editor, highlight the card, draw the leader.
- Click empty editor chrome or pane background → clear selection; underlines remain.

### Cards

Each card shows quote, author name, relative timestamp, body, reply list.

Actions: edit body, add reply, Resolve / Reopen, Delete.

Delete of a thread that has replies asks for confirmation. Delete of a reply does not.

Empty new composer: if the user leaves with an empty body, drop the draft. No sidecar write.

## Interaction details

- New Comment requires a non-empty text selection in WYSIWYG. Otherwise the shortcut is a no-op and the context-menu item is disabled.
- Shortcut: `Ctrl+Alt+M` (Windows/Linux), `Cmd+Alt+M` (macOS). User-rebindable through the existing keybinding preferences.
- Context menu item sits with the editor edit actions.
- View menu: Toggle Comments Pane. Creating a comment forces the pane open.
- Source mode: pane may stay open; list, reply, resolve, delete work; New Comment is disabled; no underlines or leaders; clicking a card does not force a switch back to WYSIWYG.

## Preferences and i18n

- Preference `commentAuthorName` (string, default `""`). Empty means use `mt::comments::author-name`.
- Place the field under General preferences.
- Add locale keys to every file in `packages/desktop/static/locales/`. `en.json` and `zh-CN.json` get real copy; other locales may use the English strings for the first version.

## Failure cases

| Case | Behavior |
|---|---|
| No sidecar | Empty comments, no error |
| Corrupt sidecar / bad version | Notify; treat as empty in memory; never overwrite the bad file until the user successfully saves a valid new file after explicitly creating comments (then overwrite is allowed because the user has new data). If they never create comments, leave the bad file on disk. |
| Sidecar write failure | Notify; comments remain dirty |
| Quote missing on open | Orphaned card, no line |
| Duplicate quotes | Closest to `startOffset` after prefix/suffix |
| Image-only selection | Cannot create |
| Export / print | Comments omitted |
| Empty display name | OS username |
| Git conflict in JSON | Corrupt-sidecar path |

## Testing

Automated tests lock data and behavior. Pixel-perfect leaders and scroll animation are manual.

### Unit (required)

- Sidecar path helper: `notes.md` → `notes.md.comments.json`
- Bind: exact quote, small surrounding change still matches via prefix/suffix, missing quote → orphaned, duplicate quotes pick closest offset
- Empty draft discarded (store helper)
- Save As path update: old sidecar removed, new path used (pure path logic)

### Store / component (required)

- New comment rejected without a text selection
- Selecting a card selects the bound range; clicking an underline selects the card
- Reply, resolve, reopen, delete; delete with replies requires confirm
- Source mode: list actions work; create from selection does not

### Manual (not in CI)

- Leader alignment while scrolling
- Two windows on the same file

### Acceptance path

Open a markdown file → select text → New Comment → type body → Save → close tab → reopen → comment, underline, and jump-to-text still work → delete all comments → Save → sidecar file is gone.

## Implementation notes (constraints, not a plan)

- Do not serialize comments into markdown or Muya JSON state.
- Do not reuse the left sidebar `rightColumn` for this pane.
- New IPC channels use the `mt::` prefix and the typed contract in `ipc.ts`.
- Comments that dirty a tab must participate in the existing unsaved-close dialog.
- Visual style follows MarkText’s current CSS variables (`--editorBgColor`, `--sideBarBgColor`, accent) so light/dark themes both work. Underline uses the theme accent, not a hard-coded Word yellow.
