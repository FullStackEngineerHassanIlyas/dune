// Connected areas per movement class (4-connected over passable tiles), recomputed lazily when the
// map's passability revision changes. Orders use it to retarget unreachable goals up front instead
// of letting A* exhaust a whole region, and to keep group slots on each unit's side of a wall.
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Reachability {
  constructor(map) {
    this.map = map;
    this.labels = new Map();
    this.revision = -1;
  }

  labelsFor(cls) {
    if (this.revision !== this.map.revision) { this.labels.clear(); this.revision = this.map.revision; }
    let lab = this.labels.get(cls);
    if (!lab) { lab = this.compute(cls); this.labels.set(cls, lab); }
    return lab;
  }

  compute(cls) {
    const m = this.map, n = m.w * m.h;
    const lab = new Int32Array(n), queue = new Int32Array(n);
    let next = 1;
    for (let s = 0; s < n; s++) {
      if (lab[s] || m.moveFactor(s, cls) === 0) continue;
      let head = 0, tail = 0;
      queue[tail++] = s;
      lab[s] = next;
      while (head < tail) {
        const i = queue[head++], x = i % m.w, y = (i / m.w) | 0;
        for (const [dx, dy] of N4) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
          const j = ny * m.w + nx;
          if (!lab[j] && m.moveFactor(j, cls) > 0) { lab[j] = next; queue[tail++] = j; }
        }
      }
      next++;
    }
    return lab;
  }

  connected(a, b, cls) {
    const lab = this.labelsFor(cls);
    return lab[a] !== 0 && lab[a] === lab[b];
  }

  /** Nearest tile to `goal` (ring by ring) in the same area as `from`, ties going to the side `from` is on. */
  nearestReachable(goal, from, cls) {
    const m = this.map, lab = this.labelsFor(cls), want = lab[from];
    if (!want) return null;
    const gx = m.xOf(goal), gy = m.yOf(goal), fx = m.xOf(from), fy = m.yOf(from);
    const maxR = Math.max(m.w, m.h);
    for (let r = 1; r <= maxR; r++) {
      let best = -1, bestD = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = gx + dx, y = gy + dy;
        if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
        const i = y * m.w + x, d = (dx * dx + dy * dy) * 1e6 + (x - fx) ** 2 + (y - fy) ** 2;
        if (lab[i] === want && d < bestD) { best = i; bestD = d; }
      }
      if (best >= 0) return best;
    }
    return null;
  }
}
