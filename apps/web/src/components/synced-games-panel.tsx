"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { SyncedGame } from "@chess-review/shared";
import { externalGameKey } from "../lib/review-status";
import type { LibrarySnapshot } from "../lib/library-snapshot";
import { openSyncedGameRecord } from "./import-desk";

/**
 * Games that exist in a connected account but have no review record yet. Kept
 * out of `RecentReviewsPanel` because a synced game is not a review: opening one
 * is what creates the record.
 */
export function SyncedGamesPanel({
  games,
  records,
  statuses,
  limit = 6,
  onOpened,
}: {
  games: LibrarySnapshot["games"];
  records: LibrarySnapshot["records"];
  statuses?: LibrarySnapshot["statuses"] | undefined;
  limit?: number;
  onOpened?: () => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);
  const shown = games.slice(0, limit);
  if (shown.length === 0) return null;

  function completedReviewId(game: SyncedGame): string | undefined {
    const record = records.find((candidate) => candidate.external && externalGameKey(candidate.external) === externalGameKey(game.external));
    return record && statuses?.get(record.id)?.analyzed ? record.id : undefined;
  }

  async function open(game: SyncedGame) {
    if (working.current) return;
    working.current = true;
    setBusyId(game.id);
    setError(null);
    try {
      const id = await openSyncedGameRecord(game);
      onOpened?.();
      router.push(`/review/${id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open synced game.");
      working.current = false;
      setBusyId(null);
    }
  }

  return (
    <section className="synced-games-section paper-panel">
      <div className="panel-heading"><h2>Recent games</h2><span className="panel-meta">From your accounts</span></div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="synced-game-grid">
        {shown.map((game) => {
          const reviewId = completedReviewId(game);
          return (
            <article key={game.id}>
              <span className={`platform-label ${game.external.provider}`}>{game.external.provider === "chesscom" ? "Chess.com" : "Lichess"}</span>
              <strong>{game.white.username} <i>vs</i> {game.black.username}</strong>
              <small>{game.timeClass ?? "game"} · {new Date(game.playedAt).toLocaleDateString()}</small>
              {reviewId
                ? <Link href={`/review/${reviewId}`}>Open review →</Link>
                : <button type="button" className="text-button" disabled={busyId !== null} onClick={() => void open(game)}>{busyId === game.id ? "Preparing…" : "Analyze this game →"}</button>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
