"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// CSS-only entrance: content is in the HTML and visible even before JavaScript loads.
export function FadeIn({ children, index = 0 }: { children: ReactNode; index?: number }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 motion-reduce:animate-none" style={{ animationDelay: `${index * 60}ms` }}>
      {children}
    </div>
  );
}

export function GrowBar({ percent, className }: { percent: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={{ width: `${percent}%` }}
      initial={reduce ? false : { width: 0 }}
      animate={{ width: `${percent}%` }}
      transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
    />
  );
}
