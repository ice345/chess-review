"use client";

import Link from "next/link";
import { useTransition } from "react";
import type { UiLanguage } from "@chess-review/shared";
import { useUiLanguage } from "../hooks/use-ui-language";

type ErrorCopy = {
  heading: string;
  body: string;
  retry: string;
  openHistory: string;
};

const COPY: Record<UiLanguage, ErrorCopy> = {
  en: {
    heading: "This page could not be opened",
    body: "Try loading it again, or return to your saved games.",
    retry: "Try again",
    openHistory: "Open history",
  },
  "zh-CN": {
    heading: "这个页面打不开",
    body: "可以重新加载，或回到已保存的对局。",
    retry: "重试",
    openHistory: "打开棋库",
  },
};

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const copy = COPY[useUiLanguage()];
  const [pending, startTransition] = useTransition();
  return <main className="page-scroll utility-page"><section className="utility-empty" role="alert">
    <h1>{copy.heading}</h1><p>{copy.body}</p>
    <button type="button" className="secondary" disabled={pending} onClick={() => startTransition(() => retry())}>{copy.retry}</button>
    <Link href="/history">{copy.openHistory}</Link>
  </section></main>;
}
