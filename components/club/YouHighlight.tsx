"use client";

import { useSyncExternalStore } from "react";
import { ME_CHANGED } from "@/components/club/RosterPicker";
import { PLAYER_COOKIE } from "@/lib/me";

function myId(): string | null {
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${PLAYER_COOKIE}=`))
    ?.slice(PLAYER_COOKIE.length + 1);
  return raw && /^\d+$/.test(raw) ? raw : null;
}

function subscribe(l: () => void) {
  window.addEventListener(ME_CHANGED, l);
  return () => window.removeEventListener(ME_CHANGED, l);
}

/**
 * Marks your rows everywhere (links to your player page, record holders) with a tint and a "You" tag.
 * Pure CSS added in the browser, so shared pages stay the same for everyone.
 */
export function YouHighlight() {
  const id = useSyncExternalStore(subscribe, myId, () => null);
  if (!id) return null;
  const link = `a[href="/players/${id}"]`;
  const holder = `[data-player-id="${id}"]`;
  return (
    <style>{`
:is(li, tr):has(${link}) { background: rgba(92, 200, 255, 0.08); }
${link}::after, ${holder}::after {
  content: "You"; display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px;
  font-size: 10px; line-height: 16px; font-weight: 700; vertical-align: 1px;
  background: var(--accent-blue); color: #070b14;
}`}</style>
  );
}
