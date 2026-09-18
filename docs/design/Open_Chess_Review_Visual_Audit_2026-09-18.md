# Open Chess Review — Windowlight / Bluebird V2 实现审计与修改建议

**审计日期：2026-09-18**  
**审计仓库：** `ice345/chess-review`  
**审计基线：** `a7c61934ecb4984062ca6f307c64c8324d4183ae`  
**范围：** 当前 Web UI、Home、App Shell / Rail、Review Start、Key Moment、Practice、图标系统、环境背景、Windowlight / Bluebird 设计文档与实际实现之间的一致性。  
**对照：** `docs/design/windowlight-bluebird-v2.md`、`FIX.md`、四张采用的参考效果图，以及当前源码实现。

---

## 0. 结论

这一轮实现不是失败。它已经完成了几个很重要的基础切换：

- 顶部导航已经换成 persistent left rail；
- Room environment 已经真正成为整站背景；
- Home、Review Start、Key Moment、Practice 已经按照参考图重新组合；
- `Windowlight / Bluebird V2` 已经进入正式设计 contract；
- Practice White / Black selector 的不可逆问题已经修复；
- Tier A / Tier B motion、reduced motion、viewport acceptance 都已经有测试；
- UI icon 已经统一为自有 line-icon family。

但是，从目前源码和已经采用的参考效果图对照来看，**实现更像“把参考图的组成元素逐项实现了”，还没有完全实现参考图的“场面调度、空气感和层级”**。

因此现在的主要问题不是继续换主题，也不是继续加更多装饰，而是：

> **已经拥有正确的材料，但组合得仍然偏 Web App / 文档页面；需要从“组件实现”进一步进入“空间设计”。**

当前最明显的问题集中在四处：

1. **Home 仍然最弱。**  
   它同时承担完整 Import form、board preview、accounts、synced games、recent reviews，因此又回到了“左边一个大卡 + 右边一列工具卡”的结构；并且棋盘仍是 inert preview，与 “Start from a position” 这个语义不一致。

2. **所有 route 过度共享同一种 `page-head`。**  
   `kicker + serif display + lede + step trail` 被推广到几乎所有页面，反而重新制造了“每页一个模板”的单调感，这与设计文档自己提出的“same language, different scene composition”发生冲突。

3. **背景环境虽然已经进入产品，但当前使用方式过于“一张图全站固定”。**  
   Home、Review、Practice、Settings 的认知负担不同，不应该完全以同一强度看到同一个 room。参考图的重点不是“永远看到房间”，而是空气、距离、光和安静的层次。

4. **图标统一了，但还没有形成 Open Chess Review 自己的视觉符号。**  
   当前 icon family 工程上干净统一，但 `review = 四格方框`、`practice = 分叉箭头`、`stats = 三根柱` 等仍比较 generic，和 Windowlight / Feather Porcelain / chess-study desk 的身份感没有真正接上。

这一轮建议不要继续大规模加页面。优先做一个 **Visual Refinement Pass**。

---

# 1. 当前实现里做对了什么

这些部分建议保留，不要推翻。

## 1.1 Persistent rail 是正确方向

`AppShell` 使用一个 `<nav>` 同时承担 desktop rail 和 mobile drawer，这是好的：

- accessibility landmark 单一；
- 当前 route 有 `aria-current`；
- 桌面能保持长期空间记忆；
- 相比旧 top bar，更接近“study desk / chapter rail”。

不要重新回到顶部导航。

---

## 1.2 Room 作为一个环境层，而不是每页插画，是正确方向

`.app-frame::before` 把 `room.webp` 固定在整站下面，而不是每页复制一个 hero image，这比普通网页 background section 更成熟。

问题只在于后面要做 **route-specific intensity**，不是把这个方案删掉。

---

## 1.3 Board card + contextual panel 的 Review 架构已经成立

现在 Review 的大方向：

```text
Board / game identity
        +
Contextual panel
```

比过去：

```text
board + tabs + cards + more cards
```

清晰得多。

Board 保持稳定、右栏随着 cognitive mode 变化，也是正确架构。

---

## 1.4 Practice selector contract 已经修到正确方向

当前 `practice-side`：

