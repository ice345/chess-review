# 分享链接、棋盘箭头与导入注解保真（S4）

日期：2026-09-11。范围：已验证复盘的**分享链接**、**用户手绘箭头**、**导入 PGN 注解
的显示与再导出**，以及单机 Debian NUC + Cloudflare Tunnel 部署层的缓存要求。
未改动任何棋类算法语义（WinPercent、Accuracy、Divider、分类、Great/Brilliant、
Human Difficulty、引擎缓存键、`OBJECTIVE_ALGORITHM_VERSION` 均未变）。

## 1. 分享链接（`/share#pgn=…`）

**必须放在 fragment。** 目标部署是单机 NUC，应用没有用户数据后端，而隐私是产品承诺；
URL fragment 由浏览器在发出请求前剥离，因此服务器只看到 `GET /share`，棋局内容不上传。
这也顺带让 Nginx 的请求行保持在 19 字节，远离默认 8 KiB 限制。

- `apps/web/src/lib/share-link.ts`：`MAX_SHARE_PGN_BYTES = 4096`（原始 UTF-8 字节），
  base64url 无填充编码；超限返回 null，菜单提示改用 Original PGN。非 ASCII 棋手名
  经 E2E 验证可完整往返。
- `apps/web/src/app/share/page.tsx`：解码 → 用 `parsePgn` 验证是真棋局 → 存入**访问者
  自己的** IndexedDB 库 → 跳转 `/review/<id>`；空/非法/超限/导入失败各有可操作提示。
- 只有 fragment 变化不会重新加载文档，因此该页额外监听 `hashchange`，否则同一标签页
  打开第二条分享链接会停留在上一条的结果上。
- `/share` 已加入 robots 的 disallow 列表。
- **剪贴板失败时链接仍然可用**：Export 菜单除了尝试写入剪贴板，也始终把链接显示为
  可选中字段。Firefox 与 WebKit 对 `navigator.clipboard` 的处理不同，只给"复制失败"
  错误提示会让这些用户拿不到链接。

## 2. 用户手绘箭头

复盘棋盘原先 `allowDrawingArrows: false`。已改为 `true`。已核实安装的
`react-chessboard@5.12.1`：`Arrows()` 渲染 `[...arrows, ...internalArrows]`，**引擎候选箭头
与手绘箭头是合并而非替换**；默认 `clearArrowsOnClick`/`clearArrowsOnPositionChange` 均为
`true`，语义正好符合"箭头描述某一个局面"。首页预览与错题练习仍是 `false`（那里画箭头无意义）。

E2E 实测：引擎箭头 3 条 → 右键拖拽后 4 条 → 切换局面后回到 3 条。

**已知限制**：这是指针手势。触摸设备没有等价手势，因此手机上目前无法手绘箭头；
实现触摸绘制需要单独的手势设计，不在本批范围。E2E 对触摸工程按此原因跳过而不是伪造通过。

## 3. 导入注解保真

导入的评论、NAG、递归变例此前被 `parsePgn` 丢弃，界面也不显示。现在：

- `packages/shared/src/pgn-annotations.ts`（新增）：PGN movetext 的注解读取器，是既有 PGN
  写入器的对应物。它把评论/NAG/变例映射到 ply 下标；当读取到的着法数与 chess.js 重放的
  主线不一致时**整份丢弃映射**，绝不把注解贴到错误的着法上。
- `NormalizedPly` 增加 `comment`/`nags`/`variations`，`NormalizedGame` 增加 `comment`。
  `analysis.game.pgn` 已经保存原始 PGN，因此这些字段是**从既有规范数据派生**的，
  没有引入第二份副本，也没有动 `GameAnalysisV2` 结构、备份格式或数据库版本。
- Moves 视图在对应着法旁显示作者评论、`$1`–`$6` 传统符号与变例原文；选中着法时
  证据面板也显示该评论。注解仅用于显示与导出，**不进入分类、Accuracy 或教练事实**。
  显示层只去掉时钟类指令（`[%clk …]`、`[%emt …]`），包括变例里的。`[%eval …]` 是作者数据，
  原样保留。`readPgnAnnotations` 仍是忠实读取器，Annotated 导出仍带原文时钟。
- Annotated PGN 导出现在是原作的**超集**：注解随分析证据一起写出。

### 过程中发现并修复的真实缺陷

