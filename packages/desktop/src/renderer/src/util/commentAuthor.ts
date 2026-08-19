import { usePreferencesStore } from '@/store/preferences'

// Falls back to the OS username from the main process when the display-name
// preference is blank, per the `commentAuthorName` default of ''.
export const resolveCommentAuthorName = async(): Promise<string> => {
  const preference = String(usePreferencesStore().commentAuthorName ?? '').trim()
  if (preference) return preference
  return await window.electron.ipcRenderer.invoke('mt::comments::author-name')
}
