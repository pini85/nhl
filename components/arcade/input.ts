import type { Action, Input } from "@/components/arcade/engine/types";

// Touch: a floating stick on the left half, gestures on the right half. Keyboard for desktops.
// Screen directions are turned into world directions (screen y goes down, world y goes up).

const STICK_R = 56;
const HOLD_MS = 170;
const SWIPE_PX = 34;

type Gesture = { id: number; x0: number; y0: number; t0: number; x: number; y: number; charging: boolean; done: boolean };

export class Controls {
  mx = 0;
  my = 0;
  burst = false;
  joy: { ox: number; oy: number; x: number; y: number } | null = null;
  used = false; // any input yet (fades the hint)
  private stickId: number | null = null;
  private gesture: Gesture | null = null;
  private actions: Action[] = [];
  private keys = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private off: (() => void)[] = [];

  constructor(private el: HTMLElement, private haptic: (ms: number) => void) {
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(t, f as EventListener, { passive: false });
      this.off.push(() => el.removeEventListener(t, f as EventListener));
    };
    on("pointerdown", (e) => this.down(e));
    on("pointermove", (e) => this.move(e));
    on("pointerup", (e) => this.up(e));
    on("pointercancel", (e) => this.up(e, true));
    on("contextmenu", (e) => e.preventDefault());
    const kd = (e: KeyboardEvent) => this.key(e, true);
    const ku = (e: KeyboardEvent) => this.key(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    this.off.push(() => window.removeEventListener("keydown", kd), () => window.removeEventListener("keyup", ku));
  }

  destroy() {
    for (const f of this.off) f();
    if (this.timer) clearTimeout(this.timer);
  }

  /** This step's input; actions are handed out once. */
  take(): Input {
    let mx = this.mx;
    let my = this.my;
    let burst = this.burst;
    if (this.stickId === null) {
      const k = this.keys;
      mx = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
      my = (k.has("arrowup") || k.has("w") ? 1 : 0) - (k.has("arrowdown") || k.has("s") ? 1 : 0);
      const l = Math.hypot(mx, my);
      if (l > 1) {
        mx /= l;
        my /= l;
      }
      burst = k.has("shift");
    }
    const actions = this.actions;
    this.actions = [];
    return { mx, my, burst, actions };
  }

  private down(e: PointerEvent) {
    e.preventDefault();
    this.used = true;
    const rect = this.el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {}
    if (x < rect.width / 2 && this.stickId === null) {
      this.stickId = e.pointerId;
      this.joy = { ox: x, oy: y, x, y };
      this.mx = this.my = 0;
      return;
    }
    if (this.gesture) return;
    const g: Gesture = { id: e.pointerId, x0: x, y0: y, t0: performance.now(), x, y, charging: false, done: false };
    this.gesture = g;
    this.timer = setTimeout(() => {
      if (this.gesture === g && !g.done && Math.hypot(g.x - g.x0, g.y - g.y0) < SWIPE_PX * 0.6) {
        g.charging = true;
        this.actions.push({ kind: "charge" });
        this.haptic(8);
      }
    }, HOLD_MS);
  }

  private move(e: PointerEvent) {
    const rect = this.el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (e.pointerId === this.stickId && this.joy) {
      let dx = x - this.joy.ox;
      let dy = y - this.joy.oy;
      let d = Math.hypot(dx, dy);
      // The base follows a thumb that drifts too far.
      if (d > STICK_R * 1.6) {
        const k = (d - STICK_R * 1.6) / d;
        this.joy.ox += dx * k;
        this.joy.oy += dy * k;
        dx = x - this.joy.ox;
        dy = y - this.joy.oy;
        d = Math.hypot(dx, dy);
      }
      const m = Math.min(1, d / STICK_R);
      this.mx = d ? (dx / d) * m : 0;
      this.my = d ? (-dy / d) * m : 0;
      this.burst = d > STICK_R * 1.15;
      const c = Math.min(d, STICK_R);
      this.joy.x = this.joy.ox + (d ? (dx / d) * c : 0);
      this.joy.y = this.joy.oy + (d ? (dy / d) * c : 0);
      return;
    }
    const g = this.gesture;
    if (!g || g.id !== e.pointerId) return;
    g.x = x;
    g.y = y;
    const dist = Math.hypot(x - g.x0, y - g.y0);
    const ms = performance.now() - g.t0;
    // A quick flick fires right away, before the finger lifts.
    if (!g.done && !g.charging && dist > SWIPE_PX * 1.4 && ms < 260) {
      g.done = true;
      this.swipe(g, ms);
    }
  }

  private up(e: PointerEvent, cancel = false) {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.joy = null;
      this.mx = this.my = 0;
      this.burst = false;
      return;
    }
    const g = this.gesture;
    if (!g || g.id !== e.pointerId) return;
    this.gesture = null;
    if (this.timer) clearTimeout(this.timer);
    if (cancel) {
      if (g.charging) this.actions.push({ kind: "release" });
      return;
    }
    if (g.charging) this.actions.push({ kind: "release" });
    else if (!g.done) {
      const dist = Math.hypot(g.x - g.x0, g.y - g.y0);
      if (dist > SWIPE_PX) this.swipe(g, performance.now() - g.t0);
      else this.actions.push({ kind: "tap" });
    }
  }

  private swipe(g: Gesture, ms: number) {
    const dx = g.x - g.x0;
    const dy = g.y - g.y0;
    const speed = Math.hypot(dx, dy) / Math.max(16, ms); // px per ms
    const power = Math.max(0.3, Math.min(1, (speed - 0.25) / 1.6));
    this.actions.push({ kind: "swipe", dx, dy: -dy, power });
  }

  private key(e: KeyboardEvent, down: boolean) {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (down && e.repeat) return;
    if (down) this.keys.add(k);
    else this.keys.delete(k);
    if (down) this.used = true;
    if (k === " " && down) this.actions.push({ kind: "swipe", dx: (this.keys.has("a") || this.keys.has("arrowleft") ? -0.3 : 0) + (this.keys.has("d") || this.keys.has("arrowright") ? 0.3 : 0), dy: 1, power: 0.85 });
    if ((k === "e" || k === "j") && down) this.actions.push({ kind: "tap" });
    if (k === "k") this.actions.push({ kind: down ? "charge" : "release" });
  }
}
