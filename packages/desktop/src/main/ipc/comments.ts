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
