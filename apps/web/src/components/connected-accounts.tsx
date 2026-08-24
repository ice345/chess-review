"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PlatformAccount, PlatformSyncState, SyncedGame } from "@chess-review/shared";
import { chessComProvider, lichessProvider, PlatformRequestError } from "../lib/platforms/provider";
import { retryAt, type PlatformSyncMode } from "../lib/platform-sync";
import {
  listPlatformAccounts,
  listPlatformSyncStates,
  removePlatformAccount,
  savePlatformAccount,
  savePlatformSyncState,
  saveSyncedGames,
} from "../lib/platform-library";

function providerFor(account: PlatformAccount) {
  return account.provider === "chesscom" ? chessComProvider : lichessProvider;
}

function ratingSummary(account: PlatformAccount): string {
  const order = ["rapid", "blitz", "bullet", "classical", "daily", "correspondence"];
  const ratings = Object.entries(account.ratings ?? {})
    .sort(([left], [right]) => order.indexOf(left) - order.indexOf(right))
    .slice(0, 3);
  return ratings.length === 0
    ? "Rating unavailable"
    : ratings.map(([label, rating]) => `${label[0]?.toUpperCase()}${label.slice(1)} ${rating}`).join(" · ");
}

function resumable(state: PlatformSyncState | undefined): boolean {
  return state?.status === "paused" || state?.status === "rate-limited" || state?.status === "error";
}

