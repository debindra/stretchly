import { useId, type ReactNode } from 'react';
import { Arrow, ArcArrow, C, FloorShadow, clamp, easeInOut, minJerk, pt, wobble, type Clip, type Cue, type Ease, type P } from './engine';
import { Drawing, mapply, toWorld, towardViewer, vadd, vlen, vlerp, vscale, vsub, type Camera, type V3 } from './rig3d';
import { FLOOR_Y, drawBody, legChain, spineFrom, type BodyPose, type BodyRig, type HandTarget, type LegPose, type NeckSeg, type SpineSeg } from './body3d';
import { drawHead } from './head3d';
import { drawStool } from './back';

// ---------------------------------------------------------------------------
// Held stretches on the pseudo-3D mannequin, added from the desk-doable subset of the
// hasaneyldrm/exercises-dataset shortlist (chest, shoulders, upper back, sides, glutes, legs).
//
// Same approach as back.tsx: timelines in SECONDS, evaluated at s = (t mod 1) · duration so the
// loop seam is invisible. Two-sided stretches share one 40 s choreography (right side first, as
// knee-to-chest does): settle → move in (3 s) → 12 s hold that deepens a touch on each exhale →
// release → rest, then the camera orbits to the other side while the figure rests. One-sided
// stretches share a 15 s rep (the exercise runs two).
//
// Target-muscle patches on limbs are capsules floated a little toward the viewer so they paint
// over the limb they belong to (the torso patches of body3d don't cover thighs, calves or arms).
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
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Idle torso life (≤ ~0.6°), loop-safe. */
function idleTorso(t: number) {
  return {
    sway: 0.45 * wobble(t, 1.3, [1, 2, 3]),
    lean: 0.35 * wobble(t, 2.1, [1, 2]),
    twist: 0.3 * wobble(t, 0.7, [1, 3]),
  };
}

/** Fade-in / fade-out envelope for cue arrows (seconds). */
const envelope = (s: number, a: number, b: number, c: number, e: number) => smooth(a, b, s) * (1 - smooth(c, e, s));

/** Slow breathing, 0..1 inhale amount; seamless when the block length is a multiple of `period`. */
const breathe = (s: number, period: number) => 0.45 + 0.35 * Math.sin((2 * Math.PI * s) / period - Math.PI / 2);

/** Neck chain that cancels a net upper-body pitch (+ = flexed) so the gaze stays level, plus an extra look. */
const levelNeck = (trunkPitch: number, look = 0, t = 0): [NeckSeg, NeckSeg, NeckSeg] => [
  { pitch: -0.4 * trunkPitch + 0.3 * look },
  { pitch: -0.35 * trunkPitch + 0.35 * look },
  { pitch: -0.25 * trunkPitch + 0.35 * look + 0.3 * wobble(t, 2.7, [2, 3]) },
];

const segs3 = (pitch: readonly number[]) => [0, 1, 2].map((i) => ({ pitch: pitch[i] })) as unknown as readonly [SpineSeg, SpineSeg, SpineSeg];

interface Rendered {
  d: Drawing;
  rig: BodyRig;
}

/** Mannequin figure in the Relief tab cover style (faceless head, bare skin, cyan target patch). */
function drawFigure(id: string, cam: Camera, pose: BodyPose, stool = false): Rendered {
  const d = new Drawing(cam, id);
  if (stool) drawStool(d);
  const rig = drawBody(d, pose, { chair: false });
  drawHead(d, rig.head, { faceless: true });
  return { d, rig };
}

/** Painter-sorted figure, faded out toward the bottom edge (unless `fadeFrom` is null: full figure), plus cue overlay on top. */
function scene(fig: Rendered, overlay: ReactNode, fadeFrom: number | null = 160) {
  if (fadeFrom === null)
    return (
      <>
        {fig.d.render()}
        {overlay}
      </>
    );
  const fade = fig.d.uid('fade');
  return (
    <>
      <defs>
        <linearGradient id={`${fade}-g`} gradientUnits="userSpaceOnUse" x1="0" y1={fadeFrom} x2="0" y2="200">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={fade} maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="200">
          <rect width="240" height="200" fill={`url(#${fade}-g)`} />
        </mask>
      </defs>
      <g mask={`url(#${fade})`}>{fig.d.render()}</g>
      {overlay}
    </>
  );
}

const sp = (d: Drawing, v: V3): P => {
  const q = d.p(v);
  return pt(q.x, q.y);
};

// ---------------------------------------------------------------------------
// Target patches on limbs
// ---------------------------------------------------------------------------

/** Cyan band on a limb: capsule a→b of radius r, floated `lift` toward the viewer so it paints over the limb. */
function limbPatch(d: Drawing, a: V3, b: V3, r: number, k: number, lift = 2) {
  if (k < 0.02) return;
  const off = vscale(towardViewer(d.cam), lift);
  const grow = 0.35 + 0.65 * smooth(0.02, 0.6, k);
  const op = 0.95 * smooth(0.02, 0.14, k);
  d.capsule(vadd(a, off), vadd(b, off), r * grow, C.patch, 0.5, op);
  d.capsule(vadd(a, off), vadd(b, off), r * grow * 0.4, C.patchGlow, 0.51, 0.45 * op);
}

