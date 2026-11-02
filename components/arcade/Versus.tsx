"use client";

import { Check, Copy, Crown, Loader2, Share2, Timer, Users, Wifi } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { MatchResult, Net } from "@/components/arcade/Game";
import type { MatchSetup, TeamSetup } from "@/components/arcade/engine/types";
import { HostLobby, type Start } from "@/components/arcade/net/lobby";
import { LOBBY_SECONDS, type RoomInfo, type Side, SIDE_MAX } from "@/components/arcade/net/party";
import { host, type Hosting, join, type Link } from "@/components/arcade/net/peer";
import { partyView, readSetup, RIVAL } from "@/components/arcade/net/snapshot";
import { cn } from "@/lib/utils";

const HOME = "#5cc8ff";
const SIDES: { side: Side; label: string; color: string }[] = [
  { side: 0, label: "Left", color: HOME },
  { side: 1, label: "Right", color: RIVAL },
];
const NAME_KEY = "arcade-online-name";

type Stage =
  | { k: "menu" }
  | { k: "opening" } // asking the site for a room
  | { k: "joining" } // knocking on a friend's room
  | { k: "lobby"; code: string }
  | { k: "error"; msg: string };

/** An online game for the arcade screen: the roles for the game, and how to leave. */
export type VersusNet = { net: Net; quit(): void };

type Props = {
  mine: TeamSetup; // this phone's line
  defaultName: string;
  ai: () => TeamSetup; // a club for a side nobody sits on
  insane: boolean;
  initialCode: string;
  result: MatchResult | null; // the last online game, from this phone's side
  playing: boolean;
  picker: ReactNode; // the line picker
  invite: (code: string) => { url: string; text: string; title: string };
  onPlay: (setup: MatchSetup, label: string, net: VersusNet) => void;
  onTap: () => void; // unlocks sound inside a tap (iOS)
  back: ReactNode;
};

const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
};

const named = (team: TeamSetup, name: string): TeamSetup => {
  const n = name.trim().slice(0, 16);
  if (!n) return team;
  const abbr = n.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || team.abbr;
  return { ...team, name: `Team ${n}`, abbr };
};

