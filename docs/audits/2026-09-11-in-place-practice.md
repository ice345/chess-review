Status: Historical
Baseline: 2026-09-11 (S7)
Superseded by: [docs/mistake-practice.md](../mistake-practice.md)
Do not use as the current product contract.

# 错题练习就地化（S7）

日期：2026-09-11。范围：把 `practice` 从独立弹窗改为**就地练习**，贴合 Lichess
"Learn from your mistakes"（`lila` 内部名 `retrospect`）。未改动 Accuracy、WinPercent、
Divider、分类阈值或算法版本号。

## 改动前的问题

原实现是一个 `<dialog>` 弹窗，内含**第二块棋盘**。用户想要的是 Lichess 那种体验：
**在复盘棋盘上回到出错那一步重下**。两者差距不是细节，而是形态。

## 参考实现（读源码而非猜测）

`references/lila/ui/analyse/src/retrospect/`，入口 `view/actionMenu.ts:86`（要求已有完整
电脑分析）：

- **挑题**（`nodeFinder.ts:19` `evalSwings`）：评估摆动 > 10 个百分点，或丢掉 ≤3 步的杀棋。
- **出题**：跳到错误**前**一步，`preventGoingToNextMove`（`retroCtrl.ts:246`）**锁住前进**。
- **隐藏**：未解出的候选步连**着法列表**里的引擎线也隐藏（`inlineView.ts:70`）。
- **判定**（`retroCtrl.ts:147`）：`winningChances.povDiff > −0.04`，即损失 ≤ **4 个百分点**。
  另外大师开局库着法、将死、原局正解都算对。
- **开局例外**（`retroCtrl.ts:117`）：查大师库，流行着法直接跳过，因为开局没有唯一答案。

## 本次改动

**1. 就地形态。** 新增 `apps/web/src/hooks/use-retrospect.ts`（会话状态）与
`apps/web/src/components/retro-practice.tsx`（面板）。棋盘就是原来的复盘棋盘；
`components/mistake-practice.tsx` 弹窗**已删除**，不留双路径。

**2. 在咽喉处锁导航。** 不是逐个按钮加判断，而是在会改变 ply 的地方统一拦截：
`navigateToPly`、`navigateNext`、`navigateLast` 与 `playDisabled`（自动播放）都在
`retro.locked` 时拒绝越过出题位置。这样着法列表、评估图、播放条都无法泄露答案。

**3. 隐藏答案。** 出题位置隐藏六类证据：棋盘候选箭头、`Engine` 面板的 MultiPV 列表、
`PositionAnalysis` 的续着、着法列表里该步的标签与 Accuracy（显示 "Hidden while solving"）、
**Maia 侧栏的人类候选**、以及 **Study 页生成的讲解**。

> 三个容易漏的点，都是实测发现而非推测：
> 1. `analysis.moves[currentPly].stockfish` 是**当前位置**（而非下一步）的 MultiPV 根，
>    所以出题时它的第一条就是答案 —— 三个消费点都必须屏蔽，仅隐藏棋盘箭头不够。
> 2. **Maia/Compare 侧栏**同样泄露：它渲染该局面的人类候选，而且**点击即走**。
>    该面板原先完全不读 `retro.locked`。已在 Enhanced Local 模式下加 e2e 断言锁住。
> 3. **Study 页的讲解**也会泄露，而且**不需要 Maia**：确定性讲解的 "What happens next"
>    一行是以该步的 `fenAfter` 为起点校验的，而出题时 `fenAfter` 就是待解局面，
>    于是那一行**以正解开头**；正文也引用 SAN。已在锁定期间屏蔽整篇文章并加断言。
>
> 注意锁定只拦 ply 导航，拦不住 `Link` 切换标签页，所以这些面板必须各自屏蔽内容。

**4. 判定对齐 Lichess。** 容忍度由 2 个百分点放宽到 **4**（`PRACTICE_MAX_WIN_PERCENT_LOSS`）。
将死语义保留：必胜的杀不能丢，被将死不能算对，即使 WinPercent 饱和。

**5. 开局例外。** 仍在理论范围内的着法（`classificationReason.isBook`）不再出题。
Lichess 用大师库频率；我们用既有的理论边界，是**位置近似**而非对局频率证据，这一点在文档中写明。

