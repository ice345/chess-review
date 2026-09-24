"use client";

import { HistoryPage } from "./history-page";

/** Preserve the saved-review route while sharing one library view and actions. */
export function ReviewIndexPage() {
  return <HistoryPage savedOnly />;
}
