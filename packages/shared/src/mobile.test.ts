import { describe, expect, it } from "vitest";
import {
  isMobileEndpointManifestV1,
  MOBILE_ENDPOINT_PROTOCOL_VERSION,
  resolveMobileCapabilities,
  type MobileEndpointManifestV1,
  type MobileRuntimeContext,
} from "./mobile";

const manifest: MobileEndpointManifestV1 = {
  protocolVersion: MOBILE_ENDPOINT_PROTOCOL_VERSION,
  endpointId: "paired-home-engine",
  objective: { available: true, gameAnalysisVersion: 1, stockfishVersion: "18" },
  human: { available: true, maiaModels: ["maia3-5m", "maia3-23m"] },
  coach: { available: true, languages: ["en", "zh-CN"] },
};

function context(overrides: Partial<MobileRuntimeContext> = {}): MobileRuntimeContext {
  return {
    cache: { game: true, objective: false, human: false, coach: false, training: false },
    deviceStockfishReady: false,
    selectedMaiaModel: "maia3-5m",
    language: "zh-CN",
    ...overrides,
  };
}

function lane(result: ReturnType<typeof resolveMobileCapabilities>, capability: string) {
  return result.find((item) => item.capability === capability)?.lane;
}

describe("mobile companion capability policy", () => {
  it("keeps PGN/rules and deterministic coaching useful while fully offline", () => {
    const result = resolveMobileCapabilities(context());

    expect(lane(result, "game-import")).toBe("device");
    expect(lane(result, "review-navigation")).toBe("device");
    expect(lane(result, "objective-analysis")).toBe("unavailable");
    expect(lane(result, "human-analysis")).toBe("unavailable");
    expect(lane(result, "coach")).toBe("deterministic");
  });

  it("reuses persisted canonical facts before scheduling new analysis", () => {
    const result = resolveMobileCapabilities(context({
      cache: { game: true, objective: true, human: true, coach: true, training: true },
      deviceStockfishReady: true,
      remote: { online: true, secureTransport: true, authenticated: true, manifest },
    }));

    expect(lane(result, "objective-analysis")).toBe("cache");
    expect(lane(result, "human-analysis")).toBe("cache");
    expect(lane(result, "coach")).toBe("cache");
    expect(lane(result, "training")).toBe("cache");
  });

  it("allows an independently proven on-device Stockfish without enabling Maia", () => {
    const result = resolveMobileCapabilities(context({ deviceStockfishReady: true }));

    expect(lane(result, "objective-analysis")).toBe("device");
    expect(lane(result, "human-analysis")).toBe("unavailable");
  });

  it("routes each source only through a secure authenticated compatible endpoint", () => {
    const result = resolveMobileCapabilities(context({
      remote: { online: true, secureTransport: true, authenticated: true, manifest },
    }));

    expect(lane(result, "objective-analysis")).toBe("remote");
    expect(lane(result, "human-analysis")).toBe("remote");
    expect(lane(result, "coach")).toBe("remote");
  });

  it("rejects reachable but insecure or unpaired remote services", () => {
    for (const remote of [
      { online: true, secureTransport: false, authenticated: true, manifest },
      { online: true, secureTransport: true, authenticated: false, manifest },
      { online: false, secureTransport: true, authenticated: true, manifest },
    ]) {
      const result = resolveMobileCapabilities(context({ remote }));
      expect(lane(result, "objective-analysis")).toBe("unavailable");
      expect(lane(result, "human-analysis")).toBe("unavailable");
      expect(lane(result, "coach")).toBe("deterministic");
    }
  });

  it("requires the selected Maia model and Coach language independently", () => {
    const result = resolveMobileCapabilities(context({
      selectedMaiaModel: "maia3-79m",
      language: "zh-CN",
      remote: {
        online: true,
        secureTransport: true,
        authenticated: true,
        manifest: { ...manifest, coach: { available: true, languages: ["en"] } },
      },
    }));

    expect(lane(result, "objective-analysis")).toBe("remote");
    expect(lane(result, "human-analysis")).toBe("unavailable");
    expect(lane(result, "coach")).toBe("deterministic");
  });
});

describe("mobile endpoint manifest validation", () => {
  it("accepts the versioned endpoint contract", () => {
    expect(isMobileEndpointManifestV1(manifest)).toBe(true);
  });

  it("rejects incompatible or structurally invalid endpoint data", () => {
    expect(isMobileEndpointManifestV1({ ...manifest, protocolVersion: "mobile-endpoint-v2" })).toBe(false);
    expect(isMobileEndpointManifestV1({ ...manifest, objective: { available: true, gameAnalysisVersion: 2 } })).toBe(false);
    expect(isMobileEndpointManifestV1({ ...manifest, objective: { available: true, gameAnalysisVersion: 1 } })).toBe(false);
    expect(isMobileEndpointManifestV1({ ...manifest, human: { available: true, maiaModels: ["maia2"] } })).toBe(false);
    expect(isMobileEndpointManifestV1({ ...manifest, coach: { available: true, languages: ["fr"] } })).toBe(false);
  });
});
