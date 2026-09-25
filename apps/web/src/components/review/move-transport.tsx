"use client";

import type { UiLanguage } from "@chess-review/shared";
import { Icon, type IconName } from "@chess-review/ui";
import { useUiLanguage } from "../../hooks/use-ui-language";

type TransportCopy = {
  navigation: string;
  variationStart: string;
  firstPosition: string;
  previousMove: string;
  pausePlayback: string;
  playbackPauses: string;
  replayGame: string;
  playGame: string;
  nextMove: string;
  variationEnd: string;
  lastPosition: string;
};

const COPY: Record<UiLanguage, TransportCopy> = {
  en: {
    navigation: "Move navigation",
    variationStart: "Variation start",
    firstPosition: "First position",
    previousMove: "Previous move",
    pausePlayback: "Pause playback",
    playbackPauses: "Playback pauses during variation",
    replayGame: "Replay game",
    playGame: "Play game",
    nextMove: "Next move",
    variationEnd: "Variation end",
    lastPosition: "Last position",
  },
  "zh-CN": {
    navigation: "着法导航",
    variationStart: "变化起点",
    firstPosition: "起始局面",
    previousMove: "上一着",
    pausePlayback: "暂停播放",
    playbackPauses: "变化中暂停播放",
    replayGame: "重播对局",
    playGame: "播放对局",
    nextMove: "下一着",
    variationEnd: "变化终点",
    lastPosition: "最终局面",
  },
};

export function MoveTransport({
  isPlaying,
  inVariation,
  playDisabled,
  atStart,
  atEnd,
  onFirst,
  onPrevious,
  onTogglePlayback,
  onNext,
  onLast,
}: {
  isPlaying: boolean;
  inVariation: boolean;
  playDisabled: boolean;
  atStart: boolean;
  atEnd: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onTogglePlayback: () => void;
  onNext: () => void;
  onLast: () => void;
}) {
  const copy = COPY[useUiLanguage()];
  const controls: { label: string; icon: IconName; disabled: boolean; action: () => void }[] = [
    { label: inVariation ? copy.variationStart : copy.firstPosition, icon: "first", disabled: atStart, action: onFirst },
    { label: copy.previousMove, icon: "previous", disabled: atStart, action: onPrevious },
    { label: isPlaying ? copy.pausePlayback : inVariation ? copy.playbackPauses : atEnd ? copy.replayGame : copy.playGame, icon: isPlaying ? "pause" : "play", disabled: playDisabled, action: onTogglePlayback },
    { label: copy.nextMove, icon: "next", disabled: atEnd, action: onNext },
    { label: inVariation ? copy.variationEnd : copy.lastPosition, icon: "last", disabled: atEnd, action: onLast },
  ];

  return (
    <div className="move-transport" aria-label={copy.navigation}>
      {controls.map((control) => (
        <button
          type="button"
          key={`${control.icon}-${control.label}`}
          aria-label={control.label}
          title={control.label}
          disabled={control.disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={control.action}
        >
          <Icon name={control.icon} size={16} />
        </button>
      ))}
    </div>
  );
}
