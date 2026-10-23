import Image from "next/image";

export function crestUrl(assetId: string | null | undefined) {
  return assetId ? `https://media.contentapi.ea.com/content/dam/eacom/nhl/pro-clubs/custom-crests/${assetId}.png` : null;
}

export function Crest({ assetId, size = 40, name }: { assetId?: string | null; size?: number; name?: string }) {
  const url = crestUrl(assetId);
  if (!url) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-xl bg-[rgba(92,200,255,0.15)]"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
        aria-label={name ? `${name} crest` : undefined}
      >
        🏒
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={name ? `${name} crest` : ""}
      width={size}
      height={size}
      className="shrink-0 rounded-xl object-contain"
      unoptimized
    />
  );
}
