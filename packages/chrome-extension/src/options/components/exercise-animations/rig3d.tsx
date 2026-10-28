import type { ReactNode } from 'react';
import type { P } from './engine';

// ---------------------------------------------------------------------------
// Minimal 3D rig: orthographic projection + painter's-algorithm drawing.
//
// World axes (character-relative, figure faces the viewer at camera yaw 0):
//   +x = character's LEFT (viewer's right in front view)
//   +y = up
//   +z = character's FORWARD (toward the viewer in front view)
// Units are "screen px at scale 1".
//
// Rotation conventions (degrees, applied to a local frame):
//   rotY(+)  yaw   — turns forward (+z) toward +x  => head turns to character's LEFT
//   rotX(+)  pitch — turns forward toward -y       => chin down / flexion
//   rotZ(+)  roll  — turns up (+y) toward -x       => ear toward character's RIGHT shoulder
// ---------------------------------------------------------------------------

export type V3 = readonly [number, number, number];
/** Row-major 3×3 matrix. */
export type M3 = readonly [number, number, number, number, number, number, number, number, number];

export const v3 = (x: number, y: number, z: number): V3 => [x, y, z];
export const vadd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vscale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const vlerp = (a: V3, b: V3, u: number): V3 => vadd(a, vscale(vsub(b, a), u));
export const vdot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vlen = (a: V3) => Math.hypot(a[0], a[1], a[2]);

export const IDENTITY: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mmul(a: M3, b: M3): M3 {
  const r: number[] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
  return r as unknown as M3;
}

