# Bluebird 全平台实施与接手手册

2026-09-24 · 用户已认可 14 页设计方向，并要求开始正式实现。

## 一、必须保留的功能

Stats `/stats` 保留为独立主导航入口。原型中的“成长”仅为命名探索，正式实现继续使用 Stats，避免用户误以为统计被移除。保留所有现有指标：Records、Games、Analyzed、Pending、Manual/Chess.com/Lichess、Time class、Win/Loss/Draw、Mastered/Due/In progress。

关键口径：`snapshot.records` 是可复盘记录（含手动输入），`snapshot.games` 是同步棋局集合；它们会重叠，不能相加当总局数。分析状态来自 canonical `statuses`。来源、结果和时间类型可切换全部 records 或全部 synced games 聚合，后者包含尚未进入复盘的同步对局；胜负相对来源账号，缺失不能算输或平。FEN 不是完整棋局，不能为其计算整局准确率。初期保持已有记录统计语义并增加独立同步集合视图，明确展示口径；若后续建立跨集合唯一棋局总数，需单独定义去重、手动/同步重复、PGN 多局与 FEN 排除规则，并添加真实 fixture 回归测试。

图片中的数据范围作为需求，排版不作为参考。新 Stats 为全宽指标带、独立来源行、结果/时间两张紧凑分布面板、横向练习摘要；没有跨多行强撑高度的两列大表。

## 二、视觉与导航

采用 [逐页设计方案](../proposals/2026-09-23-bluebird-platform-redesign.md)。统一顶部导航、实底阅读表面、居中的页面宽度。保留现有全部路由；第一轮不删除 Review 入口，待 Library/Review 共用视图后再合并。移动端同一 nav 改为菜单，必须支持 Escape、点击外部、失焦关闭、路由变化收起。

按页面族整合，禁止复制原型中的模拟数据进正式应用。棋盘、评价、分类、Maia、LLM、训练算法不改语义。继续英文产品文案以匹配当前语言设置，不做半套国际化。

## 三、资产清单与接手方式

| 资产 | 文件 | 来源与使用 |
|---|---|---|
| Chess.com 图片标记 | `packages/ui/assets/providers/chesscom-64.png` | 现有用户提供棋兵图，16–24px，保留品牌色 |
| Lichess 图片标记 | `packages/ui/assets/providers/lichess.svg` | 现有 lila 来源 SVG，用 CSS mask 着墨色 |
| 手动/PGN | `packages/ui/assets/providers/notation.svg` | 本轮原创线稿文件/棋谱图形，替代字母 P |
| FEN | `packages/ui/assets/providers/position.svg` | 本轮原创棋盘局面图形，替代字母 F |
| 蓝鸟水彩 | `docs/design/prototypes/bluebird-platform-v4/assets/bluebird-watercolor.png` | 上轮内置 imagegen 原创方向样稿，完整 prompt 在方案 §10 |
| 功能图标 | `packages/ui/src/icons.tsx` | 现有统一 SVG 图标集，优先复用 |
| 棋子 | `apps/web/public/pieces/feather_porcelain_v1_1/` | 保持现有棋子，不使用字母代替棋子 |

统一入口是 `ProviderMark`。任何来源连接、列表、统计、导入都消费它，不自行写 C/L/P/F 字母徽标。图标旁仍保留平台名称，单独图标提供可访问名称。没有品牌资产时先补资产，不能退回字母缩写。新增 SVG 无字体、无外链、无脚本，直接留在版本库，可离线继续工作。新水彩图正式接入前压缩并生成合适尺寸，不引入运行时图像生成依赖。

## 四、任务与文件级实施顺序

### A1 本轮起步：正式外壳、Stats、来源图标

