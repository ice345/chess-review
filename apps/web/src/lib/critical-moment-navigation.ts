import type { CriticalMoment } from "@chess-review/shared";

/**
 * Guided-review navigation over the canonical critical moments.
 *
 * The moments are already decided by the analysis; this module only answers
 * "where am I" and "what is the next one". It never re-derives which moves
 * matter.
 */

export interface KeyMomentPosition {
  /** 1-based position of the current ply among the key moments. */
  index: number;
  total: number;
}

/** Critical-moment plies, ascending and deduplicated. */
export function criticalMomentPlies(moments: readonly CriticalMoment[]): number[] {
  return [...new Set(moments.map((moment) => moment.ply))].sort((left, right) => left - right);
}

/** The moment the board is on, or null when the board sits between moments. */
export function keyMomentPosition(moments: readonly CriticalMoment[], currentPly: number): KeyMomentPosition | null {
  const plies = criticalMomentPlies(moments);
  const index = plies.indexOf(currentPly);
  return index === -1 ? null : { index: index + 1, total: plies.length };
}

/** The last moment before the current ply, so a visitor already on a moment steps back one. */
export function previousCriticalPly(moments: readonly CriticalMoment[], currentPly: number): number | null {
  let previous: number | null = null;
  for (const ply of criticalMomentPlies(moments)) {
    if (ply >= currentPly) break;
    previous = ply;
  }
  return previous;
}

/** The first moment after the current ply. */
export function nextCriticalPly(moments: readonly CriticalMoment[], currentPly: number): number | null {
  return criticalMomentPlies(moments).find((ply) => ply > currentPly) ?? null;
}

/** True once every key moment has been on the board at least once. */
export function allKeyMomentsVisited(moments: readonly CriticalMoment[], visited: ReadonlySet<number>): boolean {
  const plies = criticalMomentPlies(moments);
  return plies.length > 0 && plies.every((ply) => visited.has(ply));
}
