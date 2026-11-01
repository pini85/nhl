import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { MatchState, Skater } from "@/components/arcade/engine/types";

// A hockey player built from simple shapes: helmet, jersey with the number on the back, breezers,
// socks, skates and a stick. Everything is posed by hand each frame from the sim state, so the
// skating stride, crouch, turn lean, slapshot wind-up, falls and the goalie's butterfly all come
// from what the player is doing. The model faces +Z; its left is +X. World units are half metres.

const THIGH = 0.78;
const SHIN = 0.72;
const SKATE = 0.32;
const UP = new Vector3(0, 1, 0);
const FWD = new Vector3(0, 0, 1);

export type Kit = { jersey: string; trim: string; pants: string; helmet: string; number: number; goalie: boolean };

/** Shared shapes; every player reuses them. */
export class Parts {
  readonly limb = new CylinderGeometry(1, 0.85, 1, 10, 1).translate(0, 0.5, 0); // unit length up +Y, base at origin
  readonly sphere = new SphereGeometry(1, 18, 12);
  readonly box = new BoxGeometry(1, 1, 1);
  readonly torso = new CylinderGeometry(0.6, 0.5, 1.1, 20, 1, false);
  readonly capsule = new CapsuleGeometry(1, 1, 4, 10);
  readonly skin = new MeshStandardMaterial({ color: "#e0b391", roughness: 0.8 });
  readonly steel = new MeshStandardMaterial({ color: "#d9e3ee", roughness: 0.2, metalness: 0.9 });
  readonly black = new MeshStandardMaterial({ color: "#111318", roughness: 0.55 });
  readonly tape = new MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.9 });
  readonly shaft = new MeshStandardMaterial({ color: "#2a2f3a", roughness: 0.5 });
  readonly visor = new MeshStandardMaterial({ color: "#9fd8ff", roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.45 });
  readonly white = new MeshStandardMaterial({ color: "#f4f7fb", roughness: 0.6 });
  readonly cage = new MeshStandardMaterial({ color: "#c9ced6", roughness: 0.3, metalness: 0.7, wireframe: true });

  dispose() {
    for (const g of [this.limb, this.sphere, this.box, this.torso, this.capsule]) g.dispose();
    for (const m of [this.skin, this.steel, this.black, this.tape, this.shaft, this.visor, this.white, this.cage]) m.dispose();
  }
}

function jerseyTexture(kit: Kit) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = kit.jersey;
  g.fillRect(0, 0, 512, 256);
  // Hem stripes.
  g.fillStyle = kit.trim;
  g.fillRect(0, 196, 512, 18);
  g.fillRect(0, 226, 512, 10);
  // Yoke across the shoulders.
  g.globalAlpha = 0.25;
  g.fillRect(0, 0, 512, 34);
  g.globalAlpha = 1;
  // Number: big on the back (u = 0.5), small on the chest (u = 0 / 1 wraps).
  const num = String(kit.number);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  const draw = (x: number, y: number, size: number) => {
    g.font = `900 ${size}px system-ui, sans-serif`;
    g.lineWidth = size * 0.14;
    g.strokeStyle = kit.trim;
    g.strokeText(num, x, y);
    g.fillStyle = "#ffffff";
    g.fillText(num, x, y);
  };
  draw(256, 112, 128);
  draw(0, 96, 58);
  draw(512, 96, 58);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

type Leg = { hip: Group; knee: Group; foot: Group; side: 1 | -1 };

export class PlayerModel {
  readonly root = new Group();
  private body = new Group(); // whole-body tilt for falls, pivots at the skates
  private pelvis = new Group();
  private torso = new Group();
  private head = new Group();
  private legs: Leg[] = [];
  private stick = new Group();
  private arms: { upper: Mesh; glove: Mesh; shoulder: Vector3; side: 1 | -1 }[] = [];
  private jerseyMat: MeshStandardMaterial;
  private mats: Material[] = [];
  private tex: CanvasTexture;
  // Animation state.
  private phase = Math.random() * 6;
  private heading = 0;
  private lean = 0;
  private crouch = 0.3;
  swing = 0; // follow-through after a shot, seconds left
  butterfly = 0; // goalie drop after a save, seconds left
  lunge = 0; // shoulder into a hit, seconds left
  cheer = 0; // celebrating a goal, seconds left
  private fall = 0;

