// Decides how to offer "Add to Home Screen" and when the install banner may show.
// Pure functions so the rules are testable; the browser glue is in components/club/InstallPrompt.tsx.

export type InstallMode =
  | "installed" // already running from the home screen
  | "prompt" // the browser offers its own one-tap install dialog (Chrome, Edge, Samsung)
  | "ios" // iPhone/iPad browser: Share menu → Add to Home Screen
  | "ios-in-app" // Instagram/Facebook/… browser on iOS: must open in Safari first
  | "android-in-app" // an app's WebView on Android: must open in Chrome first
  | "android-manual" // Android browser without the prompt: ⋮ menu → Add to Home screen
  | "none"; // desktop browser that can't install

export type InstallEnv = { ua: string; standalone: boolean; canPrompt: boolean; touchPoints: number };

const IN_APP: [RegExp, string][] = [
  [/Instagram/, "Instagram"],
  [/FBAN|FBAV|FB_IAB/, "Facebook"],
  [/Snapchat/, "Snapchat"],
  [/musical_ly|BytedanceWebview|TikTok/i, "TikTok"],
  [/Discord/i, "Discord"],
  [/LinkedInApp/, "LinkedIn"],
  [/Twitter/, "X"],
  [/Telegram/i, "Telegram"],
  [/\bLine\//, "LINE"],
  [/\bGSA\//, "the Google app"],
];

/** The app whose built-in browser is showing the page, when the user agent says so. */
export function inAppName(ua: string): string | null {
  return IN_APP.find(([re]) => re.test(ua))?.[1] ?? null;
}

export function installMode({ ua, standalone, canPrompt, touchPoints }: InstallEnv): InstallMode {
  if (standalone) return "installed";
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  const android = /Android/.test(ua);
  const inApp = inAppName(ua) !== null || (android && /; wv\)/.test(ua));
  if (inApp && ios) return "ios-in-app";
  if (inApp && android) return "android-in-app";
  if (canPrompt) return "prompt";
  if (ios) return "ios";
  if (android) return "android-manual";
  return "none";
}

// Banner timing

export type Visits = {
  views: number;
  days: number;
  lastDay: string | null;
  moment: boolean;
  dismissedAt: number | null;
  installed: boolean;
};

export const EMPTY_VISITS: Visits = { views: 0, days: 0, lastDay: null, moment: false, dismissedAt: null, installed: false };

const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

/** Pages where someone just got something out of the site: a scout result, a game, a game night, Wrapped. */
export function isMomentPath(path: string): boolean {
  return /^\/(clubs|nights|games)\/[^/]+/.test(path) || path === "/wrapped";
}

export function recordView(v: Visits, { day, path }: { day: string; path: string }): Visits {
  return {
    ...v,
    views: v.views + 1,
    days: day === v.lastDay ? v.days : v.days + 1,
    lastDay: day,
    moment: v.moment || isMomentPath(path),
  };
}

/** Not on the first plain page view: wait for a 3rd page, a 2nd day, or a moment page. */
export function shouldShowBanner(v: Visits, now: number): boolean {
  if (v.installed) return false;
  if (v.dismissedAt !== null && now - v.dismissedAt < SNOOZE_MS) return false;
  return v.views >= 3 || v.days >= 2 || v.moment;
}

/** Reads stored visits, tolerating missing or old-shaped data. */
export function parseVisits(raw: string | null): Visits {
  if (!raw) return EMPTY_VISITS;
  try {
    const v = JSON.parse(raw) as Partial<Visits>;
    return { ...EMPTY_VISITS, ...v };
  } catch {
    return EMPTY_VISITS;
  }
}