/** Cyan spot on a joint or muscle belly. */
function spotPatch(d: Drawing, c: V3, r: number, k: number, lift = 2) {
  if (k < 0.02) return;
  const off = vscale(towardViewer(d.cam), lift);
  const grow = 0.35 + 0.65 * smooth(0.02, 0.6, k);
  const op = 0.95 * smooth(0.02, 0.14, k);
  d.ball(vadd(c, off), r * grow, C.patch, 0.5, op);
  d.ball(vadd(vadd(c, off), [0, 0.25 * r * grow, 0]), r * grow * 0.4, C.patchGlow, 0.51, 0.45 * op);
}

// ---------------------------------------------------------------------------
// Shared timelines
// ---------------------------------------------------------------------------

/** Two-sided clips: 20 s per side, right first. */
const HALF = 20;
const TWO = 2 * HALF;
const IN2: readonly TK[] = [
  [0, 0],
  [0.8, 0],
  [3.0, 1],
  [14.8, 1.06, easeInOut],
  [16.6, 0],
  [HALF, 0],
];
/** A second movement that follows the first (e.g. hinge forward once the leg is placed). */
const THEN2: readonly TK[] = [
  [0, 0],
  [2.6, 0],
  [4.4, 1],
  [14.8, 1, easeInOut],
  [16.2, 0],
  [HALF, 0],
];
/** One-sided clips: a 15 s rep (the exercise runs two). */
const ONE = 15;
const IN1: readonly TK[] = [
  [0, 0],
  [0.6, 0],
  [2.4, 1],
  [11.6, 1.06, easeInOut],
  [13.2, 0],
  [ONE, 0],
];
const THEN1: readonly TK[] = [
  [0, 0],
  [1.4, 0],
  [3.2, 1],
  [11.6, 1, easeInOut],
  [12.8, 0],
  [ONE, 0],
];

function twoSided(t: number) {
  const s = (t - Math.floor(t)) * TWO;
  const half = wrap(s, HALF);
  const side = s < HALF ? -1 : 1; // right side first (−x)
  const k = track(half, IN2);
  const then = track(half, THEN2);
  const breath = breathe(half, 4);
  // Exhale deepens the hold a touch.
  const deep = ((0.45 - breath) / 0.35) * smooth(3, 4.2, half) * (1 - smooth(14.2, 14.8, half));
  return { s, half, side, k, then, breath, deep };
}

function oneSided(t: number) {
  const s = (t - Math.floor(t)) * ONE;
  const k = track(s, IN1);
  const then = track(s, THEN1);
  const breath = breathe(s, 5);
  const deep = ((0.45 - breath) / 0.35) * smooth(2.4, 3.4, s) * (1 - smooth(11, 11.6, s));
  return { s, k, then, breath, deep };
}

const cues2 = (right: string, left: string, hold = 'Hold · breathe', release = 'Release'): Cue[] => [
  [0, right],
  [3 / TWO, hold, true],
  [14.8 / TWO, release],
  [HALF / TWO, left],
  [(HALF + 3) / TWO, hold, true],
  [(HALF + 14.8) / TWO, release],
];
const cues1 = (enter: string, hold = 'Hold · breathe', release = 'Release'): Cue[] => [
  [0, enter],
  [2.4 / ONE, hold, true],
  [11.6 / ONE, release],
];

/** Camera yaw for two-sided clips: `a` on the right half, `b` on the left, orbiting while the figure rests between sides. */
const yaw2 = (s: number, a: number, b: number) =>
  track(s, [
    [0, a],
    [16.8, a],
    [19.8, b],
    [HALF + 16.8, b],
    [HALF + 19.8, a],
    [TWO, a],
  ]);

/** Resting hand on the thigh (body3d's default) and its elbow pole, so blended targets start and end at rest. */
const REST_HAND = (side: number): V3 => [side * 11.6, 16.6, 23.5];
const REST_POLE = (side: number): V3 => [side * 0.55, -0.25, -1];
const REST_FINGERS = (side: number): V3 => [-side * 0.22, -0.12, 1];
const DOWN: V3 = [0, -1, 0];

/** Blend a hand from its thigh rest to a target along a lifted arc. */
function reachHand(side: number, target: HandTarget, g: number, lift: V3 = [0, 8, 4]): HandTarget {
  const arc = Math.sin(Math.PI * g);
  const at = vadd(vlerp(REST_HAND(side), target.at, g), vscale(lift, arc));
  return {
    at,
    pole: vlerp(REST_POLE(side), target.pole ?? REST_POLE(side), g),
    fingers: vlerp(REST_FINGERS(side), target.fingers ?? REST_FINGERS(side), g),
    palm: vlerp(DOWN, target.palm ?? DOWN, g),
  };
}

/** Leg angles that put the ankle at `ankle` with the knee near `knee` (coordinate descent; run once per static target). */
function solveLeg(side: number, ankle: V3, knee: V3, init: LegPose): Required<Pick<LegPose, 'hip' | 'knee' | 'abduct' | 'rotate'>> {
  let best = { hip: init.hip ?? 0, knee: init.knee ?? 0, abduct: init.abduct ?? 0, rotate: init.rotate ?? 0 };
  const cost = (p: typeof best) => {
    const L = legChain(side, p);
    return vlen(vsub(L.ankle, ankle)) ** 2 + 0.3 * vlen(vsub(L.knee, knee)) ** 2;
  };
  let c = cost(best);
  let step = 16;
  const keys = ['hip', 'knee', 'abduct', 'rotate'] as const;
  while (step > 0.05) {
    let improved = false;
    for (const key of keys)
      for (const dir of [1, -1]) {
        const trial = { ...best, [key]: best[key] + dir * step };
        const tc = cost(trial);
        if (tc < c) {
          best = trial;
          c = tc;
          improved = true;
        }
      }
    if (!improved) step /= 2;
  }
  return best;
}

