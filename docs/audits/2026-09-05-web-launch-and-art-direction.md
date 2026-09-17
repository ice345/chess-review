Status: Historical
Baseline: `a1f603e` · 2026-09-05
Superseded by: [docs/design/windowlight-contract.md](../design/windowlight-contract.md)
Do not use as the current product contract.

# Web 上线与艺术方向审计 · 2026-09-05

审计基线：`a1f603e`。范围是面向公众的棋局复盘与学习网站。本文记录当前事实、设计判断和待实现的验收条件；不代表下面的建议已经实现。

## 结论

**已有可信的产品基础，适合进入有明确范围的 Web beta 收尾；当前尚不宜作为“开箱即用、完整在线 AI coaching 平台”正式推广。**

视觉方向基本正确。暖纸、蓝灰墨色、原创 Blue Bishop、细线、克制的着法图标，应继续使用。下一步的主要工作是版面比例、阅读顺序、可读性与服务能力表达。继续增加淡色卡片不能解决这些问题。

建议首发承诺：无需安装即可导入一盘棋、完成 Stockfish 复盘、查看证据与基础学习总结，并在本浏览器积累训练记录。Maia / 生成式 Coach 按部署实际能力提供，明确区分本地增强和在线服务。这里的“chess 平台”沿用仓库已有复盘与学习定位，不把多人对弈、配对和赛事系统加入首发范围。

## 本轮证据与边界

已阅读以下任务的可访问实现总结，并用当前代码和页面核实本轮涉及的结论：

- `根据 Prompt.md 开启实现吧`：`01a029ab-4d54-7120-906d-a28bbc5b476f`。Phase 6/7/8 的桌面、训练、移动基础等已有实现。
- `Audit release readiness`：`01a03bfd-6a39-7341-a066-4cf882da4519`。历史分析关联、分支回退、timeline、首页与开发启动等已有后续修复。

阅读了 `docs/ui-spec.md`、既有完整审计及 9 月 2 日附录、roadmap、产品 North Star、相关组件、样式、存储、API、CI 和工作流测试。

实际浏览 Home → 示例复盘 → 下一步 → Study → 无本地服务的整盘总结，以及 Training、Settings。在新的 `localhost:3100` origin 打开生产构建，核对首次访问界面。人工页面尺寸实际为 1280×720。浏览器尺寸覆盖 API 未反映到页面 `innerWidth/innerHeight`，因此不声称本轮完成了人工手机视觉验收；已有工作流覆盖部分 390px 场景，不能替代完整手机检查。

| 本轮重新执行 | 结果 |
| --- | --- |
| `pnpm test` | PASS：235 项，shared 10 / chess-core 14 / analysis 75 / openings 2 / stockfish 13 / web 121 |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS：Web、Desktop frontend、Mobile frontend |
| `pnpm test:e2e e2e/workflows.spec.ts` | PASS：29 项 Chromium 工作流，38.8 秒 |
| `pnpm audit --prod` | 未报告已知依赖漏洞；这不是整体安全认证 |
| 本地生产 HTTP 首页 | 200 |
| 本地生产 malformed Chess.com sync 请求 | 500，见 W04 |

本轮没有重新执行 Python、Rust、完整视觉基线测试，没有连接真实 Lichess OAuth、下载模型、验证真实远程 AI、检查实际公开域名、重新核验远端 CI，也没有做 1,000/10,000 局压力测试。已有测试通过不应被扩大解释为这些项目已通过。

## 从作品资料得到的设计依据

### 《リズと青い鳥》作为主要基调

