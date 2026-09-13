# Open Chess Review — AI 修改简报

把这份文档作为本项目已批准的 Product North Star、UI/UX 方向与 audit hypotheses。先读完，再检查当前代码和真实运行页面，然后才允许修改。

优先级与事实来源如下：

1. `AGENTS.md` 及适用的 nested `AGENTS.md`
2. canonical architecture / data-model invariants
3. 当前源码、测试以及 live browser 中可复现的事实
4. 本文档中明确标记为已批准的 Product Direction
5. 本文档中的 P*/V* audit findings

本文档中的 P*/V* 问题不是永久事实。它们来自某次实际审计，但代码可能已经变化。执行模型必须先使用当前 `master`、测试和真实浏览器重新验证，再决定是否修复。

如果某项已经部分或完全修复：
- 不要重复实现；
- 记录当前状态；
- 只解决仍然存在的问题。

如果本文档中的具体实现建议与当前架构、测试或更好的 canonical design 冲突，以验证后的当前事实和架构原则为准。

不要把本文档理解成「日系 / 浅色 / 蓝绿色 / 模仿《リズと青い鳥》」。

仓库：https://github.com/ice345/chess-review
本地 web：`apps/web`（App Router）。正式 UI spec：`docs/ui-spec.md`。色板：`apps/web/src/app/styles/tokens.css`。Training 样式：`apps/web/src/app/styles/study.css`。品牌：`apps/web/src/app/styles/visual-identity.css`。

**已实施状态（2026-09-13）**：Windowlight 视觉收敛已落地，见 `docs/design/2026-09-13-windowlight-implementation.md`。要点：单一浅色主题（无主题切换、无 theme provider）；棋盘 light `#eee8d9` / dark `#b1c6c2`，棋子为 Feather Porcelain（存储 id 仍为 `liz-blue`，Settings 显示名已改为 Feather Porcelain）；棋盘外观集中在 `apps/web/src/lib/board-appearance.ts`；无 `backdrop-filter`；重复密集信息用 ink row 而非半透明卡片；Stockfish/Maia/Move Quality 语义色不变。`docs/design/2026-09-05-bluebird-design-plan.md` 已标记为历史文档。

实测账号：Chess.com `ice-345`，导入 98 盘，Stockfish depth 10 分析完成 95 盘，3 盘非法 PGN 失败。

### Audit finding 状态规则

执行模型在处理下面每一个 P*/V* 项目前，必须将其归入以下一种状态：

- **VERIFIED** — 当前代码 + live browser 可以复现，允许修复。
- **PARTIALLY FIXED** — 当前代码已经处理了一部分，只修剩余问题。
- **ALREADY FIXED** — 当前 `master` 已解决，不再修改。
- **PRODUCT DECISION** — 不是 bug，而是已批准的信息架构 / 产品方向变更。
- **NOT REPRODUCED** — 当前版本无法复现，不得为了符合本文档而强行修改代码。

禁止：

`brief says it is broken → immediately edit code`

必须：

`brief hypothesis → inspect source → reproduce in browser/test → classify → implement if justified`

---

## 0. 两句 North Star（不可违背）

视觉方向：

以暖色纸张、蓝灰墨色、极淡水彩 wash、纤细线条和有意识的留白构成的安静 editorial chess-study environment；它借鉴《リズと青い鳥》中透明、纤细、易逝而克制的空气感，但完全以原创的 Blue Bishop 与棋类证据系统表达，而不是做成动漫主题。

产品感觉：

像一个安静、聪明而非常认真地观察你下棋的人——它不急着评价你，而是把你的棋局、决定、变化和长期模式一点点整理出来，让你最终真正理解「自己是怎样的棋手」。

关键词（给模型用，优先于任何风格形容词）：

Quiet Editorial Chess Study · Warm Paper · Blue-gray Ink · Faint Watercolor Wash · Fine Rules · Deliberate Negative Space · Evidence-first · Human but Precise · No Card Soup · No SaaS Dashboard

