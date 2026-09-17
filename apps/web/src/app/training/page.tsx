import type { Metadata } from "next";
import { Suspense } from "react";
import { AdvancedStudyPage } from "../../components/advanced-study-page";

export const metadata: Metadata = { title: "Training", robots: { index: false, follow: false } };

export default function Training() {
  // The page reads ?player= and ?task= from the handoff link, so it needs a
  // suspense boundary to stay statically prerenderable.
  return <Suspense fallback={<p role="status">Loading training…</p>}><AdvancedStudyPage /></Suspense>;
}
