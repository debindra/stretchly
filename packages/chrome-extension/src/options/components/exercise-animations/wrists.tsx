import { useId, type ReactNode } from 'react';
import { C, CUE_COLOR, M, clamp, easeInOut, minJerk, pt, wobble, type Clip, type Ease, type P } from './engine';
import {
  Drawing,
  child,
  mapply,
  mmul,
  rotX,
  rotY,
  rotZ,
  toWorld,
  vadd,
  vdot,
  vlen,
  vlerp,
  vscale,
  vsub,
  towardViewer,
  type Camera,
  type Frame,
  type M3,
  type V3,
} from './rig3d';

// ---------------------------------------------------------------------------
// Wrist exercises on a close-up forearm-and-hand rig (the seated mannequin is
// far too small at this scale): flexor stretch, extensor stretch and wrist
// circles, drawn in the style of the Relief "wrists" cover — bare peach
// forearms and hands with separate fingers and thumb, soft two-tone shading,
// a glossy cyan band on the target area.
//
// Same approach as neck.tsx: choreography authored in SECONDS and evaluated at
// s = (t mod 1) · duration, so t = 0 and t = 1 are the same instant.
//
// Units are roughly centimetres. World axes follow rig3d (+x = character's
// LEFT, +y = up, +z = forward). Hand-local axes: +z distal (toward the
// fingertips), +y dorsal (back of the hand), thumb on +x for a right hand and
// −x for a left hand (`ts`, thumb sign). Wrist angles: flex + = palmar flexion
// (fingers toward the palm side), flex − = extension; dev + = radial deviation.
// The stretches are authored for the RIGHT arm; the left side is the same
// scene mirrored horizontally.
// ---------------------------------------------------------------------------

/** [seconds, value, ease of the segment that ENDS at this key (default min-jerk)]. */
type TK = readonly [sec: number, value: number, ease?: Ease];

function track(sec: number, keys: readonly TK[]): number {
  if (sec <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, ease = minJerk] = keys[i];
    if (sec <= t1) {
      const [t0, v0] = keys[i - 1];
      return v0 + (v1 - v0) * ease((sec - t0) / (t1 - t0 || 1));
    }
  }
  return keys[keys.length - 1][1];
}

