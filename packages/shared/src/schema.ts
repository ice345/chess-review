export type PlayerColor = "white" | "black";
export type GamePhase = "opening" | "middlegame" | "endgame";
export type ExternalPlatform = "chesscom" | "lichess";

export interface ExternalGameReference {
  provider: ExternalPlatform;
  externalGameId: string;
  accountId: string;
  username: string;
  url?: string;
  importedAt: string;
}

export interface SyncedGamePlayer {
  username: string;
  rating?: number;
  result?: string;
  avatarUrl?: string;
}

/** Sync metadata is intentionally separate from canonical chess analysis. */
export interface SyncedGame {
  id: string;
  external: ExternalGameReference;
  pgn: string;
  playedAt: string;
  timeClass?: string;
  timeControl?: string;
  rated?: boolean;
  white: SyncedGamePlayer;
  black: SyncedGamePlayer;
  accountColor: PlayerColor;
  analyzed: boolean;
  analysisId?: string;
  analysisAlgorithmVersion?: string;
  analysisDepth?: number;
  analyzedAt?: string;
  syncedAt: string;
}

export interface PlatformAccount {
  id: string;
  provider: ExternalPlatform;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  authMode: "public-username" | "oauth-pkce";
  verified: boolean;
  linkedAt: string;
  lastSyncAt?: string;
  ratings?: Partial<Record<string, number>>;
}

export interface PlatformSyncState {
  accountId: string;
  provider: ExternalPlatform;
  status: "idle" | "syncing" | "paused" | "rate-limited" | "complete" | "error";
  mode?: "incremental" | "full-history";
  cursor?: string;
  since?: string;
  lastSyncAt?: string;
  importedCount: number;
  completedBatches?: number;
  completedUnits?: number;
  totalUnits?: number;
  retryAfter?: string;
  error?: string;
}

export type EngineScore =
  | { kind: "cp"; cp: number }
  | { kind: "mate"; mateIn: number };

export type EngineScorePerspective = "white" | "side-to-move";

export interface EngineLine {
  rank: number;
  score: EngineScore;
  depth: number;
  nodes?: number;
  pv: string[];
}

export interface StockfishMoveAnalysis {
  fen: string;
  score: EngineScore;
  bestMove?: string;
  /** Present when the root search was restricted with the UCI searchmoves option. */
  searchMoves?: string[];
  lines: EngineLine[];
  depth: number;
  nodes?: number;
}

export interface OpeningInfo {
  eco: string;
  name: string;
  variation?: string;
  matchedPly: number;
  theoryUntilPly: number;
}

export interface GameDivision {
  /** Zero-based board index before the first middlegame move. */
  middlePly?: number;
  /** Zero-based board index before the first endgame move. */
  endPly?: number;
  totalPlies: number;
}

export type MoveClassification =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "book"
  | "interesting"
  | "forced"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "miss"
  | "missed_win"
  | "missed_mate";

/** Continuous objective quality. Special chess semantics never replace this value. */
export type MoveQuality =
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

/** Deterministic secondary semantics attached to an objective quality result. */
export type MoveAnnotation =
  | "book"
  | "forced"
  | "critical"
  | "brilliant"
  | "sacrifice"
  | "missed_win"
  | "missed_mate";

export type ObjectiveVerificationReason =
  | "special-annotation"
  | "quality-threshold-boundary"
  | "played-score-inconsistency"
  | "low-depth-evidence"
  | "unstable-candidate-order";

export interface EngineConsistencyEvidence {
  /** Absolute difference between equivalent White-POV root/result evidence. */
  winPercentDelta: number;
  centipawnDelta?: number;
  toleranceWinPercent: number;
  consistent: boolean;
}

export interface ObjectiveVerificationEvidence {
  status: "baseline" | "verified";
  depth: number;
  multiPv: number;
  reasons: ObjectiveVerificationReason[];
}

export interface SacrificeEvidence {
  sacrificedMaterial: number;
  see: number;
  compensationCp: number;
  survivesBestResponse: boolean;
  recoveredWithinPv: number;
  genuine: boolean;
}

