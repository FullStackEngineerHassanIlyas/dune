// A* on the tile grid: 8-connected, no corner cutting, step cost = distance × TERRAIN_REF / terrain
// factor, so slow ground is avoided the way the original units avoid it. Unreachable goals and
// exhausted budgets return the path to the explored tile closest to the goal.
import { TERRAIN_REF } from '../data/tuning.js';

const SQRT2 = Math.SQRT2;
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2]];
// Estimate one step at the cost of ordinary sand or rock (factor 160). Only concrete is cheaper, so
// paths across concrete may be slightly longer than optimal — in exchange searches stay small.
const H_STEP = TERRAIN_REF / 160;

class MinHeap {
  constructor(capacity) { this.ids = new Int32Array(capacity); this.pri = new Float32Array(capacity); this.size = 0; }
  clear() { this.size = 0; }
  push(id, p) {
    if (this.size === this.ids.length) this.grow();
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.pri[parent] <= p) break;
      this.ids[i] = this.ids[parent]; this.pri[i] = this.pri[parent]; i = parent;
    }
    this.ids[i] = id; this.pri[i] = p;
  }
  pop() {
    const top = this.ids[0];
    const lastId = this.ids[--this.size], lastP = this.pri[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.pri[c + 1] < this.pri[c]) c++;
      if (this.pri[c] >= lastP) break;
      this.ids[i] = this.ids[c]; this.pri[i] = this.pri[c]; i = c;
    }
    this.ids[i] = lastId; this.pri[i] = lastP;
    return top;
  }
  grow() {
    const ids = new Int32Array(this.ids.length * 2); ids.set(this.ids); this.ids = ids;
    const pri = new Float32Array(this.pri.length * 2); pri.set(this.pri); this.pri = pri;
  }
}

export class PathFinder {
  constructor(map) {
    this.map = map;
    const n = map.w * map.h;
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.opened = new Uint32Array(n);   // search generation that last touched the node
    this.closed = new Uint32Array(n);
    this.gen = 0;
    this.heap = new MinHeap(n);
    this.expanded = 0;
  }

  find(start, goal, moveClass, { maxNodes = 30000, blocked = null, extraCost = null } = {}) {
    const { map } = this;
    const w = map.w, h = map.h;
    const gen = ++this.gen;
    const gx = goal % w, gy = (goal / w) | 0;
    const hOf = (i) => {
      const dx = Math.abs((i % w) - gx), dy = Math.abs(((i / w) | 0) - gy);
      return (Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)) * H_STEP;
    };
    const passable = (i) => map.moveFactor(i, moveClass) > 0 && !(blocked && i !== goal && blocked(i));
    const heap = this.heap;
    heap.clear();
    this.g[start] = 0; this.from[start] = -1; this.opened[start] = gen;
    heap.push(start, hOf(start));
    let best = start, bestH = hOf(start), expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      if (cur === goal) { best = cur; bestH = 0; break; }
      const hc = hOf(cur);
      if (hc < bestH) { bestH = hc; best = cur; }
      if (++expanded > maxNodes) break;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy, dist] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (this.closed[ni] === gen || !passable(ni)) continue;
        if (dx && dy && (!passable(cy * w + nx) || !passable(ny * w + cx))) continue;
        const ng = this.g[cur] + (dist * TERRAIN_REF) / map.moveFactor(ni, moveClass) + (extraCost ? extraCost(ni) : 0);
        if (this.opened[ni] !== gen || ng < this.g[ni]) {
          this.opened[ni] = gen; this.g[ni] = ng; this.from[ni] = cur;
          heap.push(ni, ng + hOf(ni));
        }
      }
    }
    this.expanded = expanded;
    const path = [];
    for (let i = best; i !== start && i !== -1; i = this.from[i]) path.push(i);
    path.reverse();
    return { path, reached: best === goal };
  }
}
