/**
 * Canonical piece identity: the selectable piece sets and the authored asset
 * files behind the default set.
 *
 * Kept JSX-free and dependency-free so the PNG canvas renderer and its tests can
 * import the asset contract without pulling the react-chessboard component tree.
 */
export const PIECE_SET_IDS = ["liz-blue", "classic"] as const;
export type PieceSetId = (typeof PIECE_SET_IDS)[number];

export const PIECE_ASSET_DIR = "/pieces/liz_blue_chess_pieces_512";

export const PIECE_ASSET_KEYS = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"] as const;
export type PieceAssetKey = (typeof PIECE_ASSET_KEYS)[number];

/** FEN piece character → authored asset key (`P` → `wP`, `n` → `bN`). */
export function boardPieceImageKey(piece: string): PieceAssetKey {
  return `${piece === piece.toUpperCase() ? "w" : "b"}${piece.toUpperCase()}` as PieceAssetKey;
}
