Status: Historical
Baseline: 2026-09-11 (S5)
Superseded by: [docs/move-classification.md](../move-classification.md)
Do not use as the current product contract.

# 分类契约修复（S5）

日期：2026-09-11。范围：`packages/analysis` 的着法分类与静态交换评估（SEE）。
**没有**改动 Accuracy、WinPercent、Divider、game phases、POV 或 Human Difficulty；
`OBJECTIVE_ALGORITHM_VERSION` 保持 `objective-v2.0`（原因见文末）。

## 1. 修：平分的最佳着法被判为 Excellent

**改动前**：`isEngineBest = playedMoveRank === 1`。两条走法同分时只有一条能排在
MultiPV 第 1 位；玩家走了另一条时 `winPercentLoss = 0`，却拿不到 `best`，落到
`excellent`。

**改动后**：`isEngineBest` 同时接受"与最优同分"的走法，但**必须同时**满足两个条件：

- mover WinPercent 损失 ≤ 0.1，**且**
- centipawn 损失 ≤ 5。

centipawn 这一半是必需的。实测反例：`scoreBefore 1200cp → scoreAfter 1100cp`、
`playedMoveRank 2` 时 `winPercentLoss = 0`（胜率已饱和）但实际差 100cp；只看胜率会
把真实失误判成 `best`。这个反例现在由锁定测试守着。

实测（探针，修复后）：

| 输入 | 结果 |
| --- | --- |
| 完全同分、rank 2 | `best`，cpLoss 0，winPercentLoss 0 |
| 1200→1100cp、rank 2 | `excellent`，cpLoss 100，winPercentLoss 0 |
| rank 1 | `best`（未变） |
| 同分且不在 MultiPV 内 | `best` |

## 2. 修：SEE 把被绝对牵制的子当作合法攻击方/防守方

`chess.js` 的 `attackers()` 是纯几何的。`packages/analysis/src/sacrifice.ts` 的交换
循环直接使用它，于是**被钉住的子**也会被算进交换。后果是交换价值被高估，**可能
凭空产生牺牲证据，把普通回吃判成 Brilliant**。

**改动后**：每个候选攻击方先做一次虚拟吃子，检查是否会让己方王被攻击；被牵制的子
既不作为攻击方也不作为防守方参与交换。

**实测对照**（白 Ke1/Be2，黑 Re4 沿 e 线钉住主教）：

| 位置 | 修复前 | 修复后 |
| --- | --- | --- |
| 被钉住（Bxd3 非法） | **100**（错误地把钉住的主教算作攻击方） | **0**（正确） |
| 同局面去掉钉子车 | 100 | 100（未回归） |

## 3. 未改：`interesting` 与 `miss` 保持"声明但不可达"

调查结论与仓库既有文档、既有测试一致，因此**不接线、也不删除**：

- **`interesting` 是被有意下线的。** 锁定测试明确要求"普通接近最优的 rank-3 走法
  必须判 Good，而不是 Interesting"（`classification.test.ts`、`classification-golden.test.ts`）。
  我一度按历史语义接线，导致 4 个测试失败——那是既定契约，不是遗漏，故已回退。
- **`miss` 从未可达。** 它的历史条件是 `loss ≥ 25 && hasTacticalBestLine`，而
  `git grep hasTacticalBestLine` 显示该输入在**包括首个提交在内的任何版本里都没有
  被赋值过**；本项目也没有战术模式检测器（走法的 `motifs` 只会是 `"sacrifice"`）。
  要真正实现 `miss` 需要先做战术检测，属于新功能。
- 两个标签继续留在 `MoveClassification` 里，并在 `schema.ts` 用注释标为 reserved，
  因为 AGENTS.md 列出了它们，且 `study.ts` / `coach-facts.ts` 仍把它们当作严重标签
  使用。删除会波及 10 余个文件与视觉基准，且会让契约与规格不一致。

## 验证

2026-09-11，macOS（10 逻辑核）、Next 16.3.3：

| 检查 | 实际结果 |
| --- | --- |
| `pnpm test` | **429 项通过**（analysis 由 82 增至 85） |
| `pnpm typecheck` / `pnpm lint` | 通过（0 错误 / exit 0） |
| `NEXT_PUBLIC_APP_MODE=browser-core pnpm build` | 通过 |
| `playwright.release.config.ts` | **135 通过、5 条跳过**，5.3 分钟，5 种浏览器配置 |
| 新增回归测试 | `classification.test.ts` 2 条（同分判 best、饱和评估不得升为 best）；`sacrifice.test.ts` 1 条（被牵制的子不参与交换，含未牵制对照） |

## 关于 `OBJECTIVE_ALGORITHM_VERSION`（重要，未改）

本批**改变**了分类输出（同分走法不再被判 Excellent；SEE 更严格会减少 Brilliant
误报），但**没有**提升算法版本号，因此已存储的 `objective-v2.0` 分析会被继续视为
现行结果、不会自动重算：

- `apps/web/src/lib/analysis-cache.ts` 以该常量做缓存键与"是否现行"判定；
- `advanced-study-library.ts`、`history-analysis-jobs.ts` 用它区分 analyzed / stale。

**这是有意选择的保守取默认**：你即将在 Debian NUC 上线，且站上已有用 v2.0 分析的
棋局；提升版本号会把整个棋库标记为过期并触发重算。按仓库既往做法（`332ca90` 曾在
改动分类语义的同一提交里把 `v1-preview.3` 提到 `v2.0`），语义变化通常配套提升版本
号——如果你接受一次性重算，或想确保新旧标签不混用，把 `game-analysis.ts:26` 改成
`objective-v2.1` 即可（我已验证：需同时把 5 个测试文件里硬编码的 `"objective-v2.0"`
字面量改为导入该常量，就是当时的差异）。

**当前状态下的实际影响**：新完成的复盘采用新规则；此前已分析的棋局保留旧标签，除非
在 Engine 页手动"Re-analyze full game"。同一棋库中可能同时存在两套规则产生的标签，
UI 不会提示这一点。

## 未做

- 触摸设备的手绘箭头（需要全新手势，`react-chessboard` 无触摸绘制实现）。
- `interesting` / `miss` 的接线（前者被测试明确禁止；后者需要尚不存在的战术检测器）。
- 战术检测器、开局 explorer、账号/云同步、CSP/HSTS、错误上报。
- 未在真实 NUC、真实域名或物理手机上验收。
