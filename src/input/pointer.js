// Raw pointer events → clicks, drags and double-clicks (5 px drag threshold, 300 ms double-click).
const mods = (e) => ({ shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey });

export class Pointer {
  constructor(el, handlers) {
    this.h = handlers;
    this.down = null;
    this.lastClick = { t: 0, x: 0, y: 0, button: -1 };
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 2) return;
      el.setPointerCapture?.(e.pointerId);
      this.down = { x: e.clientX, y: e.clientY, button: e.button, dragging: false };
    });
    el.addEventListener('pointermove', (e) => {
      const d = this.down;
      if (d && d.button === 0 && !d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.dragging = true;
      if (d?.dragging) this.h.onDrag?.(d.x, d.y, e.clientX, e.clientY);
      this.h.onMove?.(e.clientX, e.clientY);
    });
    el.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || e.button !== d.button) return;
      if (d.dragging) { this.h.onDragEnd?.(d.x, d.y, e.clientX, e.clientY, mods(e)); return; }
      const now = performance.now(), lc = this.lastClick;
      const double = d.button === lc.button && now - lc.t < 300 && Math.hypot(e.clientX - lc.x, e.clientY - lc.y) < 6;
      this.lastClick = { t: double ? 0 : now, x: e.clientX, y: e.clientY, button: d.button };
      this.h.onClick?.(e.clientX, e.clientY, d.button, mods(e), double);
    });
    el.addEventListener('pointercancel', () => {
      if (this.down?.dragging) this.h.onDragCancel?.();
      this.down = null;
    });
  }
}
