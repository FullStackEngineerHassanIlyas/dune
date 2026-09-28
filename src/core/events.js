// Simulation → presentation event queue, drained once per rendered frame.
export class EventQueue {
  constructor() { this.items = []; }
  push(type, data = {}) { data.type = type; this.items.push(data); return data; }
  drain() { const out = this.items; this.items = []; return out; }
}

// Tiny synchronous emitter for UI and input wiring.
export class Emitter {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) { this.map.get(name)?.delete(fn); }
  emit(name, ...args) { for (const fn of [...(this.map.get(name) ?? [])]) fn(...args); }
}
