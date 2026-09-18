import type { CSSProperties } from "react";

/**
 * Neutral source identity — not a navigation icon and not a third-party logo.
 * The letter is a scan target; the visible name beside it carries the provider.
 */
export type ProviderKind = "chesscom" | "lichess" | "manual" | "pgn" | "fen";

const LETTER: Record<ProviderKind, string> = {
  chesscom: "C",
  lichess: "L",
  manual: "P",
  pgn: "P",
  fen: "F",
};

const LABEL: Record<ProviderKind, string> = {
  chesscom: "Chess.com",
  lichess: "Lichess",
  manual: "Manual",
  pgn: "PGN",
  fen: "FEN",
};

export function providerLabel(provider: ProviderKind): string {
  return LABEL[provider];
}

export interface ProviderMarkProps {
  provider: ProviderKind;
  size?: number;
  /** Hide the accessible name when a visible "Chess.com" / "Lichess" sits beside it. */
  decorative?: boolean;
}

export function ProviderMark({ provider, size = 16, decorative = false }: ProviderMarkProps) {
  const label = LABEL[provider];
  return (
    <span
      className="provider-mark"
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.5) } as CSSProperties}
      title={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      {LETTER[provider]}
    </span>
  );
}