const wrap = (sec: number, dur: number) => ((sec % dur) + dur) % dur;
const smooth = (a: number, b: number, v: number) => {
  const u = clamp((v - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const DEG = 180 / Math.PI;

// ---------------------------------------------------------------------------
// Shaded blobs (same technique as body3d's blobNode): the hull of a group of
// solids in the shade tone, then the hull of the same solids shrunk toward
// their light-facing side in the lit tone, leaving a soft shade crescent.
// ---------------------------------------------------------------------------

type Pt = readonly [number, number];

const norm = (v: V3): V3 => vscale(v, 1 / (vlen(v) || 1));
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const transpose = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
/** Rotation whose columns are the given (orthonormal) axes. */
const basis = (x: V3, y: V3, z: V3): M3 => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
const col = (m: M3, j: number): V3 => [m[j], m[3 + j], m[6 + j]];

/**
 * Key light, fixed relative to the camera (upper left, in front) so every close-up gets the cover's
 * soft shade crescent on the lower-right edge of each form, whatever the camera angle.
 */
const LIGHT_VIEW: V3 = norm([-0.6, 0.7, 0.45]);
const lightOf = (d: Drawing): V3 => mapply(transpose(d.view), LIGHT_VIEW);

const T = {
  skin: C.skin,
  skinShade: C.skinShade,
  crease: '#E8955F',
  patch: C.patch,
  patchShade: '#1E9AD6',
  patchGlow: C.patchGlow,
};

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

const closedPath = (pts: readonly Pt[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${r2(q[0])} ${r2(q[1])}`).join('') + 'Z';

type Solid = { f: Frame; r: V3 } | { c: V3; s: number };
const sph = (c: V3, s: number): Solid => ({ c, s });

function solidPts(d: Drawing, sol: Solid, k = 1, n = 28): Pt[] {
  const out: Pt[] = [];
  const LIGHT = lightOf(d);
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

const blobHull = (d: Drawing, solids: readonly Solid[], k = 1) => hull(solids.flatMap((s) => solidPts(d, s, k)));

function blobNode(d: Drawing, solids: readonly Solid[], lit: string, shade: string, k = 0.86): ReactNode {
  return (
    <>
      <path d={closedPath(blobHull(d, solids))} fill={shade} />
      <path d={closedPath(blobHull(d, solids, k))} fill={lit} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Arm + hand rig
// ---------------------------------------------------------------------------

const FOREARM = 25;

/** Finger layout (right hand; x is mirrored by `ts`): MCP position, phalanx lengths, radii. */
const FINGERS = [
  { x: 3.0, y: 0.15, z: 8.5, len: [3.9, 2.4, 2.0], r: 1.05, spread: 5 }, // index
  { x: 1.0, y: 0.3, z: 8.9, len: [4.3, 2.7, 2.1], r: 1.08, spread: 1 }, // middle
  { x: -1.0, y: 0.2, z: 8.6, len: [4.0, 2.5, 2.0], r: 1.03, spread: -3 }, // ring
  { x: -2.9, y: -0.05, z: 7.9, len: [3.2, 1.9, 1.8], r: 0.93, spread: -8 }, // little
] as const;

export interface HandPose {
  /** Wrist: + palmar flexion, − extension (deg). */
  flex: number;
  /** Wrist: + radial deviation (deg). */
  dev: number;
  /** Per-finger MCP / PIP / DIP flexion (deg); + curls toward the palm. */
  curl: readonly (readonly [number, number, number])[];
  /** Extra finger spread (deg), + fans the fingers apart. */
  spread?: number;
  /** Thumb flexion across the palm (deg). */
  thumb?: number;
}

interface HandRig {
  hand: Frame;
  /** Frames at each finger's MCP (after MCP flexion), proximal phalanx along +z. */
  mcp: Frame[];
  tips: V3[];
  /** Solids of each hand part (palm, thumb and finger segments), for silhouettes and cast shadows. */
  parts: Solid[][];
}

const relaxedCurl = (k: number): HandPose['curl'] =>
  FINGERS.map((_, i) => [(10 + 3 * i) * k, (16 + 4 * i) * k, (10 + 2 * i) * k] as const);

interface ArmOpts {
  /** Thumb sign: +1 right hand, −1 left hand. */
  ts: 1 | -1;
  /** Painter bias added to every item of this arm. */
  bias?: number;
  /** Cyan patch on the forearm: which side and how strong. */
  patch?: { side: 'volar' | 'dorsal' | 'band'; amount: number };
  /** Draw the upper-arm stub behind the elbow. */
  stub?: boolean;
}

/** Hand frame at the wrist from a forearm frame (origin at the elbow, +z toward the wrist). */
function wristFrame(forearm: Frame, pose: Pick<HandPose, 'flex' | 'dev'>, ts: 1 | -1): Frame {
  return child(forearm, [0, 0, FOREARM], mmul(rotY(ts * pose.dev), rotX(pose.flex)));
}

function fingerChain(hand: Frame, i: number, pose: HandPose, ts: 1 | -1): { frames: Frame[]; tip: V3 } {
  const F = FINGERS[i];
  const [c1, c2, c3] = pose.curl[i];
  const spread = F.spread * (1 + (pose.spread ?? 0) / 10) + (pose.spread ?? 0) * (i - 1.5) * 0.4;
  const f1 = child(hand, [ts * F.x, F.y, F.z], mmul(rotY(ts * spread), rotX(c1)));
  const f2 = child(f1, [0, 0, F.len[0]], rotX(c2));
  const f3 = child(f2, [0, 0, F.len[1]], rotX(c3));
  return { frames: [f1, f2, f3], tip: toWorld(f3, [0, 0, F.len[2]]) };
}

/**
 * Forearm (+ optional upper-arm stub), palm, thumb and four 3-phalanx fingers. Each part is a
 * separate painter item so fingers can pass in front of / behind the palm and the other hand.
 */
function drawArm(d: Drawing, forearm: Frame, hand: Frame, pose: HandPose, opts: ArmOpts): HandRig {
  const { ts } = opts;
  const bias = opts.bias ?? 0;
  const depthOf = (v: V3) => d.p(v).depth;
  const at = (f: Frame, x: number, y: number, z: number) => toWorld(f, [ts * x, y, z]);
  const ell = (f: Frame, o: V3, r: V3): Solid => ({ f: { origin: toWorld(f, [ts * o[0], o[1], o[2]]), rot: f.rot }, r });

  // ---- forearm: wide and round near the elbow, flat and narrow at the wrist ----
  const armSolids: Solid[] = [
    ell(forearm, [0, 0.2, 1.5], [3.7, 3.3, 2.2]),
    ell(forearm, [0, 0.3, 8], [3.5, 2.9, 3]),
    ell(forearm, [0, 0.1, 16], [3.0, 2.25, 3]),
    ell(forearm, [0, 0, FOREARM - 1.2], [2.75, 1.75, 1.6]),
  ];
  if (opts.stub) armSolids.push(ell(forearm, [0, 0.3, -12], [4.2, 4.0, 3]));
  const armNode: ReactNode[] = [<g key="a">{blobNode(d, armSolids, T.skin, T.skinShade, 0.86)}</g>];

  // Target patch on the distal forearm, masked to the forearm silhouette. Depth grows the patch
  // from the wrist toward the elbow (colour stays saturated; only the first bit fades in).
  if (opts.patch && opts.patch.amount > 0.02) {
    const { side, amount } = opts.patch;
    const z0 = FOREARM - 3 - 9 * amount;
    const z1 = FOREARM - 1.1;
    let op = smooth(0, 0.3, amount);
    let solids: Solid[];
    if (side === 'band') {
      // A ring around the wrist, like the cover.
      solids = [ell(forearm, [0, 0, z0], [3.1, 2.4, 0.5]), ell(forearm, [0, 0, z1], [3.0, 2.2, 0.5])];
    } else {
      // A copy of the forearm section shifted toward the target side: inside the silhouette it covers
      // that face of the forearm and ends in a curved edge across it.
      const sy = side === 'dorsal' ? 1 : -1;
      const fade = clamp((vdot(mapply(forearm.rot, [0, sy, 0]), towardViewer(d.cam)) + 0.5) / 0.45, 0, 1);
      op *= fade * fade * (3 - 2 * fade);
      solids = [ell(forearm, [0, sy * 2.2, z0], [3.1, 2.4, 0.8]), ell(forearm, [0, sy * 1.6, z1], [2.9, 1.9, 0.8])];
    }
    if (op > 0.02) {
      const maskId = d.uid('fa');
      armNode.push(
        <mask key="m" id={maskId} maskUnits="userSpaceOnUse" x={-1e4} y={-1e4} width={2e4} height={2e4}>
          <path d={closedPath(blobHull(d, armSolids))} fill="#fff" />
        </mask>,
        <g key="p" mask={`url(#${maskId})`} opacity={op < 0.999 ? r2(op) : undefined}>
          {blobNode(d, solids, T.patch, T.patchShade, 0.86)}
          <path d={closedPath(blobHull(d, solids, 0.5))} fill={T.patchGlow} opacity={0.4} />
        </g>,
      );
    }
  }
  d.add(depthOf(toWorld(forearm, [0, 0, FOREARM * 0.6])) + bias, <>{armNode}</>);

  // ---- palm ----
  const palmSolids: Solid[] = [
    ell(hand, [0, 0.05, 1.0], [3.0, 1.75, 1.6]),
    ell(hand, [0.1, 0.05, 4.6], [3.95, 1.6, 3.3]),
    ell(hand, [2.2, -0.55, 3.0], [1.6, 1.25, 2.3]), // thenar
    ell(hand, [-2.5, -0.35, 4.0], [1.25, 1.2, 3.0]), // hypothenar
    ...FINGERS.map((F) => sph(at(hand, F.x, F.y, F.z - 0.4), F.r * 1.12)),
  ];
  d.add(depthOf(at(hand, 0, 0, 4.5)) + bias, blobNode(d, palmSolids, T.skin, T.skinShade, 0.87));
  const parts: Solid[][] = [palmSolids];

  // ---- thumb: metacarpal from the CMC joint, then two phalanges ----
  const th = pose.thumb ?? 0;
  const t0 = child(hand, [ts * 2.3, -0.9, 1.4], mmul(rotY(ts * (40 - 0.45 * th)), mmul(rotZ(-ts * 35), rotX(18 + 0.3 * th))));
  const t1 = child(t0, [0, 0, 4.0], mmul(rotY(-ts * 6), rotX(10 + 0.4 * th)));
  const t2 = child(t1, [0, 0, 3.0], rotX(14 + 0.5 * th));
  const tTip = toWorld(t2, [0, 0, 2.3]);
  const thumbParts: [V3, V3, number, number][] = [
    [t0.origin, t1.origin, 1.35, 1.15],
    [t1.origin, t2.origin, 1.12, 1.0],
    [t2.origin, tTip, 0.98, 0.82],
  ];
  thumbParts.forEach(([a, b, ra, rb], i) => {
    const sols = [sph(a, ra), sph(b, rb)];
    parts.push(sols);
    d.add((depthOf(a) + depthOf(b)) / 2 + bias + 0.05 * i, blobNode(d, sols, T.skin, T.skinShade, 0.84));
  });

  // ---- fingers ----
  const mcp: Frame[] = [];
  const tips: V3[] = [];
  FINGERS.forEach((F, i) => {
    const { frames, tip } = fingerChain(hand, i, pose, ts);
    mcp.push(frames[0]);
    tips.push(tip);
    const joints = [frames[0].origin, frames[1].origin, frames[2].origin, tip];
    const radii = [F.r, F.r * 0.93, F.r * 0.86, F.r * 0.78];
    for (let j = 0; j < 3; j++) {
      const a = joints[j];
      const b = joints[j + 1];
      // Phalanx: rounded at both ends; the knuckle end slightly fuller.
      const sols = [sph(a, radii[j]), sph(vlerp(a, b, 0.55), (radii[j] + radii[j + 1]) / 2), sph(b, radii[j + 1])];
      parts.push(sols);
      d.add((depthOf(a) + depthOf(b)) / 2 + bias + 0.02 * j, blobNode(d, sols, T.skin, T.skinShade, 0.84));
    }
  });
  return { hand, mcp, tips, parts };
}

/** Forearm frame: origin at the elbow, +z along `dirn`, rolled so local +y is as close to `up` as possible. */
function armFrame(elbow: V3, dirn: V3, up: V3): Frame {
  const z = norm(dirn);
  const y = norm(vsub(up, vscale(z, vdot(up, z))));
  return { origin: elbow, rot: basis(cross(y, z), y, z) };
}

/** Forearm frame for a straight arm reaching forward, rolled by `sup` (0 = palm down, 180 = palm up). */
function reachFrame(origin: V3, yaw: number, pitch: number, sup: number, ts: 1 | -1): Frame {
  return { origin, rot: mmul(mmul(rotY(yaw), rotX(pitch)), rotZ(ts * sup)) };
}

// ---------------------------------------------------------------------------
// Scene helpers
// ---------------------------------------------------------------------------

/** Painter-sorted drawing faded toward the bottom edge, optionally mirrored, plus cue overlay on top. */
function scene(d: Drawing, overlay: ReactNode, opts: { mirror?: boolean; opacity?: number; dy?: number } = {}) {
  const fade = d.uid('fade');
  const tf = `${opts.mirror ? 'translate(240 0) scale(-1 1) ' : ''}translate(0 ${r2(opts.dy ?? 0)})`;
  return (
    <>
      <defs>
        <linearGradient id={`${fade}-g`} gradientUnits="userSpaceOnUse" x1="0" y1="165" x2="0" y2="200">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={fade} maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="200">
          <rect width="240" height="200" fill={`url(#${fade}-g)`} />
        </mask>
      </defs>
      <g mask={`url(#${fade})`}>
        <g transform={tf} opacity={opts.opacity === undefined ? undefined : r2(opts.opacity)}>
          {d.render()}
          {overlay}
        </g>
      </g>
    </>
  );
}

/** Polyline cue with an arrowhead at its end. */
function CuePath({ pts, opacity }: { pts: P[]; opacity: number }) {
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const head = (da: number) => pt(b.x - Math.cos(ang + da) * 6, b.y - Math.sin(ang + da) * 6);
  const d = pts.map((q, i) => `${i ? 'L' : 'M'}${r2(q.x)} ${r2(q.y)}`).join('');
  const h1 = head(0.5);
  const h2 = head(-0.5);
  return (
    <g style={{ stroke: CUE_COLOR, fill: 'none' }} opacity={r2(opacity)} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      <path d={`${M(h1)}L${r2(b.x)} ${r2(b.y)}L${r2(h2.x)} ${r2(h2.y)}`} />
    </g>
  );
}

/** Arc (screen space) around `c` from compass angle `from` to `to`. */
function arcPts(c: P, r: number, from: number, to: number, n = 14): P[] {
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (from + ((to - from) * i) / n) / DEG;
    out.push(pt(c.x + Math.sin(a) * r, c.y - Math.cos(a) * r));
  }
  return out;
}

const screenAngle = (from: P, to: P) => Math.atan2(to.x - from.x, -(to.y - from.y)) * DEG;

// ---------------------------------------------------------------------------
// Assisted stretches (flexor / extensor) — shared choreography.
//
// Per side (15 s): the arm settles in (0–0.7) → the helping hand reaches the fingers
// (0.6–2.0) → the wrist is eased into extension/flexion over 2 s → hold ~8.5 s while
// the stretch softens a few degrees deeper → release (1.2 s) → helper lets go →
// the arm lowers and the other side comes up. The right side plays first; the left
// side is the same scene mirrored.
// ---------------------------------------------------------------------------

const STRETCH_DUR = 30;
const HALF = 15;
const BEND: readonly TK[] = [
  [0, 0],
  [2.1, 0],
  [4.1, 0.9],
  [12.5, 1, easeInOut],
  [13.7, 0],
  [HALF, 0],
];
const GRIP: readonly TK[] = [
  [0, 0],
  [0.6, 0],
  [2.0, 1],
  [13.6, 1],
  [14.4, 0],
  [HALF, 0],
];
/** Exhale into the stretch, slow breaths in the hold. */
const BREATH: readonly TK[] = [
  [0, 0.5, easeInOut],
  [2.1, 0.9, easeInOut],
  [4.1, 0.15, easeInOut],
  [6.9, 0.8, easeInOut],
  [9.7, 0.2, easeInOut],
  [12.5, 0.8, easeInOut],
  [13.7, 0.3, easeInOut],
  [HALF, 0.5, easeInOut],
];

const STRETCH_CAM: Camera = { yaw: 45, pitch: 14, scale: 6, origin: pt(118, 58) };

interface StretchSpec {
  /** Forearm roll: 180 = palm up (supinated), 0 = palm down. */
  sup: number;
  /** Peak wrist angle (deg, signed: − extension, + flexion). */
  bend: number;
  patch: 'volar' | 'dorsal';
  /** Target thumb flexion (− = abducted out to the side). */
  thumb: number;
  /** Target finger curl as a function of stretch depth 0..1. */
  curl: (u: number) => HandPose['curl'];
  /** Where the helper's palm presses, in the reference frame (`mcp` = middle proximal phalanx, `hand`). */
  ref: 'mcp' | 'hand';
  contact: V3;
  /** Helper hand orientation in the reference frame: helper +y (dorsal) and +z (distal). */
  gy: V3;
  gz: V3;
}

const ang = 24 / DEG;
const FLEXOR: StretchSpec = {
  sup: 180,
  bend: -64,
  patch: 'volar',
  thumb: -22,
  // Fingers are drawn back straight (slight MCP extension under the pull).
  curl: (u) => FINGERS.map((_, i) => [6 - 14 * u + i, 8 - 6 * u + i, 4 - 3 * u] as const),
  ref: 'mcp',
  contact: [0, -1.0, 7.4],
  gy: [0, -1, 0],
  gz: [Math.cos(ang), 0, Math.sin(ang)],
};
const EXTENSOR: StretchSpec = {
  sup: 0,
  bend: 68,
  patch: 'dorsal',
  thumb: 12,
  // Fingers softly curled; the press adds a little curl.
  curl: (u) => FINGERS.map((_, i) => [10 + 6 * u + 2 * i, 12 + 6 * u + 3 * i, 8 + 4 * u] as const),
  ref: 'mcp',
  contact: [0, 1.0, 3.4],
  gy: [0, 1, 0],
  gz: [-Math.cos(ang), 0, Math.sin(ang)],
};

/** Helper's palm centre in its own hand frame. */
const HELPER_PALM: V3 = [0, -1.35, 4.8];

/**
 * The loop starts 0.4 s into the right side, so the first frame (and a paused player at t=0) shows the
 * arm already in place rather than mid-crossfade.
 */
const STRETCH_START = 0.4;
const stretchSec = (t: number) => wrap((t - Math.floor(t)) * STRETCH_DUR + STRETCH_START, STRETCH_DUR);

/** Visibility of one side at its local phase `ph` (may run past 0..HALF while crossfading). */
const sideVis = (ph: number) => smooth(-0.3, 0.4, ph) * (1 - smooth(HALF - 0.4, HALF + 0.3, ph));

/** One side's scene. At the switch the outgoing and incoming sides crossfade, so the frame never goes empty. */
function stretchScene(spec: StretchSpec, t: number, id: string) {
  const s = stretchSec(t);
  const mirror = s >= HALF;
  const ph = wrap(s, HALF);
  const main = stretchSide(spec, t, id, ph, mirror);
  if (ph > HALF - 0.4) return <>{main}{stretchSide(spec, t, `${id}n`, ph - HALF, !mirror)}</>;
  if (ph < 0.3) return <>{stretchSide(spec, t, `${id}p`, ph + HALF, !mirror)}{main}</>;
  return main;
}

function stretchSide(spec: StretchSpec, t: number, id: string, ph: number, mirror: boolean) {
  const u = track(ph, BEND);
  const grip = track(ph, GRIP);
  const br = track(ph, BREATH);
  const d = new Drawing(STRETCH_CAM, id);

  // Target (right) arm: reaching forward at shoulder height, idle drift + breath.
  const bob = 0.35 * (br - 0.5) + 0.25 * wobble(t, 1.7, [2, 3]);
  const yaw = 1.2 * wobble(t, 0.4, [1, 2]);
  const elbow: V3 = [0, bob, -FOREARM];
  const forearm = reachFrame(elbow, yaw, -2 + 0.8 * u, spec.sup, 1);
  // The wrist leads, the fingers follow ~100 ms later under the helper's pull.
  const pose: HandPose = { flex: spec.bend * u, dev: 0, curl: spec.curl(track(ph - 0.1, BEND)), thumb: spec.thumb };
  const hand = wristFrame(forearm, pose, 1);

  // Helper (left) hand: glued to the target's fingers / back of the hand.
  const refFrame = spec.ref === 'mcp' ? fingerChain(hand, 1, pose, 1).frames[0] : hand;
  const gz = norm(spec.gz);
  const gy = norm(spec.gy);
  const gRot = mmul(refFrame.rot, basis(cross(gy, gz), gy, gz));
  const contact = toWorld(refFrame, spec.contact);
  const gOrigin0 = vsub(contact, mapply(gRot, HELPER_PALM));
  // Helper forearm drops away below the hands toward its elbow (bent, low, in front of the body).
  const gZ = col(gRot, 2);
  const back = norm(vadd(vscale(gZ, -0.2), vscale(norm(vsub([12, -42, 4], gOrigin0)), 0.8)));
  // Reaching in / letting go: the hand lifts off the surface and slides back along its forearm.
  const reach = 1 - grip;
  const rch = reach * reach * (3 - 2 * reach);
  const lift = mapply(gRot, [0, 1, 0]);
  const gOrigin = vadd(gOrigin0, vadd(vscale(lift, 2.5 * smooth(0, 0.3, reach)), vscale(back, 42 * rch)));
  const gHand: Frame = { origin: gOrigin, rot: gRot };
  const g = smooth(0.4, 1, grip);
  const gPose: HandPose = {
    flex: 0,
    dev: 0,
    // Open while reaching; wraps around the edge of the target hand on contact.
    curl: FINGERS.map((_, i) => [8 + (40 - 4 * i) * g, 14 + (48 + 4 * i) * g, 10 + 22 * g] as const),
    thumb: 8 + 12 * g,
  };
  const gForearm = armFrame(vadd(gOrigin, vscale(back, FOREARM)), vscale(back, -1), col(gRot, 1));

  // The helper is drawn wholly in front of the target hand (it presses on the visible face), with a
  // soft contact shadow cast onto the target hand only.
  const rig = drawArm(d, forearm, hand, pose, {
    ts: 1,
    stub: true,
    patch: { side: spec.patch, amount: smooth(0.1, 0.85, u) },
  });
  const helper = drawArm(d, gForearm, gHand, gPose, { ts: -1, bias: 40, stub: true });
  {
    const L = lightOf(d);
    const off = vscale(L, -1.1); // away from the light
    const maskId = d.uid('cs');
    const shadow = helper.parts.map((sols, i) => (
      <path
        key={i}
        d={closedPath(blobHull(d, sols.map((so) => ('c' in so ? sph(vadd(so.c, off), so.s) : { f: { origin: vadd(so.f.origin, off), rot: so.f.rot }, r: so.r }))))}
      />
    ));
    d.add(
      d.p(hand.origin).depth + 39,
      <>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-1e4} y={-1e4} width={2e4} height={2e4}>
          {rig.parts.map((sols, i) => (
            <path key={i} d={closedPath(blobHull(d, sols))} fill="#fff" />
          ))}
        </mask>
        <g mask={`url(#${maskId})`} fill={T.crease} opacity={r2(0.55 * smooth(0.5, 1, grip))}>
          {shadow}
        </g>
      </>,
    );
  }

  // Cue: arc around the wrist, leading the fingertips in the direction of the stretch.
  const w = d.p(hand.origin);
  const tip = d.p(rig.tips[1]);
  const a0 = screenAngle(w, tip);
  const op = ph < 2.0 ? smooth(1.4, 2.2, ph) : 1 - smooth(4.6, 5.6, ph);
  const r = Math.hypot(tip.x - w.x, tip.y - w.y) + 9;
  const overlay = op > 0.01 && <CuePath pts={arcPts(w, r, a0 + 6, a0 + 6 + 34 * (1 - 0.6 * u))} opacity={op * 0.9} />;

  // Side switch: the arm lowers and fades while the other side rises.
  const vis = sideVis(ph);
  return scene(d, overlay, { mirror, opacity: vis < 0.999 ? vis : undefined, dy: 14 * (1 - vis) });
}

