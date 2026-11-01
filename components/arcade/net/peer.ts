// A direct phone-to-phone link (WebRTC data channels). The site only relays the handshake:
// the host posts an offer under a short room code, the guest answers it, and from then on
// game traffic goes straight between the two phones.

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
  const res = await fetch("/api/arcade/room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
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

export type Hosting = { code: string; link: Promise<Link>; cancel(): void };

/** Opens a room. `link` resolves when a friend has joined. */
export async function host(): Promise<Hosting> {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const ctl = pc.createDataChannel("ctl", { ordered: true });
  const fast = pc.createDataChannel("fast", { ordered: false, maxRetransmits: 0 });
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  let code: string;
  try {
    ({ code } = await api<{ code: string }>({ op: "create", sdp: pc.localDescription!.sdp }));
  } catch (e) {
    pc.close();
    throw e;
  }
  let cancelled = false;
  const link = (async () => {
    // Wait for the answer (rooms last 15 minutes).
    const until = Date.now() + 15 * 60_000;
    while (!cancelled) {
      if (Date.now() > until) throw new Error("Nobody joined. Open a new room.");
      const room = await api<{ answer: string | null }>({ op: "get", code }).catch(() => ({ answer: null }));
      if (room.answer) {
        await pc.setRemoteDescription({ type: "answer", sdp: room.answer });
        break;
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    if (cancelled) throw new Error("cancelled");
    await withTimeout(Promise.all([opened(ctl), opened(fast)]), 20_000);
    return makeLink(pc, ctl, fast);
  })();
  link.catch(() => pc.close());
  return {
    code,
    link,
    cancel: () => {
      cancelled = true;
      pc.close();
    },
  };
}

/** Joins a friend's room by its code. */
export async function join(code: string): Promise<Link> {
  const room = await api<{ offer: string }>({ op: "get", code });
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const channels = new Map<string, RTCDataChannel>();
  const both = new Promise<void>((done) => {
    pc.ondatachannel = (e) => {
      channels.set(e.channel.label, e.channel);
      if (channels.has("ctl") && channels.has("fast")) done();
    };
  });
  try {
    await pc.setRemoteDescription({ type: "offer", sdp: room.offer });
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    await api({ op: "answer", code, sdp: pc.localDescription!.sdp });
    await withTimeout(both, 20_000);
    const ctl = channels.get("ctl")!;
    const fast = channels.get("fast")!;
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
    new Promise<never>((_, fail) => setTimeout(() => fail(new Error("Couldn't reach your friend's phone. Try the same Wi-Fi, or swap who hosts.")), ms)),
  ]);
}