const hands2 = (side: number, own: HandTarget | undefined, other: HandTarget | undefined): BodyPose['hands'] =>
  side > 0 ? { left: own, right: other } : { right: own, left: other };

// ---------------------------------------------------------------------------
// 1) Seated figure four — 40 s. Ankle onto the other knee, knee drops open, then a hinge forward.
// ---------------------------------------------------------------------------

const F4_CAM: Camera = { yaw: 0, pitch: 14, scale: 1.15, origin: pt(120, 128) };
const f4Cache = new Map<number, ReturnType<typeof solveLeg>>();
function f4Leg(side: number) {
  let v = f4Cache.get(side);
  if (!v) {
    v = solveLeg(side, [-side * 8, 15.5, 35], [side * 36, 16, 22], { hip: 30, abduct: 40, knee: 20, rotate: 40 });
    f4Cache.set(side, v);
  }
  return v;
}

function FigureFourScene({ t }: { t: number }) {
  const id = useId();
  const { half, side, k, then, breath, deep } = twoSided(t);
  const target = f4Leg(side);
  const leg: LegPose = {
    hip: target.hip * k,
    knee: target.knee * k,
    abduct: target.abduct * k,
    rotate: target.rotate * k,
    ankle: { pitch: 14 * k },
  };
  const L = legChain(side, leg);
  const hinge = then + 0.08 * deep;
  const grip = smooth(0.3, 1, k);
  const own = reachHand(side, {
    at: vadd(L.knee, [side * 1.5, 6.4, 0]),
    pole: [side * 0.9, -0.1, -0.5],
    fingers: [side * 0.35, -0.35, 1],
    palm: DOWN,
  }, grip, [0, 6, 2]);
  const other = reachHand(-side, {
    at: vadd(L.ankle, [-side * 0.5, 4.2, -0.5]),
    pole: [-side * 0.85, -0.25, -0.6],
    fingers: [0, -0.35, 1],
    palm: DOWN,
  }, grip, [0, 7, 2]);
  const trunk = 11 * hinge;
  const pose: BodyPose = {
    legs: side < 0 ? { right: leg } : { left: leg },
    pelvis: trunk + 1.5 * deep,
    spine: spineFrom({ flex: 5 * hinge + deep }),
    neck: levelNeck(trunk + 5 * hinge, 0, t),
    breath,
    torso: idleTorso(t),
    hands: hands2(side, own, other),
  };
  const fig = drawFigure(id, F4_CAM, pose, true);
  const d = fig.d;
  // Outer hip / glute of the crossed leg.
  spotPatch(d, L.map([side * 14, 10, 9]), 5, smooth(0.25, 0.9, k), 5);

  // Cue: the knee drops open (down and out).
  const op = envelope(half, 1.2, 1.8, 3.4, 4.0) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) overlay = <Arrow a={sp(d, vadd(L.knee, [side * 2, 24, 0]))} b={sp(d, vadd(L.knee, [side * 4, 11, 0]))} opacity={r2(op)} />;
  return scene(fig, overlay, null);
}

export const seatedFigureFour: Clip = {
  duration: TWO,
  still: 8 / TWO,
  cues: cues2('Right ankle on left knee · let the knee drop open', 'Left ankle on right knee · let the knee drop open', 'Hinge forward · hold, breathe'),
  Scene: FigureFourScene,
};

// ---------------------------------------------------------------------------
// 2) Seated hamstring stretch — 40 s. One leg straight, heel on the floor, toes up; hinge forward.
// ---------------------------------------------------------------------------

const HAM_CAM: Camera = { yaw: 0, pitch: 8, scale: 1.12, origin: pt(118, 128) };

function HamstringScene({ t }: { t: number }) {
  const id = useId();
  const { s, half, side, k, then, breath, deep } = twoSided(t);
  const leg: LegPose = { hip: -34 * k, knee: -86 * k, ankle: { pitch: 24 * k } };
  const L = legChain(side, leg);
  const hinge = then + 0.1 * deep;
  const trunk = 18 * hinge;
  // The hand on the stretched side rides its thigh; the other rests as usual.
  const own: HandTarget = { at: L.map(REST_HAND(side)), pole: REST_POLE(side), fingers: mapply(L.thigh.rot, REST_FINGERS(side)), palm: mapply(L.thigh.rot, DOWN) };
  const pose: BodyPose = {
    legs: side < 0 ? { right: leg } : { left: leg },
    pelvis: trunk + 2 * deep,
    spine: spineFrom({ flex: 3 * hinge }),
    neck: levelNeck(trunk + 3 * hinge, 0, t),
    breath,
    torso: idleTorso(t),
    hands: hands2(side, own, undefined),
  };
  const cam: Camera = { ...HAM_CAM, yaw: yaw2(s, 58, -58) };
  const fig = drawFigure(id, cam, pose, true);
  const d = fig.d;
  // Back of the thigh.
  limbPatch(d, L.map([side * 9.4, 0.6, 12]), L.map([side * 9.8, -0.4, 33]), 3.4, smooth(0.35, 1, k) * (0.4 + 0.6 * hinge), 2);

  // Cue: hinge forward from the hips (arrow off the chest).
  const op = envelope(half, 2.8, 3.4, 4.8, 5.4) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) {
    const c = fig.rig.sternum;
    overlay = <Arrow a={sp(d, vadd(c, [0, 2, 10]))} b={sp(d, vadd(c, [0, -5, 24]))} opacity={r2(op)} />;
  }
  return scene(fig, overlay, null);
}

