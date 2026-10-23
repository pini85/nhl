"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const COLORS = ["#2f9be0", "#5dffa8", "#ffd27a", "#e8f1ff", "#e5506a"];

function seenBefore(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function remember(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // private mode / storage blocked: celebrate again next time, that's fine
  }
}

// Confetti burst the first time a device sees a clinched promotion or title.
export function Celebrate({ message, storageKey }: { message: string; storageKey: string }) {
  const reduce = useReducedMotion();
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (seenBefore(storageKey)) return;
    remember(storageKey);
    const t = setTimeout(() => setBurst(true), 0);
    const off = setTimeout(() => setBurst(false), 3500);
    return () => {
      clearTimeout(t);
      clearTimeout(off);
    };
  }, [storageKey]);

  return (
    <>
      <div className="arena-card my-3 border-[var(--win-fg)] px-3.5 py-3 text-center text-sm font-black text-[var(--win-fg)]">{message}</div>
      {burst && !reduce && (
        <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
          {Array.from({ length: 80 }, (_, i) => {
            const left = (i * 37) % 100;
            const delay = (i % 10) * 0.05;
            const rotate = (i * 47) % 360;
            return (
              <motion.span
                key={i}
                className="absolute top-0 block h-2.5 w-1.5 rounded-sm"
                style={{ left: `${left}%`, background: COLORS[i % COLORS.length] }}
                initial={{ y: -20, opacity: 1, rotate: 0 }}
                animate={{ y: "105vh", opacity: [1, 1, 0], rotate: rotate + 360, x: ((i % 7) - 3) * 18 }}
                transition={{ duration: 2.4 + (i % 5) * 0.2, delay, ease: "easeIn" }}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
