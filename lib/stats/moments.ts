// Moments: the things worth a card (and later a push): beaten club records, rare awards,
// personal milestones and team news. Worked out by replaying stored games in time order.
import type { MatchClubRow } from "@/lib/ea/normalize";
import { AWARD_INFO, allAwards } from "@/lib/stats/awards";
import { groupGameNights } from "@/lib/stats/nights";
import { clubRecords, milestones, type RecordItem } from "@/lib/stats/records";
import { divisionJourney } from "@/lib/stats/trends";
import type { ExtraStats, GameLite, PlayerLine } from "@/lib/stats/types";

export type Moment = {
  id: string;
  kind: "record" | "award" | "milestone" | "team";
  at: Date;
  emoji: string;
  key: string;
  value: number | null;
  label: string;
  playerId: string | null;
  playerName: string | null;
  prevHolderId: string | null;
  prevHolderName: string | null;
  matchId: string | null;
  nightKey: string | null;
  where: string | null; // "vs HK Bricks" or "on Thu Oct 22"
};

export type MomentInput = {
  lines: PlayerLine[];
  games: GameLite[];
  clubs: MatchClubRow[];
  extras: ExtraStats[];
  history: { takenAt: Date; division: number }[];
  ourClubId: number;
};

const DAY = 86_400_000;
export const MOMENT_WINDOW_DAYS = 14;

const RARE_AWARDS = new Set(["hattrick", "shutout", "nightmvp"]);

export const MILESTONE_STEPS = {
  games: [25, 50, 100, 200, 500],
  goals: [10, 25, 50, 100, 250],
  assists: [10, 25, 50, 100, 250],
  points: [10, 25, 50, 100, 200, 500],
  hits: [100, 250, 500, 1000],
} as const;
export type MilestoneStat = keyof typeof MILESTONE_STEPS;
const SINGULAR: Record<MilestoneStat, string> = { games: "game", goals: "goal", assists: "assist", points: "point", hits: "hit" };

// How each record reads: short noun (for "took your … record") and the full phrase for a value.
const RECORD_WORDS: Record<string, { short: string; full: (v: number) => string }> = {
  "goals-game": { short: "goals", full: (v) => `${v} goals in a game` },
  "assists-game": { short: "assists", full: (v) => `${v} assists in a game` },
  "points-game": { short: "points", full: (v) => `${v} points in a game` },
  "hits-game": { short: "hits", full: (v) => `${v} hits in a game` },
  "shots-game": { short: "shots", full: (v) => `${v} shots in a game` },
  "takeaways-game": { short: "takeaways", full: (v) => `${v} takeaways in a game` },
  "interceptions-game": { short: "interceptions", full: (v) => `${v} interceptions in a game` },
  "blocks-game": { short: "blocked shots", full: (v) => `${v} blocked shots in a game` },
  "pass-pct-game": { short: "passing", full: (v) => `${v}% passing in a game` },
  "point-streak": { short: "point streak", full: (v) => `${v}-game point streak` },
  "team-goals-game": { short: "team goals", full: (v) => `${v} goals in a game` },
  "biggest-win": { short: "biggest win", full: (v) => `biggest win, by ${v}` },
  "win-streak": { short: "wins in a row", full: (v) => `${v} wins in a row` },
};
const words = (key: string) => RECORD_WORDS[key] ?? { short: key, full: (v: number) => `${v} ${key}` };

const STREAK_KEYS = new Set(["point-streak", "win-streak"]);

/** "vs {opponent}" for a game id. */
function versus(games: GameLite[]) {
  const byId = new Map(games.map((g) => [g.matchId, g]));
  return (matchId: string | null) => {
    const g = matchId ? byId.get(matchId) : undefined;
    return g ? `vs ${g.opponentName ?? `Club ${g.opponentClubId}`}` : null;
  };
}

