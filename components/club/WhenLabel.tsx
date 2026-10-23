"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// "Tonight" when the night's last game ended under 6 hours ago, otherwise the fallback label.
export function WhenLabel({ lastIso, recent, fallback }: { lastIso: string; recent: string; fallback: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => (Date.now() - new Date(lastIso).getTime() < 6 * 3_600_000 ? recent : fallback),
    () => fallback,
  );
  return <>{label}</>;
}
