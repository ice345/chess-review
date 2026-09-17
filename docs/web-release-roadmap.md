# Web beta 修复与上线 roadmap

日期：2026-09-08。原审计基线：`a1f603e`。状态：**R1–R5 本地工程交付完成，S1 补齐个人 Notebook；真实 NUC、Cloudflare HTTPS 与手机验收仍未完成。**

当前结论以 [免费稳定版审计](audits/2026-09-08-free-stable-release.md) 为准。以下旧问题清单是审计历史，不代表这些错误仍然存在。

R1 的实际行为、测试与边界见 [修复记录](/Users/ice/Code/chess-review/docs/audits/2026-09-06-r1-repairs.md)，R2 见 [布局与导入验收](audits/2026-09-06-r2-layout-and-import.md)。第 2 节保留审计基线的问题说明，不能再将其中 R1、R2 涉及的旧行为当作当前实现。

本计划承接此前两个任务的实现，以及 [9 月 5 日审计](/Users/ice/Code/chess-review/docs/audits/2026-09-05-web-launch-and-art-direction.md)。本轮聚焦现有问题、UI/UX、布局和上线业务流程；此前艺术方向草案保留参考。

**视觉状态更新（2026-09-13）：** 本节写于 2026-09-08，当时产品决定“暂时保留当前棋子、棋盘颜色、全站配色、品牌与 V3 着法图标”，因此下面各批交付记录中的“棋子、配色保持原样”是当时的真实状态。该决定已被 [Windowlight 视觉收敛](design/2026-09-13-windowlight-implementation.md)取代：现在是单一浅色生产主题，棋盘 `#eee8d9` / `#b1c6c2`，默认棋子为 Feather Porcelain（存储 id 仍为 `liz-blue`，Settings 显示名已改），品牌仍是 Blue Bishop，V3 着法图标语义未变。PNG 导出与升变选择器也已改用同一套棋子（Classic 或资源解码失败时回退 Unicode），移动端共享同一棋盘外观与棋盘令牌。仍未做的只有两件已限定范围的事：移动端自有外壳配色与共享棋子资源路径、暗色主题（未来 feature）。后续视觉工作顺序见该实现说明与 [roadmap](roadmap.md)。

## 1. 首发范围与判断

当前已有可继续完善的复盘核心：PGN/FEN、浏览器 Stockfish、整盘分析、Accuracy、阶段与开局识别、可解释着法分类、分支探索、导出、平台棋局同步，以及 Maia / Coach 的可选增强。无需重建这些基础。

**主要缺口是状态可信、数据操作完整、学习流程连贯，以及公开服务的实际验收。** 现有 roadmap 中的阶段完成记录主要面向功能与自托管，不等同于面向普通访客的 Hosted Web 已通过验收。

建议首发承诺：用户无需安装本地服务，即可导入棋局、完成客观复盘、理解关键决定、回看相关局面，并在本浏览器保留学习记录。具体 AI 增强按网站实际部署能力提供。

| 产品能力 | 当前基础 | 首发需要补齐 |
| --- | --- | --- |
| 导入与复盘 | 文本 PGN/FEN、平台同步、整盘客观分析已有 | 入口可见、文件导入、准确状态、失败恢复 |
| 看懂一盘棋 | 关键时刻、证据、Study、基础总结已有 | 分析完成后明确引导到关键决定与后续学习 |
| 持续学习 | 跨局统计、弱点证据、Training 队列已有 | Start 真正进入任务，逐局面进度与中断恢复 |
| 数据保留 | IndexedDB、局部删除、分析/图片导出已有 | 删除一致性、备份恢复、存储故障提示 |
| 人类视角与 AI | Maia、Ollama、API provider、结构化事实约束已有 | Hosted / Local 能力表达与真实服务可用性 |
| 公开运营 | 本地构建与自动化测试已有 | 正式域名验证、接口边界、反馈入口、发布与回退流程 |

