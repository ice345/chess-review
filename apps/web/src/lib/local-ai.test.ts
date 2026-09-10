import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadMaiaModel, getLocalAiHealth } from "./local-ai";
vi.mock("./deployment", () => ({ localAiAccess: () => ({ state: "enabled", url: "http://127.0.0.1:8000" }) }));

describe("local-ai client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([null, {}, { status: "ok", maia: "available", coach: { ollamaModels: "invalid" } }])("rejects invalid capability responses before UI consumers receive them: %j", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
    await expect(getLocalAiHealth()).rejects.toMatchObject({ code: "invalid-health-response" });
  });

  it("sends an explicit JSON confirmation for model downloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: "maia3-23m",
      status: "cached",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadMaiaModel("maia3-23m")).resolves.toBe("cached");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/maia/models/maia3-23m/download",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
        signal: expect.any(AbortSignal),
      },
    );
  });
});
