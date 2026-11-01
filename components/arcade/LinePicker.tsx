"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { ArcadeData, ArcadeSkater } from "@/lib/stats/arcade";
import { cn } from "@/lib/utils";

const HOME = "#5cc8ff";

/** Your three skaters and goalie; tap a card to swap someone in. */
export function LinePicker({
  data,
  lineup,
  goalieId,
  myId,
  onLineup,
  title = "Your line · tap to swap",
}: {
  data: ArcadeData;
  lineup: string[];
  goalieId: string;
  myId: string | null;
  onLineup: (l: string[], g: string) => void;
  title?: string;
}) {
  const [swap, setSwap] = useState<number | null>(null); // slot being changed (3 = goalie)
  const byId = new Map(data.skaters.map((s) => [s.id, s]));
  const ours = lineup.map((id) => byId.get(id)!).filter(Boolean);
  const goalie = data.goalies.find((g) => g.id === goalieId) ?? data.goalies[0];
  return (
      <section className="arena-card mt-4 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">{title}</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ours.map((s, i) => (
            <PlayerCard key={s.id} s={s} you={s.id === myId} onClick={() => setSwap(swap === i ? null : i)} active={swap === i} color={HOME} />
          ))}
          <GoalieCard name={goalie.name} save={goalie.save} svPct={goalie.svPct} you={goalie.id === myId} onClick={() => setSwap(swap === 3 ? null : 3)} active={swap === 3} color={HOME} />
        </div>
        <AnimatePresence>
          {swap !== null && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <p className="mt-3 mb-1.5 text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">{swap === 3 ? "Pick a goalie" : "Bring in"}</p>
              <ul className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {swap === 3
                  ? data.goalies.map((g) => (
                      <li key={g.id} className="w-36 shrink-0">
                        <GoalieCard
                          name={g.name}
                          save={g.save}
                          svPct={g.svPct}
                          you={g.id === myId}
                          active={g.id === goalie.id}
                          color={HOME}
                          onClick={() => {
                            onLineup(lineup, g.id);
                            setSwap(null);
                          }}
                        />
                      </li>
                    ))
                  : data.skaters
                      .filter((s) => !lineup.includes(s.id))
                      .map((s) => (
                        <li key={s.id} className="w-36 shrink-0">
                          <PlayerCard
                            s={s}
                            you={s.id === myId}
                            color={HOME}
                            onClick={() => {
                              const l = [...lineup];
                              l[swap] = s.id;
                              onLineup(l, goalie.id);
                              setSwap(null);
                            }}
                          />
                        </li>
                      ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

  );
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center gap-1.5 text-[9px] text-[var(--muted-fg)]">
      <span className="w-6 font-bold">{label}</span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
        <span className="block h-full rounded-full bg-[var(--accent-blue)]" style={{ width: `${((v - 55) / 44) * 100}%` }} />
      </span>
      <span className="tabular w-4 text-right text-[var(--fg)]">{v}</span>
    </div>
  );
}

export function PlayerCard({ s, you, onClick, active, color }: { s: ArcadeSkater; you?: boolean; onClick?: () => void; active?: boolean; color: string }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn("block w-full rounded-xl bg-[rgba(255,255,255,0.04)] p-2.5 text-left ring-1 ring-[rgba(255,255,255,0.06)]", active && "ring-[var(--accent-blue)]", you && "ring-[#ffcf5a]")}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className={cn("truncate text-xs font-black", you && "text-[#ffcf5a]")}>{s.name}</p>
          <p className="text-[10px] text-[var(--muted-fg)]">
            #{s.number} · {s.pos === "D" ? "Defense" : "Forward"}
            {you && " · You"}
          </p>
        </div>
        <span className="tabular text-lg leading-none font-black" style={{ color }}>
          {s.ovr}
        </span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        <Bar label="SKT" v={s.r.skate} />
        <Bar label="SHT" v={s.r.shot} />
        <Bar label="PAS" v={s.r.pass} />
        <Bar label="HIT" v={s.r.hit} />
      </div>
    </Tag>
  );
}

export function GoalieCard({ name, save, svPct, you, onClick, active, color }: { name: string; save: number; svPct: number; you?: boolean; onClick?: () => void; active?: boolean; color: string }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn("flex w-full flex-col rounded-xl bg-[rgba(255,255,255,0.04)] p-2.5 text-left ring-1 ring-[rgba(255,255,255,0.06)]", active && "ring-[var(--accent-blue)]", you && "ring-[#ffcf5a]")}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className={cn("truncate text-xs font-black", you && "text-[#ffcf5a]")}>{name}</p>
          <p className="text-[10px] text-[var(--muted-fg)]">Goalie{svPct > 0 ? ` · ${svPct.toFixed(3).replace(/^0/, "")}` : ""}</p>
        </div>
        <span className="tabular text-lg leading-none font-black" style={{ color }}>
          {save}
        </span>
      </div>
      <div className="mt-1.5">
        <Bar label="SAVE" v={save} />
      </div>
      <p className="mt-auto pt-1 text-[22px] leading-none">🥅</p>
    </Tag>
  );
}

