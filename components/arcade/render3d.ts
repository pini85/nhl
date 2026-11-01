import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Fog,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  PCFShadowMap,
  PerspectiveCamera,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { RINK } from "@/components/arcade/engine/rink";
import type { GameEvent, MatchState, Skater } from "@/components/arcade/engine/types";
import { type Insets, type Particle, Renderer, type View } from "@/components/arcade/render";
import { Arena } from "@/components/arcade/three/arena";
import { kitFor, Parts, PlayerModel } from "@/components/arcade/three/player";

// The 3D arena view. A broadcast camera sits behind the home end and follows the play up ice, so
// "up the screen" is still "towards the goal we attack" and the touch controls work unchanged.
// Sim (x, y, height) → three (x, height, -y). The flat Renderer draws the HUD on a canvas on top.

const HOME = "#5cc8ff";
const MAX_PARTICLES = 900;
const ELEV = (56 * Math.PI) / 180; // camera pitch above the ice

const W = (x: number, y: number, z = 0) => new Vector3(x, z, -y);

type Ring = { mesh: Mesh; t: number; max: number; size: number };
type Hat = { mesh: Mesh; x: number; y: number; z: number; vz: number; spin: number; t: number };

export class Arena3D implements View {
  private gl: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(50, 1, 0.5, 400);
  private hud: Renderer;
  private arena: Arena;
  private parts = new Parts();
  private players: PlayerModel[] = [];
  private pucks: { mesh: Mesh; glow: Mesh; trail: Mesh }[] = [];
  private marker: { ring: Mesh; stamina: Mesh; charge: Mesh; arrow: Mesh };
  private particles: Particle[] = [];
  private pts: Points;
  private rings: Ring[] = [];
  private hatList: Hat[] = [];
  private own: (BufferGeometry | Material)[] = [];
  private w = 1;
  private h = 1;
  private camX = 0;
  private camY = -6;
  private zoom = 1;
  private shakeT = 0;
  private shakeMag = 0;
  private prevV = new Map<number, { vx: number; vy: number; x: number; y: number }>();
  private frameN = 0;
  private marksDirty = false;
  private setupDone = false;
  private excitement = 0;
  private lastStamina = -1;
  private lastCharge = -2;

