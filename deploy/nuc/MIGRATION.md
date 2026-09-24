# 把 Open Chess Review 迁移到 NUC

本文是**线性操作手册**：从头到尾照做即可上线。设计取舍、资源上限、安全边界和
完整故障说明见同目录 [`README.md`](README.md)（规范性文档），本文不重复那部分。

目标机器：`ssh nuc` → `ice@192.168.1.195` · NUC6CAYH（Celeron J3455，4 核）·
Debian · 16 GB · 约 215 GB 可用磁盘 · **没有公网 IPv4**。

拓扑：访客 HTTPS → 已有 Cloudflare Tunnel → NUC 的 `127.0.0.1:8080` → Nginx →
一个 Next.js standalone 进程。不需要公网端口转发，不需要在 NUC 上申请证书。

NUC 上只需要两样东西：**deploy/nuc/ 这一个目录** 和 **镜像**。不需要 pnpm、
Node、源码或模型。

---

## 0. 开始前：你需要填的值

本文全篇用下面这几个占位值。先决定好，后面直接照抄。

| 占位 | 说明 | 本文用到的地方 |
| --- | --- | --- |
| `chess.你的域名` | 复盘站的公网域名。只填域名，**不加** `https://`、端口、引号或路径 | `.env` 的 `DOMAIN`、Cloudflare Tunnel、Lichess 回调 |
| `beta-001` | 第一个发布版本号。**每次发布必须唯一，永不复用** | 镜像 tag、`release.py deploy` |
| `/opt/chess-review` | NUC 上放 `deploy/nuc/` 的位置，可自选 | 本文所有 NUC 路径 |

## 0.1 你 Mac 上已有的棋类镜像不要用

OrbStack 里有 5 个 `chess-review:r5-*` 镜像（`r5-test` / `r5-final` / `r5-proxy` /
`r5-unhealthy` / `r5-candidate`），都是 **2026-09-07 的 R5 本地验证产物**，
`amd64/linux`，目前**没有任何容器引用**。

**不要拿它们发布**，原因有两条：

1. 它们是 R5 时代（浏览器数据库 v7）的构建。S1 已把 IndexedDB 升到 v8，
   **v7 页面打不开已升级的库**——发出去会把现有访客的数据卡住。
2. `r5-unhealthy` 的镜像 label 就是 `r5-deliberately-unhealthy`，是当初用来验证
   健康门禁的**故意坏掉**的镜像。

新流程走 §2 的 GHCR。这 5 个镜像怎么清理见 §9.3。

---

## 1. NUC 上的一次性准备

```bash
ssh nuc

# Debian 上装 Docker Engine + Compose 插件（按官方 Debian 步骤）
# https://docs.docker.com/engine/install/debian/

docker info                 # 守护进程可用、非 sudo 也能跑
docker compose version      # compose 插件在位
python3 --version           # release.py 需要 Python 3

sudo systemctl enable --now docker   # 开机自启

sudo mkdir -p /opt/chess-review && sudo chown "$USER" /opt/chess-review
```

这三条命令都通过再往下走。脚本不会改你的软件源、交换空间、防火墙或现有 Tunnel。

## 2. 在 Mac 上构建并发布镜像

镜像必须在 **linux/amd64** 上构建（NUC 是 x86）。有两条路。

### 方式一（推荐）：CI 构建，推到 GHCR

1. 在 GitHub 打开仓库 → **Actions** → 左侧 **Release image** → **Run workflow**。
2. `release_id` 填 `beta-001` → Run。
3. 等它推完，产物是 `ghcr.io/ice345/chess-review:beta-001`。

workflow 在原生 amd64 runner 上构建同一个 `deploy/nuc/Dockerfile`，**没有模拟**，
比 Mac 上快。它只推不可变的 release tag，**故意不推 `latest`**：`release.py` 靠
镜像 label 校验版本并记录不可变 image ID，移动 tag 会让 `--pull` 失去意义。

也可以推一个 `web-v*` tag 触发同一个 workflow（版本号就取 tag 名）。

