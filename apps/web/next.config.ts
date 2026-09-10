import path from "node:path";
import type { NextConfig } from "next";

if (process.env.NEXT_PUBLIC_APP_MODE && !["browser-core", "enhanced-local"].includes(process.env.NEXT_PUBLIC_APP_MODE)) throw new Error("NEXT_PUBLIC_APP_MODE must be browser-core or enhanced-local. Hosted AI is not implemented.");
if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_APP_MODE !== "enhanced-local" && process.env.NEXT_PUBLIC_LOCAL_AI_TOKEN) throw new Error("Remove NEXT_PUBLIC_LOCAL_AI_TOKEN before building a public Browser Core site. Public bundles must not contain service credentials.");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  cacheMaxMemorySize: 16 * 1024 * 1024,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ] }, { source: "/api/platforms/:path*", headers: [
      { key: "Cache-Control", value: "no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ] }];
  },
  // The managed launcher advertises the loopback URL. Without this explicit
  // origin Next dev serves HTML at 127.0.0.1 but blocks its client chunks,
  // leaving the page visible and every React-backed control unhydrated.
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  transpilePackages: [
    "@chess-review/analysis",
    "@chess-review/chess-core",
    "@chess-review/openings",
    "@chess-review/shared",
    "@chess-review/stockfish",
    "@chess-review/ui",
  ],
};

export default nextConfig;
