import Link from "next/link";
import { Crest } from "@/components/club/Crest";
import { LocalTime } from "@/components/club/LocalTime";

export type OpponentRowData = {
  clubId: number;
  name: string;
  crestAssetId: string | null;
  gp: number;
  wins: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  lastPlayedIso: string | null;
};

export function OpponentRow({ o }: { o: OpponentRowData }) {
  return (
    <Link href={`/clubs/${o.clubId}`} className="flex items-center gap-3 px-3.5 py-2.5 active:bg-white/[0.05]">
      <Crest assetId={o.crestAssetId} size={32} name={o.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{o.name}</div>
        <div className="text-[11px] text-[var(--muted-fg)]">
          {o.gp ? (
            <>
              GF {o.goalsFor} · GA {o.goalsAgainst}
              {o.lastPlayedIso && (
                <>
                  {" · "}
                  <LocalTime iso={o.lastPlayedIso} format="date" />
                </>
              )}
            </>
          ) : (
            "Scouted · not played yet"
          )}
        </div>
      </div>
      {o.gp > 0 && (
        <span className="tabular text-base font-black">
          <span className="text-[var(--win-fg)]">{o.wins}</span>-<span className="text-[var(--loss-fg)]">{o.losses}</span>
        </span>
      )}
    </Link>
  );
}
