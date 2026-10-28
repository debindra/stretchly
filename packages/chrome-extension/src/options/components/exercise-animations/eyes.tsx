import { useId } from 'react';
import { ArcArrow, C, CUE_COLOR, clamp, easeInOut, minJerk, wobble, type Clip, type Ease } from './engine';

// ---------------------------------------------------------------------------
// Eye exercises as a close-up of two eyes on peach skin patches, in the style of
// the Relief cover public/icons/areas/eyes.png: warm brown brows, dark lash liner
// with a small flick, blue iris, white sclera. No full face.
//
// Choreography is authored in SECONDS and evaluated at s = (t mod 1) · duration,
// so t = 0 and t = 1 are the same instant.
//
// Eye-movement timing follows physiology:
//   - saccades (focus shifts) are fast, ~70 ms, minimum-jerk, with a tiny glissade;
//   - smooth pursuit (rolls) is slow and continuous;
//   - natural blinks close fast and open slower (close 70 ms, shut 30 ms, open 120 ms);
//   - vergence (near/far) and pupil response are slower (≈ 0.3–0.9 s) and lag the saccade.
//
// Gaze is in normalised units: gx + = viewer's right, gy + = down; |g| ≈ 1 is a full
// excursion. The upper lid follows vertical gaze (lifts looking up, drops looking down).
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
const r2 = (n: number) => Math.round(n * 100) / 100;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/**
 * Lid closure 0..1 for a blink starting at `start` (seconds): close, stay shut, open.
 * Closing accelerates (eyelid falls), opening decelerates and is slower.
 */
function blink(sec: number, start: number, close = 0.07, shut = 0.03, open = 0.12): number {
  const u = sec - start;
  if (u <= 0 || u >= close + shut + open) return 0;
  if (u < close) return easeInOut(u / close);
  if (u < close + shut) return 1;
  return 1 - minJerk((u - close - shut) / open);
}

/** Max of several blinks (any of them may be active). */
const blinks = (sec: number, list: readonly (readonly [number, number?, number?, number?])[]) =>
  list.reduce((m, [st, c, sh, o]) => Math.max(m, blink(sec, st, c, sh, o)), 0);

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const PAL = {
  brow: '#B35A36',
  browShade: '#9A4628',
  liner: '#2A211C',
  sclera: '#FFFFFF',
  scleraShade: '#DCE2EA',
  irisIn: '#7CC8FF',
  irisMid: '#2F8DEB',
  irisOut: '#1C5BC0',
  limbus: '#163C80',
  pupil: '#0E1420',
} as const;

interface EyeState {
  /** Gaze, normalised (screen space). */
  gx: number;
  gy: number;
  /** Convergence toward the nose (near focus), normalised. */
  conv: number;
  /** Pupil radius in px (iris radius 12.5). */
  pupil: number;
  /** Lid closure 0 (open) .. 1 (shut). */
  lid: number;
  /** Squeeze 0..1 while shut (lower lid rises, brow lowers a touch). */
  squeeze: number;
  /** Brow offset in px (+ = lower / relaxed, − = raised). */
  brow: number;
}

const IRIS_R = 12.5;
const GAZE_X = 15; // px of iris travel at |gx| = 1
const GAZE_UP = 9;
const GAZE_DOWN = 7;

// Local eye geometry (viewer-left eye; outer corner at −x, nose side at +x).
const OC = { x: -31, y: 1 }; // outer canthus (slightly higher: almond tilt)
const IC = { x: 30, y: 5 }; // inner canthus

