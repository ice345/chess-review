import type { Metadata } from "next";
import { StatsPage } from "../../components/stats-page";

export const metadata: Metadata = { title: "Stats", robots: { index: false, follow: false } };

export default function Stats() {
  return <StatsPage />;
}
