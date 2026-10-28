import { useRef, useState, type ComponentType } from 'react';
import { useAnimationFrame } from 'motion/react';

// ---------------------------------------------------------------------------
// Clip contract
// ---------------------------------------------------------------------------

/** [progress 0..1, caption, hold?] — caption applies from that progress onward; holds show a countdown. */
export type Cue = readonly [at: number, text: string, hold?: boolean];

export interface Clip {
  /** Seconds for one full loop. */
  duration: number;
  /** Progress shown when the user prefers reduced motion (the key pose). */
  still: number;
  /** Captions shown under the scene. */
  cues: readonly Cue[];
  /** Renders SVG children for a `0 0 240 200` viewBox at loop progress `t`. */
  Scene: ComponentType<{ t: number }>;
}

export const VIEWBOX = '0 0 240 200';

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** [progress 0..1, value]. Repeat a value on consecutive keys to hold a pose. */
export type Key = readonly [at: number, value: number];

export type Ease = (u: number) => number;

export const easeInOut: Ease = (u) => (1 - Math.cos(Math.PI * u)) / 2;

/** Minimum-jerk profile — the velocity curve of natural, voluntary human reaching/head movement. */
export const minJerk: Ease = (u) => u * u * u * (10 - 15 * u + 6 * u * u);

/** Keyframe interpolation with easing between keys; clamps outside the range. */
export function kf(t: number, keys: readonly Key[], ease: Ease = easeInOut): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0 || 1));
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * Smooth, loop-safe low-amplitude wobble in [-1, 1] for idle life (sway, micro-adjustments).
 * `cycles` are whole numbers of periods per loop so the loop seam is invisible.
 */
export function wobble(t: number, seed = 0, cycles: readonly number[] = [1, 2, 3]): number {
  let sum = 0;
  cycles.forEach((c, i) => {
    sum += Math.sin(2 * Math.PI * c * t + seed * (i + 1) * 1.7) / (i + 1);
  });
  return sum / cycles.reduce((s, _, i) => s + 1 / (i + 1), 0);
}

/** Caption at progress `t`; during a hold cue, also the whole seconds left in that hold. */
export function cueAt(t: number, cues: readonly Cue[], duration: number): { text: string; holdLeft: number | null } {
  let i = 0;
  cues.forEach(([at], j) => {
    if (t >= at) i = j;
  });
  const [, text = '', hold] = cues[i] ?? [];
  const end = cues[i + 1]?.[0] ?? 1;
  return { text, holdLeft: hold ? Math.max(1, Math.ceil((end - t) * duration - 1e-6)) : null };
}

/** Loop progress 0..1 that advances only while `playing`; pausing freezes the pose. */
export function useLoopProgress(duration: number, playing: boolean): number {
  const [t, setT] = useState(0);
  const elapsed = useRef(0);
  useAnimationFrame((_, delta) => {
    if (!playing) return;
    const total = duration * 1000;
    elapsed.current = (elapsed.current + Math.min(delta, 100)) % total;
    setT(elapsed.current / total);
  });
  return t;
}

// ---------------------------------------------------------------------------
// Geometry — "compass" angles in degrees: 0 = up, 90 = right, 180 = down
// (positive = clockwise on screen, matching SVG rotate()).
// ---------------------------------------------------------------------------

export interface P {
  x: number;
  y: number;
}

export const pt = (x: number, y: number): P => ({ x, y });
export const add = (a: P, b: P): P => pt(a.x + b.x, a.y + b.y);
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const lerpP = (a: P, b: P, u: number): P => pt(lerp(a.x, b.x, u), lerp(a.y, b.y, u));
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Unit vector (scaled by len) pointing at compass angle `deg`. */
export const dir = (deg: number, len = 1): P => pt(Math.sin(rad(deg)) * len, -Math.cos(rad(deg)) * len);
export const along = (o: P, deg: number, len: number): P => add(o, dir(deg, len));

const f = (n: number) => Math.round(n * 100) / 100;
export const M = (p: P) => `M${f(p.x)} ${f(p.y)}`;
export const L = (p: P) => `L${f(p.x)} ${f(p.y)}`;

/** Quadratic path from a to b that passes through m. */
export function curveThrough(a: P, m: P, b: P): string {
  const c = pt(2 * m.x - (a.x + b.x) / 2, 2 * m.y - (a.y + b.y) / 2);
  return `${M(a)}Q${f(c.x)} ${f(c.y)} ${f(b.x)} ${f(b.y)}`;
}

/** Two-bone IK: elbow/knee position reaching from `root` toward `target`. bend ±1 picks the side. */
export function ik(root: P, target: P, l1: number, l2: number, bend: 1 | -1): { joint: P; end: P } {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx);
  const off = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const a = base + bend * off;
  return {
    joint: pt(root.x + Math.cos(a) * l1, root.y + Math.sin(a) * l1),
    end: pt(root.x + Math.cos(base) * d, root.y + Math.sin(base) * d),
  };
}

// ---------------------------------------------------------------------------
// Palette (flat colours — no gradient ids, so many scenes can share a page)
// ---------------------------------------------------------------------------

export const C = {
  // Mannequin skin, matching the Relief tab area covers (public/icons/areas).
  skin: '#FCC28F',
  skinShade: '#F2A26E',
  skinLight: '#FEC795',
  /** Target-muscle highlight, the cyan "patch" on the area covers. */
  patch: '#2FB9F2',
  patchGlow: '#7FE0FB',
  shirt: '#4A9FE8',
  shirtShade: '#3A7FC8',
  pants: '#5A6A79',
  pantsShade: '#47535F',
  hair: '#2D2319',
  shoe: '#2D2D2D',
  chair: '#94A3B8',
  chairShade: '#64748B',
  lip: '#C9908A',
  eye: '#2D2319',
} as const;

/** Cue colour follows the theme. Apply via `style`, not presentation attributes. */
export const CUE_COLOR = 'var(--primary)';

// ---------------------------------------------------------------------------
// Cue arrows
// ---------------------------------------------------------------------------

function head(tip: P, towardDeg: number, size = 6): string {
  const back = towardDeg + 180;
  return `${M(along(tip, back - 28, size))}${L(tip)}${L(along(tip, back + 28, size))}`;
}

const cueStyle = { stroke: CUE_COLOR, fill: 'none' } as const;

/** Straight arrow from a to b. */
export function Arrow({ a, b, opacity = 1 }: { a: P; b: P; opacity?: number }) {
  const ang = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;
  return (
    <g style={cueStyle} opacity={opacity} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={`${M(a)}${L(b)}`} />
      <path d={head(b, ang)} />
    </g>
  );
}

/** Arc arrow around `c` from compass angle `from` to `to` (to > from = clockwise). */
export function ArcArrow({ c, r, from, to, opacity = 1 }: { c: P; r: number; from: number; to: number; opacity?: number }) {
  if (Math.abs(to - from) < 1) return null;
  const a = along(c, from, r);
  const b = along(c, to, r);
  const cw = to > from;
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const tangent = to + (cw ? 90 : -90);
  return (
    <g style={cueStyle} opacity={opacity} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={`${M(a)}A${r} ${r} 0 ${large} ${cw ? 1 : 0} ${f(b.x)} ${f(b.y)}`} />
      <path d={head(b, tangent)} />
    </g>
  );
}

/** Soft floor shadow that works in light and dark themes. */
export function FloorShadow({ cx, y, rx }: { cx: number; y: number; rx: number }) {
  return <ellipse cx={cx} cy={y} rx={rx} ry={5} fill="currentColor" opacity={0.08} />;
}
