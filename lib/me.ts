// Who is looking (no login: teammates pick themselves) and which moment cards they closed.
// Pure helpers; cookies are read in lib/me-server.ts and written in app/me/actions.ts.

export const PLAYER_COOKIE = "ddd-player";
export const SEEN_COOKIE = "ddd-seen";
export const SEEN_MAX = 60;

// Readable from the browser on purpose: the "You" highlight reads ddd-player there.
export const COOKIE_OPTIONS = { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/", httpOnly: false } as const;

export type Me = { kind: "player"; playerId: string } | { kind: "guest" } | { kind: "skipped" } | { kind: "unset" };

const ID = /^[a-z0-9]{1,12}$/;

export function parseMe(raw: string | undefined, knownIds: Set<string>): Me {
  if (raw === "guest") return { kind: "guest" };
  if (raw === "skipped") return { kind: "skipped" };
  if (raw && /^\d+$/.test(raw) && knownIds.has(raw)) return { kind: "player", playerId: raw };
  return { kind: "unset" };
}

export function parseSeen(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .filter((id) => ID.test(id))
    .slice(-SEEN_MAX);
}

/** Seen ids after closing `ids`: only ids that can still show are kept, newest last. */
export function addSeen(seen: string[], ids: string[], activeIds: Set<string>): string[] {
  const out = seen.filter((id) => activeIds.has(id) && !ids.includes(id));
  for (const id of ids) if (ID.test(id) && activeIds.has(id) && !out.includes(id)) out.push(id);
  return out.slice(-SEEN_MAX);
}
