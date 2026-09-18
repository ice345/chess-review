# Open Chess Review — Windowlight / Bluebird V3 完善设计审计

**审计日期：2026-09-18**  
**仓库：** `ice345/chess-review`  
**审计基线：** `58555770d7ee65ed6dc402e0e53f409ae932695f`  
**目标：** 在不破坏当前正确产品架构的前提下，把最新实现从“已经不错的 Windowlight chess app”推进到一套真正完整、克制、可识别的视觉与交互系统。

---

## 0. 这次审计的核心判断

最新版本比上一轮明显成熟：Home board 已可交互、Home 数据入口已收敛、route head 已分为多种模式、room 会随认知负担退场、Review Start 的主路径更明确、Practice side selector 已稳定、rail icons 也已经从 generic dashboard glyph 往 chess-desk 方向重画。

现在剩下的不是“再换一种设计”，而是最后一轮 **system finishing**：

1. 第三方平台身份（Chess.com / Lichess）现在表达不统一；
2. 自有 navigation icons 虽然统一，但还有几枚需要 optical refinement；
3. Home / Import / Review Index / Practice / Stats 仍有不同程度的 dashboard/card-stack 痕迹；
4. production background 还没有真正进入 “music × chess × windowlight” 的最终版本；
5. 页面与 icon 的职责边界还需要写死，否则 agent 很容易为了“Liz 感”把鸟、羽毛、乐器塞进控制图标；
6. 当前仓库规则与用户最新方向存在一处需要明确决策的冲突：现行规则禁止 literal bird / feather UI motif，而参考效果图和后续讨论允许 Home 环境中出现极弱的蓝鸟。

最终目标不是做一个“动画/动漫主题国际象棋网站”，而是：

> **一张被冷色窗光照到的棋桌。  
> UI 像细线、纸张、玻璃后的空气；音乐只作为环境记忆；棋盘始终是物体本身。**

---

# 1. 官方美学依据：我们到底在借什么

这部分必须成为后续 agent 的设计依据，而不是“我觉得像”。

## 1.1 《リズと青い鳥》真正值得转译的语言

山田尚子在官方访谈中明确描述：

- 「透明な、作り物ではない空気感」
- 「小さな変化を積み重ねる」
- 像隔着玻璃观察
- 触碰就会消失般的脆弱、儚さ
- 不走“记号化”的表达捷径
- 生演奏带来温暖与空间感
- 电影核心乐器明确包含 **フルート / オーボエ**

官方工作人员评论又强调：

- 线的细さ
- 透明感
- 教室中绷紧的空气
- かすかな息づかい
- 两人距离逐渐变化
- 静かな熱量

美术监督篠原睦雄明确给出：

- “ガラスを覗いたような透明感”
- 淡い色彩のコントラスト
- 水彩絵具的味道

### 对 UI 的翻译

| 官方特质 | Open Chess Review 的实现 |
|---|---|
| 透明な空気感 | 轻 surface、负空间、细 rule；不是 glassmorphism |
| ガラス越し | “观察”的构图关系，不是 blur card |
| 線の細さ | 1.4 stroke icon family、hairline separator |
| 小さな変化 | 160ms micro change、240ms cognitive state shift |
| 距離 | 主/次内容之间有空间，不填满所有像素 |
| 息づかい | panel 不同时抢话；一次一个问题 |
| 静かな熱量 | blunder / key moment 更聚焦，不更吵 |
| 淡い色の対比 | warm ivory × cool blue-gray / celadon |
| 水彩 | environment / wash 的边缘感，而非 UI 插画贴纸 |
| フルート / オーボエ | Home environment 的 still-life，不是按钮 icon |

官方参考：

- https://liz-bluebird.com/interview/
- https://liz-bluebird.com/news/?id=3
- https://liz-bluebird.com/news/?id=31
- https://www.kyotoanimation.co.jp/works/liz/
- https://tv.anime-eupho.com/sp/instrument/

---

# 2. 图标系统必须分成 6 个层级

当前最大潜在风险是：为了“更有 Liz 味”，把所有 icon 都主题化。

不要这么做。

## Layer A — Product Brand Mark

**用途：**

- favicon
- app icon
- rail brand
- desktop/mobile shell
- export signature

**当前：**

