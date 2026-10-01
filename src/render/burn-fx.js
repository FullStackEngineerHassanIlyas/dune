// Fire, smoke and blast recipes for destruction (spec §5.4; visual-units.md §1.1 damage smoke: a grey
// puff, then a tall dark column with orange flame at its base), built on the Effects pools
// (fx.glow additive, fx.smoke alpha). k scales a recipe with the size of what burns. Lingering smoke
// leans downwind, so columns over a battlefield all drift the same way. Every recipe fills particles
// from constant templates (k goes in as the particle's scale), so burning allocates nothing per frame.
const rnd = (a, b) => a + Math.random() * (b - a);
export const WIND = { x: 0.16, z: 0.07 };

// Templates: sizes are for k = 1.
const T = {
  grey:     { size: [0.12, 0.65], color: [0.26, 0.25, 0.24], color2: [0.5, 0.48, 0.46], alpha: [0.42, 0], drag: 0.5 },
  black:    { size: [0.26, 1.45], color: [0.025, 0.022, 0.02], color2: [0.18, 0.17, 0.16], alpha: [1, 0], drag: 0.45 },
  flame:    { size: [0.26, 0.1], color: [3, 1.1, 0.22], color2: [0.9, 0.16, 0.02], alpha: [1, 0] },
  tip:      { size: [0.13, 0.04], color: [3.4, 2.1, 0.7], alpha: [1, 0] },
  spark:    { size: [0.06, 0.02], color: [7, 4.2, 1.4], alpha: [1, 0], gravity: 7 },
  core:     { size: [0.7, 1.3], color: [4, 3.2, 2.2], alpha: [1, 0] },
  ball:     { size: [0.3, 1], color: [3.2, 1.3, 0.3], color2: [0.7, 0.14, 0.02], alpha: [1, 0], drag: 2.2 },
  mushroom: { size: [0.45, 2.1], color: [0.035, 0.03, 0.028], color2: [0.3, 0.28, 0.26], alpha: [0.9, 0], drag: 1.1 },
  blast:    { size: [0.25, 0.85], color: [3.6, 1.5, 0.35], color2: [0.8, 0.15, 0.02], alpha: [1, 0], drag: 2.8 },
  soot:     { size: [0.3, 1.4], color: [0.05, 0.045, 0.04], color2: [0.32, 0.3, 0.28], alpha: [0.8, 0], drag: 1 },
  spice:    { size: [0.3, 1.3], color: [0.86, 0.46, 0.16], color2: [0.8, 0.6, 0.38], alpha: [0.6, 0], drag: 1.6 },
  ring:     { size: [0.5, 1.8], color: [0.6, 0.52, 0.42], color2: [0.74, 0.66, 0.55], alpha: [0.55, 0], drag: 1.8 },
  plume:    { size: [0.7, 2.6], color: [0.46, 0.42, 0.37], color2: [0.66, 0.6, 0.52], alpha: [0.5, 0], drag: 0.9 },
};

/** Thin grey smoke: a vehicle or building past half health, a wreck smouldering out. */
export function greySmoke(fx, x, y, z, k = 1) {
  fx.smoke.spawn(T.grey, x, y, z, WIND.x + rnd(-0.06, 0.06), rnd(0.4, 0.7), WIND.z + rnd(-0.06, 0.06), rnd(1.4, 2.2), k);
}

/** Thick black oil smoke: fires, burning wrecks, a building near collapse. */
export function blackSmoke(fx, x, y, z, k = 1) {
  fx.smoke.spawn(T.black, x + rnd(-0.05, 0.05), y, z + rnd(-0.05, 0.05), WIND.x + rnd(-0.08, 0.08), rnd(0.55, 0.95), WIND.z + rnd(-0.08, 0.08), rnd(2.4, 3.6), k);
}

/** A tongue of flame licking upward: an orange body, now and then a yellow tip rising off it. */
export function fire(fx, x, y, z, k = 1) {
  fx.glow.spawn(T.flame, x + rnd(-0.07, 0.07) * k, y, z + rnd(-0.07, 0.07) * k, WIND.x * 0.4, rnd(0.35, 0.7) * k, WIND.z * 0.4, rnd(0.3, 0.5), k);
  if (Math.random() < 0.5) fx.glow.spawn(T.tip, x + rnd(-0.05, 0.05) * k, y + 0.08 * k, z + rnd(-0.05, 0.05) * k, WIND.x * 0.4, rnd(0.6, 1.1) * k, WIND.z * 0.4, rnd(0.2, 0.35), k);
}

