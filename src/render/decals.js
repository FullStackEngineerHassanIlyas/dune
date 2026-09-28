// Paintable multiply map over the terrain: craters, scorch and track marks (spec §5.2).
// White means untouched; the texture uploads at most five times a second.
import * as THREE from 'three';

export class DecalMap {
  constructor(w, h) {
    this.px = Math.min(2048, Math.max(512, w * 16)) / w;   // pixels per tile
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(w * this.px);
    this.canvas.height = Math.round(h * this.px);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.dirty = false;
    this.lastFlush = 0;
  }

  blob(x, y, radius, inner, outer) {
    const c = this.ctx, px = this.px, cx = x * px, cy = y * px, r = radius * px;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, inner);
    g.addColorStop(0.65, outer);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    this.dirty = true;
  }

  crater(x, y, radius, strength = 0.55) { this.blob(x, y, radius, `rgba(45,32,22,${strength})`, `rgba(80,60,40,${strength * 0.5})`); }
  scorch(x, y, radius) { this.blob(x, y, radius, 'rgba(30,26,24,0.55)', 'rgba(60,50,42,0.25)'); }

  track(x, y, heading, width = 0.28, alpha = 0.05) {
    const c = this.ctx, px = this.px;
    c.save();
    c.translate(x * px, y * px);
    c.rotate(heading);
    c.fillStyle = `rgba(90,70,48,${alpha})`;
    c.fillRect(-0.18 * px, -width * px * 0.5 - 0.05 * px, 0.36 * px, 0.1 * px);
    c.fillRect(-0.18 * px, width * px * 0.5 - 0.05 * px, 0.36 * px, 0.1 * px);
    c.restore();
    this.dirty = true;
  }

  flush(now) {
    if (this.dirty && now - this.lastFlush > 200) {
      this.texture.needsUpdate = true;
      this.dirty = false;
      this.lastFlush = now;
    }
  }
}
