#!/usr/bin/env node
/* global URL, clearTimeout, console, document, indexedDB, process, setTimeout, structuredClone, Worker */
/**
 * C01 diagnostic: Opera Game `15. Bxd7+` (ply 29) evaluation anomaly.
 *
 * READ-ONLY with respect to product code. It never edits apps/, packages/ or
 * services/. It measures three independent things:
 *
 *   1. The raw UCI transcript of the shipped browser WASM engine
 *      (`/engine/stockfish.js`) for the root FENs of the requested plies, the
 *      restricted `searchmoves <played uci>` search, and the resulting position.
 *      The engine's own `id name` line is captured verbatim.
 *   2. The `GameAnalysisV2` the real app wrote to IndexedDB
 *      (`open-chess-review` → `objective-analyses`) after driving the real UI
 *      in an isolated, cold Playwright context.
 *   3. A rebuild of the same canonical pipeline from the raw transcript, using
 *      the product's own analysis functions (not transcriptions), so raw truth
 *      and stored record can be compared field by field.
 *
 * It also runs one decisive cache experiment: an identity-compatible but
 * semantically stale record is seeded for ply 29, then the review route is
 * reloaded to observe whether the app reuses it. Seeded values are chosen to
 * reproduce the audit's reported ~21.0 win-percentage-point loss / Accuracy
 * ~39, which links a stale played-move score to the reported numbers.
 *
 * Usage (from the repo root):
 *   node scripts/diagnose-objective-game.mjs
 *   node scripts/diagnose-objective-game.mjs --ply-from 27 --ply-to 31
 *   node scripts/diagnose-objective-game.mjs --base-url http://127.0.0.1:3000 --no-spawn
 *
 * Options:
 *   --base-url <url>      App origin (default http://127.0.0.1:3000)
 *   --ply-from <n>        First ply to report (default 27)
 *   --ply-to <n>          Last ply to report (default 31)
 *   --out-dir <dir>       Raw output directory (default $TMPDIR/c01-opera-evidence)
 *   --pool <n>            Raw engine worker count (default 4)
 *   --job-timeout <sec>   Per-search UCI timeout (default 180)
 *   --native-stockfish <path>
 *                         Optional native Stockfish reference binary; its
 *                         `uci` identification is recorded in the report.
 *   --no-spawn            Do not start `pnpm dev:web` if the origin is down
 *   --no-cache-probe      Skip the stale-record reuse experiment
 */