- White / Black 始终存在；
- selected state 使用 `aria-pressed`；
- empty state 仍可见；
- selection 与 start 分离；
- active practice 中也保留 setup。

这部分不要再倒退。

后面只需要视觉上做得更“成组”、更容易看懂。

---

## 1.5 Motion 的边界是正确的

当前只保留：

- Tier A micro interaction；
- Tier B cognitive mode transition；
- reduced-motion fallback；
- 没有第一访问强制 cinematic intro。

这个决定适合正式工具。

不建议重新做大规模 scroll-driven Bluebird intro。

---

# 2. 当前最大的问题：参考图被“组件化”了，但没有完全“空间化”

参考图真正优秀的地方不是：

- 有 rail；
- 有 serif；
- 有卡片；
- 有 room background。

而是：

> **每一个画面都有一个明确的视觉主角，其余东西主动退后。**

当前源码的实现更多是：

```text
route head
+
two-column grid
+
paper panel
+
paper panel
+
paper rows
```

虽然比以前漂亮，但仍然容易形成“设计系统 demo”的感觉。

应该进一步做到：

```text
Home
    → threshold / desk

Review Start
    → invitation

Key Moment
    → one decision

Practice
    → your turn

Library
    → archive

Stats
    → instrument / report
```

也就是说，**同一个 Windowlight 语言，不应该意味着同一个 page template。**

---

# 3. P0：Home 需要重新做一次，而不是继续微调

这是当前最值得优先修改的地方。

---

## 3.1 当前 Home 的核心结构问题

当前 `home-workspace.tsx`：

```text
page-head
    ↓
home-stage
    ├── home-aside
    │   ├── ImportForm
    │   ├── ConnectedAccounts
    │   ├── SyncedGamesPanel
    │   └── RecentReviewsPanel
    │
    └── home-board
```

Desktop CSS 再把：

```text
home-board → 左
home-aside → 右
```

视觉上虽然正确，但是右栏实际塞了 **四种不同任务**：

1. 导入棋局；
2. 账号状态；
3. 平台同步棋局；
4. 最近复盘。

于是 Home 重新变成了一个 mini dashboard。

### 建议

Home 的右栏只保留两件事情：

```text
Bring a game in
Continue
```

其中：

### A. Bring a game in

只保留：

- Paste PGN
- Open file
- FEN / position
- connected account shortcut

不要在 Home 展开完整 account management。

账号只显示成一行：

```text
Chess.com · ice-345 · 129 games
Lichess · Not connected
```

点击进入 `/import` 或 Settings 管理。

### B. Continue

把：

- synced recent games
- recent reviews

合并成一个统一的 **Continue / Recent activity**。

不要让用户理解两个数据模型。

UI 可以只显示：

```text
Continue

Morphy — Duke of Brunswick
Reviewed · 89 / 72

ice-345 — blitz 4+2
Synced · not reviewed

ice-345 — rapid 15+10
Reviewed
```

Home 不需要教用户什么叫 `SyncedGamesPanel` 和 `ReviewRecord`。

---

## 3.2 Home 棋盘目前的语义不成立

当前：

```tsx
aria-hidden="true"
inert
allowDragging: false
canDragPiece: () => false
```

但标题是：

> Start from a position

这会产生明显的 affordance mismatch。

即使现在副标题改成：

> Paste a PGN on the right and the board previews it.

它仍然让棋盘看起来像产品的中心，但用户不能和它交互。

### 建议：优先做真正的 Position Desk

Home board 应该支持两种状态：

#### Idle

```text
Start from a position
Move a piece, paste a FEN, or bring in a game.
```

棋盘可以操作。

用户走：

```text
1. e4
```

以后出现一个非常轻的：

```text
Position · after 1.e4
[ Open in Engine Lab → ]
```

#### PGN input active

当右侧正在输入 PGN 时：

- board 自动切为 preview；
- board interaction 暂时禁用；
- header 明确写：

```text
PGN preview
Opening position
```

这样语义才完整。

### 如果暂时不实现交互

至少把：

> Start from a position

改为：

> Preview the game

不要让不可操作的对象看起来可操作。

---

## 3.3 Home 不应该再完全被 `page-head` 和 `home-stage` 切成上下两块

