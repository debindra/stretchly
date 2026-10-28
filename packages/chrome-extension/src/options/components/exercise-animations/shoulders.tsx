import { useId, type ReactNode } from 'react';
import { Arrow, CUE_COLOR, M, clamp, easeInOut, minJerk, pt, wobble, type Clip, type Ease, type P } from './engine';
import { Drawing, type Camera, type V3 } from './rig3d';
import { drawBody, type BodyPose, type BodyRig } from './body3d';
import { drawHead } from './head3d';

// ---------------------------------------------------------------------------
// Shoulder-girdle exercises on the seated mannequin: forward + backward rolls
// (circumduction of the girdle in the sagittal plane), shrugs (elevation) and
// shoulder-blade squeezes (retraction with a little thoracic extension).
//
// Same approach as neck.tsx: choreography authored in SECONDS and evaluated at
// s = (t mod 1) · duration, so t = 0 and t = 1 are the same instant; every
// periodic signal is continuous across the seam. Faceless mannequin, bust
// framing, no chair, cyan patch on the working muscle.
//
// Body fields: shoulderLift (+ up), shoulderShift (+ protraction / forward,
// − retraction), thorax (+ extension). World +x = character's LEFT, +z = forward.
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
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Idle torso life (≤ ~0.5°), loop-safe. */
function idleTorso(t: number) {
  return {
    sway: 0.4 * wobble(t, 1.3, [1, 2, 3]),
    lean: 0.3 * wobble(t, 2.1, [1, 2]),
    twist: 0.3 * wobble(t, 0.7, [1, 3]),
  };
}

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

// ---------------------------------------------------------------------------
// 1) Shoulder rolls — 15 s (divides the 30 s routine): two forward circles, then two backward.
//
// rest 0.5 → forward block 0.5–6.4 s (2 circles, ≈ 2.95 s each) → pause → backward block
// 7.6–13.5 s (2 circles) → rest. Within a block θ runs 0 → 4π at constant speed with
// sine-ramped start/stop, and the girdle traces a circle in the sagittal plane whose BOTTOM is
// the neutral pose (so every block starts and ends at rest — no jump at the seam):
//   lift  = R (1 − cos θ)          0 … 8 px
//   shift = −dir · S sin θ          forward roll (dir +1): back → up → forward → down
//                                   backward roll (dir −1): forward → up → back → down
// Arms hang at the sides and are carried passively: the swing follows the girdle's shift and
// shift-velocity ~150 ms late (lag / follow-through). Breath leads the lift slightly; the head
// counter-nods a whisker so it stays level. A near-profile camera makes the sagittal circle —
// and hence forward vs backward — read directly on screen.
// ---------------------------------------------------------------------------

const ROLL_DUR = 15;
const ROLL_FWD = [0.5, 6.4] as const;
const ROLL_BWD = [7.6, 13.5] as const;
const ROLL_REPS = 2;
const ROLL_R = 4;
const ROLL_S = 4.6;
const ROLL_LAG = 0.08; // the far shoulder follows a hair later
const ARM_LAG = 0.15; // passive arm follow-through delay

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

/** Girdle state at second `sec` (wrapped). dir: +1 forward roll, −1 backward, 0 at rest. */
function girdle(sec: number) {
  const s = wrap(sec, ROLL_DUR);
  let theta = 0;
  let dir = 0;
  for (const [blk, d] of [[ROLL_FWD, 1], [ROLL_BWD, -1]] as const) {
    if (s >= blk[0] && s <= blk[1]) {
      theta = 2 * Math.PI * ROLL_REPS * cruise((s - blk[0]) / (blk[1] - blk[0]));
      dir = d;
    }
  }
  return { theta, dir, lift: ROLL_R * (1 - Math.cos(theta)), shift: -dir * ROLL_S * Math.sin(theta) };
}

