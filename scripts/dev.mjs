/* global AbortController, URL, clearTimeout, fetch, process, setInterval, setTimeout */

import { access } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { spawn } from "node:child_process";

const CHECK_ONLY = process.argv.includes("--check");
const SERVICES_ONLY = process.argv.includes("--services-only");
const OLLAMA_URL = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const LOCAL_AI_URL = (process.env.NEXT_PUBLIC_LOCAL_AI_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:12b-it-qat";
const WEB_PORT = process.env.PORT ?? "3000";
const ownedChildren = new Set();
let stopping = false;

function log(scope, message) {
  process.stdout.write(`[${scope}] ${message}\n`);
}

async function fetchJson(url, timeout = 1_500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPage(url, timeout = 1_500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { body: await response.text(), poweredBy: response.headers.get("x-powered-by") };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function waitFor(url, attempts, label) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await fetchJson(url);
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`${label} did not become ready at ${url}. Check the prefixed logs above.`);
}

function pipeLines(stream, scope, target) {
  let pending = "";
  stream?.setEncoding("utf8");
  stream?.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) if (line) target.write(`[${scope}] ${line}\n`);
  });
  stream?.on("end", () => {
    if (pending) target.write(`[${scope}] ${pending}\n`);
  });
}

function startOwned(scope, command, args, options = {}, fatal = true) {
  const child = spawn(command, args, {
    ...options,
    env: { ...process.env, ...options.env },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.__scope = scope;
  ownedChildren.add(child);
  pipeLines(child.stdout, scope, process.stdout);
  pipeLines(child.stderr, scope, process.stderr);
  child.on("error", (error) => log(scope, `failed to start: ${error.message}`));
  child.on("exit", (code, signal) => {
    ownedChildren.delete(child);
    if (!stopping && code !== 0 && fatal) {
      log(scope, `exited unexpectedly (${signal ?? `code ${code}`}).`);
      shutdown(1);
    } else if (!stopping && code !== 0) {
      log(scope, `optional process exited (${signal ?? `code ${code}`}); Browser Core remains available.`);
    }
  });
  return child;
}

async function isExecutable(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function locateOllama() {
  const executable = process.platform === "win32" ? "ollama.exe" : "ollama";
  const candidates = (process.env.PATH ?? "").split(delimiter).filter(Boolean).map((entry) => join(entry, executable));
  if (process.platform === "darwin") candidates.push("/Applications/Ollama.app/Contents/Resources/ollama");
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    candidates.push(join(process.env.LOCALAPPDATA, "Programs", "Ollama", "ollama.exe"));
  }
  for (const candidate of candidates) if (await isExecutable(candidate)) return candidate;
  return null;
}

async function ensureOllama() {
  let tags = await fetchJson(`${OLLAMA_URL}/api/tags`);
  if (tags) {
    log("ollama", `reusing service at ${OLLAMA_URL}; this launcher does not own it.`);
  } else if (CHECK_ONLY) {
    log("ollama", `offline at ${OLLAMA_URL}.`);
    return;
  } else {
    const executable = await locateOllama();
    if (!executable) {
      log("ollama", "not running and no executable was found. Browser analysis remains available.");
      return;
    }
    log("ollama", `starting ${executable} serve (owned by this launcher).`);
    startOwned("ollama", executable, ["serve"], {}, SERVICES_ONLY);
    tags = await waitFor(`${OLLAMA_URL}/api/tags`, 30, "Ollama");
  }

  if (!tags) return;
  const models = Array.isArray(tags.models) ? tags.models : [];
  const available = models.some((model) => model?.name === OLLAMA_MODEL || model?.model === OLLAMA_MODEL);
  if (available) {
    log("ollama", `configured model ${OLLAMA_MODEL} is available.`);
  } else {
    log("ollama", `model ${OLLAMA_MODEL} is missing. Download only with explicit approval: ollama pull ${OLLAMA_MODEL}`);
  }
}

async function ensureLocalAi() {
  const healthUrl = `${LOCAL_AI_URL}/health`;
  const existing = await fetchJson(healthUrl);
  if (existing) {
    log("local-ai", `reusing service at ${LOCAL_AI_URL}; this launcher does not own it.`);
    return;
  }
  if (CHECK_ONLY) {
    log("local-ai", `offline at ${LOCAL_AI_URL}.`);
    return;
  }
  log("local-ai", `starting optional service at ${LOCAL_AI_URL} (owned by this launcher).`);
  startOwned("local-ai", "uv", ["run", "uvicorn", "chess_review_local_ai.main:app", "--host", "127.0.0.1", "--port", "8000"], {
    cwd: new URL("../services/local-ai", import.meta.url),
  }, SERVICES_ONLY);
  await waitFor(healthUrl, 40, "local-ai");
}

async function ensureWeb() {
  const url = `http://127.0.0.1:${WEB_PORT}`;
  const existing = await fetchPage(url);
  if (existing) {
    if (existing.poweredBy?.toLowerCase().includes("next") && existing.body.includes("Open Chess Review")) {
      log("web", `reusing Open Chess Review at ${url}; this launcher does not own it.`);
      return null;
    }
    throw new Error(`port ${WEB_PORT} is already serving another application. Set PORT to an unused value or stop that process.`);
  }
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  log("web", `starting Next.js at ${url}.`);
  return startOwned("web", pnpm, ["--filter", "@chess-review/web", "exec", "next", "dev", "--port", WEB_PORT]);
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  const children = [...ownedChildren];
  if (children.length) log("dev", `stopping ${children.length} process${children.length === 1 ? "" : "es"} started by this launcher.`);
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 800).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

try {
  const web = !CHECK_ONLY && !SERVICES_ONLY ? await ensureWeb() : null;
  if (SERVICES_ONLY || CHECK_ONLY) {
    await ensureOllama();
    await ensureLocalAi();
  } else {
    try {
      await ensureOllama();
    } catch (error) {
      log("ollama", `${error instanceof Error ? error.message : String(error)} Browser Core remains available.`);
    }
    try {
      await ensureLocalAi();
    } catch (error) {
      log("local-ai", `${error instanceof Error ? error.message : String(error)} Browser Core remains available.`);
    }
  }
  if (CHECK_ONLY) {
    log("dev", "runtime check complete; no process was started.");
    process.exit(0);
  }
  if (SERVICES_ONLY) {
    log("dev", "local services are ready. Keep this process open; press Ctrl+C to stop services started here.");
    setInterval(() => undefined, 60_000);
  } else {
    if (web) web.on("exit", (code) => shutdown(code ?? 0));
    else setInterval(() => undefined, 60_000);
  }
} catch (error) {
  log("dev", error instanceof Error ? error.message : String(error));
  shutdown(1);
}
