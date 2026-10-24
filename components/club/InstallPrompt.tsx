"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Check, Compass, Copy, Ellipsis, EllipsisVertical, Share, SquarePlus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import {
  EMPTY_VISITS,
  type InstallMode,
  inAppName,
  installMode,
  parseVisits,
  recordView,
  shouldShowBanner,
  type Visits,
} from "@/lib/install";

// Chrome's install event. The inline script in app/layout.tsx catches it before React loads.
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global {
  interface Window {
    __dddInstall?: InstallEvent | null;
    __dddInstalled?: boolean;
  }
}

const KEY = "ddd-install";
const OPEN_EVENT = "ddd:open-install";
const MODE_EVENTS = ["ddd:installable", "ddd:installed"];

// Visits live in localStorage; this small store lets React read them without effects setting state.
type Snapshot = { visits: Visits; at: number };
let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();

function readVisits(): Snapshot {
  if (!snapshot) {
    let visits = EMPTY_VISITS;
    try {
      visits = parseVisits(window.localStorage.getItem(KEY));
    } catch {
      // Storage blocked: start fresh every time.
    }
    snapshot = { visits, at: Date.now() };
  }
  return snapshot;
}

function writeVisits(change: (v: Visits) => Visits) {
  const visits = change(readVisits().visits);
  snapshot = { visits, at: Date.now() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(visits));
  } catch {
    // Storage blocked: the banner just won't remember anything.
  }
  listeners.forEach((l) => l());
}

function subscribeVisits(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const snooze = () => writeVisits((v) => ({ ...v, dismissedAt: Date.now() }));
/** Keeps the install banner away for 2 weeks (closing it, or "Not now" in onboarding). */
export const snoozeInstallBanner = snooze;

// The banner waits until onboarding is finished or skipped (ddd-player has any value).
const PROFILE_EVENTS = ["ddd:me-changed"];
function hasProfileCookie() {
  return document.cookie.split("; ").some((c) => c.startsWith("ddd-player=") && c.length > "ddd-player=".length);
}
function subscribeProfile(l: () => void) {
  PROFILE_EVENTS.forEach((e) => window.addEventListener(e, l));
  return () => PROFILE_EVENTS.forEach((e) => window.removeEventListener(e, l));
}

function currentMode(): InstallMode {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.__dddInstalled === true;
  return installMode({
    ua: navigator.userAgent,
    standalone,
    canPrompt: Boolean(window.__dddInstall),
    touchPoints: navigator.maxTouchPoints ?? 0,
  });
}

function subscribeMode(l: () => void) {
  MODE_EVENTS.forEach((e) => window.addEventListener(e, l));
  return () => MODE_EVENTS.forEach((e) => window.removeEventListener(e, l));
}

/** How this browser can install the app; null on the server and during hydration. */
export function useInstallMode(): InstallMode | null {
  return useSyncExternalStore(subscribeMode, currentMode, () => null);
}

/** Opens the browser's own install dialog. The event works once, so it is used up here. */
async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  const e = window.__dddInstall;
  if (!e) return null;
  window.__dddInstall = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") window.__dddInstalled = true;
  window.dispatchEvent(new Event(outcome === "accepted" ? "ddd:installed" : "ddd:installable"));
  return outcome;
}

/** Starts installing: the one-tap dialog where the browser has one, otherwise the how-to sheet. */
export async function startInstall() {
  if ((await promptInstall()) === null) window.dispatchEvent(new Event(OPEN_EVENT));
}

function installLink() {
  return `${window.location.origin}/?install=1`;
}

