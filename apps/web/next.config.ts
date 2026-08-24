import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