import { registerHooks, createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

// Node strips TypeScript types natively; product sources use extensionless
// relative imports, so resolve them the way the bundler does.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".json")) {
      const url = specifier.startsWith(".") && context.parentURL ? new URL(specifier, context.parentURL).href : specifier;
      return { url, shortCircuit: true, importAttributes: { type: "json" } };
    }
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      try {
        return nextResolve(specifier, context);
      } catch {
        const base = new URL(specifier, context.parentURL);
        for (const candidate of [`${base.href}.ts`, `${base.href}/index.ts`]) {
          if (existsSync(fileURLToPath(candidate))) return { url: candidate, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const parsed = {
    baseUrl: "http://127.0.0.1:3000",
    plyFrom: 27,
    plyTo: 31,
    outDir: path.join(os.tmpdir(), "c01-opera-evidence"),
    pool: 4,
    jobTimeoutMs: 180_000,
    nativeStockfish: null,
    spawn: true,
    cacheProbe: true,
    depthSweep: "10,12,14,16",
  };
  const numeric = { "--ply-from": "plyFrom", "--ply-to": "plyTo", "--pool": "pool" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-spawn") parsed.spawn = false;
    else if (arg === "--no-cache-probe") parsed.cacheProbe = false;
    else if (arg === "--base-url") parsed.baseUrl = argv[++i];
    else if (arg === "--out-dir") parsed.outDir = argv[++i];
    else if (arg === "--job-timeout") parsed.jobTimeoutMs = Number(argv[++i]) * 1000;
    else if (arg === "--native-stockfish") parsed.nativeStockfish = argv[++i];
    else if (arg === "--depth-sweep") parsed.depthSweep = argv[++i];
    else if (numeric[arg] !== undefined) parsed[numeric[arg]] = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  parsed.outDir = path.resolve(REPO_ROOT, parsed.outDir);
  return parsed;
}

const options = parseArgs(process.argv.slice(2));

// ---------------------------------------------------------------------------
// Product modules: real implementations, not transcriptions
// ---------------------------------------------------------------------------

const analysis = await import(pathToFileURL(path.join(REPO_ROOT, "packages/analysis/src/index.ts")).href);
const chessCore = await import(pathToFileURL(path.join(REPO_ROOT, "packages/chess-core/src/index.ts")).href);
const protocol = await import(pathToFileURL(path.join(REPO_ROOT, "packages/stockfish/src/protocol.ts")).href);
const example = await import(pathToFileURL(path.join(REPO_ROOT, "apps/web/src/lib/example-game.ts")).href);
const storageConstants = await import(pathToFileURL(path.join(REPO_ROOT, "apps/web/src/lib/browser-storage.ts")).href);
const openingsModule = await import(pathToFileURL(path.join(REPO_ROOT, "packages/openings/src/index.ts")).href);

const requireFromChessCore = createRequire(path.join(REPO_ROOT, "packages/chess-core/package.json"));
const chessModule = await import(pathToFileURL(requireFromChessCore.resolve("chess.js")).href);
const Chess = chessModule.Chess ?? chessModule.default?.Chess;
if (typeof Chess !== "function") throw new Error("Unable to load chess.js from the packages/chess-core resolution path.");

const {
  buildGameAnalysis, divideGame, planObjectiveVerification, normalizeToWhitePov, winPercentFromScore,
  CLASSIFICATION_MULTI_PV, OBJECTIVE_ALGORITHM_VERSION, CLASSIFICATION_THRESHOLDS, VERIFICATION_POLICY_VERSION,
} = analysis;
const { parsePgn, noLegalMoveTerminalStatus, replayUciLine } = chessCore;

const browserEngineSource = await readFile(path.join(REPO_ROOT, "packages/stockfish/src/browser-engine.ts"), "utf8");
const STOCKFISH_VERSION = browserEngineSource.match(/export const STOCKFISH_VERSION\s*=\s*"([^"]+)"/)?.[1];
if (!STOCKFISH_VERSION) throw new Error("Unable to read STOCKFISH_VERSION from packages/stockfish/src/browser-engine.ts.");

const DEPTH = 10;
const MULTI_PV = CLASSIFICATION_MULTI_PV; // 3, fixed baseline classification width

// ---------------------------------------------------------------------------
// Game ledger
// ---------------------------------------------------------------------------

const game = parsePgn(example.EXAMPLE_PGN);
const plies = game.plies;
const LAST_INDEX = plies.length;
const fenAt = (index) => (index === 0 ? game.initialFen : plies[index - 1].fenAfter);
const sideToMoveAt = (index) => (fenAt(index).split(" ")[1] === "b" ? "black" : "white");
const positionCommand = (index) => {
  const history = plies.slice(0, index).map((ply) => ply.uci);
  return history.length === 0 ? `position fen ${game.initialFen}` : `position fen ${game.initialFen} moves ${history.join(" ")}`;
};
const isTerminal = (index) => noLegalMoveTerminalStatus(fenAt(index)) !== null;

// ---------------------------------------------------------------------------
// Dev server
// ---------------------------------------------------------------------------

function probe(url, timeoutMs = 2_000) {
  return new Promise((resolve) => {
    const request = http.request(url, { method: "GET" }, (response) => {
      response.resume();
      resolve(true);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve(false);
    });
    request.end();
  });
}

let spawnedServer = null;
async function ensureServer() {
  if (await probe(options.baseUrl)) return "reachable";
  if (!options.spawn) throw new Error(`${options.baseUrl} is not reachable. Start \`pnpm dev:web\` first, or drop --no-spawn.`);
  process.stderr.write(`[c01] ${options.baseUrl} unreachable; starting \`pnpm dev:web\`…\n`);
  spawnedServer = spawn("pnpm", ["dev:web"], { cwd: REPO_ROOT, stdio: "ignore" });
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    if (await probe(options.baseUrl)) return "spawned";
  }
  throw new Error("Timed out waiting for the dev server to become reachable.");
}

// ---------------------------------------------------------------------------
// Raw engine transcript (shipped browser worker)
// ---------------------------------------------------------------------------

const jobs = [];
const jobResults = new Map();
let engineIdentity = null;

function addJob(job) {
  if (jobResults.has(job.id)) return job.id;
  jobResults.set(job.id, null);
  jobs.push(job);
  return job.id;
}
const rootJob = (index, depth, multiPv) => addJob({ id: `root:${index}:d${depth}:mp${multiPv}`, index, depth, multiPv, searchMoves: [] });
const restrictedJob = (ply, depth) => addJob({ id: `restricted:${ply}:d${depth}`, index: ply - 1, depth, multiPv: 1, searchMoves: [plies[ply - 1].uci] });

async function runEnginePool(page, pending, size, timeoutMs) {
  if (pending.length === 0) return [];
  return page.evaluate(
    async ({ jobs: batch, poolSize, timeout }) => {
      const groups = Array.from({ length: Math.min(poolSize, batch.length) }, () => []);
      batch.forEach((job, index) => groups[index % groups.length].push(job));

      const runWorker = async (list) => {
        const worker = new Worker("/engine/stockfish.js");
        const state = { lines: [], waiters: [] };
        worker.onmessage = (event) => {
          const text = typeof event.data === "string" ? event.data : String(event.data);
          state.lines.push(text);
          for (const waiter of [...state.waiters]) waiter(text);
        };
        const waitFor = (predicate, limit) => new Promise((resolve, reject) => {
          const existing = state.lines.find(predicate);
          if (existing !== undefined) {
            resolve(existing);
            return;
          }
          const timer = setTimeout(() => {
            const at = state.waiters.indexOf(waiter);
            if (at >= 0) state.waiters.splice(at, 1);
            reject(new Error("UCI timeout"));
          }, limit);
          const waiter = (line) => {
            if (!predicate(line)) return;
            const at = state.waiters.indexOf(waiter);
            if (at >= 0) state.waiters.splice(at, 1);
            clearTimeout(timer);
            resolve(line);
          };
          state.waiters.push(waiter);
        });

        worker.postMessage("uci");
        await waitFor((line) => line === "uciok", 60_000);
        const identification = state.lines.filter((line) => line.startsWith("id name ") || line.startsWith("id author "));
        worker.postMessage("isready");
        await waitFor((line) => line === "readyok", 120_000);

        const out = [];
        for (const job of list) {
          state.lines.length = 0;
          worker.postMessage(`setoption name MultiPV value ${job.multiPv}`);
          worker.postMessage("ucinewgame");
          worker.postMessage(job.positionCommand);
          const restriction = job.searchMoves.length > 0 ? ` searchmoves ${job.searchMoves.join(" ")}` : "";
          worker.postMessage(`go depth ${job.depth}${restriction}`);
          await waitFor((line) => line.startsWith("bestmove "), timeout);
          out.push({ id: job.id, lines: [...state.lines], identification });
        }
        worker.postMessage("quit");
        worker.terminate();
        return out;
      };

      const batches = await Promise.all(groups.map(runWorker));
      return { results: batches.flat(), identification: batches[0]?.[0]?.identification ?? [] };
    },
    {
      jobs: pending.map((job) => ({
        id: job.id,
        depth: job.depth,
        multiPv: job.multiPv,
        positionCommand: positionCommandOf(job),
        searchMoves: job.searchMoves,
      })),
      poolSize: size,
      timeout: timeoutMs,
    },
  );
}

function positionCommandOf(job) {
  return positionCommand(job.index);
}

async function flushJobs(page) {
  const pending = jobs.filter((job) => jobResults.get(job.id) === null);
  if (pending.length === 0) return;
  const { results, identification } = await runEnginePool(page, pending, options.pool, options.jobTimeoutMs);
  if (identification?.length) engineIdentity = identification;
  for (const result of results) jobResults.set(result.id, result);
}

/** Parse a raw transcript into White-POV MultiPV lines plus bestmove. */
function parseTranscript(jobId) {
  const result = jobResults.get(jobId);
  if (!result) throw new Error(`Missing raw transcript for job ${jobId}.`);
  const job = jobs.find((candidate) => candidate.id === jobId);
  const sideToMove = sideToMoveAt(job.index);
  const byRank = new Map();
  const rawWitnessByRank = new Map();
  let reachedDepth = 0;
  let bestMove = null;
  for (const line of result.lines) {
    const parsed = protocol.parseUciInfo(line);
    if (parsed?.score && parsed.pv.length > 0) {
      byRank.set(parsed.multiPv, {
        rank: parsed.multiPv,
        whitePov: normalizeToWhitePov(parsed.score, "side-to-move", sideToMove),
        raw: parsed.score,
        depth: parsed.depth ?? 0,
        pv: parsed.pv,
      });
      rawWitnessByRank.set(parsed.multiPv, line);
      reachedDepth = Math.max(reachedDepth, parsed.depth ?? 0);
    }
    const best = protocol.parseBestMove(line);
    if (best) bestMove = best;
  }
  const lines = [...byRank.values()].sort((left, right) => left.rank - right.rank);
  return {
    jobId,
    fen: fenAt(job.index),
    sideToMove,
    depthRequested: job.depth,
    multiPvRequested: job.multiPv,
    searchMoves: job.searchMoves,
    reachedDepth,
    lineCount: result.lines.length,
    bestMove,
    lines,
    analysis: {
      fen: fenAt(job.index),
      score: lines[0]?.whitePov ?? { kind: "cp", cp: 0 },
      lines: lines.map((line) => ({ rank: line.rank, score: line.whitePov, depth: line.depth, pv: line.pv })),
      depth: job.depth,
      ...(bestMove === null ? {} : { bestMove }),
    },
    rawWitness: Object.fromEntries([...rawWitnessByRank.entries()].map(([rank, line]) => [rank, line])),
  };
}

// ---------------------------------------------------------------------------
// Playwright helpers
// ---------------------------------------------------------------------------

async function readStore(page, store) {
  return page.evaluate(
    ({ dbName, storeName }) => new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          resolve([]);
          return;
        }
        const tx = db.transaction(storeName, "readonly");
        const values = tx.objectStore(storeName).getAll();
        const keys = tx.objectStore(storeName).getAllKeys();
        tx.oncomplete = () => {
          const rows = values.result.map((value, index) => ({ key: keys.result[index], value }));
          db.close();
          resolve(rows);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    }),
    { dbName: storageConstants.DATABASE_NAME, storeName: store },
  );
}

