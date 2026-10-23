import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BoxScore } from "@/components/club/BoxScore";
import { Crest } from "@/components/club/Crest";
import { LocalTime } from "@/components/club/LocalTime";
import { ResultPill } from "@/components/club/ResultPill";
import { Section } from "@/components/club/Section";
import { ShareButton } from "@/components/club/ShareButton";
import { Skeleton } from "@/components/ui/skeleton";
import { CLUB_CREST_ASSET, CLUB_ID, CLUB_NAME } from "@/lib/config";
import { getMatch } from "@/lib/data/club";
import type { MatchClubRow } from "@/lib/ea/normalize";
import { threeStars } from "@/lib/stats/nights";

export default function GamePage({ params }: PageProps<"/games/[matchId]">) {
  return (
    <Suspense fallback={<Skeleton className="mt-4 h-64 w-full rounded-2xl" />}>
      <GameContent params={params} />
    </Suspense>
  );
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

async function GameContent({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const detail = await getMatch(matchId);
  if (!detail) notFound();
  const { game, clubs, lines } = detail;

  const ours = clubs.find((c) => c.clubId === CLUB_ID);
  const theirs = clubs.find((c) => c.clubId === game.opponentClubId);
  const oppName = theirs?.name ?? game.opponentName ?? `Club ${game.opponentClubId}`;
  const stars = threeStars(lines);
  const title = `${CLUB_NAME} ${game.goalsFor}-${game.goalsAgainst} ${oppName}`;

  const rows: Array<[string, (c: MatchClubRow) => string]> = [
    ["Shots", (c) => String(c.shots)],
    ["Hits", (c) => String(c.hits)],
    ["Faceoffs", (c) => pct(c.faceoffWins, c.faceoffWins + c.faceoffLosses)],
    ["Passing", (c) => pct(c.passCompletions, c.passAttempts)],
    ["Power play", (c) => `${c.ppg}/${c.ppo}`],
    ["PIM", (c) => String(c.pim)],
    ["Time on attack", (c) => mmss(c.toaSeconds)],
  ];

  return (
    <>
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-[var(--muted-fg)]">
          <LocalTime iso={game.playedAt.toISOString()} format="datetime" />
        </span>
        <ShareButton title={title} />
      </div>

      <section className="arena-card my-3 p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <Crest assetId={ours?.crestAssetId ?? CLUB_CREST_ASSET} size={52} name={CLUB_NAME} />
            <span className="text-xs font-semibold">{CLUB_NAME}</span>
          </div>
          <div>
            <div className="glow tabular text-4xl font-black">
              {game.goalsFor}
              <span className="text-[var(--accent-blue)]">–</span>
              {game.goalsAgainst}
            </div>
            <ResultPill outcome={game.outcome} overtime={game.overtime} dnf={game.dnf} className="mt-1" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Crest assetId={theirs?.crestAssetId} size={52} name={oppName} />
            <span className="line-clamp-2 text-xs font-semibold">{oppName}</span>
          </div>
        </div>
        {game.dnf === "opponent_quit" && <p className="mt-3 text-center text-[11px] text-[var(--muted-fg)]">⚑ Opponent quit this game</p>}
        {game.dnf === "we_quit" && <p className="mt-3 text-center text-[11px] text-[var(--muted-fg)]">⚑ We quit this game</p>}
      </section>

      {game.source === "summary" ? (
        <Section>
          <p className="text-sm text-[var(--muted-fg)]">Only the score was saved for this game. It was recovered from EA's recent results after the full box score had expired.</p>
        </Section>
      ) : (
        <>
          {ours && theirs && (
            <Section title="Team stats">
              <table className="tabular w-full text-sm">
                <tbody>
                  {rows.map(([label, f]) => (
                    <tr key={label} className="border-t border-white/[0.05] first:border-0">
                      <td className="py-1.5 font-bold">{f(ours)}</td>
                      <td className="py-1.5 text-center text-xs text-[var(--muted-fg)]">{label}</td>
                      <td className="py-1.5 text-right font-bold">{f(theirs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {stars.length > 0 && (
            <Section title="Three stars">
              <ol className="space-y-1 text-sm">
                {stars.map((p, i) => (
                  <li key={p.eaPlayerId} className="flex justify-between">
                    <span>
                      {"⭐".repeat(3 - i)} {p.playerName}{" "}
                      <span className="text-[var(--muted-fg)]">{p.clubId === CLUB_ID ? "" : `(${oppName})`}</span>
                    </span>
                    <b className="tabular">
                      {p.goals}G {p.assists}A
                    </b>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          <BoxScore title={CLUB_NAME} lines={lines.filter((l) => l.clubId === CLUB_ID)} linkPlayers />
          <BoxScore title={oppName} lines={lines.filter((l) => l.clubId === game.opponentClubId)} linkPlayers={false} />
        </>
      )}
    </>
  );
}
