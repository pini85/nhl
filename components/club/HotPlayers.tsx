import Link from "next/link";
import { HeatBadge } from "@/components/club/HeatBadge";
import { Section } from "@/components/club/Section";
import type { Heat } from "@/lib/stats/trends";

const POS: Record<string, string> = { center: "C", leftWing: "LW", rightWing: "RW", defenseMen: "D", goalie: "G" };

export function HotPlayers({ players }: { players: { eaPlayerId: string; name: string; position: string; goals: number; assists: number; heat?: Heat }[] }) {
  if (!players.length) return null;
  return (
    <Section title="Hot · last 5 games">
      <ul className="space-y-1.5">
        {players.map((p) => (
          <li key={p.eaPlayerId}>
            <Link href={`/players/${p.eaPlayerId}`} className="flex items-center justify-between text-sm">
              <span>
                {p.name} <span className="text-[var(--muted-fg)]">{POS[p.position] ?? ""}</span> <HeatBadge heat={p.heat} />
              </span>
              <b className="tabular text-[var(--accent-blue)]">
                {p.goals}G {p.assists}A
              </b>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
