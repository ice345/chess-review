export function BoardFlipButton({ onFlip }: { onFlip: () => void }) {
  return (
    <button type="button" className="board-flip-button" aria-label="Flip board" title="Flip board" onClick={onFlip}>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M7 5h10l-2.5-2.5M17 19H7l2.5 2.5M19 7.5v5M5 16.5v-5" />
        <path d="m17 5 2 2.5-2 2.5M7 19l-2-2.5L7 14" />
      </svg>
    </button>
  );
}
