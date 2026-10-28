import type { ReactNode } from 'react';
import { C } from './engine';
import {
  Drawing,
  IDENTITY,
  euler,
  mapply,
  mmul,
  rotX,
  rotY,
  rotZ,
  toWorld,
  towardViewer,
  vadd,
  vdot,
  vlen,
  vlerp,
  vscale,
  vsub,
  type Frame,
  type M3,
  type V3,
} from './rig3d';

// ---------------------------------------------------------------------------
// Seated 3D body with an articulated cervical spine.
//
// World: origin = centre of the seat surface, +x = character's LEFT, +y = up,
// +z = character's forward. Floor at y = FLOOR_Y. Everything is drawn into a
// shared `Drawing` (painter's algorithm); the head is drawn separately by the
// caller at the returned `head` frame.
// ---------------------------------------------------------------------------

export interface NeckSeg {
  pitch?: number;
  yaw?: number;
  roll?: number;
}

export interface SpineSeg {
  pitch?: number;
  yaw?: number;
  roll?: number;
}

export interface LegPose {
  /** Hip flexion in degrees (+ lifts the knee toward the chest). */
  hip?: number;
  /** Extra knee flexion in degrees beyond the seated 90° (+ draws the heel back / under). */
  knee?: number;
  /** Hip abduction in degrees (+ knee out to the side). */
  abduct?: number;
  /** Rotation about the thigh's own axis in degrees (+ = external: the knee turns out, the foot swings in). */
  rotate?: number;
  /** Ankle in degrees: pitch + = dorsiflexion (toes up), roll + = inversion (sole turns in). */
  ankle?: { pitch?: number; roll?: number };
}

/**
 * A wrist target. `in` picks the space of `at` / `pole` / `fingers` / `palm`:
 *  - 'world' (default),
 *  - 'body': torso-local REST coordinates (same numbers as the neutral world pose), skinned onto the
 *    spine, so e.g. a hand on the lower back follows every bend,
 *  - 'head': head-local (the frame passed to drawHead),
 *  - 'shinLeft' / 'shinRight': REST world coordinates of that leg, carried by its hip/knee motion.
 */
export interface HandTarget {
  at: V3;
  in?: 'world' | 'body' | 'head' | 'shinLeft' | 'shinRight';
  /** Direction the elbow bends toward. */
  pole?: V3;
  /** Finger direction (default: continuing the forearm). */
  fingers?: V3;
  /** Palm normal, out of the palm (default: facing down). */
  palm?: V3;
}

export interface BodyPose {
  /**
   * Cervical chain, each relative to its parent: [lower C7–C5, mid C4–C3, upper C2–C1/head].
   * Angles are measured about the torso's upright axes (the resting cervical curve is kept
   * underneath), so the head orientation is exactly torso · seg0 · seg1 · seg2.
   * All zeros = natural neutral posture with the head upright and looking straight ahead.
   */
  neck?: readonly [NeckSeg, NeckSeg, NeckSeg];
  /** 0..1 inhale amount: chest expands slightly, sternum/shoulders rise ~0.6–1px, clavicles lift. */
  breath?: number;
  /** Shoulder girdle elevation per side in px (+ up / − depressed). */
  shoulderLift?: { left?: number; right?: number };
  /** Shoulder girdle protraction per side in px (+ forward / rounded, − retracted / blades squeezed). */
  shoulderShift?: { left?: number; right?: number };
  /** Where the hands go: 'thighs' (default, planted on the lap) or 'sides' (arms hang relaxed and follow the girdle). */
  arms?: 'thighs' | 'sides';
  /** Only with arms 'sides': passive arm swing per side in degrees (+ forward), for follow-through/lag. */
  armSwing?: { left?: number; right?: number };
  /** Thoracic extension in degrees (+ = upper back extends, chest lifts and opens). */
  thorax?: number;
  /** 'sit' (default): seated on the chair/seat. 'stand': upright, hips and knees extended, feet on the floor. */
  stance?: 'sit' | 'stand';
  /** Small whole-upper-body idle motion in degrees (applied at the pelvis/lumbar). */
  torso?: { lean?: number; sway?: number; twist?: number };
  /**
   * Spine segments, each relative to its parent: [lumbar L5–L1, lower thoracic T12–T7, upper thoracic T6–T1].
   * pitch + = flexion (rounding forward), yaw + = turn to the character's LEFT, roll + = side-bend to the RIGHT.
   * Use `spineFrom()` for a natural distribution. The idle `torso` motion is applied under the lumbar segment.
   */
  spine?: readonly [SpineSeg, SpineSeg, SpineSeg];
  /** Pelvic tilt in degrees about the hip axis (+ = anterior / top of the pelvis forward, − = posterior / tucked). */
  pelvis?: number;
  /** Leg articulation per side (defaults: seated, thigh horizontal, knee at 90°). */
  legs?: { left?: LegPose; right?: LegPose };
  /** Wrist targets per side; the arm reaches them by IK (overrides `arms` for that side). */
  hands?: { left?: HandTarget; right?: HandTarget };
  /** Target-muscle highlight on the neck, 0..1 per region (character's left/right side, back of the neck). */
  highlight?: {
    left?: number;
    right?: number;
    back?: number;
    /** Upper trapezius, both sides (neck → top of the shoulder). */
    traps?: number;
    /** Between the shoulder blades (rhomboids / mid trapezius), on the back. */
    blades?: number;
    /** Upper back band across the shoulder blades (back view). */
    upperBack?: number;
    /** Lower back band across the lumbar spine. */
    lowerBack?: number;
    /** Strip along the spine (paraspinal muscles), neck to sacrum. */
    spine?: number;
  };
}

export interface BodyRig {
  /** Head–neck pivot (atlanto-occipital joint); rot = head orientation. */
  head: Frame;
  /** Cervical segment frames (origin = segment base, local +y along the segment). */
  neck: readonly [Frame, Frame, Frame];
  /** Upper-body frame (origin at the lumbar pivot, identity when the torso is neutral). */
  torso: Frame;
  /** Base of the neck at the back (C7 spinous process). */
  c7: V3;
  /** Suprasternal notch (front of the collar). */
  sternum: V3;
  /** Acromion (top of shoulder) per side. */
  shoulders: { left: V3; right: V3 };
  elbows: { left: V3; right: V3 };
  wrists: { left: V3; right: V3 };
  /** Palm centre per side (on the thigh with arms 'thighs', beside the hip with 'sides'). */
  hands: { left: V3; right: V3 };
  /** Middle of each shoulder blade's medial border, on the skin of the back (follows lift/shift/thorax). */
  blades: { left: V3; right: V3 };
  /** Pelvis frame (origin on the hip axis). */
  pelvis: Frame;
  /** Spine segment frames [lumbar, lower thoracic, upper thoracic] (origin = segment's lower joint). */
  spine: readonly [Frame, Frame, Frame];
  knees: { left: V3; right: V3 };
  ankles: { left: V3; right: V3 };
}

export const FLOOR_Y = -46;
/**
 * Standing: the pelvis / hip axis is this much higher than seated (straight legs, feet flat on the
 * floor), so standing torso-local ('body') points are the seated ones + [0, STAND_RISE, 0] in world.
 */
export const STAND_RISE = 40;

// Local tones (flat; no gradient ids).
const T = {
  skin: C.skin,
  skinShade: C.skinShade,
  skinLight: C.skinLight,
  patch: C.patch,
  patchGlow: C.patchGlow,
  pants: C.pants,
  pantsShade: C.pantsShade,
  shoe: '#3A3A3D',
  shoeShade: C.shoe,
  chair: C.chair,
  chairShade: C.chairShade,
  chrome: '#B4C0CF',
  wheel: '#475569',
};

/** World-fixed key light: from the character's right (viewer's left in front view), above, in front. */
const LIGHT: V3 = (() => {
  const l: V3 = [-0.45, 0.62, 0.64];
  return vscale(l, 1 / vlen(l));
})();

// ---------------------------------------------------------------------------
// Small geometry helpers
// ---------------------------------------------------------------------------

type Pt = readonly [number, number];
const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const norm = (v: V3): V3 => {
  const l = vlen(v) || 1;
  return vscale(v, 1 / l);
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const transpose = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
/** Rotation whose columns are the given (orthonormal) axes. */
const basis = (x: V3, y: V3, z: V3): M3 => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];

function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

const lerpN = (a: number, b: number, u: number) => a + (b - a) * u;

/** Parameter t where the ray p + t·n crosses the line through segment a–b (within the segment), or null. */
function rayHit(p: Pt, n: Pt, a: Pt, b: Pt): number | null {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const det = -n[0] * ey + n[1] * ex;
  if (Math.abs(det) < 1e-9) return null;
  const rx = a[0] - p[0];
  const ry = a[1] - p[1];
  const u = (n[0] * ry - n[1] * rx) / det;
  if (u < -1e-6 || u > 1 + 1e-6) return null;
  return (-rx * ey + ry * ex) / det;
}

/** Smooth Catmull-Rom curve through screen points (closed loop when `closed`). */
function smoothPath(pts: readonly Pt[], closed = false): string {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  let out = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    out +=
      `C${r2(p1[0] + (p2[0] - p0[0]) / 6)} ${r2(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${r2(p2[0] - (p3[0] - p1[0]) / 6)} ${r2(p2[1] - (p3[1] - p1[1]) / 6)} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return closed ? out + 'Z' : out;
}

const closedPath = (pts: readonly Pt[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${r2(q[0])} ${r2(q[1])}`).join('') + 'Z';

/** A convex solid primitive: ellipsoid (frame + radii) or sphere (centre + radius). */
type Solid = { f: Frame; r: V3 } | { c: V3; s: number };

/**
 * Screen outline points of a solid. With k < 1 the solid is first shrunk by a homothety centred on
 * its light-facing surface point — the result lies inside the original, leaving a shade crescent on
 * the side away from the light.
 */
