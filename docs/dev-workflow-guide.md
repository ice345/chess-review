# 从零构建一个多语言桌面应用：完整开发流程指南

> 本文以 Open Chess Review 为真实样本，讲述一个个人开发者如何从空目录开始，
> 逐步搭建出「Web 前端 + Python AI 后端 + Rust 桌面壳」三语言一体，且能发布三平台安装包的项目。
>
> **目标**：读完本文 + 对照仓库源码，你能几乎复现整个过程。每条命令、每个配置、
> 每段关键代码都有出处（括号内标注仓库路径）。

---

## 0. 文档地图

| 阶段 | 产出 | 用什么语言 | 对应仓库目录 |
|------|------|-----------|--------------|
| 一 | Monorepo 骨架 | JS/TS | 根目录 |
| 二 | 共享逻辑层 | TypeScript | `packages/*` |
| 三 | Web 前端 | TypeScript + React | `apps/web` |
| 四 | AI 后端 | Python + FastAPI | `services/local-ai` |
| 五 | 前后端打通 | TS ↔ HTTP ↔ Python | `apps/web/src/lib/local-ai.ts` |
| 六 | 开发编排 | Node.js | `scripts/dev.mjs` |
| 七 | 桌面壳 | Vite + React + Tauri(Rust) | `apps/desktop` |
| 八 | Sidecar 打包 | Python → 二进制 | `scripts/build-local-ai-sidecar.mjs` |
| 九 | 三平台发布 | CI | `.github/workflows/` |

**阅读顺序**：阶段一到九按真实开发顺序排列。想先看"整体怎么串"请先读第 1 节。

---

## 1. 最终架构总览（先看这张图）

```
┌────────────────────────────────────────────────────────────────────┐
│  pnpm workspace (单仓库, 一份代码多端复用)                          │
│                                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────────┐  │
│  │  apps/web   │  │ apps/desktop│  │ packages/* (纯 TS 逻辑)    │  │
│  │  Next.js 16 │  │ Vite+React  │  │ chess-core / analysis /   │  │
│  │  React 19   │  │ + Tauri 2   │  │ stockfish / openings /    │  │
│  └──────┬──────┘  └──────┬──────┘  │ shared / ui               │  │
│         │                 │        └───────────┬───────────────┘  │
│         │  fetch          │  invoke/listen      │ 编译进前端产物    │
│         ▼                 ▼                     │ (源码直接引用)    │
│  ┌──────────────────────────────────────────────┴───────────────┐  │
│  │                services/local-ai (Python FastAPI)            │  │
│  │              Maia-3 神经网络 + LLM Coach，HTTP 8000           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│         ▲                                                        │
│         │ 桌面版: Rust 用 PyInstaller 编译后的 sidecar 二进制启动  │
└─────────┴──────────────────────────────────────────────────────────┘
```

**三个语言各管一段，绝不越界：**

| 语言 | 管什么 | 为什么用它 |
|------|--------|-----------|
| TypeScript | 棋类逻辑、UI、分析编排、存储 | 前后端唯一能共享的语言，逻辑不重写 |
| Python | AI 推理（神经网络 / LLM） | 只有它有 PyTorch 和模型生态 |
| Rust | 原生窗口、文件系统、进程管理 | Tauri 提供，且安全边界清晰 |

**串起来的通道只有两条：**
- **HTTP**：TS ↔ Python，走业务数据（JSON）
- **IPC**：TS ↔ Rust，走系统能力（Tauri command / event）

其余零耦合。这是多语言项目不失控的根本原因。

---

## 2. 阶段零：工具链与前置准备

### 2.1 需要的工具

| 工具 | 版本要求 | 作用 | 仓库出处 |
|------|---------|------|---------|
| Node.js | ≥22（CI 用 24） | JS/TS 运行时 | `package.json` engines |
| pnpm | 11.19.0 | 包管理 / monorepo | `packageManager` |
| Python | ≥3.12 | AI 后端 | `pyproject.toml` requires-python |
| uv | 最新 | Python 项目与依赖管理 | CI 用 `astral-sh/setup-uv` |
| Rust | ≥1.77.2 | Tauri 壳 | `Cargo.toml` rust-version |
| Tauri CLI | 2.11.4 | 桌面构建 | `apps/desktop` devDeps |

### 2.2 先想清楚的五个决策

动手前先明确这五件事，它们决定了整个架构：

