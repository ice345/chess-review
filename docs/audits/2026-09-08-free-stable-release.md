# 免费开源稳定版审计与 S1

日期：2026-09-08；最终复核：2026-09-10。范围：当前工作树，承接已实现的 R1–R5；不把历史审计的旧问题当成当前缺陷。

## 发布判断

首发定位是**免费、无需自有账号的浏览器复盘与个人学习工具**。已有 PGN/FEN、浏览器 Stockfish、可解释客观复盘、平台导入、训练局面回顾和本地备份，不需要为上线先开发付款、套餐、账号系统或在线对弈。

本轮补齐 Notebook，并修复两个交互失败路径。当前仍是本地发布候选，不能称为已在 NUC 或公网通过验收。没有改棋子、棋盘/站点配色、Quality SVG，也没有改变 Accuracy、Divider、WinPercent、POV、分类、Great/Brilliant 或 Human Difficulty。

## 本轮确认与处理

| 编号 | 优先级 | 源码确认的问题/缺口 | 当前处理 |
| --- | --- | --- | --- |
| S1-01 | P2，稳定版学习流程 | [分支树](../../apps/web/src/lib/analysis-branch.ts) 只存在于会话，缺少个人笔记/书签/变例保存；原 PGN 导出不能代替个人研究存档 | 新增 [Notebook](../../apps/web/src/lib/review-notebook.ts)、独立存储、PGN/FEN 界面和 v2 备份。保存当前节点之前的合法路径，重新打开时重放规则；不保存探索评分 |
| S1-02 | P2，导航数据上下文 | [ReviewShell](../../apps/web/src/components/review-shell.tsx) 把缺失的 `ply` 查询参数通过 `Number(null)` 变为 0；从带 ply 的深链接切换到无参数栏目会回到开局，并退出分支 | 只有实际存在且为整数文本的 ply 才触发跳转；栏目切换保留当前棋盘/分支，浏览器工作流覆盖 |
| S1-03 | P2，失败可见性 | PNG 导出方法会因 Canvas 不可用或编码失败而拒绝；按钮使用 `void export…()`，没有捕获和用户反馈 | 导出统一经过忙碌锁和错误处理。失败给出原因与重试入口；成功生成文件，不把“触发下载”宣称成用户已保存 |
| S1-04 | P2，发布口径 | 两份 roadmap 顶部仍写 R1–R4；旧清理/历史身份等事项与后续完成记录矛盾；保留了收费候选 | 统一 R1–R5 + S1 口径，明确免费开源，补贡献指南；实际硬件/公网验收仍保持未完成 |
| S1-05 | P1，生产依赖 | 9 月 10 日重新查询生产依赖公告，原 Next 16.3.2 / sharp 0.35.3 命中 2 条 critical 和 1 条 high 公告 | 升级修复版本并重新构建、回归；CI 增加生产依赖 high/critical 检查，不沿用之前的零漏洞结果 |

依赖修补依据：[Next AVIF 公告](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4)、[Windows 托管公告](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)、[sharp/libheif 公告](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c)。Windows 特定问题不代表 Debian NUC 具有同一攻击路径；仍升级共同依赖，消除已知受影响版本。

## Notebook 的业务完整性

- 独立于原 PGN、客观分析缓存及生成式 Coach；个人文本按纯文本展示。
- 显式保存，失败保留草稿；可找回同一标签页中的其他局面草稿。草稿不等于持久存档。
- 同局面并发修改/删除做 revision 比较，不静默覆盖；不同局面合并。
- v2 备份包含笔记、书签、变例；v1 继续可恢复。校验、预览和事务恢复覆盖整个 Notebook。
- 删除单盘或账号棋局会清理对应 Notebook；清引擎缓存保留个人内容；全重置覆盖新存储。
- 数据库 v7 → v8 只新增 store。回退镜像必须支持 v8，旧 R5 页面不能打开升级后的库；[部署说明](../../deploy/nuc/README.md) 已记录这项边界。

详细契约与容量限制见 [Notebook](../review-notebook.md) 与 [备份恢复](../library-backup.md)。这不是完整的 PGN 变例树编辑器或云端研究空间。

实际页面：[1280px 桌面](assets/s1/notebook-desktop.png)、[390px 手机尺寸](assets/s1/notebook-mobile.png)。截图来自修补后的生产构建，已检查布局；桌面右侧面板处于保存后的滚动位置。

## 还需要完成的上线门槛