当前按免费开源发布，不规划收费、套餐和支付。自有账号、跨设备云同步、在线对弈、配对和赛事属于另行评估的业务扩展。Browser Core beta 可以先以匿名、本浏览器保存的方式上线；不得因此暗示已有云端账号或云同步。

## 2. 当前问题清单

优先级：P1 为本次公开 beta 前应修复的问题，或需要通过明确首发范围解决的能力缺口；P2 为可安排在后续稳定版的完善。证据分为“页面/请求实测”“源码确认”“待专项验收”。未证明新的 P0 棋类算法缺陷。

### WEB-01 · P1 · “Reviewed” 不能可靠代表完成分析

**源码确认。** 首页先保存 ReviewRecord，再启动复盘。History 对手动导入的记录直接归入 reviewedRecords，没有检查是否存在完整、兼容的分析结果。因此刚导入、取消或失败的棋谱，以及 FEN 局面，都可能被统计为 Reviewed。

证据：[导入流程](/Users/ice/Code/chess-review/apps/web/src/components/home-workspace.tsx:65)、[History 分类与计数](/Users/ice/Code/chess-review/apps/web/src/components/history-page.tsx:67)。

修复方向：统一应用层的保存、待分析、分析中、部分完成、完成、失败和结果过期状态；明确“已经分析”和“用户已阅读”的区别。FEN 用局面研究状态。结果匹配复用 [现有兼容性检查](/Users/ice/Code/chess-review/apps/web/src/lib/analysis-cache.ts:43)，不在 UI 重算棋类算法。

验收：导入后取消/失败不会显示完成；完成后刷新仍正确；清缓存和算法版本变化后状态准确；同一棋局在 Home、History、Training 的口径一致。切换分析深度时保留已有结果的深度信息，不把设置变化解释为棋谱丢失。

### WEB-02 · P1 · Training 只有状态切换，缺少任务执行流程

**源码确认。** Start / Complete 只调用状态转换；Start 不会进入练习。V2 队列初始化为 `0/N positions reviewed`，当前路径没有逐局面更新计数的实现，却可以直接标记 completed。

证据：[按钮处理](/Users/ice/Code/chess-review/apps/web/src/components/advanced-study-page.tsx:584)、[队列与进度](/Users/ice/Code/chess-review/apps/web/src/lib/training-queue.ts:9)。已有源局面链接和弱点证据可以复用。

修复方向分两层：先让 Start 打开第一处未完成的源局面，支持明确确认回顾、下一处、恢复进度；“回顾过”“手动完成”“答对”分别记录。若首发宣传可作答训练题，再加入隐藏答案、合法落子、提示、反馈和作答记录。

验收：Start 后有实际任务；刷新能继续；重复打开同一局面不重复计数；0/N 不会自动成为已掌握。评分练习仅使用证据足够的局面，处理等价正确着法，不能把第一条 PV 当成唯一合法答案；一般弱点建议继续作为学习任务。

### WEB-03 · P1 · 删除、断开账号、历史修复之间缺少统一规则

**基线删除范围由源码确认；R1 已在隔离 IndexedDB fixture 中复现 Training 重建主动删除记录、账号清理残留复盘和 reset 遗漏头像，并加入修复后的回归测试。**

- 单条删除只移除 review-records，保留源棋局、缓存等关联对象。
- 断开账号并选择删除棋局，只移除 synced-games；已经生成的复盘与训练引用可能保留。
- Training 的历史修复会根据源棋局与兼容缓存重建缺失 ReviewRecord，因此可能重建用户主动删除的记录。
- Full reset 的存储列表遗漏 player-avatars。

证据：[删除与重置](/Users/ice/Code/chess-review/apps/web/src/lib/local-data.ts:34)、[账号删除文案与调用](/Users/ice/Code/chess-review/apps/web/src/components/connected-accounts.tsx:242)、[历史修复写入](/Users/ice/Code/chess-review/apps/web/src/lib/advanced-study-library.ts:413)、[头像存储](/Users/ice/Code/chess-review/apps/web/src/lib/browser-storage.ts:11)。

