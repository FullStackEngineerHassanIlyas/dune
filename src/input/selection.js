// Selection state plus pure screen-space hit tests (testable without a browser).
export class Selection {
  constructor() { this.ids = new Set(); this.version = 0; }
  set(ids) { this.ids = new Set(ids); this.version++; }
  add(ids) { for (const id of ids) this.ids.add(id); this.version++; }
  toggle(id) { if (this.ids.has(id)) this.ids.delete(id); else this.ids.add(id); this.version++; }
  clear() { if (this.ids.size) { this.ids.clear(); this.version++; } }
  has(id) { return this.ids.has(id); }
  list() { return [...this.ids]; }
  prune(alive) {
    let changed = false;
    for (const id of this.ids) if (!alive(id)) { this.ids.delete(id); changed = true; }
    if (changed) this.version++;
  }
}

/** Nearest candidate whose radius contains the point; own units win close calls. */
export function pickAt(candidates, x, y) {
  let best = null, bestScore = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(c.sx - x, c.sy - y);
    if (d > c.r) continue;
    const score = d - (c.own ? 4 : 0);
    if (score < bestScore) { best = c; bestScore = score; }
  }
  return best;
}

export function inBox(candidates, x0, y0, x1, y1) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
  return candidates.filter((c) => c.sx >= ax && c.sx <= bx && c.sy >= ay && c.sy <= by).map((c) => c.id);
}
