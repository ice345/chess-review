"use client";
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="en"><body><main role="alert"><h1>Unable to open Open Chess Review</h1><p>Reload the page to try again.</p>
    <button type="button" onClick={() => retry()}>Try again</button><a href="/">Return home</a>
  </main></body></html>;
}
