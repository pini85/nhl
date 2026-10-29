import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, MathUtils, type Object3D, type Vector3 } from "three";

export type Mode = "games" | "chemistry" | "leaders";
export type StatKey = "points" | "goals" | "assists" | "hits" | "shots";
export type Selection = { kind: "game" | "player"; index: number } | null;
export type Tier = "high" | "low";

/** Something tappable: a point (or a segment, for bars) in `obj`'s local space. */
export type Pick = { sel: NonNullable<Selection>; obj: Object3D; a: Vector3; b?: Vector3; radius: number };
export type PickRegistry = { current: Record<Mode, Pick[]> };

export const TIERS = {
  high: { dpr: [1, 2] as [number, number], dust: 38000, sky: 2600, reflections: true, fullPost: true },
  low: { dpr: [1, 1.25] as [number, number], dust: 14000, sky: 1200, reflections: false, fullPost: false },
} satisfies Record<Tier, unknown>;

/** Best first guess from device hints; the performance monitor corrects it after a few seconds. */
export function initialTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  return cores < 4 || memory < 3 ? "low" : "high";
}

// Colours (sRGB hex, converted to linear by three). Multipliers push them into HDR so bloom picks them up.
const hdr = (hex: string, k: number) => new Color(hex).multiplyScalar(k);
export const COLORS = {
  win: () => hdr("#5cc8ff", 1.6),
  loss: () => hdr("#ff3d6e", 1.5),
  otLoss: () => hdr("#ffb648", 1.5),
  you: () => hdr("#ffcf5a", 2.2),
  pos: { F: () => hdr("#4aa8ff", 1.5), D: () => hdr("#3dffa0", 1.3), G: () => hdr("#b67cff", 1.6) },
  stat: {
    goals: () => hdr("#5cc8ff", 1.2),
    assists: () => hdr("#5dffa8", 1.0),
    hits: () => hdr("#ff8a4c", 1.1),
    shots: () => hdr("#b48cff", 1.2),
  },
};

export const HEX = { win: "#5cc8ff", loss: "#ff3d6e", otLoss: "#ffb648", you: "#ffcf5a", F: "#4aa8ff", D: "#3dffa0", G: "#b67cff", goals: "#5cc8ff", assists: "#5dffa8", hits: "#ff8a4c", shots: "#b48cff" };

/** Red → amber → cyan by win %. */
export function winColor(pct: number): Color {
  const lo = new Color("#ff3d6e");
  const mid = new Color("#ffb648");
  const hi = new Color("#5cc8ff");
  const c = pct < 0.5 ? lo.lerp(mid, pct / 0.5) : mid.lerp(hi, (pct - 0.5) / 0.5);
  return c.multiplyScalar(1.4);
}

/**
 * 0 → 1 when a scene becomes active ("big bang"), back to 0 when it leaves (a faster implosion).
 * With reduced motion it jumps straight to the end.
 */
export function useIntro(active: boolean, calm: boolean) {
  const v = useRef(0);
  useFrame((_, dt) => {
    const target = active ? 1 : 0;
    v.current = calm ? target : MathUtils.damp(v.current, target, active ? 1.5 : 4.5, Math.min(dt, 0.05));
    if (Math.abs(v.current - target) < 0.0005) v.current = target;
  });
  return v;
}
