import { Icon } from "@chess-review/ui";

export function BoardFlipButton({ onFlip }: { onFlip: () => void }) {
  return (
    <button type="button" className="board-flip-button" aria-label="Flip board" title="Flip board" onClick={onFlip}>
      <Icon name="flip" size={16} />
    </button>
  );
}