`bishop + wing + windowlight`。

这个方向是成立的。

它是产品唯一可以承载 wing / bird-like gesture 的强品牌符号。

### 建议

Brand Mark 不再与 navigation icon 混用。

继续单独维护：

```text
packages/ui/assets/brand/logo.png
packages/ui/assets/brand/brand-mark.png
packages/ui/assets/brand/brand-badge.png
```

下一轮只需要做 **16 / 32 / 64 / 128px optical acceptance**。

不要在没有专门视觉验收的情况下重新生成整套 brand。

---

## Layer B — Product Navigation Icons

**用途：**

- Home
- Import
- Review
- Practice
- Library
- Stats
- Settings

**规则：**

- 自有 SVG
- 16-unit grid
- stroke 1.4
- round cap / join
- no fill
- monochrome `currentColor`
- 不使用鸟、羽毛、音符、长笛、双簧管
- 不承担品牌故事，只承担导航含义

**美学来自线条的细、留白、节奏，而不是图形主题化。**

---

## Layer C — Provider Marks

**用途：**

- Chess.com source
- Lichess source
- Manual / PGN / FEN source

这和 Layer B 完全不同。

现在 repository 没有一个统一 ProviderMark contract，导致：

- Home Accounts 基本是纯文字；
- Settings Connected Accounts 的 provider identity 被 avatar / initials 吞掉；
- Review Index 对 Chess.com 和 Lichess 都使用同一个 `import` icon；
- Stats → Sources 对 Manual / Chess.com / Lichess 全部使用同一个 `import` icon；
- Practice / player profile 只用 provider 文本。

这会让“这个棋局来自哪里”缺少一眼识别。

### 推荐默认方案：原创中性 ProviderMark

为了同时满足：

1. 当前 repo 明确写着不要复制 Chess.com trademark assets；
2. Windowlight palette 不应突然插入大面积 Chess.com saturated green；
3. Chess.com 与 Lichess 官方 logo 的视觉重量并不一致；

推荐生产版默认做：

```text
C   Chess.com
L   Lichess
P   Manual PGN
F   FEN
```

但不是普通字母圆圈。

做一个 `ProviderMark` family：

```text
14 / 16 / 18px
one quiet outline
same optical box
ink-secondary
neutral paper background
```

例如：

```text
┌───┐
│ C │  Chess.com
└───┘
```

Chess.com / Lichess 名字本身已经提供真实 provider identity，mark 只用于视觉扫描。

这比伪造它们的 logo 更安全，也更符合当前产品规则。

### 可选方案：官方 Provider Logos

如果 maintainer 明确决定要使用第三方官方 logo，那么必须：

- 先修改 `Prompt.md` / design contract，给 “provider attribution marks” 一个明确例外；
- 只从官方 brand / press kit 下载；
- 不重新描摹；
- 不自行 recolor；
- 不把它们用于 Move Quality / navigation；
- 在 `docs/third-party-notes.md` 记录来源与 trademark note。

官方来源：

**Chess.com：**
https://www.chess.com/article/view/chess-com-brand-resources

Chess.com 官方同时明确要求尊重品牌，不要制造官方赞助/背书印象，也不要未经许可修改商标资源。

**Lichess：**
https://lichess.org/about  
其 Press Kit 明确链接 graphics / icons / logo：
https://github.com/lichess-org/files/tree/lichess/Press%20Kit

### 我不建议这次默认下载官方 logos

最佳设计方案仍然是：

> Product UI 使用原创中性 ProviderMark；  
> Provider 名字使用 “Chess.com / Lichess” 文本；  
> 官方 logo 只在未来确有 attribution 需求时引入。

因此这次 **不需要下载 Chess.com / Lichess logo 才能完成 V3**。

---

## Layer D — Move Quality Icons

这套是 canonical chess semantics。

不要因为参考 Chess.com 而改成：

- !! flashy icon
- Chess.com Brilliant asset
- Chess.com Blunder icon

当前 V3 geometric family 保留。

这套 icon 是 Open Chess Review 自己的语言。

---

## Layer E — Human Difficulty Marks

继续和 objective Move Quality 分开。

不要让 Maia / human prediction 的 mark 看起来像另一套 Move Quality。

---

