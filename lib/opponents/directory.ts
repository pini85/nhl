import type { OpponentRowData } from "@/components/club/OpponentRow";
import type { MatchClubRow } from "@/lib/ea/normalize";
import type { H2H } from "@/lib/stats/opponents";

// Latest known crest per club, from stored games and scouting snapshots.
export function crestMap(rows: MatchClubRow[], scouted: { clubId: number; crestAssetId: string | null }[]) {
  const m = new Map<number, string | null>();
  for (const r of rows) if (r.crestAssetId) m.set(r.clubId, r.crestAssetId);
  for (const s of scouted) if (s.crestAssetId && !m.has(s.clubId)) m.set(s.clubId, s.crestAssetId);
  return m;
}

// Every club we've played or scouted, as list rows.
export function opponentDirectory(
  h2h: H2H[],
  scouted: { clubId: number; name: string; crestAssetId: string | null }[],
  crests: Map<number, string | null>,
): OpponentRowData[] {
  const names = new Map(scouted.map((s) => [s.clubId, s.name]));
  const rows: OpponentRowData[] = h2h.map((h) => ({
    clubId: h.clubId,
    name: h.name ?? names.get(h.clubId) ?? `Club ${h.clubId}`,
    crestAssetId: crests.get(h.clubId) ?? null,
    gp: h.gp,
    wins: h.wins,
    losses: h.losses,
    goalsFor: h.goalsFor,
    goalsAgainst: h.goalsAgainst,
    lastPlayedIso: h.lastPlayedAt.toISOString(),
  }));
  const played = new Set(h2h.map((h) => h.clubId));
  for (const s of scouted) {
    if (played.has(s.clubId)) continue;
    rows.push({ clubId: s.clubId, name: s.name, crestAssetId: s.crestAssetId, gp: 0, wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, lastPlayedIso: null });
  }
  return rows;
}
