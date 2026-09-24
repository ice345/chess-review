"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@chess-review/ui";
import { ReviewExportMenu } from "./review-export-menu";
import type { ReviewRecord } from "../../lib/review-library";
import type { RetroRuntime } from "../../hooks/use-retrospect";

export function ReviewLoadingChrome({
  loadState,
  loadError,
}: {
  loadState: "loading" | "missing" | "error" | "ready";
  loadError: string | null;
}) {
  return (
    <main className="review-loading">
      <div className="review-titlebar">
        <Link className="brand review-home" href="/" aria-label="Open Chess Review home">
          <span className="brand-mark"><BrandMark decorative /></span>
        </Link>
      </div>
      <section>
        <h1>{loadState === "missing" ? "Review not found" : loadState === "error" ? "Unable to open review" : "Preparing workspace"}</h1>
        <p>{loadError ?? (loadState === "missing" ? "This browser has no record for that review ID." : "Loading the persisted game and analysis cache…")}</p>
        {loadState === "error" && <button type="button" className="secondary" onClick={() => window.location.reload()}>Retry opening review</button>}
        {loadState !== "loading" && <Link href="/">Return home →</Link>}
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
  return (
    <div className="review-titlebar">
      <Link className="brand review-home" href="/" aria-label="Open Chess Review home">
        <span className="brand-mark"><BrandMark decorative /></span>
      </Link>
      <div className="review-title"><strong>{record.title}</strong><small>{record.subtitle}</small></div>
      <nav className="review-nav" aria-label="Review sections">
        {primary.map((item) => (
          <Link aria-current={pathname === item.href ? "page" : undefined} className={pathname === item.href ? "active" : ""} href={sectionHref(item.href)} key={item.href}>
            {item.label}{item.label === "Study" && coachRunning ? <small>Generating…</small> : null}
          </Link>
        ))}
      </nav>
      <div className="review-actions">
        <details className={moreOpen ? "review-more open" : "review-more"}>
          <summary>More</summary>
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
  return (
    <div className="review-head-slot">
      {retro.active && (
        <section className="page-head head-focus practice-page-head">
          <p className="page-kicker">Practice — Position {Math.min(retro.currentIndex + 1, Math.max(retro.totalCount, 1))} of {Math.max(retro.totalCount, 1)}</p>
          <h1 className="page-display">Practice this position</h1>
          <p className="page-lede">Take your time. Look closely. Find the best move.</p>
        </section>
      )}
      {!retro.active && (
        <section className="page-head head-task review-page-head">
          <p className="page-kicker">{`Review — ${reviewKickerState}`}</p>
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