1. **核心逻辑放哪？** → 放共享 TS 包（`packages/`），不放任何 app 里。
2. **重计算放哪？** → 放浏览器（Stockfish WASM），省掉一个常驻后端。只有浏览器做不了的（PyTorch 推理）才给 Python。
3. **后端可不可选？** → 可选。挂了产品照跑，只降级（Maia 显示 offline、Coach 用确定性文案）。
4. **桌面是不是重写？** → 不是。桌面复用全部共享包，只是壳。
5. **契约怎么定？** → 跨语言的数据结构在 `packages/shared`（TS）和 `schemas.py`（Pydantic）各存一份，版本控制可追溯。

> 这五条对应仓库 `README.md` 的 "Architecture" 一节和 `docs/architecture.md`。

---

## 3. 阶段一：Monorepo 骨架

### 3.1 创建 pnpm workspace

`pnpm-workspace.yaml`（仓库根目录，内容就是这个）：

```yaml
packages:
  - apps/*
  - packages/*
  - services/*
```

三个区域的分工：
- `apps/*` → 可运行的应用（web、desktop）
- `packages/*` → 纯逻辑共享包
- `services/*` → 非 JS 服务（Python），也被 workspace 纳入管理

### 3.2 根 `package.json`

```json
{
  "name": "chess-review",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@11.19.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "node scripts/dev.mjs",
    "dev:local-ai": "node scripts/dev.mjs --services-only",
    "dev:web": "pnpm --filter @chess-review/web dev",
    "build": "pnpm -r --if-present run build",
    "test": "pnpm -r --if-present run test",
    "test:e2e": "playwright test",
    "typecheck": "pnpm -r --if-present run typecheck",
    "lint": "eslint ."
  }
}
```

**关键设计：根脚本用 `pnpm -r --if-present` 递归执行。** 每个子包有自己的 `test`/`build`/`typecheck` 脚本，根命令一次跑完所有包。`--if-present` 允许有的包没有该脚本。

### 3.3 基础 TypeScript 配置（全仓共享）

`tsconfig.base.json` —— 所有子包的 `tsconfig.json` 都 `extends` 它：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

注意 `noEmit: true` + `moduleResolution: Bundler` —— **TS 只做类型检查，不负责编译产物**，编译交给各应用的 bundler（Next.js / Vite）。这是"源码驱动 monorepo"的关键。

### 3.4 安装与验证

```bash
pnpm install --frozen-lockfile
pnpm -r typecheck   # 所有包类型检查通过
```

> 顺序建议：先建骨架再逐个加包，每加一个包就 `pnpm -r typecheck` 一次，避免积压错误。

---

## 4. 阶段二：共享 packages 层（源码驱动）

### 4.1 核心概念：源码直接引用，不预编译

看 `packages/chess-core/package.json`（这是全仓共享包的标准写法）：

```json
{
  "name": "@chess-review/chess-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },   // ← 直接导出 TS 源码
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@chess-review/shared": "workspace:*",
    "chess.js": "1.4.0"
  }
}
```

**要点：**
- `exports` 指向 `./src/index.ts`（不是 `dist/`）—— 消费方（Next.js/Vite 的 bundler）直接编译这份 TS 源码。
- 包内依赖用 `"workspace:*"` 引用兄弟包，pnpm 自动链接成本地 symlink。
- 共享包不需要 `build` 脚本，`test` + `typecheck` 就够。

### 4.2 包的分工（你的仓库实际布局）

| 包 | 职责 | 关键依赖 |
|----|------|---------|
| `packages/shared` | 跨语言 Schema 与共享类型 | 无 |
| `packages/chess-core` | PGN/FEN 解析、棋局合法性、回放 | chess.js |
| `packages/analysis` | 胜率/准确率/棋局阶段/分类/教练事实 | chess-core |
| `packages/stockfish` | Stockfish WASM 通信、UCI 解析、缓存 | — |
| `packages/openings` | Lichess 开局数据与局面匹配 | — |
| `packages/ui` | React 组件库（棋盘、标注系统） | react (peer) |

**划分标准**：将来可能被 Web、桌面、或任何端复用的逻辑，就放 packages/。与 UI 无关的纯逻辑（`chess-core`、`analysis`）保持零 React 依赖，这样 Python 服务理论上也能读懂同一份棋局数据结构。

### 4.3 共享包的写法示例

纯函数 + 类型导出（`packages/shared` 的导出模式）：

```ts
// packages/shared/src/...（示例）
export interface HumanMoveCandidate {
  uci: string;
  san: string;
  probability: number;
  policyRank: number;
  wdl?: { win: number; draw: number; loss: number };
}
```

这个类型会在前端显示、会被序列化进 HTTP 请求发给 Python，是跨语言契约的 TS 半边。

### 4.4 验证

```bash
pnpm --filter @chess-review/chess-core test        # vitest
pnpm --filter @chess-review/shared typecheck
```

> **纪律**：packages 层只放确定性逻辑，不碰 `fetch`、不碰 DOM、不碰文件系统。
> 它的可测试性就是它的价值。