> **发布前先确认 CI 是绿的。** `ci.yml` 里的 `nuc-container` job 会在每次 push 上
> 用同一个 Dockerfile 构建并跑真实代理 smoke——那才是这次发布的门禁。release
> workflow 本身不重复这些检查。
>
> 当前 `437af65` 的状态：`web-quality`（typecheck/lint/单测/build）和
> `nuc-container` 都是绿的，**镜像可以发**；两个浏览器 E2E job 是红的（一批 e2e
> spec 还没跟上 bluebird 改版，与可部署产物无关）。详见会话记录，或
> `gh run list`。

### 方式二（备用）：Mac 本地构建 + 传输

```bash
cd /path/to/chess-review
deploy/nuc/build.sh chess-review:beta-001 beta-001   # IMAGE RELEASE_ID

docker save -o chess-review-beta-001.tar chess-review:beta-001
scp chess-review-beta-001.tar nuc:/tmp/
```

`build.sh` 明确构建 `linux/amd64`，在 OrbStack 上可用（走模拟，比较慢）。
它不会把 macOS 的 `node_modules` / `.next` 带进镜像。

## 3. 把 `deploy/nuc/` 送到 NUC

```bash
cd /path/to/chess-review
rsync -av --delete \
  --exclude '.env' --exclude '.state/' --exclude '__pycache__/' \
  deploy/nuc/ nuc:/opt/chess-review/deploy/nuc/
```

两个 exclude **不能省**。`.env`（含服务端会话密钥）和 `.state/`（含 `release.json`
回滚记录和 `nginx.conf`）只存在于 NUC 上，Mac 的源目录里没有——裸的 `--delete` 会把
它们删掉：密钥没了等于让所有访客的登录失效，`.state` 没了等于失去回滚能力。

**只送这个目录。** 不要带 Mac 上本地验收残留的 `.env` / `.state`。

用 GHCR 的话，第 2 步的 tar 不用传，跳过 `docker load`。

## 4. 首次配置

```bash
ssh nuc
cd /opt/chess-review/deploy/nuc

python3 release.py init          # 生成 .env 和随机会话密钥
nano .env                        # 只改 DOMAIN=chess.你的域名
chmod 600 .env
```

`init` 不会覆盖已存在的 `.env`。密钥是自动生成的，**不要更换、不要提交进 Git**。

`.env` 里其余项：`PORT` 默认 8080，一般不用动；`LICHESS_CLIENT_ID` 留空表示不启用
登录（见 §5）。

## 5. Lichess 登录（可选）

要用 Lichess 登录，**必须先到 Lichess 侧注册回调**，否则授权会在 Lichess 端被拒，
登录根本走不完：

1. Lichess 账号设置 → 创建 OAuth app。
2. **Redirect URI 必须一字不差地填
   `https://chess.你的域名/api/platforms/lichess/oauth/callback`**
   ——路径固定、协议必须 https、域名必须与 `.env` 的 `DOMAIN` 完全一致。
3. 把该 app 的 **client id**（不是 app 名称）填进 `.env` 的 `LICHESS_CLIENT_ID`。
4. 换域名要同步改这个 app，旧回调不会生效。

不启用就把 `LICHESS_CLIENT_ID` 留空，`smoke.py` 只检查该接口返回
`configured: false`。

## 6. 上线

```bash
cd /opt/chess-review/deploy/nuc

# 用 GHCR：
echo "$GHCR_TOKEN" | docker login ghcr.io -u ice345 --password-stdin   # 见下
python3 release.py deploy ghcr.io/ice345/chess-review:beta-001 --pull

# 用本地 tar：
docker load -i /tmp/chess-review-beta-001.tar
python3 release.py deploy chess-review:beta-001

python3 release.py check
python3 smoke.py
python3 release.py status
```

关于 `docker login`：GHCR 上的包**默认是私有的**，首次拉取需要登录。用带
`read:packages` 权限的 PAT。也可以到 GitHub 的 package 设置里把它改成 public，
之后匿名拉取，NUC 上就不用存 token 了。