function FlexorScene({ t }: { t: number }) {
  return stretchScene(FLEXOR, t, useId());
}

function ExtensorScene({ t }: { t: number }) {
  return stretchScene(EXTENSOR, t, useId());
}

/** Cues authored in timeline seconds, shifted to loop progress (see STRETCH_START). */
const stretchCues = (first: string, pull: string): Clip['cues'] => {
  const at = (sec: number) => wrap(sec - STRETCH_START, STRETCH_DUR) / STRETCH_DUR;
  // The loop opens inside the first caption's span, so it also starts the list at progress 0.
  return [[0, first] as const, ...(
    [
      [0, first],
      [0.6, pull],
      [4.1, 'Hold · breathe', true],
      [12.5, 'Release'],
      [14.2, 'Switch hands'],
      [HALF + 0.6, pull],
      [HALF + 4.1, 'Hold · breathe', true],
      [HALF + 12.5, 'Release'],
    ] as const
  )
    .map(([sec, text, hold]) => [at(sec), text, hold] as const)
    .sort((a, b) => a[0] - b[0])];
};

export const wristFlexor: Clip = {
  duration: STRETCH_DUR,
  still: (8 - STRETCH_START) / STRETCH_DUR,
  cues: stretchCues('Arm out, palm up', 'Gently pull fingers back'),
  Scene: FlexorScene,
};

