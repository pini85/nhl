import Link from "next/link";
import { Crest } from "@/components/club/Crest";
import { Section } from "@/components/club/Section";
import type { H2H } from "@/lib/stats/opponents";

function Row({ h, crest, tone }: { h: H2H; crest: string | null; tone: "bad" | "good" }) {
  return (
    <Link href={`/clubs/${h.clubId}`} className="flex items-center gap-2.5 py-1.5">
      <Crest assetId={crest} size={28} name={h.name ?? undefined} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{h.name ?? `Club ${h.clubId}`}</span>
        <span className="tabular block text-[10px] text-[var(--muted-fg)]">
          GF {h.goalsFor} · GA {h.goalsAgainst} · {h.goalDiff > 0 ? "+" : h.goalDiff < 0 ? "−" : ""}
          {Math.abs(h.goalDiff)}
        </span>
      </span>
      <span
        className="tabular rounded-md px-1.5 py-0.5 text-xs font-extrabold"
        style={{
          background: tone === "bad" ? "var(--loss-bg)" : "var(--win-bg)",
          color: tone === "bad" ? "var(--loss-fg)" : "var(--win-fg)",
        }}
      >
        {h.wins}W {h.losses}L{h.otLosses > 0 ? ` ${h.otLosses}OTL` : ""}
      </span>
    </Link>
  );
}

export function NemesisCards({ nemesis, bags, crests }: { nemesis: H2H[]; bags: H2H[]; crests: Map<number, string | null> }) {
  if (!nemesis.length && !bags.length) {
    return <p className="mt-3 text-center text-xs text-[var(--muted-fg)]">Nemesis and punching bags appear after your first game.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-0">
      {nemesis.length > 0 && (
        <Section title="😈 Nemesis">
          {nemesis.map((h) => (
            <Row key={h.clubId} h={h} crest={crests.get(h.clubId) ?? null} tone="bad" />
          ))}
        </Section>
      )}
      {bags.length > 0 && (
        <Section title="🥊 Punching bags">
          {bags.map((h) => (
            <Row key={h.clubId} h={h} crest={crests.get(h.clubId) ?? null} tone="good" />
          ))}
        </Section>
      )}
    </div>
  );
}
