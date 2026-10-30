import Link from "next/link";
import { Crest } from "@/components/club/Crest";
import { LocalTime } from "@/components/club/LocalTime";
import { ResultPill } from "@/components/club/ResultPill";

export type OpponentRowData = {
  clubId: number;
  name: string;
  crestAssetId: string | null;
  gp: number;
  wins: number;
  losses: number;
  otLosses: number;
  goalsFor: number;
  goalsAgainst: number;
  lastPlayedIso: string | null;
  last: { outcome: "W" | "L"; goalsFor: number; goalsAgainst: number; overtime: boolean; dnf: string } | null;
};

// "2W 0L 1OTL": a record, written so it can't be mistaken for a score.
function Record({ wins, losses, otLosses }: { wins: number; losses: number; otLosses: number }) {
  return (
    <>
      <span className="text-[var(--win-fg)]">{wins}W</span> <span className="text-[var(--loss-fg)]">{losses}L</span>
      {otLosses > 0 && (
        <>
          {" "}
          <span className="text-[var(--otl-fg)]">{otLosses}OTL</span>
        </>
      )}
    </>
  );
}

// mode "recent": the last game's result and score on the right, the overall record underneath.
// mode "record": the overall record on the right (for Most played / Worst record).
export function OpponentRow({ o, mode = "recent" }: { o: OpponentRowData; mode?: "recent" | "record" }) {
  const date = o.lastPlayedIso ? <LocalTime iso={o.lastPlayedIso} format="date" /> : null;
  return (
    <Link href={`/clubs/${o.clubId}`} className="flex items-center gap-3 px-3.5 py-2.5 active:bg-white/[0.05]">
      <Crest assetId={o.crestAssetId} size={32} name={o.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{o.name}</div>
        <div className="truncate text-[11px] text-[var(--muted-fg)]">
          {!o.gp || !o.last ? (
            "Scouted · not played yet"
          ) : mode === "recent" ? (
            <>
              {date} · <Record wins={o.wins} losses={o.losses} otLosses={o.otLosses} /> overall · GF {o.goalsFor} GA {o.goalsAgainst}
            </>
          ) : (
            <>
              GF {o.goalsFor} · GA {o.goalsAgainst} · last {date}
            </>
          )}
        </div>
      </div>
      {o.gp > 0 && o.last && (
        <span className="flex shrink-0 items-center gap-1.5">
          {mode === "recent" ? (
            <>
              <ResultPill outcome={o.last.outcome} overtime={o.last.overtime} dnf={o.last.dnf} />
              <span className="tabular text-base font-black">
                {o.last.goalsFor}-{o.last.goalsAgainst}
              </span>
            </>
          ) : (
            <span className="tabular text-base font-black">
              <Record wins={o.wins} losses={o.losses} otLosses={o.otLosses} />
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
