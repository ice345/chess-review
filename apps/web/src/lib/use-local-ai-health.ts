"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getLocalAiHealth, type LocalAiHealth } from "./local-ai";

export type LocalAiConnectionState = "checking" | "online" | "offline";

export interface LocalAiHealthRuntime {
  state: LocalAiConnectionState;
  health: LocalAiHealth | null;
  refresh: (signal?: AbortSignal) => Promise<LocalAiHealth | null>;
}

/**
 * Keeps optional native capabilities in sync with reality. A browser cannot
 * launch the Python process, but it can reconnect as soon as the managed
 * development launcher (or a separately run service) becomes available.
 */
export function useLocalAiHealth(pollIntervalMs = 5_000) {
  const [state, setState] = useState<LocalAiConnectionState>("checking");
  const [health, setHealth] = useState<LocalAiHealth | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getLocalAiHealth(signal);
      setHealth(result);
      setState("online");
      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      setHealth(null);
      setState("offline");
      return null;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = window.setInterval(() => void refresh(), pollIntervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollIntervalMs, refresh]);

  // Keep the runtime identity stable so consumers can share this poller
  // without retriggering their request callbacks on every health update.
  return useMemo<LocalAiHealthRuntime>(() => ({ state, health, refresh }), [health, refresh, state]);
}