export const wristExtensor: Clip = {
  duration: STRETCH_DUR,
  still: (8 - STRETCH_START) / STRETCH_DUR,
  cues: stretchCues('Arm out, palm down', 'Gently press hand down'),
  Scene: ExtensorScene,
};

// ---------------------------------------------------------------------------
// Wrist circles — 15 s: two slow circles one way (≈3.4 s each), then two the other way.
//
// Fingertip path: flexion/extension ±32° combined with deviation (radial 14°, ulnar 20°),
// phase-shifted 90°. Amplitude eases in and out around each reversal. Fingers stay relaxed
// and trail the wrist (follow-through): each joint uses the wrist motion from a few tens of
// milliseconds earlier, distal joints lagging more. The left hand runs ~60 ms behind.
// ---------------------------------------------------------------------------

const CIRCLE_DUR = 15;
const CIRCLE_HALF = 7.5;

function circleAngles(sec: number): { flex: number; dev: number; amp: number } {
  const s = wrap(sec, CIRCLE_DUR);
  const dirn = s < CIRCLE_HALF ? 1 : -1;
  const ph = wrap(s, CIRCLE_HALF);
  const amp = smooth(0, 1.1, ph) * (1 - smooth(CIRCLE_HALF - 1.1, CIRCLE_HALF, ph));
  // Two full turns per half; slow at the ends where the amplitude is small anyway.
  const phi = dirn * 2 * Math.PI * 2 * (ph / CIRCLE_HALF);
  const c = Math.cos(phi);
  const sn = Math.sin(phi);
  return { flex: amp * 32 * c, dev: amp * (sn > 0 ? 14 : 20) * sn, amp };
}

