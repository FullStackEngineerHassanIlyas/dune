// Procedural canvas textures. Outside the browser (Node tests) they are null.
import * as THREE from 'three';

const cache = {};
const hasDom = () => typeof document !== 'undefined';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/**
 * Tileable grime and wear (linear multipliers ~0.8–1.0) for the triplanar detail in materials.js:
 * soft blotches from four octaves of wrapped value noise, fine grain, rain streaks running down
 * (texture v is model y on side faces) and small scratches.
 */
export function detailTexture() {
  if (!hasDom()) return null;
  if (cache.detail) return cache.detail;
  const N = 256;
  const c = canvas(N), g = c.getContext('2d');
  let s = 1234567;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const field = new Float32Array(N * N);
  for (const [cells, amp] of [[4, 0.45], [8, 0.27], [16, 0.17], [48, 0.11]]) {
    const grid = Array.from({ length: cells * cells }, rnd);
    const at = (x, y) => grid[(y % cells) * cells + (x % cells)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = (x / N) * cells, fy = (y / N) * cells, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx, bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
      field[y * N + x] += (top * (1 - sy) + bottom * sy) * amp;
    }
  }
  const img = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const blotch = Math.min(1, Math.max(0, (0.62 - field[i]) / 0.3));   // grime gathers in the low spots
    const v = 1 - 0.1 * blotch - rnd() * 0.035;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = Math.round(255 * v);
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const wrapped = (draw) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) draw(ox, oy); };
  g.fillStyle = '#4a4540';
  for (let k = 0; k < 34; k++) {
    const x = rnd() * N, y = rnd() * N, w = 1 + rnd() * 2.5, h = 14 + rnd() * 60;
    g.globalAlpha = 0.05 + rnd() * 0.07;
    wrapped((ox, oy) => g.fillRect(x + ox, y + oy, w, h));
  }
  g.strokeStyle = '#3b3733';
  g.lineWidth = 0.8;
  for (let k = 0; k < 26; k++) {
    const x = rnd() * N, y = rnd() * N, a = rnd() * Math.PI, l = 3 + rnd() * 9;
    g.globalAlpha = 0.14 + rnd() * 0.12;
    wrapped((ox, oy) => { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke(); });
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return (cache.detail = t);
}

/** Track links in the Genesis blue-black with lavender link highlights; scrolled per instance by the tread material. */
export function treadTexture() {
  if (!hasDom()) return null;
  if (cache.tread) return cache.tread;
  const c = canvas(64), g = c.getContext('2d');
  g.fillStyle = '#2c2c48'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#141426'; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 4, 64);
  g.fillStyle = '#6a6a8e'; for (let x = 0; x < 64; x += 8) g.fillRect(x + 4, 0, 1, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return (cache.tread = t);
}