山田尚子在官方访谈中强调透明而自然的空气、小变化的累积、细线，以及安静观察人物的色彩感。这里最适合产品的转译是：让用户在稳定的空间内逐步发现自己的决定，而不是同时承受所有分析指标。[导演访谈](https://liz-bluebird.com/interview/)

美术监督篠原睦雄在官方倒计时评论中明确提到透过玻璃的透明感、淡色之间的对比和水彩表达。它支持微妙的冷暖层次与留白，不能据此推导“所有文字都应该很浅”。[美术与制作人员评论](https://liz-bluebird.com/news/?id=31)

西屋太志的官方评论关注细线、呼吸、人物间逐渐变化的距离。这可以转化为版面中的主次关系和缓慢揭示的证据，而不是增加鸟、羽毛或人物插画。[角色设计等工作人员评论](https://liz-bluebird.com/news/?id=3)

已实际查看[电影官网](https://liz-bluebird.com/)的首页视觉。官网包含较鲜明的童话树林、水彩与粉蓝标题；它是宣传物料，不能把整站的所有颜色直接移植为长期使用的棋盘界面。建议以作品现实校园段落的克制与透明作为工作区主调，童话色彩只借用少量情绪点缀。

### 《響け！ユーフォニアム》作为补充

石原立也的官方访谈强调对乐器、演奏动作和使用者感受的细致研究，并让复杂制作自然地呈现。这对本项目的启发是：视觉可以柔和，棋类事实、落子反馈和练习设计必须精确。[导演访谈](https://anime-eupho.com/interview/director/)

**以上是根据资料作出的产品设计推论，不是制作团队对本项目的建议。** 原创品牌、现有分类图标与棋类语义继续保留。

## 当前风格符合到什么程度

| 维度 | 当前判断 | 调整方向 |
| --- | --- | --- |
| 纸张与墨色 | 符合；tokens 已有完整语义色板 | 继续使用现有 tokens，减少组件内独立颜色 |
| 空气感 | 部分符合；背景有轻微冷暖渐变 | 留白集中在章节之间，减少控制区内浪费的纵向空间 |
| 主体与陪衬 | 笔记本尺寸明显失衡 | 棋盘保有足够尺寸，右栏服务于当前决策 |
| 纤细与可读性 | 过多 7–11px 小字、部分墨色过浅 | 细线与轻背景保留，正文和焦点加深、增大 |
| 纸面批注感 | Review 行列表与 Training 已有进步 | Study 先给可理解的观察，技术规则按需展开 |
| 温度与节奏 | 降级文案及小样本页面仍像调试工具 | 正常能力不以“离线失败”为开场，少数据时给下一步 |
| 视觉一致性 | 品牌和 V3 图标可复用 | 不再新增一套图标、语义色或分析口径 |

## 需要优先完善的事实

优先级用于这一轮 Web 首发：P1 是应在公开 beta 前处理或明确限缩承诺的事项，P2 是稳定版前的重要完善。`SOURCE VERIFIED` 表示源码确认；没有对用户存量数据执行破坏性复现。没有在本轮证明新的 P0 棋类算法缺陷。

### W01 · P1 · 棋盘比例与首屏导航不符合核心体验

状态：**VERIFIED，页面 + 源码**。

1280×720、页面顶端、示例复盘的实测：棋盘对应 transport 宽 330px，右侧 `.context-panel` 宽约 815px；transport 的 y 范围为 689–741，底部超出首屏。根因是 `review-shell.css:132` 的 `min(520px, calc(100vh - 390px), calc(100vw - 620px))`：720px 高度把棋盘限制成 330px。

540–610px 的文档目标与目前最大 520px 的 CSS 也不一致。1120px 以下使用另一条不受窗口高度限制的公式，造成断点两侧的比例变化。

实现建议：压缩两层 header、顶部工具和 player strip 的纵向开销，按可用列宽与合理高度共同分配棋盘。笔记本目标先尝试 420–460px，1440×900 目标约 500–540px，再以真实页面验收。右栏保持 timeline 在 Game Summary 内；不要撤销用户之前要求的放置方式。

验收：1280×720 / 1366×768 / 1440×900 / 1920×1080 下棋盘、两位玩家与五个导航按钮都清晰可用；不靠缩小到 330px 达到“对齐”。新增几何断言应检查棋盘最低尺寸和按钮是否在视口内。现有 1280×720 测试仅检查内容可见性和列高相等，没有验证这些条件。

### W02 · P1 · 首页入口在首屏之外，示例还没有展示产品的学习价值

状态：**VERIFIED，页面 + 源码**。

1280×720 实测 `Analyze game` 按钮 y=742.96–782.96；示例入口更低。首页先展示重复品牌/标题，再展示 560px 静态棋盘，表单纵向居中。手机 CSS 把棋盘排在表单前面，进一步推后入口；手机实际屏幕仍需人工复核。

当前 SAMPLE_PGN 是 21 ply、未结束、基本在开局理论内的局面。它能验证导入，但很难展示错误后果、补救与训练价值。这是示例内容选择问题，不是算法失效。

实现建议：首屏直接呈现导入或“先看示例”，棋盘与引导同一行；手机先放操作。支持本地 `.pgn` 文件选择/拖入，保留 PGN/FEN 边界。准备一盘来源明确、已由真实引擎验证、有两三个可教学决策的演示棋局，预先缓存其分析，再允许重新分析。

验收：初访者无需账号、术语知识或滚动寻找入口就能进入示例；导入错误可修正；首盘完成后有“看关键一步 → 看后果 → 练一次”的路径。建议用 5 位首次使用者做任务观察，至少 4 位无需提示完成这条路径；这是拟定验收标准，不是已取得的结果。

### W03 · P1 · Hosted 能力与 Local 模式仍没有清晰的产品边界

状态：**VERIFIED，页面 + 源码；正式域名行为 NOT VERIFIED**。

`local-ai.ts:62` 默认指向 `http://127.0.0.1:8000`，包括远程 provider 的请求仍经该 gateway。公开网页中的这个地址指向访问者的电脑。Settings 直接告诉普通用户运行 `pnpm dev` / `pnpm dev:local-ai`；默认 Coach 为中文、Ollama，界面主体为英文。

没有本地服务时，Study 可以生成确定性总结，这条能力已实测成功。但页面以服务离线、deterministic、canonical-facts、规则原文等开场，容易让新用户理解为产品损坏。

实现建议：显式区分 hosted-browser、enhanced-local 和未来 hosted-ai 的能力配置。Hosted Browser 默认展示现成的“基础复盘总结”，生成式讲解与 Maia 在有服务时才承诺可用。可选服务配置放进专门入口。公开部署不可把 `NEXT_PUBLIC_LOCAL_AI_TOKEN` 当成共享云服务秘密；`NEXT_PUBLIC_` 会进入客户端包，这是本地开发机制与多人服务认证不同的边界，并不表示本轮发现了已泄露的密钥。[Next.js 环境变量说明](https://nextjs.org/docs/pages/guides/environment-variables)

如果首发一定要求所有访问者都能使用 Maia/LLM，则增加服务端用户/会话边界、配额、并发预算、取消与超时，以及明确的数据传输说明。这是另一个上线门槛，不能只把 loopback URL 换成公网 URL。

验收：在没有任何本地服务的真实 HTTPS 浏览器中完成全部 Browser Core 学习流程；首次进入不需要处理持续出现的错误提示。Local 模式和在线 AI 的连接方式单独验收。

### W04 · P1 · 公共 API 需要运行时输入校验与资源预算

状态：**VERIFIED 的输入错误；其余为 SOURCE VERIFIED / 部署层 NOT VERIFIED**。

对本地生产构建的 `/api/platforms/chesscom/sync` 发送 `{"account":{"provider":"chesscom","username":42}}` 得到 HTTP 500。该请求在 `sync/route.ts:45` 的 `username.toLowerCase()` 抛错，尚未发起外部请求。TypeScript 类型断言没有提供运行时校验。应该返回结构化 400。

同步 route 已有请求体大小限制与 archive host allowlist，应保留。仍需统一校验 username、cursor、mode、limit 等。`chesscom/link` 用 `request.json()`，对 upstream 请求没有自身 timeout；route 中也未见服务端限流。不能据此认定部署平台没有边缘保护，本轮没有访问平台配置。

验收：非法 JSON/字段类型/范围返回 4xx；超大请求 413；上游超时有可理解响应；短时重复请求受到预算控制；429 可重试，不丢失 checkpoint。不对真实服务做负载攻击测试。

### W05 · P1 · 数据删除承诺仍有遗漏，备份与迁移缺少完整闭环

状态：**SOURCE VERIFIED；未清除用户数据**。

`browser-storage.ts` 创建了 `player-avatars` store，但 `local-data.ts:85` 的 Reset all 列表没有包含它；这些记录含 provider、username、avatarUrl 与时间。当前“Erase all Open Chess Review data”承诺与实现不完全一致。

全量 reset 按 store 分别提交事务，缺少跨 store 原子性。另需明确它是否也意味着退出 Lichess：目前删除 IndexedDB 不会自动删除服务器 HttpOnly OAuth cookie。既有 Disconnect 功能应继续复用。

当前界面有单局导出、清缓存与删除；没有发现完整资料库备份/恢复入口。`openReviewDatabase` 没有 `onblocked` / `onversionchange` 处理，数据库升级被另一个标签页阻挡时没有明确恢复路径。

验收：隔离测试库验证全量删除范围；运行中的分析/同步在清理期间不能重新写回；删除与账号断开的文案和行为一致。添加版本化备份/恢复、损坏记录隔离、多标签升级与 quota 错误处理。用户换浏览器后数据不存在，应有明确说明。

### W06 · P1 · “淡”已经影响阅读与焦点辨识

状态：**SOURCE VERIFIED + 色值计算；不是完整 WCAG 认证**。

`--ink-muted: #71828a` 在 `#f7f2e9` / `#fffdf8` 上的理论对比分别约 3.58:1 / 3.93:1。该色用于 10–11px 标签、说明与 caption。默认焦点 `#a9c0c2` 相对 paper 仅约 1.88:1。Review 的来源标签、规则说明还有 7–9px 字号。

建议正文 14–16px、重要辅助文字 12–13px；普通小字采用至少 4.5:1 的组合。装饰线可以淡，焦点和交互边界用深一档墨色。44px 是建议的主要触控目标；不要把所有小于 44px 的控件直接宣布为 WCAG AA 失败，2.5.8 还包含 24px 和间距等条件。[WCAG 2.2](https://www.w3.org/TR/WCAG22/)

验收：实际背景上的对比检查、键盘全流程、200% 放大、焦点可见、手机主要导航目标。保留 existing reduced-motion 和静音能力。棋子按钮在当前 accessibility tree 中缺少可读名称，应进一步验证棋盘键盘/屏幕阅读器操作，并提供明确 square/piece/side 名称。

### W07 · P2 · 学习内容的默认阅读顺序仍然是系统视角

状态：**VERIFIED，页面；改法属于 PRODUCT DECISION**。

Study 先显示运行状态、provider、事实来源、规则名，再显示总结。实测开局样例的总结包含“第 13 半回合”“0.0 个胜率百分点的波动”“canonical-facts · high confidence”等表达。内容可追溯，但缺少面向棋手的解释顺序。

Training 在 2 局手动数据下首先展示无平台 rating、无 meaningful target、coverage 与 low confidence；真正可做的事情在更低位置。现有低样本限制是正确的，应保留，不能让 LLM 编出棋手画像来填空。

实现建议：Review 默认是当前着法与简短证据，完整 MultiPV/技术字段可展开；Study 是“观察 → 后果 → 尝试 → 证据”；Training 少数据时直接提供“继续复盘/重练已知节点”，足够数据时才显示跨局模式。训练 Start 应最终进入隐藏答案的尝试流程，完成记录来自实际练习或用户明确确认，二者区分。

统一 Web UI 的中英文策略，将 UI language 与 Coach output language 分开配置或明确联动。翻译展示文案，不改变内部 classification key、Accuracy 或 phase 语义。

### W08 · P1（发布验收）/ P2（规模扩展） · 测试与性能证据仍不完整

状态：**SOURCE VERIFIED；性能实际瓶颈 NOT MEASURED**。

`playwright.config.ts:22` 只有 Chromium；默认 webServer 为 `pnpm dev:web`。CI 只运行 workflows，截图基线并不是 CI gate。本轮 29 项通过包含真实 WASM 样例、分支、将死/逼和和持久化路径，是有意义的基础，但不能代表 Safari/Firefox、生产构建或真实 HTTPS。

History 只渲染 60 行，却先通过 `getAll()` 读取 review 和 synced games，再排序合并；首页也读取完整列表后 slice。渐进渲染已经实现，数据库分页尚未完成。大量数据下的开销是源码风险，本轮未声称已测出卡顿阈值。

验收建议：生产构建 E2E；Chrome、Firefox、Safari/WebKit 基础路径；真机 iOS Safari / Android Chrome；1k/10k library 固定 fixtures；冷/热缓存及 depth/MultiPV 标注；记录首个有效分析、完整复盘、主线程输入与恢复时间。先测中端机器，再定完整引擎用时预算。可以先以 LCP ≤2.5s、INP ≤200ms、CLS ≤0.1 作为页面体验目标，不能把它们当作已达到的数据。上线后按移动/桌面分别观察第 75 百分位。[Web Vitals 官方说明](https://web.dev/articles/vitals)

### W09 · P1 · 正式发布的运维与信任入口没有形成可核验交付

状态：**仓库与本地生产 SOURCE VERIFIED；实际托管 NOT VERIFIED**。

本地 `next start` 首页响应未包含 CSP、frame 防护、nosniff 等自定义安全头；`next.config.ts` 未设置这些 headers。可能由真实反向代理补充，因此正式域名需要最终核对。CSP 必须兼容现有 Worker/WASM 和授权资源，先 report-only 验证再逐步执行。

仓库未发现 Web 部署配置、独立 readiness endpoint、客户端 error boundary、发布回滚 runbook，以及完整的 public About/Privacy/反馈入口。layout metadata 只有 title/description，仍需首页分享预览、私有工作区的索引策略及一致 404。增加这些入口是产品信任与运维完善，不是本报告对某司法辖区提出的法律判断。

部分 GitHub Actions 仍使用可变 tag（checkout、setup-node、pnpm 等）；固定 SHA 的既有 follow-up 尚未完成。桌面签名、公证和移动商店打包不应阻塞只发布 Web 的 beta，应继续独立标记。

验收：从干净 checkout 可重建并部署到 staging；配置实际 OAuth redirect/secret；检查部署后 Worker/WASM、同步与重试；发布版本可识别、可回滚；错误日志不默认收集原始 PGN/FEN/token；用户能找到数据范围说明与反馈入口。

## 已经完成、不要重做的部分

- Game Summary 内的 Evaluation Timeline：本轮工作流通过，保留位置。
- 分支回退、合法走子、升变选择、current-position 与 canonical game 分离：已有回归，本轮对应工作流通过。
- 历史分析成功结果进入 Training、失败逐局解释、持久批次暂停/恢复：本轮工作流通过。
- PGN/FEN、Stockfish、统一 icon/分类语义、已有音效与 reduced-motion：保留。
- 本地 AI 可选且支持确定性 Coach 降级：已有能力，优先改默认产品呈现。
- 开发启动不等待全部可选服务：已有修复，不再把它列为尚未实现。

文档也要同步：`docs/ui-spec.md:93` 仍写升变默认 queen、chooser 为未来工作，实际已存在 chooser 与测试；棋盘尺寸段落也已过期。下一轮实际修改相应功能时更新这些契约，避免后续审计按过期描述继续推断。

## 建议的实施顺序与完成定义

### 第一步：完成首盘复盘体验

范围：W01/W02/W06 的入口、版面、文字与焦点，以及 W07 的基础文案。保持 timeline 位置、V3 图标、分析算法和现有路由。

交付：一个首次访问无需安装的完整样例；笔记本与手机都能顺手操作；清楚说明“现在能做什么”；页面草案转成真实组件。优先触及 home、review shell、coach、tokens 的正确样式所有者，避免全局覆盖堆叠。

### 第二步：补齐公开 beta 的可靠性

范围：W03/W04/W05/W09。明确 Hosted Browser 的配置；修复输入 500；完整数据清理、备份与升级恢复；部署配置与错误反馈。

交付：Browser Core 在没有 local-ai 的 HTTPS staging 上通过核心全流程；数据操作在隔离环境里通过恢复/删除测试。Hosted AI 若包含在首发承诺中，必须同时完成会话、配额和服务端 provider 集成。

### 第三步：发布前验证与小范围用户试用

范围：W08，及前两步的验收矩阵。

交付：生产构建与跨浏览器测试；中端设备性能实测；5 位新用户任务观察；发布 runbook、回滚和反馈方式。CI 绿灯是必要条件，实际操作通过才是发布条件。

### 第四步：稳定版增长与长期训练

根据 beta 反馈扩展大历史库、主动练习、重复训练反馈，以及在线 Maia/Coach。先让“复盘一盘 → 理解一步 → 实际练一次 → 下次回来”稳定成立，再扩展更多分析页面、账号云同步和原生分发。

## 设计落地约束

- 继续使用 warm paper / blue-gray ink / mist / pink / sage / cream；wash 只提供气氛，不给每个指标分配彩色卡片。
- 首屏每个区域只有一个主要行动；不要让功能名、来源名、数值和 CTA 同时争夺注意。
- 棋盘区域保持平坦、清楚的格子与棋子；减少包围棋盘的厚重阴影，不牺牲对比。
- 鼠标和键盘交互立即响应；动画只说明选择与移动，尊重 reduced motion；不自动播放背景音乐。
- 先呈现合法且有证据的棋类观察；“为什么”可展开 rank、PV、来源与规则。不要为人情味编造心理或战术事实。
- 两种作品提供观察方式与情绪灵感，Blue Bishop 和棋类证据提供产品自己的身份。

这轮只新增审计文档与对话内布局提案；没有把提案算作生产实现，也没有变更棋类算法、部署网站或创建新的提交。