修复方向：先用隔离 fixture 复现，再明确“删除复盘”“删除源棋局及其学习记录”“清缓存”“断开连接”“全部重置”的范围。主动删除意图必须与旧数据修复协调；共享缓存只在无其他引用时清理。跨存储写入保持事务一致，并协调后台任务与其他标签页，防止清理后又写回。

验收：删除后进入 Training、刷新或继续后台工作，记录不会意外复活；账号清理不留下损坏引用，不误删其他账号数据；cache-only 保留原棋谱；all-reset 覆盖头像。使用测试数据库，避免对用户存量棋谱执行破坏性验证。

### WEB-04 · P1 · 存储失败会伪装成“没有棋局”

**源码确认。** History 的读取异常会把两个列表设为空数组，Home 读取异常被忽略。部分删除/清理操作缺少用户可见的失败处理。

证据：[History catch](/Users/ice/Code/chess-review/apps/web/src/components/history-page.tsx:58)、[Home 读取](/Users/ice/Code/chess-review/apps/web/src/components/home-workspace.tsx:58)、[Settings 清理操作](/Users/ice/Code/chess-review/apps/web/src/components/settings-page.tsx:123)。

修复方向：区分加载中、首次空库、筛选无结果、加载失败、部分结果；刷新失败保留已显示数据。导入/删除/备份失败就地给出重试或恢复入口。补充页面错误恢复和无效复盘链接的返回路径。

验收：模拟 IndexedDB 打开失败、事务中止、容量不足时，不显示虚假的空库或成功提示；用户可重试且不会重复创建记录。

### WEB-05 · P1 · 首页入口与复盘主次比例需要调整

**R2 前的基线：9 月 5 日页面实测 + 源码复核。** 在 1280×720，复盘棋盘约 330px，右栏约 815px，导航按钮底部超出首屏；首页 Analyze game 在首屏以下。旧手机样式把预览棋盘放在表单前。部分辅助文字为 7–11px。R2 已修复指定尺寸的布局和操作顺序，真实手机硬件验收仍在 R5。

证据：[尺寸公式](/Users/ice/Code/chess-review/apps/web/src/app/styles/review-shell.css:130)、[字号](/Users/ice/Code/chess-review/apps/web/src/app/styles/review-shell.css:37)、[首页结构](/Users/ice/Code/chess-review/apps/web/src/components/home-workspace.tsx:125)。具体测量记录见原审计 W01/W02。

修复方向：压缩标题和重复说明，先解决主操作可见性；按实际可用空间分配棋盘和内容列，保留 timeline 在右侧 Game Summary 中。改善字号、行高、触控区域、键盘焦点与阅读顺序，继续使用现有棋子和配色。

> 状态（2026-09-13）：文中「继续使用现有棋子和配色」是当时的约束。棋子和配色随后由 [Windowlight 视觉收敛](design/2026-09-13-windowlight-implementation.md)按新调色板统一，字号下限（功能文字 ≥ 11px）、触控 44px、焦点环与 hover 不改变几何等要求已在该批次落地。

验收：1280×720、1366×768、1440×900、1920×1080，以及 390px 手机宽度和窄屏回流。笔记本棋盘先以 420–460px 为设计目标，1440×900 以 500–540px 为目标，再用实测调整；桌面两位玩家和导航可用，手机主操作优先，放大文字后不裁切。尺寸目标不构成已通过声明；配色对比度沿用此前记录，后续视觉批次再处理。

### WEB-06 · P1 · 本浏览器数据缺少可恢复的备份

**源码确认功能缺口；多标签页升级风险待专项验收。** 当前有单盘分析 JSON、带分析注释的 PGN、图片导出，但没有完整棋库/训练记录的备份与恢复。数据库已有版本号，打开逻辑没有处理 blocked / versionchange。

