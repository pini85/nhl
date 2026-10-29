// Pure layout math for the Galaxy tab (no three.js, so it is cheap to test).

/** Small seeded random generator, so every visit draws the same galaxy. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal-ish random number (sum of uniforms), mean 0, sd ~1. */
export function gauss(r: () => number) {
  return (r() + r() + r() + r() - 2) * 1.73;
}

export const SPIRAL = { rMin: 1.35, rMax: 9.2, k: 3.4, r0: 0.75 };

/** Angle of the main spiral arm at radius r (a logarithmic spiral). */
export const spiralAngle = (r: number) => SPIRAL.k * Math.log(r / SPIRAL.r0);

const NIGHT_GAP_MS = 3 * 3600_000;

/**
 * Star positions for games (oldest first): newest next to the core, oldest at the rim, along one spiral arm.
 * Game nights stay together with a gap between nights. Height = goal difference.
 * Returns xyz triples and a star size that keeps neighbours from piling up.
 */
export function gamePositions(games: { t: number; gf: number; ga: number }[], seed = 11): { xyz: Float32Array; size: number } {
  const n = games.length;
  const xyz = new Float32Array(n * 3);
  if (!n) return { xyz, size: 0.4 };
  const steps: number[] = [0];
  for (let i = 1; i < n; i++) steps.push(steps[i - 1] + 1 + (games[i].t - games[i - 1].t > NIGHT_GAP_MS ? 2.5 : 0));
  const last = steps[n - 1] || 1;
  const r = rng(seed);
  const { rMin, rMax, k } = SPIRAL;
  // Arc length of the arm is about (rMax - rMin) * sqrt(1 + k²); space stars evenly along it.
  const armLength = (rMax - rMin) * Math.sqrt(1 + k * k);
  const spacing = armLength / Math.max(1, last);
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 1 : steps[i] / last; // 0 oldest → 1 newest
    const radius = rMin + (rMax - rMin) * (1 - u) + gauss(r) * Math.min(0.12, spacing * 0.6);
    const a = spiralAngle(radius) + gauss(r) * Math.min(0.05, spacing * 0.08);
    const diff = Math.max(-6, Math.min(6, games[i].gf - games[i].ga));
    xyz[i * 3] = Math.cos(a) * radius;
    xyz[i * 3 + 1] = diff * 0.12 + gauss(r) * 0.03;
    xyz[i * 3 + 2] = Math.sin(a) * radius;
  }
  return { xyz, size: Math.max(0.2, Math.min(0.62, spacing * 2.4)) };
}

/**
 * 3D force-directed layout: nodes push apart, linked nodes pull together (stronger links pull closer).
 * Deterministic for the same input. Result fits in a sphere of `radius`.
 */
export function forceLayout(
  n: number,
  links: { a: number; b: number; w: number }[],
  { radius = 4.6, iterations = 360, seed = 7, sizes = [] as number[] } = {},
): Float32Array {
  const pos = new Float32Array(n * 3);
  if (!n) return pos;
  const r = rng(seed);
  // Start on a Fibonacci sphere so nothing overlaps.
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = i * 2.399963 + r() * 0.2;
    pos[i * 3] = Math.cos(th) * rad * 3;
    pos[i * 3 + 1] = y * 3;
    pos[i * 3 + 2] = Math.sin(th) * rad * 3;
  }
  const vel = new Float32Array(n * 3);
  const force = new Float32Array(n * 3);
  for (let it = 0; it < iterations; it++) {
    const alpha = 1 - it / iterations;
    force.fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i * 3] - pos[j * 3];
        let dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        let dz = pos[i * 3 + 2] - pos[j * 3 + 2];
        let d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1e-4) {
          dx = r() - 0.5;
          dy = r() - 0.5;
          dz = r() - 0.5;
          d2 = 0.01;
        }
        const d = Math.sqrt(d2);
        // Push apart, much harder when two planets (plus room for a name) would touch.
        const room = ((sizes[i] ?? 0.3) + (sizes[j] ?? 0.3)) * 3 + 1.2;
        const f = 4 / d2 + (d < room ? (room - d) * 4 : 0);
        force[i * 3] += (dx / d) * f;
        force[i * 3 + 1] += (dy / d) * f;
        force[i * 3 + 2] += (dz / d) * f;
        force[j * 3] -= (dx / d) * f;
        force[j * 3 + 1] -= (dy / d) * f;
        force[j * 3 + 2] -= (dz / d) * f;
      }
    }
    for (const { a, b, w } of links) {
      const dx = pos[b * 3] - pos[a * 3];
      const dy = pos[b * 3 + 1] - pos[a * 3 + 1];
      const dz = pos[b * 3 + 2] - pos[a * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-3;
      const rest = 4 - 2 * w;
      const f = (d - rest) * 0.06 * (0.3 + w);
      force[a * 3] += (dx / d) * f;
      force[a * 3 + 1] += (dy / d) * f;
      force[a * 3 + 2] += (dz / d) * f;
      force[b * 3] -= (dx / d) * f;
      force[b * 3 + 1] -= (dy / d) * f;
      force[b * 3 + 2] -= (dz / d) * f;
    }
    for (let i = 0; i < n * 3; i++) {
      force[i] -= pos[i] * 0.02; // gentle pull to the centre
      vel[i] = (vel[i] + force[i] * 0.5 * alpha) * 0.82;
      const step = Math.max(-0.5, Math.min(0.5, vel[i]));
      pos[i] += step;
    }
  }
  // Centre and fit.
  const c = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) c[k] += pos[i * 3 + k] / n;
  let max = 0;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) pos[i * 3 + k] -= c[k];
    max = Math.max(max, Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
  }
  const s = max > 0 ? radius / max : 1;
  for (let i = 0; i < n * 3; i++) pos[i] *= s;
  return pos;
}

/**
 * Slots for `n` bars on an arc that curves toward the viewer, leader in the middle,
 * then alternating left/right (like a podium). Returns slots in rank order.
 */
export function arcSlots(n: number, { radius = 7.5, spread = 1.5, centerZ = 4.6 } = {}): { x: number; z: number; rotY: number }[] {
  if (!n) return [];
  const angles = Array.from({ length: n }, (_, j) => (n === 1 ? 0 : -spread / 2 + (j * spread) / (n - 1)));
  const mid = (n - 1) / 2;
  const order = [...angles.keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  return order.map((j) => {
    const a = angles[j];
    return { x: Math.sin(a) * radius, z: centerZ - Math.cos(a) * radius, rotY: -a };
  });
}
