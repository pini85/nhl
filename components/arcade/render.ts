import { netSegments, RINK } from "@/components/arcade/engine/rink";
import type { MatchState, Skater } from "@/components/arcade/engine/types";

// Canvas renderer. World (x, y) with +y up is drawn as (u, v) = (x, -y) so screen y goes down.

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: "snow" | "spark" | "confetti" | "ring" | "fire" | "hat" | "star";
  rot: number;
  spin: number;
};

type Banner = { text: string; sub: string; color: string; t: number; max: number; big: boolean };
type Float = { text: string; x: number; y: number; t: number; color: string };

const ARENA = 6; // units of arena drawn around the rink
const HOME = "#5cc8ff";

export type Insets = { top: number; bottom: number };

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  w = 0;
  h = 0;
  scale = 10;
  private camX = 0;
  private camY = 0;
  private zoom = 1;
  private shakeT = 0;
  private shakeMag = 0;
  private flash = 0;
  private flashColor = "#fff";
  private rink: HTMLCanvasElement | null = null;
  private marks: HTMLCanvasElement | null = null;
  private k = 20; // offscreen pixels per unit
  private particles: Particle[] = [];
  private banners: Banner[] = [];
  private floats: Float[] = [];
  private ticker = { text: "", t: 0 };
  private prevV = new Map<number, { vx: number; vy: number; x: number; y: number }>();
  private logo: HTMLImageElement | null = null;
  private bulge = { side: 0, t: 0 };
  calm = false;
  insets: Insets = { top: 0, bottom: 0 };
  joy: { ox: number; oy: number; x: number; y: number } | null = null;
  hint = 1; // controls hint opacity

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    const img = new Image();
    img.onload = () => {
      this.logo = img;
      this.buildRink();
    };
    img.src = "/brand/logo-256.webp";
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.dpr = Math.min(dpr, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.scale = Math.min(w / (RINK.hw * 2 + 1.4), h / 36);
    const k = Math.min(26, Math.max(10, this.scale * this.dpr));
    if (Math.abs(k - this.k) > 1 || !this.rink) {
      this.k = k;
      this.buildRink();
      this.marks = document.createElement("canvas");
      this.marks.width = Math.round((RINK.hw + ARENA) * 2 * k);
      this.marks.height = Math.round((RINK.hl + ARENA) * 2 * k);
    }
  }

  // ————— effects API —————

  shake(mag: number) {
    if (this.calm) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = 0.35;
  }

  flashScreen(color: string, a = 0.35) {
    this.flash = this.calm ? a * 0.4 : a;
    this.flashColor = color;
  }

  banner(text: string, sub = "", color = "#fff", big = true, max = 2.2) {
    this.banners = this.banners.filter((b) => !b.big || !big);
    this.banners.push({ text, sub, color, t: 0, max, big });
  }

  float(text: string, x: number, y: number, color = "#fff") {
    this.floats.push({ text, x, y, t: 0, color });
    if (this.floats.length > 8) this.floats.shift();
  }

  say(text: string) {
    this.ticker = { text, t: 0 };
  }

  netBulge(side: number) {
    this.bulge = { side, t: 0 };
  }

  burst(kind: Particle["kind"], x: number, y: number, n: number, color: string | string[], speed = 8, size = 0.18) {
    if (this.calm) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.9);
      this.particles.push({
        x, y, z: 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: kind === "confetti" ? 4 + Math.random() * 8 : 0,
        life: 0, max: kind === "confetti" ? 1.6 + Math.random() : kind === "spark" ? 0.35 : 0.6 + Math.random() * 0.3,
        size: size * (0.6 + Math.random() * 0.8), color: Array.isArray(color) ? color[i % color.length] : color, kind,
        rot: Math.random() * 6, spin: (Math.random() - 0.5) * 14,
      });
    }
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
  }

  ring(x: number, y: number, color: string, size = 3) {
    this.particles.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 0.45, size, color, kind: "ring", rot: 0, spin: 0 });
  }

  hats() {
    const vh = this.h / (2 * this.scale);
    for (let i = 0; i < (this.calm ? 8 : 26); i++) {
      this.particles.push({
        x: (Math.random() - 0.5) * RINK.hw * 1.8, y: this.camY + vh + Math.random() * 6, z: 0, vx: (Math.random() - 0.5) * 2, vy: -10 - Math.random() * 8, vz: 0,
        life: 0, max: 3 + Math.random(), size: 0.9, color: "#111", kind: "hat", rot: Math.random() * 6, spin: (Math.random() - 0.5) * 6,
      });
    }
  }

  // ————— frame —————

  frame(state: MatchState, dt: number, focus: { x: number; y: number; vx: number; vy: number }) {
    const ctx = this.ctx;
    const { w, h, dpr } = this;
    this.updateCamera(state, dt, focus);
    this.carve(state, dt);
    this.stepParticles(dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#03060d";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // World transform.
    let sx = 0;
    let sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * (this.shakeT / 0.35);
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m;
      if (this.shakeT <= 0) this.shakeMag = 0;
    }
    const S = this.scale * this.zoom * dpr;
    const ox = (w / 2 + sx) * dpr - this.camX * S;
    const oy = (h / 2 + sy) * dpr + this.camY * S;
    ctx.setTransform(S, 0, 0, S, ox, oy);

    if (this.rink) {
      const wu = (RINK.hw + ARENA) * 2;
      const hu = (RINK.hl + ARENA) * 2;
      ctx.drawImage(this.rink, -wu / 2, -hu / 2, wu, hu);
      if (this.marks) ctx.drawImage(this.marks, -wu / 2, -hu / 2, wu, hu);
    }
    this.drawCrowdFlashes(state);
    this.drawNets(dt);
    this.drawGroundParticles();
    const order = [...state.skaters].sort((a, b) => b.y - a.y);
    for (const s of order) this.drawSkater(state, s);
    this.drawPucks(state);
    this.drawAirParticles();
    this.drawFloats(dt);

    // Screen space.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.flash > 0.01) {
      ctx.globalAlpha = this.flash;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      this.flash *= Math.exp(-dt * 6);
    }
    this.vignette();
    this.drawHud(state);
    this.drawBanners(dt);
    this.drawTicker(dt);
    this.drawJoystick();
  }

  private updateCamera(state: MatchState, dt: number, f: { x: number; y: number; vx: number; vy: number }) {
    let tz = 1;
    let ty = f.y + f.vy * 0.28 + 2.5; // lead up ice
    let tx = 0;
    if (state.phase === "goal" && state.lastGoal && state.phaseT < 2.2 && !this.calm) {
      tz = 1.45;
      ty = state.lastGoal.y * 0.92;
      tx = state.lastGoal.x * 0.5;
    }
    const k = 1 - Math.exp(-dt * (state.phase === "goal" ? 3 : 5));
    this.zoom += (tz - this.zoom) * k;
    const vh = this.h / (2 * this.scale * this.zoom);
    const vw = this.w / (2 * this.scale * this.zoom);
    const limY = RINK.hl + 1.6 - vh + (this.insets.top + 40) / (this.scale * this.zoom);
    const ty2 = limY > 0 ? Math.max(-limY, Math.min(limY, ty)) : 0;
    const limX = Math.max(0, RINK.hw + 0.7 - vw);
    this.camY += (ty2 - this.camY) * k;
    this.camX += (Math.max(-limX, Math.min(limX, tx)) - this.camX) * k;
  }

  /** Skates leave marks in the ice; hard stops throw snow. */
  private carve(state: MatchState, dt: number) {
    const m = this.marks?.getContext("2d");
    for (const s of state.skaters) {
      const p = this.prevV.get(s.i);
      this.prevV.set(s.i, { vx: s.vx, vy: s.vy, x: s.x, y: s.y });
      if (!p || !m || dt <= 0) continue;
      const sp = Math.hypot(s.vx, s.vy);
      const jump = Math.hypot(s.x - p.x, s.y - p.y);
      if (sp < 1.5 || jump > 2) continue;
      const k = this.k;
      const cx = (RINK.hw + ARENA) * k;
      const cy = (RINK.hl + ARENA) * k;
      const nx = -s.vy / sp;
      const ny = s.vx / sp;
      m.strokeStyle = "rgba(120,150,180,0.10)";
      m.lineWidth = Math.max(1, k * 0.07);
      for (const side of [-0.28, 0.28]) {
        m.beginPath();
        m.moveTo(cx + (p.x + nx * side) * k, cy - (p.y + ny * side) * k);
        m.lineTo(cx + (s.x + nx * side) * k, cy - (s.y + ny * side) * k);
        m.stroke();
      }
      const decel = ((p.vx - s.vx) * s.vx + (p.vy - s.vy) * s.vy) / (sp * dt);
      if (decel > 26 && sp > 4) {
        m.strokeStyle = "rgba(255,255,255,0.16)";
        m.lineWidth = k * 0.35;
        m.beginPath();
        m.moveTo(cx + (s.x - nx * 0.6) * k, cy - (s.y - ny * 0.6) * k);
        m.lineTo(cx + (s.x + nx * 0.6) * k, cy - (s.y + ny * 0.6) * k);
        m.stroke();
        if (Math.random() < 0.5) this.spray(s);
      }
    }
  }

  private spray(s: Skater) {
    const sp = Math.hypot(s.vx, s.vy) || 1;
    for (let i = 0; i < (this.calm ? 1 : 4); i++) {
      const a = Math.atan2(s.vy, s.vx) + (Math.random() - 0.5) * 1.6;
      const v = sp * (0.4 + Math.random() * 0.6);
      this.particles.push({ x: s.x + (s.vx / sp) * 0.8, y: s.y + (s.vy / sp) * 0.8, z: 0.1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 2 + Math.random() * 3, life: 0, max: 0.45, size: 0.12 + Math.random() * 0.12, color: "#ffffff", kind: "snow", rot: 0, spin: 0 });
    }
  }

  private stepParticles(dt: number) {
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.kind === "confetti") {
        p.vz -= 14 * dt;
        p.z = Math.max(0, p.z + p.vz * dt);
        if (p.z === 0) {
          p.vx *= 0.9;
          p.vy *= 0.9;
          p.spin *= 0.9;
        } else {
          p.vx *= Math.exp(-1.5 * dt);
          p.vy *= Math.exp(-1.5 * dt);
        }
      } else if (p.kind === "snow" || p.kind === "spark") {
        p.vz -= 20 * dt;
        p.z = Math.max(0, p.z + p.vz * dt);
        const f = Math.exp(-4 * dt);
        p.vx *= f;
        p.vy *= f;
      } else if (p.kind === "fire") {
        p.vx *= Math.exp(-3 * dt);
        p.vy *= Math.exp(-3 * dt);
      } else if (p.kind === "hat") {
        if (p.life > p.max - 1) {
          p.vx *= 0.9;
          p.vy *= 0.9;
          p.spin *= 0.9;
        }
      }
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
  }

  // ————— static art —————

  private buildRink() {
    const k = this.k;
    const c = document.createElement("canvas");
    c.width = Math.round((RINK.hw + ARENA) * 2 * k);
    c.height = Math.round((RINK.hl + ARENA) * 2 * k);
    const g = c.getContext("2d")!;
    g.setTransform(k, 0, 0, k, c.width / 2, c.height / 2); // world units, v down

    // Arena: dark stands with a crowd of little heads.
    g.fillStyle = "#060a14";
    g.fillRect(-RINK.hw - ARENA, -RINK.hl - ARENA, (RINK.hw + ARENA) * 2, (RINK.hl + ARENA) * 2);
    const crowd = ["#1d3557", "#2a2f45", "#5cc8ff", "#e8f1ff", "#3a2a4a", "#13233f", "#ff3d6e", "#ffcf5a"];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = -RINK.hl - ARENA + 0.4; y < RINK.hl + ARENA; y += 0.55) {
      for (let x = -RINK.hw - ARENA + 0.4; x < RINK.hw + ARENA; x += 0.55) {
        if (insideRounded(x, y, RINK.hw + 1.2, RINK.hl + 1.2, RINK.corner + 1.2)) continue;
        if (rnd() < 0.18) continue;
        g.globalAlpha = 0.25 + rnd() * 0.35;
        g.fillStyle = crowd[Math.floor(rnd() * crowd.length)];
        g.beginPath();
        g.arc(x + (rnd() - 0.5) * 0.15, y + (rnd() - 0.5) * 0.15, 0.17, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;

    // Glass glow + boards.
    roundRect(g, RINK.hw + 0.55, RINK.hl + 0.55, RINK.corner + 0.55);
    g.fillStyle = "#0d1526";
    g.fill();
    g.save();
    g.shadowColor = "rgba(92,200,255,0.9)";
    g.shadowBlur = k * 1.2;
    roundRect(g, RINK.hw + 0.5, RINK.hl + 0.5, RINK.corner + 0.5);
    g.strokeStyle = "rgba(92,200,255,0.55)";
    g.lineWidth = 0.18;
    g.stroke();
    g.restore();

    // Ice.
    roundRect(g, RINK.hw, RINK.hl, RINK.corner);
    const grad = g.createRadialGradient(0, 0, 4, 0, 0, RINK.hl * 1.1);
    grad.addColorStop(0, "#f7fbff");
    grad.addColorStop(1, "#d9e8f5");
    g.fillStyle = grad;
    g.fill();
    g.save();
    g.clip();
    // Fine scratches for texture.
    g.strokeStyle = "rgba(150,180,210,0.08)";
    g.lineWidth = 0.05;
    for (let i = 0; i < 260; i++) {
      const x = (rnd() - 0.5) * RINK.hw * 2;
      const y = (rnd() - 0.5) * RINK.hl * 2;
      const a = rnd() * Math.PI;
      const l = 1 + rnd() * 4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    const red = "#d6213a";
    const blue = "#1f5fd6";
    // Creases.
    for (const s of [1, -1]) {
      g.fillStyle = "rgba(92,170,255,0.35)";
      g.beginPath();
      g.moveTo(-RINK.mouth - 0.6, -s * RINK.goalY);
      g.arc(0, -s * RINK.goalY, RINK.creaseR, s > 0 ? 0 : Math.PI, s > 0 ? Math.PI : 0);
      g.closePath();
      g.fill();
      g.strokeStyle = red;
      g.lineWidth = 0.12;
      g.stroke();
      // Goal line.
      g.beginPath();
      g.moveTo(-RINK.hw, -s * RINK.goalY);
      g.lineTo(RINK.hw, -s * RINK.goalY);
      g.lineWidth = 0.15;
      g.stroke();
      // Blue line.
      g.fillStyle = blue;
      g.fillRect(-RINK.hw, -s * RINK.blueY - 0.3, RINK.hw * 2, 0.6);
      // End-zone circles and dots.
      for (const x of [-RINK.circleX, RINK.circleX]) {
        g.strokeStyle = red;
        g.lineWidth = 0.13;
        g.beginPath();
        g.arc(x, -s * RINK.circleY, RINK.circleR, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = red;
        g.beginPath();
        g.arc(x, -s * RINK.circleY, 0.45, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(x, -s * (RINK.blueY + 2.2), 0.4, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Centre line, circle, logo.
    g.fillStyle = red;
    g.fillRect(-RINK.hw, -0.3, RINK.hw * 2, 0.6);
    g.fillStyle = "rgba(255,255,255,0.6)";
    for (let x = -RINK.hw; x < RINK.hw; x += 1.2) g.fillRect(x, -0.05, 0.5, 0.1);
    g.strokeStyle = blue;
    g.lineWidth = 0.13;
    g.beginPath();
    g.arc(0, 0, RINK.circleR, 0, Math.PI * 2);
    g.stroke();
    if (this.logo) {
      g.globalAlpha = 0.28;
      g.save();
      g.beginPath();
      g.arc(0, 0, 3.6, 0, Math.PI * 2);
      g.clip();
      g.drawImage(this.logo, -3.6, -3.6, 7.2, 7.2);
      g.restore();
      g.globalAlpha = 1;
    } else {
      g.fillStyle = blue;
      g.beginPath();
      g.arc(0, 0, 0.45, 0, Math.PI * 2);
      g.fill();
    }
    // "DROP DROP DROP" painted in the neutral zone.
    g.fillStyle = "rgba(31,95,214,0.16)";
    g.font = "900 1.5px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("DROP DROP DROP", 0, -5.2);
    g.save();
    g.rotate(Math.PI);
    g.fillText("DROP DROP DROP", 0, -5.2);
    g.restore();
    g.restore();

    // Dasher boards: white with a yellow kick plate.
    roundRect(g, RINK.hw + 0.12, RINK.hl + 0.12, RINK.corner + 0.12);
    g.strokeStyle = "#ffd23d";
    g.lineWidth = 0.24;
    g.stroke();
    roundRect(g, RINK.hw + 0.4, RINK.hl + 0.4, RINK.corner + 0.4);
    g.strokeStyle = "#f2f6fb";
    g.lineWidth = 0.36;
    g.stroke();
    this.rink = c;
  }

  // ————— dynamic art —————

  private drawCrowdFlashes(state: MatchState) {
    if (this.calm) return;
    const ctx = this.ctx;
    const n = state.phase === "goal" ? 10 : 1;
    for (let i = 0; i < n; i++) {
      if (Math.random() > (state.phase === "goal" ? 0.9 : 0.05)) continue;
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = (Math.random() - 0.5) * (RINK.hw * 2 + 8);
      const y = side * (RINK.hl + 1.5 + Math.random() * (ARENA - 2));
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, 0.18 + Math.random() * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawNets(dt: number) {
    const ctx = this.ctx;
    this.bulge.t += dt;
    for (const s of [1, -1] as const) {
      const segs = netSegments(s);
      const bul = this.bulge.side === s ? Math.max(0, 1 - this.bulge.t / 0.9) * 0.6 : 0;
      // Mesh.
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.moveTo(-RINK.mouth, -s * RINK.goalY);
      for (const [, , bx, by] of segs) ctx.lineTo(bx, -(by + s * (by !== s * RINK.goalY ? bul : 0)));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(160,170,190,0.7)";
      ctx.lineWidth = 0.04;
      for (let i = -RINK.mouth + 0.3; i < RINK.mouth; i += 0.35) {
        ctx.beginPath();
        ctx.moveTo(i, -s * RINK.goalY);
        ctx.lineTo(i * 0.8, -s * (RINK.goalY + RINK.depth + bul));
        ctx.stroke();
      }
      // Frame.
      ctx.strokeStyle = "#e0263d";
      ctx.lineWidth = 0.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(segs[0][0], -segs[0][1]);
      for (const [, , bx, by] of segs) ctx.lineTo(bx, -(by + (by !== s * RINK.goalY ? s * bul : 0)));
      ctx.stroke();
    }
  }

  private drawSkater(state: MatchState, s: Skater) {
    const ctx = this.ctx;
    const home = s.team === 0;
    const color = home ? HOME : (state.setup.away.color ?? "#ff3d6e");
    const u = s.x;
    const v = -s.y;
    const controlled = !state.setup.humanless && s.i === state.controlled;
    const fire = state.onFire.includes(s.i);

    // Shadow.
    ctx.fillStyle = "rgba(10,20,40,0.22)";
    ctx.beginPath();
    ctx.ellipse(u + 0.25, v + 0.35, s.r * 1.1, s.r * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ring under the human's player / "you".
    if (controlled) {
      const pulse = 0.5 + 0.5 * Math.sin(state.t * 8);
      ctx.strokeStyle = s.info.you ? "#ffcf5a" : "#ffffff";
      ctx.globalAlpha = 0.65 + pulse * 0.35;
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.arc(u, v, s.r + 0.38 + pulse * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Stamina arc.
      ctx.strokeStyle = s.stamina > 0.3 ? "rgba(92,255,168,0.9)" : "rgba(255,90,110,0.9)";
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.arc(u, v, s.r + 0.68, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * s.stamina);
      ctx.stroke();
    }
    if (s.charge >= 0) {
      ctx.strokeStyle = s.charge >= 1 ? "#ff5a3d" : "#ffd23d";
      ctx.lineWidth = 0.22;
      ctx.beginPath();
      ctx.arc(u, v, s.r + 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.charge);
      ctx.stroke();
    }

    if (fire && Math.random() < 0.7) {
      this.particles.push({ x: s.x + (Math.random() - 0.5) * 0.8, y: s.y + (Math.random() - 0.5) * 0.8, z: 0, vx: -s.vx * 0.3 + (Math.random() - 0.5) * 2, vy: -s.vy * 0.3 + (Math.random() - 0.5) * 2, vz: 0, life: 0, max: 0.45, size: 0.35 + Math.random() * 0.3, color: Math.random() < 0.5 ? "#ff7a1a" : "#ffd23d", kind: "fire", rot: 0, spin: 0 });
    }

    ctx.save();
    ctx.translate(u, v);
    let a = -s.face;
    if (s.stun > 0) a += state.t * 14;
    ctx.rotate(a);
    // Stick: from the right shoulder to the blade.
    {
      const bx = s.r + 0.62 * (s.goalie ? 0.5 : 1);
      ctx.strokeStyle = home ? "#1b1f2a" : "#2b2117";
      ctx.lineWidth = 0.13;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0.1, 0.55 * s.r);
      ctx.lineTo(bx, 0.12);
      ctx.stroke();
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.moveTo(bx - 0.05, 0.12);
      ctx.lineTo(bx + 0.15, -0.28);
      ctx.stroke();
    }
    if (s.goalie) {
      // Pads and blocker.
      ctx.fillStyle = "#f4f7fb";
      roundBox(ctx, -0.35, -s.r * 1.05, 0.7, s.r * 2.1, 0.25);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(-0.2, -s.r * 0.9, 0.12, s.r * 1.8);
    }
    // Shoulders (jersey).
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, s.r * 0.62, s.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 0.08;
    ctx.stroke();
    // Stripe.
    ctx.strokeStyle = home ? "#0d1b33" : "#ffffff";
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.ellipse(0, 0, s.r * 0.45, s.r * 0.8, 0, Math.PI * 0.6, Math.PI * 1.4);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Helmet.
    ctx.fillStyle = home ? "#0d1b33" : "#1a1a1a";
    ctx.beginPath();
    ctx.arc(0.08, 0, s.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(0.18, -0.1, s.r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (s.stun > 0) {
      for (let i = 0; i < 3; i++) {
        const ang = state.t * 6 + (i * Math.PI * 2) / 3;
        star(ctx, u + Math.cos(ang) * 0.9, v - 1.1 + Math.sin(ang) * 0.3, 0.22, "#ffd23d");
      }
    }

    // Name tag.
    const carrier = state.pucks.some((p) => p.owner === s.i);
    const showName = controlled || carrier || state.phase === "faceoff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (showName) {
      const label = `${s.info.number} ${s.info.name}`;
      ctx.font = `800 ${controlled ? 0.72 : 0.6}px system-ui, sans-serif`;
      ctx.lineWidth = 0.22;
      ctx.strokeStyle = "rgba(3,6,13,0.85)";
      ctx.lineJoin = "round";
      const ty = v - s.r - 0.95;
      ctx.strokeText(label, u, ty);
      ctx.fillStyle = s.info.you ? "#ffcf5a" : home ? "#ffffff" : color;
      ctx.fillText(label, u, ty);
      if (fire) {
        ctx.font = "700 0.6px system-ui, sans-serif";
        ctx.fillText("🔥", u + ctx.measureText(label).width / 2 + 0.6, ty);
      }
    } else {
      ctx.font = "800 0.55px system-ui, sans-serif";
      ctx.fillStyle = home ? "#0d1b33" : "#111";
      ctx.globalAlpha = 0.7;
      ctx.fillText(String(s.info.number), u, v - s.r - 0.6);
      ctx.globalAlpha = 1;
    }
    if (controlled && state.phase === "play") {
      // Arrow over the human's player.
      ctx.fillStyle = s.info.you ? "#ffcf5a" : "#ffffff";
      const ay = v - s.r - (showName ? 1.75 : 1.2) - Math.abs(Math.sin(state.t * 5)) * 0.25;
      ctx.beginPath();
      ctx.moveTo(u - 0.35, ay - 0.35);
      ctx.lineTo(u + 0.35, ay - 0.35);
      ctx.lineTo(u, ay + 0.05);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawPucks(state: MatchState) {
    const ctx = this.ctx;
    for (const p of state.pucks) {
      const sp = Math.hypot(p.vx, p.vy);
      const shooter = p.shotBy >= 0 ? state.skaters[p.shotBy] : null;
      const hot = shooter && state.onFire.includes(shooter.i);
      // Trail.
      if (p.owner < 0 && sp > 8 && p.trail.length > 2) {
        ctx.lineCap = "round";
        for (let i = 1; i < p.trail.length; i++) {
          const a = p.trail[i - 1];
          const b = p.trail[i];
          const t = i / p.trail.length;
          ctx.strokeStyle = hot ? `rgba(255,${120 + 100 * t},40,${t * 0.8})` : p.oneTimer ? `rgba(92,200,255,${t * 0.8})` : `rgba(40,60,90,${t * 0.35})`;
          ctx.lineWidth = 0.08 + t * (hot ? 0.45 : 0.25);
          ctx.beginPath();
          ctx.moveTo(a.x, -a.y - a.z * 0.7);
          ctx.lineTo(b.x, -b.y - b.z * 0.7);
          ctx.stroke();
        }
        if (hot && Math.random() < 0.8) this.burst("fire", p.x, p.y, 1, "#ff7a1a", 1, 0.3);
      }
      // Shadow and puck.
      ctx.fillStyle = "rgba(10,20,40,0.3)";
      ctx.beginPath();
      ctx.ellipse(p.x + 0.08 + p.z * 0.15, -p.y + 0.1, 0.26, 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      const r = 0.25 * (1 + p.z * 0.12);
      ctx.fillStyle = "#0b0d12";
      ctx.beginPath();
      ctx.arc(p.x, -p.y - p.z * 0.7, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 0.05;
      ctx.stroke();
    }
  }

  private drawGroundParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const t = p.life / p.max;
      if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 1 - t;
        ctx.lineWidth = 0.3 * (1 - t) + 0.05;
        ctx.beginPath();
        ctx.arc(p.x, -p.y, p.size * (0.3 + t), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "confetti" && p.z === 0) {
        ctx.globalAlpha = Math.min(1, (1 - t) * 3);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, -p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawAirParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const t = p.life / p.max;
      const v = -p.y - p.z * 0.7;
      if (p.kind === "snow" || p.kind === "spark") {
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, v, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "fire") {
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, v, p.size * (1 - t * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "confetti" && p.z > 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, v);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.rot * 2));
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
      } else if (p.kind === "hat") {
        ctx.globalAlpha = Math.min(1, (p.max - p.life) * 2);
        ctx.save();
        ctx.translate(p.x, -p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = "#15171d";
        ctx.fillRect(-0.7, 0.15, 1.4, 0.22);
        ctx.fillRect(-0.42, -0.6, 0.84, 0.8);
        ctx.fillStyle = "#d6213a";
        ctx.fillRect(-0.42, -0.02, 0.84, 0.14);
        ctx.restore();
      } else if (p.kind === "star") {
        ctx.globalAlpha = 1 - t;
        star(ctx, p.x, v, p.size * (1 + t), p.color);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFloats(dt: number) {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of this.floats) {
      f.t += dt;
      const t = f.t / 1.1;
      const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (t - 0.15) * 0.4);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 0.6) / 0.4);
      ctx.font = `900 ${0.95 * pop}px system-ui, sans-serif`;
      ctx.lineWidth = 0.25;
      ctx.strokeStyle = "rgba(3,6,13,0.9)";
      ctx.strokeText(f.text, f.x, -f.y - 1.6 - t * 1.4);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, -f.y - 1.6 - t * 1.4);
    }
    ctx.globalAlpha = 1;
    this.floats = this.floats.filter((f) => f.t < 1.1);
  }

  private vignette() {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.45, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawHud(state: MatchState) {
    const ctx = this.ctx;
    const top = this.insets.top + 8;
    const cx = this.w / 2;
    const W = Math.min(this.w - 24, 340);
    const H = 42;
    // Jumbotron.
    ctx.fillStyle = "rgba(7,11,20,0.82)";
    roundBox(ctx, cx - W / 2, top, W, H, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(92,200,255,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    const away = state.setup.away;
    const home = state.setup.home;
    ctx.textBaseline = "middle";
    const side = (abbr: string, score: number, color: string, x: number, align: CanvasTextAlign, sog: number) => {
      ctx.textAlign = align;
      ctx.fillStyle = color;
      ctx.font = "800 13px system-ui, sans-serif";
      ctx.fillText(abbr, x, top + 15);
      ctx.fillStyle = "#7f95b5";
      ctx.font = "600 10px system-ui, sans-serif";
      ctx.fillText(`SOG ${sog}`, x, top + 30);
    };
    side(home.abbr, state.score[0], HOME, cx - W / 2 + 12, "left", state.sog[0]);
    side(away.abbr, state.score[1], away.color, cx + W / 2 - 12, "right", state.sog[1]);
    ctx.textAlign = "center";
    ctx.font = "900 26px system-ui, sans-serif";
    ctx.fillStyle = "#e8f1ff";
    ctx.fillText(String(state.score[0]), cx - 52, top + H / 2 + 1);
    ctx.fillText(String(state.score[1]), cx + 52, top + H / 2 + 1);
    const c = state.ot ? state.clock : Math.max(0, state.clock);
    const mm = Math.floor(c / 60);
    const ss = Math.floor(c % 60);
    ctx.font = "800 15px ui-monospace, monospace";
    ctx.fillStyle = state.ot ? "#ffb648" : !state.ot && c < 20 ? "#ff7a8a" : "#e8f1ff";
    ctx.fillText(`${mm}:${String(ss).padStart(2, "0")}`, cx, top + 16);
    ctx.font = "700 9px system-ui, sans-serif";
    ctx.fillStyle = state.ot ? "#ffb648" : "#7f95b5";
    ctx.fillText(state.ot ? "OVERTIME" : state.setup.insane ? "INSANE" : "3RD", cx, top + 31);
  }

  private drawBanners(dt: number) {
    const ctx = this.ctx;
    const cy = this.h * 0.36;
    for (const b of this.banners) {
      b.t += dt;
      const inT = Math.min(1, b.t / 0.18);
      const pop = b.big ? 1 + (1 - easeOutBack(inT)) * -0.6 : 1;
      const alpha = Math.min(1, (b.max - b.t) / 0.35);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(this.w / 2, b.big ? cy : cy + 70);
      ctx.scale(pop, pop);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const size = b.big ? Math.min(64, this.w / Math.max(4, b.text.length * 0.62)) : 22;
      ctx.font = `900 italic ${size}px system-ui, sans-serif`;
      ctx.lineWidth = b.big ? 8 : 5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(3,6,13,0.9)";
      ctx.strokeText(b.text, 0, 0);
      if (!this.calm && b.big) {
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 24;
      }
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      ctx.shadowBlur = 0;
      if (b.sub) {
        ctx.font = "800 14px system-ui, sans-serif";
        ctx.lineWidth = 4;
        ctx.strokeText(b.sub, 0, size * 0.75);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(b.sub, 0, size * 0.75);
      }
      ctx.restore();
    }
    this.banners = this.banners.filter((b) => b.t < b.max);
  }

  private drawTicker(dt: number) {
    if (!this.ticker.text) return;
    this.ticker.t += dt;
    const a = Math.min(1, Math.min(this.ticker.t / 0.15, (3 - this.ticker.t) / 0.4));
    if (a <= 0) return;
    const ctx = this.ctx;
    const y = this.h - this.insets.bottom - 150;
    ctx.globalAlpha = a;
    ctx.font = "800 13px system-ui, sans-serif";
    const w = ctx.measureText(this.ticker.text).width + 24;
    ctx.fillStyle = "rgba(7,11,20,0.75)";
    roundBox(ctx, this.w / 2 - w / 2, y - 14, w, 28, 14);
    ctx.fill();
    ctx.fillStyle = "#e8f1ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.ticker.text, this.w / 2, y);
    ctx.globalAlpha = 1;
  }

  private drawJoystick() {
    const ctx = this.ctx;
    const by = this.h - this.insets.bottom - 70;
    if (this.joy) {
      const { ox, oy, x, y } = this.joy;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox, oy, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(92,200,255,0.65)";
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.hint > 0) {
      ctx.globalAlpha = 0.5 * this.hint;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(80, by, 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    if (this.hint > 0) {
      ctx.globalAlpha = this.hint;
      ctx.font = "700 11px system-ui, sans-serif";
      ctx.fillStyle = "rgba(232,241,255,0.85)";
      ctx.textAlign = "center";
      ctx.fillText("SKATE", 80, by);
      ctx.fillText("push far = BURST", 80, by + 62);
      ctx.textAlign = "right";
      const rx = this.w - 18;
      ctx.fillText("TAP  pass · switch", rx, by - 22);
      ctx.fillText("SWIPE  shoot · hit", rx, by);
      ctx.fillText("HOLD  slapshot · poke", rx, by + 22);
      ctx.globalAlpha = 1;
    }
  }
}

// ————— helpers —————

function insideRounded(x: number, y: number, hw: number, hl: number, r: number) {
  const ix = hw - r;
  const iy = hl - r;
  const dx = x - Math.max(-ix, Math.min(ix, x));
  const dy = y - Math.max(-iy, Math.min(iy, y));
  return Math.abs(x) <= hw && Math.abs(y) <= hl && Math.hypot(dx, dy) <= r;
}

function roundRect(g: CanvasRenderingContext2D, hw: number, hl: number, r: number) {
  g.beginPath();
  g.moveTo(-hw + r, -hl);
  g.arcTo(hw, -hl, hw, hl, r);
  g.arcTo(hw, hl, -hw, hl, r);
  g.arcTo(-hw, hl, -hw, -hl, r);
  g.arcTo(-hw, -hl, hw, -hl, r);
  g.closePath();
}

function roundBox(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

