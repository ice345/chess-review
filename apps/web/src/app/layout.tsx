import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "../lib/site-info";
import type { ReactNode } from "react";
import { ServiceWorkerRegistrar } from "../components/service-worker-registrar";
import { AppShell } from "../components/app-shell";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/surfaces.css";
import "./styles/chrome.css";
import "./styles/home.css";
import "./styles/import.css";
import "./styles/review-index.css";
import "./styles/folio.css";
import "./styles/stats.css";
import "./styles/utilities.css";
import "./styles/review-shell.css";
import "./styles/review-panels.css";
import "./styles/review-workspace.css";
import "./styles/review-semantics.css";
import "./styles/human-lens.css";
import "./styles/platforms.css";
import "./styles/coach.css";
import "./styles/visual-identity.css";
import "./styles/study.css";
import "./styles/notebook.css";
import "./styles/practice.css";
import "./styles/platform-pages.css";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  ...(process.env.APP_ORIGIN ? { metadataBase: new URL(process.env.APP_ORIGIN) } : {}),
  openGraph: { type: "website", title: SITE_NAME, description: SITE_DESCRIPTION, siteName: SITE_NAME, locale: "en_US" },
  twitter: { card: "summary", title: SITE_NAME, description: SITE_DESCRIPTION },
  referrer: "strict-origin-when-cross-origin",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
