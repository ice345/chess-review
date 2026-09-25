"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { UiLanguage } from "@chess-review/shared";
import { parsePgn } from "@chess-review/chess-core";
import { buildReviewRecord, saveReviewRecord } from "../../lib/review-library";
import { readSharedPgn } from "../../lib/share-link";
import { loadAppSettings } from "../../lib/app-settings";
import { useUiLanguage } from "../../hooks/use-ui-language";

type ShareFailureReason = "empty" | "invalid" | "too-large" | "import-failed";

type ShareState =
  | { phase: "loading" }
  | { phase: "importing" }
  | { phase: "error"; reason: ShareFailureReason; detail?: string };

type ShareCopy = {
  reading: string;
  importing: string;
  emptyHeading: string;
  emptyBody: string;
  invalidHeading: string;
  invalidBody: string;
  invalidPayload: string;
  tooLargeHeading: string;
  tooLargeBody: string;
  importFailedHeading: string;
  importFailedBody: string;
  importFailedFallback: string;
  backHome: string;
};

const COPY: Record<UiLanguage, ShareCopy> = {
  en: {
    reading: "Reading shared game…",
    importing: "Importing shared game into your library…",
    emptyHeading: "Incomplete share link",
    emptyBody: "This link does not contain a game. It may have been copied without the full address.",
    invalidHeading: "Invalid share link",
    invalidBody: "The game data in this link could not be decoded. The link may be corrupted or incomplete.",
    invalidPayload: "The payload is not a valid chess game.",
    tooLargeHeading: "Game too large to share by link",
    tooLargeBody: "This game exceeds the size limit for link sharing. Ask the sender for the original PGN file instead.",
    importFailedHeading: "Import failed",
    importFailedBody: "The shared game could not be imported into your library.",
    importFailedFallback: "The game could not be imported.",
    backHome: "← Back to home",
  },
  "zh-CN": {
    reading: "正在读取分享的对局…",
    importing: "正在把分享的对局导入棋库…",
    emptyHeading: "分享链接不完整",
    emptyBody: "这个链接里没有对局。可能复制时没有带上完整地址。",
    invalidHeading: "分享链接无效",
    invalidBody: "无法解码这个链接里的对局数据。链接可能已损坏或不完整。",
    invalidPayload: "这段内容不是有效的棋局。",
    tooLargeHeading: "对局太大，无法用链接分享",
    tooLargeBody: "这盘对局超过了链接分享的大小限制。请向发送方索取原始 PGN 文件。",
    importFailedHeading: "导入失败",
    importFailedBody: "无法把这盘分享的对局导入棋库。",
    importFailedFallback: "无法导入这盘对局。",
    backHome: "← 返回首页",
  },
};

export default function SharePage() {
  const router = useRouter();
  const copy = COPY[useUiLanguage()];
  const [state, setState] = useState<ShareState>({ phase: "loading" });
  const ran = useRef(false);

  useEffect(() => {
    // Changing only the fragment does not reload the document, so the effect
    // must re-run on `hashchange`; otherwise a second share link opened in the
    // same tab would keep showing the previous link's result.
    const readHash = (): void => {
      const result = readSharedPgn(window.location.hash);
      const text = COPY[loadAppSettings().uiLanguage];

      if (!result.ok) {
        setState({ phase: "error", reason: result.reason });
        return;
      }

      // Validate that the payload is a real game with at least one move
      try {
        parsePgn(result.pgn);
      } catch {
        setState({ phase: "error", reason: "invalid", detail: text.invalidPayload });
        return;
      }

      setState({ phase: "importing" });

      (async () => {
        try {
          const record = await saveReviewRecord(await buildReviewRecord("pgn", result.pgn), { restoreDeleted: true });
          window.sessionStorage.setItem(`open-chess-review:auto:${record.id}`, "1");
          router.replace(`/review/${record.id}`);
        } catch (err) {
          setState({
            phase: "error",
            reason: "import-failed",
            detail: err instanceof Error ? err.message : text.importFailedFallback,
          });
        }
      })();
    };

    if (!ran.current) {
      ran.current = true;
      readHash();
    }
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [router]);

  return (
    <main className="page-scroll utility-page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "1rem", padding: "2rem" }}>
      {state.phase === "loading" && <p role="status">{copy.reading}</p>}
      {state.phase === "importing" && <p role="status">{copy.importing}</p>}
      {state.phase === "error" && <ShareError reason={state.reason} {...(state.detail === undefined ? {} : { detail: state.detail })} />}
    </main>
  );
}

function ShareError({ reason, detail }: { reason: ShareFailureReason; detail?: string }) {
  const copy = COPY[useUiLanguage()];
  return (
    <>
      {reason === "empty" && (
        <>
          <h1>{copy.emptyHeading}</h1>
          <p>{copy.emptyBody}</p>
        </>
      )}
      {reason === "invalid" && (
        <>
          <h1>{copy.invalidHeading}</h1>
          <p>{detail ?? copy.invalidBody}</p>
        </>
      )}
      {reason === "too-large" && (
        <>
          <h1>{copy.tooLargeHeading}</h1>
          <p>{copy.tooLargeBody}</p>
        </>
      )}
      {reason === "import-failed" && (
        <>
          <h1>{copy.importFailedHeading}</h1>
          <p>{detail ?? copy.importFailedBody}</p>
        </>
      )}
      <Link href="/">{copy.backHome}</Link>
    </>
  );
}
