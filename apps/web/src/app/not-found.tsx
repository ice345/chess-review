"use client";

import Link from "next/link";
import type { UiLanguage } from "@chess-review/shared";
import { DeskEmptyState } from "../components/desk-empty-state";
import { useUiLanguage } from "../hooks/use-ui-language";

type NotFoundCopy = {
  title: string;
  body: string;
  returnHome: string;
  openLibrary: string;
};

const COPY: Record<UiLanguage, NotFoundCopy> = {
  en: {
    title: "This page is not on the desk.",
    body: "Return to your saved games, or import a new one.",
    returnHome: "Return home →",
    openLibrary: "Open library",
  },
  "zh-CN": {
    title: "这张桌子上没有这个页面。",
    body: "回到已保存的对局，或导入新的对局。",
    returnHome: "返回首页 →",
    openLibrary: "打开棋库",
  },
};

export default function NotFound() {
  const copy = COPY[useUiLanguage()];
  return (
    <main className="page-scroll utility-page">
      <DeskEmptyState
        title={copy.title}
        actions={(
          <>
            <Link className="primary-link" href="/">{copy.returnHome}</Link>
            <Link className="text-button" href="/history">{copy.openLibrary}</Link>
          </>
        )}
      >
        {copy.body}
      </DeskEmptyState>
    </main>
  );
}
