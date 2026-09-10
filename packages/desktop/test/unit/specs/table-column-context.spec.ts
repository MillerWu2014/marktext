import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyTableColumnAction,
  findTableCellAtPoint,
  probeTableColumnContext,
  runTableColumnAction
} from '@/util/tableColumnContext'

const BLOCK_DOM_PROPERTY = '__MUYA_BLOCK__'

afterEach(() => {
  document.body.innerHTML = ''
})

function makeTableDom() {
  document.body.innerHTML = `
    <table class="mu-table-inner">
      <tr>
        <td class="mu-table-cell" data-align="none"><span class="inner">a</span></td>
        <td class="mu-table-cell mu-table-cell-selected" data-align="center">
          <span class="inner">b</span>
        </td>
      </tr>
    </table>
  `
  const cells = [...document.querySelectorAll('td.mu-table-cell')] as HTMLElement[]
  return { left: cells[0], right: cells[1] }
}

describe('findTableCellAtPoint', () => {
  it('returns the cell when the hit is nested content inside a selected column', () => {
    const { right } = makeTableDom()
    const inner = right.querySelector('.inner')
    expect(inner).toBeInstanceOf(HTMLElement)
    expect(findTableCellAtPoint(10, 10, () => (inner ? [inner] : []))).toBe(right)
  })

  it('returns null when the click is outside a table', () => {
    document.body.innerHTML = '<p>hello</p>'
    const paragraph = document.querySelector('p')
    expect(findTableCellAtPoint(0, 0, () => (paragraph ? [paragraph] : []))).toBeNull()
  })
})

describe('probeTableColumnContext', () => {
  it('reports the clicked column alignment so the menu can check it', () => {
    const { right } = makeTableDom()
    expect(probeTableColumnContext(1, 1, () => [right])).toEqual({
      inTable: true,
      align: 'center'
    })
  })

  it('returns null and clears pending context outside a table', () => {
    document.body.innerHTML = '<p>x</p>'
    const paragraph = document.querySelector('p')
    expect(probeTableColumnContext(0, 0, () => (paragraph ? [paragraph] : []))).toBeNull()
  })
})

describe('runTableColumnAction', () => {
  const makeBlock = (align: 'none' | 'left' | 'center' | 'right' = 'none') => {
    const cursor = { setCursor: vi.fn() }
    const table = {
      insertColumn: vi.fn(() => cursor),
      removeColumn: vi.fn(() => cursor),
      alignColumn: vi.fn()
    }
    return { table, columnOffset: 2, align, cursor }
  }

  it('inserts a column to the left of the clicked index', () => {
    const block = makeBlock()
    runTableColumnAction(block, { type: 'insert', side: 'left' })
    expect(block.table.insertColumn).toHaveBeenCalledWith(2)
    expect(block.cursor.setCursor).toHaveBeenCalledWith(0, 0)
  })

  it('inserts a column to the right of the clicked index', () => {
    const block = makeBlock()
    runTableColumnAction(block, { type: 'insert', side: 'right' })
    expect(block.table.insertColumn).toHaveBeenCalledWith(3)
  })

  it('removes the clicked column', () => {
    const block = makeBlock()
    runTableColumnAction(block, { type: 'remove' })
    expect(block.table.removeColumn).toHaveBeenCalledWith(2)
    expect(block.cursor.setCursor).toHaveBeenCalledWith(0, 0)
  })

  it('aligns the column left, center, or right', () => {
    const block = makeBlock()
    runTableColumnAction(block, { type: 'align', align: 'right' })
    expect(block.table.alignColumn).toHaveBeenCalledWith(2, 'right')
  })

  it('does not toggle alignment off when the menu repeats the current value', () => {
    const block = makeBlock('left')
    runTableColumnAction(block, { type: 'align', align: 'left' })
    expect(block.table.alignColumn).not.toHaveBeenCalled()
  })
})

describe('applyTableColumnAction', () => {
  it('runs the pending probed cell through the Muya table APIs', () => {
    const { right } = makeTableDom()
    const cursor = { setCursor: vi.fn() }
    const table = {
      insertColumn: vi.fn(() => cursor),
      removeColumn: vi.fn(),
      alignColumn: vi.fn()
    }
    Object.defineProperty(right, BLOCK_DOM_PROPERTY, {
      value: {
        blockName: 'table.cell',
        table,
        columnOffset: 1,
        align: 'center'
      }
    })

    probeTableColumnContext(0, 0, () => [right])
    applyTableColumnAction({ type: 'insert', side: 'left' })

    expect(table.insertColumn).toHaveBeenCalledWith(1)
    expect(cursor.setCursor).toHaveBeenCalledWith(0, 0)
  })
})
