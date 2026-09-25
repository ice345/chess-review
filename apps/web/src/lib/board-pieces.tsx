import { defaultPieces, type PieceRenderObject } from "react-chessboard";
import type { UiLanguage } from "@chess-review/shared";
import { useUiLanguage } from "../hooks/use-ui-language";
import { PIECE_ASSET_DIR, PIECE_ASSET_KEYS, boardPieceName, type PieceAssetKey, type PieceSetId } from "./board-piece-assets";

type PieceProps = { fill?: string; square?: string; svgStyle?: React.CSSProperties };

const ON_SQUARE: Record<UiLanguage, (name: string, square: string) => string> = {
  en: (name, square) => `${name} on ${square}`,
  "zh-CN": (name, square) => `${name}在 ${square}`,
};

/**
 * A piece whose containing button carries a real name.
 *
 * The board renders each piece inside a focusable draggable element, but the art
 * itself is anonymous: an empty-alt image or a bare SVG. A screen reader then
 * announces a button with no name for every piece on the board. Each renderer
 * therefore emits the piece's name, and the square it currently occupies, as
 * visually hidden text beside the art — the draggable element takes its
 * accessible name from that text, and it follows the piece when it moves.
 */
function namedPiece(key: PieceAssetKey, render: (props?: PieceProps) => React.JSX.Element): (props?: PieceProps) => React.JSX.Element {
  return function NamedPiece(props?: PieceProps) {
    const language = useUiLanguage();
    const name = boardPieceName(key, language);
    const square = props?.square;
    return (
      <>
        {render(props)}
        <span className="sr-only">{square ? ON_SQUARE[language](name, square) : name}</span>
      </>
    );
  };
}

function lizBluePiece(key: PieceAssetKey): (props?: PieceProps) => React.JSX.Element {
  return namedPiece(key, () => (
    <img
      src={`${PIECE_ASSET_DIR}/${key}.png`}
      alt=""
      draggable={false}
      style={{ width: "100%", height: "100%", pointerEvents: "none", userSelect: "none", display: "block" }}
    />
  ));
}

const lizBluePieces: PieceRenderObject = Object.fromEntries(
  PIECE_ASSET_KEYS.map((key) => [key, lizBluePiece(key)]),
);

const classicPieces: PieceRenderObject = Object.fromEntries(
  PIECE_ASSET_KEYS.map((key) => [key, namedPiece(key, defaultPieces[key] as (props?: PieceProps) => React.JSX.Element)]),
);

export function chessboardPieces(set: PieceSetId): PieceRenderObject {
  return set === "classic" ? classicPieces : lizBluePieces;
}
