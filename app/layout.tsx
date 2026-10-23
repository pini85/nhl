import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { BottomNav, BottomNavView } from "@/components/club/BottomNav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://drop-drop-drop.vercel.app"),
  title: { default: "Drop drop drop", template: "%s · Drop drop drop" },
  description: "Club-only stats, game nights and scouting for the Drop drop drop NHL 26 Pro Club.",
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh">
        <main className="mx-auto w-full max-w-md px-4 pt-4 pb-28">{children}</main>
        <Suspense fallback={<BottomNavView path={null} />}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
