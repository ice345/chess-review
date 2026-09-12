# 生产边界修复（S6）

日期：2026-09-11。范围：Lichess OAuth 回跳与 Cookie 属性、安全响应头、平台请求的
服务端可观测性。未改动任何棋类算法语义。

## 1. 修：Lichess 取消授权后跳回内网地址

**改动前**（实测复现）：配置 `APP_ORIGIN=https://…` + `TRUST_PROXY_ORIGIN=1` 后请求
`/api/platforms/lichess/oauth/callback?error=access_denied`，响应
`307 location: https://localhost:3101/settings?...`。`oauth/start` 正确使用了
`lichessOrigin()`，但 callback 的 `settingsUrl` 用的是原始 `new URL(request.url).origin`
——在文档记载的 Nginx/Cloudflare 部署下那是容器内部地址，访客会被送到
`http://web:3000`。这是用户可见的失败路径：取消登录等于走进死胡同。

**改动后**：callback 的成功与失败跳转都改用 `lichessOrigin(request)`（规范
`APP_ORIGIN`，未配置时退回经代理校验的请求 origin），并在构造跳转前同步重算
`settingsUrl`，因此 `origin` 解析失败时也不会退回内网地址。

**实测证明**（新增测试，先证明能抓到这个 bug）：把 callback 临时改回旧写法后，
该测试失败并显示 `web:3000`；恢复后通过。

## 2. 修：Cookie 的 `Secure` 改由规范 origin 决定

三处（`oauth/start`、`oauth/callback`、`session` 的 DELETE）用
`new URL(request.url).protocol === "https:"` 决定 `Secure`，即依赖 Next 是否恰好
保留了转发协议头，与本应用"不信任转发头、只信规范 origin"的既有模型不一致。

**改动后**：新增 `secureCookieFor(request)`，由 `APP_ORIGIN`（未配置时用经校验的
请求 origin）判断。行为与部署 origin 一致，不再取决于偶然的头处理。

## 3. 新增 HSTS

`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`。

线上实测（standalone 生产构建）：`/` 返回该头，且既有的
`X-Content-Type-Options` / `Referrer-Policy` / `X-Frame-Options` 未受影响；
`/engine/stockfish.wasm` 仍为 `public, max-age=31536000, immutable`。

## 4. 新增：平台请求失败的服务端可见性

此前 provider/传输失败只回给访客一句通用错误，运营侧**没有任何记录**。现在
`platformRequest` 的兜底分支写入一行 JSON 日志（`scope`、`provider`、`method`、
`error` 的类名与消息）。

**只记录错误类型与消息**：不记录请求体、token、Cookie、PGN 或访客内容。这与仓库
既有的"访问日志不含查询串/IP/Cookie"约定一致。

## 未做，以及为什么

**CSP 故意没加。** 现在最保险的 CSP 写法是 `Content-Security-Policy-Report-Only`，
但它需要一个收集端点才能发现违规，而本项目**没有**远端错误收集服务；直接上强制
CSP 则要精确列出 `worker-src`（Stockfish 走 Web Worker）、`wasm-unsafe-eval`、
`sound`/`media-src`、`img-src`（棋手头像来自 Chess.com/Lichess 域名），一旦漏项
就是**整站白屏或引擎无法启动**，而且这类问题只在真实浏览器里暴露。因此 CSP 应当
与"错误上报"一起做，并在真实浏览器与真实域名下逐项验证——不适合在没有这两样东西
时塞进本批。

**第三方错误上报（Sentry 等）也没加**：它会向站外发送数据，而你尚未做隐私取向的
决策（项目当前承诺是"不上传用户棋局/笔记"，日志级别的最小暴露已经覆盖了"运营能
发现问题"的最小需求）。这一步需要你明确选择。

## 验证

| 检查 | 实际结果 |
| --- | --- |
| `pnpm test` | **444 项通过**（web 由 296 增至 297） |
| `pnpm typecheck` / `pnpm lint` | 0 错误 / exit 0 |
| `NEXT_PUBLIC_APP_MODE=browser-core pnpm build` | 通过 |
| 线上头实测 | HSTS 已下发；engine 缓存头未回归 |
| 新回归测试 | `lichess-flow.test.ts` 新增 1 条：取消登录必须跳到配置 origin、不得出现 `web:3000`、Cookie 必须带 `Secure`；已用"改回旧写法"证明该测试确实能抓到该缺陷 |

## 提醒：`OBJECTIVE_ALGORITHM_VERSION` 已提升为 `objective-v2.1`

按你的决定执行。**你 NUC 上已有的 v2.0 分析会被判为过期并需要重算**：
`analysis-cache.ts` 用它做缓存键与"是否现行"判定，`advanced-study-library.ts` /
`history-analysis-jobs.ts` 用它区分 analyzed / stale。首次开放 beta 前建议先导出
一份库备份（Settings 内）。

同时修正了一处测试隐患：`study-v2.test.ts` 原先用 `"objective-v2.1"` 作为"不同
版本"来验证拒绝混用，提升版本号后它会变成与当前版本相同而使断言失效；现在改用
`"objective-v2.0"`，并注明它是刻意不同于当前常量的标识。