/** One eye with its skin patch and brow; `mirror` flips it for the viewer-right eye. */
function Eye({ uid, cx, cy, mirror, st }: { uid: string; cx: number; cy: number; mirror: boolean; st: EyeState }) {
  const sx = mirror ? -1 : 1;
  // Gaze in local coordinates: x flips with the mirror; convergence is always toward the nose (+x).
  const lgx = clamp(sx * st.gx + st.conv, -1.2, 1.2);
  const lgy = clamp(st.gy, -1.2, 1.2);
  const up = Math.max(0, -lgy);
  const down = Math.max(0, lgy);

  // Lids. Lower lid control height; upper lid control height follows gaze and closes onto the lower lid.
  const ly = 12.5 + 2.2 * down - 0.8 * up - 3 * st.squeeze;
  const uyOpen = -21 - 7 * up + 6 * down;
  const uy = lerp(uyOpen, ly, clamp(st.lid, 0, 1));
  const upper = `M${OC.x} ${OC.y}C-13 ${r2(uy)} 15 ${r2(uy)} ${IC.x} ${IC.y}`;
  const lower = `M${IC.x} ${IC.y}C15 ${r2(ly)} -12 ${r2(ly)} ${OC.x} ${OC.y}`;
  const opening = `${upper}C15 ${r2(ly)} -12 ${r2(ly)} ${OC.x} ${OC.y}Z`;

  // Iris: shift with gaze, squash toward the corners to fake the eyeball's roundness.
  const ix = lgx * GAZE_X;
  const iy = lgy < 0 ? lgy * GAZE_UP : lgy * GAZE_DOWN;
  const irx = IRIS_R * (1 - 0.2 * Math.abs(lgx));
  const iry = IRIS_R * (1 - 0.12 * Math.abs(lgy));
  const prx = st.pupil * (1 - 0.2 * Math.abs(lgx));
  const pry = st.pupil * (1 - 0.12 * Math.abs(lgy));
  // Corneal catch-light: rides with the eye but lags a little (fixed light source). Keep it on the
  // viewer's upper-left in both eyes, so un-mirror its offset.
  const hlx = ix * 0.82 - 3.6 * sx;
  const hly = iy * 0.82 - 4.2;

  // Lid crease: rides above the upper lid; flattens and fades as the eye shuts.
  const open = 1 - clamp(st.lid, 0, 1);
  const cy2 = lerp(-3, uy - 9, open);
  const crease = `M-27 -5C-12 ${r2(cy2)} 14 ${r2(cy2)} 29 -3`;
  // Squeeze lines at the outer corner.
  const sq = st.squeeze;

  // Brow crescent and the skin patch whose top edge follows the brow.
  const b = st.brow;
  const browOuter = `M-56 ${r2(-2 + b)}Q-2 ${r2(-64 + b * 1.3)} 55 ${r2(-8 + b)}`;
  const browPath = `${browOuter}Q2 ${r2(-44 + b * 1.2)} -56 ${r2(-2 + b)}Z`;
  const patch = `${browOuter}C66 10 46 38 2 38C-44 38 -68 22 -56 ${r2(-2 + b)}Z`;

  // Flick: a small upswept wing past the outer corner, thinning as the lid closes.
  const fl = 0.55 + 0.45 * open;
  const flick = `M-22 ${r2(-6 + 3 * (1 - open))}Q-33 ${r2(-1 + 2 * (1 - open))} ${r2(-31 - 10 * fl)} ${r2(OC.y - 9 * fl)}Q-34 3 -29 3.5Z`;

  return (
    <g transform={`translate(${cx} ${cy}) scale(${sx * 0.98} 0.98)`}>
      <path d={patch} fill={`url(#${uid}-skin)`} />
      {/* soft socket shading */}
      <ellipse cx={0} cy={1} rx={40} ry={20} fill={`url(#${uid}-socket)`} />
      <path d={browPath} fill={PAL.brow} />
      <path d={`M-42 ${r2(-12 + b)}Q-2 ${r2(-54 + b * 1.25)} 42 ${r2(-16 + b)}`} stroke={PAL.browShade} strokeWidth={2.2} fill="none" opacity={0.35} strokeLinecap="round" />
      <path d={crease} stroke={C.skinShade} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.75 * open} />

      {/* eyeball, clipped to the opening */}
      <g clipPath={`url(#${uid}-open)`}>
        <rect x={-34} y={-34} width={68} height={52} fill={`url(#${uid}-sclera)`} />
        <ellipse cx={ix} cy={iy} rx={irx} ry={iry} fill={`url(#${uid}-iris)`} stroke={PAL.limbus} strokeWidth={1.1} />
        <ellipse cx={ix} cy={iy} rx={prx} ry={pry} fill={PAL.pupil} />
        <circle cx={hlx} cy={hly} r={2.7} fill="#fff" />
        <circle cx={ix * 0.82 + 3.4 * sx} cy={iy * 0.82 + 3.6} r={1.1} fill="#fff" opacity={0.75} />
        {/* upper-lid shadow on the eyeball */}
        <path d={upper} stroke="#3B4556" strokeWidth={7} fill="none" opacity={0.2} />
      </g>

      <path d={lower} stroke={C.skinShade} strokeWidth={1.3} fill="none" opacity={0.8} strokeLinecap="round" />
      {sq > 0.01 && (
        <g stroke={C.skinShade} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.85 * sq}>
          <path d="M-36 -2q-4 1-7 0" />
          <path d="M-35 4q-4 2-7 3" />
          <path d={`M-12 ${r2(ly + 1)}q12 4 24 0`} />
        </g>
      )}
      <path d={upper} stroke={PAL.liner} strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <path d={flick} fill={PAL.liner} />

      <defs>
        <clipPath id={`${uid}-open`}>
          <path d={opening} />
        </clipPath>
        <radialGradient id={`${uid}-skin`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor={C.skinLight} />
          <stop offset="0.7" stopColor={C.skin} />
          <stop offset="1" stopColor={C.skinShade} />
        </radialGradient>
        <radialGradient id={`${uid}-socket`}>
          <stop offset="0.55" stopColor={C.skinShade} stopOpacity={0.45} />
          <stop offset="1" stopColor={C.skinShade} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${uid}-sclera`} cx="0.5" cy="0.55" r="0.55">
          <stop offset="0.45" stopColor={PAL.sclera} />
          <stop offset="1" stopColor={PAL.scleraShade} />
        </radialGradient>
        <radialGradient id={`${uid}-iris`}>
          <stop offset="0.3" stopColor={PAL.irisIn} />
          <stop offset="0.7" stopColor={PAL.irisMid} />
          <stop offset="1" stopColor={PAL.irisOut} />
        </radialGradient>
      </defs>
    </g>
  );
}

const EYE_Y = 110;
const EYE_L = 63;
const EYE_R = 177;

function Eyes({ st }: { st: EyeState }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <>
      <Eye uid={`${id}l`} cx={EYE_L} cy={EYE_Y} mirror={false} st={st} />
      <Eye uid={`${id}r`} cx={EYE_R} cy={EYE_Y} mirror st={st} />
    </>
  );
}

/** Fixation micro-drift (tiny, loop-safe). */
const drift = (t: number, amp = 0.018) => ({ x: amp * wobble(t, 3.1, [2, 5, 7]), y: amp * wobble(t, 4.7, [3, 4, 6]) });

const cueStroke = { stroke: CUE_COLOR, fill: 'none' } as const;

// ---------------------------------------------------------------------------
// 1) 20-20-20 — 20 s: screen (near: converged, small pupils) → saccade far up/out
// (parallel, pupils dilate, relaxing blink) → hold with natural blinks → saccade back.
// ---------------------------------------------------------------------------

const F_DUR = 20;
const F_OUT = 1.0; // saccade out
const F_BACK = 18.8; // saccade back
const SAC = 0.07;

const F_GX: readonly TK[] = [
  [0, 0],
  [F_OUT, 0],
  [F_OUT + SAC, 0.47],
  [F_OUT + SAC + 0.05, 0.44, easeInOut], // glissade
  [9.4, 0.44],
  [9.45, 0.5], // small corrective re-fixation
  [F_BACK, 0.5],
  [F_BACK + SAC, -0.02],
  [F_BACK + SAC + 0.05, 0, easeInOut],
  [F_DUR, 0],
];
const F_GY: readonly TK[] = [
  [0, 0.32],
  [F_OUT, 0.32],
  [F_OUT + SAC, -0.58],
  [F_OUT + SAC + 0.05, -0.54, easeInOut],
  [9.4, -0.54],
  [9.45, -0.5],
  [F_BACK, -0.5],
  [F_BACK + SAC, 0.35],
  [F_BACK + SAC + 0.05, 0.32, easeInOut],
  [F_DUR, 0.32],
];
// Vergence relaxes after the saccade (slower system).
const F_CONV: readonly TK[] = [
  [0, 0.13],
  [F_OUT + 0.05, 0.13],
  [F_OUT + 0.5, 0],
  [F_BACK + 0.05, 0],
  [F_BACK + 0.5, 0.13],
  [F_DUR, 0.13],
];
// Near triad: pupils constrict at the screen, dilate looking far (latency ≈ 0.3 s).
const F_PUPIL: readonly TK[] = [
  [0, 4.4],
  [F_OUT + 0.3, 4.4],
  [F_OUT + 1.2, 5.9, easeInOut],
  [F_BACK + 0.3, 5.9],
  [F_BACK + 1.0, 4.4, easeInOut],
  [F_DUR, 4.4],
];
// Brows: slight strain at the screen, soften while looking far.
const F_BROW: readonly TK[] = [
  [0, -0.8],
  [F_OUT + 0.2, -0.8],
  [3.5, 1.2, easeInOut],
  [F_BACK, 1.2],
  [F_BACK + 0.9, -0.8, easeInOut],
  [F_DUR, -0.8],
];
const F_BLINKS = [
  [0.35],
  [1.75, 0.12, 0.12, 0.28], // slower relaxing blink after the shift
  [6.3],
  [11.2],
  [15.4],
  [19.35],
] as const;
const F_FAR_OP: readonly TK[] = [
  [0, 0],
  [F_OUT, 0],
  [F_OUT + 0.6, 1, easeInOut],
  [F_BACK - 0.2, 1],
  [F_BACK + 0.3, 0, easeInOut],
  [F_DUR, 0],
];

/** Distant mountain + tree, the "20 feet away" target. */
function FarCue({ opacity }: { opacity: number }) {
  return (
    <g transform="translate(206 34)" opacity={opacity} style={cueStroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M-20 10L-7 -8L0 1L5 -4L18 10" />
      <path d="M-11 -2.5L-7 -8L-3 -2.5" opacity={0.6} />
      <path d="M-24 10H22" />
    </g>
  );
}

/** Small monitor near the bottom: the near target. */
function ScreenCue({ opacity }: { opacity: number }) {
  return (
    <g transform="translate(120 176)" opacity={opacity} style={cueStroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={-12} y={-9} width={24} height={15} rx={2} />
      <path d="M0 6V10M-5 10H5" />
    </g>
  );
}

function FarScene({ t }: { t: number }) {
  const s = (t - Math.floor(t)) * F_DUR;
  const d = drift(t);
  const st: EyeState = {
    gx: track(s, F_GX) + d.x,
    gy: track(s, F_GY) + d.y,
    conv: track(s, F_CONV),
    pupil: track(s, F_PUPIL),
    lid: blinks(s, F_BLINKS),
    squeeze: 0,
    brow: track(s, F_BROW),
  };
  const far = track(s, F_FAR_OP);
  return (
    <>
      <Eyes st={st} />
      {far > 0.01 && <FarCue opacity={far * 0.9} />}
      {far < 0.99 && <ScreenCue opacity={(1 - far) * 0.55} />}
    </>
  );
}

export const eye202020: Clip = {
  duration: F_DUR,
  still: 8 / F_DUR,
  cues: [
    [0, 'Look at your screen'],
    [(F_OUT + 0.2) / F_DUR, 'Focus 20 ft away', true],
    [F_BACK / F_DUR, 'Back to screen'],
  ],
  Scene: FarScene,
};

// ---------------------------------------------------------------------------
// 2) Blink reset — 5 s: three slow, full blinks. Each: close 0.25 s, gentle squeeze
// hold 0.6 s, open 0.35 s, then ~0.45 s open. Pupils dilate a touch in the dark and
// constrict again after opening; brows dip with the squeeze and relax.
// ---------------------------------------------------------------------------

const B_DUR = 5;
const B_STARTS = [0.25, 1.9, 3.55] as const;
const B_CLOSE = 0.25;
const B_HOLD = 0.6;
const B_OPEN = 0.35;

function slowBlink(u: number) {
  if (u <= 0 || u >= B_CLOSE + B_HOLD + B_OPEN + 0.9) return { lid: 0, squeeze: 0, pupil: 0 };
  const lid =
    u < B_CLOSE ? easeInOut(u / B_CLOSE) : u < B_CLOSE + B_HOLD ? 1 : 1 - minJerk(clamp((u - B_CLOSE - B_HOLD) / B_OPEN, 0, 1));
  const squeeze = track(u, [
    [0, 0],
    [B_CLOSE, 0.15],
    [B_CLOSE + 0.25, 1, easeInOut],
    [B_CLOSE + B_HOLD - 0.05, 0.85, easeInOut],
    [B_CLOSE + B_HOLD + 0.15, 0, easeInOut],
  ]);
  // Pupil: dilates while shut, constricts after light returns (latency ~0.2 s).
  const pupil = track(u, [
    [0, 0],
    [B_CLOSE, 0],
    [B_CLOSE + B_HOLD + B_OPEN, 0.8, easeInOut],
    [B_CLOSE + B_HOLD + B_OPEN + 0.9, 0, easeInOut],
  ]);
  return { lid, squeeze, pupil };
}

function BlinkScene({ t }: { t: number }) {
  const s = (t - Math.floor(t)) * B_DUR;
  let lid = 0;
  let squeeze = 0;
  let pupil = 0;
  for (const st of B_STARTS) {
    // Evaluate both this loop and the previous one so tails cross the seam cleanly.
    for (const off of [0, -B_DUR]) {
      const r = slowBlink(s - st - off);
      lid = Math.max(lid, r.lid);
      squeeze = Math.max(squeeze, r.squeeze);
      pupil = Math.max(pupil, r.pupil);
    }
  }
  const d = drift(t, 0.02);
  return (
    <Eyes
      st={{
        gx: d.x,
        gy: 0.05 + d.y,
        conv: 0.04,
        pupil: 5 + pupil,
        lid,
        squeeze,
        brow: 0.6 + 1.6 * squeeze,
      }}
    />
  );
}

export const blinkReset: Clip = {
  duration: B_DUR,
  still: (B_STARTS[0] + B_CLOSE + 0.3) / B_DUR,
  cues: [[0, 'Slow, full blinks']],
  Scene: BlinkScene,
};

// ---------------------------------------------------------------------------
// 3) Eye rolls — 10 s: one slow circle clockwise (on screen: up → right → down → left),
// then one counterclockwise. Per 5 s half: center 0.3 s → glide up 0.5 s → smooth pursuit
// circle 3.4 s → back to center 0.4 s → natural blink. Brows lift a little looking up.
// ---------------------------------------------------------------------------

const R_DUR = 10;
const R_HALF = 5;
const R_AMP = 0.88;
const R_RADIUS: readonly TK[] = [
  [0, 0],
  [0.3, 0],
  [0.8, 1],
  [4.2, 1],
  [4.6, 0],
  [R_HALF, 0],
];
const R_ANGLE: readonly TK[] = [
  [0, 0],
  [0.8, 0],
  [4.2, 360, easeInOut],
  [R_HALF, 360],
];

function RollScene({ t }: { t: number }) {
  const s = (t - Math.floor(t)) * R_DUR;
  const half = s < R_HALF ? 0 : 1;
  const u = wrap(s, R_HALF);
  const dirn = half === 0 ? 1 : -1;
  const r = track(u, R_RADIUS) * R_AMP;
  const a = (dirn * track(u, R_ANGLE) * Math.PI) / 180;
  const d = drift(t, 0.012);
  const gx = r * Math.sin(a) + d.x;
  const gy = -r * Math.cos(a) + d.y;
  const lid = blink(u, 4.65);
  const op = track(u, [
    [0, 0],
    [0.5, 0],
    [1.0, 1, easeInOut],
    [4.0, 1],
    [4.4, 0, easeInOut],
    [R_HALF, 0],
  ]);
  return (
    <>
      <Eyes st={{ gx, gy, conv: 0.03, pupil: 5, lid, squeeze: 0, brow: 0.4 - 2.6 * Math.max(0, -gy) + 0.6 * Math.max(0, gy) }} />
      {op > 0.01 && (
        <ArcArrow c={{ x: 120, y: 38 }} r={13} from={dirn > 0 ? -140 : 140} to={dirn > 0 ? 140 : -140} opacity={op * 0.9} />
      )}
    </>
  );
}

export const eyeRolls: Clip = {
  duration: R_DUR,
  still: 1.6 / R_DUR,
  cues: [
    [0, 'Circle clockwise'],
    [0.5, 'Now counterclockwise'],
  ],
  Scene: RollScene,
};
