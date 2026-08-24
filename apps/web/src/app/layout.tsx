import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/chrome.css";
import "./styles/home.css";
import "./styles/utilities.css";
import "./globals.css";
import "./styles/review-workspace.css";
import "./styles/human-lens.css";
import "./styles/platforms.css";
import "./styles/coach.css";
import "./styles/visual-identity.css";

export const metadata: Metadata = {
  title: "Open Chess Review",
  description: "Objective analysis, human behavior, and explainable coaching.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
