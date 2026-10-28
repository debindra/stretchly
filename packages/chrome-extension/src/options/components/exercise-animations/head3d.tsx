import type { ReactNode } from 'react';
import { C } from './engine';
import { mapply, mmul, rotX, rotY, toWorld, towardViewer, vadd, vdot, vlen, vscale, vsub, type Drawing, type Frame, type M3, type V3 } from './rig3d';

// ---------------------------------------------------------------------------
// Pseudo-3D human head.
//
// Head-local space (px at camera scale 1), origin = head–neck pivot:
//   +x = character's left, +y = up, +z = forward (face direction).
// The head is a union of skin ellipsoids (cranium, mid-face, mandible halves,
// chin, lips) whose exact screen ellipses form the silhouette; a hair volume
// drawn as the visible part of a cap region on a larger ellipsoid; and
// features placed as 3D points on the skin surface (ray-cast), projected
// per frame. Everything is emitted as ONE composite node, internally ordered.
// ---------------------------------------------------------------------------

export interface HeadState {
  /** Eye rotation relative to the head, degrees, + = toward character's left (clamped ±35). */
  gazeYaw?: number;
  /** + = looking down (clamped ±25). */
  gazePitch?: number;
  /** 0 open .. 1 closed. */
  blink?: number;
  /** Mannequin head (Relief tab cover style): skin forms only — no hair, eyes, brows or mouth. */
  faceless?: boolean;
}

/**
 * Uniform head scale. The modelling below is in "design units"; the drawn head is HS× larger so it
 * sits in realistic proportion on body3d's torso (shoulders ≈ 2.3 head widths, crown-to-seat ≈ 3.3
 * heads). HEAD reports the final (scaled) dimensions.
 */
const HS = 1.08;
const hs = (n: number) => Math.round(n * HS * 100) / 100;

/** Key dimensions in head-local px (origin = head–neck pivot). */
export const HEAD = {
  /** Top of the hair volume / top of the skull. */
  crownY: hs(22),
  skullCrownY: hs(21),
  /** Lowest point of the chin and its forward position. */
  chinY: hs(-6.8),
  chinZ: hs(7.9),
  /** Back of the hair / back of the skull. */
  backZ: hs(-12.5),
  skullBackZ: hs(-11.5),
  foreheadZ: hs(9.6),
  noseTip: [0, hs(3.7), hs(13.4)] as V3,
  eyeY: hs(7),
  eyeX: hs(3.5),
  /** Ear centres at (±earX, earY, earZ). */
  earX: hs(9.6),
  earY: hs(5),
  earZ: hs(-1),
  halfWidth: hs(9.5),
  /** Suggested neck radius; the head closes over a neck of this size entering the pivot. */
  neckRadius: hs(5.5),
} as const;
/** Eye placement in design units. */
const EYE_Y = 7;
const EYE_X = 3.5;

// Local tones (flat colours, palette-compatible).
const T = {
  skin: C.skin,
  shade: '#F6B27F',
  deep: '#DE8A55',
  hair: C.hair,
  hairLight: '#4B3A2B',
  white: '#FBF7F4',
  iris: '#5C3D27',
  pupil: '#1E1610',
  lash: '#2A1F17',
  lip: C.lip,
  lipDark: '#B57A74',
  nostril: '#A77462',
  earInner: '#CC9984',
  blush: '#E9A596',
};

// Key light: viewer's upper-left-front in the default front view (world space).
const LIGHT: V3 = norm([-0.5, 0.72, 0.48]);

// ---------------------------------------------------------------------------
// Small vector helpers
// ---------------------------------------------------------------------------