---

## 5. 阶段三：Web 前端（Next.js）

### 5.1 为什么用 Next.js 而不是纯 SPA

仓库用 Next.js 16 + React 19。它带来的东西：
- **App Router**：文件即路由（`app/page.tsx`），同时支持 SSR 和 `"use client"` 客户端组件。
- **构建期环境变量**：`NEXT_PUBLIC_*` 前缀的变量在 `next build` 时被编译成常量，浏览器也能读到。

### 5.2 目录结构（`apps/web`）

```
apps/web/
├── app/            # 路由 + 页面 (layout.tsx, page.tsx)
├── components/     # React 组件 (review-shell, coach-panel, settings-page...)
├── hooks/          # 业务 hooks (use-review-analysis, use-review-coach...)
├── lib/            # 纯逻辑 (local-ai.ts, analysis-scheduler.ts, png-export.ts...)
└── public/         # 静态资源（Stockfish WASM 等）
```

**分层纪律**：
- 组件只负责渲染 + 调用 hooks，不含业务逻辑。
- `lib/` 是纯 TS 函数，能单独测试（仓库里 `lib/*.test.ts` 一堆）。
- `hooks/` 是组件与 lib 之间的胶水。

### 5.3 关键依赖（`apps/web/package.json`）

```json
{
  "dependencies": {
    "@chess-review/analysis": "workspace:*",
    "@chess-review/chess-core": "workspace:*",
    "@chess-review/openings": "workspace:*",
    "@chess-review/shared": "workspace:*",
    "@chess-review/stockfish": "workspace:*",
    "@chess-review/ui": "workspace:*",
    "next": "16.3.2",
    "react": "19.2.8",
    "react-chessboard": "5.12.1",
    "react-dom": "19.2.8",
    "zustand": "5.0.15"
  }
}
```

注意：**6 个 workspace 包全是源码引用**，Next.js 的 bundler 会直接把 `packages/*` 的 TS 编译进产物。这是"一份棋类逻辑，Web/桌面共用"的技术基础。

### 5.4 重计算放浏览器：Stockfish WASM 方案

这是整个架构最省心的决定——**棋力评估不搭后端，直接在浏览器跑**：

```
浏览器里运行 Stockfish 18 WASM
  → Web Worker 里跑 UCI 引擎
  → packages/stockfish 封装通信 + UCI 输出解析 + 缓存
  → 结果供 review / 图表 / 导出复用
```

**为什么**：Stockfish 是纯计算，WASM 在浏览器跑得动；棋局本身在用户本地，不需要上传。于是"核心分析"这一层彻底不需要后端。后端只留给浏览器做不了的事（神经网络、LLM）。

### 5.5 本地存储：IndexedDB

棋局库、分析缓存存浏览器本地（`lib/platform-library.ts`、`lib/analysis-cache.ts`），联网平台（Chess.com/Lichess）通过 Next.js 的 `app/api/*` 路由做服务端代理（避免 CORS 和密钥暴露）。

### 5.6 验证

```bash
pnpm --filter @chess-review/web dev   # 开发
pnpm --filter @chess-review/web build # 产出 .next/
pnpm --filter @chess-review/web test  # vitest
```

---

## 6. 阶段四：Python AI 后端（FastAPI）

### 6.1 为什么独立成 Python 项目

需求是 Maia-3 神经网络预测人类走法 + LLM 棋局讲解。这些要 PyTorch 和模型权重，TypeScript 生态做不了。所以起一个**完全独立的 Python 服务**，不混进 pnpm。

### 6.2 项目初始化：用 uv

`uv` 管理 Python 环境和锁文件，等价于 Python 界的 pnpm。`services/local-ai/pyproject.toml`：

```toml
[project]
name = "chess-review-local-ai"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.116,<1",
  "httpx>=0.28,<1",
  "pydantic>=2.11,<3",
  "python-chess>=1.999,<2",
  "uvicorn[standard]>=0.35,<1",
]

[project.optional-dependencies]
dev = ["pytest>=8.4,<9"]
maia = ["maia3 @ git+...", "torch>=2.9,<3"]   # 重型 AI 依赖
bundle = ["pyinstaller>=6.16,<7"]             # 桌面打包用

[tool.uv.sources]
torch = { index = "pytorch-cpu" }              # 用 CPU 版 torch，减小体积

[build-system]
requires = ["hatchling>=1.27"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/chess_review_local_ai"]

[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]
```

**三个 extras 的设计意图：**
- 开发时只装 `dev`（轻量）；需要 AI 时才装 `maia`（torch 很重）；桌面打包时才装 `bundle`。
- torch 固定用 CPU 版（`pytorch-cpu` index），避免打包时把 CUDA 那几百 MB 塞进来。