## Layer F — Feather Porcelain Chess Pieces

这是唯一应该明显承载：

- porcelain
- feather / wing-like organic contour
- translucent cool highlight

的地方。

**不要把棋子的有机造型扩散到按钮图标。**

---

# 3. Navigation Icon 逐枚审核

## Home

### 当前
house。

### 结论
**可保留。**

它不够“特色”，但这是好事。

Home 是导航语义，不需要承担 Liz。

要求只做 optical alignment：

- 20px rail 下 roof / baseline 不显得比 Library 更重；
- door 不要太细；
- active state 由 rail wash 提供，不给 icon 填色。

---

## Import

### 当前
arrow ↓ into tray。

### 结论
**语义正确，基本符合。**

不要改成：

- 文件夹 icon
- 下载云
- 乐谱进入盒子

建议仅精修：

- tray 更像一条 paper rule，而不是 OS download icon；
- arrow shaft 稍短；
- 保持 line family。

可考虑：

```text
一张薄纸 / score sheet
    ↓
一条 desk line
```

但必须仍然一眼理解为 import。

---

## Review

### 当前
mini board + focus point。

### 结论
**方向正确，是这一组里最值得成为 signature navigation glyph 的一枚。**

建议做最后 optical pass：

- focus dot 与 board cross 稍微分离；
- 20px 下不要读成 dashboard grid；
- dot 只落在一个 square 内，不要靠交叉线太近。

目标含义：

> Look again at one position.

---

## Practice

### 当前
square + return path。

### 问题
仍然可能读成：

- undo
- reset
- back

### 建议
重画成：

```text
一个 position square
+
一个不闭合的 return arc
+
另一个更小的 destination / recall point
```

表达：

> Return to this position later.

不要用：

- dumbbell
- flame
- target
- medal
- brain
- XP

Practice 是记忆，不是 gamification。

---

## Library

### 当前
open folio。

### 结论
**非常合适，建议保留。**

它同时自然联想到：

- game score
- notebook
- study
- 乐谱页

但又没有 literal music-note，所以和 Liz / Euphonium 的联系是间接的。

这是最理想的“元素融合”方式。

---

## Stats

### 当前
evaluation-like line graph。

### 结论
比普通 three-bars 好。

### 进一步精修
不要让它看起来像 fintech stock chart。

可改成：

```text
thin evaluation trace
+
one baseline
```

只 1–2 个 turning points。

含义：

> measured trend

不是：

> finance dashboard。

---

## Settings

sliders 保留。

系统 icon 本来就应 generic。

---

# 4. Platform identity：具体应该放在哪里

建立：

```tsx
<ProviderMark provider="chesscom" />
<ProviderMark provider="lichess" />
<ProviderMark provider="manual" />
<ProviderMark provider="fen" />
```

建议位置：

## Home → Sources

```text
C Chess.com      ice-345 · 129 games
L Lichess        Not connected
```

不要只写 platform name。

---

## Import → Connected sources

当前 account-link cards：

```text
Chess.com
Public username...

Lichess
OAuth...
```

改成：

```text
[C] Chess.com
    Public username · ownership unverified

[L] Lichess
    Verified OAuth session
```

Provider mark 是 identity anchor，不需要大。

---

## Review Index

当前 Chess.com 和 Lichess 都：

```tsx
icon: "import"
```

这是明确应该改的地方。

改为：

```text
[C] Chess.com
[L] Lichess
[P] PGN
[F] FEN
```

这里不应该再用 navigation `ImportIcon` 代替 provider。

---

## Library

source / avatar 分离：

```text
avatar
   + small ProviderMark badge

player / title
source metadata
```

不要把 provider 信息塞进 avatar background color。

当前：

```css
.platform-avatar
.platform-avatar.lichess
```

用不同背景色表达 provider 不够清晰，也会和真实头像冲突。

建议：

```text
Avatar = person
ProviderMark = source
```

两者职责分开。

---

## Stats → Sources

当前：

```text
Import icon  Manual
Import icon  Chess.com
Import icon  Lichess
```

这是视觉语义错误。

必须改成：

```text
[P] Manual
[C] Chess.com
[L] Lichess
```

---

## Practice / Player Profile

native `<select>` 内不强塞 logo。

选中 player 以后，在 profile header / scope summary 显示：