export const seatedHamstring: Clip = {
  duration: TWO,
  still: 8 / TWO,
  cues: cues2('Right leg straight · heel down, toes up', 'Left leg straight · heel down, toes up', 'Hinge forward · hold, breathe'),
  Scene: HamstringScene,
};

// ---------------------------------------------------------------------------
// 3) Standing quad stretch — 40 s. One hand on a chair back, the other draws the heel to the glute.
// ---------------------------------------------------------------------------

const QUAD_CAM: Camera = { yaw: 0, pitch: 4, scale: 1.0, origin: pt(118, 150) };

/** A chair back beside the figure (post + top rail), painted at its own depth. */
function drawChairBack(d: Drawing, x: number) {
  d.capsule([x, FLOOR_Y + 1, 6], [x, 47, 6], 1.6, C.chairShade);
  d.capsule([x, 48.5, -5], [x, 48.5, 17], 1.9, C.chair);
}

function QuadScene({ t }: { t: number }) {
  const id = useId();
  const { s, half, side, k, breath, deep } = twoSided(t);
  const leg: LegPose = { hip: -7 * k - 0.6 * deep, knee: 118 * k + 1.5 * deep };
  const L = legChain(side, leg, 'stand');
  const g = smooth(0.5, 1, k);
  const hang: V3 = [side * 21.5, 44, 1];
  const anklePt = L.map([side * 14.6, -38.5, 41.5]);
  const own: HandTarget = {
    at: vlerp(hang, anklePt, g),
    pole: vlerp([side * 0.6, -0.1, -0.8], [side * 0.7, 0.15, -1], g),
    fingers: vlerp([0, -1, 0], mapply(L.shin.rot, [-side * 0.9, 0, -0.35]), g),
    palm: vlerp([-side, 0, 0], mapply(L.shin.rot, [-side * 0.8, 0, -0.45]), g),
  };
  const other: HandTarget = { at: [-side * 22, 51, 6], pole: [-side * 0.6, -0.3, -0.7], fingers: [-side * 0.15, 0, 1], palm: DOWN };
  const pose: BodyPose = {
    stance: 'stand',
    legs: side < 0 ? { right: leg } : { left: leg },
    pelvis: -3 * k,
    neck: levelNeck(0, 0, t),
    breath,
    torso: idleTorso(t),
    hands: hands2(side, own, other),
  };
  const cam: Camera = { ...QUAD_CAM, yaw: yaw2(s, 80, -80) };
  const d = new Drawing(cam, id);
  drawChairBack(d, -side * 22);
  const rig = drawBody(d, pose, { chair: false });
  drawHead(d, rig.head, { faceless: true });
  const fig: Rendered = { d, rig };
  // Front of the thigh.
  limbPatch(d, L.map([side * 9.4, 14.6, 9]), L.map([side * 9.8, 13.8, 31]), 3.6, smooth(0.35, 1, k), 2);

  // Cue: hips press forward.
  const op = envelope(half, 2.6, 3.2, 5, 5.6) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) overlay = <Arrow a={sp(d, [0, 46, -18])} b={sp(d, [0, 46, -5])} opacity={r2(op)} />;
  return scene(fig, overlay, null);
}

export const standingQuad: Clip = {
  duration: TWO,
  still: 8 / TWO,
  cues: cues2('Hold the chair · right heel to glute', 'Hold the chair · left heel to glute', 'Knees together, hips forward · hold'),
  Scene: QuadScene,
};

// ---------------------------------------------------------------------------
// 4) Standing calf stretch — 40 s. Hands on the wall, one foot back with the heel down; lean in.
// ---------------------------------------------------------------------------

const CALF_CAM: Camera = { yaw: 0, pitch: 3, scale: 1.0, origin: pt(118, 150) };
const WALL_Z = 35;

