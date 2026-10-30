"use client";

import { Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Sound } from "@/components/arcade/audio";
import { goalLine, goalWord, hitLine, hitWord, postLine, saveLine } from "@/components/arcade/commentary";
import { createMatch, dist } from "@/components/arcade/engine/core";
import { RINK } from "@/components/arcade/engine/rink";
import { STEP, step } from "@/components/arcade/engine/sim";
import type { GameEvent, MatchSetup, MatchState } from "@/components/arcade/engine/types";
import { Controls } from "@/components/arcade/input";
import { Renderer } from "@/components/arcade/render";

export type PlayerResult = { id: string; name: string; team: 0 | 1; goalie: boolean; goals: number; assists: number; shots: number; hits: number; saves: number; you: boolean };
export type MatchResult = { score: [number, number]; sog: [number, number]; ot: boolean; players: PlayerResult[] };

type Props = {
  setup: MatchSetup;
  label: string;
  sound: Sound;
  muted: boolean;
  calm: boolean;
  onMute: (m: boolean) => void;
  onEnd: (r: MatchResult) => void;
  onQuit: () => void;
};

const HOME = "#5cc8ff";

export default function Game({ setup, label, sound, muted, calm, onMute, onEnd, onQuit }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const done = useRef({ onEnd, onQuit });
  useEffect(() => {
    pausedRef.current = paused;
    done.current = { onEnd, onQuit };
  });

  useEffect(() => {
    const el = wrap.current!;
    const cv = canvas.current!;
    const r = new Renderer(cv);
    r.calm = calm;
    const haptic = (p: number | number[]) => {
      try {
        navigator.vibrate?.(p);
      } catch {}
    };
    const controls = new Controls(el, haptic);
    const state = createMatch(setup);
    const name = (i: number) => state.skaters[i]?.info.name ?? "";

    const fit = () => {
      const b = el.getBoundingClientRect();
      const cs = measure.current ? getComputedStyle(measure.current) : null;
      r.insets = { top: cs ? parseFloat(cs.paddingTop) : 0, bottom: cs ? parseFloat(cs.paddingBottom) : 0 };
      r.resize(b.width, b.height, window.devicePixelRatio || 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    r.banner(setup.away.name.toUpperCase(), label, setup.away.color, true, 2.6);
    sound.whistle();

    const handle = (e: GameEvent) => {
      const ours = (i: number) => state.skaters[i]?.team === 0;
      switch (e.kind) {
        case "shot":
          sound.shot(e.power, e.slap);
          if (ours(e.by)) haptic(8);
          if (e.oneTimer) r.float("ONE-TIMER!", e.x, e.y, HOME);
          else if (e.slap) {
            r.float("SLAPPER!", e.x, e.y, "#ffd23d");
            r.shake(4);
          }
          r.burst("snow", e.x, e.y, 6, "#ffffff", 5);
          break;
        case "pass":
          sound.pass();
          break;
        case "hit": {
          sound.hit(e.power);
          r.shake(Math.min(16, 3 + e.power * 0.5));
          r.ring(e.x, e.y, "#ffffff", 2.5 + e.power * 0.1);
          r.burst("snow", e.x, e.y, 14, "#ffffff", 9);
          r.burst("star", e.x, e.y, 4, "#ffd23d", 5, 0.4);
          r.float(hitWord(), e.x, e.y, ours(e.by) ? HOME : setup.away.color);
          if (ours(e.by) || ours(e.victim)) haptic(e.power > 10 ? [25, 20, 35] : 25);
          if (e.power > 9) r.say(hitLine(name(e.by), name(e.victim)));
          break;
        }
        case "poke":
          if (e.won) {
            sound.steal();
            r.float("POKED!", e.x, e.y, ours(e.by) ? HOME : setup.away.color);
          }
          break;
        case "steal":
          sound.steal();
          if (ours(e.by)) haptic(10);
          break;
        case "post":
          sound.post();
          r.burst("spark", e.x, e.y, 16, ["#ffd23d", "#ffffff"], 12, 0.12);
          r.float("DING!", e.x, e.y, "#ffd23d");
          r.shake(4);
          r.say(postLine());
          haptic(15);
          break;
        case "boards":
          sound.boards(e.power);
          if (e.power > 18) r.burst("snow", e.x, e.y, 5, "#ffffff", 4);
          break;
        case "save": {
          sound.save();
          r.burst("spark", e.x, e.y, 8, "#ffffff", 7, 0.1);
          if (e.held) r.float("SAVE!", e.x, e.y, "#ffffff");
          if (Math.random() < 0.35) r.say(saveLine(name(e.by)));
          break;
        }
        case "block":
          sound.boards(12);
          r.float("BLOCKED!", e.x, e.y, "#ffffff");
          break;
        case "goal": {
          const us = e.team === 0;
          const color = us ? HOME : setup.away.color;
          sound.horn(us);
          r.flashScreen(color, 0.4);
          r.shake(us ? 14 : 8);
          r.netBulge(e.team === 0 ? 1 : -1);
          r.burst("confetti", e.x, e.y + (us ? -1 : 1), us ? 90 : 40, [color, "#ffffff", us ? "#ffcf5a" : color], 11, 0.22);
          r.ring(e.x, e.y, color, 6);
          const who = e.scorer >= 0 ? `#${state.skaters[e.scorer].info.number} ${name(e.scorer)}` : "";
          const sub = [who, e.assists.length ? `from ${e.assists.map(name).join(", ")}` : ""].filter(Boolean).join(" · ");
          r.banner(e.hatTrick ? "HAT TRICK!" : goalWord(us), sub, color, true, 2.8);
          if (e.hatTrick) r.hats();
          if (e.scorer >= 0) r.say(goalLine(name(e.scorer), { oneTimer: e.oneTimer, fire: e.fire, ours: us }));
          haptic(us ? [40, 40, 90] : 60);
          if (us && state.score[0] - state.score[1] >= 3) {
            sound.chant();
            setTimeout(() => r.banner("DROP! DROP! DROP!", "", "#ffcf5a", false, 2), 1400);
          }
          break;
        }
        case "fire":
          r.banner("ON FIRE!", name(e.who), "#ff7a1a", false, 2.2);
          sound.organ();
          break;
        case "faceoff":
          sound.whistle();
          break;
        case "drop":
          sound.pass();
          break;
        case "overtime":
          r.banner("OVERTIME", "Next goal wins", "#ffb648", true, 2.4);
          sound.whistle();
          break;
        case "end": {
          const won = e.winner === 0;
          sound.end(won);
          r.banner(won ? "YOU WIN!" : "FINAL", `${state.score[0]} – ${state.score[1]}`, won ? "#ffcf5a" : "#ff7a8a", true, 3);
          if (won) r.burst("confetti", 0, state.skaters[0].y, 120, [HOME, "#ffcf5a", "#ffffff"], 14, 0.25);
          haptic(won ? [60, 50, 60, 50, 120] : 80);
          break;
        }
        default:
          break;
      }
    };

    let last = performance.now();
    let acc = 0;
    let raf = 0;
    let ended = false;
    let started = 0;
    const focusOf = (s: MatchState) => {
      const me = s.skaters[s.controlled];
      const p = s.pucks.find((q) => q.owner === s.controlled) ?? s.pucks.slice().sort((a, b) => dist(a.x, a.y, me.x, me.y) - dist(b.x, b.y, me.x, me.y))[0];
      return p ?? { x: 0, y: 0, vx: 0, vy: 0 };
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (pausedRef.current) return;
      started += dt;
      if (state.freeze > 0) state.freeze -= dt;
      else acc += dt * state.timeScale * (setup.insane ? 1.22 : 1);
      let n = 0;
      while (acc >= STEP && n < 16) {
        step(state, controls.take());
        acc -= STEP;
        n++;
        for (const e of state.events) handle(e);
        state.events.length = 0;
        if (state.freeze > 0) {
          acc = 0;
          break;
        }
      }
      if (n >= 16) acc = 0;
      r.joy = controls.joy;
      if (controls.used && started > 4) r.hint = Math.max(0, r.hint - dt * 0.5);
      // The crowd gets louder near either net.
      const p = focusOf(state);
      sound.excitement(Math.max(0, 1 - (RINK.goalY - Math.abs(p.y)) / 14));
      r.frame(state, dt, p);
      if (state.phase === "end" && state.phaseT > 3.2 && !ended) {
        ended = true;
        done.current.onEnd({
          score: [...state.score],
          sog: [...state.sog],
          ot: state.ot,
          players: state.skaters.map((s) => ({ id: s.info.id, name: s.info.name, team: s.team, goalie: s.goalie, goals: s.goals, assists: s.assists, shots: s.shots, hits: s.hits, saves: s.saves, you: !!s.info.you })),
        });
      }
    };
    raf = requestAnimationFrame(loop);

    const vis = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", vis);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.destroy();
      document.removeEventListener("visibilitychange", vis);
      document.body.style.overflow = prevOverflow;
    };
    // The match is created once per mount; a rematch remounts with a new key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sound.pause(paused);
  }, [paused, sound]);

  return (
    <div className="fixed inset-0 z-[70] touch-none overscroll-none bg-[#03060d] select-none" style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}>
      <div ref={measure} aria-hidden className="pointer-events-none absolute inset-0" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }} />
      <div ref={wrap} className="absolute inset-0 touch-none">
        <canvas ref={canvas} className="block h-full w-full" aria-label="Hockey game. Left thumb skates, right thumb passes, shoots and checks." />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 58px)" }}>
        <button type="button" aria-label="Pause" onClick={() => setPaused(true)} className="pointer-events-auto rounded-full border border-[var(--card-border)] bg-[rgba(7,11,20,0.6)] p-2 text-[var(--fg)] backdrop-blur">
          <Pause className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={muted ? "Sound on" : "Sound off"}
          onClick={() => {
            sound.setMuted(!muted);
            onMute(!muted);
          }}
          className="pointer-events-auto rounded-full border border-[var(--card-border)] bg-[rgba(7,11,20,0.6)] p-2 text-[var(--fg)] backdrop-blur"
        >
          {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
        </button>
      </div>
      {paused && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[rgba(3,6,13,0.78)] px-8 backdrop-blur-sm">
          <p className="glow text-3xl font-black italic tracking-tight">PAUSED</p>
          <button type="button" onClick={() => setPaused(false)} className="flex w-full max-w-60 items-center justify-center gap-2 rounded-full bg-[var(--accent-blue)] py-3 font-black text-[#04101f]">
            <Play className="size-4" aria-hidden /> Resume
          </button>
          <button type="button" onClick={() => done.current.onQuit()} className="flex w-full max-w-60 items-center justify-center gap-2 rounded-full border border-[var(--card-border)] py-3 font-bold text-[var(--fg)]">
            <X className="size-4" aria-hidden /> Quit game
          </button>
        </div>
      )}
    </div>
  );
}