/** Passive arm swing (deg, + forward): follows the girdle's shift and its velocity, delayed. */
function rollArmSwing(sec: number): number {
  const h = 0.04;
  const sd = sec - ARM_LAG;
  const vel = (girdle(sd + h).shift - girdle(sd - h).shift) / (2 * h);
  return 0.45 * girdle(sd).shift - 0.3 * vel;
}

const ROLL_CAM: Camera = { yaw: 72, pitch: 6, scale: 2.2, origin: pt(116, 252) };

function RollScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * ROLL_DUR;
  const g = girdle(s);
  const gFar = girdle(s - ROLL_LAG);
  const top = 2 * ROLL_R;
  // Breathe in as the shoulders rise, out as they fall (breath leads the lift slightly).
  const breath = 0.22 + 0.6 * clamp(girdle(s + 0.2).lift / top, 0, 1);
  // Trapezius patch: on through both blocks (stays lit across the short pause), brighter at the top.
  const on =
    smooth(ROLL_FWD[0] - 0.3, ROLL_FWD[0] + 0.5, s) * (1 - smooth(ROLL_BWD[1] - 0.4, ROLL_BWD[1] + 0.4, s));
  const pose: BodyPose = {
    // Head stays poised: a whisker of counter-motion and idle drift.
    neck: [{ pitch: 0.12 * g.shift }, {}, { pitch: -0.12 * g.shift + 0.3 * wobble(t, 2.7, [2, 3]), roll: 0.25 * wobble(t, 4.4, [3, 4]) }],
    breath,
    // Near shoulder (character's right) leads; the left follows ~80 ms later.
    shoulderLift: { right: g.lift, left: gFar.lift },
    shoulderShift: { right: g.shift, left: gFar.shift },
    arms: 'sides',
    armSwing: { right: rollArmSwing(s), left: rollArmSwing(s - ROLL_LAG) },
    // The chest rounds a touch as the shoulders come forward and opens as they draw back.
    thorax: -0.25 * g.shift,
    torso: idleTorso(t),
    highlight: { traps: on * (0.55 + 0.45 * clamp(g.lift / top, 0, 1)) },
  };
  const fig = drawFigure(id, ROLL_CAM, pose);

  // Cue: comet arc in the sagittal plane around the near shoulder, its head just ahead of the
  // girdle on the circle, so it turns one way for the forward block and the other for the backward.
  let overlay: ReactNode = null;
  const inFwd = s > ROLL_FWD[0] - 0.3 && s < ROLL_FWD[1] + 0.3;
  const inBwd = s > ROLL_BWD[0] - 0.3 && s < ROLL_BWD[1] + 0.3;
  if (inFwd || inBwd) {
    const blk = inFwd ? ROLL_FWD : ROLL_BWD;
    const dir = inFwd ? 1 : -1;
    const op = smooth(blk[0] - 0.3, blk[0] + 0.3, s) * (1 - smooth(blk[1] - 0.5, blk[1] + 0.2, s));
    if (op > 0.01) {
      const acr = fig.rig.shoulders.right;
      // Circle centre in world space: the acromion minus its offset from the circle centre,
      // pushed out a little toward the camera so the arc wraps round the outside of the shoulder.
      const centre: V3 = [acr[0] - 7, acr[1] - g.lift + ROLL_R + 1, acr[2] - g.shift];
      const RY = 11;
      const RZ = 12;
      const pts: P[] = [];
      for (let i = 0; i <= 20; i++) {
        const a = g.theta + (-150 + (195 * i) / 20) / DEG;
        const q = fig.d.p([centre[0], centre[1] - RY * Math.cos(a), centre[2] - dir * RZ * Math.sin(a)]);
        pts.push(pt(q.x, q.y));
      }
      overlay = <CuePath pts={pts} opacity={op * 0.9} />;
    }
  }
  return scene(fig, overlay);
}

