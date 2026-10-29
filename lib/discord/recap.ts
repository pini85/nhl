// The Discord "last night" recap: which night to post, and the message text. Pure, so it is easy to test.
import type { MatchClubRow } from "@/lib/ea/normalize";
import { gameAwards } from "@/lib/stats/awards";
import { momentText, moments, type MomentInput } from "@/lib/stats/moments";
import { nightRecap, type NightRecap } from "@/lib/stats/nightRecap";
import { groupGameNights, type GameNight } from "@/lib/stats/nights";
import type { GameLite } from "@/lib/stats/types";

const HOUR = 3_600_000;
const NIGHT_OVER_MS = 3 * HOUR; // same gap that splits game nights
const MAX_AGE_MS = 36 * HOUR; // don't announce old nights (first deploy, or the collector was down)
const DISCORD_LIMIT = 2000;
const MAX_LIST = 6;
const TZ = "Europe/Amsterdam";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" });

/**
 * The night to announce now, or null. A night is ready the morning after it was played
 * (from `postHour` Amsterdam time, 08:00 by default), once 3 hours have passed since its last game.
 */
export function nightToPost(games: GameLite[], now: Date, posted: Set<string>, postHour = 8): GameNight | null {
  const night = groupGameNights(games)[0];
  if (!night || posted.has(night.key)) return null;
  const first = night.games.at(-1)!.playedAt;
  const last = night.games[0].playedAt;
  const since = now.getTime() - last.getTime();
  if (since < NIGHT_OVER_MS || since > MAX_AGE_MS) return null;
  if (dayFmt.format(now) <= dayFmt.format(first)) return null;
  if (Number(hourFmt.format(now)) < postHour) return null;
  return night;
}

export type RecapFacts = {
  recap: NightRecap;
  url: string;
  insights: string[];
  awards: { text: string; name: string; vs: string | null }[];
  highlights: string[];
};

