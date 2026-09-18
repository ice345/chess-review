"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BrandMark, Icon, type IconName } from "@chess-review/ui";
import { LocalDataNotice } from "./local-data-notice";

/**
 * The application frame: a persistent rail beside the route content at desktop
 * sizes, and the same rail as a drawer behind a top-bar trigger below them.
 *
 * One `<nav>` serves both. Rendering a second copy for the drawer would give
 * assistive technology two navigation landmarks with identical links and would
 * make every `getByRole("link", …)` ambiguous, so the presentation is switched
 * in CSS and the element itself never moves.
 */
/**
 * The rail's seven rows, in the reference's order: the desk, the way in, the
 * review, the practice, the library, the numbers, the settings. Each row is a
 * real destination — nothing here is a placeholder for a screen that does not
 * exist.
 */
const RAIL_SECTIONS: readonly { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/import", label: "Import", icon: "import" },
  { href: "/review", label: "Review", icon: "review" },
  { href: "/training", label: "Practice", icon: "practice" },
  { href: "/history", label: "Library", icon: "library" },
  { href: "/stats", label: "Stats", icon: "stats" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

/* The reference changes the rail's quiet line per screen. So does the product:
   the leg says where the reader is, in the same register. */
const RAIL_REGISTER: readonly { quote: string; foot: [string, string] }[] = [
  { quote: "A calmer mind sees further.", foot: ["Built for", "A quieter tomorrow"] },
  { quote: "Start with one good game.", foot: ["Built for", "A fuller library"] },
  { quote: "Good games linger quietly in the mind.", foot: ["Built for", "A clearer look"] },
  { quote: "Good moves grow from quiet attention.", foot: ["Built for", "A kinder look"] },
  { quote: "Every game leaves something behind.", foot: ["Built for", "A longer game"] },
  { quote: "Numbers, not noise.", foot: ["Built for", "A steadier view"] },
  { quote: "Your machine, your games.", foot: ["Built for", "A quieter tomorrow"] },
] as const;


function sceneRoute(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/import")) return "import";
  if (pathname.startsWith("/review")) return "review";
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
  const currentIndex = RAIL_SECTIONS.findIndex((section) => isCurrentRoute(pathname, section.href));
  const register = RAIL_REGISTER[currentIndex === -1 ? 0 : currentIndex]!;
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

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
      <header className="app-rail">
        <Link className="brand" href="/" aria-label="Open Chess Review home">
          <span className="brand-mark"><BrandMark decorative /></span>
          <span>
            <strong>Open Chess Review</strong>
            {/* The reference sets its tagline as two short lines; ours is the
                same shape, and "Objective · Human · Coach" stays the words. */}
            <small><span>Objective · Human</span><span>Coach</span></small>
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
          <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M1.5 4h13M1.5 8h13M1.5 12h13" /></svg>
          Menu
        </button>
        <nav
          id="app-nav"
          ref={navRef}
          className="rail-nav"
          aria-label="Application navigation"
          data-open={open ? "true" : undefined}
        >
          {RAIL_SECTIONS.map((section) => (
            <Link
              key={section.href}
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
        {/* The rail's own register: a quiet line above the fold of the leg, at the
            bottom where the reference puts it. Decorative, never load-bearing. */}
        <p className="rail-quote">“{register.quote}”</p>
        <p className="rail-foot"><span>{register.foot[0]}</span><span>{register.foot[1]}</span></p>
      </header>
      <div className="app-content">
        <LocalDataNotice />
        {children}
      </div>
    </div>
  );
}
