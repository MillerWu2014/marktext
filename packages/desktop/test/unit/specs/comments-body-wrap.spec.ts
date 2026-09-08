import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const card = readFileSync(
  resolve(here, '../../../src/renderer/src/components/comments/CommentCard.vue'),
  'utf8'
)

describe('comment body line breaks', () => {
  it('keeps textarea newlines visible on the saved body and replies', () => {
    // <p>{{ body }}</p> collapses \n unless the display style is pre-wrap.
    expect(card).toMatch(
      /\.comment-body,\s*\.reply-body\s*\{[^}]*white-space:\s*pre-wrap/
    )
  })
})
