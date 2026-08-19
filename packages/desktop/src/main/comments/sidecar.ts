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

export const loadCommentsFile = async(markdownPath: string): Promise<ICommentsFile | null> => {
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

export const saveCommentsFile = async(
  markdownPath: string,
  file: ICommentsFile
): Promise<void> => {
  const side = sidecarPath(markdownPath)
  await writeFile(side, JSON.stringify(file, null, 2), undefined, 'utf-8')
}

export const removeCommentsFile = async(markdownPath: string): Promise<void> => {
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
