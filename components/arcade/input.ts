import type { Action, Input } from "@/components/arcade/engine/types";

// Touch: a floating stick on the left half, labelled buttons on the right. Keyboard for desktops.
// The buttons change with the puck:
//   with it:    SHOOT (hold for a slapshot) · PASS
//   without it: HIT · SWITCH · POKE
// Screen directions are turned into world directions (screen y goes down, world y goes up).

const STICK_R = 56;
const HOLD_MS = 170;

export type ButtonId = "a" | "b" | "c";
export type ButtonSpot = { x: number; y: number; r: number };

/** Where the buttons sit, in CSS pixels. Shared by the input and the HUD so taps land where the buttons are drawn. */
export function buttonLayout(w: number, h: number, bottom: number): Record<ButtonId, ButtonSpot> {
  const s = Math.max(0.8, Math.min(1.15, Math.min(w, h) / 390));
  const by = h - bottom - 24;
  return {
    a: { x: w - 74 * s, y: by - 58 * s, r: 48 * s }, // big: SHOOT / HIT
    b: { x: w - 170 * s, y: by - 34 * s, r: 36 * s }, // PASS / SWITCH
    c: { x: w - 62 * s, y: by - 168 * s, r: 30 * s }, // POKE (only without the puck)
  };
}

/** What the HUD needs to draw the buttons. */
export type PadView = { hasPuck: boolean; down: Record<ButtonId, boolean>; charging: boolean };

type Press = { id: number; btn: ButtonId; t0: number; charging: boolean };

export class Controls {
  mx = 0;
  my = 0;
  burst = false;
  joy: { ox: number; oy: number; x: number; y: number } | null = null;
  used = false; // any input yet (fades the hint)
  /** Set by the game each frame: does the human's player have the puck? Picks what the buttons do. */
  hasPuck = false;
  /** Bottom safe-area inset in CSS pixels, so the buttons clear the home bar. */
  bottom = 0;
  private stickId: number | null = null;
  private presses = new Map<number, Press>();
  private actions: Action[] = [];
  private keys = new Set<string>();
  private keyCharge: ReturnType<typeof setTimeout> | null = null;
  private keyCharging = false;
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
    for (const p of this.presses.values()) this.clearTimer(p);
    if (this.keyCharge) clearTimeout(this.keyCharge);
  }

  /** Button state for the HUD. */
  get pad(): PadView {
    const down = { a: false, b: false, c: false };
    let charging = this.keyCharging;
    for (const p of this.presses.values()) {
      down[p.btn] = true;
      charging ||= p.charging;
    }
    if (this.keys.has(" ")) down.a = true;
    if (this.keys.has("e") || this.keys.has("j")) down.b = true;
    if (this.keys.has("q") || this.keys.has("l")) down.c = true;
    return { hasPuck: this.hasPuck, down, charging };
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

  private buttonAt(x: number, y: number): ButtonId | null {
    const rect = this.el.getBoundingClientRect();
    const L = buttonLayout(rect.width, rect.height, this.bottom);
    let best: ButtonId | null = null;
    let bestD = Infinity;
    for (const id of ["a", "b", "c"] as const) {
      if (id === "c" && this.hasPuck) continue;
      const b = L[id];
      const d = Math.hypot(x - b.x, y - b.y) / b.r;
      if (d < 1.35 && d < bestD) {
        best = id;
        bestD = d;
      }
    }
    return best;
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
    const btn = this.buttonAt(x, y);
    if (btn) {
      this.press(e.pointerId, btn);
      return;
    }
    if (x < rect.width / 2 && this.stickId === null) {
      this.stickId = e.pointerId;
      this.joy = { ox: x, oy: y, x, y };
      this.mx = this.my = 0;
    }
  }

  private press(id: number, btn: ButtonId) {
    this.haptic(6);
    const p: Press = { id, btn, t0: performance.now(), charging: false };
    this.presses.set(id, p);
    if (btn === "a") {
      if (this.hasPuck) {
        // Hold to wind up a slapshot; a quick tap is a wrist shot (fired on release).
        timers.set(p, setTimeout(() => {
          if (this.presses.get(id) === p && this.hasPuck) {
            p.charging = true;
            this.actions.push({ kind: "charge" });
            this.haptic(10);
          }
        }, HOLD_MS));
      } else this.actions.push({ kind: "hit" });
    } else if (btn === "b") this.actions.push({ kind: "tap" });
    else this.actions.push({ kind: "poke" });
  }

  private move(e: PointerEvent) {
    if (e.pointerId !== this.stickId || !this.joy) return;
    const rect = this.el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
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
  }

  private up(e: PointerEvent, cancel = false) {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.joy = null;
      this.mx = this.my = 0;
      this.burst = false;
      return;
    }
    const p = this.presses.get(e.pointerId);
    if (!p) return;
    this.presses.delete(e.pointerId);
    this.clearTimer(p);
    if (p.btn !== "a") return;
    if (p.charging) this.actions.push({ kind: "release" });
    else if (!cancel && this.hasPuck) this.actions.push({ kind: "shoot" });
  }

  private clearTimer(p: Press) {
    const t = timers.get(p);
    if (t) clearTimeout(t);
    timers.delete(p);
  }

  private key(e: KeyboardEvent, down: boolean) {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (down && e.repeat) return;
    if (down) this.keys.add(k);
    else this.keys.delete(k);
    if (down) this.used = true;
    if (k === " ") {
      // Space: shoot (hold for a slapshot) with the puck, hit without it.
      if (down) {
        if (!this.hasPuck) this.actions.push({ kind: "hit" });
        else
          this.keyCharge = setTimeout(() => {
            this.keyCharge = null;
            if (this.keys.has(" ") && this.hasPuck) {
              this.keyCharging = true;
              this.actions.push({ kind: "charge" });
            }
          }, HOLD_MS);
      } else {
        if (this.keyCharge) clearTimeout(this.keyCharge);
        this.keyCharge = null;
        if (this.keyCharging) this.actions.push({ kind: "release" });
        else if (this.hasPuck) this.actions.push({ kind: "shoot" });
        this.keyCharging = false;
      }
    }
    if ((k === "e" || k === "j") && down) this.actions.push({ kind: "tap" });
    if ((k === "q" || k === "l") && down) this.actions.push({ kind: "poke" });
  }
}

const timers = new WeakMap<Press, ReturnType<typeof setTimeout>>();
