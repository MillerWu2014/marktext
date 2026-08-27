import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')

const read = (rel: string): string => readFileSync(resolve(repo, rel), 'utf8')

const block = (css: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))
  return match?.[1] ?? ''
}

describe('table page-width containment', () => {
  it('editor tables use fixed layout and wrap inside the column', () => {
    const css = read('packages/muya/src/assets/styles/blockSyntax.css')
    const inner = block(css, '.mu-table-inner')
    const cells = block(css, '.mu-table-cell-content')

    // `table-layout:fixed` equalizes columns and clips KaTeX (nowrap + overflow
    // glyphs). Auto layout still wraps text via overflow-wrap, but math can size
    // its column.
    expect(inner).not.toMatch(/table-layout:\s*fixed/)
    expect(inner).toMatch(/max-width:\s*100%/)
    expect(inner).toMatch(/overflow-wrap:\s*anywhere/)
    expect(cells).not.toMatch(/min-width:\s*10em/)
  })

  it('exported markdown tables wrap on the page without touching page-container', () => {
    const css = read('packages/muya/src/assets/styles/exportStyle.css')
    const tables = block(css, '.markdown-body table')

    expect(tables).toMatch(/display:\s*table/)
    expect(tables).not.toMatch(/table-layout:\s*fixed/)
    expect(tables).toMatch(/max-width:\s*100%/)
    expect(tables).toMatch(/overflow-wrap:\s*anywhere/)
    expect(css).not.toMatch(/page-container[^{]*\{[^}]*table-layout:\s*fixed/)
  })

  it('print stylesheet wraps markdown tables the same way', () => {
    const css = read('packages/desktop/src/renderer/src/assets/styles/printService.css')
    const tables = block(css, 'body article.markdown-body table')

    expect(tables).toMatch(/display:\s*table/)
    expect(tables).not.toMatch(/table-layout:\s*fixed/)
    expect(tables).toMatch(/max-width:\s*100%/)
    expect(tables).toMatch(/overflow-wrap:\s*anywhere/)
  })
})
