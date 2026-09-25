"use client";

import { useEffect, useRef } from "react";
import type { UiLanguage } from "@chess-review/shared";
import { REVIEW_SHORTCUT_GROUPS, shortcutGroupLabel, shortcutKeysLabel, shortcutLabel, shortcutsInGroup } from "../../lib/review-shortcuts";
import { useUiLanguage } from "../../hooks/use-ui-language";

type ShortcutHelpCopy = {
  kicker: string;
  title: string;
  lede: string;
  close: string;
};

const COPY: Record<UiLanguage, ShortcutHelpCopy> = {
  en: {
    kicker: "Keyboard",
    title: "Shortcuts",
    lede: "These work anywhere in Review unless you are typing in a field.",
    close: "Close",
  },
  "zh-CN": {
    kicker: "键盘",
    title: "快捷键",
    lede: "除非你正在输入框里打字，这些快捷键在复盘各处都有效。",
    close: "关闭",
  },
};

/**
 * The `?` overlay. It owns Escape and `?` while it is open, because the
 * workspace shortcut hook is suspended for the same period.
 */
export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const language = useUiLanguage();
  const copy = COPY[language];
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" && event.key !== "?") return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="shortcut-help-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        className="shortcut-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
      >
        <header>
          <span className="kicker">{copy.kicker}</span>
          <h2 id="shortcut-help-title">{copy.title}</h2>
          <p>{copy.lede}</p>
        </header>
        {REVIEW_SHORTCUT_GROUPS.map((group) => (
          <div className="shortcut-help-group" key={group}>
            <strong>{shortcutGroupLabel(group, language)}</strong>
            <dl>
              {shortcutsInGroup(group).map((shortcut) => (
                <div key={shortcut.action}>
                  <dt><kbd>{shortcutKeysLabel(shortcut, language)}</kbd></dt>
                  <dd>{shortcutLabel(shortcut, language)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <button ref={closeRef} type="button" className="secondary" onClick={onClose}>{copy.close}</button>
      </section>
    </div>
  );
}
