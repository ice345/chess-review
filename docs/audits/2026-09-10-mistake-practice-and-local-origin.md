Status: Historical
Baseline: 2026-09-10 working tree (R1–R5 + S1)
Superseded by: [docs/mistake-practice.md](../mistake-practice.md)
Do not use as the current product contract.

# 本地连接修复与单盘错题练习

2026-09-10；在 R1–R5 + S1 工作树上追加，未改棋子或配色。

## 连接问题

用户在 `localhost:3000` 看到 “Open this website to change its platform
connection.”。这是本应用 `platformRequest` 返回的 403，不是 Chess.com 的
离线响应。使用本地地址发送无效数据可复现：请求在输入校验前即被来源检查拒绝。

Next 使用监听地址构造 `request.url`，可能与浏览器使用的 localhost/127.0.0.1
不同。现在仅在内部 URL 是本地监听地址时，接受同端口的合法 loopback Host；
浏览器 Origin 仍需精确匹配，不信任任意域名或转发地址。受信任公网代理路径
保持原有严格校验。错误文字也改为实际的地址/代理配置提示。

浏览器回归通过正常本地请求得到 400 输入错误、跨站请求得到 403，证明前者已
进入 handler；这不是对用户账号执行真实历史同步。用户棋库与同步断点未删除。

## 新增错题练习

Review 页的 **Practice my mistakes** 提供选择执棋方、可选 inaccuracies、
错误前局面、隐藏答案、点选/拖动/键盘走棋、升变、提示、查看答案、逐步浏览变例、
打开原始证据和下一题。摘要区分独立解出、提示后解出、查看和跳过。

不在已存 MultiPV 中的走法会补跑浏览器 Stockfish；引擎失败、取消或超时不判错。
接受接近最佳的替代解，不要求只猜同一条 UCI。新增练习规则在 analysis 包，
复用既有评分视角和 WinPercent；不修改原棋局分类或 Accuracy。规则、引擎深度
和限制见 [功能契约](../mistake-practice.md)。

首版只保留本次会话，不修改 Training V3 的“已回顾”记录，尚无跨会话错题
统计或间隔复习；没有把查看答案记作掌握。

## 接下来按这个顺序

1. **实际发布验收**：修补后的 Linux 镜像、NUC 实机资源占用、Cloudflare
   正式 HTTPS、手机下载/恢复；若开放 Lichess 再做真实授权验证。
2. **S2b 错题记录**：保存每次尝试、提示和查看状态，覆盖备份/恢复、删除、
   并发及旧版迁移，再把跨棋局待复习列表接上 Training。
3. **S2c 复习安排**：根据真实尝试记录安排重访，展示可解释的到期原因；
   不把点击“已回顾”或看过答案当作答对。
4. **长期运行**：浏览器容量提示、可恢复的缓存淘汰、持续依赖审计和发行记录。

暂不扩展收费、在线对弈、云账号或艺术重设计。首发仍定位于免费复盘与学习。

## 验证

- `pnpm test`：404 项通过（Web 286、analysis 79、其他核心包 39）；收尾又单独运行 analysis 包 79 项通过。
- `pnpm typecheck`、`pnpm lint`、Browser Core `pnpm build`：通过。
- `playwright.release.config.ts`：110 条通过，3.4 分钟，覆盖三种桌面浏览器和两种手机尺寸配置。包含真实 WASM 对未列出候选的补充判题、取消/失败重试、会话结果、棋盘输入、本地同源 400/跨站 403，以及既有发布路径。
- 开发模式新增界面首轮仅因状态区域选择器同时匹配棋盘拖动播报而失败；限定到具名 Answer feedback 后 4 条通过；最终生产回归包含扩充后的 6 条新路径 × 5 配置。
- `git diff --check` 通过。核对桌面和手机尺寸截图；模拟器不等同于物理设备验收。

没有执行用户账号的完整历史同步，没有连接 NUC 或公开发布。

本地生产预览已启动于 `http://localhost:3000`，release 标识
`local-f284ac8`。使用 localhost 和 127.0.0.1 分别重测同源无效请求，均得到
400 输入错误；截图所示的来源误拦截路径已解除。用户可刷新后重试 Resume。

## 逻辑提交

分支：`codex/free-stable-practice`。按依赖顺序整理此前未提交的稳定版工作，
再独立保留本次修复和功能：

- `6ae37a7`：依赖补丁和 IndexedDB 测试支持。
- `92d369c`：本地数据、进度、Notebook 和备份恢复。
- `a75f207`：平台请求保护与公开能力边界。
- `0bbc8ab`：本地 loopback 来源修复。
- `e438345`：导入、复盘、Training 回顾和 Notebook 界面。
- `658f659`：NUC 部署、回退与发布检查。
- `f284ac8`：可验证替代解的错题练习。

验证针对最终组合工作树，不宣称逐个中间提交都单独运行过完整测试。审计记录
和参考设计单独提交；未推送远端。
