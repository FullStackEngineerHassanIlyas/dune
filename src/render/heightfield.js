// Terrain heights for rendering, derived deterministically from the sim map (spec §5.2): sand with
// low swells, dunes as asymmetric waves, rock plateaus raised with soft edges, ridged mountains.
// Pure JS (no three) so it is testable under Node; the simulation never needs heights.
import { G } from '../data/terrain.js';

export const ROCK_HEIGHT = 0.42;

function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise2(x, y, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function ridged(x, y, s) {
  let sum = 0, amp = 0.6, f = 1;
  for (let o = 0; o < 3; o++) { sum += amp * (1 - Math.abs(noise2(x * f, y * f, s + o * 17) * 2 - 1)); amp *= 0.5; f *= 2.1; }
  return sum;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const isRock = (g) => g === G.ROCK || g === G.MOUNTAIN;
const isMountain = (g) => g === G.MOUNTAIN;
const isDune = (g) => g === G.DUNE;

export class Heightfield {
  constructor(map, { sub = 4, seed = map.seed ?? 1 } = {}) {
    this.map = map;
    this.sub = sub;
    this.seed = seed;
    this.vw = map.w * sub + 1;
    this.vh = map.h * sub + 1;
    const n = this.vw * this.vh;
    this.data = new Float32Array(n);
    this.rock = new Float32Array(n);
    this.mountain = new Float32Array(n);
    this.dune = new Float32Array(n);
    this.maxHeight = 0;
    this.build();
  }

  classAt(x, y, pred) {
    const m = this.map;
    x = Math.max(0, Math.min(m.w - 1, x));
    y = Math.max(0, Math.min(m.h - 1, y));
    return pred(m.ground[y * m.w + x]) ? 1 : 0;
  }

  // bilinear blend of a tile class over tile centres
  smoothClass(x, y, pred) {
    const fx = x - 0.5, fy = y - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const a = this.classAt(x0, y0, pred), b = this.classAt(x0 + 1, y0, pred);
    const c = this.classAt(x0, y0 + 1, pred), d = this.classAt(x0 + 1, y0 + 1, pred);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  build() {
    const { sub, seed, vw, vh, map } = this;
    for (let vy = 0; vy < vh; vy++) for (let vx = 0; vx < vw; vx++) {
      const x = vx / sub, y = vy / sub, k = vy * vw + vx;
      const wx = x + (noise2(x * 0.6, y * 0.6, seed) - 0.5) * 0.8;
      const wy = y + (noise2(x * 0.6 + 40, y * 0.6 + 40, seed) - 0.5) * 0.8;
      const r = smooth(0.32, 0.68, this.smoothClass(wx, wy, isRock));
      const m = smooth(0.12, 0.6, this.smoothClass(wx, wy, isMountain));
      const d = this.smoothClass(x, y, isDune);
      const wave = Math.pow(Math.sin(x * 0.55 + y * 0.18 + noise2(x * 0.25, y * 0.25, seed + 3) * 5) * 0.5 + 0.5, 1.8);
      const sand = (noise2(x * 0.35, y * 0.35, seed + 5) - 0.5) * 0.08 + d * (0.08 + 0.3 * wave);
      const rockTop = ROCK_HEIGHT + (noise2(x * 1.4, y * 1.4, seed + 9) - 0.5) * 0.05;
      const mountain = 0.5 + 2.3 * ridged(x * 0.45, y * 0.45, seed + 13);
      let h = sand * (1 - r) + rockTop * r + mountain * m;
      h *= smooth(0, 0.8, Math.min(x, y, map.w - x, map.h - y));   // meet the flat apron at the map edge
      this.data[k] = h;
      if (this.data[k] > this.maxHeight) this.maxHeight = this.data[k];   // the stored float32, not the double
      this.rock[k] = r;
      this.mountain[k] = m;
      this.dune[k] = d * (1 - r);
    }
  }

  heightAt(x, z) {
    const s = this.sub;
    const fx = Math.max(0, Math.min(this.vw - 1.0001, x * s)), fz = Math.max(0, Math.min(this.vh - 1.0001, z * s));
    const x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0, w = this.vw, d = this.data;
    const a = d[z0 * w + x0], b = d[z0 * w + x0 + 1], c = d[(z0 + 1) * w + x0], e = d[(z0 + 1) * w + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz;
  }

  normalAt(x, z, out = { x: 0, y: 1, z: 0 }) {
    const e = 0.5 / this.sub;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const nx = -hx / (2 * e), nz = -hz / (2 * e), len = Math.hypot(nx, 1, nz);
    out.x = nx / len; out.y = 1 / len; out.z = nz / len;
    return out;
  }

  /** Level the vertices under a structure footprint (tile rect) to their average height. */
  flatten(x0, y0, w, h) {
    const s = this.sub;
    let sum = 0, count = 0;
    for (let vy = y0 * s; vy <= (y0 + h) * s; vy++) for (let vx = x0 * s; vx <= (x0 + w) * s; vx++) { sum += this.data[vy * this.vw + vx]; count++; }
    const avg = sum / count;
    for (let vy = y0 * s; vy <= (y0 + h) * s; vy++) for (let vx = x0 * s; vx <= (x0 + w) * s; vx++) this.data[vy * this.vw + vx] = avg;
    return avg;
  }
}
