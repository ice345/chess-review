import { defaultPieces, type PieceRenderObject } from "react-chessboard";

export const PIECE_SET_IDS = ["liz-blue", "classic"] as const;
export type PieceSetId = (typeof PIECE_SET_IDS)[number];

const KEYS = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"] as const;
const LIZ_BLUE_DIR = "/pieces/liz_blue_chess_pieces_512";

function lizBluePiece(key: (typeof KEYS)[number]) {
  return function LizBluePiece() {
    return (
      <img
        src={`${LIZ_BLUE_DIR}/${key}.png`}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "100%", pointerEvents: "none", userSelect: "none", display: "block" }}
      />
    );
  };
}

const lizBluePieces: PieceRenderObject = Object.fromEntries(
  KEYS.map((key) => [key, lizBluePiece(key)]),
);

export function chessboardPieces(set: PieceSetId): PieceRenderObject {
  return set === "classic" ? defaultPieces : lizBluePieces;
}