```text
[C] Chess.com · rapid
```

就够了。

---

# 5. Page-by-page 完整审核

---

## 5.1 Home

### 当前 fit
方向已基本符合。

### 仍然的问题

- Import / Accounts / Continue 仍然形成 3 surface stack；
- 720p Home board 会被 `100dvh - 340px` 压得过小；
- tablet/mobile 顺序是 aside 全部在 board 前；
- production room asset 还不是最终 music × chess still-life；
- Home 的品牌感更多来自 background，而不是 composition 本身。

### V3 目标

Home 只保留：

```text
Threshold copy

BOARD                     BRING A GAME IN
                          + Sources

                          CONTINUE
                          ruled list
```

### 具体改法

1. Accounts 并进 Import 底部 `Sources`；
2. Continue 去 paper-panel，改 open ruled list；
3. 1280×720 desktop board minimum 460–480px；
4. mobile 顺序：
   `Head → Import → Board → Sources → Continue`；
5. board move history只显示 last 2 plies / ply count；
6. Room V2 在 Home 露出最多；
7. Home 是唯一可明显看到乐器 still-life 的 route。

---

## 5.2 Import

### 当前问题

Import route 现在又包含：

- ImportForm
- ConnectedAccounts
- SyncedGamesPanel
- RecentReviewsPanel

它比 Home 更完整没问题，但仍略像“everything about imports” dashboard。

### V3 目标

Import 是 **入口工作台**，不是 Activity dashboard。

结构建议：

```text
IMPORT

[ Large import desk ]

FROM ACCOUNTS
[C] Chess.com ...
[L] Lichess ...

RECENTLY SYNCED
ruled list
```

### 删除/降权

`RecentReviewsPanel` 建议从 Import route 移除。

已有：

- Home Continue；
- Review index；
- Library；

不需要 Import 再承担 “最近复盘”。

### 美学

Import 是 instrument page：

- sans title；
- room presence 70%；
- panel 边角 8–10px；
- 少 shadow；
- 不需要 narrative serif section heading。

---

## 5.3 Review Index

### 当前

```text
Pick up where you left off.
[ paper-panel list ]
```

### 主要问题

- provider chip 使用 generic `import` icon；
- 整个 list 再包 paper-panel，有一点“card containing table”；
- source、review state、date、open action 的 hierarchy 还可以更像 folio / archive。

### V3 目标

改成 open archive：

```text
REVIEWS

[C] Morphy...
    Chess.com · Reviewed            Sep 18     Open →

[P] Casual game...
    PGN · Not analyzed              Sep 17     Open →
```

外面不要大 card。

只用：

- hairline rows；
- ProviderMark；
- tiny state mark；
- current accent only on hover / focus。

---

## 5.4 Review Workspace

### 当前 fit
总体非常接近目标。

### 仍需完成

- desktop duplicate BrandMark；
- Review local titlebar + page head + board head 层数偏多；
- More 内重复 global Library / Practice / Settings；
- local nav 仍有 web-app module tabs 的感觉。

### V3 目标

Desktop：

```text
GAME CONTEXT       Review  Moves  Study  Analysis          More  Export

REVIEW · KEY MOMENT 2 OF 5
Two moves leave the plan.

BOARD                                        THE MOMENT
```

### 改

- desktop Review titlebar 删除 BrandMark；
- titlebar 32–38px；
- More 仅 Notebook / game-local action；
- global routes 留给 left rail；
- page head 是 scene title；
- Key Moment prose 回 open surface；
- board + question 是唯二视觉主角。

---

## 5.5 Practice

这是目前最需要“小心”的页面。

`AdvancedStudyPage` 的能力非常丰富：

- Today
- Queue
- player profile
- ratings/form
- openings
- phases
- weaknesses
- highlights
- plan
- coverage
- analysis jobs

但用户进入的是 **Practice**。

### 当前风险

视觉上仍容易重新变成：

> analytics report with a Practice tab

而不是：

> 今天我该练什么。

### V3 信息层级

第一屏：

```text
PRACTICE
Player [selector]

TODAY
[ one task / continue practice ]

QUEUE
due / learning / mastered
```

第二屏以后：

```text
YOUR GAME
Overview / Rating / Openings / Phases / Highlights / Plan
```

