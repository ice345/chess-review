import Link from "next/link";
import { BlueBishopMark } from "@chess-review/ui";

export function AppHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`app-header ${compact ? "compact" : ""}`}>
      <Link className="brand" href="/" aria-label="Open Chess Review home">
        <span className="brand-mark"><BlueBishopMark decorative /></span>
        <span><strong>Open Chess Review</strong><small>Objective · Human · Coach</small></span>
      </Link>
      <nav aria-label="Application navigation">
        <Link href="/history">History</Link>
        <Link href="/settings">Settings</Link>
      </nav>
    </header>
  );
}
