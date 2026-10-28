import { useId, type ReactNode } from 'react';
import { Arrow, ArcArrow, C, CUE_COLOR, M, clamp, easeInOut, minJerk, pt, wobble, type Clip, type Ease, type P } from './engine';
import { Drawing, IDENTITY, mapply, toWorld, vadd, vlerp, type Camera, type V3 } from './rig3d';
import { FLOOR_Y, drawBody, legChain, spineFrom, type BodyPose, type BodyRig, type HandTarget, type LegPose, type NeckSeg, type SpineSeg } from './body3d';
import { drawHead } from './head3d';

// ---------------------------------------------------------------------------
// Back stretches on the pseudo-3D mannequin (seated; the back extension stands):
//   upper back — seated spinal twist, thoracic extension
//   lower back — pelvic tilt, seated cat-cow, knee-to-chest, standing back extension
//
// Same approach as neck.tsx: timelines authored in SECONDS (min-jerk segments), evaluated at
// s = (t mod 1) · duration so t = 0 and t = 1 are the same instant; breath, idle wobble and every
// periodic signal are continuous across the seam. Motion is distributed along the spine with a
// small lag between segments (the segment that initiates leads, the others follow 60–150 ms later).
//
// Conventions (rig3d / body3d): spine pitch + = flexion (rounding), yaw + = turn to the character's
// LEFT, pelvis + = anterior tilt. Camera yaw 90 sees the character's RIGHT side (facing screen-right);
// yaw > 90 moves the camera behind, so the back (and its cyan target patch) is in view.
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

interface Rendered {
  d: Drawing;
  rig: BodyRig;
}