`deploy` 内置验收：它会检查镜像的 linux/amd64 架构、版本标签、代理配置、应用健康
状态和实际返回的版本，**任何一项不过就不会记为健康发布**，并自动回到上一份健康
镜像。所以这四条命令跑完就是上线了。

首次 deploy 时 Docker 会顺带拉 `nginx:1.28-alpine`（compose 里的网关镜像），属正常。

`release.py` 的可用命令只有：`init`、`deploy <image> [--pull]`、`check`、
`status`、`rollback`。

## 7. 接 Cloudflare Tunnel

你已经有 Tunnel，只需加一条路由。

1. 在 Tunnel 的 Public hostname 里加：
   - **Hostname**：`chess.你的域名`（与 `.env` 的 `DOMAIN` 相同）
   - **Service URL**：`http://127.0.0.1:8080`
2. **检查 DNS（最容易漏的一步）**：加了 Public hostname 后 Cloudflare 会自动为该
   主机名建一条**代理状态**的 CNAME（指向 `<tunnel-id>.cfargotunnel.com`）。到 DNS
   页面确认这一点，并确认该主机名**没有遗留的 A/AAAA 记录**——旧记录会遮蔽
   Tunnel，表现为域名打不开或 522/523，而你在 NUC 本机跑 `smoke.py` 却是通过的。
   证书由 Cloudflare Universal SSL 自动签发，**不要在 NUC 上另行申请证书**。
3. 本地管理的 Tunnel 则把下面这段合并进已有 `ingress`，放在最终 catch-all **之前**，
   不要覆盖其他服务（占位符手动替换，cloudflared 不读本项目的 `.env`）：

   ```yaml
   ingress:
     - hostname: chess.你的域名
       service: http://127.0.0.1:8080
     # 保留你原有的其他路由和最终 catch-all
   ```

   本节假设 cloudflared 跑在 **Debian 宿主机**上。若你的 cloudflared 自己在容器
   里，容器的 `127.0.0.1` 不是宿主机，需按你现有 Tunnel 的方式接入宿主网络。

### 7.1 三条 Cache Rules（必须配，第 3 条尤其）

Next.js standalone 对预渲染 HTML 返回 `Cache-Control: s-maxage=31536000,
stale-while-revalidate`（这是给 Vercel CDN 设计的）。如果 Cloudflare 缓存了这些
HTML，**新版本发布后旧 HTML 会引用已删除的 JS chunk，所有命中旧缓存的访客看到白屏**。

在 Cloudflare → **Cache Rules** 里按优先级配三条：

| 顺序 | 匹配 | Cache eligibility | Edge TTL |
| --- | --- | --- | --- |
| 1 | `URI Path` starts with `/_next/static/` | Eligible | Override origin，**1 年** |
| 2 | `URI Path` starts with `/engine/` **OR** starts with `/sounds/` | Eligible | Respect origin |
| 3 | `Hostname` equals `chess.你的域名` | **Bypass cache** | — |

第 1、2 条是收益：资产 URL 带构建哈希，内容不可变。第 3 条是正确性：它保证 HTML、
`/sw.js`、`/manifest.webmanifest`、`/offline.html`、`/api/*` 和 `/share` 全部回源。
`/sw.js` 尤其不能被中间层缓存——过期的 service worker 会把旧版本锁死在访客浏览器里。

**不要开 Rocket Loader**（会改应用脚本导致 hydration 失败）。

## 8. 上线验收清单

`smoke.py` 只覆盖代理、固定域名、HTTP→HTTPS 跳转、worker/WASM、私有 API 响应头，
以及配置后的 OAuth 起始跳转。**它不替代真机验收。** 接上域名后逐项确认：

- [ ] 外网打开 `https://chess.你的域名`，首页 / Help / Settings 可用，没有发往
      localhost 的 AI 请求
- [ ] 全新浏览器导入 PGN，跑完真实分析、取消再重试、查看证据和训练回顾
- [ ] 保存 Notebook 笔记与变例，刷新后能重新打开
- [ ] 真机 iOS Safari / Android Chrome：棋盘、触摸导航、下载备份与恢复
- [ ] `/engine/stockfish.wasm` 的 Content-Type 是 `application/wasm`，控制台没有
      worker / CSP 报错
