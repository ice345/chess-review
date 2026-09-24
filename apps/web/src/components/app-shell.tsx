"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BrandMark, Icon, type IconName } from "@chess-review/ui";
import { LocalDataNotice } from "./local-data-notice";

/** One navigation serves the desktop header and mobile disclosure. */
const RAIL_SECTIONS: readonly { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/import", label: "Import", icon: "import" },
  { href: "/review", label: "Review", icon: "review" },
  { href: "/training", label: "Practice", icon: "practice" },
  { href: "/history", label: "Library", icon: "library" },
  { href: "/stats", label: "Stats", icon: "stats" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

function sceneRoute(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/import")) return "import";
  /* Saved reviews (/review index) shares Library climate; game desk keeps review. */
  if (pathname === "/review") return "library";
  if (pathname.startsWith("/review/")) return "review";
  if (pathname.startsWith("/training")) return "practice";
  if (pathname.startsWith("/history")) return "library";
  if (pathname.startsWith("/stats")) return "stats";
  if (pathname.startsWith("/settings")) return "settings";
  return "other";
}

function isCurrentRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previousPath = useRef(pathname);

  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    if (previous === pathname) return;
    const content = contentRef.current;
    if (!content) return;
    // Keep the board mounted and still when moving among one game's tools.
    const sameGame = /^\/review\/([^/]+)/.exec(previous)?.[1];
    const staysInGame = sameGame && sameGame === /^\/review\/([^/]+)/.exec(pathname)?.[1];
    const heading = content.querySelector<HTMLElement>("h1");
    const focusTarget = heading ?? content;
    focusTarget.tabIndex = -1;
    focusTarget.focus({ preventScroll: true });
    if (staysInGame || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Soft page enter: opacity-only so it stays quieter than task-state motion.
    const animation = content.animate?.(
      [{ opacity: 0.72 }, { opacity: 1 }],
      { duration: 180, easing: "ease" },
    );
    return () => animation?.cancel();
  }, [pathname]);

  // Navigating is the one thing that must always leave the page unobscured.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    // A drawer is a floating surface, so it dismisses like the review popovers
    // do: a pointer outside closes it, and Escape closes it and returns focus to
    // the trigger rather than leaving focus inside a hidden panel.
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (navRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="app-frame" data-route={sceneRoute(pathname)}>
      <a className="skip-to-content" href="#workspace-content" onClick={() => contentRef.current?.focus()}>Skip to content</a>
      <header className="app-rail">
        <Link className="brand" href="/" aria-label="Open Chess Review home">
          <span className="brand-mark"><BrandMark decorative /></span>
          <span>
            <strong>Open Chess Review</strong>
            <small>Objective · Human · Coach</small>
          </span>
        </Link>
        <button
          ref={triggerRef}
          type="button"
          className="rail-trigger"
          aria-expanded={open}
          aria-controls="app-nav"
          onClick={() => setOpen((current) => !current)}
        >
          <Icon name="menu" size={16} />
          Menu
        </button>
        <nav
          id="app-nav"
          ref={navRef}
          className="rail-nav"
          aria-label="Application navigation"
          data-open={open ? "true" : undefined}
          onBlur={(event) => {
            if (open && !event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== triggerRef.current) setOpen(false);
          }}
        >
          {RAIL_SECTIONS.map((section) => (
            <Link
              key={section.href}
              className={section.href === "/import" ? "nav-import" : undefined}
              href={section.href}
              aria-current={
                section.href === "/"
                  ? pathname === "/" ? "page" : undefined
                  : isCurrentRoute(pathname, section.href) ? "page" : undefined
              }
            >
              <Icon name={section.icon} />
              <span>{section.label}</span>
            </Link>
          ))}
        </nav>
      </header>
      <div className="app-content" id="workspace-content" ref={contentRef} tabIndex={-1}>
        <LocalDataNotice />
        {children}
      </div>
    </div>
  );
}