当前 hero 在上：

```text
A quieter desk for your games.
```

然后下面才是 desk。

参考图真正好的地方是：

> **Hero 与 desk 是同一场景。**

建议 Home desktop 改成：

```text
┌────────────────────────────────────────────────────────┐
│ kicker                                                 │
│ A quieter desk for your games.                         │
│ short lede                                             │
│                                                        │
│        BOARD / POSITION              BRING A GAME IN    │
│        ─────────────────             ────────────────    │
│        [ large board ]               [ compact form ]   │
│                                                        │
│                                      Continue           │
└────────────────────────────────────────────────────────┘
```

Hero 不需要另占一整段垂直空间。

### CSS 建议

不要继续使用：

```css
.page-head
.home-stage
```

两个独立 67.7vw 容器。

Home 自己拥有：

```css
.home-scene
```

内部：

```css
grid-template-areas:
  "head   head"
  "board  aside";
```

Hero 可以只跨 1.3 行，而不是成为全站统一 slot。

---

## 3.4 当前 Home 内容宽度太机械地照抄参考图比例

目前 desktop：

```css
width: min(67.7vw, 1400px);
margin-inline: 7vw auto;
```

这是把 mockup 的测量值直接硬编码成 production geometry。

问题：

- 1440px 时实际内容约 975px；
- rail 已经占据一块；
- Home board + aside + gap 又要分这 975px；
- 右边留下很大的 photograph 空白；
- 结果容易让 UI 看起来“小”和“远”，而不是“空气感”。

**距离感 ≠ 把应用缩成屏幕 2/3。**

建议改为：

```css
--scene-width: min(1320px, calc(100cqw - clamp(36px, 5vw, 84px)));
```

然后：

```css
.home-scene {
  width: var(--scene-width);
  margin-inline: clamp(28px, 4.5vw, 72px) auto;
}
```

在 1440 / 1728 / 1920 下保持 board 真正 dominant。

---

# 4. P0：不要所有页面都使用同一种 `page-head`

这是目前造成“还是有点单调”的核心原因之一。

`chrome.css` 当前把：

```text
page-kicker
page-display
page-lede
page-steps
```

定义成全站 route composition。

工程统一性很好，但产品表现过度统一。

---

## 4.1 应该改成 4 种 head mode

### `head--threshold`

Home 专用。

- 最大 serif；
- lede；
- optional movement trail；
- 环境最强。

---

### `head--task`

Review Start / Key Moment。

只保留：

```text
REVIEW · KEY MOMENT 2 OF 5
Two moves leave the plan.
```

lede 应该非常短。

Key moment 的真正叙事标题应进入右栏，而不是顶部和右栏同时抢。

---

### `head--instrument`

Import / Library / Stats / Settings。

不要强制大 serif hero。

例如：

```text
LIBRARY
Your games
```

`Your games` 可以是 26–30px sans / restrained serif，而不是 46px editorial headline。

这样工具页不会像杂志目录。

---

### `head--focus`

Active Practice。

进入 Practice 后，顶部只保留：

```text
PRACTICE · POSITION 2 OF 5
Your turn.
```

甚至 `Your turn` 可以直接进入右 panel。

不要在 active exercise 上方保留完整文学 hero。

---

# 5. P0：背景图片需要换成真正属于这个产品的 environment

当前 repo 已经把 `room.webp` 定义成 production environment。

方向正确。

但是当前背景如果仍是早先的：

- coffee mug；
- generic books；
- flower vase；
- pen / notebook；

它仍然更像：

> lifestyle productivity app

而不是：

> chess × music × Liz / Euphonium 的 study room。

---

## 5.1 建议替换 Room V2

使用我们后面已经明确下来的元素：

### 保留

- tall window；
- sheer curtain；
- cool daylight；
- foliage shadow；
- large empty desk；
- subtle blue bird in environment；
- very sparse petals / blossom。

### 替换右下 still-life

不要：

- 咖啡杯作为主要对象；
- 通用笔记本 + 钢笔；
- 巨大的花瓶。

改为：

