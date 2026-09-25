"use client";

import { useEffect } from "react";
import { useUiLanguage } from "../hooks/use-ui-language";

/**
 * Keeps `<html lang>` in step with the interface language.
 *
 * The attribute decides which font fallbacks and line-breaking rules the browser
 * uses - it is what makes Chinese text pick a CJK face rather than a Latin one - and
 * it is what a screen reader announces as the page language. The server renders
 * "en"; this corrects it as soon as the stored choice is known.
 */
export function InterfaceLanguage() {
  const language = useUiLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return null;
}