/** A few sparks spitting out of torn metal. */
export function sparks(fx, x, y, z, n = 3, speed = 1.4) {
  for (let i = 0; i < n; i++) fx.glow.spawn(T.spark, x, y, z, rnd(-speed, speed), rnd(0.6, 2.2), rnd(-speed, speed), rnd(0.18, 0.4));
}

/**
 * A vehicle's fuel and ammunition going up: a white-hot core, a rolling orange ball that climbs and
 * darkens, a shower of sparks and a dark mushroom of smoke. k: about 0.7 for a Trike, 1.4 for a Harvester.
 * core: false leaves out the flash (when a big blast of the simulation's own already goes off there).
 */
export function fireball(fx, x, y, z, k = 1, core = true) {
  if (core) fx.glow.spawn(T.core, x, y + 0.1 * k, z, 0, 0, 0, 0.12, k);
  for (let i = 0, n = Math.round(11 * k); i < n; i++) {
    fx.glow.spawn(T.ball, x + rnd(-0.18, 0.18) * k, y + rnd(0, 0.25) * k, z + rnd(-0.18, 0.18) * k, rnd(-0.6, 0.6) * k, rnd(0.6, 1.5) * k, rnd(-0.6, 0.6) * k, rnd(0.6, 1.1), k);
  }
  sparks(fx, x, y + 0.1, z, Math.round(8 * k), 3 * k);
  for (let i = 0, n = Math.round(10 * k); i < n; i++) {
    fx.smoke.spawn(T.mushroom, x + rnd(-0.2, 0.2) * k, y + rnd(0.1, 0.4) * k, z + rnd(-0.2, 0.2) * k, WIND.x + rnd(-0.35, 0.35), rnd(0.8, 1.5) * k, WIND.z + rnd(-0.35, 0.35), rnd(2.6, 4), k);
  }
  fx.flash?.(x, y, z, 8 + 6 * k);
}

/** A secondary blast (ammunition cooking off, a floor of a building going up): orange, never white-hot. */
export function blast(fx, x, y, z, k = 1) {
  for (let i = 0, n = Math.round(7 * k); i < n; i++) {
    fx.glow.spawn(T.blast, x, y, z, rnd(-0.9, 0.9) * k, rnd(0.4, 1.3) * k, rnd(-0.9, 0.9) * k, rnd(0.35, 0.65), k);
  }
  sparks(fx, x, y, z, Math.round(5 * k), 2.5 * k);
  for (let i = 0, n = Math.round(4 * k); i < n; i++) {
    fx.smoke.spawn(T.soot, x + rnd(-0.15, 0.15) * k, y + 0.1, z + rnd(-0.15, 0.15) * k, WIND.x + rnd(-0.3, 0.3), rnd(0.5, 1.1), WIND.z + rnd(-0.3, 0.3), rnd(1.8, 2.8), k);
  }
  fx.flash?.(x, y, z, 4 + 3 * k);
}

/** A harvester's load thrown up as a cloud of orange spice dust. */
export function spiceBurst(fx, x, y, z) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, s = rnd(0.8, 2.2);
    fx.smoke.spawn(T.spice, x, y, z, Math.cos(a) * s, rnd(0.3, 1.1), Math.sin(a) * s, rnd(1.4, 2.4));
  }
}

/** The dust a building throws out as it comes down: a low ring rolling outward and a pale plume over the footprint. */
export function collapseDust(fx, cx, y, cz, w, h) {
  const r = Math.max(w, h) * 0.5, n = Math.round(10 + 6 * r);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(-0.1, 0.1), s = rnd(1.2, 2.4);
    fx.smoke.spawn(T.ring, cx + Math.cos(a) * r * 0.8, y + 0.1, cz + Math.sin(a) * r * 0.8, Math.cos(a) * s, rnd(0.1, 0.35), Math.sin(a) * s, rnd(1.6, 2.6));
  }
  for (let i = 0, m = Math.round(4 + 3 * r); i < m; i++) {
    fx.smoke.spawn(T.plume, cx + rnd(-r, r) * 0.6, y + rnd(0.2, 0.6), cz + rnd(-r, r) * 0.6, WIND.x + rnd(-0.2, 0.2), rnd(0.4, 0.9), WIND.z + rnd(-0.2, 0.2), rnd(2.4, 3.6));
  }
}
