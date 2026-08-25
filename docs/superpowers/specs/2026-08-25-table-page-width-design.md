# Table page-width containment

Tables currently size to their content (`min-width: 10em` per cell, `word-break: initial`) and ignore the editor column (`--editor-area-width` / preference Max width). Export/print then forces `display: table`, which undoes GitHub’s scrollable table and lets columns paint past the PDF page.

## Locked decisions

| Topic | Choice |
|---|---|
| Behavior | **A** — wrap. Tables stay inside the editor column and the PDF page. |
| Editor | `table-layout: fixed`, `width/max-width: 100%`, wrap long cell text. Drop the `10em` cell min-width so columns can shrink. |
| PDF / print | Same wrap on `.markdown-body table` only (not the header/footer `table.page-container`). Keep `display: table` so Chromium printToPDF still lays out a real table. |
| Markdown | Unchanged. This is CSS only. |

## Out of scope

- Horizontal scroll inside the editor
- Auto-shrinking font size
- Changing the Max width preference itself