- **银色长笛**，横向穿过右下边缘；
- **双簧管**，与长笛形成深浅材质对比；
- **少量乐谱页**，只作为 texture，不让谱线进入文字阅读区域；
- **1–2 枚 Feather Porcelain 棋子**；
- 可露出非常小的一角棋盘；
- 只保留很轻的白色花瓣 / 小枝。

这会同时建立：

```text
music
+
chess
+
window
+
distance
```

而不是 generic “beautiful desk”。

---

## 5.2 Background 不应全站同强度

当前：

```css
.app-frame::before
```

全站一张固定图、6% wash。

建议升级为 route atmosphere variable：

```css
.app-frame {
  --room-presence: .90;
  --room-veil: 6%;
}
```

建议：

| 页面 | room presence |
|---|---:|
| Home | 85–100% |
| Import | 70% |
| Review Start | 65–75% |
| Key Moment | 50–60% |
| Practice | 35–50% |
| Library | 45–60% |
| Stats | 35–45% |
| Settings | 25–35% |

不是 blur。

而是通过：

```text
photo opacity
+
solid paper veil
+
local head glow
```

让越需要思考的页面越纯净。

**越进入棋局，环境越退后。**

这比所有页面都同一张 full-strength room 更符合电影里“注意力逐渐收束”的感觉。

---

# 6. P1：Rail 现在是正确结构，但品牌区和 icon 仍偏普通

---

## 6.1 Brand mark 30px 太小，复杂 artwork 在这里失去意义

当前：

```css
.app-rail .brand-mark {
  width: 30px;
  height: 30px;
}
```

如果 mark 本身带有 bishop / wing / translucent detail，30px 圆形裁切几乎看不出来。

结果是：

- 视觉上像一个圆形 avatar；
- 和 `Open Chess Review` 字标关系弱；
- 没有成为 rail 的“入口”。

### 建议

开一个正式 **Brand Mark V2** 任务：

先只做 master SVG。

目标：

```text
32px 仍可识别
16px favicon 仍可辨认 silhouette
```

使用：

- bishop body；
- wing / feather negative-space；
- 两级 tone；
- 不要 watercolor texture；
- 不要复杂窗框；
- 不要 literal bird。

Master approval 后再同步：

- favicon；
- manifest；
- Tauri；
- mobile；
- export card。

---

# 7. P1：当前 line icons 一致，但“太正确、太 generic”

`packages/ui/src/icons.tsx` 工程质量不错：

- 16-unit grid；
- 1.4 stroke；
- round cap / join；
- no fill。

问题不是一致性。

问题是**身份感**。

---

## 7.1 当前几个 icon 的问题

### Review

现在是一个 2×2 square grid。

它更像：

- dashboard；
- apps；
- layout。

不像 chess review。

建议：

```text
一个 4-square mini board
+
一个细小 focus dot / move mark
```

让它表达：

> review a position

而不是：

> four tiles。

---

### Practice

现在是一个 branching arrow。

它看起来接近：

- shuffle；
- git branch；
- workflow。

建议换为：

- simplified knight path；
- 或 board-square + returning arrow；
- 或 single piece + repeat arc。

重点是：

> revisit a position

---

### Library

三本书基本成立。

但是可以更接近 **score / study folio**：

- 两页打开的 score；
- 一条细 vertical spine。

不要做成普通 bookshelf app。

---

### Stats

三根 vertical bars 太 generic。

可以改成：

- subtle evaluation line；
- three measured stems；
- 或 small timeline / chart。

但仍保持极简。

---

### Settings

sliders 保留。

这是系统 icon，本来就不需要做品牌化。

---

## 7.2 Icon family 不要全部“音乐化”

不要给：

- Review 加音符；
- Practice 加长笛；
- Stats 加五线谱。

音乐元素应该属于 environment。

UI icon 仍然是 chess tool。

否则会从 subtle reference 变成 theme park。

---

# 8. P1：Paper panel 还可以更克制

当前：

```css
.paper-panel {
  border-radius: 16px;
  background: 88% paper;
  box-shadow: 0 12px 34px ...
}
```

它已经比 glassmorphism 好。

但是如果 Home / Review 所有主要东西都 `.paper-panel`，仍然会产生：

> soft-card SaaS

的感觉。

