# Game phases

Implementation: `packages/analysis/src/divider.ts`. Upstream: current scalachess `Divider.scala` at research commit `ed12438`.

The input is the list of boards immediately before each played move. The first matching board starts the structural phase.

Middlegame starts when any condition holds:

- number of queens, rooks, bishops and knights is at most 10;
- White has fewer than four White pieces on rank 1, or Black has fewer than four Black pieces on rank 8;
- the scalachess 2×2-region `mixedness` score exceeds 150.

Endgame starts, after a middlegame is found, when the non-pawn/non-king piece count is at most 6.

If middlegame and endgame would start at the same board index, the middle boundary is omitted, matching upstream `Division` behavior. Boundaries are zero-based board indices; move records are one-based plies and must use `phaseForPly()`.

This is unrelated to opening theory. A game can leave known theory while remaining structurally in its opening, or transpose into a known opening position after unusual move order.

The test suite includes real legal move sequences and checks boundaries/ranges rather than fixed move numbers. Future fixtures should include the seven current scalachess Divider games plus early queen trades, closed structures and pawn endings.
