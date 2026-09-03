# 本仓库相对上游 MarkText 的改动说明

这份文档记录 **MillerWu2014/marktext** 相对开源上游 **marktext/marktext** 多出来的功能与代码。用途只有一个：上游 `develop` 更新后，把新功能合进本仓库时，能快速判断该保什么、该重打什么补丁、测什么。

更细的产品决策见各功能的 design spec（文末索引）。合入时以本文的**锁定决策**和**接入点**为准；spec 只补充动机。

---

## 1. 仓库身份

| 项 | 值 |
|---|---|
| 产品名 | **MDComment**（由 MarkText 改名；界面、安装包、CLI 均使用此名） |
| 本仓库 | https://github.com/MillerWu2014/marktext |
| 上游 | https://github.com/marktext/marktext |
| 工作分支 | `develop`（PR 也合进 `develop`，不要合 `main`） |
| 分叉点（本仓库最后一次与上游同内容的提交） | `e52106fd` — `docs: update sponsor logo (#5014)`（2026-07-27） |
| 本文对照的 HEAD | `569e476f` — `feat(editor): default body copy to justified alignment` |

统计（`e52106fd..HEAD`）：约 **114 个文件**，**+6757 / −81**。其中批注是主体；图标是资源替换；表格与两端对齐是 CSS。改动在 `packages/desktop`、`packages/muya`（当前编辑引擎）和网站 favicon；**没有**改正在退役的 `packages/muyajs`。

已合入本仓库的 PR（全部 `base: develop`）：

| PR | 主题 |
|---|---|
| #1–#7 | 批注：sidecar、侧栏、工具栏按钮、嵌套回复、打开即加载 |
| #8 | 初版海象应用图标 / `.md` 关联图标 / favicon；批注工具栏黄气泡 PNG（工具栏未显示） |
| #9 | 表格限制在编辑栏宽和 PDF 页宽内（换行，不横向滚动） |
| #10 | 正文默认两端对齐（编辑器 + 导出） |

---

## 2. 功能清单与锁定决策

合入上游时，下面这些选择不要静默改掉。上游若提供同类能力，以本表为准做适配，而不是直接采用上游默认。

### 2.1 Word 风格批注（最大功能）

| 主题 | 锁定选择 |
|---|---|
| 持久化 | sidecar：`${markdownPath}.comments.json`，与 `.md` **同目录** |
| 写入 Markdown / Muya JSON | **禁止**。解析、序列化、CommonMark/GFM、导出 HTML 都不得带批注标记 |
| 锚定 | 小改动能跟；引文找不到 → `orphaned: true`，显示「原文已不在」 |
| 作者 | OS 用户名；偏好设置 `commentAuthorName` 可覆盖（空则用系统名） |
| 侧栏 | 独立右栏，**不是**左侧栏的 `rightColumn` 页签；默认关闭 |
| 自动打开 | 新建批注时打开；打开已有 sidecar 且其中有线程时也打开 |
| 创建入口 | 右键菜单、快捷键、选中后浮动格式工具栏最右侧按钮 |
| 快捷键 新建 | Win `Ctrl+Alt+M` · macOS `Command+Alt+M` · Linux `Ctrl+Shift+Alt+M` |
| 快捷键 开关侧栏 | Win/Linux `Ctrl+Shift+Alt+C` · macOS `Command+Shift+Alt+C` |
| 编辑模式 | WYSIWYG 全功能；源码模式只显示列表（不能新建、没有下划线/引导线） |
| 回复 | Word 风格，最多 **2** 层（根 → 回复 → 回复的回复） |
| 导出 / 打印 | 不含批注 |

### 2.2 品牌

| 主题 | 锁定选择 |
|---|---|
| 产品显示名 | **MDComment**（不要改回 MarkText） |
| 包名 / 可执行文件 / WM Class | `mdcomment` |
| appId | `com.mdcomment.app` |
| 应用图标、`.md` 文件关联、About logo、网站 favicon / 页头 logo | 用户提供的蓝色思考海象 PNG，抠去棋盘格后的**透明底** |
| 格式工具栏「新建批注」 | 系统/应用内置 **💬** 字形（不要用 PNG：工具栏是剪影 mask，彩色图不会显示） |

### 2.3 表格栏宽