禁止把《リズと青い鳥》理解成：鸟、羽毛、动画人物、京都动画插画、pastel SaaS、glassmorphism。要从官方访谈抽取的是哲学：透明感、纤细、淡色、水彩、微小变化、留白、距离感、克制、观察感。来源：https://liz-bluebird.com/interview/ 、https://liz-bluebird.com/news/?id=31 、https://liz-bluebird.com/news/?id=3

---

## 1. 产品是什么

Open Chess Review 是 open-source chess review and coaching workspace。四层语义必须保持边界，不能在视觉上混成一锅：

| 层 | 职责 | 视觉语气 |
|---|---|---|
| Stockfish | objective truth | 精确、冷静 |
| Maia | human prediction | 安静、概率 |
| Coach / Study | grounded explanation | 批注 / 棋书旁注 |
| Training | 跨棋局 deterministic aggregation | 个人棋力发展 journal |

用户节奏必须是：

Game → Understanding → Evidence → Pattern → Training

禁止变成：

Dashboard → Cards → Numbers → More Cards

用户进入后应逐渐感到：

- 这里知道我刚才哪里下错了
- 这里能解释为什么
- 这里记得我过去很多盘棋
- 这里开始知道我是怎样的棋手
- 这里告诉我下一步应该练什么

禁止让用户感到：「这里有好多分析指标。」

---

## 2. 设计语言：Paper / Ink / Wash

比「蓝卡粉卡绿卡」重要得多。

### Paper（主体）

页面首先要像纸，不是纯白，也不是冷灰 SaaS。

现有 token，必须沿用，不要另起一套：

```
--bg:      #f7f2e9
--surface: #fffdf8
--paper:   #fbf7ef
--surface-2: #eef3f1
--surface-3: #e4ecea
--line:    #ccd6d5
--line-soft: #dfe5e2
```

Card 不是 Material 浮起的组件，而是一张纸轻轻放在另一张纸上。靠留白和细 rule 分层，不要重阴影、不要大块容器硬切。

### Ink（信息）

```
--text:   #253d49
--muted:  #71828a
--accent: #4e7182
--danger: #a6535f
```

不是 black + bright blue CTA。是深蓝灰墨水 + 较浅 secondary ink。

### Wash（情绪，不是组件身份）

```
--mist:  #dce8e7
--pink:  #eadde3
--sage:  #dfe8dc
--cream: #f1e4c9
```

正确：某一块纸上有一点点 mist；某个重点背后隐约 dusty pink；某个 section 有极浅 sage tint。

错误（立刻会变成 pastel dashboard）：

- Opening = 蓝卡
- Middlegame = 粉卡
- Endgame = 绿卡
- Rating = 黄卡

Wash 是 atmosphere，不是 component identity。

### 「透明感」不是 Glassmorphism

禁止：

```
backdrop-filter: blur(30px);
background: rgba(...);
border: 1px solid rgba(...);
```

透明 = 视觉存在感降低：边界变轻、色彩变淡、阴影变弱、装饰减少、空气更多。层级用排版和距离建立，不是用大块 container。`docs/ui-spec.md` 已写：surfaces primarily rely on whitespace and fine rules。

### 留白

- 好的：deliberate negative space，让重要东西呼吸（Training 里 Player / Opening / Middlegame / Endgame / Focus Now 之间有停顿）。
- 坏的：accidental empty space。例如 Rating & Form 一张巨大 Paper Card 左边一个小框、右边 70% 空白——那不是日系留白，是 layout 没设计完。

### Card 规则（写进实现）

Rare / Important → 可以 Card。
Repeated / Dense → Ink Row。

禁止把每个 KPI 包成一张卡。不要：

```
[Games 184] [Accuracy 83.7] [Score 60.9%] [Error Rate 15.5%]
```

要：

```
184 Games    83.7 Accuracy    60.9% Score    15.5% Errors
```

中间最多几条极细 divider。Typography > container。

重复信息（Openings / History / Mistakes / Critical Moves / Analysis Jobs / Evidence）用 Ink Row：

```
C21 Danish Gambit Accepted    22 games · 12.0%    Acc 84.9    Recent 87.6    Loss 2.8    Errors 23.5%
────────────────────────────────────────────────────────────────────────
```

