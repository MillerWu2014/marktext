import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')

const read = (rel: string): string => readFileSync(resolve(repo, rel), 'utf8')

const JUSTIFY_BODY = /text-align:\s*justify/
const LAST_START = /text-align-last:\s*start/

describe('default justified prose', () => {
  it('justifies editor paragraphs, lists, and quotes, not headings', () => {
    const css = read('packages/muya/src/assets/styles/blockSyntax.css')

    expect(css).toMatch(
      /\.mu-container p,\s*\.mu-container li,\s*\.mu-container blockquote\s*\{[^}]*text-align:\s*justify/
    )
    expect(css).toMatch(
      /\.mu-container p,\s*\.mu-container li,\s*\.mu-container blockquote\s*\{[^}]*text-align-last:\s*start/
    )
    expect(css).not.toMatch(/\.mu-container h1[^{]*\{[^}]*text-align:\s*justify/)
  })

  it('justifies exported markdown body copy the same way', () => {
    const css = read('packages/muya/src/assets/styles/exportStyle.css')

    expect(css).toMatch(
      /\.markdown-body p,\s*\.markdown-body li,\s*\.markdown-body blockquote\s*\{[^}]*text-align:\s*justify/
    )
    expect(css).toMatch(LAST_START)
    expect(css).toMatch(JUSTIFY_BODY)
  })

  it('justifies printed markdown body copy the same way', () => {
    const css = read('packages/desktop/src/renderer/src/assets/styles/printService.css')

    expect(css).toMatch(
      /body article\.markdown-body p,\s*body article\.markdown-body li,\s*body article\.markdown-body blockquote\s*\{[^}]*text-align:\s*justify/
    )
    expect(css).toMatch(LAST_START)
  })

  it('does not let paragraph text-align-last steal image left/center/right', () => {
    // Images live in a <p>. `text-align-last: start` is inherited, and a
    // centered image is a one-line block — so last-line start equals left.
    const css = read('packages/muya/src/assets/styles/inlineSyntax.css')
    expect(css).toMatch(
      /\.mu-inline-image\.left,\s*\.mu-inline-image\.center,\s*\.mu-inline-image\.right\s*\{[^}]*text-align-last:\s*auto/
    )
    expect(css).toMatch(/\.mu-inline-image\.center\s*\{[^}]*text-align:\s*center/)
  })

  it('centers diagram SVG/img with auto margins, not only text-align', () => {
    // Mermaid emits `display:block` SVG; text-align on the preview does not
    // move block-level children.
    const css = read('packages/muya/src/assets/styles/blockSyntax.css')
    expect(css).toMatch(
      /figure\.mu-diagram-block \.mu-diagram-preview > svg\s*\{[^}]*margin:\s*0 auto/
    )
    expect(css).toMatch(
      /figure\.mu-diagram-block \.mu-diagram-preview img\s*\{[^}]*margin:\s*0 auto/
    )
  })
})
