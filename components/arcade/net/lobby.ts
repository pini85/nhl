import type { MatchSetup, TeamSetup } from "@/components/arcade/engine/types";
import { allReady, LOBBY_SECONDS, type Member, openSide, PARTY_MAX, partySetup, type RoomInfo, type Side, SIDE_MAX, sideCount } from "@/components/arcade/net/party";
import type { Link, Msg } from "@/components/arcade/net/peer";
import { readTeam } from "@/components/arcade/net/snapshot";

// The host's side of a lobby. The host's phone keeps the room: who sits where, who is ready,
// and the clock. Every change goes out to all phones as a "room" message.
//
// Messages from a guest:  hi {name, team} · seat {side} · ready {on}
// Messages to a guest:    you {id} · room RoomInfo · start {setup, me} · full · closed {why}

export type Start = { setup: MatchSetup; guests: { link: Link; pilot: number; mirror: boolean }[] };

type Hooks = {
  /** Something changed: draw it again. */
  change(): void;
  /** Time to play. */
  start(s: Start): void;
  /** The room closed (the host left). */
  close(why: string): void;
};

const cleanName = (v: unknown, fallback: string) =>
  (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 16) : "") || fallback;

export class HostLobby {
  members: Member[];
  private links = new Map<number, Link>();
  private offs = new Map<number, () => void>();
  private nextId = 1;
  deadline: number | null = null; // the clock only runs with two or more phones in
  playing = false;
  closed = false;

  constructor(
    me: { name: string; team: TeamSetup },
    private hooks: Hooks,
    private opts: { ai: () => TeamSetup; insane: () => boolean; now?: () => number },
  ) {
    this.members = [{ id: 0, name: cleanName(me.name, "Host"), side: 0, ready: false, team: me.team }];
  }

  private now() {
    return this.opts.now?.() ?? Date.now();
  }

  /** Seconds left on the lobby clock, or null while it waits for a second phone. */
  left() {
    return this.deadline === null ? null : Math.max(0, Math.ceil((this.deadline - this.now()) / 1000));
  }

  /** Starts the clock when a second phone arrives; stops it when the host is alone again. */
  private clock() {
    if (this.members.length < 2) this.deadline = null;
    else if (this.deadline === null && !this.playing) this.deadline = this.now() + LOBBY_SECONDS * 1000;
  }

  info(): RoomInfo {
    return { members: this.members.map(({ id, name, side, ready }) => ({ id, name, side, ready })), left: this.left(), playing: this.playing };
  }

  private changed() {
    this.clock();
    const room = this.info();
    for (const l of this.links.values()) l.send({ t: "room", ...room });
    this.hooks.change();
  }

  /** A friend's phone got through. */
  add(link: Link) {
    if (this.closed) return link.close();
    const side = openSide(this.members);
    if (side === null || this.members.length >= PARTY_MAX) {
      link.send({ t: "full" });
      setTimeout(() => link.close(), 300);
      return;
    }
    const id = this.nextId++;
    // Until its "hi" arrives the phone sits with a stand-in line; it's replaced right away.
    this.members.push({ id, name: "Joining…", side, ready: false, team: this.members[0].team });
    this.links.set(id, link);
    const offMsg = link.on((m) => this.message(id, m));
    const offClose = link.onClose(() => this.drop(id));
    this.offs.set(id, () => {
      offMsg();
      offClose();
    });
    link.send({ t: "you", id });
    this.changed();
  }

  private message(id: number, m: Msg) {
    const who = this.members.find((x) => x.id === id);
    if (!who) return;
    if (m.t === "hi") {
      const team = readTeam(m.team);
      who.name = cleanName(m.name, `Player ${id + 1}`);
      if (team) who.team = team;
    } else if (m.t === "seat") this.seatOf(who, m.side === 1 ? 1 : 0);
    else if (m.t === "ready") who.ready = !!m.on && !this.playing;
    else return;
    this.changed();
  }

  private seatOf(who: Member, side: Side) {
    if (who.side === side || this.playing || sideCount(this.members, side) >= SIDE_MAX) return;
    who.side = side;
    who.ready = false;
    // Move to the end of the list so the order on each side is the order people sat down.
    this.members = [...this.members.filter((x) => x !== who), who];
    if (who.id === 0) this.members = [who, ...this.members.filter((x) => x !== who)]; // the host stays first
  }

  /** The host's own taps. */
  seat(side: Side) {
    this.seatOf(this.members[0], side);
    this.changed();
  }
  ready(on: boolean) {
    if (!this.playing) this.members[0].ready = on;
    this.changed();
  }
  rename(name: string, team: TeamSetup) {
    this.members[0].name = cleanName(name, "Host");
    this.members[0].team = team;
    this.changed();
  }

  private drop(id: number) {
    this.offs.get(id)?.();
    this.offs.delete(id);
    this.links.delete(id);
    this.members = this.members.filter((x) => x.id !== id);
    if (!this.closed) this.changed();
  }

  /** Once a second: start when everyone's ready, or when the clock runs out. */
  tick() {
    if (this.closed || this.playing) return;
    if (allReady(this.members)) return this.begin();
    if (this.deadline !== null && this.members.length >= 2 && this.now() >= this.deadline) return this.begin();
    this.changed();
  }

  private begin() {
    const players = this.members.slice();
    const setup = partySetup(players, this.opts.ai(), { seed: Math.floor(Math.random() * 1e9), insane: this.opts.insane() });
    const seats = setup.party!;
    const guests: Start["guests"] = [];
    players.forEach((m, k) => {
      if (k === 0) return;
      const link = this.links.get(m.id);
      if (!link) return;
      link.send({ t: "start", setup, me: k });
      guests.push({ link, pilot: k, mirror: seats[k].team === 1 });
    });
    this.playing = true;
    this.deadline = null;
    for (const m of this.members) m.ready = false;
    this.changed();
    this.hooks.start({ setup, guests });
  }

  /** Back from a game: a fresh clock for the next one. */
  ended() {
    if (!this.playing) return;
    this.playing = false;
    this.deadline = null; // a fresh clock, if there's still someone to play
    for (const m of this.members) m.ready = false;
    this.changed();
  }

  shut(why: string) {
    if (this.closed) return;
    this.closed = true;
    for (const [id, l] of this.links) {
      l.send({ t: "closed", why: "The host closed the room." });
      this.offs.get(id)?.();
      setTimeout(() => l.close(), 200);
    }
    this.links.clear();
    this.hooks.close(why);
  }
}
