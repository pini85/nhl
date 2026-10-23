import { readFileSync } from "node:fs";
import { normalizeMatch, type MatchPlayerRow } from "@/lib/ea/normalize";
import { EaMatchListSchema } from "@/lib/ea/schemas";
import type { GameLite, PlayerLine } from "@/lib/stats/types";

const FIX = "tests/fixtures/ea/2026-10-23";
const load = (f: string) => EaMatchListSchema.parse(JSON.parse(readFileSync(`${FIX}/${f}`, "utf8")));

export const normalized = [...load("matches-gameType5.json"), ...load("matches-recovered-from-opponents.json")].map(
  (m) => normalizeMatch(m, "gameType5", 56507),
);

const ssk = normalized.find((n) => n.match.matchId === "2776830620072")!;

export const games: GameLite[] = [
  ...normalized.map((n) => ({
    matchId: n.match.matchId,
    playedAt: n.match.playedAt,
    opponentClubId: n.match.opponentClubId,
    opponentName: n.clubs.find((c) => c.clubId === n.match.opponentClubId)?.name ?? null,
    goalsFor: n.match.goalsFor,
    goalsAgainst: n.match.goalsAgainst,
    outcome: n.match.outcome,
    overtime: n.match.overtime,
    dnf: n.match.dnf,
    source: "full" as const,
    matchType: "gameType5",
  })),
  {
    matchId: "summary-1974",
    playedAt: new Date(ssk.match.playedAt.getTime() - 1000),
    opponentClubId: 1974,
    opponentName: null,
    goalsFor: 3,
    goalsAgainst: 1,
    outcome: "W",
    overtime: false,
    dnf: "none",
    source: "summary",
    matchType: "gameType5",
  },
];

export const lines: PlayerLine[] = normalized.flatMap((n) => n.players as (MatchPlayerRow & PlayerLine)[]);
export const linesOf = (matchId: string) => lines.filter((l) => l.matchId === matchId);