证据：[数据库打开逻辑](/Users/ice/Code/chess-review/apps/web/src/lib/browser-storage.ts:13)、[现有导出菜单](/Users/ice/Code/chess-review/apps/web/src/components/review-shell.tsx:426)。数据库连接可能阻塞同一数据库的版本升级，属于需要专门恢复提示的状态。[MDN 事件说明](https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/blocked_event)

修复方向：提供版本化备份，首版包含原始棋局/FEN、用户设置及训练记录；体积较大的派生缓存可选。恢复前校验格式、版本、大小并展示合并/重复处理结果；凭据和 OAuth session 不导出，连接恢复后重新授权，后台任务恢复为暂停。

验收：备份到新浏览器恢复后，棋局、训练进度和引用一致；坏文件不会部分覆盖原库；两个标签页升级可恢复；存储失败可理解且有后续动作。

### WEB-07 · P1/P2 · 文件输入和导出含义尚不完整

**R2 前的源码基线。** 首页只有粘贴输入，没有本地 PGN 文件选择/拖入。旧示例主要是开局片段，难以展示完整学习价值。原始 PGN 已保留，但 annotated PGN 由分析主线重建，不等于原评论、NAG、变例的无损导出。探索分支明确是会话内状态。R2 已完成下列 P1 项；P2 的个人变例与编辑往返继续保留为后续工作。

证据：[首页输入](/Users/ice/Code/chess-review/apps/web/src/components/home-workspace.tsx:164)、[PGN 导出](/Users/ice/Code/chess-review/packages/shared/src/export.ts:87)、[分支边界](/Users/ice/Code/chess-review/docs/analysis-variations.md:79)。

P1：增加 `.pgn` 文件选择/拖入、大小与格式校验；多局文件提供选局或明确限制，不能静默丢掉其他棋局。增加独立“下载原始 PGN”，明确“附分析注释 PGN”的内容；用真实引擎验证一盘有关键决定的示例。探索分支标明临时状态。

P2 原候选：可保存的个人变例、笔记、书签及完整编辑往返。S1 已交付独立 Notebook 的前三项；PGN 全变例树编辑往返仍未实现。图片 OCR 不加入导入范围，PNG 导出继续保留。

### WEB-08 · P1 · Hosted / Local 的可用能力需要成为产品事实

**源码确认；真实公开域名未验证。** AI gateway 默认地址为 `http://127.0.0.1:8000`，网页访客会访问自己的电脑；选择远程 provider 也仍经过该 gateway。Settings 中仍有本地开发命令，界面主体英文而 Coach 默认中文。

证据：[gateway 默认值](/Users/ice/Code/chess-review/apps/web/src/lib/local-ai.ts:62)、[Coach 默认设置](/Users/ice/Code/chess-review/apps/web/src/lib/app-settings.ts:23)。

修复方向：由部署配置声明 Browser Core / Enhanced Local / Hosted AI 的能力；分别表达可用、未配置、不可达和该部署未提供。公开版普通用户首先看到可用的复盘能力。本地安装步骤移入明确的增强设置/帮助入口；统一界面语言，Coach 输出语言作为单独偏好。

若首发承诺所有访客可直接使用在线 AI，则服务端 gateway、身份/会话边界、用量限制、超时取消、并发与成本上限都进入首发范围；密钥保持在服务端。保留 provider 抽象和事实约束，不自动为每一步调用 LLM。

验收：未安装本地服务的全新访客仍完成基础复盘；可选能力不可用不会阻塞流程；公开 AI 的失败与限额有准确反馈。现有 Chess.com 公共用户名与 Lichess OAuth 连接继续复用，不将前者改称验证过的账号所有权。

### WEB-09 · P1 · 公开同步接口存在可触发的输入错误

**9 月 5 日生产请求实测 + 本轮源码复核。** Chess.com sync 接收 `username: 42` 会在调用 `toLowerCase()` 时返回 500。TypeScript 类型断言没有验证请求体运行时结构。现有大小限制、archive URL allowlist、429/checkpoint 支持均已存在。

