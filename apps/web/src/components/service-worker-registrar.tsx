"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Registers the offline service worker for production builds only. Development
 * unregisters instead, so a cached app shell can never shadow `next dev`.
 *
 * Registration runs after the page has loaded: installing a worker competes
 * with hydration for the main thread, and nothing here is needed for the first
 * paint. A failed registration is not surfaced because the product is fully
 * usable online without it.
 */
export function ServiceWorkerRegistrar() {
  const pathname = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      });
      return;
    }
    const register = (): void => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    };
    if (document.readyState === "complete") {
      const handle = window.setTimeout(register, 0);
      return () => window.clearTimeout(handle);
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  // Client-side navigation performs no document request, so the worker is told
  // which routes to keep. It decides whether the address is safe to cache.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker?.controller?.postMessage({ type: "ocr:cache-route", url: `${location.pathname}${location.search}` });
  }, [pathname]);

  return null;
}