导入注解后导出会写出**两个相邻注释**（`{ 作者注解 } { [%eval …] … }`），而 chess.js 1.4.0
的 PGN 文法**每个着法只接受一个注释**，且顺序必须是 `SAN NAG* comment? variation*`。
结果是导出的 Annotated PGN **无法被本产品自己重新导入**。已改为把作者注解合并进唯一的
注释（`…; Imported note: 原文`），保留 `[%eval …]` 在注释开头以兼容其他工具。
`packages/analysis/src/export-roundtrip.test.ts` 用真实 `buildGameAnalysis` 产物重新导入
本产品导出的 PGN 来锁住这条不变量，并断言不出现 `} {`。

这是本批最重要的修复：它同时暴露了"导出后必须能被自己读回"这一此前**没有任何测试覆盖**
的契约。

## 验证

2026-09-11，macOS（10 逻辑核）、Next 16.3.3：

| 检查 | 实际结果 |
| --- | --- |
| `pnpm test` | 426 项通过（shared 15 / chess-core 16 / openings 2 / analysis 82 / stockfish 15 / web 296） |
| `pnpm typecheck` / `pnpm lint` | 通过 |
| `NEXT_PUBLIC_APP_MODE=browser-core pnpm build` | 通过，新增 `/share` 路由 |
| `playwright.release.config.ts` | **135 通过、5 条跳过**，5.5 分钟；Chromium / Firefox / WebKit / 手机尺寸 Chromium / 手机尺寸 WebKit |
| 分享链接实测 | 发送方拿到 `/share#pgn=…`；**全新浏览器上下文**打开后自动导入并跳转 `/review/<id>`，标题栏为 `Ünïcode Nàme vs Player two`（非 ASCII 完整往返） |
| 导入注解实测 | `1. e4 !Book 100 Best by test (1. d4 d5 2. c4)`；导出片段 `1. e4 $1 { [%eval 0.35]; …; Imported note: Best by test } (1. d4 d5 2. c4) e5 …` |
| 箭头实测 | 3 → 右键拖拽 → 4 → 导航 → 3 |
| `pnpm test:e2e`（开发模式） | 73 通过；**1 项失败为既有问题**，见下 |

## 部署层（Debian NUC + Cloudflare Tunnel）

- Nginx 保持透明代理，未改动功能：没有 `proxy_cache`，不增删 `Cache-Control`，上游的
  `no-cache`（`/sw.js`）与 `immutable`（`/engine/*`、`/sounds/*`）原样透传。只加了注释说明
  这一设计以及 Cloudflare 侧必须配置的规则。
- **发布后必须配置 Cloudflare Cache Rules**（`deploy/nuc/README.md` §4）：`/_next/static/*`
  可长期缓存；`/engine/*`、`/sounds/*` 尊重源站 TTL；**其余全部 Bypass cache**。原因是 Next.js
  standalone 对预渲染 HTML 返回 `s-maxage=31536000`，若边缘缓存了 HTML，新版本发布后旧 HTML
  引用的 JS chunk 已被删除，命中缓存的访客会白屏，直到 TTL 过期或手动清除。
- 分享链接的 fragment 不经过网络，因此不需要为它调整代理或请求行限制。
- **本批没有运行 Docker**（本机 daemon 不可用），部署层结论基于配置与源码阅读，
  `deploy/nuc/README.md` §7 已列出需要在真机核对的响应头项。

## 既有问题（非本批引入，未修改）

`e2e/visual.spec.ts` 的 `combined-stockfish-maia-1440.png` 基线在当前 HEAD 即不匹配：
1440×900、x 720–1326 / y 69–815（右侧 Compare 面板），差异 38412 像素（ratio 0.03，
阈值 0.015）。已用 `git show HEAD:` 还原 `review-shell.tsx` 单独复跑验证，**差异像素数完全
相同（38412）**，因此与本批改动无关。按仓库规则未擅自更新基线；需要人工肉眼确认该图后
再决定是更新基线还是修复回归。

## 未做

- 触摸设备的手绘箭头。
- 变例**树**：导入变例按原文显示与导出，不作为可走子分支回放，也不支持编辑后回写。
- 账号、云同步、云端分享空间、开局 explorer、多语言、CSP/HSTS、错误上报。
- 未在真实 NUC、真实域名或物理手机上验收。
