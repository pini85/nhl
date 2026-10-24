// Our team logo (public/brand). Plain img: it's a small local file, no optimizer needed.
export function ClubLogo({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={size > 128 ? "/brand/logo-640.webp" : "/brand/logo-256.webp"}
      alt="Drop drop drop logo"
      width={size}
      height={size}
      className={`shrink-0 rounded-xl object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
