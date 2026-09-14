import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type { ExplorerPositionV1 } from "@chess-review/openings";
import { EXPLORER_CACHE_TTL_MS, loadExplorerPosition } from "./opening-explorer";

const EPD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
const OTHER_FEN = "8/8/8/8/8/8/8/K6k w - -";

function position(overrides: Partial<ExplorerPositionV1> = {}): ExplorerPositionV1 {
  return {
    version: 1,
    fen: EPD,
    source: "lichess",
    totalGames: 100,
    white: 40,
    draws: 35,
    black: 25,
    whitePercent: 40,
    drawPercent: 35,
    blackPercent: 25,
    moves: [{ uci: "e2e4", san: "e4", games: 100, white: 40, draws: 35, black: 25, whitePercent: 40, drawPercent: 35, blackPercent: 25 }],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Moves the clock past the cache lifetime without touching the stored entries. */
function ageCache(): void {
  const real = Date.now;
  vi.spyOn(Date, "now").mockImplementation(() => real() + EXPLORER_CACHE_TTL_MS + 1000);
}

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("window", {
    localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("opening explorer client", () => {
  it("fetches once and answers the next lookup from the cache", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ position: position() }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await loadExplorerPosition(EPD, "lichess");
    expect(first).toMatchObject({ stale: false, position: { totalGames: 100 } });

    const second = await loadExplorerPosition(EPD, "lichess");
    expect(second.position.totalGames).toBe(100);
    expect(second.stale).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps one cache entry per database", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => jsonResponse({
      position: position({ source: String(input).includes("source=masters") ? "masters" : "lichess" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await loadExplorerPosition(EPD, "lichess");
    const masters = await loadExplorerPosition(EPD, "masters");
    expect(masters.position.source).toBe("masters");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("revalidates an expired entry and keeps the answer fresh", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ position: position() }));
    vi.stubGlobal("fetch", fetchMock);
    await loadExplorerPosition(EPD, "lichess");
    ageCache();

    const refreshed = await loadExplorerPosition(EPD, "lichess");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshed.stale).toBe(false);
  });

  it("serves an expired entry only when the refresh fails, and labels it stale", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ position: position() })));
    await loadExplorerPosition(EPD, "lichess");
    ageCache();

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const stale = await loadExplorerPosition(EPD, "lichess");
    expect(stale.stale).toBe(true);
    expect(stale.position.totalGames).toBe(100);
  });

  it("fails rather than inventing an answer when nothing is cached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await expect(loadExplorerPosition(OTHER_FEN, "lichess")).rejects.toThrow(/could not be reached/);

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "The opening explorer is rate limiting requests." }, 429)));
    await expect(loadExplorerPosition(OTHER_FEN, "masters")).rejects.toThrow(/rate limiting/);
  });

  it("rejects a payload this build does not understand", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ position: position({ version: 2 as unknown as 1 }) })));
    await expect(loadExplorerPosition(EPD, "lichess")).rejects.toThrow(/unusable response/);
  });
});
