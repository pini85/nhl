"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, Crown, Flame, Gamepad2, Repeat, Skull, Swords, Trophy, Volume2, VolumeX } from "lucide-react";
import dynamic from "next/dynamic";
import { type ReactNode, useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Sound } from "@/components/arcade/audio";
import type { MatchResult } from "@/components/arcade/Game";
import { nextStop, parseProgress, type Progress, recordResult, saveProgress } from "@/components/arcade/progress";
import { buildSetup, validLineup } from "@/components/arcade/setup";
import type { MatchSetup } from "@/components/arcade/engine/types";
import { useMyId } from "@/components/club/YouHighlight";
import type { ArcadeData, ArcadeOpponent, ArcadeSkater } from "@/lib/stats/arcade";
import { cn } from "@/lib/utils";

// The game (engine + canvas) only loads when a match starts, and only in the browser.
const Game = dynamic(() => import("@/components/arcade/Game"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-[70] grid place-items-center bg-[#03060d] text-sm text-[var(--muted-fg)]">Flooding the ice…</div>,
});

const KEY = "ddd-arcade-v1";
const CHANGED = "ddd:arcade";
const subscribe = (f: () => void) => {
  window.addEventListener(CHANGED, f);
  window.addEventListener("storage", f);
  return () => {
    window.removeEventListener(CHANGED, f);
    window.removeEventListener("storage", f);
  };
};
const readRaw = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

function useProgress(): [Progress, (p: Progress) => void] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const [fallback, setFallback] = useState<Progress | null>(null); // when storage is unavailable
  const p = useMemo(() => fallback ?? parseProgress(raw), [raw, fallback]);
  const set = useCallback((next: Progress) => {
    saveProgress(next);
    if (readRaw() === null) setFallback(next);
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return [p, set];
}

type Screen = { kind: "home" } | { kind: "tour" } | { kind: "exhibition" } | { kind: "matchup"; clubId: number; tour: boolean } | { kind: "result"; clubId: number; tour: boolean; result: MatchResult };

const HOME = "#5cc8ff";

export function ArcadeView({ data }: { data: ArcadeData }) {
  const myId = useMyId();
  const calm = useReducedMotion() ?? false;
  const [progress, setProgress] = useProgress();
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [playing, setPlaying] = useState<{ setup: MatchSetup; label: string; key: number } | null>(null);
  const [sound] = useState(() => new Sound()); // inert until start() inside a tap
  const p = progress;

  const lineup = useMemo(() => validLineup(data, p.lineup, myId), [data, p.lineup, myId]);
  const goalieId = data.goalies.some((g) => g.id === p.goalie) ? p.goalie! : data.goalies[0].id;
  const opp = (id: number) => data.opponents.find((o) => o.clubId === id)!;
  const next = nextStop(data.tour, p.avenged);

  const start = (clubId: number, tour: boolean) => {
    sound.setMuted(p.muted);
    sound.start(); // inside the tap, so iOS allows audio
    const stop = tour ? data.tour.indexOf(clubId) : null;
    const setup = buildSetup(data, opp(clubId), lineup, goalieId, myId, { insane: p.insane, stop, seed: Math.floor(Math.random() * 1e9) });
    const label = tour ? `REVENGE TOUR · STOP ${stop! + 1} OF ${data.tour.length}` : "EXHIBITION";
    setPlaying({ setup, label, key: Date.now() });
  };

  const finished = (clubId: number, tour: boolean, result: MatchResult) => {
    setProgress(recordResult(p, clubId, result.score[0] > result.score[1], tour));
    setPlaying(null);
    setScreen({ kind: "result", clubId, tour, result });
    window.scrollTo(0, 0);
  };

  const go = (s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={screen.kind} initial={calm ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {screen.kind === "home" && (
            <Home
              data={data}
              progress={p}
              next={next}
              onTour={() => go({ kind: "tour" })}
              onNext={() => next !== null && go({ kind: "matchup", clubId: next, tour: true })}
              onExhibition={() => go({ kind: "exhibition" })}
              onToggle={(k) => setProgress({ ...p, [k]: !p[k] })}
            />
          )}
          {screen.kind === "tour" && <Tour data={data} avenged={p.avenged} next={next} onBack={() => go({ kind: "home" })} onPick={(id) => go({ kind: "matchup", clubId: id, tour: true })} />}
          {screen.kind === "exhibition" && <Exhibition data={data} onBack={() => go({ kind: "home" })} onPick={(id) => go({ kind: "matchup", clubId: id, tour: data.tour.includes(id) })} />}
          {screen.kind === "matchup" && (
            <Matchup
              data={data}
              opp={opp(screen.clubId)}
              tour={screen.tour}
              stop={screen.tour ? data.tour.indexOf(screen.clubId) : -1}
              lineup={lineup}
              goalieId={goalieId}
              myId={myId}
              insane={p.insane}
              avenged={p.avenged.includes(screen.clubId)}
              onLineup={(l, g) => setProgress({ ...p, lineup: l, goalie: g })}
              onBack={() => go({ kind: screen.tour ? "tour" : "exhibition" })}
              onStart={() => start(screen.clubId, screen.tour)}
            />
          )}
          {screen.kind === "result" && (
            <Result
              data={data}
              opp={opp(screen.clubId)}
              tour={screen.tour}
              result={screen.result}
              next={next}
              onRematch={() => start(screen.clubId, screen.tour)}
              onNext={() => next !== null && go({ kind: "matchup", clubId: next, tour: true })}
              onMenu={() => go({ kind: "home" })}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {playing && (
        <Game
          key={playing.key}
          setup={playing.setup}
          label={playing.label}
          sound={sound}
          muted={p.muted}
          calm={calm}
          onMute={(m) => setProgress({ ...p, muted: m })}
          onQuit={() => setPlaying(null)}
          onEnd={(r) => {
            const s = screen.kind === "matchup" || screen.kind === "result" ? screen : null;
            if (s) finished(s.clubId, s.tour, r);
          }}
        />
      )}
    </div>
  );
}

// ————— screens —————

function Home({
  data,
  progress,
  next,
  onTour,
  onNext,
  onExhibition,
  onToggle,
}: {
  data: ArcadeData;
  progress: Progress;
  next: number | null;
  onTour: () => void;
  onNext: () => void;
  onExhibition: () => void;
  onToggle: (k: "insane" | "muted") => void;
}) {
  const done = data.tour.filter((id) => progress.avenged.includes(id)).length;
  const total = data.tour.length;
  const n = next !== null ? data.opponents.find((o) => o.clubId === next)! : null;
  return (
    <>
      <div className="relative -mx-4 overflow-hidden px-4 pt-2 pb-5">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(92,200,255,0.28),transparent_65%)]" />
        <p className="relative text-[10px] font-bold tracking-[0.3em] text-[var(--accent-blue)]">DROP DROP DROP ARCADE</p>
        <h1 className="glow relative mt-1 text-5xl leading-[0.9] font-black tracking-tight italic">
          REVENGE
          <br />
          TOUR
        </h1>
        <p className="relative mt-2 text-sm text-[var(--muted-fg)]">3-on-3. Our real players, rated from real stats, against the real clubs that beat us.</p>
        <Puck />
      </div>

      {total > 0 ? (
        <section className="arena-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">Revenge Tour</h2>
            <span className="tabular text-xs font-bold">
              {done}/{total} avenged
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#5cc8ff] to-[#ffcf5a]" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          {n ? (
            <button type="button" onClick={onNext} className="mt-3 flex w-full items-center gap-3 rounded-xl bg-[rgba(92,200,255,0.12)] p-3 text-left ring-1 ring-[var(--card-border)] active:scale-[0.99]">
              <ClubBadge abbr={n.abbr} color={n.color} />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold tracking-wider text-[var(--accent-blue)]">NEXT STOP</span>
                <span className="block truncate font-black">{n.name}</span>
                <span className="block text-xs text-[var(--muted-fg)]">{grudge(n)}</span>
              </span>
              <Swords className="size-5 text-[var(--accent-blue)]" aria-hidden />
            </button>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-sm font-bold text-[#ffcf5a]">
              <Crown className="size-4" aria-hidden /> Every grudge settled. Legend status.
            </p>
          )}
          <button type="button" onClick={onTour} className="mt-2 w-full py-1.5 text-xs font-semibold text-[var(--muted-fg)]">
            See every stop →
          </button>
        </section>
      ) : (
        <section className="arena-card p-4 text-sm">
          <p className="font-bold">No grudges yet 😇</p>
          <p className="mt-1 text-[var(--muted-fg)]">Nobody has a winning record against us. Play an exhibition instead.</p>
        </section>
      )}

      <button type="button" onClick={onExhibition} className="arena-card mt-3 flex w-full items-center gap-3 p-4 text-left active:scale-[0.99]">
        <Gamepad2 className="size-6 text-[var(--accent-blue)]" aria-hidden />
        <span className="flex-1">
          <span className="block font-black">Exhibition</span>
          <span className="block text-xs text-[var(--muted-fg)]">Any of the {data.opponents.length} clubs we&apos;ve played</span>
        </span>
        <span aria-hidden>→</span>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Toggle on={progress.insane} onClick={() => onToggle("insane")} icon={<Flame className="size-4" aria-hidden />} title="INSANE mode" hint="2 pucks · turbo · huge hits" hot />
        <Toggle on={!progress.muted} onClick={() => onToggle("muted")} icon={progress.muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />} title="Sound" hint="Horn, organ, crowd" />
      </div>

      <section className="arena-card mt-3 p-4">
        <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">How to play</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-black text-[var(--accent-blue)]">LEFT THUMB</p>
            <p className="mt-1 text-[var(--muted-fg)]">Drag anywhere to skate. Push far for a burst.</p>
          </div>
          <div>
            <p className="font-black text-[var(--accent-blue)]">RIGHT THUMB</p>
            <ul className="mt-1 space-y-0.5 text-[var(--muted-fg)]">
              <li>
                <b className="text-[var(--fg)]">Tap</b> pass / switch
              </li>
              <li>
                <b className="text-[var(--fg)]">Swipe</b> shoot / hit
              </li>
              <li>
                <b className="text-[var(--fg)]">Hold</b> slapshot / poke
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--muted-fg)]">
          Shoot right after a pass for a <b className="text-[var(--fg)]">one-timer</b>. Score twice in a row and you&apos;re <b className="text-[#ff7a1a]">ON FIRE</b>.
        </p>
      </section>

      {progress.wins + progress.losses > 0 && (
        <p className="mt-3 text-center text-xs text-[var(--muted-fg)]">
          Arcade record on this phone: <b className="tabular text-[var(--fg)]">{progress.wins}-{progress.losses}</b>
        </p>
      )}
    </>
  );
}