- `app-shell.tsx`：顶部外壳、同一份导航、主操作和选中状态；保持现有路由和无障碍行为。
- `chrome.css`：替换外壳区样式，保留各路由共享基础类；不添加第二套覆盖式外壳。
- `tokens.css`：顶部导航尺寸，取消桌面左轨宽度；保留棋盘与语义颜色。
- `stats-page.tsx` / `stats.css`：保留真实 hook、订阅、loading/error/retry；用指标带、来源行、分布条、练习带替换旧大表。
- `ProviderMark` 与 assets：所有来源统一图片/SVG，去掉字母降级。
- 同步视觉合同及 UI 文档，注明尚未迁移的页面内部结构。

A1 验收：真实浏览器有数据 Stats 与手机；空态/错误保留；所有原有数字可定位；导航可达；来源图标无缺失；不再加载全屏房间背景；web tests/typecheck/lint/build。

### A2 首页 → 导入 → 棋谱库

- `home-workspace.tsx`：水彩开场、最近记录、今日练习、最近棋局；无记录时主操作导入。
- `import-page.tsx` / `import-desk.tsx` / `connected-accounts.tsx`：单一区域来源切换，保留输入草稿、文件、多局 PGN、FEN、公开账号同步、取消与重试。
- `history-page.tsx` / `review-index-page.tsx`：共用 LibraryView，保留 `/review` 旧路由；URL 筛选、返回滚动、批量操作。
- 不改 IndexedDB schema；若必要，必须独立迁移和恢复测试。

### B 棋盘工作台

- `review-shell.tsx` 负责不重挂载棋盘的稳定布局；复盘/着法/教练/引擎/笔记共用上边界和棋局身份。
- 当前任务右栏，整局图表全宽置于下方；长 PV 和着法列表有局部滚动，低高度视口允许文档滚动。
- `review-route-panels.tsx`、`review-notebook-panel.tsx`：结论/证据/延伸三级；保存失败、未配置服务与生成错误可见。
- 完成页取消大几何飞鸟，保留真实读完/提前总结区分。
- 不改变分析线程或缓存键，不因模式切换启动新引擎。

### C 练习、设置、帮助、分享

- 练习：今日任务优先，研究维度二级化；保留调度与掌握算法。
- 设置：类别导航 + 当前配置区，保留直接锚点、真实保存、备份恢复。
- 帮助：阅读宽度与目录；分享：解析、预览、选择保存，错误可恢复。
- 导出延续相同图标语义，PNG 是输出，不新增 OCR 导入。

### D 综合验收

320/390/768/1024/1440px、低高度、200%缩放、键盘与减少动态；长姓名/PV/笔记、多局PGN、离线、可选本地服务缺失；完整导入→分析→笔记→练习→统计流程。逐页截图人工检查，不能以新 baseline 自动通过代替审美验收。

## 五、当前状态与接手入口

- 设计稿：14 页已由用户认可。
- A1：本轮实施，完成情况与实际验证写入下方记录。
- A2/B/C/D：未完成，不得按已交付处理。
- 工作区已有大量前序修改，不可执行 reset/clean 或覆盖整个文件树。按本轮实际 diff 继续。
- 运行：`pnpm dev`；浏览器核心单独启动用 `pnpm dev:web`。不要重复启动已有服务或下载模型。
- 静态原型：`python3 -m http.server 3014 --bind 127.0.0.1 --directory docs/design/prototypes/bluebird-platform-v4`。
- 下一位 AI 先读本文、整体方案、实际生产代码及 `git status`，以真实 hook 为数据源，禁止复制原型数字。


## 六、本轮实施记录（2026-09-24）

已实施 A1：

- 顶部导航与手机单一菜单；取消全屏房间照片；保留全部七个路由入口。
- Stats 已接真实 library snapshot 和训练队列；指标带、来源图标、结果/用时分布、练习摘要。
- 新增 Distribution scope：全部复盘记录 / 全部同步棋局。未分析的同步对局也参与后者的元数据统计。头部分析计数仍明确以复盘记录为单位。
- 缺失元数据独立显示 Not recorded；零胜/负/平仍显示 0。无复盘记录但有同步棋局时仍显示统计，避免误判为空库。
- 手动/PGN 与 FEN 的原创 SVG 已保存；Chess.com/Lichess 复用现有图片，所有调用 ProviderMark 的位置同步生效。
- A2/B/C 尚未整体实施。旧页面内部构图暂时仍在新的全局外壳里，不应将此称为全站整合完成。