- [ ] `/sw.js` 的 `Cache-Control` 是 `no-cache`，且 `cf-cache-status` 是 `DYNAMIC`
      或无此头（说明没被 Cloudflare 缓存）
- [ ] `/manifest.webmanifest` 可访问且 Content-Type 正确
- [ ] 复制一条 `/share#pgn=…` 链接在全新标签打开，确认自动导入并跳到复盘页
- [ ] 用自己账号走一遍 Lichess 授权 / 取消 / 同步 / 断开；Chess.com 测公开账号同步
      及错误恢复

这些通过之前，状态是「本地工程已验证、待部署验收」，不能说已上线。

## 9. 日常运维

### 9.1 更新

换一个唯一 `RELEASE_ID`（如 `beta-002`）走一遍 §2 → §6：

```bash
python3 release.py deploy ghcr.io/ice345/chess-review:beta-002 --pull
python3 smoke.py
```

单机单进程更新有短暂服务中断，这是预期。

### 9.2 回滚

```bash
python3 release.py rollback
python3 release.py check
```

回到上一份健康镜像。**注意**：这是应用镜像回滚，不会撤销你手动改过的 `.env` 或
代理模板，也不是浏览器数据格式降级——回退目标必须支持当前的 IndexedDB v8。

管理员要备份的：`.env`、`.state/`、上一个发布镜像。`.env` 含服务端 Cookie 密钥。

**首次发布给访客之前先导出一份库备份**，之后保留两份支持 v8 的健康镜像用于回退。
另外：**换域名会改变浏览器存储的 origin**，用户数据不会跟着走，必须先在旧域名让
用户导出备份。

### 9.3 磁盘与镜像清理

NUC 和 Mac 上查占用：

```bash
docker system df          # 汇总
docker system df -v       # 逐项（含 build cache）
```

`deploy/nuc/README.md` §6 写明：**发布脚本不会删镜像、不做全局 prune、不删卷**。
`.state` 引用的当前版本和上一版本镜像**必须保留**，否则回滚会失败。要腾空间，手动
删确认不再需要的旧版本。

Mac 上那 5 个 `chess-review:r5-*` 镜像（§0.1）确认不再需要后可以删：

```bash
docker rmi chess-review:r5-test chess-review:r5-final chess-review:r5-proxy \
           chess-review:r5-unhealthy chess-review:r5-candidate
```

`nginx:1.28-alpine` **在 NUC 上不要删**——compose 的 `gateway` 服务就用它。（Mac 上
它只是拉取缓存，删了下次要用会重新拉；不影响 NUC。）

### 9.4 排错

```bash
python3 release.py status
python3 release.py check
docker logs --tail 100 chess-review-web-1
docker logs --tail 100 chess-review-gateway-1
docker stats --no-stream chess-review-web-1 chess-review-gateway-1
```

| 现象 | 先看这里 |
| --- | --- |
| 域名打不开 / 522 / 523，但 NUC 上 `smoke.py` 通过 | §7 第 2 步——该主机名有遗留 A/AAAA 记录遮蔽了 Tunnel |
| 发版后白屏 / JS chunk 404 | §7.1 第 3 条 Cache Rules 没配，或被缓存的旧 `/sw.js` 锁住 |
| 容器 `unhealthy` 但进程还活着 | Docker 的 restart policy 不会重启仅标记为 unhealthy 的存活进程，看日志处理 |
| `release.py` 报「另一个 release 命令在运行」 | 有别的 `release.py` 还持着 `.state/lock`，等它结束或确认没有残留进程 |
| 镜像报 `needs a unique RELEASE_ID` | 复用了版本号，或本地构建时没给 label。换新版本号重新构建 |

**不要**把 Nginx 改成监听 `0.0.0.0:8080`，也不要单独暴露 Web 容器的 3000 端口。

**不要**给 `web` 加副本：平台限流和提供方队列是**进程内**状态，加副本会让限流失效。
