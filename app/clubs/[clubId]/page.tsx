import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Crest } from "@/components/club/Crest";
import { LocalTime } from "@/components/club/LocalTime";
import { RelativeTime } from "@/components/club/RelativeTime";
import { ResultPill } from "@/components/club/ResultPill";
import { ScoutButton } from "@/components/club/ScoutButton";
import { Section } from "@/components/club/Section";
import { StatTile } from "@/components/club/StatTile";
import { Skeleton } from "@/components/ui/skeleton";
import { CLUB_ID } from "@/lib/config";
import { getGames } from "@/lib/data/club";
import { getClubRows, getOpponentLines, getOpponentSnapshot, getScoutedClubs } from "@/lib/data/opponents";
import { getDivision } from "@/lib/divisions";
import {
  clubTotals,
  commonOpponents,
  dangerousPlayers,
  headToHead,
  ourAverages,
  playStyle,
  recentFromSummary,
  rosterLeaders,
  rosterStats,
} from "@/lib/stats/opponents";

const POS: Record<string, string> = { center: "C", leftWing: "LW", rightWing: "RW", defenseMen: "D", goalie: "G" };
const pct = (n: number) => `${Math.round(n * 100)}%`;
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const savePct = (n: number) => n.toFixed(3).replace(/^0/, "");
const recordColor = (r: { wins: number; losses: number }) =>
  r.wins > r.losses ? "text-[var(--win-fg)]" : r.losses > r.wins ? "text-[var(--loss-fg)]" : "";
