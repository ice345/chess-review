"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadLibrarySnapshot, type LibrarySnapshot } from "../lib/library-snapshot";
import type { LibraryIndexProgress } from "../lib/review-identity-backfill";
import { subscribeLocalData } from "../lib/browser-storage";

export function useLibrarySnapshot() {
  const [indexing, setIndexing] = useState<LibraryIndexProgress | null>(null);
  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    const id = ++request.current;
    setLoading(true);
    try {
      const next = await loadLibrarySnapshot(nextController.signal, (progress) => { if (id === request.current) setIndexing(progress); });
      if (id !== request.current) return;
      setSnapshot(next);
      setError(null);
    } catch (cause) {
      if (id === request.current) setError(cause instanceof Error ? cause.message : "Unable to load local games. Try again.");
    } finally { if (id === request.current) { setLoading(false); setIndexing(null); } }
  }, []);
  useEffect(() => {
    void refresh();
    let pending: ReturnType<typeof setTimeout> | undefined;
    const queueRefresh = () => { clearTimeout(pending); pending = setTimeout(() => void refresh(), 100); };
    const unsubscribe = subscribeLocalData(queueRefresh);
    window.addEventListener("focus", queueRefresh);
    return () => { controller.current?.abort(); request.current += 1; clearTimeout(pending); unsubscribe(); window.removeEventListener("focus", queueRefresh); };
  }, [refresh]);
  const running = [...(snapshot?.statuses.values() ?? [])].some((status) => status.kind === "running");
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void refresh(), 5_000);
    return () => clearInterval(timer);
  }, [running, refresh]);
  return { snapshot, error, loading, indexing, refresh };
}