export const shoulderRolls: Clip = {
  duration: ROLL_DUR,
  still: 2.6 / ROLL_DUR,
  cues: [
    [0, 'Roll forward'],
    [7.0 / ROLL_DUR, 'Roll backward'],
    [ROLL_BWD[1] / ROLL_DUR, 'Relax'],
  ],
  Scene: RollScene,
};

// ---------------------------------------------------------------------------
// 2) Shoulder shrugs — 8 s, one repetition.
//
// rest 0.6 → lift 1.2 s toward the ears (inhale) → hold 3 s (eases up a touch) → slow release
// 2.1 s (exhale), settling a hair below neutral → settle 0.5 → rest. The release is slower than
// the lift. A tiny chin tuck keeps the head poised as the shoulders rise around the neck.
// ---------------------------------------------------------------------------

const SHRUG_DUR = 8;
const SHRUG_TOP = 8.6;
const SHRUG: readonly TK[] = [
  [0, 0],
  [0.6, 0],
  [1.8, SHRUG_TOP],
  [4.8, SHRUG_TOP + 0.4, easeInOut],
  [6.9, -0.5],
  [7.4, 0, easeInOut],
  [8, 0],
];
const SHRUG_BREATH: readonly TK[] = [
  [0, 0.3, easeInOut],
  [0.6, 0.25, easeInOut],
  [1.9, 0.88, easeInOut],
  [3.3, 0.7, easeInOut],
  [4.8, 0.86, easeInOut],
  [6.9, 0.1, easeInOut],
  [8, 0.3, easeInOut],
];
const SHRUG_RELEASE = 4.8;
const SHRUG_CAM: Camera = { yaw: 14, pitch: 6, scale: 2.2, origin: pt(120, 252) };

function ShrugScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * SHRUG_DUR;
  const lift = track(s, SHRUG);
  const liftLag = track(wrap(s - 0.07, SHRUG_DUR), SHRUG);
  const k = clamp(lift / SHRUG_TOP, 0, 1.1);
  const pose: BodyPose = {
    neck: [{ pitch: 0.8 * k }, {}, { pitch: -0.8 * k + 0.3 * wobble(t, 3.1, [2, 3]), roll: 0.25 * wobble(t, 5.2, [3, 4]) }],
    breath: track(s, SHRUG_BREATH),
    shoulderLift: { right: lift, left: liftLag },
    torso: idleTorso(t),
    highlight: { traps: smooth(0.05, 0.9, k) },
  };
  const fig = drawFigure(id, SHRUG_CAM, pose);

  // Cues: up arrows beside both shoulders during the lift, down arrows during the release.
  const up = s < SHRUG_RELEASE;
  const op = up
    ? smooth(0.45, 0.85, s) * (1 - smooth(3.6, 4.3, s))
    : smooth(SHRUG_RELEASE - 0.05, SHRUG_RELEASE + 0.35, s) * (1 - smooth(6.3, 6.9, s));
  let overlay: ReactNode = null;
  if (op > 0.01) {
    overlay = (
      <g>
        {(['left', 'right'] as const).map((side) => {
          const a = fig.d.p(fig.rig.shoulders[side]);
          const out = side === 'left' ? 1 : -1; // character's left = screen right in front view
          const x = a.x + out * 9;
          const y0 = a.y - 6;
          return up ? (
            <Arrow key={side} a={pt(x, y0)} b={pt(x, y0 - 14)} opacity={r2(op * 0.9)} />
          ) : (
            <Arrow key={side} a={pt(x, y0 - 14)} b={pt(x, y0)} opacity={r2(op * 0.9)} />
          );
        })}
      </g>
    );
  }
  return scene(fig, overlay);
}

export const shoulderShrugs: Clip = {
  duration: SHRUG_DUR,
  still: 3.2 / SHRUG_DUR,
  cues: [
    [0, 'Lift toward ears · breathe in'],
    [1.8 / SHRUG_DUR, 'Hold', true],
    [SHRUG_RELEASE / SHRUG_DUR, 'Slowly release · breathe out'],
  ],
  Scene: ShrugScene,
};

