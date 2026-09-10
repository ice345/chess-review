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

Full-game and optional post-sync review pools use one Stockfish worker. R5
reserves one of the application's two logical slots for interactive work:
only one background game runs at a time. Previously two whole games could
occupy both slots, forcing a foreground request to wait for a game to finish.
History orchestration can still prepare two items, but their engine searches
are serialized. Running jobs remain cooperative; two active foreground jobs
can still occupy both slots. This policy does not preempt engine searches or
change depth, MultiPV, cache keys, scores or classifications.

Maia and Coach remain optional local-service requests and do not enter this
browser Stockfish queue. Their results retain separate source semantics, and no
scheduler decision changes canonical scores, Accuracy or classifications.
