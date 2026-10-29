"use client";
/* eslint-disable react-hooks/immutability -- three.js uniforms, buffers and instance matrices are meant to be mutated every frame (the React Compiler is not enabled in this app). */

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { CatmullRomCurve3, type Group, InstancedBufferAttribute, type InstancedMesh, type Mesh, Object3D, PlaneGeometry, TubeGeometry, Vector3 } from "three";
import { COLORS, type PickRegistry, type Selection, TIERS, type Tier, useIntro } from "@/components/galaxy/common";
import { gamePositions, SPIRAL, spiralAngle } from "@/components/galaxy/layout";
import { CloudPoints, glowMaterial } from "@/components/galaxy/parts";
import { galaxyDust } from "@/components/galaxy/particles";
import { glowFragment, glowVertex, starFragment, starVertex, threadFragment, threadVertex } from "@/components/galaxy/shaders";
import type { GalaxyGame } from "@/lib/stats/galaxy";

type Props = {
  games: GalaxyGame[];
  active: boolean;
  calm: boolean;
  tier: Tier;
  selected: Selection;
  myIndex: number | null;
  picks: PickRegistry;
};

/** Every game is a star on the spiral arm: newest by the core, oldest at the rim. */
export function GamesGalaxy({ games, active, calm, tier, selected, myIndex, picks }: Props) {
  const intro = useIntro(active, calm);
  const root = useRef<Group>(null);
  const stars = useRef<InstancedMesh>(null);
  const core = useRef<Mesh>(null);
  const thread = useRef<Mesh>(null);
  const n = games.length;

  const { xyz, size } = useMemo(() => gamePositions(games), [games]);
  const dust = useMemo(() => galaxyDust(TIERS[tier].dust), [tier]);

  const starGeometry = useMemo(() => {
    const g = new PlaneGeometry(1, 1);
    const color = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const seeds = new Float32Array(n);
    games.forEach((game, i) => {
      const c = game.win ? COLORS.win() : game.ot ? COLORS.otLoss() : COLORS.loss();
      color.set([c.r, c.g, c.b], i * 3);
      sizes[i] = size * (0.75 + 0.09 * Math.min(game.gf + game.ga, 12));
      seeds[i] = (i * 0.618) % 1;
    });
    g.setAttribute("aColor", new InstancedBufferAttribute(color, 3));
    g.setAttribute("aSize", new InstancedBufferAttribute(sizes, 1));
    g.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    g.setAttribute("aSel", new InstancedBufferAttribute(new Float32Array(n), 1));
    g.setAttribute("aMine", new InstancedBufferAttribute(new Float32Array(n), 1));
    return g;
  }, [games, n, size]);
  const starMaterial = useMemo(() => glowMaterial(starVertex, starFragment, { uTime: { value: 0 }, uIntro: { value: 0 } }), []);

  const coreGeometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const coreMaterial = useMemo(
    () => glowMaterial(glowVertex, glowFragment, { uScale: { value: 5.5 }, uColor: { value: COLORS.otLoss().multiplyScalar(0.55) }, uIntensity: { value: 0 }, uTime: { value: 0 } }),
    [],
  );

  // The thread follows the ideal arm (no jitter) from the oldest game to the newest.
  const threadGeometry = useMemo(() => {
    if (n < 2) return null;
    const pts: Vector3[] = [];
    for (let k = 0; k <= 160; k++) {
      const r = SPIRAL.rMax - ((SPIRAL.rMax - SPIRAL.rMin) * k) / 160;
      const a = spiralAngle(r);
      pts.push(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    return new TubeGeometry(new CatmullRomCurve3(pts), 600, 0.012, 5, false);
  }, [n]);
  const threadMaterial = useMemo(() => glowMaterial(threadVertex, threadFragment, { uTime: { value: 0 }, uAlpha: { value: 0 } }), []);

  useEffect(
    () => () => {
      starGeometry.dispose();
      threadGeometry?.dispose();
    },
    [starGeometry, threadGeometry],
  );
  useEffect(
    () => () => {
      for (const m of [starMaterial, coreMaterial, threadMaterial]) m.dispose();
      coreGeometry.dispose();
    },
    [starMaterial, coreMaterial, threadMaterial, coreGeometry],
  );

  // Star positions + tap targets.
  useLayoutEffect(() => {
    const mesh = stars.current;
    if (!mesh) return;
    const o = new Object3D();
    for (let i = 0; i < n; i++) {
      o.position.set(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    picks.current.games = games.map((_, i) => ({
      sel: { kind: "game", index: i },
      obj: mesh,
      a: new Vector3(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]),
      radius: size * 0.6,
    }));
  }, [games, n, xyz, size, picks, starGeometry]);

  useEffect(() => {
    const sel = starGeometry.getAttribute("aSel") as InstancedBufferAttribute;
    (sel.array as Float32Array).fill(0);
    if (selected?.kind === "game") sel.array[selected.index] = 1;
    sel.needsUpdate = true;
  }, [selected, starGeometry]);

  useEffect(() => {
    const mine = starGeometry.getAttribute("aMine") as InstancedBufferAttribute;
    games.forEach((g, i) => (mine.array[i] = myIndex !== null && g.who.includes(myIndex) ? 1 : 0));
    mine.needsUpdate = true;
  }, [games, myIndex, starGeometry]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const v = intro.current;
    starMaterial.uniforms.uTime.value = t;
    starMaterial.uniforms.uIntro.value = v;
    coreMaterial.uniforms.uTime.value = t;
    coreMaterial.uniforms.uIntensity.value = v;
    threadMaterial.uniforms.uTime.value = t;
    threadMaterial.uniforms.uAlpha.value = Math.max(0, (v - 0.85) / 0.15);
    if (root.current) {
      root.current.visible = v > 0.001;
      if (!calm) root.current.rotation.y -= Math.min(dt, 0.05) * 0.045;
    }
  });

  return (
    <group ref={root}>
      <CloudPoints cloud={dust} size={30} intro={intro} motion={!calm} />
      <mesh ref={core} geometry={coreGeometry} material={coreMaterial} frustumCulled={false} />
      {threadGeometry && <mesh ref={thread} geometry={threadGeometry} material={threadMaterial} frustumCulled={false} />}
      {n > 0 && <instancedMesh key={n} ref={stars} args={[starGeometry, starMaterial, n]} frustumCulled={false} />}
    </group>
  );
}
