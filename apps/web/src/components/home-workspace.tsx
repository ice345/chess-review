"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { useBoardPieces } from "../hooks/use-board-pieces";
import { normalizeFen, parsePgn } from "@chess-review/chess-core";
import { useLibrarySnapshot } from "../hooks/use-library-snapshot";
import { externalGameKey } from "../lib/review-status";
import type { SyncedGame } from "@chess-review/shared";
import { AppHeader } from "./app-header";
import { EXAMPLE_PGN } from "../lib/example-game";
import { inspectPgnImport, readPgnFile, type PgnChoice } from "../lib/pgn-import";
import { ConnectedAccounts } from "./connected-accounts";
import { loadAppSettings } from "../lib/app-settings";
import { autoAnalyzeSyncedGames } from "../lib/auto-analysis";
import type { PlatformSyncMode } from "../lib/platform-sync";
import {
  buildReviewRecord,
  buildReviewRecordFromSyncedGame,
  saveReviewRecord,
  type ReviewRecordKind,
} from "../lib/review-library";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function previewImport(kind: ReviewRecordKind, input: string): { fen: string; previewable: boolean } {
  const value = input.trim();
  if (!value) return { fen: STARTING_FEN, previewable: false };
  try {
    return { fen: kind === "fen" ? normalizeFen(value) : parsePgn(value).initialFen, previewable: true };
  } catch {
    return { fen: STARTING_FEN, previewable: false };
  }
}

