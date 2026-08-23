"use client";

import { useEffect, useState } from "react";
import type { PlatformAccount, PlatformSyncState } from "@chess-review/shared";
import { chessComProvider, lichessProvider } from "../lib/platforms/provider";
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

export function ConnectedAccounts({ compact = false, onGamesUpdated }: { compact?: boolean; onGamesUpdated?: (games: import("@chess-review/shared").SyncedGame[]) => void | Promise<void> }) {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [syncStates, setSyncStates] = useState<Record<string, PlatformSyncState>>({});
  const [username, setUsername] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lichessConfigured, setLichessConfigured] = useState<boolean | null>(null);

  async function load() {
    const [storedAccounts, states] = await Promise.all([listPlatformAccounts(), listPlatformSyncStates()]);
    let nextAccounts = storedAccounts;
    try {
      const configResponse = await fetch("/api/platforms/lichess/config", { cache: "no-store" });
      const config = await configResponse.json() as { configured?: boolean };
      setLichessConfigured(config.configured === true);
      const response = await fetch("/api/platforms/lichess/session", { cache: "no-store" });
      const session = await response.json() as { connected?: boolean; account?: PlatformAccount };
      if (session.connected && session.account) {
        const existing = storedAccounts.find((account) => account.id === session.account?.id);
        const account = await savePlatformAccount({ ...session.account, linkedAt: existing?.linkedAt ?? session.account.linkedAt, ...(existing?.lastSyncAt ? { lastSyncAt: existing.lastSyncAt } : {}) });
        nextAccounts = [...storedAccounts.filter((item) => item.id !== account.id), account];
      }
    } catch {
      // OAuth is optional and may be unconfigured in browser-only mode.
    }
    setAccounts(nextAccounts);
    setSyncStates(Object.fromEntries(states.map((state) => [state.accountId, state])));
  }

  useEffect(() => { void load(); }, []);

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

  async function sync(account: PlatformAccount) {
    setWorking(account.id);
    setNotice(null);
    const syncing: PlatformSyncState = { accountId: account.id, provider: account.provider, status: "syncing", importedCount: 0 };
    setSyncStates((current) => ({ ...current, [account.id]: syncing }));
    await savePlatformSyncState(syncing);
    try {
      const result = await providerFor(account).sync({ account, ...(account.lastSyncAt ? { since: account.lastSyncAt } : {}), limit: 50 });
      const newGames = await saveSyncedGames(result.games);
      const importedCount = newGames.length;
      await savePlatformAccount(result.account);
      const complete: PlatformSyncState = { accountId: account.id, provider: account.provider, status: "complete", importedCount, lastSyncAt: result.account.lastSyncAt ?? new Date().toISOString(), ...(result.cursor ? { cursor: result.cursor } : {}) };
      await savePlatformSyncState(complete);
      setSyncStates((current) => ({ ...current, [account.id]: complete }));
      setNotice(`${importedCount} new game${importedCount === 1 ? "" : "s"} added${onGamesUpdated ? "; applying your analysis policy…" : ". Analysis was not started."}`);
      await load();
      await onGamesUpdated?.(newGames);
      if (onGamesUpdated) setNotice(`${importedCount} new game${importedCount === 1 ? "" : "s"} added. Your selected analysis policy is complete.`);
    } catch (error) {
      const failed: PlatformSyncState = { accountId: account.id, provider: account.provider, status: "error", importedCount: 0, error: error instanceof Error ? error.message : "Sync failed." };
      await savePlatformSyncState(failed);
      setSyncStates((current) => ({ ...current, [account.id]: failed }));
      setNotice(failed.error ?? "Sync failed.");
    } finally {
      setWorking(null);
    }
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
      <header><div><span className="kicker">Connected games</span><h2>Accounts</h2></div><p>Sync metadata stays separate from analysis. Imported games wait for you to choose what to review.</p></header>
      <div className="account-link-grid">
        <div className="account-link-card chesscom-link">
          <div><strong>Chess.com</strong><small>Public username · ownership unverified</small></div>
          <div><input aria-label="Chess.com username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" /><button className="secondary" disabled={working !== null || username.trim() === ""} onClick={() => void linkChessCom()}>{working === "chesscom" ? "Linking…" : "Link"}</button></div>
        </div>
        <div className="account-link-card lichess-link">
          <div><strong>Lichess</strong><small>OAuth 2 · PKCE · verified session</small></div>
          <button className="secondary" disabled={working !== null || lichessConfigured !== true} onClick={() => void lichessProvider.link()}>{lichessConfigured === false ? "Configure OAuth in .env.local" : "Connect Lichess"}</button>
        </div>
      </div>
      {accounts.length > 0 && <div className="account-list">{accounts.map((account) => {
        const syncState = syncStates[account.id];
        return <article key={account.id}>
          <span className={`platform-monogram ${account.provider}`}>{account.provider === "chesscom" ? "C" : "L"}</span>
          <div><strong>{account.displayName ?? account.username}</strong><small>{account.provider === "chesscom" ? "Chess.com · public link" : "Lichess · verified OAuth"}{account.lastSyncAt ? ` · synced ${new Date(account.lastSyncAt).toLocaleDateString()}` : ""}</small>{syncState?.status === "error" && <em>{syncState.error}</em>}</div>
          <button className="text-button" disabled={working !== null} onClick={() => void sync(account)}>{working === account.id ? "Syncing…" : "Sync games"}</button>
          <button className="text-button disconnect" disabled={working !== null} onClick={() => void disconnect(account)}>Disconnect</button>
        </article>;
      })}</div>}
      {notice && <p className="account-notice" role="status">{notice}</p>}
    </section>
  );
}
