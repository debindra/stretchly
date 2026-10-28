#!/usr/bin/env node
/**
 * Generate the extension icons from the figure mark in public/logo.png.
 *
 * The wordmark is unreadable at toolbar sizes, so only the mark (the left-most
 * shape in the logo) is used. It is cropped to its bounding box, centered on a
 * transparent square and resampled with a Catmull-Rom filter. No dependencies:
 * PNG decode/encode uses node:zlib.
 *
 *   node scripts/generate-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Size → padding around the mark. Chrome suggests ~16px padding at 128px;
// toolbar sizes use less so the mark stays legible.
const SIZES = { 16: 0, 32: 1, 48: 3, 128: 12 };

function decodePng(file) {
  const buf = readFileSync(file);
  let offset = 8;
  let width, height, colorType, bitDepth;
  const idat = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    offset += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`${file}: expected 8-bit RGBA PNG`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const r = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y ? px[(y - 1) * stride + x - 4] : 0;
      let v;
      if (filter === 0) v = r;
      else if (filter === 1) v = r + a;
      else if (filter === 2) v = r + b;
      else if (filter === 3) v = r + ((a + b) >> 1);
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = r + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { width, height, px };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
  return out;
}

function encodePng(file, size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ])
  );
}

/** Bounding box of the first opaque column run (the mark, left of the wordmark). */
function markBounds({ width, height, px }) {
  const opaque = (x, y) => px[(y * width + x) * 4 + 3] > 8;
  const colHasInk = (x) => {
    for (let y = 0; y < height; y++) if (opaque(x, y)) return true;
    return false;
  };
  let x0 = 0;
  while (x0 < width && !colHasInk(x0)) x0++;
  let x1 = x0;
  while (x1 + 1 < width && colHasInk(x1 + 1)) x1++;
  let y0 = height, y1 = 0;
  for (let y = 0; y < height; y++)
    for (let x = x0; x <= x1; x++)
      if (opaque(x, y)) {
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const cubic = (t) => {
  t = Math.abs(t);
  if (t < 1) return 1.5 * t ** 3 - 2.5 * t ** 2 + 1;
  if (t < 2) return -0.5 * t ** 3 + 2.5 * t ** 2 - 4 * t + 2;
  return 0;
};

/** Resample the source box into a size×size canvas (premultiplied alpha, supersampled when shrinking). */
function render(img, box, size, padding) {
  const { width, height, px } = img;
  const scale = Math.min((size - padding * 2) / box.w, (size - padding * 2) / box.h);
  const dw = box.w * scale, dh = box.h * scale;
  const ox = (size - dw) / 2, oy = (size - dh) / 2;
  const ss = Math.max(1, Math.ceil(1 / scale));
  const out = Buffer.alloc(size * size * 4);
  const sample = (sx, sy) => {
    const ix = Math.floor(sx), iy = Math.floor(sy);
    let r = 0, g = 0, b = 0, a = 0, wsum = 0;
    for (let j = -1; j <= 2; j++)
      for (let i = -1; i <= 2; i++) {
        const wgt = cubic(sx - (ix + i)) * cubic(sy - (iy + j));
        const x = ix + i, y = iy + j;
        wsum += wgt;
        // Only read pixels inside the mark's box, so the wordmark never bleeds in.
        if (x < box.x0 || y < box.y0 || x >= box.x0 + box.w || y >= box.y0 + box.h) continue;
        const k = (y * width + x) * 4, al = px[k + 3] / 255;
        r += px[k] * al * wgt;
        g += px[k + 1] * al * wgt;
        b += px[k + 2] * al * wgt;
        a += al * wgt;
      }
    return [r / wsum, g / wsum, b / wsum, a / wsum];
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const u = (x + (sx + 0.5) / ss - ox) / scale + box.x0 - 0.5;
          const v = (y + (sy + 0.5) / ss - oy) / scale + box.y0 - 0.5;
          const [pr, pg, pb, pa] = sample(u, v);
          r += pr; g += pg; b += pb; a += pa;
        }
      const n = ss * ss;
      a = Math.min(1, Math.max(0, a / n));
      const k = (y * size + x) * 4;
      if (a > 0) {
        out[k] = Math.min(255, Math.max(0, Math.round(r / n / a)));
        out[k + 1] = Math.min(255, Math.max(0, Math.round(g / n / a)));
        out[k + 2] = Math.min(255, Math.max(0, Math.round(b / n / a)));
      }
      out[k + 3] = Math.round(a * 255);
    }
  return out;
}

const logo = decodePng(join(PUBLIC_DIR, 'logo.png'));
const box = markBounds(logo);
console.log(`Mark found at ${box.x0},${box.y0} (${box.w}×${box.h}px)`);
for (const [size, padding] of Object.entries(SIZES)) {
  const file = join(PUBLIC_DIR, 'icons', `icon${size}.png`);
  encodePng(file, Number(size), render(logo, box, Number(size), padding));
  console.log(`✓ icons/icon${size}.png`);
}