**6. 差异化：用 Maia 解释「原着为何自然」。** 新增
`practiceHumanComparison()`（`packages/analysis`）：给出该等级下玩家选择**原着**的概率、
引擎推荐着法的概率，以及复用 `humanFindDifficulty` 得到的难度标签。Lichess 的 retrospect
完全没有人类模型证据。

**硬约束**：Maia 只在 Enhanced Local 模式存在，**Browser Core 没有**。因此：
- 复用已持久化的 `move.human` 事实，不新增网络请求；
- 没有 Maia 事实时，练习流程**完整可用**，面板提示可去 Review 运行人类分析；
- 文案由确定性字符串拼接，不经语言模型，因此不可能与引擎事实冲突。

## 验证

| 检查 | 实际结果 |
| --- | --- |
| `pnpm test` | **89 项 analysis**（新增开局例外、Maia 对照、**4 个百分点边界**）+ web 297 全通过 |
| `pnpm typecheck` / `pnpm lint` | 0 错误 / exit 0 |
| `NEXT_PUBLIC_APP_MODE=browser-core pnpm build` | 通过 |
| `playwright test e2e/mistake-practice.spec.ts` | **12 条全通过**，含：答案隐藏（断言棋盘箭头数为 0）、`End` 键跳转被拒、答错不离开出题位置、正确解出、View/Skip 推进、无 Maia 事实时不显示人类解释、Enhanced Local 下 Maia 侧栏候选被隐藏、Study 讲解被隐藏、**真实 WASM 验证未列出的接近最优着法被接受**、引擎失败不判错 |
| `pnpm test:e2e`（开发模式） | **79 条全通过**；含 `visual.spec.ts` 基准图 |
| `playwright.release.config.ts`（5 种浏览器配置） | **165 通过、5 跳过、0 失败**，6.1 分钟。CI 的 `browser-workflows` job 上限 25 分钟，安全（此前一次 20.5 分钟的运行是失败用例的 90 秒超时×重试所致，不是稳定态） |
| 基准图 | 4 张 review 页更新。**已用 DOM 实测解释**：`combined-stockfish-maia-1440` 的 60,381 像素变化来自第二张卡片 `[aria-label="Learn from your mistakes"]`（实测 y=282、高 354，落在 1440×900 视口内），其文案由单段变为标题+说明+下拉+复选+按钮；另 3 张仅 **1 像素**差异（低于 0.015 阈值，重编码噪声） |

e2e 已重写为驱动**真实棋盘点击**；旧 spec 断言的是已删除的弹窗与 UCI 输入框，留着会
"通过但与新实现无关"。

## 过程中修掉的真实缺陷

1. **`skip` 看似无效**：`skip()` 先 `markSolved()` 再 `next()`，而 `next()` 闭包里的
   `solvedPlies` 是**上一次渲染**的值，于是刚标记的位置仍被视为未解、被重新出题。
   现在由调用方显式传入更新后的列表，并在注释里说明原因。
2. **锁定可被绕过**：`navigateToPly`/`navigateLast`/自动播放最初没有锁，点一下着法列表即可
   越过出题位置、看到该步分类与引擎续着。现已在四个入口统一拦截。
3. **Maia 侧栏泄露答案**：`analysis-lens-panel.tsx` 从不检查 `retro.locked`，在 Enhanced Local
   模式下会列出该局面的人类候选，且点击即可走子。已屏蔽，并新增 e2e 断言防止回归。
4. **Study 讲解泄露答案（且不需要 Maia）**：确定性讲解的续着行以 `fenAfter` 为起点，出题时
   那就是待解局面，于是讲解**以正解开头**。已在锁定期间屏蔽整篇并加断言。
5. **"开始练习"按钮的可用性判断错误**：面板原先只看 `analysis.moves.length === 0`，但因为
   开局例外会把理论着法排除，某一方可能一个候选都没有；此时点开始会直接进入
   "已完成 0 个局面"。空状态文案也误称"双方都没错"。现按面板所选执棋方本地计算候选数。