/** Mannequin figure in the Relief tab cover style (faceless head, bare skin, cyan target patch). */
function drawFigure(id: string, cam: Camera, pose: BodyPose): Rendered {
  const d = new Drawing(cam, id);
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

/** Polyline cue with an arrowhead at its end. */
function CuePath({ pts, opacity }: { pts: P[]; opacity: number }) {
  if (pts.length < 2) return null;
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

const sp = (d: Drawing, v: V3): P => {
  const q = d.p(v);
  return pt(q.x, q.y);
};

/** Spine segments from per-segment values (each already lagged by the caller). */
const segs3 = (pitch: readonly number[], yaw: readonly number[] = [0, 0, 0], roll: readonly number[] = [0, 0, 0]) =>
  [0, 1, 2].map((i) => ({ pitch: pitch[i], yaw: yaw[i], roll: roll[i] })) as unknown as readonly [SpineSeg, SpineSeg, SpineSeg];

/** Neck chain that cancels a net upper-body pitch (+ = flexed) so the gaze stays level, plus an extra look. */
const levelNeck = (trunkPitch: number, look = 0, t = 0): [NeckSeg, NeckSeg, NeckSeg] => [
  { pitch: -0.4 * trunkPitch + 0.3 * look },
  { pitch: -0.35 * trunkPitch + 0.35 * look },
  { pitch: -0.25 * trunkPitch + 0.35 * look + 0.3 * wobble(t, 2.7, [2, 3]) },
];

// ---------------------------------------------------------------------------
// Cameras
// ---------------------------------------------------------------------------

/** Straight from behind and above: both sides read the same, the shoulder girdle turning over the hips. */
const TWIST_CAM: Camera = { yaw: 180, pitch: 24, scale: 1.75, origin: pt(120, 192) };
/** Profile from slightly behind (character faces screen-right): back curve + patch in view. */
const BACK_PROFILE: Camera = { yaw: 112, pitch: 5, scale: 1.65, origin: pt(108, 186) };
/** Thoracic extension: profile from a little behind, so the arch and the upper-back patch read. */
const TEXT_CAM: Camera = { yaw: 108, pitch: 6, scale: 1.6, origin: pt(112, 190) };
/** Wider profile for cat-cow (hands on the knees). */
const CATCOW_CAM: Camera = { yaw: 113, pitch: 6, scale: 1.55, origin: pt(100, 184) };
/**
 * Knee-to-chest: front ¾ from the character's right, a little above, so BOTH legs read as they
 * alternate (from a side profile the far knee hides behind the near leg).
 */
const KNEE_CAM: Camera = { yaw: 115, pitch: 8, scale: 1.2, origin: pt(112, 128) };

// ---------------------------------------------------------------------------
// 1) Seated spinal twist — 30 s: right side, then left (15 s each).
//
// Per side: rest 0.5 → rotate 2.5 s to 40° of thoracic/lumbar rotation (10/40/50 % lumbar → upper
// thoracic; the head leads and adds ~30° of neck rotation to look over the shoulder) → 10 s hold
// that deepens a little on each exhale → unwind 1.6 s → rest. The turn-side hand goes to the seat
// beside and just behind its hip, the other hand to the outside of the turn-side knee (no chair is
// drawn in this rear framing, so "hand on the back of the chair" becomes a hand on the seat behind).
// ---------------------------------------------------------------------------

const TWIST_DUR = 30;
const TWIST_HALF: readonly TK[] = [
  [0, 0],
  [0.5, 0],
  [3.0, 40],
  [13.0, 44, easeInOut],
  [14.6, 0],
  [15, 0],
];
/** Lag of [lumbar, lower thoracic, upper thoracic, head] — the head and shoulders lead. */
const TWIST_LAG = [0.16, 0.1, 0.05, 0] as const;
const TWIST_SHARE = [0.1, 0.4, 0.5] as const;

/** Signed twist (yaw, + = to the left) at second `sec`: right first (yaw −), then left. */
function twistAmount(sec: number): number {
  const s = wrap(sec, TWIST_DUR);
  return s < 15 ? -track(s, TWIST_HALF) : track(s - 15, TWIST_HALF);
}

/** Arms: 0..1 reach progress at second `sec` of the half (they move in after the turn starts, release first). */
const TWIST_ARMS: readonly TK[] = [
  [0, 0],
  [0.7, 0],
  [2.6, 1],
  [12.9, 1],
  [14.4, 0],
  [15, 0],
];

const BREATH_TWIST: readonly TK[] = [
  [0, 0.6, easeInOut],
  [0.5, 0.85, easeInOut],
  [3.0, 0.2, easeInOut],
  [5.2, 0.75, easeInOut],
  [7.6, 0.15, easeInOut],
  [9.8, 0.72, easeInOut],
  [12.6, 0.12, easeInOut],
  [14.6, 0.75, easeInOut],
  [15, 0.6, easeInOut],
];

function TwistScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * TWIST_DUR;
  const half = wrap(s, 15);
  const dirn = s < 15 ? -1 : 1; // yaw sign of the current side (right = −)
  const tot = twistAmount(s);
  const mag = Math.abs(tot) / 44;
  const breath = track(half, BREATH_TWIST);
  // Exhale deepens the hold a touch, inhale lengthens the spine.
  const deep = 1.2 * (0.5 - breath) * smooth(3, 4, half) * (1 - smooth(12.6, 13.2, half));
  const yaw = TWIST_SHARE.map((share, i) => (twistAmount(s - TWIST_LAG[i]) + dirn * deep) * share);
  const headYaw = twistAmount(s - TWIST_LAG[3]) * 0.75;
  const idle = idleTorso(t);
  const arm = track(half, TWIST_ARMS);
  // Lead hand (same side as the turn) goes to the seat beside and just behind its hip — out to the
  // side, so from behind it reads clearly instead of crossing the back; the other hand crosses to
  // the outside of the lead-side knee.
  const lead = dirn < 0 ? -1 : 1; // world x sign of the leading side (right = −x)
  const thigh = (side: number): V3 => [side * 11.6, 16.6, 23.5];
  // Same elbow pole as body3d's hands-on-thighs rest, so both sides start and end identically.
  const restPole = (side: number): V3 => [side * 0.55, -0.25, -1];
  const behind: V3 = [lead * 21, 2.5, -7];
  const knee: V3 = [lead * 13.5, 14.5, 35];
  const hands: BodyPose['hands'] = {};
  const set = (side: number, h: HandTarget) => {
    if (side > 0) hands.left = h;
    else hands.right = h;
  };
  // Reach back in an arc that passes outside the hip (up and around rather than through it).
  const back = vlerp(thigh(lead), behind, arm);
  const arc = Math.sin(Math.PI * arm);
  set(lead, {
    at: [back[0] + lead * 6 * arc, back[1] + 7 * arc, back[2]],
    pole: vlerp(restPole(lead), [lead * 1, 0.1, -0.35], smooth(0, 0.6, arm)),
    fingers: vlerp([-lead * 0.22, -0.12, 1], [lead * 0.25, -0.3, -1], smooth(0.35, 0.8, arm)),
    palm: [0, -1, 0],
  });
  set(-lead, {
    at: vlerp(thigh(-lead), knee, arm),
    pole: vlerp(restPole(-lead), [-lead * 0.6, -0.3, -1], arm),
    fingers: vlerp([lead * 0.22, -0.12, 1], [lead * 0.35, -0.5, 0.75], arm),
    palm: vlerp([0, -1, 0], [-lead * 0.8, -0.2, 0.2], smooth(0.5, 1, arm)),
  });
  const pose: BodyPose = {
    spine: segs3([0.6 * mag, 0.4 * mag, 0], yaw, [0, -dirn * 1.5 * mag, 0]),
    neck: [
      { yaw: headYaw * 0.2 },
      { yaw: headYaw * 0.3 },
      { yaw: headYaw * 0.5, pitch: 0.3 * wobble(t, 3.3, [2, 3]), roll: 0.3 * wobble(t, 6.1, [3, 4]) },
    ],
    breath,
    torso: idle,
    hands,
    highlight: { spine: 0.35 + 0.65 * smooth(0.1, 0.8, mag) },
  };
  // Fixed camera straight behind: the shoulders turn over the hips and the highlighted spine twists
  // into an S; the arm crossing to the far knee stays hidden behind the back.
  const fig = drawFigure(id, TWIST_CAM, pose);
  const d = fig.d;

  // Cue: an arc around the shoulders, sweeping the way the shoulders turn.
  const op = envelope(half, 0.5, 1.1, 2.6, 3.4) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) {
    const c = fig.rig.torso.origin;
    const pts: P[] = [];
    const a0 = Math.PI + dirn * 0.15; // start just past straight back
    for (let i = 0; i <= 16; i++) {
      const a = a0 + (dirn * (i / 16) * 70) / DEG;
      pts.push(sp(d, [c[0] + 27 * Math.sin(a), 66, c[2] + 27 * Math.cos(a)]));
    }
    overlay = <CuePath pts={pts} opacity={op} />;
  }
  return scene(fig, overlay);
}