async function putStore(page, store, key, value) {
  return page.evaluate(
    ({ dbName, storeName, recordKey, record }) => new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(record, recordKey);
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    }),
    { dbName: storageConstants.DATABASE_NAME, storeName: store, recordKey: key, record: value },
  );
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const serverMode = await ensureServer();

const { chromium } = await import("@playwright/test");
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const context = await browser.newContext();
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

const runStartedAt = new Date().toISOString();

// 1. Drive the real UI: Home → paste the example PGN → Analyze game →
//    the review route auto-starts the baseline review at the default depth.
//    This is the path e2e/workflows.spec.ts exercises; the example button is
//    equivalent but both need React hydration. A `fill` before hydration is
//    discarded by the controlled textarea, so verify the value stuck.
await page.goto(`${options.baseUrl}/`, { waitUntil: "domcontentloaded" });
const pgnField = page.getByLabel("Paste a complete PGN");
await pgnField.waitFor({ state: "visible", timeout: 60_000 });
let filled = false;
for (let attempt = 0; attempt < 40 && !filled; attempt += 1) {
  await pgnField.fill(example.EXAMPLE_PGN);
  await page.waitForTimeout(250);
  filled = (await pgnField.inputValue()) === example.EXAMPLE_PGN;
}
if (!filled) throw new Error("The Home PGN textarea never kept the pasted example PGN (React hydration did not attach).");
const analyzeButton = page.getByRole("button", { name: "Analyze game →" });
await analyzeButton.waitFor({ state: "visible", timeout: 60_000 });
for (let attempt = 0; attempt < 5; attempt += 1) {
  await analyzeButton.click().catch(() => undefined);
  try {
    await page.waitForURL(/\/review\/[^/]+$/, { timeout: 15_000 });
    break;
  } catch (error) {
    if (attempt === 4) throw error;
  }
}
const reviewUrl = page.url();
const reviewId = reviewUrl.split("/").pop();

const isOperaAnalysis = (value) => typeof value?.game?.pgn === "string" && value.game.pgn.includes("Opera Game");
let stored = null;
const appDeadline = Date.now() + 15 * 60_000;
while (Date.now() < appDeadline && !stored) {
  const rows = await readStore(page, storageConstants.ANALYSIS_STORE);
  stored = rows.find((row) => isOperaAnalysis(row.value)) ?? null;
  if (!stored) await page.waitForTimeout(1_000);
}
if (!stored) throw new Error(`The app never stored an Opera Game analysis in ${storageConstants.ANALYSIS_STORE}.`);
const appAnalysis = stored.value;
const indexRows = await readStore(page, storageConstants.ANALYSIS_INDEX_STORE);
const appProjection = indexRows.find((row) => row.key === stored.key)?.value ?? null;
const appRenderedReview = await page.evaluate(() => document.body.innerText.includes("MOVE QUALITY"));

// Small guard: the app's own pool must be idle before the raw pool competes.
await page.waitForTimeout(1_000);