function CalfScene({ t }: { t: number }) {
  const id = useId();
  const { s, half, side, k, breath, deep } = twoSided(t);
  const back: LegPose = { hip: -22 * k - deep, knee: 0, ankle: { pitch: 22 * k + deep } };
  const front: LegPose = { hip: 15 * k, knee: 41.7 * k, ankle: { pitch: -26.7 * k } };
  const Lb = legChain(side, back, 'stand');
  const Lf = legChain(-side, front, 'stand');
  const lean = 12 * k + 0.6 * deep;
  const hand = (h: number): HandTarget => ({ at: [h * 14, 87, WALL_Z - 3.5], pole: [h * 0.5, -1, 0.1], fingers: [0, 1, 0], palm: [0, 0, 1] });
  const pose: BodyPose = {
    stance: 'stand',
    legs: side < 0 ? { right: back, left: front } : { left: back, right: front },
    pelvis: lean,
    neck: levelNeck(lean, 0, t),
    breath,
    torso: idleTorso(t),
    hands: { left: hand(1), right: hand(-1) },
  };
  // Keep the back foot planted: shift the camera origin by that ankle's displacement.
  const a0 = legChain(side, {}, 'stand').ankle;
  const base: Camera = { ...CALF_CAM, yaw: yaw2(s, 92, -92) };
  const dvy = mapply(new Drawing(base).view, vsub(Lb.ankle, a0));
  const cam: Camera = { ...base, origin: pt(base.origin.x - dvy[0] * base.scale, base.origin.y + dvy[1] * base.scale) };
  const d = new Drawing(cam, id);
  // Wall edge in front of the figure.
  d.capsule([0, FLOOR_Y - 2, WALL_Z], [0, 150, WALL_Z], 2.2, C.chair);
  const rig = drawBody(d, pose, { chair: false });
  drawHead(d, rig.head, { faceless: true });
  const fig: Rendered = { d, rig };
  // Calf of the back leg.
  limbPatch(d, Lb.map([side * 10.2, -9, 34.6]), Lb.map([side * 10.5, -31, 36.2]), 3.2, smooth(0.35, 1, k), 2);
  const shadows = [Lb.ankle, Lf.ankle].map((a, i) => {
    const q = sp(d, a);
    return <FloorShadow key={i} cx={q.x} y={q.y + 5} rx={13} />;
  });

  // Cue: lean in toward the wall.
  const op = envelope(half, 1.2, 1.8, 3.4, 4.0) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) overlay = <Arrow a={sp(d, [0, 50, -20])} b={sp(d, [0, 50, -7])} opacity={r2(op)} />;
  return (
    <>
      {shadows}
      {scene(fig, overlay, null)}
    </>
  );
}

export const standingCalf: Clip = {
  duration: TWO,
  still: 8 / TWO,
  cues: cues2('Hands on the wall · right foot back, heel down', 'Hands on the wall · left foot back, heel down', 'Lean in · hold, breathe'),
  Scene: CalfScene,
};

// ---------------------------------------------------------------------------
// 5) Ankle circles — 30 s: right foot 15 s (5 circles each way), then left.
// ---------------------------------------------------------------------------

const AC_HALF = 15;
const AC_DUR = 30;
const AC_LIFT: readonly TK[] = [
  [0, 0],
  [0.2, 0],
  [1.3, 1],
  [12.4, 1],
  [13.4, 0],
  [AC_HALF, 0],
];
const AC_A = [1.5, 6.8] as const;
const AC_B = [7.2, 12.5] as const;
const AC_TURNS = 5;

/** Constant-speed progress 0..1 with sine-ramped velocity over the first/last `a` of the block. */
function cruise(u: number, a = 0.12): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const ramp = (x: number) => x / 2 - (a / (2 * Math.PI)) * Math.sin((Math.PI * x) / a);
  let v: number;
  if (u < a) v = ramp(u);
  else if (u > 1 - a) v = 1 - a - ramp(1 - u);
  else v = a / 2 + (u - a);
  return v / (1 - a);
}

function ankleTheta(half: number): { theta: number; dir: number } {
  for (const [blk, dir] of [[AC_A, 1], [AC_B, -1]] as const)
    if (half >= blk[0] && half <= blk[1]) return { theta: dir * 2 * Math.PI * AC_TURNS * cruise((half - blk[0]) / (blk[1] - blk[0])), dir };
  return { theta: 0, dir: 0 };
}

const AC_CAM: Camera = { yaw: 0, pitch: 12, scale: 1.15, origin: pt(118, 128) };

function AnkleScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * AC_DUR;
  const half = wrap(s, AC_HALF);
  const side = s < AC_HALF ? -1 : 1;
  const lift = track(half, AC_LIFT);
  const { theta, dir } = ankleTheta(half);
  const leg: LegPose = { hip: -9 * lift, knee: -40 * lift, ankle: { pitch: 17 * lift * Math.cos(theta), roll: 17 * lift * Math.sin(theta) } };
  const L = legChain(side, leg);
  const pose: BodyPose = {
    legs: side < 0 ? { right: leg } : { left: leg },
    neck: levelNeck(0, 6 * lift, t),
    breath: breathe(half, 5),
    torso: idleTorso(t),
    spine: spineFrom({ flex: 3 * lift }),
  };
  const yaw = track(s, [
    [0, 40],
    [13.5, 40],
    [14.9, -40],
    [AC_HALF + 13.5, -40],
    [AC_HALF + 14.9, 40],
    [AC_DUR, 40],
  ]);
  const fig = drawFigure(id, { ...AC_CAM, yaw }, pose, true);
  const d = fig.d;
  spotPatch(d, L.ankle, 4.2, lift, 2.5);

  // Cue: an arc around the foot, turning the way the circles go.
  let overlay: ReactNode = null;
  if (dir !== 0) {
    const blk = dir > 0 ? AC_A : AC_B;
    const op = envelope(half, blk[0] - 0.2, blk[0] + 0.4, blk[1] - 0.6, blk[1]) * 0.9;
    if (op > 0.01) {
      const c = sp(d, L.footPt([side * 10.9, -43.6, 47]));
      const sweep = 240;
      const from = dir > 0 ? 200 : 160;
      overlay = <ArcArrow c={c} r={17} from={from} to={from + dir * sweep} opacity={r2(op)} />;
    }
  }
  return scene(fig, overlay, null);
}

