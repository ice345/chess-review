export function BoardFocusButton({ focused, onToggle }: { focused: boolean; onToggle: () => void }) {
  const label = focused ? "Exit focus board" : "Focus board";
  return (
    <button
      type="button"
      className="board-focus-button"
      aria-label={label}
      aria-pressed={focused}
      title={`${label} (Z)`}
      onClick={onToggle}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        {focused
          ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
          : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
      </svg>
    </button>
  );
}
