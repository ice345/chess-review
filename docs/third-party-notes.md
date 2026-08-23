# Third-party notes

`references/` contains shallow research clones and is excluded from Git and production builds.

The browser engine assets at `apps/web/public/engine/stockfish.js` and `stockfish.wasm` are the Stockfish.js 18 GPLv3 build found in `cooperbuilds/chess-game-analyzer/public/engine/`. The JavaScript banner identifies Stockfish.js, Chess.com LLC, official Stockfish contributors, and its neural net source. These assets are intentionally kept as a matched pair.

Algorithm provenance:

- WinPercent: `lichess-org/scalachess/core/src/main/scala/eval.scala`.
- Accuracy: `lichess-org/lila/modules/analyse/src/main/AccuracyPercent.scala`.
- Game division: `lichess-org/scalachess/core/src/main/scala/Divider.scala`.
- Opening data/recognition recommendation: `lichess-org/chess-openings`.
- Browser worker baseline and initial taxonomy study: `cooperbuilds/chess-game-analyzer`.
- SEE and non-trivial Brilliant/Great guards: behavior-level TypeScript adaptation of the swap-off/recomputed-attacker design studied in `dev-arcturus/positional_chess`, extended with project-owned Stockfish best-response/PV evidence; WintrChess informed the exclusion review.
- OpenAI-compatible coaching uses the official Responses API request shape with strict JSON Schema output and `store: false`; Ollama coaching uses its native chat structured-output contract. Both transports remain outside canonical analysis logic.

The product's SVG quality icons are original code in `packages/ui`; third-party classification images are not shipped.
