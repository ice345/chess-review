"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { Chessboard, defaultArrowOptions, type Arrow, type PieceRenderObject } from "react-chessboard";
import { legalBoardDestinations, type NormalizedPly, type ReplayedUciMove } from "@chess-review/chess-core";
import { BoardQualityBadge, WINDOWLIGHT_BOARD_APPEARANCE, qualityLabel } from "@chess-review/ui";
import type { EngineScore, MaiaPositionAnalysis, MoveAnalysisV2, UiLanguage } from "@chess-review/shared";
import type { AnalysisBranchMoveQuality, AnalysisBranchTree } from "../../lib/analysis-branch";
import type { AnalysisMode } from "../../lib/board-analysis-arrows";
import { faultArrow } from "../../lib/board-analysis-arrows";
import { boardMoveHintStyles, pieceMatchesTurn } from "../../lib/board-move-hints";
import { boardSquareDescription } from "../../lib/board-piece-assets";
import type { PracticePresentation } from "../../lib/practice-presentation";
import type { ReviewPlayerIdentity } from "../../lib/player-identity";
import type { ReviewRecord } from "../../lib/review-library";
import type { BoardDisplaySettings } from "../../hooks/use-board-display-settings";
import { PIECE_ANIMATION_MS } from "../../hooks/use-board-display-settings";
import type { BoardGeometryPreference } from "../../hooks/use-board-geometry-preference";
import type { RetroRuntime } from "../../hooks/use-retrospect";
import { BoardControls } from "./board-controls";
import { BoardFlipButton } from "./board-flip-button";
import { BoardFocusButton } from "./board-focus-button";
import { EvaluationBar } from "./evaluation-bar";
import { MoveEntry } from "./move-entry";
import { MoveTransport } from "./move-transport";
import { PlayerStrip } from "./player-strip";
import { useUiLanguage } from "../../hooks/use-ui-language";

type BoardSurfaceCopy = {
  workspaceAria: string;
  accuracy: (color: string, value: number) => string;
  toMove: (side: string) => string;
  promoteAria: string;
  queen: string;
  rook: string;
  bishop: string;
  knight: string;
  cancel: string;
  variation: (san: string) => string;
  startingPosition: string;
  qualityAccuracy: (quality: string, accuracy: string) => string;
  analyzingQuality: string;
  qualityFailed: string;
  branchPly: (index: number, total: number) => string;
  ply: (current: number, total: number) => string;
  returnToGame: string;
  temporaryVariation: string;
  saveNotebook: string;
  boardPosition: (fen: string) => string;
};

const COPY: Record<UiLanguage, BoardSurfaceCopy> = {
  en: {
    workspaceAria: "Persistent board workspace",
    accuracy: (color, value) => `${color} \u00b7 ${value} accuracy`,
    toMove: (side) => `${side} to move`,
    promoteAria: "Choose promotion piece",
    queen: "Queen",
    rook: "Rook",
    bishop: "Bishop",
    knight: "Knight",
    cancel: "Cancel",
    variation: (san) => `Analysis variation \u00b7 ${san}`,
    startingPosition: "Starting position",
    qualityAccuracy: (quality, accuracy) => `${quality} \u00b7 Accuracy ${accuracy}`,
    analyzingQuality: "Analyzing this move\u2019s objective quality\u2026",
    qualityFailed: "Move Quality analysis failed",
    branchPly: (index, total) => `${index} / ${total} branch ply`,
    ply: (current, total) => `${current} / ${total} ply`,
    returnToGame: "Return to game ",
    temporaryVariation: "Temporary variation \u00b7 not saved automatically. ",
    saveNotebook: "Save this position in Notebook \u2192",
    boardPosition: (fen) => `Board position: ${fen}`,
  },
  "zh-CN": {
    workspaceAria: "常驻棋盘工作区",
    accuracy: (color, value) => `${color === "Black" ? "黑方" : "白方"} \u00b7 准确率 ${value}`,
    toMove: (side) => `${side === "Black" ? "黑方" : side === "White" ? "白方" : side}走棋`,
    promoteAria: "选择升变棋子",
    queen: "后",
    rook: "车",
    bishop: "象",
    knight: "马",
    cancel: "取消",
    variation: (san) => `分析变化 \u00b7 ${san}`,
    startingPosition: "起始局面",
    qualityAccuracy: (quality, accuracy) => `${quality} \u00b7 准确率 ${accuracy}`,
    analyzingQuality: "正在分析这步的客观质量…",
    qualityFailed: "着法质量分析失败",
    branchPly: (index, total) => `${index} / ${total} 变化半回合`,
    ply: (current, total) => `${current} / ${total} 半回合`,
    returnToGame: "返回对局 ",
    temporaryVariation: "临时变化 \u00b7 不会自动保存。",
    saveNotebook: "将此局面保存到笔记 →",
    boardPosition: (fen) => `棋盘局面：${fen}`,
  },
};