不要在每行里面再嵌 Accuracy/Loss 小卡。

### Typography

- Serif（Georgia, "Songti SC", serif）：Training / Review / Study / Overview、大数字、核心章节标题。感觉 paper / journal / essay。
- Sans（Inter 等现有 sans）：buttons、controls、filters、engine data、metadata、evidence rows。感觉 clarity / precision。

现有实现方向正确，不要改成全 sans 后台，也不要全 serif 装饰。

### Blue Bishop

唯一允许的象征性图形。简化 bishop silhouette，对角线切入克制的 feather/wing gesture。不是鸟，不是第三方 chess artwork。

当前：`background: rgba(219, 233, 232, .82); color: #608899;` + 极轻 inset line。

禁止再设计：羽毛 icon、鸟 icon、自定义箭头装饰、Liz-themed symbols、decorative flourishes。其余品牌感只来自 color + whitespace + typography + composition。

### Motion

符合「微小变化」。禁止 hover scale(1.05)、card 跳起、button bounce、大幅 translate、夸张阴影、confetti、spring。允许：border 微变、paper tint 微变、opacity、underline、2px 以内位移、subtle reveal。用户甚至不该意识到「它动画了」，只觉得精致。

文案语气同样克制：

- 不要「🔥 BRILLIANT!!!」，要「这是一个值得注意的决定。」
- 不要「你中局太差了！」，要「过去 41 盘类似局面中，这类决定重复出现了。」
- 不要「AI Coach 正在和你聊天。」，要「这是基于这几个具体棋局证据得到的解释。」

Quality 里 schema `great` 对用户显示为 **Critical**（`docs/ui-spec.md` 已规定）。

---

## 3. 三页不同的正确感觉

### Training = Personal Chess Development Journal（本风格最完整的一页）

Training 的首屏信息优先级应大致是：

1. Who am I / Player Profile
2. How am I doing recently
3. What patterns define my play
4. What should I work on now
5. Evidence supporting those conclusions

一种推荐 composition：

TRAINING

PLAYER PROFILE
ice-345 · Chess.com · Rapid
rating · recent range · form · next target · coverage summary

OPENING        MIDDLEGAME        ENDGAME
quiet phase summaries

FOCUS NOW
1. …
2. …
3. …

HIGHLIGHTS / RECENT EVIDENCE

这是一种目标 composition，不是必须逐像素照抄的 wireframe。

执行模型可以根据真实 browser evidence 调整 composition，但必须保持信息优先级：

identity / development / action
优先于
filters / system status / analytics controls。

用户不该首先面对 Source / Rated / Color / Minimum Sample / Date Range / Opening。这些退到「Change scope」。

当前实现是 9 个 tab + 顶部密集 filter bar 的 BI dashboard，和 north star 冲突最大。

### Review = 即时分析 workspace

Board first。顺序：BOARD → CURRENT DECISION → GAME CONTEXT → EVIDENCE。棋盘是 primary interaction surface。比 Training 更 precise / focused / compact，但仍是 paper + light rules + low saturation。不要做成 journal 长文，也不要做成 engine lab 首页。

### Study / Coach = 棋书批注，不是 chatbot

规定教学序列（只显示有证据的槽）：

What to notice → Your idea → The problem → What happens next → A practical alternative → Remember this

禁止 🤖 AI / 👤 You 对话气泡。

---

## 4. 现网功能问题（ice-345 全量分析后实测）

按优先级修。这些是 correctness，不是审美。

### P1 — 批量分析进不了单局 Review（最大价值损失）

现象：Training Coverage 写着 “Stockfish analysis saved to Training”。点进 `/review/{id}`、`/moves`、`/coach`、`/engine`，却是 “Run the objective review first”；Engine 的 Cache 显示 `No game analysis`。95 盘已经算完的分析，在 Review 里等于不存在。

原因：

