import type { Metadata } from "next";
import { Suspense } from "react";
import { PracticeStudyPanel } from "../../components/advanced-study/practice-study-panel";

export const metadata: Metadata = { title: "Practice", robots: { index: false, follow: false } };

export default function Training() {
  // The page reads ?player= and ?task= from the handoff link, so it needs a
  // suspense boundary to stay statically prerenderable.
  return <Suspense fallback={<p role="status">Loading training…</p>}><PracticeStudyPanel /></Suspense>;
}
