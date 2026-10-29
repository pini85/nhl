"use client";
/* eslint-disable react-hooks/immutability -- three.js uniforms, buffers and instance matrices are meant to be mutated every frame (the React Compiler is not enabled in this app). */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, type Points, ShaderMaterial, SphereGeometry, Vector3 } from "three";
import type { Cloud } from "@/components/galaxy/particles";
import { dustFragment, dustVertex, skyFragment, skyVertex } from "@/components/galaxy/shaders";

/** Additive shader material with the usual "light adds up" settings. */
export function glowMaterial(vertexShader: string, fragmentShader: string, uniforms: Record<string, { value: unknown }>) {
  return new ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: AdditiveBlending });
}

/** A particle cloud drawn as soft points; `intro` (0–1) collapses it to the centre and back. */
export function CloudPoints({ cloud, size, intro, motion }: { cloud: Cloud; size: number; intro?: RefObject<number>; motion: boolean }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const points = useRef<Points>(null);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(cloud.position, 3));
    g.setAttribute("aColor", new BufferAttribute(cloud.color, 3));
    g.setAttribute("aSize", new BufferAttribute(cloud.size, 1));
    g.setAttribute("aSeed", new BufferAttribute(cloud.seed, 1));
    return g;
  }, [cloud]);
  const material = useMemo(
    () => glowMaterial(dustVertex, dustFragment, { uTime: { value: 0 }, uIntro: { value: 1 }, uPixelRatio: { value: 1 }, uSize: { value: size }, uMotion: { value: 1 } }),
    [size],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    const u = material.uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uIntro.value = intro ? intro.current : 1;
    u.uPixelRatio.value = dpr;
    u.uMotion.value = motion ? 1 : 0;
    if (points.current) points.current.visible = u.uIntro.value > 0.001;
  });
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}

/** Deep-space sphere behind everything. */
export function Sky() {
  const geometry = useMemo(() => new SphereGeometry(150, 32, 16), []);
  const material = useMemo(
    () => new ShaderMaterial({ vertexShader: skyVertex, fragmentShader: skyFragment, uniforms: { uTint: { value: new Vector3(0.1, 0.25, 0.6) } }, side: BackSide, depthWrite: false }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <mesh geometry={geometry} material={material} renderOrder={-10} frustumCulled={false} />;
}
