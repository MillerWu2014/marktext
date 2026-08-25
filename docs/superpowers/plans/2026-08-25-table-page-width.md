# Table page-width containment Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep GFM tables inside the editor Max-width column and inside the PDF page by wrapping cell text.

**Architecture:** CSS only. Editor rules on `.mu-table` / `.mu-table-inner`; export/print rules on `.markdown-body table` (never `table.page-container`).

**Tech Stack:** Muya `blockSyntax.css`, `exportStyle.css`, desktop `printService.css`, Vitest.

## Global Constraints

- Do not serialize layout into markdown.
- Do not change `table.page-container` header/footer layout.
- 2-space indent, no semicolons in TS; CSS matches surrounding files.

---

### Task 1: Failing tests for wrap rules

**Files:**
- Create: `packages/desktop/test/unit/specs/table-page-width.spec.ts`
- Modify: `packages/desktop/test/unit/specs/exportHtml.spec.ts`

- [ ] **Step 1: Write failing CSS/export tests**
- [ ] **Step 2: Run them and confirm they fail on missing `table-layout: fixed`**
- [ ] **Step 3: Add the CSS (Task 2) and re-run**

---

### Task 2: Editor + export + print CSS

**Files:**
- Modify: `packages/muya/src/assets/styles/blockSyntax.css`
- Modify: `packages/muya/src/assets/styles/exportStyle.css`
- Modify: `packages/desktop/src/renderer/src/assets/styles/printService.css`