// 2. Raw baseline: every position the app's baseline pass searches.
for (let index = 0; index <= LAST_INDEX; index += 1) {
  if (!isTerminal(index)) rootJob(index, DEPTH, MULTI_PV);
}
await flushJobs(page);

const baselineRoot = new Map();
for (let index = 0; index <= LAST_INDEX; index += 1) {
  baselineRoot.set(index, isTerminal(index) ? null : parseTranscript(`root:${index}:d${DEPTH}:mp${MULTI_PV}`));
}

// 3. Baseline restricted searches for played moves outside MultiPV (app behaviour).
const baselineMissing = plies.flatMap((ply, index) => (
  baselineRoot.get(index)?.lines.some((line) => line.pv[0] === ply.uci) ? [] : [{ ply: ply.ply, index }]
));
for (const item of baselineMissing) restrictedJob(item.ply, DEPTH);
await flushJobs(page);
const baselineRestricted = new Map(baselineMissing.map((item) => [item.ply, parseTranscript(`restricted:${item.ply}:d${DEPTH}`)]));
// buildGameAnalysis consumes engine results, not this script's transcript wrapper.
const baselineRestrictedAnalyses = new Map([...baselineRestricted].map(([ply, parsed]) => [ply, parsed.analysis]));

// 4. Rebuild the baseline pipeline from raw truth. `recognizeOpening` matches
//    the app's own store initialization, so book plies classify identically.
const opening = openingsModule.recognizeOpening(game) ?? null;
const baselinePositions = assemblePositions(baselineRoot, baselineRestrictedAnalyses, DEPTH);
const baselineAnalysis = buildGameAnalysis({
  game,
  ...(opening === null ? {} : { opening }),
  division: divideGame(game),
  stockfishVersion: STOCKFISH_VERSION,
  depth: DEPTH,
  multiPv: MULTI_PV,
  createdAt: runStartedAt,
  positionAnalyses: baselinePositions,
  playedMoveAnalyses: baselineRestrictedAnalyses,
});

// 5. Verification pass, mirroring app orchestration (same plan, same merge).
const plan = planObjectiveVerification(baselineAnalysis);
const verifyIndexes = [...new Set(plan.requests.flatMap((request) => [request.ply - 1, request.ply]))]
  .filter((index) => index >= 0 && index <= LAST_INDEX && !isTerminal(index));
for (const index of verifyIndexes) rootJob(index, plan.depth, plan.multiPv);
await flushJobs(page);

const verifiedRoot = new Map(verifyIndexes.map((index) => [index, parseTranscript(`root:${index}:d${plan.depth}:mp${plan.multiPv}`)]));
const verificationMissing = verifyIndexes.flatMap((index) => {
  const move = plies[index];
  if (!move) return [];
  return verifiedRoot.get(index).lines.some((line) => line.pv[0] === move.uci) ? [] : [{ ply: index + 1, index }];
});
for (const item of verificationMissing) restrictedJob(item.ply, plan.depth);
await flushJobs(page);

const mergedRoot = new Map(baselineRoot);
for (const [index, parsed] of verifiedRoot) mergedRoot.set(index, parsed);
const mergedRestricted = new Map(baselineRestricted);
for (const item of verificationMissing) mergedRestricted.set(item.ply, parseTranscript(`restricted:${item.ply}:d${plan.depth}`));
const mergedRestrictedAnalyses = new Map([...mergedRestricted].map(([ply, parsed]) => [ply, parsed.analysis]));

const verifiedAnalysis = buildGameAnalysis({
  game,
  ...(opening === null ? {} : { opening }),
  division: divideGame(game),
  stockfishVersion: STOCKFISH_VERSION,
  depth: DEPTH,
  multiPv: MULTI_PV,
  createdAt: runStartedAt,
  positionAnalyses: assemblePositions(mergedRoot, mergedRestrictedAnalyses, DEPTH),
  playedMoveAnalyses: mergedRestrictedAnalyses,
  verifiedPlies: new Set(plan.requests.map((request) => request.ply)),
  verificationReasons: new Map(plan.requests.map((request) => [request.ply, request.reasons])),
  requireVerifiedSpecialAnnotations: true,
});

// 6. Depth sweep at the ply-29 root: the mechanism evidence. The app fixes the
//    baseline classification at depth 10; these searches show where the same
//    shipped engine stops agreeing with that depth.
const ply29RootIndex = 28;
const sweepDepths = options.depthSweep.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0);
for (const depth of sweepDepths) {
  rootJob(ply29RootIndex, depth, MULTI_PV);
  restrictedJob(29, depth);
}
// The exact configuration a verification request would use for this root, so
// the report can show what the app's own verification pass would have produced.
rootJob(ply29RootIndex, plan.depth, plan.multiPv);
await flushJobs(page);
const depthSweep = sweepDepths.map((depth) => {
  const parsed = parseTranscript(`root:${ply29RootIndex}:d${depth}:mp${MULTI_PV}`);
  const playedRank = parsed.lines.findIndex((line) => line.pv[0] === plies[ply29RootIndex].uci) + 1;
  const playedLine = parsed.lines.find((line) => line.pv[0] === plies[ply29RootIndex].uci) ?? null;
  return {
    depth,
    bestMove: parsed.bestMove,
    bestMoveUci: parsed.lines[0]?.pv[0] ?? null,
    bestMoveScore: parsed.lines[0]?.whitePov ?? null,
    playedMoveRank: playedRank === 0 ? null : playedRank,
    playedMoveScore: playedLine?.whitePov ?? null,
    topLines: parsed.lines.map((line) => ({ rank: line.rank, whitePov: line.whitePov, first: line.pv[0] })),
  };
});

// Same sweep restricted to the played move, so its own score is visible at each depth.
const restrictedDepthSweep = sweepDepths.map((depth) => {
  const parsed = parseTranscript(`restricted:29:d${depth}`);
  return { depth, score: parsed.analysis.score, bestMove: parsed.bestMove, pv: parsed.lines[0]?.pv ?? [] };
});

