import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { COMMENTS_FILE_VERSION, type ICommentThread } from '@shared/types/comments'
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
  comments: [] as ICommentThread[]
}

describe('comments sidecar IO', () => {
  it('returns null when the sidecar is missing', async() => {
    const md = path.join(tempDir(), 'notes.md')
    expect(await loadCommentsFile(md)).toBeNull()
  })

  it('round-trips a valid file', async() => {
    const md = path.join(tempDir(), 'notes.md')
    await saveCommentsFile(md, { version: 1, comments: [] })
    expect(existsSync(sidecarPath(md))).toBe(true)
    const loaded = await loadCommentsFile(md)
    expect(loaded?.version).toBe(1)
    expect(loaded?.comments).toEqual([])
  })

  it('preserves unknown keys', async() => {
    const md = path.join(tempDir(), 'notes.md')
    await saveCommentsFile(md, { version: 1, comments: [], extra: true } as never)
    const loaded = await loadCommentsFile(md)
    expect((loaded as { extra?: boolean } | null)?.extra).toBe(true)
  })

  it('throws UNREADABLE on corrupt JSON and does not rewrite the file', async() => {
    const md = path.join(tempDir(), 'notes.md')
    const side = sidecarPath(md)
    writeFileSync(side, '{not json')
    await expect(loadCommentsFile(md)).rejects.toMatchObject({ code: 'UNREADABLE' })
    expect(readFileSync(side, 'utf-8')).toBe('{not json')
  })

  it('throws BAD_VERSION for version !== 1', async() => {
    const md = path.join(tempDir(), 'notes.md')
    writeFileSync(sidecarPath(md), JSON.stringify({ version: 2, comments: [] }))
    await expect(loadCommentsFile(md)).rejects.toMatchObject({ code: 'BAD_VERSION' })
  })

  it('remove succeeds when the file is already gone', async() => {
    const md = path.join(tempDir(), 'notes.md')
    await expect(removeCommentsFile(md)).resolves.toBeUndefined()
  })

  it('remove deletes an existing sidecar', async() => {
    const md = path.join(tempDir(), 'notes.md')
    await saveCommentsFile(md, { ...sample })
    await removeCommentsFile(md)
    expect(existsSync(sidecarPath(md))).toBe(false)
  })
})