const labelFor = (setup: MatchSetup) => {
  const seats = setup.party ?? [];
  const a = seats.filter((s) => s.team === 0).length;
  const b = seats.length - a;
  return b ? `ONLINE · ${a} ON ${b}` : `ONLINE · ${a} VS AI`;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Online party: one phone opens a room, up to five friends join with its code. Everyone picks a
 * side (three a side at most), and the puck drops when all are ready or the lobby clock runs out.
 * Each human skates one player; the AI fills the empty spots.
 */
export function Versus({ mine, defaultName, ai, insane, initialCode, result, playing, picker, invite, onPlay, onTap, back }: Props) {
  const [stage, setStage] = useState<Stage>({ k: "menu" });
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(() => readName() ?? defaultName);
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [copied, setCopied] = useState(false);
  // The room as the host last described it (or as this phone keeps it), and when its clock runs out here.
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [meId, setMeId] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const team = useMemo(() => named(mine, name), [mine, name]);
  const lobby = useRef<HostLobby | null>(null);
  const hosting = useRef<Hosting | null>(null);
  const link = useRef<Link | null>(null);
  const attempt = useRef(0); // results of a cancelled attempt are ignored
  const latest = useRef({ team, name, onPlay, insane, ai, playing });
  useEffect(() => {
    latest.current = { team, name, onPlay, insane, ai, playing };
  });

  useEffect(() => {
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {}
  }, [name]);

  const closeAll = () => {
    attempt.current++;
    hosting.current?.close();
    hosting.current = null;
    lobby.current?.shut("");
    lobby.current = null;
    link.current?.close();
    link.current = null;
  };

  // Leaving the screen closes the room and the link.
  useEffect(() => closeAll, []);

  const reset = () => {
    closeAll();
    setRoom(null);
    setMeId(null);
    setRole(null);
    setStage({ k: "menu" });
  };

  const fail = (msg: string) => {
    closeAll();
    setRoom(null);
    setStage({ k: "error", msg });
  };

  // Host: the lobby clock. Guest: just the countdown on screen.
  useEffect(() => {
    if (stage.k !== "lobby") return;
    const t = setInterval(() => {
      lobby.current?.tick();
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [stage.k]);

  // Back from a game: the host restarts the lobby clock.
  useEffect(() => {
    if (!playing) lobby.current?.ended();
  }, [playing]);

  // Tell the room who we are (again whenever the name or the line changes).
  useEffect(() => {
    lobby.current?.rename(name, team);
    link.current?.send({ t: "hi", name, team });
  }, [name, team]);

  const openRoom = async () => {
    onTap();
    const n = ++attempt.current;
    setRole("host");
    setStage({ k: "opening" });
    const room = new HostLobby(
      { name: latest.current.name, team: latest.current.team },
      {
        change: () => {
          setRoom(room.info());
          setEndsAt(Date.now() + room.left() * 1000);
        },
        start: ({ setup, guests }: Start) => {
          // The host's own view: unchanged, but with its own skater marked.
          const view = { ...partyView(setup, setup.party![0]), party: setup.party };
          latest.current.onPlay(view, labelFor(setup), { net: { role: "host", guests }, quit: () => reset() });
        },
        close: (why) => {
          if (why) fail(why);
        },
      },
      { ai: () => latest.current.ai(), insane: () => latest.current.insane },
    );
    try {
      const h = await host(
        (l) => room.add(l),
        (msg) => {
          if (n === attempt.current) fail(msg);
        },
      );
      if (n !== attempt.current) return h.close();
      hosting.current = h;
      lobby.current = room;
      setRoom(room.info());
      setEndsAt(Date.now() + room.left() * 1000);
      setStage({ k: "lobby", code: h.code });
    } catch (e) {
      if (n === attempt.current) setStage({ k: "error", msg: (e as Error).message });
    }
  };

  const joinRoom = async () => {
    onTap();
    const n = ++attempt.current;
    const c = code;
    setRole("guest");
    setStage({ k: "joining" });
    const signal = { cancelled: false };
    try {
      const l = await join(c, signal);
      if (n !== attempt.current) return l.close();
      link.current = l;
      l.on((m) => {
        if (m.t === "you") setMeId(Number(m.id));
        else if (m.t === "room") {
          const info = m as unknown as RoomInfo;
          if (!Array.isArray(info.members)) return;
          setRoom({ members: info.members, left: Number(info.left) || 0, playing: !!info.playing });
          setEndsAt(Date.now() + (Number(info.left) || 0) * 1000);
        } else if (m.t === "full") fail("That room is full (3 a side).");
        else if (m.t === "closed") fail(typeof m.why === "string" ? m.why : "The host closed the room.");
        else if (m.t === "start" && !latest.current.playing) {
          const setup = readSetup(m.setup);
          const me = Number(m.me);
          const seat = setup?.party?.[me];
          if (!setup || !seat) return;
          latest.current.onPlay(partyView(setup, seat), labelFor(setup), { net: { role: "guest", link: l, me, mirror: seat.team === 1 }, quit: reset });
        }
      });
      l.onClose(() => {
        if (link.current === l) fail("The host closed the room.");
      });
      l.send({ t: "hi", name: latest.current.name, team: latest.current.team });
      setStage({ k: "lobby", code: c });
    } catch (e) {
      signal.cancelled = true;
      if (n === attempt.current) setStage({ k: "error", msg: (e as Error).message });
    }
  };

  const share = async (c: string) => {
    const { url, text, title } = invite(c);
    try {
      if (navigator.share) return await navigator.share(url ? { title, text, url } : { title, text });
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url ? `${text}: ${url}` : text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  // The room as this phone sees it.
  const info = room;
  const myId = role === "host" ? 0 : meId;
  const me = info?.members.find((m) => m.id === myId);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));

  const seat = (side: Side) => {
    onTap();
    if (role === "host") lobby.current?.seat(side);
    else link.current?.send({ t: "seat", side });
  };
  const ready = (on: boolean) => {
    onTap(); // the game may start from this tap
    if (role === "host") lobby.current?.ready(on);
    else link.current?.send({ t: "ready", on });
  };

  const people = info?.members.length ?? 0;
  const waiting = info?.members.filter((m) => !m.ready).length ?? 0;

  return (
    <>
      {back}
      <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--accent-blue)]">ONLINE · UP TO 3 ON 3</p>
      <h1 className="text-2xl font-black italic">Play friends</h1>
      <p className="text-xs text-[var(--muted-fg)]">Up to six phones, one rink. Each of you skates one player; the AI fills the rest.</p>

      {stage.k === "menu" && (
        <div className="mt-4 space-y-3">
          <label className="arena-card flex items-center gap-3 p-4">
            <span className="text-xs font-bold tracking-wider text-[var(--muted-fg)] uppercase">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
              placeholder="Name"
              autoComplete="nickname"
              className="min-w-0 flex-1 rounded-xl bg-[rgba(255,255,255,0.06)] px-3 py-2 font-bold ring-1 ring-[var(--card-border)] outline-none focus:ring-[var(--accent-blue)]"
            />
          </label>
          <button type="button" onClick={openRoom} className="arena-card flex w-full items-center gap-3 p-4 text-left active:scale-[0.99]">
            <Wifi className="size-6 text-[var(--accent-blue)]" aria-hidden />
            <span className="flex-1">
              <span className="block font-black">Open a room</span>
              <span className="block text-xs text-[var(--muted-fg)]">Get a code to send your friends</span>
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
          {picker}
        </div>
      )}

      {(stage.k === "opening" || stage.k === "joining") && (
        <div className="arena-card mt-4 flex items-center gap-3 p-4 text-sm">
          <Loader2 className="size-5 animate-spin text-[var(--accent-blue)]" aria-hidden />
          {stage.k === "opening" ? "Opening a room…" : `Knocking on room ${code}…`}
        </div>
      )}

      {stage.k === "lobby" && (
        <>
          {result && !playing && <Score result={result} />}
          <section className="arena-card mt-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">Room code</p>
                <p className="tabular glow text-4xl font-black tracking-[0.2em]">{stage.code}</p>
              </div>
              <button type="button" onClick={() => share(stage.code)} className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-blue)] px-4 py-2.5 text-sm font-black text-[#04101f]">
                {copied ? <Copy className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />} {copied ? "Copied" : "Invite"}
              </button>
            </div>
            {!info ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-fg)]">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Getting a seat…
              </p>
            ) : info.playing ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-fg)]">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> A game is on. You&apos;re in for the next one.
              </p>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-fg)]" aria-live="polite">
                <Timer className="size-3.5" aria-hidden />
                {people < 2 ? "Waiting for friends to join · " : `${waiting ? `${waiting} not ready` : "Everyone's ready"} · `}
                <span className="tabular font-bold text-[var(--fg)]">{people < 2 ? `closes in ${clock(left)}` : `puck drops in ${clock(left)}`}</span>
              </p>
            )}
          </section>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {SIDES.map(({ side, label, color }) => {
              const here = info?.members.filter((m) => m.side === side) ?? [];
              const canMove = !!me && me.side !== side && here.length < SIDE_MAX && !info?.playing;
              return (
                <section key={side} className="arena-card flex flex-col gap-2 p-3" style={{ borderColor: `${color}55` }}>
                  <p className="text-center text-xs font-black tracking-[0.2em] uppercase" style={{ color }}>
                    {label}
                  </p>
                  {Array.from({ length: SIDE_MAX }, (_, k) => {
                    const m = here[k];
                    if (!m) {
                      return (
                        <div key={k} className="rounded-xl border border-dashed border-[var(--card-border)] px-2 py-2.5 text-center text-xs text-[var(--muted-fg)]">
                          AI
                        </div>
                      );
                    }
                    return (
                      <div
                        key={k}
                        className={cn("flex items-center gap-1.5 rounded-xl px-2 py-2.5 text-sm", m.id === myId ? "bg-[rgba(255,255,255,0.12)] ring-1 ring-[var(--fg)]" : "bg-[rgba(255,255,255,0.05)]")}
                      >
                        {m.id === 0 && <Crown className="size-3.5 shrink-0 text-[#ffcf5a]" aria-label="Host" />}
                        <span className="min-w-0 flex-1 truncate font-bold">{m.name}</span>
                        {m.ready ? <Check className="size-4 shrink-0 text-[#5dffa8]" aria-label="Ready" /> : <span className="size-2 shrink-0 rounded-full bg-[var(--muted-fg)] opacity-50" aria-label="Not ready" />}
                      </div>
                    );
                  })}
                  {canMove && (
                    <button type="button" onClick={() => seat(side)} className="rounded-full border py-1.5 text-xs font-black" style={{ borderColor: color, color }}>
                      Move here
                    </button>
                  )}
                </section>
              );
            })}
          </div>

          {info && !info.playing && me && (
            <div className="sticky bottom-24 z-10 mt-4">
              <button
                type="button"
                onClick={() => ready(!me.ready)}
                disabled={people < 2}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-full py-4 text-lg font-black tracking-wide italic active:scale-[0.98] disabled:opacity-50",
                  me.ready ? "border border-[#5dffa8] bg-[rgba(93,255,168,0.12)] text-[#5dffa8]" : "bg-gradient-to-r from-[#5cc8ff] to-[#7ee0ff] text-[#04101f] shadow-[0_0_30px_rgba(92,200,255,0.45)]",
                )}
              >
                {me.ready ? (
                  <>
                    <Check className="size-5" aria-hidden /> READY · TAP TO UNDO
                  </>
                ) : (
                  <>
                    {people < 2 ? "WAITING FOR FRIENDS" : "READY"} {insane && role === "host" && "🔥"}
                  </>
                )}
              </button>
            </div>
          )}
          <div className="mt-3">{picker}</div>
          <button type="button" onClick={reset} className="mt-3 w-full py-2 text-sm font-semibold text-[var(--muted-fg)]">
            {role === "host" ? "Close room" : "Leave room"}
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
          <li>Pick Left or Right, up to 3 a side. Uneven sides are fine; the AI fills empty spots.</li>
          <li>The puck drops when everyone taps Ready, or after {LOBBY_SECONDS / 60} minutes with whoever is in.</li>
          <li>With teammates you each keep your own skater. Alone on a side, you switch players as usual.</li>
          <li>Everyone joins the host&apos;s phone. Same Wi-Fi works best. The host picks INSANE mode on the menu.</li>
        </ul>
      </section>
    </>
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