export const spinalTwist: Clip = {
  duration: TWIST_DUR,
  still: 8 / TWIST_DUR,
  cues: [
    [0, 'Sit tall · twist right'],
    [3 / TWIST_DUR, 'Hold · breathe, twist a little more', true],
    [13 / TWIST_DUR, 'Unwind to center'],
    [15 / TWIST_DUR, 'Sit tall · twist left'],
    [18 / TWIST_DUR, 'Hold · breathe, twist a little more', true],
    [28 / TWIST_DUR, 'Unwind to center'],
  ],
  Scene: TwistScene,
};

// ---------------------------------------------------------------------------
// 2) Thoracic extension — 6 s per rep (5 reps in 30 s).
//
// Fingers laced behind the head (wrists behind the ears, elbows wide and drawn back), sitting at
// the edge of the seat. rest 0.4 → arch the upper back 1.5 s (extension mostly in the thoracic
// segments, upper leading; the neck follows into a gentle look up) → 3 s hold that eases a touch
// further → return 1 s → rest. Inhale while lifting, a slow exhale through the hold and return.
// ---------------------------------------------------------------------------

const TEXT_DUR = 6;
const TEXT: readonly TK[] = [
  [0, 0],
  [0.4, 0],
  [1.9, 0.9],
  [4.9, 1, easeInOut],
  [5.9, 0],
  [6, 0],
];
const TEXT_LAG = [0.12, 0.06, 0, 0.1] as const; // lumbar, lower thoracic, upper thoracic, neck
const TEXT_BREATH: readonly TK[] = [
  [0, 0.3, easeInOut],
  [0.4, 0.25, easeInOut],
  [1.9, 0.95, easeInOut],
  [4.9, 0.4, easeInOut],
  [5.9, 0.25, easeInOut],
  [6, 0.3, easeInOut],
];

function ThoracicScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * TEXT_DUR;
  const u = (lag: number) => track(wrap(s - lag, TEXT_DUR), TEXT);
  const k = u(0);
  const ext = [-4 * u(TEXT_LAG[0]), -10 * u(TEXT_LAG[1]), -14 * u(TEXT_LAG[2])];
  const idle = idleTorso(t);
  const look = -12 * u(TEXT_LAG[3]);
  // Head-local wrist targets: just behind the ears, so the forearms frame the back of the skull
  // and the elbows open out to the sides and slightly back (never across the face).
  const hand = (side: number): HandTarget => ({
    at: [side * 9.2, 7, -9.5],
    in: 'head',
    pole: [side * 0.8, 0.7, -0.9 - 0.2 * k],
    fingers: [-side * 0.75, 0.1, -0.65],
    palm: [-side * 0.6, 0, 0.8],
  });
  const pose: BodyPose = {
    pelvis: 3 * k,
    spine: segs3(ext),
    // Neck keeps the head in line with the upper back, then adds a gentle look up.
    neck: [{ pitch: 0.3 * look }, { pitch: 0.35 * look }, { pitch: 0.35 * look + 0.3 * wobble(t, 2.7, [2, 3]) }],
    breath: track(s, TEXT_BREATH),
    torso: idle,
    shoulderShift: { left: -1.5 - 2 * k, right: -1.5 - 2 * k },
    hands: { left: hand(1), right: hand(-1) },
    highlight: { upperBack: smooth(0.1, 0.8, k) },
  };
  const fig = drawFigure(id, TEXT_CAM, pose);
  const d = fig.d;

  // Cue: an arc behind the upper back, centred on the thoracolumbar junction, bending backward.
  const op = envelope(s, 0.2, 0.5, 1.4, 2.0) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) {
    const c = sp(d, fig.rig.spine[1].origin);
    const top = sp(d, toWorld(fig.rig.spine[2], [0, 22, -24]));
    const ang = Math.atan2(top.x - c.x, -(top.y - c.y)) * DEG;
    const r = Math.hypot(top.x - c.x, top.y - c.y);
    overlay = <ArcArrow c={c} r={r} from={ang + 6} to={ang - 22} opacity={r2(op)} />;
  }
  return scene(fig, overlay);
}

export const thoracicExtension: Clip = {
  duration: TEXT_DUR,
  still: 3.4 / TEXT_DUR,
  cues: [
    [0, 'Hands behind head · lift chest, arch back'],
    [1.9 / TEXT_DUR, 'Hold · look up, breathe', true],
    [4.9 / TEXT_DUR, 'Return'],
  ],
  Scene: ThoracicScene,
};

// ---------------------------------------------------------------------------
// 3) Seated pelvic tilt — 6 s per rep (5 reps in 30 s).
//
// neutral → tilt the pelvis forward 1.6 s (lumbar arches, chest lifts slightly) → pause 0.6 →
// roll it back 2 s (lumbar rounds, chest stays over the hips) → pause 0.6 → neutral 1.2 s.
// The pelvis initiates; the lumbar and thoracic segments follow 60–140 ms later and mostly
// compensate, so the head barely moves (the neck keeps the gaze level).
// ---------------------------------------------------------------------------

const TILT_DUR = 6;
const TILT: readonly TK[] = [
  [0, 0],
  [0.2, 0],
  [1.8, 1],
  [2.4, 1],
  [4.4, -1],
  [5.0, -1],
  [6, 0],
];
const TILT_BREATH: readonly TK[] = [
  [0, 0.45, easeInOut],
  [1.8, 0.9, easeInOut],
  [2.4, 0.85, easeInOut],
  [4.4, 0.12, easeInOut],
  [5.0, 0.15, easeInOut],
  [6, 0.45, easeInOut],
];

function tiltPose(s: number, t: number): BodyPose {
  const u = (lag: number) => track(wrap(s - lag, TILT_DUR), TILT);
  const p = u(0);
  // Anterior: the lumbar arches but only partly compensates, so the chest rises a little forward.
  // Posterior: the lumbar and lower thoracic round and the upper body sinks back slightly.
  const signed = (v: number, fwd: number, bwd: number) => (v >= 0 ? v * fwd : -v * bwd);
  const pelvis = signed(p, 22, -20);
  const lumbar = signed(u(0.06), -13, 11);
  const lowT = signed(u(0.12), -3.5, 7);
  const upT = signed(u(0.16), 0, 2);
  const net = pelvis + lumbar + lowT + upT;
  const pos = Math.max(0, -p);
  return {
    pelvis,
    spine: segs3([lumbar, lowT, upT]),
    neck: levelNeck(net, 0, t),
    breath: track(s, TILT_BREATH),
    torso: idleTorso(t),
    highlight: { lowerBack: 0.55 + 0.45 * smooth(0.1, 0.9, Math.max(pos, 0.6 * Math.max(0, p))) },
  };
}

function PelvicTiltScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * TILT_DUR;
  const fig = drawFigure(id, BACK_PROFILE, tiltPose(s, t));
  const d = fig.d;

  // Cue: a rocking arc behind the pelvis (anterior = top of the pelvis rolls forward).
  const fwd = envelope(s, 0.2, 0.6, 1.4, 1.9);
  const bwd = envelope(s, 2.4, 2.8, 3.9, 4.5);
  let overlay: ReactNode = null;
  const c = sp(d, fig.rig.pelvis.origin);
  // Screen direction of "forward" decides which way is clockwise.
  const f = sp(d, vadd(fig.rig.pelvis.origin, [0, 0, 10]));
  const right = f.x > c.x ? 1 : -1;
  const back = right > 0 ? 270 : 90;
  const r = 27;
  if (fwd > 0.01) overlay = <ArcArrow c={c} r={r} from={back - right * 40} to={back + right * 22} opacity={r2(0.9 * fwd)} />;
  else if (bwd > 0.01) overlay = <ArcArrow c={c} r={r} from={back + right * 22} to={back - right * 40} opacity={r2(0.9 * bwd)} />;
  return scene(fig, overlay);
}

export const pelvicTilt: Clip = {
  duration: TILT_DUR,
  still: 3.8 / TILT_DUR,
  cues: [
    [0, 'Tilt pelvis forward · arch low back'],
    [2.4 / TILT_DUR, 'Tilt back · round low back'],
    [5 / TILT_DUR, 'Back to neutral'],
  ],
  Scene: PelvicTiltScene,
};

// ---------------------------------------------------------------------------
// 4) Seated cat-cow — 40/6 ≈ 6.67 s per cycle (6 slow cycles in 40 s).
//
// Hands on the knees. Inhale: cow 2.0 s — pelvis tips forward first, the arch travels up the spine,
// chest forward, shoulders back, a gentle look up; pause 0.6. Exhale: cat 2.6 s — pelvis tucks, the
// whole spine rounds from the bottom up, shoulders round, chin drops; pause 0.6; back to neutral 0.8 s.
// ---------------------------------------------------------------------------

const CC_DUR = 40 / 6;
const CC: readonly TK[] = [
  [0, 0],
  [0.25, 0],
  [2.25, 1],
  [2.85, 1],
  [5.45, -1],
  [6.0, -1],
  [CC_DUR, 0],
];
const CC_BREATH: readonly TK[] = [
  [0, 0.45, easeInOut],
  [0.25, 0.4, easeInOut],
  [2.25, 0.95, easeInOut],
  [2.85, 0.92, easeInOut],
  [5.45, 0.08, easeInOut],
  [6.0, 0.1, easeInOut],
  [CC_DUR, 0.45, easeInOut],
];
/** Lag up the spine: pelvis, lumbar, lower thoracic, upper thoracic, neck. */
const CC_LAG = [0, 0.07, 0.14, 0.2, 0.28] as const;

function CatCowScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * CC_DUR;
  const u = (i: number) => track(wrap(s - CC_LAG[i], CC_DUR), CC);
  // Positive = cow (extension), negative = cat (flexion); flexion range is larger than extension.
  const amt = (i: number, cow: number, cat: number) => {
    const v = u(i);
    return v >= 0 ? v * cow : -v * cat;
  };
  const pelvis = amt(0, 20, -15);
  const spine = [amt(1, -14, 14), amt(2, -8, 12), amt(3, -5, 10)];
  const neckU = u(4);
  const cow = Math.max(0, u(0));
  const cat = Math.max(0, -u(0));
  const idle = idleTorso(t);
  const handOnKnee = (side: number): HandTarget => ({
    at: [side * 10.6, 13.8, 37.5],
    pole: [side * 0.75, -0.1, -1],
    fingers: [-side * 0.15, -0.55, 1],
    palm: [0, -1, -0.25],
  });
  const pose: BodyPose = {
    pelvis,
    spine: segs3(spine),
    // Cow: look gently up; cat: chin toward the chest.
    neck: neckU >= 0
      ? [{ pitch: -4 * neckU }, { pitch: -4 * neckU }, { pitch: -5 * neckU }]
      : [{ pitch: -10 * neckU }, { pitch: -8 * neckU }, { pitch: -6 * neckU }],
    breath: track(s, CC_BREATH),
    torso: idle,
    shoulderShift: { left: -2.5 * cow + 3.5 * cat, right: -2.5 * cow + 3.5 * cat },
    hands: { left: handOnKnee(1), right: handOnKnee(-1) },
    highlight: { spine: 0.55 + 0.45 * smooth(0.1, 0.9, Math.max(cat, 0.7 * cow)) },
  };
  const fig = drawFigure(id, CATCOW_CAM, pose);
  const d = fig.d;

  // Cue: an arrow off the mid back — pushing the back out (cat) or drawing it in (cow).
  const opCow = envelope(s, 0.25, 0.6, 1.7, 2.3);
  const opCat = envelope(s, 2.85, 3.2, 4.8, 5.4);
  let overlay: ReactNode = null;
  if (opCow > 0.01 || opCat > 0.01) {
    const mid = fig.rig.spine[1];
    const near = sp(d, toWorld(mid, [0, 6, -16]));
    const far = sp(d, toWorld(mid, [0, 6, -27]));
    overlay =
      opCow > opCat ? (
        <Arrow a={far} b={near} opacity={r2(0.9 * opCow)} />
      ) : (
        <Arrow a={near} b={far} opacity={r2(0.9 * opCat)} />
      );
  }
  return scene(fig, overlay);
}

