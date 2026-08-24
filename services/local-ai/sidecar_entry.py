"""Frozen desktop entry point for the optional local-ai service."""

from __future__ import annotations

import multiprocessing
import os

import uvicorn

from chess_review_local_ai.main import app


def main() -> None:
    host = os.environ.get("LOCAL_AI_HOST", "127.0.0.1")
    port = int(os.environ.get("LOCAL_AI_PORT", "8000"))
    if host not in {"127.0.0.1", "::1", "localhost"}:
        raise SystemExit("The packaged local-ai sidecar only accepts a loopback host.")
    uvicorn.run(app, host=host, port=port, access_log=False)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
