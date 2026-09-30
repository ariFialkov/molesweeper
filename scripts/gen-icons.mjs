// Draws the app icon in pure JS (no native canvas needed) and writes PNGs for the PWA manifest.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function draw(size) {
  const s = size;
  const grass = [95, 174, 74];
  const grassDark = [63, 138, 51];
  const dirt = [120, 78, 44];
  const dirtDark = [78, 50, 24];
  const mole = [90, 58, 34];
  const nose = [255, 143, 176];
  const eye = [20, 12, 8];
  const red = [214, 40, 40];
  const yellow = [247, 217, 76];
  return png(s, (x, y) => {
    const u = x / s;
    const v = y / s;
    // rounded square background
    const r = 0.22;
    const cx = Math.min(Math.max(u, r), 1 - r);
    const cy = Math.min(Math.max(v, r), 1 - r);
    const dEdge = Math.hypot(u - cx, v - cy);
    if (dEdge > r) return [0, 0, 0, 0];
    // grid of grass squares
    const gx = Math.floor(u * 6);
    const gy = Math.floor(v * 6);
    let c = (gx + gy) % 2 ? grass : grassDark;
    // dirt hole
    const hx = 0.5;
    const hy = 0.62;
    const hd = Math.hypot((u - hx) * 1.0, (v - hy) * 1.6);
    if (hd < 0.34) c = mix(dirt, dirtDark, Math.min(1, hd / 0.34));
    // mole body
    const bd = Math.hypot((u - 0.5) * 1.15, (v - 0.55) * 1.0);
    if (bd < 0.24 && v < 0.62) c = mole;
    // paws
    for (const px of [0.36, 0.64]) if (Math.hypot(u - px, (v - 0.6) * 1.3) < 0.06) c = [232, 184, 152];
    // nose
    if (Math.hypot(u - 0.5, v - 0.5) < 0.05) c = nose;
    // eyes
    for (const ex of [0.43, 0.57]) if (Math.hypot(u - ex, v - 0.42) < 0.03) c = eye;
    // firecracker in the corner
    const fx = u - 0.78;
    const fy = v - 0.26;
    const rot = 0.6;
    const lx = fx * Math.cos(rot) + fy * Math.sin(rot);
    const ly = -fx * Math.sin(rot) + fy * Math.cos(rot);
    if (Math.abs(lx) < 0.055 && Math.abs(ly) < 0.14) c = Math.abs(ly) < 0.035 ? yellow : red;
    if (Math.hypot(lx, ly + 0.19) < 0.035) c = [255, 240, 150];
    return [c[0], c[1], c[2], 255];
  });
}

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) writeFileSync(`public/icons/icon-${size}.png`, draw(size));
console.log('icons written');