function norm(a: V3): V3 {
  const l = vlen(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const transpose = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth01 = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const DEG = Math.PI / 180;

/** Rotation whose columns are the given local axes (z = dir, y ≈ up hint). */
function basis(dir: V3, upHint: V3 = [0, 1, 0]): M3 {
  const z = norm(dir);
  const x = norm(cross(upHint, z));
  const y = cross(z, x);
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

// ---------------------------------------------------------------------------
// Volumes (head-local)
// ---------------------------------------------------------------------------

interface Vol {
  c: V3;
  r: V3;
  rot: M3;
}

const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const CRANIUM: Vol = { c: [0, 9.5, -1], r: [9.3, 11.5, 10.5], rot: I3 };
const FACE: Vol = { c: [0, 4.2, 1.6], r: [8.0, 9.2, 8.4], rot: I3 };
const CHIN: Vol = { c: [0, -4.6, 5.2], r: [2.9, 2.2, 2.8], rot: I3 };
const MUZZLE: Vol = { c: [0, -0.9, 5.7], r: [4.2, 3.6, 3.6], rot: I3 };
const MANDIBLE: Vol = { c: [0, -3.0, 1.6], r: [5.8, 2.9, 5.2], rot: rotX(33) };
const SKIN: Vol[] = [CRANIUM, FACE, MANDIBLE, MUZZLE, CHIN];
/** Hair volume: inflated cranium, shifted up so it dips into the skull at the nape. */
const HAIR: Vol = { c: [0, 10.7, -1.4], r: [10.05, 11.3, 11.15], rot: I3 };
/**
 * Back-of-head hair: the cranium inflated by a short-haircut thickness (a little more at the back of
 * the crown), so the occiput is covered right down to the nape hairline instead of the main hair
 * volume dipping under the skull there. Only its back cap (NAPE_LINE) is drawn.
 */
const NAPE: Vol = { c: [0, 9.5, -1.3], r: [9.75, 11.95, 11.0], rot: I3 };

/** Ray-cast the skin surface from the front: point + outward normal at (x, y). */
function surface(x: number, y: number): { p: V3; n: V3 } {
  let best: { p: V3; n: V3 } | null = null;
  for (const v of SKIN) {
    const rt = transpose(v.rot);
    const o = mapply(rt, vsub([x, y, 40], v.c));
    const dd = mapply(rt, [0, 0, -1]);
    const ou: V3 = [o[0] / v.r[0], o[1] / v.r[1], o[2] / v.r[2]];
    const du: V3 = [dd[0] / v.r[0], dd[1] / v.r[1], dd[2] / v.r[2]];
    const a = vdot(du, du);
    const b = 2 * vdot(ou, du);
    const cc = vdot(ou, ou) - 1;
    const disc = b * b - 4 * a * cc;
    if (disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    const z = 40 - t;
    if (best && best.p[2] >= z) continue;
    const u = vadd(ou, vscale(du, t));
    const n = norm(mapply(v.rot, [u[0] / v.r[0], u[1] / v.r[1], u[2] / v.r[2]]));
    best = { p: [x, y, z], n };
  }
  return best ?? { p: [x, y, 0], n: [0, 0, 1] };
}

// ---------------------------------------------------------------------------
// Hair region: cap above a hairline, in the hair ellipsoid's unit-sphere coords.
// φ = azimuth (0 = front, 90 = side), θ = elevation.
// ---------------------------------------------------------------------------

const HAIRLINE: readonly (readonly [number, number])[] = [
  [0, 22],
  [16, 23],
  [30, 24],
  [42, 20],
  [53, 13],
  [61, 6],
  [65.5, -3],
  [69, -13],
  [73.5, -17.5],
  [77.5, -13],
  [81, -6],
  [88, -3],
  [99, -5],
  [108, -13],
  [118, -24],
  [132, -36],
  [155, -44],
  [180, -47],
];

/**
 * Back/nape hairline for the NAPE volume (same φ/θ convention). Well inside the main cap at the
 * front and sides (so front, 3/4 and profile silhouettes are untouched), then descending behind the
 * ear to a neat short-cut nape edge level with the ear lobes, with a slight centre point.
 */
const NAPE_LINE: readonly (readonly [number, number])[] = [
  [0, 50],
  [94, 50],
  [100, 12],
  [106, -6],
  [114, -18],
  [123, -29],
  [133, -38],
  [146, -43.5],
  [160, -46],
  [171, -48],
  [180, -50.5],
];

function lineTheta(table: readonly (readonly [number, number])[], phiDeg: number): number {
  const p = Math.abs(phiDeg);
  for (let i = 1; i < table.length; i++) {
    const [p1, t1] = table[i];
    if (p <= p1) {
      const [p0, t0] = table[i - 1];
      const u = (p - p0) / (p1 - p0);
      // Cubic Hermite with finite-difference slopes (smooth, no plateaus at knots).
      const slope = (j: number) => {
        const a = table[Math.max(0, j - 1)];
        const b = table[Math.min(table.length - 1, j + 1)];
        return (b[1] - a[1]) / (b[0] - a[0]);
      };
      const h = p1 - p0;
      const m0 = i - 1 === 0 ? 0 : slope(i - 1) * h;
      const m1 = slope(i) * h;
      const u2 = u * u;
      const u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * t0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * t1 + (u3 - u2) * m1;
    }
  }
  return table[table.length - 1][1];
}
const hairlineTheta = (phiDeg: number) => lineTheta(HAIRLINE, phiDeg);

const sph = (phi: number, theta: number): V3 => [
  Math.sin(phi * DEG) * Math.cos(theta * DEG),
  Math.sin(theta * DEG),
  Math.cos(phi * DEG) * Math.cos(theta * DEG),
];

type Line = (phiDeg: number) => number;

function insideCap(u: V3, line: Line): boolean {
  const phi = Math.atan2(u[0], u[2]) / DEG;
  const theta = Math.asin(clamp(u[1], -1, 1)) / DEG;
  return theta > line(phi);
}

/**
 * Visible part of the cap region {θ > line(φ)} on a unit sphere, seen along `w` (unit-sphere
 * view direction): the front-facing boundary arcs joined by silhouette arcs that stay in the cap.
 * Returns unit-sphere points (empty when nothing is visible).
 */
function capOutline(w: V3, line: Line): V3[] {
  const toSil = (u: V3): V3 => norm(vsub(u, vscale(w, vdot(u, w))));
  const bnd: V3[] = [];
  for (let phi = -180; phi < 180; phi += 2) bnd.push(sph(phi, line(phi)));
  const pts: V3[] = [];
  const nB = bnd.length;
  let start = bnd.findIndex((u) => vdot(u, w) > 0);
  if (start < 0) {
    if (insideCap(w, line)) {
      for (let a = 0; a < 360; a += 6) {
        const e1 = toSil(Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
        const e2 = cross(w, e1);
        pts.push(vadd(vscale(e1, Math.cos(a * DEG)), vscale(e2, Math.sin(a * DEG))));
      }
    }
    return pts;
  }
  // Rotate so we begin on a visible point.
  while (vdot(bnd[(start - 1 + nB) % nB], w) > 0 && start > -nB) start--;
  let exitPt: V3 | null = null;
  for (let i = 0; i < nB; i++) {
    const u = bnd[(start + i + nB) % nB];
    const nx = bnd[(start + i + 1 + nB) % nB];
    const su = vdot(u, w);
    const sn = vdot(nx, w);
    if (su > 0) pts.push(u);
    if (su > 0 && sn <= 0) {
      exitPt = toSil(vadd(vscale(u, -sn), vscale(nx, su)));
      pts.push(exitPt);
    } else if (su <= 0 && sn > 0 && exitPt) {
      const entry = toSil(vadd(vscale(u, sn), vscale(nx, -su)));
      // Silhouette arc from exit to entry that stays inside the cap.
      const e1 = exitPt;
      const e2 = norm(cross(w, e1));
      const ang = Math.atan2(vdot(entry, e2), vdot(entry, e1));
      const alt = ang > 0 ? ang - 2 * Math.PI : ang + 2 * Math.PI;
      const mid = (a: number) => vadd(vscale(e1, Math.cos(a / 2)), vscale(e2, Math.sin(a / 2)));
      const use = insideCap(mid(ang), line) ? ang : alt;
      const steps = Math.max(2, Math.ceil(Math.abs(use) / (6 * DEG)));
      for (let j = 1; j < steps; j++) {
        const a = (use * j) / steps;
        pts.push(vadd(vscale(e1, Math.cos(a)), vscale(e2, Math.sin(a))));
      }
      pts.push(entry);
      exitPt = null;
    }
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

interface Pt {
  x: number;
  y: number;
}
const f2 = (n: number) => Math.round(n * 100) / 100;

/** Catmull-Rom spline through points as cubic Béziers (no leading M). */
function spline(ps: readonly Pt[], closed: boolean): string {
  const n = ps.length;
  if (n < 2) return '';
  const at = (i: number) => (closed ? ps[(i + n) % n] : ps[clamp(i, 0, n - 1)]);
  let s = '';
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    s += `C${f2(c1.x)} ${f2(c1.y)} ${f2(c2.x)} ${f2(c2.y)} ${f2(p2.x)} ${f2(p2.y)}`;
  }
  return s;
}
const moveTo = (p: Pt) => `M${f2(p.x)} ${f2(p.y)}`;
const openPath = (ps: readonly Pt[]) => (ps.length ? moveTo(ps[0]) + spline(ps, false) : '');
const closedPath = (ps: readonly Pt[]) => (ps.length ? moveTo(ps[0]) + spline(ps, true) + 'Z' : '');

function hull(ps: Pt[]): Pt[] {
  const s = [...ps].sort((a, b) => a.x - b.x || a.y - b.y);
  const cr = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Pt[] = [];
  for (const p of s) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  const up: Pt[] = [];
  for (let i = s.length - 1; i >= 0; i--) {
    const p = s[i];
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// ---------------------------------------------------------------------------
// drawHead
// ---------------------------------------------------------------------------

export function drawHead(d: Drawing, frame: Frame, state: HeadState = {}): void {
  const s = d.cam.scale;
  const id = d.uid('hd3');
  const view = towardViewer(d.cam);
  const rotT = transpose(frame.rot);
  const vL = mapply(rotT, view); // toward viewer, head-local
  const lL = mapply(rotT, LIGHT); // toward light, head-local
  // Scaled frame: design-unit geometry → world. Normals/facing use the pure rotation (rotT).
  const R = frame.rot.map((x) => x * HS) as unknown as M3;
  const W = (p: V3) => toWorld({ origin: frame.origin, rot: R }, p);
  const P = (p: V3): Pt => d.p(W(p));
  const facing = (n: V3) => vdot(n, vL);
  const out: ReactNode[] = [];
  let k = 0;
  const push = (node: ReactNode) => out.push(<g key={k++}>{node}</g>);

  const volFrame = (v: Vol): Frame => ({ origin: W(v.c), rot: mmul(R, v.rot) });
  const ellipseEl = (v: Vol, fill: string, dx = 0, dy = 0, key?: number) => {
    const e = d.ellipse(volFrame(v), v.r);
    return (
      <ellipse
        key={key}
        cx={f2(e.cx + dx)}
        cy={f2(e.cy + dy)}
        rx={f2(e.rx)}
        ry={f2(e.ry)}
        transform={`rotate(${f2(e.angle)} ${f2(e.cx + dx)} ${f2(e.cy + dy)})`}
        fill={fill}
      />
    );
  };

  // ---- ears (back-facing ones go behind the skull) ----
  const ears = ([1, -1] as const).map((side) => buildEar(side));
  function buildEar(side: 1 | -1) {
    const back = norm([0.5 * side, 0, -0.87]);
    const up = norm([0, 0.97, -0.24]);
    const n0 = norm(cross(back, up));
    const n = n0[0] * side > 0 ? n0 : vscale(n0, -1);
    const root: V3 = [8.35 * side, 5.1, 0.7];
    const E = (a: number, h: number, lift = 0): Pt => P(vadd(vadd(root, vadd(vscale(back, a), vscale(up, h))), vscale(n, lift)));
    const OUTLINE = (
      [
        [0.15, 3.0],
        [1.3, 3.9],
        [2.9, 3.6],
        [4.0, 2.3],
        [4.2, 0.4],
        [3.6, -1.5],
        [2.6, -3.0],
        [1.5, -3.85],
        [0.5, -3.4],
        [0.05, -1.8],
        [-0.15, 0.6],
      ] as const
    );
    const outline = OUTLINE.map(([a, h]) => E(a, h));
    const helix = (
      [
        [0.9, 2.5],
        [2.2, 2.75],
        [3.2, 1.6],
        [3.3, -0.4],
        [2.6, -1.9],
        [1.6, -2.4],
      ] as const
    ).map(([a, h]) => E(a, h, 0.1));
    const concha = (
      [
        [0.9, 1.2],
        [2.1, 1.5],
        [2.5, 0.0],
        [1.9, -1.3],
        [0.9, -1.0],
        [0.6, 0.2],
      ] as const
    ).map(([a, h]) => E(a, h, 0.05));
    const fv = facing(n);
    if (fv >= 0.12) {
      const lit = vdot(n, lL);
      const node = (
        <g>
          <path d={closedPath(outline)} fill={lit < 0.05 ? T.shade : T.skin} />
          {fv > 0.12 && !state.faceless && (
            <g opacity={f2(smooth01(0.12, 0.45, fv))}>
              <path d={closedPath(concha)} fill={T.earInner} opacity={0.55} />
              <path d={openPath(helix)} fill="none" stroke={T.deep} strokeWidth={f2(0.35 * s)} strokeLinecap="round" opacity={0.7} />
            </g>
          )}
        </g>
      );
      return { front: true, node };
    }
    // Back of the auricle (rear and rear-3/4 views): a shaded shell with its rolled helix rim and the
    // crease where it joins the scalp. On the viewer's side of the head it stands in front of the
    // hair/skull; on the far side (or seen squarely from behind) only the part past the silhouette shows.
    const near = fv >= 0 || side * vL[0] > 0.22;
    const bf = Math.max(-fv, 0.12 - fv);
    const rim = outline.slice(0, 9);
    const rootEdge = [outline[8], outline[9], outline[10], outline[0]];
    // The concha's cup bulges medially behind the rim, so the ear keeps some width even edge-on.
    const shell = hull([...outline, ...OUTLINE.map(([a, h]) => E(a * 0.55, h * 0.7, -1.1))]);
    const node = (
      <g>
        <path d={closedPath(shell)} fill={T.shade} stroke={T.deep} strokeWidth={f2(0.18 * s)} strokeOpacity={0.4} strokeLinejoin="round" />
        <path d={closedPath(outline)} fill={T.shade} />
        <path d={openPath(rim)} fill="none" stroke={T.skin} strokeWidth={f2(0.55 * s)} strokeLinecap="round" opacity={f2(0.85 * smooth01(0.05, 0.4, bf))} />
        {near && <path d={openPath(rootEdge)} fill="none" stroke={T.deep} strokeWidth={f2(0.45 * s)} strokeLinecap="round" opacity={f2(0.4 * smooth01(0.05, 0.4, bf))} />}
      </g>
    );
    return { front: near, node };
  }
  for (const e of ears) if (!e.front) push(e.node);

  // ---- skin: shade base + lit layer shifted toward the key light, clipped to the silhouette ----
  const lv = mapply(d.view, LIGHT);
  const sh = Math.hypot(lv[0], lv[1]) || 1;
  const shift = 1.7 * s * Math.min(1, sh * 1.4);
  const dx = (lv[0] / sh) * shift;
  const dy = (-lv[1] / sh) * shift;
  const skinClip = `${id}-s`;
  push(
    <>
      <defs>
        <clipPath id={skinClip}>{SKIN.map((v, i) => ellipseEl(v, '#000', 0, 0, i))}</clipPath>
      </defs>
      {SKIN.map((v, i) => ellipseEl(v, T.shade, 0, 0, i))}
      <g clipPath={`url(#${skinClip})`}>{SKIN.map((v, i) => ellipseEl(v, T.skin, dx, dy, i))}</g>
    </>,
  );

  // ---- facial features (clipped to the skin silhouette) ----
  const features: ReactNode[] = [];
  const addF = (n: ReactNode) => features.push(<g key={features.length}>{n}</g>);
  const surfP = (x: number, y: number, off = 0): V3 => {
    const q = surface(x, y);
    return vadd(q.p, vscale(q.n, off));
  };

  // Cheek blush (soft, friendly)
  for (const side of [1, -1] as const) {
    const q = surface(4.6 * side, 2.4);
    const fv = facing(q.n);
    if (fv > 0.1) {
      const e = d.ellipse({ origin: W(q.p), rot: mmul(R, basis(q.n)) }, [1.9, 1.3, 0.01]);
      addF(
        <ellipse
          cx={f2(e.cx)}
          cy={f2(e.cy)}
          rx={f2(e.rx)}
          ry={f2(Math.max(e.ry, 0.01))}
          transform={`rotate(${f2(e.angle)} ${f2(e.cx)} ${f2(e.cy)})`}
          fill={T.blush}
          opacity={f2(0.22 * smooth01(0.1, 0.5, fv))}
        />,
      );
    }
  }

  // Eyes
  const gy = clamp(state.gazeYaw ?? 0, -35, 35);
  const gp = clamp(state.gazePitch ?? 0, -25, 25);
  const blink = clamp(state.blink ?? 0, 0, 1);
  const gazeRot = mmul(rotY(gy), rotX(gp));
  const gazeDir = mapply(gazeRot, [0, 0, 1]);
  const EY = EYE_Y;
  for (const side of [1, -1] as const) {
    const ex = EYE_X * side;
    const centre = surface(ex, EY);
    const fv = facing(centre.n);
    const vis = smooth01(0.05, 0.3, fv);
    if (vis <= 0) continue;
    const N = 7;
    const inner = 1.7;
    const outer = 1.85;
    const xAt = (t: number) => ex + side * lerp(-inner, outer, t);
    const upOpen = (t: number) => EY + 0.15 * t + 0.88 * Math.pow(Math.sin(Math.PI * t), 0.85) * (1 - 0.15 * t);
    const low = (t: number) => EY + 0.15 * t - 0.6 * Math.sin(Math.PI * Math.pow(t, 0.9));
    const closed = (t: number) => EY + 0.15 * t - 0.4 * Math.sin(Math.PI * t);
    const ts = Array.from({ length: N }, (_, i) => i / (N - 1));
    const upY = (t: number) => lerp(upOpen(t), closed(t), blink);
    const up3 = ts.map((t) => surfP(xAt(t), upY(t), -0.15));
    const lo3 = ts.map((t) => surfP(xAt(t), low(t), -0.15));
    const upS = up3.map(P);
    const loS = lo3.map(P);
    const parts: ReactNode[] = [];
    // Upper-lid crease (adult definition)
    const crease = ts.slice(1, -1).map((t) => P(surfP(xAt(t) + side * 0.15, upOpen(t) + 0.55 + 0.25 * Math.sin(Math.PI * t), 0)));
    parts.push(<path key="c" d={openPath(crease)} fill="none" stroke={T.deep} strokeWidth={f2(0.22 * s)} strokeLinecap="round" opacity={0.45} />);
    if (blink < 0.92) {
      const eyeClip = `${id}-e${side > 0 ? 'l' : 'r'}`;
      const shape = moveTo(upS[0]) + spline(upS, false) + `L${f2(loS[N - 1].x)} ${f2(loS[N - 1].y)}` + spline([...loS].reverse(), false) + 'Z';
      // Eyeball straight behind the opening (eyes face forward), not along the laterally-tilted
      // surface normal, which made neutral gaze converge (irises shifted toward the nose).
      const ball: V3 = vsub(centre.p, [0, 0, 1.75]);
      const rE = 1.95;
      const irisC = vadd(ball, vscale(gazeDir, rE * 0.97));
      const irisF: Frame = { origin: W(irisC), rot: mmul(R, gazeRot) };
      const ie = d.ellipse(irisF, [1.08, 1.08, 0.02]);
      const pe = d.ellipse(irisF, [0.5, 0.5, 0.02]);
      const hl = P(vadd(irisC, [-0.35, 0.4, 0.3]));
      const ell = (e: typeof ie, fill: string) => (
        <ellipse cx={f2(e.cx)} cy={f2(e.cy)} rx={f2(e.rx)} ry={f2(Math.max(e.ry, 0.01))} transform={`rotate(${f2(e.angle)} ${f2(e.cx)} ${f2(e.cy)})`} fill={fill} />
      );
      parts.push(
        <g key="e">
          <defs>
            <clipPath id={eyeClip}>
              <path d={shape} />
            </clipPath>
          </defs>
          <path d={shape} fill={T.white} />
          <g clipPath={`url(#${eyeClip})`}>
            {ell(ie, T.iris)}
            {ell(pe, T.pupil)}
            <circle cx={f2(hl.x)} cy={f2(hl.y)} r={f2(0.26 * s)} fill="#fff" opacity={0.9} />
            {/* lid shadow on the eyeball */}
            <path d={openPath(upS)} fill="none" stroke={T.deep} strokeWidth={f2(0.7 * s)} opacity={0.25} />
          </g>
        </g>,
      );
    }
    // Lash line: upper lid (open) or closed lid curve
    const lash = blink < 0.92 ? upS : ts.map((t) => P(surfP(xAt(t), closed(t), -0.1)));
    const flick = P(surfP(ex + side * (outer + 0.3), EY + 0.15 + (blink < 0.92 ? 0.22 : 0.02), -0.1));
    parts.push(
      <path
        key="l"
        d={openPath([...lash, flick])}
        fill="none"
        stroke={T.lash}
        strokeWidth={f2(0.36 * s)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />,
    );
    // Faint lower lid
    if (blink < 0.92)
      parts.push(<path key="lo" d={openPath(loS.slice(1, -1))} fill="none" stroke={T.deep} strokeWidth={f2(0.18 * s)} opacity={0.35} strokeLinecap="round" />);
    addF(<g opacity={vis < 1 ? f2(vis) : undefined}>{parts}</g>);

    // Brow: tapered filled stroke on the surface
    const bt = Array.from({ length: 7 }, (_, i) => i / 6);
    const bx = (t: number) => side * lerp(1.15, 5.7, t);
    const by = (t: number) => 9.35 + 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.25)) * (t > 0.8 ? 1 - (t - 0.8) * 2.2 : 1);
    const bw = (t: number) => lerp(0.5, 0.18, t);
    const bTop = bt.map((t) => surfP(bx(t), by(t) + bw(t), 0.05));
    const bBot = bt.map((t) => surfP(bx(t), by(t) - bw(t), 0.05));
    const bVis = smooth01(0.03, 0.25, facing(surface(bx(0.5), by(0.5)).n));
    if (bVis > 0) {
      const top = bTop.map(P);
      const bot = bBot.map(P).reverse();
      addF(<path d={moveTo(top[0]) + spline(top, false) + `L${f2(bot[0].x)} ${f2(bot[0].y)}` + spline(bot, false) + 'Z'} fill={T.hair} opacity={bVis < 1 ? f2(bVis) : undefined} />);
    }
  }

  // Mouth: gentle smile curve on the surface; keep only the visible part
  {
    const mt = Array.from({ length: 11 }, (_, i) => i / 10);
    const mpts = mt.map((t) => {
      const x = lerp(-2.25, 2.25, t);
      const q = surface(x, -1.25 + 0.32 * Math.pow(x / 2.25, 2));
      return { p: vadd(q.p, vscale(q.n, 0.02)), v: facing(q.n) };
    });
    const vis = mpts.filter((m) => m.v > 0.02).map((m) => P(m.p));
    if (vis.length >= 2) addF(<path d={openPath(vis)} fill="none" stroke={T.lipDark} strokeWidth={f2(0.42 * s)} strokeLinecap="round" />);
    const lower = Array.from({ length: 7 }, (_, i) => {
      const x = lerp(-1.2, 1.2, i / 6);
      const q = surface(x, -2.05 - 0.12 * Math.cos((x / 1.2) * Math.PI * 0.5));
      return { p: q.p, v: facing(q.n) };
    })
      .filter((m) => m.v > 0.05)
      .map((m) => P(m.p));
    if (lower.length >= 2) addF(<path d={openPath(lower)} fill="none" stroke={T.lip} strokeWidth={f2(0.5 * s)} strokeLinecap="round" opacity={0.35} />);
  }

  if (!state.faceless) push(<g clipPath={`url(#${skinClip})`}>{features}</g>);

  // ---- nose: 3D wedge that protrudes past the silhouette ----
  {
    const root = surfP(0, 8.3, -0.1);
    const rootL = surfP(1.0, 7.7, -0.1);
    const rootR = surfP(-1.0, 7.7, -0.1);
    const tip: V3 = [0, 3.7, 13.4];
    const tipL: V3 = [0.95, 3.55, 12.75];
    const tipR: V3 = [-0.95, 3.55, 12.75];
    const colum: V3 = [0, 2.5, 12.2];
    const alaL = vadd(surfP(1.85, 2.6), [0, 0, 0.9]);
    const alaR = vadd(surfP(-1.85, 2.6), [0, 0, 0.9]);
    const alaLb = surfP(1.75, 2.3, -0.1);
    const alaRb = surfP(-1.75, 2.3, -0.1);
    const sub = surfP(0, 2.0, -0.1);
    const all = [root, rootL, rootR, tip, tipL, tipR, colum, alaL, alaR, alaLb, alaRb, sub];
    const hp = hull(all.map(P));
    const faceN = (a: V3, b: V3, c: V3) => norm(cross(vsub(b, a), vsub(c, a)));
    const nodes: ReactNode[] = [<path key="h" d={moveTo(hp[0]) + hp.slice(1).map((q) => `L${f2(q.x)} ${f2(q.y)}`).join('') + 'Z'} fill={T.skin} stroke={T.skin} strokeWidth={f2(0.15 * s)} strokeLinejoin="round" />];
    // Side planes (outward normals), shaded when turned from the light
    const sides: [V3[], 1 | -1][] = [
      [[root, tipL, alaL, alaLb, rootL], 1],
      [[root, rootR, alaRb, alaR, tipR], -1],
    ];
    for (const [poly, side] of sides) {
      let n = faceN(poly[0], poly[1], poly[2]);
      if (n[0] * side < 0) n = vscale(n, -1);
      const fv = facing(n);
      const lit = vdot(n, lL);
      if (fv > 0 && lit < 0.35) {
        const ps = poly.map(P);
        nodes.push(<path key={`s${side}`} d={closedPath(ps)} fill={T.deep} opacity={f2(0.32 * smooth01(0.35, -0.3, lit) * smooth01(0, 0.25, fv))} />);
      }
    }
    // Underside plane + nostrils
    const underN = norm([0, -1, 0.35]);
    const uf = facing(underN);
    if (uf > 0) {
      const under = [tipL, tip, tipR, alaR, alaRb, sub, alaLb, alaL].map(P);
      nodes.push(<path key="u" d={closedPath(under)} fill={T.deep} opacity={f2(0.28 * smooth01(0, 0.3, uf))} />);
      for (const side of [1, -1] as const) {
        const c: V3 = [0.78 * side, 2.4, 11.35];
        const nf: Frame = { origin: W(c), rot: mmul(R, mmul(basis(underN, [0, 0, 1]), [Math.cos(0.5 * side), -Math.sin(0.5 * side), 0, Math.sin(0.5 * side), Math.cos(0.5 * side), 0, 0, 0, 1])) };
        const e = d.ellipse(nf, [0.62, 0.32, 0.01]);
        nodes.push(
          <ellipse
            key={`n${side}`}
            cx={f2(e.cx)}
            cy={f2(e.cy)}
            rx={f2(e.rx)}
            ry={f2(Math.max(e.ry, 0.01))}
            transform={`rotate(${f2(e.angle)} ${f2(e.cx)} ${f2(e.cy)})`}
            fill={T.nostril}
            opacity={f2(0.85 * smooth01(0.02, 0.3, uf))}
          />,
        );
      }
    }
    // Soft tip highlight
    const tf = facing(norm([0, 0.2, 1]));
    if (tf > 0.2) {
      const tp = P([-0.25, 4.15, 13.1]);
      nodes.push(<circle key="t" cx={f2(tp.x)} cy={f2(tp.y)} r={f2(0.9 * s)} fill="#fff" opacity={0.08} />);
    }
    push(<>{nodes}</>);
  }

  // ---- hair: visible part of the cap regions on the hair volumes ----
  if (!state.faceless) {
    const cap = (v: Vol) => {
      const hf = volFrame(v);
      const A = (u: V3): V3 => vadd(hf.origin, mapply(hf.rot, [u[0] * v.r[0], u[1] * v.r[1], u[2] * v.r[2]]));
      /** World-space outward normal at unit-sphere point u. */
      const Nw = (u: V3): V3 => norm(mapply(hf.rot, [u[0] / v.r[0], u[1] / v.r[1], u[2] / v.r[2]]));
      const wl = mapply(transpose(hf.rot), view);
      const w = norm([wl[0] / v.r[0], wl[1] / v.r[1], wl[2] / v.r[2]]);
      const shape = (line: Line) => {
        const pts = capOutline(w, line);
        if (pts.length < 3) return '';
        const sp = pts.map((u) => d.p(A(u)));
        return moveTo(sp[0]) + sp.slice(1).map((q) => `L${f2(q.x)} ${f2(q.y)}`).join('') + 'Z';
      };
      return { A, Nw, shape };
    };
    const main = cap(HAIR);
    const nape = cap(NAPE);
    const mainD = main.shape(hairlineTheta);
    const napeLine: Line = (phi) => lineTheta(NAPE_LINE, phi);
    const napeD = nape.shape(napeLine);
    const backness = -vL[2]; // 1 = seen straight from behind

    // Seen from behind, the neck stands between the viewer and the jaw/cheeks: repaint the lower skin
    // in the body's neck tones (shade, with the lit neck column shifted toward the key light), clipped
    // to the head's skin silhouette so it only recolours face volumes and never spills past them; the
    // jaw angles that peek out beside the neck read as turned-away shade.
    if (backness > 0.45) {
      const headDown = mapply(frame.rot, [0, -1, 0]);
      const down = norm(vadd(vscale(headDown, 0.45), [0, -0.55, 0]));
      const top = W([0, 1.5, -0.4]);
      const pt = d.p(top);
      const pb = d.p(vadd(top, vscale(down, 20)));
      let ax = pb.x - pt.x;
      let ay = pb.y - pt.y;
      const al = Math.hypot(ax, ay) || 1;
      ax /= al;
      ay /= al;
      let lx = dx - (dx * ax + dy * ay) * ax;
      let ly = dy - (dx * ax + dy * ay) * ay;
      const ll = Math.hypot(lx, ly) || 1;
      const r = 5.6 * s;
      lx = (lx / ll) * r * 0.2;
      ly = (ly / ll) * r * 0.2;
      const seg = (ox: number, oy: number) => `M${f2(pt.x + ox)} ${f2(pt.y + oy)}L${f2(pb.x + ox)} ${f2(pb.y + oy)}`;
      // Fade in over the first few px so the column's top edge never shows on the skull.
      const fadeLen = 3.5 * s;
      const grad = (gid: string, color: string, ox: number, oy: number) => (
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={f2(pt.x + ox)} y1={f2(pt.y + oy)} x2={f2(pt.x + ox + ax * fadeLen)} y2={f2(pt.y + oy + ay * fadeLen)}>
          <stop offset="0" stopColor={color} stopOpacity={0} />
          <stop offset="1" stopColor={color} stopOpacity={1} />
        </linearGradient>
      );
      const g0 = `${id}-n0`;
      const g1 = `${id}-n1`;
      push(
        <g clipPath={`url(#${skinClip})`} opacity={f2(smooth01(0.45, 0.8, backness))}>
          <defs>
            {grad(g0, C.skinShade, 0, 0)}
            {grad(g1, T.skin, lx, ly)}
          </defs>
          <path d={seg(0, 0)} stroke={`url(#${g0})`} strokeWidth={f2(2 * r * 1.8)} fill="none" />
          <path d={seg(lx, ly)} stroke={`url(#${g1})`} strokeWidth={f2(2 * r * 0.8)} fill="none" />
        </g>,
      );
    }

    // Soft shadow cast by the occiput onto the top of the neck (under the nape hairline).
    {
      const n = norm([0, -0.35, -1]);
      const fv = facing(n);
      if (fv > 0) {
        const e = d.ellipse({ origin: W([0, -0.9, -5.9]), rot: mmul(R, basis(n)) }, [4.5, 2.4, 0.01]);
        const g = `${id}-ns`;
        push(
          <>
            <defs>
              <radialGradient id={g}>
                <stop offset="0" stopColor={T.deep} stopOpacity={0.5} />
                <stop offset="0.55" stopColor={T.deep} stopOpacity={0.28} />
                <stop offset="1" stopColor={T.deep} stopOpacity={0} />
              </radialGradient>
            </defs>
            <ellipse
              cx={f2(e.cx)}
              cy={f2(e.cy)}
              rx={f2(e.rx)}
              ry={f2(Math.max(e.ry, 0.01))}
              transform={`rotate(${f2(e.angle)} ${f2(e.cx)} ${f2(e.cy)})`}
              fill={`url(#${g})`}
              opacity={f2(smooth01(0, 0.45, fv))}
            />
          </>,
        );
      }
    }

    if (napeD) {
      // Tapered short-cut edge: two faint, slightly lower copies fade the hair into the skin.
      for (const [drop, op] of [
        [3.6, 0.22],
        [1.8, 0.4],
      ] as const) {
        const t = nape.shape((phi) => napeLine(phi) - drop * smooth01(96, 130, Math.abs(phi)));
        if (t) push(<path d={t} fill={T.hair} opacity={op} />);
      }
      push(<path d={napeD} fill={T.hair} stroke={T.hair} strokeWidth={f2(0.2 * s)} strokeLinejoin="round" />);
    }
    if (mainD) push(<path d={mainD} fill={T.hair} stroke={T.hair} strokeWidth={f2(0.2 * s)} strokeLinejoin="round" />);

    if (mainD || napeD) {
      const clip = `${id}-h`;
      const deco: ReactNode[] = [];
      const visible = (vol: ReturnType<typeof cap>, u: V3, min: number) => vdot(vol.Nw(u), view) > min;
      // Sheen: arc on the light-facing upper front of the hair (as before).
      const sheen: Pt[] = [];
      for (let phi = -55; phi <= 10; phi += 5) {
        const u = sph(phi, 50 - 0.004 * (phi + 20) * (phi + 20));
        if (visible(main, u, 0.45)) sheen.push(d.p(main.A(u)));
      }
      if (sheen.length >= 3) deco.push(<path key="sh" d={openPath(sheen)} fill="none" stroke={T.hairLight} strokeWidth={f2(1.3 * s)} strokeLinecap="round" opacity={0.3} />);
      // Back of the crown: the key light grazes the top from the front, so only a soft lit band near
      // the crown (brighter toward the light's side) and a few strand-direction strokes flowing to the nape.
      if (backness > -0.2) {
        const fade = smooth01(-0.2, 0.35, backness);
        const runs: Pt[][] = [[]];
        for (let phi = -178; phi <= -92; phi += 4) {
          const u = sph(phi, 47 + 0.05 * (phi + 135));
          const ok = visible(main, u, 0.25) && vdot(main.Nw(u), LIGHT) > 0.2;
          if (ok) runs[runs.length - 1].push(d.p(main.A(u)));
          else if (runs[runs.length - 1].length) runs.push([]);
        }
        runs.forEach((r, i) => {
          if (r.length >= 3)
            deco.push(<path key={`bs${i}`} d={openPath(r)} fill="none" stroke={T.hairLight} strokeWidth={f2(1.6 * s)} strokeLinecap="round" opacity={f2(0.2 * fade)} />);
        });
        // Strand strokes: from the back of the crown down and slightly inward toward the nape.
        const strands: [number, number][] = [
          [-150, 0.9],
          [-128, 0.7],
          [-162, 0.5],
          [-172, 0.85],
          [170, 0.6],
          [156, 0.8],
          [138, 0.65],
          [124, 0.5],
        ];
        strands.forEach(([phi0, len], si) => {
          const pts: Pt[] = [];
          const N = 8;
          for (let j = 0; j <= N; j++) {
            const t = j / N;
            const phi = phi0 + (phi0 > 0 ? 1 : -1) * 10 * t * t;
            const top = 42 - 6 * (1 - len);
            const bottom = napeLine(phi) + 9;
            const u = sph(phi, lerp(top, lerp(top, bottom, len), t));
            if (!visible(nape, u, 0.2)) break;
            pts.push(d.p(nape.A(u)));
          }
          if (pts.length >= 3)
            deco.push(
              <path key={`st${si}`} d={openPath(pts)} fill="none" stroke={T.hairLight} strokeWidth={f2(0.32 * s)} strokeLinecap="round" opacity={f2(0.36 * fade)} />,
            );
        });
      }
      if (deco.length)
        push(
          <>
            <defs>
              <clipPath id={clip}>
                {mainD && <path d={mainD} />}
                {napeD && <path d={napeD} />}
              </clipPath>
            </defs>
            <g clipPath={`url(#${clip})`}>{deco}</g>
          </>,
        );
    }
  }

  // ---- ears facing the viewer go on top ----
  for (const e of ears) if (e.front) push(e.node);

  const pivot = d.p(frame.origin);
  d.add(pivot.depth, <g>{out}</g>, 0.5);
}
