你现在要帮助我设计并实现一个开源国际象棋分析平台。

项目目标不是简单复制某一个网站，而是构建：

**Chess.com Game Review + Lichess Analysis + WintrChess + Maia human analysis + AI Coach**

的综合开源版本。

请把这个任务当成一个长期维护的软件工程项目，而不是一次性的 demo。

---

# 0. 总体原则

首先不要立刻开始大规模写代码。

你的第一步必须是：

1. 调研参考仓库。
2. 阅读关键实现。
3. 总结哪些代码/算法值得复用。
4. 写 architecture/design 文档。
5. 再开始实现。

不要凭印象重新发明已有算法。

尤其是：

- Accuracy
- game phase detection
- opening recognition
- Stockfish Web Worker
- move classification
- human-like chess modeling

这些领域已经有高质量开源实现。

对于第三方仓库：

- 可以 clone 到 `references/`
- `references/` 加入 `.gitignore`
- 作为研究、比较和实现参考，如果参考的内容足够优秀，可以直接 copy 下来
- 在一个文件中记录具体参考的文件、函数与算法
- 不要因为 license discussion 阻塞当前技术研发，简单提及来源即可

---

# 1. 首先调研以下仓库

使用：

```bash
gh repo clone OWNER/REPO references/NAME -- --depth=1
```

优先研究：

### A. cooperbuilds/chess-game-analyzer

这是当前项目最重要的基础参考。

重点阅读：

```text
engine/
lib/analysis/
lib/analysis/classify.ts
lib/analysis/accuracy.ts
lib/analysis/runAnalysis.ts
lib/data/openings.json
components/board/
components/analysis/
types/analysis.ts
```

重点理解：

- Stockfish 18 WASM
- Web Worker
- worker pool
- MultiPV
- PGN parsing
- classification pipeline
- Brilliant / Great / Best / Excellent / Good
- Inaccuracy / Mistake / Blunder
- Miss / Missed Win / Missed Mate
- opening detection
- endgame detection
- charts
- JSON / PGN / PDF export

注意：

这个项目当前 move classification 已经拥有明确规则。

但是不要把它当作 Chess.com 官方算法。

特别检查当前 `classify.ts` 中类似：

```text
brilliantCpLoss
greatCpLoss
onlyMoveGap
excellentCpLoss
interestingCpLoss
goodCpLoss
inaccuracyCpLoss
mistakeCpLoss
missedWinChanceBefore
missedWinDrop
missDrop
```

理解它们为什么这样设计。

同时指出现有 Brilliant sacrifice detection 的不足。

---

### B. WintrCat/wintrchess

重点不是简单复制。

研究：

- Game Review 页面布局
- 棋盘与分析 panel 的比例
- evaluation bar
- move list
- classification badge
- classification icon
- move destination square 上的 quality indicator
- analysis workflow
- UX

将它作为视觉交互参考。

---

### C. lichess-org/lila

重点研究：

```text
modules/analyse/src/main/AccuracyPercent.scala
```

必须真正读懂并移植：

```text
fromWinPercents()
gameAccuracy()
phaseAccuracies()
```

不要只复制网上的简化 accuracy formula。

重点理解：

```text
weighted mean
harmonic mean
volatility weighting
window size
```

为什么存在。

---

### D. lichess-org/scalachess

重点：

```text
core/src/main/scala/Divider.scala
core/src/main/scala/eval.scala
```

必须研究：

```text
Division
Divider
WinPercent
winningChances
```

Phase detection 使用 Lichess 当前逻辑，而不是：

```text
move 1-10 = opening
move 11-30 = middlegame
```

特别研究：

```text
majorsAndMinors()
backrankSparse()
mixedness()
```

以及 Lichess 当前：

```text
middlegame detection

majorsAndMinors <= 10
OR
backrankSparse
OR
mixedness > threshold
```

和：

```text
endgame

majorsAndMinors <= 6
```

把行为 port 到 TypeScript，并建立测试。

---

### E. lichess-org/chess-openings

这个 repository 用于：

```text
ECO
opening name
variation
PGN
UCI
EPD
```

注意：

它不是 Opening/Middlegame/Endgame phase detector。

它负责：

**Opening Recognition / Book Recognition**

而 `scalachess Divider` 才负责：

**Game Phase Detection**

研究官方建议的：

```text
play backwards until a named position is found
```

以正确处理 transposition。

不要只比较 move string prefix。

---

