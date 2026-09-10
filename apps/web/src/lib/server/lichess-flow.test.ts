import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => jar.has(key) ? { value: jar.get(key)! } : undefined, set: (key: string, value: string) => { if (value) jar.set(key, value); else jar.delete(key); } }) }));
import { GET as start } from "../../app/api/platforms/lichess/oauth/start/route";
import { GET as callback } from "../../app/api/platforms/lichess/oauth/callback/route";
import { GET as getSession, DELETE as disconnect } from "../../app/api/platforms/lichess/session/route";
import { POST as sync } from "../../app/api/platforms/lichess/sync/route";
import { LICHESS_PKCE_COOKIE, LICHESS_SESSION_COOKIE, openLichessValue, readLichessSession, sealLichessValue, type LichessPkceState } from "./lichess-session";

const origin = "https://review.example";
beforeEach(() => {
  jar.clear();
  vi.stubEnv("LICHESS_SESSION_SECRET", "test-only-private-secret-longer-than-24-characters");
  vi.stubEnv("LICHESS_CLIENT_ID", "review.example"); vi.stubEnv("APP_ORIGIN", origin);
  const state = (globalThis as typeof globalThis & { __ocrPlatformGuard?: { buckets: Map<string, unknown>; lanes: Map<string, unknown> } }).__ocrPlatformGuard;
  state?.buckets.clear(); state?.lanes.clear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const request = (path: string) => new Request(`${origin}/api/platforms/lichess/${path}`);
const readCookie = (response: Response, name: string) => response.headers.get("set-cookie")?.match(new RegExp(`${name}=([^;]+)`))?.[1];
async function begin() {
  const response = await start(request("oauth/start"));
  const sealed = readCookie(response, LICHESS_PKCE_COOKIE)!;
  jar.set(LICHESS_PKCE_COOKIE, sealed);
  return { response, pkce: openLichessValue<LichessPkceState>(sealed) };
}
function seedSession(expiresAt = new Date(Date.now() + 3_600_000).toISOString()) {
  jar.set(LICHESS_SESSION_COOKIE, sealLichessValue({ accessToken: "secret_token", tokenType: "Bearer", expiresAt, account: { id: "ada", username: "Ada" } }));
}

describe("Lichess route flow against deterministic provider responses", () => {
  it("creates S256 PKCE and an HTTPS HttpOnly cookie, then stores only an encrypted session", async () => {
    const { response, pkce } = await begin(), location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("https://lichess.org"); expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("scope")).toBe("");
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/); expect(response.headers.get("set-cookie")).toMatch(/Secure/); expect(response.headers.get("set-cookie")).toMatch(/SameSite=lax/);
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "secret_token", token_type: "Bearer", expires_in: 3600 })).mockResolvedValueOnce(Response.json({ id: "ada", username: "Ada", perfs: { rapid: { rating: 1400 } } }));
    vi.stubGlobal("fetch", fetch);
    const completed = await callback(request(`oauth/callback?code=provider-code.opaque~&state=${pkce.state}`));
    expect(completed.headers.get("location")).toBe(`${origin}/settings?lichess=connected`);
    expect(completed.headers.get("set-cookie")).not.toContain("secret_token");
    expect(completed.headers.get("set-cookie")).toContain(`${LICHESS_PKCE_COOKIE}=;`);
    expect(completed.headers.get("referrer-policy")).toBe("no-referrer");
    const sealed = readCookie(completed, LICHESS_SESSION_COOKIE)!;
    expect(readLichessSession(sealed)).toMatchObject({ accessToken: "secret_token", account: { id: "ada" } });
    jar.set(LICHESS_SESSION_COOKIE, sealed);
    const exposed = await getSession(request("session"));
    expect(await exposed.json()).toMatchObject({ connected: true, account: { verified: true } });
    expect(exposed.headers.get("cache-control")).toBe("no-store");
    expect(String(fetch.mock.calls[0]![1].body)).toContain(`code_verifier=${pkce.verifier}`);
  });
  it.each(["cancelled", "mismatch", "expired", "future", "missing", "tampered", "wrong-origin"])("rejects %s without exchanging a token and clears PKCE", async (kind) => {
    const { pkce } = await begin(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    if (kind === "expired") jar.set(LICHESS_PKCE_COOKIE, sealLichessValue({ ...pkce, createdAt: new Date(Date.now() - 601_000).toISOString() }));
    if (kind === "future") jar.set(LICHESS_PKCE_COOKIE, sealLichessValue({ ...pkce, createdAt: new Date(Date.now() + 60_000).toISOString() }));
    if (kind === "missing") jar.delete(LICHESS_PKCE_COOKIE);
    if (kind === "tampered") jar.set(LICHESS_PKCE_COOKIE, "invalid");
    if (kind === "wrong-origin") jar.set(LICHESS_PKCE_COOKIE, sealLichessValue({ ...pkce, redirectUri: "https://other.example/callback" }));
    const response = await callback(request(kind === "cancelled" ? "oauth/callback?error=access_denied" : `oauth/callback?code=test&state=${kind === "mismatch" ? "wrong" : pkce.state}`));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/settings"); expect(location.searchParams.get("lichess")).toBe("error");
    expect(response.headers.get("set-cookie")).toContain(`${LICHESS_PKCE_COOKIE}=;`); expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects an unexpected callback origin and unconfigured production sign-in", async () => {
    const response = await start(new Request("https://foreign.example/api/platforms/lichess/oauth/start")); expect(response.status).toBe(503);
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_ORIGIN", "");
    expect((await start(request("oauth/start"))).status).toBe(503);
  });
  it("allows loopback development callbacks without APP_ORIGIN", async () => {
    vi.stubEnv("APP_ORIGIN", ""); vi.stubEnv("NODE_ENV", "development");
    const response = await start(new Request("http://localhost:3000/api/platforms/lichess/oauth/start"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/platforms/lichess/oauth/callback");
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
  });
  it("keeps token/provider details out of failed callback URLs", async () => {
    const { pkce } = await begin(); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret-provider-token")));
    const response = await callback(request(`oauth/callback?code=test&state=${pkce.state}`));
    expect(response.headers.get("location")).not.toContain("secret-provider-token");
  });
  it("rejects malformed provider token and account responses", async () => {
    const { pkce } = await begin(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ access_token: 42 })));
    const response = await callback(request(`oauth/callback?code=test&state=${pkce.state}`));
    expect(new URL(response.headers.get("location")!).searchParams.get("lichess")).toBe("error");
    expect(readCookie(response, LICHESS_SESSION_COOKIE)).toBeUndefined();
  });
  it("expires a session before any sync request leaves the server", async () => {
    seedSession(new Date(Date.now() - 1000).toISOString()); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await sync(new Request(`${origin}/api/platforms/lichess/sync`, { method: "POST", body: "{}" }))).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled(); expect(await (await getSession(request("session"))).json()).toMatchObject({ connected: false });
  });
  it("clears local cookies after failed remote revocation and reports the distinction", async () => {
    seedSession(); jar.set(LICHESS_PKCE_COOKIE, "pending"); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    const response = await disconnect(new Request(`${origin}/api/platforms/lichess/session`, { method: "DELETE", headers: { Origin: origin } }));
    expect(await response.json()).toEqual({ ok: true, remoteRevoked: false }); expect(jar.size).toBe(0);
  });
  it("does not disconnect the browser on a foreign-origin request", async () => {
    seedSession(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await disconnect(new Request(`${origin}/api/platforms/lichess/session`, { method: "DELETE", headers: { Origin: "https://foreign.example" } }))).status).toBe(403);
    expect(jar.has(LICHESS_SESSION_COOKIE)).toBe(true); expect(fetch).not.toHaveBeenCalled();
  });
  it("bounds token exchange time and returns a recoverable redirect", async () => {
    vi.useFakeTimers(); const { pkce } = await begin();
    vi.stubGlobal("fetch", vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => options.signal?.addEventListener("abort", () => reject(options.signal?.reason)))));
    const pending = callback(request(`oauth/callback?code=test&state=${pkce.state}`));
    await vi.advanceTimersByTimeAsync(20_001);
    expect(new URL((await pending).headers.get("location")!).searchParams.get("reason")).toContain("timed out");
  });
});