| 主题 | 锁定选择 |
|---|---|
| 行为 | **换行**，表格留在编辑栏宽和 PDF 页内，不做横向滚动 |
| Markdown | 不变，只改 CSS |
| 副作用 | 窄表仍可能被拉满整栏（`width: 100%`）；含公式的列按公式固有宽度，不再裁切 KaTeX |

### 2.4 正文两端对齐

| 主题 | 锁定选择 |
|---|---|
| 对齐 | `text-align: justify` + `text-align-last: start` |
| 作用对象 | 段落、列表项、引用 |
| 不动 | 标题、代码、表格、公式、源码模式 |
| 偏好开关 | 本轮没有，这是新默认 |

### 2.5 明确不做（合入时也不要顺手做）

- 源码模式新建批注 / 下划线 / 引导线
- 多人账号、在线协同、sidecar 三路合并
- PDF/HTML 导出带批注
- 对纯图片选区批注
- 回复正文的「编辑」
- 两端对齐的偏好开关
- 表格横向滚动方案

---

## 3. 合入上游的推荐流程

把上游当「功能来源」，把本仓库当「产品基线」。不要把本仓库的 `develop` 直接 rebase 到上游再强推；用 merge，冲突按本文接入点处理。

```bash
# 一次性
git remote add upstream https://github.com/marktext/marktext.git

# 每次合入
git fetch upstream develop
git checkout develop
git pull origin develop
git checkout -b cursor/sync-upstream-YYYYMMDD-42d0
git merge upstream/develop
```

冲突处理顺序：

1. **先保住「新增文件」**（批注模块、spec、测试、海象 SVG）。它们几乎不会和上游撞车。
2. **再处理「接入点」**（第 4 节）。这些是上游常改、本仓库也改过的文件。
3. **最后核对 CSS 三件套**（`blockSyntax.css` / `exportStyle.css` / `printService.css`）：上游若还原 `word-break: initial` 或 `min-width: 10em`，或删掉 `text-align: justify`，把本仓库的规则贴回去。
4. **图标**：上游若更新了 `build/icons/*` 或 `static/icon.*`，用本仓库的海象资源覆盖，不要留半套旧 M 标。
5. **跑第 7 节验证**。通过后再开 PR 合进本仓库 `develop`。

若要先看「只有本仓库多出来的 diff」（不含上游历史）：

```bash
git diff e52106fd..HEAD
```

分叉点 SHA 以第 1 节为准；合入上游并更新该 SHA 之后，这条命令的范围也会变。

若某次上游改动把接入点文件重构到无法三路合并：不要在冲突里手搓。按第 5 节把本仓库逻辑重新接到新 API 上，并以对应 `comments-*.spec.ts` / CSS spec 为验收。

---

## 4. 接入点（上游一改这里就会冲突）

这些文件**两边都改**。合入时不要选「全部采用上游」。

### 4.1 高冲突（几乎每次大更新都要手修）

| 文件 | 本仓库加了什么 |
|---|---|
| `packages/desktop/src/renderer/src/store/editor.ts` | `loadCommentsForTab`：会话恢复、打开已有 tab、打开新文件；`mt::tab-saved` / `mt::set-pathname` 里 `tryPersistForPath`；`comments:dirty` 把 tab 标脏 |
| `packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue` | 取选区（`getCursorOffset` → markdown 偏移，**不要** `indexOf`）、`muya-new-comment`、`comments:scroll-to`（滚 `.editor-component`，不要对覆盖层 `scrollIntoView`）、正文变化时 `followMarkdown` |
| `packages/desktop/src/renderer/src/pages/app.vue` | 挂载 `<comments-pane />`；`beginNewComment`；监听 `mt::editor-new-comment` / `mt::toggle-comments-pane` |
| `packages/desktop/src/renderer/src/store/layout.ts` | `showCommentsPane`、`commentsPaneWidth`（独立于左侧栏，默认关，宽度进 localStorage） |
| `packages/desktop/src/shared/types/ipc.ts` | 4 条 invoke + 2 条 main→renderer 事件（见下） |
| `packages/muya/src/assets/styles/blockSyntax.css` | 两端对齐 + 表格换行 |
| `packages/muya/src/assets/styles/exportStyle.css` | 同上，选择器是 `.markdown-body` |
| `packages/desktop/src/renderer/src/assets/styles/printService.css` | 同上；**不要**作用到 `table.page-container`（页眉页脚） |
| `packages/desktop/static/locales/*.json` | 批注文案（10 个语言文件） |
| `packages/muya/src/ui/inlineFormatToolbar/config.ts` | 末项 `type: 'comment'`，`glyph: '💬'`（不要 PNG） |
| `packages/muya/src/ui/inlineFormatToolbar/index.ts` | `comment` 发 `muya-new-comment` 后隐藏工具栏，**不要** `format('comment')` |
| `packages/muya/src/ui/inlineFormatToolbar/index.css` | `.mu-format-picker` 宽度 `265px` → `300px`（多一个按钮） |
| `packages/muya/src/ui/inlineFormatToolbar/__tests__/config.spec.ts` | 断言 comment 在 Eliminate 之后、且是最后一项，图标是 💬 |
| `packages/muya/src/block/base/__tests__/formatToggle.spec.ts` | 点 comment 只发事件、不改文本 |