证据：[sync 请求边界](/Users/ice/Code/chess-review/apps/web/src/app/api/platforms/chesscom/sync/route.ts:33)。

修复方向：对请求结构、username、mode、cursor、limit、since 做运行时校验；统一非法 JSON、上游异常和超时处理。逐条核查公开平台路由的限流与并发边界，核实部署层是否已有保护；不能仅依赖客户端节流。

验收：非法请求返回可理解的 400/413；上游 429 保持重试信息和断点；断网、超时可重试；公开入口具备经过验证的服务端或部署层限制。真实 Lichess OAuth 回调、Cookie、取消和断开在 HTTPS 环境验收。

### WEB-10 · P1 · 测试通过尚未覆盖实际发布条件

**配置确认 + 待专项验收。** 当前 Playwright 仅配置 Chromium，自动启动 `pnpm dev:web`；尚未完成本次真实 HTTPS、Firefox/WebKit、真实移动浏览器的专项验收。History 虽按批显示，却先读取和整理完整列表；尚无 1,000/10,000 局性能数据，不能据此断言已慢或已经足够快。

证据：[Playwright 配置](/Users/ice/Code/chess-review/playwright.config.ts:1)、[History 列表计算](/Users/ice/Code/chess-review/apps/web/src/components/history-page.tsx:58)。

修复方向：增加生产构建工作流、跨浏览器核心路径、代表性手机实测和大型棋库基准。按测量决定是否需要 IndexedDB 索引/游标分页，避免仅增加可见行数却仍每次全量读取。公开环境核实 Stockfish WASM/worker、资源缓存与安全头兼容、OAuth、错误恢复和发布回退；补齐产品说明、数据去向、反馈入口及基本分享元信息。Next.js 的发布建议也要求在生产运行模式中检查性能与错误恢复。[Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist)

验收：记录环境、数据量、耗时、失败和结果；后台分析时前台落子/导航可用，取消有效；失败可定位，日志不默认记录原始棋谱或凭据。上线前有实际部署版本、检查结果与可执行回退步骤。

## 3. UI/UX 与布局大纲

沿用当前路由与组件基础，每页围绕一个明确任务调整顺序。

| 页面 | 首屏重点 | 布局与交互调整 |
| --- | --- | --- |
| Home | 导入一盘 / 看示例 / 继续上次 | 压缩重复品牌文案；输入、文件入口与示例更早出现；手机操作在预览前；已使用用户可直达最近任务 |
| Review | 当前局面与最值得看的决定 | 压缩顶部；棋盘、玩家、导航作为整体；右侧保留 Game Summary timeline；分析进度、结果范围和下一步清晰可见 |
| Moves / Study | 看一步为什么，再验证后果 | 复用当前棋盘上下文；原因与证据先展示；技术细节按需展开；临时探索有明确返回与保存状态 |
| History | 找回棋局并继续 | 可信状态、易用筛选、明确空态；菜单内说明删除范围；加载失败可重试 |
| Training | 继续一个具体学习任务 | 当前任务优先；Start / Continue 真正打开局面；完成条件可解释；统计与证据保留为支持信息 |
| Settings | 能力连接与本地数据管理 | 普通偏好、账号连接、数据、高级本地增强分组；能力状态与部署一致；备份先于不可逆清理入口 |

界面调整不改变 Objective / Human / Coach 的事实来源，不更改 Accuracy、评分视角、分类、Great/Brilliant 或 Human Difficulty 语义。先用小屏、键盘和任务完成度检验布局，再讨论艺术方向。

## 4. 执行顺序与每批交付

### R1 — 修复现有错误与数据口径

- [x] WEB-01：复盘状态与列表统计统一；覆盖手动导入、同步、FEN、失败/取消/缓存清理。
- [x] WEB-03：隔离复现删除与修复冲突，修正关联删除、reset 范围和后台写回协调。
- [x] WEB-04：读取/写入失败不再伪装为空库或成功。
- [x] WEB-09：先修非法输入 500，统一相关路由的错误返回。
- [x] WEB-02 临时真实性修正：清楚标明手动状态，避免把按钮完成解释为作答或掌握；真实任务流程在 R3 完成。

