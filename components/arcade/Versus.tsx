"use client";

import { Copy, Loader2, Repeat, Share2, Users, Wifi } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchResult } from "@/components/arcade/Game";
import type { MatchSetup, TeamSetup } from "@/components/arcade/engine/types";
import { LinePicker } from "@/components/arcade/LinePicker";
import { host, type Hosting, join, type Link } from "@/components/arcade/net/peer";
import { guestView, readSetup, readTeam, RIVAL, versusSetup } from "@/components/arcade/net/snapshot";
import { versusTeam } from "@/components/arcade/setup";
import type { ArcadeData } from "@/lib/stats/arcade";
import { cn } from "@/lib/utils";

const HOME = "#5cc8ff";

type Stage =
  | { k: "menu" }
  | { k: "opening" } // asking the site for a room
  | { k: "hosting"; code: string }
  | { k: "joining" } // handshake with a friend's room
  | { k: "lobby" }
  | { k: "error"; msg: string };

export type VersusNet = { role: "host" | "guest"; link: Link };

type Props = {
  data: ArcadeData;
  lineup: string[];
  goalieId: string;
  myId: string | null;
  insane: boolean;
  initialCode: string;
  result: MatchResult | null; // the last online game, from this phone's side
  playing: boolean;
  onLineup: (l: string[], g: string) => void;
  onPlay: (setup: MatchSetup, label: string, net: VersusNet) => void;
  onTap: () => void; // unlocks sound inside a tap (iOS)
  back: React.ReactNode;
};

