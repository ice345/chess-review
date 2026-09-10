import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { acquireProvider, checkPlatformRate, providerCooldown } from "./platform-guard";
import { platformRequest } from "./platform-request";
import { fetchProvider, readProviderText } from "./platform-response";

beforeEach(() => {
  const state = (globalThis as typeof globalThis & { __ocrPlatformGuard?: { buckets: Map<string, unknown>; lanes: Map<string, unknown> } }).__ocrPlatformGuard;
  state?.buckets.clear(); state?.lanes.clear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const url = "https://review.example/api/platforms/chesscom/sync";
const signal = () => new AbortController().signal;
describe("public platform resource boundaries", () => {
  it("enforces frequency limits and ignores untrusted forwarding identities", async () => {
    for (let i = 0; i < 120; i++) checkPlatformRate(new Request(url, { headers: { "x-forwarded-for": `192.0.2.${i}` } }));
    const handler = vi.fn(); const response = await platformRequest(new Request(url), handler);
    expect(response.status).toBe(429); expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(handler).not.toHaveBeenCalled();
  });
  it("uses an explicitly trusted single-IP header while retaining a global cap", () => {
    vi.stubEnv("PLATFORM_CLIENT_IP_HEADER", "x-real-ip");
    for (let i = 0; i < 240; i++) checkPlatformRate(new Request(url, { headers: { "x-real-ip": `192.0.2.${i}` } }));
    expect(() => checkPlatformRate(new Request(url, { headers: { "x-real-ip": "203.0.113.1" } }))).toThrow("Too many");
  });
  it("rejects browser cross-origin mutations before running a handler", async () => {
    const handler = vi.fn();
    expect((await platformRequest(new Request(url, { method: "DELETE", headers: { Origin: "https://foreign.example" } }), handler)).status).toBe(403);
    expect((await platformRequest(new Request(url, { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" } }), handler)).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it("serializes the entire provider operation and releases capacity on failure", async () => {
    let resolveFirst: (() => void) | undefined;
    const order: string[] = [];
    const first = platformRequest(new Request(url), async () => { order.push("first-start"); await new Promise<void>((resolve) => { resolveFirst = resolve; }); order.push("first-end"); throw new Error("upstream"); }, "chesscom");
    const second = platformRequest(new Request(url), async () => { order.push("second"); return Response.json({ ok: true }); }, "chesscom");
    await vi.waitFor(() => expect(resolveFirst).toBeDefined());
    expect(order).toEqual(["first-start"]); resolveFirst!();
    expect((await first).status).toBe(502); expect((await second).status).toBe(200);
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });
  it("bounds waiters and removes cancelled requests without sending them upstream", async () => {
    const release = await acquireProvider("chesscom", signal());
    const controllers = Array.from({ length: 8 }, () => new AbortController());
    const pending = controllers.map((controller) => acquireProvider("chesscom", controller.signal).then(() => "unexpected", () => "cancelled"));
    expect(() => acquireProvider("chesscom", signal())).toThrow("busy");
    controllers.forEach((controller) => controller.abort()); expect(await Promise.all(pending)).toEqual(Array(8).fill("cancelled"));
    release(); (await acquireProvider("chesscom", signal()))();
  });
  it("pauses all queued provider requests after 429 and expires the cooldown", async () => {
    vi.useFakeTimers();
    const release = await acquireProvider("lichess", signal());
    const waiting = acquireProvider("lichess", signal()).catch((cause: Error) => cause.message);
    providerCooldown("lichess", "120");
    expect(await waiting).toContain("pause requests"); release();
    expect(() => acquireProvider("lichess", signal())).toThrow("pause requests");
    await vi.advanceTimersByTimeAsync(120_001); (await acquireProvider("lichess", signal()))();
  });
  it("cancels queued work within the request timeout", async () => {
    vi.useFakeTimers(); const release = await acquireProvider("chesscom", signal()); const handler = vi.fn();
    const response = platformRequest(new Request(url), handler, "chesscom");
    await vi.advanceTimersByTimeAsync(20_001); expect((await response).status).toBe(504); expect(handler).not.toHaveBeenCalled(); release();
  });
  it("bounds advertised and streamed upstream bodies and supports cancellation", async () => {
    await expect(readProviderText(new Response("12345"), signal(), 4)).rejects.toThrow("too large");
    await expect(readProviderText(new Response("1", { headers: { "content-length": "10" } }), signal(), 4)).rejects.toThrow("too large");
    const controller = new AbortController(); const response = new Response(new ReadableStream({ start() {} }));
    const pending = readProviderText(response, controller.signal).catch((cause: Error) => cause.name); controller.abort();
    expect(await pending).toBe("AbortError");
  });
  it("closes upstream error streams before admitting another provider request", async () => {
    const cancel = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { status: 429, headers: { "Retry-After": "120" } })));
    const response = await fetchProvider("https://lichess.org/api/account", { signal: signal() });
    expect(cancel).toHaveBeenCalledOnce();
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("120");
  });
});
