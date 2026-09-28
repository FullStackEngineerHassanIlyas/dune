// Procedural canvas textures. Outside the browser (Node tests) they are null.
import * as THREE from 'three';

const cache = {};
const hasDom = () => typeof document !== 'undefined';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/** Light grime and panel seams (linear values 0.84–1.0) that modulate vertex colours. */
export function detailTexture() {
  if (!hasDom()) return null;
  if (cache.detail) return cache.detail;
  const c = canvas(256), g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  let s = 1234567;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 256 * 256; i++) {
    const v = 215 + rnd() * 40;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.3;
  g.strokeStyle = '#707070';
  g.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    const p = 20 + k * 42;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke();
    g.beginPath(); g.moveTo(0, p + 11); g.lineTo(256, p + 11); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return (cache.detail = t);
}

/** Track cleats; scrolled per instance by the tread material. */
export function treadTexture() {
  if (!hasDom()) return null;
  if (cache.tread) return cache.tread;
  const c = canvas(64), g = c.getContext('2d');
  g.fillStyle = '#3a3531'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#1c1a18'; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 4, 64);
  g.fillStyle = '#5a534c'; for (let x = 0; x < 64; x += 8) g.fillRect(x + 4, 0, 1, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return (cache.tread = t);
}
