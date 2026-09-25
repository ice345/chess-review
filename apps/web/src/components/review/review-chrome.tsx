"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { UiLanguage } from "@chess-review/shared";
import { BrandMark } from "@chess-review/ui";
import { ReviewExportMenu } from "./review-export-menu";
import type { ReviewRecord } from "../../lib/review-library";
import type { RetroRuntime } from "../../hooks/use-retrospect";
import { useUiLanguage } from "../../hooks/use-ui-language";

type ChromeCopy = {
  homeLabel: string;
  notFound: string;
  unableToOpen: string;
  preparing: string;
  missingRecord: string;
  loadingCache: string;
  retryOpen: string;
  returnHome: string;
  sectionsLabel: string;
  generating: string;
  more: string;
  practiceKicker: (current: number, total: number) => string;
  practiceTitle: string;
  practiceLede: string;
  reviewKicker: (state: string) => string;
  loadingReview: string;
};

const COPY: Record<UiLanguage, ChromeCopy> = {
  en: {
    homeLabel: "Open Chess Review home",
    notFound: "Review not found",
    unableToOpen: "Unable to open review",
    preparing: "Preparing workspace",
    missingRecord: "This browser has no record for that review ID.",
    loadingCache: "Loading the persisted game and analysis cache…",
    retryOpen: "Retry opening review",
    returnHome: "Return home →",
    sectionsLabel: "Review sections",
    generating: "Generating…",
    more: "More",
    practiceKicker: (current, total) => `Practice — Position ${current} of ${total}`,
    practiceTitle: "Practice this position",
    practiceLede: "Take your time. Look closely. Find the best move.",
    reviewKicker: (state) => `Review — ${state}`,
    loadingReview: "Loading review…",
  },
  "zh-CN": {
    homeLabel: "Open Chess Review 首页",
    notFound: "找不到这盘复盘",
    unableToOpen: "无法打开复盘",
    preparing: "正在准备工作区",
    missingRecord: "这个浏览器里没有该复盘 ID 的记录。",
    loadingCache: "正在加载已保存的对局和分析缓存…",
    retryOpen: "重试打开复盘",
    returnHome: "返回首页 →",
    sectionsLabel: "复盘分区",
    generating: "正在生成…",
    more: "更多",
    practiceKicker: (current, total) => `训练 — 局面 ${current} / ${total}`,
    practiceTitle: "练习这个局面",
    practiceLede: "慢慢来。仔细看。找出最佳着法。",
    reviewKicker: (state) => `复盘 — ${state}`,
    loadingReview: "正在加载复盘…",
  },
};

export function ReviewRouteLoading() {
  const copy = COPY[useUiLanguage()];
  return <p role="status">{copy.loadingReview}</p>;
}

export function ReviewLoadingChrome({
  loadState,
  loadError,
}: {
  loadState: "loading" | "missing" | "error" | "ready";
  loadError: string | null;
}) {
  const copy = COPY[useUiLanguage()];
  return (
    <main className="review-loading">
      <div className="review-titlebar">
        <Link className="brand review-home" href="/" aria-label={copy.homeLabel}>
          <span className="brand-mark"><BrandMark decorative /></span>
        </Link>
      </div>
      <section>
        <h1>{loadState === "missing" ? copy.notFound : loadState === "error" ? copy.unableToOpen : copy.preparing}</h1>
        <p>{loadError ?? (loadState === "missing" ? copy.missingRecord : copy.loadingCache)}</p>
        {loadState === "error" && <button type="button" className="secondary" onClick={() => window.location.reload()}>{copy.retryOpen}</button>}
        {loadState !== "loading" && <Link href="/">{copy.returnHome}</Link>}
      </section>
    </main>
  );
}

export function ReviewTitlebar({
  record,
  pathname,
  primary,
  more,
  moreOpen,
  sectionHref,
  coachRunning,
  analysesHidden,
}: {
  record: ReviewRecord;
  pathname: string;
  primary: Array<{ href: string; label: string }>;
  more: Array<{ href: string; label: string }>;
  moreOpen: boolean;
  sectionHref: (href: string) => string;
  coachRunning: boolean;
  analysesHidden: boolean;
}) {
  const copy = COPY[useUiLanguage()];
  return (
    <div className="review-titlebar">
      <Link className="brand review-home" href="/" aria-label={copy.homeLabel}>
        <span className="brand-mark"><BrandMark decorative /></span>
      </Link>
      <div className="review-title"><strong>{record.title}</strong><small>{record.subtitle}</small></div>
      <nav className="review-nav" aria-label={copy.sectionsLabel}>
        {primary.map((item) => (
          <Link aria-current={pathname === item.href ? "page" : undefined} className={pathname === item.href ? "active" : ""} href={sectionHref(item.href)} key={item.href}>
            {item.label}{item.label === "Study" && coachRunning ? <small>{copy.generating}</small> : null}
          </Link>
        ))}
      </nav>
      <div className="review-actions">
        <details className={moreOpen ? "review-more open" : "review-more"}>
          <summary>{copy.more}</summary>
          <div className="action-menu">
            {more.map((item) => (
              <Link aria-current={pathname === item.href ? "page" : undefined} className={pathname === item.href ? "active" : ""} href={sectionHref(item.href)} key={item.href}>{item.label}</Link>
            ))}
          </div>
        </details>
        <ReviewExportMenu record={record} pathname={pathname} analysesHidden={analysesHidden} />
      </div>
    </div>
  );
}

export function ReviewWorkbenchHead({
  retro,
  reviewKickerState,
  reviewDisplay,
  reviewLede,
  reviewSteps,
}: {
  retro: RetroRuntime;
  reviewKickerState: string;
  reviewDisplay: string;
  reviewLede: string | null;
  reviewSteps: Array<{ label: string; current?: boolean }>;
}) {
  const copy = COPY[useUiLanguage()];
  return (
    <div className="review-head-slot">
      {retro.active && (
        <section className="page-head head-focus practice-page-head">
          <p className="page-kicker">{copy.practiceKicker(Math.min(retro.currentIndex + 1, Math.max(retro.totalCount, 1)), Math.max(retro.totalCount, 1))}</p>
          <h1 className="page-display">{copy.practiceTitle}</h1>
          <p className="page-lede">{copy.practiceLede}</p>
        </section>
      )}
      {!retro.active && (
        <section className="page-head head-task review-page-head">
          <p className="page-kicker">{copy.reviewKicker(reviewKickerState)}</p>
          <h1 className="page-display">{reviewDisplay}</h1>
          {reviewLede ? <p className="page-lede">{reviewLede}</p> : null}
          <p className="page-steps">
            {reviewSteps.map((step) => (
              <span key={step.label} {...(step.current ? { "data-step": "current" as const } : {})}>{step.label}</span>
            ))}
          </p>
        </section>
      )}
    </div>
  );
}

export function ReviewContextAside({
  root,
  pathname,
  trainingId,
  children,
}: {
  root: string;
  pathname: string;
  trainingId: string | null;
  children: ReactNode;
}) {
  return (
    <aside className={`context-panel${pathname === `${root}/moves` ? " moves-context" : ""}${trainingId ? " training-context" : ""}`}>
      {children}
    </aside>
  );
}
