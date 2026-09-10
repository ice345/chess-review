import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: ["/", "/help"], disallow: ["/api/", "/review/", "/history", "/training", "/settings"] } };
}
