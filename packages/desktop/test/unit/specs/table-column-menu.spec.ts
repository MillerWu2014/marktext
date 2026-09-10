import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { tableColumnMenuEntries } from '@shared/types/tableColumnMenu'

const here = dirname(fileURLToPath(import.meta.url))
const localesDir = resolve(here, '../../../static/locales')

const LOCALE_KEYS = [
  'insertColumnLeft',
  'insertColumnRight',
  'deleteColumn',
  'alignColumnLeft',
  'alignColumnCenter',
  'alignColumnRight'
] as const

describe('tableColumnMenuEntries', () => {
  it('is empty when the click is not in a table', () => {
    expect(tableColumnMenuEntries(null)).toEqual([])
  })

  it('offers insert, delete, and align actions for the clicked column', () => {
    const ids = tableColumnMenuEntries({ inTable: true, align: 'none' }).map((entry) =>
      entry.kind === 'separator' ? 'sep' : entry.id
    )

    expect(ids).toEqual([
      'insertColumnLeftMenuItem',
      'insertColumnRightMenuItem',
      'deleteColumnMenuItem',
      'sep',
      'alignColumnLeftMenuItem',
      'alignColumnCenterMenuItem',
      'alignColumnRightMenuItem',
      'sep'
    ])
  })

  it('checks the radio item that matches the column alignment', () => {
    const items = tableColumnMenuEntries({ inTable: true, align: 'right' }).filter(
      (entry) => entry.kind === 'item'
    )
    const right = items.find((entry) => entry.id === 'alignColumnRightMenuItem')
    const left = items.find((entry) => entry.id === 'alignColumnLeftMenuItem')

    expect(right?.checked).toBe(true)
    expect(left?.checked).toBe(false)
  })
})

describe('table column context-menu locales', () => {
  it('defines the six column actions in every desktop locale file', () => {
    const files = readdirSync(localesDir).filter(
      (name) => name.endsWith('.json') && !name.includes('.min')
    )
    expect(files.length).toBeGreaterThanOrEqual(10)

    for (const file of files) {
      const json = JSON.parse(readFileSync(resolve(localesDir, file), 'utf8')) as {
        contextMenu?: Record<string, unknown>
      }
      for (const key of LOCALE_KEYS) {
        expect(typeof json.contextMenu?.[key], `${file} contextMenu.${key}`).toBe('string')
      }
    }
  })
})