| 优先级 | 项目 | 验收证据 | 当前状态 |
| --- | --- | --- | --- |
| P1，实际发布前 | 在 Debian / NUC6CAYS（8 GB / 512 GB）运行发布包，接入现有 Cloudflare Tunnel 和自定义域名 | 版本/健康检查、真实外网 HTTPS、WASM/worker 响应、实际 CPU/内存/网络数据 | 等待真实机器和域名部署；本地容器结果不能代替 |
| P1，若开放 Lichess 登录 | 正式域名授权、取消、回调、同步、断开 | 真实账号授权与 Secure Cookie 结果；失败可恢复 | 本地 fixture/代理已验证；真实授权未验收。可先不配置 client ID 上线 Browser Core |
| P1，实际发布前 | 手机下载与恢复、触摸与长分析；升级与兼容回退 | 真实 iOS Safari / Android Chrome；同域名 v8 库保留；两份兼容镜像 | 浏览器模拟通过与否单独记录，不宣称实际硬件完成 |
| P1，实际发布前 | 从审核后的提交构建正式镜像并运行 CI | 明确 commit/release ID、检查记录、可获取的兼容回退镜像 | 当前仍是未提交工作树；本轮没有推送、打 tag 或操作真实 NUC |

在这些项目完成前可以继续本地使用或受控试用；公开发布的容量和稳定性以实际结果为准。

## 后续 roadmap

1. **S1：个人研究保留。** 本轮交付 Notebook、备份/删除完整性及导航/导出修复。
2. **S2：基于真实回顾记录的复习安排。** 明确“回顾过”和“答对/掌握”的区别；先提供可解释的再访计划及跳过/完成记录，再验证间隔策略。现有 Training 已是逐局面回顾流程，不能再称为只有空按钮。
3. **S3：长期本地存储管理。** 当前容量不足可见且可清缓存/备份；进一步加入容量提示、可解释的派生缓存淘汰和长期多库基准，始终保留原棋谱和个人笔记。
4. **S4：开源维护。** 完善贡献/问题模板、逐步固定 CI action 版本与发行记录。保持无默认遥测，不把用户 PGN/笔记写入运营日志。
5. 跨设备同步、共享研究和完整 PGN 变例编辑按使用反馈另立范围。在线对弈、赛事、原生签名发行和艺术方向迭代不混入这次免费 Web 发布。

## 验证记录

2026-09-10，Next 16.3.3、sharp 0.35.4，macOS 本地工作树：

| 检查 | 实际结果 |
| --- | --- |
| `pnpm test` | 392 项通过：Web 278，核心包 114 |
| `pnpm typecheck` / `pnpm lint` | 通过 |
| `NEXT_PUBLIC_APP_MODE=browser-core pnpm build` | 通过，包括 Notebook 路由及 standalone 输出 |
| `pnpm exec playwright test --config playwright.release.config.ts` | 新构建 80 条全部通过，3.0 分钟；Chromium / Firefox / WebKit / 手机尺寸 Chromium / 手机尺寸 WebKit。包含真实 WASM、备份/恢复、跨标签页、Notebook、失败重试及窄屏操作 |
| `pnpm audit --prod --json` | 修补后 0 条已知公告；生产及可选依赖共 70 项。这不替代代码审计或实际服务验收 |
| `uv run --project services/local-ai --extra dev pytest services/local-ai/tests` | 34 项通过；现有 Starlette TestClient 的 httpx 弃用提示 1 条；未下载模型 |
| `python3 -m unittest discover -s deploy/nuc -p 'test_*.py'` | 8 项通过 |

9 月 8 日开发模式验证覆盖 60 条独立工作流：首次 59 条通过；修复 PNG 测试选择器与 Next 路由播报器冲突后，该条重跑通过，并通过视觉回归 spec。未将分次结果写成一次完整运行。

本地浏览器命令添加 `NO_PROXY=localhost,127.0.0.1,::1 no_proxy=localhost,127.0.0.1,::1`，避免本机代理截获 Playwright 的启动健康检查；没有改变生产代理配置。最终 `git diff --check` 通过，新增文件未发现超过 2 MB 的意外二进制文件，S1 文档本地链接已检查。

本轮没有重新构建或启动 Linux 容器（当前 Docker daemon 未运行），R5 容器演练仅是历史版本证据。当前修补后的镜像仍需通过 CI 的 `nuc-container` 构建/代理 smoke，再进入真实 NUC 验收。没有提交、推送或公开部署。