export const mapply = (m: M3, v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

const rad = (d: number) => (d * Math.PI) / 180;

export function rotY(deg: number): M3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

export function rotX(deg: number): M3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

export function rotZ(deg: number): M3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** Head-style orientation: yaw, then pitch, then roll in the turned frame. */
export const euler = (yaw: number, pitch: number, roll: number): M3 => mmul(mmul(rotY(yaw), rotX(pitch)), rotZ(roll));

/** A rigid frame: world = origin + rot · local. */
export interface Frame {
  origin: V3;
  rot: M3;
}

export const toWorld = (f: Frame, local: V3): V3 => vadd(f.origin, mapply(f.rot, local));

/** Child frame offset/rotated in the parent's local space. */
export const child = (parent: Frame, offset: V3, rot: M3 = IDENTITY): Frame => ({
  origin: toWorld(parent, offset),
  rot: mmul(parent.rot, rot),
});

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export interface Camera {
  /** Orbit around the character: 0 = front, 90 = profile facing screen-right. */
  yaw: number;
  /** + = looking slightly down from above. */
  pitch: number;
  scale: number;
  /** Screen position of world origin. */
  origin: P;
}

export interface Projected extends P {
  /** Larger = nearer the viewer. */
  depth: number;
}

export function viewMatrix(cam: Camera): M3 {
  return mmul(rotX(cam.pitch), rotY(cam.yaw));
}

export function project(cam: Camera, v: V3, view: M3 = viewMatrix(cam)): Projected {
  const w = mapply(view, v);
  return { x: cam.origin.x + w[0] * cam.scale, y: cam.origin.y - w[1] * cam.scale, depth: w[2] };
}

/** Direction (world) the camera looks along, pointing from the scene toward the viewer. */
export function towardViewer(cam: Camera): V3 {
  // Inverse of the view rotation applied to +z.
  const m = viewMatrix(cam);
  return [m[6], m[7], m[8]];
}

// ---------------------------------------------------------------------------
// Painter's-algorithm drawing list
// ---------------------------------------------------------------------------

export interface Paint {
  fill?: string;
  stroke?: string;
  opacity?: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export class Drawing {
  readonly view: M3;
  private items: { depth: number; order: number; node: ReactNode }[] = [];
  private ids = 0;

  /** `idPrefix` should be unique per mounted scene (e.g. from React `useId`) so SVG ids never collide. */
  constructor(readonly cam: Camera, private readonly idPrefix = 'd') {
    this.view = viewMatrix(cam);
  }

  /** Deterministic SVG id, stable across frames for the same draw sequence. */
  uid(name = 'id'): string {
    return `${this.idPrefix.replace(/[^\w-]/g, '')}-${name}-${++this.ids}`;
  }

  p(v: V3): Projected {
    return project(this.cam, v, this.view);
  }

  /** Add an arbitrary pre-rendered node at a depth. `bias` nudges ties. */
  add(depth: number, node: ReactNode, bias = 0) {
    // Quantise so float jitter between frames can't flip the order of equal-depth items.
    this.items.push({ depth: Math.round((depth + bias) * 1000) / 1000, order: this.items.length, node });
  }

  /** Capsule between a and b with world radius r (exact for orthographic projection). */
  capsule(a: V3, b: V3, r: number, color: string, bias = 0, opacity?: number) {
    const pa = this.p(a);
    const pb = this.p(b);
    this.add(
      (pa.depth + pb.depth) / 2,
      <path
        d={`M${r2(pa.x)} ${r2(pa.y)}L${r2(pb.x)} ${r2(pb.y)}`}
        stroke={color}
        strokeWidth={r2(r * 2 * this.cam.scale)}
        strokeLinecap="round"
        opacity={opacity}
        fill="none"
      />,
      bias,
    );
  }

  /** Sphere of world radius r. */
  ball(c: V3, r: number, color: string, bias = 0, opacity?: number) {
    const pc = this.p(c);
    this.add(pc.depth, <circle cx={r2(pc.x)} cy={r2(pc.y)} r={r2(r * this.cam.scale)} fill={color} opacity={opacity} />, bias);
  }

  /** Screen-space outline of an ellipsoid (exact for orthographic projection). */
  ellipse(frame: Frame, radii: V3): { cx: number; cy: number; rx: number; ry: number; angle: number; depth: number } {
    const s = this.cam.scale;
    const m = mmul(this.view, frame.rot);
    // 2×3 linear map from the unit sphere to screen offsets (screen y points down).
    const a = [0, 1, 2].map((j) => m[j] * radii[j] * s);
    const b = [0, 1, 2].map((j) => -m[3 + j] * radii[j] * s);
    const p = a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
    const q = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const r = b[0] * b[0] + b[1] * b[1] + b[2] * b[2];
    const mid = (p + r) / 2;
    const disc = Math.sqrt(((p - r) / 2) ** 2 + q * q);
    const c = this.p(frame.origin);
    return {
      cx: c.x,
      cy: c.y,
      rx: Math.sqrt(mid + disc),
      ry: Math.sqrt(Math.max(0, mid - disc)),
      angle: (Math.atan2(2 * q, p - r) * 90) / Math.PI,
      depth: c.depth,
    };
  }

  /** Filled ellipsoid centred on `frame.origin`, oriented by `frame.rot`. */
  ellipsoid(frame: Frame, radii: V3, color: string, bias = 0, opacity?: number) {
    const e = this.ellipse(frame, radii);
    this.add(
      e.depth,
      <ellipse
        cx={r2(e.cx)}
        cy={r2(e.cy)}
        rx={r2(e.rx)}
        ry={r2(e.ry)}
        transform={`rotate(${r2(e.angle)} ${r2(e.cx)} ${r2(e.cy)})`}
        fill={color}
        opacity={opacity}
      />,
      bias,
    );
  }

  /** Flat polygon through world points, sorted by its average depth. */
  poly(points: readonly V3[], paint: Paint, bias = 0) {
    const ps = points.map((v) => this.p(v));
    const depth = ps.reduce((s, q) => s + q.depth, 0) / ps.length;
    this.add(
      depth,
      <path
        d={ps.map((q, i) => `${i ? 'L' : 'M'}${r2(q.x)} ${r2(q.y)}`).join('') + 'Z'}
        fill={paint.fill ?? 'none'}
        stroke={paint.stroke}
        opacity={paint.opacity}
      />,
      bias,
    );
  }

  /** Sorted nodes, back to front. */
  render(): ReactNode {
    return this.items
      .sort((a, b) => a.depth - b.depth || a.order - b.order)
      .map((it, i) => <g key={i}>{it.node}</g>);
  }
}
