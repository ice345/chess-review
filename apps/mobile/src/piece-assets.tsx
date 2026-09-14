import type { PieceRenderObject } from "react-chessboard";
/*
 * Feather Porcelain on the mobile companion.
 *
 * The assets are imported from the canonical directory
 * (`packages/ui/assets/pieces/feather-porcelain-v1.1/`) that
 * `scripts/sync-piece-assets.mjs` validates, so the companion renders exactly the
 * pieces the Web app serves — with no second copy that can drift. Static imports
 * also mean a missing file is a build error rather than a silently empty square.
 */
import wP from "../../../packages/ui/assets/pieces/feather-porcelain-v1.1/wP.png";
import wN from "../../../packages/ui/assets/pieces/feather-porcelain-v1.1/wN.png";
import wB from "../../../packages/ui/assets/pieces/feather-porcelain-v1.1/wB.png";
import wR from "../../../packages/ui/assets/pieces/feather-porcelain-v1.1/wR.png";
import wQ from "../../../packages/ui/assets/pieces/feather-porcelain-v1.1/wQ.png";
import wK from "../../../packages/ui/assets/pieces/feather-porcelain-v1.1/wK.png";
import bP from "../../../packages/ui/assets/pieces/feather-porcelain-v1.1/bP.png";
import bN from "../../../packages/ui/assets/pieces/feather-porcelain-v1.1/bN.png";
import bB from "../../../packages/ui/assets/pieces/feather-porcelain-v1.1/bB.png";
import bR from "../../../packages/ui/assets/pieces/feather-porcelain-v1.1/bR.png";
import bQ from "../../../packages/ui/assets/pieces/feather-porcelain-v1.1/bQ.png";
import bK from "../../../packages/ui/assets/pieces/feather-porcelain-v1.1/bK.png";

function pieceRenderer(source: string) {
  return function FeatherPorcelainPiece() {
    return (
      <img
        src={source}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "100%", pointerEvents: "none", userSelect: "none", display: "block" }}
      />
    );
  };
}

const renderers = {
  wP: pieceRenderer(wP), wN: pieceRenderer(wN), wB: pieceRenderer(wB),
  wR: pieceRenderer(wR), wQ: pieceRenderer(wQ), wK: pieceRenderer(wK),
  bP: pieceRenderer(bP), bN: pieceRenderer(bN), bB: pieceRenderer(bB),
  bR: pieceRenderer(bR), bQ: pieceRenderer(bQ), bK: pieceRenderer(bK),
} satisfies PieceRenderObject;

export const FEATHER_PORCELAIN_PIECES: PieceRenderObject = renderers;
