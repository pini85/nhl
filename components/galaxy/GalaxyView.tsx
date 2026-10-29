"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, type ReactNode, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useMyId } from "@/components/club/YouHighlight";
import { HEX, type Mode, type Selection, type StatKey } from "@/components/galaxy/common";
import type { GalaxyData, GalaxyGame, GalaxyPlayer } from "@/lib/stats/galaxy";
import { cn } from "@/lib/utils";

// three.js only loads on this tab, and only in the browser.
const Stage = dynamic(() => import("@/components/galaxy/Stage"), { ssr: false, loading: () => <Igniting /> });

const MODES: { key: Mode; label: string }[] = [
  { key: "games", label: "Games" },
  { key: "chemistry", label: "Chemistry" },
  { key: "leaders", label: "Leaders" },
];

const STATS: { key: StatKey; label: string }[] = [
  { key: "points", label: "Points" },
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "hits", label: "Hits" },
  { key: "shots", label: "Shots" },
];

const HINT: Record<Mode, string> = {
  games: "Tap a star for the game · drag to spin · pinch to zoom",
  chemistry: "Tap a player to light up their links",
  leaders: "Tap a bar for the numbers · drag to look around",
};

export function GalaxyView({ data }: { data: GalaxyData }) {
  const [mode, setMode] = useState<Mode>("games");
  const [stat, setStat] = useState<StatKey>("points");
  const [selected, setSelected] = useState<Selection>(null);
  const myId = useMyId();
  const calm = useReducedMotion() ?? false;
  const myIndex = useMemo(() => {
    const i = data.players.findIndex((p) => p.id === myId);
    return i < 0 ? null : i;
  }, [data.players, myId]);

  const wins = data.games.filter((g) => g.win).length;
  const skaters = data.players.filter((p) => p.pos !== "G").length;
  const subtitle = {
    games: `${data.games.length} games · ${wins}-${data.games.length - wins} · newest at the core`,
    chemistry: `${data.players.length} players · ${data.links.length} links · 2+ games together`,
    leaders: `Top ${Math.min(12, skaters)} by ${STATS.find((s) => s.key === stat)!.label.toLowerCase()}`,
  }[mode];

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#02040a]">
      <div className="absolute inset-0">
        <StageBoundary>
          <Stage data={data} mode={mode} stat={stat} selected={selected} onSelect={setSelected} myIndex={myIndex} calm={calm} />
        </StageBoundary>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto max-w-md px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
        <h1 className="glow text-2xl font-black tracking-tight">Galaxy</h1>
        <p className="text-[11px] text-[var(--muted-fg)]">{subtitle}</p>

        <div
          role="tablist"
          aria-label="View"
          className="pointer-events-auto mt-2.5 grid grid-cols-3 rounded-full border border-[var(--card-border)] bg-[rgba(7,11,20,0.55)] p-1 backdrop-blur-md"
        >
          {MODES.map((m) => {
            const on = m.key === mode;
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setMode(m.key);
                  setSelected(null);
                }}
                className={cn("relative rounded-full py-1.5 text-xs font-semibold transition-colors", on ? "text-[var(--fg)]" : "text-[var(--muted-fg)]")}
              >
                {on && (
                  <motion.span
                    layoutId="galaxy-mode"
                    className="absolute inset-0 rounded-full bg-[rgba(92,200,255,0.18)] shadow-[0_0_18px_rgba(92,200,255,0.35)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{m.label}</span>
              </button>
            );
          })}
        </div>

        {mode === "leaders" && (
          <div className="no-scrollbar pointer-events-auto -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
            {STATS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={s.key === stat}
                onClick={() => {
                  setStat(s.key);
                  setSelected(null);
                }}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur-md transition-colors",
                  s.key === stat
                    ? "border-[var(--accent-blue)] bg-[rgba(92,200,255,0.18)] text-[var(--fg)]"
                    : "border-[var(--card-border)] bg-[rgba(7,11,20,0.55)] text-[var(--muted-fg)]",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <Legend mode={mode} stat={stat} you={myIndex !== null} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 z-10 mx-auto max-w-md px-4" style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}>
        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <motion.div
              key={`${selected.kind}-${selected.index}`}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22 }}
              className="arena-card pointer-events-auto relative bg-[rgba(7,11,20,0.78)] p-3.5 shadow-[0_0_30px_rgba(92,200,255,0.15)] backdrop-blur-md"
            >
              <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="absolute top-2 right-2 p-1 text-[var(--muted-fg)]">
                <X className="size-4" aria-hidden />
              </button>
              {selected.kind === "game" ? (
                <GameCard game={data.games[selected.index]} number={selected.index + 1} total={data.games.length} players={data.players} myIndex={myIndex} />
              ) : (
                <PlayerCard data={data} index={selected.index} mine={selected.index === myIndex} />
              )}
            </motion.div>
          ) : (
            <motion.p key={`hint-${mode}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-[11px] text-[var(--muted-fg)]">
              {HINT[mode]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Dot({ color, ring }: { color: string; ring?: boolean }) {
  return (
    <span
      className="inline-block size-2 rounded-full"
      style={ring ? { boxShadow: `0 0 0 1.5px ${color}`, background: "transparent" } : { background: color, boxShadow: `0 0 8px ${color}` }}
    />
  );
}

function Legend({ mode, stat, you }: { mode: Mode; stat: StatKey; you: boolean }) {
  const items: { color: string; label: string; ring?: boolean }[] =
    mode === "games"
      ? [
          { color: HEX.win, label: "Win" },
          { color: HEX.loss, label: "Loss" },
          { color: HEX.otLoss, label: "OT loss" },
          ...(you ? [{ color: HEX.you, label: "You played", ring: true }] : []),
        ]
      : mode === "chemistry"
        ? [
            { color: HEX.F, label: "Forward" },
            { color: HEX.D, label: "Defense" },
            { color: HEX.G, label: "Goalie" },
            ...(you ? [{ color: HEX.you, label: "You" }] : []),
          ]
        : stat === "points"
          ? [
              { color: HEX.goals, label: "Goals" },
              { color: HEX.assists, label: "Assists" },
              ...(you ? [{ color: HEX.you, label: "You" }] : []),
            ]
          : [{ color: HEX[stat], label: STATS.find((s) => s.key === stat)!.label }, ...(you ? [{ color: HEX.you, label: "You" }] : [])];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--muted-fg)]">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <Dot color={i.color} ring={i.ring} />
          {i.label}
        </span>
      ))}
      {mode === "chemistry" && (
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1 w-8 rounded-full" style={{ background: `linear-gradient(90deg, ${HEX.loss}, ${HEX.otLoss}, ${HEX.win})` }} />
          win % together
        </span>
      )}
    </div>
  );
}

const when = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

function GameCard({ game, number, total, players, myIndex }: { game: GalaxyGame; number: number; total: number; players: GalaxyPlayer[]; myIndex: number | null }) {
  const color = game.win ? HEX.win : game.ot ? HEX.otLoss : HEX.loss;
  const label = game.win ? (game.ot ? "OTW" : "W") : game.ot ? "OTL" : "L";
  return (
    <>
      <div className="flex items-center gap-2 pr-6">
        <span className="rounded-md px-1.5 py-0.5 text-xs font-black text-[#02040a]" style={{ background: color, boxShadow: `0 0 14px ${color}` }}>
          {label}
        </span>
        <span className="tabular text-xl font-black">
          {game.gf}–{game.ga}
        </span>
        <span className="min-w-0 truncate text-sm font-semibold">vs {game.opp ?? "Unknown club"}</span>
      </div>
      <p className="mt-1 text-[11px] text-[var(--muted-fg)]">
        {when.format(game.t)} · game {number} of {total}
      </p>
      {game.who.length > 0 && (
        <p className="mt-1.5 text-xs leading-relaxed">
          {game.who.map((i, k) => (
            <span key={i} style={i === myIndex ? { color: HEX.you, fontWeight: 700 } : undefined}>
              {k > 0 && <span className="text-[var(--muted-fg)]"> · </span>}
              {players[i].name}
            </span>
          ))}
        </p>
      )}
      <Link href={`/games/${game.id}`} className="mt-2 inline-block text-xs font-semibold text-[var(--accent-blue)]">
        Open game →
      </Link>
    </>
  );
}

const POS_LABEL = { F: "Forward", D: "Defense", G: "Goalie" } as const;

function PlayerCard({ data, index, mine }: { data: GalaxyData; index: number; mine: boolean }) {
  const p = data.players[index];
  const mates = data.links
    .filter((l) => l.a === p.id || l.b === p.id)
    .map((l) => ({ name: data.players.find((x) => x.id === (l.a === p.id ? l.b : l.a))?.name ?? "?", gp: l.gp, wins: l.wins }));
  const most = [...mates].sort((a, b) => b.gp - a.gp)[0];
  const best = mates.filter((m) => m.gp >= 3).sort((a, b) => b.wins / b.gp - a.wins / a.gp || b.gp - a.gp)[0];
  const tiles =
    p.pos === "G"
      ? [{ k: "GP", v: p.gp }]
      : [
          { k: "GP", v: p.gp },
          { k: "G", v: p.goals },
          { k: "A", v: p.assists },
          { k: "P", v: p.points },
          { k: "Hits", v: p.hits },
          { k: "+/-", v: p.plusMinus > 0 ? `+${p.plusMinus}` : p.plusMinus },
        ];
  return (
    <>
      <div className="flex items-baseline gap-2 pr-6">
        <span className="truncate text-base font-black" style={mine ? { color: HEX.you } : undefined}>
          {p.name}
        </span>
        <span className="shrink-0 text-[11px] text-[var(--muted-fg)]">
          {POS_LABEL[p.pos]}
          {mine && " · You"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1 text-center">
        {tiles.map((t) => (
          <div key={t.k} className="rounded-lg bg-white/[0.05] py-1">
            <div className="tabular text-sm font-black">{t.v}</div>
            <div className="text-[9px] text-[var(--muted-fg)]">{t.k}</div>
          </div>
        ))}
      </div>
      {(best || most) && (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted-fg)]">
          {best && (
            <>
              Best with <b className="text-[var(--fg)]">{best.name}</b> ({best.wins}-{best.gp - best.wins})
            </>
          )}
          {best && most && most.name !== best.name && " · "}
          {most && most.name !== best?.name && (
            <>
              Most games with <b className="text-[var(--fg)]">{most.name}</b> ({most.gp})
            </>
          )}
        </p>
      )}
      <Link href={`/players/${p.id}`} className="mt-2 inline-block text-xs font-semibold text-[var(--accent-blue)]">
        Player page →
      </Link>
    </>
  );
}

function Igniting() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="size-16 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(255,214,140,0.9)_0%,rgba(92,200,255,0.35)_35%,transparent_70%)] blur-[2px]" />
      <p className="text-xs tracking-[0.2em] text-[var(--muted-fg)] uppercase">Igniting the galaxy…</p>
    </div>
  );
}

/** If WebGL is missing or crashes, keep the page usable. */
class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="arena-card px-4 py-3 text-sm text-[var(--muted-fg)]">This phone or browser can&apos;t show the 3D view. Everything else in the app still works.</p>
      </div>
    );
  }
}
