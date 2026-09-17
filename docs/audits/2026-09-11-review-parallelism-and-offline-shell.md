Status: Historical
Baseline: 2026-09-11 (S3)
Superseded by: [docs/analysis-scheduler.md](../analysis-scheduler.md)
Do not use as the current product contract.

# 复盘并行度与离线外壳（S3）

日期：2026-09-11；范围：`packages/stockfish` 的整盘复盘 worker 池，以及公开
Browser Core 的静态资源缓存与离线外壳。**没有改动任何棋类算法语义**：WinPercent、
Accuracy、Divider、分类、Great/Brilliant、Human Difficulty、引擎缓存键与
`OBJECTIVE_ALGORITHM_VERSION` 全部保持原样。

## 1. 整盘复盘并行度

**改动前**：`BrowserStockfishPool` 把池大小硬编码为 `Math.min(2, size)`，而调用方
（`apps/web/src/hooks/use-review-analysis.ts`、`apps/web/src/lib/auto-analysis.ts`）
都传 `1`。整盘复盘实际只用 **一个** worker，10 核机器上 9 个核闲置。

**改动后**：新增 `reviewWorkerBudget()` = 逻辑核数的一半，下限 1、上限 4；
worker 按需创建，短棋局不会再编译用不到的引擎。单盘内的并行度与调度器是两层
独立上限：调度器仍只允许两个引擎任务同时运行、其中至多一个整盘任务，交互落子
与变例分析始终优先。同步账号棋局仍严格串行，只是单盘内部用满设备预算。

**为什么不是"用满所有核"**：页面 UI、交互棋盘搜索和可选的本地 Maia/Coach 服务
都需要 CPU；每个 worker 都要独立编译多兆字节的 WASM 引擎，多开一个的代价是真实
的内存与启动时间。上限 4 是把"明显更快"和"不把设备拖垮"分开的位置。

## 2. 静态资源不可变缓存与离线外壳

**改动前**：引擎与音效资源没有任何缓存策略，实测响应头是
`Cache-Control: public, max-age=0`；没有 manifest、没有 Service Worker，离线完全
不可用。

**改动后**：

- `next.config.ts`：`/engine/*` 与 `/sounds/*` 标记 `max-age=31536000, immutable`；
  `/sw.js` 标记 `no-cache`，避免长期存活的 worker 把访客钉在旧版本上。
- `apps/web/public/sw.js`：`/engine/*`、`/sounds/*`、`/_next/static/*` 走
  cache-first；页面导航走 network-first，在线访客永远拿到当前版本，缓存只兜底；
  `/api/*` **完全不拦截**，平台会话、来源校验和服务端限流行为不变。
- 客户端路由不产生文档请求，因此页面会告诉 worker 记下已打开的复盘地址；worker
  只接受白名单前缀，拒绝跨源地址。
- `apps/web/public/offline.html` 是唯一预缓存的页面，未访问过的地址离线时得到它。
- `apps/web/src/app/manifest.ts` 提供安装元数据。

**不可变缓存带来的硬约束**：替换 `stockfish.wasm` 或 `stockfish.js` **必须换文件名**。
改 `STOCKFISH_VERSION` 只会改变分析缓存键，无法让已经存下旧字节的客户端失效。

## 验证

2026-09-11，macOS（10 逻辑核）、Next 16.3.3、生产 standalone 构建：

| 检查 | 实际结果 |
| --- | --- |
| `pnpm test` | 406 项通过（stockfish 包由 13 增至 15） |
| `pnpm typecheck` / `pnpm lint` | 通过 |
| `NEXT_PUBLIC_APP_MODE=browser-core pnpm build` | 通过，新增 `/manifest.webmanifest` 路由 |
| `pnpm exec playwright test --config playwright.release.config.ts` | 112 条通过、3 条按引擎跳过，3.3 分钟；Chromium / Firefox / WebKit / 手机尺寸 Chromium / 手机尺寸 WebKit |
| 响应头实测 | `/engine/stockfish.wasm` → `public, max-age=31536000, immutable`；`/sounds/*` 同；`/sw.js` → `no-cache`；`/offline.html` 与 `/manifest.webmanifest` 返回 200 |

**并行度收益**（Opera Game，33 ply，真实浏览器 WASM）：

| 深度 | 改动前（1 worker） | 改动后（4 workers） |
| --- | --- | --- |
| 10 | 2.6 s | 未重测（该深度本就接近启动开销） |
| 12 | 3.4 s | 2.9 s |
| 15 | 19.6 s | 5.5–6.4 s |

**结果一致性**（同一构建、同一步 depth 12 的 Opera Game，在页面内覆盖
`navigator.hardwareConcurrency` 做 A/B）：1 worker 与 4 workers 的 Overall /
Opening / Middlegame Accuracy 完全一致（`85.6 / 69.9`、`96.3 / 86.7`、
`66.4 / 52.3`），33 步的质量标签与 Accuracy 逐条相同。这是"并行只改调度、
不改分数"的证据。

**离线的实测边界**：`e2e/offline.spec.ts` 验证引擎与已打开复盘被缓存、离线渲染、
未缓存地址回退页、`/api/*` 不被拦截。该测试只在 Chromium 断言，原因是实测的：
WebKit 在 Playwright 关闭网络时导航直接内部错误；Firefox 与 WebKit 从页面上下文
加载引擎 wasm，service worker 观察不到该请求（诊断中该请求 `fromServiceWorker:
false`，网络切断后引擎加载失败，尽管字节已在缓存中）。跨引擎的离线**渲染**仍然
成立，离线**分析重跑**目前只在 Chromium 得到验证，按实际情况记录而不写成通用结论。

`e2e/mistake-practice.spec.ts` 增加 `test.use({ serviceWorkers: "block" })`：其中两条
workflow 故意让引擎加载失败或被 stub，否则 worker 的引擎缓存会把失败路径掩盖掉。

## 未做

- 未改棋类算法，未动引擎缓存键或算法版本。
- 未做跨设备同步、分享链接、PGN 变例/评论保真、用户手绘箭头、开局 explorer、
  多语言、CSP/HSTS、错误上报。这些仍在上线差距清单里。
- 未在真实 NUC、真实域名或物理手机上验收；本轮全部结论来自本地生产构建。
