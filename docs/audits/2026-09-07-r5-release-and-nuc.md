# R5：生产构建验收、棋库性能与 Debian NUC 部署

状态：本地工程与部署演练完成；尚未连接用户 NUC、配置真实 Cloudflare 域名或发布公开 beta。目标机器按用户提供的信息：Debian / NUC6CAYS / 8 GB / 512 GB，已有 Cloudflare Tunnel，无公网 IPv4。域名留空由用户配置。

## 实际修复

1. History 每个快照重复调用 `parsePgn` 重放所有已保存棋局。导入时现在复用 canonical parser 结果保存可丢弃索引，绑定原始输入、初始局面和 ply 数；旧数据分批升级，显示进度并响应导航取消。过期写入遵守 epoch 和删除规则，不改变用户时间戳。备份不导出索引，也不信任传入索引，恢复时重新生成。完成状态仍检查缓存、引擎/算法/MultiPV 兼容性和完成记录。
2. 快照按源局预先索引最新后台任务，避免每条 synced record 重扫整份 job history。
3. 浏览器调度器原本允许两个后台整局任务占满两席。新增回归先复现前台无法开始；应用现在只允许一个后台整局任务，占用另一席的前台任务可以立即运行。调度类仍支持其他显式配置；后台任务不强制抢占，分析深度、MultiPV、Accuracy、POV、阶段和分类算法均不变。
4. Next standalone 在实际容器里用内部监听地址构造 `Request.url`，导致公网域名 OAuth 被误认为未配置。新增明确启用的可信代理 origin 解析：Host、X-Forwarded-Host 和 HTTPS 必须与配置完全匹配。默认不信任转发头。Nginx 固定域名、覆盖这些头，并且 Node 端口不对宿主机发布。
5. 生成 standalone 产物，显式携带静态资源与 worker/WASM；Next 内存缓存限制为 16 MiB，增加无提供方请求的 `/api/healthz` 发布标识。
6. 提供 [NUC 部署说明与脚本](../../deploy/nuc/README.md)：Linux amd64 镜像、受限的单 Web 进程、Nginx、loopback 入口、私有配置初始化、配置检查、镜像版本记录、失败自动恢复、手动回滚与功能 smoke。发布只有在健康版本、资源和配置后的 OAuth 起始跳转检查都通过后才记录为成功。

棋子、颜色、品牌资产和所有棋类算法语义保持原样。没有修改用户的 `opencode.json`，没有提交或推送。

## 1,000 / 10,000 局基准

环境：本机 macOS arm64、Node 26.8.1、Playwright Chromium，独立生产服务器；修复后的测试使用真正的 standalone 目录。每条记录有唯一玩家头，合法且可复现的 21 ply 主线。测量从导航到 History 显示完整条数，固定只渲染首批 60 行，再测试重访和精确筛选。

| 数据量 | 修复前打开 | 有索引后打开 | 修复前重访 | 有索引后重访 | 修复前主线程长任务 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 1,571 ms | 86 ms | 1,607 ms | 103 ms | 1,479 ms |
| 10,000 | 14,225 ms | 165 ms | 14,137 ms | 180 ms | 14,079 ms |

最后一次旧数据升级测试：1,000 局首次 1,912 ms；10,000 局首次 15,535 ms、重访 179 ms。之前一次相同升级测试为约 20.1 秒，因此首次升级仍应按十几至二十秒预期，而不是宣称所有旧库瞬间加载。升级分批执行，两次修复后的基准都未观察到超过 50 ms 的主线程长任务。最终有索引库精确筛选约 9 / 12 ms。

这是单次可重现基准及复测，**不是 10,000 份完整 Stockfish 分析、统计学延迟分位数、真实手机或 NUC 测量**。原始测量保留在 [benchmarks](assets/r5/benchmarks/after-library-10000.json)。索引增加少量存储；大规模分析缓存、超长棋谱和真实低端设备仍可能有不同的内存与耗时表现。

```bash
pnpm build
pnpm test:e2e --config playwright.benchmark.config.ts
# 独立运行，不能同时占用 3001：
BENCHMARK_LEGACY=1 pnpm test:e2e --config playwright.benchmark.config.ts
```

