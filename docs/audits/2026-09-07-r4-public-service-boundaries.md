Status: Historical
Baseline: `a1f603e` · 2026-09-07 (R4)
Superseded by: [docs/web-service-boundaries.md](../web-service-boundaries.md)
Do not use as the current product contract.

# R4 · 公开服务业务边界验收

日期：2026-09-07。工作区基线 `a1f603e`，保留已有 R1–R3 未提交修改。
本批完成本地工程交付；未部署，也未替代 R5 的真实 HTTPS 授权与发布验收。

## 用户可见变化

- 公开生产构建默认 Browser Core：PGN/FEN、Stockfish 复盘、事实摘要、训练回顾、棋库与备份可用，不探测访客的 localhost AI。
- Enhanced Local 仅在本机地址启用，区分未提供、配置错误、服务不可达与模型未安装。提供方返回坏健康数据时不会使设置页崩溃。
- 界面使用英文，Coach 输出语言独立选择；默认英文，保留已保存的中文偏好和对应缓存。
- 新增 Help，说明首盘复盘、功能范围、数据保留/外发、恢复方式和手动 GitHub 反馈；首页、设置页有入口。
- Browser Core 设置页隐藏本地模型配置，并重排较短的说明/声音区域，避免隐藏模型卡后留下整行空位。棋子、色板、品牌与质量图标保持原样。
- Lichess 断开失败不再混淆本地清除和远端撤销，保留重新连接及手动撤销指引。

## 服务边界

所有平台路由复用运行时输入校验、20 秒截止时间与标准错误响应，并增加进程内频率限制、每个平台一条活动请求/八条等待请求、429 冷却和上游响应体大小限制。超时/取消会释放等待项，错误响应流关闭后才释放提供方通道。

OAuth 使用 S256 PKCE、加密 HttpOnly Cookie，核查 state、年龄、回调 origin 和会话到期；取消/失败使用预定义可恢复文案，不把上游异常或令牌放入跳转地址。公开登录需要正确的 APP_ORIGIN 和服务端 Cookie 密钥。

具体阈值、可信代理要求和数据说明见 [Web service boundaries](../web-service-boundaries.md)。进程内状态会在进程重启时清空，不能协调多个实例；部署拓扑及共享限制仍须在 R5 验证。没有实现或承诺 Hosted AI。

## 实际检查

环境：macOS arm64、Node 26.8.1、pnpm 11.19.0、Next 16.3.2、Playwright Chromium。CI 仍使用 Node 24；本地通过不等于远端 CI 已运行。

| 检查 | 结果与范围 |
| --- | --- |
| `pnpm test`，后续受影响 Web suite 重跑 | 353 项通过：239 Web + 114 其他包；新增可用性、限流/队列、OAuth 回归 |
| `pnpm typecheck` | 通过 |
| `pnpm lint` | 通过 |
| `pnpm build` | 通过，包括公开 Browser Core 和新增 Help/robots 路由 |
| 开发服务器 Chromium | 55 条通过：29 条原工作流；26 条 R1–R4、布局与视觉检查；最终 R4 4 条重跑通过 |
| `pnpm test:e2e --config playwright.browser-core.config.ts` | 2 条通过，独立 `next start`，不复用 dev server |
| 未缓存的真实生产 WASM 复盘 | 新浏览器导入 4 ply PGN → 完成 Stockfish → 整盘摘要/单步事实讲解 → History 记为已分析；本地 AI 请求数为零 |
| 真实 Chess.com 公共资料请求 | `/api/platforms/chesscom/link` 请求公开用户 hikaru 返回 200、`verified: false`；未改动用户棋库或发送消息 |
| Lichess 授权配置 | 当前 `configured: false`；未进行真实账号授权 |
| OAuth 确定性路由测试 | 16 项通过，包含 HTTPS Cookie 属性、PKCE、取消、过期/篡改、origin、会话到期、远端撤销失败与超时；提供方响应使用 fixture |
| 最终 diff | 检查空白错误、生成文件、依赖和大文件；未添加生产依赖、参考仓库或模型文件；保留用户的 opencode.json |

首次新增 E2E 的两个控件定位不准确，修正为明确的角色/名称后重跑。
截图检查发现反馈按钮的文字被普通链接规则覆盖，修复并重新检查；生产设置页的空位也在截图检查后调整。
没有放宽视觉阈值或更新原视觉基准来掩盖失败。

CI 增加 R1–R4 工作流，并在公开 Browser Core 构建后运行独立生产模式检查。

## 页面记录

- [公开 Settings · 1440](assets/r4/browser-settings-1440.png)
- [公开 Settings · 390](assets/r4/browser-settings-390.png)
- [公开 Settings · 320](assets/r4/browser-settings-320.png)
- [Help · 1440](assets/r4/help-1440.png)
- [Help · 390](assets/r4/help-390.png)
- [Help · 320](assets/r4/help-320.png)

已目视检查桌面/窄屏截图，页面没有横向溢出。截图来自浏览器视口模拟，不代表真机验收。

## 仍未通过的发布门槛

R5 必须在实际域名上完成真实 Lichess HTTPS 登录、同步、取消、断开，验证代理 origin、Secure Cookie、部署级限流及多实例协调；还包括跨浏览器/真机、大棋库性能与发布回退。R4 的本地测试不把这些项目标记为通过。首发范围仍是复盘与学习平台，不包含在线对弈、付费或云端棋库同步。
