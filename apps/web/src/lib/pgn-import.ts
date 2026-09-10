import { parsePgn } from "@chess-review/chess-core";

export const MAX_PGN_BYTES = 1_048_576;
export const MAX_PGN_GAMES = 100;
export interface PgnChoice { pgn: string; label: string }

/** Frame games only; chess-core remains responsible for PGN/chess validation.
 * PGN §7/§8: comments, quoted tags and recursive variations cannot end a game.
 */
export function splitPgnGames(text: string): string[] {
  const games: string[] = [];
  let start = 0;
  let hasMoves = false;
  let ended = false;
  let variation = 0;
  const boundary = (index: number) => {
    games.push(text.slice(start, index));
    if (games.length >= MAX_PGN_GAMES) throw new Error(`Choose a PGN file with at most ${MAX_PGN_GAMES} games.`);
    start = index; hasMoves = false; ended = false;
  };
  for (let i = 0; i < text.length;) {
    const char = text[i]!;
    if (/\s/.test(char)) { i++; continue; }
    if (char === "{" || char === ";" || char === "%" && (i === 0 || text[i - 1] === "\n")) {
      const end = text.indexOf(char === "{" ? "}" : "\n", i + 1);
      if (char === "{" && end === -1) throw new Error("Close the unfinished PGN comment before importing.");
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    if (char === "[") {
      if (variation === 0 && hasMoves) boundary(i);
      let quoted = false;
      let closed = false;
      for (i++; i < text.length; i++) {
        if (quoted && text[i] === "\\") { i++; continue; }
        if (text[i] === '"') quoted = !quoted;
        if (!quoted && text[i] === "]") { i++; closed = true; break; }
      }
      if (!closed) throw new Error("Close the unfinished PGN header before importing.");
      continue;
    }
    if (char === "(") { variation++; i++; continue; }
    if (char === ")") { if (--variation < 0) throw new Error("The PGN contains an unmatched variation bracket."); i++; continue; }
    const tokenStart = i;
    while (i < text.length && !/[\s[\]{}();]/.test(text[i]!)) i++;
    if (i === tokenStart) throw new Error("The PGN contains an unexpected bracket.");
    if (variation > 0) continue;
    if (ended) boundary(tokenStart);
    hasMoves = true;
    ended = /^(1-0|0-1|1\/2-1\/2|\*)$/.test(text.slice(tokenStart, i));
  }
  if (variation !== 0) throw new Error("Close the unfinished PGN variation before importing.");
  if (text.slice(start).trim()) games.push(text.slice(start));
  return games;
}

export function inspectPgnImport(text: string): PgnChoice[] {
  if (new TextEncoder().encode(text).byteLength > MAX_PGN_BYTES) throw new Error("Choose a PGN smaller than 1 MiB.");
  if (!text.trim()) throw new Error("This PGN is empty. Choose a file containing a game.");
  if (text.includes("\0")) throw new Error("Use a UTF-8 text PGN file.");
  return splitPgnGames(text).map((pgn, index) => {
    try {
      const game = parsePgn(pgn);
      if (!game.plies.length) throw new Error("PGN must contain at least one move.");
      return { pgn, label: `${index + 1}. ${game.headers.White ?? "White"} vs ${game.headers.Black ?? "Black"} · ${game.plies.length} plies` };
    } catch (error) { throw new Error(`Game ${index + 1}: ${error instanceof Error ? error.message : "Invalid PGN."}`, { cause: error }); }
  });
}

export async function readPgnFile(file: Pick<File, "name" | "size" | "text">): Promise<PgnChoice[]> {
  if (!/\.pgn$/i.test(file.name)) throw new Error("Choose a .pgn file. Images and other file types are not supported.");
  if (file.size > MAX_PGN_BYTES) throw new Error("Choose a PGN smaller than 1 MiB.");
  return inspectPgnImport(await file.text());
}
