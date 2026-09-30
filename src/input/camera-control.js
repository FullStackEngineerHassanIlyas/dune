// Camera input (spec §5.5): screen-edge scrolling over the whole window (the sidebar included),
// arrow keys, wheel zoom, middle-drag pan, Alt + middle-drag rotate/tilt, and right-drag scrolling
// as in C&C Generals: hold the right button and pull away from where it went down, the further the
// faster. A pointer pushed out past a window edge keeps that edge scrolling until it comes back, so
// the cursor need not rest on the last pixel; losing focus stops it, and so does an open menu.
import { RIGHT_DRAG } from './pointer.js';

export const EXIT_BAND = 64;   // px: leaving the window this close to an edge counts as pushing past it

export function edgeScroll(x, y, w, h, margin = 6) {
  const right = x <= margin ? -1 : x >= w - 1 - margin ? 1 : 0;
  const forward = y <= margin ? 1 : y >= h - 1 - margin ? -1 : 0;
  return [right, forward];
}

/** Right-drag pull → [right, forward] in edge-scroll speeds: nothing inside the dead zone, then growing with the pull up to three times. */
export function dragScroll(dx, dy, dead = RIGHT_DRAG) {
  const d = Math.hypot(dx, dy);
  if (d <= dead) return [0, 0];
  const speed = Math.min(3, (d - dead) / 120);
  return [(dx / d) * speed, (-dy / d) * speed];
}

/** Eight-way name ('n', 'ne', … 'nw') of a scroll direction given as [right, forward]; null when still. */
export function compass(right, forward) {
  if (!right && !forward) return null;
  const sector = Math.round(Math.atan2(forward, right) / (Math.PI / 4));
  return ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'][(sector + 8) % 8];
}

export class CameraControl {
  constructor(rig, element, settings, { win = window, onScroll = () => {} } = {}) {
    this.rig = rig;
    this.el = element;
    this.settings = settings;
    this.win = win;
    this.onScroll = onScroll;
    this.mouse = { x: -1, y: -1, inside: false, out: null };   // out: the edges a pointer that left is pushing on
    this.keys = new Set();
    this.drag = null;
    this.pull = null;   // right-drag scrolling: where the button went down, where the pointer is now
    this.suspended = false;
    this.reported = 'none';
    win.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true; this.mouse.out = null;
      if (this.drag) this.onDrag(e);
      if (this.pull) {
        this.pull.x = e.clientX; this.pull.y = e.clientY;
        if (Math.hypot(this.pull.x - this.pull.x0, this.pull.y - this.pull.y0) > RIGHT_DRAG) this.pull.active = true;
      }
    });
    win.document?.addEventListener('mouseout', (e) => {
      if (e.relatedTarget) return;
      const [right, forward] = edgeScroll(e.clientX ?? this.mouse.x, e.clientY ?? this.mouse.y, this.win.innerWidth, this.win.innerHeight, EXIT_BAND);
      this.mouse.inside = false;
      this.mouse.out = right || forward ? [right, forward] : null;
    });
    win.addEventListener('blur', () => { this.mouse.inside = false; this.mouse.out = null; this.keys.clear(); this.drag = null; this.pull = null; });
    element.addEventListener('wheel', (e) => { e.preventDefault(); this.rig.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    element.addEventListener('pointerdown', (e) => {
      if (e.button === 2 && this.settings.rightDragScroll !== false) {
        this.pull = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false };
        return;
      }
      if (e.button !== 1) return;
      e.preventDefault();
      this.drag = { x: e.clientX, y: e.clientY, rotate: e.altKey };
      element.setPointerCapture?.(e.pointerId);
    });
    element.addEventListener('pointerup', (e) => { if (e.button === 1) this.drag = null; });
    win.addEventListener('pointerup', (e) => { if (e.button === 2) this.pull = null; });
    win.addEventListener('pointercancel', () => { this.pull = null; });
    win.addEventListener('keydown', (e) => { if (e.key.startsWith('Arrow') && !this.suspended) { this.keys.add(e.key); e.preventDefault(); } });   // a menu keeps its arrows for its sliders
    win.addEventListener('keyup', (e) => this.keys.delete(e.key));
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
    let dr = 0, df = 0, edge = null, pull = null;
    if (!this.suspended) {
      if (this.keys.has('ArrowLeft')) dr -= 1;
      if (this.keys.has('ArrowRight')) dr += 1;
      if (this.keys.has('ArrowUp')) df += 1;
      if (this.keys.has('ArrowDown')) df -= 1;
      if (this.pull?.active) pull = dragScroll(this.pull.x - this.pull.x0, this.pull.y - this.pull.y0);
      else if (this.settings.edgeScroll && !this.drag) {
        edge = this.mouse.inside ? edgeScroll(this.mouse.x, this.mouse.y, this.win.innerWidth, this.win.innerHeight) : this.mouse.out;
        if (edge) { dr += edge[0]; df += edge[1]; }
      }
    }
    if (dr || df) this.rig.pan(Math.sign(dr) * speed, Math.sign(df) * speed);
    if (pull) this.rig.pan(pull[0] * speed, pull[1] * speed);
    this.report(pull ? { dir: compass(this.pull.x - this.pull.x0, this.pull.y0 - this.pull.y), anchor: { x: this.pull.x0, y: this.pull.y0 } }
      : edge && compass(...edge) ? { dir: compass(...edge), anchor: null } : null);
  }

  /** Tells the cursor which way the map is scrolling (and from which anchor, for a right-drag) when that changes. */
  report(state) {
    const key = state ? `${state.dir}:${state.anchor?.x},${state.anchor?.y}` : 'none';
    if (key === this.reported) return;
    this.reported = key;
    this.onScroll(state);
  }
}