### 6.3 服务源码结构

```
services/local-ai/src/chess_review_local_ai/
├── main.py           # FastAPI 应用 + 路由 + CORS + 错误映射
├── maia_provider.py  # Maia-3 神经网络推理（接口抽象 + 实现）
├── coach_provider.py # LLM 调用（Ollama / OpenAI 兼容）
├── coach_service.py  # 讲解编排（把结构化事实变成自然语言）
└── schemas.py        # Pydantic 请求/响应模型
```

### 6.4 FastAPI 入口（`main.py` 要点）

```python
app = FastAPI(title="Open Chess Review Local AI", version="0.1.0")

# 只允许本机访问（浏览器直连需要 CORS）
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(?:localhost|127\.0\.0\.1)(?::\d+)?$",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# 路由：
# GET  /health                 → 返回 maia/coach 完整状态
# POST /maia/moves             → 局面预测
# POST /maia/move-review       → 走法评价
# POST /coach/explain          → 讲解某个走法
# POST /coach/game-summary     → 整局总结
```

### 6.5 错误语义：可区分的 HTTP 状态码

这是前后端协作的关键设计 —— **把"出了什么错"编码进状态码**（`main.py` 的 `_run_maia`）：

```python
MaiaModelSetupRequiredError → 409  { code: "maia-model-not-cached" }  # 没装模型
MaiaUnavailableError         → 503  { code: "maia-unavailable" }      # 服务没起来
MaiaInferenceError           → 422  { code: "maia-inference-failed" } # 推理失败
```

前端拿到 `code` 就能区分"提示用户下载模型" / "显示离线" / "显示错误"，三种 UI 各不同。

### 6.6 依赖注入 + 单例

```python
@lru_cache(maxsize=1)
def get_maia_provider() -> MaiaProvider:
    return Maia3Provider()

@app.get("/health", response_model=HealthResponse)
def health(provider: MaiaProvider = Depends(get_maia_provider)) -> HealthResponse:
    return HealthResponse(maia=provider.status, ...)
```

`lru_cache` 保证整个进程只有一个 provider 实例（模型只加载一次），`Depends` 让测试能注入假 provider。

### 6.7 验证

```bash
uv sync --project services/local-ai --extra dev --locked
uv run --project services/local-ai --extra dev pytest services/local-ai/tests
uv run --project services/local-ai uvicorn chess_review_local_ai.main:app --port 8000
curl http://127.0.0.1:8000/health
```

---

## 7. 阶段五：前后端打通（HTTP + Schema 契约 + 健康轮询）

现在把 Web 前端和 Python 后端接起来。核心文件：`apps/web/src/lib/local-ai.ts`。

### 7.1 客户端封装（`local-ai.ts`）

所有对 Python 的调用都收敛在这个文件里，组件/hooks 不直接写 `fetch`：

```ts
const LOCAL_AI_URL =
  (process.env.NEXT_PUBLIC_LOCAL_AI_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export async function reviewMaiaMove(request, signal?) {
  const response = await fetch(`${LOCAL_AI_URL}/maia/move-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...maiaConfigBody(request),        // camelCase → snake_case 转换
      fen_before: request.fenBefore,
      played_move: request.playedMove,
    }),
    ...(signal === undefined ? {} : { signal }),
  });
  const body = await responseJson(response);
  if (!response.ok) throw errorFromResponse(response, body);
  return normalizeApiMaia(body);          // snake_case → camelCase 转回
}
```

**两个映射方向：**
- 发出时：`targetElo` → `target_elo`（`maiaConfigBody()`）
- 收回时：`fen_before` → `fenBefore`（`normalizeApiMaia()`）

这就是跨语言契约的落实：**TS 侧用 camelCase，Python 侧用 snake_case，两边各写自己的转换，靠 `packages/shared` 的类型和 `schemas.py` 的模型对齐结构。**

### 7.2 错误对象

```ts
export class LocalAiRequestError extends Error {
  readonly status: number;
  readonly code?: string;   // 对应 Python 的 { code: "maia-model-not-cached" }
}
```

前端 catch 到这个错误，用 `code` 决定 UI：`maia-model-not-cached` → 弹"请先下载模型"。

### 7.3 健康轮询（`use-local-ai-health.ts`）

浏览器无法启动 Python 进程，但它可以轮询探测：

```ts
export function useLocalAiHealth(pollIntervalMs = 5_000) {
  // state: "checking" | "online" | "offline"
  // 每 5 秒 GET /health 一次
  // 窗口重新聚焦 / visibilitychange 时立即刷一次
  // 页面隐藏时轮询仍跑，但 AbortController 在卸载时清理
}
```

**为什么需要它**：用户可能先打开了 Web，再手动起 Python。轮询让 UI 在服务起来后自动从"离线"切回"在线"，无需刷新。这是"可选后端"的 UI 配套。

### 7.4 打通后的完整链路（复盘）

```
用户点"分析这个局面"
  → use-review-human hook → local-ai.ts reviewMaiaMove()
  → fetch POST http://127.0.0.1:8000/maia/move-review
  → Python: main.py → maia_provider.py 跑 PyTorch 推理
  → 返回 candidates[] + probability + wdl
  → local-ai.ts 转 camelCase → hook 缓存 → 组件渲染
