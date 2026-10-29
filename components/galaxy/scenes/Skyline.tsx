"use client";
/* eslint-disable react-hooks/immutability -- three.js uniforms, buffers and instance matrices are meant to be mutated every frame (the React Compiler is not enabled in this app). */

import { Html, MeshReflectorMaterial } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { BoxGeometry, type Group, InstancedBufferAttribute, type InstancedMesh, MathUtils, Object3D, ShaderMaterial, Vector3 } from "three";
import { COLORS, HEX, type PickRegistry, type Selection, type StatKey, useIntro } from "@/components/galaxy/common";
import { arcSlots } from "@/components/galaxy/layout";
import { rinkTexture } from "@/components/galaxy/rink";
import { barFragment, barVertex } from "@/components/galaxy/shaders";
import type { GalaxyPlayer } from "@/lib/stats/galaxy";

type Props = {
  players: GalaxyPlayer[];
  stat: StatKey;
  active: boolean;
  calm: boolean;
  reflections: boolean;
  selected: Selection;
  myIndex: number | null;
  picks: PickRegistry;
};

export const SKYLINE_BARS = 12;
const MAX_H = 4.2;
const BAR_W = 0.46;
const MEDAL = ["#ffd45c", "#d7e3f4", "#e0915a"];

function barGeometry(n: number) {
  const g = new BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  g.setAttribute("aColor", new InstancedBufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("aSel", new InstancedBufferAttribute(new Float32Array(n), 1));
  g.setAttribute("aDim", new InstancedBufferAttribute(new Float32Array(n), 1));
  return g;
}

/** Leaders as glowing bars on a rink, leader in the middle. Points stack goals (bottom) and assists (top). */
export function Skyline({ players, stat, active, calm, reflections, selected, myIndex, picks }: Props) {
  const intro = useIntro(active, calm);
  const root = useRef<Group>(null);
  const lower = useRef<InstancedMesh>(null);
  const upper = useRef<InstancedMesh>(null);
  const nameRefs = useRef<(Group | null)[]>([]);
  const valueRefs = useRef<(Group | null)[]>([]);
  const portrait = useThree((s) => s.size.width / s.size.height < 0.8);
  const n = players.length;

  // Ranking for the chosen stat: rank → player index, plus target slot and heights per player.
  const plan = useMemo(() => {
    const value = (p: GalaxyPlayer) => p[stat];
    const ranked = players
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.pos !== "G")
      .sort((a, b) => value(b.p) - value(a.p) || b.p.gp - a.p.gp)
      .slice(0, SKYLINE_BARS);
    const slots = arcSlots(ranked.length, portrait ? { radius: 5.4, spread: 1.55, centerZ: 3.4 } : { radius: 7.5, spread: 1.5, centerZ: 4.6 });
    const max = Math.max(1, ...ranked.map(({ p }) => value(p)));
    const rank = new Map(ranked.map(({ i }, r) => [i, r]));
    const lowerH = new Float32Array(n);
    const upperH = new Float32Array(n);
    const slot = players.map((_, i) => {
      const r = rank.get(i);
      return r === undefined ? null : slots[r];
    });
    players.forEach((p, i) => {
      if (!rank.has(i)) return;
      if (stat === "points") {
        lowerH[i] = (p.goals / max) * MAX_H;
        upperH[i] = (p.assists / max) * MAX_H;
      } else {
        lowerH[i] = (value(p) / max) * MAX_H;
      }
    });
    return { ranked, rank, slot, lowerH, upperH };
  }, [players, stat, n, portrait]);

  const lowerGeometry = useMemo(() => barGeometry(n), [n]);
  const upperGeometry = useMemo(() => barGeometry(n), [n]);
  const material = useMemo(() => new ShaderMaterial({ vertexShader: barVertex, fragmentShader: barFragment, uniforms: { uTime: { value: 0 } } }), []);
  const rink = useMemo(() => rinkTexture(), []);

  useEffect(
    () => () => {
      lowerGeometry.dispose();
      upperGeometry.dispose();
    },
    [lowerGeometry, upperGeometry],
  );
  useEffect(
    () => () => {
      material.dispose();
      rink.dispose();
    },
    [material, rink],
  );

  // Animated state per player: position on the floor and the two heights.
  const anim = useMemo(
    () => ({ x: new Float32Array(n), z: new Float32Array(n), rot: new Float32Array(n), lo: new Float32Array(n), up: new Float32Array(n), placed: new Uint8Array(n) }),
    [n],
  );
  const tapTargets = useMemo(() => players.map(() => ({ a: new Vector3(), b: new Vector3() })), [players]);

  // Colours by stat; "you" in gold.
  useEffect(() => {
    const lo = lowerGeometry.getAttribute("aColor") as InstancedBufferAttribute;
    const up = upperGeometry.getAttribute("aColor") as InstancedBufferAttribute;
    const base = stat === "points" ? COLORS.stat.goals() : COLORS.stat[stat]();
    const top = COLORS.stat.assists();
    for (let i = 0; i < n; i++) {
      const mine = i === myIndex;
      const a = mine ? COLORS.you() : base;
      const b = mine ? COLORS.you().multiplyScalar(0.75) : top;
      lo.setXYZ(i, a.r, a.g, a.b);
      up.setXYZ(i, b.r, b.g, b.b);
    }
    lo.needsUpdate = true;
    up.needsUpdate = true;
  }, [stat, myIndex, n, lowerGeometry, upperGeometry]);

  useEffect(() => {
    const focus = selected?.kind === "player" ? selected.index : null;
    for (const g of [lowerGeometry, upperGeometry]) {
      const sel = g.getAttribute("aSel") as InstancedBufferAttribute;
      const dim = g.getAttribute("aDim") as InstancedBufferAttribute;
      for (let i = 0; i < n; i++) {
        sel.setX(i, i === focus ? 1 : 0);
        dim.setX(i, focus !== null && i !== focus ? 1 : 0);
      }
      sel.needsUpdate = true;
      dim.needsUpdate = true;
    }
  }, [selected, n, lowerGeometry, upperGeometry]);

  useLayoutEffect(() => {
    const obj = root.current;
    if (!obj) return;
    picks.current.leaders = plan.ranked.map(({ i }) => ({ sel: { kind: "player", index: i }, obj, a: tapTargets[i].a, b: tapTargets[i].b, radius: BAR_W * 0.7 }));
  }, [plan, picks, tapTargets]);

  const o = useMemo(() => new Object3D(), []);
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const v = intro.current;
    material.uniforms.uTime.value = clock.elapsedTime;
    if (root.current) root.current.visible = v > 0.001;
    const lo = lower.current;
    const up = upper.current;
    if (!lo || !up) return;
    const grow = MathUtils.smoothstep(v, 0, 1);
    for (let i = 0; i < n; i++) {
      const s = plan.slot[i];
      if (s) {
        if (!anim.placed[i] || calm) {
          anim.x[i] = s.x;
          anim.z[i] = s.z;
          anim.rot[i] = s.rotY;
          anim.placed[i] = 1;
        } else {
          anim.x[i] = MathUtils.damp(anim.x[i], s.x, 4, dt);
          anim.z[i] = MathUtils.damp(anim.z[i], s.z, 4, dt);
          anim.rot[i] = MathUtils.damp(anim.rot[i], s.rotY, 4, dt);
        }
      }
      const targetLo = plan.lowerH[i] * grow;
      const targetUp = plan.upperH[i] * grow;
      anim.lo[i] = calm ? targetLo : MathUtils.damp(anim.lo[i], targetLo, 5, dt);
      anim.up[i] = calm ? targetUp : MathUtils.damp(anim.up[i], targetUp, 5, dt);
      const hl = Math.max(anim.lo[i], 0.0001);
      const hu = Math.max(anim.up[i], 0.0001);
      const w = anim.placed[i] ? BAR_W : 0;
      o.position.set(anim.x[i], 0, anim.z[i]);
      o.rotation.set(0, anim.rot[i], 0);
      o.scale.set(w, hl, w);
      o.updateMatrix();
      lo.setMatrixAt(i, o.matrix);
      o.position.y = hl;
      const wu = anim.up[i] > 0.002 ? w * 0.94 : 0; // no lid on an empty top segment
      o.scale.set(wu, hu, wu);
      o.updateMatrix();
      up.setMatrixAt(i, o.matrix);
      tapTargets[i].a.set(anim.x[i], 0, anim.z[i]);
      tapTargets[i].b.set(anim.x[i], hl + hu, anim.z[i]);
      nameRefs.current[i]?.position.set(anim.x[i], 0, anim.z[i] + 0.4);
      valueRefs.current[i]?.position.set(anim.x[i], hl + hu + 0.32, anim.z[i]);
    }
    lo.instanceMatrix.needsUpdate = true;
    up.instanceMatrix.needsUpdate = true;
  });

  const labelsOn = active;
  const value = (p: GalaxyPlayer) => p[stat];

  return (
    <group ref={root}>
      <ambientLight intensity={0.55} />
      <pointLight position={[0, 6, 2]} intensity={30} color="#7fc8ff" />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]}>
        <planeGeometry args={[20, 8.5]} />
        {reflections ? (
          <MeshReflectorMaterial
            map={rink}
            emissiveMap={rink}
            emissive="#ffffff"
            emissiveIntensity={0.9}
            color="#a9bdd6"
            resolution={512}
            blur={[320, 90]}
            mixBlur={0.9}
            mixStrength={4}
            mirror={0.75}
            depthScale={0.6}
            minDepthThreshold={0.3}
            maxDepthThreshold={1.3}
            roughness={0.75}
            metalness={0.4}
          />
        ) : (
          <meshStandardMaterial map={rink} emissiveMap={rink} emissive="#ffffff" emissiveIntensity={0.9} color="#a9bdd6" roughness={0.6} metalness={0.2} />
        )}
      </mesh>
      {n > 0 && <instancedMesh key={`lo${n}`} ref={lower} args={[lowerGeometry, material, n]} frustumCulled={false} />}
      {n > 0 && <instancedMesh key={`up${n}`} ref={upper} args={[upperGeometry, material, n]} frustumCulled={false} />}
      {labelsOn &&
        plan.ranked.map(({ p, i }, r) => {
          const mine = i === myIndex;
          const s = plan.slot[i]!;
          return (
            <group key={p.id}>
              <group ref={(g) => void (nameRefs.current[i] = g)} position={[s.x, 0, s.z + 0.4]}>
                <Html center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
                  <span
                    className="block max-h-24 translate-y-1/2 overflow-hidden text-[10px] leading-3 font-semibold text-ellipsis whitespace-nowrap"
                    style={{ writingMode: "vertical-rl", color: mine ? HEX.you : "#c9d8ee", textShadow: "0 0 6px rgba(0,0,0,0.9)" }}
                  >
                    {p.name}
                  </span>
                </Html>
              </group>
              <group ref={(g) => void (valueRefs.current[i] = g)} position={[s.x, 0.3, s.z]}>
                <Html center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
                  <span
                    className="tabular block rounded-full px-1.5 text-[11px] leading-4 font-black"
                    style={{
                      color: r < 3 ? MEDAL[r] : mine ? HEX.you : "#e8f1ff",
                      background: "rgba(3,6,13,0.6)",
                      border: `1px solid ${r < 3 ? MEDAL[r] : "rgba(92,200,255,0.25)"}`,
                    }}
                  >
                    {value(p)}
                  </span>
                </Html>
              </group>
            </group>
          );
        })}
    </group>
  );
}