### F. official-stockfish/Stockfish

Stockfish 是整个系统的：

**objective truth engine**

用于：

- evaluation
- best move
- MultiPV
- forced mate
- candidate moves
- PV
- tactical truth
- objective move classification

Web 版本优先使用 Stockfish WASM。

增强本地模式未来可以支持 native Stockfish。

---

### G. CSSLab/maia3

不要优先实现旧 Maia 1。

对新项目首先研究 Maia-3。

重点理解：

```text
Maia3 5M
Maia3 23M
Maia3 79M

Elo
SelfElo
OppoElo
MultiPV
Temperature
TopP
human WDL
human move probability
```

Maia 的角色不是判断棋到底走得对不对。

Maia 的角色是：

**判断一个对应 Elo 的人类更可能怎么想、怎么走。**

我们最终需要类似：

```text
Stockfish:

Nf6!     +1.80

Maia-3 @ 1400:

Nf6       7%
Re8      34%
Qc7      18%
...
```

进而生成：

```text
Objective Best Move
Human Natural Move
Human Difficulty
```

三个不同概念。

---

### H. CSSLab/maia-platform-frontend

研究 Maia 官方平台如何展示：

```text
human analysis
Stockfish / Maia dual analysis
rating-aware analysis
```

作为 UI/UX 与数据组织参考。

---

### I. LeelaChessZero/lc0

Lc0 作为未来 optional engine。

不要把 Lc0 当成人类模拟器。

定义为：

```text
Stockfish
= objective tactical/overall engine

Lc0
= optional neural strategic second opinion

Maia-3
= human behavior model
```

MVP 不要求集成 Lc0。

但 architecture 必须允许未来加入任意 UCI engine。

---

### K. dev-arcturus/positional_chess

重点研究：

```text
QualityIcon
move classifier
motif detection
SEE-based sacrifice detection
complexity detection
Brilliant detection
Great detection
```

尤其参考它对：

```text
real sacrifice
obvious recapture
only move
complexity
```

的处理。

我们希望 Brilliant detection 最终优于 cooperbuilds 的简单 hanging-piece heuristic。

---

### L. imutkarsht/Chess_analyzer

重点参考：

```text
move classification SVG icons
board overlay
AI coach
opening explorer
analysis statistics
```

重点研究 classification icon system 的视觉语言。

不要复制 Chess.com trademark assets。

我们最终设计自己的 SVG icon set。

---

### M. SikamikanikoBG/patzer 和 SailingSF/chesslens-core

重点研究：

**LLM 不负责计算棋局事实，只负责解释结构化事实**

这个 architecture。

---

# 2. 项目的核心分析哲学

必须坚持三层模型：

```text
                     POSITION
                        │
            ┌───────────┴───────────┐
            │                       │
       STOCKFISH                 MAIA-3
            │                       │
 objective strength           human behavior
            │                       │
 best move                   likely move
 centipawn                   move probability
 mate                        Elo-conditioned
 MultiPV                     human WDL
 tactical truth              human naturalness
            │                       │
            └───────────┬───────────┘
                        │
                STRUCTURED FACTS
                        │
                        ▼
                    LLM COACH
                        │
                        ▼
                 Human explanation
```

LLM 永远不能成为 chess truth source。

---

# 3. Technology Stack

建立 pnpm monorepo。

推荐：

```text
/
├── apps/
│   └── web/
│
├── packages/
│   ├── chess-core/
│   ├── analysis/
│   ├── stockfish/
│   ├── openings/
│   ├── ui/
│   └── shared/
│
├── services/
│   └── local-ai/
│
├── docs/
├── references/
└── tests/
```

Web：

```text
Next.js
React
TypeScript
Tailwind CSS
Zustand
Recharts
chess.js
```

棋盘第一版优先沿用 cooper 项目的：

```text
react-chessboard
```

因为这样可以快速保留已有 Game Review 功能。

但把 board abstraction 做好，以后允许迁移：

```text
Chessground
```

不要让 analysis core 依赖具体 board library。

---

# 4. 两种运行模式

必须从 architecture 层就支持两种模式。

## Core Browser Mode

无需 backend：

```text
PGN
FEN
Chess.com game
Lichess game

Stockfish WASM
Opening recognition
Game phase detection
Accuracy
Move classification
Evaluation chart
Review
```

所有核心分析在浏览器完成。

---

## Enhanced Local Mode

增加：