- Training / study library 用投影里存好的 `cacheKey` 读（`getCachedAnalysisByKey`，见 `apps/web/src/lib/advanced-study-library.ts`）。
- Review 加载时用当前 `NormalizedGame` 再算 hash（`getCachedAnalysis(review.game, { depth, multiPv: CLASSIFICATION_MULTI_PV })`，见 `apps/web/src/hooks/use-review-record.ts`）。
- cache key = `OBJECTIVE_ALGORITHM_VERSION + STOCKFISH_VERSION + depth + multiPv + initialFen + pgn`（`apps/web/src/lib/analysis-cache.ts`）。
- 历史任务用 `parsePgn(syncedGame.pgn)` 写入；Review 用 `loadPgn(record.input)` 再序列化。两边 PGN 字符串稍有差别就会 miss。

改法原则：

不要把原始 PGN string hash 或某一个 `cacheKey` 当成永久的 game identity。

推荐的 canonical resolution 层次：

Game semantic identity
→ compatible analysis projection
→ concrete cache entry

其中 game semantic identity 优先考虑：

- `initialFen`
- canonical `uciMoves`

Analysis compatibility 再判断：

- objective algorithm version
- Stockfish version
- depth
- MultiPV
- schema/version compatibility

当前 `ANALYSIS_INDEX_STORE` 已经保存 `initialFen + uciMoves + cacheKey`，优先研究是否可以围绕现有 projection 建立统一的 analysis resolver，而不是在多个调用点分别重算 PGN-based hash。

Review 加载可以允许：

1. 已保存的直接 analysis reference / cache locator（如果架构上合理）
2. `initialFen + canonical uciMoves` 的 projection/index lookup
3. compatible cache lookup
4. 最后才使用当前 normalized game 计算 concrete cache key

`cacheKey` 可以作为 locator / optimization，但不要让它成为唯一 canonical identity，因为它会随：

- engine version
- algorithm version
- depth
- MultiPV

变化。

最终 invariant：

同一盘已经完成 compatible objective analysis 的棋，在 Training、Review、Moves、Study/Coach、Engine 中必须解析到同一份 canonical analysis，不要求用户重复 Analyze。

修改前必须添加或找到 regression case，证明：

historical analysis
→ open Review
→ compatible cached analysis is restored

相关文件：`analysis-cache.ts`、`auto-analysis.ts`、`use-review-record.ts`、`use-review-analysis.ts`、`review-library.ts`、`advanced-study-library.ts`、`history-analysis-jobs.ts`。

### P2 — Coverage 僵尸任务卡

现象：同一范围同时出现 “Partial 95/98” 和更早的 “Paused 5/98 · Resume”。点 Resume 会重跑已完成工作。

原因：`collapseHistoryJobs` 的签名包含完整 `gameId` 列表（`advanced-study-page.tsx` 的 `historyJobSignature`）。5 盘 job 和 98 盘 job 对不上。

改法：

不要仅凭：

`scope + depth + algorithmVersion + multiPv`

就认定两个 job 是重复任务。

同一个 scope 在不同时间可能对应不同 game set，尤其：

`freshness = unanalyzed`

会随着分析进度不断变化。

需要区分：

- exact duplicate
- overlapping job
- superseded job
- genuinely different work

推荐建立明确的 job supersession / dominance 规则。

只有当：

- analysis settings 兼容；
- semantic scope 相同；
- 旧 job 的有效 item set 被新 job 覆盖；
- 新 job 确实接管旧 job 尚未完成的工作；

才可以把旧 job 标记为 `superseded` / cancelled / hidden from primary UI。

不要在 React render/collapse helper 中产生 job lifecycle side effects。

UI 的职责是展示 canonical job state；
job replacement / cancellation 应由 history-analysis orchestration 层负责。

目标体验仍然是：

用户对于同一个实际分析任务只看到一张当前有效的进度卡，不看到已经被后续工作取代的 Paused / Partial 僵尸任务。

### P3 — 非法 PGN / FEN 的 exclusion 与 legacy failed migration

目标：

provider 提供的 structurally invalid PGN/FEN 属于不可分析输入，不属于 retryable Stockfish failure。

当前代码已经存在：

- `partitionUnparsableSyncedGames`
- `excludedItems`
- retry 时对 legacy unparsable item 的 migration logic

