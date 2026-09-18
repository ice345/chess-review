import type { Metadata } from "next";
import { ImportPage } from "../../components/import-page";

export const metadata: Metadata = { title: "Import", robots: { index: false, follow: false } };

export default function Import() {
  return <ImportPage />;
}