6. **OAuth 错误的回跳仍可能指向内网**：`settingsUrl` 在 `try` 之前用请求 origin 初始化，
   于是 `lichessOrigin()` 自身抛错（origin 配置不对）时，回跳仍是 `http://web:3000` ——
   恰恰是最需要可读错误页的那条分支。现在优先使用已配置的 `APP_ORIGIN` 作为回退。

### 复核阶段又发现并修掉的十四个

7. **Maia 差异化在生产数据下根本不触发。** `maia_provider.py:367` 的 move-review 只用
   `inference.policy[:multi_pv]`（默认 5）填 `candidates`，而被走出的那一步只单独取
   probability/rank、**不进 candidates**。原来的实现却要求
   `candidates.find(c => c.uci === playedMove)`，于是真正的 blunder（Maia 排名远大于 5）
   永远返回 null —— 恰好是该功能存在的理由。现在改用必定存在的
   `playedMoveProbability/playedMoveRank`。**e2e 之前之所以"通过"，是因为 fixture 手工把
   被走的一步塞进了 candidates —— 测试固化了生产中不存在的数据形状。** 已补一条单测覆盖
   该真实形态。
8. **凭空生成的证据。** 引擎推荐着法不在 Maia top-5 时，难度标签用占位的 0 计算，得出
   "exceptional"——即"极其难找"这个谁也没评估过的结论。现在该着法未被 Maia 评估时，
   百分比与难度**一并省略**；低于 1% 的概率显示为 `<1%` 而不是误导性的 `0%`。
9. **判题搜索丢失了棋局历史。** `scoreAttempt` 未传 `startFen`/`moves`，而引擎层用它们处理
   重复局面与五十回合，导致文档声称的"with the original game history"与实际不符。已补上。
10. **"View the solution" 文案与行为不符，且 `solutionLine` 是死代码。** 原来跳到
    `faultPly`（即错误那一手之后），面板却说"更强的着法已被走出" —— 用户看到的是自己刚犯的错。
    现改为停在**错误前**的局面（待解局面，其 MultiPV #1 就是正解）并改文案；未被任何地方
    调用的 `solutionLine` 已删除。
11. **着法列表的图标与 tooltip 仍泄露答案**：文本已改为 "Hidden while solving"，但
    `<QualityIcon>` 仍渲染 blunder/mistake 图标，`title` 仍给出质量标签（甚至 "Missed win"）；
    总览的 CRITICAL MOMENTS 列表同样显示该步图标与胜率跌幅。三处一并屏蔽并加断言。
12. **百分比拼接错误**：`percentText` 已自带 `%`，模板里又写了一次，会输出 `31%%`。
13. **`natural` 的判定不成立**：写成了 `best === undefined || played > best`，于是在 Maia
    未评估引擎着法时（这恰是最常见的情况）也会宣称"你走的这步是最自然的选择"——一个没有
    依据的结论。现在必须两者都有才能真正比较，否则只陈述"你走的这步很少见"。
14. **判错后棋盘无变化，用户无法确认落子是否生效**：`attempt()` 判错即回到出题位置，棋盘
    看起来毫无反应。现在反馈文案回显所走的着法（如 "Nf3 does not keep the position"），
    并在 e2e 中断言该回显。
15. **筛选与开局例外的逻辑缺少测试**：旧弹窗 spec 里有的「执棋方选择 / 是否包含 inaccuracy
    / 空状态禁用」在新 spec 里全部丢失，而 `retro-practice.tsx` 的可用性判断（按所选执棋方
    本地计算）与开局例外正是本批新增的真实逻辑。已补两条测试，并验证过：移除开局例外的
    代码后，"theory exclusion" 那条会失败（即测试确实能抓到回归）。
16. **空状态文案不准确**：`availableCount === 0` 时一律说"No mistakes were recorded"，
    但开局例外正是让计数为 0 的原因之一 —— 那种情况**确实记了错误，只是被当作理论跳过**，
    而建议（"换个执棋方或勾选 inaccuracies"）也帮不上。现在面板能区分两种情况：确有错误但
    全在理论范围内时如实说明，只有真的没有错误时才说没有记录。
17. **人类解释的句子重复且拼接生硬**：Maia 未评估引擎着法时，同一句里出现两次
    "rank #23"（逗号 + 分号连成长句）。已缩短该分支，并把单测从 `toContain` 收紧为
    **断言 rank 只出现一次**，避免同类重复回归。