因此此项必须先标记为：

**PARTIALLY FIXED — 重新验证当前 master**

需要重点检查：

1. 新创建的 history job 是否在 queue 前就正确排除 invalid PGN。
2. excluded game 是否不进入 retry loop。
3. legacy persisted job 中曾经标记为 `failed` 的 invalid game，在 migration 后是否真正退出 failure accounting。
4. migrated item 是否仍以 `status === "failed"` 留在 `job.items` 中，从而导致：
   - job 继续显示 Partial / Failed；
   - coverage.failedGames 仍然增加；
   - Retry 仍然出现；
   - completed scope 永远无法成为 complete。
5. 95 个合法游戏 + 3 个 provider-invalid games 应表达为：
   - 95 analyzable / analyzed
   - 3 excluded
   - 当前可分析范围 complete
   而不是 95 success + 3 failed。

如果 legacy migration 已经完全解决，则此项标记 `ALREADY FIXED`，不要重新实现。

### P4 — Plan 证据 SAN 截断

两列 weakness 卡里着法变成 `Nd…` `Bx…` `Qa…`，阶段变成 `mid…` `end…`。CSS：`.weakness-grid` 两列 + 证据列 overflow。见 `study.css`、`training-done-plan-cards.png`。

改法：证据行给满宽；完整 SAN + phase 必须可读（title/tooltip 兜底）。窄屏改单列。这是信息损失，不是装饰。

### P5 — 分析中数字滞后；进度藏在 Coverage

玩家下拉长期停在 `ice-345 · 5 games`，Overview 的 5/98 要好几轮刷新才到 95。25 分钟后台任务只有打开 Coverage 才看得见。

改法：

Job progress 与完整 Training report refresh 分开处理。

实时层可以更新：

- analyzed / total
- running / queued
- excluded / failed（如有）
- 当前 analysis state

但不要机械地在每一盘完成后重新读取全部 IndexedDB 数据并完整 rebuild player library / study report。

优先考虑：

job update
→ lightweight progress state immediately

report/library refresh
→ throttled / batched refresh

例如完成若干盘后或经过合理 debounce/throttle 周期再刷新完整 report。

Training 顶部应在所有章节中都能看到一个克制的分析状态，例如：

`47 / 95 games analyzed · analysis running`

使用 fine rule / quiet ink，不要制作新的 dashboard progress card。

ETA 不是硬性需求。

Stockfish 单局计算时间会受到：
- game length
- position complexity
- hardware
- browser worker scheduling

影响。如果无法给出可靠 ETA，宁可不显示，也不要制造假精确。

核心目标是：

用户始终知道分析仍在运行，并且新的分析结果会逐步进入 Training。

### P6 — 导入几乎没反馈

Settings 会卡在 `Syncing · 0 new · 0 batches` 十几秒。`ice-345` 实际只有 2 个 archives（2026/07、2026/08）。

改法：一开始就显示 archives 进度（0/2 months）和轻 spinner。不要等第一批 games 回来才有数字。

---

## 5. 现网视觉 / IA 问题（对照 North Star）

这些是「看起来像 BI Dashboard」的根因。修功能时必须一起把视觉从 card soup 拉回 editorial study。

### V1 — Card soup：同色色块粘在一起（用户明确指出）

Training Overview 6 个指标卡：

```css
.study-metrics { grid-template-columns: repeat(4, 1fr); gap: 10px; }
.study-metrics article { padding: 14px; border-radius: 12px; background: #edf2ef; }
```

同一块灰蓝绿填充、10px gap、无描边 → 读成一整块瓷砖。Coverage / Rating 复用同一套。

Highlights：

```css
.highlight-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
```

竖向几乎贴死。

准确率柱：

```css
.study-trend-chart { gap: 5px; }
.trend-track i { background: linear-gradient(180deg, #6f9ba7, #adc6c5); }
```

5px gutter 变成一条蓝墙。

改法：

