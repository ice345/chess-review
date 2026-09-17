Status: Historical
Baseline: 2026-08-26 · snapshot `0a46eb6`
Superseded by: [FIX.md](../../FIX.md) §3, which records this comparison as historical and unverified in the current pass
Do not use as the current product contract.

# WintrChess comparison

Audit date: 2026-08-26
Open Chess Review snapshot: `0a46eb6c8da31958abcadfdd69a47583586b49f2`
Public benchmark: [WintrChess Analysis](https://wintrchess.com/analysis), [WintrChess Help](https://wintrchess.com/help), and [WintrChess privacy policy](https://wintrchess.com/privacy)

## Verification boundary

The public Analysis and Help URLs returned HTTP 200 on the audit date. The live Help contract and current indexed Analysis surface were inspected. The Analysis route exposes a client-rendered shell; repeated interactive browser loads timed out in the audit environment, so live animation, sound, exact engine latency, and authenticated Archive behavior are **NOT VERIFIED**. Claims below are limited to behavior documented by the current public pages or directly observed in Open Chess Review.

WintrChess's current Help page describes PGN upload/paste, public Chess.com and Lichess username lookup, FEN import, manual moves after import, Stockfish evaluation, Accuracy, and move classifications. Its privacy policy says analysis PGNs are sent to its service and can be retained in anonymized form; account archives are stored server-side until deletion. It also describes advertising and analytics. These are important architectural differences, not merely visual differences.

## Executive comparison

Open Chess Review has the stronger long-term product model: objective Stockfish truth, separate Maia human behavior, explicit Compare mode, structured coach facts, local browser analysis, deterministic fallbacks, position-based openings, phase Accuracy, and first-class branch study. WintrChess currently presents a simpler and more immediately legible analyze-first workflow, with fewer service states and fewer conceptual panels to understand.

Open Chess Review is not yet ready to claim overall product superiority. Its core flow is already deeper, but release blockers around repetition history and local-service security, plus deletion, accessibility, audio, promotion, export, and desktop gaps, make it less trustworthy as a public release today.

## Capability matrix

| Area | WintrChess current public contract | Open Chess Review CURRENT HEAD | Judgment |
|---|---|---|---|
| PGN | Paste/upload through the game selector | Paste, example, synced-game handoff, canonical library record | Parity; WintrChess upload affordance is more explicit |
| FEN | Single-position import | FEN import and interactive position study | Parity, but Open Chess Review cannot export a FEN-only Position PNG |
| Chess.com | Public username game search | Public profile link plus resumable history sync | Open Chess Review is deeper, but cursor stability and SSRF hardening are blockers |
| Lichess | Public username game search | OAuth PKCE identity plus history sync | Open Chess Review is stronger and more private than asking repeatedly for a username |
| Analysis start | One selector and one Analyse action | Import, persistent record, then review workspace | WintrChess is simpler; Open Chess Review gives better continuity |
| Objective engine | Stockfish evaluation | Local Stockfish WASM, MultiPV, played-move fallback search, canonical evidence | Open Chess Review exceeds, except repetition history is lost |
| Human model | Not documented | Maia-3 5M/23M/79M, Elo-conditioned policy/WDL/difficulty | Unique Open Chess Review advantage; end-to-end model performance is not fully verified |
| Compare mode | Not documented | Stockfish and Maia shown together with separate semantics | Unique advantage |
| Coach | Not documented | Structured deterministic facts, validated lines, Ollama or OpenAI-compatible prose | Unique advantage |
| Move classification | Brilliant through errors advertised | 14 canonical labels with machine-readable evidence | Open Chess Review is more explainable; labels are intentionally not promised to match |
| Accuracy | Advertised | Lichess-compatible WinPercent/move/game/phase pipeline | Open Chess Review is more transparent and better tested |
| Phases/opening | Not documented beyond analysis | Structural divider, phase Accuracy, position-based ECO and theory boundary | Unique advantage |
| Candidate lines | Engine analysis is visible | MultiPV rows, exact-UCI arrows, played-move search, branch exploration | Open Chess Review exceeds |
| Manual analysis | Moves can be added and classified on the fly | Legal click/drag branches with Stockfish/Maia candidates | Comparable; underpromotion chooser is missing |
| Timeline | Analysis board/navigation | Keyboard-addressable evaluation graph and move navigation | Open Chess Review is richer, but global arrow handling conflicts with focused controls |
| Audio | **NOT VERIFIED** from current public contract | No sound layer in audited HEAD | Parity cannot be claimed; remediation batch adds Open Chess Review audio |
| History/archive | Optional account archive, server-retained until deletion | Local IndexedDB review and synced-game library | Open Chess Review is more local-first, but lacks deletion and eviction |
| Settings | Public theme page includes board colors | Engine, Maia, coach, runtime, sync automation | Open Chess Review is deeper; privacy consequences need clearer copy |
| Mobile | **NOT VERIFIED** interactively | No horizontal overflow at 390 px; board remains usable | Layout is strong, but 17 visible controls were below 44×44 px |
| Offline | Server analysis contract | Browser Stockfish and library work without local-ai; deterministic coach fallback | Clear Open Chess Review advantage |
| Privacy | PGNs transmitted; optional retention; analytics/ads | Stockfish and IndexedDB local; Maia/Ollama local services; remote coach optional | Architectural advantage, weakened by missing deletion and weak service authentication |
| Desktop | Web product | Tauri foundation, file-open and service lifecycle only | Future advantage, not current parity |

## Where Open Chess Review already exceeds WintrChess

1. **Truth-source separation.** Stockfish objective facts, Maia human behavior, and coach prose have separate schemas and visual labels.
2. **Explainability.** Move labels carry deterministic evidence instead of a badge alone.
3. **Human find difficulty.** A move can be objectively Best and separately hard for a target-Elo human.
4. **Branch study.** MultiPV candidates become legal, inspectable branches without mutating the canonical game.
5. **Grounded pedagogy.** The coach consumes versioned facts, validates lines through chess rules, and falls back deterministically.
6. **Local-first core.** PGN parsing, Stockfish WASM, openings, review records, and analysis cache run in the browser.
7. **Structural phases.** Opening/middlegame/endgame are determined by the ported Divider behavior, not move-number buckets.
8. **Connected workflow depth.** Sync is resumable and intentionally separated from expensive engine analysis.
9. **Open architecture.** Canonical analysis lives in packages rather than React components.

## Where WintrChess is more polished or easier

1. **Single-purpose entry.** Its game selector and Analyse action require less product-model learning.
2. **Lower conceptual density.** A new user does not first need to distinguish objective, human, compare, and coach states.
3. **Explicit upload language.** Open Chess Review emphasizes paste; a clear file-upload affordance would improve parity.
4. **Account archive lifecycle.** WintrChess publicly promises archive deletion. Open Chess Review's local library has no deletion UI or cache cleanup.
5. **Settings discoverability.** Public board-color settings are straightforward. Open Chess Review settings prioritize engine/runtime controls and lack appearance controls in audited HEAD.

## Parity gaps to close first

- Preserve UCI move history when searching repetition-sensitive canonical positions.
- Add local review/synced-game deletion, full local-data reset, and cache retention controls.
- Complete sound feedback with settings, quick mute, and navigation semantics.
- Add an underpromotion chooser for click and drag moves.
- Export the exact displayed branch/FEN position.
- Make mobile navigation controls at least 44×44 CSS pixels.
- Make provider/off-device data flows visible at the decision point.
- Add graceful 429/5xx/malformed-provider states and a stable Chess.com archive cursor.
- Publish a responsive, keyboard, performance, and offline acceptance matrix.

## Product direction

Do not copy WintrChess's visual design or collapse Maia into an engine score. Keep the current Review = Analyze, Moves = Inspect, Study = Learn structure. The most valuable path is to make the existing differentiated architecture trustworthy and calm:

1. secure the local and provider boundaries;
2. preserve chess history and exact displayed-position identity;
3. complete local data control;
4. improve keyboard/touch/audio feedback;
5. measure real libraries and all Maia sizes;
6. only then broaden desktop packaging.
