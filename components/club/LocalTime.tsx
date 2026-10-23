"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Renders in the viewer's own time zone; the server renders a neutral placeholder.
export function LocalTime({ iso, format = "time" }: { iso: string; format?: "time" | "datetime" | "date" }) {
  const text = useSyncExternalStore(
    subscribe,
    () => {
      const d = new Date(iso);
      if (format === "date") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      if (format === "datetime")
        return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    },
    () => "",
  );
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