function solidPts(d: Drawing, sol: Solid, k = 1, n = 36): Pt[] {
  const out: Pt[] = [];
  if ('c' in sol) {
    const c = d.p(vadd(sol.c, vscale(LIGHT, sol.s * (1 - k))));
    const rr = sol.s * k * d.cam.scale;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push([c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr]);
    }
    return out;
  }
  let f = sol.f;
  let r = sol.r;
  if (k < 1) {
    const l = mapply(transpose(f.rot), LIGHT);
    const den = Math.hypot(r[0] * l[0], r[1] * l[1], r[2] * l[2]) || 1;
    const p: V3 = [(r[0] * r[0] * l[0]) / den, (r[1] * r[1] * l[1]) / den, (r[2] * r[2] * l[2]) / den];
    f = { origin: toWorld(f, vscale(p, 1 - k)), rot: f.rot };
    r = vscale(r, k);
  }
  const e = d.ellipse(f, r);
  const ca = Math.cos((e.angle * Math.PI) / 180);
  const sa = Math.sin((e.angle * Math.PI) / 180);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * e.rx;
    const y = Math.sin(a) * e.ry;
    out.push([e.cx + x * ca - y * sa, e.cy + x * sa + y * ca]);
  }
  return out;
}

/** Shaded convex blob: hull of solids in `shade`, hull of the light-shrunk solids in `lit`. */
function blobNode(d: Drawing, solids: readonly Solid[], lit: string, shade: string, k = 0.88): ReactNode {
  const base = hull(solids.flatMap((s) => solidPts(d, s)));
  const top = hull(solids.flatMap((s) => solidPts(d, s, k)));
  return (
    <>
      <path d={closedPath(base)} fill={shade} />
      <path d={closedPath(top)} fill={lit} />
    </>
  );
}

const sph = (c: V3, s: number): Solid => ({ c, s });

