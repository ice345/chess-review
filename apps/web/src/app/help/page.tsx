import type { Metadata } from "next";
import { HelpPage } from "../../components/help-page";

export const metadata: Metadata = { title: "Help and data privacy", description: "What works in your browser, how to keep your chess library, and where optional connected services send data." };
export default function Help() {
  return <HelpPage />;
}