浏览器实际检查：1280px Stats 有数据；390/320px Stats；320px 无横向溢出；手机菜单展开与 Escape 返回；1280px 引擎工作台加载后的棋盘可见。切换同步集合后当前测试浏览器显示 100 局，77 胜 / 17 负 / 6 平，来源 Chess.com 100；这只是本地验收数据，不是硬编码或用户截图中的 157 局。

下一批从 A2 开始：首页正式使用已留存水彩资产，导入变成统一来源切换，Library/Review 合并组件而保留旧地址。随后按 B 迁移复盘内部结构。不要重做 Stats 的元数据统计，也不要把两个集合相加。

最终工程检查：Web 53 个测试文件 / 409 项测试通过；Web 和 UI 类型检查通过；本轮修改的三个 TSX 文件 ESLint 通过；Web 生产 build 通过（27 个静态页面）；`git diff --check` 通过。没有执行全站端到端套件、系统减少动态或全部错误状态验收，不能把本轮检查当作 D 阶段完成。

## 七、A2 页面整合记录（2026-09-24）

已接入生产：

- 首页改为水彩入口 → 最新真实复盘记录 / 练习入口 → 最近棋局。没有虚构今日任务数。自由走棋与 FEN 打开能力保留在可展开 Position desk，主页不再重复展示导入表单与账号面板。
- 蓝鸟原图压缩为 `apps/web/public/atmosphere/bluebird-watercolor.webp`，约 112KB；原始图和 prompt 保留在上文所列设计目录。
- 导入页使用 `PlatformHeading` 与一份来源面板；From account 在同一区域显示真实账号与同步棋局。输入区隐藏而不卸载，PGN/FEN 分别保留会话草稿；账号内容位于 form 外部，不产生嵌套表单。
- `/history` 和 `/review` 共用 `HistoryPage`，后者为 savedOnly 视图。保留所有保存记录（不仅已分析记录），取消旧入口最多显示 8 项的限制，改用现有分页。旧地址及真实分析/删除确认保持可用。
- 账号无头像时的姓名字母改为 ProviderMark 图形；平台名称仍明确显示。

实现文件：`home-workspace.tsx`、`import-page.tsx`、`import-desk.tsx`、`history-page.tsx`、`review-index-page.tsx`、`platform-heading.tsx`、`connected-accounts.tsx`、`platform-pages.css`。没有改分析算法或存储格式。

实际验收：桌面首页/导入/列表真实渲染；390px saved reviews；320px 首页、导入、history、review 无横向页面溢出；320px 账号来源可达。输入 PGN 草稿 → 账号 → PGN → FEN 草稿 → PGN，原 PGN 草稿保留；DOM 无嵌套 form。过滤无结果后 Clear filters 恢复；Saved reviews 链接进入原 `/review` 地址并显示共用列表。

本轮没有触发外部同步、删除棋谱、重新跑整局分析或真实文件选择器上传。底层 PGN/FEN 与文件导入回归由现有测试覆盖，不声称已完成全部手工端到端导入测试。

A2 剩余细节：过滤条件 URL 持久化、返回后的滚动恢复、完整文件选择/多局选择实机验证、空库截图。B（五模式工作台）/C（练习与资料页）/D（全矩阵综合验收）仍未完成。下一次先补 A2 状态恢复，然后进入 B，不要再次重写已经接好的页面。

## 八、练习 / 统计 / 棋谱库修订（2026-09-24）

用户确认：Practice 应是真正的错棋练习页；Your game 数据属于 Stats；Library 不应是平铺筛选表；复盘点下一步时页面不得跳动；Chess.com 标记改用官方兵形 SVG。Home 本轮不改。