```

### 7.5 验证

```bash
pnpm --filter @chess-review/web dev
# 另开终端起后端：uv run ... uvicorn ... --port 8000
# 浏览器里检查 Maia 状态从 offline 变 online
```

---

## 8. 阶段六：开发编排脚本（dev.mjs）

### 8.1 要解决什么问题

多服务开发时最烦的是：服务启动顺序、谁还没起、退出时会不会留孤儿进程。`scripts/dev.mjs` 用**一个 Node 脚本**解决。

### 8.2 核心机制（对照源码）

```js
const LOCAL_AI_URL = "http://127.0.0.1:8000";
const OLLAMA_URL = "http://127.0.0.1:11434";
const ownedChildren = new Set();   // 记录自己启动的进程

// 1) 健康探测（短超时 + 容错）
async function fetchJson(url, timeout = 1500) { /* AbortController */ }

// 2) 增量启动：只启动缺失的
//    - :8000 /health 健康 → 复用；不健康 → spawn uvicorn
//    - :11434 /api/tags 健康 → 复用；不健康 → ollama serve

// 3) 进程所有权：退出时只杀 ownedChildren 里的
process.on("exit", () => { for (const c of ownedChildren) c.kill(); });
```

**三个设计精髓：**
1. **健康检查驱动启动**，而不是盲目 `spawn` 一串。
2. **复用已有的**：你自己在别处跑的 Ollama 不会被误杀。
3. **只杀自己起的**：`ownedChildren` 精确记录所有权，退出时零残留。

### 8.3 提供的三种模式

```bash
pnpm dev             # 全量：前端 + Python + Ollama（完整开发入口）
pnpm dev:local-ai    # 只起服务（--services-only），配合单独跑的 web
pnpm dev:check       # 只探测报告（--check），什么都不启动，排查用
```

---

## 9. 阶段七：桌面壳（Vite + React + Tauri 2）

### 9.1 为什么桌面版结构这么小

看 `apps/desktop/src/` —— 只有 `main.tsx`、`app.tsx`、`styles.css`。

```
apps/desktop/
├── src/
│   ├── main.tsx      # createRoot 挂载 React
│   └── app.tsx       # 唯一的页面组件
├── index.html
├── vite.config.ts
└── src-tauri/        # Rust 壳
    ├── src/          # main.rs, lib.rs, native_services.rs
    ├── icons/
    ├── Cargo.toml
    ├── tauri.conf.json
    └── tauri.sidecar.conf.json
```

**它刻意保持"薄"**：桌面前端只 import 两个共享包，不 import 分析逻辑：

```tsx
import { parsePgn, type NormalizedGame } from "@chess-review/chess-core";
import { BlueBishopMark } from "@chess-review/ui";
```

文档里写得很清楚："desktop owns no analysis semantics"（桌面版不拥有任何分析语义）。桌面只负责：**开窗口 + 打开本地文件 + 起本地服务**。

### 9.2 Vite 配置（`vite.config.ts`）

```ts
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,        // Tauri 约定的 dev 端口
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },   // Rust 目录不动前端热更新
  },
});
```

### 9.3 Tauri 配置（`src-tauri/tauri.conf.json`）

```json
{
  "productName": "Open Chess Review",
  "identifier": "org.openchessreview.desktop",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",       // 开发时加载的地址
    "beforeBuildCommand": "pnpm build",      // 构建前先跑前端
    "frontendDist": "../dist"                // 生产时加载的静态目录
  },
  "bundle": {
    "active": false,
    "fileAssociations": [{ "name": "PGN", "ext": ["pgn"], ... }]  // 双击 .pgn 打开
  }
}
```

**`frontendDist` 就是"显示"的答案**：生产模式下，Rust 壳直接加载 `dist/` 里 Vite 打包出的静态文件。桌面 UI 就是浏览器渲染同一套 React —— 只是窗口由 Rust 开、资源从本地读。

### 9.4 Rust 壳的三层职责（`src-tauri/src/`）

#### (a) `main.rs` — 极简入口

```rust
fn main() { open_chess_review_desktop_lib::run(); }
```

#### (b) `lib.rs` — 命令 + 事件 + 文件读取

**命令（前端 → Rust，请求/响应）**，用 `#[tauri::command]` 注册：