建议明确 surface hierarchy：

---

## Open surface

用于：

- page head；
- narrative explanation；
- timeline label；
- secondary paths。

**没有卡。**

---

## Instrument surface

用于：

- PGN input；
- Practice setup；
- Engine options；
- filters。

特点：

```text
hairline
8–10px radius
almost no shadow
```

---

## Focus surface

用于：

- board card；
- active Practice panel；
- modal / floating chooser。

才使用：

```text
14–16px radius
soft shadow
```

也就是说：

> 不是“所有功能区都是纸片”，而是只有真正需要握住用户注意力的东西才成为纸片。

---

# 9. P1：Review Start 应进一步拉开主次

当前 Review Start 的目标方向已经对。

下一步不是再增加内容，而是减竞争。

推荐右栏：

```text
ONE THING AT A TIME

Start with the first moment
that mattered.

short explanation

[ First key moment → ]

        Step to move 1 →

────────────────

This game
○────○────○────○────○

OTHER PATHS
Practice
Moves
Summary
Engine
```

关键修改：

- `Practice / Moves / Summary / Engine` 不要每行都像可展开主菜单；
- 可以放在一个更轻的 `Other paths` 区域；
- icon 变小；
- meta 更 faint；
- 不要和 primary CTA 同一 visual weight。

---

# 10. P1：Key Moment 仍应少一层“卡片感”

Key Moment 推荐最终结构：

```text
THE MOMENT

Why does 6...Nf6 matter?

concise explanation

● Inaccuracy · 69
Explain this move →

──────────────

TRY IT YOURSELF

Play what you would have played.

[ Practice this position → ]

Evidence · Engine · Nearby
──────────────

Next key moment →
```

注意：

`Try it yourself` 不一定还要再嵌一个完整 panel。

可以只是：

```text
thin rule
+
soft wash
```

这样会比 panel-in-panel 更接近参考图的空气感。

---

# 11. P1：Practice 的交互 contract 对了，但视觉 affordance 还可以更强

当前：

```text
[ White ]
[ Black ]
```

本质上还是两个小 button。

推荐变成真正的 stable segmented surface：

```text
Play as
┌──────────────────┬──────────────────┐
│ White            │ Black            │
│ 3 positions      │ 2 positions      │
└──────────────────┴──────────────────┘
```

要求：

- selector 整体宽度跟 panel 对齐；
- selected side 使用 1 个浅 wash；
- count 永远可见；
- 0 positions 不禁用，只降低 ink；
- click empty side 显示：

```text
No practice positions for White in this game.
```

不要弹 error。

Active Practice 下：

```text
Practice setup
```

应默认保持 collapsed / quiet，除非用户刚切 side。

---

# 12. P1：Home、Review、Practice 之间应该有“环境退场”

这是当前 Bluebird V2 还没有真正实现的一个关键感觉。

不是动画，而是**视觉收束**。

建议：

### Home

```text
room           100
environment     rich
board           85
copy            80
```

### Review Start

```text
room            70
board           95
panel           90
```

### Key Moment

```text
room            55
board          100
moment         100
secondary       55
```

### Practice

```text
room            40
board          100
question       100
everything else 35
```

这会形成一种非常重要的体验：

> 越深入棋局，世界越安静。

这比让蓝鸟飞、羽毛飘更符合目标美学。

---

# 13. P2：Typography 要再减少“每页都是杂志标题”的感觉

现在 serif token 已经统一，这是好事。

但是 narrative serif 仍然使用得太广。

建议：

## Serif

只用于：

- Home hero；
- Key Moment question；
- Study lesson title；
- completion；
- occasional reflective empty state。

## Sans

用于：

- Import；
- Library；
- Stats；
- Settings；
- Review route labels；
- operational subheads；
- panel titles。

例如：

```text
LIBRARY
Your games
```

`Your games` 可以是一个较大的 refined sans，而不是必须是 editorial serif。

这样才能让：

> serif 出现的时候真的有情绪重量。

---

# 14. P2：避免把生成效果图里的所有装饰都实现

四张 reference 很有用，但它们是 **art-direction exaggeration**。

Production 不应该复制：

