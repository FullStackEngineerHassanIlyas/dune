// Seeded PRNG (mulberry32). Every random decision in the simulation goes through an Rng so that the
// same seed and the same commands always produce the same game.
export class Rng {
  constructor(seed = 1) {
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(n) { return Math.floor(this.next() * n); }
  range(a, b) { return a + (b - a) * this.next(); }
  chance(p) { return this.next() < p; }
  pick(list) { return list[this.int(list.length)]; }

  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
}

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