function Tour({ data, avenged, next, onBack, onPick }: { data: ArcadeData; avenged: number[]; next: number | null; onBack: () => void; onPick: (id: number) => void }) {
  return (
    <>
      <Back onClick={onBack} />
      <h1 className="text-2xl font-black italic">Revenge Tour</h1>
      <p className="text-xs text-[var(--muted-fg)]">Every club with a winning or even record against us. The real nemesis waits at the end.</p>
      <ol className="mt-3 space-y-2">
        {data.tour.map((id, i) => {
          const o = data.opponents.find((x) => x.clubId === id)!;
          const done = avenged.includes(id);
          const boss = i === data.tour.length - 1 && data.tour.length > 1;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onPick(id)}
                className={cn("arena-card relative flex w-full items-center gap-3 overflow-hidden p-3 text-left active:scale-[0.99]", id === next && "ring-1 ring-[var(--accent-blue)]")}
              >
                <span className="tabular w-5 text-center text-xs font-black text-[var(--muted-fg)]">{i + 1}</span>
                <ClubBadge abbr={o.abbr} color={o.color} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-black">
                    <span className="truncate">{o.name}</span>
                    {boss && <Skull className="size-3.5 shrink-0 text-[#ff3d6e]" aria-label="Nemesis" />}
                  </span>
                  <span className="block text-xs text-[var(--muted-fg)]">{grudge(o)}</span>
                  <Heat value={o.difficulty} />
                </span>
                {done ? <Stamp text="AVENGED" /> : id === next ? <span className="text-[10px] font-black text-[var(--accent-blue)]">NEXT</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Exhibition({ data, onBack, onPick }: { data: ArcadeData; onBack: () => void; onPick: (id: number) => void }) {
  return (
    <>
      <Back onClick={onBack} />
      <h1 className="text-2xl font-black italic">Exhibition</h1>
      <p className="text-xs text-[var(--muted-fg)]">Pick any club we&apos;ve played. Most played first.</p>
      <ul className="mt-3 space-y-2">
        {data.opponents.map((o) => (
          <li key={o.clubId}>
            <button type="button" onClick={() => onPick(o.clubId)} className="arena-card flex w-full items-center gap-3 p-3 text-left active:scale-[0.99]">
              <ClubBadge abbr={o.abbr} color={o.color} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-black">{o.name}</span>
                <span className="block text-xs text-[var(--muted-fg)]">
                  Real record <b className="tabular text-[var(--fg)]">{o.wins}-{o.losses}</b> · goals {o.gf}-{o.ga}
                </span>
              </span>
              <Heat value={o.difficulty} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Matchup({
  data,
  opp,
  tour,
  stop,
  lineup,
  goalieId,
  myId,
  insane,
  avenged,
  onLineup,
  onBack,
  onStart,
}: {
  data: ArcadeData;
  opp: ArcadeOpponent;
  tour: boolean;
  stop: number;
  lineup: string[];
  goalieId: string;
  myId: string | null;
  insane: boolean;
  avenged: boolean;
  onLineup: (l: string[], g: string) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const [swap, setSwap] = useState<number | null>(null); // slot being changed (3 = goalie)
  const byId = new Map(data.skaters.map((s) => [s.id, s]));
  const ours = lineup.map((id) => byId.get(id)!).filter(Boolean);
  const goalie = data.goalies.find((g) => g.id === goalieId) ?? data.goalies[0];
  const ovr = (list: ArcadeSkater[]) => Math.round(list.reduce((s, x) => s + x.ovr, 0) / Math.max(1, list.length));
  return (
    <>
      <Back onClick={onBack} />
      <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--accent-blue)]">{tour ? `REVENGE TOUR · STOP ${stop + 1}/${data.tour.length}` : "EXHIBITION"}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-1">
          <ClubBadge abbr="DDD" color={HOME} big />
          <span className="tabular text-xs text-[var(--muted-fg)]">OVR {ovr(ours)}</span>
        </div>
        <span className="text-3xl font-black text-[var(--muted-fg)] italic">VS</span>
        <div className="flex flex-col items-center gap-1">
          <ClubBadge abbr={opp.abbr} color={opp.color} big />
          <span className="tabular text-xs text-[var(--muted-fg)]">OVR {ovr(opp.skaters)}</span>
        </div>
      </div>
      <h1 className="mt-2 text-center text-xl font-black">{opp.name}</h1>
      <p className="mx-auto mt-1 max-w-xs text-center text-sm text-[var(--muted-fg)]">{story(opp)}</p>
      <div className="mt-1 flex justify-center">
        <Heat value={opp.difficulty} label />
      </div>
      {avenged && (
        <div className="mt-2 flex justify-center">
          <Stamp text="AVENGED" />
        </div>
      )}

      <section className="arena-card mt-4 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">Your line · tap to swap</h2>
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

      <section className="arena-card mt-3 p-3">
        <h2 className="mb-2 text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">Their line · from our box scores</h2>
        <div className="grid grid-cols-2 gap-2">
          {opp.skaters.map((s) => (
            <PlayerCard key={s.id} s={s} color={opp.color} />
          ))}
          <GoalieCard name={opp.goalie.name} save={opp.goalie.save} svPct={opp.goalie.svPct} color={opp.color} />
        </div>
      </section>

      <div className="sticky bottom-24 z-10 mt-4">
        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-full bg-gradient-to-r from-[#5cc8ff] to-[#7ee0ff] py-4 text-lg font-black tracking-wide text-[#04101f] italic shadow-[0_0_30px_rgba(92,200,255,0.45)] active:scale-[0.98]"
        >
          DROP THE PUCK {insane && "🔥"}
        </button>
      </div>
    </>
  );
}

function Result({
  data,
  opp,
  tour,
  result,
  next,
  onRematch,
  onNext,
  onMenu,
}: {
  data: ArcadeData;
  opp: ArcadeOpponent;
  tour: boolean;
  result: MatchResult;
  next: number | null;
  onRematch: () => void;
  onNext: () => void;
  onMenu: () => void;
}) {
  const won = result.score[0] > result.score[1];
  const stars = [...result.players]
    .map((p) => ({ p, v: p.goals * 3 + p.assists * 2 + p.hits * 0.4 + p.saves * 0.25 + (p.team === (won ? 0 : 1) ? 0.5 : 0) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 3);
  const ours = result.players.filter((p) => p.team === 0);
  const lastWasLoss = !opp.last.win;
  const n = next !== null ? data.opponents.find((o) => o.clubId === next) : null;
  return (
    <>
      <div className="relative -mx-4 overflow-hidden px-4 pt-4 pb-2 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${won ? "rgba(255,207,90,0.3)" : "rgba(255,61,110,0.25)"}, transparent 65%)` }}
        />
        <p className="relative text-[10px] font-bold tracking-[0.3em] text-[var(--muted-fg)]">{result.ot ? "FINAL · OVERTIME" : "FINAL"}</p>
        <h1 className={cn("relative mt-1 text-5xl font-black tracking-tight italic", won ? "text-[#ffcf5a]" : "text-[#ff7a8a]")}>{won ? (tour ? "AVENGED!" : "VICTORY") : "DEFEAT"}</h1>
        <div className="relative mt-3 flex items-center justify-center gap-4">
          <ClubBadge abbr="DDD" color={HOME} />
          <span className="tabular text-5xl font-black">
            {result.score[0]}
            <span className="mx-2 text-[var(--muted-fg)]">–</span>
            {result.score[1]}
          </span>
          <ClubBadge abbr={opp.abbr} color={opp.color} />
        </div>
        <p className="relative mt-1 text-xs text-[var(--muted-fg)]">
          Shots {result.sog[0]}–{result.sog[1]}
        </p>
        <p className="relative mx-auto mt-3 max-w-xs text-sm">
          {won
            ? lastWasLoss
              ? `Real life: they won ${opp.last.ga}-${opp.last.gf}. Arcade: justice.`
              : `They never stood a chance. Real record ${opp.wins}-${opp.losses}, now with interest.`
            : `${opp.name} got you again. Run it back.`}
        </p>
      </div>

      <section className="arena-card mt-3 p-3">
        <h2 className="mb-2 text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">Three stars</h2>
        <ol className="space-y-1.5">
          {stars.map(({ p }, i) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span className="text-[#ffcf5a]">{"★".repeat(3 - i)}</span>
              <span className={cn("flex-1 truncate font-bold", p.you && "text-[#ffcf5a]")}>{p.name}</span>
              <span className="tabular text-xs text-[var(--muted-fg)]">{p.goalie ? `${p.saves} saves` : `${p.goals}G ${p.assists}A ${p.hits}H`}</span>
              <span className="size-2 rounded-full" style={{ background: p.team === 0 ? HOME : opp.color }} />
            </li>
          ))}
        </ol>
      </section>

      <section className="arena-card mt-3 p-3">
        <h2 className="mb-2 text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">Your line</h2>
        <table className="tabular w-full text-sm">
          <thead>
            <tr className="text-[10px] text-[var(--muted-fg)]">
              <th className="text-left font-semibold">Player</th>
              <th className="w-8 font-semibold">G</th>
              <th className="w-8 font-semibold">A</th>
              <th className="w-8 font-semibold">SOG</th>
              <th className="w-8 font-semibold">H</th>
            </tr>
          </thead>
          <tbody>
            {ours.map((p) => (
              <tr key={p.id}>
                <td className={cn("truncate py-0.5", p.you && "font-bold text-[#ffcf5a]")}>{p.name}</td>
                <td className="text-center">{p.goalie ? "" : p.goals}</td>
                <td className="text-center">{p.goalie ? "" : p.assists}</td>
                <td className="text-center">{p.goalie ? "" : p.shots}</td>
                <td className="text-center">{p.goalie ? `${p.saves}sv` : p.hits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-4 space-y-2">
        {tour && won && n && (
          <button type="button" onClick={onNext} className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-blue)] py-3.5 font-black text-[#04101f] italic">
            <Trophy className="size-4" aria-hidden /> NEXT: {n.name}
          </button>
        )}
        {tour && won && !n && <p className="text-center font-black text-[#ffcf5a]">🏆 TOUR COMPLETE. EVERY GRUDGE SETTLED.</p>}
        <button
          type="button"
          onClick={onRematch}
          className={cn("flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-black italic", tour && won && n ? "border border-[var(--card-border)]" : "bg-[var(--accent-blue)] text-[#04101f]")}
        >
          <Repeat className="size-4" aria-hidden /> {won ? "PLAY AGAIN" : "REMATCH"}
        </button>
        <button type="button" onClick={onMenu} className="w-full py-2 text-sm font-semibold text-[var(--muted-fg)]">
          Arcade menu
        </button>
      </div>
    </>
  );
}

// ————— pieces —————

function grudge(o: ArcadeOpponent) {
  const last = `last ${o.last.win ? "W" : "L"} ${o.last.gf}-${o.last.ga}`;
  return `Real ${o.wins}-${o.losses} · ${last}`;
}

function story(o: ArcadeOpponent) {
  if (o.losses > o.wins) return o.gp === 1 ? `They beat us ${o.last.ga}-${o.last.gf} in our only game. Time to settle it.` : `${o.losses} wins to ${o.wins} for them in real life. Goals ${o.ga}-${o.gf}. Not anymore.`;
  if (o.losses === o.wins) return `Dead even in real life at ${o.wins}-${o.losses}. Break the tie.`;
  return `We're ${o.wins}-${o.losses} against them for real. Keep it that way.`;
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="-ml-1 mb-2 flex items-center gap-0.5 py-1 text-sm text-[var(--muted-fg)]">
      <ChevronLeft className="size-4" aria-hidden /> Back
    </button>
  );
}

function ClubBadge({ abbr, color, big }: { abbr: string; color: string; big?: boolean }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-xl font-black tracking-tight text-[#04101f] italic", big ? "size-16 text-lg" : "size-11 text-xs")}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, boxShadow: `0 0 18px ${color}55` }}
    >
      {abbr}
    </span>
  );
}

function Heat({ value, label }: { value: number; label?: boolean }) {
  const n = Math.max(1, Math.min(5, Math.round(value * 4) + 1));
  const words = ["Warm-up", "Fair fight", "Tough", "Brutal", "Nightmare"];
  return (
    <span className="mt-0.5 inline-flex items-center gap-1" aria-label={`Difficulty ${n} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Flame key={i} className={cn("size-3", i < n ? "text-[#ff7a1a]" : "text-[rgba(255,255,255,0.15)]")} aria-hidden />
      ))}
      {label && <span className="ml-1 text-xs font-bold text-[#ff7a1a]">{words[n - 1]}</span>}
    </span>
  );
}

function Stamp({ text }: { text: string }) {
  return <span className="shrink-0 -rotate-12 rounded-md border-2 border-[#5dffa8] px-1.5 py-0.5 text-[10px] font-black tracking-widest text-[#5dffa8]">{text}</span>;
}

function Toggle({ on, onClick, icon, title, hint, hot }: { on: boolean; onClick: () => void; icon: ReactNode; title: string; hint: string; hot?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "arena-card flex flex-col items-start gap-1 p-3 text-left transition-shadow",
        on && (hot ? "shadow-[0_0_24px_rgba(255,122,26,0.45)] ring-1 ring-[#ff7a1a]" : "ring-1 ring-[var(--accent-blue)]"),
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-sm font-black", on ? (hot ? "text-[#ff7a1a]" : "text-[var(--accent-blue)]") : "text-[var(--fg)]")}>
        {icon} {title}
      </span>
      <span className="text-[11px] text-[var(--muted-fg)]">{hint}</span>
      <span className={cn("mt-1 text-[10px] font-black tracking-widest", on ? "text-[var(--fg)]" : "text-[var(--muted-fg)]")}>{on ? "ON" : "OFF"}</span>
    </button>
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

function PlayerCard({ s, you, onClick, active, color }: { s: ArcadeSkater; you?: boolean; onClick?: () => void; active?: boolean; color: string }) {
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

function GoalieCard({ name, save, svPct, you, onClick, active, color }: { name: string; save: number; svPct: number; you?: boolean; onClick?: () => void; active?: boolean; color: string }) {
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

function Puck() {
  return (
    <motion.div
      aria-hidden
      className="absolute top-6 right-6 size-10 rounded-full bg-[#0b0d12] shadow-[0_0_0_2px_rgba(255,255,255,0.15),0_10px_30px_rgba(92,200,255,0.35)]"
      animate={{ rotate: [0, 360], y: [0, -6, 0] }}
      transition={{ rotate: { duration: 6, repeat: Infinity, ease: "linear" }, y: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } }}
    >
      <span className="absolute inset-1.5 rounded-full border border-[rgba(255,255,255,0.12)]" />
    </motion.div>
  );
}
