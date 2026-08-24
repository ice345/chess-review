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
  sacrifice?: SacrificeEvidence;
  exclusions: string[];
}

export interface HumanMoveCandidate {
  uci: string;
  san: string;
  probability: number;
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
  model: string;
  targetElo: number;
  selfElo: number;
  opponentElo: number;
  candidates: HumanMoveCandidate[];
  candidateProbabilityMass: number;
  playedMoveProbability: number;
  expectedHumanMove?: string;
  humanWdl?: { win: number; draw: number; loss: number };
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

export interface PlayerAnalysis {
  color: PlayerColor;
  accuracy?: number;
  phaseAccuracy: Partial<Record<GamePhase, number>>;
  classificationCounts: Partial<Record<MoveClassification, number>>;
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