即：

> Practice action first, intelligence report second.

### 视觉

- Today 可用一个 focus surface；
- Queue 用 ruled band；
- Report sections 大量 open surface；
- phase wash 可保留，但降低彩色 card 感；
- report 不要加更多 icon。

### Active Practice

setup 默认 quiet summary：

```text
Practice setup        Edit
White · 3 positions
```

只有 Edit 后展开 full White / Black selector。

---

## 5.6 Library

当前 list / ruled-row 方向是对的。

### 建议

- provider 从 avatar color 中拆出；
- filters 减少 “filter card” 感；
- 使用 ProviderMark；
- avatar 只代表 player；
- source mark 只代表 provider。

Library 本身无需更多 Liz 元素。

它应该像 archive shelf / score index。

---

## 5.7 Stats

这是当前第二个明显仍有 dashboard 痕迹的页面。

现在：

```text
[ Library card ]
[ Sources card ]
[ Practice card ]
```

### V3 改法

做成一张连续 score sheet：

```text
WHAT THE LIBRARY SAYS

LIBRARY
Records          129
Games            127
Analyzed          88
Pending           39

────────────────────

SOURCES
[P] Manual         4
[C] Chess.com    120
[L] Lichess        3

────────────────────

PRACTICE
Mastered          12
Due                3
In progress        7
```

没有 3 张 card。

如果以后增加 chart：

- 只加一个；
- thin evaluation-line style；
- 不做彩色 analytics dashboard。

### Typography

Stats headings 全部 sans 或 very restrained serif。

数字可用 serif，但不要每个 section 都 magazine title。

---

## 5.8 Settings

当前 room presence 最低是对的。

Settings 的目标不是“好看”，是：

- clear
- stable
- trustworthy

不要加音乐 / Liz decorations。

只保持 Windowlight tokens、fine rule 和 provider source identity。

---

# 6. Background / Room V2

这是 V3 最重要的 production asset。

## 应包含

- tall window
- sheer curtain
- cool daylight
- faint foliage shadows
- wide negative-space desk
- silver flute
- dark oboe
- loose sheet music
- 1–2 Feather Porcelain chess pieces
- tiny edge of chessboard

## 不要成为主物体

- vase
- coffee mug
- lifestyle notebook
- pen
- flowers

## 关于蓝鸟

这里存在 current contract 冲突。

当前 `.claude/rules/windowlight-ui.md` / design rules 禁止：

- second bird motif
- feather decorations
- drifting petals

如果 owner 现在明确希望 Home 有一只 **极远、环境式、非 mascot 的 blue bird**，需要先修改 contract：

允许：

> One distant environmental bird may appear in the Home room artwork only.  
> It is non-interactive, non-animated, non-branding, and never appears as a UI icon.

禁止：

- 跟鼠标飞；
- Practice 成功飞出；
- button bird icon；
- feather particles；
- multiple birds；
- other routes repeat bird。

如果不修改 contract，Room V2 就不要 literal bird，只用：

```text
flute + oboe + score + window light + chess
```

也已经足够。

---

# 7. 乐器元素应该在哪里出现

官方访谈明确关联 flute / oboe，本身是非常合理的素材。

但只放：

## 可以

- Home room still-life
- Home empty/completion illustration（极少）
- large marketing / README hero screenshot background

## 不可以

- Import icon
- Practice icon
- Stats icon
- provider badge
- move-quality icon
- button decoration
- rail active marker

### 原因

最好的融合不是：

> “这是 Liz，所以到处放长笛。”

而是：

> “环境像音乐室，但工具仍然是工具。”

---

# 8. 不要下载哪些官方素材

## 不要使用《リズと青い鳥》角色、剧照、官方视觉图

只使用官方文字描述作为 art direction 依据。

## 不要从《響け！ユーフォニアム》网站复制乐器图片

官方 Instrument 页面可以做资料参考，但生产素材应自己绘制 / 生成。

尤其其 Special 页面对提供的 Twitter icon 明确写着：

> 画像データの再配布等を禁じます。

因此不要把官方角色 / icon / instrument art 打进这个 repo。

乐器请使用：

- 自己生成的 Room V2；
- 自己绘制的简化 still-life；
- 或许可证明确的独立素材。

