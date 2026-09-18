import type { Metadata } from "next";
import { ReviewIndexPage } from "../../components/review-index-page";

export const metadata: Metadata = { title: "Review", robots: { index: false, follow: false } };

export default function Review() {
  return <ReviewIndexPage />;
}