```text
Python service
Maia-3
Ollama
optional native Stockfish
optional Lc0
```

建议：

```text
services/local-ai

Python
FastAPI
Pydantic
python-chess
maia3
```

API：

```text
GET  /health

POST /maia/analyze
POST /maia/moves

POST /coach/explain
POST /coach/game-summary
```

---

# 5. Stockfish Engine Architecture

Stockfish 是 objective ground truth。

支持：

```text
depth configurable

10
15
18
20
22
```

以及：

```text
MultiPV configurable

1-5
```

Game Review 默认：

```text
MultiPV = 3
```

至少需要知道：

```text
top1
top2
top3
```

因为：

- Great
- only move
- candidate comparison
- AI explanation

都依赖候选差异。

使用：

```text
Web Worker
Worker Pool
LRU cache
```

缓存 key 至少包含：

```text
FEN
depth
MultiPV
engine version
```

---

# 6. Evaluation Normalization

建立唯一数据表示。

每一个 engine result 都必须明确：

```text
perspective
cp
mate
wdl
depth
nodes
pv
```

不要在不同模块里随意正负翻转。

内部原则：

```text
raw Stockfish score
→ normalize to White POV

display layer
→ convert to requested POV
```

Mate 不要粗暴当成普通 cp。

建立：

```ts
type EngineScore =
  | {
      kind: "cp";
      cp: number;
    }
  | {
      kind: "mate";
      mateIn: number;
    };
```

---

# 7. Lichess WinPercent

行为级 port 当前：

```text
scalachess/eval.scala
WinPercent
```

包括：

```text
CP ceiling
initial CP
winningChances()
fromCentiPawns()
fromMate()
```

不要使用多个不同 logistic function。

整个项目只有一个 canonical：

```text
engine score
→ WinPercent
```

实现。

---

# 8. Accuracy

这里不要沿用 cooperbuilds 当前简单平均作为最终算法。

直接 port Lichess：

```text
AccuracyPercent.fromWinPercents
AccuracyPercent.gameAccuracy
AccuracyPercent.phaseAccuracies
```

需要：

```ts
moveAccuracy()
gameAccuracy()
phaseAccuracies()
```

注意 Lichess gameAccuracy 包含：

```text
volatility-based window
weighted mean
harmonic mean
```

最终：

```text
gameAccuracy =
(weightedMean + harmonicMean) / 2
```

必须写单元测试。

尽量读取 Lichess 对应 test fixtures，并制作 TypeScript regression tests。

最终页面需要同时展示：

```text
Overall Accuracy

Opening Accuracy
Middlegame Accuracy
Endgame Accuracy
```

White / Black 分开。

---

# 9. Game Phase

TypeScript port：

```text
scalachess Divider.scala
```

定义：

```ts
interface GameDivision {
  middlePly?: number;
  endPly?: number;
  totalPlies: number;
}
```

每一步：

```ts
phase:
  | "opening"
  | "middlegame"
  | "endgame"
```

不要通过固定回合数判断。

除此以外额外提供：

```text
Opening Theory Boundary
```

这个来自：

```text
lichess chess-openings
```

注意：

```text
Game Phase Opening
```

和：

```text
Still in Opening Book
```

不是同一个概念。

UI 可以同时显示：

```text
Opening phase ended: move 12
Known theory ended: move 9
```

---

# 10. Opening Recognition

把 `lichess-org/chess-openings` 数据转换为适合前端加载的数据。

建议 build-time script：

```text
TSV
 ↓
normalize
 ↓
EPD hash / position lookup
 ↓
compact JSON
```

识别结果：

```ts
interface OpeningInfo {
  eco: string;
  name: string;
  variation?: string;
  matchedPly: number;
  theoryUntilPly: number;
}
```

必须正确支持 transposition。

---

# 11. Move Classification

保留以下 taxonomy：

```text
brilliant
great
best
excellent
good
book
interesting
forced

inaccuracy
mistake
blunder
miss

missed_win
missed_mate
```

建立：

```ts
MoveClassification
ClassificationReason
```

不能只返回：

```text
"brilliant"
```

必须同时返回为什么。

例如：

```json
{
  "classification": "great",
  "reason": {
    "isEngineBest": true,
    "cpLoss": 2,
    "secondBestGapCp": 187,
    "onlyMove": true
  }
}
```

---

# 12. Brilliant Detection 改进

不要仅使用：

```text
moved piece is hanging
```

来判断 sacrifice。