export function ConnectedAccounts({
  compact = false,
  onGamesUpdated,
}: {
  compact?: boolean;
  onGamesUpdated?: (games: SyncedGame[]) => void | Promise<void>;
}) {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [syncStates, setSyncStates] = useState<Record<string, PlatformSyncState>>({});
  const [username, setUsername] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lichessConfigured, setLichessConfigured] = useState<boolean | null>(null);
  const controllers = useRef(new Map<string, AbortController>());

  async function load() {
    const [storedAccounts, storedStates] = await Promise.all([listPlatformAccounts(), listPlatformSyncStates()]);
    let nextAccounts = storedAccounts;
    try {
      const configResponse = await fetch("/api/platforms/lichess/config", { cache: "no-store" });
      const config = await configResponse.json() as { configured?: boolean };
      setLichessConfigured(config.configured === true);
      const response = await fetch("/api/platforms/lichess/session", { cache: "no-store" });
      const session = await response.json() as { connected?: boolean; account?: PlatformAccount };
      if (session.connected && session.account) {
        const existing = storedAccounts.find((account) => account.id === session.account?.id);
        const account = await savePlatformAccount({
          ...session.account,
          linkedAt: existing?.linkedAt ?? session.account.linkedAt,
          ...(existing?.lastSyncAt ? { lastSyncAt: existing.lastSyncAt } : {}),
        });
        nextAccounts = [...storedAccounts.filter((item) => item.id !== account.id), account];
      }
    } catch {
      // OAuth is optional and may be unconfigured in browser-only mode.
    }
    const states = storedStates.map((state): PlatformSyncState => state.status === "syncing"
      ? { ...state, status: "paused", error: "The previous browser session ended during sync. Resume from the saved checkpoint." }
      : state);
    await Promise.all(states.filter((state, index) => state !== storedStates[index]).map(savePlatformSyncState));
    setAccounts(nextAccounts);
    setSyncStates(Object.fromEntries(states.map((state) => [state.accountId, state])));
  }

  useEffect(() => {
    void load();
    const activeControllers = controllers.current;
    return () => activeControllers.forEach((controller) => controller.abort());
  }, []);

  async function linkChessCom() {
    setWorking("chesscom");
    setNotice(null);
    try {
      const account = await chessComProvider.link(username);
      await savePlatformAccount(account);
      setUsername("");
      setNotice(`${account.username} linked as a public, unverified Chess.com profile.`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to link Chess.com.");
    } finally {
      setWorking(null);
    }
  }

  async function persistState(state: PlatformSyncState) {
    await savePlatformSyncState(state);
    setSyncStates((current) => ({ ...current, [state.accountId]: state }));
  }

  async function sync(account: PlatformAccount, requestedMode: PlatformSyncMode, resume = false) {
    const prior = syncStates[account.id];
    const mode = resume ? prior?.mode ?? requestedMode : requestedMode;
    let cursor = resume ? prior?.cursor : undefined;
    const since = resume ? prior?.since : mode === "incremental" ? account.lastSyncAt : undefined;
    let importedCount = resume ? prior?.importedCount ?? 0 : 0;
    let completedBatches = resume ? prior?.completedBatches ?? 0 : 0;
    let completedUnits = resume ? prior?.completedUnits : undefined;
    let totalUnits = resume ? prior?.totalUnits : undefined;
    let currentAccount = account;
    let newestImported: SyncedGame[] = [];
    const controller = new AbortController();
    controllers.current.set(account.id, controller);
    setWorking(account.id);
    setNotice(null);

    const stateFor = (status: PlatformSyncState["status"], extra: Partial<PlatformSyncState> = {}): PlatformSyncState => ({
      accountId: account.id,
      provider: account.provider,
      status,
      mode,
      importedCount,
      completedBatches,
      ...(cursor ? { cursor } : {}),
      ...(since ? { since } : {}),
      ...(completedUnits === undefined ? {} : { completedUnits }),
      ...(totalUnits === undefined ? {} : { totalUnits }),
      ...extra,
    });

    await persistState(stateFor("syncing"));
    try {
      while (true) {
        const result = await providerFor(currentAccount).sync({
          account: currentAccount,
          mode,
          ...(cursor ? { cursor } : {}),
          ...(since ? { since } : {}),
          limit: 100,
          signal: controller.signal,
        });
        if (controller.signal.aborted) throw new DOMException("Sync paused", "AbortError");
        const newGames = await saveSyncedGames(result.games);
        newestImported = [...newestImported, ...newGames]
          .sort((left, right) => right.playedAt.localeCompare(left.playedAt))
          .slice(0, 5);
        importedCount += newGames.length;
        completedBatches += 1;
        cursor = result.cursor;
        currentAccount = result.account;
        completedUnits = result.progress?.completed ?? completedBatches;
        totalUnits = result.progress?.total;
        await savePlatformAccount(result.account);
        if (result.done) break;
        if (!cursor) throw new Error("Provider returned an incomplete sync without a resume checkpoint.");
        await persistState(stateFor("syncing"));
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }

      const complete = stateFor("complete", { lastSyncAt: currentAccount.lastSyncAt ?? new Date().toISOString() });
      await persistState(complete);
      setNotice(`${importedCount} new game${importedCount === 1 ? "" : "s"} imported. No bulk Maia or Coach work was started.`);
      await load();
      if (newestImported.length > 0) await onGamesUpdated?.(newestImported);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        await persistState(stateFor("paused", { error: "Paused by user. Resume continues from the saved checkpoint." }));
        setNotice("Sync paused. Its checkpoint is saved in this browser.");
      } else if (error instanceof PlatformRequestError && error.status === 429) {
        const retryAfter = retryAt(error.retryAfter ?? null);
        await persistState(stateFor("rate-limited", { retryAfter, error: error.message }));
        setNotice(`${error.message} Resume after ${new Date(retryAfter).toLocaleTimeString()}.`);
      } else {
        const message = error instanceof Error ? error.message : "Sync failed.";
        await persistState(stateFor("error", { error: message }));
        setNotice(message);
      }
    } finally {
      controllers.current.delete(account.id);
      setWorking(null);
    }
  }

  function pause(account: PlatformAccount) {
    controllers.current.get(account.id)?.abort();
  }

  async function disconnect(account: PlatformAccount) {
    setWorking(account.id);
    try {
      await providerFor(account).disconnect(account);
      await removePlatformAccount(account.id);
      setNotice(`${account.username} disconnected. Imported games remain in your browser.`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to disconnect account.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <section className={`connected-accounts ${compact ? "compact" : ""}`} id="connected-accounts">
      <header>
        <div><span className="kicker">Connected games</span><h2>{compact ? "Your chess identities" : "Accounts"}</h2></div>
        <p>{compact ? "Profiles stay lightweight here; account setup and full-history tools live in Settings." : "Sync metadata stays separate from analysis. Every batch has a persistent, resumable checkpoint."}</p>
      </header>
      {!compact && <div className="account-link-grid">
        <div className="account-link-card chesscom-link" id="chesscom-link">
          <div><strong>Chess.com</strong><small>Public username · ownership unverified</small></div>
          <div><input aria-label="Chess.com username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" /><button className="secondary" disabled={working !== null || username.trim() === ""} onClick={() => void linkChessCom()}>{working === "chesscom" ? "Linking…" : "Link"}</button></div>
        </div>
        <div className="account-link-card lichess-link" id="lichess-link">
          <div><strong>Lichess</strong><small>OAuth 2 · PKCE · verified session</small></div>
          <button className="secondary" disabled={working !== null || lichessConfigured !== true} onClick={() => void lichessProvider.link()}>{lichessConfigured === false ? "Configure OAuth in .env.local" : "Connect Lichess"}</button>
        </div>
      </div>}
      {accounts.length === 0 && compact && <div className="compact-account-empty"><span>No chess identity connected.</span><Link href="/settings#connected-accounts">Connect in Settings →</Link></div>}
      {accounts.length > 0 && <div className="account-list">{accounts.map((account) => {
        const syncState = syncStates[account.id];
        const isSyncing = working === account.id && syncState?.status === "syncing";
        return <article key={account.id}>
          <span className={`platform-avatar ${account.provider}`}>
            <b>{account.username.slice(0, 2).toUpperCase()}</b>
            {account.avatarUrl && <img alt="" src={account.avatarUrl} referrerPolicy="no-referrer" />}
          </span>
          <div className="account-identity">
            <strong>{account.displayName ?? account.username}</strong>
            <small>@{account.username} · {account.provider === "chesscom" ? "Chess.com public link" : "Lichess verified OAuth"}</small>
            <small>{ratingSummary(account)}{account.lastSyncAt ? ` · synced ${new Date(account.lastSyncAt).toLocaleDateString()}` : ""}</small>
            {syncState && syncState.status !== "idle" && <span className={`sync-summary ${syncState.status}`}>
              {syncState.status.replaceAll("-", " ")} · {syncState.importedCount} new · {syncState.completedBatches ?? 0} batches
              {syncState.totalUnits !== undefined ? ` · ${syncState.completedUnits ?? 0}/${syncState.totalUnits} archives` : ""}
            </span>}
            {syncState?.status === "syncing" && <progress value={syncState.completedUnits ?? syncState.completedBatches ?? 0} max={Math.max(1, syncState.totalUnits ?? (syncState.completedBatches ?? 0) + 1)} />}
            {syncState?.error && syncState.status !== "complete" && <em>{syncState.error}</em>}
          </div>
          <div className="account-sync-actions">
            {isSyncing ? <button className="text-button" onClick={() => pause(account)}>Pause</button> : resumable(syncState) ? (
              <button className="text-button" disabled={working !== null} onClick={() => void sync(account, syncState?.mode ?? "incremental", true)}>Resume</button>
            ) : <button className="text-button" disabled={working !== null} onClick={() => void sync(account, "incremental")}>Sync newest</button>}
            {!compact && <button className="text-button" disabled={working !== null} onClick={() => void sync(account, "full-history")}>Import full history</button>}
          </div>
          {!compact && <button className="text-button disconnect" disabled={working !== null} onClick={() => void disconnect(account)}>Disconnect</button>}
        </article>;
      })}</div>}
      {compact && <Link className="manage-accounts" href="/settings#connected-accounts">Manage connections and full history →</Link>}
      {notice && <p className="account-notice" role="status">{notice}</p>}
    </section>
  );
}
