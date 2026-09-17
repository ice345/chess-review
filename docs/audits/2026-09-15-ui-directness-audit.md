# UI 直接性审计：为什么我们不如 Chess.com / Lichess / WintrChess 一眼可读

日期：2026-09-15  
范围：Web 布局、信息架构、首屏任务。不改 Accuracy / 分类 / 阶段算法。  
对照：本机 `http://localhost:3000`（Opera Game 示例）、[WintrChess Analysis](https://wintrchess.com/analysis)、[Lichess Analysis](https://lichess.org/analysis)。Chess.com Game Review 未登录，不宣称测到付费复盘的端到端。  
方法：browser-use 连本机 Chrome，实测 1440×900、1280×720、390×844；对照页同尺寸截图。Chrome DevTools MCP 本轮未接入。

---

## 1. 结论

**产品不丑在配色或棋子，丑在“杂志排版了一整套棋工具”。**

Windowlight 纸色、青瓷棋盘、Feather Porcelain 棋子已经比 WintrChess 默认棕格 + 黑白 Unicode 更有识别度。Lichess / WintrChess / Chess.com 给人“直接”的原因不是更花，而是：

1. **棋盘是唯一主角。** 剩下的空间只服务当前这一手。
2. **同一时刻只有一个主动作。** 导入、复盘、练习、引擎不会同时抢一个主按钮。
3. **功能按需出现。** 报告、练习、教练、开局库是状态，不是永远摊开的卡片墙。

本产品当前是相反策略：每个功能都想证明自己存在，所以首屏像控制台。功能确实比 WintrChess 多；多出来的能力没有被收进更少的表面。

**不要换主题。** 下一轮只做三件事：合并顶栏、让 Review 每一屏只问一个问题、把棋盘吃满去掉双顶栏之后剩下的视口。

---

## 2. 实测数字（Opera Game 复盘，起始局面）

| 指标 | 本产品 | WintrChess `/analysis` | Lichess `/analysis` |
| --- | --- | --- | --- |
| 顶栏层数 | 2（应用头 + 复盘头） | 1 | 1 |
| 1440×900 顶栏高度 | **101px** | 单层站点头 | ~65px 站点头 |
| 1440×900 棋盘 | **540×540**，距顶 157px | 左栏几乎满高 | **698×698**，距顶 65px |
| 1280×720 棋盘 | **424×424**（`100dvh - 296px`） | 棋盘仍是左栏主体 | 棋盘吃满剩余高度 |
| 右侧栏滚动 | 1440：**1882 / 773**（2.4×） | 一卡，基本不滚 | 空着，等棋步 |
| 视口内可点控件 | Review **50** | 分析页 **~22**（含 Discord 条） | 全站导航多，分析列几乎空 |
| 首屏主按钮 | 至少 3 个同时在抢 | 1 个：Analyse | 0 个：直接走子 |
| 390×844 文档高 | Review **2818px**（~3.3 屏） | 单屏分析台 | 单屏分析台 |
| Settings 入口 | 应用头 + 复盘头各一 | 一颗齿轮 | 一颗齿轮 |

1280×720 是常见笔记本。这一档我们的棋盘只有 424px，右侧还要滚将近 3 倍高度，页本身也溢出（`scrollHeight 789 > 720`）。这就是“臃肿、不直接”的几何原因。

---

## 3. 对照：他们到底直接在哪

### 3.1 WintrChess

空状态几乎只有两件事：一块能走的棋盘，一张 **Game Analysis** 卡（来源 + Analyse）。

分析开始后，同一张卡变成 `Report | Analysis`：进度、评估图、双方 Accuracy、分类计数。图标工具（返回 / 翻转 / 设置 / 分享）是一行，不是第二套顶栏。

它功能更少。这正是它看起来更专业的原因：它没有在第一秒解释自己的架构。

### 3.2 Lichess

分析页是仪器。棋盘从顶栏底下开始，边长接近剩余视口。右侧默认是空白引擎列 + 一行走子键。FEN/PGN 在棋盘**下面**，不和棋盘抢第一眼。

全站导航很多，但分析工作区内部很空。空，在棋类 UI 里是高级信号。

### 3.3 Chess.com（未登录，按公开产品形态）

Game Review 的记忆点是：大棋盘 + 着法列表着色 + **当前这手一句判词** + 偶发的“再试一次”。报告、教练、开局探索不是同一张首屏海报。

我们不该复制他们的付费漏斗。该学的是“当前这手”独占注意力。

---

## 4. 本产品：首屏在同时说什么

`ObjectiveRoutePanel` 在起始局面一次渲染：

1. “Start with a key moment” + Review + Study  
2. 关键时刻导航（上一个 / 下一个 / 提前结束）  
3. 练习启动器（White / Black / Filters + **深色主按钮**）  
4. 附近 5 手列表  
5. Stockfish / Maia / Compare + 候选变例  
6. 再往下：整局摘要、Accuracy 表、评估图  

实测 1440 首屏里，视觉最重的按钮是 **Review White's 1 position**，即使当前并没有在看白方错着。正在讲的是 10. Nxb5 Brilliant，主按钮却在拉去练另一件事。

同一屏还有：

- 应用导航 History / Training / Settings  
- 复盘导航 Review / Moves / Study / More / Export / Settings（Settings 出现两次）  
- 棋盘上四颗圆钮：声音、棋盘设置、专注、翻转  
- 走子条 + 永远展开的 SAN/UCI 输入  

这不是“功能多所以看起来多”。这是没有主次。

Study 页反而更接近对的形态：一块主按钮、一块棋盘。说明问题出在 Review 的组合，不是整套视觉系统坏了。

---

## 5. 根因（按影响排序）

### U1. 双顶栏，棋盘被压到笔记本不可用

`ReviewShell` 先渲染 `AppHeader compact`，再渲染 `.review-titlebar`。CSS 用 `100dvh - 296px` 给棋盘留出走子条、双方条、SAN 输入和两层头。1280×720 只剩 424px。

Lichess 把这 100px 顶栏预算给了棋盘。

### U2. Review 没有模式，只有堆叠

U01（`docs/design/2026-09-15-review-desk-and-withheld-answers.md`）把**阅读顺序**改对了，但没有做**互斥**。引导、练习、附近着法、引擎、摘要仍然同时在 DOM 里。结果是“正确的顺序 + 仍然太长”。

WintrChess 用 `Report | Analysis` 互斥。Lichess 用空列。Chess.com 用当前手判词。我们用垂直论文。

### U3. 主按钮语义被练习入口抢走

`.primary` 用在练习启动器上，而关键时刻的 “Next key moment” 只是描边按钮。“Start with a key moment” 又是第三套入口。三种学习动作，三种视觉权重，没有一个像 WintrChess 的 Analyse 那样独占。

### U4. 首页是落地页，不是分析台

桌面首页左半是 **inert 装饰棋盘**（`aria-hidden`，不能走子），右半是表单。WintrChess / Lichess 的棋盘就是工作面：粘贴或走子，立刻开始。

手机首页把表单放前面是对的，但 PGN/FEN 页、文件、粘贴、示例、身份、最近复盘仍然是长文档（390 宽 **2068px**）。

### U5. Training 是仪表盘，不是今天的一题

导入一盘 Opera Game 后，Training 把黑方名字当成“你”，展开 Rating / Openings / Middlegame / Endgame / Mistakes / Highlights / Plan / Coverage。n=1 时这是空统计墙。“Nothing to train yet” 已经说了没任务，下面仍是完整画像。

### U6. 编辑气质过重，仪器气质不足

uppercase kicker（NEW REVIEW、CONNECTED GAMES、GAME SUMMARY、THE WHOLE GAME）、Georgia 标题、解释性复句，适合品牌页，不适合复盘台。棋手在复盘时要的是：这手是什么、下一步按哪个。

SAN 输入是正当的无障碍通道（`MoveEntry` 注释写得很清楚），但不该在鼠标用户的棋盘柱里永远占一行。Lichess 把键盘走子收在快捷键里。

### U7. 长名字与装饰圆钮

`Duke of Brunswick and Count Isouard` 在双方条里截断；四颗 44px 圆钮排成工具栏，像第二套应用头。WintrChess 三个图标。Lichess 把翻转等收进菜单。

---

## 6. 不要做的事

- 不要换 Windowlight，不要换 Feather Porcelain，不要上暗色主题当“更像 WintrChess”。暗色不是直接性。  
- 不要把 Maia / Coach / 证据收成一句营销口号。分离真相源是产品优势；要藏的是**表面**，不是**能力**。  
- 不要再为每个功能加一张纸卡片。卡片越多，棋盘越小。  
- 不要把 Lichess 的全站导航、聊天、观战列搬过来。我们不是对弈平台。  
- 不要在修布局时改分类、Accuracy、阶段。

---

## 7. 建议改成什么样（目标画面）

### 复盘（桌面）

```
[ 标记  对局标题                    Review  Moves  Study     ⋯ ]
[ 黑方名                                          翻转 ]
[ ██ 棋盘吃满剩余高度 ████████████ ]  [ 当前手一句 ]
[ ██                        ████ ]  [ 着法列表     ]
[ 白方名                         ]  [ 一个主动作   ]
[  |<  <  ▶  >  >|               ]
```

规则：

- **一层顶栏。** 应用级 History/Training 进标记菜单或末尾 “⋯”。Settings 只出现一次。  
- **右侧默认只有：** 当前手判词（含 Why?）+ 着法列表。  
- **一个主动作：** 起始局面是 “Go to first key moment”；错着上是 “Try this position”；看完是 “Next key moment”。练习启动器不再用全局 `.primary`。  
- **互斥：** 练习进行中，右侧只剩题目；引擎线、摘要、Maia 比较进 Moves / 一个 Analysis 分段 / 折叠。  
- **SAN 输入** 默认不占棋盘柱；`/` 或棋盘设置打开。键盘走子仍在。  
- **棋盘几何：** 去掉双顶栏和 SAN 之后，把 `100dvh - 296px` 改成真正剩余高度。1280×720 目标至少 ~560px，而不是 424px。

### 首页

棋盘可走、可粘贴、可拖文件。一个主按钮。示例是文字链。Chess.com/Lichess 连接在有账号之后再展开，不要空身份卡占首屏。

### Training

有任务：一句话 + 一个开始。没任务：一句 + 链回最近复盘。n<5 不渲染完整阶段仪表盘。

---

## 8. 实施顺序（建议 PR 切法）

| PR | 改什么 | 验收 |
| --- | --- | --- |
| 1 | 合并 Review 顶栏；Settings 只留一处 | 1440 顶栏 ≤ 56px；1280 棋盘明显变大 |
| 2 | Review 右侧互斥：默认判词 + 着法；引导/练习/摘要按状态出现 | 起始局面视口内只有一个实心主按钮；练习中不出现摘要/引擎 |
| 3 | 隐藏默认 SAN 行；圆钮收到一个菜单（翻转留下） | 棋盘柱在 720 高内完整可见，含走子条 |
| 4 | 首页：可交互棋盘或拿掉装饰盘；压缩表单 | 390 首屏不滚就能 Analyze |
| 5 | Training 空态与小样本 | 一盘示例棋不会长出八个分析页签 |

每步都要在 1280×720 和 390×844 用浏览器点一遍，不要只看 1728 视觉基线。现有 e2e 截图会跟着变，那是预期。

---

## 9. 代码落点

- `apps/web/src/components/review-shell.tsx` — `AppHeader` + `.review-titlebar`；棋盘柱里的 `MoveEntry`  
- `apps/web/src/app/styles/review-shell.css` — `--review-board-default: … 100dvh - 296px`；双栏宽度  
- `apps/web/src/components/review-route-panels.tsx` — `ObjectiveRoutePanel` 七块同屏  
- `apps/web/src/components/retro-practice.tsx` — 空闲态深色主按钮  
- `apps/web/src/components/review/key-moment-navigation.tsx` — 与 next-step 条重复的引导  
- `apps/web/src/components/review/move-entry.tsx` — 合理功能，错误位置  
- `apps/web/src/components/home-workspace.tsx` — `inert` 装饰棋盘  
- `apps/web/src/components/advanced-study-page.tsx` / `training-today.tsx` — 仪表盘 vs 今日任务  

CSS 模块边界是干净的。这不是 “globals.css 垃圾场”。是组合层把所有模块同时打开了。

---

## 10. 证据边界

- 实测了本机当前工作区（含未提交的 desk-order / withheld-answer 改动），不是 8 月的 WintrChess 对照文档。  
- WintrChess 粘贴 Opera Game 后引擎停在 Evaluating 0%（本环境约 24s 未完成）。空状态与 Report 壳已看到；不宣称测到他们的终局分类。  
- 未登录 Chess.com 付费 Game Review。  
- 未做读屏完整走查、未跑全量 e2e。  
- 本审计不修改产品代码。

## 11. Layout pass (same day)

Implemented in the working tree: one Review titlebar, mutually exclusive Review panel (engine lines and Game Summary collapsed; one solid key-moment CTA; idle practice is a text control), Board settings holds sound/focus/typed-move, quieter Home connect row, Training hides the eight-tab report when n<5 and no task. Tokens and Feather Porcelain unchanged.

先前相关文档（结论仍然成立，本轮用新几何数据收紧）：

- `docs/audits/wintrchess-comparison.md` — 他们更简单，我们更深  
- `docs/audits/2026-09-15-liz-bluebird-product-audit-and-remediation.md` — 一屏一个主学习动作  
- `docs/design/2026-09-15-review-desk-and-withheld-answers.md` — 顺序已改，互斥未做  