设计更完整的 sacrifice detector。

至少考虑：

```text
material before
material immediately after
SEE
opponent best response
material after PV
compensation
evaluation
forced recapture
obvious recapture
position already won
```

Brilliant 候选必须满足：

```text
objective top move
+
very low eval loss
+
genuine sacrifice or exceptional tactical resource
+
not trivial recapture
+
position not already completely decided
```

建立：

```ts
interface SacrificeEvidence {
  sacrificedMaterial: number;
  see: number;
  compensationCp: number;
  survivesBestResponse: boolean;
  recoveredWithinPv: number;
}
```

Brilliant classification 必须可解释。

---

# 13. Great Detection

Great 的核心思想：

```text
critical only move
```

使用 MultiPV。

例如：

```text
#1 +2.7
#2 +0.2
#3 -0.4
```

如果 played move = #1：

这是 Great 候选。

但排除：

```text
only legal move
obvious recapture
automatic forced response
trivial check escape
```

---

# 14. Maia-3 Human Analysis

建立独立：

```text
HumanAnalysis
```

不要修改 Stockfish objective classification。

数据结构：

```ts
interface HumanMoveCandidate {
  uci: string;
  san: string;
  probability: number;
}

interface HumanAnalysis {
  targetElo: number;
  selfElo: number;
  opponentElo: number;

  candidates: HumanMoveCandidate[];

  playedMoveProbability: number;

  expectedHumanMove?: string;

  humanWdl?: {
    win: number;
    draw: number;
    loss: number;
  };
}
```

用户可以选择：

```text
800
1000
1200
1400
1600
1800
2000
2200
2400
2600
```

或者输入自定义 Elo。

---

# 15. Human Difficulty

这是项目非常重要的新 feature。

定义独立指标：

```text
Find Difficulty
```

不要和 Best / Brilliant 混在一起。

例如：

```text
Stockfish Best
but
Maia probability @1400 = 2%
```

那么：

```text
Objective Quality:
Best

Human Difficulty:
Very Hard
```

可以设计：

```text
Natural
Findable
Hard
Very Hard
Exceptional
```

指标考虑：

```text
Maia move probability
Stockfish second-best gap
legal move count
forcing move
tactical complexity
move type
```

不要第一版就宣称这是科学 Elo 指标。

明确标注为：

```text
Human Find Difficulty
```

---

# 16. AI Coach

首先支持：

```text
Ollama
```

默认模型：

```text
gemma4:12b-it-qat
```

连接：

```text
http://127.0.0.1:11434
```

同时设计 Provider interface：

```text
OllamaProvider
OpenAICompatibleProvider
```

以后可以加入其他 API。

---

# 17. LLM 输入

绝对禁止只发送 FEN 然后：

```text
Analyze this chess position.
```

LLM 输入必须是 structured facts。

例如：

```json
{
  "position": {
    "fenBefore": "...",
    "fenAfter": "...",
    "phase": "middlegame"
  },

  "move": {
    "san": "Rxf7",
    "uci": "f1f7",
    "classification": "brilliant"
  },

  "objective": {
    "evalBefore": 0.42,
    "evalAfter": 2.81,
    "bestMove": "Rxf7",
    "multiPv": [],
    "mate": null
  },

  "human": {
    "targetElo": 1400,
    "playedProbability": 0.037,
    "topHumanMoves": []
  },

  "boardFacts": {
    "materialBefore": {},
    "materialAfter": {},
    "checks": [],
    "captures": [],
    "hangingPieces": [],
    "motifs": []
  },

  "opening": {},
  "phaseAccuracy": {}
}
```

LLM 只允许解释这些事实。

---

# 18. Coach Response

要求模型输出 structured JSON：

```ts
interface CoachExplanation {
  headline: string;
  summary: string;

  whyMoveWorks?: string;

  whatWentWrong?: string;

  betterPlan?: string;

  humanPerspective?: string;

  tacticalIdea?: string;

  trainingTip?: string;

  confidence: "high" | "medium" | "low";
}
```

服务器验证 JSON。

任何 LLM 提到的具体 move：

```text
SAN
UCI
```

必须通过 chess.js 验证合法性后才能展示。

如果验证失败：

不要展示该具体变化。

---

# 20. Input Formats

最终至少支持：

```text
Paste PGN
Upload .pgn
FEN
Chess.com URL
Chess.com username

Lichess URL
Lichess username
```

输入层统一转换成：

