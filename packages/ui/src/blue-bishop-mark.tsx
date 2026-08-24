export interface BlueBishopMarkProps {
  size?: number;
  title?: string;
  decorative?: boolean;
}

/** Original project mark: a bishop silhouette whose quiet inner wing follows
 * the piece's diagonal cut. It is deliberately simple enough for 16px use. */
export function BlueBishopMark({ size = 32, title = "Open Chess Review", decorative = false }: BlueBishopMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
    >
      {!decorative && <title>{title}</title>}
      <path
        d="M24 3.7c-4.7 0-8.1 3.7-8.1 8.1 0 2.9 1.4 5.1 3.2 7-5.1 3.2-8.3 8.3-8.5 14.2h26.8c-.2-5.9-3.4-11-8.5-14.2 1.8-1.9 3.2-4.1 3.2-7 0-4.4-3.4-8.1-8.1-8.1Z"
        fill="currentColor"
      />
      <path d="m19.2 7.8 9.6 9.4" fill="none" stroke="#fbf7ef" strokeWidth="3.1" strokeLinecap="round" />
      <path
        d="M23.4 21.4c5.8-.6 10.2 1.7 12 5.7-4.9-.6-8.8-2.1-12-5.7Zm.3 1.4c.3 3.3-.3 6.3-2.2 9 3.8-1.3 6.2-3.8 7.4-7.4-1.7-.8-3.4-1.4-5.2-1.6Z"
        fill="#dfeceb"
        opacity=".92"
      />
      <path d="M7.6 36.2h32.8M10.7 40.1h26.6" fill="none" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" />
    </svg>
  );
}
