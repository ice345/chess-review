import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveLocalAiAccess } from "./deployment";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("deployment capabilities", () => {
  it.each(["localhost", "127.0.0.1", "review.example"])("never exposes an enhancement endpoint in Browser Core at %s", (hostname) => {
    expect(resolveLocalAiAccess("browser-core", "http://127.0.0.1:8000", hostname).state).toBe("not-provided");
  });
  it("does not probe a visitor's computer even if a local build is exposed on a public domain", () => {
    expect(resolveLocalAiAccess("enhanced-local", "http://127.0.0.1:8000", "review.example").state).toBe("not-provided");
  });
  it.each(["https://remote.example/api", "http://user:password@localhost:8000", "http://localhost:8000?token=secret", "bad-url"])("rejects unsupported enhancement address %s", (url) => {
    expect(resolveLocalAiAccess("enhanced-local", url, "localhost").state).toBe("not-configured");
  });
  it("supports an explicit local loopback service", () => {
    expect(resolveLocalAiAccess("enhanced-local", "http://127.0.0.1:8000/", "localhost")).toEqual({ state: "enabled", url: "http://127.0.0.1:8000" });
  });
  it("guards every direct enhancement call before any network request", async () => {
    vi.stubGlobal("window", { location: { hostname: "public.example" } });
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const ai = await import("./local-ai");
    await expect(ai.getLocalAiHealth()).rejects.toMatchObject({ code: "not-provided" });
    await expect(ai.downloadMaiaModel("maia3-5m")).rejects.toMatchObject({ code: "not-provided" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