## 浏览器与回归

- `pnpm test`：372 项（Web 258，其余包 114）。
- `python3 -m unittest discover -s deploy/nuc -p 'test_*.py'`：8 项配置、重复部署与恢复回归。
- `pnpm typecheck`、`pnpm lint`、`pnpm build`：通过。
- `pnpm test:e2e --config playwright.release.config.ts`：50 条通过，单 worker，3.4 分钟。包含 Chromium / Firefox / WebKit / Pixel 7 尺寸 Chromium / iPhone 13 尺寸 WebKit。
- 50 条覆盖保存进度后刷新、跨棋局回顾、备份到全新上下文恢复、冲突/跨标签页失效、被阻塞的 DB 升级、窄屏操作、真实 Stockfish 分析、纯事实 Study、零 localhost AI 请求和公开响应头。
- 取消/重试测试模拟 2 核和 2 GiB 提示；Chromium 额外使用 CDP 4 倍 CPU 降速。可取消、重试并恢复缓存；这不是物理设备测试。
- 旧 R3 测试原本点击“确认回顾”后立即硬刷新，可能打断尚显示 Saving 的写入。现在先等待界面确认已保存，再检验刷新后的持久进度；没有放宽保存数量或恢复断言。
- 生产测试入口改用 `scripts/start-web-standalone.mjs`，不再用 `next start` 掩盖 standalone 资源打包遗漏。CI 增加完整浏览器组与 Linux 容器/代理检查；工作流已写入，未声称远程 CI 已运行。

## 容器与入口演练

实际构建 Linux amd64 镜像并在本机 OrbStack Linux 中运行。最后候选：`chess-review:r5-candidate`，release `r5-local-20260907-candidate`，基于当前未提交工作区。不是已发布的 registry 版本或已部署 NUC 版本。

代理检查：正确 Host 200，错误 Host 421，Cloudflare HTTP 标记跳转固定 HTTPS 域名；worker 和 WASM 内容类型/魔数正确；私有 API no-store/no-referrer；Lichess 配置开启后 PKCE S256 跳转指向正确域名且 Cookie 为 Secure/HttpOnly/SameSite=Lax。检查不跟随授权跳转、不登录真实账号。

使用无提供方请求的隔离输入，验证同源非法输入 400、跨站 403、超过 64 KiB 的请求体 413。60 个请求、并发 16 的入口小型突发检查得到 18 个 200、42 个 429，429 包含 Retry-After 和 no-store；访问日志不含测试查询串标记。此检查仅验证限流生效，不能当作负载容量测试。[原始结果](assets/r5/benchmarks/proxy-limits.json)。

测试空闲时 Web 约 201 MiB、Nginx 约 4.8 MiB；这是 Mac 上 Linux 容器的快照，不是 NUC 实机内存保证。镜像约 277 MB（未压缩）。

演练包括：正常升级、手动回到上一健康镜像、故意退出的坏镜像触发自动恢复，以及进程健康但代理 OAuth 配置失败时拒绝提升版本并恢复。发布脚本保留固定 image ID，原子保存并同步状态文件，检测环境变量、Compose 和代理模板摘要变化；配置与镜像完全一致时不重建容器。脚本不会修改现有 Tunnel、执行全局 prune 或删除浏览器数据。

## 仍需真实部署验收

- 用户填入域名并在 NUC 上启动；将现有 Tunnel 的该域名路由接到本机端口。
- 从真实外网检查 HTTPS、Cloudflare 缓存/响应头、worker 和 WASM，不只检查本地 HTTP 代理。
- 真实 Lichess 授权、取消、同步、断开，以及 Chess.com 实际同步。
- 实际 iPhone / Android 和 NUC 资源、网络、错误率与目标规模测试。
- 保存实际发布版本并在 NUC 演练恢复；这些完成后才将公开 beta 标记为已发布。

2026-09-08 收尾复验：8 项部署脚本测试再次通过；配置摘要覆盖代理模板与 Compose，缺失的 bind 文件不会被 Docker 自动建成目录；功能门禁使用显式异常，Python 优化模式不能关闭它。本地 standalone 预览恢复到 3000 端口。
