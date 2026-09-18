"use client";

import Link from "next/link";
import { Icon } from "@chess-review/ui";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";

const VISIBLE_CAP = 8;

export function ReviewIndexPage() {
  const { snapshot, error, loading: refreshing, indexing, refresh } = useLibrarySnapshot();
  const records = [...(snapshot?.records ?? [])].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const visible = records.slice(0, VISIBLE_CAP);
  const loading = refreshing && !snapshot;
  const empty = !loading && !error && records.length === 0;

  return (
    <main className="page-scroll review-index">
      <section className="page-head head-instrument">

        <span className="page-kicker">Open Chess Review</span>
        <h1 className="page-display">Pick up where you left off.</h1>
        <p className="page-lede">Saved games on this machine, newest first.</p>
      </section>

      <section className="review-index-stage">
        {error && <p className="error" role="alert">{error} <button type="button" className="text-button" disabled={refreshing} onClick={() => void refresh()}>Retry loading games</button></p>}
        {loading ? (
          <p className="review-index-status" role="status">{indexing ? `Preparing saved games… ${indexing.completed} / ${indexing.total}. This one-time update keeps future visits fast.` : "Loading reviews…"}</p>
        ) : empty ? (
          <section className="review-index-empty paper-panel">
            <h2>No reviews yet</h2>
            <p>Import a game to start one, or return to the desk.</p>
            <p className="review-index-empty-links">
              <Link href="/import">Import a game →</Link>
              <Link href="/">Return home →</Link>
            </p>
          </section>
        ) : (
          <>
            <section className="review-index-list paper-panel" aria-label="Saved reviews">
              {visible.map((record) => {
                const status = snapshot?.statuses.get(record.id)?.label;
                const provider = record.external?.provider;
                const chip = provider === "chesscom"
                  ? { icon: "import" as const, label: "Chess.com" }
                  : provider === "lichess"
                    ? { icon: "import" as const, label: "Lichess" }
                    : record.kind === "fen"
                      ? { icon: "engine" as const, label: "FEN" }
                      : { icon: "review" as const, label: "PGN" };
                return (
                  <article className="review-index-row" key={record.id}>
                    <span className="review-index-chip">
                      <Icon name={chip.icon} />
                      <span>{chip.label}</span>
                    </span>
                    <span className="review-index-copy">
                      <strong>{record.title}</strong>
                      <small>{status ? `${record.subtitle} · ${status}` : record.subtitle}</small>
                    </span>
                    <time dateTime={record.updatedAt}>{new Date(record.updatedAt).toLocaleDateString()}</time>
                    <Link href={record.kind === "pgn" ? `/review/${record.id}` : `/review/${record.id}/engine`}>Open →</Link>
                  </article>
                );
              })}
            </section>
            {records.length > VISIBLE_CAP && (
              <p className="review-index-more">
                <Link href="/history">View all →</Link>
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
