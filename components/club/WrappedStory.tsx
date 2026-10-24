"use client";

import { ClubLogo } from "@/components/club/ClubLogo";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { ShareButton } from "@/components/club/ShareButton";
import type { Slide } from "@/lib/stats/wrapped";

export function WrappedStory({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  const s = slides[i];
  const go = (d: number) => setI((n) => Math.min(slides.length - 1, Math.max(0, n + d)));

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[radial-gradient(120%_60%_at_50%_0%,#12305a_0%,#070b14_65%)] px-5 pt-4 pb-8">
      <div className="flex gap-1" aria-hidden>
        {slides.map((_, n) => (
          <div key={n} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[var(--fg)] transition-all" style={{ width: n <= i ? "100%" : "0%" }} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted-fg)]">
        <span>Drop drop drop · All-time Wrapped</span>
        <Link href="/" aria-label="Close" className="px-2 py-1 text-base">
          ✕
        </Link>
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <button aria-label="Previous" onClick={() => go(-1)} className="absolute inset-y-0 left-0 w-1/3" />
        <button aria-label="Next" onClick={() => go(1)} className="absolute inset-y-0 right-0 w-2/3" />
        <p className="sr-only" aria-live="polite">
          {`${s.eyebrow}: ${s.big}${s.title ? `, ${s.title}` : ""}. ${s.line}`}
        </p>
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none text-center"
          >
            <div className="text-xs tracking-[0.3em] text-[var(--muted-fg)] uppercase">{s.eyebrow}</div>
            {s.kind === "outro" ? (
              <ClubLogo size={208} className="mx-auto mt-4 rounded-3xl shadow-[0_0_48px_rgba(92,200,255,0.35)]" />
            ) : (
              <div className="glow tabular mt-3 text-8xl font-black text-[var(--accent-blue)]">{s.big}</div>
            )}
            {s.title && <div className="mt-3 text-2xl font-black">{s.title}</div>}
            <div className="mt-2 text-sm text-[var(--muted-fg)]">{s.line}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      {s.kind === "outro" ? (
        <div className="flex justify-center">
          <ShareButton title="Drop drop drop · All-time Wrapped" />
        </div>
      ) : (
        <p className="text-center text-[11px] text-[var(--muted-fg)]">Tap to continue</p>
      )}
    </div>
  );
}
