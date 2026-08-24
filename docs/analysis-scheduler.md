# Browser analysis scheduler

Phase 5.1 uses one shared browser-side `AnalysisScheduler` with capacity two.
It controls logical Stockfish jobs in this order:

1. current canonical position;
2. interactive analysis variation;
3. background full-game review.

Queued jobs are stable within a priority and can be removed with an
`AbortSignal`. Running engine searches receive the same signal, so changing the
displayed FEN, leaving the workspace or cancelling a review terminates stale
work reliably.

Full-game and optional post-sync review pools use one Stockfish worker. This
leaves one scheduler slot available to an interactive request and bounds the
combined normal workload at two active browser workers. A running background
game is cooperative rather than forcibly preempted; the reserved second slot is
the responsiveness policy. If both interactive slots are occupied, queued
current-position work is selected before a variation and before another game.

Maia and Coach remain optional local-service requests and do not enter this
browser Stockfish queue. Their results retain separate source semantics, and no
scheduler decision changes canonical scores, Accuracy or classifications.
