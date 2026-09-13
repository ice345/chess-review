import { defaultPieces, type PieceRenderObject } from "react-chessboard";
import { PIECE_ASSET_DIR, PIECE_ASSET_KEYS, type PieceAssetKey, type PieceSetId } from "./board-piece-assets";

function lizBluePiece(key: PieceAssetKey) {
  return function LizBluePiece() {
    return (
      <img
        src={`${PIECE_ASSET_DIR}/${key}.png`}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "100%", pointerEvents: "none", userSelect: "none", display: "block" }}
      />
    );
  };
}

const lizBluePieces: PieceRenderObject = Object.fromEntries(
  PIECE_ASSET_KEYS.map((key) => [key, lizBluePiece(key)]),
);

export function chessboardPieces(set: PieceSetId): PieceRenderObject {
  return set === "classic" ? defaultPieces : lizBluePieces;
}