- KPI 取消独立色块卡，改成 ink 横排 + 细 divider（见第 2 节 Card 规则）。
- 若必须保留容器：白/paper 底 + `var(--line-soft)` 细 rule，gap 16–20px，不要 `#edf2ef` 铺满。
- Wash 最多给 1 个主数字极浅 mist，其余不铺底。
- Highlights 竖向 gap ≥ 16px，或改成 ink row 列表（Critical · Kd1 · 8/25 · ply 23）。重复项优先 row。
- Accuracy trend 当前实现最多显示最近 30 盘，不要假设页面绘制全部 95 盘。实际在 live browser 验证 30 根柱在 desktop / tablet / mobile 下的可读性。如果仍然形成连续“蓝墙”，再考虑增大 gutter、降低视觉重量、使用更稀疏的 trend representation，或保留点击进入单局的证据能力。

### V2 — Training 信息架构是 Dashboard，不是 Journal

状态：

**PRODUCT DECISION**

这不是单纯的 CSS bug。

当前 `docs/ui-spec.md` 明确规定了 Training 的 9-tab architecture，因此如果执行下面的 journal IA 重构，代表我们有意 supersede 当前 Training spec。

实现完成后必须同步更新：

`docs/ui-spec.md`

使正式 spec 与新产品方向一致。

不要同时：
- 一边要求 agent 严格遵守旧 9-tab spec；
- 一边要求它删除 / 降级 9-tab architecture。

本文档在 Training IA 这一项上代表已批准的新方向。

当前：顶栏 5×2 filter（Source / Time control / Rated / Color / Opening / Minimum sample / From / To）+ 9 个 tab（Overview, Rating & Form, Openings, Middlegame, Endgame, Mistakes, Highlights, Plan, Coverage）。

用户先看到控件，后看到「我是谁」。和「Game → Understanding → Evidence → Pattern → Training」相反。

改法（按 north star 重组，不要只改 CSS）：

1. 首屏：Player Profile（名字、平台、时间控制、rating、recent range、form、next target、coverage 一句话）。
2. 同一视线：Opening / Middlegame / Endgame 三个 phase 摘要（ink，不是三张彩虹卡）。
3. Focus Now：最多 3 条下一步该练什么，来自 Plan/queue。
4. Highlights：少而精的证据，链到 ply。
5. Filters 收到 “Change scope”。Coverage / 分析 job 收到次要位置，不要当首页。
6. 9 个平行 tab 降级：要么改成页面内章节（有距离的 journal sections），要么保留但默认落地在 Profile+Focus，而不是 Coverage。

### V3 — Rating & Form 是 accidental empty space

一张巨大 section 里只有一个 Chess.com · rapid 小框，右侧大片空白。不是留白，是没设计完。

改法：若只有一条 rating band，不要用「等更多卡填满网格」的空 card 布局。改成与 Player Profile 一体的 ink 行，或把 recent range / performance / next target 做成横向 editorial 排版，让纸面被内容填满而不是被空容器撑开。

### V4 — 字号过小，像后台 metadata 墙

大量 label 是 8–9px（`.study-filters label` 8px，`.study-metrics span` 9px，`.highlight-grid small` 8px，`.study-trend-chart` 8px）。这是 admin density，不是 editorial。

改法：正文/证据 ≥ 13–14px，辅助 metadata ≥ 11px。Serif 章节标题保持，但不要靠缩小字号塞控件。

### V5 — Plan 卡既粘又截断

`.weakness-grid { grid-template-columns: repeat(2, 1fr); gap: 11px; }` 两列卡 + 截断 SAN，既是 P4 信息损失，也是 card soup。

改法：Focus Now 只突出 1–3 条（Rare → 可以轻微 paper card）。其余弱点用 ink row。P{n} 徽章不要做成粉彩身份色。趋势用 ink 词（improving / worsening），不要 saturate。

### V6 — Home 近况卡对比太弱

Home「Recent games」卡底色几乎等于页面纸色，边界靠很浅的线，网格又密，会糊成一片（另一种粘）。拉开 gap，或改 ink row。不要为了「有卡」而加深阴影。

### V7 — Review 缓存 miss 在视觉上也破坏 Study