---

# 9. Asset acquisition 清单

## 不需要下载

### Navigation icons

全部继续维护：

```text
packages/ui/src/icons.tsx
```

不要引入 Heroicons / Lucide / Font Awesome。

### Provider marks（推荐）

自己实现：

```text
packages/ui/src/provider-mark.tsx
```

不需要外部图片。

### Music elements

直接作为 Room V2 的原创 background，而不是独立 UI icon。

---

## 可选下载（仅当决定使用官方 provider logos）

### Chess.com

官方 Brand Resources：

https://www.chess.com/article/view/chess-com-brand-resources

要求：

- 不改色；
- 不重画；
- 不暗示 Chess.com endorsement；
- 只做 source attribution；
- 记录 trademark/source note。

### Lichess

官方 About → Press Kit：

https://lichess.org/about

Graphics folder：

https://github.com/lichess-org/files/tree/lichess/Press%20Kit

可用官方 `lichesslogo.svg`，但同样只做 provider attribution。

### 建议的 repo layout（如果 owner 选择 official logos）

```text
packages/ui/assets/providers/
├── README.md
├── chesscom-pawn.png
└── lichess-logo.svg
```

`README.md` 记录：

```text
source URL
download date
intended use
no modification
trademark / license note
```

不要从 Google Images 下载。

---

# 10. ProviderMark 推荐 API

默认原创 neutral mode：

```tsx
type Provider =
  | "chesscom"
  | "lichess"
  | "manual"
  | "pgn"
  | "fen";

<ProviderMark provider="chesscom" size={16} />
```

SVG / CSS 规则：

```text
box: 16×16
visual ink: ~11×11
stroke: 1.2–1.4
radius: 3–4
background: transparent
color: ink-muted / ink-secondary
```

不要根据 provider 使用：

```text
Chess.com green
Lichess black
```

在 neutral mode 下全部 Windowlight。

文字承担 provider brand name。

---

# 11. `ProviderMark` 落地文件

建议新增：

```text
packages/ui/src/provider-mark.tsx
packages/ui/src/index.ts
```

替换：

```text
apps/web/src/components/home-workspace.tsx
apps/web/src/components/connected-accounts.tsx
apps/web/src/components/review-index-page.tsx
apps/web/src/components/stats-page.tsx
apps/web/src/components/synced-games-panel.tsx
apps/web/src/components/history-page.tsx
apps/web/src/components/advanced-study-page.tsx
```

样式：

```text
apps/web/src/app/styles/platforms.css
apps/web/src/app/styles/home.css
apps/web/src/app/styles/stats.css
apps/web/src/app/styles/study.css
```

---

# 12. Surface system 最终版

要彻底摆脱 dashboard 感，生产 UI 只允许三种 surface。

## Open Surface

没有 card。

用于：

- prose
- Continue
- Stats sections
- Library rows
- Key Moment explanation
- secondary path

靠：

- whitespace
- alignment
- hairline

分层。

## Instrument Surface

轻 border，8–10px radius，几乎没 shadow。

用于：

- Import input
- Scope filters
- Connected account controls
- Practice setup
- Engine settings

## Focus Surface

14–16px radius + very soft shadow。

只用于：

- board card
- Training Today
- active practice
- modal / floating chooser

**任何页面如果同时出现 3 个以上 Focus Surface，都要重新审查。**

---

# 13. 色彩最终规则

继续保持当前 token 基础：

```text
surface-page      warm ivory
surface-paper     warm paper
ink-primary       blue-gray
wash-blue         mist
wash-pink         dusty pale rose
wash-sage         pale sage
accent-primary    restrained slate blue
```

第三方 provider 不应污染主 palette。

即使以后官方 Chess.com mark 是绿色，它也只应该是：

```text
16px attribution mark
```

绝不能让：

```text
button
panel
active state
chart
```

变成 Chess.com green。

---

# 14. Motion 最终规则

当前 motion tier 基本正确。

## Tier A

120–180ms：

- hover
- focus
- pressed
- selected side
- disclosure

## Tier B

220–280ms：

- Review start → key moment
- key moment → practice
- answer reveal
- context panel mode

只用：

- opacity
- translate 2–6px
- slight wash
- divider reveal

不使用：