// ---------------------------------------------------------------------------
// 3) Shoulder-blade squeeze — 8 s, one repetition, seen from behind (3/4 back).
//
// rest 0.5 → squeeze 1.2 s → hold 5 s (deepens slightly, breathing gently) → release 1.0 s →
// rest 0.3. At full squeeze: retraction −5.5 px, slight depression −0.8 px, thoracic extension
// +5°. The near blade leads by ~70 ms. The neck flexes a little to keep the gaze level.
// ---------------------------------------------------------------------------

const SQZ_DUR = 8;
const SQZ: readonly TK[] = [
  [0, 0],
  [0.5, 0],
  [1.7, 0.92],
  [6.7, 1, easeInOut],
  [7.7, 0],
  [8, 0],
];
const SQZ_BREATH: readonly TK[] = [
  [0, 0.3, easeInOut],
  [0.5, 0.25, easeInOut],
  [1.8, 0.8, easeInOut],
  [3.4, 0.5, easeInOut],
  [5.1, 0.8, easeInOut],
  [6.7, 0.55, easeInOut],
  [7.7, 0.15, easeInOut],
  [8, 0.3, easeInOut],
];
const SQZ_CAM: Camera = { yaw: 148, pitch: 10, scale: 2.2, origin: pt(122, 250) };

function SqueezeScene({ t }: { t: number }) {
  const id = useId();
  const s = (t - Math.floor(t)) * SQZ_DUR;
  const u = track(s, SQZ);
  const uLag = track(wrap(s - 0.07, SQZ_DUR), SQZ);
  const th = 5 * u;
  const pose: BodyPose = {
    // Thoracic extension tips the head back; the neck flexes to keep the face level.
    neck: [{ pitch: 0.5 * th }, { pitch: 0.3 * th }, { pitch: 0.2 * th + 0.3 * wobble(t, 2.2, [2, 3]), roll: 0.25 * wobble(t, 3.7, [3, 4]) }],
    breath: track(s, SQZ_BREATH),
    shoulderLift: { left: -0.8 * u, right: -0.8 * uLag },
    shoulderShift: { left: -5.5 * u, right: -5.5 * uLag },
    thorax: th,
    torso: idleTorso(t),
    highlight: { blades: smooth(0.05, 0.85, u) },
  };
  const fig = drawFigure(id, SQZ_CAM, pose);

  // Cue: two short arrows on the upper back, pointing in toward the spine between the blades.
  let overlay: ReactNode = null;
  const op = smooth(0.5, 1.0, s) * (1 - smooth(4.6, 5.4, s));
  if (op > 0.01) {
    const L = fig.rig.blades.left;
    const R = fig.rig.blades.right;
    const mid: V3 = [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2, (L[2] + R[2]) / 2];
    // Arrows sit just outside the patch, beside each blade, pointing in toward the spine.
    const at = (from: V3, extra: number) => {
      const v: V3 = [from[0] - mid[0], from[1] - mid[1], from[2] - mid[2]];
      const len = Math.hypot(v[0], v[1], v[2]) || 1;
      const k = (len + extra) / len;
      const q = fig.d.p([mid[0] + v[0] * k, mid[1] + v[1] * k, mid[2] + v[2] * k]);
      return pt(q.x, q.y);
    };
    overlay = (
      <g>
        {[L, R].map((b, i) => (
          <Arrow key={i} a={at(b, 17)} b={at(b, 9)} opacity={r2(op * 0.9)} />
        ))}
      </g>
    );
  }
  return scene(fig, overlay);
}

export const shoulderSqueeze: Clip = {
  duration: SQZ_DUR,
  still: 4.2 / SQZ_DUR,
  cues: [
    [0, 'Squeeze shoulder blades together'],
    [1.7 / SQZ_DUR, 'Hold · breathe', true],
    [6.7 / SQZ_DUR, 'Release'],
  ],
  Scene: SqueezeScene,
};