```ts
NormalizedGame
```

或者：

```ts
NormalizedPosition
```

---

# 21. Export Formats

支持：

```text
Annotated PGN
JSON
PNG
```

以后：

```text
PDF
```

PNG 至少两类：

```text
Position Card
Game Review Card
```

例如：

```text
Rxf7!!

BRILLIANT

Stockfish +2.81
Human find rate @1400: 3.7%

White Accuracy 93.6
Black Accuracy 87.1
```

---

# 22. Canonical Data Model

不要让 UI 自己拼分析数据。

建立版本化：

```ts
interface GameAnalysisV1 {
  version: 1;

  game: GameMetadata;

  engine: {
    stockfishVersion: string;
    depth: number;
    multiPv: number;
  };

  opening?: OpeningInfo;

  division: GameDivision;

  white: PlayerAnalysis;
  black: PlayerAnalysis;

  moves: MoveAnalysis[];

  criticalMoments: CriticalMoment[];

  createdAt: string;
}
```

Move：

```ts
interface MoveAnalysis {
  ply: number;

  color: "white" | "black";

  san: string;
  uci: string;

  fenBefore: string;
  fenAfter: string;

  phase:
    | "opening"
    | "middlegame"
    | "endgame";

  classification: MoveClassification;

  classificationReason: ClassificationReason;

  stockfish: StockfishMoveAnalysis;

  accuracy: number;

  human?: HumanAnalysis;

  motifs: TacticalMotif[];

  coach?: CoachExplanation;
}
```

所有 export / UI / cache 都围绕 canonical schema。

---

# 23. UI

Desktop Game Review 页面参考：

```text
┌─────────────────────────────────────────────────────┐
│ Header                                              │
├──────────────────────────┬──────────────────────────┤
│                          │ Player / Review          │
│ Eval                     │                          │
│ │                        │ White       Black        │
│ │      Chess Board       │ 93.2        87.4         │
│ │                        │                          │
│ │                        │ Opening  96.2 / 91.4     │
│ │                        │ Middle   87.3 / 79.8     │
│ │                        │ Endgame  94.5 / 92.1     │
│                          │                          │
│                          │ Move classifications     │
├──────────────────────────┼──────────────────────────┤
│ Move navigation          │ AI Coach                 │
└──────────────────────────┴──────────────────────────┘
```

允许：

```text
Overview
Moves
Coach
Engine
Human
```

tabs。

---

# 24. Move Quality Icon

建立自己的 SVG system：

```text
brilliant
great
best
excellent
good
book
forced
interesting
inaccuracy
mistake
blunder
miss
missed_win
missed_mate
```

同时用于：

```text
move list
board overlay
charts
game summary
PNG export
```

棋盘上：

classification icon 放在：

**刚走棋 destination square 的右上角。**

它必须正确处理：

```text
white orientation
black orientation
board resize
mobile
animation
```

不要把坐标写死成 pixels。

应根据：

```text
square size
board orientation
destination square
```

计算 overlay。

---

# 25. Evaluation Graph

Graph 至少支持：

```text
Stockfish evaluation
phase boundaries
critical moments
classification markers
```

在 graph 上显示：

```text
Opening
│
│ Middlegame
│            │
│            │ Endgame
```

用户点击 graph point：

棋盘同步跳到对应 move。

---

# 26. Game Review Summary

最终 Summary 页面：

```text
White                    Black

93.4 Accuracy             87.1 Accuracy

Opening
96.2                      92.8

Middlegame
88.6                      79.3

Endgame
97.1                      93.6
```

然后：

```text
Brilliant
Great
Best
Excellent
Good
Book
Inaccuracy
Mistake
Blunder
```

counts。

另外：

```text
Opening
Sicilian Defense
Najdorf Variation
B90
```

---

# 27. AI Coach UI

点击一步，例如：

```text
24. Rxf7!!
```

显示：

```text
BRILLIANT

Objective
Stockfish: +0.4 → +2.8

Human perspective
Only ~4% of 1400-rated Maia moves choose Rxf7.

Why it works
...

Natural alternative
Re8

Why humans prefer it
...

Best continuation
24.Rxf7 ...
```

必须区分：

```text
Objective
Human
Coach
```

三个区域。

---

# 28. Storage

Browser mode：

```text
IndexedDB
```

保存：

```text
analysis cache
game history
favorite games
settings
AI explanations
```

不要把完整分析长期只放 localStorage。