已实施：

- Practice `/training` 只保留今日任务、练习队列、以及为练习准备分析的 history job。完整玩家报告不再放在练习页。
- Stats `/stats` 在原有库计数之后接入同一份 `advanced-study-v2` 报告（Your game：rating / openings / phases / mistakes / highlights / plan / coverage）。算法与过滤口径未改。
- Library 改为按月份分组的曲目单，筛选改为始终可见的搜索行 + chip，不再使用折叠的 Filter 卡片。
- Chess.com `ProviderMark` 改用官方兵形 SVG（品牌绿 `#81B64C`），处理方式与 Lichess 矢量标记同一量级。
- 复盘步进：transport 按钮 mousedown 不再抢焦点；工作区 / 裁决面板关闭 overflow-anchor；去掉每步 dual-verdict 入场位移动画，避免点下一步时整页下滑。

未改：Home 构图、分析语义、IndexedDB schema。

## 九、Stats 抬升与 Review 工作台（2026-09-24）

- Stats：Your game 紧接在一行库计数之后；来源/结果/用时收到页面下部 “The collection”。切换 Opening / Endgame 等章节不再 `scrollTo(0)`。
- Review：模式栏（Review / Moves / Study / Analysis）从顶栏挪到右侧任务列；去掉大号 MOVEMENT 页头；棋盘上的圆形工具钮改为步进条旁的细线图标。
- 导航图标按「リズと青い鳥」转译（窗、谱架、反复记号、谱表），仍是同一套 16px 线稿，不加鸟。
- Library 的 Import a game 改为细线下划线，不再用胶囊主按钮。

## 十、完成页 / 节目单 / Stats 氛围（2026-09-24）

完成页几何飞鸟已删除，不换成官方电影素材。结束态是同一张纸上的课业单：谱表细线、黄铜 kicker、衬线收获句、节目单事实行、练习位置收入 details、一个实心主操作。空桌用谱表记号替换抽象鸟。谱表记号不在 Library / Stats 页头重复盖章。

Library 与 Saved reviews 按月份做乐章编号（罗马数字 + 衬线曲名）。Stats 保留 Your game 结构，只加冷窗 wash 与黄铜 kicker，不重做仪表盘。Home 水彩仍是唯一的鸟插画。

## 十一、上线前审查修复（2026-09-24）

- 空态主按钮不再强制白字（与浅蓝底对比不足）。
- Help 用户可见词为 Practice，不再写 Training。
- Library 行不再为缺失结果留 76px 空列；Open 始终可见。PGN Result 显示为 1-0 / 0-1 / Draw，不写入 Stats 的账号胜负。
- 手机 Review 棋盘列按评价条宽度收缩，消除横向溢出。手机菜单 Import 与其他入口同一行样式。
- Stats/Practice 玩家选择标签为 Whose games；手动对局在同等局数时默认 White。
- Import 未选文件时不显示 Choose another file；占位符改为短句。
- Practice 乐章步骤条不换行。完成页操作保持一行。
- 404 使用空桌样式。ui-spec 顶栏外壳取代左轨与房间照片。
- Chess.com / Lichess 同步：账号必须匹配白或黑，不再默认 Black；Lichess 无 winner 且非和棋状态时不记成和棋。

## 11. Browser audit follow-up: Practice decision boundary

See [the detailed audit](../audits/2026-09-24-atmosphere-practice.md). Decision links now
open at faultPly - 1 while preserving the evidence id. A source-decision strip on
Stats mistake links makes before/played-move navigation explicit. Open-book queue
reviews can only record exposed, not self-declared unaided mastery. Queue/player
scope and the manual-player sync-backlog leak are fixed. Practice gains a bounded
cool task sheet / warm method margin. Full queue-to-board attempt integration and
mobile rendered acceptance remain outstanding; the browser viewport override did
not take effect during this audit. Web: 53 files / 412 tests, typecheck, targeted
lint and production build passed.