export const ankleCircles: Clip = {
  duration: AC_DUR,
  still: 4 / AC_DUR,
  cues: [
    [0, 'Lift right foot · circle slowly'],
    [AC_B[0] / AC_DUR, 'Now the other way'],
    [12.4 / AC_DUR, 'Lower'],
    [AC_HALF / AC_DUR, 'Lift left foot · circle slowly'],
    [(AC_HALF + AC_B[0]) / AC_DUR, 'Now the other way'],
    [(AC_HALF + 12.4) / AC_DUR, 'Lower'],
  ],
  Scene: AnkleScene,
};

// ---------------------------------------------------------------------------
// 6) Chest opener — 15 s rep. Hands clasped behind the back; lift them a little and open the chest.
// ---------------------------------------------------------------------------

const CO_CAM: Camera = { yaw: 46, pitch: 4, scale: 1.7, origin: pt(118, 196) };

function ChestOpenerScene({ t }: { t: number }) {
  const id = useId();
  const { s, k, breath, deep } = oneSided(t);
  const open = k + 0.08 * deep;
  const hand = (side: number): HandTarget => ({
    at: [side * 3.6, 12 + 9 * open, -15.5 - 3.5 * open],
    in: 'body',
    pole: [side * 0.9, -0.25, -0.55],
    fingers: [-side * 0.85, -0.45, -0.25],
    palm: [-side, 0, 0],
  });
  const pose: BodyPose = {
    shoulderShift: { left: -6 * open, right: -6 * open },
    shoulderLift: { left: -0.8 * open, right: -0.8 * open },
    thorax: 9 * open,
    neck: [{ pitch: -2 * open }, { pitch: -2 * open }, { pitch: -3 * open + 0.3 * wobble(t, 2.7, [2, 3]) }],
    breath,
    torso: idleTorso(t),
    hands: { left: hand(1), right: hand(-1) },
  };
  const fig = drawFigure(id, CO_CAM, pose);
  const d = fig.d;
  const rig = fig.rig;
  const onChest = (v: V3): V3 => vadd(rig.sternum, mapply(rig.torso.rot, v));
  for (const side of [1, -1]) limbPatch(d, onChest([side * 3.5, -11, 9.5]), onChest([side * 12.5, -14.5, 6.5]), 3.4, smooth(0.1, 0.8, k), 1.5);

  // Cue: the chest lifts and opens forward.
  const op = envelope(s, 0.6, 1.2, 2.4, 3.0) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) overlay = <Arrow a={sp(d, vadd(rig.sternum, [0, -10, 16]))} b={sp(d, vadd(rig.sternum, [0, -5, 28]))} opacity={r2(op)} />;
  return scene(fig, overlay);
}

export const chestOpener: Clip = {
  duration: ONE,
  still: 6 / ONE,
  cues: cues1('Clasp hands behind · lift them, open the chest', 'Hold · breathe into the chest'),
  Scene: ChestOpenerScene,
};

// ---------------------------------------------------------------------------
// 7) Cross-body shoulder stretch — 40 s. One arm across the chest, the other hand draws it in.
// ---------------------------------------------------------------------------

const XB_CAM: Camera = { yaw: 0, pitch: 4, scale: 1.8, origin: pt(120, 226) };

function CrossBodyScene({ t }: { t: number }) {
  const id = useId();
  const { s, half, side, k, breath, deep } = twoSided(t);
  const g = smooth(0, 1, k);
  const own = reachHand(side, {
    at: [-side * (24 + 1.5 * deep), 48, 14],
    pole: [0, -0.7, 0.9],
    fingers: [-side, 0, 0],
    palm: [0, 0, -1],
  }, g, [0, 10, 8]);
  const cam: Camera = { ...XB_CAM, yaw: yaw2(s, 8, -8) };
  const base: BodyPose = {
    shoulderShift: side > 0 ? { left: 2.5 * g } : { right: 2.5 * g },
    neck: [{}, {}, { pitch: 0.3 * wobble(t, 2.7, [2, 3]), roll: 0.25 * wobble(t, 4.4, [3, 4]) }],
    breath,
    torso: idleTorso(t),
    hands: hands2(side, own, undefined),
  };
  // Pre-pass to find the crossed arm's elbow, then put the other hand just above it.
  const pre = drawBody(new Drawing(cam, `${id}p`), base, { chair: false });
  const elbow = side > 0 ? pre.elbows.left : pre.elbows.right;
  const shoulder = side > 0 ? pre.shoulders.left : pre.shoulders.right;
  const grab = smooth(0.2, 1, k);
  const other = reachHand(-side, {
    at: vadd(elbow, [side * 4, 2, 5]),
    pole: [-side * 0.5, -0.9, 0.3],
    fingers: [side, 0.15, -0.3],
    palm: [0, -0.25, -1],
  }, grab, [0, 9, 8]);
  const fig = drawFigure(id, cam, { ...base, hands: hands2(side, own, other) });
  const d = fig.d;
  spotPatch(d, vadd(shoulder, [side * 1.5, -2.5, -3]), 4.5, smooth(0.25, 0.9, k), 1.5);

  // Cue: draw the arm across.
  const op = envelope(half, 2.4, 3.0, 4.6, 5.2) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) overlay = <Arrow a={sp(d, vadd(elbow, [side * 9, 5, 9]))} b={sp(d, vadd(elbow, [-side * 6, 5, 9]))} opacity={r2(op)} />;
  return scene(fig, overlay);
}

export const crossBodyShoulder: Clip = {
  duration: TWO,
  still: 8 / TWO,
  cues: cues2('Right arm across the chest · draw it in', 'Left arm across the chest · draw it in', 'Shoulder down · hold, breathe'),
  Scene: CrossBodyScene,
};

