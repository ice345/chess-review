# Debian NUC 部署（已有 Cloudflare Tunnel）

适用目标：你的 NUC6CAYS，Debian、8 GB 内存、512 GB 存储，没有公网 IPv4。
这是 Browser Core 复盘网站：服务器提供页面和平台连接，Stockfish WASM 在访客浏览器运行。默认不运行 Maia、Ollama 或服务端整局分析。

拓扑：访客 HTTPS → 现有 Cloudflare Tunnel → Debian 本机 `127.0.0.1:8080` → Nginx → 一个 Next.js standalone 进程。无需公网端口转发或本机证书。

## 0. 快速开始（按顺序照做即可）

分两台机器：**A = 构建机**（你的 Mac 或 x86 CI，装有 Docker buildx），**B = NUC**。

| # | 在哪台 | 命令 / 操作 |
| --- | --- | --- |
| 1 | B | 装 Docker Engine + Compose 插件（[官方 Debian 步骤](https://docs.docker.com/engine/install/debian/)），确认 `docker info`、`docker compose version`、`python3 --version` 正常 |
| 2 | A | `pnpm install --frozen-lockfile` |
| 3 | A | `pnpm test && pnpm typecheck && pnpm lint && pnpm build` |
| 4 | A | `deploy/nuc/build.sh chess-review:beta-001 beta-001`（明确构建 linux/amd64；RELEASE_ID 每次发布必须唯一） |
| 5 | A | `docker save -o chess-review-beta-001.tar chess-review:beta-001`，再把 tar 传到 B |
| 6 | B | `docker load -i chess-review-beta-001.tar` |
| 7 | B | 把整个 `deploy/nuc/` 目录（含 `.env.example`、`compose.yaml`、`release.py`、`smoke.py`、`nginx.conf.template`）放到例如 `/opt/chess-review/deploy/nuc/` |
| 8 | B | `cd /opt/chess-review/deploy/nuc && python3 release.py init` |
| 9 | B | 编辑 `.env`：填 `DOMAIN=chess.你的域名`（只填域名，不加 `https://`、端口、引号、路径）；`chmod 600 .env` |
| 10 | B | `python3 release.py deploy chess-review:beta-001` 然后 `python3 release.py check` |
| 11 | B | `python3 smoke.py`（代理、固定域名、HTTP→HTTPS 跳转、worker/WASM、私有 API 响应头、OAuth 起始跳转） |
| 12 | Cloudflare | 在现有 Tunnel 加一条 Public hostname → `http://127.0.0.1:8080`（见 §4） |
| 13 | Cloudflare | **配置 §4 的三条 Cache Rules**（不配第 3 条会在第二次发版后白屏） |
| 14 | B | `python3 release.py status`，按 §7 清单做真机验收 |

后续更新：跳回第 4 步换一个唯一 `RELEASE_ID`（如 `beta-002`）→ `docker load` → `release.py deploy` → `smoke.py`；出问题用 `python3 release.py rollback`。

只需镜像和 `deploy/nuc/` 目录即可上线，NUC 上不需要 pnpm、Node、源码或模型。

## 1. 准备

NUC 安装 Python 3、Docker Engine 和 Docker Compose 插件。按 [Docker 官方 Debian 安装步骤](https://docs.docker.com/engine/install/debian/)安装对应 Debian 版本的软件包；脚本不改你的系统软件源、交换空间、防火墙或现有 Tunnel。

```bash
docker info
docker compose version
python3 --version
```

Docker 命令须有权限，Docker 服务须随开机启动。只有一个网站实例，不能直接增加 `web` 副本：平台限流和提供方队列是进程内状态。

## 2. 在开发机或 CI 构建 Linux amd64 镜像

在仓库根目录运行。RELEASE_ID 每次发布唯一；有未提交修改时不要只用旧 commit SHA 充当发布版本。

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e --config playwright.release.config.ts
# 安装测试浏览器：pnpm exec playwright install --with-deps chromium firefox webkit

deploy/nuc/build.sh chess-review:beta-001 beta-001
```

`build.sh` 明确构建 `linux/amd64`，可以在支持 amd64 模拟的 Mac Docker 或 x86 Linux CI 上执行。不把 macOS 的 node_modules / .next 复制到 Debian。构建上下文仅包含 Web、共享包和必要配置，排除模型、参考仓库、密钥与原生构建产物。

选择一种传输方式：

```bash
# 无镜像仓库：导出后自行传到 NUC，并执行 docker load -i chess-review-beta-001.tar
docker save -o chess-review-beta-001.tar chess-review:beta-001

# 或使用自己的镜像仓库（把地址换成你的）
# docker tag chess-review:beta-001 YOUR_REGISTRY/chess-review:beta-001
# docker push YOUR_REGISTRY/chess-review:beta-001
```

NUC 仅需 `deploy/nuc/` 这个完整目录和镜像，不需要 pnpm、Node 开发环境、源码或模型。
保留文件布局，例如 `/opt/chess-review/deploy/nuc/`；以下命令均在这个目录执行。

## 3. 配置并启动

```bash
python3 release.py init
# 编辑 .env：DOMAIN 留空，由你填入实际域名；例如 chess.your-domain.com
# 只填域名，不加 https://、端口、引号或路径。
# PORT 默认 8080。LICHESS_CLIENT_ID 可选，用唯一的域名标识；空白时登录保持关闭。
# LICHESS_SESSION_SECRET 已自动生成，不要更换，不要放进 Git。
chmod 600 .env

python3 release.py deploy chess-review:beta-001
# 镜像仓库方式：python3 release.py deploy YOUR_REGISTRY/chess-review:beta-001 --pull
python3 release.py check
python3 smoke.py
python3 release.py status
```

`init` 不覆盖已有配置。修改可选的 Lichess 配置后，可再次对同一个镜像运行 `deploy`；脚本检测环境变量、Compose 和代理模板的摘要变化并重新应用配置。脚本不会执行 `.env` 内的 shell 内容，也不打印密钥。`deploy` 默认使用已加载的镜像，只有 `--pull` 才拉取指定应用镜像；首次使用 Docker 会拉取 Compose 指定的 Nginx 镜像。

发布检查镜像的 Linux amd64 架构、版本标签、代理配置、应用健康状态及实际返回的发布版本，并自动执行代理/资源/OAuth 起始跳转检查后才记为健康发布。运行状态保存在 `.state/release.json`，镜像会解析成不可变的本地 image ID，避免标签变化导致回滚到错误代码。

Nginx 仅发布 IPv4 loopback 端口，Web 的 3000 端口不发布。不要改成 `0.0.0.0:8080`，也不要单独暴露 Web 容器。

## 4. 接入已有 Cloudflare Tunnel

在你现有 Tunnel 的 Published application route / Public hostname 中设置：

- Hostname：与你 `.env` 的 `DOMAIN` 相同。
- Service URL：`http://127.0.0.1:8080`，端口跟随 `.env`。
- 如设置了 HTTP Host Header，改为同一个实际域名；否则保持默认。
- 开启公网 HTTPS 重定向；Nginx 也会把 Cloudflare 标记为 HTTP 的请求跳转到固定 HTTPS 域名。

如果是本地管理的 Tunnel，只将以下路由合并进已有 `ingress`，放在最终 catch-all 前，勿覆盖其他服务。占位符要手动替换，cloudflared 不会读取本项目的 `.env`。

```yaml
ingress:
  - hostname: YOUR_CHESS_DOMAIN
    service: http://127.0.0.1:8080
  # 保留你原有的其他路由和最终 catch-all
```

本方案假设 cloudflared 在 **Debian 宿主机**运行。若你的 cloudflared 自己在容器中，容器的 127.0.0.1 不是宿主机；在 Linux 上需按现有 Tunnel 的部署方式接入宿主网络后再使用这个地址，不能通过开放公网监听解决。

DNS 检查（容易漏）：在 Tunnel 里加 Public hostname 时，Cloudflare 会为它自动创建**代理状态**的 DNS 记录（指向 `<tunnel-id>.cfargotunnel.com` 的 CNAME）。到 DNS 页面确认这一点，并确认该主机名**没有**遗留的 A/AAAA 记录——旧记录会遮蔽 Tunnel，表现为域名打不开或 522/523，而 `smoke.py` 在 NUC 本机却是通过的。证书由 Cloudflare 的 Universal SSL 在以代理模式接管该主机名后自动签发，不要在 NUC 上另行申请证书。

分享链接无需任何代理或服务器改动：`/share#pgn=…` 的棋局内容在 URL fragment 里，浏览器发出请求前就已剥离，服务器只看到 `GET /share`。机制说明见仓库中的 `docs/web-service-boundaries.md`（不在 `deploy/nuc/` 内）。

Cloudflare 缓存配置：Next.js standalone 对静态预渲染的 HTML 页面返回 `Cache-Control: s-maxage=31536000, stale-while-revalidate`（设计给 Vercel 的 CDN，非通用场景），如果 Cloudflare 缓存了这些 HTML，新版本发布后旧 HTML 引用的已变更 JS chunk 路径会 404，**所有命中旧缓存的访客看到白屏或报错**，直到缓存 TTL 过期或手动清除。必须在 Cloudflare 的 **Cache Rules** 配置以下规则，按优先级排列：

1. **Cache Everything**——`/_next/static/*`：这些资产 URL 包含构建哈希，内容不可变。规则：`URI Path` starts with `/_next/static/`，Cache eligibility → Eligible for cache，Edge TTL → Override origin, 1 year。Cloudflare 缓存减轻源站带宽。
2. **Cache Everything**——`/engine/*`、`/sounds/*`：版本固定的 WASM 和音频文件，源站已返回 `immutable`。规则：`URI Path` starts with `/engine/` OR starts with `/sounds/`，Cache eligibility → Eligible for cache，Edge TTL → Respect origin。替换这些文件需要改文件名，不能靠清缓存更新。
3. **Bypass cache**——其余所有路径：规则：`Hostname` equals `YOUR_CHESS_DOMAIN`（放在上面两条之后），Cache eligibility → Bypass cache。这确保 HTML 页面、`/sw.js`、`/manifest.webmanifest`、`/offline.html`、`/api/*` 和 `/share` 全部回源，每次访问拿到当前版本。`/sw.js` 尤其不能被中间层缓存：过期的 service worker 会把旧版本锁定在访客浏览器。

不配置第 3 条的后果：每次发布新版本后，命中 Cloudflare 边缘缓存的访客会收到引用已删除 JS chunk 的旧 HTML，页面无法加载。手动在 Cloudflare 控制台 Purge Everything 可立即修复，但下次发布仍会复发。不要启用 Rocket Loader（它修改应用脚本导致 hydration 失败）。保留 Next 的 `Vary`、缓存与内容类型响应头。发布验收要看实际响应，不能仅看控制台配置。

代理信任条件：Cloudflare 正常边缘请求提供 `CF-Connecting-IP`；Nginx 将验证后的地址覆盖为 `X-Real-IP`，覆盖 Host / X-Forwarded-Host / X-Forwarded-Proto；应用通过 `TRUST_PROXY_ORIGIN=1` 使用与 `APP_ORIGIN` 完全一致的公网 origin。整个宿主机及 Docker 管理权限属于可信范围。不要在此域名前挂可任意修改 IP 头的同区域 Worker，也不要删除访问者 IP 头后还期待按访客限流。

参考：[Tunnel origin 参数](https://developers.cloudflare.com/tunnel/advanced/origin-parameters/)、[Cloudflare 请求头语义](https://developers.cloudflare.com/fundamentals/reference/http-headers/)、[Docker Compose 服务配置](https://docs.docker.com/reference/compose-file/services/)。

## 5. NUC 资源与运维

| 项目 | 默认限制 |
| --- | --- |
| Web 进程 | 一个，容器 1.5 GiB / 2 CPU，Node heap 768 MiB |
| Next 内存缓存 | 16 MiB |
| Nginx | 一个 worker，128 MiB / 0.5 CPU，临时目录 32 MiB |
| 日志 | 每个服务最多 3 × 10 MiB |
| API 入口 | 每地址 4 请求/秒，突发 20；全局 10/秒，突发 40 |
| 连接与请求 | 每地址 32 连接，请求体 64 KiB，代理读取 35 秒 |

64 KiB 是**服务端 API 请求体**上限。PGN 文件和棋库备份在浏览器本地处理，不上传至该 API，因此不受这个入口上限限制。后端另有 R4 的参数校验、20 秒总超时、限流和串行提供方队列；这些限制针对小规模 beta，可依据真实流量再调整，不能理解为容量承诺。

健康检查不请求 Lichess / Chess.com、不启动引擎。Docker 的 restart policy 会重启退出进程，但不会自动重启仅被标记为 unhealthy 的仍存活进程；出现 unhealthy 要检查日志并处理。

```bash
python3 release.py status
python3 release.py check
# 只含路径/状态/耗时的访问日志；不记录查询串、IP、Cookie 或 OAuth code。
docker logs --tail 100 chess-review-gateway-1
docker logs --tail 100 chess-review-web-1
docker stats --no-stream chess-review-web-1 chess-review-gateway-1
```

进程的严重错误可能包含运行时诊断；不要把完整日志公开发布。没有部署第三方遥测或自动报警服务。

棋局、分析缓存和训练进度在**各个访客浏览器的 IndexedDB**，不是 NUC 磁盘里的共享数据库；512 GB 不能为访客提供云存档。使用 Settings 的库备份保留用户数据。管理员另外安全备份 `.env`、`.state` 和上一个发布包/镜像；`.env` 含服务端 Cookie 密钥，不是访客导出文件。

## 6. 更新、回滚与故障

```bash
# 导入或拉取下一个唯一版本后：
python3 release.py deploy chess-review:beta-002
python3 smoke.py

# 回到上一份健康镜像：
python3 release.py rollback
python3 release.py check
```

单机单进程更新有短暂服务中断。更新失败会尝试恢复上一份健康镜像；首次部署失败会停止本项目容器。突然断电 / 强制终止留下 pending 记录时，`rollback` 恢复最后健康版；首次部署没有旧版本时，它会停止残留容器并允许重试。回滚失败会保留 pending，检查 Docker 和日志后再次运行，脚本不伪报成功。

脚本不会删镜像、执行全局 Docker prune、删除容器卷或重建浏览器数据。确保 `.state` 引用的当前/上一版本镜像仍在，不要删除它们。磁盘不足时先用 `docker system df` 查占用，手动删除确认不再需要的旧版本。

这是应用镜像回滚，不会撤销你手动修改的 `.env` 或代理模板，也不是任意版本的浏览器数据格式降级。S1 将浏览器 IndexedDB 从 v7 增量升级至 v8，新增 Notebook store，旧棋局保持原样；备份输出 v2，仍可恢复 v1。**已有访客使用 S1 后，回退镜像必须支持数据库 v8；R5 的 v7 页面不能打开已升级的数据库。** 发布脚本不检查每个访客的数据库，也不会做格式降级。不要通过清空访客数据修复回退错误，应恢复支持 v8 的镜像。首次 S1 发布前导出库备份，后续保留两份支持 v8 的健康镜像用于回退。升级时保持域名、端口、密钥和发布脚本包兼容；域名迁移会改变浏览器存储 origin，需先在原域名导出用户备份，不能靠改 DOMAIN 迁移数据。

## 7. 开放 beta 前的真实环境验收

本地 `smoke.py` 会检验代理、固定域名、HTTP→HTTPS 跳转、worker/WASM、私有 API 响应头，以及配置后的 OAuth PKCE 跳转和 Secure Cookie；它不跟随 Lichess 跳转，也不代替真实授权。

接入实际 Tunnel 后逐项确认：

- 从外网打开实际 HTTPS 域名，首页、Help、Settings 可用；没有 localhost AI 请求。
- 全新浏览器导入 PGN，完成真实分析、取消重试、查看证据和训练回顾；保存 Notebook 笔记与变例，刷新后重新打开。
- 实际 iOS Safari / Android Chrome 测试棋盘、触摸导航、下载备份与恢复。
- 检查 `/engine/stockfish.wasm` 内容类型为 `application/wasm`，控制台无 worker/CSP 错误；API 不被 Cloudflare 缓存。
- 检查 `/sw.js` 的 `Cache-Control` 是 `no-cache`，Cloudflare 未缓存（`cf-cache-status` 应为 `DYNAMIC` 或无此头）。
- 检查 `/manifest.webmanifest` 可访问，返回正确的 `application/manifest+json` 内容类型。
- 复制一条 `/share#pgn=…` 链接在全新浏览器标签打开，确认棋局自动导入库中并跳转到复盘页。
- 用自己的 Lichess 账号执行授权、取消、同步、断开；确认回调域名与 Cookie 正确。Chess.com 测试公开账号同步及错误恢复。
- 在 NUC 记录内存、CPU、网络和错误率，再决定公开规模。保存两个真实发布版本并演练回滚。

这些真实环境项目通过前，状态是“本地工程已验证、待部署验收”，不是已上线。
