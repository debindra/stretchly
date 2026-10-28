import { useId, type ReactNode } from 'react';
import { Arrow, CUE_COLOR, M, clamp, easeInOut, minJerk, pt, wobble, type Clip, type Ease, type P } from './engine';
import { Drawing, child, mapply, toWorld, vadd, type Camera, type V3 } from './rig3d';
import { drawBody, type BodyPose, type BodyRig, type NeckSeg } from './body3d';
import { HEAD, drawHead } from './head3d';

// ---------------------------------------------------------------------------
// Neck stretches on the pseudo-3D rig: lateral flexion (tilt), axial rotation
// and chin tuck (retraction).
//
// Choreography is authored in SECONDS on a per-clip timeline and evaluated at
// s = (t mod 1) · duration, so t = 0 and t = 1 are the same instant. Every
// periodic signal (breath, blinks, idle wobble) is built to be continuous
// across the loop seam.
//
// Conventions (rig3d): roll + = ear toward character's RIGHT shoulder,
// yaw + = face turns to character's LEFT (so "turn right" is yaw −),
// pitch + = flexion (chin down). Person's right = viewer's left in front view.
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
const DEG = 180 / Math.PI;

/** Idle torso life (≤ ~0.6°), loop-safe. */
function idleTorso(t: number) {
  return {
    sway: 0.45 * wobble(t, 1.3, [1, 2, 3]),
    lean: 0.35 * wobble(t, 2.1, [1, 2]),
    twist: 0.3 * wobble(t, 0.7, [1, 3]),
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

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

/** Painter-sorted figure, faded out toward the bottom edge like a bust, plus cue overlay on top. */
function scene(fig: Rendered, overlay: ReactNode) {
  const fade = fig.d.uid('fade');
  return (
    <>
      <defs>
        <linearGradient id={`${fade}-g`} gradientUnits="userSpaceOnUse" x1="0" y1="160" x2="0" y2="200">
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

// ---------------------------------------------------------------------------
// Cameras
// ---------------------------------------------------------------------------

const FRONT: Camera = { yaw: 0, pitch: 5, scale: 2.2, origin: pt(120, 252) };
const PROFILE: Camera = { yaw: 84, pitch: 2, scale: 2.2, origin: pt(112, 250) };

// ---------------------------------------------------------------------------
// 1) Neck tilt (lateral flexion) — 12 s: right, then left.
//
// Per side (6 s): rest 0.4 → ease into the tilt over 1.8 s (34°) → hold 2.6 s while the
// stretch softens to 38° → return 1.0 s → rest 0.2.
// Distribution lower/mid/upper = 35/35/30 %, upper segment leading by ~80 ms (the head
// initiates, the lower neck follows). Small coupled rotation in the lower cervical spine is
// cancelled in the upper cervical spine so the face keeps looking forward.
// ---------------------------------------------------------------------------

const TILT_DUR = 12;
const TILT_HALF: readonly TK[] = [
  [0, 0],
  [0.4, 0],
  [2.2, 34],
  [4.8, 38, easeInOut],
  [5.8, 0],
  [6, 0],
];
const TILT_SHARE = [0.35, 0.35, 0.3] as const;
const TILT_LAG = [0.1, 0.05, 0] as const;

/** Signed total tilt in degrees (+ = right) at second `sec` (wrapped). */
function tiltAmount(sec: number): number {
  const s = wrap(sec, TILT_DUR);
  return s < 6 ? track(s, TILT_HALF) : -track(s - 6, TILT_HALF);
}

/** Breath shared by the two 6 s halves: exhale into the stretch, a calm breath in the hold, inhale on return. */
const BREATH_HALF_6: readonly TK[] = [
  [0, 0.88, easeInOut],
  [0.4, 0.9, easeInOut],
  [2.2, 0.12, easeInOut],
  [3.5, 0.62, easeInOut],
  [4.8, 0.15, easeInOut],
  [5.8, 0.82, easeInOut],
  [6, 0.88, easeInOut],
];
const breath6 = (sec: number) => track(wrap(sec, 6), BREATH_HALF_6);

function TiltScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * TILT_DUR;
  const tot = tiltAmount(s);
  const segs = TILT_SHARE.map((share, i) => tiltAmount(s - TILT_LAG[i]) * share);
  const k = tot / 38; // −1..1 signed depth
  const mag = Math.abs(k);
  // Lower cervical couples rotation toward the tilt side (yaw − for a right tilt);
  // the upper cervical counter-rotates so the face stays forward.
  const couple = 0.12;
  const micro = 0.35 * mag;
  const neck: [NeckSeg, NeckSeg, NeckSeg] = [
    { roll: segs[0], yaw: -couple * segs[0] },
    { roll: segs[1], pitch: 0.6 * mag },
    { roll: segs[2] + micro * wobble(t, 4.2, [2, 3]), yaw: couple * segs[0], pitch: -0.4 * mag + 0.3 * wobble(t, 5.1, [3, 4]) },
  ];
  const idle = idleTorso(t);
  const pose: BodyPose = {
    neck,
    breath: breath6(s),
    // Shoulder on the stretched side (opposite the tilt) settles down; the other rests.
    shoulderLift: { left: -1.3 * Math.max(0, k), right: -1.3 * Math.max(0, -k) },
    // Trunk counter-sways slightly away from the tilt to stay balanced.
    torso: { sway: -1.3 * k + idle.sway, lean: idle.lean, twist: idle.twist },
    // The stretch is felt on the side away from the tilt.
    highlight: { left: smooth(0.15, 0.85, Math.max(0, k)), right: smooth(0.15, 0.85, Math.max(0, -k)) },
  };
  const fig = drawFigure(id, FRONT, pose);

  // Cue: arc concentric with the lower neck, just outside the crown's path, leading it.
  const base = fig.d.p(fig.rig.neck[0].origin);
  const crown = fig.d.p(toWorld(fig.rig.head, [0, HEAD.crownY, -1]));
  const crownAng = (Math.atan2(crown.x - base.x, -(crown.y - base.y)) * DEG);
  const side = Math.sign(tot) || 1; // + right (screen: counter-clockwise)
  const phase = wrap(s, 6);
  const op = phase < 0.4 ? 0 : phase < 1 ? smooth(0.4, 1, phase) : 1 - smooth(3.6, 4.6, phase);
  const r = Math.hypot(crown.x - base.x, crown.y - base.y) + 8;
  const from = crownAng - side * 7;
  const to = crownAng - side * (10 + 30 * (1 - 0.4 * mag));
  return scene(fig, op > 0.01 && <TiltArc c={base} r={r} from={from} to={to} opacity={op * 0.9} />);
}

function TiltArc({ c, r, from, to, opacity }: { c: P; r: number; from: number; to: number; opacity: number }) {
  const n = 14;
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (from + ((to - from) * i) / n) / DEG;
    pts.push(pt(c.x + Math.sin(a) * r, c.y - Math.cos(a) * r));
  }
  return <CuePath pts={pts} opacity={opacity} />;
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

export const neckTilt: Clip = {
  duration: TILT_DUR,
  still: 3.6 / TILT_DUR,
  cues: [
    [0, 'Tilt right · ear toward shoulder'],
    [2.2 / TILT_DUR, 'Hold · breathe out, shoulders down', true],
    [4.8 / TILT_DUR, 'Back to center'],
    [6 / TILT_DUR, 'Tilt left · ear toward shoulder'],
    [8.2 / TILT_DUR, 'Hold · breathe out, shoulders down', true],
    [10.8 / TILT_DUR, 'Back to center'],
  ],
  Scene: TiltScene,
};

// ---------------------------------------------------------------------------
// 2) Neck rotation — 12 s: turn right, then left.
//
// Per side (6 s): the head turns over 1.7 s to 66°, then eases on to 70° during the hold;
// return 1.1 s. Distribution lower/mid/upper = 20/30/50 % (C1–C2 does most of the work),
// lower segments lagging slightly. Torso follows by ≤ 2.5° only near end range.
// ---------------------------------------------------------------------------

const ROT_DUR = 12;
const ROT_HALF: readonly TK[] = [
  [0, 0],
  [0.45, 0],
  [2.15, 66],
  [4.75, 70, easeInOut],
  [5.85, 0],
  [6, 0],
];
const ROT_SHARE = [0.2, 0.3, 0.5] as const;
const ROT_LAG = [0.12, 0.06, 0] as const;

function rotAmount(sec: number): number {
  const s = wrap(sec, ROT_DUR);
  return s < 6 ? -track(s, ROT_HALF) : track(s - 6, ROT_HALF); // right turn = yaw −
}

function RotationScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * ROT_DUR;
  const yaw = rotAmount(s);
  const segs = ROT_SHARE.map((share, i) => rotAmount(s - ROT_LAG[i]) * share);
  const dirn = s < 6 ? -1 : 1; // world yaw sign of the current side
  const phase = wrap(s, 6);
  const mag = Math.abs(yaw) / 70;
  const idle = idleTorso(t);
  const twist = 2.5 * smooth(0.65, 1, mag) * dirn; // trunk follows only near end range
  const neck: [NeckSeg, NeckSeg, NeckSeg] = [
    { yaw: segs[0] },
    { yaw: segs[1] },
    // Slight chin lift near end range as people look over the shoulder, plus tiny idle drift.
    { yaw: segs[2], pitch: -1.5 * smooth(0.5, 1, mag) + 0.3 * wobble(t, 3.3, [2, 3]), roll: 0.3 * wobble(t, 6.1, [3, 4]) },
  ];
  const pose: BodyPose = {
    neck,
    breath: breath6(s),
    torso: { twist: twist + idle.twist, sway: idle.sway, lean: idle.lean },
    // Turning right stretches the left side of the neck, and vice versa.
    highlight: dirn < 0 ? { left: smooth(0.3, 0.9, mag) } : { right: smooth(0.3, 0.9, mag) },
  };
  const fig = drawFigure(id, FRONT, pose);

  // Cue: a curved arrow above the head, sweeping toward the turn (person's right = viewer's left).
  const crown = fig.d.p(toWorld(fig.rig.head, [0, HEAD.crownY, -1]));
  const top = pt(fig.d.p(fig.rig.neck[0].origin).x, Math.max(14, crown.y - 13));
  const op = phase < 0.4 ? 0 : phase < 1 ? smooth(0.4, 1, phase) : 1 - smooth(3.4, 4.4, phase);
  const rx = 24;
  const ry = 7;
  const pts: P[] = [];
  const sweep = dirn < 0 ? 1 : -1; // −1 world yaw (right) → arrow moves to screen-left
  for (let i = 0; i <= 16; i++) {
    const a = (sweep * (65 - (130 * i) / 16)) / DEG;
    pts.push(pt(top.x + Math.sin(a) * rx, top.y - 6 + Math.cos(a) * ry));
  }
  return scene(fig, op > 0.01 && <CuePath pts={pts} opacity={op * 0.9} />);
}

export const neckRotation: Clip = {
  duration: ROT_DUR,
  still: 3.4 / ROT_DUR,
  cues: [
    [0, 'Turn right · look over shoulder'],
    [2.15 / ROT_DUR, 'Hold · breathe', true],
    [4.75 / ROT_DUR, 'Back to center'],
    [6 / ROT_DUR, 'Turn left · look over shoulder'],
    [8.15 / ROT_DUR, 'Hold · breathe', true],
    [10.75 / ROT_DUR, 'Back to center'],
  ],
  Scene: RotationScene,
};

// ---------------------------------------------------------------------------
// 3) Chin tuck (retraction) — 7 s.
//
// rest 0.5 → glide back 1.4 s → hold 2.6 s (eases a touch deeper) → release 1.1 s → rest 1.4.
// Lower cervical EXTENSION translates the head backwards; mid/upper FLEXION keeps the face
// level (net head pitch ≈ 0°; ~5 px of backward glide at this framing), so the head glides straight back.
// ---------------------------------------------------------------------------

const TUCK_DUR = 7;
const TUCK: readonly TK[] = [
  [0, 0],
  [0.5, 0],
  [1.9, 0.92],
  [4.5, 1, easeInOut],
  [5.6, 0],
  [7, 0],
];
const TUCK_BREATH: readonly TK[] = [
  [0, 0.55, easeInOut],
  [0.5, 0.82, easeInOut],
  [1.9, 0.15, easeInOut],
  [3.2, 0.6, easeInOut],
  [4.5, 0.2, easeInOut],
  [5.6, 0.85, easeInOut],
  [7, 0.55, easeInOut],
];
const TUCK_MAG = { lower: -14, mid: 2, upper: 12 } as const;

function tuckPose(u: number, t: number, breath: number): BodyPose {
  const idle = idleTorso(t);
  return {
    neck: [
      { pitch: TUCK_MAG.lower * u },
      { pitch: TUCK_MAG.mid * u },
      { pitch: TUCK_MAG.upper * u + 0.3 * wobble(t, 2.7, [2, 3]) },
    ],
    breath,
    torso: idle,
    highlight: { back: smooth(0.2, 0.85, u) },
  };
}

function ChinTuckScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * TUCK_DUR;
  const u = track(s, TUCK);
  const breath = track(s, TUCK_BREATH);
  const fig = drawFigure(id, PROFILE, tuckPose(u, t, breath));
  const d = fig.d;

  // Neutral head frame for the ghost (same breath/torso, neutral neck).
  const neutral = drawBody(new Drawing(PROFILE), tuckPose(0, t, breath), { chair: false }).head;
  const op = s < 0.5 ? 0 : s < 1.2 ? smooth(0.5, 1.2, s) : 1 - smooth(4.4, 5.4, s);
  let overlay: ReactNode = null;
  if (op > 0.01) {
    const ghost = d.ellipse(child(neutral, [0, 8.5, -0.8]), [9.6, 13.4, 11.4]);
    const fwd = mapply(fig.rig.head.rot, [0, 0, 1]);
    const nose = toWorld(fig.rig.head, HEAD.noseTip);
    const a = d.p(vadd(nose, scaleV(fwd, 10)));
    const b = d.p(vadd(nose, scaleV(fwd, 3.5)));
    overlay = (
      <g>
        <ellipse
          cx={r2(ghost.cx)}
          cy={r2(ghost.cy)}
          rx={r2(ghost.rx)}
          ry={r2(ghost.ry)}
          transform={`rotate(${r2(ghost.angle)} ${r2(ghost.cx)} ${r2(ghost.cy)})`}
          style={{ stroke: CUE_COLOR, fill: 'none' }}
          strokeWidth={1.5}
          strokeDasharray="3 3"
          opacity={r2(op * 0.55)}
        />
        <Arrow a={pt(a.x, a.y)} b={pt(b.x, b.y)} opacity={r2(op * 0.9)} />
      </g>
    );
  }
  return scene(fig, overlay);
}

const scaleV = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];

export const chinTuck: Clip = {
  duration: TUCK_DUR,
  still: 3 / TUCK_DUR,
  cues: [
    [0, 'Glide chin straight back'],
    [1.9 / TUCK_DUR, 'Hold · eyes level', true],
    [4.5 / TUCK_DUR, 'Release'],
  ],
  Scene: ChinTuckScene,
};