export function HomeWorkspace() {
  const router = useRouter();
  const pieces = useBoardPieces();
  const [kind, setKind] = useState<ReviewRecordKind>("pgn");
  const [input, setInput] = useState("");
  const { snapshot, error: libraryError, loading: libraryLoading, refresh: refreshLibrary } = useLibrarySnapshot();
  const recent = snapshot?.records.slice(0, 3) ?? [];
  const syncedGames = snapshot?.games.slice(0, 6) ?? [];
  function completedReviewId(game: SyncedGame): string | undefined {
    const record = snapshot?.records.find((record) => record.external && externalGameKey(record.external) === externalGameKey(game.external));
    return record && snapshot?.statuses.get(record.id)?.analyzed ? record.id : undefined;
  }
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [readingFile, setReadingFile] = useState(false);
  const reading = useRef(false);
  const [choices, setChoices] = useState<PgnChoice[]>([]);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const busy = status === "saving" || readingFile;

  function applyPgnChoices(next: PgnChoice[], notice: string) {
    setKind("pgn"); setChoices(next.length > 1 ? next : []);
    setInput(next.length === 1 ? next[0]!.pgn : "");
    setFileNotice(notice); setError(null);
  }

  async function chooseFile(files: FileList | File[]) {
    if (saving.current || reading.current) return;
    if (files.length !== 1) { setError("Choose one PGN file at a time."); return; }
    const file = files[0]!;
    reading.current = true; setReadingFile(true); setError(null);
    try { applyPgnChoices(await readPgnFile(file), file.name); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "This file could not be read. Try again."); }
    finally { reading.current = false; setReadingFile(false); }
  }
  const preview = useMemo(() => previewImport(kind, input), [kind, input]);
  const fen = preview.fen;
  const ready = input.trim() !== "";

  async function openReview(value = input, sourceKind = kind) {
    if (saving.current || reading.current) return;
    saving.current = true;
    setStatus("saving");
    setError(null);
    try {
      if (sourceKind === "pgn") {
        const games = inspectPgnImport(value);
        if (games.length > 1) {
          applyPgnChoices(games, "Multiple pasted games");
          saving.current = false; setStatus("idle"); return;
        }
      }
      const record = await saveReviewRecord(await buildReviewRecord(sourceKind, value), { restoreDeleted: true });
      if (record.kind === "pgn") window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
      router.push(record.kind === "pgn" ? `/review/${record.id}` : `/review/${record.id}/engine`);
    } catch (requestError) {
      saving.current = false;
      setError(requestError instanceof Error ? requestError.message : "This chess record could not be imported. Try again.");
      setStatus("idle");
    }
  }

  function loadExample() {
    setKind("pgn");
    setInput(EXAMPLE_PGN); setChoices([]); setFileNotice(null);
    setError(null);
    void openReview(EXAMPLE_PGN, "pgn");
  }

  function loadStartingPosition() {
    setKind("fen");
    setInput(STARTING_FEN);
    setError(null);
  }

  async function openSyncedGame(game: SyncedGame) {
    if (saving.current || reading.current) return;
    saving.current = true;
    setStatus("saving");
    setError(null);
    try {
      const record = await saveReviewRecord(await buildReviewRecordFromSyncedGame(game), { restoreDeleted: true });
      window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
      router.push(`/review/${record.id}`);
    } catch (requestError) {
      saving.current = false;
      setError(requestError instanceof Error ? requestError.message : "Unable to open synced game.");
      setStatus("idle");
    }
  }

  async function applySyncAnalysisPolicy(games: SyncedGame[], mode: PlatformSyncMode, complete = true) {
    if (mode === "incremental" && complete) {
      const settings = loadAppSettings();
      const selected = games.slice(0, settings.autoAnalyzeImported);
      if (selected.length > 0) await autoAnalyzeSyncedGames(selected, { depth: settings.reviewDepth, multiPv: settings.reviewMultiPv });
    }
    refreshLibrary();
  }

  return (
    <main className="page-scroll home-page">
      <AppHeader />
      <section className="home-hero">
        <div className="home-copy">
          <h1>Review a game. <em>See what mattered.</em></h1>
          <p>Paste a PGN, open a file, or try a complete example.</p>
          {recent[0] && <Link className="home-resume" href={recent[0].kind === "pgn" ? `/review/${recent[0].id}` : `/review/${recent[0].id}/engine`}>Continue last review · {recent[0].title} →</Link>}
        </div>

        <div className="home-stage">
          <form
            className={`import-card${dragging ? " drag-active" : ""}`}
            aria-busy={busy}
            onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }}
            onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); setDragging(false); void chooseFile(event.dataTransfer.files); }}
            aria-labelledby="import-title"
            onSubmit={(event) => {
              event.preventDefault();
              void openReview();
            }}
          >
            <div className="import-heading"><span className="kicker">New review</span><h2 id="import-title">Bring in a game</h2></div>
            <div className="source-tabs" role="group" aria-label="Import source">
              <button type="button" disabled={busy} aria-pressed={kind === "pgn"} className={kind === "pgn" ? "active" : ""} onClick={() => { if (kind === "pgn") return; setKind("pgn"); setInput(""); setChoices([]); setFileNotice(null); setError(null); }}>PGN</button>
              <button type="button" disabled={busy} aria-pressed={kind === "fen"} className={kind === "fen" ? "active" : ""} onClick={() => { if (kind === "fen") return; setKind("fen"); setInput(""); setChoices([]); setFileNotice(null); setError(null); }}>FEN</button>
            </div>
            {kind === "pgn" && <div className="file-import">
              <input ref={fileInput} type="file" accept=".pgn" aria-label="Choose PGN file" hidden onChange={(event) => { if (event.target.files?.length) void chooseFile(event.target.files); event.target.value = ""; }} />
              <button type="button" className="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>{readingFile ? "Reading file…" : "Open PGN file"}</button>
              <span>or drop one here · up to 1 MiB</span>
            </div>}
            {fileNotice && <p className="import-file-notice" role="status">{fileNotice}{choices.length > 1 ? ` · ${choices.length} games. Choose one to analyze.` : " · Ready to analyze."}</p>}
            {choices.length > 1 && <label className="game-choice"><span id="pgn-choice-label">Choose a game</span><select disabled={busy} aria-labelledby="pgn-choice-label" aria-describedby="pgn-choice-help" value={choices.findIndex((choice) => choice.pgn === input)} onChange={(event) => setInput(choices[Number(event.target.value)]?.pgn ?? "")}>
              <option value={-1} disabled>Select one game…</option>{choices.map((choice, index) => <option key={index} value={index}>{choice.label}</option>)}
            </select><small id="pgn-choice-help">Other games remain in your file; they are not imported automatically.</small></label>}
            <label className="import-field">
              <span>{kind === "pgn" ? "Paste a complete PGN" : "Paste an explicit FEN"}</span>
              <textarea
                value={input}
                disabled={busy}
                aria-describedby={error ? "import-error" : "import-help"}
                aria-invalid={Boolean(error)}
                onChange={(event) => { setInput(event.target.value); setChoices([]); setFileNotice(null); setError(null); }}
                placeholder={kind === "pgn" ? "Paste a complete PGN…" : "Paste a FEN…"}
                spellCheck={false}
              />
            </label>
            {error && <p id="import-error" className="error" role="alert">{error}</p>}
            <button type="submit" className="primary import-submit" disabled={!ready || busy}>
              {status === "saving" ? "Preparing review…" : kind === "pgn" ? "Analyze game →" : "Open Engine Lab →"}
            </button>
            <button type="button" className="text-action" disabled={busy} onClick={kind === "pgn" ? loadExample : loadStartingPosition}>
              {kind === "pgn" ? "Load example game" : "Use starting position"}
            </button>
            <small id="import-help" className="import-note">{kind === "pgn" ? "Example: Morphy’s 17-move Opera Game. " : "FEN opens a position study. "}Your library is saved in this browser.</small>
          </form>
          <figure className="home-board">
            <div className="home-board-frame" aria-hidden="true" inert>
              <Chessboard options={{
                position: fen,
                pieces,
                allowDragging: false,
                canDragPiece: () => false,
                allowDrawingArrows: false,
                boardOrientation: "white",
                lightSquareStyle: { backgroundColor: "#f2e5cf" },
                darkSquareStyle: { backgroundColor: "#91aeb6" },
                lightSquareNotationStyle: { color: "#6d8290" },
                darkSquareNotationStyle: { color: "#f4eadb" },
                boardStyle: { borderRadius: "5px", boxShadow: "0 20px 54px rgba(60, 74, 84, .16)" },
              }} />
            </div>
            <figcaption>{
              !ready
                ? "Starting position"
                : !preview.previewable
                  ? "Could not preview this input"
                  : kind === "fen" ? "This position" : "Opening position of the pasted game"
            }</figcaption>
          </figure>

        </div>
      </section>

      {libraryError && <p className="error" role="alert">{libraryError} <button type="button" className="text-button" disabled={libraryLoading} onClick={() => void refreshLibrary()}>Retry loading games</button></p>}
      <ConnectedAccounts compact onGamesUpdated={applySyncAnalysisPolicy} />

      {syncedGames.length > 0 && <section className="synced-games-section">
        <div><span className="kicker">From your accounts</span><h2>Recent games</h2><p>Sync imports games first. Full-history analysis runs in the background from Settings.</p></div>
        <div className="synced-game-grid">{syncedGames.map((game) => <article key={game.id}>
          <span className={`platform-label ${game.external.provider}`}>{game.external.provider === "chesscom" ? "Chess.com" : "Lichess"}</span>
          <strong>{game.white.username} <i>vs</i> {game.black.username}</strong>
          <small>{game.timeClass ?? "game"} · {new Date(game.playedAt).toLocaleDateString()}</small>
          {completedReviewId(game) ? <Link href={`/review/${completedReviewId(game)}`}>Open review →</Link> : <button type="button" className="text-button" disabled={status === "saving"} onClick={() => void openSyncedGame(game)}>Analyze this game →</button>}
        </article>)}</div>
      </section>}

      <section className="recent-section">
        <div><span className="kicker">Continue learning</span><h2>Recent reviews</h2></div>
        {libraryLoading && !snapshot ? <p role="status">Loading saved games…</p> : libraryError && !snapshot ? null : recent.length === 0 ? (
          <div className="recent-empty">Your imported games will appear here.</div>
        ) : (
          <div className="recent-grid">
            {recent.map((record) => (
              <Link href={record.kind === "pgn" ? `/review/${record.id}` : `/review/${record.id}/engine`} key={record.id}>
                <span>{record.kind.toUpperCase()}</span><strong>{record.title}</strong><small>{record.subtitle} · {snapshot?.statuses.get(record.id)?.label}</small><em>Open →</em>
              </Link>
            ))}
          </div>
        )}
        {recent.length > 0 && <Link className="view-history" href="/history">View all history →</Link>}
      </section>
    <p className="product-help-link"><Link href="/help">Help, capabilities and data privacy →</Link></p>
      </main>
  );
}
