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
      // The documented deployment terminates HTTPS at Cloudflare, so the origin
      // only ever answers plain HTTP over loopback. Sending HSTS from the app is
      // still correct and keeps the guarantee if the proxy setup changes; two
      // years plus preload matches what a browser-first public site wants.
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    ] }, {
      // The engine and sound assets are version-pinned build inputs rather than
      // fingerprinted routes, so a visitor who has them must never fetch seven
      // megabytes again. Replacing either binary therefore requires a NEW
      // filename: bumping STOCKFISH_VERSION only changes the analysis cache key
      // and cannot invalidate a client that already stored the old bytes.
      source: "/engine/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }, {
      source: "/sounds/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }, {
      // A long-lived service worker would pin visitors to a previous release.
      source: "/sw.js",
      headers: [{ key: "Cache-Control", value: "no-cache" }],
    }, { source: "/api/platforms/:path*", headers: [
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