  constructor(
    private parts: Parts,
    readonly kit: Kit,
  ) {
    const P = parts;
    this.tex = jerseyTexture(kit);
    this.jerseyMat = new MeshStandardMaterial({ map: this.tex, roughness: 0.7 });
    const sleeve = new MeshStandardMaterial({ color: kit.jersey, roughness: 0.7 });
    const pants = new MeshStandardMaterial({ color: kit.pants, roughness: 0.65 });
    const sock = new MeshStandardMaterial({ color: kit.jersey, roughness: 0.8 });
    const helmet = new MeshStandardMaterial({ color: kit.helmet, roughness: 0.3, metalness: 0.1 });
    const glove = new MeshStandardMaterial({ color: kit.trim, roughness: 0.6 });
    this.mats = [this.jerseyMat, sleeve, pants, sock, helmet, glove];
    const mesh = (geo: Mesh["geometry"], mat: Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) => {
      const m = new Mesh(geo, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    };
    const big = kit.goalie ? 1.18 : 1;

    this.root.add(this.body);
    this.body.add(this.pelvis);

    // Breezers.
    this.pelvis.add(mesh(P.sphere, pants, 0.52 * big, 0.42, 0.4, 0, 0.08, 0));

    // Legs.
    for (const side of [1, -1] as const) {
      const hip = new Group();
      hip.position.set(side * 0.27 * big, -0.02, 0);
      const thigh = mesh(P.limb, pants, 0.21 * big, -THIGH, 0.21 * big);
      hip.add(thigh);
      const knee = new Group();
      knee.position.y = -THIGH;
      hip.add(knee);
      knee.add(mesh(P.limb, sock, 0.15, -SHIN, 0.15));
      knee.add(mesh(P.sphere, sock, 0.16, 0.16, 0.16)); // knee cap
      if (kit.goalie) {
        // Leg pads: tall, wide and white, with a team-colour stripe.
        knee.add(mesh(P.box, P.white, 0.42, SHIN + 0.4, 0.3, 0, -SHIN / 2 + 0.1, 0.12));
        knee.add(mesh(P.box, sock, 0.1, SHIN + 0.42, 0.32, 0, -SHIN / 2 + 0.1, 0.12));
      }
      const foot = new Group();
      foot.position.y = -SHIN;
      knee.add(foot);
      foot.add(mesh(P.box, P.black, 0.24, 0.24, 0.52, 0, -0.12, 0.08)); // boot
      foot.add(mesh(P.box, P.steel, 0.035, 0.08, 0.62, 0, -SKATE + 0.04, 0.08)); // blade
      this.pelvis.add(hip);
      this.legs.push({ hip, knee, foot, side });
    }

    // Upper body.
    this.torso.position.y = 0.22;
    this.pelvis.add(this.torso);
    const chest = new Mesh(P.torso, this.jerseyMat);
    chest.position.y = 0.55;
    chest.scale.set(big, 1, big * 0.82);
    chest.castShadow = true;
    this.torso.add(chest);
    this.torso.add(mesh(P.sphere, sleeve, 0.78 * big, 0.32, 0.5 * big, 0, 1.06, 0)); // shoulder pads
    this.torso.add(mesh(P.limb, P.skin, 0.13, 0.2, 0.13, 0, 1.18, 0)); // neck
    this.head.position.set(0, 1.42, 0.02);
    this.torso.add(this.head);
    this.head.add(mesh(P.sphere, P.skin, 0.24, 0.27, 0.25, 0, 0, 0.05));
    if (kit.goalie) {
      this.head.add(mesh(P.sphere, P.white, 0.33, 0.36, 0.35, 0, 0.04, 0));
      this.head.add(mesh(P.sphere, P.cage, 0.27, 0.26, 0.2, 0, -0.04, 0.22));
      this.head.add(mesh(P.box, helmet, 0.05, 0.3, 0.5, 0, 0.18, 0)); // painted mask stripe
    } else {
      this.head.add(mesh(P.sphere, helmet, 0.31, 0.29, 0.34, 0, 0.1, -0.02)); // helmet shell
      this.head.add(mesh(P.box, P.visor, 0.5, 0.12, 0.05, 0, 0.0, 0.3)); // visor
    }

    // Arms: one stretched limb from shoulder to glove, aimed every frame.
    for (const side of [1, -1] as const) {
      const upper = mesh(P.limb, sleeve, 0.15 * big, 1, 0.15 * big);
      const g = kit.goalie && side === 1 ? mesh(P.sphere, glove, 0.3, 0.3, 0.22) : kit.goalie ? mesh(P.box, glove, 0.18, 0.42, 0.34) : mesh(P.box, glove, 0.2, 0.2, 0.26);
      this.body.add(upper, g);
      this.arms.push({ upper, glove: g, shoulder: new Vector3(), side });
    }

    // Stick: shaft along +Z from the top hand, blade at the far end.
    const len = kit.goalie ? 2.4 : 3.1;
    const shaft = mesh(P.box, P.shaft, 0.07, 0.07, len, 0, 0, len / 2);
    this.stick.add(shaft);
    if (kit.goalie) this.stick.add(mesh(P.box, P.shaft, 0.1, 0.1, 0.9, 0, 0, len - 0.45)); // paddle
    const blade = mesh(P.box, P.tape, 0.06, 0.16, 0.62, 0, 0, 0);
    blade.position.set(kit.goalie ? 0 : 0.26, 0, len + 0.02);
    blade.rotation.y = Math.PI / 2;
    this.stick.add(blade);
    this.stick.userData.len = len;
    this.body.add(this.stick);
  }

  setFire(on: boolean, t: number) {
    const e = this.jerseyMat.emissive;
    if (on) e.setRGB(0.5 + 0.3 * Math.sin(t * 20), 0.18, 0);
    else e.setRGB(0, 0, 0);
  }

  /** Pose for this frame. Root position and heading are set by the caller. */
  update(state: MatchState, s: Skater, dt: number, carrying: boolean, scorer: boolean) {
    const speed = Math.hypot(s.vx, s.vy);
    const dir = Math.atan2(s.vy, s.vx);
    let turn = 0;
    if (speed > 1 && dt > 0) {
      let d = dir - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      turn = d / dt;
      this.heading = dir;
    }
    const k = 1 - Math.exp(-dt * 8);
    this.lean += (Math.max(-0.45, Math.min(0.45, -turn * speed * 0.012)) - this.lean) * k;
    const a = Math.min(1, speed / 11); // stride amplitude
    this.crouch += ((s.goalie ? 0.75 : 0.25 + 0.6 * a + (s.burst ? 0.15 : 0)) - this.crouch) * k;
    this.phase += speed * dt * 0.95;
    for (const key of ["swing", "butterfly", "lunge", "cheer"] as const) this[key] = Math.max(0, this[key] - dt);
    this.fall += ((s.stun > 0 ? 1 : 0) - this.fall) * (1 - Math.exp(-dt * (s.stun > 0 ? 14 : 5)));

    const c = this.crouch;
    const fly = s.goalie ? Math.min(1, this.butterfly * 4) : 0; // goalie: 1 = butterfly
    let drop = 0;
    for (const L of this.legs) {
      let hx: number, hz: number, hy = 0, kx: number;
      if (s.goalie) {
        hx = -0.55 * c * (1 - fly);
        hz = L.side * (0.32 * (1 - fly) - 0.12 * fly);
        hy = L.side * 1.2 * fly;
        kx = 1.0 * c * (1 - fly) + 1.55 * fly;
      } else {
        const p = Math.sin(this.phase + (L.side > 0 ? 0 : Math.PI));
        const push = Math.max(0, p) * a;
        const back = Math.max(0, -p) * a;
        hx = -0.6 * c + push * 0.55 - back * 0.25;
        hz = L.side * (0.06 + push * 0.42);
        kx = 0.15 + 1.0 * c + back * 0.55 - push * 0.35;
      }
      L.hip.rotation.set(hx, hy, hz);
      L.knee.rotation.set(kx, 0, 0);
      L.foot.rotation.set(-(hx + kx) * (1 - fly), 0, -hz * 0.6);
      const h = (Math.cos(hx) * THIGH + Math.cos(hx + kx) * SHIN) * Math.cos(hz) + SKATE;
      drop = Math.max(drop, h);
    }
    this.pelvis.position.y = s.goalie && fly > 0 ? drop * (1 - fly) + (THIGH * 0.95 + 0.15) * fly : drop;

    // Torso: lean forward with speed, into turns, into hits.
    const lunge = Math.min(1, this.lunge * 5) + (s.dash > 0 ? 1 : 0);
    this.torso.rotation.set(0.15 + 0.45 * c + 0.4 * Math.min(1, lunge), lunge * 0.5, 0);
    this.body.rotation.set(-this.fall * 1.4, s.stun > 0.9 ? state.t * 7 : 0, -this.lean * (1 - this.fall));
    this.head.rotation.x = -0.3 * c - 0.2 * Math.min(1, lunge); // eyes up ice

    // Stick target in body space: blade B and top hand G.
    const st = s.charge >= 0 ? s.charge : -1;
    const B = new Vector3();
    const G = new Vector3();
    const hipY = this.pelvis.position.y;
    if (this.cheer > 0 && scorer) {
      G.set(0.1, hipY + 2.3, 0.2);
      B.set(0.5, hipY + 4.6, -0.6);
    } else if (s.goalie) {
      G.set(-0.45, hipY + 0.55, 0.45);
      B.set(-0.1, 0.06, 1.35);
    } else if (st >= 0) {
      const w = Math.min(1, st * 1.4);
      G.set(-0.2 + 0.3 * w, hipY + 0.35 + 0.6 * w, 0.4 - 0.3 * w);
      B.set(0.3 + 0.9 * w, 0.06 + 2.2 * w, 1.4 - 2.4 * w);
    } else if (this.swing > 0) {
      const w = Math.min(1, this.swing * 4);
      G.set(-0.3, hipY + 0.5 + 0.4 * w, 0.6);
      B.set(-0.4 - 0.4 * w, 0.06 + 1.8 * w, 1.6);
    } else if (s.poke > 0) {
      G.set(-0.1, hipY + 0.3, 1.0);
      B.set(0.2, 0.06, 2.3);
    } else {
      const sweep = carrying ? Math.sin(state.t * 9 + s.i) * 0.42 : 0;
      G.set(-0.2, hipY + 0.32, 0.38);
      B.set(0.28 + sweep, 0.06, 1.45);
    }
    // Rotate the targets with the body tilt so a fallen player's stick falls with them.
    if (this.fall > 0.01) {
      // Positions above are in root space; the stick lives in body space, so undo the tilt.
      const inv = this.body.quaternion.clone().invert();
      B.applyQuaternion(inv);
      G.applyQuaternion(inv);
    }
    const len = this.stick.userData.len as number;
    this.stick.position.copy(G);
    const d = B.clone().sub(G);
    this.stick.quaternion.setFromUnitVectors(FWD, d.normalize());

    // Arms: shoulders from the torso, hands on the stick.
    this.body.updateMatrixWorld(true);
    const hands = [G.clone(), G.clone().add(d.clone().multiplyScalar(len * 0.42))];
    if (s.goalie) {
      hands[0].set(0.75, hipY + 0.75, 0.75); // catcher out to the side
      hands[1] = G.clone().add(d.clone().multiplyScalar(0.2));
    }
    if (this.cheer > 0 && scorer) hands[0].set(-0.4, hipY + 2.6, 0.2);
    for (const [i, arm] of this.arms.entries()) {
      arm.shoulder.set(arm.side * 0.58, 1.02, 0);
      this.torso.localToWorld(arm.shoulder);
      this.body.worldToLocal(arm.shoulder);
      const hand = hands[i];
      const v = hand.clone().sub(arm.shoulder);
      const l = Math.max(0.2, v.length());
      arm.upper.position.copy(arm.shoulder);
      arm.upper.quaternion.setFromUnitVectors(UP, v.normalize());
      arm.upper.scale.y = l;
      arm.glove.position.copy(hand);
      arm.glove.quaternion.copy(arm.upper.quaternion);
    }
  }

  dispose() {
    this.tex.dispose();
    for (const m of this.mats) m.dispose();
  }
}

/** Jersey, trim and pants colours for a team. */
export function kitFor(color: string, home: boolean): Omit<Kit, "number" | "goalie"> {
  if (home) return { jersey: color, trim: "#0d1b33", pants: "#0d1b33", helmet: "#0d1b33" };
  const c = new Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const trim = hsl.l > 0.55 ? "#151821" : "#f4f7fb";
  const dark = new Color().setHSL(hsl.h, Math.min(1, hsl.s), Math.min(0.18, hsl.l * 0.4));
  return { jersey: color, trim, pants: `#${dark.getHexString()}`, helmet: `#${dark.getHexString()}` };
}