type PromotionPiece = "q" | "r" | "b" | "n";

export interface ReviewBoardInteraction {
  pendingPromotion: { from: string; to: string } | null;
  playBoardMove: (from: string, to: string, promotion?: PromotionPiece) => boolean;
  selectedSquare: string | null;
  setSelectedSquare: (square: string | null) => void;
  legalDestinations: ReturnType<typeof legalBoardDestinations>;
  boardSquareStyles: ReturnType<typeof boardMoveHintStyles>;
  setPendingPromotion: (value: { from: string; to: string } | null) => void;
}

/**
 * Board I/O: square selection, promotion chooser state, and the shared play path
 * used by Chessboard drops and typed MoveEntry (via runtime.playMove).
 */
export function useReviewBoardInteraction({
  positionFen,
  playAnalysisMove,
  retro,
  currentPly,
  branch,
}: {
  positionFen: string;
  playAnalysisMove: (from: string, to: string, promotion?: PromotionPiece) => boolean;
  retro: RetroRuntime;
  currentPly: number;
  branch: AnalysisBranchTree | null;
}): ReviewBoardInteraction {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const legalDestinations = useMemo(
    () => (selectedSquare ? legalBoardDestinations(positionFen, selectedSquare) : []),
    [selectedSquare, positionFen],
  );
  const boardSquareStyles = useMemo(
    () => boardMoveHintStyles(selectedSquare, legalDestinations, retro.hintSquare),
    [legalDestinations, retro.hintSquare, selectedSquare],
  );

  useEffect(() => {
    setSelectedSquare(null);
    setPendingPromotion(null);
  }, [positionFen]);

  // The promotion chooser owns Escape while it is open.
  useEffect(() => {
    if (!pendingPromotion) return;
    function closeChooser(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPendingPromotion(null);
    }
    window.addEventListener("keydown", closeChooser);
    return () => window.removeEventListener("keydown", closeChooser);
  }, [pendingPromotion]);

  const playBoardMove = useCallback((from: string, to: string, promotion?: PromotionPiece) => {
    const destinations = legalBoardDestinations(positionFen, from).filter((move) => move.to === to);
    const promotionChoices = destinations.flatMap((move) => (
      move.promotion === "q" || move.promotion === "r" || move.promotion === "b" || move.promotion === "n"
        ? [move.promotion]
        : []
    ));
    if (promotionChoices.length > 0 && promotion === undefined) {
      setPendingPromotion({ from, to });
      return false;
    }
    setPendingPromotion(null);
    if (retro.evaluating || retro.status === "rejected" || retro.status === "rewinding") return false;
    const practice = retro.active && retro.locked && !branch ? retro.current : null;
    if (practice && currentPly === practice.promptPly) {
      if (!destinations.some((move) => move.to === to)) return false;
      const played = playAnalysisMove(from, to, promotion);
      if (!played) return false;
      void retro.attempt(`${from}${to}${promotion ?? ""}`);
      return true;
    }
    return playAnalysisMove(from, to, promotion);
  }, [branch, currentPly, playAnalysisMove, positionFen, retro]);

  return {
    pendingPromotion,
    playBoardMove,
    selectedSquare,
    setSelectedSquare,
    legalDestinations,
    boardSquareStyles,
    setPendingPromotion,
  };
}

