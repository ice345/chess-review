import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as syncChessCom } from "../app/api/platforms/chesscom/sync/route";

beforeEach(() => {
  const state = (globalThis as typeof globalThis & { __ocrPlatformGuard?: { buckets: Map<string, unknown>; lanes: Map<string, unknown> } }).__ocrPlatformGuard;
  state?.buckets.clear(); state?.lanes.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("public platform input boundary", () => {
  it("reads a proxied route request without cloning native Request state", async () => {
    const original = new Request("https://review.test/api/platforms/chesscom/sync", {
      method: "POST", body: JSON.stringify({ account: { provider: "chesscom", username: 42 } }),
    });
    const proxied = new Proxy(original, {
      get(target, key) { return Reflect.get(target, key, target); },
    });
    expect((await syncChessCom(proxied)).status).toBe(400);
  });

  it("rejects a non-string username before contacting the provider", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await syncChessCom(new Request("https://review.test/api/platforms/chesscom/sync", {
      method: "POST", body: JSON.stringify({ account: { provider: "chesscom", username: 42 } }),
    }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

const account = { provider: "chesscom", username: "Ada", id: "chesscom:ada", linkedAt: "2026-09-06T00:00:00Z", verified: false, authMode: "public-username" };
function request(body: unknown): Request { return new Request("https://review.test/api/platforms/chesscom/sync", { method: "POST", body: JSON.stringify(body) }); }

describe("platform recovery responses", () => {
  it.each([
    null, [], { account, limit: "10" }, { account, limit: 0 }, { account, limit: 101 },
    { account, mode: "unexpected" }, { account, since: "not-a-date" },
    { account, cursor: "cc2:2026-99:0" }, { account, cursor: "cc:999999999999999999999:0" },
  ])("rejects invalid request shape %# without fetching", async (body) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await syncChessCom(request(body))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON", async () => {
    expect((await syncChessCom(new Request("https://review.test/sync", { method: "POST", body: "{" }))).status).toBe(400);
  });
  it("bounds UTF-8 bytes, including multibyte input", async () => {
    expect((await syncChessCom(request({ account, extra: "鳥".repeat(400_000) }))).status).toBe(413);
  });
  it("preserves rate limits and retry information on the archive-list request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429, headers: { "Retry-After": "120" } })));
    const response = await syncChessCom(request({ account }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
  });
  it("returns a recoverable provider error on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    expect((await syncChessCom(request({ account }))).status).toBe(502);
  });
  it("returns a recoverable provider error on invalid provider JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    expect((await syncChessCom(request({ account }))).status).toBe(502);
  });
  it("times out a provider request without losing the retry path", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("fetch", vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(options.signal?.reason));
      })));
      const pending = syncChessCom(request({ account }));
      await vi.advanceTimersByTimeAsync(20_001);
      expect((await pending).status).toBe(504);
    } finally { vi.useRealTimers(); }
  });
  it("accepts a valid request and keeps public username ownership unverified", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ archives: [] })));
    const response = await syncChessCom(request({ account: { ...account, verified: true } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ done: true, account: { verified: false } });
  });
});