// What the app's own verification configuration would have returned for this
// root if ply 29 had been selected for verification.
const counterfactual = (() => {
  const parsed = parseTranscript(`root:${ply29RootIndex}:d${plan.depth}:mp${plan.multiPv}`);
  const playedRank = parsed.lines.findIndex((line) => line.pv[0] === plies[ply29RootIndex].uci) + 1;
  return {
    note: "The ply-29 root searched at the app's own verification configuration (depth and MultiPV from planObjectiveVerification).",
    depth: plan.depth,
    multiPv: plan.multiPv,
    bestMove: parsed.bestMove,
    playedMoveRank: playedRank === 0 ? null : playedRank,
    topLines: parsed.lines.map((line) => ({ rank: line.rank, whitePov: line.whitePov, first: line.pv[0] })),
  };
})();

/**
 * Mirrors the transport's terminal handling: a checkmate/stalemate index has no
 * root search, so it carries forward the preceding played line's score.
 * `restrictedAnalyses` holds StockfishMoveAnalysis values, exactly what the
 * real BrowserStockfishPool passes to buildGameAnalysis.
 */
function assemblePositions(roots, restrictedAnalyses, depth) {
  const positions = new Array(LAST_INDEX + 1).fill(null);
  for (const [index, parsed] of roots) if (parsed) positions[index] = parsed.analysis;
  for (let index = 0; index <= LAST_INDEX; index += 1) {
    if (positions[index]) continue;
    positions[index] = terminalAnalysis(index, positions, restrictedAnalyses, depth);
  }
  return positions;
}

