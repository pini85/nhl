// GLSL for the Galaxy tab. Everything glows additively into an HDR buffer, then bloom does the rest.
// Values above 1.0 are on purpose: they are what the bloom pass picks up.

/** Soft round points that orbit the core on the GPU (inner ones faster). */
export const dustVertex = /* glsl */ `
uniform float uTime;
uniform float uIntro;
uniform float uPixelRatio;
uniform float uSize;
uniform float uMotion;
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
void main() {
  // position holds (radius, angle, height) instead of xyz.
  float aRadius = position.x;
  float aAngle = position.y;
  float aHeight = position.z;
  float intro = smoothstep(0.0, 1.0, uIntro);
  float r = aRadius * mix(0.04, 1.0, intro);
  // Arms stay put (the whole galaxy turns as one); the bulge swirls faster and every grain drifts a little.
  float spin = uMotion * (uTime * 0.16 * (1.0 - smoothstep(0.4, 1.8, aRadius)) + sin(uTime * 0.21 + aSeed * 30.0) * 0.035);
  float a = aAngle + spin + (1.0 - intro) * 4.0 / (0.5 + aRadius * 0.4);
  vec3 p = vec3(cos(a) * r, aHeight * intro, sin(a) * r);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float twinkle = 0.7 + 0.3 * sin(uTime * (0.8 + aSeed * 2.5) + aSeed * 60.0);
  gl_PointSize = max(1.0, uSize * aSize * uPixelRatio / -mv.z);
  vColor = aColor * twinkle;
  vAlpha = smoothstep(0.0, 0.25, uIntro);
}
`;

export const dustFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-d * d * 4.5) * (1.0 - smoothstep(0.8, 1.0, d));
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}
`;

/** A star per game: hot core, halo, 4 diffraction spikes, rings for "selected" and "you played". */
export const starVertex = /* glsl */ `
uniform float uTime;
uniform float uIntro;
attribute vec3 aColor;
attribute float aSize;
attribute float aSeed;
attribute float aSel;
attribute float aMine;
varying vec2 vUv;
varying vec3 vColor;
varying float vSel;
varying float vMine;
void main() {
  float intro = smoothstep(0.0, 1.0, uIntro);
  vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float r = length(c.xz);
  float a = atan(c.z, c.x) + (1.0 - intro) * 4.0 / (0.5 + r * 0.4);
  c = vec3(cos(a) * r * mix(0.04, 1.0, intro), c.y * intro, sin(a) * r * mix(0.04, 1.0, intro));
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  float pulse = 1.0 + 0.1 * sin(uTime * 2.2 + aSeed * 40.0);
  float s = aSize * pulse * (1.0 + aSel * 0.9) * smoothstep(0.2, 1.0, uIntro);
  mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv;
  vUv = uv;
  vColor = aColor;
  vSel = aSel;
  vMine = aMine;
}
`;

export const starFragment = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;
varying float vSel;
varying float vMine;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  float core = exp(-d * d * 70.0) * 5.0;
  float glow = exp(-d * 6.5) * 1.1;
  float sx = exp(-abs(p.y) * 60.0) * pow(max(0.0, 1.0 - abs(p.x)), 3.0);
  float sy = exp(-abs(p.x) * 60.0) * pow(max(0.0, 1.0 - abs(p.y)), 3.0);
  vec3 col = vColor * (glow + (sx + sy) * 1.6 + core * 0.6) + vec3(core);
  float sel = (1.0 - smoothstep(0.0, 0.045, abs(d - (0.58 + 0.05 * sin(uTime * 6.0))))) * vSel;
  float mine = (1.0 - smoothstep(0.0, 0.035, abs(d - 0.36))) * vMine;
  col += vec3(1.0) * sel * 3.0 + vec3(1.0, 0.78, 0.32) * mine * 1.6;
  float edge = 1.0 - smoothstep(0.75, 1.0, max(abs(p.x), abs(p.y)));
  gl_FragColor = vec4(col * edge, 1.0);
}
`;

/** Generic camera-facing glow quad (core light, node halos). */
export const glowVertex = /* glsl */ `
uniform float uScale;
varying vec2 vUv;
void main() {
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uScale;
  gl_Position = projectionMatrix * mv;
  vUv = uv;
}
`;