const plural = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? "" : "s"}` : null);

export default function ClubPage({ params }: PageProps<"/clubs/[clubId]">) {
  return (
    <Suspense fallback={<Skeleton className="mt-4 h-64 w-full rounded-2xl" />}>
      <ClubContent params={params} />
    </Suspense>
  );
}

async function ClubContent({ params }: { params: Promise<{ clubId: string }> }) {
  const clubId = Number((await params).clubId);
  if (!Number.isInteger(clubId) || clubId <= 0 || clubId === CLUB_ID) notFound();

  const [snapshot, games, clubRows, theirLines, scouted] = await Promise.all([
    getOpponentSnapshot(clubId),
    getGames(),
    getClubRows(),
    getOpponentLines(clubId),
    getScoutedClubs(),
  ]);
  const h2h = headToHead(games.filter((g) => g.opponentClubId === clubId))[0] ?? null;
  if (!snapshot && !h2h) notFound();

  const name = snapshot?.name ?? h2h?.name ?? `Club ${clubId}`;
  const crest = snapshot?.crestAssetId ?? clubRows.find((r) => r.clubId === clubId && r.crestAssetId)?.crestAssetId ?? null;
  const division = snapshot?.division ? getDivision(snapshot.division) : null;
  const danger = dangerousPlayers(theirLines, clubId);
  const profile = snapshot?.profile ?? null;
  const ours = ourAverages(clubRows, CLUB_ID);
  const styles = profile ? playStyle(profile, ours) : [];
  const totals = snapshot ? clubTotals(snapshot) : null;
  const roster = rosterStats(snapshot?.members ?? null);
  const leaders = rosterLeaders(snapshot?.members ?? null);
  const ourH2H = headToHead(games);
  const recent = theirRecentGames(snapshot, clubRows, scouted, ourH2H, new Set(games.map((g) => g.matchId)));
  const recentWins = recent.filter((g) => g.outcome === "W").length;
  const common = commonOpponents(recent, ourH2H, CLUB_ID);
  const form = (snapshot?.seasonResults ?? []).filter(Boolean).slice().reverse();

  return (
    <>
      <header className="flex items-center gap-3 py-2">
        <Crest assetId={crest} size={56} name={name} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">{name}</h1>
          <p className="text-[11px] text-[var(--muted-fg)]">
            {snapshot?.division ? `Division ${snapshot.division}${division ? ` · ${division.conference}` : ""} · ` : ""}
            {snapshot ? `${snapshot.wins}-${snapshot.losses}-${snapshot.otl} all-time` : "Not scouted yet"}
          </p>
          {snapshot && (
            <p className="text-[10px] text-[var(--muted-fg)]">
              Scouted <RelativeTime iso={snapshot.takenAt.toISOString()} />
            </p>
          )}
        </div>
      </header>

      {totals && (
        <Section title="Club stats · all-time">
          <div className="grid grid-cols-3 gap-1.5">
            <StatTile label="Games" value={totals.gp} glow />
            <StatTile label="Win %" value={pct(totals.winPct)} />
            <StatTile label="Record" value={`${totals.wins}-${totals.losses}-${totals.otl}`} />
            <StatTile label="Goals/GP" value={totals.goalsForPerGame.toFixed(1)} />
            <StatTile label="Against/GP" value={totals.goalsAgainstPerGame.toFixed(1)} />
            <StatTile label="Goal diff" value={signed(totals.goalDiff)} />
          </div>
          <p className="mt-2 text-[11px] text-[var(--muted-fg)]">
            {[
              plural(totals.seasons, "season"),
              plural(totals.titles, "title"),
              plural(totals.promotions, "promotion"),
              plural(totals.relegations, "relegation"),
              totals.rankingPoints ? `${totals.rankingPoints} ranking pts` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Section>
      )}

      {recent.length > 0 && (
        <Section title={`Their last ${recent.length} games · ${recentWins}-${recent.length - recentWins}`}>
          {common.clubs > 0 && (
            <div className="mb-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
              <div className="text-[10px] tracking-wide text-[var(--muted-fg)] uppercase">
                Common opponents · {common.clubs} club{common.clubs === 1 ? "" : "s"} we also played
              </div>
              <div className="mt-1 flex justify-between">
                <span>
                  They went{" "}
                  <b className="tabular">
                    {common.theirTotal.wins}-{common.theirTotal.losses}
                  </b>
                </span>
                <span>
                  We&apos;re{" "}
                  <b className={`tabular ${recordColor(common.ourTotal)}`}>
                    {common.ourTotal.wins}-{common.ourTotal.losses}
                  </b>{" "}
                  vs them
                </span>
              </div>
            </div>
          )}
          <ul className="divide-y divide-white/[0.05]">
            {recent.map((g) => {
              const ours = g.opponentClubId === CLUB_ID ? undefined : common.ours.get(g.opponentClubId);
              const row = (
                <>
                  <span className="w-11 shrink-0">
                    <ResultPill outcome={g.outcome} overtime={g.overtime} dnf={g.dnf} />
                  </span>
                  <span className="tabular w-10 shrink-0 font-bold">
                    {g.goalsFor}-{g.goalsAgainst}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${g.opponentClubId === CLUB_ID ? "font-bold text-[var(--accent-blue)]" : ""}`}>
                    vs {g.opponentName}
                  </span>
                  {ours && (
                    <span
                      className={`tabular shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold ${recordColor(ours)}`}
                      title="Our record against this club"
                    >
                      Us {ours.wins}-{ours.losses}
                    </span>
                  )}
                  {g.playedAt && (
                    <span className="shrink-0 text-xs text-[var(--muted-fg)]">
                      <LocalTime iso={g.playedAt} format="date" />
                    </span>
                  )}
                </>
              );
              return (
                <li key={g.key}>
                  {g.href ? (
                    <Link href={g.href} className="flex items-center gap-2.5 py-2 text-sm">
                      {row}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2.5 py-2 text-sm">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Head-to-head">
        {h2h ? (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              <StatTile label="Record" value={`${h2h.wins}-${h2h.losses}`} glow />
              <StatTile label="Goals" value={`${h2h.goalsFor}-${h2h.goalsAgainst}`} />
              <StatTile label="Diff" value={h2h.goalDiff > 0 ? `+${h2h.goalDiff}` : h2h.goalDiff} />
            </div>
            <ul className="mt-2 divide-y divide-white/[0.05]">
              {h2h.games.map((g) => (
                <li key={g.matchId}>
                  <Link href={`/games/${g.matchId}`} className="flex items-center gap-2.5 py-2 text-sm">
                    <span className="w-11 shrink-0">
                      <ResultPill outcome={g.outcome} overtime={g.overtime} dnf={g.dnf} />
                    </span>
                    <span className="tabular font-bold">
                      {g.goalsFor}-{g.goalsAgainst}
                    </span>
                    <span className="flex-1 text-right text-xs text-[var(--muted-fg)]">
                      <LocalTime iso={g.playedAt.toISOString()} format="date" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-[var(--muted-fg)]">No games against them yet.</p>
        )}
      </Section>

      {danger.length > 0 && (
        <Section title="Dangerous vs us">
          <ul className="space-y-1">
            {danger.map((p) => (
              <li key={p.name} className="flex justify-between text-sm">
                <span>{p.name}</span>
                <b className="tabular text-[var(--loss-fg)]">
                  {p.goals}G {p.assists}A <span className="text-xs font-normal text-[var(--muted-fg)]">in {p.gp}</span>
                </b>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!snapshot && (
        <Section>
          <ScoutButton name={name} clubId={clubId} />
        </Section>
      )}

      {form.length > 0 && (
        <Section title="Current form · this season">
          <div className="flex gap-1">
            {form.map((r, i) => (
              <ResultPill key={i} outcome={r === "wins" ? "W" : r === "losses" ? "L" : "OTL"} className="flex-1" />
            ))}
          </div>
        </Section>
      )}

      {profile && (
        <Section title={`Lineup · last ${profile.matches} games`}>
          <div className="flex flex-wrap gap-1.5">
            {profile.lineup.slice(0, 8).map((p) => (
              <span key={p.name} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs">
                <b className="text-[var(--accent-blue)]">{POS[p.position] ?? p.position}</b> {p.name}{" "}
                <span className="text-[var(--muted-fg)]">×{p.games}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[var(--muted-fg)]">
            {Object.entries(profile.platforms).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" · ")}
            {profile.avgPlayerLevel ? ` · avg level ${Math.round(profile.avgPlayerLevel)}` : ""}
            {profile.usualHourCet !== null ? ` · usually plays ~${profile.usualHourCet}:00 CET` : ""}
          </p>
        </Section>
      )}

      {profile && (
        <Section title={`Play style vs us · last ${profile.matches} games`}>
          {styles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {styles.map((s) => (
                <span key={s} className="rounded-full bg-[rgba(92,200,255,0.15)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-blue)]">
                  {s}
                </span>
              ))}
            </div>
          )}
          <table className="tabular w-full text-sm">
            <thead className="text-[10px] text-[var(--muted-fg)]">
              <tr>
                <th className="text-left font-medium">Per game</th>
                <th className="text-right font-medium">Them</th>
                <th className="text-right font-medium">Us</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Goals for", profile.avg.goalsFor.toFixed(1), ours.goalsFor.toFixed(1)],
                  ["Goals against", profile.avg.goalsAgainst.toFixed(1), ours.goalsAgainst.toFixed(1)],
                  ["Shots", profile.avg.shots.toFixed(1), ours.shots.toFixed(1)],
                  profile.avg.shotsAgainst !== undefined && ["Shots against", profile.avg.shotsAgainst.toFixed(1), ours.shotsAgainst.toFixed(1)],
                  profile.avg.shootingPct !== undefined && ["Shooting", pct(profile.avg.shootingPct), pct(ours.shootingPct)],
                  profile.avg.ppPct !== undefined && ["Power play", pct(profile.avg.ppPct), pct(ours.ppPct)],
                  ["Hits", profile.avg.hits.toFixed(1), ours.hits.toFixed(1)],
                  ["PIM", profile.avg.pim.toFixed(1), ours.pim.toFixed(1)],
                  ["Faceoffs", pct(profile.avg.faceoffPct), pct(ours.faceoffPct)],
                  ["Passing", pct(profile.avg.passPct), pct(ours.passPct)],
                ].filter(Boolean) as string[][]
              ).map(([label, t, u]) => (
                <tr key={label} className="border-t border-white/[0.05]">
                  <td className="py-1.5 text-xs text-[var(--muted-fg)]">{label}</td>
                  <td className="py-1.5 text-right font-bold">{t}</td>
                  <td className="py-1.5 text-right">{u}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {leaders.length > 0 && (
        <Section title="Team leaders · NHL 27 career">
          <div className="grid grid-cols-3 gap-1.5">
            {leaders.map((l) => (
              <div key={l.label} className="min-w-0 rounded-xl bg-white/[0.04] px-2 py-2 text-center">
                <div className="tabular text-lg font-black">{l.value}</div>
                <div className="truncate text-[11px]">{l.name}</div>
                <div className="text-[10px] tracking-wide text-[var(--muted-fg)] uppercase">{l.label}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {roster.skaters.length > 0 && (
        <Section title="Skaters · NHL 27 career (all clubs)">
          <table className="tabular w-full text-xs">
            <thead className="text-[10px] text-[var(--muted-fg)]">
              <tr>
                <th className="text-left font-medium">Player</th>
                <th className="text-right font-medium">GP</th>
                <th className="text-right font-medium">G</th>
                <th className="text-right font-medium">A</th>
                <th className="text-right font-medium">P</th>
                <th className="text-right font-medium">+/-</th>
                <th className="text-right font-medium">P/GP</th>
              </tr>
            </thead>
            <tbody>
              {roster.skaters.map((m) => (
                <tr key={m.name} className="border-t border-white/[0.05]">
                  <td className="py-1.5">
                    <span className="flex max-w-[9.5rem] items-baseline">
                      <span className="mr-1 shrink-0 text-[10px] text-[var(--muted-fg)]">{POS[m.position] ?? ""}</span>
                      <span className="truncate">{m.name}</span>
                    </span>
                  </td>
                  <td className="text-right">{m.gp}</td>
                  <td className="text-right">{m.goals}</td>
                  <td className="text-right">{m.assists}</td>
                  <td className="text-right font-bold">{m.points}</td>
                  <td className="text-right">{signed(m.plusMinus)}</td>
                  <td className="text-right">{m.pointsPerGame.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {roster.goalies.length > 0 && (
        <Section title="Goalies · NHL 27 career (all clubs)">
          <table className="tabular w-full text-xs">
            <thead className="text-[10px] text-[var(--muted-fg)]">
              <tr>
                <th className="text-left font-medium">Player</th>
                <th className="text-right font-medium">GP</th>
                <th className="text-right font-medium">W</th>
                <th className="text-right font-medium">SV%</th>
                <th className="text-right font-medium">GAA</th>
                <th className="text-right font-medium">SO</th>
              </tr>
            </thead>
            <tbody>
              {roster.goalies.map((g) => (
                <tr key={g.name} className="border-t border-white/[0.05]">
                  <td className="py-1.5">
                    <span className="block max-w-[9.5rem] truncate">{g.name}</span>
                  </td>
                  <td className="text-right">{g.gp}</td>
                  <td className="text-right">{g.wins}</td>
                  <td className="text-right font-bold">{savePct(g.savePct)}</td>
                  <td className="text-right">{g.gaa.toFixed(2)}</td>
                  <td className="text-right">{g.shutouts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </>
  );
}

type RecentRow = {
  key: string;
  opponentClubId: number;
  opponentName: string;
  goalsFor: number;
  goalsAgainst: number;
  outcome: "W" | "L";
  overtime: boolean;
  dnf: string;
  playedAt: string | null;
  href: string | null;
};

// Their own last games against anyone. Newer snapshots keep full games; older ones only EA's last-10 summary.
function theirRecentGames(
  snapshot: Awaited<ReturnType<typeof getOpponentSnapshot>>,
  clubRows: { clubId: number; name: string }[],
  scouted: { clubId: number; name: string }[],
  ourH2H: { clubId: number; name: string | null }[],
  ourMatchIds: Set<string>,
): RecentRow[] {
  if (!snapshot) return [];
  const names = new Map<number, string>();
  for (const h of ourH2H) if (h.name) names.set(h.clubId, h.name);
  for (const r of clubRows) if (r.name) names.set(r.clubId, r.name);
  for (const c of scouted) names.set(c.clubId, c.name);
  const label = (id: number, fromGame: string | null) => (id === CLUB_ID ? "Us" : (fromGame ?? names.get(id) ?? `Club ${id}`));
  const link = (id: number, matchId: string | null) =>
    matchId && ourMatchIds.has(matchId) ? `/games/${matchId}` : id !== CLUB_ID && names.has(id) ? `/clubs/${id}` : null;

  const full = snapshot.profile?.recentGames;
  if (full?.length) {
    return full.map((g) => ({
      key: g.matchId,
      opponentClubId: g.opponentClubId,
      opponentName: label(g.opponentClubId, g.opponentName),
      goalsFor: g.goalsFor,
      goalsAgainst: g.goalsAgainst,
      outcome: g.outcome,
      overtime: g.overtime,
      dnf: g.dnf,
      playedAt: g.playedAt,
      href: link(g.opponentClubId, g.matchId),
    }));
  }
  return recentFromSummary(snapshot.raw).map((r) => ({
    key: `s${r.index}`,
    opponentClubId: r.opponentClubId,
    opponentName: label(r.opponentClubId, null),
    goalsFor: r.goalsFor,
    goalsAgainst: r.goalsAgainst,
    outcome: r.outcome,
    overtime: false,
    dnf: "none",
    playedAt: null,
    href: link(r.opponentClubId, null),
  }));
}