// ---------------------------------------------------------------------------
// 8) Overhead triceps stretch — 40 s. Hand drops behind the neck; the other hand eases the elbow back.
// ---------------------------------------------------------------------------

const TRI_CAM: Camera = { yaw: 0, pitch: 4, scale: 1.6, origin: pt(120, 230) };

function TricepsScene({ t }: { t: number }) {
  const id = useId();
  const { s, half, side, k, breath, deep } = twoSided(t);
  const g = smooth(0, 1, k);
  const own = reachHand(side, {
    at: [-side * 1.5, 50 - 1.5 * deep, -11],
    pole: [-side * 0.1, 1, -0.3],
    fingers: [-side * 0.2, -1, 0.1],
    palm: [0, 0, 1],
  }, g, [side * 6, 16, 18]);
  const cam: Camera = { ...TRI_CAM, yaw: yaw2(s, 8, -8) };
  const base: BodyPose = {
    neck: [{}, {}, { pitch: 0.3 * wobble(t, 2.7, [2, 3]), roll: 0.25 * wobble(t, 4.4, [3, 4]) }],
    breath,
    torso: idleTorso(t),
    hands: hands2(side, own, undefined),
  };
  const pre = drawBody(new Drawing(cam, `${id}p`), base, { chair: false });
  const elbow = side > 0 ? pre.elbows.left : pre.elbows.right;
  const shoulder = side > 0 ? pre.shoulders.left : pre.shoulders.right;
  const grab = smooth(0.3, 1, k);
  const other = reachHand(-side, {
    at: vadd(elbow, [-side * 2, 6, 3]),
    pole: [-side * 0.5, 1, 0.4],
    fingers: [side, -0.2, -0.2],
    palm: [side * 0.3, -0.3, -0.9],
  }, grab, [0, 12, 10]);
  const fig = drawFigure(id, cam, { ...base, hands: hands2(side, own, other) });
  const d = fig.d;
  limbPatch(d, vadd(shoulder, [0, -5, -3]), vadd(elbow, [0, 2.5, -2.5]), 3.2, smooth(0.3, 0.9, k), 2.2);

  // Cue: ease the elbow back.
  const op = envelope(half, 2.4, 3.0, 4.6, 5.2) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) overlay = <Arrow a={sp(d, vadd(elbow, [side * 10, 2, 14]))} b={sp(d, vadd(elbow, [side * 10, 2, 2]))} opacity={r2(op)} />;
  return scene(fig, overlay);
}

export const overheadTriceps: Clip = {
  duration: TWO,
  still: 8 / TWO,
  cues: cues2('Right hand behind the neck · ease the elbow back', 'Left hand behind the neck · ease the elbow back', 'Ribs down · hold, breathe'),
  Scene: TricepsScene,
};

// ---------------------------------------------------------------------------
// 9) Standing side bend — 40 s, seen from behind so the spine's curve reads. Opposite arm overhead.
// ---------------------------------------------------------------------------

const SB_CAM: Camera = { yaw: 180, pitch: 6, scale: 0.88, origin: pt(120, 160) };

function SideBendScene({ t }: { t: number }) {
  const id = useId();
  const { half, side, k, breath, deep } = twoSided(t);
  const bend = 34 * k + 2 * deep; // + = toward `side`
  const armSide = -side;
  const g = smooth(0, 1, k);
  const a = lerp(8, 174, g) / DEG;
  const dir: V3 = [armSide * Math.sin(a), -Math.cos(a), 0];
  const up: HandTarget = {
    at: vadd([armSide * 17.6, 53.2, -1.6], vscale(dir, 49)),
    in: 'body',
    pole: [armSide * 0.6, 0.2, -0.8],
    fingers: dir,
    palm: [-armSide, 0, 0],
  };
  const down: HandTarget = { at: [side * (20 - 5 * g), 44 - 14 * g, 2], pole: [side * 0.7, -0.3, -0.6], fingers: [0, -1, 0.1], palm: [-side, 0, 0] };
  const pose: BodyPose = {
    stance: 'stand',
    spine: spineFrom({ side: -side * bend }),
    neck: [{ roll: side * 0.2 * bend }, { roll: side * 0.15 * bend }, { roll: 0.25 * wobble(t, 4.4, [3, 4]) }],
    breath,
    torso: idleTorso(t),
    hands: hands2(side, down, up),
    highlight: { spine: 0.35 + 0.65 * smooth(0.1, 0.8, k) },
  };
  const fig = drawFigure(id, SB_CAM, pose);
  const d = fig.d;

  // Cue: an arc over the head, sweeping toward the bend side (from behind, the character's right is screen-right).
  const op = envelope(half, 0.8, 1.4, 3.0, 3.6) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) {
    const c = sp(d, fig.rig.pelvis.origin);
    const h = sp(d, fig.rig.head.origin);
    const r = Math.hypot(h.x - c.x, h.y - c.y) + 14;
    const dirn = side < 0 ? 1 : -1;
    overlay = <ArcArrow c={c} r={r} from={-dirn * 6} to={dirn * 30} opacity={r2(op)} />;
  }
  return scene(fig, overlay, null);
}

export const standingSideBend: Clip = {
  duration: TWO,
  still: 8 / TWO,
  cues: cues2('Left arm up · bend to the right', 'Right arm up · bend to the left', 'Feet planted · hold, breathe'),
  Scene: SideBendScene,
};