export interface ReviewBoardSurfaceProps {
  /** Shared analysis play path; board owns selection/promotion/practice attempt I/O. */
  playAnalysisMove: (from: string, to: string, promotion?: PromotionPiece) => boolean;
  /** Practice-aware playMove for typed MoveEntry / runtime bridge. */
  onPlayMoveReady?: (playMove: ReviewBoardInteraction["playBoardMove"]) => void;
  /** Shell suspends keyboard shortcuts while the promotion chooser is open. */
  onPendingPromotionChange?: (pending: ReviewBoardInteraction["pendingPromotion"]) => void;
  pieces: PieceRenderObject;
  positionFen: string;
  orientation: "white" | "black";
  boardDisplay: BoardDisplaySettings;
  boardGeometry: BoardGeometryPreference;
  boardArrows: Arrow[];
  presentation: PracticePresentation;
  retro: RetroRuntime;
  analysisMode: AnalysisMode;
  displayedScore: EngineScore | null;
  humanPositionAnalysis: MaiaPositionAnalysis | null;
  orderedPlayers: { top: ReviewPlayerIdentity; bottom: ReviewPlayerIdentity };
  topAccuracy: number | undefined;
  bottomAccuracy: number | undefined;
  sideToMove: string;
  record: ReviewRecord;
  currentMove: NormalizedPly | null;
  currentAnalysis: MoveAnalysisV2 | null;
  selectedBranchMove: ReplayedUciMove | null;
  selectedBranchQuality: AnalysisBranchMoveQuality | undefined;
  branch: AnalysisBranchTree | null;
  totalPlies: number;
  currentPly: number;
  positionAnnouncement: string;
  playback: {
    isPlaying: boolean;
    pause: () => void;
    toggle: () => void;
  };
  boardControlsRef: RefObject<HTMLDetailsElement | null>;
  focusBoard: boolean;
  onToggleFocus: () => void;
  onShowShortcuts: () => void;
  onFlip: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  navigateFirst: () => void;
  navigatePrevious: () => void;
  navigateNext: () => void;
  navigateLast: () => void;
  onReturnToGame: () => void;
  notebookHref: string;
}

/**
 * Persistent review board column: owns Chessboard I/O (selection, promotion,
 * practice attempts), player strips, quality badge, and move transport. Shell composes chrome around it.
 */
