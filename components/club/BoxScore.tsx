import Link from "next/link";
import type { PlayerLine } from "@/lib/stats/types";

const POS: Record<string, string> = { center: "C", leftWing: "LW", rightWing: "RW", defenseMen: "D", goalie: "G" };
const ORDER: Record<string, number> = { center: 0, leftWing: 1, rightWing: 2, defenseMen: 3, goalie: 4 };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function BoxScore({ title, lines, linkPlayers }: { title: string; lines: PlayerLine[]; linkPlayers: boolean }) {
  const skaters = lines.filter((l) => l.position !== "goalie").sort((a, b) => ORDER[a.position] - ORDER[b.position]);
  const goalies = lines.filter((l) => l.position === "goalie");
  const name = (l: PlayerLine) =>
    linkPlayers ? (
      <Link href={`/players/${l.eaPlayerId}`} className="underline-offset-2 active:underline">
        {l.playerName}
      </Link>
    ) : (
      l.playerName
    );

  return (
    <section className="arena-card my-3 overflow-hidden">
      <h2 className="px-3.5 pt-3 text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">{title}</h2>
      {!lines.length && <p className="p-3.5 text-sm text-[var(--muted-fg)]">No player stats for this club.</p>}
      {skaters.length > 0 && (
        <table className="tabular mt-1 w-full text-xs">
          <thead className="text-[10px] text-[var(--muted-fg)]">
            <tr>
              <th className="px-3.5 py-1.5 text-left font-medium">Skater</th>
              {["G", "A", "P", "+/-", "S", "H", "TOI"].map((h) => (
                <th key={h} className="px-1 py-1.5 text-right font-medium last:pr-3.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skaters.map((l) => (
              <tr key={l.eaPlayerId} className="border-t border-white/[0.05]">
                <td className="max-w-[120px] truncate px-3.5 py-1.5">
                  <span className="mr-1 text-[10px] text-[var(--muted-fg)]">{POS[l.position]}</span>
                  {name(l)}
                </td>
                <td className="px-1 text-right">{l.goals}</td>
                <td className="px-1 text-right">{l.assists}</td>
                <td className="px-1 text-right font-bold">{l.goals + l.assists}</td>
                <td className="px-1 text-right">{l.plusMinus > 0 ? `+${l.plusMinus}` : l.plusMinus}</td>
                <td className="px-1 text-right">{l.shots}</td>
                <td className="px-1 text-right">{l.hits}</td>
                <td className="px-1 pr-3.5 text-right">{mmss(l.toiSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {goalies.length > 0 && (
        <table className="tabular mb-1 w-full text-xs">
          <thead className="text-[10px] text-[var(--muted-fg)]">
            <tr>
              <th className="px-3.5 py-1.5 text-left font-medium">Goalie</th>
              {["SV", "SA", "GA", "SV%"].map((h) => (
                <th key={h} className="px-1 py-1.5 text-right font-medium last:pr-3.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {goalies.map((l) => (
              <tr key={l.eaPlayerId} className="border-t border-white/[0.05]">
                <td className="max-w-[140px] truncate px-3.5 py-1.5">{name(l)}</td>
                <td className="px-1 text-right">{l.glSaves}</td>
                <td className="px-1 text-right">{l.glShots}</td>
                <td className="px-1 text-right">{l.glGa}</td>
                <td className="px-1 pr-3.5 text-right">{l.glShots ? (l.glSaves / l.glShots).toFixed(3).replace(/^0/, "") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