### 4.2 中冲突（加一两行/一项菜单）

| 文件 | 本仓库加了什么 |
|---|---|
| `packages/desktop/src/main/ipc/index.ts` | `registerCommentsHandlers()` |
| `packages/desktop/src/common/commands/constants.ts` | `EDIT_NEW_COMMENT`、`VIEW_TOGGLE_COMMENTS` |
| `packages/desktop/src/main/keyboard/keybindings{Darwin,Linux,Windows}.ts` | 上述两条快捷键 |
| `packages/desktop/src/main/menu/templates/edit.ts` + `actions/edit.ts` | 新建批注 |
| `packages/desktop/src/main/menu/templates/view.ts` + `actions/view.ts` | 开关批注栏 |
| `packages/desktop/src/main/contextMenu/editor/{index,menuItems}.ts` | 右键「新建批注」 |
| `packages/desktop/src/renderer/src/commands/{index,descriptions}.ts` | 命令面板 |
| `packages/desktop/src/main/preferences/schema.json` | `commentAuthorName` |
| `packages/desktop/src/renderer/src/store/preferences.ts` | 同名字段，默认 `''` |
| `packages/desktop/src/shared/types/preferences.ts` | 类型 |
| `packages/desktop/src/renderer/src/prefComponents/general/index.vue` | 「评论」分组：显示名 |
| `packages/desktop/src/renderer/src/components/editorWithTabs/index.vue` | `max-width` 减去 `effectiveCommentsPaneWidth` |
| `packages/muya/src/locales/*.ts` | `New Comment` |
| `.gitignore` | `.superpowers/` |

### 4.3 IPC 合同（`ipc.ts` 被上游改写时整段补回）

Invoke（renderer → main）：

| 通道 | 参数 | 返回 |
|---|---|---|
| `mt::comments::load` | `pathname: string` | `ICommentsFile \| null` |
| `mt::comments::save` | `pathname, file` | `void` |
| `mt::comments::remove` | `pathname` | `void` |
| `mt::comments::author-name` | 无 | `string` |

Main → renderer：

| 通道 | 含义 |
|---|---|
| `mt::editor-new-comment` | 菜单/右键触发新建 |
| `mt::toggle-comments-pane` | 菜单触发开关侧栏 |

渲染进程内部 bus（不是 IPC，但接入点要在）：

- `edit:new-comment`、`view:toggle-comments`
- `comments:get-selection`、`comments:scroll-to`、`comments:dirty`
- Muya 事件 `muya-new-comment`

布局 IPC `mt::view-layout-changed` 的 payload 多一个 `showCommentsPane`。

Preload **没有**单独的 comments 文件；通道走 `ipc.ts` 的类型合同。上游若改 preload 生成方式，确认这 6 条通道仍能 `invoke` / `on`。

---

## 5. 各功能怎么接（给重打补丁用）

### 5.1 批注

#### 分层

```
main                         preload              renderer
─────────────────────────    ───────              ─────────────────────────
sidecar 读/写/删              类型化 IPC            Pinia comments store
OS 用户名                                          CommentsPane / CommentCard
菜单、快捷键、右键                                 CommentDecorations（下划线+引导线）
                                                   选区 / 滚动 / followMarkdown
                                                   Muya 工具栏只发事件，不改文档
```

硬边界：**磁盘只在 main**。渲染进程沙箱，不能自己写 sidecar。

#### Sidecar

路径：`/path/notes.md` → `/path/notes.md.comments.json`（`sidecarPath()`）。

