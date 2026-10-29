import { gauss, rng, SPIRAL, spiralAngle } from "@/components/galaxy/layout";

// Particle clouds as flat arrays. `position` holds (radius, angle, height); the dust shader turns that into xyz.

export type Cloud = { position: Float32Array; color: Float32Array; size: Float32Array; seed: Float32Array; count: number };

const TAU = Math.PI * 2;

function cloud(count: number): Cloud {
  return { position: new Float32Array(count * 3), color: new Float32Array(count * 3), size: new Float32Array(count), seed: new Float32Array(count), count };
}

/** Bulge + two spiral arms that follow the game timeline + a faint halo. */
export function galaxyDust(count: number, seed = 3): Cloud {
  const c = cloud(count);
  const r = rng(seed);
  const gain = Math.sqrt(20000 / count); // more grains → each one dimmer, same total light
  const outer = SPIRAL.rMax * 1.25;
  for (let i = 0; i < count; i++) {
    const k = r();
    let rad: number;
    let ang: number;
    let h: number;
    let col: [number, number, number];
    let size: number;
    if (k < 0.13) {
      rad = Math.abs(gauss(r)) * 0.7;
      ang = r() * TAU;
      h = gauss(r) * 0.3 * Math.max(0.25, 1 - rad / 1.6);
      col = [1.0, 0.72, 0.42];
      size = 0.8 + r() * 1.3;
    } else if (k < 0.95) {
      const arm = r() < 0.5 ? 0 : Math.PI;
      rad = SPIRAL.rMin * 0.5 + Math.pow(r(), 0.8) * (outer - SPIRAL.rMin * 0.5);
      ang = spiralAngle(Math.max(rad, SPIRAL.r0 * 1.05)) + arm + gauss(r) * (0.2 + rad * 0.03);
      h = gauss(r) * (0.2 * (1 - rad / (outer * 1.1)) + 0.025);
      const t = Math.min(1, rad / outer);
      col = [1.0 + (0.28 - 1.0) * t, 0.72 + (0.5 - 0.72) * t, 0.42 + (1.35 - 0.42) * t];
      size = 0.5 + r() * 1.1;
      if (r() < 0.025) {
        col = [1.35, 0.3, 0.78]; // star-forming knots
        size *= 1.6;
      }
    } else {
      rad = 2 + r() * 12;
      ang = r() * TAU;
      h = gauss(r) * 2.2;
      col = [0.2, 0.26, 0.45];
      size = 0.4 + r() * 0.7;
    }
    const b = (0.55 + r() * 0.7) * gain * 1.3;
    c.position.set([rad, ang, h], i * 3);
    c.color.set([col[0] * b, col[1] * b, col[2] * b], i * 3);
    c.size[i] = size;
    c.seed[i] = r();
  }
  return c;
}

/** Far background stars on a thick shell around everything. */
export function skyStars(count: number, seed = 5): Cloud {
  const c = cloud(count);
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const dist = 45 + r() * 45;
    const y = r() * 2 - 1;
    const rad = Math.sqrt(1 - y * y) * dist;
    const tint = r();
    const col: [number, number, number] = tint < 0.15 ? [1.0, 0.8, 0.6] : tint < 0.35 ? [0.6, 0.75, 1.0] : [0.9, 0.92, 1.0];
    const bright = r() < 0.04;
    const b = bright ? 1.6 + r() : 0.25 + r() * 0.5;
    c.position.set([rad, r() * TAU, y * dist], i * 3);
    c.color.set([col[0] * b, col[1] * b, col[2] * b], i * 3);
    c.size[i] = bright ? 2.2 + r() * 1.5 : 0.7 + r() * 1.2;
    c.seed[i] = r();
  }
  return c;
}
