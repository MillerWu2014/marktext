# Default justified prose

Locked choice **A**: body copy is justified in the WYSIWYG editor and in PDF/HTML export.

| Topic | Choice |
|---|---|
| Alignment | `text-align: justify` with `text-align-last: start` so the last line is not stretched |
| Applies to | Paragraphs, list items, blockquotes |
| Unchanged | Headings, code, tables, math, source-code mode |
| Markdown | Unchanged — display/export CSS only |
| Preference | None this round; this is the new default |

PDF/print uses the same rules on `.markdown-body p/li/blockquote` only. Header/footer and table cells keep their own alignment.