Study 本应是批注。现在因为 P1，用户看到的是 CTA「Run the objective review first」——产品在催促，而不是观察。修 P1 后，Study 必须直接进入 What to notice 序列，而不是再推销一次 Analyze。

---

## 6. 实现时的文件地图

改视觉（Training / study）：

- `apps/web/src/app/styles/study.css` — metrics、highlight-grid、trend-chart、weakness-grid、filters、tabs
- `apps/web/src/app/styles/tokens.css` — 不要另起色板；不要把 wash token 当成组件填色
- `apps/web/src/components/advanced-study-page.tsx` — 重组 Training IA、job 折叠、顶栏进度、filter 退居
- `docs/ui-spec.md` — 改完后把 Training 从「9 tabs dashboard」改写成 journal 顺序

改缓存 / Review：

- `apps/web/src/lib/analysis-cache.ts`
- `apps/web/src/lib/auto-analysis.ts`
- `apps/web/src/lib/review-library.ts`
- `apps/web/src/hooks/use-review-record.ts`
- `apps/web/src/hooks/use-review-analysis.ts`
- `apps/web/src/lib/advanced-study-library.ts`
- `apps/web/src/lib/history-analysis-jobs.ts`

改同步进度：

- `apps/web/src/components/connected-accounts.tsx`
- `apps/web/src/app/api/platforms/chesscom/sync/route.ts`

禁止：

- 新增 Liz 符号、鸟、羽毛、玻璃拟态、hover scale、KPI 彩虹卡、Chess.com/Lichess 视觉抄袭
- 为了「好看」把 Objective / Human / Coach 三层配成三套高饱和色身份
- 克隆新色板；现有 token 已经对

---

## 7. 验收（改完必须同时满足）

功能：

- [ ] ice-345 这类已分析棋，打开 `/review/{id}` `/moves` `/coach` `/engine` 直接看到分析，Cache 不是 “No game analysis”
- [ ] Coverage 同一 scope 只有一张 job 卡；没有 Paused 僵尸 Resume
- [ ] 新的非法 PGN/FEN 在进入 analysis queue 前被排除。
- [ ] legacy persisted failed-invalid items migration 后不再进入 retryable failure accounting。
- [ ] excluded games 不导致 analyzable population 永久显示 Partial / Failed。
- [ ] Plan/Focus 证据 SAN 完整可读
- [ ] 分析进行中，任何 Training 章节都能看到克制且及时的进度。
- [ ] lightweight job progress 可以实时更新，但完整 Training report 不因每一盘完成而产生明显的重复全量重算。
- [ ] player/report game count 能以合理的 batch/throttled cadence 跟上分析进度。
- [ ] 全量导入显示 archives 进度，不只 0 new · 0 batches

视觉 / IA：

- [ ] Training 首屏是「我是谁 / 最近怎样 / 模式 / 下一步练什么」，不是 filter+9 tabs+KPI 卡
- [ ] 看不到一排同色填充 KPI 卡粘在一起
- [ ] 重复列表是 ink row，不是 card grid
- [ ] Rating 单 band 时没有 70% 空纸
- [ ] 没有 glassmorphism、scale bounce、鸟/羽毛装饰
- [ ] 仍是暖纸 + 蓝灰墨 + 极淡 wash；Blue Bishop 仍是唯一品牌图形
- [ ] 动效 ≤ 2px / opacity / tint；用户感觉精致，不感觉「动画了」

Responsive / Accessibility：

- [ ] 1440×1000 desktop 无意外 overflow / accidental empty layout。
- [ ] 1280×800 laptop 保持主信息层级。
- [ ] 900px 左右 tablet / narrow desktop 不出现挤压导致的信息丢失。
- [ ] 390×844 mobile 无 document-level horizontal overflow。
- [ ] long username / opening name / SAN / phase / evidence link 不丢失关键语义。
- [ ] keyboard 可以到达主要 Training navigation、filters、queue actions、details 和 evidence links。
- [ ] focus-visible 清楚但克制。
- [ ] 所有 form control 有可访问 label。
- [ ] status / error / progress 状态具有合理的 accessibility announcement。
- [ ] 正文与证据文字可舒适阅读；不要依赖 8–9px 字号维持布局。
- [ ] touch target 在 mobile 上不能因为 editorial aesthetics 而过小。

