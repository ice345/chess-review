"use client";

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { exportAnalysisJson, exportAnnotatedPgn, type GameAnalysisV2 } from "@chess-review/shared";
import { selectedBranchNode } from "../../lib/analysis-branch";
import { downloadBlob, renderDisplayedPositionCard, renderGameReviewCard, renderPositionCard, reviewFilename } from "../../lib/png-export";
import { buildShareUrl } from "../../lib/share-link";
import type { ReviewRecord } from "../../lib/review-library";
import { useReviewStore } from "../../store/review-store";
import { loadAppSettings } from "../../lib/app-settings";

type ExportCtx = {
  analysis: GameAnalysisV2 | null;
  exportBusy: boolean;
  exportError: string | null;
  setExportError: (value: string | null) => void;
  shareCopied: boolean;
  shareUrl: string | null;
  runExport: (label: string, action: () => void | Promise<void>) => Promise<void>;
  downloadText: (content: string, mimeType: string, filename: string) => void;
  exportPositionPng: () => Promise<void>;
  exportReviewPng: () => Promise<void>;
  copyShareLink: () => Promise<void>;
};

const ReviewExportContext = createContext<ExportCtx | null>(null);

function useExportCtx() {
  const ctx = useContext(ReviewExportContext);
  if (!ctx) throw new Error("Review export controls require ReviewExportProvider");
  return ctx;
}

export function ReviewExportProvider({
  record,
  children,
}: {
  record: ReviewRecord;
  children: ReactNode;
}) {
  const analysis = useReviewStore((s) => s.analysis);
  const positionFen = useReviewStore((s) => s.positionFen);
  const orientation = useReviewStore((s) => s.orientation);
  const branch = useReviewStore((s) => s.branch);
  const currentPly = useReviewStore((s) => s.currentPly);
  const game = useReviewStore((s) => s.game);
  const pieceSet = useMemo(() => loadAppSettings().pieceSet, []);

  const [exportBusy, setExportBusy] = useState(false);
  const exporting = useRef(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const shareCopiedTimer = useRef<number | null>(null);

  const currentMove = currentPly === 0 ? null : game?.plies[currentPly - 1] ?? null;
  const currentAnalysis = currentPly === 0 ? null : analysis?.moves[currentPly - 1] ?? null;
  const selectedBranchMove = branch ? selectedBranchNode(branch).move ?? null : null;

  function downloadText(content: string, mimeType: string, filename: string) {
    downloadBlob(new Blob([content], { type: `${mimeType};charset=utf-8` }), filename);
  }

  async function runExport(label: string, action: () => void | Promise<void>) {
    if (exporting.current) return;
    exporting.current = true; setExportBusy(true); setExportError(null);
    try { await action(); }
    catch (cause) { setExportError(`${label} export failed. ${cause instanceof Error ? cause.message : "Please try again."}`); }
    finally { exporting.current = false; setExportBusy(false); }
  }

  async function exportPositionPng() {
    const fen = positionFen;
    const title = branch
      ? `Analysis variation · ${selectedBranchMove?.san ?? "root"}`
      : currentMove
        ? `${currentMove.moveNumber}${currentMove.color === "white" ? "." : "…"} ${currentMove.san}`
        : "Starting position";
    if (analysis && currentAnalysis && !branch) {
      downloadBlob(await renderPositionCard(analysis, currentAnalysis, orientation, pieceSet), reviewFilename(analysis, `move-${currentAnalysis.ply}.png`));
      return;
    }
    downloadBlob(
      await renderDisplayedPositionCard({
        fen,
        orientation,
        title,
        subtitle: analysis?.opening ? `${analysis.opening.eco} · ${analysis.opening.name}` : "Displayed position",
        pieceSet,
      }),
      `${title.replaceAll(" ", "-").toLowerCase()}.png`,
    );
  }

  async function exportReviewPng() {
    if (!analysis) return;
    downloadBlob(await renderGameReviewCard(analysis), reviewFilename(analysis, "game-review.png"));
  }

  async function copyShareLink() {
    const pgn = record.originalPgn ?? record.input;
    const url = buildShareUrl(pgn, window.location.origin);
    if (!url) throw new Error("This game is too large to share by link. Use Original PGN to export instead.");
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setShareCopied(false);
      return;
    }
    setShareCopied(true);
    if (shareCopiedTimer.current !== null) window.clearTimeout(shareCopiedTimer.current);
    shareCopiedTimer.current = window.setTimeout(() => { shareCopiedTimer.current = null; setShareCopied(false); }, 3000);
  }

  const value: ExportCtx = {
    analysis,
    exportBusy,
    exportError,
    setExportError,
    shareCopied,
    shareUrl,
    runExport,
    downloadText,
    exportPositionPng,
    exportReviewPng,
    copyShareLink,
  };

  return <ReviewExportContext.Provider value={value}>{children}</ReviewExportContext.Provider>;
}

export function ReviewExportMenu({
  record,
  pathname,
  analysesHidden,
}: {
  record: ReviewRecord;
  pathname: string;
  analysesHidden: boolean;
}) {
  const {
    analysis,
    exportBusy,
    shareCopied,
    shareUrl,
    runExport,
    downloadText,
    exportPositionPng,
    exportReviewPng,
    copyShareLink,
  } = useExportCtx();

  return (
    <details key={`export-${pathname}`}><summary>Export</summary><div className="action-menu">
      {record.kind === "pgn" && <button type="button" disabled={exportBusy} onClick={() => void runExport("Original PGN", () => downloadText(record.originalPgn ?? record.input, "application/x-chess-pgn", `review-${record.id}-original.pgn`))}>Original PGN</button>}
      {record.kind === "pgn" && <button type="button" disabled={exportBusy} onClick={() => { void runExport("Copy share link", copyShareLink); }}>Copy share link</button>}
      {shareCopied && <small role="status">Share link copied to clipboard</small>}
      {shareUrl !== null && <input className="share-link-value" aria-label="Share link" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />}
      {record.kind === "pgn" && <small className="export-note">Original keeps imported comments and variations. Annotated adds analysis to the mainline. A share link opens the game in the recipient's own browser — nothing is uploaded.</small>}
      <button type="button" disabled={exportBusy || !analysis || analysesHidden} onClick={() => void runExport("Canonical JSON", () => { if (analysis) downloadText(exportAnalysisJson(analysis), "application/json", reviewFilename(analysis, "analysis.json")); })}>Canonical JSON</button>
      <button type="button" disabled={exportBusy || !analysis || analysesHidden} onClick={() => void runExport("Annotated PGN", () => { if (analysis) downloadText(exportAnnotatedPgn(analysis), "application/x-chess-pgn", reviewFilename(analysis, "annotated.pgn")); })}>Annotated PGN</button>
      <button type="button" disabled={exportBusy || analysesHidden} onClick={() => void runExport("Position PNG", exportPositionPng)}>Position PNG</button>
      <button type="button" disabled={exportBusy || !analysis || analysesHidden} onClick={() => void runExport("Review PNG", exportReviewPng)}>Review PNG</button>
      {analysesHidden
        ? <small role="status">Analysis exports are withheld while you solve this position.</small>
        : exportBusy && <small role="status">Preparing export…</small>}
    </div></details>
  );
}

export function ReviewExportErrorBanner() {
  const { exportError, setExportError } = useExportCtx();
  if (!exportError) return null;
  return (
    <div className="review-export-error" role="alert">
      <p className="error">{exportError} Open Export to retry.</p>
      <button type="button" className="text-button" onClick={() => setExportError(null)}>Dismiss export error</button>
    </div>
  );
}