export const glowFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  float breathe = 1.0 + 0.06 * sin(uTime * 1.3);
  float g = exp(-d * 4.2 / breathe) * 0.9 + exp(-d * d * 40.0) * 2.5;
  g *= 1.0 - smoothstep(0.7, 1.0, d);
  gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
}
`;

/** Deep-space backdrop: a dark gradient with two faint nebula tints. Cheap: no noise. */
export const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const skyFragment = /* glsl */ `
uniform vec3 uTint;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = mix(vec3(0.0005, 0.001, 0.003), vec3(0.004, 0.008, 0.022), smoothstep(-0.5, 0.7, d.y));
  col += vec3(0.32, 0.06, 0.42) * pow(max(0.0, dot(d, normalize(vec3(-0.7, 0.3, -0.6)))), 5.0) * 0.22;
  col += vec3(0.02, 0.16, 0.42) * pow(max(0.0, dot(d, normalize(vec3(0.8, -0.05, -0.5)))), 4.0) * 0.28;
  col += uTint * pow(max(0.0, d.y * -1.0 + 0.2), 3.0) * 0.04;
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Plasma planets for players: dark body, fresnel rim, slow energy bands. */
export const nodeVertex = /* glsl */ `
uniform float uIntro;
attribute vec3 aColor;
attribute float aSel;
attribute float aDim;
attribute float aSeed;
varying vec3 vN;
varying vec3 vV;
varying vec3 vColor;
varying vec3 vLocal;
varying float vSel;
varying float vDim;
varying float vSeed;
void main() {
  float intro = smoothstep(0.0, 1.0, uIntro);
  vec4 wp = instanceMatrix * vec4(position, 1.0);
  wp.xyz *= intro;
  vec4 mv = modelViewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vV = normalize(-mv.xyz);
  vLocal = position;
  vColor = aColor;
  vSel = aSel;
  vDim = aDim;
  vSeed = aSeed;
}
`;

