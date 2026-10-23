"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function FadeIn({ children, index = 0 }: { children: ReactNode; index?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function GrowBar({ percent, className }: { percent: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { width: 0 }}
      animate={{ width: `${percent}%` }}
      transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
    />
  );
}
