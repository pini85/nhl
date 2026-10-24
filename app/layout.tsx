import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { BottomNav, BottomNavView } from "@/components/club/BottomNav";
import { InstallPrompt } from "@/components/club/InstallPrompt";
import { YouHighlight } from "@/components/club/YouHighlight";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// iPhone launch screens (team logo on Arena Night). iOS needs an exact size match per device.
const SPLASH = (
  [
    [375, 667, 2], [414, 736, 3], [375, 812, 3], [414, 896, 2], [414, 896, 3], [390, 844, 3],
    [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3], [420, 912, 3],
  ] as const
).map(([w, h, dpr]) => ({
  url: `/brand/splash/splash-${w * dpr}x${h * dpr}.jpg`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}));

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://drop-drop-drop.vercel.app"),
  title: { default: "Drop drop drop", template: "%s · Drop drop drop" },
  description: "Club-only stats, game nights and scouting for the Drop drop drop NHL 27 Pro Club.",
  appleWebApp: { capable: true, title: "Drop drop drop", startupImage: SPLASH },
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Chrome fires its install event once, often before React loads, so catch it early and keep it for the "Add" button.
const CAPTURE_INSTALL = `
addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); window.__dddInstall = e; dispatchEvent(new Event("ddd:installable")); });
addEventListener("appinstalled", function () { window.__dddInstall = null; window.__dddInstalled = true; dispatchEvent(new Event("ddd:installed")); });
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh">
        <Script id="capture-install" strategy="beforeInteractive">
          {CAPTURE_INSTALL}
        </Script>
        <main className="mx-auto w-full max-w-md px-4 pt-4 pb-28">{children}</main>
        <Suspense fallback={null}>
          <InstallPrompt />
        </Suspense>
        <YouHighlight />
        <Suspense fallback={<BottomNavView path={null} />}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