function terminalAnalysis(index, positions, restrictedAnalyses, depth) {
  const precedingMove = plies[index - 1];
  const precedingRoot = positions[index - 1];
  const playedLine = precedingMove
    ? precedingRoot?.lines.find((line) => line.pv[0] === precedingMove.uci) ?? restrictedAnalyses.get(precedingMove.ply)?.lines[0]
    : undefined;
  const status = noLegalMoveTerminalStatus(fenAt(index));
  const score = playedLine?.score ?? (status.kind === "stalemate"
    ? { kind: "cp", cp: 0 }
    : { kind: "mate", mateIn: status.sideToMove === "white" ? -1 : 1 });
  return { fen: fenAt(index), score, lines: [], depth };
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

const appMoveFile = (move) => ({
  ply: move.ply,
  san: move.san,
  uci: move.uci,
  color: move.color,
  fenBefore: move.fenBefore,
  evaluationBefore: move.evaluationBefore,
  playedMoveScore: move.playedMoveScore,
  evaluationAfter: move.evaluationAfter,
  quality: move.quality,
  classification: move.classification,
  annotations: move.annotations,
  accuracy: move.accuracy,
  classificationReason: move.classificationReason,
});

const engineFile = (parsed) => (parsed === null || parsed === undefined ? null : {
  fen: parsed.fen,
  depthRequested: parsed.depthRequested,
  multiPvRequested: parsed.multiPvRequested,
  searchMoves: parsed.searchMoves,
  reachedDepth: parsed.reachedDepth,
  bestMove: parsed.bestMove,
  lines: parsed.lines.map((line) => ({ rank: line.rank, whitePov: line.whitePov, rawEngine: line.raw, depth: line.depth, pv: line.pv })),
});

const reportPlies = [];
for (let ply = options.plyFrom; ply <= options.plyTo; ply += 1) {
  const rootIndex = ply - 1;
  const appMove = appAnalysis.moves[ply - 1];
  reportPlies.push({
    ply,
    san: appMove.san,
    uci: appMove.uci,
    color: appMove.color,
    fenBefore: appMove.fenBefore,
    legalMoveCountBefore: appMove.classificationReason.legalMoveCount,
    root: engineFile(baselineRoot.get(rootIndex)),
    rootVerificationDepth: engineFile(verifiedRoot.get(rootIndex) ?? null),
    playedMoveRestricted: engineFile(baselineRestricted.get(ply) ?? null),
    resultingPosition: engineFile(baselineRoot.get(ply) ?? null),
    pipedFromRawTranscript: {
      baseline: appMoveFile(baselineAnalysis.moves[ply - 1]),
      verified: appMoveFile(verifiedAnalysis.moves[ply - 1]),
    },
    appStored: appMoveFile(appMove),
  });
}

// ---------------------------------------------------------------------------
// Hypothesis checks
// ---------------------------------------------------------------------------

const checks = {};
checks.engineBuildIdentity = {
  stockfishVersionConstant: STOCKFISH_VERSION,
  engineOwnIdentification: engineIdentity,
  assetHashes: hashAssets(["apps/web/public/engine/stockfish.js", "apps/web/public/engine/stockfish.wasm"]),
  constantTrustedByCacheIdentity: "OBJECTIVE_ALGORITHM_VERSION\u0000STOCKFISH_VERSION\u0000depth\u0000multiPv\u0000initialFen\u0000pgn (apps/web/src/lib/analysis-cache.ts)",
};

const probeIndex = options.plyFrom - 1;
const probeRoot = baselineRoot.get(probeIndex);
const probeAppMove = appAnalysis.moves[probeIndex];
checks.povAndMateNormalization = {
  rawEngineFinalLine: probeRoot?.lines[0]?.raw ?? null,
  engineScoresAreSideToMovePov: probeRoot?.sideToMove === "white"
    ? "raw engine score is White POV here (side to move is White)"
    : "raw engine score is Black POV here; normalizeToWhitePov inverts it",
  storedWhitePovBefore: probeAppMove.evaluationBefore,
  whitePovRecomputedFromRaw: probeRoot?.lines[0]?.whitePov ?? null,
  storedWhitePovPlayed: probeAppMove.playedMoveScore,
  winPercentOfStoredBefore: winPercentFromScore(probeAppMove.evaluationBefore),
  winPercentOfStoredPlayed: winPercentFromScore(probeAppMove.playedMoveScore),
  winPercentLossFromStored: probeAppMove.classificationReason.winPercentLoss,
};

const ply29 = appAnalysis.moves[28];
checks.engineDepthBehavior = (() => {
  const flips = depthSweep.filter((entry) => entry.playedMoveRank === 1);
  return {
    note:
      "The shipped engine at the ply-29 root over increasing depth, unrestricted (MultiPV 3) and restricted to the played move. "
      + "A depth where the played move becomes rank 1 shows the baseline depth-10 ranking is not the engine's converged opinion.",
    unrestricted: depthSweep,
    restrictedToPlayedMove: restrictedDepthSweep,
    verificationConfigurationCounterfactual: counterfactual,
    verificationPlannedPlies: plan.requests.map((request) => request.ply),
    ply29WasVerified: plan.requests.some((request) => request.ply === 29),
    firstDepthWherePlayedIsBest: flips.length > 0 ? flips[0].depth : null,
    playedIsBestAtBaselineDepth: depthSweep.find((entry) => entry.depth === DEPTH)?.playedMoveRank === 1,
    appBaselineDepth: DEPTH,
  };
})();
checks.reportedAnomaly = {
  auditClaim: { ply: 29, san: "15. Bxd7+", classification: "blunder", accuracy: 39, winPercentLoss: 21.0 },
  stored: {
    classification: ply29.classification,
    quality: ply29.quality,
    annotations: ply29.annotations,
    accuracy: ply29.accuracy,
    winPercentLoss: ply29.classificationReason.winPercentLoss,
    evaluationBefore: ply29.evaluationBefore,
    playedMoveScore: ply29.playedMoveScore,
    evaluationAfter: ply29.evaluationAfter,
  },
  differsFromAudit: ply29.classification !== "blunder" || Math.abs(ply29.classificationReason.winPercentLoss - 21) > 0.5,
};

checks.restrictedSearchPairing = (() => {
  const root = baselineRoot.get(28);
  const restricted = baselineRestricted.get(29) ?? null;
  const rootLine = root?.lines.find((line) => line.pv[0] === plies[28].uci) ?? null;
  return {
    playedUci: plies[28].uci,
    playedMoveFoundInUnrestrictedRoot: rootLine !== null,
    playedMoveRootRank: rootLine?.rank ?? null,
    playedMoveRootScore: rootLine?.whitePov ?? null,
    restrictedSearchScore: restricted?.analysis.score ?? null,
    restrictedMatchesRoot: JSON.stringify(rootLine?.whitePov ?? null) === JSON.stringify(restricted?.analysis.score ?? null),
    storedPlayedMoveScore: ply29.playedMoveScore,
    storedMatchesRaw: JSON.stringify(ply29.playedMoveScore) === JSON.stringify(rootLine?.whitePov ?? restricted?.analysis.score ?? null),
  };
})();

checks.verificationOverwrite = {
  keptBaseline: baselineAnalysis.moves.slice(options.plyFrom - 1, options.plyTo).map(appMoveFile),
  afterVerification: verifiedAnalysis.moves.slice(options.plyFrom - 1, options.plyTo).map(appMoveFile),
  appVerifiedMoveCount: appAnalysis.engine.verifiedMoveCount,
  rebuiltVerifiedMoveCount: verifiedAnalysis.engine.verifiedMoveCount,
  rebuildingVerificationPlies: plan.requests.map((request) => request.ply),
  appraisal:
    "The rebuild runs the same verification plan against the raw transcript. If the stored record matches the rebuilt one on every compared "
    + "field, the worker request/response pairing, the restricted-search pairing and the verification merge all reproduced.",
};

/**
 * The central comparison: is the app's stored record identical to the record
 * this script rebuilds from its own raw transcripts? A matching record rules
 * out mis-pairing, mis-normalization and a verification pass that silently
 * overwrites baseline evidence.
 */
checks.storedVersusRebuilt = (() => {
  const fields = [
    "evaluationBefore", "playedMoveScore", "evaluationAfter", "quality", "classification",
    "annotations", "accuracy", "classificationReason",
  ];
  const rows = [];
  const differingPlies = [];
  for (let ply = 1; ply <= appAnalysis.moves.length; ply += 1) {
    const appMove = appAnalysis.moves[ply - 1];
    const rebuilt = verifiedAnalysis.moves[ply - 1];
    const mismatched = fields.filter((field) => JSON.stringify(appMove[field]) !== JSON.stringify(rebuilt[field]));
    if (mismatched.length > 0) {
      differingPlies.push({
        ply,
        san: appMove.san,
        mismatchedFields: mismatched,
        app: Object.fromEntries(mismatched.map((field) => [field, appMove[field]])),
        rebuilt: Object.fromEntries(mismatched.map((field) => [field, rebuilt[field]])),
      });
    }
    if (ply >= options.plyFrom - 1 && ply <= options.plyTo + 1) {
      rows.push({
        ply,
        san: appMove.san,
        mismatchedFields: mismatched,
        app: Object.fromEntries(fields.map((field) => [field, appMove[field]])),
        rebuilt: Object.fromEntries(fields.map((field) => [field, rebuilt[field]])),
      });
    }
  }
  return {
    comparedFields: fields,
    differingMovesOutOfTotal: `${differingPlies.length}/${appAnalysis.moves.length}`,
    differingPlies,
    identicalRecord: differingPlies.length === 0,
    window: rows,
    appraisal: differingPlies.length === 0
      ? "The stored record is identical to the rebuild on every compared field, so the pipeline pairing is reproducible."
      : "The window above (and differingPlies) names every field that differs, localizing where pairing or merge diverges.",
  };
})();

if (options.cacheProbe) {
  checks.staleRecordReuse = await runCacheProbe(page, {
    store: storageConstants.ANALYSIS_STORE,
    key: stored.key,
    original: appAnalysis,
    reviewUrl,
  });
}

/**
 * Decisive cache-identity experiment. The app reuses a record whose
 * algorithmVersion/stockfishVersion/depth/multiPv/game identity all match the
 * query. Renaming the stored `createdAt` to an impossible date is an
 * identity-compatible mutation: if the app reuses the record, the served value
 * carries the sentinel date; if it recomputes, a fresh date replaces it. That
 * separates "warm cache served as-is" from "engine recomputed", without
 * changing any chess-relevant field.
 */
async function runCacheProbe(targetPage, { store, key, original, reviewUrl: url }) {
  const sentinel = "2000-01-01T00:00:00.000Z";
  const seeded = structuredClone(original);
  seeded.createdAt = sentinel;
  seeded.moves[28].playedMoveScore = { kind: "cp", cp: 190 };
  await putStore(targetPage, store, key, seeded);
  await targetPage.reload({ waitUntil: "domcontentloaded" });
  await targetPage.waitForFunction(() => document.body.innerText.includes("MOVE QUALITY"), undefined, { timeout: 180_000 }).catch(() => undefined);
  await targetPage.waitForTimeout(1_500);
  const rows = await readStore(targetPage, store);
  const observed = rows.find((row) => row.key === key)?.value ?? null;
  const move = observed?.moves?.[28] ?? null;
  const servedUnchanged = observed?.createdAt === sentinel;
  const observedLoss = move?.classificationReason?.winPercentLoss ?? null;
  const observedAccuracy = move?.accuracy ?? null;
  // Restore the genuine record inside this ephemeral context.
  await putStore(targetPage, store, key, original);
  void url;
  return {
    experiment:
      "Write an identity-compatible record (same game identity, algorithmVersion, stockfishVersion, depth and multiPv) with a sentinel "
      + "createdAt and no engine re-run, reload /review/<id>, then read the record back.",
    sentinelCreatedAt: sentinel,
    observedCreatedAt: observed?.createdAt ?? null,
    reusedWithoutRecompute: servedUnchanged,
    observedWinPercentLoss: observedLoss,
    observedAccuracy: observedAccuracy,
    observedClassification: move?.classification ?? null,
    conclusion: servedUnchanged
      ? "The app served the stored record unchanged. A record that matches the cache identity is reused even when its numbers were produced by an older engine build."
      : "The app recomputed and replaced the record, so a stale record was not reused.",
  };
}

// ---------------------------------------------------------------------------
// Native reference (optional)
// ---------------------------------------------------------------------------

let nativeReference = null;
if (options.nativeStockfish) {
  nativeReference = await runNativeStockfish(options.nativeStockfish);
}

async function runNativeStockfish(binary) {
  if (!existsSync(binary)) return { binary, available: false, reason: "binary not found" };
  try {
    const identify = spawnSync(binary, [], { input: "uci\nquit\n", encoding: "utf8", timeout: 60_000 });
    const identification = identify.stdout.split("\n").filter((line) => line.startsWith("id ") || /^Stockfish/.test(line)).slice(0, 4);
    const searches = {};
    for (const [label, index, searchMoves] of [
      ["rootPly27", 26, []],
      ["rootPly28", 27, []],
      ["rootPly29", 28, []],
      ["restrictedPly29", 28, [plies[28].uci]],
      ["resultingAfterPly29", 29, []],
      ["rootPly30", 29, []],
      ["rootPly31", 30, []],
    ]) {
      const history = plies.slice(0, index).map((ply) => ply.uci);
      const position = history.length === 0
        ? `position fen ${game.initialFen}`
        : `position fen ${game.initialFen} moves ${history.join(" ")}`;
      const restriction = searchMoves.length > 0 ? ` searchmoves ${searchMoves.join(" ")}` : "";
      const lines = await nativeSearch(binary, [
        "uci", "isready", "setoption name MultiPV value 3", "ucinewgame", position, `go depth 10${restriction}`,
      ]);
      const scored = lines.filter((line) => line.startsWith("info ") && line.includes(" score ") && line.includes(" pv "));
      const reachedDepth = scored.length ? Math.max(...scored.map((line) => Number(line.match(/ depth (\d+)/)?.[1] ?? 0))) : 0;
      searches[label] = {
        position,
        searchMoves,
        bestmove: lines.find((line) => line.startsWith("bestmove ")) ?? null,
        reachedDepth,
        finalInfo: scored.filter((line) => line.includes(` depth ${reachedDepth} `)),
      };
    }
    return { binary, available: true, identification, searches };
  } catch (error) {
    return { binary, available: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Feed commands to a native Stockfish on stdin and collect stdout until the
 * `bestmove` for `go` arrives. Pre-buffering "quit" would abort the search at
 * depth 1 (observed), so the process is closed only after the bestmove.
 */
function nativeSearch(binary, commands) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [], { stdio: ["pipe", "pipe", "pipe"] });
    const lines = [];
    let buffer = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Native Stockfish timed out after ${JSON.stringify(commands.at(-1))}.`));
    }, 300_000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const split = buffer.split("\n");
      buffer = split.pop() ?? "";
      for (const line of split) {
        lines.push(line);
        if (line.startsWith("bestmove ")) {
          clearTimeout(timer);
          child.kill("SIGTERM");
          resolve(lines);
        }
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    for (const command of commands) child.stdin.write(`${command}\n`);
  });
}

function hashAssets(files) {
  return files.map((file) => {
    const absolute = path.join(REPO_ROOT, file);
    if (!existsSync(absolute)) return { file, sha256: null };
    return { file, sha256: execFileSync("shasum", ["-a", "256", absolute], { encoding: "utf8" }).trim().split(/\s+/)[0] };
  });
}

// ---------------------------------------------------------------------------
// Extra contract artefacts: legality of every raw PV and the cp implied by the claim
// ---------------------------------------------------------------------------

checks.rawPvLegality = (() => {
  const problems = [];
  let checkedLines = 0;
  for (const job of jobs) {
    const parsed = parseTranscript(job.id);
    for (const line of parsed.lines) {
      checkedLines += 1;
      try {
        replayUciLine(fenAt(job.index), line.pv);
      } catch (error) {
        problems.push({ job: job.id, rank: line.rank, pv: line.pv, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return {
    checkedJobs: jobs.length,
    checkedFinalLines: checkedLines,
    illegal: problems,
    note: "Every final MultiPV line of every captured search is replayed through the rules layer; an empty `illegal` list means the raw transcripts are legal chess.",
  };
})();

checks.arithmetic = (() => {
  const before = winPercentFromScore(ply29.evaluationBefore);
  const candidates = [190, 226, 320, 398].map((cp) => {
    const after = winPercentFromScore({ kind: "cp", cp });
    return {
      cp,
      winPercentAfter: after,
      winPercentLoss: before - after,
      accuracy: analysis.moveAccuracyFromWinPercents(before, after),
      matchesStored: Math.abs((before - after) - ply29.classificationReason.winPercentLoss) < 0.01,
    };
  });
  return {
    note: "Recomputes ply 29's loss/Accuracy for candidate played-move scores with the product's own functions. `matchesStored` names the exact cp the app stored.",
    storedBefore: ply29.evaluationBefore,
    winPercentBefore: before,
    storedWinPercentLoss: ply29.classificationReason.winPercentLoss,
    storedAccuracy: ply29.accuracy,
    candidates,
    storedPlayedMoveScore: ply29.playedMoveScore,
  };
})();

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

await mkdir(options.outDir, { recursive: true });

const positionsPath = path.join(options.outDir, "positions.json");
await writeFile(positionsPath, JSON.stringify({
  pgn: example.EXAMPLE_PGN,
  initialFen: game.initialFen,
  plies: plies.map((ply) => ({
    ply: ply.ply, san: ply.san, uci: ply.uci, color: ply.color,
    fenBefore: ply.fenBefore, fenAfter: ply.fenAfter,
    legalMoveCountBefore: ply.legalMoveCountBefore, isCapture: ply.isCapture, isCheck: ply.isCheck,
  })),
  positionCommands: plies.map((_, index) => ({ index, command: positionCommand(index) })).concat([{ index: LAST_INDEX + 1, command: null }]).slice(0, LAST_INDEX + 1),
}, null, 2));

const rawPath = path.join(options.outDir, "raw-uci-transcripts.json");
await writeFile(rawPath, JSON.stringify({
  meta: {
    baseUrl: options.baseUrl,
    workerUrl: "/engine/stockfish.js",
    depth: DEPTH,
    multiPv: MULTI_PV,
    verifyDepth: plan.depth,
    verifyMultiPv: plan.multiPv,
    engineOwnIdentification: engineIdentity,
  },
  transcripts: jobs.map((job) => ({
    id: job.id,
    index: job.index,
    ply: job.index + 1,
    fen: fenAt(job.index),
    positionCommand: positionCommand(job.index),
    depth: job.depth,
    multiPv: job.multiPv,
    searchMoves: job.searchMoves,
    lines: jobResults.get(job.id)?.lines ?? null,
  })),
}, null, 2));

const analysisPath = path.join(options.outDir, "app-stored-analysis.json");
await writeFile(analysisPath, JSON.stringify(appAnalysis, null, 2));

const summary = {
  meta: {
    generatedAt: new Date().toISOString(),
    runStartedAt,
    baseUrl: options.baseUrl,
    profile: "isolated Playwright context: no storage state, empty IndexedDB, fresh profile",
    serverMode,
    reviewUrl,
    reviewId,
    appRenderedReview,
    baselineCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim(),
    workingTreeDirty: execFileSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" }).trim().length > 0,
    objectiveAlgorithmVersion: OBJECTIVE_ALGORITHM_VERSION,
    verificationPolicyVersion: VERIFICATION_POLICY_VERSION,
    stockfishVersionConstant: STOCKFISH_VERSION,
    classificationMultiPv: MULTI_PV,
    classificationThresholds: CLASSIFICATION_THRESHOLDS,
    engineOwnIdentification: engineIdentity,
    rawSearchCount: jobs.length,
    depthSweepDepths: sweepDepths,
    pageErrors,
    artifacts: {
      positions: path.relative(REPO_ROOT, positionsPath),
      rawTranscripts: path.relative(REPO_ROOT, rawPath),
      appStoredAnalysis: path.relative(REPO_ROOT, analysisPath),
    },
  },
  gameLedger: plies
    .filter((ply) => ply.ply >= options.plyFrom - 2 && ply.ply <= options.plyTo + 2)
    .map((ply) => ({ ply: ply.ply, san: ply.san, uci: ply.uci, color: ply.color, fenBefore: ply.fenBefore, legalMoveCountBefore: ply.legalMoveCountBefore })),
  appStored: {
    cacheKey: stored.key,
    engine: appAnalysis.engine,
    algorithmVersion: appAnalysis.algorithmVersion,
    createdAt: appAnalysis.createdAt,
    whiteAccuracy: appAnalysis.white.accuracy,
    blackAccuracy: appAnalysis.black.accuracy,
    projection: appProjection,
    verificationPlan: plan.requests.map((request) => ({ ply: request.ply, reasons: request.reasons })),
    verificationDepth: plan.depth,
    verificationMultiPv: plan.multiPv,
  },
  plies: reportPlies,
  rawDerivedPipeline: {
    baselineMoveCount: baselineAnalysis.moves.length,
    baseline: baselineAnalysis.moves.slice(options.plyFrom - 1, options.plyTo).map(appMoveFile),
    verifiedMoveCount: verifiedAnalysis.engine.verifiedMoveCount,
    verified: verifiedAnalysis.moves.slice(options.plyFrom - 1, options.plyTo).map(appMoveFile),
  },
  depthSweep: { unrestricted: depthSweep, restrictedToPlayedMove: restrictedDepthSweep, verificationConfigurationCounterfactual: counterfactual },
  checks,
  nativeReference,
};

const summaryPath = path.join(options.outDir, "summary.json");
await writeFile(summaryPath, JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary, null, 2));

await browser.close();
if (spawnedServer) spawnedServer.kill("SIGTERM");
process.exit(0);
