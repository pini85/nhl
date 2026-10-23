"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={share}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-blue)] active:bg-white/[0.06]"
    >
      <Share2 className="size-3.5" /> {copied ? "Link copied" : "Share"}
    </button>
  );
}
