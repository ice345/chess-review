import type { MaiaAvailability } from "./local-ai";

export type MaiaServiceState = "checking" | MaiaAvailability | "offline";

export function humanLensServiceCopy(state: MaiaServiceState): string {
  if (state === "checking") return "Checking the optional Maia capability…";
  if (state === "available") return "Maia-3 is ready for this position.";
  if (state === "not-installed") return "Local runtime found; Maia-3 is not installed. Browser Stockfish remains fully available.";
  if (state === "error") return "Maia could not initialize. Browser Stockfish remains fully available.";
  return "Local Maia service is offline. Browser Stockfish remains fully available.";
}
