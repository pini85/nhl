import { describe, expect, it } from "vitest";
import { EMPTY_VISITS, inAppName, installMode, isMomentPath, recordView, shouldShowBanner } from "@/lib/install";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 Mobile/15E148 Safari/604.1",
  iosInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 389.0.0.49.87",
  iosFacebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 [FBAN/FBIOS;FBAV/519.0.0.38.109]",
  ipadAsMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:141.0) Gecko/141.0 Firefox/141.0",
  desktopChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
};

const env = (ua: string, extra: Partial<Parameters<typeof installMode>[0]> = {}) => ({
  ua,
  standalone: false,
  canPrompt: false,
  touchPoints: 0,
  ...extra,
});

describe("installMode", () => {
  it("knows when it already runs as the installed app", () => {
    expect(installMode(env(UA.iosSafari, { standalone: true }))).toBe("installed");
    expect(installMode(env(UA.androidChrome, { standalone: true, canPrompt: true }))).toBe("installed");
  });

  it("uses the one-tap prompt when the browser offers it", () => {
    expect(installMode(env(UA.androidChrome, { canPrompt: true }))).toBe("prompt");
    expect(installMode(env(UA.desktopChrome, { canPrompt: true }))).toBe("prompt");
  });

  it("shows the Share-menu steps on iPhone browsers", () => {
    expect(installMode(env(UA.iosSafari))).toBe("ios");
    expect(installMode(env(UA.iosChrome))).toBe("ios");
  });

  it("treats an iPad that reports itself as a Mac as iOS", () => {
    expect(installMode(env(UA.ipadAsMac, { touchPoints: 5 }))).toBe("ios");
    expect(installMode(env(UA.ipadAsMac))).toBe("none");
  });

  it("sends people in an app's built-in browser to a real browser first", () => {
    expect(installMode(env(UA.iosInstagram))).toBe("ios-in-app");
    expect(installMode(env(UA.iosFacebook))).toBe("ios-in-app");
    expect(installMode(env(UA.androidWebView))).toBe("android-in-app");
  });

  it("falls back to the browser-menu steps on Android without the prompt", () => {
    expect(installMode(env(UA.androidChrome))).toBe("android-manual");
    expect(installMode(env(UA.androidFirefox))).toBe("android-manual");
  });

  it("offers nothing on desktop browsers that can't install", () => {
    expect(installMode(env(UA.desktopChrome))).toBe("none");
  });
});

describe("inAppName", () => {
  it("names the app whose browser is open", () => {
    expect(inAppName(UA.iosInstagram)).toBe("Instagram");
    expect(inAppName(UA.iosFacebook)).toBe("Facebook");
    expect(inAppName(UA.androidWebView)).toBeNull();
    expect(inAppName(UA.iosSafari)).toBeNull();
  });
});

describe("isMomentPath", () => {
  it("flags pages where someone just got something out of the site", () => {
    expect(isMomentPath("/clubs/1808")).toBe(true);
    expect(isMomentPath("/nights/2026-10-22")).toBe(true);
    expect(isMomentPath("/games/2782817800237")).toBe(true);
    expect(isMomentPath("/wrapped")).toBe(true);
    expect(isMomentPath("/")).toBe(false);
    expect(isMomentPath("/games")).toBe(false);
    expect(isMomentPath("/opponents")).toBe(false);
  });
});

describe("banner timing", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 9, 24, 20);

  it("stays hidden on the first plain page view", () => {
    const v = recordView(EMPTY_VISITS, { day: "2026-10-24", path: "/" });
    expect(v).toMatchObject({ days: 1, views: 1, moment: false });
    expect(shouldShowBanner(v, now)).toBe(false);
  });

  it("shows on the third page view", () => {
    let v = EMPTY_VISITS;
    for (const path of ["/", "/players", "/games"]) v = recordView(v, { day: "2026-10-24", path });
    expect(shouldShowBanner(v, now)).toBe(true);
  });

  it("shows on a second day's visit", () => {
    let v = recordView(EMPTY_VISITS, { day: "2026-10-22", path: "/" });
    v = recordView(v, { day: "2026-10-22", path: "/" });
    expect(v.days).toBe(1);
    v = recordView(v, { day: "2026-10-24", path: "/" });
    expect(v.days).toBe(2);
    expect(shouldShowBanner(v, now)).toBe(true);
  });

  it("shows right after a scout result or game night", () => {
    const v = recordView(EMPTY_VISITS, { day: "2026-10-24", path: "/clubs/1808" });
    expect(shouldShowBanner(v, now)).toBe(true);
  });

  it("stays away for two weeks after being closed", () => {
    const v = { ...recordView(EMPTY_VISITS, { day: "2026-10-24", path: "/clubs/1808" }), dismissedAt: now - 13 * DAY };
    expect(shouldShowBanner(v, now)).toBe(false);
    expect(shouldShowBanner({ ...v, dismissedAt: now - 15 * DAY }, now)).toBe(true);
  });

  it("never shows again once the app is installed", () => {
    const v = { ...recordView(EMPTY_VISITS, { day: "2026-10-24", path: "/clubs/1808" }), installed: true };
    expect(shouldShowBanner(v, now)).toBe(false);
  });
});