export interface ClassificationReason {
  precedenceRule: string;
  /** V2 quality rule; absent on persisted V1 records. */
  qualityRule?: string;
  isEngineBest: boolean;
  engineRank?: number;
  centipawnLoss?: number;
  winPercentBefore: number;
  winPercentAfter: number;
  winPercentLoss: number;
  secondBestGapCp?: number;
  secondBestGapWinPercent?: number;
  legalMoveCount: number;
  isForced: boolean;
  isBook: boolean;
  isCheckmate: boolean;
  isObviousRecapture: boolean;
  isTrivialCheckEscape: boolean;
  playedMoveOutsideMultiPv: boolean;
  engineConsistency?: EngineConsistencyEvidence;
  verification?: ObjectiveVerificationEvidence;
  sacrifice?: SacrificeEvidence;
  exclusions: string[];
}

export interface HumanMoveCandidate {
  uci: string;
  san: string;
  probability: number;
  policyRank: number;
  /** Human-game WDL from the perspective of the player choosing this move. */
  wdl?: HumanWdl;
}

export type MaiaModel = "maia3-5m" | "maia3-23m" | "maia3-79m";

export interface HumanWdl {
  win: number;
  draw: number;
  loss: number;
}

/** Maia facts for one already-played move, rooted at that move's fenBefore. */
export interface MaiaMoveReview {
  kind: "move-review";
  fenBefore: string;
  playedMove: string;
  model: MaiaModel;
  targetElo: number;
  selfElo: number;
  opponentElo: number;
  candidates: HumanMoveCandidate[];
  candidateProbabilityMass: number;
  playedMoveProbability: number;
  playedMoveRank: number;
  expectedHumanMove?: string;
  /** Human-game WDL from the perspective of the player who played the move. */
  playedMoveWdl?: HumanWdl;
  modelPrediction: true;
}

/** Maia facts for the exact board position currently displayed. */
export interface MaiaPositionAnalysis {
  kind: "position-analysis";
  fen: string;
  sideToMove: PlayerColor;
  model: MaiaModel;
  targetElo: number;
  selfElo: number;
  opponentElo: number;
  candidates: HumanMoveCandidate[];
  /** Bounded union of Maia top-K and explicitly requested comparison moves. */
  evaluatedCandidates: HumanMoveCandidate[];
  candidateProbabilityMass: number;
  /** Human-game WDL from the perspective of sideToMove. */
  rootWdl: HumanWdl;
  expectedHumanMove?: string;
  modelPrediction: true;
}

export type HumanFindDifficultyLabel = "natural" | "findable" | "hard" | "very-hard" | "exceptional";

export interface HumanDifficultyAdjustment {
  factor: string;
  points: number;
}

export interface HumanFindDifficulty {
  label: HumanFindDifficultyLabel;
  score: number;
  evidence: {
    experimental: true;
    maiaProbability: number;
    probabilityBand: "common" | "plausible" | "uncommon" | "rare" | "very-rare";
    legalMoveCount: number;
    secondBestGapCp?: number;
    secondBestGapWinPercent?: number;
    isEngineBest: boolean;
    isForced: boolean;
    isForcing: boolean;
    isSacrifice: boolean;
    tacticalMotifCount: number;
    adjustments: HumanDifficultyAdjustment[];
  };
}

export interface HumanAnalysis {
  version: "human-v2";
  model: MaiaModel;
  targetElo: number;
  selfElo: number;
  opponentElo: number;
  candidates: HumanMoveCandidate[];
  candidateProbabilityMass: number;
  playedMoveProbability: number;
  playedMoveRank: number;
  expectedHumanMove?: string;
  /** Human-game WDL for the reviewed played move, from that mover's perspective. */
  playedMoveWdl?: HumanWdl;
  modelPrediction: true;
  findDifficulty: HumanFindDifficulty;
}

export type CoachProvider = "ollama" | "openai-compatible" | "deterministic";
export type CoachLanguage = "en" | "zh-CN";

