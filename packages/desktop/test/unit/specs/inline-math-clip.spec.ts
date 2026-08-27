import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')

const read = (rel: string): string => readFileSync(resolve(repo, rel), 'utf8')

// KaTeX builds operators and braces with `table-layout:fixed` vlists plus
// `width:0` thinboxes whose glyphs overflow the box. Clipping those overflow
// paints (`overflow: auto/hidden` on `.mu-math-render`) or shrinking the 2px
// `.vlist-s` strut makes `$T_i=\max\{e_i,a_i\}$` lose its interior.

describe('inline math must not clip KaTeX overflow', () => {
  it('does not zero KaTeX .vlist-s / .vlist-t2 inside inline math', () => {
    const css = read('packages/muya/src/assets/styles/inlineSyntax.css')

    expect(css).not.toMatch(/\.vlist-s\s*\{[^}]*width:\s*0/)
    expect(css).not.toMatch(/\.vlist-t2\s*\{[^}]*margin-right:\s*0/)
  })

  it('lets committed (hidden) inline math paint overflow instead of clipping', () => {
    const css = read('packages/muya/src/assets/styles/inlineSyntax.css')

    expect(css).toMatch(
      /\.mu-hide\.mu-math\s*>\s*\.mu-math-render\s*\{[^}]*overflow:\s*visible/
    )
  })

  it('keeps horizontal scroll only on the editing popup', () => {
    const css = read('packages/muya/src/assets/styles/inlineSyntax.css')

    expect(css).toMatch(
      /\.mu-math:not\(\.mu-hide\)\s*>\s*\.mu-math-render\s*\{[^}]*overflow:\s*auto\s+hidden/
    )
  })

  it('stops table wrap rules from breaking KaTeX nowrap boxes', () => {
    const editor = read('packages/muya/src/assets/styles/blockSyntax.css')
    const exported = read('packages/muya/src/assets/styles/exportStyle.css')
    const print = read('packages/desktop/src/renderer/src/assets/styles/printService.css')

    for (const css of [editor, exported, print]) {
      expect(css).toMatch(/\.katex\s*\{[^}]*word-break:\s*normal/)
      expect(css).toMatch(/\.katex\s*\{[^}]*overflow-wrap:\s*normal/)
    }
  })

  it('lets table columns size to math instead of clipping it with fixed layout', () => {
    const editor = read('packages/muya/src/assets/styles/blockSyntax.css')
    const exported = read('packages/muya/src/assets/styles/exportStyle.css')
    const print = read('packages/desktop/src/renderer/src/assets/styles/printService.css')

    expect(editor).not.toMatch(/\.mu-table-inner\s*\{[^}]*table-layout:\s*fixed/)
    expect(exported).not.toMatch(/\.markdown-body table\s*\{[^}]*table-layout:\s*fixed/)
    expect(print).not.toMatch(
      /body article\.markdown-body table\s*\{[^}]*table-layout:\s*fixed/
    )
  })
})
