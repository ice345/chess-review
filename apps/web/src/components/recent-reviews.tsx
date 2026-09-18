"use client";

import Link from "next/link";
import type { LibrarySnapshot } from "../lib/library-snapshot";

/**
 * The saved-review rows the reference draws on the landing desk and on the
 * import desk. One component so both screens agree on what a row says.
 */
export function RecentReviewsPanel({
  records,
  statuses,
  limit = 3,
  viewAllHref,
  loading,
  empty = "Your imported games will appear here.",
}: {
  records: LibrarySnapshot["records"];
  statuses?: LibrarySnapshot["statuses"] | undefined;
  limit?: number;
  viewAllHref?: string;
  loading?: boolean;
  empty?: string;
}) {
  const shown = records.slice(0, limit);
  return (
    <section className="recent-section paper-panel">
      <div className="panel-heading">
        <h2>Recent reviews</h2>
        {viewAllHref && records.length > 0 ? <Link className="text-button" href={viewAllHref}>View all →</Link> : null}
      </div>
      {loading ? <p role="status">Loading saved games…</p> : shown.length === 0 ? (
        <div className="recent-empty">{empty}</div>
      ) : (
        <div className="recent-grid">
          {shown.map((record) => (
            <Link href={record.kind === "pgn" ? `/review/${record.id}` : `/review/${record.id}/engine`} key={record.id}>
              <span>{record.kind.toUpperCase()}</span>
              <strong>{record.title}</strong>
              <small>{record.subtitle} · {statuses?.get(record.id)?.label}</small>
              <em>Open →</em>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
