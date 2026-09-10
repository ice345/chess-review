import type { MaiaAvailability } from "./local-ai";

export type MaiaServiceState = "checking" | MaiaAvailability | "offline" | "not-provided" | "not-configured";

export function humanLensServiceCopy(state: MaiaServiceState): string {
  if (state === "not-provided") return "Maia is not provided by this website. Browser Stockfish remains fully available. Learn about Enhanced Local in Help.";
  if (state === "not-configured") return "Local enhancements are not configured correctly. Browser Stockfish remains fully available. Check local setup in Help.";
  if (state === "checking") return "Checking the optional Maia capability…";
  if (state === "available") return "Maia-3 is ready for this position.";
  if (state === "not-installed") return "Local runtime found; Maia-3 is not installed. Browser Stockfish remains fully available.";
  if (state === "error") return "Maia could not initialize. Browser Stockfish remains fully available.";
  return "Local Maia service is offline. Browser Stockfish remains fully available.";
}
