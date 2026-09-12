/**
 * Reads what a PGN says *around* its mainline: comments, NAGs and recursive
 * annotation variations. The mainline itself is replayed by chess-core; this
 * reader only maps peripheral text onto ply indexes so the product can display
 * it, and re-emit it on export, without rewriting the imported game.
 *
 * It deliberately does not validate chess: a token counts as a move if it is
 * not a move number, NAG or result. Callers compare the resulting length with
 * the replayed mainline and discard the mapping when they disagree, so a
 * mis-read annotation can never be attached to the wrong move.
 */

export interface PlyPgnAnnotations {
  /** Comments after this move, joined in source order. */
  comment?: string;
  /** NAG values as written, for example 1 for `$1`. */
  nags?: number[];
  /** Recursive annotation variations, verbatim, including their parentheses. */
  variations?: string[];
}

export interface PgnAnnotationSet {
  /** Comment that appears before the first move. */
  gameComment?: string;
  /** One entry per mainline move, in order. */
  plies: PlyPgnAnnotations[];
}

const RESULT_TOKEN = /^(?:1-0|0-1|1\/2-1\/2|\*)$/;
const MOVE_NUMBER_PREFIX = /^\d+\.+/;
const ONLY_DOTS = /^\.+$/;
const NAG_TOKEN = /^\$(\d+)$/;
/** Ends a movetext token: whitespace and the structural PGN delimiters. */
const TOKEN_BOUNDARY = /[\s[\]{}();]/;

/** Index of the `}` closing the comment opened at `start`, or -1. */
function braceCommentEnd(pgn: string, start: number): number {
  return pgn.indexOf("}", start + 1);
}

/** Index of the newline ending the comment opened at `start`, or -1. */
function lineEnd(pgn: string, start: number): number {
  return pgn.indexOf("\n", start + 1);
}

/** Index of the `)` matching the `(` at `start`, or -1. Comments and nested variations may contain both delimiters. */
function variationEnd(pgn: string, start: number): number {
  let depth = 0;
  for (let index = start; index < pgn.length; index += 1) {
    const char = pgn[index]!;
    if (char === "{") {
      const close = braceCommentEnd(pgn, index);
      index = close === -1 ? pgn.length : close;
      continue;
    }
    if (char === ";") {
      const close = lineEnd(pgn, index);
      index = close === -1 ? pgn.length : close;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Index just past the `]` closing the tag pair opened at `start`, or -1. */
function tagPairEnd(pgn: string, start: number): number {
  let quoted = false;
  for (let index = start + 1; index < pgn.length; index += 1) {
    const char = pgn[index]!;
    if (quoted && char === "\\") {
      index += 1;
      continue;
    }
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === "]") return index + 1;
  }
  return -1;
}

export function readPgnAnnotations(pgn: string): PgnAnnotationSet {
  const plies: PlyPgnAnnotations[] = [];
  let gameComment: string | undefined;
  const addComment = (value: string): void => {
    const text = value.trim();
    if (!text) return;
    const slot = plies.at(-1);
    if (!slot) {
      gameComment = gameComment === undefined ? text : `${gameComment} ${text}`;
      return;
    }
    slot.comment = slot.comment === undefined ? text : `${slot.comment} ${text}`;
  };

  let index = 0;
  while (index < pgn.length) {
    const char = pgn[index]!;
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    // PGN §6: a line beginning with % is an escape and must be ignored.
    if (char === "%" && (index === 0 || pgn[index - 1] === "\n")) {
      const close = lineEnd(pgn, index);
      index = close === -1 ? pgn.length : close + 1;
      continue;
    }
    if (char === "{") {
      const close = braceCommentEnd(pgn, index);
      addComment(pgn.slice(index + 1, close === -1 ? pgn.length : close));
      index = close === -1 ? pgn.length : close + 1;
      continue;
    }
    if (char === ";") {
      const close = lineEnd(pgn, index);
      addComment(pgn.slice(index + 1, close === -1 ? pgn.length : close));
      index = close === -1 ? pgn.length : close + 1;
      continue;
    }
    if (char === "(") {
      const close = variationEnd(pgn, index);
      const raw = (close === -1 ? pgn.slice(index) : pgn.slice(index, close + 1)).replace(/\s+/g, " ").trim();
      const slot = plies.at(-1);
      // An empty "()" or a variation before the first move carries nothing.
      if (slot && raw.length > 2) (slot.variations ??= []).push(raw);
      index = close === -1 ? pgn.length : close + 1;
      continue;
    }
    // An unmatched ")" is tolerated: the movetext is already validated by the
    // replayed mainline, and this reader must not become a second parser.
    if (char === ")") {
      index += 1;
      continue;
    }
    if (char === "[") {
      const close = tagPairEnd(pgn, index);
      if (close === -1) break;
      index = close;
      continue;
    }
    const start = index;
    while (index < pgn.length && !TOKEN_BOUNDARY.test(pgn[index]!)) index += 1;
    let token = pgn.slice(start, index);
    // Tolerate the glued form "1.e4" and "1...e5".
    const prefix = MOVE_NUMBER_PREFIX.exec(token);
    if (prefix) token = token.slice(prefix[0].length);
    if (!token || ONLY_DOTS.test(token) || RESULT_TOKEN.test(token)) continue;
    const nag = NAG_TOKEN.exec(token);
    if (nag) {
      const slot = plies.at(-1);
      if (slot) (slot.nags ??= []).push(Number(nag[1]));
      continue;
    }
    plies.push({});
  }

  return { ...(gameComment === undefined ? {} : { gameComment }), plies };
}

/**
 * Attaches annotations to a replayed mainline. Returns the ply annotations only
 * when the reader and the replayed mainline agree on the move count; otherwise
 * the mapping is dropped rather than risk labelling the wrong move.
 */
export function alignPgnAnnotations(
  annotations: PgnAnnotationSet,
  plyCount: number,
): { gameComment?: string; plies: PlyPgnAnnotations[] } {
  const aligned = annotations.plies.length === plyCount ? annotations.plies : [];
  return {
    ...(annotations.gameComment === undefined ? {} : { gameComment: annotations.gameComment }),
    plies: Array.from({ length: plyCount }, (_, index) => aligned[index] ?? {}),
  };
}
