import type { UiLanguage } from "@chess-review/shared";

/**
 * Canonical piece identity: the selectable piece sets and the authored asset
 * files behind the default set.
 *
 * Kept JSX-free and dependency-free so the PNG canvas renderer and its tests can
 * import the asset contract without pulling the react-chessboard component tree.
 */
export const PIECE_SET_IDS = ["liz-blue", "classic"] as const;
export type PieceSetId = (typeof PIECE_SET_IDS)[number];

/**
 * Versioned directory for the authored Feather Porcelain assets.
 *
 * The path carries the art version on purpose: `/pieces/` is cache-first in the
 * service worker, so overwriting a URL would leave returning visitors on the
 * previous King/Queen/Bishop art until they cleared storage. A new version
 * directory changes the URL itself, which needs no cache flush for the engine,
 * sounds or hashed chunks (see `docs/ui-spec.md`).
 */
export const PIECE_ASSET_DIR = "/pieces/feather_porcelain_v1_1";

export const PIECE_ASSET_KEYS = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"] as const;
export type PieceAssetKey = (typeof PIECE_ASSET_KEYS)[number];

/** FEN piece character → authored asset key (`P` → `wP`, `n` → `bN`). */
export function boardPieceImageKey(piece: string): PieceAssetKey {
  return `${piece === piece.toUpperCase() ? "w" : "b"}${piece.toUpperCase()}` as PieceAssetKey;
}

const PIECE_NAMES: Record<UiLanguage, Record<PieceAssetKey, string>> = {
  en: {
    wP: "White pawn", wN: "White knight", wB: "White bishop", wR: "White rook", wQ: "White queen", wK: "White king",
    bP: "Black pawn", bN: "Black knight", bB: "Black bishop", bR: "Black rook", bQ: "Black queen", bK: "Black king",
  },
  "zh-CN": {
    wP: "白方兵", wN: "白方马", wB: "白方象", wR: "白方车", wQ: "白方后", wK: "白方王",
    bP: "黑方兵", bN: "黑方马", bB: "黑方象", bR: "黑方车", bQ: "黑方后", bK: "黑方王",
  },
};

/** What a screen reader calls a piece: "White knight". */
export function boardPieceName(key: PieceAssetKey, language: UiLanguage): string {
  return PIECE_NAMES[language][key];
}

const SQUARE_COPY: Record<UiLanguage, (square: string) => string> = {
  en: (square) => `Square ${square}`,
  "zh-CN": (square) => `格子 ${square}`,
};

/** What a screen reader calls a square: "Square e4".
 *
 * The square groups the piece that stands on it, whose own name says what it is;
 * the squares themselves are not focusable, so operating the board is the move
 * entry, the transport and the named move and candidate buttons.
 */
export function boardSquareDescription(square: string, language: UiLanguage): string {
  return SQUARE_COPY[language](square);
}