Zustand 负责 runtime state。

IndexedDB 负责持久数据。

---

# 29. Performance

分析一盘 40-60 move 的棋时：

不要：

```text
Stockfish
Maia
Gemma
```

同时抢资源。

建立任务队列。

优先顺序：

```text
1. Parse
2. Stockfish
3. classification + accuracy
4. render usable review
5. Maia enrichment
6. LLM explanation on demand
```

AI Coach 默认：

```text
lazy
```

只有用户：

```text
点击某一步
或
点击 Generate Game Review
```

才生成。

不要每一步自动跑 Gemma。

---

# 30. Testing

TypeScript：

```text
Vitest
```

UI：

```text
Playwright
```

Python：

```text
pytest
```

重点 regression tests：

```text
PGN parsing
score POV
mate normalization
WinPercent
moveAccuracy
gameAccuracy
phaseAccuracies
Divider
opening transposition
classification thresholds
Brilliant detection
Great detection
FEN import
```

---

# 31. Accuracy Compatibility Tests

从 Lichess 当前实现建立 fixtures。

目标：

相同 centipawn sequence：

```text
Scala/Lichess
```

和：

```text
our TypeScript implementation
```

结果误差必须小于合理浮点误差。

不要只是“看起来差不多”。

---

# 32. Phase Compatibility Tests

使用多个真实 PGN：

```text
closed opening
open tactical game
early queen trade
long opening theory
rook ending
pawn ending
```

确认 Divider 不会简单依赖 move number。

测试：

```text
middlePly
endPly
```

是否稳定。

---

# 33. Classification Explainability

每一个 classification 都必须能回答：

> Why?

例如 Brilliant：

```text
Best engine move
Sacrifices rook
SEE negative
Evaluation improves
Opponent best reply does not refute sacrifice
Position was not already trivially won
```

Great：

```text
Best engine move
Second-best move loses 2.1 evaluation
Non-trivial choice
Not only legal move
```

Mistake：

```text
Win probability:
64% → 37%
```

UI 可以把这些放到：

```text
Why this label?
```

展开面板。

---

# 34. 不要伪造 Estimated Elo

如果实现：

```text
Estimated Performance
```

必须明确：

```text
experimental
heuristic
not FIDE Elo
not Chess.com rating
```

第一阶段甚至可以不做。

Human Elo 应优先用于 Maia：

```text
What players around this Elo are likely to play
```

这比通过一盘棋 accuracy 猜 Elo 更可靠且更有意义。

---

# 35. 第一轮要生成的文档

在编码前创建：

```text
docs/research.md

docs/architecture.md

docs/analysis-spec.md

docs/accuracy.md

docs/game-phases.md

docs/move-classification.md

docs/human-analysis.md

docs/ai-coach.md

docs/data-model.md

docs/ui-spec.md

docs/roadmap.md

docs/third-party-notes.md
```

并创建：

```text
AGENTS.md
```

AGENTS.md 必须告诉未来 coding agent：

- objective chess facts come from engines/core
- LLM cannot invent chess facts
- Accuracy follows our documented Lichess port
- phase detection follows Divider port
- analysis core must remain UI-independent
- engine scores have one canonical POV
- every classification requires machine-readable reason
- do not silently change algorithm constants
- algorithm changes require regression tests

---

# 36. Research Document 要求

`docs/research.md` 不要只是 repository 列表。

对于每个参考项目写：

```text
Repository

Relevant files

What it already solves

What we should reuse

What we should NOT reuse

Algorithm weaknesses

Integration proposal
```

尤其比较：

```text
cooperbuilds/chess-game-analyzer
WintrChess
Lichess
Maia-3
positional_chess
Chess_analyzer
Patzer
ChessLens
```

---

# 37. Implementation Roadmap

按阶段实施。

## Phase 0

建立 baseline。

确保：

```text
PGN
FEN
Stockfish
Board
Move navigation
```

正常。

---

## Phase 1

完成 objective analysis：

```text
Stockfish
MultiPV
Move classification
Lichess Accuracy
Lichess Divider
Phase Accuracy
Opening recognition
Evaluation graph
```

这是第一个真正可用版本。

---

## Phase 2

完成高级 Game Review UI：

```text
classification icons
destination-square badge
summary
critical moments
phase summary
PNG export
```

---

## Phase 3

加入 Maia-3：

```text
human candidate moves
rating selection
human move probability
find difficulty
Stockfish vs Maia comparison
```

