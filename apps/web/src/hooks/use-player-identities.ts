"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExternalPlatform, PlatformAccount, PlayerColor, SyncedGame } from "@chess-review/shared";
import type { NormalizedGame } from "@chess-review/chess-core";
import type { ReviewRecord } from "../lib/review-library";
import { getPlatformAccount, getSyncedGame } from "../lib/platform-library";
import { platformFromGameHeaders, resolvePlayerAvatars } from "../lib/player-avatars";
import { buildReviewPlayerIdentities } from "../lib/player-identity";

export function usePlayerIdentities(record: ReviewRecord | null, game: NormalizedGame | null) {
  const [account, setAccount] = useState<PlatformAccount | null>(null);
  const [syncedGame, setSyncedGame] = useState<SyncedGame | null>(null);
  const [avatars, setAvatars] = useState<Partial<Record<PlayerColor, string>>>({});
  const headers = game?.headers ?? {};
  const provider: ExternalPlatform | undefined = record?.external?.provider
    ?? syncedGame?.external.provider
    ?? platformFromGameHeaders(headers);

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

  useEffect(() => {
    let active = true;
    if (!provider) {
      setAvatars({});
      return;
    }
    setAvatars({});
    const white = syncedGame?.white.username ?? headers.White ?? "";
    const black = syncedGame?.black.username ?? headers.Black ?? "";
    void resolvePlayerAvatars(provider, { white, black }).then((next) => {
      if (active) setAvatars(next);
    }).catch(() => {
      if (active) setAvatars({});
    });
    return () => { active = false; };
  }, [headers.Black, headers.White, provider, syncedGame?.black.username, syncedGame?.white.username]);

  return useMemo(
    () => buildReviewPlayerIdentities(headers, account, syncedGame, avatars, provider),
    [account, avatars, headers, provider, syncedGame],
  );
}
