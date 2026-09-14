import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { notebookPositionKey, notebookPositionLabel, validateNotebook, MAX_NOTE_LENGTH, MAX_NOTEBOOK_LINE_PLIES } from "./review-notebook";

const PGN = '[White "Ada"]\n[Black "Mikhail"]\n\n1. e4 {Original comment} e5 2. Nf3 Nc6 *';
const position = { rootPly: 2, line: ["f1c4", "g8f6"] };
const note = { title: "Develop before attacking", note: "Consider the opponent’s reply.", bookmarked: true };

beforeEach(() => {
  vi.resetModules(); vi.stubGlobal("indexedDB", new IDBFactory());
  const storage = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) }, dispatchEvent: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function fixture() {
  const library = await import("./review-library"), api = await import("./review-notebook-storage");
  const record = await library.saveReviewRecord(await library.buildReviewRecord("pgn", PGN));
  return { record, library, api };
}
async function freshPage() { vi.resetModules(); return import("./review-notebook-storage"); }

describe("personal notebook persistence", () => {
  it("saves and reopens a legal line independently of source PGN and engine facts", async () => {
    const { record, library, api } = await fixture();
    const book = await api.saveNotebookEntry(record, position, note, null);
    const entry = book.entries[0]!;
    expect(entry).toMatchObject({ ...position, ...note, id: notebookPositionKey(position) });
    expect(notebookPositionLabel(record, position)).toBe("2. Bc4 2… Nf6");
    expect(await (await freshPage()).getReviewNotebook(record)).toEqual(book);
    expect((await library.getReviewRecord(record.id))?.originalPgn).toBe(PGN);
    expect(validateNotebook({ ...book, engine: "untrusted", entries: [{ ...entry, fen: "forged", classification: "brilliant", score: 1000 }] }, record)).toEqual(book);
  });
  it("updates one position without duplicates and rejects stale edits or deletes", async () => {
    const { record, api } = await fixture();
    const first = await api.saveNotebookEntry(record, position, note, null);
    const next = await api.saveNotebookEntry(record, position, { ...note, note: "Revised" }, first.entries[0]!.revision);
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0]!.createdAt).toBe(first.entries[0]!.createdAt);
    await expect(api.saveNotebookEntry(record, position, { ...note, note: "Old draft" }, first.entries[0]!.revision)).rejects.toThrow("changed in another tab");
    await expect(api.saveNotebookEntry(record, position, null, first.entries[0]!.revision)).rejects.toThrow("changed in another tab");
    expect((await api.getReviewNotebook(record)).entries[0]!.note).toBe("Revised");
    expect((await api.saveNotebookEntry(record, position, null, next.entries[0]!.revision)).entries).toEqual([]);
  });
  it("merges concurrent different positions and serializes competing edits", async () => {
    const { record, api } = await fixture();
    await Promise.all([api.saveNotebookEntry(record, position, note, null), api.saveNotebookEntry(record, { rootPly: 1, line: [] }, note, null)]);
    const book = await api.getReviewNotebook(record);
    expect(book.entries).toHaveLength(2);
    const revision = book.entries.find((entry) => entry.id === notebookPositionKey(position))!.revision;
    const results = await Promise.allSettled([api.saveNotebookEntry(record, position, { ...note, note: "Tab A" }, revision), api.saveNotebookEntry(record, position, { ...note, note: "Tab B" }, revision)]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
  });
  it("keeps saved entries intact after quota failures", async () => {
    const { record, api } = await fixture();
    const original = await api.saveNotebookEntry(record, position, note, null);
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
      if (this.name === "review-notebooks") throw new DOMException("Storage is full", "QuotaExceededError");
      return put.apply(this, args);
    });
    await expect(api.saveNotebookEntry(record, position, { ...note, note: "Cannot save" }, original.entries[0]!.revision)).rejects.toThrow("Storage is full");
    expect(await api.getReviewNotebook(record)).toEqual(original);
  });
  it("preserves notebooks on cache clear, deletes them with the review, and prevents stale resurrection", async () => {
    const { record, library, api } = await fixture();
    const original = await api.saveNotebookEntry(record, position, note, null);
    await (await import("./local-data")).clearObjectiveAnalysisCache();
    let current = await freshPage();
    expect(await current.getReviewNotebook(record)).toEqual(original);
    await (await import("./local-data")).deleteReviewRecord(record.id);
    await expect(current.saveNotebookEntry(record, position, note, original.entries[0]!.revision)).rejects.toThrow("Reload");
    current = await freshPage();
    expect((await current.getReviewNotebook(record)).entries).toEqual([]);
    await expect(current.saveNotebookEntry(record, position, note, null)).rejects.toThrow("deleted");
    await (await import("./review-library")).saveReviewRecord(await library.buildReviewRecord("pgn", PGN), { restoreDeleted: true });
    expect((await current.getReviewNotebook(record)).entries).toEqual([]);
  });
  it("cleans linked notebooks on account purge and all notebooks on reset", async () => {
    const { record, library, api } = await fixture();
    const linked = await library.saveReviewRecord({ ...record, id: "0123456789abcdefabcd", external: { provider: "lichess", accountId: "lichess:ada", username: "Ada", externalGameId: "gameA", importedAt: record.createdAt } });
    await api.saveNotebookEntry(record, position, note, null);
    await api.saveNotebookEntry(linked, position, note, null);
    await (await import("./local-data")).deleteSyncedGamesForAccount("lichess:ada", true);
    let current = await freshPage();
    expect((await current.getReviewNotebook(linked)).entries).toEqual([]);
    expect((await current.getReviewNotebook(record)).entries).toHaveLength(1);
    await (await import("./local-data")).resetLocalData("all");
    current = await freshPage();
    expect((await current.getReviewNotebook(record)).entries).toEqual([]);
  });
  it("upgrades a v7 library without rewriting source records", async () => {
    const oldValue = { input: PGN, custom: "untouched" };
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("open-chess-review", 7);
      open.onupgradeneeded = () => open.result.createObjectStore("review-records").put(oldValue, "legacy");
      open.onsuccess = () => { open.result.close(); resolve(); }; open.onerror = () => reject(open.error);
    });
    const storage = await import("./browser-storage");
    const db = await storage.openReviewDatabase();
    // The upgrade must reach the current schema, add its stores, and leave
    // existing records exactly as they were.
    expect(db.version).toBe(storage.DATABASE_VERSION);
    expect(db.objectStoreNames.contains("review-notebooks")).toBe(true);
    expect(db.objectStoreNames.contains("remote-positions")).toBe(true);
    expect(await new Promise((resolve) => { const get = db.transaction("review-records").objectStore("review-records").get("legacy"); get.onsuccess = () => resolve(get.result); })).toEqual(oldValue);
    db.close();
  });
});