---

## Phase 4

加入 AI Coach：

```text
Gemma 4 via Ollama
structured context
move explanation
game summary
training advice
```

---

## Phase 5

产品 UX 和导航：

```text
Home / Import
persisted review IDs
route-based Review / Moves / Human / Coach
advanced Engine Lab
History / Settings
viewport-oriented desktop workspace
managed local development startup
```

---

## Phase 6

Tauri 2 桌面应用：

```text
separate Vite + React + Tauri shell
macOS / Windows / Linux
managed local-ai sidecar
Ollama discovery and owned startup
explicit model download approval
native PGN file open
```

---

## Phase 7

高级功能：

```text
multi-game analysis
player trends
opening repertoire
weakness detection
training recommendations
optional Lc0
```

---

## Phase 8

探索移动端 companion，评估 Tauri Mobile 和 React Native，不在桌面阶段引入 Flutter。

---

# 38. Git 工作方式

不要一个 giant commit 完成全部项目。

每个阶段保持：

```text
working state
tests
documentation
```

如果当前目录已经是 Git repository：

每完成一个有意义的独立模块，建议形成逻辑清晰的 commit。

不要为了 commit 而 commit。

---

# 39. 第一阶段现在应该怎么开始


Before substantial implementation, create the repository's persistent
Codex guidance files.

Required files:

1. /AGENTS.md

   Project-wide durable engineering rules.

   It must define:
   - project architecture
   - Stockfish / Maia / LLM responsibilities
   - canonical engine-score POV
   - Lichess-compatible Accuracy requirements
   - Divider-based phase detection
   - opening-theory versus game-phase distinction
   - explainable move classification
   - Brilliant / Great requirements
   - PGN/FEN import boundaries
   - Browser Mode versus Enhanced Local Mode
   - testing and documentation expectations
   - reference repository policy

2. /packages/analysis/AGENTS.md

   Stricter rules for product-critical chess-analysis code.

   Changes to:
   - WinPercent
   - Accuracy
   - Divider
   - classification
   - Brilliant
   - Great
   - score normalization

   must require deterministic regression tests and documentation.

3. /services/local-ai/AGENTS.md

   Define strict boundaries for:
   - Maia-3
   - Ollama
   - LLM coaching

   Explicitly state that:
   - Maia models human behavior, not objective truth
   - LLMs explain structured facts and do not create canonical chess facts

4. /.agents/skills/chess-analysis-change/SKILL.md

   Create a repository-local Codex skill for implementing, reviewing,
   debugging, or modifying chess-analysis semantics.

   The skill must contain YAML frontmatter:

```yaml
   ---
   name: chess-analysis-change
   description: ...
   ---
```

   It should trigger for tasks involving:
   - Stockfish evaluation
   - Accuracy
   - WinPercent
   - Divider
   - phase Accuracy
   - move classification
   - Brilliant
   - Great
   - MultiPV
   - sacrifice detection
   - critical moments
   - analysis regression testing

   It should NOT trigger for purely visual UI changes.

Use the current Codex repository skill location:

.agents/skills/<skill-name>/SKILL.md

Do not use the older .codex/skills project layout.

Keep AGENTS.md files focused on durable rules.
Keep SKILL.md focused on a repeatable workflow.
Do not duplicate the entire project specification into both.

执行：

```text
1. inspect current repository
2. clone references
3. study key files
4. write docs/research.md
5. write docs/architecture.md
6. write docs/analysis-spec.md
7. write docs/data-model.md
8. write docs/roadmap.md
9. create AGENTS.md
10. report findings
```

完成研究后再开始 implementation。

但是不要只是给我建议后停止。

在研究结论足够明确之后，继续完成：

```text
Phase 0
+
Phase 1 architecture skeleton
```

确保项目能够实际运行。

---

# 40. 最终目标

项目最终不应该只是：

> Stockfish says this move is -2.3.

而应该能够回答：

```text
你走了什么？

客观来说好不好？

为什么？

这一步属于 Brilliant / Great / Best / Mistake 的原因是什么？

一个与你水平接近的人类通常会考虑什么？

这个最佳着对于人类到底有多难发现？

你错过了什么战术或战略思想？

这一盘你的开局、中盘、残局分别表现如何？

下一步真正应该训练什么？
```

我们的目标是：

**Objective Chess Analysis + Human Chess Analysis + Explainable AI Coaching**

而不是一个简单 engine frontend。

开始工作。