/** Online 1-on-1: one phone opens a room, the other joins with its code. Each drives their own line. */
export function Versus({ data, lineup, goalieId, myId, insane, initialCode, result, playing, onLineup, onPlay, onTap, back }: Props) {
  const [stage, setStage] = useState<Stage>({ k: "menu" });
  const [code, setCode] = useState(initialCode);
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [link, setLink] = useState<Link | null>(null);
  const [theirs, setTheirs] = useState<TeamSetup | null>(null);
  const [copied, setCopied] = useState(false);
  const hosting = useRef<Hosting | null>(null);
  const attempt = useRef(0); // results of a cancelled attempt are ignored

  const mine = useMemo(() => versusTeam(data, lineup, goalieId, myId, role === "guest" ? "Guest" : "Host"), [data, lineup, goalieId, myId, role]);
  const latest = useRef({ mine, onPlay, insane });
  useEffect(() => {
    latest.current = { mine, onPlay, insane };
  });

  // Leaving the screen closes the room and the link.
  const linkRef = useRef<Link | null>(null);
  useEffect(() => {
    linkRef.current = link;
  }, [link]);
  useEffect(
    () => () => {
      hosting.current?.cancel();
      linkRef.current?.close();
    },
    [],
  );

  // Messages from the friend's phone.
  useEffect(() => {
    if (!link) return;
    const offMsg = link.on((m) => {
      if (m.t === "hello") setTheirs(readTeam(m.team));
      if (m.t === "start" && role === "guest") {
        const setup = readSetup(m.setup);
        if (setup) latest.current.onPlay(guestView(setup, latest.current.mine), "ONLINE · 1 ON 1", { role: "guest", link });
      }
    });
    const offClose = link.onClose(() => {
      setLink(null);
      setTheirs(null);
      setStage({ k: "error", msg: "Your friend left the rink." });
    });
    return () => {
      offMsg();
      offClose();
    };
  }, [link, role]);

  // Tell the friend who we are (again whenever the line changes).
  useEffect(() => {
    link?.send({ t: "hello", team: mine });
  }, [link, mine]);

  const connected = (l: Link) => {
    setLink(l);
    setStage({ k: "lobby" });
  };

  const openRoom = async () => {
    onTap();
    const n = ++attempt.current;
    setRole("host");
    setStage({ k: "opening" });
    try {
      const h = await host();
      if (n !== attempt.current) return h.cancel();
      hosting.current = h;
      setStage({ k: "hosting", code: h.code });
      const l = await h.link;
      hosting.current = null;
      if (n !== attempt.current) return l.close();
      connected(l);
    } catch (e) {
      if (n === attempt.current) setStage({ k: "error", msg: (e as Error).message });
    }
  };

  const joinRoom = async () => {
    onTap();
    const n = ++attempt.current;
    setRole("guest");
    setStage({ k: "joining" });
    try {
      const l = await join(code);
      if (n !== attempt.current) return l.close();
      connected(l);
    } catch (e) {
      if (n === attempt.current) setStage({ k: "error", msg: (e as Error).message });
    }
  };

  const reset = () => {
    attempt.current++;
    hosting.current?.cancel();
    hosting.current = null;
    link?.close();
    setLink(null);
    setTheirs(null);
    setRole(null);
    setStage({ k: "menu" });
  };

  const start = () => {
    if (!link || !theirs) return;
    onTap();
    const setup = versusSetup(mine, theirs, { seed: Math.floor(Math.random() * 1e9), insane: latest.current.insane });
    link.send({ t: "start", setup });
    onPlay(setup, "ONLINE · 1 ON 1", { role: "host", link });
  };

  const share = async (c: string) => {
    const url = `${location.origin}/arcade?join=${c}`;
    const text = `Play me in the Revenge Tour arcade. Room code ${c}`;
    try {
      if (navigator.share) return await navigator.share({ title: "Arcade · play me", text, url });
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}: ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  return (
    <>
      {back}
      <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--accent-blue)]">ONLINE · 1 ON 1</p>
      <h1 className="text-2xl font-black italic">Play a friend</h1>
      <p className="text-xs text-[var(--muted-fg)]">Two phones, one rink. You each drive your own line; the AI fills in the rest.</p>

      {stage.k === "menu" && (
        <div className="mt-4 space-y-3">
          <button type="button" onClick={openRoom} className="arena-card flex w-full items-center gap-3 p-4 text-left active:scale-[0.99]">
            <Wifi className="size-6 text-[var(--accent-blue)]" aria-hidden />
            <span className="flex-1">
              <span className="block font-black">Open a room</span>
              <span className="block text-xs text-[var(--muted-fg)]">Get a code to send your friend</span>
            </span>
            <span aria-hidden>→</span>
          </button>
          <form
            className="arena-card p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 4) joinRoom();
            }}
          >
            <label htmlFor="room-code" className="flex items-center gap-2 font-black">
              <Users className="size-5 text-[var(--accent-blue)]" aria-hidden /> Join with a code
            </label>
            <div className="mt-3 flex gap-2">
              <input
                id="room-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="ABCD"
                className="tabular min-w-0 flex-1 rounded-xl bg-[rgba(255,255,255,0.06)] px-3 py-2.5 text-center text-2xl font-black tracking-[0.4em] uppercase ring-1 ring-[var(--card-border)] outline-none placeholder:text-[rgba(255,255,255,0.15)] focus:ring-[var(--accent-blue)]"
              />
              <button type="submit" disabled={code.length !== 4} className="rounded-xl bg-[var(--accent-blue)] px-5 font-black text-[#04101f] disabled:opacity-40">
                Join
              </button>
            </div>
          </form>
          <LinePicker data={data} lineup={lineup} goalieId={goalieId} myId={myId} onLineup={onLineup} />
        </div>
      )}

      {(stage.k === "opening" || stage.k === "joining") && (
        <div className="arena-card mt-4 flex items-center gap-3 p-4 text-sm">
          <Loader2 className="size-5 animate-spin text-[var(--accent-blue)]" aria-hidden />
          {stage.k === "opening" ? "Opening a room…" : `Connecting to room ${code}…`}
        </div>
      )}

      {stage.k === "hosting" && (
        <section className="arena-card mt-4 p-4 text-center">
          <p className="text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">Room code</p>
          <p className="tabular glow mt-1 text-6xl font-black tracking-[0.2em]">{stage.code}</p>
          <p className="mt-2 flex items-center justify-center gap-2 text-xs text-[var(--muted-fg)]">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Waiting for your friend to join…
          </p>
          <button type="button" onClick={() => share(stage.code)} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--accent-blue)] px-5 py-2.5 font-black text-[#04101f]">
            {copied ? <Copy className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />} {copied ? "Link copied" : "Send invite"}
          </button>
          <button type="button" onClick={reset} className="mt-2 block w-full py-1.5 text-xs font-semibold text-[var(--muted-fg)]">
            Cancel
          </button>
        </section>
      )}

      {stage.k === "lobby" && (
        <>
          {result && !playing && <Score result={result} />}
          <section className="arena-card mt-4 p-4">
            <div className="flex items-center justify-between gap-2">
              <TeamSide team={mine} color={HOME} label="You" />
              <span className="text-2xl font-black text-[var(--muted-fg)] italic">VS</span>
              <TeamSide team={theirs} color={RIVAL} label="Friend" right />
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#5dffa8]">
              <span className="size-1.5 rounded-full bg-[#5dffa8]" /> Connected
            </p>
          </section>
          {role === "host" ? (
            <div className="sticky bottom-24 z-10 mt-4">
              <button
                type="button"
                onClick={start}
                disabled={!theirs}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#5cc8ff] to-[#7ee0ff] py-4 text-lg font-black tracking-wide text-[#04101f] italic shadow-[0_0_30px_rgba(92,200,255,0.45)] active:scale-[0.98] disabled:opacity-50"
              >
                {result ? <Repeat className="size-5" aria-hidden /> : null}
                {result ? "REMATCH" : "DROP THE PUCK"} {insane && "🔥"}
              </button>
            </div>
          ) : (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-[var(--muted-fg)]">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Waiting for your friend to drop the puck…
            </p>
          )}
          <div className="mt-3">
            <LinePicker data={data} lineup={lineup} goalieId={goalieId} myId={myId} onLineup={onLineup} />
          </div>
          <button type="button" onClick={reset} className="mt-3 w-full py-2 text-sm font-semibold text-[var(--muted-fg)]">
            Leave room
          </button>
        </>
      )}

      {stage.k === "error" && (
        <section className="arena-card mt-4 p-4">
          <p className="font-bold">{stage.msg}</p>
          <button type="button" onClick={reset} className="mt-3 w-full rounded-full bg-[var(--accent-blue)] py-3 font-black text-[#04101f]">
            Try again
          </button>
        </section>
      )}

      <section className="arena-card mt-3 p-4 text-xs text-[var(--muted-fg)]">
        <h2 className="text-[10px] font-semibold tracking-[0.15em] uppercase">How it works</h2>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>The phones connect straight to each other. Same Wi-Fi works best.</li>
          <li>On both phones you&apos;re blue and skate up the screen.</li>
          <li>The room&apos;s host picks INSANE mode on the arcade menu.</li>
        </ul>
      </section>
    </>
  );
}

