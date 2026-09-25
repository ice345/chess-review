"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { SyncedGame, UiLanguage } from "@chess-review/shared";
import { useUiLanguage } from "../hooks/use-ui-language";
import { externalGameKey } from "../lib/review-status";
import type { LibrarySnapshot } from "../lib/library-snapshot";
import { openSyncedGameRecord } from "./import-desk";
import { SourceChip } from "./source-chip";

type SyncedGamesCopy = {
  unableToOpen: string;
  recentGames: string;
  fromAccounts: string;
  game: string;
  openReview: string;
  preparing: string;
  analyzeThisGame: string;
};

const COPY: Record<UiLanguage, SyncedGamesCopy> = {
  en: {
    unableToOpen: "Unable to open synced game.",
    recentGames: "Recent games",
    fromAccounts: "From your accounts",
    game: "game",
    openReview: "Open review →",
    preparing: "Preparing…",
    analyzeThisGame: "Analyze this game →",
  },
  "zh-CN": {
    unableToOpen: "无法打开已同步的对局。",
    recentGames: "最近对局",
    fromAccounts: "来自你的账号",
    game: "对局",
    openReview: "打开复盘 →",
    preparing: "准备中…",
    analyzeThisGame: "分析这盘对局 →",
  },
};

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
  const copy = COPY[useUiLanguage()];
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
      setError(cause instanceof Error ? cause.message : copy.unableToOpen);
      working.current = false;
      setBusyId(null);
    }
  }

  return (
    <section className="synced-games-section paper-panel">
      <div className="panel-heading"><h2>{copy.recentGames}</h2><span className="panel-meta">{copy.fromAccounts}</span></div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="synced-game-grid">
        {shown.map((game) => {
          const reviewId = completedReviewId(game);
          return (
            <article key={game.id}>
              <SourceChip provider={game.external.provider} />
              <strong>{game.white.username} <i>vs</i> {game.black.username}</strong>

              <small>{game.timeClass ?? copy.game} · {new Date(game.playedAt).toLocaleDateString()}</small>
              {reviewId
                ? <Link href={`/review/${reviewId}`}>{copy.openReview}</Link>
                : <button type="button" className="text-button" disabled={busyId !== null} onClick={() => void open(game)}>{busyId === game.id ? copy.preparing : copy.analyzeThisGame}</button>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
