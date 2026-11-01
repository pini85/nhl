import {
    BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  RepeatWrapping,
  type Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  Vector2,
} from "three";
import { RINK } from "@/components/arcade/engine/rink";

// The arena: ice with painted lines, boards, glass, two nets, tiers of fans and the lights.
// Sim (x, y) maps to three (x, 0, -y): the home team attacks into the screen (-Z).

const ICE_W = 960;
const ICE_H = 2048;
const HOME = "#5cc8ff";

/** Rounded rink outline grown by `d` units, in sim coordinates. */
function outline(d: number, into: Shape | Path = new Shape()) {
  const hw = RINK.hw + d;
  const hl = RINK.hl + d;
  const r = RINK.corner + d;
  into.moveTo(-hw + r, -hl);
  into.lineTo(hw - r, -hl);
  into.absarc(hw - r, -hl + r, r, -Math.PI / 2, 0, false);
  into.lineTo(hw, hl - r);
  into.absarc(hw - r, hl - r, r, 0, Math.PI / 2, false);
  into.lineTo(-hw + r, hl);
  into.absarc(-hw + r, hl - r, r, Math.PI / 2, Math.PI, false);
  into.lineTo(-hw, -hl + r);
  into.absarc(-hw + r, -hl + r, r, Math.PI, Math.PI * 1.5, false);
  return into;
}

/** A flat ring between two outlines, raised from y0 to y1. */
function band(inner: number, outer: number, y0: number, y1: number) {
  const s = outline(outer) as Shape;
  s.holes.push(outline(inner, new Path()) as Path);
  const g = new ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

/** Flat rink-shaped plane on the ice with UVs spanning the rink box. */
function rinkPlane(y: number) {
  const g = new ShapeGeometry(outline(0) as Shape, 24);
  const uv = g.getAttribute("uv");
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + RINK.hw) / (2 * RINK.hw), (pos.getY(i) + RINK.hl) / (2 * RINK.hl));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

function paintIce(logo: HTMLImageElement | null) {
  const c = document.createElement("canvas");
  c.width = ICE_W;
  c.height = ICE_H;
  const g = c.getContext("2d")!;
  const sx = ICE_W / (2 * RINK.hw);
  const sy = ICE_H / (2 * RINK.hl);
  // Sim (x, y) → canvas pixels; canvas top is +y (the far end).
  const X = (x: number) => (x + RINK.hw) * sx;
  const Y = (y: number) => (RINK.hl - y) * sy;
  const grad = g.createLinearGradient(0, 0, ICE_W, 0);
  grad.addColorStop(0, "#d6e4f2");
  grad.addColorStop(0.5, "#f1f7fd");
  grad.addColorStop(1, "#d6e4f2");
  g.fillStyle = grad;
  g.fillRect(0, 0, ICE_W, ICE_H);
  // Light pools from the rig above.
  for (const y of [-RINK.circleY, 0, RINK.circleY]) {
    const r = g.createRadialGradient(X(0), Y(y), 10, X(0), Y(y), 14 * sx);
    r.addColorStop(0, "rgba(255,255,255,0.55)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, ICE_W, ICE_H);
  }
  // Faint scratches.
  g.strokeStyle = "rgba(150,175,200,0.10)";
  g.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * ICE_W;
    const y = Math.random() * ICE_H;
    const a = Math.random() * Math.PI;
    const l = 10 + Math.random() * 60;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  const hline = (y: number, color: string, w: number) => {
    g.fillStyle = color;
    g.fillRect(0, Y(y) - (w * sy) / 2, ICE_W, w * sy);
  };
  const circle = (x: number, y: number, r: number, color: string, w: number, fill?: string) => {
    g.beginPath();
    g.ellipse(X(x), Y(y), r * sx, r * sy, 0, 0, Math.PI * 2);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    g.strokeStyle = color;
    g.lineWidth = w * sx;
    g.stroke();
  };
  const red = "#d6283f";
  const blue = "#1e5bd8";
  hline(0, red, 0.6);
  g.setLineDash([12, 10]);
  g.strokeStyle = "#f1f7fd";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, Y(0));
  g.lineTo(ICE_W, Y(0));
  g.stroke();
  g.setLineDash([]);
  for (const s of [1, -1]) {
    hline(s * RINK.blueY, blue, 0.6);
    hline(s * RINK.goalY, red, 0.18);
    // Crease.
    g.beginPath();
    g.ellipse(X(0), Y(s * RINK.goalY), RINK.creaseR * sx, RINK.creaseR * sy, 0, s > 0 ? 0 : Math.PI, s > 0 ? Math.PI : Math.PI * 2);
    g.closePath();
    g.fillStyle = "rgba(80,160,255,0.55)";
    g.fill();
    g.strokeStyle = red;
    g.lineWidth = 0.14 * sx;
    g.stroke();
    for (const cx of [-RINK.circleX, RINK.circleX]) {
      circle(cx, s * RINK.circleY, RINK.circleR, red, 0.16);
      circle(cx, s * RINK.circleY, 0.45, red, 0.1, red);
      circle(cx, s * (RINK.blueY + 2.2), 0.35, red, 0.1, red);
    }
  }
  circle(0, 0, RINK.circleR, blue, 0.16);
  if (logo) {
    const r = RINK.circleR - 0.4;
    g.save();
    g.beginPath();
    g.ellipse(X(0), Y(0), r * sx, r * sy, 0, 0, Math.PI * 2);
    g.clip();
    g.globalAlpha = 0.85;
    g.drawImage(logo, X(-r), Y(r), 2 * r * sx, 2 * r * sy);
    g.restore();
  } else circle(0, 0, 0.45, blue, 0.1, blue);
  return c;
}

function netTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(64, 64);
  g.moveTo(64, 0);
  g.lineTo(0, 64);
  g.stroke();
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(5, 3);
  return t;
}

/** Quad list → geometry with simple UVs. */
function quads(list: [number, number, number][][]) {
  const pos: number[] = [];
  const uv: number[] = [];
  for (const [a, b, c, d] of list) {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

export class Arena {
  readonly group = new Group();
  readonly marks: HTMLCanvasElement;
  readonly marksTex: CanvasTexture;
  private iceTex: CanvasTexture;
  private iceMat: MeshStandardMaterial;
  private nets: { group: Group; back: Mesh; light: Mesh; side: 1 | -1 }[] = [];
  private crowd: { mesh: InstancedMesh; base: Matrix4[]; phase: Float32Array }[] = [];
  private cheerT = 0;
  private bulge = { side: 0, t: 0 };
  private disposables: (BufferGeometry | Material | Texture)[] = [];

  constructor(scene: Scene, awayColor: string) {
    const keep = <T extends BufferGeometry | Material | Texture>(x: T) => {
      this.disposables.push(x);
      return x;
    };
    scene.add(this.group);

    // Ice.
    this.iceTex = keep(new CanvasTexture(paintIce(null)));
    this.iceTex.colorSpace = SRGBColorSpace;
    this.iceTex.anisotropy = 8;
    this.iceMat = keep(new MeshStandardMaterial({ map: this.iceTex, roughness: 0.18, metalness: 0.05 }));
    const ice = new Mesh(keep(rinkPlane(0)), this.iceMat);
    ice.receiveShadow = true;
    this.group.add(ice);
    const img = new Image();
    img.onload = () => {
      this.iceTex.image = paintIce(img);
      this.iceTex.needsUpdate = true;
    };
    img.src = "/brand/logo-256.webp";

    // Skate marks: a transparent layer just above the ice.
    this.marks = document.createElement("canvas");
    this.marks.width = 480;
    this.marks.height = 1024;
    this.marksTex = keep(new CanvasTexture(this.marks));
    const marks = new Mesh(keep(rinkPlane(0.01)), keep(new MeshBasicMaterial({ map: this.marksTex, transparent: true, depthWrite: false })));
    marks.receiveShadow = false;
    this.group.add(marks);

    // Boards: yellow kick plate, white boards, blue cap, glass, dark stands.
    const std = (color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) => keep(new MeshStandardMaterial({ color, roughness: 0.55, ...extra }));
    const add = (g: BufferGeometry, m: Material, shadow = false) => {
      const mesh = new Mesh(keep(g), m);
      mesh.receiveShadow = shadow;
      this.group.add(mesh);
      return mesh;
    };
    add(band(0, 0.08, 0, 0.35), std("#f2c230"), true);
    add(band(0.08, 0.5, 0, 2.1), std("#f4f7fb"), true);
    add(band(0, 0.6, 2.1, 2.3), std("#1e5bd8"));
    add(band(0.22, 0.28, 2.3, 5.2), keep(new MeshStandardMaterial({ color: "#bfe3ff", roughness: 0.05, transparent: true, opacity: 0.1, depthWrite: false, side: DoubleSide })));
    // Ad strip on the boards (coloured bands).
    add(band(0.06, 0.07, 0.8, 1.6), std(HOME, { emissive: new Color(HOME), emissiveIntensity: 0.25 }));

    // Stands and fans.
    const tiers = 9;
    const stand = std("#0f1626", { roughness: 0.9 });
    const fanGeo = keep(new CapsuleGeometry(0.32, 0.55, 3, 6));
    const palette = [HOME, HOME, "#ffffff", "#0d1b33", "#ffcf5a", awayColor, "#2a3550", "#e8f1ff"].map((c) => new Color(c));
    const m4 = new Matrix4();
    for (let i = 0; i < tiers; i++) {
      const d0 = 1.2 + i * 1.5;
      const top = 2.6 + i * 1.05;
      add(band(d0, d0 + 1.5, 0, top), stand);
      const path = outline(d0 + 0.75) as Shape;
      const pts = path.getSpacedPoints(Math.round((2 * (RINK.hw + RINK.hl) * 2 + i * 12) / 1.05));
      const mesh = new InstancedMesh(fanGeo, keep(new MeshStandardMaterial({ roughness: 0.8 })), pts.length);
      const base: Matrix4[] = [];
      const phase = new Float32Array(pts.length);
      pts.forEach((p: Vector2, j: number) => {
        const empty = Math.random() < 0.08;
        m4.makeTranslation(p.x + (Math.random() - 0.5) * 0.3, top + 0.6, -p.y + (Math.random() - 0.5) * 0.3);
        if (empty) m4.multiply(new Matrix4().makeScale(0.001, 0.001, 0.001));
        base.push(m4.clone());
        mesh.setMatrixAt(j, m4);
        mesh.setColorAt(j, palette[Math.floor(Math.random() * palette.length)]);
        phase[j] = Math.random() * Math.PI * 2;
      });
      this.group.add(mesh);
      this.crowd.push({ mesh, base, phase });
    }

    // Nets.
    const red = std("#d6283f", { roughness: 0.35, metalness: 0.3 });
    const netMat = keep(new MeshStandardMaterial({ map: keep(netTexture()), transparent: true, side: DoubleSide, depthWrite: false, roughness: 1 }));
    const post = keep(new CylinderGeometry(0.11, 0.11, 2.4, 10));
    const bar = keep(new CylinderGeometry(0.11, 0.11, RINK.mouth * 2 + 0.22, 10));
    const lampGeo = keep(new SphereGeometry(0.35, 12, 8));
    for (const side of [1, -1] as const) {
      const group = new Group();
      group.position.set(0, 0, -side * RINK.goalY);
      if (side < 0) group.rotation.y = Math.PI; // depth always runs away from centre ice (local -Z)
      const m = RINK.mouth;
      const D = RINK.depth;
      const back = m * 0.8;
      const H = 2.4;
      for (const x of [-m, m]) {
        const p = new Mesh(post, red);
        p.position.set(x, H / 2, 0);
        p.castShadow = true;
        group.add(p);
      }
      const cb = new Mesh(bar, red);
      cb.rotation.z = Math.PI / 2;
      cb.position.set(0, H, 0);
      cb.castShadow = true;
      group.add(cb);
      const net = new Mesh(
        keep(
          quads([
            [[-m, H, 0], [m, H, 0], [back, H * 0.55, -D], [-back, H * 0.55, -D]], // top
            [[-m, 0, 0], [-back, 0, -D], [-back, H * 0.55, -D], [-m, H, 0]], // left side
            [[back, 0, -D], [m, 0, 0], [m, H, 0], [back, H * 0.55, -D]], // right side
          ]),
        ),
        netMat,
      );
      group.add(net);
      const backNet = new Mesh(keep(quads([[[-back, 0, -D], [back, 0, -D], [back, H * 0.55, -D], [-back, H * 0.55, -D]]])), netMat);
      group.add(backNet);
      // Goal lamp above the glass behind the net.
      const lamp = new Mesh(lampGeo, keep(new MeshStandardMaterial({ color: "#550000", emissive: new Color("#ff2030"), emissiveIntensity: 0 })));
      lamp.position.set(0, 5.6, -(RINK.hl - RINK.goalY) - 0.3);
      group.add(lamp);
      this.group.add(group);
      this.nets.push({ group, back: backNet, light: lamp, side });
    }

    // Lights.
    scene.add(new HemisphereLight("#cfe3ff", "#1a2033", 1.6));
    const sun = new DirectionalLight("#ffffff", 2.2);
    sun.position.set(8, 40, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -RINK.hw - 2;
    sc.right = RINK.hw + 2;
    sc.top = RINK.hl + 2;
    sc.bottom = -RINK.hl - 2;
    sc.near = 10;
    sc.far = 80;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    this.group.userData.lights = [sun];
  }

  cheer(t = 3.5) {
    this.cheerT = t;
  }

  netBulge(side: number) {
    this.bulge = { side, t: 0 };
  }

  goalLamp(side: 1 | -1) {
    const n = this.nets.find((q) => q.side === side);
    if (n) n.light.userData.t = 3;
  }

  update(dt: number, t: number, excitement: number, calm: boolean) {
    // Net bulge.
    this.bulge.t += dt;
    for (const n of this.nets) {
      const on = n.side === this.bulge.side && this.bulge.t < 0.8;
      const k = on ? Math.sin(Math.min(1, this.bulge.t / 0.8) * Math.PI) * 0.7 * (1 - this.bulge.t / 0.8) : 0;
      n.back.position.z = -k;
      const lt = (n.light.userData.t as number | undefined) ?? 0;
      n.light.userData.t = Math.max(0, lt - dt);
      n.light.visible = lt > 0;
      (n.light.material as MeshStandardMaterial).emissiveIntensity = 1.5 + Math.sin(t * 18) * 1.2;
    }
    // Crowd: a light sway, and jumping after goals.
    this.cheerT = Math.max(0, this.cheerT - dt);
    if (calm && this.cheerT <= 0) return;
    const jump = this.cheerT > 0 ? 1 : 0;
    const sway = 0.04 + excitement * 0.12;
    const m = new Matrix4();
    for (const c of this.crowd) {
      for (let j = 0; j < c.base.length; j++) {
        const ph = c.phase[j];
        const h = jump ? Math.abs(Math.sin(t * 9 + ph)) * 0.8 : Math.max(0, Math.sin(t * 2 + ph)) * sway;
        m.copy(c.base[j]);
        m.elements[13] += h;
        c.mesh.setMatrixAt(j, m);
      }
      c.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    for (const c of this.crowd) c.mesh.dispose();
  }
}