- 没有批注、没有 dirty → 不创建文件。
- 保存后内存列表为空且 dirty → 删除 sidecar。
- 未命名标签只在内存；第一次 Save As 再写。
- 损坏 / `version !== 1` → 当读失败：通知用户，**不覆盖磁盘上的坏文件**，直到用户真正新建批注。
- 保存前必须 `deepClone`。Pinia 的 Vue Proxy 不能结构化克隆，否则 IPC `DataCloneError`。

JSON `version: 1` 要点：

- 线程：`quote` / `prefix` / `suffix`（前后各最多 32 字符）/ `startOffset` / `endOffset`（UTF-16 提示，不是真理来源）/ `orphaned` / `status: open|resolved`
- 回复扁平数组；一层回复不写 `parentId`；二层写一层回复的 `id`
- 未知字段用 `[key: string]: unknown` 保留，保存时不要剥掉

绑定顺序（打开时 `bindComment`）：

1. `prefix + quote + suffix` 唯一命中
2. `quote` 唯一命中
3. `quote` 多命中：取离 `startOffset` 最近的（距离相同取更靠后的）。划线定位要把 markdown 偏移按**出现次序**对齐到 `.mu-content` 文本，不能把 markdown 偏移当 DOM 偏移（表格管道符会把提示撑到最后一个命中）。`Range.getClientRects()` 在表格里会额外给出表头/其它列的幽灵盒子（`td::before` 绝对定位也会掺进来）；下划线只保留与引文文本节点相交的盒子，引导线不要取 `querySelector` 的第一个，要用 `pickLeaderBox` 丢掉坍缩盒子后再按卡片垂直中心就近。点卡片跳转时只滚 `.editor-component`（`commentJumpScrollTop`，与目录同一套 `scrollTop + viewportY - STANDAR_Y`）；**不要**对覆盖层下划线 `scrollIntoView`——下划线是滚动容器的兄弟节点，会带动外层 `overflow: hidden` 把正文移出视口
4. 否则 `orphaned: true`

编辑中用 `followComment`：先 bind；失败则用 prefix/suffix 夹住中间文本。范围没了就标记 Orphaned。

#### 生命周期钩子（`editor.ts` 必须接到等价位置）

| 时机 | 行为 |
|---|---|
| 会话恢复每个有路径的 tab | `loadCommentsForTab`；有线程则打开侧栏 |
| `NEW_TAB` 已存在同一路径 | 再 load；**dirty 的 tab 不覆盖内存** |
| `NEW_TAB` 新文件 | load；有线程则打开侧栏 |
| `mt::tab-saved` | `tryPersistForPath`；失败则 `isSaved = false` 并通知 |
| `mt::set-pathname`（Save As） | `force` persist 到新路径；若本 tab 写过批注且旧路径不同，删旧 sidecar |
| `comments:dirty` | 把对应 markdown tab 标脏，从而走保存流程 |

`loadCommentsForTab` 在 dirty 时直接 return，避免「重新打开已打开文件」冲掉未保存批注。

#### 命令 ID

- `edit.new-comment`
- `view.toggle-comments`

#### 测试入口

```bash
pnpm -C packages/desktop exec vitest run test/unit/specs/comments-
```

约 13 个文件。合入后这条必须绿。

### 5.2 格式工具栏「新建批注」

Muya 工具栏最后一项 `type: 'comment'`。点击：恢复选区 → `eventCenter.emit('muya-new-comment')` → `hide()`。桌面 `editor.vue` 转成 `bus.emit('edit:new-comment')`，与菜单/快捷键同一条 `beginNewComment`。

图标：`config.ts` 里 `glyph: '💬'`，渲染为 `span.icon-emoji`。**不要**再加 `format_comment` PNG——工具栏 `i.icon-inner` 用 `drop-shadow` 剪影上色，彩色 PNG 不会按原样显示。工具栏容器宽度在 `index.css` 里从 `265px` 调到 `300px`。改 Muya 工具栏代码后必须**完全重启** `pnpm run dev`（Ctrl+R 往往不重载 Muya）。

### 5.3 品牌资源

源稿：用户提供的蓝色海象 PNG，抠去棋盘格后的透明底。`icon.svg` / `md.svg` 是该 PNG 的嵌入包装，不是手绘矢量。

覆盖这些路径（上游若更新图标，合完再覆盖回来）：

- `packages/desktop/src/renderer/src/assets/images/logo.png`（About 对话框）
- `packages/desktop/static/icon.{png,ico,icns}`、`logo-96px.png`、`logo-small.png`
- `packages/desktop/build/icons/icon.{png,ico,icns,svg}` 与 `md.*`
- `packages/desktop/build/icons/{16,24,32,48,64,128,256,512}x*/{md,marktext}.png`
- `packages/website/public/favicon.png`、`packages/website/public/assets/logo.png`
- `docs/assets/logo-small.png`（README）

