"use client";

import { useState } from "react";

export function crestUrl(assetId: string | null | undefined) {
  return assetId ? `https://media.contentapi.ea.com/content/dam/eacom/nhl/pro-clubs/custom-crests/${assetId}.png` : null;
}

// Club crest with a 🏒 fallback when there's no custom crest or the image fails to load.
export function Crest({ assetId, size = 40, name }: { assetId?: string | null; size?: number; name?: string }) {
  const [failed, setFailed] = useState(false);
  const url = crestUrl(assetId);
  if (!url || failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-xl bg-[rgba(92,200,255,0.15)]"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
        role="img"
        aria-label={name ? `${name} crest` : undefined}
      >
        🏒
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- plain img so onError works without the image optimizer
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-xl object-contain"
      style={{ width: size, height: size }}
    />
  );
}
