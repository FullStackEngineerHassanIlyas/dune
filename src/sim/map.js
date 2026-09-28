// Tile grid shared by every system. Ground types never change during a game; spice, concrete,
// rubble, structures and unit occupancy do.
import { G, SURFACE, moveFactor } from '../data/terrain.js';

export class GameMap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.ground = new Uint8Array(n);      // G.*
    this.spice = new Uint16Array(n);      // spice credits lying on the tile
    this.concrete = new Uint8Array(n);    // 0 = none, else owning house slot + 1
    this.bloom = new Uint8Array(n);       // 1 = spice bloom mound
    this.rubble = new Uint8Array(n);      // 1 = rubble of a destroyed wall/structure
    this.structure = new Int32Array(n);   // structure id or 0
    this.unit = new Int32Array(n);        // ground unit id holding or reserving the tile, or 0
    this.revision = 0;                    // bumps whenever passability changes
    this.spiceRevision = 0;
    this.concreteRevision = 0;
    this.seed = 1;
  }

  idx(x, y) { return y * this.w + x; }
  xOf(i) { return i % this.w; }
  yOf(i) { return (i / this.w) | 0; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  surface(i) {
    if (this.structure[i]) return SURFACE.BLOCKED;
    if (this.concrete[i]) return SURFACE.CONCRETE;
    const g = this.ground[i];
    if (g === G.MOUNTAIN) return SURFACE.MOUNTAIN;
    if (g === G.ROCK) return this.rubble[i] ? SURFACE.RUBBLE : SURFACE.ROCK;
    if (this.spice[i] > 0) return SURFACE.SPICE;
    return g === G.DUNE ? SURFACE.DUNE : SURFACE.SAND;
  }

  moveFactor(i, moveClass) { return moveFactor(this.surface(i), moveClass); }

  isSand(i) {
    const g = this.ground[i];
    return (g === G.SAND || g === G.DUNE) && !this.concrete[i] && !this.structure[i];
  }

  isBuildableGround(i) { return this.ground[i] === G.ROCK && !this.structure[i]; }

  setSpice(i, amount) {
    this.spice[i] = Math.max(0, Math.min(65535, Math.round(amount)));
    this.spiceRevision++;
  }
}