macOS 安装包必须在 Mac 上打：`pnpm run build:mac:arm64` 或 `:x64`，产物在仓库根 `dist/`。Dock / `.app` 图标不会随 `pnpm run dev` 热更新。

### 5.4 表格栏宽（CSS）

编辑器：`.mu-table` / `.mu-table-inner` → `width/max-width: 100%`、`overflow-wrap: anywhere`；单元格 `min-width: 0`（去掉 `10em`）。**不要** `table-layout: fixed`（会裁切行内公式）。`.katex` 重置 `word-break` / `overflow-wrap`。已提交的行内公式 `.mu-hide .mu-math-render` 必须 `overflow: visible`，不要改 KaTeX 的 `.vlist-s` 宽度。

导出/打印：只对 `.markdown-body table`（及 `th/td`）做同样限制，并保留 `display: table`。页眉页脚的 `table.page-container` 不要套这些规则。

测试：`packages/desktop/test/unit/specs/table-page-width.spec.ts`（断言 CSS 文本里仍有这些规则）。

### 5.5 两端对齐（CSS）

编辑器：`.mu-container p, li, blockquote`。导出/打印：`.markdown-body p, li, blockquote`。

测试：`packages/desktop/test/unit/specs/justify-prose.spec.ts`。

---

## 6. 文件清单

相对 `e52106fd`。`A` = 本仓库新增，合入时应原样保留；`M` = 改过的上游文件，见第 4 节。

### 6.1 新增（批注核心）

```
packages/desktop/src/shared/types/comments.ts
packages/desktop/src/common/comments/index.ts
packages/desktop/src/common/comments/sidecarPath.ts
packages/desktop/src/common/comments/bind.ts
packages/desktop/src/common/comments/replyTree.ts
packages/desktop/src/common/comments/leader.ts
packages/desktop/src/common/comments/jump.ts
packages/desktop/src/common/comments/relativeTime.ts
packages/desktop/src/main/comments/sidecar.ts
packages/desktop/src/main/ipc/comments.ts
packages/desktop/src/renderer/src/store/comments.ts
packages/desktop/src/renderer/src/store/commentsDirty.ts
packages/desktop/src/renderer/src/components/comments/CommentsPane.vue
packages/desktop/src/renderer/src/components/comments/CommentCard.vue
packages/desktop/src/renderer/src/components/comments/CommentDecorations.vue
packages/desktop/src/renderer/src/util/commentAuthor.ts
packages/desktop/src/renderer/src/util/commentQuoteDom.ts
packages/desktop/src/renderer/src/util/commentSelection.ts
packages/desktop/src/renderer/src/util/commentCardClick.ts
packages/desktop/src/renderer/src/util/commentReplyComposer.ts
```

测试：

```
packages/desktop/test/unit/specs/comments-bind.spec.ts
packages/desktop/test/unit/specs/comments-sidecar.spec.ts
packages/desktop/test/unit/specs/comments-store.spec.ts
packages/desktop/test/unit/specs/comments-lifecycle.spec.ts
packages/desktop/test/unit/specs/comments-layout.spec.ts
packages/desktop/test/unit/specs/comments-commands.spec.ts
packages/desktop/test/unit/specs/comments-decorations.spec.ts
packages/desktop/test/unit/specs/comments-quote-dom.spec.ts
packages/desktop/test/unit/specs/comments-jump.spec.ts
packages/desktop/test/unit/specs/comments-selection.spec.ts
packages/desktop/test/unit/specs/comments-card-click.spec.ts
packages/desktop/test/unit/specs/comments-reply-tree.spec.ts
packages/desktop/test/unit/specs/comments-reply-composer.spec.ts
packages/desktop/test/unit/specs/table-page-width.spec.ts
packages/desktop/test/unit/specs/justify-prose.spec.ts
```

### 6.2 新增（品牌）

```
packages/desktop/build/icons/icon.svg
packages/desktop/build/icons/md.svg
packages/desktop/build/icons/md.png
```

### 6.3 新增（设计与计划，合入时保留）

`docs/superpowers/specs/` 与 `docs/superpowers/plans/` 下 2026-08-19 起的 comments / toolbar / nested replies / table / justify 文档。

