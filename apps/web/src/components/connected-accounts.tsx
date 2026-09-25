"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PlatformAccount, PlatformSyncState, SyncedGame, UiLanguage } from "@chess-review/shared";
import { ProviderMark } from "@chess-review/ui";
import { chessComProvider, lichessProvider, PlatformRequestError } from "../lib/platforms/provider";
import { retryAt, type PlatformSyncMode } from "../lib/platform-sync";
import { useUiLanguage } from "../hooks/use-ui-language";

import { loadAppSettings } from "../lib/app-settings";
import { HISTORY_ANALYSIS_CONCURRENCY, queueAutomaticHistoryAnalysis } from "../lib/history-analysis-jobs";
import {
  listPlatformAccounts,
  listPlatformSyncStates,
  removePlatformAccount,
  savePlatformAccount,
  savePlatformSyncState,
  saveSyncedGames,
} from "../lib/platform-library";

type AccountsCopy = {
  ratingUnavailable: string;
  sessionEnded: string;
  linkedChessCom: (username: string) => string;
  unableToLinkChessCom: string;
  unableToConnectLichess: string;
  incompleteSync: string;
  analysisPaused: string;
  analysisStarted: (count: number, concurrency: number) => string;
  analysisAlreadyRunning: (concurrency: number) => string;
  analysisAllCurrent: string;
  analysisQueueFailed: (message: string) => string;
  unknownError: string;
  gamesImported: (n: number) => string;
  pausedByUser: string;
  syncPausedNotice: string;
  rateLimitedResume: (message: string, time: string) => string;
  syncFailed: string;
  disconnectConfirm: (username: string) => string;
  disconnectedRemain: (username: string) => string;
  revocationNote: string;
  unableToDisconnect: string;
  optionalImport: string;
  chessComUsername: string;
  usernamePlaceholder: string;
  linking: string;
  link: string;
  connectInSettings: string;
  connectedGames: string;
  connectedAccounts: string;
  accounts: string;
  compactIntro: string;
  fullIntro: string;
  chessComUnverified: string;
  verifiedOauth: string;
  oauthPkce: string;
  notConfigured: string;
  connectLichess: string;
  connectLichessInSettings: string;
  chessComPublicLink: string;
  lichessVerifiedOauth: string;
  syncedOn: (date: string) => string;
  syncStatus: Record<PlatformSyncState["status"], string>;
  syncProgress: (status: string, imported: number, batches: number) => string;
  archives: (completed: number, total: number) => string;
  pause: string;
  resume: string;
  syncNewest: string;
  importFullHistory: string;
  disconnect: string;
  manageConnections: string;
};

