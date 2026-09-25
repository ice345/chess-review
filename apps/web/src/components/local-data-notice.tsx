"use client";
import { useEffect, useState } from "react";
import type { UiLanguage } from "@chess-review/shared";
import { INVALIDATION_EVENT, isLocalSessionInvalid, subscribeLocalData } from "../lib/browser-storage";
import { useUiLanguage } from "../hooks/use-ui-language";

type NoticeCopy = {
  stale: string;
  reload: string;
  retry: string;
  loadingTraining: string;
};

const COPY: Record<UiLanguage, NoticeCopy> = {
  en: {
    stale: "Local data changed. Background work was paused. Reload before continuing.",
    reload: "Reload page",
    retry: "Retry local storage",
    loadingTraining: "Loading training…",
  },
  "zh-CN": {
    stale: "本地数据已变更。后台工作已暂停。请先重新加载再继续。",
    reload: "重新加载页面",
    retry: "重试本地存储",
    loadingTraining: "正在加载训练…",
  },
};

export function LocalDataNotice() {
  const copy = COPY[useUiLanguage()];
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const invalidate = () => setStale(true);
    if (isLocalSessionInvalid()) invalidate();
    window.addEventListener(INVALIDATION_EVENT, invalidate);
    const recover = () => { void import("../lib/library-backup").then(({ applyPendingBackupSettings }) => applyPendingBackupSettings()).then((changed) => {
      if (!active) return;
      setError(null);
      if (changed) window.location.reload();
    }).catch((cause) => {
      if (!active) return;
      if (isLocalSessionInvalid()) invalidate();
      // Page-specific loaders already report ordinary database errors. Keep a
      // global recovery path for upgrades and a committed restore with pending
      // preferences, including pages with no library loader.
      else if (cause instanceof Error && /preferences are still pending|Close other Open Chess Review tabs/.test(cause.message)) setError(cause.message);
    }); };
    const unsubscribe = subscribeLocalData(recover);
    recover();
    return () => { active = false; unsubscribe(); window.removeEventListener(INVALIDATION_EVENT, invalidate); };
  }, [retry]);
  if (stale) return <p className="error" role="alert">{copy.stale} <button type="button" className="text-button" onClick={() => window.location.reload()}>{copy.reload}</button></p>;
  return error ? <p className="error" role="alert">{error} <button type="button" className="text-button" onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button></p> : null;
}

export function TrainingRouteLoading() {
  const copy = COPY[useUiLanguage()];
  return <p role="status">{copy.loadingTraining}</p>;
}
