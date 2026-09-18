import type { ProviderKind } from "@chess-review/ui";

export function providerKindFor(input: {
  kind?: "pgn" | "fen";
  external?: { provider: "chesscom" | "lichess" } | undefined;
}): ProviderKind {
  if (input.external?.provider === "chesscom") return "chesscom";
  if (input.external?.provider === "lichess") return "lichess";
  return input.kind === "fen" ? "fen" : "pgn";
}
