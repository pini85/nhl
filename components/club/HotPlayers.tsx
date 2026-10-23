import Link from "next/link";
import { Section } from "@/components/club/Section";

const POS: Record<string, string> = { center: "C", leftWing: "LW", rightWing: "RW", defenseMen: "D", goalie: "G" };

export function HotPlayers({ players }: { players: { eaPlayerId: string; name: string; position: string; goals: number; assists: number }[] }) {
  if (!players.length) return null;
  return (
    <Section title="Hot · last 5 games">
      <ul className="space-y-1.5">
        {players.map((p, i) => (
          <li key={p.eaPlayerId}>
            <Link href={`/players/${p.eaPlayerId}`} className="flex items-center justify-between text-sm">
              <span>
                {i < 2 ? "🔥 " : ""}
                {p.name} <span className="text-[var(--muted-fg)]">{POS[p.position] ?? ""}</span>
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
