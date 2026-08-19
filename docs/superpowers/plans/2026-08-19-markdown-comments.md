# Word-like Markdown Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-hand Word-like comments pane to MarkText: select WYSIWYG text, store comments in a sidecar `*.md.comments.json`, underline quotes, and jump between cards and body text.

**Architecture:** Comments are a desktop overlay. Pure bind/follow logic lives in `packages/desktop/src/common/comments/` (no Electron). Main process loads/saves the sidecar over typed `mt::comments::*` IPC. A Pinia store holds per-tab comments; Vue renders the pane, underlines, and a single dashed leader. Markdown and Muya serialize paths stay untouched.

**Tech Stack:** TypeScript (strict), Vue 3, Pinia, Electron 42, Vitest 4 (`pnpm -C packages/desktop exec vitest run …`). Renderer style: 2-space indent, no semicolons, single quotes.

## Global Constraints

- Do not serialize comments into markdown or Muya JSON state.
- Do not reuse the left sidebar `rightColumn` for this pane.
- New IPC channels use the `mt::` prefix and the typed contract in `packages/desktop/src/shared/types/ipc.ts`.
- Comments that dirty a tab must participate in the existing unsaved-close dialog (`isSaved === false`).
- Visual style follows MarkText CSS variables (`--editorBgColor`, `--sideBarBgColor`, theme accent). Underline uses the theme accent, not Word yellow.
- Sidecar name is exactly `${markdownPath}.comments.json` (so `/path/notes.md` → `/path/notes.md.comments.json`).
- New Comment shortcut: Windows `Ctrl+Alt+M`, macOS `Command+Alt+M`, Linux `Ctrl+Shift+M` (Linux avoids `Ctrl+Alt` per `keybindingsLinux.ts` / GH#2370).
- Prefix/suffix context is at most 32 characters of surrounding plain text.
- `version` other than `1` is unreadable (same as corrupt JSON).

## File map

| Path | Role |
|---|---|
| `packages/desktop/src/shared/types/comments.ts` | Sidecar + IPC types |
| `packages/desktop/src/common/comments/sidecarPath.ts` | Path helpers |
| `packages/desktop/src/common/comments/bind.ts` | Rebind + follow + overlap pick |
| `packages/desktop/src/common/comments/relativeTime.ts` | Relative timestamps |
| `packages/desktop/src/common/comments/index.ts` | Re-exports |
| `packages/desktop/src/main/comments/sidecar.ts` | Load/save/remove/author |
| `packages/desktop/src/main/ipc/comments.ts` | IPC handlers |
| `packages/desktop/src/renderer/src/store/comments.ts` | Per-tab Pinia store |
| `packages/desktop/src/renderer/src/components/comments/CommentsPane.vue` | Right pane |
| `packages/desktop/src/renderer/src/components/comments/CommentCard.vue` | One thread |
| `packages/desktop/src/renderer/src/components/comments/CommentDecorations.vue` | Underlines + SVG leader |

---

### Task 1: Types, sidecar path, bind/follow

**Files:**
- Create: `packages/desktop/src/shared/types/comments.ts`
- Create: `packages/desktop/src/common/comments/sidecarPath.ts`
- Create: `packages/desktop/src/common/comments/bind.ts`
- Create: `packages/desktop/src/common/comments/relativeTime.ts`
- Create: `packages/desktop/src/common/comments/index.ts`
- Test: `packages/desktop/test/unit/specs/comments-bind.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `ICommentsFile`, `ICommentThread`, `ICommentReply`, `CommentsSidecarError`, `sidecarPath(mdPath)`, `oldSidecarPathAfterRename(oldMd, newMd)`, `bindComment(markdown, comment)`, `bindComments(markdown, comments)`, `followComment(markdown, comment)`, `extractQuoteContext(markdown, start, end)`, `pickOverlappingComment(comments, offset)`, `formatRelativeTime(iso, now)`

- [ ] **Step 1: Write the failing test**

Create `packages/desktop/test/unit/specs/comments-bind.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  bindComment,
  bindComments,
  extractQuoteContext,
  followComment,
  formatRelativeTime,
  oldSidecarPathAfterRename,
  pickOverlappingComment,
  sidecarPath
} from 'common/comments'
import type { ICommentThread } from '@shared/types/comments'

const thread = (partial: Partial<ICommentThread>): ICommentThread => ({
  id: 'c1',
  status: 'open',
  orphaned: false,
  quote: 'budget',
  prefix: 'the ',
  suffix: ' before',
  startOffset: 4,
  endOffset: 10,
  createdAt: '2026-08-19T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
  author: { name: 'Ada' },
  body: 'check this',
  replies: [],
  ...partial
})

describe('sidecarPath', () => {
  it('appends .comments.json to the markdown path', () => {
    expect(sidecarPath('/docs/notes.md')).toBe('/docs/notes.md.comments.json')
  })

  it('returns old and new sidecar paths after Save As', () => {
    expect(oldSidecarPathAfterRename('/a/old.md', '/b/new.md')).toEqual({
      oldSidecar: '/a/old.md.comments.json',
      newSidecar: '/b/new.md.comments.json'
    })
  })
})

describe('extractQuoteContext', () => {
  it('captures up to 32 chars of prefix and suffix', () => {
    const md = 'aaa the budget before Friday zzz'
    const start = md.indexOf('budget')
    const end = start + 'budget'.length
    expect(extractQuoteContext(md, start, end)).toEqual({
      quote: 'budget',
      prefix: 'aaa the ',
      suffix: ' before Friday zzz',
      startOffset: start,
      endOffset: end
    })
  })
})

describe('bindComment', () => {
  const md = 'then review the budget before Friday. then review the budget before Friday.'

  it('binds a unique prefix+quote+suffix match', () => {
    const one = 'Please review the budget before Friday.'
    const t = thread({
      quote: 'review the budget',
      prefix: 'Please ',
      suffix: ' before Friday.',
      startOffset: 0
    })
    const bound = bindComment(one, t)
    expect(bound.orphaned).toBe(false)
    expect(one.slice(bound.startOffset, bound.endOffset)).toBe('review the budget')
  })

  it('falls back to a unique quote match', () => {
    const one = 'xxx budget yyy'
    const bound = bindComment(one, thread({ prefix: 'nope ', suffix: ' nope' }))
    expect(bound.orphaned).toBe(false)
    expect(bound.startOffset).toBe(one.indexOf('budget'))
  })

  it('picks the quote closest to startOffset when duplicates exist', () => {
    const mdDup = 'budget one then budget two'
    const second = mdDup.lastIndexOf('budget')
    const bound = bindComment(mdDup, thread({ prefix: '', suffix: '', startOffset: second }))
    expect(bound.startOffset).toBe(second)
  })

  it('marks missing quotes orphaned', () => {
    const bound = bindComment('nothing here', thread())
    expect(bound.orphaned).toBe(true)
  })
})

describe('followComment', () => {
  it('keeps a match when surrounding text is unchanged', () => {
    const md = 'the budget before'
    const bound = followComment(md, thread({ startOffset: 4, endOffset: 10 }))
    expect(bound.orphaned).toBe(false)
    expect(bound.quote).toBe('budget')
  })

  it('updates the quote when the interior text changes but bookends remain', () => {
    const original = thread({
      quote: 'budget review',
      prefix: 'the ',
      suffix: ' before',
      startOffset: 4,
      endOffset: 17
    })
    const md = 'the budget and timeline before'
    const bound = followComment(md, original)
    expect(bound.orphaned).toBe(false)
    expect(bound.quote).toBe('budget and timeline')
  })

  it('orphans when the quoted span is gone', () => {
    const bound = followComment('the before', thread())
    expect(bound.orphaned).toBe(true)
  })
})

