import type { Metadata } from "next";
import { SettingsPage } from "../../components/settings-page";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default function Settings() {
  return <SettingsPage />;
}