/** Banner above the bottom nav plus the how-to sheet. Mounted once in the root layout. */
export function InstallPrompt() {
  const mode = useInstallMode();
  const path = usePathname();
  const seen = useSyncExternalStore(subscribeVisits, readVisits, () => null);
  const hasProfile = useSyncExternalStore(subscribeProfile, hasProfileCookie, () => false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (path) writeVisits((v) => recordView(v, { day: new Date().toLocaleDateString("en-CA"), path }));
  }, [path]);

  useEffect(() => {
    if (mode === "installed") writeVisits((v) => (v.installed ? v : { ...v, installed: true }));
  }, [mode]);

  // ?install=1 (the link to share in the group chat) opens the how-to sheet straight away.
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    const url = new URL(window.location.href);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (url.searchParams.has("install")) {
      url.searchParams.delete("install");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      t = setTimeout(show, 0);
    }
    return () => {
      clearTimeout(t);
      window.removeEventListener(OPEN_EVENT, show);
    };
  }, []);

  async function add() {
    const outcome = await promptInstall();
    if (outcome === "dismissed") snooze();
    if (outcome === null) setOpen(true);
  }

  const showBanner =
    mode !== null &&
    mode !== "installed" &&
    mode !== "none" &&
    seen !== null &&
    path !== "/wrapped" &&
    hasProfile &&
    !open &&
    shouldShowBanner(seen.visits, seen.at);

  return (
    <>
      {showBanner && (
        <>
          {/* Extra scroll room so the banner never hides the end of the page. */}
          <div aria-hidden className="h-20" />
          <div
            className="fixed inset-x-0 z-40 px-3 animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 70px)" }}
          >
            <div
              role="region"
              aria-label="Get the app"
              className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[var(--card-border)] bg-[rgba(13,22,40,0.97)] p-2.5 pr-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur"
            >
              <AppIcon size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-tight font-bold">Get the Drop drop drop app</p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted-fg)]">
                  Game nights and scouting, one tap from your home screen
                </p>
              </div>
              <button
                onClick={add}
                className="shrink-0 rounded-full bg-[var(--accent-blue)] px-4 py-1.5 text-xs font-bold text-[#070b14] active:opacity-80"
              >
                Add
              </button>
              <button
                onClick={snooze}
                aria-label="Not now"
                className="shrink-0 rounded-full p-1.5 text-[var(--muted-fg)] active:bg-white/[0.08]"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </>
      )}

      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) snooze();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup
            className="fixed inset-x-0 bottom-0 z-[90] mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-[var(--card-border)] bg-[#0d1628] px-5 pt-3 text-[var(--fg)] shadow-[0_-12px_48px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out outline-none data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
          >
            <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-start gap-3">
              <AppIcon size={56} />
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-base leading-tight font-extrabold">Add Drop drop drop to your home screen</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-snug text-[var(--muted-fg)]">
                  Opens full screen like an app, straight to your stats. No App Store, takes 10 seconds.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" className="-mt-1 -mr-1 rounded-full p-2 text-[var(--muted-fg)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] active:bg-white/[0.08]">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <div className="mt-5">{mode && <InstallSteps mode={mode} onInstalled={() => setOpen(false)} />}</div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/** Permanent "Get the app" entry for the home page, so the option never disappears for good. */
export function InstallCard() {
  const mode = useInstallMode();
  if (mode === null || mode === "installed" || mode === "none") return null;
  return (
    <button
      onClick={startInstall}
      className="arena-card my-3 flex w-full items-center gap-3 px-3.5 py-3 text-left text-sm font-semibold"
    >
      <AppIcon size={32} />
      <span className="flex-1">Get the app</span>
      <span className="text-[var(--accent-blue)]">Add to Home Screen →</span>
    </button>
  );
}

