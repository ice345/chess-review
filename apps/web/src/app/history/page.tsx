import type { Metadata } from "next";
import { HistoryPage } from "../../components/history-page";

export const metadata: Metadata = { title: "History", robots: { index: false, follow: false } };

export default function History() {
  return <HistoryPage />;
}