describe('bindComments', () => {
  it('rebinds every thread against the document', () => {
    const md = 'the budget before'
    const [a] = bindComments(md, [thread()])
    expect(a!.orphaned).toBe(false)
  })
})

describe('pickOverlappingComment', () => {
  it('picks the tightest range, then the later one', () => {
    const a = thread({ id: 'a', startOffset: 0, endOffset: 10, orphaned: false })
    const b = thread({ id: 'b', startOffset: 2, endOffset: 6, orphaned: false })
    const c = thread({ id: 'c', startOffset: 2, endOffset: 6, orphaned: false })
    expect(pickOverlappingComment([a, b, c], 4)?.id).toBe('c')
  })
})

describe('formatRelativeTime', () => {
  it('formats hours-ago and yesterday', () => {
    const now = new Date('2026-08-19T12:00:00.000Z')
    expect(formatRelativeTime('2026-08-19T10:00:00.000Z', now)).toBe('2h ago')
    expect(formatRelativeTime('2026-08-18T12:00:00.000Z', now)).toBe('yesterday')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-bind.spec.ts`

Expected: FAIL with `Cannot find module 'common/comments'` (or similar unresolved import).

- [ ] **Step 3: Write minimal implementation**

`packages/desktop/src/shared/types/comments.ts`:

```ts
export type CommentStatus = 'open' | 'resolved'

export interface ICommentAuthor {
  name: string
  [key: string]: unknown
}

export interface ICommentReply {
  id: string
  author: ICommentAuthor
  createdAt: string
  updatedAt: string
  body: string
  [key: string]: unknown
}

export interface ICommentThread {
  id: string
  status: CommentStatus
  orphaned: boolean
  quote: string
  prefix: string
  suffix: string
  startOffset: number
  endOffset: number
  createdAt: string
  updatedAt: string
  author: ICommentAuthor
  body: string
  replies: ICommentReply[]
  [key: string]: unknown
}

export interface ICommentsFile {
  version: 1
  comments: ICommentThread[]
  [key: string]: unknown
}

export type CommentsSidecarErrorCode = 'UNREADABLE' | 'BAD_VERSION'

export class CommentsSidecarError extends Error {
  readonly code: CommentsSidecarErrorCode

  constructor(code: CommentsSidecarErrorCode, message: string) {
    super(message)
    this.name = 'CommentsSidecarError'
    this.code = code
  }
}

export const COMMENTS_FILE_VERSION = 1 as const
export const QUOTE_CONTEXT_CHARS = 32
```

`packages/desktop/src/common/comments/sidecarPath.ts`:

```ts
export const sidecarPath = (markdownPath: string): string => `${markdownPath}.comments.json`

export const oldSidecarPathAfterRename = (
  oldMarkdownPath: string,
  newMarkdownPath: string
): { oldSidecar: string; newSidecar: string } => ({
  oldSidecar: sidecarPath(oldMarkdownPath),
  newSidecar: sidecarPath(newMarkdownPath)
})
```

`packages/desktop/src/common/comments/bind.ts`:

```ts
import {
  QUOTE_CONTEXT_CHARS,
  type ICommentThread
} from '@shared/types/comments'

const indexesOf = (haystack: string, needle: string): number[] => {
  if (!needle) return []
  const out: number[] = []
  let from = 0
  while (from <= haystack.length) {
    const i = haystack.indexOf(needle, from)
    if (i === -1) break
    out.push(i)
    from = i + Math.max(needle.length, 1)
  }
  return out
}

export const extractQuoteContext = (
  markdown: string,
  startOffset: number,
  endOffset: number
): Pick<ICommentThread, 'quote' | 'prefix' | 'suffix' | 'startOffset' | 'endOffset'> => {
  const start = Math.max(0, Math.min(startOffset, markdown.length))
  const end = Math.max(start, Math.min(endOffset, markdown.length))
  return {
    quote: markdown.slice(start, end),
    prefix: markdown.slice(Math.max(0, start - QUOTE_CONTEXT_CHARS), start),
    suffix: markdown.slice(end, Math.min(markdown.length, end + QUOTE_CONTEXT_CHARS)),
    startOffset: start,
    endOffset: end
  }
}

const applyOffsets = (comment: ICommentThread, markdown: string, start: number, end: number): ICommentThread => ({
  ...comment,
  ...extractQuoteContext(markdown, start, end),
  orphaned: false
})

export const bindComment = (markdown: string, comment: ICommentThread): ICommentThread => {
  const wrapped = `${comment.prefix}${comment.quote}${comment.suffix}`
  if (comment.quote && comment.prefix && comment.suffix) {
    const wrappedHits = indexesOf(markdown, wrapped)
    if (wrappedHits.length === 1) {
      const start = wrappedHits[0]! + comment.prefix.length
      return applyOffsets(comment, markdown, start, start + comment.quote.length)
    }
  }

  const quoteHits = indexesOf(markdown, comment.quote)
  if (quoteHits.length === 1) {
    const start = quoteHits[0]!
    return applyOffsets(comment, markdown, start, start + comment.quote.length)
  }
  if (quoteHits.length > 1) {
    let best = quoteHits[0]!
    let bestDist = Math.abs(best - comment.startOffset)
    for (const hit of quoteHits) {
      const dist = Math.abs(hit - comment.startOffset)
      if (dist <= bestDist) {
        best = hit
        bestDist = dist
      }
    }
    return applyOffsets(comment, markdown, best, best + comment.quote.length)
  }

  return { ...comment, orphaned: true }
}

export const followComment = (markdown: string, comment: ICommentThread): ICommentThread => {
  const rebound = bindComment(markdown, comment)
  if (!rebound.orphaned) return rebound
  if (!comment.prefix || !comment.suffix) return { ...comment, orphaned: true }

  const prefixAt = markdown.indexOf(comment.prefix)
  if (prefixAt === -1) return { ...comment, orphaned: true }
  const afterPrefix = prefixAt + comment.prefix.length
  const suffixAt = markdown.indexOf(comment.suffix, afterPrefix)
  if (suffixAt === -1 || suffixAt === afterPrefix) return { ...comment, orphaned: true }
  return applyOffsets(comment, markdown, afterPrefix, suffixAt)
}

export const bindComments = (
  markdown: string,
  comments: ICommentThread[]
): ICommentThread[] => comments.map((c) => bindComment(markdown, c))

export const pickOverlappingComment = (
  comments: ICommentThread[],
  offset: number
): ICommentThread | null => {
  const hits = comments.filter(
    (c) => !c.orphaned && offset >= c.startOffset && offset < c.endOffset
  )
  if (!hits.length) return null
  hits.sort((a, b) => {
    const da = a.endOffset - a.startOffset
    const db = b.endOffset - b.startOffset
    if (da !== db) return da - db
    return a.startOffset - b.startOffset
  })
  return hits[hits.length - 1] ?? null
}
```

`packages/desktop/src/common/comments/relativeTime.ts`:

```ts
export const formatRelativeTime = (iso: string, now: Date = new Date()): string => {
  const then = new Date(iso).getTime()
  const diffMs = now.getTime() - then
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  if (diffMs < hour) {
    const mins = Math.max(1, Math.round(diffMs / 60000))
    return `${mins}m ago`
  }
  if (diffMs < day) {
    return `${Math.round(diffMs / hour)}h ago`
  }
  if (diffMs < 2 * day) return 'yesterday'
  return new Date(iso).toISOString().slice(0, 10)
}
```

`packages/desktop/src/common/comments/index.ts`:

```ts
export * from './sidecarPath'
export * from './bind'
export * from './relativeTime'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-bind.spec.ts`

Expected: PASS (all tests green). If `extractQuoteContext` prefix/suffix assertion fails, adjust the fixture string in the test to match the 32-char slice, do not loosen the helper.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/shared/types/comments.ts \
  packages/desktop/src/common/comments \
  packages/desktop/test/unit/specs/comments-bind.spec.ts
git commit -m "feat(comments): add sidecar path and quote bind helpers"
```

---

### Task 2: Main-process sidecar IO and IPC

**Files:**
- Create: `packages/desktop/src/main/comments/sidecar.ts`
- Create: `packages/desktop/src/main/ipc/comments.ts`
- Modify: `packages/desktop/src/shared/types/ipc.ts` (add four invoke channels)
- Modify: `packages/desktop/src/main/ipc/index.ts` (register handlers)
- Test: `packages/desktop/test/unit/specs/comments-sidecar.spec.ts`

**Interfaces:**
- Consumes: `ICommentsFile`, `CommentsSidecarError`, `COMMENTS_FILE_VERSION`, `sidecarPath` from Task 1
- Produces: `loadCommentsFile(pathname)`, `saveCommentsFile(pathname, file)`, `removeCommentsFile(pathname)`, `getCommentAuthorName()`, IPC `mt::comments::load|save|remove|author-name`

- [ ] **Step 1: Write the failing test**

Create `packages/desktop/test/unit/specs/comments-sidecar.spec.ts`:

```ts
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { COMMENTS_FILE_VERSION, CommentsSidecarError } from '@shared/types/comments'
import { sidecarPath } from 'common/comments'
import {
  loadCommentsFile,
  removeCommentsFile,
  saveCommentsFile
} from 'main_renderer/comments/sidecar'

const dirs: string[] = []
const tempDir = (): string => {
  const d = mkdtempSync(path.join(tmpdir(), 'mt-comments-'))
  dirs.push(d)
  return d
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const sample = {
  version: COMMENTS_FILE_VERSION,
  comments: []
} as const

describe('comments sidecar IO', () => {
  it('returns null when the sidecar is missing', async () => {
    const md = path.join(tempDir(), 'notes.md')
    expect(await loadCommentsFile(md)).toBeNull()
  })

  it('round-trips a valid file', async () => {
    const md = path.join(tempDir(), 'notes.md')
    await saveCommentsFile(md, { version: 1, comments: [] })
    expect(existsSync(sidecarPath(md))).toBe(true)
    const loaded = await loadCommentsFile(md)
    expect(loaded?.version).toBe(1)
    expect(loaded?.comments).toEqual([])
  })

  it('preserves unknown keys', async () => {
    const md = path.join(tempDir(), 'notes.md')
    await saveCommentsFile(md, { version: 1, comments: [], extra: true } as never)
    const loaded = await loadCommentsFile(md)
    expect((loaded as { extra?: boolean } | null)?.extra).toBe(true)
  })

  it('throws UNREADABLE on corrupt JSON and does not rewrite the file', async () => {
    const md = path.join(tempDir(), 'notes.md')
    const side = sidecarPath(md)
    writeFileSync(side, '{not json')
    await expect(loadCommentsFile(md)).rejects.toMatchObject({ code: 'UNREADABLE' })
    expect(readFileSync(side, 'utf-8')).toBe('{not json')
  })

  it('throws BAD_VERSION for version !== 1', async () => {
    const md = path.join(tempDir(), 'notes.md')
    writeFileSync(sidecarPath(md), JSON.stringify({ version: 2, comments: [] }))
    await expect(loadCommentsFile(md)).rejects.toMatchObject({ code: 'BAD_VERSION' })
  })

  it('remove succeeds when the file is already gone', async () => {
    const md = path.join(tempDir(), 'notes.md')
    await expect(removeCommentsFile(md)).resolves.toBeUndefined()
  })

  it('remove deletes an existing sidecar', async () => {
    const md = path.join(tempDir(), 'notes.md')
    await saveCommentsFile(md, { ...sample })
    await removeCommentsFile(md)
    expect(existsSync(sidecarPath(md))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-sidecar.spec.ts`

Expected: FAIL — cannot resolve `main_renderer/comments/sidecar`.

- [ ] **Step 3: Write minimal implementation**

`packages/desktop/src/main/comments/sidecar.ts`:

```ts
import { unlink } from 'fs/promises'
import os from 'os'
import { writeFile } from '../filesystem'
import {
  COMMENTS_FILE_VERSION,
  CommentsSidecarError,
  type ICommentsFile
} from '@shared/types/comments'
import { sidecarPath } from 'common/comments'

const isCommentsFile = (value: unknown): value is ICommentsFile => {
  if (!value || typeof value !== 'object') return false
  const v = value as { version?: unknown; comments?: unknown }
  return v.version === COMMENTS_FILE_VERSION && Array.isArray(v.comments)
}

export const loadCommentsFile = async (markdownPath: string): Promise<ICommentsFile | null> => {
  const side = sidecarPath(markdownPath)
  let raw: string
  try {
    const { readFile } = await import('fs/promises')
    raw = await readFile(side, 'utf-8')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return null
    throw new CommentsSidecarError('UNREADABLE', `Cannot read comments sidecar: ${side}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new CommentsSidecarError('UNREADABLE', `Comments sidecar is not valid JSON: ${side}`)
  }
  if (!parsed || typeof parsed !== 'object' || !('version' in parsed)) {
    throw new CommentsSidecarError('UNREADABLE', `Comments sidecar is not an object: ${side}`)
  }
  const version = (parsed as { version?: unknown }).version
  if (version !== COMMENTS_FILE_VERSION) {
    throw new CommentsSidecarError('BAD_VERSION', `Unsupported comments sidecar version: ${String(version)}`)
  }
  if (!isCommentsFile(parsed)) {
    throw new CommentsSidecarError('UNREADABLE', `Comments sidecar is missing a comments array: ${side}`)
  }
  return parsed
}

export const saveCommentsFile = async (
  markdownPath: string,
  file: ICommentsFile
): Promise<void> => {
  const side = sidecarPath(markdownPath)
  await writeFile(side, JSON.stringify(file, null, 2), undefined, 'utf-8')
}

export const removeCommentsFile = async (markdownPath: string): Promise<void> => {
  const side = sidecarPath(markdownPath)
  try {
    await unlink(side)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
    throw err
  }
}

export const getCommentAuthorName = (): string => {
  try {
    const name = os.userInfo().username
    return name && name.trim() ? name : 'User'
  } catch {
    return 'User'
  }
}
```

`packages/desktop/src/main/ipc/comments.ts`:

```ts
import { ipcMain } from 'electron'
import type { ICommentsFile } from '@shared/types/comments'
import {
  getCommentAuthorName,
  loadCommentsFile,
  removeCommentsFile,
  saveCommentsFile
} from '../comments/sidecar'

export const registerCommentsHandlers = (): void => {
  ipcMain.handle('mt::comments::load', (_e, pathname: string) => loadCommentsFile(pathname))
  ipcMain.handle('mt::comments::save', (_e, pathname: string, file: ICommentsFile) =>
    saveCommentsFile(pathname, file)
  )
  ipcMain.handle('mt::comments::remove', (_e, pathname: string) => removeCommentsFile(pathname))
  ipcMain.handle('mt::comments::author-name', () => getCommentAuthorName())
}
```

In `packages/desktop/src/shared/types/ipc.ts`, add to `IpcInvokeChannels` (keep alphabetical-ish near other `mt::` entries):

```ts
  'mt::comments::author-name': { args: []; ret: string }
  'mt::comments::load': { args: [pathname: string]; ret: import('./comments').ICommentsFile | null }
  'mt::comments::remove': { args: [pathname: string]; ret: void }
  'mt::comments::save': { args: [pathname: string, file: import('./comments').ICommentsFile]; ret: void }
```

Prefer a top-of-file `import type { ICommentsFile } from './comments'` and use `ICommentsFile` in the entries instead of inline import.

In `packages/desktop/src/main/ipc/index.ts` add:

```ts
import { registerCommentsHandlers } from './comments'
// inside registerSandboxIpcHandlers:
  registerCommentsHandlers()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-sidecar.spec.ts`

Expected: PASS.

Also run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-bind.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/main/comments \
  packages/desktop/src/main/ipc/comments.ts \
  packages/desktop/src/main/ipc/index.ts \
  packages/desktop/src/shared/types/ipc.ts \
  packages/desktop/test/unit/specs/comments-sidecar.spec.ts
git commit -m "feat(comments): load and save sidecar files over IPC"
```

---

### Task 3: Pinia comments store

**Files:**
- Create: `packages/desktop/src/renderer/src/store/comments.ts`
- Test: `packages/desktop/test/unit/specs/comments-store.spec.ts`

**Interfaces:**
- Consumes: Task 1 helpers; Task 2 IPC channel names (`window.electron.ipcRenderer.invoke`)
- Produces: `useCommentsStore()` with `threadsForActiveTab`, `filter`, `selectedId`, `hoveredId`, `isDirty(tabId)`, `createDraft`, `commitDraft`, `discardDraft`, `addReply`, `setStatus`, `deleteThread`, `deleteReply`, `loadForTab`, `persistForPath`, `switchTab`, `unloadTab`, `markDirty`, `visibleThreads`

Store rules from the spec:

- Per-tab map keyed by tab id.
- Empty-body draft is not persisted and does not dirty.
- create/edit/reply/resolve/reopen/delete dirty the tab (`isSaved` flipped by the editor store in Task 6; this store exposes `isDirty`).
- `createDraft` requires non-empty selected text; otherwise return `null`.
- Source-mode create is rejected here when `sourceCode === true`.

- [ ] **Step 1: Write the failing test**

Create `packages/desktop/test/unit/specs/comments-store.spec.ts` using the same `vi.hoisted` `window.electron` stub pattern as `test/unit/specs/editor-store-anchor.spec.ts`. Stub `invoke` to record load/save/remove.

Cover at least:

```ts
it('rejects createDraft without selected text', () => { /* expect null, !isDirty */ })
it('rejects createDraft in source mode', () => { /* sourceCode true → null */ })
it('discards an empty draft without dirtying', () => { /* createDraft, discardDraft */ })
it('commits a body, dirties, and lists the thread', () => { /* commitDraft */ })
it('adds a reply, resolves, reopens, and deletes', () => { /* addReply, setStatus, deleteThread */ })
it('deleteThread with replies returns needsConfirm until confirmed', () => {
  // deleteThread(id, false) → { needsConfirm: true } and thread remains
  // deleteThread(id, true) removes it
})
it('switchTab swaps the visible list', () => { /* two tab ids */ })
it('persistForPath saves when comments exist and removes when empty', async () => { /* invoke spies */ })
```

Exact test file (write this verbatim):

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const invoke = vi.fn()

vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      electron?: { ipcRenderer: { invoke: (...a: unknown[]) => unknown; send: () => void; on: () => void } }
      path?: { sep: string; dirname: (p: string) => string }
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', dirname: (p: string) => p }
  w.window.electron ??= {
    ipcRenderer: { invoke: (...a: unknown[]) => invoke(...a), send: () => {}, on: () => {} }
  }
})

