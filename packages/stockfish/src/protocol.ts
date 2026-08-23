import type { EngineScore } from "@chess-review/shared";

export interface UciInfoLine {
  depth?: number;
  multiPv: number;
  nodes?: number;
  score?: EngineScore;
  pv: string[];
}

function numericToken(tokens: string[], name: string): number | undefined {
  const index = tokens.indexOf(name);
  if (index < 0) return undefined;
  const value = Number(tokens[index + 1]);
  return Number.isFinite(value) ? value : undefined;
}

export function parseUciInfo(line: string): UciInfoLine | null {
  if (!line.startsWith("info ")) return null;
  const tokens = line.trim().split(/\s+/);
  const scoreIndex = tokens.indexOf("score");
  let score: EngineScore | undefined;
  if (scoreIndex >= 0) {
    const kind = tokens[scoreIndex + 1];
    const value = Number(tokens[scoreIndex + 2]);
    if (Number.isFinite(value) && kind === "cp") score = { kind: "cp", cp: value };
    if (Number.isFinite(value) && kind === "mate") score = { kind: "mate", mateIn: value };
  }
  const pvIndex = tokens.indexOf("pv");
  const depth = numericToken(tokens, "depth");
  const nodes = numericToken(tokens, "nodes");
  return {
    ...(depth === undefined ? {} : { depth }),
    multiPv: numericToken(tokens, "multipv") ?? 1,
    ...(nodes === undefined ? {} : { nodes }),
    ...(score === undefined ? {} : { score }),
    pv: pvIndex < 0 ? [] : tokens.slice(pvIndex + 1),
  };
}

export function parseBestMove(line: string): string | null {
  if (!line.startsWith("bestmove ")) return null;
  const move = line.trim().split(/\s+/)[1];
  return !move || move === "(none)" ? null : move;
}