18. **【最严重】差异化在真实运行中依然不生效 —— 人类事实被写到了错误的 ply。**
    练习把棋盘停在错误**前**一步，于是 shell 的"当前着法"是错误前面那一手；但人类请求已被
    我改指向错误本身。结果是：请求拿的是错误的 Maia 数据，却用 `reviewedAnalysis.ply`
    （错误前一手）去存 —— `buildHumanAnalysis` 因 fenBefore/playedMove 不匹配抛错，被裸
    `catch` 吞掉，**面板永远拿不到解释**。这正是我上一轮"修好"之后仍存在的空壳。
    现在把**同一个目标**贯穿四处（请求、构建、存储、匹配），不再只改一处。
    这条也说明：只改"请求指向"而不改"存储指向"比不改更糟。
19. **裁决卡把一手的证据挂在另一手身上**：`CurrentMoveVerdict` 读 shell 的 `currentHuman`
    （现在是错误的），却打印棋盘那一手的 SAN。练习期间人类半边直接停用，避免张冠李戴。
20. **e2e 覆盖空缺 + CI 遗漏**：先前所有 fixture 都在 ply 1 出错（该处 Coach 面板走的是
    game-facts 分支），被我改成 "—" 的 `coach-move-facts` 分支**零覆盖** —— 那才是真实
    中局错误会遇到的分支。已补中局用例，并新增 `e2e/mistake-practice-enhanced.spec.ts`
    在 Enhanced Local 下**真实走一遍** Maia 请求 → 持久化 → 解释显示，而不是手工塞 `move.human`
    （手工塞数据正是上一轮数据形状 bug 没被抓到的原因）。该文件已加入 CI 的显式文件列表，
    否则它只会在本地跑、CI 永远不覆盖。

## 测试基建注意事项

- **`r4.spec.ts` 曾在全量开发模式运行中失败**（"Too many platform requests"），单跑通过。
  实测定位：不是并行度，也不是服务复用 —— `r4 + visual` 与 `r4 + workflows` 两两组合都通过，
  而全量运行会累加。计量后发现主导流量是首页 `connected-accounts` 每次加载都会请求
  `/api/platforms/lichess/config` 与 `/session`；未设置 `PLATFORM_CLIENT_IP_HEADER` 时
  所有客户端共用同一个桶（代码中已注明），新增的 10 条 practice 用例各加载多个页面，
  把原本已接近上限的运行推过了阈值。
  **修复是在本 spec 内 stub 这两个端点**（本 spec 从不断言平台连通性），全量随即 77 条全绿。
  未放宽 `platform-guard.ts` 的任何限制：生产设置 `x-real-ip`，那个上限是真实的产品行为。
  两点补充：`workers: 1` 与 `reuseExistingServer: false` 这两处配置改动保留（与 CI 一致、
  每次运行从干净状态开始），但**它们都不是本次失败的成因** —— 已用 `pkill` + 全新 server
  复现过同样的失败；配置注释已按实测结论改写，避免后来者沿着错误方向排查。
- 旧 spec 断言的是已删除的弹窗与 UCI 输入框，留着会"通过但与新实现无关"，
  已重写为驱动**真实棋盘点击**。

## 未做

- 持久化答题记录（备份/删除/迁移）与间隔复习；当前仍是仅本次会话。
- 触摸端手绘箭头（按用户决定不做；手机保持点击走子）。
- 开局 explorer（用户决定暂缓，待其他功能稳定后再议）。
- 未在真实 NUC、真实域名或物理手机上验收。

## 后续 UI（同日）

对照 Lichess `retroView.ts` / `retroCtrl.ts` 补了交互，而不是再写一套：

- 答对后棋子留在棋盘上（先 `playAnalysisMove` 再判定）；错了才收回。
- 看答案会走出更强的那步作为变例，而不是停在错误前的空棋盘。
- 之后可以沿着这步继续下，或点 **Next mistake** 回到练习。
- 解出前走开棋盘会显示 **You browsed away** / **Resume learning**。
- 启动面板收成一条 Lichess 式的 "Learn from your mistakes" 短条，去掉 Georgia 大标题和三段说明。