- bounce
- spring
- scale-pop
- glitter
- feather particle
- mascot flight

---

# 15. 最新 screenshot acceptance 仍必须补

当前 committed golden screenshots 仍落后于：

```text
Home rewrite
head variants
room presence
Review refinement
icon V2
```

因此在称 V3 “完成”前：

## 先 capture

```text
Home          1280×720
Home          1440×900
Home          1920×1080
Import        1440×900
Review Index  1440×900
Review Start  1280×720
Review Start  1440×900
Key Moment    1440×900
Practice      1440×900
Stats         1440×900
Library       1440×900
Settings      1440×900
Mobile Home   390×844
Mobile Review 390×844
Mobile Practice 390×844
```

## 人工并排对比四张设计 reference

不要自动更新 baseline 后就宣布完成。

---

# 16. V3 实施顺序

## Phase 1 — Asset / identity

1. Room V2
2. `ProviderMark`
3. provider / avatar separation
4. Review / Practice icon optical pass
5. BrandMark 16/32px check

## Phase 2 — Home

1. Sources 并入 Import
2. Continue open list
3. 720p board minimum
4. mobile order
5. line history truncation
6. Room V2 position

## Phase 3 — Import / Review Index

1. Import remove RecentReviewsPanel
2. connected provider marks
3. Review Index open archive
4. provider chip → ProviderMark

## Phase 4 — Review

1. remove duplicate desktop logo
2. compact local navigation
3. remove global links from More
4. reduce Key Moment surface nesting
5. visual acceptance

## Phase 5 — Practice

1. Today first
2. Queue second
3. Report third
4. active setup collapsed summary
5. provider mark in profile context

## Phase 6 — Stats / Library / Settings

1. Stats cards → continuous score sheet
2. Stats provider marks
3. Library avatar/source separation
4. Settings only token cleanup, no decorative expansion

## Phase 7 — Documentation / golden screenshots

1. update `docs/ui-spec.md`
2. update `docs/design/windowlight-bluebird-v2.md`
3. resolve bird-contract decision
4. mark older visual audit historical
5. regenerate golden screenshots after human acceptance
6. update README screenshot

---

# 17. Final acceptance checklist

## Aesthetic

- [ ] “Liz” 不依赖角色 / 官方 artwork / 鸟 icon
- [ ] 视觉空气来自 space / light / fine line
- [ ] music 只存在于 environment
- [ ] Home 比 Review 更有环境
- [ ] Practice 环境最退后
- [ ] blunder / error 不大红大叫
- [ ] serif 只出现在真正 narrative 的地方

## Icons

- [ ] nav icons 全是同一 family
- [ ] Review 不读成 dashboard
- [ ] Practice 不读成 undo
- [ ] ProviderMark 与 nav Icon 完全分层
- [ ] Stats 不再用 Import icon 表示 Chess.com / Lichess
- [ ] Review Index 不再用 Import icon 表示 Chess.com / Lichess
- [ ] avatar 不承担 provider identity
- [ ] 20px / 16px optical test 通过

## Pages

- [ ] Home 第一眼是 board
- [ ] Home 第二眼是 Bring a game in
- [ ] Import 没有 Activity dashboard 感
- [ ] Review Start 只有一个 primary CTA
- [ ] Key Moment board + question 主导
- [ ] Active Practice 1 秒内看懂 “Your turn”
- [ ] Practice 首页先告诉用户今天练什么
- [ ] Stats 是 score sheet，不是 analytics cards
- [ ] Settings 仍然是工具，不被 art direction 干扰

---

# 18. 最终设计定义

Open Chess Review 的美学不应该被描述为：

> “Liz and the Blue Bird themed chess website”

而应该被定义为：

> **Windowlight is a quiet observational interface language: warm paper under cool daylight, thin lines, pale contrast, deliberate distance, and small state changes.  
> Bluebird is not a mascot. Music is not an icon theme. They are traces in the environment.  
> The chessboard remains the object.**

中文：

> **一张被冷色窗光照着的棋桌。  
> 乐器只是桌边留下的痕迹；蓝鸟不是吉祥物；棋盘才是主角。  
> 页面越进入思考，周围的世界越安静。**

这才是这轮 V3 应该追求的“尽可能完美”。