export interface CoachMaterialFacts {
  white: Record<"pawn" | "knight" | "bishop" | "rook" | "queen", number>;
  black: Record<"pawn" | "knight" | "bishop" | "rook" | "queen", number>;
  /** White material minus Black material, in centipawns. */
  balanceCp: number;
}

export interface CoachCandidateFacts {
  rank: number;
  score: EngineScore;
  pv: string[];
}

export interface CoachPieceSquareFacts {
  color: PlayerColor;
  piece: "pawn" | "knight" | "bishop" | "rook" | "queen";
  square: string;
}

export interface CoachSidePositionFacts {
  inCheck: boolean;
  castled: boolean;
  pawnShieldCount: number;
  undevelopedMinorSquares: string[];
  doubledPawnFiles: string[];
  isolatedPawnFiles: string[];
  passedPawnSquares: string[];
}

export interface CoachPositionUnderstanding {
  sideToMove: PlayerColor;
  legalMoveCount: number;
  checks: string[];
  captures: string[];
  forcingCandidates: string[];
  attackedUndefendedPieces: CoachPieceSquareFacts[];
  center: {
    whiteOccupied: string[];
    blackOccupied: string[];
    contested: string[];
  };
  openFiles: string[];
  whiteSemiOpenFiles: string[];
  blackSemiOpenFiles: string[];
  white: CoachSidePositionFacts;
  black: CoachSidePositionFacts;
}

export interface CoachFutureConsequenceFacts {
  start: "after";
  moves: string[];
  opponentBestResponse?: string;
}

export interface CoachPracticalAlternativeFacts {
  uci: string;
  san: string;
  stockfishRank: number;
  score: EngineScore;
  maiaProbability: number;
  objectiveBestUci: string;
  objectiveBestMaiaProbability?: number;
  winPercentCost: number;
}

export interface CoachMoveFacts {
  factsVersion: 1;
  position: {
    fenBefore: string;
    fenAfter: string;
    phase: GamePhase;
  };
  move: {
    ply: number;
    color: PlayerColor;
    san: string;
    uci: string;
    classification: MoveClassification;
    quality?: MoveQuality;
    annotations?: MoveAnnotation[];
    accuracy: number;
  };
  objective: {
    evaluationBefore: EngineScore;
    playedMoveScore: EngineScore;
    evaluationAfter: EngineScore;
    bestMove?: string;
    candidates: CoachCandidateFacts[];
    afterCandidates: CoachCandidateFacts[];
    classificationReason: ClassificationReason;
  };
  human?: HumanAnalysis;
  boardFacts: {
    materialBefore: CoachMaterialFacts;
    materialAfter: CoachMaterialFacts;
    isCapture: boolean;
    givesCheck: boolean;
    motifs: string[];
    positionBefore: CoachPositionUnderstanding;
    positionAfter: CoachPositionUnderstanding;
    futureConsequence?: CoachFutureConsequenceFacts;
    practicalAlternative?: CoachPracticalAlternativeFacts;
  };
  opening?: OpeningInfo;
  phaseAccuracy: { white?: number; black?: number };
}

export interface CoachGameMoveFacts {
  ply: number;
  color: PlayerColor;
  san: string;
  uci: string;
  phase: GamePhase;
  classification: MoveClassification;
  quality?: MoveQuality;
  annotations?: MoveAnnotation[];
  accuracy: number;
  winPercentLoss: number;
  humanProbability?: number;
  humanDifficulty?: HumanFindDifficultyLabel;
}

export interface CoachGameFacts {
  factsVersion: 1;
  headers: Record<string, string>;
  opening?: OpeningInfo;
  division: GameDivision;
  players: { white: PlayerAnalysis; black: PlayerAnalysis };
  moves: CoachGameMoveFacts[];
  criticalMoments: CriticalMoment[];
}

export interface CoachValidatedLine {
  label: string;
  start: "before" | "after";
  moves: Array<{ uci: string; san: string }>;
  note?: string;
}