const COPY: Record<UiLanguage, AccountsCopy> = {
  en: {
    ratingUnavailable: "Rating unavailable",
    sessionEnded: "The previous browser session ended during sync. Resume from the saved checkpoint.",
    linkedChessCom: (username) => `${username} linked as a public, unverified Chess.com profile.`,
    unableToLinkChessCom: "Unable to link Chess.com.",
    unableToConnectLichess: "Unable to connect Lichess.",
    incompleteSync: "Provider returned an incomplete sync without a resume checkpoint.",
    analysisPaused: " An existing analysis is paused; resume it from Practice.",
    analysisStarted: (count, concurrency) => ` Background Stockfish analysis started for ${count} game${count === 1 ? "" : "s"} (up to ${concurrency} at once); open Practice to follow progress.`,
    analysisAlreadyRunning: (concurrency) => ` Background Stockfish analysis is already running (up to ${concurrency} at once); open Practice to follow progress.`,
    analysisAllCurrent: " All imported games already have current objective analysis.",
    analysisQueueFailed: (message) => ` History was imported, but background analysis could not be queued: ${message}`,
    unknownError: "unknown error",
    gamesImported: (n) => `${n} new game${n === 1 ? "" : "s"} imported.`,
    pausedByUser: "Paused by user. Resume continues from the saved checkpoint.",
    syncPausedNotice: "Sync paused. Its checkpoint is saved in this browser.",
    rateLimitedResume: (message, time) => `${message} Resume after ${time}.`,
    syncFailed: "Sync failed.",
    disconnectConfirm: (username) => `Disconnect ${username}. Delete imported games, linked reviews and training references too? Background work will pause.`,
    disconnectedRemain: (username) => `${username} disconnected. Imported games remain in your browser.`,
    revocationNote: " Remote revocation could not be confirmed; revoke this application in Lichess account settings. See Help for the link.",
    unableToDisconnect: "Unable to disconnect account.",
    optionalImport: "Optional: import games from a platform.",
    chessComUsername: "Chess.com username",
    usernamePlaceholder: "username",
    linking: "Linking…",
    link: "Link",
    connectInSettings: "Connect in Settings",
    connectedGames: "Connected games",
    connectedAccounts: "Connected accounts",
    accounts: "Accounts",
    compactIntro: "Link Chess.com or Lichess here, then sync recent games. Full-history tools stay in Settings.",
    fullIntro: "Sync metadata stays separate from analysis. Full-history imports queue objective Stockfish work after syncing, and every batch has a persistent, resumable checkpoint.",
    chessComUnverified: "Public username · ownership unverified",
    verifiedOauth: "Verified OAuth session",
    oauthPkce: "OAuth 2 · PKCE · verified session",
    notConfigured: "Not configured on this server",
    connectLichess: "Connect Lichess",
    connectLichessInSettings: "Connect Lichess in Settings",
    chessComPublicLink: "Chess.com public link",
    lichessVerifiedOauth: "Lichess verified OAuth",
    syncedOn: (date) => ` · synced ${date}`,
    syncStatus: {
      idle: "idle",
      syncing: "syncing",
      paused: "paused",
      "rate-limited": "rate limited",
      complete: "complete",
      error: "error",
    },
    syncProgress: (status, imported, batches) => `${status} · ${imported} new · ${batches} batches`,
    archives: (completed, total) => ` · ${completed}/${total} archives`,
    pause: "Pause",
    resume: "Resume",
    syncNewest: "Sync newest",
    importFullHistory: "Import full history",
    disconnect: "Disconnect",
    manageConnections: "Manage connections and full history →",
  },
  "zh-CN": {
    ratingUnavailable: "等级分不可用",
    sessionEnded: "上次浏览器会话在同步中结束。请从已保存的检查点继续。",
    linkedChessCom: (username) => `已将 ${username} 链接为公开、未验证的 Chess.com 资料。`,
    unableToLinkChessCom: "无法链接 Chess.com。",
    unableToConnectLichess: "无法连接 Lichess。",
    incompleteSync: "平台返回了未完成的同步，且没有可继续的检查点。",
    analysisPaused: "已有分析已暂停；请到训练页继续。",
    analysisStarted: (count, concurrency) => `已为 ${count} 盘对局开始后台 Stockfish 分析（最多同时 ${concurrency} 盘）；打开训练页查看进度。`,
    analysisAlreadyRunning: (concurrency) => `后台 Stockfish 分析已在进行（最多同时 ${concurrency} 盘）；打开训练页查看进度。`,
    analysisAllCurrent: "所有导入的对局都已有当前的客观分析。",
    analysisQueueFailed: (message) => `历史已导入，但无法排队后台分析：${message}`,
    unknownError: "未知错误",
    gamesImported: (n) => `已导入 ${n} 盘新对局。`,
    pausedByUser: "已由用户暂停。继续将从已保存的检查点开始。",
    syncPausedNotice: "同步已暂停。检查点已保存在本浏览器中。",
    rateLimitedResume: (message, time) => `${message} 请在 ${time} 后继续。`,
    syncFailed: "同步失败。",
    disconnectConfirm: (username) => `断开 ${username}。同时删除已导入的对局、关联复盘和训练引用吗？后台工作将暂停。`,
    disconnectedRemain: (username) => `${username} 已断开。已导入的对局仍留在本浏览器中。`,
    revocationNote: "无法确认远程撤销；请在 Lichess 账号设置中撤销此应用。链接见帮助。",
    unableToDisconnect: "无法断开账号。",
    optionalImport: "可选：从平台导入对局。",
    chessComUsername: "Chess.com 用户名",
    usernamePlaceholder: "用户名",
    linking: "正在链接…",
    link: "链接",
    connectInSettings: "在设置中连接",
    connectedGames: "已连接的对局",
    connectedAccounts: "已连接的账号",
    accounts: "账号",
    compactIntro: "在此链接 Chess.com 或 Lichess，然后同步最近对局。完整历史工具在设置中。",
    fullIntro: "同步元数据与分析分开保存。完整历史导入会在同步后排队客观的 Stockfish 分析，每一批都有可持久、可继续的检查点。",
    chessComUnverified: "公开用户名 · 所有权未验证",
    verifiedOauth: "已验证的 OAuth 会话",
    oauthPkce: "OAuth 2 · PKCE · 已验证会话",
    notConfigured: "本服务器未配置",
    connectLichess: "连接 Lichess",
    connectLichessInSettings: "在设置中连接 Lichess",
    chessComPublicLink: "Chess.com 公开链接",
    lichessVerifiedOauth: "Lichess 已验证 OAuth",
    syncedOn: (date) => ` · 同步于 ${date}`,
    syncStatus: {
      idle: "空闲",
      syncing: "同步中",
      paused: "已暂停",
      "rate-limited": "频率限制",
      complete: "完成",
      error: "出错",
    },
    syncProgress: (status, imported, batches) => `${status} · ${imported} 盘新对局 · ${batches} 批`,
    archives: (completed, total) => ` · ${completed}/${total} 个归档`,
    pause: "暂停",
    resume: "继续",
    syncNewest: "同步最新",
    importFullHistory: "导入完整历史",
    disconnect: "断开",
    manageConnections: "管理连接与完整历史 →",
  },
};

