import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "../lib/site-info";

/**
 * Install metadata for the browser-first product. There is no account system,
 * so the manifest deliberately declares no shortcuts, share target or protocol
 * handlers: the app is the page, and its data lives in this browser.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4efe6",
    theme_color: "#4e7182",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
