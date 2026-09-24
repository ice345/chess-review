import { Icon, type IconName } from "@chess-review/ui";

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
  const controls: { label: string; icon: IconName; disabled: boolean; action: () => void }[] = [
    { label: inVariation ? "Variation start" : "First position", icon: "first", disabled: atStart, action: onFirst },
    { label: "Previous move", icon: "previous", disabled: atStart, action: onPrevious },
    { label: isPlaying ? "Pause playback" : inVariation ? "Playback pauses during variation" : atEnd ? "Replay game" : "Play game", icon: isPlaying ? "pause" : "play", disabled: playDisabled, action: onTogglePlayback },
    { label: "Next move", icon: "next", disabled: atEnd, action: onNext },
    { label: inVariation ? "Variation end" : "Last position", icon: "last", disabled: atEnd, action: onLast },
  ];

  return (
    <div className="move-transport" aria-label="Move navigation">
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
