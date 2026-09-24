import Link from "next/link";
import { DeskEmptyState } from "../components/desk-empty-state";

export default function NotFound() {
  return (
    <main className="page-scroll utility-page">
      <DeskEmptyState
        title="This page is not on the desk."
        actions={(
          <>
            <Link className="primary-link" href="/">Return home →</Link>
            <Link className="text-button" href="/history">Open library</Link>
          </>
        )}
      >
        Return to your saved games, or import a new one.
      </DeskEmptyState>
    </main>
  );
}