- 每页 visible bird；
- 每页 feather；
- 每页 blossom；
- 每页书本；
- 每页 handwritten quote；
- 大量 photo still-life。

推荐生产比例：

### Home

可以看到：

- window；
- instrument/chess still-life；
- distant bird；
- foliage shadow。

### Review Start

只能明显看到：

- light；
- window geometry；
- faint instrument edge / score texture。

### Key Moment

更少。

### Practice

几乎只留：

- cool light；
- faint shadow；
- room color。

环境只负责“空气”，不负责讲故事。

---

# 15. 当前设计文档本身需要一个小修正

`windowlight-bluebird-v2.md` 当前的 implementation table 把：

```text
Home composition
Review Start
Key Moment
Practice composition
```

都标成：

> implemented

从代码意义上没错。

但是从视觉验收意义上，这会误导后续 agent：

> “已经实现，不要再动。”

建议改状态成：

```text
implemented structurally; visual refinement pending
```

具体：

| 项 | 新状态 |
|---|---|
| Home composition | structural implementation complete; refinement required |
| Review Start | structural implementation complete; hierarchy refinement required |
| Key Moment | structural implementation complete; surface reduction required |
| Practice | interaction contract complete; visual grouping refinement required |
| Icon set | family implemented; art-direction refinement pending |
| Room environment | infrastructure implemented; Room V2 asset pending |

这样 agent 不会把“代码存在”误解成“设计完成”。

---

# 16. 建议的新实施顺序

不要同时改所有页面。

---

## Phase V1 — Home + Room V2

最高优先级。

### 改

- `room.webp` → Music / chess room V2；
- Home 重新组合；
- Home board interaction / honest preview semantics；
- merged Continue section；
- compressed account state；
- Home-specific `home-scene`；
- 不再机械复用 full `page-head`。

### 验收

- 1280×720；
- 1366×768；
- 1440×900；
- 1728×1117；
- 1920×1080；
- 390×844。

重点看：

- board 是否仍是首个视觉物体；
- import CTA 是否首屏可见；
- 背景是否支持 UI，而不是抢 UI；
- right aside 是否不再像 dashboard；
- 1440 下 board 是否至少接近当前 reference 的存在感。

---

## Phase V2 — Rail + Icon V2

### 改

- review icon；
- practice icon；
- library icon；
- stats icon；
- optical alignment；
- active row weight；
- brand mark review。

Brand mark 如果不确定，先不替换 production asset。

---

## Phase V3 — Head variants

建立：

```text
threshold
task
instrument
focus
```

四种 composition。

删除“所有 route 都必须 full page-head”的隐含规则。

---

## Phase V4 — Review / Key Moment surface reduction

- secondary paths 退后；
- Try it yourself 减少 panel nesting；
- evidence rows 更接近 score / annotation；
- board 和 question 成为唯一双主角。

---

## Phase V5 — Practice visual refinement

- full-width segmented side selector；
- visible counts；
- setup 收敛；
- active state further removes environment；
- hint / answer hierarchy。

---

# 17. 推荐文件级修改清单

## Home

```text
apps/web/src/components/home-workspace.tsx
apps/web/src/components/import-desk.tsx
apps/web/src/components/recent-reviews.tsx
apps/web/src/components/synced-games-panel.tsx
apps/web/src/components/connected-accounts.tsx
apps/web/src/app/styles/home.css
```

---

## Shell / scene

```text
apps/web/src/components/app-shell.tsx
apps/web/src/app/styles/chrome.css
apps/web/src/app/styles/tokens.css
apps/web/public/atmosphere/room.webp
```

---

## Icons

```text
packages/ui/src/icons.tsx
packages/ui/src/index.ts
```

如做 brand V2：

```text
packages/ui/assets/brand/
scripts/sync-brand-assets.mjs
```

但必须单独 review master SVG 后再传播。

---

## Review

```text
apps/web/src/components/review-route-panels.tsx
apps/web/src/components/review-shell.tsx
apps/web/src/app/styles/review-shell.css
apps/web/src/app/styles/review-workspace.css
apps/web/src/app/styles/review-panels.css
```

---

## Practice

