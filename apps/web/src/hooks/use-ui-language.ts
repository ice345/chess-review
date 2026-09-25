"use client";

import { useSyncExternalStore } from "react";
import type { UiLanguage } from "@chess-review/shared";
import { APP_SETTINGS_EVENT, loadAppSettings } from "../lib/app-settings";

/** What the prerendered HTML says. The stored choice is read after hydration. */
const PRERENDERED_LANGUAGE: UiLanguage = "en";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(APP_SETTINGS_EVENT, onStoreChange);
  return () => window.removeEventListener(APP_SETTINGS_EVENT, onStoreChange);
}

function getSnapshot(): UiLanguage {
  return loadAppSettings().uiLanguage;
}

function getServerSnapshot(): UiLanguage {
  return PRERENDERED_LANGUAGE;
}

/**
 * The language the interface is written in.
 *
 * Components keep their own `COPY: Record<UiLanguage, …>` table and index it with
 * this value, so a screen's wording lives next to the screen that renders it - the
 * pattern the coach panel already uses. This hook replaced reading the selector:
 * before it, only `coach-panel.tsx` consumed `uiLanguage`, so choosing 简体中文
 * changed that one panel and nothing else.
 *
 * `useSyncExternalStore` rather than a `useState`/`useEffect` pair: the server ships
 * English HTML, and `getServerSnapshot` keeps hydration matching it until the stored
 * choice is read on the client. A `useState(read)` first render would disagree with
 * the server and log a hydration error on every Chinese session.
 *
 * `getSnapshot` returns a string, so React's `Object.is` comparison stays stable
 * between settings changes without a memo.
 */
export function useUiLanguage(): UiLanguage {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