/** Two-bone IK in 3D: elbow/knee position from root to target, bending toward `pole`. */
function ik3(root: V3, target: V3, l1: number, l2: number, pole: V3): { joint: V3; end: V3 } {
  const dv = vsub(target, root);
  const dist = clamp(vlen(dv), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const dir = norm(dv);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pp = norm(vsub(pole, vscale(dir, vdot(pole, dir))));
  return { joint: vadd(vadd(root, vscale(dir, a)), vscale(pp, h)), end: vadd(root, vscale(dir, dist)) };
}

// ---------------------------------------------------------------------------
// Proportions (rest pose, world coordinates)
// ---------------------------------------------------------------------------

const LUMBAR: V3 = [0, 12, -2];
/** Thoracic extension pivots the rib cage about the thoracolumbar junction (torso-local). */
const THORAX_PIVOT: V3 = [0, 30, -4];
const HIP = 8.5;
/** Pelvic tilt pivot (hip axis) and the spine joints above LUMBAR (thoracolumbar T12/L1, mid-thoracic T6/T7). */
const PELVIS_PIVOT: V3 = [0, 7.5, -1];
const SPINE_PIVOTS: readonly V3[] = [LUMBAR, [0, 28, -6], [0, 44, -6]];
/** Height ranges (rest y) over which the skin blends from one spine segment to the next. */
const SPINE_BLEND = [
  [8, 16],
  [24, 32],
  [40, 48],
] as const;
/** Neck: resting forward inclination at C7 then lordosis; cumulative rest pitch per segment. */
const NECK_LEN = [5.6, 5.1, 5.1] as const;
const NECK_REST_CUM = [18, 10, 0] as const;
const NECK_R = [6, 5.9, 5.7, 5.6] as const; // radius at base, joint 1, joint 2, pivot
const UPPER_ARM = 26;
const FOREARM = 24;

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

/** `chair: false` drops the office chair (bust framings, matching the area covers). */
export function drawBody(d: Drawing, pose: BodyPose = {}, opts: { chair?: boolean } = {}): BodyRig {
  const s = d.cam.scale;
  const view = towardViewer(d.cam);
  const vx = Math.abs(view[0]);
  const breath = clamp(pose.breath ?? 0, 0, 1);
  const lift = { left: pose.shoulderLift?.left ?? 0, right: pose.shoulderLift?.right ?? 0 };
  const liftOf = (side: number) => (side > 0 ? lift.left : lift.right);
  const shiftOf = (side: number) => (side > 0 ? pose.shoulderShift?.left ?? 0 : pose.shoulderShift?.right ?? 0);
  const swingOf = (side: number) => (side > 0 ? pose.armSwing?.left ?? 0 : pose.armSwing?.right ?? 0);
  const standing = pose.stance === 'stand';
  const rise = standing ? STAND_RISE : 0;
  // Standing there is no lap to rest the hands on: 'thighs' falls back to hanging at the sides.
  const sides = pose.arms === 'sides' || standing;
  const thorax = clamp(pose.thorax ?? 0, -12, 15);
  const tor = pose.torso ?? {};

  // Spine chain: pelvis (tilts about the hip axis) → lumbar (also carries the idle `torso` motion) →
  // lower thoracic → upper thoracic. Torso-local rest points are skinned onto the chain by height so
  // the trunk bends smoothly; with spine/pelvis neutral this is exactly the rigid upper body.
  const spineSegs = pose.spine ?? [{}, {}, {}];
  const segR = (i: number) => {
    const g = spineSegs[i] ?? {};
    return euler(g.yaw ?? 0, g.pitch ?? 0, g.roll ?? 0);
  };
  const pelvisF: Frame = { origin: vadd(PELVIS_PIVOT, [0, rise, 0]), rot: rotX(pose.pelvis ?? 0) };
  const chain: { pivot: V3; f: Frame }[] = [{ pivot: PELVIS_PIVOT, f: pelvisF }];
  const segRots = [mmul(euler(tor.twist ?? 0, tor.lean ?? 0, tor.sway ?? 0), segR(0)), segR(1), segR(2)];
  SPINE_PIVOTS.forEach((pv, i) => {
    const prev = chain[i];
    chain.push({ pivot: pv, f: { origin: toWorld(prev.f, vsub(pv, prev.pivot)), rot: mmul(prev.f.rot, segRots[i]) } });
  });
  const onSeg = (v: V3, i: number): V3 => toWorld(chain[i].f, vsub(v, chain[i].pivot));
  const tp = (v: V3): V3 => {
    let p = onSeg(v, 0);
    for (let i = 1; i < 4; i++) {
      const [a, z] = SPINE_BLEND[i - 1];
      const u = clamp((v[1] - a) / (z - a), 0, 1);
      if (u > 0) p = vlerp(p, onSeg(v, i), u * u * (3 - 2 * u));
    }
    return p;
  };
  const segOfY = (y: number) => (y < SPINE_PIVOTS[0][1] ? 0 : y < SPINE_PIVOTS[1][1] ? 1 : y < SPINE_PIVOTS[2][1] ? 2 : 3);
  const tf = (v: V3, rot: M3 = IDENTITY): Frame => ({ origin: tp(v), rot: mmul(chain[segOfY(v[1])].f.rot, rot) });
  /** Upper-body frame: origin at the lumbar joint, orientation of the upper thoracic segment (rib cage, shoulders, neck base). */
  const torso: Frame = { origin: chain[1].f.origin, rot: chain[3].f.rot };
  // Rib cage: thoracic extension tips it back about the thoracolumbar junction and lengthens the
  // spine a little (the kyphosis straightens), so the sternum rises and the chest opens.
  const thRot = rotX(-thorax);
  const thUp = (v: V3): V3 =>
    thorax ? vadd(vadd(THORAX_PIVOT, mapply(thRot, vsub(v, THORAX_PIVOT))), [0, 0.1 * Math.max(0, thorax), 0]) : v;
  const tpU = (v: V3): V3 => tp(thUp(v));
  const tfU = (v: V3, rot: M3 = IDENTITY): Frame => ({ origin: tpU(v), rot: mmul(torso.rot, mmul(thRot, rot)) });
  const depthOf = (v: V3) => d.p(v).depth;

  // ---- neck chain --------------------------------------------------------
  // The neck base rides on the rib cage, but its orientation stays the torso's: thoracic extension
  // moves the head back/up without tipping the gaze (the lower cervical spine compensates).
  const neckBase = tpU([0, 61.6 + 0.5 * breath, -2.2]);
  const segs = pose.neck ?? [{}, {}, {}];
  const frames: Frame[] = [];
  let acc: M3 = IDENTITY;
  let o = neckBase;
  for (let i = 0; i < 3; i++) {
    const g = segs[i] ?? {};
    acc = mmul(acc, euler(g.yaw ?? 0, g.pitch ?? 0, g.roll ?? 0));
    const f: Frame = { origin: o, rot: mmul(torso.rot, mmul(acc, rotX(NECK_REST_CUM[i]))) };
    frames.push(f);
    o = toWorld(f, [0, NECK_LEN[i], 0]);
  }
  const head: Frame = { origin: o, rot: mmul(torso.rot, acc) };
  const neck = frames as unknown as readonly [Frame, Frame, Frame];
  const headDepth = depthOf(head.origin) + 0.5;

  // ---- torso parts -------------------------------------------------------
  const b = breath;
  const thOpen = Math.max(0, thorax);
  const chest = tfU([0, 42 + 0.5 * b, -0.9]);
  const chestR: V3 = [15.2 + 0.35 * b, 15 + 0.15 * b, 12.4 + 0.55 * b + 0.05 * thOpen];
  // Shrugging drags the neckline/upper chest skin up a little with the shoulders (per side).
  const upL = Math.max(0, lift.left);
  const upR = Math.max(0, lift.right);
  const ringLift = (th: number) => 0.3 * (upL * (1 + Math.sin(th)) + upR * (1 - Math.sin(th))) / 2;
  const ringY = (th: number) => 63.6 + 0.6 * b + ringLift(th) - 4.0 * ((1 + Math.cos(th)) / 2) ** 1.3;
  const ring = (th: number): V3 => tpU([7.4 * Math.sin(th), ringY(th), -2.2 + 5.9 * Math.cos(th)]);
  /**
   * Shoulder-girdle offset (torso-local) of the acromion / arm root. The scapula glides around the
   * curved rib cage: protraction carries the shoulder forward and a little inward (rounded), retraction
   * back and a little outward (chest opens); elevation swings the clavicle up, drawing the tip in slightly.
   */
  const girdle = (side: number): V3 => {
    const L = liftOf(side);
    const S = shiftOf(side);
    const Lp = Math.max(0, L);
    return [-side * (0.26 * S + 0.014 * Lp * Lp), L, (S > 0 ? 0.9 : 0.72) * S];
  };
  const onGirdle = (side: number, v: V3): V3 => tpU(vadd(v, girdle(side)));
  // Upper trapezius: rides with the girdle, and bunches (steeper, thicker, more medial) in a shrug.
  const trap = (side: number) => {
    const L = liftOf(side);
    const S = shiftOf(side);
    const Lp = Math.max(0, L);
    return tfU(
      [side * (10.8 - 0.12 * S - 0.18 * Lp), 57.8 + 0.6 * L + 0.42 * Lp + 0.7 * b, -3.2 + 0.45 * S],
      rotZ(-side * (20 + 1.1 * Lp)),
    );
  };
  const trapR = (side: number): V3 => [6.6, 4 + 0.13 * Math.max(0, liftOf(side)), 5.4];
  const acromion = (side: number): V3 => onGirdle(side, [side * 18.2, 59.6 + 0.8 * b, -1]);
  const capC = (side: number): V3 => onGirdle(side, [side * 18.2, 54.6 + 0.8 * b, -1.5]);
  const shoulderJ = (side: number): V3 => onGirdle(side, [side * 17.6, 53.2 + 0.8 * b, -1.6]);

  const torsoSolids: Solid[] = [
    { f: tf([0, 13, -2.6]), r: [14.2, 6.5, 10.4] },
    { f: tf([0, 25, -1.2]), r: [13.4, 10.5, 10.6] },
    { f: chest, r: chestR },
    { f: tfU([0, 60.4 + 0.6 * b + 0.15 * (upL + upR), -2.4]), r: [9, 3.8, 6.4] },
    { f: trap(1), r: trapR(1) },
    { f: trap(-1), r: trapR(-1) },
    sph(capC(1), 5.2),
    sph(capC(-1), 5.2),
  ];
  for (let i = 0; i < 12; i++) torsoSolids.push(sph(ring((i / 12) * Math.PI * 2), 0.01));

  // Standing: buttocks / hip block (rides the pelvis), part of the trunk silhouette.
  const gluteF: Frame = { origin: onSeg([0, 6, -4.6], 0), rot: pelvisF.rot };
  const gluteR: V3 = [15, 8.6, 11];
  if (standing) torsoSolids.push({ f: gluteF, r: gluteR });

  const chestDepth = depthOf(chest.origin);
  const hullDepth = Math.min(chestDepth, headDepth - 0.45);

  if (!standing) {
    // Seat / buttocks (behind the trunk and thighs); tilts with the pelvis.
    const seatF: Frame = { origin: onSeg([0, 7.5, -3], 0), rot: pelvisF.rot };
    const seat: Solid[] = [{ f: seatF, r: [15.5, 7.5, 12.5] }];
    d.add(Math.min(depthOf(seatF.origin), hullDepth - 0.5), blobNode(d, seat, T.skin, T.skinShade), 0);
  }

  // ---- back silhouette ------------------------------------------------------
  // The trunk is one convex hull of its solids, which bridges straight over an arched (lordotic) lower
  // back. A loft runs from the bottom solid (lower trunk; buttocks when standing) to the rib cage: its
  // cross-sections are interpolated in REST space and skinned onto the spine chain, so with a neutral
  // spine it is the straight ruled surface the hull already shows, while extension bows it inward
  // (hollow) and flexion outward (round). Per level, the cross-section's extreme point toward the
  // screen-space posterior side is the true back outline: flexed, those points join the hull; extended,
  // the region beyond them is masked out of the trunk (and its surface details).
  const SHADE_IN = 2.4; // shade crescent width along the back (world px)
  const ty = -2;
  const loftY0 = standing ? 6 : 13;
  const loftY1 = 42 + 0.5 * b + ty;
  // The skinned chain alone bows the long loft only slightly, so the lumbar curve is also shaped
  // directly: a hollow (px, rest space, on the back half only) peaking around L3, from the lumbar /
  // lower-thoracic extension relative to the pelvis (flexion rounds it out, more gently), plus a
  // little natural lordosis when standing. Surface details on the back follow it (`hollowAt`).
  const lord = -((spineSegs[0]?.pitch ?? 0) + 0.6 * (spineSegs[1]?.pitch ?? 0));
  const hollow = clamp((standing ? 1.1 : 0) + (lord > 0 ? 0.2 : 0.1) * lord, -4, 5);
  const hollowAt = (y: number) => {
    const u = (y - loftY0) / (loftY1 - loftY0);
    return u <= 0 || u >= 1 ? 0 : hollow * Math.sin(Math.PI * u ** 0.75);
  };
  const back = (() => {
    const bot = standing
      ? { f: gluteF, r: gluteR, y: loftY0, z: -4.6 }
      : { f: tf([0, 13, -2.6]), r: [14.2, 6.5, 10.4] as V3, y: loftY0, z: -2.6 };
    const kq = Math.sqrt(1 - (ty / chestR[1]) ** 2);
    const top = { f: chest, rx: chestR[0] * kq, rz: chestR[2] * kq, y: loftY1, z: -0.9 };
    const skin = (v: V3): V3 => {
      const w = sstep(26, 36, v[1]);
      return w <= 0 ? tp(v) : w >= 1 ? tpU(v) : vlerp(tp(v), tpU(v), w);
    };
    const NT = 48;
    const NU = 12;
    const ths = Array.from({ length: NT }, (_, j) => (j / NT) * Math.PI * 2);
    const R0 = ths.map((th): V3 => [bot.r[0] * Math.cos(th), bot.y, bot.z + bot.r[2] * Math.sin(th)]);
    const R1 = ths.map((th): V3 => [top.rx * Math.cos(th), top.y, top.z + top.rz * Math.sin(th)]);
    const W0 = ths.map((th) => toWorld(bot.f, [bot.r[0] * Math.cos(th), 0, bot.r[2] * Math.sin(th)]));
    const W1 = ths.map((th) => toWorld(top.f, [top.rx * Math.cos(th), ty, top.rz * Math.sin(th)]));
    const E0 = W0.map((w, j) => vsub(w, skin(R0[j])));
    const E1 = W1.map((w, j) => vsub(w, skin(R1[j])));
    const at = (u: number, j: number): V3 => {
      const r = vlerp(R0[j], R1[j], u);
      const hz = hollowAt(r[1]) * Math.max(0, -Math.sin(ths[j]));
      return vadd(skin([r[0], r[1], r[2] + hz]), vlerp(E0[j], E1[j], u));
    };
    const P2 = (v: V3): Pt => {
      const q = d.p(v);
      return [q.x, q.y];
    };
    const FRONT = NT / 4; // sin = 1 → +z
    const BACK = (3 * NT) / 4;
    const levels: { ring2: Pt[]; ax: Pt; perp: number }[] = [];
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      const ring3 = ths.map((_, j) => at(u, j));
      const ring2 = ring3.map(P2);
      // Level axes on screen: up along the loft, posterior = back point − front point.
      const du = 0.03;
      const ctr = (uu: number) => P2(vlerp(at(clamp(uu, 0, 1), FRONT), at(clamp(uu, 0, 1), BACK), 0.5));
      const c0 = ctr(u - du);
      const c1 = ctr(u + du);
      let ux = c1[0] - c0[0];
      let uy = c1[1] - c0[1];
      const ul = Math.hypot(ux, uy) || 1;
      ux /= ul;
      uy /= ul;
      const post = norm(vsub(ring3[BACK], ring3[FRONT]));
      const pp = P2(vadd(ring3[0], post));
      const pq = ring2[0];
      const px = pp[0] - pq[0];
      const py = pp[1] - pq[1];
      levels.push({ ring2, ax: [ux, uy], perp: (px * -uy + py * ux) / s });
    }
    // Screen normal to the loft axis on the posterior side (one side for the whole back, so the outline
    // can't flip between levels); weight by how sideways the back is seen there.
    const sg = levels.reduce((acc, l) => acc + l.perp, 0) >= 0 ? 1 : -1;
    const sil: Pt[] = [];
    const nrm: Pt[] = [];
    const wts: number[] = [];
    for (const { ring2, ax, perp } of levels) {
      const n: Pt = [-ax[1] * sg, ax[0] * sg];
      wts.push(sstep(0.12, 0.35, perp * sg));
      let best = -Infinity;
      let bp: Pt = ring2[0];
      for (const q of ring2) {
        const v = q[0] * n[0] + q[1] * n[1];
        if (v > best) {
          best = v;
          bp = q;
        }
      }
      sil.push(bp);
      nrm.push(n);
    }
    // The loft's bow: how far each level's outline point sits inside (+, hollow) or outside (−, round)
    // the chord between the end levels, measured along that level's screen normal.
    const A = sil[0];
    const B = sil[NU];
    const bow = sil.map((p, i) => {
      const t = rayHit(p, nrm[i], A, B);
      return t === null ? 0 : t * wts[i];
    });
    return { sil, nrm, bow, on: Math.max(...wts) > 0.01 && bow.some((v) => Math.abs(v) > 0.05) };
  })();

  // The new back outline: the hull's own edge at each level (so whatever the hull legitimately bridges —
  // e.g. waist to shoulder from behind — stays), moved in by the bow. Bulges join the hull; hollows are
  // cut from it with a carve region a hair outside the outline (eased further out toward both ends so
  // the cut never nicks the solids it meets), fanned out to a far point.
  const solidHull = hull(torsoSolids.flatMap((sol) => solidPts(d, sol)));
  const edge: Pt[] = [];
  const carve: Pt[] = [];
  const litPts: Pt[] = [];
  if (back.on)
    back.sil.forEach((p, i) => {
      const n = back.nrm[i];
      let tmax = 0;
      let hit = false;
      for (let k = 0; k < solidHull.length; k++) {
        const t = rayHit(p, n, solidHull[k], solidHull[(k + 1) % solidHull.length]);
        if (t !== null && (!hit || t > tmax)) {
          tmax = t;
          hit = true;
        }
      }
      const at = (k: number): Pt => [p[0] + n[0] * k, p[1] + n[1] * k];
      const e = tmax - back.bow[i];
      const u = i / (back.sil.length - 1);
      edge.push(at(e));
      litPts.push(at(e - SHADE_IN * s));
      carve.push(at(e + (0.4 + 2.6 * (1 - Math.sin(Math.PI * u)) ** 2) * s));
    });
  const midN = back.nrm[Math.round((back.nrm.length - 1) / 2)];
  const midC = carve[Math.round((carve.length - 1) / 2)];
  const torsoBase = back.on ? hull([...solidHull, ...edge]) : solidHull;
  const torsoLit = hull([...torsoSolids.flatMap((sol) => solidPts(d, sol, 0.85)), ...litPts]);
  const carveOn = back.on && back.bow.some((v) => v > 0.05);
  const carveD = carveOn ? closedPath([...carve, [midC[0] + midN[0] * 34 * s, midC[1] + midN[1] * 34 * s]]) : '';
  /** Mask for anything drawn on the trunk: its outline minus the carved hollow of the back. */
  const trunkMask = d.uid('trk');
  const carveMask = d.uid('crv');
  d.add(
    hullDepth,
    <>
      <defs>
        <mask id={trunkMask} maskUnits="userSpaceOnUse" x={-1e4} y={-1e4} width={2e4} height={2e4}>
          <path d={closedPath(torsoBase)} fill="#fff" />
          {carveD && <path d={carveD} fill="#000" />}
        </mask>
        {carveD && (
          <mask id={carveMask} maskUnits="userSpaceOnUse" x={-1e4} y={-1e4} width={2e4} height={2e4}>
            <rect x={-1e4} y={-1e4} width={2e4} height={2e4} fill="#fff" />
            <path d={carveD} fill="#000" />
          </mask>
        )}
      </defs>
      <g mask={carveD ? `url(#${carveMask})` : undefined}>
        <path d={closedPath(torsoBase)} fill={T.skinShade} />
        <path d={closedPath(torsoLit)} fill={T.skin} />
        {carveD && (
          // Shade crescent along the hollow (the lit layer would otherwise run right up to the cut).
          <path
            d={smoothPath(carve)}
            fill="none"
            stroke={T.skinShade}
            strokeWidth={r2(2 * (SHADE_IN + 0.4) * s)}
            strokeLinecap="round"
            strokeLinejoin="round"
            mask={`url(#${trunkMask})`}
          />
        )}
      </g>
    </>,
  );

  // ---- back of the rib cage: spine groove and shoulder blades ---------------
  /** A point on the skin of the back at torso-local (x, y) (before thoracic extension). */
  const backPt = (x: number, y: number, out = 0.2): V3 => {
    const q = 1 - (x / 16.2) ** 2 - ((y - 43) / 17.5) ** 2;
    return tpU([x, y, -0.9 - 12.4 * Math.sqrt(Math.max(0.22, q)) - out + hollowAt(y)]);
  };
  const bladeOf = (side: number) => {
    const L = liftOf(side);
    const S = shiftOf(side);
    const Lp = Math.max(0, L);
    const dy = 0.9 * L;
    // Medial border ~6.5 px off the spine at rest; retraction draws it in, protraction wraps it out.
    const mx = clamp(6.4 + 0.62 * S, 2.4, 11);
    const g = girdle(side);
    const pts = {
      sup: [mx + 0.9, 56.8 + dy] as Pt,
      spineRoot: [mx + 0.2, 54 + dy] as Pt,
      mid: [mx, 49.5 + dy] as Pt,
      inf: [mx + 2 + 0.3 * S + 0.25 * Lp, 41.6 + dy] as Pt,
      lat: [mx + 6.2 + 0.35 * S + 0.2 * Lp, 46.4 + dy] as Pt,
      glen: [14.6 - g[0] * side * 0.3, 52.2 + dy] as Pt,
      acr: [16.6 - g[0] * side * 0.3, 57.4 + dy] as Pt,
    };
    return { mx, dy, pts };
  };
  {
    const backN = mapply(torso.rot, mapply(thRot, [0, 0, -1]));
    const facing = vdot(backN, view);
    const smooth = (a: number, z: number, v: number) => {
      const u = clamp((v - a) / (z - a), 0, 1);
      return u * u * (3 - 2 * u);
    };
    const alpha = smooth(0.08, 0.5, facing);
    if (alpha > 0.01) {
      const P2 = (x: number, y: number, side = 1): Pt => {
        const q = d.p(backPt(side * x, y));
        return [q.x, q.y];
      };
      const sAvg = (shiftOf(1) + shiftOf(-1)) / 2;
      const squeeze = clamp(-sAvg / 5, 0, 1);
      const spread = clamp(sAvg / 5, 0, 1);
      const lAvg = (liftOf(1) + liftOf(-1)) / 2;
      const nodes: ReactNode[] = [];
      let k = 0;
      const stroke = (pts: Pt[], color: string, w: number, op: number) => {
        if (op < 0.01) return;
        nodes.push(
          <path key={k++} d={smoothPath(pts)} fill="none" stroke={color} strokeWidth={r2(w * s)} strokeLinecap="round" strokeLinejoin="round" opacity={r2(op)} />,
        );
      };
      const fill = (pts: Pt[], color: string, op: number) => {
        if (op < 0.01) return;
        nodes.push(<path key={k++} d={smoothPath(pts, true)} fill={color} opacity={r2(op)} />);
      };

      // Spine groove (between the paraspinal columns): deeper when the blades are squeezed together,
      // smoothed out when they are spread.
      const groove: Pt[] = [];
      for (let y = 58.5 + 0.3 * Math.max(0, lAvg); y >= 17; y -= 4.5) groove.push(P2(0, y));
      const gOp = alpha * (0.26 + 0.2 * squeeze - 0.1 * spread);
      stroke(groove, T.skinShade, 2.6 + 1.6 * squeeze, gOp * 0.4);
      stroke(groove, T.skinShade, 0.9 + 0.3 * squeeze, gOp);

      for (const side of [1, -1]) {
        const { mx, pts } = bladeOf(side);
        // Fade the far blade as it rolls past the silhouette.
        const sideN = mapply(torso.rot, mapply(thRot, norm([side * 0.75, 0, -0.66])));
        const op = alpha * smooth(-0.35, 0.15, vdot(sideN, view));
        if (op < 0.01) continue;
        const p = (q: Pt) => P2(q[0], q[1], side);
        const { sup, spineRoot, mid, inf, lat, glen, acr } = pts;
        // Blade plate catching a little light, then a soft shadow crescent along its medial border
        // and round the inferior angle (the groove between blade and the paraspinal muscles).
        fill([sup, acr, glen, lat, inf, mid].map(p), '#FFFFFF', op * 0.1);
        const border: Pt[] = [sup, spineRoot, mid, inf, [inf[0] + 2.2, inf[1] + 1.4]];
        const inner = border.map((q, i): Pt => {
          const w = [0.2, 1.1, 1.5 + 0.5 * squeeze, 1.3, 0.2][i];
          return i === 3 ? [q[0] - 0.4 * w, q[1] - w] : [q[0] - w, q[1]];
        });
        fill([...border, ...inner.reverse()].map(p), T.skinShade, op * (0.42 + 0.2 * squeeze));
        stroke(border.map(p), T.skinShade, 2.2, op * 0.12);
        // Spine of the scapula: faint shadow just under the ridge.
        stroke(
          [spineRoot, [lerpN(spineRoot[0], acr[0], 0.5), spineRoot[1] + 1.8] as Pt, [acr[0] - 1.2, acr[1] - 1.4] as Pt].map(p),
          T.skinShade,
          1.1,
          op * 0.14,
        );
        // Squeeze: the rhomboids bunch into a soft vertical fold between blade and spine.
        if (squeeze > 0.02) {
          const fx = Math.max(1.4, mx - 1.5);
          const fy = 0.9 * liftOf(side);
          const fold: Pt[] = [
            [fx, 55.5 + fy],
            [fx - 0.3, 50.5 + fy],
            [fx + 0.1, 45.5 + fy],
          ];
          stroke(fold.map(p), T.skinShade, 1.8, op * 0.16 * squeeze);
        }
      }

      d.add(hullDepth, <g mask={`url(#${trunkMask})`}>{nodes}</g>);
    }
  }

  // ---- target-muscle patches on the trunk -----------------------------------
  // Upper trapezius (along the shoulder slopes), and on the back: between the blades, the upper back,
  // the lumbar erectors and the paraspinal strip. Each is one smooth outline on the skin, clipped to
  // the torso silhouette; see patchArt for the intensity → coverage mapping.
  {
    const hl = pose.highlight ?? {};
    const amt = (v: number | undefined) => clamp(v ?? 0, 0, 1);
    const nodes: ReactNode[] = [];
    const P2 = (v: V3): Pt => {
      const q = d.p(v);
      return [q.x, q.y];
    };

    const traps = amt(hl.traps);
    if (traps > 0.02) {
      // A band along the top of each shoulder slope, from the side of the neck to the acromion;
      // the torso clip trims it to the shoulder contour like the patches on the area covers.
      const e = patchExtent(traps);
      for (const side of [1, -1]) {
        const tr = trap(side);
        const reach = 0.35 + 0.65 * e;
        const line = (k: number) =>
          smoothPath(
            [
              toWorld(tr, [-side * 4.4 * (0.6 + 0.4 * e), 3.0, -1.6]),
              toWorld(tr, [-side * 0.8, 3.6, -1.8]),
              toWorld(tr, [side * 2.8 * reach * k, 3.2, -1.8]),
              toWorld(tr, [side * 5.6 * reach * k, 2.2, -1.8]),
            ].map(P2),
          );
        nodes.push(
          patchArt(d, `tr${side}`, { d: line(1), width: (3.4 + 3.4 * e) * s }, { d: line(0.8), width: (1.2 + 1.2 * e) * s }, patchOpacity(traps), 0.9 * s),
        );
      }
    }

    // Skin of the back at torso-local rest (x, y): lumbar skin rides the spine chain, the rib cage
    // also carries the thoracic extension (blended across the thoracolumbar junction).
    const skinAt = (x: number, y: number): V3 => {
      const v: V3 = [x, y, backZ(x, y) - 0.3 + hollowAt(y) * sstep(15, 6, Math.abs(x))];
      const w = sstep(26, 36, y);
      return w <= 0 ? tp(v) : w >= 1 ? tpU(v) : vlerp(tp(v), tpU(v), w);
    };
    const facingAt = (x: number, y: number) => {
      const e = 0.5;
      const n = cross(vsub(skinAt(x, y + e), skinAt(x, y - e)), vsub(skinAt(x + e, y), skinAt(x - e, y)));
      return vdot(norm(n), view);
    };
    /**
     * A back patch from a closed control loop in rest (x, y). Intensity (times how squarely the patch
     * faces the viewer) scales it about `c`; outline points past the silhouette are pulled back toward
     * the centre along their row so the shape never folds over the edge of the back.
     */
    const backPatch = (key: string, loop: readonly Pt[], c: Pt, amount: number, aniso: Pt = [1, 1], fade: Pt = [-0.12, 0.3]) => {
      if (amount < 0.02) return;
      const vis = sstep(fade[0], fade[1], facingAt(c[0], c[1]));
      const a = amount * vis;
      const op = patchOpacity(a);
      if (op < 0.01) return;
      const e = patchExtent(a);
      const gx = 1 - aniso[0] * (1 - e);
      const gy = 1 - aniso[1] * (1 - e);
      const outline = (kx: number, ky: number, dy = 0) =>
        crLoop(loop).map(([x, y]): Pt => {
          let px = c[0] + (x - c[0]) * kx;
          const py = c[1] + dy + (y - c[1]) * ky;
          if (facingAt(px, py) < 0.03) {
            let lo = c[0];
            let hi = px;
            for (let i = 0; i < 8; i++) {
              const m = (lo + hi) / 2;
              if (facingAt(m, py) >= 0.03) lo = m;
              else hi = m;
            }
            px = lo;
          }
          return P2(skinAt(px, py));
        });
      const ys = loop.map((q) => q[1]);
      const h = Math.max(...ys) - Math.min(...ys);
      nodes.push(
        patchArt(
          d,
          key,
          { d: smoothPath(outline(gx, gy), true) },
          { d: smoothPath(outline(gx * 0.5, gy * 0.42, 0.16 * h * gy), true) },
          op,
          1.1 * s,
        ),
      );
    };
    const mirror = (loop: readonly Pt[], side: number): Pt[] => loop.map(([x, y]) => [side * x, y]);

    // Between the blades (rhomboids / mid trapezius): per side, from just off the spine to a little past
    // the medial border of the blade, following it as the blades squeeze together or spread.
    const blades = amt(hl.blades);
    if (blades > 0.02)
      for (const side of [1, -1]) {
        const { dy, pts } = bladeOf(side);
        const { sup, spineRoot, mid, inf } = pts;
        const x0 = 1.15;
        // Rhomboid-like: higher on the spine (T2–T5) than on the blade, so the fibres slant down and out.
        const loop: Pt[] = [
          [x0, 58.4 + dy],
          [(x0 + sup[0]) / 2 + 0.6, 58.6 + dy],
          [sup[0] + 2.0, 56.6 + dy],
          [spineRoot[0] + 2.5, 53 + dy],
          [mid[0] + 2.6, 48.5 + dy],
          [inf[0] + 1.4, 43.4 + dy],
          [inf[0] - 0.4, 41.6 + dy],
          [(x0 + inf[0]) / 2, 43.6 + dy],
          [x0 + 0.05, 47.2 + dy],
          [x0 - 0.1, 53 + dy],
        ];
        backPatch(`bl${side}`, mirror(loop, side), [(side * (x0 + mid[0] + 2.6)) / 2, 50.5 + dy], blades);
      }

    // Upper back: a soft band across the upper thoracic region, over both blades.
    const lAvg = 0.9 * ((liftOf(1) + liftOf(-1)) / 2);
    const upper: Pt[] = [
      [0, 57.6],
      [6.5, 57.2],
      [11.6, 55.4],
      [13.6, 50.8],
      [12.4, 45.2],
      [7.6, 42],
      [0, 41.4],
      [-7.6, 42],
      [-12.4, 45.2],
      [-13.6, 50.8],
      [-11.6, 55.4],
      [-6.5, 57.2],
    ].map(([x, y]): Pt => [x, y + lAvg * sstep(44, 57, y)]);
    backPatch('ub', upper, [0, 49.5], amt(hl.upperBack));

    // Lower back: one soft band across the lumbar region (both erector columns), sized so it still reads
    // around hands resting on the lower back and as a band — not slivers — from profile-ish cameras.
    const lower: Pt[] = [
      [0, 31],
      [5.6, 30.7],
      [10.4, 29],
      [12.4, 23.6],
      [12, 16.8],
      [10, 11.8],
      [5.2, 9.9],
      [0, 9.5],
      [-5.2, 9.9],
      [-10, 11.8],
      [-12, 16.8],
      [-12.4, 23.6],
      [-10.4, 29],
      [-5.6, 30.7],
    ];
    // Fades out (rather than collapsing into a sliver) as the back turns edge-on.
    backPatch('lb', lower, [0, 20.5], amt(hl.lowerBack), [0.35, 0.55], [0.04, 0.2]);

    // Spine: a soft strip along the groove, sacrum to the base of the neck.
    const spineLoop: Pt[] = [
      [0, 58.4],
      [2, 56.8],
      [3, 48],
      [3.2, 36],
      [3, 24],
      [2.3, 15.6],
      [0, 13.4],
      [-2.3, 15.6],
      [-3, 24],
      [-3.2, 36],
      [-3, 48],
      [-2, 56.8],
    ];
    backPatch('sp', spineLoop, [0, 36], amt(hl.spine), [0.4, 1]);

    if (nodes.some(Boolean)) d.add(hullDepth, <g mask={`url(#${trunkMask})`}>{nodes}</g>);
  }

  // ---- neck (skin) -------------------------------------------------------
  drawNeck(d, neck, head, {
    depth: headDepth - 0.3,
    filletDepth: hullDepth - 0.05,
    trapTop: (side) => toWorld(trap(side), [-side * 1.2, 3.9, -0.4]),
    filletRise: (side) => 0.3 * Math.max(0, liftOf(side)),
    ringSide: (side) => ring((side * Math.PI) / 2),
    highlight: pose.highlight ?? {},
  });

  // Base of the throat, drawn over the neck base so it blends into the chest, with a faint sternal notch.
  {
    // The half of the neckline facing the viewer, plus a band below it.
    const vl = mapply(transpose(torso.rot), view);
    const thV = Math.atan2(vl[0], vl[2]);
    const ths: number[] = [];
    for (let i = 0; i <= 16; i++) ths.push(thV + ((-100 + (200 * i) / 16) * Math.PI) / 180);
    const arc = ths.map(ring);
    const lower = [...ths].reverse().map((th) => tpU([7.6 * Math.sin(th), ringY(th) - 4.2, -2.2 + 5.6 * Math.cos(th)]));
    const pa = arc.map((v) => d.p(v));
    const pl = lower.map((v) => d.p(v));
    const panel = [...pa, ...pl].map((q, i) => `${i ? 'L' : 'M'}${r2(q.x)} ${r2(q.y)}`).join('') + 'Z';
    const trim = pa.slice(2, -2).map((q, i) => `${i ? 'L' : 'M'}${r2(q.x)} ${r2(q.y)}`).join('');
    d.add(
      headDepth - 0.2,
      <>
        <path d={panel} fill={T.skin} />
        <path d={trim} fill="none" stroke={T.skinShade} strokeWidth={r2(0.6 * s)} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} />
      </>,
    );
  }

  // ---- legs: hip flexion/abduction and knee flexion (bare, like the rest of the mannequin) ----
  const legs = (side: number) => {
    const L = legChain(side, side > 0 ? pose.legs?.left : pose.legs?.right, standing ? 'stand' : 'sit');
    const { hip, knee, ankle } = L;
    const thighMid = L.map([side * 9.4, 7.6, 18]);
    // Standing with the thigh hanging (not lifted toward the chest), its top tucks under the hip block
    // of the trunk silhouette from every side instead of showing its round end on the hip.
    const lp = side > 0 ? pose.legs?.left : pose.legs?.right;
    const thighD = depthOf(vlerp(hip, knee, 0.5));
    d.add(standing && (lp?.hip ?? 0) < 35 ? Math.min(thighD, hullDepth - 0.02) : thighD, blobNode(d, [sph(hip, 8.6), sph(thighMid, 7.4), sph(knee, 5.9)], T.skin, T.skinShade));
    const calf = L.map([side * 10.2, -7.3, 38.8]);
    d.add(depthOf(vlerp(knee, ankle, 0.5)), blobNode(d, [sph(knee, 5.7), sph(calf, 5.1), sph(ankle, 3.3)], T.skin, T.skinShade));
    const foot: Frame = { origin: L.footPt([side * 10.9, -43.6, 46.4]), rot: mmul(L.ankleRot, rotY(-side * 5)) };
    d.add(
      depthOf(foot.origin),
      blobNode(d, [{ f: foot, r: [4.2, 2.4, 8.2] }, sph(L.footPt([side * 10.7, -42.9, 40]), 3.1)], T.skin, T.skinShade, 0.85),
    );
    return L;
  };
  const legL = legs(1);
  const legR = legs(-1);

  /** Resolve a hand target into world space (see HandTarget). */
  const handAt = (side: number) => {
    const h = side > 0 ? pose.hands?.left : pose.hands?.right;
    if (!h) return null;
    const sp = h.in ?? 'world';
    const leg = sp === 'shinLeft' ? legL : sp === 'shinRight' ? legR : null;
    const at = sp === 'body' ? tp(h.at) : sp === 'head' ? toWorld(head, h.at) : leg ? leg.map(h.at) : h.at;
    const R = sp === 'body' ? chain[segOfY(h.at[1])].f.rot : sp === 'head' ? head.rot : leg ? leg.shin.rot : IDENTITY;
    return {
      at,
      pole: mapply(R, h.pole ?? [side * 0.55, -0.25, -1]),
      fingers: h.fingers && mapply(R, h.fingers),
      palm: h.palm && mapply(R, h.palm),
    };
  };

  // ---- arms (hands planted on the thighs, or hanging at the sides) ----------
  const chairOn = opts.chair !== false && !standing;
  const arm = (side: number) => {
    const sj = shoulderJ(side);
    let elbow: V3;
    let wrist: V3;
    const ht = handAt(side);
    if (ht) {
      ({ joint: elbow, end: wrist } = ik3(sj, ht.at, UPPER_ARM, FOREARM, ht.pole));
    } else if (sides) {
      // Hanging under gravity (world down, independent of torso lean): upper arm slightly abducted
      // and flexed, a relaxed ~13° elbow bend, the forearm angled out by the carrying angle so the
      // hand clears the seat. `armSwing` swings the whole arm about the shoulder; the forearm lags
      // a little (bends more on the forward swing, straightens on the back swing).
      const sw = clamp(swingOf(side), -40, 40);
      const hang = (flex: number, abd: number): V3 => {
        const a = (abd * Math.PI) / 180;
        return mapply(rotX(-flex), [side * Math.sin(a), -Math.cos(a), 0]);
      };
      const bend = 13 + 0.22 * sw;
      elbow = vadd(sj, vscale(hang(3 + sw, 5), UPPER_ARM));
      wrist = vadd(elbow, vscale(hang(3 + sw + bend, 9.5), FOREARM));
    } else {
      const wristTarget: V3 = [side * 11.6, 16.6, 23.5];
      const pole: V3 = [side * 0.55, -0.25, -1];
      ({ joint: elbow, end: wrist } = ik3(sj, wristTarget, UPPER_ARM, FOREARM, pole));
    }
    // Arms sit just in front of the torso hull from front/¾ views; from behind they go behind it.
    const biasArm = 1.5 * (1 - vx) * (view[2] >= 0 ? 1 : -1.5);

    // Upper arm: deltoid tapering to the elbow.
    // The deltoid caps the torso outline from any view except when the arm is on the far side.
    // Only when the elbow is actually on the viewer's side of the trunk: an arm reaching across the
    // front (e.g. to the opposite knee) seen from behind must stay behind the back.
    const upperDepth = depthOf(sj) + biasArm;
    const nearSide = vdot([side, 0, 0], view) > -0.3 && vdot(vsub(elbow, chest.origin), view) > -2;
    d.add(
      nearSide ? Math.max(upperDepth, hullDepth + 0.02) : upperDepth,
      blobNode(d, [sph(sj, 5.1), sph(vlerp(sj, elbow, 0.3), 4.6), sph(vlerp(sj, elbow, 0.6), 3.9), sph(elbow, 3.5)], T.skin, T.skinShade),
    );

    // A hanging hand on the far side of the body is hidden by the seat cushion (drawn behind
    // everything else): put the forearm and hand just under the cushion in the paint order.
    const farHang = sides && chairOn && vdot([side, 0, 0], view) < -0.25;
    const lowDepth = chairOn ? seatDepth(d) - 0.01 : 0;

    // Forearm.
    d.add(
      farHang ? lowDepth : depthOf(vlerp(elbow, wrist, 0.5)) + biasArm,
      blobNode(d, [sph(elbow, 3.45), sph(vlerp(elbow, wrist, 0.3), 3.4), sph(wrist, 2.6)], T.skin, T.skinShade),
    );

    let hf: Frame;
    let tip: V3;
    let thumbA: V3;
    let thumbB: V3;
    if (ht) {
      // Hand at a target: fingers continue the forearm unless given; palm as given (default down).
      const fwd = norm(ht.fingers ?? vsub(wrist, elbow));
      const back = vscale(ht.palm ?? [0, -1, 0], -1);
      let up = vsub(back, vscale(fwd, vdot(back, fwd)));
      if (vlen(up) < 1e-3) up = cross(fwd, [1, 0, 0]);
      up = norm(up);
      const lat = cross(up, fwd);
      hf = { origin: vadd(wrist, vscale(fwd, 4.4)), rot: basis(lat, up, fwd) };
      tip = vadd(vadd(wrist, vscale(fwd, 9.4)), vscale(up, -1.3));
      const thumb = vscale(norm(cross(vscale(up, -1), fwd)), side);
      thumbA = vadd(vadd(wrist, vscale(fwd, 2.2)), vscale(thumb, 2.6));
      thumbB = vadd(vadd(vadd(wrist, vscale(fwd, 6)), vscale(thumb, 3.3)), vscale(up, -0.6));
    } else if (sides) {
      // Hand: palm facing the thigh, fingers down and loosely curled inward, thumb forward.
      const sw = clamp(swingOf(side), -40, 40);
      const a = (9.5 * Math.PI) / 180;
      const dn = norm(mapply(rotX(-(3 + sw + 13 + 0.22 * sw + 8)), [side * Math.sin(a), -Math.cos(a), 0]));
      const medial0: V3 = [-side, 0, 0];
      const medial = norm(vsub(medial0, vscale(dn, vdot(medial0, dn))));
      const front = cross(dn, medial);
      const fr = front[2] < 0 ? vscale(front, -1) : front;
      hf = { origin: vadd(wrist, vscale(dn, 4.4)), rot: basis(fr, medial, dn) };
      tip = vadd(vadd(wrist, vscale(dn, 9.6)), vscale(medial, 0.9));
      thumbA = vadd(vadd(wrist, vscale(dn, 2.0)), vadd(vscale(fr, 2.5), vscale(medial, 0.4)));
      thumbB = vadd(vadd(wrist, vscale(dn, 5.6)), vadd(vscale(fr, 3.0), vscale(medial, 1.1)));
    } else {
      // Hand: palm down, fingers forward along the thigh.
      const fwd = norm([-side * 0.22, -0.12, 1]);
      const lat = norm(cross([0, 1, 0], fwd));
      const up = cross(fwd, lat);
      hf = { origin: vadd(vadd(wrist, vscale(fwd, 4.6)), vscale(up, -0.4)), rot: basis(lat, up, fwd) };
      tip = vadd(vadd(wrist, vscale(fwd, 10.2)), vscale(up, -1.5));
      const med = vscale(lat, -side * Math.sign(lat[0] || 1));
      thumbA = vadd(vadd(wrist, vscale(fwd, 2.2)), vscale(med, 2.6));
      thumbB = vadd(vadd(vadd(wrist, vscale(fwd, 6.2)), vscale(med, 3.4)), vscale(up, -0.6));
    }
    d.add(
      farHang ? lowDepth : sides ? depthOf(hf.origin) + biasArm + 0.5 : depthOf(wrist) + 3,
      <>
        {blobNode(d, [sph(thumbA, 1.5), sph(thumbB, 1.25)], T.skin, T.skinShade)}
        {blobNode(d, [{ f: hf, r: [3.6, 1.7, 4.6] }, { f: { origin: tip, rot: hf.rot }, r: [3.1, 1.5, 2.2] }], T.skin, T.skinShade, 0.86)}
      </>,
    );
    return { elbow, wrist, hand: hf.origin };
  };
  const armL = arm(1);
  const armR = arm(-1);

  if (chairOn) drawChair(d);

  // Soft floor shadow.
  {
    const e = d.ellipse({ origin: [0, FLOOR_Y, standing ? 3 : 14], rot: IDENTITY }, standing ? [22, 0.01, 16] : [30, 0.01, 34]);
    d.add(
      -1e4,
      <ellipse
        cx={r2(e.cx)}
        cy={r2(e.cy)}
        rx={r2(Math.max(e.rx, 1))}
        ry={r2(Math.max(e.ry, 3 * s))}
        transform={`rotate(${r2(e.angle)} ${r2(e.cx)} ${r2(e.cy)})`}
        fill="currentColor"
        opacity={0.08}
      />,
    );
  }

  return {
    head,
    neck,
    torso,
    c7: toWorld(neck[0], [0, 1.5, -6]),
    sternum: ring(0),
    shoulders: { left: acromion(1), right: acromion(-1) },
    elbows: { left: armL.elbow, right: armR.elbow },
    wrists: { left: armL.wrist, right: armR.wrist },
    hands: { left: armL.hand, right: armR.hand },
    pelvis: pelvisF,
    spine: [chain[1].f, chain[2].f, chain[3].f],
    knees: { left: legL.knee, right: legR.knee },
    ankles: { left: legL.ankle, right: legR.ankle },
    blades: {
      left: backPt(bladeOf(1).mx, 49.5 + bladeOf(1).dy, 0),
      right: backPt(-bladeOf(-1).mx, 49.5 + bladeOf(-1).dy, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// Neck: smooth swept tube through the cervical frames + trapezius fillets,
// sternocleidomastoid lines and a jaw shadow. One painter item.
// ---------------------------------------------------------------------------

function hermite(p0: V3, t0: V3, p1: V3, t1: V3, u: number): V3 {
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return [0, 1, 2].map((i) => h00 * p0[i] + h10 * t0[i] + h01 * p1[i] + h11 * t1[i]) as unknown as V3;
}

function drawNeck(
  d: Drawing,
  neck: readonly [Frame, Frame, Frame],
  head: Frame,
  opts: {
    depth: number;
    filletDepth: number;
    trapTop: (side: number) => V3;
    /** Extra height (px) the trapezius climbs up the neck side (shrug). */
    filletRise: (side: number) => number;
    ringSide: (side: number) => V3;
    highlight: NonNullable<BodyPose['highlight']>;
  },
) {
  const s = d.cam.scale;
  const view = towardViewer(d.cam);
  const dirs = neck.map((f) => mapply(f.rot, [0, 1, 0]));
  const joints: V3[] = [neck[0].origin, neck[1].origin, neck[2].origin, head.origin];

  // Spine curve samples with radii (base → a little into the head).
  const pts: { v: V3; r: number }[] = [];
  const tans: V3[] = [
    vscale(dirs[0], NECK_LEN[0]),
    vscale(norm(vadd(dirs[0], dirs[1])), (NECK_LEN[0] + NECK_LEN[1]) / 2),
    vscale(norm(vadd(dirs[1], dirs[2])), (NECK_LEN[1] + NECK_LEN[2]) / 2),
    vscale(dirs[2], NECK_LEN[2]),
  ];
  const STEPS = 5;
  for (let i = 0; i < 3; i++) {
    for (let j = i === 0 ? 0 : 1; j <= STEPS; j++) {
      const u = j / STEPS;
      pts.push({ v: hermite(joints[i], tans[i], joints[i + 1], tans[i + 1], u), r: NECK_R[i] + (NECK_R[i + 1] - NECK_R[i]) * u });
    }
  }
  const headUp = mapply(head.rot, [0, 1, 0]);
  pts.push({ v: vadd(head.origin, vscale(headUp, 2.5)), r: NECK_R[3] });

  // Screen-space light shift, perpendicular to the lower neck's projected axis.
  const K = 0.8;
  const pb = d.p(joints[0]);
  const p1 = d.p(joints[1]);
  let ax = p1.x - pb.x;
  let ay = p1.y - pb.y;
  const al = Math.hypot(ax, ay) || 1;
  ax /= al;
  ay /= al;
  const lp = d.p(vadd(joints[0], LIGHT));
  let lx = lp.x - pb.x;
  let ly = lp.y - pb.y;
  const along = lx * ax + ly * ay;
  lx -= along * ax;
  ly -= along * ay;
  const shiftFor = (r: number): Pt => [lx * (1 - K) * r, ly * (1 - K) * r];

  const P = pts.map((q) => ({ ...d.p(q.v), r: q.r }));
  const nodes: ReactNode[] = [];

  // Trapezius fillets: flare from the mid-neck side down to the shoulder slope. Drawn just behind the
  // shirt so only the part above the shoulder line shows, from any view.
  const fillets: ReactNode[] = [];
  for (const side of [1, -1]) {
    const A = toWorld(neck[1], [side * NECK_R[1] * 0.92, 1.4 + opts.filletRise(side), -0.9]);
    const D = toWorld(neck[0], [side * NECK_R[0] * 0.6, 0.8, -0.8]);
    const B = opts.trapTop(side);
    const R = opts.ringSide(side);
    const ctrl = vlerp(vlerp(A, B, 0.5), vlerp(D, R, 0.5), 0.6);
    const [a, bb, c, rr, dd] = [A, B, ctrl, R, D].map((v) => d.p(v));
    const facing = vdot(mapply(neck[0].rot, norm([side, 0.4, 0])), LIGHT) > 0;
    fillets.push(
      <path
        key={`f${side}`}
        d={`M${r2(a.x)} ${r2(a.y)}Q${r2(c.x)} ${r2(c.y)} ${r2(bb.x)} ${r2(bb.y)}L${r2(rr.x)} ${r2(rr.y)}L${r2(dd.x)} ${r2(dd.y)}Z`}
        fill={facing ? T.skin : SKIN_MID}
      />,
    );
  }

  // Tube: butt-ended quad for the lowest segment (so nothing pokes below the collar), then
  // round-capped strokes. Base in shade, lit copy narrower and shifted toward the light.
  const tube = (lit: boolean, colorOverride?: string) => {
    const out: ReactNode[] = [];
    const sh = (r: number): Pt => (lit ? shiftFor(r) : [0, 0]);
    const kk = lit ? K : 1;
    const color = colorOverride ?? (lit ? T.skin : T.skinShade);
    const i1 = STEPS; // index of joint 1
    // Lowest segment: exact silhouette of a cylinder cut flat at the base (a disk perpendicular to
    // the C7 segment), so the neck meets the neckline from every view without poking below it.
    const q0 = P[0];
    const q1 = P[i1];
    const [s0x, s0y] = sh(q0.r * s);
    const [s1x, s1y] = sh(q1.r * s);
    const sec: Pt[] = [];
    for (let j = 0; j < 24; j++) {
      const a = (j / 24) * Math.PI * 2;
      const q = d.p(toWorld(neck[0], [Math.cos(a) * NECK_R[0], 0, Math.sin(a) * NECK_R[0]]));
      sec.push([q0.x + (q.x - q0.x) * kk + s0x, q0.y + (q.y - q0.y) * kk + s0y]);
      const rr = q1.r * s * kk;
      sec.push([q1.x + s1x + Math.cos(a) * rr, q1.y + s1y + Math.sin(a) * rr]);
    }
    out.push(<path key={`q${lit}`} d={closedPath(hull(sec))} fill={color} />);
    let dd = '';
    for (let i = i1; i < P.length - 1; i++) {
      const a = P[i];
      const c = P[i + 1];
      const [sx, sy] = sh(((a.r + c.r) / 2) * s);
      dd = `M${r2(a.x + sx)} ${r2(a.y + sy)}L${r2(c.x + sx)} ${r2(c.y + sy)}`;
      out.push(
        <path key={`s${lit}${i}`} d={dd} stroke={color} strokeWidth={r2(((a.r + c.r) / 2) * 2 * s * kk)} strokeLinecap="round" fill="none" />,
      );
    }
    return out;
  };
  nodes.push(...tube(false), ...tube(true));

  // Surface details (SCM lines, jaw shadow) are masked to the neck silhouette so they never spill
  // past the throat/nape outline onto the background or the face beside the jaw.
  const maskId = d.uid('nk3');
  const detail: ReactNode[] = [];

  // Sternocleidomastoid: mastoid (behind the ear) → over the neck side → sternum.
  for (const side of [1, -1]) {
    const mast = toWorld(head, [side * 6.0, 0.9, -2.4]);
    const mid = toWorld(neck[1], [side * 4.1, 2.2, 3.1]);
    const low = toWorld(neck[0], [side * 1.8, 0.8, 5.0]);
    const n = norm(mapply(neck[1].rot, [side * 0.75, 0, 0.66]));
    const facing = vdot(n, view);
    // A stretched SCM (contralateral to a turn or tilt) stands out more.
    const len = vlen(vsub(mast, mid)) + vlen(vsub(mid, low));
    const stretch = clamp((len - SCM_REST) / 3, -1, 1.5);
    const op = (0.3 + 0.2 * stretch) * clamp(facing * 1.6, 0, 1);
    if (op < 0.03) continue;
    const [a, m, c] = [mast, mid, low].map((v) => d.p(v));
    const cx = 2 * m.x - (a.x + c.x) / 2;
    const cy = 2 * m.y - (a.y + c.y) / 2;
    const w = clamp(1.0 + 0.15 * stretch, 0.7, 1.3) * s;
    detail.push(
      <path
        key={`scm${side}`}
        d={`M${r2(a.x)} ${r2(a.y)}Q${r2(cx)} ${r2(cy)} ${r2(c.x)} ${r2(c.y)}`}
        stroke={T.skinShade}
        strokeWidth={r2(w)}
        strokeLinecap="round"
        fill="none"
        opacity={r2(op)}
      />,
    );
  }

  // Jaw shadow: a darker band at the top of the tube, offset toward the chin.
  {
    const fwd = mapply(head.rot, [0, 0, 1]);
    const hp = d.p(head.origin);
    const fp = d.p(vadd(head.origin, fwd));
    const fx = fp.x - hp.x;
    const fy = fp.y - hp.y;
    // Two overlapping bands (wide + faint, narrow + nearer the jaw) give a soft falloff instead of a
    // hard edge parallel to the mandible, which read as a second jawline in profile.
    const start = STEPS * 2 + 2;
    const band = (ks: number) => {
      let dd = '';
      for (let i = start; i < P.length; i++) {
        const sh = (1 - ks) * P[i].r * s;
        dd += `${i === start ? 'M' : 'L'}${r2(P[i].x + fx * sh)} ${r2(P[i].y + fy * sh)}`;
      }
      return dd;
    };
    for (const [ks, op] of [
      [0.78, 0.45],
      [0.5, 0.55],
    ] as const)
      detail.push(
        <path
          key={`jaw${ks}`}
          d={band(ks)}
          stroke={T.skinShade}
          strokeWidth={r2(NECK_R[3] * 2 * s * ks)}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={op}
        />,
      );
  }

  // Target-muscle patch: a cyan band along one side (or the back) of the neck, like the area covers.
  // Offset from the spine so the mask trims it to that side's outline. Intensity (and turning the side
  // away) shrinks the band toward the middle of the neck rather than fading it to a grey wash.
  const regions: [string, number | undefined, V3][] = [
    ['l', opts.highlight.left, [1, 0, -0.15]],
    ['r', opts.highlight.right, [-1, 0, -0.15]],
    ['b', opts.highlight.back, [0, 0, -1]],
  ];
  for (const [key, amount, local] of regions) {
    if (!amount || amount < 0.02) continue;
    const dl = norm(local);
    const facing = vdot(mapply(neck[1].rot, dl), view);
    const a = clamp(amount, 0, 1) * sstep(-0.65, -0.2, facing);
    const op = patchOpacity(a);
    if (op < 0.01) continue;
    const e = patchExtent(a);
    const band = P.slice(1, -1).map((q, i): Pt => {
      const f = neck[Math.min(2, Math.floor((i + 1) / STEPS))];
      const w = d.p(vadd(pts[i + 1].v, vscale(mapply(f.rot, dl), q.r * 0.75)));
      return [w.x, w.y];
    });
    // Grow from the middle of the neck toward both ends.
    const n = band.length - 1;
    const half = (n / 2) * (0.4 + 0.6 * e);
    const i0 = Math.max(0, Math.round(n / 2 - half));
    const i1 = Math.min(n, Math.round(n / 2 + half));
    const seg = band.slice(i0, i1 + 1);
    const ws = NECK_R[1] * s;
    detail.push(
      patchArt(
        d,
        `hl${key}`,
        { d: smoothPath(seg), width: ws * (0.85 + 0.35 * e) },
        { d: smoothPath(seg.slice(1, -1).length > 1 ? seg.slice(1, -1) : seg), width: ws * 0.4 },
        op,
        0.55 * s,
      ),
    );
  }

  nodes.push(
    <mask key="mk" id={maskId} maskUnits="userSpaceOnUse" x={-1e4} y={-1e4} width={2e4} height={2e4}>
      {tube(false, '#fff')}
    </mask>,
    <g key="dt" mask={`url(#${maskId})`}>
      {detail}
    </g>,
  );

  d.add(opts.filletDepth, <>{fillets}</>);
  d.add(opts.depth, <>{nodes}</>);
}

// ---------------------------------------------------------------------------
// Office chair (all parts behind the body).
// ---------------------------------------------------------------------------

const CHAIR_BIAS = -60;
const SKIN_MID = '#F7B27E';
/** Neutral mastoid→sternum path length (see drawNeck). */
const SCM_REST = 18.86;

function roundedRect(hw: number, hd: number, rad: number, map: (a: number, b: number) => V3, n = 5): V3[] {
  const out: V3[] = [];
  const corners: [number, number, number][] = [
    [hw - rad, hd - rad, 0],
    [-(hw - rad), hd - rad, 90],
    [-(hw - rad), -(hd - rad), 180],
    [hw - rad, -(hd - rad), 270],
  ];
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
      out.push(map(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad));
    }
  return out;
}

function seatRects() {
  return {
    top: roundedRect(21, 20, 7, (x, z) => [x, 0, z + 1]),
    bottom: roundedRect(20, 19, 6, (x, z) => [x, -6.5, z + 1]),
  };
}

/** Paint depth of the seat cushion (behind the body). */
function seatDepth(d: Drawing): number {
  const { top, bottom } = seatRects();
  const all = [...top, ...bottom];
  return all.reduce((acc, v) => acc + d.p(v).depth, 0) / all.length + CHAIR_BIAS;
}

function drawChair(d: Drawing) {
  const s = d.cam.scale;
  const view = towardViewer(d.cam);
  const proj = (pts: V3[]): Pt[] => pts.map((v) => {
    const q = d.p(v);
    return [q.x, q.y] as const;
  });
  const avgDepth = (pts: V3[]) => pts.reduce((acc, v) => acc + d.p(v).depth, 0) / pts.length;

  // Seat cushion.
  {
    const { top, bottom } = seatRects();
    d.add(
      seatDepth(d),
      <>
        <path d={closedPath(hull([...proj(top), ...proj(bottom)]))} fill={T.chairShade} />
        {view[1] > 0.01 && <path d={closedPath(proj(top))} fill={T.chair} />}
      </>,
    );
  }

  // Mechanism under the seat.
  const mech: Frame = { origin: [0, -9, 0], rot: IDENTITY };
  d.add(d.p(mech.origin).depth + CHAIR_BIAS, blobNode(d, [{ f: mech, r: [8, 2.6, 8] }], T.chairShade, T.wheel, 0.85));

  // Backrest support and backrest.
  // From behind, the (mid-back height) backrest and its upright really are between the viewer and
  // the sitter, so they sort at their true depth; otherwise everything of the chair stays behind.
  const rear = view[2] < -0.2;
  const bar = (a: V3, b: V3, inFront = false) =>
    d.add(
      (d.p(a).depth + d.p(b).depth) / 2 + (inFront ? 0 : CHAIR_BIAS),
      blobNode(d, [sph(a, 1.9), sph(b, 1.9)], T.chairShade, T.wheel, 0.85),
    );
  bar([0, -8, -8], [0, -8, -17.5]);
  bar([0, -8, -17.5], [0, 17, -18.5], rear);
  {
    const front = roundedRect(15.5, 12.5, 6, (x, y) => [x, y + 27.5, -14.2 + 2.6 * (x / 15.5) ** 2]);
    const back = front.map((v): V3 => [v[0], v[1], v[2] - 2.8]);
    const facing = view[2] > 0.02;
    d.add(
      avgDepth([...front, ...back]) + (rear ? 0 : CHAIR_BIAS),
      <>
        <path d={closedPath(hull([...proj(front), ...proj(back)]))} fill={T.chairShade} />
        {facing && <path d={closedPath(proj(front))} fill={T.chair} />}
      </>,
    );
  }

  // Gas lift.
  d.add(d.p([0, -22, 0]).depth + CHAIR_BIAS, blobNode(d, [sph([0, -11, 0], 2), sph([0, -30, 0], 2)], T.chrome, T.chairShade, 0.8));
  d.add(d.p([0, -33, 0]).depth + CHAIR_BIAS + 0.1, blobNode(d, [sph([0, -27, 0], 3), sph([0, -36, 0], 3.2)], T.chairShade, T.wheel, 0.85));

  // Five-star base with castors.
  const hub: V3 = [0, -38, 0];
  for (let i = 0; i < 5; i++) {
    const a = ((18 + 72 * i) * Math.PI) / 180;
    const dir: V3 = [Math.sin(a), 0, Math.cos(a)];
    const end = vadd(vadd(hub, vscale(dir, 23)), [0, -2.4, 0]);
    d.add(
      d.p(vlerp(hub, end, 0.6)).depth + CHAIR_BIAS,
      blobNode(d, [sph(hub, 2.6), sph(end, 1.9)], T.chairShade, T.wheel, 0.85),
    );
    const wheel = vadd(vadd(hub, vscale(dir, 24)), [0, -5.3, 0]);
    d.add(
      d.p(wheel).depth + CHAIR_BIAS + 0.05,
      <circle cx={r2(d.p(wheel).x)} cy={r2(d.p(wheel).y)} r={r2(2.7 * s)} fill={T.wheel} />,
    );
  }
  d.add(d.p(hub).depth + CHAIR_BIAS + 0.02, blobNode(d, [sph(hub, 3.4)], T.chairShade, T.wheel, 0.85));
}

// ---------------------------------------------------------------------------
// Spine / leg helpers
// ---------------------------------------------------------------------------

/**
 * Natural distribution of whole-spine motion over [lumbar, lower thoracic, upper thoracic]:
 * rotation 10/40/50 % (the lumbar spine barely rotates), flexion 45/30/25 %, extension 50/30/20 %,
 * side-bend 30/40/30 %. Degrees; signs as in `SpineSeg`.
 */
export function spineFrom(m: { flex?: number; twist?: number; side?: number }): [SpineSeg, SpineSeg, SpineSeg] {
  const f = m.flex ?? 0;
  const fs = f >= 0 ? [0.45, 0.3, 0.25] : [0.5, 0.3, 0.2];
  const ts = [0.1, 0.4, 0.5];
  const ss = [0.3, 0.4, 0.3];
  return [0, 1, 2].map((i) => ({ pitch: f * fs[i], yaw: (m.twist ?? 0) * ts[i], roll: (m.side ?? 0) * ss[i] })) as [SpineSeg, SpineSeg, SpineSeg];
}

const KNEE_REST = (side: number): V3 => [side * 10, 6.5, 40];

/**
 * Leg chain for a pose (also usable by clips to place hands on a lifted leg). `map` carries a REST
 * world point on the shin/foot with the leg; thigh points use `thigh` about the hip.
 */
export function legChain(side: number, leg: LegPose = {}, stance: 'sit' | 'stand' = 'sit') {
  const hip0: V3 = [side * HIP, 7.5, -1];
  let hip = hip0;
  let thighRot: M3;
  let shinRot: M3;
  if (stance === 'stand') {
    // Standing: the hip axis is raised by STAND_RISE; the thigh hangs straight down (the seated thigh
    // swung 90° down), the shin continues it (knee straight). `hip` / `knee` are then flexion from
    // straight (hip 90 + knee 90 = the seated leg shape), `abduct` swings the leg out sideways.
    hip = vadd(hip0, [0, STAND_RISE, 0]);
    thighRot = mmul(mmul(rotZ(side * (leg.abduct ?? 0)), rotX(90 - (leg.hip ?? 0))), rotZ(-side * (leg.rotate ?? 0)));
    shinRot = mmul(thighRot, rotX(-90 + (leg.knee ?? 0)));
  } else {
    thighRot = mmul(mmul(rotY(side * (leg.abduct ?? 0)), rotX(-(leg.hip ?? 0))), rotZ(-side * (leg.rotate ?? 0)));
    shinRot = mmul(thighRot, rotX(leg.knee ?? 0));
  }
  const k0 = KNEE_REST(side);
  const knee = vadd(hip, mapply(thighRot, vsub(k0, hip0)));
  /** Rest (seated) world point → posed: points beyond the knee (z ≥ 30 or below the seat) ride the shin, others the thigh. */
  const map = (v: V3): V3 =>
    v[1] < 2 || v[2] > 41 ? vadd(knee, mapply(shinRot, vsub(v, k0))) : vadd(hip, mapply(thighRot, vsub(v, hip0)));
  const a0: V3 = [side * 10.6, -39.5, 41.5];
  const ankle = vadd(knee, mapply(shinRot, vsub(a0, k0)));
  const ankleRot = mmul(shinRot, mmul(rotX(-(leg.ankle?.pitch ?? 0)), rotZ(-side * (leg.ankle?.roll ?? 0))));
  /** Rest world point on the foot → posed, turning about the ankle. */
  const footPt = (v: V3): V3 => vadd(ankle, mapply(ankleRot, vsub(v, a0)));
  return { hip, knee, ankle, ankleRot, footPt, thigh: { origin: hip, rot: thighRot } as Frame, shin: { origin: knee, rot: shinRot } as Frame, map };
}

// ---------------------------------------------------------------------------
// Target-muscle patches: solid cyan shapes with a soft inner sheen, like the area covers.
// Intensity shows as coverage (the shape grows from a small core), not as transparency: a faint cyan
// wash over the peach skin reads grey, so once visible a patch is always (nearly) opaque cyan.
// ---------------------------------------------------------------------------

const sstep = (a: number, z: number, v: number) => {
  const u = clamp((v - a) / (z - a), 0, 1);
  return u * u * (3 - 2 * u);
};
/** Opacity of a patch at an (effective) intensity: a quick fade-in, then solid. */
const patchOpacity = (a: number) => 0.95 * sstep(0.02, 0.14, a);
/** Extent (0..1 scale of the full shape) at an (effective) intensity. */
const patchExtent = (a: number) => 0.45 + 0.55 * (1 - (1 - clamp(a, 0, 1)) ** 2);

/** Rest-pose torso ellipsoids used to find points on the skin of the back. */
const BACK_SHELL: readonly { c: V3; r: V3 }[] = [
  { c: [0, 13, -2.6], r: [14.2, 6.5, 10.4] },
  { c: [0, 25, -1.2], r: [13.4, 10.5, 10.6] },
  { c: [0, 42, -0.9], r: [15.2, 15, 12.4] },
];

/** Torso-local rest z of the skin of the back at (x, y). */
function backZ(x: number, y: number): number {
  let z = Infinity;
  for (const { c, r } of BACK_SHELL) {
    const q = 1 - ((x - c[0]) / r[0]) ** 2 - ((y - c[1]) / r[1]) ** 2;
    if (q > 0) z = Math.min(z, c[2] - r[2] * Math.sqrt(q));
  }
  // Upper back between the shell and the shoulders (same surface as the blade details).
  const qb = 1 - (x / 16.2) ** 2 - ((y - 43) / 17.5) ** 2;
  return Math.min(z, -0.9 - 12.4 * Math.sqrt(Math.max(0.22, qb)));
}

/** Uniform Catmull-Rom resampling of a (closed) control loop: `per` points per span. */
function crLoop(pts: readonly Pt[], per = 6): Pt[] {
  const n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let j = 0; j < per; j++) {
      const t = j / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (k: 0 | 1) =>
        0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  return out;
}

/** Geometry of a patch layer: a filled outline, or a round-capped stroke of the given width. */
type PatchGeo = { d: string; width?: number };

/**
 * One patch: solid cyan body, a blurred light sheen and a soft light inner rim, both masked to the body
 * so nothing pale spills onto the skin.
 */
function patchArt(d: Drawing, key: string, base: PatchGeo, glow: PatchGeo, op: number, blur: number): ReactNode {
  if (op < 0.01 || !base.d) return null;
  const maskId = d.uid('pm');
  const blurId = d.uid('pf');
  const geo = (g: PatchGeo, color: string, extra: Record<string, string | number> = {}) =>
    g.width ? (
      <path d={g.d} fill="none" stroke={color} strokeWidth={r2(g.width)} strokeLinecap="round" strokeLinejoin="round" {...extra} />
    ) : (
      <path d={g.d} fill={color} {...extra} />
    );
  return (
    <g key={key} opacity={r2(op)}>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-1e4} y={-1e4} width={2e4} height={2e4}>
          {geo(base, '#fff')}
        </mask>
        <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={r2(blur)} />
        </filter>
      </defs>
      {geo(base, T.patch)}
      <g mask={`url(#${maskId})`}>
        {!base.width && (
          <path d={base.d} fill="none" stroke={T.patchGlow} strokeWidth={r2(blur * 1.6)} filter={`url(#${blurId})`} opacity={0.45} />
        )}
        {geo(glow, T.patchGlow, { filter: `url(#${blurId})`, opacity: 0.7 })}
      </g>
    </g>
  );
}