```text
apps/web/src/components/retro-practice.tsx
apps/web/src/app/styles/practice.css
apps/web/src/lib/practice-setup.ts
```

---

## Documentation

```text
docs/design/windowlight-bluebird-v2.md
docs/design/references/windowlight-bluebird-v2/README.md
FIX.md
docs/ui-spec.md
.claude/rules/windowlight-ui.md
.claude/skills/visual-acceptance/SKILL.md
```

---

# 18. Visual acceptance 必须新增什么

现有 screenshot coverage 很好，但下一轮不要只做“没有 overflow”。

建议为 Home 增加明确 geometry assertions：

```text
board width / usable content width
board top position
primary CTA within first viewport
right column max width
hero + board relationship
```

以及 visual review checklist：

### Home

- [ ] first glance lands on board, not rail
- [ ] second glance lands on primary import
- [ ] accounts do not look like a settings page
- [ ] recent activity looks like continuation, not analytics
- [ ] room props stay outside operational text
- [ ] flute / oboe / score do not intersect functional panels

### Review Start

- [ ] First key moment is the only solid CTA
- [ ] secondary paths read as secondary
- [ ] board remains visually larger than panel
- [ ] room no longer competes with board

### Key Moment

- [ ] question and board dominate
- [ ] evidence is present but folded
- [ ] no nested-card feel
- [ ] verdict does not use loud semantic color

### Practice

- [ ] “Your turn” obvious in < 1 second
- [ ] selected side obvious
- [ ] both side counts visible
- [ ] engine answer not leaked
- [ ] environment recedes
- [ ] board remains the dominant object

---

# 19. 不建议做的事情

这一轮不要：

- 加 dark mode；
- 加更多 bird / feather UI icon；
- 加持续 ambient animation；
- 加 glass blur；
- 加更多 cards；
- 重新设计 Stockfish / Maia / classification semantics；
- 把音乐元素塞进每个 icon；
- 因为“艺术感”而降低文字 contrast；
- 把 Project Kylin 的黑色 / lime / cyber grid 引进来；
- 重新做 first-visit cinematic intro。

---

# 20. 最终目标

如果这一轮修好，Home 不应该再像：

> 一个漂亮的 chess dashboard。

而应该像：

> **一个安静的窗边学习桌，棋盘已经在那里等你。**

Review 不应该像：

> 一个复杂分析工具换了浅色主题。

而应该像：

> **棋盘保持不动，界面一次只把一个决定放到你面前。**

Practice 不应该像：

> Review 中又打开一个功能模块。

而应该像：

> **周围的信息都退开，只剩棋盘和“轮到你了”。**

这才是 Windowlight / Bluebird V2 真正需要完成的最后一层：

```text
不是更多装饰，
而是更好的距离、空气、重心和退场。
```

---

# 21. 建议给 Codex 的执行约束

在下一轮 prompt 中明确写：

1. 先读 `FIX.md` 和 `docs/design/windowlight-bluebird-v2.md`。
2. 不以“implemented”作为视觉验收通过的证据。
3. 必须把 production screenshot 与 `01-home.png` ～ `04-practice.png` **并排人工比较**。
4. 参考图是 composition authority，不是 pixel target。
5. 优先修 Home，而不是全站一起改。
6. 每轮只改一个 scene：
   - Home；
   - Rail / icons；
   - Review Start；
   - Key Moment；
   - Practice。
7. 每轮都用真实浏览器检查 1440×900 和 1280×720，再看 mobile。
8. 不允许仅因为 Playwright snapshot 更新成功就宣布视觉完成。
9. 不修改棋类分析语义。
10. 不用生成效果图中的 decorative text、script quote、bird、feather 作为 UI 元素。

---

## 建议的验收顺序

```text
Room V2
   ↓
Home scene
   ↓
Rail / icon optical pass
   ↓
Head variants
   ↓
Review Start
   ↓
Key Moment
   ↓
Practice
   ↓
Library / Stats / Settings cleanup
   ↓
full acceptance
```

这一顺序可以避免现在的问题再次发生：

> 先建立一个全站模板，再把所有页面套进去。

下一轮应该反过来：

> **先把 Home 这一幕做到真正成立，再抽象出其余页面真正需要共享的东西。**