function providerFor(account: PlatformAccount) {
  return account.provider === "chesscom" ? chessComProvider : lichessProvider;
}

function ratingSummary(account: PlatformAccount, copy: AccountsCopy): string {
  const order = ["rapid", "blitz", "bullet", "classical", "daily", "correspondence"];
  const ratings = Object.entries(account.ratings ?? {})
    .sort(([left], [right]) => order.indexOf(left) - order.indexOf(right))
    .slice(0, 3);
  return ratings.length === 0
    ? copy.ratingUnavailable
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
  onGamesUpdated?: (games: SyncedGame[], mode: PlatformSyncMode, complete?: boolean) => void | Promise<void>;
}) {
  const copy = COPY[useUiLanguage()];
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [syncStates, setSyncStates] = useState<Record<string, PlatformSyncState>>({});
  const [username, setUsername] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lichessConfigured, setLichessConfigured] = useState<boolean | null>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const activeAction = useRef<string | null>(null);

  function beginAction(key: string): boolean {
    if (activeAction.current) return false;
    activeAction.current = key;
    setWorking(key);
    return true;
  }

  function finishAction(key: string) {
    if (activeAction.current !== key) return;
    activeAction.current = null;
    setWorking(null);
  }

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
      ? { ...state, status: "paused", error: copy.sessionEnded }
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
    if (!beginAction("chesscom")) return;
    setNotice(null);
    try {
      const account = await chessComProvider.link(username);
      await savePlatformAccount(account);
      setUsername("");
      setNotice(copy.linkedChessCom(account.username));
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.unableToLinkChessCom);
    } finally {
      finishAction("chesscom");
    }
  }

  async function linkLichess() {
    if (!beginAction("lichess")) return;
    try {
      await lichessProvider.link();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.unableToConnectLichess);
      finishAction("lichess");
    }
  }

  async function persistState(state: PlatformSyncState) {
    await savePlatformSyncState(state);
    setSyncStates((current) => ({ ...current, [state.accountId]: state }));
  }

  async function sync(account: PlatformAccount, requestedMode: PlatformSyncMode, resume = false) {
    if (controllers.current.has(account.id) || !beginAction(account.id)) return;
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

    try {
      await persistState(stateFor("syncing"));
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
        if (!cursor) throw new Error(copy.incompleteSync);
        await persistState(stateFor("syncing"));
        await onGamesUpdated?.(newestImported, mode, false);
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }

      const complete = stateFor("complete", { lastSyncAt: currentAccount.lastSyncAt ?? new Date().toISOString() });
      await persistState(complete);
      // Full-history imports hand every currently unanalyzed game for this
      // account to the durable queue. The scope selects never-analyzed games
      // only, so repeat calls are no-ops when nothing is waiting. Incremental
      // Home syncs retain their explicit newest-game setting instead of
      // starting a second queue for the same imports.
      let analysisNotice = "";
      if (mode === "full-history") {
        try {
          const queued = await queueAutomaticHistoryAnalysis(account.id, loadAppSettings().reviewDepth);
          if (queued.job?.status === "paused") {
            analysisNotice = copy.analysisPaused;
          } else if (queued.queuedCount > 0) {
            analysisNotice = copy.analysisStarted(queued.queuedCount, HISTORY_ANALYSIS_CONCURRENCY);
          } else if (queued.job?.status === "running" || queued.job?.status === "queued") {
            analysisNotice = copy.analysisAlreadyRunning(HISTORY_ANALYSIS_CONCURRENCY);
          } else if (queued.reused) {
            analysisNotice = copy.analysisAllCurrent;
          }
        } catch (error) {
          analysisNotice = copy.analysisQueueFailed(error instanceof Error ? error.message : copy.unknownError);
        }
      }
      setNotice(`${copy.gamesImported(importedCount)}${analysisNotice}`);
      await load();
      if (newestImported.length > 0) await onGamesUpdated?.(newestImported, mode, true);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        await persistState(stateFor("paused", { error: copy.pausedByUser }));
        setNotice(copy.syncPausedNotice);
      } else if (error instanceof PlatformRequestError && error.status === 429) {
        const retryAfter = retryAt(error.retryAfter ?? null);
        await persistState(stateFor("rate-limited", { retryAfter, error: error.message }));
        setNotice(copy.rateLimitedResume(error.message, new Date(retryAfter).toLocaleTimeString()));
      } else {
        const message = error instanceof Error ? error.message : copy.syncFailed;
        await persistState(stateFor("error", { error: message }));
        setNotice(message);
      }
    } finally {
      controllers.current.delete(account.id);
      finishAction(account.id);
    }
  }

  useEffect(() => {
    const stop = () => { for (const controller of controllers.current.values()) controller.abort(); };
    window.addEventListener("open-chess-review-invalidated", stop);
    return () => window.removeEventListener("open-chess-review-invalidated", stop);
  }, []);

  function pause(account: PlatformAccount) {
    controllers.current.get(account.id)?.abort();
  }

  async function disconnect(account: PlatformAccount) {
    if (!beginAction(account.id)) return;
    try {
      const result = await providerFor(account).disconnect(account);
      const pendingRevocation = result?.remoteRevoked === false;
      const removeGames = window.confirm(copy.disconnectConfirm(account.username));
      const { deleteSyncedGamesForAccount } = await import("../lib/local-data");
      if (removeGames) {
        await deleteSyncedGamesForAccount(account.id, true);
        if (pendingRevocation) window.location.assign("/settings?lichess=disconnected");
        else window.location.reload();
        return;
      }
      await removePlatformAccount(account.id);
      setNotice(`${copy.disconnectedRemain(account.username)}${pendingRevocation ? copy.revocationNote : ""}`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.unableToDisconnect);
    } finally {
      finishAction(account.id);
    }
  }

  if (compact && accounts.length === 0) {
    return (
      <section className="connected-accounts compact connected-accounts-quiet scene-sheet" id="connected-accounts">
        <p>{copy.optionalImport}</p>
        <div className="account-link-inline" id="chesscom-link">
          <ProviderMark provider="chesscom" size={18} decorative />
          <span className="account-link-name">Chess.com</span>
          <input aria-label={copy.chessComUsername} value={username} onChange={(event) => setUsername(event.target.value)} placeholder={copy.usernamePlaceholder} />
          <button type="button" className="text-button" disabled={working !== null || username.trim() === ""} onClick={() => void linkChessCom()}>{working === "chesscom" ? copy.linking : copy.link}</button>
        </div>
        <div className="account-link-inline" id="lichess-link">
          <ProviderMark provider="lichess" size={18} decorative />
          <span className="account-link-name">Lichess</span>
          <Link href="/settings#lichess-link">{copy.connectInSettings}</Link>
        </div>
        {notice && <p className="account-notice" role="status">{notice}</p>}
      </section>
    );
  }

  return (
    <section className={`connected-accounts ${compact ? "compact paper-panel" : ""}`} id="connected-accounts">
      <header>
        <div><span className="kicker">{copy.connectedGames}</span><h2>{compact ? copy.connectedAccounts : copy.accounts}</h2></div>
        <p>{compact ? copy.compactIntro : copy.fullIntro}</p>
      </header>
      <div className="account-link-grid">
        <div className="account-link-card chesscom-link" id="chesscom-link">
          <div><strong><ProviderMark provider="chesscom" decorative /> Chess.com</strong><small>{copy.chessComUnverified}</small></div>
          <div><input aria-label={copy.chessComUsername} value={username} onChange={(event) => setUsername(event.target.value)} placeholder={copy.usernamePlaceholder} /><button type="button" className="secondary" disabled={working !== null || username.trim() === ""} onClick={() => void linkChessCom()}>{working === "chesscom" ? copy.linking : copy.link}</button></div>
        </div>
        <div className="account-link-card lichess-link" id="lichess-link">
          <div><strong><ProviderMark provider="lichess" decorative /> Lichess</strong><small>{compact ? copy.verifiedOauth : copy.oauthPkce}</small></div>

          <div>
            {(!compact || lichessConfigured === true) && <button type="button" className="secondary" disabled={working !== null || lichessConfigured !== true} onClick={() => void linkLichess()}>{lichessConfigured === false ? copy.notConfigured : copy.connectLichess}</button>}
            {compact && <Link href="/settings#lichess-link" aria-label={copy.connectLichessInSettings}>{copy.connectLichessInSettings}</Link>}
          </div>
        </div>
      </div>
      {accounts.length > 0 && <div className="account-list">{accounts.map((account) => {
        const syncState = syncStates[account.id];
        const isSyncing = working === account.id && syncState?.status === "syncing";
        return <article key={account.id}>
          <span className="account-face">
            <span className="platform-avatar">
              <b><ProviderMark provider={account.provider} size={24} decorative /></b>
              {account.avatarUrl && <img alt="" src={account.avatarUrl} referrerPolicy="no-referrer" />}
            </span>
            <ProviderMark provider={account.provider} size={14} decorative />
          </span>
          <div className="account-identity">
            <strong>{account.displayName ?? account.username}</strong>
            <small>@{account.username} · {account.provider === "chesscom" ? copy.chessComPublicLink : copy.lichessVerifiedOauth}</small>

            <small>{ratingSummary(account, copy)}{account.lastSyncAt ? copy.syncedOn(new Date(account.lastSyncAt).toLocaleDateString()) : ""}</small>
            {syncState && syncState.status !== "idle" && <span className={`sync-summary ${syncState.status}`}>
              {copy.syncProgress(copy.syncStatus[syncState.status], syncState.importedCount, syncState.completedBatches ?? 0)}
              {syncState.totalUnits !== undefined ? copy.archives(syncState.completedUnits ?? 0, syncState.totalUnits) : ""}
            </span>}
            {syncState?.status === "syncing" && <progress value={syncState.completedUnits ?? syncState.completedBatches ?? 0} max={Math.max(1, syncState.totalUnits ?? (syncState.completedBatches ?? 0) + 1)} />}
            {syncState?.error && syncState.status !== "complete" && <em>{syncState.error}</em>}
          </div>
          <div className="account-sync-actions">
            {isSyncing ? <button type="button" className="text-button" onClick={() => pause(account)}>{copy.pause}</button> : resumable(syncState) ? (
              <button type="button" className="text-button" disabled={working !== null} onClick={() => void sync(account, syncState?.mode ?? "incremental", true)}>{copy.resume}</button>
            ) : <button type="button" className="text-button" disabled={working !== null} onClick={() => void sync(account, "incremental")}>{copy.syncNewest}</button>}
            {!compact && <button type="button" className="text-button" disabled={working !== null} onClick={() => void sync(account, "full-history")}>{copy.importFullHistory}</button>}
          </div>
          {!compact && <button type="button" className="text-button disconnect" disabled={working !== null} onClick={() => void disconnect(account)}>{copy.disconnect}</button>}
        </article>;
      })}</div>}
      {compact && <Link className="manage-accounts" href="/settings#connected-accounts">{copy.manageConnections}</Link>}
      {notice && <p className="account-notice" role="status">{notice}</p>}
    </section>
  );
}