---

## 8. 给执行模型的工作方式

### Phase 0 — Re-validate this brief

不要直接开始修改。

对于每一个准备处理的 P*/V* finding：

1. 阅读当前相关源码。
2. 阅读适用的 `AGENTS.md` / docs / tests。
3. 在可能时使用 live browser 复现。
4. 检查当前 git master 是否已经部分修复。
5. 标记状态：

   - VERIFIED
   - PARTIALLY FIXED
   - ALREADY FIXED
   - PRODUCT DECISION
   - NOT REPRODUCED

只有 VERIFIED / PARTIALLY FIXED / approved PRODUCT DECISION 才进入 implementation。

---

### Phase 1 — Restore the product value chain first

优先重新验证 P1。

必须确认：

history analysis
→ canonical analysis cache/index
→ Review
→ Moves
→ Study/Coach
→ Engine

是否真正共享 compatible objective analysis。

如果 P1 仍存在，这是最高优先级。

但不要为了快速修复而制造第二套 analysis identity。

先设计 canonical analysis resolution。

---

### Phase 2 — Clean durable job semantics

重新验证 P2 / P3：

- duplicate / superseded history jobs
- legacy paused jobs
- invalid PGN exclusion
- retryability
- failure accounting
- persisted IndexedDB migration

Job correctness 优先于美化 job card。

---

### Phase 3 — Training IA

V2 是已批准的 PRODUCT DECISION。

把 Training 从：

filters
→ tabs
→ KPI dashboard

转成更接近：

identity
→ development
→ pattern
→ next action
→ evidence

Filters / Coverage / engine maintenance information退居次层。

实现后同步更新正式 `docs/ui-spec.md`。

---

### Phase 4 — Visual refinement

结合 live browser 实测处理：

- V1 card soup
- V3 accidental empty space
- V4 tiny typography
- V5 Plan density / evidence truncation

遵守：

Rare / Important → Card

Repeated / Dense → Ink Row

Wash → atmosphere

Typography / whitespace / fine rules → hierarchy

不要通过新增更多组件容器解决已有组件太多的问题。

---

### Phase 5 — Progress UX

处理 P5 / P6 时保持：

observable
but quiet

进度必须容易看到，但不能生成新的 analytics dashboard。

实时 progress 与 heavyweight report rebuild 分离。

不要求不可靠的 ETA。

---

### Phase 6 — Browser validation loop

每个 meaningful UI batch 修改后必须：

1. refresh / reopen live page
2. inspect desktop
3. inspect narrow viewport
4. inspect mobile
5. interact with changed controls
6. inspect console
7. inspect failed network requests
8. inspect screenshot / DOM / accessibility state
9. compare before / after
10. 如果结果更差则继续修改

禁止：

edit source
→ run lint
→ declare UI fixed

---

### Phase 7 — Regression protection

Correctness bug 尽量增加对应 regression test。

尤其：

- historical analysis can open directly in Review
- semantic analysis lookup survives harmless PGN/header serialization differences
- superseded history jobs
- invalid PGN exclusion
- legacy failed-invalid migration
- exact-ply Training evidence
- persistent training progress
- mobile overflow

优先扩展现有 unit / Playwright infrastructure，不另建重复测试体系。

---

### Phase 8 — Final validation

至少运行适用的：

- focused tests
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- relevant Playwright E2E

最后检查：

- `git status --short`
- `git diff --check`
- `git diff --stat`
- `git diff`

不要 commit。
不要 push。
不要自动接受 screenshot baseline 变化。

---

判断口诀：

若你加的东西让页面更像 BI dashboard、更像 pastel SaaS、更像动漫主题、更像在催促用户——删掉它。

若它让证据更清楚、纸面更安静、距离更合适、观察感更强——留下。

若 brief 与当前实际代码冲突——先相信可验证的当前事实，再决定 brief 是否需要更新。