export interface CoachGrounding {
  factsVersion: 1;
  structuredFactsOnly: true;
  removedMoveMentions: string[];
  removedUnsupportedClaims: string[];
  validatedLineCount: number;
}

export interface CoachSource {
  provider: CoachProvider;
  model: string;
  language: CoachLanguage;
  promptVersion: string;
  generatedAt: string;
  fallbackReason?: string;
}

export interface CoachExplanation {
  headline: string;
  summary: string;
  whyMoveWorks?: string;
  whatWentWrong?: string;
  betterPlan?: string;
  humanPerspective?: string;
  tacticalIdea?: string;
  trainingTip?: string;
  notice?: string;
  moveIdea?: string;
  problem?: string;
  consequence?: string;
  practicalAlternative?: string;
  takeaway?: string;
  confidence: "high" | "medium" | "low";
  validatedLines: CoachValidatedLine[];
  grounding: CoachGrounding;
  source: CoachSource;
}

export interface CoachCriticalInsight {
  ply: number;
  insight: string;
}

export interface CoachTrainingRecommendation {
  title: string;
  reason: string;
  focus: string;
}

export interface GameCoachSummary {
  headline: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  criticalMoments: CoachCriticalInsight[];
  trainingRecommendations: CoachTrainingRecommendation[];
  confidence: "high" | "medium" | "low";
  grounding: CoachGrounding;
  source: CoachSource;
}

export interface GameMetadata {
  headers: Record<string, string>;
  pgn?: string;
  initialFen: string;
}

export interface MoveAnalysis {
  ply: number;
  color: PlayerColor;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  phase: GamePhase;
  /** Best root evaluation before the move, White POV. */
  evaluationBefore: EngineScore;
  /** Evaluation of the resulting position, White POV. */
  evaluationAfter: EngineScore;
  /** Root evaluation restricted to the played move when needed, White POV. */
  playedMoveScore: EngineScore;
  playedMoveOutsideMultiPv: boolean;
  classification: MoveClassification;
  classificationReason: ClassificationReason;
  stockfish: StockfishMoveAnalysis;
  accuracy: number;
  human?: HumanAnalysis;
  motifs: string[];
  coach?: CoachExplanation;
}

/** Phase 9 objective move contract. `classification` is a UI compatibility projection. */
export interface MoveAnalysisV2 extends MoveAnalysis {
  quality: MoveQuality;
  annotations: MoveAnnotation[];
  objectiveVersion: "move-quality-v2";
}

export interface PlayerAnalysis {
  color: PlayerColor;
  accuracy?: number;
  phaseAccuracy: Partial<Record<GamePhase, number>>;
  classificationCounts: Partial<Record<MoveClassification, number>>;
}

export interface PlayerAnalysisV2 extends PlayerAnalysis {
  qualityCounts: Record<MoveQuality, number>;
  annotationCounts: Partial<Record<MoveAnnotation, number>>;
}

export interface CriticalMoment {
  ply: number;
  classification: MoveClassification;
  winPercentSwing: number;
}

export interface GameAnalysisV1 {
  version: 1;
  algorithmVersion: string;
  game: GameMetadata;
  engine: {
    stockfishVersion: string;
    depth: number;
    multiPv: number;
  };
  opening?: OpeningInfo;
  division: GameDivision;
  white: PlayerAnalysis;
  black: PlayerAnalysis;
  moves: MoveAnalysis[];
  criticalMoments: CriticalMoment[];
  coachSummary?: GameCoachSummary;
  createdAt: string;
}

export interface GameAnalysisV2 {
  version: 2;
  algorithmVersion: string;
  game: GameMetadata;
  engine: {
    stockfishVersion: string;
    depth: number;
    /** Compatibility alias for classificationMultiPv. */
    multiPv: number;
    classificationMultiPv: number;
    verificationPolicyVersion: string;
    verifiedMoveCount: number;
  };
  opening?: OpeningInfo;
  division: GameDivision;
  white: PlayerAnalysisV2;
  black: PlayerAnalysisV2;
  moves: MoveAnalysisV2[];
  criticalMoments: CriticalMoment[];
  coachSummary?: GameCoachSummary;
  createdAt: string;
}