import { useCommentsStore } from '@/store/comments'

const selection = { text: 'budget', markdown: 'the budget before', startOffset: 4, endOffset: 10 }

describe('useCommentsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    invoke.mockReset()
    invoke.mockResolvedValue(null)
  })

  it('rejects createDraft without selected text', () => {
    const store = useCommentsStore()
    expect(store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection: { ...selection, text: '  ' } })).toBeNull()
    expect(store.isDirty('t1')).toBe(false)
  })

  it('rejects createDraft in source mode', () => {
    const store = useCommentsStore()
    expect(store.createDraft({ tabId: 't1', sourceCode: true, authorName: 'Ada', selection })).toBeNull()
  })

  it('discards an empty draft without dirtying', () => {
    const store = useCommentsStore()
    const draft = store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    expect(draft).not.toBeNull()
    store.discardDraft('t1')
    expect(store.threadsForTab('t1')).toHaveLength(0)
    expect(store.isDirty('t1')).toBe(false)
  })

  it('commits a body, dirties, and lists the thread', () => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    const id = store.commitDraft('t1', 'please check')
    expect(id).toBeTruthy()
    expect(store.threadsForTab('t1')[0]?.body).toBe('please check')
    expect(store.isDirty('t1')).toBe(true)
  })

  it('adds a reply, resolves, reopens', () => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    const id = store.commitDraft('t1', 'body')!
    store.addReply('t1', id, 'Ada', 'ok')
    expect(store.threadsForTab('t1')[0]?.replies).toHaveLength(1)
    store.setStatus('t1', id, 'resolved')
    expect(store.threadsForTab('t1')[0]?.status).toBe('resolved')
    store.setStatus('t1', id, 'open')
    expect(store.threadsForTab('t1')[0]?.status).toBe('open')
  })

  it('deleteThread with replies requires confirm', () => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    const id = store.commitDraft('t1', 'body')!
    store.addReply('t1', id, 'Ada', 'ok')
    expect(store.deleteThread('t1', id, false)).toEqual({ needsConfirm: true })
    expect(store.threadsForTab('t1')).toHaveLength(1)
    expect(store.deleteThread('t1', id, true)).toEqual({ needsConfirm: false })
    expect(store.threadsForTab('t1')).toHaveLength(0)
  })

  it('switchTab swaps the visible list', () => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 'a', sourceCode: false, authorName: 'Ada', selection })
    store.commitDraft('a', 'one')
    store.createDraft({ tabId: 'b', sourceCode: false, authorName: 'Ada', selection })
    store.commitDraft('b', 'two')
    store.switchTab('a')
    expect(store.visibleThreads.map((t) => t.body)).toEqual(['one'])
    store.switchTab('b')
    expect(store.visibleThreads.map((t) => t.body)).toEqual(['two'])
  })

  it('persistForPath saves when comments exist and removes when empty', async () => {
    const store = useCommentsStore()
    store.createDraft({ tabId: 't1', sourceCode: false, authorName: 'Ada', selection })
    store.commitDraft('t1', 'body')
    await store.persistForPath('t1', '/docs/notes.md')
    expect(invoke).toHaveBeenCalledWith('mt::comments::save', '/docs/notes.md', expect.objectContaining({ version: 1 }))
    store.deleteThread('t1', store.threadsForTab('t1')[0]!.id, true)
    await store.persistForPath('t1', '/docs/notes.md')
    expect(invoke).toHaveBeenCalledWith('mt::comments::remove', '/docs/notes.md')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-store.spec.ts`

Expected: FAIL — cannot find `@/store/comments`.

- [ ] **Step 3: Write minimal implementation**

Implement `packages/desktop/src/renderer/src/store/comments.ts` as a Pinia setup store that makes the tests pass. Required API:

```ts
createDraft(opts: {
  tabId: string
  sourceCode: boolean
  authorName: string
  selection: { text: string; markdown: string; startOffset: number; endOffset: number }
}): string | null
commitDraft(tabId: string, body: string): string | null
discardDraft(tabId: string): void
addReply(tabId: string, threadId: string, authorName: string, body: string): void
setStatus(tabId: string, threadId: string, status: 'open' | 'resolved'): void
deleteThread(tabId: string, threadId: string, confirmed: boolean): { needsConfirm: boolean }
deleteReply(tabId: string, threadId: string, replyId: string): void
threadsForTab(tabId: string): ICommentThread[]
isDirty(tabId: string): boolean
switchTab(tabId: string | null): void
visibleThreads: ComputedRef<ICommentThread[]>  // filtered by filter + document order
filter: Ref<'open' | 'resolved'>
selectedId: Ref<string | null>
hoveredId: Ref<string | null>
loadForTab(tabId: string, pathname: string, markdown: string): Promise<void>
persistForPath(tabId: string, pathname: string): Promise<void>
unloadTab(tabId: string): void
setFilter(filter: 'open' | 'resolved'): void
select(id: string | null): void
hover(id: string | null): void
draftForTab(tabId: string): ICommentThread | null
```

Implementation notes:

- `createDraft` trims `selection.text`; empty → `null`. `sourceCode` true → `null`.
- Draft lives in `drafts[tabId]` and is not in `threads` until `commitDraft`.
- `commitDraft` no-ops and returns `null` if body is empty (leave draft in place). Non-empty: build `ICommentThread` via `extractQuoteContext`, `crypto.randomUUID()`, `new Date().toISOString()`, push onto `byTab[tabId]`, set dirty, clear draft, return id.
- `visibleThreads` uses `activeTabId`. Filter `open` shows `status === 'open'` (including orphaned). Filter `resolved` shows resolved only. Sort by `startOffset` ascending; orphaned without a usable offset (`orphaned &&` bind failed, keep `startOffset`) sort last (`orphaned ? Number.MAX_SAFE_INTEGER : startOffset`).
- `persistForPath`: if no pathname, return. If `threadsForTab` is empty, `invoke('mt::comments::remove', pathname)` and clear dirty. Else `invoke('mt::comments::save', pathname, { version: 1, comments })` and clear dirty.
- `loadForTab`: `invoke('mt::comments::load', pathname)`; on `null`, set empty list; on success, `bindComments(markdown, file.comments)` into `byTab[tabId]`, dirty false; on reject, leave empty list, dirty false, rethrow so Task 6 can notify.
- Do not mark dirty on load.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-store.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/src/store/comments.ts \
  packages/desktop/test/unit/specs/comments-store.spec.ts
git commit -m "feat(comments): add per-tab comments Pinia store"
```

---

### Task 4: Layout + empty comments pane

**Files:**
- Modify: `packages/desktop/src/renderer/src/store/layout.ts`
- Create: `packages/desktop/src/renderer/src/components/comments/CommentsPane.vue`
- Create: `packages/desktop/src/renderer/src/components/comments/CommentCard.vue`
- Modify: `packages/desktop/src/renderer/src/pages/app.vue`
- Modify: `packages/desktop/src/renderer/src/components/editorWithTabs/index.vue`
- Test: `packages/desktop/test/unit/specs/comments-layout.spec.ts`

**Interfaces:**
- Consumes: `useCommentsStore` from Task 3
- Produces: `showCommentsPane`, `commentsPaneWidth`, `effectiveCommentsPaneWidth`, `TOGGLE_COMMENTS_PANE`, `SET_COMMENTS_PANE`, `SET_COMMENTS_PANE_WIDTH`

- [ ] **Step 1: Write the failing test**

`packages/desktop/test/unit/specs/comments-layout.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      electron?: { ipcRenderer: { send: () => void; on: () => void } }
      marktext?: { env?: { windowId?: number } }
    }
    localStorage?: Storage
  }
  w.window ??= {}
  w.window.electron ??= { ipcRenderer: { send: () => {}, on: () => {} } }
  w.window.marktext ??= { env: { windowId: 1 } }
})

import { useLayoutStore } from '@/store/layout'

describe('comments pane layout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('defaults closed with zero effective width', () => {
    const store = useLayoutStore()
    expect(store.showCommentsPane).toBe(false)
    expect(store.effectiveCommentsPaneWidth).toBe(0)
  })

  it('opens to at least 220px and persists width', () => {
    const store = useLayoutStore()
    store.SET_COMMENTS_PANE(true)
    expect(store.showCommentsPane).toBe(true)
    expect(store.effectiveCommentsPaneWidth).toBeGreaterThanOrEqual(220)
    store.SET_COMMENTS_PANE_WIDTH(400)
    expect(localStorage.getItem('comments-pane-width')).toBe('400')
    expect(store.effectiveCommentsPaneWidth).toBe(400)
  })

  it('TOGGLE_COMMENTS_PANE flips visibility without persisting open state', () => {
    const store = useLayoutStore()
    store.TOGGLE_COMMENTS_PANE()
    expect(store.showCommentsPane).toBe(true)
    store.TOGGLE_COMMENTS_PANE()
    expect(store.showCommentsPane).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-layout.spec.ts`

Expected: FAIL — `showCommentsPane` / `SET_COMMENTS_PANE` undefined.

- [ ] **Step 3: Write minimal implementation**

Extend `layout.ts` (same pattern as `sideBarWidth`):

- `showCommentsPane = ref(false)` — not restored from buffered layout, not written to preferences.
- `commentsPaneWidth = ref(normalizeCommentsPaneWidth(localStorage.getItem('comments-pane-width')))` with clamp `Math.max(220, n || 280)`.
- `effectiveCommentsPaneWidth`: `0` when closed, else `commentsPaneWidth`.
- `SET_COMMENTS_PANE(open: boolean)`, `TOGGLE_COMMENTS_PANE()`, `SET_COMMENTS_PANE_WIDTH(width)`.
- Closing the pane calls `useCommentsStore().discardDraft(activeTabId)` — import the comments store inside the function to avoid a cycle at module load.

`CommentsPane.vue`: right column, `v-show="showCommentsPane"`, header “Comments” + open-count + close, filter chips Open/Resolved, empty copy “Select text, then New Comment”, list of `CommentCard`. If `draftForTab(activeTabId)` is set, render that card first as a composer (textarea focused). Blur with empty body calls `discardDraft`. Drag handle on the left edge of the pane calling `SET_COMMENTS_PANE_WIDTH`. Width style `width: ${commentsPaneWidth}px`. Use CSS variables `--sideBarBgColor`, `--editorColor`, theme accent. Clicking pane background (not a card) calls `select(null)`.

`CommentCard.vue`: quote, author, `formatRelativeTime(createdAt)`, body, replies, actions Edit / Reply / Resolve|Reopen / Delete. Selected card gets accent border. Hover sets `hoveredId`. Delete with replies: `window.confirm` then `deleteThread(..., true)`.

`app.vue`: inside `.editor-middle`, after `<editor-with-tabs>`, render `<comments-pane />`. `.editor-middle` already is a column; wrap `editor-with-tabs` + comments in a row flex so the title bar stays above both:

```vue
<div class="editor-body">
  <editor-with-tabs ... />
  <comments-pane />
</div>
```

```css
.editor-body {
  flex: 1;
  display: flex;
  flex-direction: row;
  min-height: 0;
}
```

`editorWithTabs/index.vue` max-width:

```ts
const { effectiveSideBarWidth, effectiveCommentsPaneWidth } = storeToRefs(useLayoutStore())
```

```vue
:style="{ 'max-width': `calc(100vw - ${effectiveSideBarWidth}px - ${effectiveCommentsPaneWidth}px)` }"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-layout.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/src/store/layout.ts \
  packages/desktop/src/renderer/src/components/comments \
  packages/desktop/src/renderer/src/pages/app.vue \
  packages/desktop/src/renderer/src/components/editorWithTabs/index.vue \
  packages/desktop/test/unit/specs/comments-layout.spec.ts
git commit -m "feat(comments): add independent right-hand comments pane"
```

---

### Task 5: New Comment command, menus, i18n, preferences

**Files:**
- Modify: `packages/desktop/src/common/commands/constants.ts`
- Modify: `packages/desktop/src/main/keyboard/keybindingsLinux.ts`
- Modify: `packages/desktop/src/main/keyboard/keybindingsWindows.ts`
- Modify: `packages/desktop/src/main/keyboard/keybindingsDarwin.ts`
- Modify: `packages/desktop/src/main/menu/templates/edit.ts`
- Modify: `packages/desktop/src/main/menu/templates/view.ts`
- Modify: `packages/desktop/src/main/menu/actions/edit.ts`
- Modify: `packages/desktop/src/main/menu/actions/view.ts`
- Modify: `packages/desktop/src/main/contextMenu/editor/index.ts`
- Modify: `packages/desktop/src/main/contextMenu/editor/menuItems.ts`
- Modify: `packages/desktop/src/renderer/src/commands/index.ts`
- Modify: `packages/desktop/src/renderer/src/commands/descriptions.ts`
- Modify: `packages/desktop/src/main/preferences/schema.json`
- Modify: `packages/desktop/src/renderer/src/store/preferences.ts`
- Modify: `packages/desktop/src/shared/types/preferences.ts`
- Modify: `packages/desktop/src/renderer/src/prefComponents/general/index.vue`
- Modify: all `packages/desktop/static/locales/*.json`
- Modify: `packages/desktop/src/renderer/src/pages/app.vue` (listen for new-comment / toggle)
- Test: `packages/desktop/test/unit/specs/comments-commands.spec.ts`

**Interfaces:**
- Consumes: layout `TOGGLE_COMMENTS_PANE`; comments `createDraft`
- Produces: command ids `edit.new-comment`, `view.toggle-comments`; preference `commentAuthorName`

- [ ] **Step 1: Write the failing test**

`packages/desktop/test/unit/specs/comments-commands.spec.ts` should import `COMMANDS` from `common/commands/constants` and assert:

```ts
expect(COMMANDS.EDIT_NEW_COMMENT).toBe('edit.new-comment')
expect(COMMANDS.VIEW_TOGGLE_COMMENTS).toBe('view.toggle-comments')
```

Also import default maps:

```ts
import linux from 'main_renderer/keyboard/keybindingsLinux'
```

Those files export a `Map`, not a default — they export `const keybindings`. Read each file and import the named map the same way existing `keybinding-*.spec.ts` does.

Look at `packages/desktop/test/unit/specs/accelerator.spec.ts` for the import style. Assert:

- Linux `edit.new-comment` → `Ctrl+Shift+M`
- Windows `edit.new-comment` → `Ctrl+Alt+M`
- Darwin `edit.new-comment` → `Command+Alt+M`
- Linux/Windows `view.toggle-comments` → `Ctrl+Shift+Alt+C`
- Darwin `view.toggle-comments` → `Command+Shift+Alt+C`

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-commands.spec.ts`

Expected: FAIL — missing command ids.

- [ ] **Step 3: Write minimal implementation**

Add to `COMMANDS`:

```ts
EDIT_NEW_COMMENT: 'edit.new-comment',
VIEW_TOGGLE_COMMENTS: 'view.toggle-comments',
```

Keybinding maps (three platform files), next to the other edit/view entries.

`edit.ts` menu: after Find/Replace block, item label `t('menu.edit.newComment')`, accelerator `edit.new-comment`, click sends `mt::editor-new-comment` to the focused window (`win.webContents.send('mt::editor-new-comment')`).

`view.ts` menu: after Toggle Sidebar, checkbox `id: 'commentsPaneMenuItem'`, label `t('menu.view.toggleComments')`, click sends `mt::toggle-view-layout-entry` with `'showCommentsPane'` **or** a dedicated `mt::toggle-comments-pane`. Prefer dedicated send `mt::toggle-comments-pane` handled in renderer layout store to avoid coupling `TOGGLE_LAYOUT_ENTRY`’s existing `'showSideBar' | 'showTabBar'` union more than needed. Add `'mt::toggle-comments-pane': []` to `IpcMainEventChannels`.

Context menu: `getNewComment()` in `menuItems.ts`, enabled iff `selectionText.trim().length > 0`. Insert after paste-as-plain, before insert-before/after. Click: `win.webContents.send('mt::editor-new-comment')`.

Renderer command palette (`commands/index.ts`): entries that `bus.emit('view:toggle-comments')` and `bus.emit('edit:new-comment')`.

`app.vue` onMounted: listen `mt::editor-new-comment` and `mt::toggle-comments-pane`; also `bus` events `edit:new-comment` / `view:toggle-comments`. For this task, `view:toggle-comments` calls `layoutStore.TOGGLE_COMMENTS_PANE()`. `edit:new-comment` only opens the pane (`SET_COMMENTS_PANE(true)`). Task 6 replaces that handler with `createDraft` once selection is available.

Preference:

- `schema.json`: `"commentAuthorName": { "description": "General--Display name used on comments. Empty uses the OS username.", "type": "string", "default": "" }`
- `preferences.ts` state default `''`
- `IUserPreferences.commentAuthorName?: string`
- General prefs: a `text-box` bound to `commentAuthorName` after the startup compound.

Locales: add keys to **every** file in `packages/desktop/static/locales/`:

en:

```json
"menu.edit.newComment": "New Comment",
"menu.view.toggleComments": "Toggle Comments",
"contextMenu.newComment": "New Comment",
"comments.title": "Comments",
"comments.open": "Open",
"comments.resolved": "Resolved",
"comments.empty": "Select text, then New Comment",
"comments.reply": "Reply",
"comments.resolve": "Resolve",
"comments.reopen": "Reopen",
"comments.delete": "Delete",
"comments.deleteConfirm": "Delete this comment and its replies?",
"comments.orphaned": "Original text is gone",
"comments.newComment": "New Comment",
"preferences.general.comments.authorName": "Comment display name",
"preferences.general.comments.authorNameNotes": "Leave empty to use your system username",
"notifications.commentsUnreadable": "Could not read comments file. The sidecar was left unchanged.",
"notifications.commentsSaveFailed": "Markdown saved, but comments could not be written."
```

zh-CN: real Chinese for the same keys. Other locales: copy the English strings.

Register command descriptions in `descriptions.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-commands.spec.ts`

Expected: PASS.

Also run existing `pnpm -C packages/desktop exec vitest run test/unit/specs/i18n.spec.ts` if it asserts key parity across locales — fix any missing keys until it passes.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/common/commands/constants.ts \
  packages/desktop/src/main/keyboard \
  packages/desktop/src/main/menu \
  packages/desktop/src/main/contextMenu \
  packages/desktop/src/renderer/src/commands \
  packages/desktop/src/main/preferences/schema.json \
  packages/desktop/src/renderer/src/store/preferences.ts \
  packages/desktop/src/shared/types/preferences.ts \
  packages/desktop/src/renderer/src/prefComponents/general/index.vue \
  packages/desktop/src/renderer/src/pages/app.vue \
  packages/desktop/src/shared/types/ipc.ts \
  packages/desktop/static/locales \
  packages/desktop/test/unit/specs/comments-commands.spec.ts
git commit -m "feat(comments): add New Comment command, menus, and author preference"
```

---

### Task 6: Selection, file lifecycle, dirty save

**Files:**
- Modify: `packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue`
- Modify: `packages/desktop/src/renderer/src/store/editor.ts`
- Modify: `packages/desktop/src/renderer/src/pages/app.vue`
- Test: `packages/desktop/test/unit/specs/comments-lifecycle.spec.ts`

**Interfaces:**
- Consumes: `createDraft`, `loadForTab`, `persistForPath`, `switchTab`, `unloadTab`, `followComment` / `bindComments`
- Produces: bus `comments:get-selection` → `{ text, markdown, startOffset, endOffset } | null`; comments dirty flips `currentFile.isSaved`

- [ ] **Step 1: Write the failing test**

Extend store-level tests in `comments-lifecycle.spec.ts`:

```ts
it('marks the editor tab unsaved when comments become dirty', () => {
  // create pinia, editor store with a tab, comments createDraft+commitDraft
  // then a helper applyCommentsDirty(editorStore, tabId) or comments store hook
  // expect currentFile.isSaved === false
})
```

If the dirty coupling is a function `syncCommentsDirty(editorStore, tabId, dirty: boolean)` in `store/comments.ts`, test that function. Implement it to set `editorStore.tabs.find(...)?.isSaved = !dirty` when dirty is true, and not force true when dirty is false (markdown may still be dirty).

Also test `persistForPath` error: invoke rejects → helper returns false so editor can set `isSaved = false` after a successful markdown save.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-lifecycle.spec.ts`

Expected: FAIL until the helper exists.

- [ ] **Step 3: Write minimal implementation**

**Selection.** In `editor.vue`, after Muya init:

```ts
const getCommentSelection = () => {
  if (!editor.value) return null
  const sel = editor.value.getSelection()
  if (!sel || sel.isCollapsed) return null
  const text = document.getSelection()?.toString() ?? ''
  if (!text.trim()) return null
  const markdown = editor.value.getMarkdown()
  const startOffset = markdown.indexOf(text)
  if (startOffset < 0) return null
  return {
    text,
    markdown,
    startOffset,
    endOffset: startOffset + text.length
  }
}
bus.on('comments:get-selection', (cb: (s: unknown) => void) => {
  cb(getCommentSelection())
})
```

If `text` occurs twice, compute offsets from Muya cursor: walk `getMarkdown()` using `sel.anchor` / `sel.focus` only if a small helper can map them; otherwise `indexOf` plus `sel` direction is acceptable for v1. Prefer: `startOffset = markdown.indexOf(text)` and if duplicates, pick closest to a naive estimate (first hit). Follow-up bind still uses prefix/suffix.

**New comment in app.vue** — replace the Task 5 stub handler:

```ts
const beginNewComment = async (): Promise<void> => {
  const editorStore = useEditorStore()
  const preferencesStore = usePreferencesStore()
  const commentsStore = useCommentsStore()
  const layoutStore = useLayoutStore()
  if (preferencesStore.sourceCode) return
  const tabId = editorStore.currentFile?.id
  if (!tabId) return
  let selection: {
    text: string
    markdown: string
    startOffset: number
    endOffset: number
  } | null = null
  bus.emit('comments:get-selection', (s: unknown) => {
    selection = s as typeof selection
  })
  if (!selection) return
  const authorPref = String(preferencesStore.commentAuthorName ?? '').trim()
  const authorName =
    authorPref || (await window.electron.ipcRenderer.invoke('mt::comments::author-name'))
  const draftId = commentsStore.createDraft({
    tabId,
    sourceCode: false,
    authorName,
    selection
  })
  if (!draftId) return
  layoutStore.SET_COMMENTS_PANE(true)
  commentsStore.select(draftId)
  if (editorStore.currentFile) editorStore.currentFile.isSaved = false
}
```

**json-change follow.** In `editor.vue` `json-change` handler, after `LISTEN_FOR_CONTENT_CHANGE`, call `commentsStore.followMarkdown(tabId, markdown)` which runs `followComment` on each thread (skip drafts). Do not dirty on follow that only updates offsets/quote; dirty if `orphaned` flips from false to true (user deleted the quote).

Add `followMarkdown(tabId, markdown)` to the comments store with a unit test in this task’s spec:

```ts
it('marks a thread orphaned when the quote disappears', () => {
  const store = useCommentsStore()
  store.createDraft({
    tabId: 't1',
    sourceCode: false,
    authorName: 'Ada',
    selection: { text: 'budget', markdown: 'the budget before', startOffset: 4, endOffset: 10 }
  })
  store.commitDraft('t1', 'body')
  store.followMarkdown('t1', 'the before')
  expect(store.threadsForTab('t1')[0]?.orphaned).toBe(true)
})
```

**Load.** In `NEW_TAB_WITH_CONTENT`, after the tab exists, `void commentsStore.loadForTab(id, pathname, markdown).catch(notify unreadable)`. In `UPDATE_CURRENT_FILE`, `commentsStore.switchTab(currentFile.id)`.

**Unload.** In `FORCE_CLOSE_TAB`, `commentsStore.unloadTab(id)`.

**Save.** In `LISTEN_FOR_SET_PATHNAME`, after `tab.pathname` is assigned, `await commentsStore.persistForPath(tab.id, pathname)`. If it throws, `tab.isSaved = false` and notify `notifications.commentsSaveFailed`. Handle Save As: if `fileInfo` contains previous path, `removeCommentsFile` is already done by persist at the new path plus:

```ts
if (oldPath && oldPath !== pathname) {
  await window.electron.ipcRenderer.invoke('mt::comments::remove', oldPath)
}
```

Keep `oldPath` from the tab before assign.

Untitled tabs: `persistForPath` no-ops without pathname (Task 3). First Save As then persist.

**Dirty.** After `commitDraft` / `addReply` / `setStatus` / `deleteThread` (when it actually deletes) / `deleteReply`, set `currentFile.isSaved = false` and `debouncedSendBufferedState()`.

- [ ] **Step 4: Run tests**

```
pnpm -C packages/desktop exec vitest run test/unit/specs/comments-lifecycle.spec.ts
pnpm -C packages/desktop exec vitest run test/unit/specs/comments-store.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue \
  packages/desktop/src/renderer/src/store/editor.ts \
  packages/desktop/src/renderer/src/store/comments.ts \
  packages/desktop/src/renderer/src/pages/app.vue \
  packages/desktop/test/unit/specs/comments-lifecycle.spec.ts
git commit -m "feat(comments): bind comments to tab load, save, and selection"
```

---

### Task 7: Underlines, leader, jump-to-text, source mode

**Files:**
- Create: `packages/desktop/src/renderer/src/components/comments/CommentDecorations.vue`
- Create: `packages/desktop/src/common/comments/leader.ts`
- Modify: `packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue` (mount decorations overlay)
- Modify: `packages/desktop/src/renderer/src/components/comments/CommentsPane.vue`
- Test: `packages/desktop/test/unit/specs/comments-decorations.spec.ts`

**Interfaces:**
- Consumes: `visibleThreads`, `selectedId`, `hoveredId`, `pickOverlappingComment`, `filter`
- Produces: `activeLeaderCommentId(selectedId, hoveredId)`, `shouldDrawUnderline(thread, filter, selectedId)`, `leaderPath(from, to)`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { activeLeaderCommentId, shouldDrawUnderline } from 'common/comments/leader'
import type { ICommentThread } from '@shared/types/comments'

const t = (id: string, extra: Partial<ICommentThread> = {}): ICommentThread => ({
  id,
  status: 'open',
  orphaned: false,
  quote: 'x',
  prefix: '',
  suffix: '',
  startOffset: 0,
  endOffset: 1,
  createdAt: '',
  updatedAt: '',
  author: { name: 'Ada' },
  body: '',
  replies: [],
  ...extra
})

describe('comment decorations', () => {
  it('draws a leader for hover over selection', () => {
    expect(activeLeaderCommentId('sel', 'hov')).toBe('hov')
    expect(activeLeaderCommentId('sel', null)).toBe('sel')
    expect(activeLeaderCommentId(null, null)).toBeNull()
  })

  it('hides underlines for resolved unless that card is selected in the resolved filter', () => {
    const resolved = t('r', { status: 'resolved' })
    const open = t('o')
    const orphaned = t('x', { orphaned: true })
    expect(shouldDrawUnderline(open, 'open', null)).toBe(true)
    expect(shouldDrawUnderline(resolved, 'open', null)).toBe(false)
    expect(shouldDrawUnderline(resolved, 'resolved', 'r')).toBe(true)
    expect(shouldDrawUnderline(resolved, 'resolved', null)).toBe(false)
    expect(shouldDrawUnderline(orphaned, 'open', 'x')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/comments-decorations.spec.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`packages/desktop/src/common/comments/leader.ts`:

```ts
import type { CommentStatus, ICommentThread } from '@shared/types/comments'

export const activeLeaderCommentId = (
  selectedId: string | null,
  hoveredId: string | null
): string | null => hoveredId ?? selectedId

export const shouldDrawUnderline = (
  thread: ICommentThread,
  filter: 'open' | 'resolved',
  selectedId: string | null
): boolean => {
  if (thread.orphaned) return false
  if (thread.status === 'open') return true
  return filter === 'resolved' && selectedId === thread.id
}

export const leaderPath = (
  from: { x: number; y: number },
  to: { x: number; y: number }
): string => `M ${from.x} ${from.y} C ${from.x + 40} ${from.y}, ${to.x - 40} ${to.y}, ${to.x} ${to.y}`
```

Re-export from `common/comments/index.ts`.

`CommentDecorations.vue`: absolutely positioned overlay on the editor wrapper (`pointer-events: none` except underlines). For each thread with `shouldDrawUnderline`, find the quote in the editor DOM via `window.find` is forbidden (moves selection). Instead: walk text nodes of `.mu-editor` (or the Muya root class — inspect the live class; it is `mu-editor` per muya CSS) and locate `thread.quote` starting at a character count matching `startOffset` as a hint. Wrap matches with a `span.mt-comment-underline` is unsafe (snabbdom will destroy it). **Do not wrap.** Use an absolutely positioned `div` per underline using `Range.getClientRects()` from a temporary Range over the matching text node, then `range.detach()`. Recompute on scroll (`container` scroll listener already used for typewriter) and on `json-change`.

Click on an underline hit-rect: `pointer-events: auto` on those rects, call `pickOverlappingComment` using a markdown offset derived from the click target’s dataset (`data-start` / `data-end` stored on the rect). Then `commentsStore.select(id)` and `editor.value` set selection if a Range can be restored.

SVG leader: one `path` from the selected/hovered underline’s right-center to the matching `CommentCard`’s left-center (`getBoundingClientRect` both, convert into overlay-local coordinates). Stroke `var(--themeColor)` or `--editorColor80`, `stroke-dasharray: 5 4`, fill none. Hide when `activeLeaderCommentId` is null or that thread is orphaned or source mode is on.

**Source mode:** `CommentDecorations` `v-if="!sourceCode"`. New Comment already no-ops. Clicking a card in source mode still selects the card and scrolls the pane, but does not call `muya.setSelection` and does not emit a mode switch.

**Jump from card:** `CommentCard` click → `select(id)` → bus `comments:scroll-to` with `{ startOffset, endOffset, quote }`. `editor.vue` listens; if `sourceCode`, return. Otherwise locate the underline overlay rects for that id (they share `data-comment-id`) and call `scrollIntoView({ block: 'center' })` on the first rect. Then build a DOM `Range` over the matching text node and add it with `document.getSelection()`. Muya already tracks `selectionchange`, so this is the supported way to show the related body text.

**Clear selection:** click empty editor chrome (not on an underline) → `select(null)`.

- [ ] **Step 4: Run tests**

```
pnpm -C packages/desktop exec vitest run test/unit/specs/comments-decorations.spec.ts
pnpm -C packages/desktop exec vitest run test/unit/specs/comments-bind.spec.ts
pnpm -C packages/desktop exec vitest run test/unit/specs/comments-store.spec.ts
pnpm -C packages/desktop exec vitest run test/unit/specs/comments-layout.spec.ts
pnpm -C packages/desktop exec vitest run test/unit/specs/comments-sidecar.spec.ts
pnpm -C packages/desktop exec vitest run test/unit/specs/comments-commands.spec.ts
pnpm -C packages/desktop exec vitest run test/unit/specs/comments-lifecycle.spec.ts
```

Expected: all PASS.

Then `pnpm run lint` and `pnpm run typecheck` from repo root. Fix any issues caused by these files.

Manual (not CI): open a file, select text, New Comment, save, reopen, click card, delete all, save, confirm sidecar gone. Check leader while scrolling.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/common/comments \
  packages/desktop/src/renderer/src/components/comments \
  packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue \
  packages/desktop/test/unit/specs/comments-decorations.spec.ts
git commit -m "feat(comments): underline quotes and draw a leader to the active card"
```

---

## Spec coverage

| Spec item | Task |
|---|---|
| Sidecar path + JSON schema types | 1, 2 |
| Bind / follow / orphaned / duplicate quotes | 1, 6 |
| IPC load/save/remove/author-name | 2 |
| Corrupt sidecar not overwritten on load | 2 |
| Per-tab store, draft discard, replies, resolve, delete confirm | 3 |
| Independent pane, default closed, width, title-bar layout | 4 |
| New Comment shortcut/menu/context, author pref, i18n | 5 |
| Dirty tab, save with markdown, Save As, untitled | 6 |
| Underline, selected wash, single leader, click jump | 7 |
| Source mode list-only | 5–7 |
| Export omits comments | satisfied by not touching export |

## Type names (do not rename later)

`ICommentsFile`, `ICommentThread`, `ICommentReply`, `CommentsSidecarError`, `sidecarPath`, `bindComment`, `followComment`, `createDraft`, `commitDraft`, `persistForPath`, `loadForTab`, `showCommentsPane`, `effectiveCommentsPaneWidth`, `mt::comments::load`.
