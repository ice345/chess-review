"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parsePgn } from "@chess-review/chess-core";
import { buildReviewRecord, saveReviewRecord } from "../../lib/review-library";
import { readSharedPgn } from "../../lib/share-link";

type ShareFailureReason = "empty" | "invalid" | "too-large" | "import-failed";

type ShareState =
  | { phase: "loading" }
  | { phase: "importing" }
  | { phase: "error"; reason: ShareFailureReason; detail?: string };

export default function SharePage() {
  const router = useRouter();
  const [state, setState] = useState<ShareState>({ phase: "loading" });
  const ran = useRef(false);

  useEffect(() => {
    // Changing only the fragment does not reload the document, so the effect
    // must re-run on `hashchange`; otherwise a second share link opened in the
    // same tab would keep showing the previous link's result.
    const readHash = (): void => {
      const result = readSharedPgn(window.location.hash);

      if (!result.ok) {
        setState({ phase: "error", reason: result.reason });
        return;
      }

      // Validate that the payload is a real game with at least one move
      try {
        parsePgn(result.pgn);
      } catch {
        setState({ phase: "error", reason: "invalid", detail: "The payload is not a valid chess game." });
        return;
      }

      setState({ phase: "importing" });

      (async () => {
        try {
          const record = await saveReviewRecord(await buildReviewRecord("pgn", result.pgn), { restoreDeleted: true });
          window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
          router.replace(`/review/${record.id}`);
        } catch (err) {
          setState({
            phase: "error",
            reason: "import-failed",
            detail: err instanceof Error ? err.message : "The game could not be imported.",
          });
        }
      })();
    };

    if (!ran.current) {
      ran.current = true;
      readHash();
    }
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [router]);

  return (
    <main className="page-scroll utility-page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "1rem", padding: "2rem" }}>
      {state.phase === "loading" && <p role="status">Reading shared game…</p>}
      {state.phase === "importing" && <p role="status">Importing shared game into your library…</p>}
      {state.phase === "error" && <ShareError reason={state.reason} {...(state.detail === undefined ? {} : { detail: state.detail })} />}
    </main>
  );
}

function ShareError({ reason, detail }: { reason: ShareFailureReason; detail?: string }) {
  return (
    <>
      {reason === "empty" && (
        <>
          <h1>Incomplete share link</h1>
          <p>This link does not contain a game. It may have been copied without the full address.</p>
        </>
      )}
      {reason === "invalid" && (
        <>
          <h1>Invalid share link</h1>
          <p>{detail ?? "The game data in this link could not be decoded. The link may be corrupted or incomplete."}</p>
        </>
      )}
      {reason === "too-large" && (
        <>
          <h1>Game too large to share by link</h1>
          <p>This game exceeds the size limit for link sharing. Ask the sender for the original PGN file instead.</p>
        </>
      )}
      {reason === "import-failed" && (
        <>
          <h1>Import failed</h1>
          <p>{detail ?? "The shared game could not be imported into your library."}</p>
        </>
      )}
      <Link href="/">← Back to home</Link>
    </>
  );
}
