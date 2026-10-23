"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function RelativeTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => {
      const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
      if (mins < 2) return "just now";
      if (mins < 60) return `${mins} min ago`;
      const h = Math.round(mins / 60);
      if (h < 48) return `${h} h ago`;
      return `${Math.round(h / 24)} days ago`;
    },
    () => "",
  );
  return <span suppressHydrationWarning>{text}</span>;
}
