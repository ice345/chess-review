function TransportIcon({ kind }: { kind: "first" | "previous" | "play" | "pause" | "next" | "last" }) {
  if (kind === "play") return <path d="m9 6 9 6-9 6Z" />;
  if (kind === "pause") return <path d="M8 6h3v12H8zM14 6h3v12h-3z" />;
  if (kind === "previous") return <path d="m15.5 6-7 6 7 6Z" />;
  if (kind === "next") return <path d="m8.5 6 7 6-7 6Z" />;
  if (kind === "first") return <path d="M6 6h2v12H6zM17 6l-7 6 7 6Z" />;
  return <path d="M16 6h2v12h-2zM7 6l7 6-7 6Z" />;
}

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
  const controls = [
    { label: inVariation ? "Variation start" : "First position", icon: "first" as const, disabled: atStart, action: onFirst },
    { label: "Previous move", icon: "previous" as const, disabled: atStart, action: onPrevious },
    { label: isPlaying ? "Pause playback" : inVariation ? "Playback pauses during variation" : atEnd ? "Replay game" : "Play game", icon: (isPlaying ? "pause" : "play") as "pause" | "play", disabled: playDisabled, action: onTogglePlayback },
    { label: "Next move", icon: "next" as const, disabled: atEnd, action: onNext },
    { label: inVariation ? "Variation end" : "Last position", icon: "last" as const, disabled: atEnd, action: onLast },
  ];

  return (
    <div className="move-transport" aria-label="Move navigation">
      {controls.map((control) => (
        <button
          type="button"
          key={control.icon}
          aria-label={control.label}
          title={control.label}
          disabled={control.disabled}
          onClick={control.action}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24"><TransportIcon kind={control.icon} /></svg>
        </button>
      ))}
    </div>
  );
}