交付完成：278 项仓库单元测试（Web 164 项）、36 条 Chromium 工作流（新增 R1 7 条），以及 typecheck、lint、production build 通过。棋子、配色与棋类算法语义保持原样。清理会暂停后台工作并刷新当前页，其他页提示重新加载。

### R2 — 修整首页与复盘布局

- [x] WEB-05：首屏入口、棋盘尺寸、标题占用、右栏比例、手机顺序、字号与焦点。
- [x] WEB-07：PGN 文件导入、原始 PGN 导出、示例内容、临时分支提示。
- [x] 给首次完成分析的用户明确的关键一步与学习入口，沿用已有事实和证据。
- [x] 各尺寸截图与关键操作验收；保留右栏 Game Summary timeline。

交付完成：[实际页面截图](audits/assets/r2/index.html)与[验收记录](audits/2026-09-06-r2-layout-and-import.md)。1280×720 棋盘由 330px 增至 424px，导航进入首屏；390px 手机首页优先显示表单。292 项单元测试（Web 178 项）、45 条 Chromium 测试（含布局与视觉对比）、typecheck、lint、production build 通过。没有部署，也没有改动棋子、配色或棋类算法。

### R3 — 补齐学习与数据保留流程

- [x] WEB-02：Start → 源局面 → 明确回顾/作答 → 反馈 → 下一处 → 持久进度 → Continue。
- [x] 首版完成可恢复的局面回顾；若首发包含评分训练题，另行完成证据筛选、等价答案、提示和作答验收。
- [x] WEB-06：版本化备份/恢复、重复处理、多标签页升级和存储异常恢复。
- [x] 回顾与作答记录只记录实际行为，不能直接推算棋力提升或掌握度。

交付完成：[R3 验收记录](audits/2026-09-06-r3-training-and-backup.md)。315 项单元测试、51 条 Chromium 路径覆盖（最终受影响 13 条重跑通过），typecheck、lint、production build 通过。首版采用明确确认的局面回顾，评分训练题不在本批范围。

### R4 — 完善公开服务的业务边界

- [x] WEB-08：Browser Core 与 Enhanced Local 能力、语言和帮助入口；公开模式不探测访客的本地 AI。
- [x] WEB-09 工程部分：运行时校验、超时、进程内限流、串行队列、429 冷却，以及 OAuth 状态/取消/过期/断开回归。
- [x] 首发采用 Browser Core，按实际能力展示；未提供 Hosted AI，不承诺公开生成式服务。
- [x] 产品说明、数据存储/外发说明、手动反馈入口和公开页面元信息。
- [ ] WEB-09 环境验收：真实账号 HTTPS 授权/同步/取消/断开与部署层限制，在 R5 实际部署上完成；不能用模拟提供方测试替代。

本地工程交付完成：[R4 验收记录](audits/2026-09-07-r4-public-service-boundaries.md)。353 项单元测试（Web 239）、55 条开发模式 Chromium 路径和 2 条生产模式 Browser Core 路径通过；typecheck、lint、production build 通过。真实 Chess.com 公共资料请求成功，Lichess 当前未配置，真实授权保持为未验收。进程内保护不能代替多实例共享限制，见[运行边界](web-service-boundaries.md)。

### R5 — 生产环境验收与 beta 发布

- [x] WEB-10 工程部分：standalone 生产构建的 Chromium / Firefox / WebKit 及两种手机尺寸核心路径，50 条通过。
- [x] 1,000 / 10,000 局基准、旧库分批升级、模拟低资源取消重试、前台保留名额。
- [x] Debian / NUC / 现有 Cloudflare Tunnel 部署脚本，真实 Linux amd64 容器的代理、worker/WASM、Origin、Cookie、限流与安全头检查。
- [x] 版本记录、正常升级、手动回滚、启动失败及功能检查失败的自动恢复演练。
- [ ] 实际 NUC 与真实手机资源/触摸/下载验收。
- [ ] 实际 Cloudflare 公网 HTTPS 域名、缓存与真实账号 OAuth 授权/同步/取消/断开验收。
- [ ] 完成上述真实环境项目后，标记公开 Web beta 已发布。

