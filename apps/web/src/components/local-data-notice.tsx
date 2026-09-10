"use client";
import { useEffect, useState } from "react";
import { INVALIDATION_EVENT, isLocalSessionInvalid, subscribeLocalData } from "../lib/browser-storage";

export function LocalDataNotice() {
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
  if (stale) return <p className="error" role="alert">Local data changed. Background work was paused. Reload before continuing. <button type="button" className="text-button" onClick={() => window.location.reload()}>Reload page</button></p>;
  return error ? <p className="error" role="alert">{error} <button type="button" className="text-button" onClick={() => setRetry((value) => value + 1)}>Retry local storage</button></p> : null;
}