// ---------------------------------------------------------------------------
// 10) Upper back reach — 15 s rep. Fingers laced, palms pushed forward, upper back rounds, chin drops.
// ---------------------------------------------------------------------------

const UBR_CAM: Camera = { yaw: 112, pitch: 5, scale: 1.6, origin: pt(100, 186) };

function UpperBackReachScene({ t }: { t: number }) {
  const id = useId();
  const { s, k, then, breath, deep } = oneSided(t);
  const g = smooth(0, 0.95, k);
  const round = then + 0.1 * deep;
  const hand = (side: number): HandTarget => ({
    ...reachHand(side, { at: [side * 3.6, 50, 44], pole: [side * 0.3, -1, 0.1], fingers: [-side, 0, 0], palm: [0, 0, 1] }, g, [0, 6, 0]),
    in: 'body',
  });
  const pose: BodyPose = {
    pelvis: -5 * round,
    spine: segs3([3 * round, 9 * round, 15 * round]),
    shoulderShift: { left: 6 * round, right: 6 * round },
    neck: [{ pitch: 5 * round }, { pitch: 5 * round }, { pitch: 6 * round + 0.3 * wobble(t, 2.7, [2, 3]) }],
    breath,
    torso: idleTorso(t),
    hands: { left: hand(1), right: hand(-1) },
    highlight: { upperBack: smooth(0.1, 0.8, round), blades: 0.6 * smooth(0.1, 0.8, round) },
  };
  const fig = drawFigure(id, UBR_CAM, pose);
  const d = fig.d;

  // Cue: the upper back pushes out (arrow off the mid-upper back, pointing backward).
  const op = envelope(s, 1.4, 2.0, 3.4, 4.0) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) {
    const seg = fig.rig.spine[2];
    overlay = <Arrow a={sp(d, toWorld(seg, [0, 10, -16]))} b={sp(d, toWorld(seg, [0, 10, -27]))} opacity={r2(op)} />;
  }
  return scene(fig, overlay);
}

export const upperBackReach: Clip = {
  duration: ONE,
  still: 6 / ONE,
  cues: cues1('Lace fingers · push palms forward, round the upper back', 'Chin down · hold, breathe'),
  Scene: UpperBackReachScene,
};

// ---------------------------------------------------------------------------
// 11) Seated forward fold — 15 s rep. Fold from the hips, hands slide down the shins, head hangs.
// ---------------------------------------------------------------------------

const FOLD_CAM: Camera = { yaw: 100, pitch: 6, scale: 1.15, origin: pt(104, 128) };

function ForwardFoldScene({ t }: { t: number }) {
  const id = useId();
  const { s, k, breath, deep } = oneSided(t);
  const fold = clamp(k, 0, 1.06);
  const g = smooth(0.05, 1, k);
  const hand = (h: number): HandTarget => ({
    at: vlerp(REST_HAND(h), [h * 13.4, -14 - 2 * deep, 40.5], g),
    pole: vlerp(REST_POLE(h), [h * 0.75, -0.3, -0.5], g),
    fingers: vlerp(REST_FINGERS(h), [0, -1, 0.25], g),
    palm: vlerp(DOWN, [-h, 0, 0], g),
  });
  const legs: LegPose = { abduct: 8 };
  const pose: BodyPose = {
    legs: { left: legs, right: legs },
    pelvis: 38 * fold + 2 * deep,
    spine: spineFrom({ flex: 42 * fold + 2 * deep }),
    neck: [{ pitch: 6 * fold }, { pitch: 6 * fold }, { pitch: 6 * fold + 0.3 * wobble(t, 2.7, [2, 3]) }],
    breath,
    torso: idleTorso(t),
    hands: { left: hand(1), right: hand(-1) },
    highlight: { lowerBack: 0.35 + 0.65 * smooth(0.1, 0.8, k), spine: 0.5 * smooth(0.1, 0.8, k) },
  };
  const fig = drawFigure(id, FOLD_CAM, pose, true);
  const d = fig.d;

  // Cue: hinge forward and down about the hips.
  const op = envelope(s, 0.4, 1.0, 2.2, 2.8) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) {
    const c = sp(d, fig.rig.pelvis.origin);
    const f = sp(d, vadd(fig.rig.pelvis.origin, [0, 0, 10]));
    const right = f.x > c.x ? 1 : -1;
    overlay = <ArcArrow c={c} r={40} from={right * 4} to={right * 70} opacity={r2(op)} />;
  }
  return scene(fig, overlay, null);
}

export const seatedForwardFold: Clip = {
  duration: ONE,
  still: 6 / ONE,
  cues: cues1('Fold forward from the hips · hands down the shins', 'Hang heavy · hold, breathe', 'Roll up slowly'),
  Scene: ForwardFoldScene,
};

// ---------------------------------------------------------------------------

export const stretchClips: Record<string, Clip> = {
  'chest-opener': chestOpener,
  'cross-body-shoulder': crossBodyShoulder,
  'overhead-triceps': overheadTriceps,
  'upper-back-reach': upperBackReach,
  'standing-side-bend': standingSideBend,
  'seated-forward-fold': seatedForwardFold,
  'seated-figure-four': seatedFigureFour,
  'seated-hamstring': seatedHamstring,
  'standing-quad': standingQuad,
  'standing-calf': standingCalf,
  'ankle-circles': ankleCircles,
};