### 6.4 i18n 必须补回的键

桌面 `packages/desktop/static/locales/{en,zh-CN,zh-TW,de,es,fr,ja,ko,pt,tr}.json`：

- `menu.edit.newComment` / `menu.view.toggleComments`
- `commands.edit.newComment` / `commands.view.toggleComments`
- `preferences.general.comments.title|authorName|authorNameNotes`
- `comments.*`（title, open, resolved, empty, reply, edit, resolve, reopen, delete, deleteConfirm, deleteReplyConfirm, orphaned, newComment, closePane）
- `notifications.commentsUnreadable` / `notifications.commentsSaveFailed`

Muya `packages/muya/src/locales/*.ts`：`New Comment`。

改完 locale 源文件后，生产构建仍要跑 `pnpm run minify-locales`（`build:win/mac/linux` 已包含；`dev` 不跑）。

---

## 7. 合入后验证

```bash
# 批注
pnpm -C packages/desktop exec vitest run test/unit/specs/comments-

# 表格 / 两端对齐 CSS 未丢
pnpm -C packages/desktop exec vitest run test/unit/specs/table-page-width.spec.ts
pnpm -C packages/desktop exec vitest run test/unit/specs/justify-prose.spec.ts

# Muya 工具栏仍把 comment 当 action
pnpm -C packages/muya exec vitest run src/ui/inlineFormatToolbar/__tests__/config.spec.ts
pnpm -C packages/muya exec vitest run src/block/base/__tests__/formatToggle.spec.ts

# 全量（合入较大上游变更时）
pnpm run lint
pnpm run typecheck
pnpm run test:unit
```

手测（改过 Muya CSS/PNG 必须**完全重启** `pnpm run dev`）：

1. 同目录放 `notes.md` 与 `notes.md.comments.json`，打开 md → 侧栏出现线程。
2. 选中文字 → 格式工具栏最右 **💬** → 侧栏草稿；保存后 sidecar 出现。
3. 宽表 / 长 URL 单元格：编辑栏内换行；导出 PDF 不画出纸边。
4. 长段落两端对齐，标题/代码/表仍是各自对齐。
5. 应用图标仍是透明底海象，不是上游 M 标。

---

## 8. 已知缺口（合入时不要当成回归去「修上游」）

这些是本仓库有意留下或尚未做的，不是合入失败：

- 损坏的 sidecar 在用户新建批注之前不会被删
- 空草稿不把 markdown tab 标脏
- Linux「新建批注」是 `Ctrl+Shift+Alt+M`，与最初方案的 `Ctrl+Alt+M` 不同（与 Linux 其它快捷键冲突）
- 海象小尺寸（16/24）发糊，没有单独的简化字形
- 两端对齐没有左对齐偏好
- 窄表会被拉满栏宽
- 批注没有 Playwright e2e（只有 Vitest）

---

## 9. 详细设计索引

| 文档 | 内容 |
|---|---|
| [2026-08-19-markdown-comments-design.md](./superpowers/specs/2026-08-19-markdown-comments-design.md) | 批注主设计：sidecar、锚定、侧栏、引导线 |
| [2026-08-19-markdown-comments.md](./superpowers/plans/2026-08-19-markdown-comments.md) | 批注实现计划 |
| [2026-08-22-format-toolbar-comment-design.md](./superpowers/specs/2026-08-22-format-toolbar-comment-design.md) | 格式工具栏按钮 |
| [2026-08-22-nested-comment-replies-design.md](./superpowers/specs/2026-08-22-nested-comment-replies-design.md) | 两层回复树 |
| [2026-08-25-table-page-width-design.md](./superpowers/specs/2026-08-25-table-page-width-design.md) | 表格栏宽 |
| [2026-08-25-justify-prose-design.md](./superpowers/specs/2026-08-25-justify-prose-design.md) | 两端对齐 |

上游 IPC 约定仍见 `packages/website/content/docs/dev/IPC.md`。本仓库新增通道以本文第 4.3 节为准。

---

## 10. 维护约定

- 以后在本仓库加功能：同步改这份清单（功能表、接入点、文件清单、测试命令）。
- 合入上游后若分叉点前进，更新第 1 节的 SHA。
- 不要把批注逻辑塞进 `packages/muya` 的 parse/serialize。Muya 只允许：工具栏事件、locale、图标、展示用 CSS。
- 不要把 sidecar IO 放到 renderer。