function TeamSide({ team, color, label, right }: { team: TeamSetup | null; color: string; label: string; right?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1", right ? "items-end text-right" : "items-start")}>
      <span
        className="grid size-14 place-items-center rounded-xl text-base font-black tracking-tight text-[#04101f] italic"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, boxShadow: `0 0 18px ${color}55` }}
      >
        {team?.abbr ?? "…"}
      </span>
      <span className="text-[10px] font-bold tracking-wider text-[var(--muted-fg)] uppercase">{label}</span>
      <span className="w-full truncate text-sm font-black">{team?.name ?? "Joining…"}</span>
      {team && <span className="w-full truncate text-[11px] text-[var(--muted-fg)]">{team.skaters.map((s) => s.name).join(" · ")}</span>}
    </div>
  );
}

function Score({ result }: { result: MatchResult }) {
  const won = result.score[0] > result.score[1];
  const stars = [...result.players]
    .map((p) => ({ p, v: p.goals * 3 + p.assists * 2 + p.hits * 0.4 + p.saves * 0.25 }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 3);
  return (
    <section className="arena-card mt-4 p-4 text-center">
      <p className="text-[10px] font-bold tracking-[0.3em] text-[var(--muted-fg)]">{result.ot ? "FINAL · OVERTIME" : "FINAL"}</p>
      <p className={cn("mt-1 text-4xl font-black italic", won ? "text-[#ffcf5a]" : "text-[#ff7a8a]")}>{won ? "YOU WIN!" : "YOU LOSE"}</p>
      <p className="tabular mt-1 text-4xl font-black">
        {result.score[0]}
        <span className="mx-2 text-[var(--muted-fg)]">–</span>
        {result.score[1]}
      </p>
      <p className="text-xs text-[var(--muted-fg)]">
        Shots {result.sog[0]}–{result.sog[1]}
      </p>
      <ol className="mt-3 space-y-1 text-left text-sm">
        {stars.map(({ p }, i) => (
          <li key={`${p.team}-${p.id}`} className="flex items-center gap-2">
            <span className="w-8 text-[#ffcf5a]">{"★".repeat(3 - i)}</span>
            <span className="flex-1 truncate font-bold">{p.name}</span>
            <span className="tabular text-xs text-[var(--muted-fg)]">{p.goalie ? `${p.saves} saves` : `${p.goals}G ${p.assists}A ${p.hits}H`}</span>
            <span className="size-2 rounded-full" style={{ background: p.team === 0 ? HOME : RIVAL }} />
          </li>
        ))}
      </ol>
    </section>
  );
}
