"use client";

import { useEffect, useRef } from "react";
import { REVIEW_SHORTCUT_GROUPS, shortcutKeysLabel, shortcutsInGroup } from "../../lib/review-shortcuts";

/**
 * The `?` overlay. It owns Escape and `?` while it is open, because the
 * workspace shortcut hook is suspended for the same period.
 */
export function ShortcutHelp({ onClose }: { onClose: () => void }) {
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
          <span className="kicker">Keyboard</span>
          <h2 id="shortcut-help-title">Shortcuts</h2>
          <p>These work anywhere in Review unless you are typing in a field.</p>
        </header>
        {REVIEW_SHORTCUT_GROUPS.map((group) => (
          <div className="shortcut-help-group" key={group}>
            <strong>{group}</strong>
            <dl>
              {shortcutsInGroup(group).map((shortcut) => (
                <div key={shortcut.action}>
                  <dt><kbd>{shortcutKeysLabel(shortcut)}</kbd></dt>
                  <dd>{shortcut.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <button ref={closeRef} type="button" className="secondary" onClick={onClose}>Close</button>
      </section>
    </div>
  );
}
