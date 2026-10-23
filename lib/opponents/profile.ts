import { toInt, toNum } from "@/lib/ea/normalize";
import type { EaMatch } from "@/lib/ea/schemas";

export type OpponentProfile = {
  matches: number;
  avg: { shots: number; hits: number; pim: number; faceoffPct: number; passPct: number; goalsFor: number; goalsAgainst: number };
  humanGoalieShare: number;
  lineup: { name: string; position: string; games: number }[];
  platforms: Record<string, number>;
  avgPlayerLevel: number;
  usualHourCet: number | null;
};

type Bag = Record<string, unknown>;
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hourCycle: "h23" });

// A club's recent form and habits, from its own last matches.
export function buildProfile(matches: EaMatch[], clubId: number): OpponentProfile | null {
  if (!matches.length) return null;
  const key = String(clubId);
  let shots = 0, hits = 0, pim = 0, fow = 0, fol = 0, passa = 0, passc = 0, gf = 0, ga = 0, withGoalie = 0;
  let levelSum = 0, levelCount = 0;
  const positions = new Map<string, Map<string, number>>();
  const platforms: Record<string, number> = {};
  const hours = new Map<number, number>();

  for (const m of matches) {
    const club = (m.clubs[key] ?? {}) as Bag;
    const agg = (m.aggregate[key] ?? {}) as Bag;
    shots += toInt(club.shots);
    passa += toInt(club.passa);
    passc += toInt(club.passc);
    gf += toInt(club.score);
    ga += toInt(club.opponentScore);
    hits += toInt(agg.skhits);
    pim += toInt(agg.skpim);
    fow += toInt(agg.skfow);
    fol += toInt(agg.skfol);

    const players = Object.values(m.players[key] ?? {}) as Bag[];
    if (players.some((p) => p.position === "goalie")) withGoalie++;
    for (const p of players) {
      const name = String(p.playername);
      const byPos = positions.get(name) ?? new Map<string, number>();
      byPos.set(String(p.position), (byPos.get(String(p.position)) ?? 0) + 1);
      positions.set(name, byPos);
      if (p.clientPlatform) platforms[String(p.clientPlatform)] = (platforms[String(p.clientPlatform)] ?? 0) + 1;
      const level = toNum(p.playerLevel);
      if (level > 0) {
        levelSum += level;
        levelCount++;
      }
    }
    const h = Number(hourFmt.format(new Date(m.timestamp * 1000)));
    hours.set(h, (hours.get(h) ?? 0) + 1);
  }

  const n = matches.length;
  const lineup = [...positions.entries()]
    .map(([name, byPos]) => {
      const [position, games] = [...byPos.entries()].sort((a, b) => b[1] - a[1])[0];
      const total = [...byPos.values()].reduce((s, v) => s + v, 0);
      return { name, position, games: Math.max(games, total) };
    })
    .sort((a, b) => b.games - a.games);

  return {
    matches: n,
    avg: {
      shots: shots / n,
      hits: hits / n,
      pim: pim / n,
      faceoffPct: fow + fol ? fow / (fow + fol) : 0,
      passPct: passa ? passc / passa : 0,
      goalsFor: gf / n,
      goalsAgainst: ga / n,
    },
    humanGoalieShare: withGoalie / n,
    lineup,
    platforms,
    avgPlayerLevel: levelCount ? levelSum / levelCount : 0,
    usualHourCet: [...hours.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
}
