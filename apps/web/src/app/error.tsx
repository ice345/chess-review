"use client";
import Link from "next/link";
import { useTransition } from "react";
import { AppHeader } from "../components/app-header";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return <main className="page-scroll utility-page"><AppHeader /><section className="utility-empty" role="alert">
    <h1>This page could not be opened</h1><p>Try loading it again, or return to your saved games.</p>
    <button type="button" className="secondary" disabled={pending} onClick={() => startTransition(() => retry())}>Try again</button>
    <Link href="/history">Open history</Link>
  </section></main>;
}
