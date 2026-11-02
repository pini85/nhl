// Direct phone-to-phone links (WebRTC data channels). The site only relays the handshake: the
// host opens a short room code, each friend knocks with an offer, the host answers, and from then
// on game traffic goes straight between the host's phone and each friend's.

/** Where room codes are kept. */
const ROOM_API = "/api/arcade/room";

const ICE: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }, { urls: "stun:stun.cloudflare.com:3478" }];

export type Msg = Record<string, unknown> & { t: string };

export type Link = {
  /** Reliable, in order: events, inputs, game control. */
  send(m: Msg): void;
  /** Lossy and quick: the newest snapshot is all that matters. */
  sendFast(m: unknown): void;
  on(f: (m: Msg) => void): () => void;
  onFast(f: (m: unknown) => void): () => void;
  onClose(f: () => void): () => void;
  close(): void;
  readonly open: boolean;
};

async function api<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(ROOM_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "The rink office is closed. Try again.");
  return json as T;
}

/** Waits until the browser has found its addresses, so one offer/answer is enough (no trickle). */
function gathered(pc: RTCPeerConnection, ms = 3000) {
  return new Promise<void>((done) => {
    if (pc.iceGatheringState === "complete") return done();
    const t = setTimeout(done, ms);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(t);
        done();
      }
    });
  });
}

function opened(ch: RTCDataChannel) {
  return new Promise<void>((done, fail) => {
    if (ch.readyState === "open") return done();
    ch.addEventListener("open", () => done(), { once: true });
    ch.addEventListener("error", () => fail(new Error("Couldn't connect.")), { once: true });
  });
}

function makeLink(pc: RTCPeerConnection, ctl: RTCDataChannel, fast: RTCDataChannel): Link {
  const subs = new Set<(m: Msg) => void>();
  const fastSubs = new Set<(m: unknown) => void>();
  const closeSubs = new Set<() => void>();
  let closed = false;
  const early: Msg[] = []; // messages that came before anyone listened
  const shut = () => {
    if (closed) return;
    closed = true;
    for (const f of closeSubs) f();
    try {
      pc.close();
    } catch {}
  };
  ctl.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data) as Msg;
      if (!subs.size) early.push(m);
      for (const f of subs) f(m);
    } catch {}
  };
  fast.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      for (const f of fastSubs) f(m);
    } catch {}
  };
  ctl.onclose = shut;
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") shut();
  });
  const add = <F>(set: Set<F>, f: F) => {
    set.add(f);
    return () => void set.delete(f);
  };
  return {
    send: (m) => {
      if (ctl.readyState === "open") ctl.send(JSON.stringify(m));
    },
    sendFast: (m) => {
      // Skip a snapshot rather than queue stale ones behind a slow link.
      if (fast.readyState === "open" && fast.bufferedAmount < 64_000) fast.send(JSON.stringify(m));
    },
    on: (f) => {
      const off = add(subs, f);
      for (const m of early.splice(0)) f(m);
      return off;
    },
    onFast: (f) => add(fastSubs, f),
    onClose: (f) => add(closeSubs, f),
    close: () => {
      try {
        ctl.send(JSON.stringify({ t: "bye" }));
      } catch {}
      setTimeout(shut, 100);
    },
    get open() {
      return !closed && ctl.readyState === "open";
    },
  };
}

export type Hosting = { code: string; close(): void };

/**
 * Opens a room and keeps letting phones in: every friend who knocks gets its own link, handed to
 * `onGuest`. `onFail` hears it when the room is gone. Close it to stop letting people in.
 */
export async function host(onGuest: (link: Link) => void, onFail: (msg: string) => void): Promise<Hosting> {
  const { code, key } = await api<{ code: string; key: string }>({ op: "create" });
  let closed = false;
  const seen = new Set<string>();
  const pending = new Set<RTCPeerConnection>();
  let misses = 0;

  const welcome = async (id: string, offer: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pending.add(pc);
    try {
      const both = channelsOf(pc);
      await pc.setRemoteDescription({ type: "offer", sdp: offer });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      await api({ op: "answer", code, key, id, sdp: pc.localDescription!.sdp });
      const { ctl, fast } = await withTimeout(both, 25_000);
      await withTimeout(Promise.all([opened(ctl), opened(fast)]), 20_000);
      pending.delete(pc);
      if (closed) return pc.close();
      onGuest(makeLink(pc, ctl, fast));
    } catch {
      pending.delete(pc);
      pc.close();
    }
  };

  (async () => {
    while (!closed) {
      try {
        const { knocks } = await api<{ knocks: { id: string; offer: string }[] }>({ op: "knocks", code, key });
        misses = 0;
        for (const k of knocks) {
          if (closed || seen.has(k.id)) continue;
          seen.add(k.id);
          void welcome(k.id, k.offer);
        }
      } catch (e) {
        // A blip is fine; a room that's gone (or a long outage) ends it.
        if (++misses >= 8 || /closed/i.test((e as Error).message)) {
          if (!closed) onFail((e as Error).message);
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  })();

  return {
    code,
    close: () => {
      closed = true;
      for (const pc of pending) pc.close();
      pending.clear();
    },
  };
}

function channelsOf(pc: RTCPeerConnection) {
  const channels = new Map<string, RTCDataChannel>();
  return new Promise<{ ctl: RTCDataChannel; fast: RTCDataChannel }>((done) => {
    pc.ondatachannel = (e) => {
      channels.set(e.channel.label, e.channel);
      if (channels.has("ctl") && channels.has("fast")) done({ ctl: channels.get("ctl")!, fast: channels.get("fast")! });
    };
  });
}

/** Joins a friend's room by its code: knocks, then waits for the host to let us in. */
export async function join(code: string, signal?: { cancelled: boolean }): Promise<Link> {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const ctl = pc.createDataChannel("ctl", { ordered: true });
  const fast = pc.createDataChannel("fast", { ordered: false, maxRetransmits: 0 });
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const { id } = await api<{ id: string }>({ op: "knock", code, sdp: pc.localDescription!.sdp });
    const until = Date.now() + 45_000;
    let answer: string | null = null;
    while (!answer) {
      if (signal?.cancelled) throw new Error("cancelled");
      if (Date.now() > until) throw new Error("The room didn't let you in. Ask your friend to check the room is open.");
      await new Promise((r) => setTimeout(r, 1000));
      ({ answer } = await api<{ answer: string | null }>({ op: "reply", id }).catch((e: Error) => {
        if (/didn't let you in/.test(e.message)) throw e;
        return { answer: null };
      }));
    }
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
    await withTimeout(Promise.all([opened(ctl), opened(fast)]), 20_000);
    return makeLink(pc, ctl, fast);
  } catch (e) {
    pc.close();
    throw e;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, fail) => setTimeout(() => fail(new Error("Couldn't reach the host's phone. Try the same Wi-Fi, or let someone else host.")), ms)),
  ]);
}
