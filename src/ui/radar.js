// Radar (spec §4.9, §5.6, §5.7): the minimap in the sidebar, the map as the player knows it with the
// camera's view outlined in white. Left click or drag jumps the camera; in the Classic scheme a left
// click with own units selected orders them there, in Modern a right click does. Without a powered
// Outpost it shows static and "RADAR OFFLINE"; coming online it opens from the centre.
import { radarImage } from './radar-model.js';

const NOISE = 48, REFRESH = 0.25, OPEN = 0.8;

export class Radar {
  constructor(el, { world, house, onJump, onOrder, ordersOnLeft = () => false, ordersOnRight = () => false }) {
    Object.assign(this, { world, house, onJump, onOrder, ordersOnLeft, ordersOnRight });
    const map = world.map;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'radar-canvas';
    this.label = document.createElement('div');
    this.label.className = 'radar-offline';
    this.label.textContent = 'RADAR OFFLINE';
    el.append(this.canvas, this.label);
    this.ctx = this.canvas.getContext('2d');
    this.tiles = document.createElement('canvas');
    this.tiles.width = map.w;
    this.tiles.height = map.h;
    this.tctx = this.tiles.getContext('2d');
    this.image = this.tctx.createImageData(map.w, map.h);
    this.noise = document.createElement('canvas');
    this.noise.width = this.noise.height = NOISE;
    this.nctx = this.noise.getContext('2d');
    this.noiseImage = this.nctx.createImageData(NOISE, NOISE);
    this.online = null;
    this.age = 0;
    this.timer = 0;
    this.size = 0;
    this.dragging = false;
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerdown', (e) => this.pointer(e, true));
    this.canvas.addEventListener('pointermove', (e) => { if (this.dragging) this.pointer(e, false); });
    const stop = () => { this.dragging = false; };
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
  }

  layout() {
    const map = this.world.map, scale = this.size / Math.max(map.w, map.h);
    return { scale, ox: (this.size - map.w * scale) / 2, oy: (this.size - map.h * scale) / 2 };
  }

  pointer(e, down) {
    if (!this.online) return;
    const r = this.canvas.getBoundingClientRect(), { scale, ox, oy } = this.layout();
    const x = (e.clientX - r.left - ox) / scale, y = (e.clientY - r.top - oy) / scale;
    const map = this.world.map;
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return;
    if (down && e.button === 2) { if (this.ordersOnRight()) this.onOrder(Math.floor(x), Math.floor(y)); return; }
    if (down && e.button !== 0) return;
    if (down && this.ordersOnLeft()) { this.onOrder(Math.floor(x), Math.floor(y)); return; }
    if (down) { this.dragging = true; this.canvas.setPointerCapture?.(e.pointerId); }
    this.onJump(x, y);
  }

  resize() {
    const size = this.canvas.clientWidth || 220;
    if (size === this.size) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.size = size;
    this.canvas.width = this.canvas.height = Math.round(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  update(dt, { online, view }) {
    this.resize();
    if (online !== this.online) {
      this.online = online;
      this.age = 0;
      this.timer = 0;
      this.label.classList.toggle('show', !online);
    }
    this.age += dt;
    const c = this.ctx, size = this.size;
    if (!online) { this.drawStatic(); return; }
    if ((this.timer -= dt) <= 0) {
      this.timer = REFRESH;
      radarImage(this.world, this.house, this.image.data);
      this.tctx.putImageData(this.image, 0, 0);
    }
    const { scale, ox, oy } = this.layout(), map = this.world.map;
    c.save();
    c.fillStyle = '#000';
    c.fillRect(0, 0, size, size);
    if (this.age < OPEN) { c.beginPath(); c.arc(size / 2, size / 2, (this.age / OPEN) * size * 0.72, 0, Math.PI * 2); c.clip(); }
    c.imageSmoothingEnabled = false;
    c.drawImage(this.tiles, ox, oy, map.w * scale, map.h * scale);
    if (view) {
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 1;
      c.beginPath();
      view.forEach((p, k) => { const x = ox + p.x * scale, y = oy + p.z * scale; if (k) c.lineTo(x, y); else c.moveTo(x, y); });
      c.closePath();
      c.stroke();
    }
    c.restore();
  }

  drawStatic() {
    const d = this.noiseImage.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 110; d[i] = v; d[i + 1] = v * 0.9; d[i + 2] = v * 0.7; d[i + 3] = 255; }
    this.nctx.putImageData(this.noiseImage, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.noise, 0, 0, this.size, this.size);
  }
}
