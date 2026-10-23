"use client";

import { useSyncExternalStore } from "react";
import { Section } from "@/components/club/Section";

const subscribe = () => () => {};

// Shows 3 facts, rotating daily (decided on the device so the page stays prerendered).
export function FunFacts({ facts }: { facts: { key: string; text: string }[] }) {
  const offset = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 86_400_000) % Math.max(1, facts.length),
    () => 0,
  );
  if (!facts.length) return null;
  const shown = Array.from({ length: Math.min(3, facts.length) }, (_, i) => facts[(offset + i) % facts.length]);
  return (
    <Section title="💡 Did you know?">
      <ul className="space-y-1.5 text-sm">
        {shown.map((f) => (
          <li key={f.key}>{f.text}</li>
        ))}
      </ul>
    </Section>
  );
}