```rust
#[tauri::command]
async fn open_pgn_dialog(app: tauri::AppHandle) -> Result<Option<PgnDocument>, String> {
    let selected = app.dialog().file().add_filter("Portable Game Notation", &["pgn"])
        .blocking_pick_file();
    // ... 读文件、校验
}

#[tauri::command]
fn take_pending_pgn(pending: State<'_, PendingPgn>) -> Option<PgnDocument> { ... }

#[tauri::command]
fn native_service_status(services: State<'_, NativeServices>) -> NativeServiceStatus { ... }

#[tauri::command]
async fn refresh_native_services(...) -> Result<NativeServiceStatus, String> { ... }
```

在 `invoke_handler` 里注册：
```rust
.invoke_handler(tauri::generate_handler![
    open_pgn_dialog, take_pending_pgn, native_service_status, refresh_native_services
])
```

**事件（Rust → 前端，推送）**：
```rust
app.emit(PGN_OPENED_EVENT, document);       // "desktop://pgn-opened"
app.emit(SERVICES_CHANGED_EVENT, status);   // "desktop://services-changed"
```

**为什么既要命令又要事件？**
- 用户**点按钮** → 是命令（前端发起请求）。
- 用户**双击 .pgn 文件**（App 可能已开着）→ 是事件（Rust 侧主动发生，前端被动收到）。

**安全边界**：Rust 读文件前校验（`.pgn` 后缀、≤10MiB、UTF-8、普通文件）。前端拿到的永远是校验过的 `PgnDocument`，前端代码里没有 `fs` 调用。

#### (c) `native_services.rs` — 进程管家

这是 Rust 最重的活：管理 Python sidecar 和 Ollama 的生命周期。

```
桌面启动
  → start_or_refresh()
    → refresh_ollama()   探测 :11434，没有就在 PATH/常见路径找 ollama 可执行文件并 spawn
    → refresh_local_ai() 探测 :8000，没有就 spawn sidecar 二进制，等它健康
  → 状态 emit 成 "desktop://services-changed"
窗口退出
  → shutdown_owned() 只杀 owned 进程
```

有意思的实现细节 —— 探测用**手写 TCP HTTP 而不是 HTTP 库**：

```rust
fn read_http_json(endpoint: SocketAddr, path: &str) -> Result<String, String> {
    let mut stream = TcpStream::connect_timeout(&endpoint, Duration::from_millis(450))...;
    write!(stream, "GET {path} HTTP/1.1\r\nHost: {endpoint}\r\nConnection: close\r\n\r\n")...;
    // 只解析：状态行含 " 200 " + body
}
```

**为什么不用 reqwest**：只需要"端口通、返回 200"，手写十几行 TCP 就够，不给 Cargo 加一个重型依赖。KISS。

### 9.5 前端怎么用这些能力（`desktop/src/app.tsx`）

```tsx
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// 命令：打开系统文件对话框
const document = await invoke<NativePgnDocument | null>("open_pgn_dialog");

// 事件：监听文件被打开 / 服务状态变化
unlisten = await listen<NativePgnDocument>("desktop://pgn-opened", (event) => {
  inspectPgn(event.payload.contents, event.payload.fileName);
  void invoke("take_pending_pgn");
});
```

**`isTauri()` 是关键**：同一份 React 代码，在浏览器里跑时跳过 Tauri 调用、用 `<input type="file">` 上传；在 Tauri 窗口里跑时用原生对话框。一个组件同时服务 Web 预览和原生两种运行时。

### 9.6 数据序列化约定

Rust `PgnDocument`（serde）↔ TS `NativePgnDocument`，字段名 camelCase 对齐：

```rust
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct PgnDocument { file_name: String, contents: String }
```
```ts
interface NativePgnDocument { fileName: string; contents: string; }
```

### 9.7 验证

```bash
cd apps/desktop && pnpm tauri dev
# 窗口打开 → 点 Open PGN… → 系统对话框 → 选中 .pgn → 棋局渲染
# 服务状态区显示 Ollama / local-ai 状态
```

---

## 10. 阶段八：Sidecar 打包（PyInstaller）

### 10.1 问题

桌面用户不会装 Python + PyTorch。怎么把几百 MB 的 Python 环境塞进安装包？

### 10.2 答案：PyInstaller 编译成单文件

`scripts/build-local-ai-sidecar.mjs`：