const CIRCLE_CAM: Camera = { yaw: 8, pitch: 30, scale: 4.6, origin: pt(120, 64) };

function CirclesScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * CIRCLE_DUR;
  const d = new Drawing(CIRCLE_CAM, id);
  const breath = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t);
  let rightTips: V3[] = [];
  let rightTipAt: (sec: number) => V3 = () => [0, 0, 0];
  let rightNeutral: V3 = [0, 0, 0];

  for (const ts of [1, -1] as const) {
    const lag = ts === 1 ? 0 : 0.06;
    const at = (sec: number) => circleAngles(sec - lag);
    const now = at(s);
    // Follow-through: fingers lag the wrist — distal joints more.
    const trail = (dt: number) => {
      const p = at(s - dt);
      return { f: p.flex - now.flex, d: p.dev - now.dev };
    };
    const tr1 = trail(0.12);
    const tr2 = trail(0.2);
    const base = relaxedCurl(1);
    const pose: HandPose = {
      flex: now.flex,
      dev: now.dev,
      curl: base.map(([a, b, c]) => [a + 0.5 * tr1.f, b + 0.35 * tr2.f, c + 0.25 * tr2.f] as const),
      spread: clamp(-0.25 * tr1.d, -4, 4),
      thumb: 6,
    };
    const x = -ts * 13; // right arm on −x (person's right)
    const elbow: V3 = [x - ts * 1.5, 0.3 * (breath - 0.5) + 0.2 * wobble(t, ts + 2, [1, 2]), -FOREARM];
    const forearm = reachFrame(elbow, ts * 7, -3, 8, ts);
    const hand = wristFrame(forearm, pose, ts);
    const rig = drawArm(d, forearm, hand, pose, {
      ts,
      stub: true,
      patch: { side: 'band', amount: 0.55 + 0.4 * now.amp },
    });
    if (ts === 1) {
      rightTips = rig.tips;
      // Fingertip path of the right middle finger at the current amplitude (for the cue).
      rightTipAt = (sec: number) => {
        const p = at(sec);
        const h = wristFrame(forearm, { flex: p.flex, dev: p.dev }, 1);
        return fingerChain(h, 1, { ...pose, flex: p.flex, dev: p.dev }, 1).tip;
      };
      rightNeutral = fingerChain(wristFrame(forearm, { flex: 0, dev: 0 }, 1), 1, pose, 1).tip;
    }
  }

  // Cue: the next stretch of the fingertip path, scaled out around the circle's centre.
  const ph = wrap(s, CIRCLE_HALF);
  const op = smooth(0.6, 1.4, ph) * (1 - smooth(CIRCLE_HALF - 2.2, CIRCLE_HALF - 1.2, ph));
  let overlay: ReactNode = null;
  if (op > 0.01 && rightTips.length) {
    const path: P[] = [];
    for (let i = 0; i <= 12; i++) path.push(d.p(rightTipAt(s + 0.3 + (i / 12) * 1.1)));
    const centre = d.p(rightNeutral);
    // Centre of the loop ≈ the neutral fingertip position; push the cue outward a bit.
    const cue = path.map((q) => pt(centre.x + (q.x - centre.x) * 1.7, centre.y + (q.y - centre.y) * 1.7));
    overlay = <CuePath pts={cue} opacity={op * 0.85} />;
  }
  return scene(d, overlay);
}

export const wristCircles: Clip = {
  duration: CIRCLE_DUR,
  still: 2.6 / CIRCLE_DUR,
  cues: [
    [0, 'Slow circles · fingers loose'],
    [(CIRCLE_HALF - 0.4) / CIRCLE_DUR, 'Reverse direction'],
    [(CIRCLE_HALF + 1.2) / CIRCLE_DUR, 'Slow circles · other way'],
    [(CIRCLE_DUR - 0.4) / CIRCLE_DUR, 'Reverse direction'],
  ],
  Scene: CirclesScene,
};
