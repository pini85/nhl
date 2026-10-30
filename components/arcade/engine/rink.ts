// Rink geometry and collision helpers. World units are roughly "half metres"; +y is the top goal
// (the one the home team attacks). Pure math, no DOM.

export const RINK = {
  hw: 15, // half width
  hl: 32, // half length
  corner: 8.5,
  goalY: 27.5, // goal line distance from centre
  mouth: 2.1, // half width of the net mouth
  depth: 1.9, // net depth behind the goal line
  postR: 0.2,
  creaseR: 3,
  blueY: 8.5,
  circleX: 7.5,
  circleY: 21,
  circleR: 4.5,
} as const;

export type Body = { x: number; y: number; vx: number; vy: number };

/** Keeps a circle inside the rounded boards. Returns the speed into the wall (0 if no contact). */
export function boards(b: Body, r: number, bounce: number): number {
  const ix = RINK.hw - RINK.corner;
  const iy = RINK.hl - RINK.corner;
  const qx = Math.max(-ix, Math.min(ix, b.x));
  const qy = Math.max(-iy, Math.min(iy, b.y));
  const dx = b.x - qx;
  const dy = b.y - qy;
  const d = Math.hypot(dx, dy);
  const max = RINK.corner - r;
  if (d <= max || d === 0) return 0;
  const nx = dx / d;
  const ny = dy / d;
  b.x = qx + nx * max;
  b.y = qy + ny * max;
  const vn = b.vx * nx + b.vy * ny;
  if (vn <= 0) return 0;
  b.vx -= (1 + bounce) * vn * nx;
  b.vy -= (1 + bounce) * vn * ny;
  return vn;
}

/** Circle vs. static circle. Returns impact speed. */
export function bumpCircle(b: Body, r: number, cx: number, cy: number, cr: number, bounce: number): number {
  const dx = b.x - cx;
  const dy = b.y - cy;
  const d = Math.hypot(dx, dy);
  const min = r + cr;
  if (d >= min || d === 0) return 0;
  const nx = dx / d;
  const ny = dy / d;
  b.x = cx + nx * min;
  b.y = cy + ny * min;
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return 0;
  b.vx -= (1 + bounce) * vn * nx;
  b.vy -= (1 + bounce) * vn * ny;
  return -vn;
}

/** Circle vs. static segment. Returns impact speed. */
export function bumpSegment(b: Body, r: number, ax: number, ay: number, bx: number, by: number, bounce: number): number {
  const ex = bx - ax;
  const ey = by - ay;
  const len2 = ex * ex + ey * ey;
  const t = Math.max(0, Math.min(1, ((b.x - ax) * ex + (b.y - ay) * ey) / len2));
  return bumpCircle(b, r, ax + ex * t, ay + ey * t, 0, bounce);
}

/** The net frame of the goal at side `s` (+1 top, -1 bottom): three segments behind the posts. */
export function netSegments(s: 1 | -1): [number, number, number, number][] {
  const y0 = s * RINK.goalY;
  const y1 = s * (RINK.goalY + RINK.depth);
  const m = RINK.mouth;
  const back = m * 0.8;
  return [
    [-m, y0, -back, y1],
    [-back, y1, back, y1],
    [back, y1, m, y0],
  ];
}

/** Bounces a body off both nets and their posts. Returns the hardest impact and whether a post was hit. */
export function nets(b: Body, r: number, bounce: number): { impact: number; post: boolean } {
  let impact = 0;
  let post = false;
  for (const s of [1, -1] as const) {
    if (Math.abs(b.y - s * (RINK.goalY + RINK.depth / 2)) > RINK.depth + 2 + r) continue;
    for (const [ax, ay, bx, by] of netSegments(s)) impact = Math.max(impact, bumpSegment(b, r, ax, ay, bx, by, bounce * 0.5));
    for (const px of [-RINK.mouth, RINK.mouth]) {
      const hit = bumpCircle(b, r, px, s * RINK.goalY, RINK.postR, bounce);
      if (hit > 0) {
        post = true;
        impact = Math.max(impact, hit);
      }
    }
  }
  return { impact, post };
}

/** Did a puck moving from (x0,y0) to (x1,y1) cross the goal line of side `s` into the net mouth from the front? */
export function crossedGoal(x0: number, y0: number, x1: number, y1: number, s: 1 | -1, r: number): boolean {
  const g = s * RINK.goalY;
  const before = s * (y0 - g) < 0;
  const after = s * (y1 - g) >= 0;
  if (!before || !after) return false;
  const t = (g - y0) / (y1 - y0);
  const x = x0 + (x1 - x0) * t;
  return Math.abs(x) < RINK.mouth - r * 0.5;
}

export const insideRink = (x: number, y: number, r = 0) => {
  const ix = RINK.hw - RINK.corner;
  const iy = RINK.hl - RINK.corner;
  const dx = x - Math.max(-ix, Math.min(ix, x));
  const dy = y - Math.max(-iy, Math.min(iy, y));
  return Math.hypot(dx, dy) <= RINK.corner - r + 1e-6;
};
