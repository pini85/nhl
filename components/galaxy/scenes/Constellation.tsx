"use client";
/* eslint-disable react-hooks/immutability -- three.js uniforms, buffers and instance matrices are meant to be mutated every frame (the React Compiler is not enabled in this app). */

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  type Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  type InstancedMesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from "three";
import { COLORS, HEX, type PickRegistry, type Selection, useIntro, winColor } from "@/components/galaxy/common";
import { forceLayout } from "@/components/galaxy/layout";
import { glowMaterial } from "@/components/galaxy/parts";
import { beamFragment, beamVertex, haloFragment, haloVertex, nodeFragment, nodeVertex } from "@/components/galaxy/shaders";
import type { GalaxyLink, GalaxyPlayer } from "@/lib/stats/galaxy";

type Props = {
  players: GalaxyPlayer[];
  links: GalaxyLink[];
  active: boolean;
  calm: boolean;
  selected: Selection;
  myIndex: number | null;
  picks: PickRegistry;
};

const MAX_LABELS = 14;

/** Players as plasma planets, beams between teammates: thicker = more games together, colour = win % together. */
export function Constellation({ players, links, active, calm, selected, myIndex, picks }: Props) {
  const intro = useIntro(active, calm);
  const root = useRef<Group>(null);
  const nodes = useRef<InstancedMesh>(null);
  const halos = useRef<InstancedMesh>(null);
  const [labelsOn, setLabelsOn] = useState(false);
  const labelsWanted = useRef(false);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const n = players.length;

  const graph = useMemo(() => {
    const index = new Map(players.map((p, i) => [p.id, i]));
    const maxGp = Math.max(1, ...links.map((l) => l.gp));
    const maxPts = Math.max(1, ...players.map((p) => p.points));
    const maxGpP = Math.max(1, ...players.map((p) => p.gp));
    const edges = links.flatMap((l) => {
      const a = index.get(l.a);
      const b = index.get(l.b);
      return a === undefined || b === undefined ? [] : [{ a, b, w: l.gp / maxGp, pct: l.wins / l.gp }];
    });
    const radius = players.map((p) => 0.16 + 0.3 * Math.sqrt(p.pos === "G" ? p.gp / maxGpP : Math.max(p.points / maxPts, (0.4 * p.gp) / maxGpP)));
    const pos = forceLayout(n, edges, { sizes: radius });
    return { edges, pos, radius };
  }, [players, links, n]);

  const nodeGeometry = useMemo(() => {
    const g = new IcosahedronGeometry(1, 3);
    g.setAttribute("aColor", new InstancedBufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aSel", new InstancedBufferAttribute(new Float32Array(n), 1));
    g.setAttribute("aDim", new InstancedBufferAttribute(new Float32Array(n), 1));
    g.setAttribute("aSeed", new InstancedBufferAttribute(Float32Array.from({ length: n }, (_, i) => (i * 0.37) % 1), 1));
    return g;
  }, [n]);
  const nodeMaterial = useMemo(
    () => new ShaderMaterial({ vertexShader: nodeVertex, fragmentShader: nodeFragment, uniforms: { uTime: { value: 0 }, uIntro: { value: 0 } } }),
    [],
  );

  const haloGeometry = useMemo(() => {
    const g = new PlaneGeometry(1, 1);
    g.setAttribute("aColor", new InstancedBufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aSize", new InstancedBufferAttribute(Float32Array.from(graph.radius, (r) => r * 7), 1));
    g.setAttribute("aDim", new InstancedBufferAttribute(new Float32Array(n), 1));
    return g;
  }, [n, graph]);
  const haloMaterial = useMemo(() => glowMaterial(haloVertex, haloFragment, { uIntro: { value: 0 } }), []);

  // Beams: 4 vertices per link, widths in CSS pixels.
  const beamGeometry = useMemo(() => {
    const m = graph.edges.length;
    const g = new BufferGeometry();
    const start = new Float32Array(m * 12);
    const end = new Float32Array(m * 12);
    const t = new Float32Array(m * 4);
    const side = new Float32Array(m * 4);
    const width = new Float32Array(m * 4);
    const color = new Float32Array(m * 12);
    const seed = new Float32Array(m * 4);
    const index: number[] = [];
    graph.edges.forEach((e, k) => {
      // Stretch 30–70 % across the colour scale so differences show; weak links fade back.
      const c = winColor(Math.min(1, Math.max(0, (e.pct - 0.3) / 0.4))).multiplyScalar(0.12 + 0.9 * e.w * e.w);
      for (let v = 0; v < 4; v++) {
        const j = k * 4 + v;
        start.set(graph.pos.subarray(e.a * 3, e.a * 3 + 3), j * 3);
        end.set(graph.pos.subarray(e.b * 3, e.b * 3 + 3), j * 3);
        t[j] = v < 2 ? 0 : 1;
        side[j] = v % 2 ? 1 : -1;
        width[j] = 0.8 + 3.4 * e.w;
        color.set([c.r, c.g, c.b], j * 3);
        seed[j] = (k * 0.618) % 1;
      }
      const o = k * 4;
      index.push(o, o + 1, o + 2, o + 2, o + 1, o + 3);
    });
    g.setAttribute("position", new BufferAttribute(start, 3)); // only used for the vertex count
    g.setAttribute("aStart", new BufferAttribute(start, 3));
    g.setAttribute("aEnd", new BufferAttribute(end, 3));
    g.setAttribute("aT", new BufferAttribute(t, 1));
    g.setAttribute("aSide", new BufferAttribute(side, 1));
    g.setAttribute("aWidth", new BufferAttribute(width, 1));
    g.setAttribute("aColor", new BufferAttribute(color, 3));
    g.setAttribute("aSeed", new BufferAttribute(seed, 1));
    g.setAttribute("aDim", new BufferAttribute(new Float32Array(m * 4), 1));
    g.setIndex(index);
    return g;
  }, [graph]);
  const beamMaterial = useMemo(() => {
    const m = glowMaterial(beamVertex, beamFragment, { uTime: { value: 0 }, uIntro: { value: 0 }, uResolution: { value: [1, 1] }, uPixelRatio: { value: 1 } });
    m.side = DoubleSide; // the ribbons are built in screen space, so their winding flips with the view
    return m;
  }, []);

  useEffect(() => () => nodeGeometry.dispose(), [nodeGeometry]);
  useEffect(() => () => haloGeometry.dispose(), [haloGeometry]);
  useEffect(() => () => beamGeometry.dispose(), [beamGeometry]);
  useEffect(
    () => () => {
      for (const m of [nodeMaterial, haloMaterial, beamMaterial]) m.dispose();
    },
    [nodeMaterial, haloMaterial, beamMaterial],
  );

  // Positions, sizes and tap targets.
  useLayoutEffect(() => {
    const mesh = nodes.current;
    const halo = halos.current;
    if (!mesh || !halo) return;
    const o = new Object3D();
    for (let i = 0; i < n; i++) {
      o.position.fromArray(graph.pos, i * 3);
      o.scale.setScalar(graph.radius[i]);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      o.scale.setScalar(1);
      o.updateMatrix();
      halo.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    picks.current.chemistry = players.map((_, i) => ({
      sel: { kind: "player", index: i },
      obj: halo,
      a: new Vector3().fromArray(graph.pos, i * 3),
      radius: graph.radius[i] * 1.3,
    }));
  }, [players, n, graph, picks, nodeGeometry, haloGeometry]);

  // Colours ("you" in gold), selection and dimming of everyone not linked to the selection.
  useEffect(() => {
    const focus = selected?.kind === "player" ? selected.index : null;
    const linked = new Set<number>();
    if (focus !== null) {
      linked.add(focus);
      for (const e of graph.edges) {
        if (e.a === focus) linked.add(e.b);
        if (e.b === focus) linked.add(e.a);
      }
    }
    const nodeColor = nodeGeometry.getAttribute("aColor") as InstancedBufferAttribute;
    const haloColor = haloGeometry.getAttribute("aColor") as InstancedBufferAttribute;
    const sel = nodeGeometry.getAttribute("aSel") as InstancedBufferAttribute;
    const dim = nodeGeometry.getAttribute("aDim") as InstancedBufferAttribute;
    const haloDim = haloGeometry.getAttribute("aDim") as InstancedBufferAttribute;
    players.forEach((p, i) => {
      const c = i === myIndex ? COLORS.you() : COLORS.pos[p.pos]();
      nodeColor.setXYZ(i, c.r, c.g, c.b);
      haloColor.setXYZ(i, c.r, c.g, c.b);
      sel.setX(i, i === focus ? 1 : 0);
      const d = focus !== null && !linked.has(i) ? 1 : 0;
      dim.setX(i, d);
      haloDim.setX(i, d);
    });
    const beamDim = beamGeometry.getAttribute("aDim") as BufferAttribute;
    graph.edges.forEach((e, k) => {
      const d = focus !== null && e.a !== focus && e.b !== focus ? 1 : 0;
      for (let v = 0; v < 4; v++) beamDim.setX(k * 4 + v, d);
    });
    for (const a of [nodeColor, haloColor, sel, dim, haloDim, beamDim]) a.needsUpdate = true;
  }, [selected, myIndex, players, graph, nodeGeometry, haloGeometry, beamGeometry]);

  const labelled = useMemo(() => {
    const top = new Set(players.map((_, i) => i).slice(0, MAX_LABELS));
    if (myIndex !== null) top.add(myIndex);
    return [...top];
  }, [players, myIndex]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const v = intro.current;
    nodeMaterial.uniforms.uTime.value = t;
    nodeMaterial.uniforms.uIntro.value = v;
    haloMaterial.uniforms.uIntro.value = v;
    beamMaterial.uniforms.uTime.value = t;
    beamMaterial.uniforms.uIntro.value = v;
    beamMaterial.uniforms.uResolution.value = [(size.width * dpr) / 2, (size.height * dpr) / 2];
    beamMaterial.uniforms.uPixelRatio.value = dpr;
    if (root.current) {
      root.current.visible = v > 0.001;
      if (!calm) root.current.rotation.y += Math.min(dt, 0.05) * 0.07;
    }
    const want = active && v > 0.97;
    if (want !== labelsWanted.current) {
      labelsWanted.current = want;
      setLabelsOn(want);
    }
  });

  return (
    <group ref={root}>
      <mesh geometry={beamGeometry} material={beamMaterial} frustumCulled={false} />
      {n > 0 && <instancedMesh key={`h${n}`} ref={halos} args={[haloGeometry, haloMaterial, n]} frustumCulled={false} />}
      {n > 0 && <instancedMesh key={`n${n}`} ref={nodes} args={[nodeGeometry, nodeMaterial, n]} frustumCulled={false} />}
      <group>
        {labelsOn &&
          labelled.map((i) => {
            const p = players[i];
            const mine = i === myIndex;
            const sel = selected?.kind === "player" && selected.index === i;
            return (
              <Html
                key={p.id}
                position={[graph.pos[i * 3], graph.pos[i * 3 + 1] + graph.radius[i] + 0.12, graph.pos[i * 3 + 2]]}
                center
                zIndexRange={[10, 0]}
                style={{ pointerEvents: "none" }}
              >
                <span
                  className="block -translate-y-2 rounded-full px-1.5 text-[10px] leading-4 font-semibold whitespace-nowrap"
                  style={{
                    color: mine ? HEX.you : "#e8f1ff",
                    background: sel ? "rgba(92,200,255,0.25)" : "rgba(3,6,13,0.55)",
                    textShadow: "0 0 6px rgba(0,0,0,0.8)",
                  }}
                >
                  {mine ? `${p.name} · You` : p.name}
                </span>
              </Html>
            );
          })}
      </group>
    </group>
  );
}
