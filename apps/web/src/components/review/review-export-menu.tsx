"use client";

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { exportAnalysisJson, exportAnnotatedPgn, type GameAnalysisV2, type UiLanguage } from "@chess-review/shared";
import { selectedBranchNode } from "../../lib/analysis-branch";
import { downloadBlob, renderDisplayedPositionCard, renderGameReviewCard, renderPositionCard, reviewFilename } from "../../lib/png-export";
import { buildShareUrl } from "../../lib/share-link";
import type { ReviewRecord } from "../../lib/review-library";
import { useReviewStore } from "../../store/review-store";
import { loadAppSettings } from "../../lib/app-settings";
import { useUiLanguage } from "../../hooks/use-ui-language";

type ExportCopy = {
  exportFailed: (label: string, detail: string) => string;
  tryAgain: string;
  variationTitle: (san: string) => string;
  startingPosition: string;
  displayedPosition: string;
  tooLarge: string;
  export: string;
  originalPgn: string;
  copyShare: string;
  shareCopied: string;
  shareLinkAria: string;
  exportNote: string;
  canonicalJson: string;
  annotatedPgn: string;
  positionPng: string;
  reviewPng: string;
  withheld: string;
  preparing: string;
  openToRetry: string;
  dismiss: string;
};

const COPY: Record<UiLanguage, ExportCopy> = {
  en: {
    exportFailed: (label, detail) => `${label} export failed. ${detail}`,
    tryAgain: "Please try again.",
    variationTitle: (san) => `Analysis variation \u00b7 ${san}`,
    startingPosition: "Starting position",
    displayedPosition: "Displayed position",
    tooLarge: "This game is too large to share by link. Use Original PGN to export instead.",
    export: "Export",
    originalPgn: "Original PGN",
    copyShare: "Copy share link",
    shareCopied: "Share link copied to clipboard",
    shareLinkAria: "Share link",
    exportNote: "Original keeps imported comments and variations. Annotated adds analysis to the mainline. A share link opens the game in the recipient's own browser \u2014 nothing is uploaded.",
    canonicalJson: "Canonical JSON",
    annotatedPgn: "Annotated PGN",
    positionPng: "Position PNG",
    reviewPng: "Review PNG",
    withheld: "Analysis exports are withheld while you solve this position.",
    preparing: "Preparing export\u2026",
    openToRetry: "Open Export to retry.",
    dismiss: "Dismiss export error",
  },
  "zh-CN": {
    exportFailed: (label, detail) => `${label} 导出失败。${detail}`,
    tryAgain: "请重试。",
    variationTitle: (san) => `分析变化 · ${san}`,
    startingPosition: "起始局面",
    displayedPosition: "当前显示的局面",
    tooLarge: "这盘棋太大，无法用链接分享。请改用「原始 PGN」导出。",
    export: "导出",
    originalPgn: "原始 PGN",
    copyShare: "复制分享链接",
    shareCopied: "分享链接已复制到剪贴板",
    shareLinkAria: "分享链接",
    exportNote: "原始导出保留导入的注释和变化。带注解的导出把分析加到主变。分享链接在对方自己的浏览器中打开对局——不会上传任何内容。",
    canonicalJson: "规范 JSON",
    annotatedPgn: "带注解的 PGN",
    positionPng: "局面 PNG",
    reviewPng: "复盘 PNG",
    withheld: "解题时暂不提供分析导出。",
    preparing: "正在准备导出…",
    openToRetry: "打开「导出」以重试。",
    dismiss: "关闭导出错误",
  },
};

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
  const language = useUiLanguage();
  const copy = COPY[language];
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
    catch (cause) { setExportError(copy.exportFailed(label, cause instanceof Error ? cause.message : copy.tryAgain)); }
    finally { exporting.current = false; setExportBusy(false); }
  }

  async function exportPositionPng() {
    const fen = positionFen;
    const title = branch
      ? copy.variationTitle(selectedBranchMove?.san ?? "root")
      : currentMove
        ? `${currentMove.moveNumber}${currentMove.color === "white" ? "." : "…"} ${currentMove.san}`
        : copy.startingPosition;
    if (analysis && currentAnalysis && !branch) {
      downloadBlob(await renderPositionCard(analysis, currentAnalysis, orientation, language, pieceSet), reviewFilename(analysis, `move-${currentAnalysis.ply}.png`));
      return;
    }
    downloadBlob(
      await renderDisplayedPositionCard({
        fen,
        orientation,
        title,
        subtitle: analysis?.opening ? `${analysis.opening.eco} · ${analysis.opening.name}` : copy.displayedPosition,
        language,
        pieceSet,
      }),
      `${title.replaceAll(" ", "-").toLowerCase()}.png`,
    );
  }

  async function copyShareLink() {
    const pgn = record.originalPgn ?? record.input;
    const url = buildShareUrl(pgn, window.location.origin);
    if (!url) throw new Error(copy.tooLarge);
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

  async function exportReviewPng() {
    if (!analysis) return;
    downloadBlob(await renderGameReviewCard(analysis, language), reviewFilename(analysis, "game-review.png"));
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
  const copy = COPY[useUiLanguage()];
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
    <details key={`export-${pathname}`}><summary>{copy.export}</summary><div className="action-menu">
      {record.kind === "pgn" && <button type="button" disabled={exportBusy} onClick={() => void runExport(copy.originalPgn, () => downloadText(record.originalPgn ?? record.input, "application/x-chess-pgn", `review-${record.id}-original.pgn`))}>{copy.originalPgn}</button>}
      {record.kind === "pgn" && <button type="button" disabled={exportBusy} onClick={() => { void runExport(copy.copyShare, copyShareLink); }}>{copy.copyShare}</button>}
      {shareCopied && <small role="status">{copy.shareCopied}</small>}
      {shareUrl !== null && <input className="share-link-value" aria-label={copy.shareLinkAria} readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />}
      {record.kind === "pgn" && <small className="export-note">{copy.exportNote}</small>}
      <button type="button" disabled={exportBusy || !analysis || analysesHidden} onClick={() => void runExport(copy.canonicalJson, () => { if (analysis) downloadText(exportAnalysisJson(analysis), "application/json", reviewFilename(analysis, "analysis.json")); })}>{copy.canonicalJson}</button>
      <button type="button" disabled={exportBusy || !analysis || analysesHidden} onClick={() => void runExport(copy.annotatedPgn, () => { if (analysis) downloadText(exportAnnotatedPgn(analysis), "application/x-chess-pgn", reviewFilename(analysis, "annotated.pgn")); })}>{copy.annotatedPgn}</button>
      <button type="button" disabled={exportBusy || analysesHidden} onClick={() => void runExport(copy.positionPng, exportPositionPng)}>{copy.positionPng}</button>
      <button type="button" disabled={exportBusy || !analysis || analysesHidden} onClick={() => void runExport(copy.reviewPng, exportReviewPng)}>{copy.reviewPng}</button>
      {analysesHidden
        ? <small role="status">{copy.withheld}</small>
        : exportBusy && <small role="status">{copy.preparing}</small>}
    </div></details>
  );
}

export function ReviewExportErrorBanner() {
  const copy = COPY[useUiLanguage()];
  const { exportError, setExportError } = useExportCtx();
  if (!exportError) return null;
  return (
    <div className="review-export-error" role="alert">
      <p className="error">{exportError} {copy.openToRetry}</p>
      <button type="button" className="text-button" onClick={() => setExportError(null)}>{copy.dismiss}</button>
    </div>
  );
}
