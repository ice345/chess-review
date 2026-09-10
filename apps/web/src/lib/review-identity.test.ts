import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { parsePgn } from "@chess-review/chess-core";
import { buildReviewRecord } from "./review-library";
import { readReviewIdentity, hasReviewIdentity } from "./review-identity";
import { resolveReviewStatus } from "./review-status";

beforeEach(() => { vi.resetModules(); vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("disposable validated review identity", () => {
  it("reuses the canonical import and rejects a stale stamp after PGN changes", async () => {
    const record = await buildReviewRecord("pgn", '1. e4 e5 *');
    expect(hasReviewIdentity(record)).toBe(true);
    expect(readReviewIdentity(record).uciMoves).toEqual(['e2e4', 'e7e5']);
    const changed = { ...record, input: '1. d4 d5 *' };
    expect(hasReviewIdentity(changed)).toBe(false);
    expect(readReviewIdentity(changed).uciMoves).toEqual(['d2d4', 'd7d5']);
    expect(resolveReviewStatus({ ...record, input: 'broken chess' }, []).kind).toBe('invalid');
  });
  it("falls back to the same parser for legacy records", async () => {
    const record = await buildReviewRecord("pgn", '1. e4 c5 2. Nf3 *');
    delete record.identity;
    expect(readReviewIdentity(record).uciMoves).toEqual(parsePgn(record.input).plies.map((ply) => ply.uci));
    const fen = await buildReviewRecord('fen', record.initialFen);
    expect(fen.identity).toBeUndefined();
  });
  it("persists legacy indexes without changing user timestamps or re-creating deleted records", async () => {
    const lib = await import('./review-library');
    const { backfillReviewIdentities } = await import('./review-identity-backfill');
    const first = await lib.buildReviewRecord('pgn', '1. e4 e5 *');
    delete first.identity;
    const saved = await lib.saveReviewRecord(first);
    const missing = await lib.buildReviewRecord('pgn', '1. d4 d5 *');
    delete missing.identity;
    await backfillReviewIdentities([saved, missing]);
    expect(await lib.getReviewRecord(saved.id)).toMatchObject({ updatedAt: saved.updatedAt, identity: { version: 1, uciMoves: ['e2e4', 'e7e5'] } });
    expect(await lib.getReviewRecord(missing.id)).toBeNull();
  });
  it("does not overwrite newer PGN or write after a destructive epoch change", async () => {
    const lib = await import('./review-library');
    const { backfillReviewIdentities } = await import('./review-identity-backfill');
    const record = await lib.buildReviewRecord('pgn', '1. e4 e5 *');
    delete record.identity;
    await lib.saveReviewRecord({ ...record, input: '1. d4 d5 *' });
    await backfillReviewIdentities([record]);
    expect((await lib.getReviewRecord(record.id))?.identity).toBeUndefined();
    const storage = await import('./browser-storage');
    storage.invalidateLocalSession();
    delete record.identity;
    await expect(backfillReviewIdentities([record])).rejects.toThrow('Local data was changed');
  });
  it("stops cancelled legacy work before parsing or saving", async () => {
    const lib = await import('./review-library');
    const record = await lib.buildReviewRecord('pgn', '1. e4 e5 *');
    delete record.identity;
    const controller = new AbortController(); controller.abort();
    await expect((await import('./review-identity-backfill')).backfillReviewIdentities([record], controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(record.identity).toBeUndefined();
  });
});
