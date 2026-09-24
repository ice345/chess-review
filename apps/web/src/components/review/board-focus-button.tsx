import { Icon } from "@chess-review/ui";

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
      <Icon name={focused ? "focus-exit" : "focus"} size={16} />
    </button>
  );
}
