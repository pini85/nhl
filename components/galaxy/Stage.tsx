"use client";

import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Noise, ShockWave, ToneMapping, Vignette } from "@react-three/postprocessing";
import { easing } from "maath";
import { ToneMappingMode, type ShockWaveEffect } from "postprocessing";
import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react";
import { HalfFloatType, Vector2, Vector3 } from "three";
import { initialTier, type Mode, type PickRegistry, type Selection, type StatKey, TIERS, type Tier } from "@/components/galaxy/common";
import { CloudPoints, Sky } from "@/components/galaxy/parts";
import { skyStars } from "@/components/galaxy/particles";
import { Constellation } from "@/components/galaxy/scenes/Constellation";
import { GamesGalaxy } from "@/components/galaxy/scenes/GamesGalaxy";
import { Skyline } from "@/components/galaxy/scenes/Skyline";
import type { GalaxyData } from "@/lib/stats/galaxy";

export type StageProps = {
  data: GalaxyData;
  mode: Mode;
  stat: StatKey;
  selected: Selection;
  onSelect: (s: Selection) => void;
  myIndex: number | null;
  calm: boolean;
};

/** The 3D canvas. Loaded only on the Galaxy tab (three.js is big). */
export default function Stage(props: StageProps) {
  const [tier, setTier] = useState<Tier>(initialTier);
  const [lost, setLost] = useState(false);
  const picks: PickRegistry = useRef({ games: [], chemistry: [], leaders: [] });
  const shock = useRef<ShockWaveEffect>(null);
  const settings = TIERS[tier];

  if (lost) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[var(--muted-fg)]">
        <button type="button" className="arena-card px-4 py-3" onClick={() => location.reload()}>
          The 3D view stopped (the phone needed the memory back). Tap to restart it.
        </button>
      </div>
    );
  }

  return (
    <Canvas
      dpr={settings.dpr}
      flat
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance" }}
      camera={{ fov: 52, near: 0.1, far: 400, position: [0, 30, 60] }}
      onCreated={({ gl }) => {
        gl.setClearColor("#02040a");
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          setLost(true);
        });
      }}
      style={{ touchAction: "none" }}
      aria-label="3D view of the club's games and players"
    >
      <PerformanceMonitor flipflops={2} onDecline={() => setTier("low")} onFallback={() => setTier("low")} />
      <Sky />
      <Backdrop count={settings.sky} motion={!props.calm} />
      <GamesGalaxy
        games={props.data.games}
        active={props.mode === "games"}
        calm={props.calm}
        tier={tier}
        selected={props.selected}
        myIndex={props.myIndex}
        picks={picks}
      />
      <Constellation
        players={props.data.players}
        links={props.data.links}
        active={props.mode === "chemistry"}
        calm={props.calm}
        selected={props.selected}
        myIndex={props.myIndex}
        picks={picks}
      />
      <Skyline
        players={props.data.players}
        stat={props.stat}
        active={props.mode === "leaders"}
        calm={props.calm}
        reflections={settings.reflections}
        selected={props.selected}
        myIndex={props.myIndex}
        picks={picks}
      />
      <CameraRig mode={props.mode} calm={props.calm} />
      <Picker
        mode={props.mode}
        picks={picks}
        onPick={(sel, at) => {
          props.onSelect(sel);
          if (sel && at && shock.current && !props.calm) {
            shock.current.position.copy(at);
            shock.current.explode();
          }
          if (sel) navigator.vibrate?.(8);
        }}
      />
      <Effects tier={tier} shock={shock} />
    </Canvas>
  );
}

function Backdrop({ count, motion }: { count: number; motion: boolean }) {
  const cloud = useMemo(() => skyStars(count), [count]);
  return <CloudPoints cloud={cloud} size={140} motion={motion} />;
}

function Effects({ tier, shock }: { tier: Tier; shock: React.RefObject<ShockWaveEffect | null> }) {
  const ca = useMemo(() => new Vector2(0.0007, 0.0005), []);
  if (tier === "high") {
    return (
      <EffectComposer multisampling={0} frameBufferType={HalfFloatType}>
        <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.22} luminanceSmoothing={0.3} levels={7} radius={0.78} />
        <ShockWave ref={shock} speed={1.4} maxRadius={0.8} waveSize={0.18} amplitude={0.08} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <ChromaticAberration offset={ca} radialModulation modulationOffset={0.3} />
        <Vignette offset={0.3} darkness={0.72} />
        <Noise premultiply opacity={0.55} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0} frameBufferType={HalfFloatType}>
      <Bloom mipmapBlur intensity={1.0} luminanceThreshold={0.25} luminanceSmoothing={0.3} levels={5} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.3} darkness={0.7} />
    </EffectComposer>
  );
}