本地工程完成：[R5 验收记录](audits/2026-09-07-r5-release-and-nuc.md)，[Debian NUC 部署操作](../deploy/nuc/README.md)。372 项仓库单元测试、8 项部署脚本测试、50 条生产浏览器路径、typecheck/lint/build 通过。已带索引的 10,000 局棋库首次加载从约 14.2 秒降到最终复测 165 ms；旧数据首次升级仍需约 15–20 秒，页面保持响应，后续约 179 ms。保留棋子、配色和所有棋类算法语义。未配置用户真实域名、未连接 NUC、未公开发布。

依赖：R2 可复用已完成的 UI，不等待艺术方案；R3 依赖 R1 的状态和数据规则；R4 的接口保护必须在公开暴露前完成；R5 验收已选定的首发功能范围。每批单独 review diff，不把算法重构或新商业功能混入修复。

## 5. 首发验收脚本与验证边界

用全新浏览器、没有本地 AI 的访客完成：

1. 首页找到示例或 PGN 文件导入，输入失败时知道如何修正。
2. 运行客观分析，看到真实进度；取消/失败后可恢复，完成状态正确。
3. 从关键决定进入局面，查看证据与后果，探索后回到原棋局。
4. 开始一个相关学习任务，逐局面推进；刷新后进度仍在，完成条件明确。
5. 在 History 找回棋局，导出原始 PGN，备份并在新浏览器恢复。
6. 删除一盘棋/清缓存/断开账号，各自行为与提示一致；进入 Training 不意外重建已删记录。
7. 在手机及服务异常状态重复核心动作，仍能完成或得到可恢复的结果。

实现时遵守仓库验证要求：先检查现有 scripts，运行相关确定性回归、受影响 package tests、typecheck/lint、涉及集成的 production build，以及对应 E2E；检查最终 diff。新增训练判定若涉及棋类语义，另行遵守 chess-analysis-change 的测试与文档规则。

### 证据矩阵(哪些已经自动化,哪些必须由人执行)

| 验收条件 | 自动化证据 | 仍需人工/外部环境 |
| --- | --- | --- |
| 浏览器缩放 200% / 400% | 固定视口下的布局断言(desktop/tablet/phone);`zoom-acceptance.spec.ts` | 真实浏览器缩放下逐页走查(记录在案的还有一处:棋盘坐标与棋子随缩放的视觉节奏) |
| 真实手机与平板 | 手机视口下练习面板不溢出、导航仍相邻 | 物理触摸设备上的走棋、长按、音效解锁 |
| 引擎异常(worker 停摆、结果迟到、单局失败) | 代码路径:分析取消/失败/重试、迟到结果丢弃、离线重跑 | 真机上一次完整的引擎异常复现记录 |
| 读屏操作 | 棋盘各方格有名称、每步有话述、可用 SAN/UCI 输入走子(见 ui-spec 键盘与读屏一节) | VoiceOver 与 NVDA 上的真实会话(含首次使用者) |
| 首次使用者(5–8 人) | 无 | 全部:导入到学会一个改进点的完整观察记录 |
| 公开部署、真实 HTTPS OAuth | 本地容器演练、standalone 验收 | 正式域名与真实第三方授权 |

2026-09-07 已实施 R1–R4 并运行对应工程检查，具体结果见各批验收记录。删除和重置验证使用隔离的测试数据，没有对用户存量棋谱执行破坏性实验。除开发模式 Chromium 工作流外，R4 新增独立 next start 的 Browser Core 验收，覆盖真实 WASM 分析和零本地 AI 请求。R5 已补齐 standalone 跨浏览器验收、1,000/10,000 局基准和本地容器部署演练；实际公开部署、真实 HTTPS OAuth 与物理设备仍待环境验收。Hosted AI 未纳入本次首发。

