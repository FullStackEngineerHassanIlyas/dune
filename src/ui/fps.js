// ?fps=1 overlay (spec §10): frames per second, worst frame time, draw calls and triangles. It times
// real frame intervals (the game loop caps its dt), so slow devices are reported honestly.
export class FpsMeter {
  constructor(root, renderer) {
    this.el = document.createElement('div');
    this.el.className = 'fps-meter';
    this.el.textContent = 'measuring…';
    root.appendChild(this.el);
    this.renderer = renderer;
    this.last = null;
    this.frames = 0; this.acc = 0; this.worst = 0;
  }
  frame() {
    const now = performance.now();
    if (this.last === null) { this.last = now; return; }
    const dt = (now - this.last) / 1000;
    this.last = now;
    this.frames++; this.acc += dt; this.worst = Math.max(this.worst, dt);
    if (this.acc < 0.5) return;
    const info = this.renderer.info.render;
    this.el.textContent = `${(this.frames / this.acc).toFixed(1)} fps · worst ${(this.worst * 1000).toFixed(0)} ms · ${info.calls} draws · ${(info.triangles / 1000).toFixed(0)}k tris`;
    this.frames = 0; this.acc = 0; this.worst = 0;
  }
}