// Where the camera sits for each view. On a tall phone screen it backs off so the scene still fits sideways.
const POSES: Record<Mode, { pos: [number, number, number]; target: [number, number, number]; min: number; max: number; fit: number; maxPolar: number }> = {
  games: { pos: [0, 8.2, 13.5], target: [0, -0.4, 0], min: 2.5, max: 45, fit: 0.78, maxPolar: Math.PI },
  chemistry: { pos: [0, 2.5, 12], target: [0, 0, 0], min: 2.5, max: 35, fit: 0.85, maxPolar: Math.PI },
  leaders: { pos: [0, 4.6, 10.5], target: [0, 1.6, -0.6], min: 4, max: 26, fit: 0.72, maxPolar: 1.42 },
};

function CameraRig({ mode, calm }: { mode: Mode; calm: boolean }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const flight = useRef<{ pos: Vector3; target: Vector3 } | null>(null);
  const camera = useThree((s) => s.camera);
  const get = useThree((s) => s.get);
  const pose = POSES[mode];

  // Fly to the view whenever it changes (not on every resize: the browser bar showing/hiding would reset your zoom).
  useEffect(() => {
    const p = POSES[mode];
    const target = new Vector3(...p.target);
    const offset = new Vector3(...p.pos).sub(target);
    const { width, height } = get().size;
    offset.multiplyScalar(Math.min(2.1, Math.max(1, p.fit / (width / height))));
    flight.current = { pos: target.clone().add(offset), target };
  }, [mode, get]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => (flight.current = null);
    c.addEventListener("start", stop);
    return () => c.removeEventListener("start", stop);
  }, []);

  useFrame((_, delta) => {
    const f = flight.current;
    const c = controls.current;
    if (!f || !c) return;
    const dt = Math.min(delta, 0.05);
    if (calm) {
      camera.position.copy(f.pos);
      c.target.copy(f.target);
    } else {
      easing.damp3(camera.position, f.pos, 0.6, dt);
      easing.damp3(c.target, f.target, 0.6, dt);
    }
    if (camera.position.distanceTo(f.pos) < 0.01 && c.target.distanceTo(f.target) < 0.01) flight.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      enablePan={false}
      rotateSpeed={0.55}
      zoomSpeed={0.8}
      minDistance={pose.min}
      maxDistance={pose.max}
      maxPolarAngle={pose.maxPolar}
    />
  );
}

/** Tap (not drag) → nearest tappable thing on screen, with a thumb-sized margin. */
function Picker({ mode, picks, onPick }: { mode: Mode; picks: PickRegistry; onPick: (sel: Selection, at: Vector3 | null) => void }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  });

  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Set<number>();
    let start: { x: number; y: number; t: number } | null = null;
    let multi = false;
    const a = new Vector3();
    const b = new Vector3();
    const toScreen = (v: Vector3, rect: DOMRect) => {
      v.project(camera);
      return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height, behind: v.z > 1 };
    };
    const down = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) multi = true;
      if (pointers.size === 1) {
        multi = false;
        start = { x: e.clientX, y: e.clientY, t: performance.now() };
      }
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      const s = start;
      if (pointers.size > 0 || !s) return;
      start = null;
      if (multi || Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10 || performance.now() - s.t > 600) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const focal = rect.height / 2 / Math.tan(((camera as { fov?: number }).fov ?? 50) * (Math.PI / 360));
      let best: { sel: Selection; d: number; at: Vector3 } | null = null;
      for (const p of picks.current[mode]) {
        p.obj.updateWorldMatrix(true, false);
        a.copy(p.a).applyMatrix4(p.obj.matrixWorld);
        const world = a.clone();
        const depth = a.distanceTo(camera.position);
        const sa = toScreen(a, rect);
        if (sa.behind) continue;
        let d: number;
        if (p.b) {
          b.copy(p.b).applyMatrix4(p.obj.matrixWorld);
          const sb = toScreen(b, rect);
          d = distToSegment(px, py, sa.x, sa.y, sb.x, sb.y);
        } else {
          d = Math.hypot(px - sa.x, py - sa.y);
        }
        const reach = Math.max(26, (p.radius / depth) * focal * 1.2);
        if (d <= reach && (!best || d < best.d)) best = { sel: p.sel, d, at: world };
      }
      onPickRef.current(best?.sel ?? null, best?.at ?? null);
    };
    const cancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      start = null;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, [gl, camera, mode, picks]);
  return null;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
