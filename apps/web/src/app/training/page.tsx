import type { Metadata } from "next";
import { AdvancedStudyPage } from "../../components/advanced-study-page";

export const metadata: Metadata = { title: "Training", robots: { index: false, follow: false } };

export default function Training() {
  return <AdvancedStudyPage />;
}
