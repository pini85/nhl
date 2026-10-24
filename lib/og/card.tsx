import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

// Team logo as a data URI, read once. A missing file just means a card without the logo.
let logo: Promise<string | null> | undefined;
function logoDataUri() {
  logo ??= readFile(join(process.cwd(), "public/brand/logo-og.jpg"))
    .then((b) => `data:image/jpeg;base64,${b.toString("base64")}`)
    .catch(() => null);
  return logo;
}

// Shared 1200×630 Arena Night card for link previews (Satori: flexbox + inline styles only).
export async function ogCard({
  eyebrow,
  big,
  bigColor = "#e8f1ff",
  title,
  subtitle,
  footer,
}: {
  eyebrow: string;
  big: string;
  bigColor?: string;
  title: string;
  subtitle?: string;
  footer?: string;
}) {
  const logoSrc = await logoDataUri();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          color: "#e8f1ff",
          background: "radial-gradient(120% 80% at 50% 0%, #12305a 0%, #070b14 65%)",
          fontFamily: "sans-serif",
        }}
      >
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori image, not a page element
          <img
            src={logoSrc}
            width={330}
            height={330}
            style={{ position: "absolute", right: 72, top: 120, borderRadius: 36, boxShadow: "0 0 60px rgba(92,200,255,0.35)" }}
          />
        ) : null}
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, color: "#7f95b5", textTransform: "uppercase" }}>{eyebrow}</div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: logoSrc ? 700 : 1056 }}>
          <div style={{ display: "flex", fontSize: 170, fontWeight: 900, color: bigColor, textShadow: "0 0 40px rgba(80,170,255,0.55)", lineHeight: 1 }}>
            {big}
          </div>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 800, marginTop: 18 }}>{title}</div>
          {subtitle ? <div style={{ display: "flex", fontSize: 34, color: "#7f95b5", marginTop: 8 }}>{subtitle}</div> : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#5cc8ff" }}>
          <span>🏒 Drop drop drop</span>
          <span style={{ color: "#7f95b5" }}>{footer ?? "drop-drop-drop.vercel.app"}</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

export const ogDay = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", weekday: "short", month: "short", day: "numeric" });
