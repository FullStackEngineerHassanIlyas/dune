// Camera input (spec §5.5): screen-edge scrolling, arrow keys, wheel zoom, middle-drag pan and
// Alt + middle-drag rotate/tilt. Edge scrolling stops when the pointer leaves the window.
export class CameraControl {
  constructor(rig, element, settings, { viewportRight = () => element.clientWidth } = {}) {
    this.rig = rig;
    this.el = element;
    this.settings = settings;
    this.viewportRight = viewportRight;
    this.mouse = { x: -1, y: -1, inside: false };
    this.keys = new Set();
    this.drag = null;
    element.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
      if (this.drag) this.onDrag(e);
    });
    element.addEventListener('pointerleave', () => { this.mouse.inside = false; });
    window.addEventListener('blur', () => { this.mouse.inside = false; this.keys.clear(); this.drag = null; });
    element.addEventListener('wheel', (e) => { e.preventDefault(); this.rig.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    element.addEventListener('pointerdown', (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      this.drag = { x: e.clientX, y: e.clientY, rotate: e.altKey };
      element.setPointerCapture?.(e.pointerId);
    });
    element.addEventListener('pointerup', (e) => { if (e.button === 1) this.drag = null; });
    window.addEventListener('keydown', (e) => { if (e.key.startsWith('Arrow')) { this.keys.add(e.key); e.preventDefault(); } });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
  }

  onDrag(e) {
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX; this.drag.y = e.clientY;
    if (this.drag.rotate) { this.rig.rotate(-dx * 0.006, dy * 0.004); return; }
    const scale = this.rig.distance * 0.0019;
    this.rig.pan(-dx * scale, dy * scale);
  }

  update(dt) {
    const speed = this.rig.distance * 0.95 * (this.settings.scrollSpeed ?? 1) * dt;
    let dr = 0, df = 0;
    if (this.keys.has('ArrowLeft')) dr -= 1;
    if (this.keys.has('ArrowRight')) dr += 1;
    if (this.keys.has('ArrowUp')) df += 1;
    if (this.keys.has('ArrowDown')) df -= 1;
    if (this.settings.edgeScroll && this.mouse.inside && !this.drag) {
      const m = 6, w = this.viewportRight(), h = this.el.clientHeight;
      if (this.mouse.x <= m) dr -= 1; else if (this.mouse.x >= w - m && this.mouse.x <= w) dr += 1;
      if (this.mouse.y <= m) df += 1; else if (this.mouse.y >= h - m) df -= 1;
    }
    if (dr || df) this.rig.pan(dr * speed, df * speed);
  }
}
