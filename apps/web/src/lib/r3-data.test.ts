import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import type { RecurringWeakness } from "@chess-review/analysis";
import type { TrainingQueueItemV2 } from "@chess-review/shared";

const PGN = '[White "Ada"]\n[Black "Mikhail"]\n\n1. e4 {Keep this comment} e5 2. Nf3 *';
const stamp = "2026-09-06T00:00:00.000Z";
beforeEach(() => {
  vi.resetModules(); vi.stubGlobal("indexedDB", new IDBFactory());
  const values = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) }, dispatchEvent: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => vi.restoreAllMocks());
async function entries(store: string) {
  const db = await (await import("./browser-storage")).openReviewDatabase();
  try { return await new Promise<unknown[]>((resolve, reject) => { const req = db.transaction(store).objectStore(store).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
  finally { db.close(); }
}
async function put(store: string, key: string, value: unknown) {
  const s = await import("./browser-storage"), db = await s.openReviewDatabase();
  try { await s.writeLocalData(db, store, (tx) => tx.objectStore(store).put(value, key)); } finally { db.close(); }
}
async function seed() {
  const lib = await import("./review-library"), queue = await import("./training-queue");
  const record = await lib.saveReviewRecord({ ...await lib.buildReviewRecord("pgn", PGN), originalPgn: PGN });
  const fen = await lib.saveReviewRecord(await lib.buildReviewRecord("fen", record.initialFen));
  const evidence = [1, 3].map((ply, i) => ({ gameId: record.id, ply, san: i ? "Nf3" : "e4", phase: "opening" as const, classification: "mistake" as const, winPercentLoss: 20 }));
  const task = queue.createTrainingQueueItem("ada", { kind: "opening-decisions", priority: 72, evidence } as RecurringWeakness, stamp);
  await queue.saveTrainingQueueItem(task);
  return { record, fen, task, queue, lib };
}
async function backup() { return (await import("./library-backup")).createLibraryBackup(); }
async function freshPage() { vi.resetModules(); return import("./library-backup"); }

describe("position review ledger", () => {
  it("opens the first pending source without credit, saves once, and resumes after reload", async () => {
    const { task, queue } = await seed();
    expect((await queue.startTrainingTask(task.id)).progress.reviewedPositionCount).toBe(0);
    await queue.reviewTrainingPosition(task.id, task.evidence[0]!);
    await queue.reviewTrainingPosition(task.id, task.evidence[0]!);
    vi.resetModules();
    const resumed = await (await import("./training-queue")).startTrainingTask(task.id);
    expect(resumed.progress.reviewedPositionCount).toBe(1);
    expect(queue.nextTrainingPosition(resumed)?.ply).toBe(3);
    const url = new URL(queue.trainingReviewHref(resumed), "http://localhost");
    expect(url.searchParams.get("training")).toBe(task.id);
    expect(url.searchParams.get("ply")).toBe("3");
    const complete = await (await import("./training-queue")).reviewTrainingPosition(task.id, task.evidence[1]!);
    expect(complete).toMatchObject({ status: "completed", completionKind: "reviewed", progress: { reviewedPositionCount: 2 } });
    expect((await (await import("./training-queue")).startTrainingTask(task.id)).progress.positions).toHaveLength(2);
  });
  it("merges concurrent acknowledgements and ignores a stale Add to queue", async () => {
    const { task, queue } = await seed();
    await Promise.all(task.evidence.map((source) => queue.reviewTrainingPosition(task.id, source)));
    await queue.saveTrainingQueueItem(task, { ifAbsent: true });
    expect(await queue.listTrainingQueue()).toMatchObject([{ status: "completed", progress: { reviewedPositionCount: 2 } }]);
  });
  it("does not invent position identities for legacy manual completion", async () => {
    const { task, queue } = await seed();
    const legacy = { ...task, version: 2, status: "completed", progress: { reviewedPositionCount: 2, totalPositionCount: 2 } } as TrainingQueueItemV2;
    expect(queue.normalizeTrainingItem(legacy)).toMatchObject({ status: "completed", completionKind: "manual", progress: { positions: [], reviewedPositionCount: 0 } });
    await queue.saveTrainingQueueItem(legacy);
    expect(await queue.startTrainingTask(task.id)).toMatchObject({ status: "in-progress", progress: { reviewedPositionCount: 0 } });
  });
  it("rejects a missing or changed source without credit", async () => {
    const { task, queue } = await seed();
    await queue.saveTrainingQueueItem({ ...task, evidence: [{ ...task.evidence[0]!, san: "d4" }] });
    await expect(queue.reviewTrainingPosition(task.id, task.evidence[0]!)).rejects.toThrow("no longer matches");
    expect((await queue.listTrainingQueue())[0]!.progress.positions).toEqual([]);
    await queue.saveTrainingQueueItem({ ...task, evidence: [{ ...task.evidence[0]!, gameId: "missing" }] });
    await expect(queue.startTrainingTask(task.id)).rejects.toThrow("source game is missing");
  });
  it("removes only deleted references and preserves acknowledged remaining positions", async () => {
    const { task, queue, record, lib } = await seed();
    const second = await lib.saveReviewRecord(await lib.buildReviewRecord("pgn", "1. d4 d5 *"));
    const other = { ...task.evidence[0]!, gameId: second.id, san: "d4" };
    await queue.saveTrainingQueueItem({ ...task, evidence: [task.evidence[0]!, other] });
    await queue.reviewTrainingPosition(task.id, other);
    await (await import("./local-data")).deleteReviewRecord(record.id);
    await freshPage();
    expect(await (await import("./training-queue")).listTrainingQueue()).toMatchObject([{ status: "completed", completionKind: "reviewed", evidence: [other], progress: { reviewedPositionCount: 1, totalPositionCount: 1 } }]);
  });
});

describe("versioned library backup", () => {
  it("round-trips games, FEN, original comments, preferences and exact review progress into a fresh browser", async () => {
    const { task, queue, record, fen } = await seed();
    await queue.reviewTrainingPosition(task.id, task.evidence[0]!);
    const settings = await import("./app-settings");
    window.localStorage.setItem(settings.APP_SETTINGS_STORAGE_KEY, JSON.stringify({ ...settings.DEFAULT_APP_SETTINGS, soundEnabled: false }));
    const file = await backup();
    vi.stubGlobal("indexedDB", new IDBFactory()); window.localStorage.removeItem(settings.APP_SETTINGS_STORAGE_KEY);
    const api = await freshPage();
    const preview = await api.previewLibraryRestore(file);
    expect(preview.counts.reviews.added).toBe(2);
    await api.restoreLibraryBackup(preview, "keep-existing", true);
    const next = await freshPage();
    await next.applyPendingBackupSettings();
    expect(await entries("review-records")).toEqual(expect.arrayContaining([expect.objectContaining({ id: record.id, originalPgn: PGN }), expect.objectContaining({ id: fen.id, kind: "fen" })]));
    expect(await (await import("./training-queue")).listTrainingQueue()).toMatchObject([{ progress: { reviewedPositionCount: 1, totalPositionCount: 2 } }]);
    expect(JSON.parse(window.localStorage.getItem(settings.APP_SETTINGS_STORAGE_KEY)!)).toMatchObject({ soundEnabled: false });
    expect(await entries("objective-analyses")).toEqual([]);
  });
  it("allowlists exported data and excludes credentials, sessions, caches, jobs and avatars", async () => {
    const { record } = await seed();
    await put("review-records", record.id, { ...record, token: "SECRET" });
    await put("platform-accounts", "a", { accessToken: "SECRET" });
    await put("objective-analyses", "x", { secret: "SECRET" });
    await put("player-avatars", "a", { image: "SECRET" });
    await put("synced-games", "chesscom:source", { id: "chesscom:source", external: { provider: "chesscom", accountId: "a", externalGameId: "source", username: "Ada", importedAt: stamp, accessToken: "SECRET" }, pgn: "Provider PGN not yet validated", playedAt: stamp, syncedAt: stamp, white: { username: "Ada", avatar: "SECRET" }, black: { username: "Other" }, accountColor: "white", analyzed: true, analysisId: "SECRET" });
    const settings = await import("./app-settings");
    window.localStorage.setItem(settings.APP_SETTINGS_STORAGE_KEY, JSON.stringify({ ...settings.DEFAULT_APP_SETTINGS, apiKey: "SECRET" }));
    const file = await backup();
    expect(JSON.stringify(file)).not.toContain("SECRET");
    expect(file.sources[0]).toMatchObject({ analyzed: false, pgn: "Provider PGN not yet validated" });
  });
  it.each(["version", "duplicate", "invalid-pgn", "bad-fen", "bad-source", "bad-progress", "too-many"])("rejects %s before any write", async (kind) => {
    await seed(); const file = await backup(); const before = await entries("review-records");
    const bad = structuredClone(file);
    if (kind === "version") Object.assign(bad, { version: 99 });
    if (kind === "duplicate") bad.reviews.push(bad.reviews[0]!);
    if (kind === "invalid-pgn") bad.reviews.find((r) => r.kind === "pgn")!.input = "1. e5 *";
    if (kind === "bad-fen") bad.reviews.find((r) => r.kind === "fen")!.input = "broken fen";
    if (kind === "bad-source") bad.tasks[0]!.evidence[0]!.san = "Qa9";
    if (kind === "bad-progress") bad.tasks[0]!.progress.positions.push({ gameId: "00000000000000000000", ply: 2, reviewedAt: stamp });
    if (kind === "too-many") bad.tasks = Array.from({ length: 10001 }, () => bad.tasks[0]!);
    await expect((await import("./library-backup")).previewLibraryRestore(bad)).rejects.toThrow();
    expect(await entries("review-records")).toEqual(before);
  });
  it("rejects oversized or malformed files without reading oversized content", async () => {
    const { readLibraryBackup, MAX_BACKUP_BYTES } = await import("./library-backup-format");
    const text = vi.fn();
    await expect(readLibraryBackup({ size: MAX_BACKUP_BYTES + 1, text })).rejects.toThrow("50 MiB");
    expect(text).not.toHaveBeenCalled();
    await expect(readLibraryBackup({ size: 1, text: async () => "{" })).rejects.toThrow("valid JSON");
  });
  it.each(["keep-existing", "use-backup"] as const)("previews duplicates and resolves conflicts with %s", async (mode) => {
    const { task, queue, record, lib } = await seed(); const file = await backup();
    await queue.reviewTrainingPosition(task.id, task.evidence[0]!);
    await lib.saveReviewRecord({ ...record, title: "New title" });
    const extra = await lib.saveReviewRecord(await lib.buildReviewRecord("pgn", "1. d4 *"));
    const api = await import("./library-backup"), preview = await api.previewLibraryRestore(file);
    expect(preview.counts).toMatchObject({ reviews: { duplicates: 1, conflicts: 1 }, tasks: { conflicts: 1 } });
    await api.restoreLibraryBackup(preview, mode, false); await freshPage();
    expect((await entries("review-records"))).toEqual(expect.arrayContaining([expect.objectContaining({ id: extra.id }), expect.objectContaining({ id: record.id, title: mode === "keep-existing" ? "New title" : record.title })]));
    expect((await (await import("./training-queue")).listTrainingQueue())[0]!.progress.reviewedPositionCount).toBe(mode === "keep-existing" ? 1 : 0);
  });
  it("rejects collided chess identities and stale previews", async () => {
    const { task, queue, record, lib } = await seed(); const file = await backup(); const api = await import("./library-backup");
    const collision = structuredClone(file), different = await lib.buildReviewRecord("pgn", "1. d4 *");
    collision.reviews = [{ ...different, id: record.id }]; collision.tasks = [];
    await expect(api.previewLibraryRestore(collision)).rejects.toThrow("different source game");
    const preview = await api.previewLibraryRestore(file);
    await queue.reviewTrainingPosition(task.id, task.evidence[0]!);
    await expect(api.restoreLibraryBackup(preview, "use-backup", false)).rejects.toThrow("changed after the preview");
    expect((await queue.listTrainingQueue())[0]!.progress.reviewedPositionCount).toBe(1);
  });
  it("rolls back every library write and epoch on a quota failure", async () => {
    await seed(); const file = await backup(); file.reviews.forEach((r) => r.title = "Replacement");
    const api = await import("./library-backup"), preview = await api.previewLibraryRestore(file), before = await entries("review-records");
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === "training-queue") throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, value, key);
    });
    await expect(api.restoreLibraryBackup(preview, "use-backup", false)).rejects.toThrow("Storage full");
    expect(await entries("review-records")).toEqual(before);
    expect(await entries("local-data-metadata")).toEqual([]);
  });
  it("retains deletion intent, pauses running work and prevents an old page from writing", async () => {
    const { lib, record } = await seed(); const file = await backup();
    file.deletions = [`deleted-review:${record.id}`, "deleted-review:00000000000000000000"];
    await put("history-analysis-jobs", "j", { status: "running", items: [{ status: "running" }] });
    await put("platform-sync-state", "s", { status: "syncing" });
    await put("review-runs", "r", { status: "running" });
    const api = await import("./library-backup");
    await api.restoreLibraryBackup(await api.previewLibraryRestore(file), "use-backup", false);
    await expect(lib.saveReviewRecord(record)).rejects.toThrow("Reload");
    await freshPage();
    expect(await entries("history-analysis-jobs")).toMatchObject([{ status: "paused", items: [{ status: "queued" }] }]);
    expect(await entries("platform-sync-state")).toMatchObject([{ status: "paused" }]);
    expect(await entries("review-runs")).toMatchObject([{ status: "cancelled" }]);
    const out = await backup(); expect(out.deletions).toEqual(["deleted-review:00000000000000000000"]);
  });
  it("reports committed library separately from failed preferences and retries after reload", async () => {
    await seed(); const file = await backup(); file.settings.soundEnabled = false;
    const api = await import("./library-backup"), preview = await api.previewLibraryRestore(file);
    const real = window.localStorage.setItem;
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    expect(await api.restoreLibraryBackup(preview, "use-backup", true)).toMatchObject({ preferencesError: expect.stringContaining("library was restored") });
    const next = await freshPage();
    await expect(next.applyPendingBackupSettings()).rejects.toThrow("preferences are still pending");
    expect(await entries("local-data-metadata")).toEqual(expect.arrayContaining([expect.objectContaining({ soundEnabled: false })]));
    window.localStorage.setItem = real;
    expect(await next.applyPendingBackupSettings()).toBe(true);
    expect(await next.applyPendingBackupSettings()).toBe(false);
  });
});