describe("notebook validation and portable backup", () => {
  it.each(["illegal", "root", "duplicate", "too-long", "note-size", "source"])("rejects %s notebook input before restoration", async (kind) => {
    const { record, api } = await fixture();
    await api.saveNotebookEntry(record, position, note, null);
    const backup = await import("./library-backup"), file = await backup.createLibraryBackup(), entry = file.notebooks[0]!.entries[0]!;
    if (kind === "illegal") { entry.line = ["f1f8"]; entry.id = notebookPositionKey(entry); }
    if (kind === "root") { entry.rootPly = 100; entry.id = notebookPositionKey(entry); }
    if (kind === "duplicate") file.notebooks[0]!.entries.push(entry);
    if (kind === "too-long") { entry.line = Array(MAX_NOTEBOOK_LINE_PLIES + 1).fill("f1c4"); entry.id = notebookPositionKey(entry); }
    if (kind === "note-size") entry.note = "x".repeat(MAX_NOTE_LENGTH + 1);
    if (kind === "source") file.notebooks[0]!.id = "abcdefabcdefabcdefab";
    await expect(backup.previewLibraryRestore(file)).rejects.toThrow();
    expect((await api.getReviewNotebook(record)).entries[0]!.note).toBe(note.note);
  });
  it("restores v2 notes and bookmarks to a fresh database and continues reading v1", async () => {
    const { record, api, library } = await fixture();
    const fen = await library.saveReviewRecord(await library.buildReviewRecord("fen", "7k/8/8/8/8/8/p7/7K b - - 0 50"));
    const promotion = { rootPly: 0, line: ["a2a1n"] };
    expect(notebookPositionLabel(fen, promotion)).toBe("50… a1=N");
    await api.saveNotebookEntry(record, position, note, null);
    await api.saveNotebookEntry(fen, promotion, note, null);
    const backup = await import("./library-backup"), file = await backup.createLibraryBackup();
    expect(file.version).toBe(2); expect(file.notebooks).toHaveLength(2);
    const old = { ...file, version: 1 }; delete (old as Partial<typeof file>).notebooks;
    expect((await (await import("./library-backup-format")).validateLibraryBackup(old)).notebooks).toEqual([]);
    vi.stubGlobal("indexedDB", new IDBFactory()); await freshPage();
    const target = await import("./library-backup");
    await target.restoreLibraryBackup(await target.previewLibraryRestore(file), "keep-existing", false);
    const restored = await freshPage();
    expect(await restored.getReviewNotebook(record)).toEqual(file.notebooks.find((book) => book.id === record.id));
    expect(await restored.getReviewNotebook(fen)).toEqual(file.notebooks.find((book) => book.id === fen.id));
  });
  it.each(["keep-existing", "use-backup"] as const)("previews whole-notebook conflicts and applies %s", async (mode) => {
    const { record, api } = await fixture();
    const first = await api.saveNotebookEntry(record, position, note, null);
    const backup = await import("./library-backup"), file = await backup.createLibraryBackup();
    await api.saveNotebookEntry(record, position, { ...note, note: "Changed locally" }, first.entries[0]!.revision);
    const preview = await backup.previewLibraryRestore(file);
    expect(preview.counts.notebooks).toEqual({ added: 0, duplicates: 0, conflicts: 1 });
    await backup.restoreLibraryBackup(preview, mode, false);
    expect((await (await freshPage()).getReviewNotebook(record)).entries[0]!.note).toBe(mode === "keep-existing" ? "Changed locally" : note.note);
  });
  it("does not create a backup conflict when a save changes only edit metadata", async () => {
    const { record, api } = await fixture();
    const first = await api.saveNotebookEntry(record, position, note, null);
    await api.saveNotebookEntry(record, { rootPly: 1, line: [] }, note, null);
    const backup = await import("./library-backup"), file = await backup.createLibraryBackup();
    await api.saveNotebookEntry(record, position, note, first.entries[0]!.revision);
    expect((await backup.previewLibraryRestore(file)).counts.notebooks).toEqual({ added: 0, duplicates: 1, conflicts: 0 });
  });
  it("invalidates a restore preview after an entry changes and rolls back a failed notebook restore", async () => {
    const { record, api } = await fixture();
    const first = await api.saveNotebookEntry(record, position, note, null);
    const backup = await import("./library-backup"), file = await backup.createLibraryBackup();
    const preview = await backup.previewLibraryRestore(file);
    await api.saveNotebookEntry(record, position, { ...note, note: "Changed" }, first.entries[0]!.revision);
    await expect(backup.restoreLibraryBackup(preview, "use-backup", false)).rejects.toThrow("changed after the preview");
    const latest = await backup.previewLibraryRestore(file), put = IDBObjectStore.prototype.put;
    file.reviews[0]!.title = "Should not leak through";
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
      if (this.name === "review-notebooks") throw new DOMException("Quota", "QuotaExceededError");
      return put.apply(this, args);
    });
    await expect(backup.restoreLibraryBackup(latest, "use-backup", false)).rejects.toThrow("Quota");
    expect((await api.getReviewNotebook(record)).entries[0]!.note).toBe("Changed");
  });
});
