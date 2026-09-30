import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { titleBarAncestors } from '@/components/titleBar/label'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')
const titleBarVue = readFileSync(
  resolve(repo, 'packages/desktop/src/renderer/src/components/titleBar/index.vue'),
  'utf8'
)

describe('titleBarAncestors', () => {
  it('does not show directory crumbs for a nested markdown path', () => {
    expect(
      titleBarAncestors('/Users/me/projects/codex-full-sdk/sdk-v1/app-server-api.zh.md', '/')
    ).toEqual([])
  })

  it('does not show directory crumbs for a Windows path', () => {
    expect(
      titleBarAncestors('C:\\Users\\me\\projects\\sdk-v1\\app-server-api.zh.md', '\\')
    ).toEqual([])
  })

  it('returns an empty list when there is no pathname', () => {
    expect(titleBarAncestors(undefined, '/')).toEqual([])
    expect(titleBarAncestors('', '/')).toEqual([])
  })
})

describe('title bar template', () => {
  it('shows the filename without parent directory crumbs', () => {
    expect(titleBarVue).toContain('{{ filename }}')
    expect(titleBarVue).not.toContain('v-for="(path, index) of paths"')
    expect(titleBarVue).not.toContain('path-arrow')
    expect(titleBarVue).not.toContain('ArrowRight')
  })
})