describe("multi-tab storage upgrades", () => {
  it("reports blocked upgrades, then closes the eventual connection and preserves old data", async () => {
    const old = await new Promise<IDBDatabase>((resolve) => { const req = indexedDB.open("open-chess-review", 6); req.onupgradeneeded = () => req.result.createObjectStore("review-records").put({ id: "legacy" }, "legacy"); req.onsuccess = () => resolve(req.result); });
    const storage = await import("./browser-storage");
    await expect(storage.openReviewDatabase()).rejects.toThrow("Close other"); old.close();
    expect(await entries("review-records")).toEqual([{ id: "legacy" }]);
    // A leaked eventual connection would block this deletion.
    await new Promise<void>((resolve, reject) => { const req = indexedDB.deleteDatabase("open-chess-review"); req.onsuccess = () => resolve(); req.onblocked = () => reject(new Error("leaked connection")); });
  });
  it("closes a managed connection on version change and invalidates that page", async () => {
    const storage = await import("./browser-storage"); const db = await storage.openReviewDatabase();
    const upgraded = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open("open-chess-review", storage.DATABASE_VERSION + 1); req.onsuccess = () => resolve(req.result); req.onblocked = () => reject(new Error("managed connection blocked upgrade")); });
    expect(storage.isLocalSessionInvalid()).toBe(true);
    expect(() => db.transaction("review-records")).toThrow(); upgraded.close();
  });
});


it("rebuilds untrusted backup indexes and ignores index-only upgrades in restore previews", async () => {
  const { record, lib } = await seed();
  const file = await backup();
  expect(file.reviews.every((review) => review.identity === undefined)).toBe(true);
  const forged = file.reviews.find((review) => review.id === record.id)!;
  forged.identity = { version: 1, input: forged.input, initialFen: forged.initialFen, uciMoves: ['a2a4'] };
  const clean = await (await import('./library-backup-format')).validateLibraryBackup(file);
  expect(clean.reviews.find((review) => review.id === record.id)?.identity?.uciMoves).toEqual(['e2e4', 'e7e5', 'g1f3']);
  const legacy = { ...record }; delete legacy.identity;
  await put('review-records', record.id, legacy);
  const api = await import('./library-backup');
  const preview = await api.previewLibraryRestore(file);
  expect(preview.counts.reviews.conflicts).toBe(0);
  await (await import('./review-identity-backfill')).backfillReviewIdentities([legacy]);
  expect((await lib.getReviewRecord(record.id))?.identity).toBeDefined();
  await expect(api.restoreLibraryBackup(preview, 'keep-existing', false)).resolves.toEqual({});
});