export type AnyGameAnalysis = GameAnalysisV1 | GameAnalysisV2;

export interface AnalysisCacheProjectionV1 {
  version: 1;
  cacheKey: string;
  gameFingerprint: string;
  algorithmVersion: string;
  objectiveVersion: 2;
  createdAt: string;
  engine: GameAnalysisV2["engine"];
  headers: Record<string, string>;
  opening?: OpeningInfo;
  division: GameDivision;
  white: Pick<PlayerAnalysisV2, "accuracy" | "phaseAccuracy" | "qualityCounts" | "annotationCounts">;
  black: Pick<PlayerAnalysisV2, "accuracy" | "phaseAccuracy" | "qualityCounts" | "annotationCounts">;
  moveCount: number;
  criticalMomentCount: number;
  approximateBytes: number;
  /**
   * Header-independent game identity for library joins. PGN-string fingerprints
   * break when serialization drifts between builds sharing persisted browser
   * data; the initial FEN plus the played UCI sequence identifies the same
   * chess game regardless of header normalization.
   */
  initialFen?: string;
  uciMoves?: string[];
}

export type HistoryAnalysisJobStatus = "queued" | "running" | "paused" | "cancelled" | "failed" | "completed";
export type HistoryAnalysisItemStatus = "queued" | "running" | "cached" | "completed" | "failed" | "cancelled";

export interface HistoryAnalysisScopeV1 {
  providers: ExternalPlatform[];
  accountIds: string[];
  dateFrom?: string;
  dateTo?: string;
  timeClasses: string[];
  rated: "all" | "rated" | "casual";
  freshness: "all" | "unanalyzed" | "stale";
}

export interface HistoryAnalysisJobItemV1 {
  gameId: string;
  status: HistoryAnalysisItemStatus;
  attempts: number;
  analysisId?: string;
  error?: string;
  updatedAt: string;
}

/** A synced game that can never be analyzed because its PGN fails rules parsing. */
export interface HistoryAnalysisJobExcludedItemV1 {
  gameId: string;
  reason: string;
}

/** Durable browser-owned work. Running means this tab currently owns it. */
export interface HistoryAnalysisJobV1 {
  version: 1;
  id: string;
  status: HistoryAnalysisJobStatus;
  scope: HistoryAnalysisScopeV1;
  objectiveAlgorithmVersion: string;
  depth: number;
  classificationMultiPv: number;
  items: HistoryAnalysisJobItemV1[];
  /** Structurally invalid games kept out of the queue instead of failing forever. */
  excludedItems?: HistoryAnalysisJobExcludedItemV1[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  /** Set when a later compatible job took over this job's unfinished work. */
  supersededBy?: string;
}

export type StudyWeaknessKind =
  | "opening-decisions"
  | "middlegame-decisions"
  | "endgame-decisions"
  | "missed-opportunities";

export type TrainingQueueStatus = "queued" | "in-progress" | "completed";

export interface TrainingEvidenceReference {
  gameId: string;
  ply: number;
  san: string;
  phase: GamePhase;
  classification: MoveClassification;
  winPercentLoss: number;
}

/** Versioned browser-persisted progress for one deterministic recurring weakness. */
export interface TrainingQueueItemV1 {
  version: 1;
  id: string;
  playerKey: string;
  weaknessKind: StudyWeaknessKind;
  status: TrainingQueueStatus;
  priority: number;
  evidence: TrainingEvidenceReference[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TrainingQueueProgressV2 {
  reviewedPositionCount: number;
  totalPositionCount: number;
  lastReviewedAt?: string;
  notes?: string;
}

/** V2 records progress only; it does not claim a spaced-repetition schedule. */
export interface TrainingQueueItemV2 extends Omit<TrainingQueueItemV1, "version"> {
  version: 2;
  sourceReportVersion: "advanced-study-v2";
  progress: TrainingQueueProgressV2;
}