## 6. 后续稳定版候选

- [x] S1：个人变例、笔记、书签与 v2 备份恢复；独立 Notebook，不改原 PGN 或客观分析。详见 [Notebook](review-notebook.md)。
- [x] S2a：单盘错题练习，隐藏答案、主动走棋、Stockfish 判题及独立的提示/查看/跳过统计。仅本次会话，详见 [Mistake practice](mistake-practice.md)。
- [x] S7：错题练习改为 **就地** 形态（贴合 Lichess retrospect）：在复现棋盘上出题、锁住前进导航、隐藏引擎证据，并新增用 Maia 解释「原着为何自然」的差异化证据。原弹窗已删除。详见 [Mistake practice](mistake-practice.md) 与 [错题练习就地化](audits/2026-09-11-in-place-practice.md)。
- [x] S3：整盘复盘 worker 池按设备规模并行（上限 4），以及引擎/音效不可变缓存、离线外壳与 manifest。未改棋类算法；离线分析重跑仅在 Chromium 验证。详见 [复盘并行度与离线外壳](audits/2026-09-11-review-parallelism-and-offline-shell.md)。
- [x] S4：fragment 内的分享链接（不上传棋局）、用户手绘棋盘箭头、导入 PGN 评论/NAG/变例的显示与再导出。修复了导出两个相邻注释导致 Annotated PGN 无法被本产品重新导入的缺陷。触摸设备暂无手绘箭头。详见 [分享链接、棋盘箭头与导入注解保真](audits/2026-09-11-share-arrows-and-annotation-fidelity.md)。
- [x] S5：同分走法不再被误判为 Excellent；SEE 不再把被绝对牵制的子算作攻击/防守方（此前会高估交换并可能误报 Brilliant）。`interesting`/`miss` 按既有契约与测试保持声明但不可达，并在 schema 注明；`OBJECTIVE_ALGORITHM_VERSION` 已提升为 `objective-v2.1`。详见 [分类契约修复](audits/2026-09-11-classification-contract-fixes.md)。
- [x] S6：修正 Lichess 取消授权后跳回内网地址（`http://web:3000`）的缺陷，Cookie 的 `Secure` 改由规范 origin 决定；新增 HSTS；平台请求失败写入不含凭据的服务端日志。CSP 与第三方错误上报仍未做（见审计记录的理由）。详见 [生产边界修复](audits/2026-09-11-production-boundary-fixes.md)。
- [ ] 基于实际训练记录的复习计划；先积累数据，再验证重复训练策略。
- [ ] 自有账号、跨设备云同步、可分享研究或教练协作，按实际用户需求选择。
- 免费开源路线；当前没有收费、支付或套餐开发任务。
- [ ] 全站 UI/UX/布局审计与艺术方向复审（2026-09-13 已排期，见 [Windowlight 实现说明](design/2026-09-13-windowlight-implementation.md)）：在 Windowlight 已落地的棋盘/棋子/令牌基础上，跨全部路由与验收视口复核信息层级、密度与可读性，再决定是否有进一步艺术方向调整。暗色主题单列，作为未来 feature，不随本次复审启动。

  > 状态（2026-09-13）：[UI/UX/布局审计](audits/2026-09-13-ui-ux-layout-audit.md)已执行（12 路由 × 7 视口），并修复手机横向溢出、练习面板 `Filters` 可发现性、Study 触控高度、阶段标签字号与首页手机行布局。审计中的 F6/F7/F8（复选框与行内链接触控尺寸、练习 CTA 对齐）保留为后续表单/艺术方向复审的低优先级项。

在线对弈、实时配对、赛事、正式桌面签名与移动商店发布另列项目范围，不追加到本次复盘 Web beta。