  constructor(glCanvas: HTMLCanvasElement, hudCanvas: HTMLCanvasElement, awayColor: string) {
    this.gl = new WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: "high-performance" });
    this.gl.outputColorSpace = SRGBColorSpace;
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = PCFShadowMap;
    this.hud = new Renderer(hudCanvas, true);
    this.hud.project = (x, y, z) => this.project(x, y, z);

    this.scene.background = new Color("#05080f");
    this.scene.fog = new Fog("#05080f", 60, 130);
    this.arena = new Arena(this.scene, awayColor);

    const keep = <T extends BufferGeometry | Material>(x: T) => {
      this.own.push(x);
      return x;
    };

    // Controlled-player markers.
    const flat = (g: BufferGeometry, color: string, opacity = 0.9) => {
      const m = new Mesh(g, keep(new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.03;
      m.renderOrder = 2;
      this.scene.add(m);
      return m;
    };
    this.marker = {
      ring: flat(keep(new RingGeometry(1.2, 1.5, 40)), "#ffffff"),
      stamina: flat(keep(new RingGeometry(1.6, 1.75, 40)), "#5cffa8"),
      charge: flat(keep(new RingGeometry(1.9, 2.15, 40)), "#ffd23d"),
      arrow: new Mesh(keep(new ConeGeometry(0.35, 0.7, 4)), keep(new MeshBasicMaterial({ color: "#ffcf5a" }))),
    };
    this.marker.arrow.rotation.x = Math.PI;
    this.scene.add(this.marker.arrow);

    // Particles: one point cloud.
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(DynamicDrawUsage));
    g.setAttribute("color", new BufferAttribute(new Float32Array(MAX_PARTICLES * 4), 4).setUsage(DynamicDrawUsage));
    g.setAttribute("size", new BufferAttribute(new Float32Array(MAX_PARTICLES), 1).setUsage(DynamicDrawUsage));
    this.pts = new Points(
      keep(g),
      keep(
        new ShaderMaterial({
          uniforms: { scale: { value: 400 } },
          transparent: true,
          depthWrite: false,
          vertexShader: `
            attribute float size; attribute vec4 color; varying vec4 vColor; uniform float scale;
            void main() {
              vColor = color;
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = size * scale / -mv.z;
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: `
            varying vec4 vColor;
            void main() {
              float d = length(gl_PointCoord - 0.5);
              if (d > 0.5) discard;
              gl_FragColor = vec4(vColor.rgb, vColor.a * smoothstep(0.5, 0.25, d));
            }`,
        }),
      ),
    );
    this.pts.frustumCulled = false;
    this.pts.renderOrder = 5;
    this.scene.add(this.pts);
  }

  // ————— View: HUD pass-through —————

  get calm() {
    return this.hud.calm;
  }
  set calm(v: boolean) {
    this.hud.calm = v;
  }
  get insets(): Insets {
    return this.hud.insets;
  }
  set insets(v: Insets) {
    this.hud.insets = v;
  }
  get joy() {
    return this.hud.joy;
  }
  set joy(v) {
    this.hud.joy = v;
  }
  get hint() {
    return this.hud.hint;
  }
  set hint(v: number) {
    this.hud.hint = v;
  }
  flashScreen(color: string, a?: number) {
    this.hud.flashScreen(color, a);
  }
  banner(text: string, sub?: string, color?: string, big?: boolean, max?: number) {
    this.hud.banner(text, sub, color, big, max);
  }
  float(text: string, x: number, y: number, color?: string) {
    this.hud.float(text, x, y, color);
  }
  say(text: string) {
    this.hud.say(text);
  }

  // ————— View: 3D effects —————

  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.gl.setPixelRatio(Math.min(dpr, 2));
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    (this.pts.material as ShaderMaterial).uniforms.scale.value = (h * Math.min(dpr, 2)) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.hud.resize(w, h, dpr);
  }

  shake(mag: number) {
    if (this.calm) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = 0.35;
  }

  netBulge(side: number) {
    this.arena.netBulge(side);
  }

  burst(kind: Particle["kind"], x: number, y: number, n: number, color: string | string[], speed = 8, size = 0.18) {
    if (this.calm) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.9);
      this.particles.push({
        x, y, z: kind === "confetti" ? 1 : 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: kind === "confetti" ? 6 + Math.random() * 10 : kind === "fire" ? 1 : 2 + Math.random() * 4,
        life: 0, max: kind === "confetti" ? 2.2 + Math.random() : kind === "spark" ? 0.4 : 0.6 + Math.random() * 0.3,
        size: size * (0.6 + Math.random() * 0.8), color: Array.isArray(color) ? color[i % color.length] : color, kind, rot: 0, spin: 0,
      });
    }
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
  }

  ring(x: number, y: number, color: string, size = 3) {
    const m = new Mesh(new RingGeometry(0.8, 1, 40), new MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(W(x, y, 0.05));
    this.scene.add(m);
    this.rings.push({ mesh: m, t: 0, max: 0.5, size });
  }

  hats() {
    const geo = this.hatGeo();
    const mat = this.hatMat();
    for (let i = 0; i < (this.calm ? 8 : 26); i++) {
      const mesh = new Mesh(geo, mat);
      mesh.castShadow = true;
      const x = (Math.random() - 0.5) * RINK.hw * 1.7;
      const y = this.camY + (Math.random() - 0.3) * 18;
      this.scene.add(mesh);
      this.hatList.push({ mesh, x, y, z: 14 + Math.random() * 8, vz: 0, spin: (Math.random() - 0.5) * 8, t: 0 });
    }
  }

  private hatG: BufferGeometry | null = null;
  private hatM: Material | null = null;
  private hatGeo() {
    if (!this.hatG) this.hatG = new CylinderGeometry(0.35, 0.4, 0.7, 12).translate(0, 0.35, 0);
    return this.hatG;
  }
  private hatMat() {
    if (!this.hatM) this.hatM = new MeshStandardMaterial({ color: "#16181d", roughness: 0.7 });
    return this.hatM;
  }

  /** Animation cues from the sim. */
  event(e: GameEvent) {
    const p = (i: number) => this.players[i];
    switch (e.kind) {
      case "shot":
        if (p(e.by)) p(e.by).swing = 0.35;
        break;
      case "save":
        if (p(e.by)) p(e.by).butterfly = 0.75;
        break;
      case "hit":
        if (p(e.by)) p(e.by).lunge = 0.3;
        break;
      case "goal":
        if (e.scorer >= 0 && p(e.scorer)) p(e.scorer).cheer = 3;
        this.arena.cheer(e.team === 0 ? 4 : 1.5);
        this.arena.goalLamp(e.team === 0 ? 1 : -1);
        break;
      case "end":
        if (e.winner === 0) this.arena.cheer(5);
        break;
      default:
        break;
    }
  }

  // ————— frame —————

  private build(state: MatchState) {
    const home = kitFor(HOME, true);
    const away = kitFor(state.setup.away.color ?? "#ff3d6e", false);
    for (const s of state.skaters) {
      const m = new PlayerModel(this.parts, { ...(s.team === 0 ? home : away), number: s.info.number, goalie: s.goalie });
      this.scene.add(m.root);
      this.players.push(m);
    }
    const puckGeo = new CylinderGeometry(0.3, 0.3, 0.14, 20);
    const puckMat = new MeshStandardMaterial({ color: "#0b0d12", roughness: 0.4 });
    const glowGeo = new RingGeometry(0.42, 0.62, 24);
    const glowMat = new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending });
    const trailMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: NormalBlending });
    this.own.push(puckGeo, puckMat, glowGeo, glowMat, trailMat);
    for (let i = 0; i < state.pucks.length; i++) {
      const mesh = new Mesh(puckGeo, puckMat);
      mesh.castShadow = true;
      const glow = new Mesh(glowGeo, glowMat);
      glow.rotation.x = -Math.PI / 2;
      const tg = new BufferGeometry();
      tg.setAttribute("position", new BufferAttribute(new Float32Array(16 * 2 * 3), 3).setUsage(DynamicDrawUsage));
      tg.setAttribute("color", new BufferAttribute(new Float32Array(16 * 2 * 4), 4).setUsage(DynamicDrawUsage));
      const idx: number[] = [];
      for (let k = 0; k < 15; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
      tg.setIndex(idx);
      this.own.push(tg);
      const trail = new Mesh(tg, trailMat);
      trail.frustumCulled = false;
      trail.renderOrder = 3;
      this.scene.add(mesh, glow, trail);
      this.pucks.push({ mesh, glow, trail });
    }
    this.setupDone = true;
  }

  frame(state: MatchState, dt: number, focus: { x: number; y: number; vx: number; vy: number }) {
    if (!this.setupDone) this.build(state);
    this.frameN++;
    this.updateCamera(state, dt, focus);
    this.carve(state, dt);
    this.drawPlayers(state, dt);
    this.drawPucks(state);
    this.stepParticles(dt);
    this.drawParticles();
    this.excitement += (Math.max(0, 1 - (RINK.goalY - Math.abs(focus.y)) / 14) - this.excitement) * Math.min(1, dt * 2);
    this.arena.update(dt, state.t, this.excitement, this.calm);
    if (this.marksDirty && this.frameN % 4 === 0) {
      this.arena.marksTex.needsUpdate = true;
      this.marksDirty = false;
    }
    this.gl.render(this.scene, this.camera);
    this.hud.frame(state, dt, focus);
  }

  private project(x: number, y: number, z: number) {
    const v = W(x, y, z).project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h };
  }

  private updateCamera(state: MatchState, dt: number, f: { x: number; y: number; vx: number; vy: number }) {
    let tz = 1;
    let ty = f.y + f.vy * 0.25 + 3;
    let tx = f.x * 0.45;
    if (state.phase === "goal" && state.lastGoal && state.phaseT < 2.4 && !this.calm) {
      tz = 0.62;
      ty = state.lastGoal.y * 0.9;
      tx = state.lastGoal.x * 0.5;
    }
    const k = 1 - Math.exp(-dt * (state.phase === "goal" ? 3 : 4));
    this.zoom += (tz - this.zoom) * k;
    const limY = RINK.hl - 11;
    this.camY += (Math.max(-limY, Math.min(limY, ty)) - this.camY) * k;
    this.camX += (Math.max(-RINK.hw * 0.45, Math.min(RINK.hw * 0.45, tx)) - this.camX) * k;

    // Distance: show about 27 units of ice across on a phone, closer on wide screens.
    const aspect = this.w / this.h;
    const vf = this.camera.fov * (Math.PI / 180);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const dist = Math.max(22, Math.min(50, 12 / Math.tan(hf / 2))) * this.zoom;
    const target = W(this.camX, this.camY, 0);
    const cam = this.camera;
    cam.position.set(target.x, dist * Math.sin(ELEV), target.z + dist * Math.cos(ELEV));
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * (this.shakeT / 0.35) * 0.04;
      cam.position.x += (Math.random() - 0.5) * m;
      cam.position.y += (Math.random() - 0.5) * m;
      if (this.shakeT <= 0) this.shakeMag = 0;
    }
    cam.lookAt(target.x, 0, target.z - 2);
    cam.updateMatrixWorld();
  }

  private drawPlayers(state: MatchState, dt: number) {
    const ctrl = state.setup.humanless ? -1 : state.controlled;
    const scorer = state.phase === "goal" || state.phase === "end" ? (state.lastGoal?.scorer ?? -1) : -1;
    for (const s of state.skaters) {
      const m = this.players[s.i];
      if (!m) continue;
      m.root.position.copy(W(s.x, s.y));
      m.root.rotation.y = Math.atan2(Math.cos(s.face), -Math.sin(s.face));
      const carrying = state.pucks.some((p) => p.owner === s.i);
      const fire = state.onFire.includes(s.i);
      m.setFire(fire, state.t);
      m.update(state, s, dt, carrying, s.i === scorer);
      if (fire && Math.random() < 0.6) this.flame(s);
    }
    // Markers under the human's player.
    const s = ctrl >= 0 ? state.skaters[ctrl] : null;
    const { ring, stamina, charge, arrow } = this.marker;
    ring.visible = stamina.visible = arrow.visible = !!s;
    charge.visible = !!s && s.charge >= 0;
    if (!s) return;
    const at = W(s.x, s.y, 0.03);
    const pulse = 0.5 + 0.5 * Math.sin(state.t * 8);
    ring.position.copy(at);
    (ring.material as MeshBasicMaterial).color.set(s.info.you ? "#ffcf5a" : "#ffffff");
    (ring.material as MeshBasicMaterial).opacity = 0.75 + pulse * 0.25;
    stamina.position.copy(at);
    const st = Math.round(s.stamina * 40) / 40;
    if (st !== this.lastStamina) {
      this.lastStamina = st;
      stamina.geometry.dispose();
      stamina.geometry = new RingGeometry(1.6, 1.75, 40, 1, Math.PI * 0.75, Math.PI * 1.5 * Math.max(0.01, st));
      (stamina.material as MeshBasicMaterial).color.set(st > 0.3 ? "#5cffa8" : "#ff5a6e");
    }
    if (s.charge >= 0) {
      charge.position.copy(at);
      const c = Math.round(s.charge * 30) / 30;
      if (c !== this.lastCharge) {
        this.lastCharge = c;
        charge.geometry.dispose();
        charge.geometry = new RingGeometry(1.9, 2.15, 40, 1, Math.PI / 2, -Math.PI * 2 * Math.max(0.01, c));
        (charge.material as MeshBasicMaterial).color.set(c >= 1 ? "#ff5a3d" : "#ffd23d");
      }
    }
    arrow.visible = state.phase === "play";
    arrow.position.copy(W(s.x, s.y, 4.4 + Math.abs(Math.sin(state.t * 5)) * 0.3));
    (arrow.material as MeshBasicMaterial).color.set(s.info.you ? "#ffcf5a" : "#ffffff");
  }

  private flame(s: Skater) {
    this.particles.push({
      x: s.x + (Math.random() - 0.5) * 0.8, y: s.y + (Math.random() - 0.5) * 0.8, z: 1 + Math.random() * 2, vx: -s.vx * 0.3, vy: -s.vy * 0.3, vz: 2 + Math.random() * 2,
      life: 0, max: 0.45, size: 0.5 + Math.random() * 0.4, color: Math.random() < 0.5 ? "#ff7a1a" : "#ffd23d", kind: "fire", rot: 0, spin: 0,
    });
  }

  private drawPucks(state: MatchState) {
    const c = new Color();
    state.pucks.forEach((p, i) => {
      const view = this.pucks[i];
      if (!view) return;
      view.mesh.position.copy(W(p.x, p.y, 0.07 + p.z));
      view.glow.position.copy(W(p.x, p.y, 0.025));
      view.glow.visible = p.owner < 0;
      view.glow.scale.setScalar(1 + p.z * 0.4);
      // Trail ribbon.
      const sp = Math.hypot(p.vx, p.vy);
      const shooter = p.shotBy >= 0 ? state.skaters[p.shotBy] : null;
      const hot = !!shooter && state.onFire.includes(shooter.i);
      const pos = view.trail.geometry.getAttribute("position") as BufferAttribute;
      const col = view.trail.geometry.getAttribute("color") as BufferAttribute;
      const tr = p.trail;
      const show = p.owner < 0 && sp > 8 && tr.length > 2;
      view.trail.visible = show;
      if (!show) return;
      c.set(hot ? "#ff8a2a" : p.oneTimer ? "#5cc8ff" : "#ffffff");
      const n = Math.min(16, tr.length);
      for (let k = 0; k < 16; k++) {
        const a = tr[Math.max(0, tr.length - n + Math.min(k, n - 1))];
        const b = tr[Math.max(0, tr.length - n + Math.min(k + 1, n - 1))];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l;
        dy /= l;
        const t = Math.min(k, n - 1) / (n - 1);
        const wdt = (hot ? 0.35 : 0.2) * t;
        const v0 = W(a.x - dy * wdt, a.y + dx * wdt, 0.08 + a.z);
        const v1 = W(a.x + dy * wdt, a.y - dx * wdt, 0.08 + a.z);
        pos.setXYZ(k * 2, v0.x, v0.y, v0.z);
        pos.setXYZ(k * 2 + 1, v1.x, v1.y, v1.z);
        const al = t * (hot || p.oneTimer ? 0.9 : 0.55);
        col.setXYZW(k * 2, c.r, c.g, c.b, al);
        col.setXYZW(k * 2 + 1, c.r, c.g, c.b, al);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      if (hot && Math.random() < 0.8) this.burst("fire", p.x, p.y, 1, "#ff7a1a", 1, 0.3);
    });
  }

  /** Skates leave marks in the ice; hard stops throw snow. */
  private carve(state: MatchState, dt: number) {
    const m = this.arena.marks.getContext("2d")!;
    const kx = this.arena.marks.width / (2 * RINK.hw);
    const ky = this.arena.marks.height / (2 * RINK.hl);
    const X = (x: number) => (x + RINK.hw) * kx;
    const Y = (y: number) => (RINK.hl - y) * ky;
    for (const s of state.skaters) {
      const p = this.prevV.get(s.i);
      this.prevV.set(s.i, { vx: s.vx, vy: s.vy, x: s.x, y: s.y });
      if (!p || dt <= 0) continue;
      const sp = Math.hypot(s.vx, s.vy);
      const jump = Math.hypot(s.x - p.x, s.y - p.y);
      if (sp < 1.5 || jump > 2) continue;
      const nx = -s.vy / sp;
      const ny = s.vx / sp;
      m.strokeStyle = "rgba(120,150,185,0.13)";
      m.lineWidth = 1;
      for (const side of [-0.28, 0.28]) {
        m.beginPath();
        m.moveTo(X(p.x + nx * side), Y(p.y + ny * side));
        m.lineTo(X(s.x + nx * side), Y(s.y + ny * side));
        m.stroke();
      }
      this.marksDirty = true;
      const decel = ((p.vx - s.vx) * s.vx + (p.vy - s.vy) * s.vy) / (sp * dt);
      if (decel > 26 && sp > 4) {
        m.strokeStyle = "rgba(255,255,255,0.35)";
        m.lineWidth = 4;
        m.beginPath();
        m.moveTo(X(s.x - nx * 0.6), Y(s.y - ny * 0.6));
        m.lineTo(X(s.x + nx * 0.6), Y(s.y + ny * 0.6));
        m.stroke();
        if (Math.random() < 0.6) {
          for (let i = 0; i < (this.calm ? 1 : 5); i++) {
            const a = Math.atan2(s.vy, s.vx) + (Math.random() - 0.5) * 1.6;
            const v = sp * (0.4 + Math.random() * 0.6);
            this.particles.push({ x: s.x + (s.vx / sp) * 0.8, y: s.y + (s.vy / sp) * 0.8, z: 0.1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 2 + Math.random() * 4, life: 0, max: 0.5, size: 0.18 + Math.random() * 0.15, color: "#ffffff", kind: "snow", rot: 0, spin: 0 });
          }
        }
      }
    }
  }

  private stepParticles(dt: number) {
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "confetti") {
        p.vz = Math.max(-3, p.vz - 14 * dt);
        p.z = Math.max(0.02, p.z + p.vz * dt);
        const f = Math.exp(-1.5 * dt);
        p.vx *= f;
        p.vy *= f;
      } else if (p.kind === "fire") {
        p.z += p.vz * dt;
        p.vx *= Math.exp(-3 * dt);
        p.vy *= Math.exp(-3 * dt);
      } else {
        p.vz -= 20 * dt;
        p.z = Math.max(0.02, p.z + p.vz * dt);
        const f = Math.exp(-4 * dt);
        p.vx *= f;
        p.vy *= f;
      }
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const r of this.rings) {
      r.t += dt;
      const t = r.t / r.max;
      r.mesh.scale.setScalar(r.size * (0.3 + t));
      (r.mesh.material as MeshBasicMaterial).opacity = 1 - t;
    }
    for (const r of this.rings.filter((q) => q.t >= q.max)) {
      this.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      (r.mesh.material as Material).dispose();
    }
    this.rings = this.rings.filter((q) => q.t < q.max);
    for (const h of this.hatList) {
      h.t += dt;
      if (h.z > 0) {
        h.vz -= 16 * dt;
        h.z = Math.max(0, h.z + h.vz * dt);
      }
      h.mesh.position.copy(W(h.x, h.y, h.z));
      h.mesh.rotation.y += h.spin * dt * (h.z > 0 ? 1 : 0.1);
      if (h.z <= 0) h.mesh.rotation.z = 1.4;
    }
    for (const h of this.hatList.filter((q) => q.t > 4)) this.scene.remove(h.mesh);
    this.hatList = this.hatList.filter((q) => q.t <= 4);
  }

  private drawParticles() {
    const g = this.pts.geometry;
    const pos = g.getAttribute("position") as BufferAttribute;
    const col = g.getAttribute("color") as BufferAttribute;
    const size = g.getAttribute("size") as BufferAttribute;
    const c = new Color();
    const n = Math.min(MAX_PARTICLES, this.particles.length);
    for (let i = 0; i < n; i++) {
      const p = this.particles[i];
      const t = p.life / p.max;
      pos.setXYZ(i, p.x, p.z, -p.y);
      c.set(p.color);
      const a = p.kind === "confetti" ? Math.min(1, (1 - t) * 3) : 1 - t;
      col.setXYZW(i, c.r, c.g, c.b, a);
      size.setX(i, p.kind === "confetti" ? p.size * 2.2 : p.kind === "fire" ? p.size * 2 * (1 - t * 0.5) : p.size * 2.4);
    }
    g.setDrawRange(0, n);
    pos.needsUpdate = col.needsUpdate = size.needsUpdate = true;
  }

  destroy() {
    for (const p of this.players) p.dispose();
    this.parts.dispose();
    this.arena.dispose();
    for (const o of this.own) o.dispose();
    for (const r of this.rings) {
      r.mesh.geometry.dispose();
      (r.mesh.material as Material).dispose();
    }
    this.hatG?.dispose();
    this.hatM?.dispose();
    this.marker.stamina.geometry.dispose();
    this.marker.charge.geometry.dispose();
    this.gl.dispose();
    this.gl.forceContextLoss();
  }
}
