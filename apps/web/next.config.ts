import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
