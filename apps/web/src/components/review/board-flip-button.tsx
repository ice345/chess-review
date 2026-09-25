"use client";

import type { UiLanguage } from "@chess-review/shared";
import { Icon } from "@chess-review/ui";
import { useUiLanguage } from "../../hooks/use-ui-language";

type FlipCopy = {
  flipBoard: string;
};

const COPY: Record<UiLanguage, FlipCopy> = {
  en: {
    flipBoard: "Flip board",
  },
  "zh-CN": {
    flipBoard: "翻转棋盘",
  },
};

export function BoardFlipButton({ onFlip }: { onFlip: () => void }) {
  const copy = COPY[useUiLanguage()];
  return (
    <button type="button" className="board-flip-button" aria-label={copy.flipBoard} title={copy.flipBoard} onClick={onFlip}>
      <Icon name="flip" size={16} />
    </button>
  );
}