// FNV-1a 32-bit → base36: short, stable, no crypto needed.
function hashId(parts: (string | null)[]): string {
  let h = 0x811c9dc5;
  for (const ch of parts.map((p) => p ?? "-").join("|")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function make(m: Omit<Moment, "id">): Moment {
  return { ...m, id: hashId([m.kind, m.key, m.matchId, m.nightKey, m.playerId, m.kind === "milestone" || m.kind === "team" ? String(m.value) : null]) };
}

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
};

function recordMoments(input: MomentInput, since: Date): Moment[] {
  const { lines, games, ourClubId } = input;
  const chrono = [...games].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const firstIdx = chrono.findIndex((g) => g.playedAt >= since);
  if (firstIdx < 0) return [];

  const byKey = (rs: RecordItem[]) => new Map(rs.map((r) => [r.key, r]));
  const vs = versus(games);
  let prev = byKey(firstIdx > 0 ? clubRecords(lines, chrono.slice(0, firstIdx), ourClubId) : []);
  // Latest moment per record key, so a record pushed further over several games is one card.
  const latest = new Map<string, Moment>();

  for (let i = firstIdx; i < chrono.length; i++) {
    const now = byKey(clubRecords(lines, chrono.slice(0, i + 1), ourClubId));
    for (const [key, r] of now) {
      const before = prev.get(key);
      if (!before || before.value <= 0 || r.value <= before.value) continue;
      const earlier = latest.get(key);
      const extending = earlier && earlier.playerId === r.holderId;
      latest.set(
        key,
        make({
          kind: "record",
          at: r.playedAt,
          emoji: "🏆",
          key,
          value: r.value,
          label: words(key).short,
          playerId: r.holderId,
          playerName: r.holder,
          prevHolderId: extending ? earlier.prevHolderId : before.holderId,
          prevHolderName: extending ? earlier.prevHolderName : before.holder,
          matchId: r.matchId,
          nightKey: null,
          where: STREAK_KEYS.has(key) ? null : vs(r.matchId),
        }),
      );
    }
    prev = now;
  }
  return [...latest.values()];
}

function awardMoments(input: MomentInput, since: Date): Moment[] {
  const { lines, games, clubs, ourClubId } = input;
  const byMatch = new Map(games.map((g) => [g.matchId, g]));
  const nights = groupGameNights(games);
  const nightEnd = new Map(nights.map((n) => [n.key, n.games[0].playedAt]));
  const nightLabel = new Map(nights.map((n) => [n.key, n.label]));
  const vs = versus(games);
  const out: Moment[] = [];
  for (const a of allAwards(lines, games, clubs, ourClubId)) {
    if (!RARE_AWARDS.has(a.key)) continue;
    const at = a.matchId ? byMatch.get(a.matchId)?.playedAt : a.nightKey ? nightEnd.get(a.nightKey) : undefined;
    if (!at || at < since) continue;
    out.push(
      make({
        kind: "award",
        at,
        emoji: AWARD_INFO[a.key].emoji,
        key: a.key,
        value: null,
        label: AWARD_INFO[a.key].label,
        playerId: a.eaPlayerId,
        playerName: a.name,
        prevHolderId: null,
        prevHolderName: null,
        matchId: a.matchId,
        nightKey: a.nightKey,
        where: a.matchId ? vs(a.matchId) : a.nightKey && nightLabel.has(a.nightKey) ? `on ${nightLabel.get(a.nightKey)}` : null,
      }),
    );
  }
  return out;
}

function milestoneMoments(input: MomentInput, since: Date): Moment[] {
  const { lines, games, extras, ourClubId } = input;
  const byMatch = new Map(games.map((g) => [g.matchId, g]));
  const ours = lines
    .filter((l) => l.clubId === ourClubId && byMatch.has(l.matchId))
    .sort((a, b) => byMatch.get(a.matchId)!.playedAt.getTime() - byMatch.get(b.matchId)!.playedAt.getTime());

  // Games without a box score come first in time, so their totals are the starting point.
  const totals = new Map<string, Record<MilestoneStat, number>>();
  for (const e of extras) {
    const t = totals.get(e.eaPlayerId) ?? { games: 0, goals: 0, assists: 0, points: 0, hits: 0 };
    t.games += e.gp;
    t.goals += e.goals;
    t.assists += e.assists;
    t.points += e.goals + e.assists;
    t.hits += e.hits;
    totals.set(e.eaPlayerId, t);
  }

  const vs = versus(games);
  const out: Moment[] = [];
  for (const l of ours) {
    const t = totals.get(l.eaPlayerId) ?? { games: 0, goals: 0, assists: 0, points: 0, hits: 0 };
    const before = { ...t };
    t.games += 1;
    t.goals += l.goals;
    t.assists += l.assists;
    t.points += l.goals + l.assists;
    t.hits += l.hits;
    totals.set(l.eaPlayerId, t);
    const at = byMatch.get(l.matchId)!.playedAt;
    if (at < since) continue;
    for (const stat of Object.keys(MILESTONE_STEPS) as MilestoneStat[]) {
      for (const step of MILESTONE_STEPS[stat]) {
        if (before[stat] < step && t[stat] >= step) {
          out.push(
            make({
              kind: "milestone",
              at,
              emoji: "💯",
              key: stat,
              value: step,
              label: `${ordinal(step)} ${SINGULAR[stat]}`,
              playerId: l.eaPlayerId,
              playerName: l.playerName,
              prevHolderId: null,
              prevHolderName: null,
              matchId: l.matchId,
              nightKey: null,
              where: vs(l.matchId),
            }),
          );
        }
      }
    }
  }
  return out;
}

function teamMoments(input: MomentInput, since: Date): Moment[] {
  const out: Moment[] = [];
  // "First hat trick" is left out: the hat trick award moment already covers it. Labels look like "Club goals: 100".
  for (const m of milestones(input.lines, input.games, input.ourClubId)) {
    // Small club milestones (10, 25, 50) come too fast to be news.
    if (m.holder || m.reachedAt < since || Number(m.label.split(": ")[1]) < 100) continue;
    out.push(
      make({
        kind: "team",
        at: m.reachedAt,
        emoji: "🎉",
        key: "club-milestone",
        value: null,
        label: m.label,
        playerId: null,
        playerName: null,
        prevHolderId: null,
        prevHolderName: null,
        matchId: m.matchId,
        nightKey: null,
        where: null,
      }),
    );
  }
  const runs = divisionJourney(input.history);
  for (let i = 1; i < runs.length; i++) {
    const r = runs[i];
    if (r.from < since || r.division >= runs[i - 1].division) continue;
    out.push(
      make({
        kind: "team",
        at: r.from,
        emoji: "⬆️",
        key: "promotion",
        value: r.division,
        label: `Promoted to Division ${r.division}`,
        playerId: null,
        playerName: null,
        prevHolderId: null,
        prevHolderName: null,
        matchId: null,
        nightKey: null,
        where: null,
      }),
    );
  }
  return out;
}

/** All moments at or after `since`, newest first. */
export function moments(input: MomentInput, since: Date): Moment[] {
  return [...recordMoments(input, since), ...awardMoments(input, since), ...milestoneMoments(input, since), ...teamMoments(input, since)].sort(
    (a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id),
  );
}

/** Moments recent enough to show as cards (last 14 days). */
export function activeMoments(input: MomentInput, now: Date): Moment[] {
  return moments(input, new Date(now.getTime() - MOMENT_WINDOW_DAYS * DAY));
}

export function isAboutMe(m: Moment, meId: string): boolean {
  return m.playerId === meId || m.prevHolderId === meId;
}

export function momentHref(m: Moment): string | null {
  if (m.matchId) return `/games/${m.matchId}`;
  if (m.nightKey) return `/nights/${m.nightKey}`;
  return null;
}

export function momentText(m: Moment, meId: string | null): string {
  const mine = meId !== null && m.playerId === meId;
  const at = m.where ? ` ${m.where}` : "";
  switch (m.kind) {
    case "record": {
      const w = words(m.key);
      const full = w.full(m.value ?? 0) + at;
      if (!m.playerId) return `🔥 Team record: ${full}`;
      if (m.prevHolderId === m.playerId) return mine ? `🏆 You beat your own club record: ${full}` : `🏆 ${m.playerName} beat their own club record: ${full}`;
      if (mine) return `🏆 You set a club record: ${full}`;
      if (meId !== null && m.prevHolderId === meId) return `😤 ${m.playerName} took your ${w.short} record (${m.value})`;
      return `🏆 ${m.playerName} set a club record: ${full}${m.prevHolderName ? ` (was ${m.prevHolderName}'s)` : ""}`;
    }
    case "award":
      if (m.key === "nightmvp") return mine ? `${m.emoji} You were Night MVP${at}` : `${m.emoji} Night MVP${at}: ${m.playerName}`;
      return mine ? `${m.emoji} Your ${m.label.toLowerCase()}${at}` : `${m.emoji} ${m.label} for ${m.playerName}${at}`;
    case "milestone":
      return mine ? `${m.emoji} Your ${m.label}${m.where ? `, ${m.where}` : ""}` : `${m.emoji} ${m.label} for ${m.playerName}${m.where ? `, ${m.where}` : ""}`;
    case "team":
      return `${m.emoji} ${m.label}`;
  }
}