```js
const targetTriple = /* rustc --print host-tuple 得到平台三元，如 aarch64-apple-darwin */;

execFileSync("uv", [
  "run", "--project", serviceRoot,
  "--extra", "maia", "--extra", "bundle",
  "pyinstaller",
  "--noconfirm", "--clean", "--onefile",
  "--name", "chess-review-local-ai",
  "--paths", join(serviceRoot, "src"),
  "--collect-all", "maia3",
  "--collect-all", "chess_review_local_ai",
  "--distpath", distRoot,
  join(serviceRoot, "sidecar_entry.py"),   // Python 入口
], { stdio: "inherit" });

// 重命名 + 拷贝到 Tauri 约定的 binaries/ 目录
const destination = join(binariesRoot, `chess-review-local-ai-${targetTriple}`);
cpSync(built, destination);
chmodSync(destination, 0o755);
```

**要点：**
- `--onefile` → 单个可执行文件（内嵌解释器 + FastAPI + torch + 模型加载代码）。
- `--collect-all maia3` → 把 Maia 模型代码全收进来（PyInstaller 默认可能漏）。
- 文件名带平台三元（`-aarch64-apple-darwin`），**Tauri 按目标平台找对应二进制**。
- 用 `rustc --print host-tuple` 获取当前平台三元，保证与 Rust 壳一致。

### 10.3 告诉 Tauri 这个二进制存在

`src-tauri/tauri.sidecar.conf.json`：

```json
{ "bundle": { "externalBin": ["binaries/chess-review-local-ai"] } }
```

构建时 Tauri 会把 `binaries/chess-review-local-ai-<triple>` 打进安装包。运行时 Rust 从自身所在目录找到它并 spawn。

### 10.4 完整链路（桌面版的服务从哪来）

```
构建时：Python 源码 → PyInstaller → binaries/chess-review-local-ai-aarch64-apple-darwin
                               → tauri build 把它打进 .dmg/.app
运行时：Rust start_or_refresh() → 探测 :8000 无 → spawn sidecar 二进制
                               → 等 /health 通 → emit 状态给前端 → 前端开始 fetch :8000
```

---

## 11. 阶段九：构建与发布流水线（三平台）

### 11.1 本机命令（`apps/desktop/package.json`）

```json
"sidecar:build":      "node ../../scripts/build-local-ai-sidecar.mjs",
"tauri:build:macos":  "pnpm sidecar:build && CI=true tauri build --config src-tauri/tauri.sidecar.conf.json --bundles app,dmg --no-sign",
"tauri:build:windows":"pnpm sidecar:build && tauri build --config src-tauri/tauri.sidecar.conf.json --bundles nsis",
"tauri:build:linux":  "pnpm sidecar:build && tauri build --config src-tauri/tauri.sidecar.conf.json --bundles deb,appimage"
```

一次 `tauri build` 内部依次做：

```
① beforeBuildCommand: pnpm build   → vite build → dist/   (前端静态文件)
② cargo build --release             → 编译 Rust 壳
③ 按 tauri.conf.json 打包:
     frontendDist: "../dist"                    前端塞哪
     bundle.externalBin: ["binaries/..."]        Python 二进制塞哪
   → 产物：.app/.dmg (macOS) / .exe (Windows) / .deb/.AppImage (Linux)
```

### 11.2 CI 三平台矩阵（`.github/workflows/desktop-artifacts.yml`）

`workflow_dispatch` 或打 `desktop-v*` 标签触发，矩阵并行构建：

| 平台 | runner | 产物 |
|------|--------|------|
| macOS arm64 | macos-latest | .app + .dmg |
| Windows x64 | windows-latest | NSIS .exe |
| Linux x64 | ubuntu-22.04 | .deb + .AppImage |

关键步骤顺序：
```yaml
- pnpm/action-setup + setup-node (cache pnpm)
- astral-sh/setup-uv                       # Python 工具链
- dtolnay/rust-toolchain (macOS 加 targets)
- swatinem/rust-cache                      # 缓存 Rust 增量编译
# 然后: pnpm install → pnpm sidecar:build → tauri build
# 最后: actions/upload-artifact 上传安装包
```

Linux 需要系统依赖（WebKit2GTK 等）：
```yaml
- run: sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf xdg-utils
```

### 11.3 验证

```bash
# macOS
pnpm tauri:build:macos
ls apps/desktop/src-tauri/target/*/release/bundle/dmg/*.dmg
```

---

## 12. 阶段十：测试与 CI

### 12.1 三层测试（`docs/testing.md` 有完整说明）

