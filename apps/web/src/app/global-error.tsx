"use client";

import type { UiLanguage } from "@chess-review/shared";
import { useUiLanguage } from "../hooks/use-ui-language";

type GlobalErrorCopy = {
  heading: string;
  body: string;
  retry: string;
  returnHome: string;
};

const COPY: Record<UiLanguage, GlobalErrorCopy> = {
  en: {
    heading: "Unable to open Open Chess Review",
    body: "Reload the page to try again.",
    retry: "Try again",
    returnHome: "Return home",
  },
  "zh-CN": {
    heading: "无法打开 Open Chess Review",
    body: "请重新加载页面。",
    retry: "重试",
    returnHome: "返回首页",
  },
};

/**
 * The outermost boundary: it replaces the root layout, so it renders its own
 * `<html>`. The language comes from the same hook as everywhere else -
 * `loadAppSettings` is defensive and falls back to English if storage is the thing
 * that broke, which is exactly the state this boundary has to survive.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const language = useUiLanguage();
  const copy = COPY[language];
  return <html lang={language}><body><main role="alert"><h1>{copy.heading}</h1><p>{copy.body}</p>
    <button type="button" onClick={() => retry()}>{copy.retry}</button><a href="/">{copy.returnHome}</a>
  </main></body></html>;
}
