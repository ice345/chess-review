import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { ReviewShell } from "../../../components/review-shell";
import { ReviewRouteLoading } from "../../../components/review/review-chrome";

export const metadata: Metadata = { title: "Chess review", robots: { index: false, follow: false } };

export default function ReviewLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<ReviewRouteLoading />}><ReviewShell>{children}</ReviewShell></Suspense>;
}