export const catCow: Clip = {
  duration: CC_DUR,
  still: 5.6 / CC_DUR,
  cues: [
    [0, 'Inhale · arch, chest forward'],
    [2.85 / CC_DUR, 'Exhale · round, chin in'],
    [6 / CC_DUR, 'Back to neutral'],
  ],
  Scene: CatCowScene,
};

// ---------------------------------------------------------------------------
// 5) Seated knee-to-chest — 40 s: right knee, then left (20 s each), as the routine runs it.
//
// Per side: settle 0.8 → lift the knee 2 s (hip flexion 0 → 58°, knee bends so the shin hangs),
// the hands slide from the thigh to the front of the shin → 10 s hold, hugging the knee a little
// closer on each exhale (pelvis tucks, lower back rounds slightly) → release the hands, lower 1.8 s
// → rest with both feet down, breathing, before switching legs.
// ---------------------------------------------------------------------------

const KTC_DUR = 40;
const KTC_HALF = 20;
const KTC_LEG: readonly TK[] = [
  [0, 0],
  [0.8, 0],
  [2.8, 58],
  [12.8, 64, easeInOut],
  [14.6, 0],
  [KTC_HALF, 0],
];
const KTC_HANDS: readonly TK[] = [
  [0, 0],
  [1.4, 0],
  [2.9, 1],
  [12.7, 1],
  [13.8, 0],
  [KTC_HALF, 0],
];
const KTC_BREATH: readonly TK[] = [
  [0, 0.45, easeInOut],
  [0.8, 0.75, easeInOut],
  [2.8, 0.25, easeInOut],
  [5.0, 0.75, easeInOut],
  [7.6, 0.15, easeInOut],
  [9.9, 0.75, easeInOut],
  [12.6, 0.15, easeInOut],
  [14.6, 0.7, easeInOut],
  [17.3, 0.2, easeInOut],
  [KTC_HALF, 0.45, easeInOut],
];

/** Camera yaw over the 40 s loop: rear-¾ on the lifting side; orbits behind the back while both feet are down. */
const KTC_YAW: readonly TK[] = [
  [0, 115],
  [15.4, 115],
  [19.6, 245],
  [35.4, 245],
  [39.6, 115],
  [KTC_DUR, 115],
];

/** A plain stool (seat pad + four legs), painted behind the body: full-figure framing needs something to sit on. */
export function drawStool(d: Drawing) {
  const BACK = -1e3;
  for (const x of [-1, 1])
    for (const z of [-1, 1]) d.capsule([x * 11, -5, 2 + z * 10], [x * 13.5, FLOOR_Y + 1.2, 2 + z * 12.5], 1.5, C.chairShade, BACK);
  d.capsule([-12.4, -30, 13], [12.4, -30, 13], 1, C.chairShade, BACK + 1);
  d.ellipsoid({ origin: [0, -3.4, 2], rot: IDENTITY }, [17.5, 3.4, 16.5], C.chairShade, BACK + 2);
  d.ellipsoid({ origin: [0, -2.4, 2], rot: IDENTITY }, [16.5, 2.4, 15.5], C.chair, BACK + 3);
}

function KneeScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * KTC_DUR;
  const half = wrap(s, KTC_HALF);
  const side = s < KTC_HALF ? -1 : 1; // right knee first (−x)
  const hip = track(half, KTC_LEG);
  const lift = hip / 64;
  const breath = track(half, KTC_BREATH);
  const hug = (0.45 - breath) * smooth(2.8, 3.8, half) * (1 - smooth(12.2, 12.8, half)); // exhale → closer
  const leg: LegPose = { hip: hip + 3 * hug, knee: 0.95 * hip + 2 * hug, abduct: 3 * lift };
  const L = legChain(side, leg);
  const grip = track(half, KTC_HANDS);
  // Hands: from resting on the thighs (they ride up with the lifting thigh) to clasped just below the knee.
  const hand = (h: number): HandTarget => {
    const own = h === side;
    const rest: V3 = [h * 11.6, 16.6, 23.5];
    const onThigh = own ? L.map(rest) : rest;
    const clasp = L.map([side * 10 + (own ? side * 5.6 : -side * 5.2), -3.5, 42.5]);
    const at = vlerp(onThigh, clasp, grip);
    return {
      at: grip < 1 ? vadd(at, [0, 6 * Math.sin(Math.PI * grip), 2 * Math.sin(Math.PI * grip)]) : at,
      pole: [h * 0.85, -0.3, -0.6],
      fingers: vlerp([-h * 0.22, -0.12, 1], mapply(L.shin.rot, [own ? -side * 1 : side * 1, -0.1, 0.6]), grip),
      palm: vlerp([0, -1, 0], mapply(L.shin.rot, [own ? -side : side, 0, 0.1]), grip),
    };
  };
  const pose: BodyPose = {
    legs: side < 0 ? { right: leg } : { left: leg },
    pelvis: -7 * lift - 1.5 * hug,
    spine: segs3([7 * lift + 1.5 * hug, 3 * lift, 0], [0, 0, 0], [side * 1.5 * lift, 0, 0]),
    neck: levelNeck(-7 * lift + 10 * lift, 0, t),
    breath,
    torso: idleTorso(t),
    hands: { left: hand(1), right: hand(-1) },
    highlight: { lowerBack: 0.35 + 0.65 * smooth(0.2, 0.9, lift) },
  };
  const cam: Camera = { ...KNEE_CAM, yaw: track(s, KTC_YAW) };
  const d = new Drawing(cam, id);
  drawStool(d);
  const rig = drawBody(d, pose, { chair: false });
  drawHead(d, rig.head, { faceless: true });
  const fig: Rendered = { d, rig };

  // Cue: an arc in front of the lifting knee, about the hip, sweeping up toward the chest — the same
  // path the knee travels, but outside the shin so it never crosses the hands.
  const op = envelope(half, 0.6, 1.0, 2.4, 3.0) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) {
    const pts: P[] = [];
    const r = 56;
    for (let i = 0; i <= 14; i++) {
      const a = (-8 + (60 * i) / 14) / DEG;
      pts.push(sp(d, [side * 12, 7.5 + r * Math.sin(a), -1 + r * Math.cos(a)]));
    }
    overlay = <CuePath pts={pts} opacity={op} />;
  }
  return scene(fig, overlay, null);
}

export const kneeToChest: Clip = {
  duration: KTC_DUR,
  still: 7 / KTC_DUR,
  cues: [
    [0, 'Lift right knee toward chest'],
    [2.8 / KTC_DUR, 'Hold with both hands · breathe', true],
    [12.8 / KTC_DUR, 'Lower · relax'],
    [20 / KTC_DUR, 'Lift left knee toward chest'],
    [22.8 / KTC_DUR, 'Hold with both hands · breathe', true],
    [32.8 / KTC_DUR, 'Lower · relax'],
  ],
  Scene: KneeScene,
};

// ---------------------------------------------------------------------------
// 6) Standing back extension — 5 s per rep (5 reps in the 25 s routine, "repeat 5 times").
//
// Standing, hands on the lower back (fingers down, thumbs forward round the waist). rest 0.2 → push
// the hips slightly forward and arch back 1.3 s (inhale): extension mostly lumbar, some thoracic, the
// head following into a look up → 2.6 s hold ("3 s" countdown) → return to neutral 0.8 s (exhale).
// The feet stay planted: the hips travel forward over them as the hip joints extend.
// ---------------------------------------------------------------------------

