import type { CSSProperties } from "react";
import chesscomMark from "../assets/providers/chesscom.svg";
import lichessMark from "../assets/providers/lichess.svg";
import notationMark from "../assets/providers/notation.svg";
import positionMark from "../assets/providers/position.svg";

/** Source identity uses local image assets; names remain visible beside marks. */
export type ProviderKind = "chesscom" | "lichess" | "manual" | "pgn" | "fen";

const LABEL: Record<ProviderKind, string> = {
  chesscom: "Chess.com",
  lichess: "Lichess",
  manual: "Manual",
  pgn: "PGN",
  fen: "FEN",
};

function assetSource(asset: unknown): string {
  return typeof asset === "string" ? asset : (asset as { src: string }).src;
}

/** Multi-tone brand glyph — render as <img>, do not CSS-mask. */
const COLOR_IMAGE: Partial<Record<ProviderKind, string>> = {
  chesscom: assetSource(chesscomMark),
};

/** Single-ink silhouette — CSS-mask + Windowlight ink fill. */
const MASK_IMAGE: Partial<Record<ProviderKind, string>> = {
  lichess: assetSource(lichessMark),
  manual: assetSource(notationMark),
  pgn: assetSource(notationMark),
  fen: assetSource(positionMark),
};

export function providerLabel(provider: ProviderKind): string {
  return LABEL[provider];
}

export interface ProviderMarkProps {
  provider: ProviderKind;
  size?: number;
  decorative?: boolean;
}

export function ProviderMark({ provider, size = 16, decorative = false }: ProviderMarkProps) {
  const label = LABEL[provider];
  const colorSrc = COLOR_IMAGE[provider];
  const maskSrc = MASK_IMAGE[provider];

  if (colorSrc) {
    return (
      <span
        className="provider-mark provider-mark--color"
        style={{ width: size, height: size } as CSSProperties}
        title={decorative ? undefined : label}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative ? true : undefined}
      >
        <img src={colorSrc} alt="" width={size} height={size} draggable={false} />
      </span>
    );
  }

  if (maskSrc) {
    return (
      <span
        className="provider-mark provider-mark--image"
        style={
          {
            width: size,
            height: size,
            WebkitMaskImage: `url(${maskSrc})`,
            maskImage: `url(${maskSrc})`,
          } as CSSProperties
        }
        title={decorative ? undefined : label}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative ? true : undefined}
      />
    );
  }

  return null;
}
