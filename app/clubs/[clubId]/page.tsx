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
import { getClubRows, getOpponentLines, getOpponentSnapshot } from "@/lib/data/opponents";
import { getDivision } from "@/lib/divisions";
import { dangerousPlayers, headToHead, ourAverages, playStyle, quitRate } from "@/lib/stats/opponents";

const POS: Record<string, string> = { center: "C", leftWing: "LW", rightWing: "RW", defenseMen: "D", goalie: "G" };
const pct = (n: number) => `${Math.round(n * 100)}%`;

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

  const [snapshot, games, clubRows, theirLines] = await Promise.all([
    getOpponentSnapshot(clubId),
    getGames(),
    getClubRows(),
    getOpponentLines(clubId),
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
  const quit = quitRate(snapshot?.members ?? null);
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
          <p className="mb-2 text-sm">{profile.humanGoalieShare >= 0.5 ? "🥅 Usually a human goalie" : "🤖 Usually a CPU goalie"}</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.lineup.slice(0, 8).map((p) => (
              <span key={p.name} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs">
                <b className="text-[var(--accent-blue)]">{POS[p.position] ?? p.position}</b> {p.name}
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
        <Section title="Play style vs us">
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
              {[
                ["Shots", profile.avg.shots.toFixed(1), ours.shots.toFixed(1)],
                ["Hits", profile.avg.hits.toFixed(1), ours.hits.toFixed(1)],
                ["PIM", profile.avg.pim.toFixed(1), ours.pim.toFixed(1)],
                ["Faceoffs", pct(profile.avg.faceoffPct), pct(ours.faceoffPct)],
                ["Passing", pct(profile.avg.passPct), pct(ours.passPct)],
              ].map(([label, t, u]) => (
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

      {quit !== null && (
        <Section title="Quit rate">
          <p className="text-sm">
            {quit >= 0.1 ? "⚠️ " : ""}
            <b className="tabular">{pct(quit)}</b> of games their players don&apos;t finish
          </p>
        </Section>
      )}

      {snapshot?.members && snapshot.members.length > 0 && (
        <Section title="Roster · NHL 27 career (all clubs)">
          <table className="tabular w-full text-xs">
            <thead className="text-[10px] text-[var(--muted-fg)]">
              <tr>
                <th className="text-left font-medium">Player</th>
                <th className="text-right font-medium">GP</th>
                <th className="text-right font-medium">P</th>
                <th className="text-right font-medium">P/GP</th>
              </tr>
            </thead>
            <tbody>
              {[...snapshot.members]
                .sort((a, b) => b.points - a.points)
                .map((m) => (
                  <tr key={m.name} className="border-t border-white/[0.05]">
                    <td className="py-1.5">
                      <span className="mr-1 text-[10px] text-[var(--muted-fg)]">{POS[m.position] ?? ""}</span>
                      {m.name}
                    </td>
                    <td className="text-right">{m.gp}</td>
                    <td className="text-right">{m.points}</td>
                    <td className="text-right">{m.gp ? (m.points / m.gp).toFixed(2) : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Section>
      )}
    </>
  );
}