const BEXT_DUR = 5;
const BEXT: readonly TK[] = [
  [0, 0],
  [0.2, 0],
  [1.5, 0.92],
  [4.1, 1, easeInOut],
  [4.9, 0],
  [5, 0],
];
const BEXT_BREATH: readonly TK[] = [
  [0, 0.35, easeInOut],
  [0.2, 0.3, easeInOut],
  [1.5, 0.92, easeInOut],
  [2.9, 0.45, easeInOut],
  [4.1, 0.7, easeInOut],
  [4.9, 0.3, easeInOut],
  [5, 0.35, easeInOut],
];
/** Full standing figure in profile from a little behind (character faces screen-right). */
const STAND_CAM: Camera = { yaw: 118, pitch: 4, scale: 1.04, origin: pt(116, 145) };

function BackExtScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * BEXT_DUR;
  const u = (lag: number) => track(wrap(s - lag, BEXT_DUR), BEXT);
  const k = u(0);
  // Hips forward: the hip joints extend a few degrees (the knees soften a touch), the whole body is
  // shifted so the feet stay planted, and the trunk arches back over them.
  const leg: LegPose = { hip: -6 * k, knee: 3 * k };
  const ext = spineFrom({ flex: -21 * u(0.05) });
  // Heels of the hands at the sides of the low back (fingers down and in), so the lumbar spine and
  // its highlight stay in view between them.
  const hand = (side: number): HandTarget => ({
    at: [side * 13.2, 17, -10],
    in: 'body',
    pole: [side * 0.8, 0.1, -1],
    fingers: [-side * 0.45, -1, -0.1],
    palm: [-side * 0.6, 0, 0.8],
  });
  const look = -14 * u(0.12);
  const pose: BodyPose = {
    stance: 'stand',
    legs: { left: leg, right: leg },
    pelvis: -3 * k,
    spine: ext,
    neck: [{ pitch: 0.3 * look }, { pitch: 0.35 * look }, { pitch: 0.35 * look + 0.3 * wobble(t, 2.7, [2, 3]) }],
    breath: track(s, BEXT_BREATH),
    torso: idleTorso(t),
    shoulderShift: { left: -2.5, right: -2.5 },
    hands: { left: hand(1), right: hand(-1) },
    highlight: { lowerBack: 0.3 + 0.7 * smooth(0.1, 0.8, k) },
  };
  // Keep the feet planted: shift the camera origin by the ankles' displacement.
  const a0 = legChain(-1, {}, 'stand').ankle;
  const a1 = legChain(-1, leg, 'stand').ankle;
  const view = new Drawing(STAND_CAM).view;
  const dv = mapply(view, [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]]);
  const cam: Camera = { ...STAND_CAM, origin: pt(STAND_CAM.origin.x - dv[0] * STAND_CAM.scale, STAND_CAM.origin.y + dv[1] * STAND_CAM.scale) };
  const fig = drawFigure(id, cam, pose);
  const d = fig.d;

  // Cue: arc over the chest, centred on the lumbar spine, bending backward.
  const op = envelope(s, 0.2, 0.5, 1.4, 2.0) * 0.9;
  let overlay: ReactNode = null;
  if (op > 0.01) {
    const c = sp(d, fig.rig.spine[0].origin);
    const top = sp(d, toWorld(fig.rig.spine[2], [0, 30, -16]));
    const ang = Math.atan2(top.x - c.x, -(top.y - c.y)) * DEG;
    const r = Math.hypot(top.x - c.x, top.y - c.y);
    overlay = <ArcArrow c={c} r={r} from={ang - 4} to={ang - 26} opacity={r2(op)} />;
  }
  return scene(fig, overlay, null);
}

export const backExtension: Clip = {
  duration: BEXT_DUR,
  still: 3 / BEXT_DUR,
  cues: [
    [0, 'Stand · hands on low back, arch back, look up'],
    [1.5 / BEXT_DUR, 'Hold', true],
    [4.1 / BEXT_DUR, 'Return to neutral'],
  ],
  Scene: BackExtScene,
};

// Re-exported for the lead's convenience when wiring ids.
export const backClips = {
  'spinal-twist': spinalTwist,
  'thoracic-extension': thoracicExtension,
  'pelvic-tilt': pelvicTilt,
  'cat-cow': catCow,
  'knee-to-chest': kneeToChest,
  'standing-back-extension': backExtension,
} as const;
