"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlatformAccount, SyncedGame } from "@chess-review/shared";
import type { NormalizedGame } from "@chess-review/chess-core";
import type { ReviewRecord } from "../lib/review-library";
import { getPlatformAccount, getSyncedGame } from "../lib/platform-library";
import { buildReviewPlayerIdentities } from "../lib/player-identity";

export function usePlayerIdentities(record: ReviewRecord | null, game: NormalizedGame | null) {
  const [account, setAccount] = useState<PlatformAccount | null>(null);
  const [syncedGame, setSyncedGame] = useState<SyncedGame | null>(null);

  useEffect(() => {
    let active = true;
    const external = record?.external;
    if (!external) {
      setAccount(null);
      setSyncedGame(null);
      return;
    }
    void Promise.all([
      getPlatformAccount(external.accountId),
      getSyncedGame(`${external.provider}:${external.externalGameId}`),
    ]).then(([nextAccount, nextGame]) => {
      if (!active) return;
      setAccount(nextAccount);
      setSyncedGame(nextGame);
    }).catch(() => {
      if (!active) return;
      setAccount(null);
      setSyncedGame(null);
    });
    return () => { active = false; };
  }, [record?.external]);

  return useMemo(
    () => buildReviewPlayerIdentities(game?.headers ?? {}, account, syncedGame),
    [account, game?.headers, syncedGame],
  );
}