/** How to add the app on this device; the sheet and onboarding both show it. */
export function InstallSteps({ mode, onInstalled }: { mode: InstallMode; onInstalled: () => void }) {
  if (mode === "installed") {
    return <Note>✓ You already have it. Open Drop drop drop from your home screen.</Note>;
  }

  if (mode === "prompt") {
    return (
      <PrimaryButton
        onClick={async () => {
          if ((await promptInstall()) === "accepted") onInstalled();
        }}
      >
        Install the app
      </PrimaryButton>
    );
  }

  if (mode === "ios") {
    return (
      <>
        <ol className="space-y-3">
          <Step n={1} icon={<Share className="size-4" />}>
            Tap <b>Share</b>. In Safari on iOS 26 and later, tap <Ellipsis className="inline size-4 align-[-3px]" aria-label="More" />{" "}
            next to the address bar first.
          </Step>
          <Step n={2} icon={<SquarePlus className="size-4" />}>
            Scroll down and tap <b>Add to Home Screen</b>.
          </Step>
          <Step n={3} icon={<Check className="size-4" />}>
            Tap <b>Add</b>. Look for this icon on your home screen.
          </Step>
        </ol>
        <Note>
          Don&apos;t see <b>Add to Home Screen</b>? You&apos;re probably in another app&apos;s browser. Open this page in Safari
          first.
        </Note>
        <CopyLink />
      </>
    );
  }

  if (mode === "ios-in-app") {
    const app = inAppName(navigator.userAgent) ?? "this app";
    return (
      <>
        <Note>
          You&apos;re in {app}&apos;s browser, which can&apos;t add apps to your home screen. Open the page in Safari first.
        </Note>
        <ol className="mt-4 space-y-3">
          <Step n={1} icon={<Compass className="size-4" />}>
            Tap <Ellipsis className="inline size-4 align-[-3px]" aria-label="More" /> or the Share button and choose{" "}
            <b>Open in Safari</b>. Or copy the link below and paste it into Safari.
          </Step>
          <Step n={2} icon={<SquarePlus className="size-4" />}>
            Safari opens these steps again. Follow them there.
          </Step>
        </ol>
        <CopyLink />
      </>
    );
  }

  if (mode === "android-in-app") {
    const host = window.location.host;
    return (
      <>
        <Note>You&apos;re in an app&apos;s built-in browser, which can&apos;t add apps to your home screen. Open the page in Chrome first.</Note>
        <a
          href={`intent://${host}/?install=1#Intent;scheme=https;package=com.android.chrome;end`}
          className="mt-4 flex w-full items-center justify-center rounded-full bg-[var(--accent-blue)] py-3 text-sm font-bold text-[#070b14] active:opacity-80"
        >
          Open in Chrome
        </a>
        <CopyLink />
      </>
    );
  }

  if (mode === "android-manual") {
    return (
      <ol className="space-y-3">
        <Step n={1} icon={<EllipsisVertical className="size-4" />}>
          Tap the <b>⋮ menu</b> in your browser (top right in Chrome).
        </Step>
        <Step n={2} icon={<SquarePlus className="size-4" />}>
          Tap <b>Add to Home screen</b> or <b>Install app</b>.
        </Step>
        <Step n={3} icon={<Check className="size-4" />}>
          Tap <b>Install</b>. Look for this icon on your home screen.
        </Step>
      </ol>
    );
  }

  return (
    <>
      <Note>Open this site on your phone to add it to your home screen.</Note>
      <CopyLink />
    </>
  );
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]" aria-hidden>
        {icon}
      </span>
      <p className="pt-1.5 text-sm leading-snug">
        <span className="sr-only">Step {n}: </span>
        {children}
      </p>
    </li>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-xl bg-white/[0.05] px-3 py-2.5 text-xs leading-snug text-[var(--muted-fg)] first:mt-0">{children}</p>;
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center rounded-full bg-[var(--accent-blue)] py-3 text-sm font-bold text-[#070b14] active:opacity-80"
    >
      {children}
    </button>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const link = installLink();
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true); // some in-app browsers block the clipboard: show the link to copy by hand
    }
  }
  return (
    <div className="mt-4">
      <button
        onClick={copy}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--card-border)] py-2.5 text-sm font-semibold text-[var(--accent-blue)] active:bg-white/[0.06]"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Link copied" : "Copy link"}
      </button>
      {failed && <p className="mt-2 text-center font-mono text-xs break-all text-[var(--muted-fg)] select-all">{link}</p>}
    </div>
  );
}

/** The real home-screen icon. */
export function AppIcon({ size }: { size: number }) {
  return (
    // The real home-screen icon, so people recognise it after adding.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/icon-192.png"
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-[22%] shadow-[0_0_16px_rgba(92,200,255,0.25)]"
      style={{ width: size, height: size }}
    />
  );
}