export function ReviewBoardSurface({
  playAnalysisMove,
  onPlayMoveReady,
  onPendingPromotionChange,
  pieces,
  positionFen,
  orientation,
  boardDisplay,
  boardGeometry,
  boardArrows,
  presentation,
  retro,
  analysisMode,
  displayedScore,
  humanPositionAnalysis,
  orderedPlayers,
  topAccuracy,
  bottomAccuracy,
  sideToMove,
  record,
  currentMove,
  currentAnalysis,
  selectedBranchMove,
  selectedBranchQuality,
  branch,
  totalPlies,
  currentPly,
  positionAnnouncement,
  playback,
  boardControlsRef,
  focusBoard,
  onToggleFocus,
  onShowShortcuts,
  onFlip,
  soundEnabled,
  onToggleSound,
  navigateFirst,
  navigatePrevious,
  navigateNext,
  navigateLast,
  onReturnToGame,
  notebookHref,
}: ReviewBoardSurfaceProps) {
  const language = useUiLanguage();
  const copy = COPY[language];
  const interaction = useReviewBoardInteraction({
    positionFen,
    playAnalysisMove,
    retro,
    currentPly,
    branch,
  });
  const {
    pendingPromotion,
    playBoardMove,
    selectedSquare,
    setSelectedSquare,
    legalDestinations,
    boardSquareStyles,
    setPendingPromotion,
  } = interaction;

  useEffect(() => {
    onPlayMoveReady?.(playBoardMove);
  }, [onPlayMoveReady, playBoardMove]);

  useEffect(() => {
    onPendingPromotionChange?.(pendingPromotion);
  }, [onPendingPromotionChange, pendingPromotion]);

  return (
    <div className="analysis-column" data-review-surface="board">
      <section className="position-workspace paper-panel board-card" aria-label={copy.workspaceAria}>
        <div className={`board-player-header board-card-header${topAccuracy === undefined ? "" : " has-accuracy"}`}>
          <PlayerStrip player={orderedPlayers.top} />
          {topAccuracy !== undefined && (
            <span className="board-card-accuracy">{copy.accuracy(orderedPlayers.top.color === "white" ? "White" : "Black", Math.round(topAccuracy))}</span>
          )}
          <span className="board-card-turn">{copy.toMove(sideToMove)}</span>
          <div className="board-toolbar">
            <BoardControls
              menuRef={boardControlsRef}
              geometry={boardGeometry}
              onShowShortcuts={onShowShortcuts}
              soundEnabled={soundEnabled}
              onToggleSound={onToggleSound}
              focusBoard={focusBoard}
              onToggleFocus={onToggleFocus}
              moveEntry={<MoveEntry compact playMove={playBoardMove} />}
            />
            {focusBoard && <BoardFocusButton focused={focusBoard} onToggle={onToggleFocus} />}
            <BoardFlipButton onFlip={onFlip} />
          </div>
        </div>
        <div className="board-stage">
          <EvaluationBar
            mode={analysisMode}
            stockfish={displayedScore}
            maia={humanPositionAnalysis}
            orientation={orientation}
            valuesHidden={!presentation.showEvalValues}
          />
          <div className="board-wrap" ref={boardGeometry.boardRef}>
            <Chessboard options={{
              position: positionFen,
              pieces,
              allowDragging: true,
              allowDrawingArrows: !retro.locked,
              arrows: pendingPromotion
                ? []
                : retro.presentation.showFaultArrow && retro.current
                  ? [faultArrow(retro.current.faultUci)].flatMap((arrow) => arrow ? [arrow] : [])
                  : boardDisplay.boardArrows && presentation.showEngineArrows ? boardArrows : [],
              arrowOptions: { ...defaultArrowOptions, arrowWidthDenominator: 9, opacity: .76 },
              boardOrientation: orientation,
              showNotation: boardDisplay.boardCoordinates === "inside",
              animationDurationInMs: PIECE_ANIMATION_MS[boardDisplay.pieceAnimation],
              squareStyles: boardSquareStyles,
              // Name each square for assistive technology. The renderer replaces
              // the library's own square content, so it reapplies the highlight
              // styles the library would otherwise have drawn.
              // A group, not an image: the square's content holds the
              // library's draggable piece button, and role="img" would make
              // that button presentational. The group names the square; the
              // piece renderers name the piece inside it.
              squareRenderer: ({ square, children }) => (
                <div
                  style={{ width: "100%", height: "100%", ...(boardSquareStyles[square] ?? {}) }}
                  role="group"
                  aria-label={boardSquareDescription(square, language)}
                >
                  {children}
                </div>
              ),
              canDragPiece: ({ piece }) => !pendingPromotion && !retro.evaluating && retro.status !== "rejected" && retro.status !== "rewinding" && pieceMatchesTurn(piece.pieceType, positionFen),
              onPieceDrag: ({ piece, square }) => {
                if (square && pieceMatchesTurn(piece.pieceType, positionFen)) setSelectedSquare(square);
              },
              onPieceDragCancel: () => setSelectedSquare(null),
              onPieceDrop: ({ sourceSquare, targetSquare }) => {
                setSelectedSquare(null);
                if (pendingPromotion || !targetSquare) return false;
                playback.pause();
                return playBoardMove(sourceSquare, targetSquare);
              },
              onSquareClick: ({ piece, square }) => {
                if (pendingPromotion || retro.evaluating || retro.status === "rejected" || retro.status === "rewinding") return;
                if (selectedSquare) {
                  const destination = legalDestinations.find((move) => move.to === square);
                  if (destination) {
                    playback.pause();
                    playBoardMove(selectedSquare, square);
                    setSelectedSquare(null);
                    return;
                  }
                }
                if (pieceMatchesTurn(piece?.pieceType, positionFen)) {
                  setSelectedSquare(selectedSquare === square ? null : square);
                  return;
                }
                setSelectedSquare(null);
                // Candidate arrows are visual hints. A destination square is
                // not a move identity (for example f2f3 and g1f3), so exact
                // Stockfish/Maia branches are entered from candidate rows.
              },
              lightSquareStyle: WINDOWLIGHT_BOARD_APPEARANCE.lightSquareStyle,
              darkSquareStyle: WINDOWLIGHT_BOARD_APPEARANCE.darkSquareStyle,
              lightSquareNotationStyle: WINDOWLIGHT_BOARD_APPEARANCE.lightSquareNotationStyle,
              darkSquareNotationStyle: WINDOWLIGHT_BOARD_APPEARANCE.darkSquareNotationStyle,
              boardStyle: WINDOWLIGHT_BOARD_APPEARANCE.boardStyle,
            }} />
            {pendingPromotion && (
              <div className="promotion-chooser" role="dialog" aria-label={copy.promoteAria}>
                <div className="promotion-pieces">
                  {([
                    ["q", copy.queen],
                    ["r", copy.rook],
                    ["b", copy.bishop],
                    ["n", copy.knight],
                  ] as const).map(([piece, label]) => {
                    const PromotionPiece = pieces[`${positionFen.split(" ")[1] === "b" ? "b" : "w"}${piece.toUpperCase()}`];
                    return (
                      <button
                        type="button"
                        key={piece}
                        autoFocus={piece === "q"}
                        onClick={() => {
                          playback.pause();
                          playBoardMove(pendingPromotion.from, pendingPromotion.to, piece);
                        }}
                      >
                        <span className="promotion-piece" aria-hidden="true">{PromotionPiece && <PromotionPiece />}</span>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="promotion-cancel" onClick={() => setPendingPromotion(null)}>{copy.cancel}</button>
              </div>
            )}
            {!pendingPromotion && boardDisplay.boardQualityBadge && presentation.showMoveBadge && (branch && selectedBranchMove && selectedBranchQuality?.state === "complete"
              ? <BoardQualityBadge square={selectedBranchMove.uci.slice(2, 4)} orientation={orientation} classification={selectedBranchQuality.classification} language={language} />
              : currentAnalysis && !branch
                ? <BoardQualityBadge square={currentAnalysis.uci.slice(2, 4)} orientation={orientation} classification={currentAnalysis.classification} language={language} />
                : null)}
          </div>
        </div>
        <div className={`board-card-footer${bottomAccuracy === undefined ? "" : " has-accuracy"}`}>
          <PlayerStrip player={orderedPlayers.bottom} />
          {bottomAccuracy !== undefined && (
            <span className="board-card-accuracy">{copy.accuracy(orderedPlayers.bottom.color === "white" ? "White" : "Black", Math.round(bottomAccuracy))}</span>
          )}
          {record.subtitle ? <span className="board-card-meta">{record.subtitle}</span> : null}
        </div>

        <div className="move-dock">
          <div className="move-status">
            <span>
              <strong>{branch ? copy.variation(selectedBranchMove?.san ?? "root") : currentMove ? `${currentMove.moveNumber}${currentMove.color === "white" ? "." : "…"} ${currentMove.san}` : copy.startingPosition}</strong>
              <small>{branch
                ? selectedBranchQuality?.state === "complete"
                  ? copy.qualityAccuracy(qualityLabel(selectedBranchQuality.classification, language), selectedBranchQuality.accuracy.toFixed(1))
                  : selectedBranchQuality?.state === "running"
                    ? copy.analyzingQuality
                    : selectedBranchQuality?.state === "error"
                      ? copy.qualityFailed
                      : copy.branchPly(branch.selectedIndex, branch.activePath.length - 1)
                : copy.ply(currentPly, totalPlies)}</small>
            </span>
            {branch && <button type="button" className="return-to-game" onClick={onReturnToGame}>{copy.returnToGame}<kbd>Esc</kbd></button>}
          </div>
          {branch && <p className="branch-session-note">{copy.temporaryVariation}<Link href={notebookHref}>{copy.saveNotebook}</Link></p>}
          <MoveTransport
            isPlaying={playback.isPlaying}
            inVariation={branch !== null}
            playDisabled={branch !== null || totalPlies === 0 || retro.locked}
            atStart={branch ? branch.selectedIndex === 0 : currentPly === 0}
            atEnd={branch ? branch.selectedIndex === branch.activePath.length - 1 : currentPly === totalPlies}
            onFirst={navigateFirst}
            onPrevious={navigatePrevious}
            onTogglePlayback={playback.toggle}
            onNext={navigateNext}
            onLast={navigateLast}
          />
          {/* The board's squares are not focusable and carry no names, so the
              workspace states what the board holds: FEN on demand, plus a polite
              announcement after every move. Operating the board is typed-move
              entry in Board settings, the transport, and the named move/candidate buttons. */}
          <p className="sr-only">{copy.boardPosition(positionFen)}</p>
          <p className="sr-only" role="status" aria-live="polite">{positionAnnouncement}</p>
        </div>
      </section>
    </div>
  );
}