export const nodeFragment = /* glsl */ `
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
varying vec3 vColor;
varying vec3 vLocal;
varying float vSel;
varying float vDim;
varying float vSeed;
void main() {
  float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.4);
  float bands = 0.5 + 0.5 * sin(vLocal.y * 9.0 + sin(vLocal.x * 4.0 + uTime * 0.7 + vSeed * 6.0) * 1.6 + uTime * 1.2);
  float light = 0.5 + 0.5 * dot(normalize(vN), normalize(vec3(0.4, 0.8, 0.5)));
  vec3 col = vColor * (0.10 + 0.28 * light + 0.35 * bands * bands) + vColor * f * 3.2 + vec3(pow(f, 5.0)) * 0.9;
  col *= 1.0 + vSel * (1.2 + 0.4 * sin(uTime * 6.0));
  col *= mix(1.0, 0.18, vDim);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Camera-facing ribbons between players, with energy pulses running along them. Width is in screen pixels. */
export const beamVertex = /* glsl */ `
uniform float uIntro;
uniform vec2 uResolution;
uniform float uPixelRatio;
attribute vec3 aStart;
attribute vec3 aEnd;
attribute float aT;
attribute float aSide;
attribute float aWidth;
attribute vec3 aColor;
attribute float aSeed;
attribute float aDim;
varying float vT;
varying float vSide;
varying vec3 vColor;
varying float vSeed;
varying float vDim;
void main() {
  float intro = smoothstep(0.0, 1.0, uIntro);
  vec4 a = projectionMatrix * modelViewMatrix * vec4(aStart * intro, 1.0);
  vec4 b = projectionMatrix * modelViewMatrix * vec4(aEnd * intro, 1.0);
  vec2 sa = a.xy / a.w * uResolution;
  vec2 sb = b.xy / b.w * uResolution;
  vec2 dir = normalize(sb - sa + vec2(1e-5));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 p = mix(a, b, aT);
  p.xy += nrm * aSide * aWidth * uPixelRatio / uResolution * p.w;
  gl_Position = p;
  vT = aT;
  vSide = aSide;
  vColor = aColor * smoothstep(0.3, 1.0, uIntro);
  vSeed = aSeed;
  vDim = aDim;
}
`;

export const beamFragment = /* glsl */ `
uniform float uTime;
varying float vT;
varying float vSide;
varying vec3 vColor;
varying float vSeed;
varying float vDim;
void main() {
  float across = 1.0 - abs(vSide);
  float core = pow(across, 4.0) * 1.4 + pow(across, 1.4) * 0.3;
  float flow = fract(vT * 1.5 - uTime * (0.35 + vSeed * 0.3) + vSeed * 7.0);
  float pulse = pow(flow, 10.0) * 4.0;
  float ends = smoothstep(0.0, 0.08, vT) * (1.0 - smoothstep(0.92, 1.0, vT));
  vec3 col = vColor * core * (0.55 + pulse) * ends;
  col *= mix(1.0, 0.08, vDim);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Glass-and-neon bars: lit edges, a bright cap, scanlines rising up the side. */
export const barVertex = /* glsl */ `
attribute vec3 aColor;
attribute float aSel;
attribute float aDim;
varying vec3 vColor;
varying vec3 vN;
varying vec3 vV;
varying vec2 vUv;
varying float vLocalY;
varying float vWorldY;
varying float vSel;
varying float vDim;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  vUv = uv;
  vLocalY = position.y;
  vWorldY = wp.y;
  vColor = aColor;
  vSel = aSel;
  vDim = aDim;
}
`;

export const barFragment = /* glsl */ `
uniform float uTime;
varying vec3 vColor;
varying vec3 vN;
varying vec3 vV;
varying vec2 vUv;
varying float vLocalY;
varying float vWorldY;
varying float vSel;
varying float vDim;
void main() {
  vec3 n = normalize(vN);
  float top = step(0.5, n.y);
  float ex = smoothstep(0.86, 1.0, abs(vUv.x * 2.0 - 1.0));
  float ey = smoothstep(0.86, 1.0, abs(vUv.y * 2.0 - 1.0)) * top;
  float edge = max(ex, ey);
  float f = pow(1.0 - abs(dot(n, normalize(vV))), 2.0);
  float scan = pow(fract(vWorldY * 0.8 - uTime * 0.35), 18.0) * (1.0 - top);
  float grad = mix(0.15, 1.0, vLocalY);
  vec3 col = vColor * (0.10 + 0.45 * grad + f * 0.8) + vColor * edge * 2.4 + vColor * scan * 1.4 * grad;
  col += top * (vColor * 2.2 + vec3(0.5));
  col *= (1.0 + vSel * (0.8 + 0.3 * sin(uTime * 6.0))) * mix(1.0, 0.25, vDim);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** The season's timeline thread through every game star; light runs from the oldest game to the newest. */
export const threadVertex = /* glsl */ `
varying float vU;
void main() {
  vU = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const threadFragment = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
varying float vU;
void main() {
  vec3 col = mix(vec3(0.04, 0.10, 0.40), vec3(0.45, 0.85, 1.6), vU);
  float pulse = pow(fract(vU * 4.0 - uTime * 0.18), 30.0) * 4.0;
  gl_FragColor = vec4(col * (0.3 + pulse) * uAlpha, 1.0);
}
`;

/** Instanced soft halos around player planets. */
export const haloVertex = /* glsl */ `
uniform float uIntro;
attribute vec3 aColor;
attribute float aSize;
attribute float aDim;
varying vec2 vUv;
varying vec3 vColor;
varying float vDim;
void main() {
  float intro = smoothstep(0.0, 1.0, uIntro);
  vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz * intro;
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  mv.xy += position.xy * aSize * intro;
  gl_Position = projectionMatrix * mv;
  vUv = uv;
  vColor = aColor;
  vDim = aDim;
}
`;

export const haloFragment = /* glsl */ `
varying vec2 vUv;
varying vec3 vColor;
varying float vDim;
void main() {
  float d = length(vUv * 2.0 - 1.0);
  float g = exp(-d * 5.0) * (1.0 - smoothstep(0.7, 1.0, d)) * 0.55;
  gl_FragColor = vec4(vColor * g * mix(1.0, 0.15, vDim), 1.0);
}
`;