| 层 | 框架 | 覆盖对象 | 命令 |
|----|------|---------|------|
| JS 单元 | vitest | packages/* 与 apps/web 的 lib/hooks | `pnpm -r test` |
| Python 单测 | pytest | services/local-ai | `uv run pytest services/local-ai/tests` |
| 浏览器 E2E | Playwright | 关键用户流程 + 视觉回归 | `pnpm test:e2e` |

### 12.2 CI 流水线（`.github/workflows/ci.yml`）

三个独立 job，并行跑：

```
web-quality   : typecheck + lint + vitest + next build   (Node 24 + pnpm)
local-ai      : uv sync --extra dev + pytest              (uv 缓存锁文件)
browser-e2e   : playwright install chromium + workflows.spec.ts
```

**为什么分三个 job**：Node 和 Python 环境完全不同，拆开能并行、能隔离失败、缓存各自独立。这就是多语言项目 CI 的第一原则——**各语言各跑各的测试，互不阻塞**。

### 12.3 Playwright 配置（根 `playwright.config.ts`）

```ts
// E2E 直接对 Next.js dev 或 build 产物跑
// testDir: e2e/
// 视觉回归用 --update-snapshots=all 更新基线
```

---

## 13. 常见坑与排查

| 症状 | 原因 | 处理 |
|------|------|------|
| `pnpm dev` 卡在 "local-ai did not become ready" | Python 服务起不来 | 看 prefixed 日志；先 `pnpm dev:check` 看哪些通 |
| 浏览器里 Maia 一直 offline | Python 没起 / 端口占用 | `curl :8000/health`；确认 CORS 允许 localhost |
| 下载了模型仍 409 | 模型没缓存成功 | 看 `/health` 的 `maia_models` 状态字段 |
| `tauri build` 找不到 sidecar | 没先跑 `sidecar:build` | 顺序：sidecar → build；或 `pnpm tauri:build:macos` 一步到位 |
| Linux 构建报 webkit 缺失 | 缺系统依赖 | 装 `libwebkit2gtk-4.1-dev` 等（见 CI 步骤） |
| 桌面版双击 .pgn 没反应 | 文件关联没生效 / 单实例 | 看 `lib.rs` single-instance 插件与 macOS `RunEvent::Opened` 分支 |
| `exactOptionalPropertyTypes` 报错 | 可选字段赋了 `undefined` | 用展开：`...(x === null ? {} : { x })` 而不是 `x: undefined` |

---

## 14. 个人开发者节奏建议（时间线）

一个周末不可能做完，但按这个节奏每周交付可运行的东西：

| 周 | 目标 | 完成标志 |
|----|------|---------|
| 第 1 周 | Monorepo + chess-core + Web 最小页 | 浏览器能导入 PGN 并显示棋局 |
| 第 2-3 周 | Stockfish WASM + 分析 | 能出评估分数和最佳着法 |
| 第 4 周 | 本地库 + 导出 | 能保存、能导出 PGN/PNG |
| 第 5 周 | Python 服务 + 健康轮询 | 状态能从 offline 切 online |
| 第 6-7 周 | 桌面壳 + sidecar | `tauri dev` 能打开本地文件 |
| 第 8 周 | CI 三平台 | tag 后自动出安装包 |

**贯穿始终的铁律**：
1. 每步都可独立运行、独立验证，绝不允许"三种语言全起才能跑"。
2. 逻辑永远先写进 packages/，再被 app 消费。
3. 跨语言契约先定结构（shared + schemas），再写实现。

---

## 15. 附录：命令速查表

```bash
# ── 安装与基础 ──────────────────────────────
pnpm install --frozen-lockfile
uv sync --project services/local-ai --extra dev --locked

# ── 开发 ────────────────────────────────────
pnpm dev             # 全量：Web + Python + Ollama
pnpm dev:web         # 只有 Web
pnpm dev:local-ai    # 只有服务
pnpm dev:check       # 只报告不启动

# ── 质量 ────────────────────────────────────
pnpm typecheck
pnpm lint
pnpm test            # vitest 全仓
uv run --project services/local-ai --extra dev pytest services/local-ai/tests
pnpm test:e2e

# ── 桌面 ────────────────────────────────────
cd apps/desktop
pnpm tauri dev                     # 开发模式
pnpm tauri:build:macos             # 或 windows / linux
```

---

> 本文基于 Open Chess Review 仓库的既有实现归纳而成。想读一手代码，按此顺序：
> `pnpm-workspace.yaml` → `tsconfig.base.json` → `packages/chess-core/package.json` →
> `apps/web/package.json` → `apps/web/src/lib/local-ai.ts` → `scripts/dev.mjs` →
> `apps/desktop/src/app.tsx` → `apps/desktop/src-tauri/src/lib.rs` →
> `apps/desktop/src-tauri/src/native_services.rs` → `scripts/build-local-ai-sidecar.mjs` →
> `.github/workflows/ci.yml` → `.github/workflows/desktop-artifacts.yml`