/** Escapes Discord markdown, so gamertags like puck_control don't turn into italics. */
export const escapeMd = (text: string) => text.replace(/([\\*_~`|>])/g, "\\$1");

const opp = (g: GameLite) => g.opponentName ?? `Club ${g.opponentClubId}`;
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const avg = (n: number, d: number) => (d ? n / d : 0);
const one = (n: number) => n.toFixed(1);

function gameLine(g: GameLite): string {
  const icon = g.outcome === "W" ? "✅" : "❌";
  const tags = [g.overtime && "OT", g.dnf === "opponent_quit" && "they quit", g.dnf === "we_quit" && "we quit"].filter(Boolean);
  return `${icon} **${g.goalsFor}-${g.goalsAgainst}** vs ${escapeMd(opp(g))}${tags.length ? ` (${tags.join(", ")})` : ""}`;
}

/** Short "what it means" lines: compared with the rest of the season, streaks, best/worst game, rivalries. */
export function nightInsights(night: GameNight, games: GameLite[]): string[] {
  const out: string[] = [];
  const ids = new Set(night.games.map((g) => g.matchId));
  const before = games.filter((g) => !ids.has(g.matchId) && g.playedAt < night.games.at(-1)!.playedAt);
  const n = night.games.length;

  if (before.length >= 5) {
    const gf = avg(night.goalsFor, n);
    const ga = avg(night.goalsAgainst, n);
    const seasonGf = avg(before.reduce((s, g) => s + g.goalsFor, 0), before.length);
    const seasonGa = avg(before.reduce((s, g) => s + g.goalsAgainst, 0), before.length);
    const word = (a: number, b: number) => (a > b + 0.25 ? "above" : a < b - 0.25 ? "below" : "right on");
    out.push(`Scored ${one(gf)} goals a game (${word(gf, seasonGf)} the usual ${one(seasonGf)}), allowed ${one(ga)} (usual ${one(seasonGa)})`);

    const winPct = avg(night.wins, n);
    const seasonPct = avg(before.filter((g) => g.outcome === "W").length, before.length);
    if (n >= 3 && winPct - seasonPct >= 0.25) out.push(`A ${Math.round(winPct * 100)}% win night, well above the ${Math.round(seasonPct * 100)}% norm`);
    if (n >= 3 && seasonPct - winPct >= 0.25) out.push(`Only ${Math.round(winPct * 100)}% wins, below the ${Math.round(seasonPct * 100)}% norm`);
  }

  // Streak going into today, counted from the newest game.
  const newest = [...games].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
  let streak = 0;
  for (const g of newest) {
    if (g.outcome !== newest[0]?.outcome) break;
    streak++;
  }
  if (streak >= 3) out.push(newest[0].outcome === "W" ? `🔥 ${streak} wins in a row and counting` : `🧊 ${streak} losses in a row, time to snap it`);

  const margin = (g: GameLite) => g.goalsFor - g.goalsAgainst;
  const best = [...night.games].filter((g) => g.outcome === "W").sort((a, b) => margin(b) - margin(a))[0];
  if (best && margin(best) >= 3) out.push(`Biggest win: ${best.goalsFor}-${best.goalsAgainst} over ${opp(best)}`);
  const closeLosses = night.games.filter((g) => g.outcome === "L" && margin(g) === -1).length;
  if (closeLosses >= 2) out.push(`${closeLosses} one-goal losses, so close`);

  // Opponents met before: the running head-to-head.
  for (const clubId of new Set(night.games.map((g) => g.opponentClubId))) {
    const all = games.filter((g) => g.opponentClubId === clubId);
    if (all.length - night.games.filter((g) => g.opponentClubId === clubId).length < 1) continue;
    const w = all.filter((g) => g.outcome === "W").length;
    out.push(`All-time vs ${opp(all[0])}: ${w}-${all.length - w}`);
  }
  return out;
}

/** Everything the message needs, worked out from stored games. */
export function recapFacts(
  night: GameNight,
  input: MomentInput & { clubs: MatchClubRow[] },
  siteUrl: string,
): RecapFacts | null {
  const recap = nightRecap(night.key, input.games, input.lines, input.ourClubId);
  if (!recap) return null;
  const byMatch = new Map(night.games.map((g) => [g.matchId, g]));
  const awards = night.games
    .flatMap((g) => gameAwards(input.lines, g, input.clubs.filter((c) => c.matchId === g.matchId), input.ourClubId))
    .map((a) => {
      const g = a.matchId ? byMatch.get(a.matchId) : undefined;
      return { text: `${a.emoji} ${a.label}`, name: a.name, vs: g ? opp(g) : null };
    });

  // Club records, milestones and team news from tonight (awards are listed above already).
  const start = night.games.at(-1)!.playedAt;
  const end = new Date(night.games[0].playedAt.getTime() + NIGHT_OVER_MS);
  // Records and team news before personal milestones.
  const rank = { record: 0, team: 1, milestone: 2, award: 3 } as const;
  const highlights = moments(input, start, end)
    .filter((m) => m.kind !== "award" && m.at <= end)
    .sort((a, b) => rank[a.kind] - rank[b.kind])
    .map((m) => momentText(m, null));

  return {
    recap,
    url: `${siteUrl.replace(/\/$/, "")}/nights/${night.key}`,
    insights: nightInsights(night, input.games),
    awards: awards.filter((a, i) => awards.findIndex((b) => b.text === a.text && b.name === a.name && b.vs === a.vs) === i).slice(0, MAX_LIST),
    highlights: highlights.slice(0, MAX_LIST),
  };
}

/** Plain-text facts for the AI writer. */
export function factsForWriter(f: RecapFacts): string {
  const { night, mvp, stars, leaders } = f.recap;
  return [
    `Night: ${night.label}, record ${night.wins}-${night.losses}, goals for ${night.goalsFor}, against ${night.goalsAgainst}`,
    `Games (first to last): ${[...night.games].reverse().map((g) => `${g.outcome} ${g.goalsFor}-${g.goalsAgainst} vs ${opp(g)}${g.overtime ? " OT" : ""}${g.dnf !== "none" && g.dnf ? ` (${g.dnf})` : ""}`).join("; ")}`,
    mvp && mvp.points > 0 ? `Night MVP: ${mvp.playerName} ${mvp.goals}G ${mvp.assists}A` : null,
    stars.length ? `Top scorers: ${stars.map((s) => `${s.name} ${s.goals}G ${s.assists}A`).join(", ")}` : null,
    leaders.hits ? `Most hits: ${leaders.hits.name} ${leaders.hits.value}` : null,
    leaders.goalie ? `Goalie: ${leaders.goalie.name} ${leaders.goalie.saves}/${leaders.goalie.shots} saves` : null,
    ...f.awards.map((a) => `Award: ${a.text}: ${a.name}${a.vs ? ` vs ${a.vs}` : ""}`),
    ...f.highlights.map((h) => `Highlight: ${h}`),
    ...f.insights.map((i) => `Insight: ${i}`),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The Discord message (max 2000 characters). The link at the end unfurls into the night's preview card.
 */
export function recapMessage(f: RecapFacts, intro: string | null = null): string {
  const { night, mvp, stars, leaders, hasPlayerData } = f.recap;
  const who = escapeMd; // plain names, with markdown escaped
  const head = [
    `🏒 **Game night recap · ${night.label}**`,
    `**${night.wins}-${night.losses}** in ${night.games.length} game${night.games.length === 1 ? "" : "s"} · GF ${night.goalsFor} · GA ${night.goalsAgainst}`,
  ];
  const games = ["**Games**", ...[...night.games].reverse().map(gameLine)];

  const mvpLine = mvp && mvp.points > 0 ? ["**🏆 Night MVP**", `${who(mvp.playerName)} · ${mvp.goals}G ${mvp.assists}A`] : [];
  const starLines =
    hasPlayerData && stars.length ? ["**Three stars**", ...stars.map((s, i) => `${"⭐".repeat(3 - i)} ${who(s.name)} · ${s.goals}G ${s.assists}A`)] : [];
  const lead = [
    leaders.hits && `💥 Hits: ${who(leaders.hits.name)} · ${leaders.hits.value}`,
    leaders.shots && `🎯 Shots: ${who(leaders.shots.name)} · ${leaders.shots.value}`,
    leaders.plusMinus && `➕ Plus/minus: ${who(leaders.plusMinus.name)} · ${signed(leaders.plusMinus.value)}`,
    leaders.goalie &&
      `🧤 Save %: ${who(leaders.goalie.name)} · ${leaders.goalie.pct.toFixed(3).replace(/^0/, "")} (${leaders.goalie.saves}/${leaders.goalie.shots})`,
  ].filter((l): l is string => !!l);
  const leaderLines = hasPlayerData && lead.length ? ["**Leaders**", ...lead] : [];

  const list = (title: string, items: string[]) => (items.length ? [`**${title}**`, ...items.map((i) => `• ${i}`)] : []);
  const footer = [`👉 Full recap: ${f.url}`];

  // Drop the least important lines until the message fits.
  let highlights = f.highlights;
  let awards = f.awards;
  let insights = f.insights;
  const build = () =>
    [
      head,
      intro ? [escapeMd(intro)] : [],
      games,
      mvpLine,
      starLines,
      leaderLines,
      list("Highlights", highlights.map(escapeMd)),
      list("Awards", awards.map((a) => `${a.text}: ${who(a.name)}${a.vs ? ` vs ${escapeMd(a.vs)}` : ""}`)),
      list("Insights", insights.map(escapeMd)),
      footer,
    ]
      .filter((s) => s.length)
      .map((s) => s.join("\n"))
      .join("\n\n");
  let text = build();
  while (text.length > DISCORD_LIMIT && (awards.length || insights.length || highlights.length)) {
    if (awards.length) awards = awards.slice(0, -1);
    else if (insights.length) insights = insights.slice(0, -1);
    else highlights = highlights.slice(0, -1);
    text = build();
  }
  if (text.length > DISCORD_LIMIT && intro) return recapMessage({ ...f, awards, insights, highlights }, null);
  return text.length > DISCORD_LIMIT ? `${text.slice(0, DISCORD_LIMIT - footer[0].length - 3)}…\n${footer[0]}` : text;
}
