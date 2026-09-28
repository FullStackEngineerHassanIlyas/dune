// Tileable detail textures for the terrain, generated once on a canvas (spec §5.2): grey rock grain
// with pebbles, small craters and cracks, multiplied onto rock and mountain colours in the shader.
import * as THREE from 'three';

function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// value noise that wraps every `period` lattice cells, so the texture tiles seamlessly
function tileNoise(x, y, period, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const w = (a) => ((a % period) + period) % period;
  const a = hash(w(x0), w(y0), s), b = hash(w(x0 + 1), w(y0), s), c = hash(w(x0), w(y0 + 1), s), d = hash(w(x0 + 1), w(y0 + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function rockDetailTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let n = 0, amp = 0.5, f = 8;
    for (let o = 0; o < 5; o++) { n += amp * tileNoise((x / size) * f, (y / size) * f, f, 11 + o); amp *= 0.5; f *= 2; }
    const v = Math.round(112 + n * 58);
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  let seed = 99;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const wrapped = (x, y, r, draw) => {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      if (x + dx > -r && x + dx < size + r && y + dy > -r && y + dy < size + r) draw(x + dx, y + dy);
    }
  };
  for (let k = 0; k < 7; k++) {   // craters: dark bowl, bright rim
    const x = rnd() * size, y = rnd() * size, r = 10 + rnd() * 22;
    wrapped(x, y, r + 4, (cx, cy) => {
      const grd = g.createRadialGradient(cx + r * 0.15, cy + r * 0.15, r * 0.1, cx, cy, r);
      grd.addColorStop(0, 'rgba(60,60,60,0.55)');
      grd.addColorStop(0.75, 'rgba(90,90,90,0.35)');
      grd.addColorStop(0.9, 'rgba(205,205,205,0.35)');
      grd.addColorStop(1, 'rgba(140,140,140,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    });
  }
  for (let k = 0; k < 900; k++) {   // pebbles with a lit top
    const x = rnd() * size, y = rnd() * size, r = 0.8 + rnd() * 2.6;
    wrapped(x, y, r + 2, (cx, cy) => {
      g.fillStyle = 'rgba(70,70,70,0.55)';
      g.beginPath(); g.ellipse(cx + 0.6, cy + 0.6, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(205,205,205,0.45)';
      g.beginPath(); g.ellipse(cx - 0.3, cy - 0.3, r * 0.7, r * 0.55, 0, 0, Math.PI * 2); g.fill();
    });
  }
  g.strokeStyle = 'rgba(55,55,55,0.45)';
  g.lineWidth = 1.2;
  for (let k = 0; k < 26; k++) {   // hairline cracks
    let x = rnd() * size, y = rnd() * size, a = rnd() * Math.PI * 2;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 14; s++) { a += (rnd() - 0.5) * 1.1; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
