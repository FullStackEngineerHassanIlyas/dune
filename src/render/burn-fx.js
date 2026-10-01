// Fire, smoke and blast recipes for destruction (spec §5.4; visual-units.md §1.1 damage smoke: a grey
// puff, then a tall dark column with orange flame at its base), built on the Effects pools
// (fx.glow additive, fx.smoke alpha). k scales a recipe with the size of what burns. Lingering smoke
// leans downwind, so columns over a battlefield all drift the same way.
const rnd = (a, b) => a + Math.random() * (b - a);
export const WIND = { x: 0.16, z: 0.07 };

/** Thin grey smoke: a vehicle or building past half health, a wreck smouldering out. */
export function greySmoke(fx, x, y, z, k = 1) {
  fx.smoke.emit({ x, y, z, vx: WIND.x + rnd(-0.06, 0.06), vy: rnd(0.4, 0.7), vz: WIND.z + rnd(-0.06, 0.06), life: rnd(1.4, 2.2), size: [0.12 * k, 0.65 * k], color: [0.26, 0.25, 0.24], color2: [0.5, 0.48, 0.46], alpha: [0.42, 0], drag: 0.5 });
}

/** Thick black oil smoke: fires, burning wrecks, a building near collapse. */
export function blackSmoke(fx, x, y, z, k = 1) {
  fx.smoke.emit({ x: x + rnd(-0.05, 0.05), y, z: z + rnd(-0.05, 0.05), vx: WIND.x + rnd(-0.08, 0.08), vy: rnd(0.55, 0.95), vz: WIND.z + rnd(-0.08, 0.08), life: rnd(2.4, 3.6), size: [0.26 * k, 1.45 * k], color: [0.025, 0.022, 0.02], color2: [0.18, 0.17, 0.16], alpha: [1, 0], drag: 0.45 });
}

/** A tongue of flame licking upward: an orange body, now and then a yellow tip rising off it. */
export function fire(fx, x, y, z, k = 1) {
  fx.glow.emit({ x: x + rnd(-0.07, 0.07) * k, y, z: z + rnd(-0.07, 0.07) * k, vx: WIND.x * 0.4, vy: rnd(0.35, 0.7) * k, vz: WIND.z * 0.4, life: rnd(0.3, 0.5), size: [0.26 * k, 0.1 * k], color: [3, 1.1, 0.22], color2: [0.9, 0.16, 0.02], alpha: [1, 0] });
  if (Math.random() < 0.5) fx.glow.emit({ x: x + rnd(-0.05, 0.05) * k, y: y + 0.08 * k, z: z + rnd(-0.05, 0.05) * k, vx: WIND.x * 0.4, vy: rnd(0.6, 1.1) * k, vz: WIND.z * 0.4, life: rnd(0.2, 0.35), size: [0.13 * k, 0.04 * k], color: [3.4, 2.1, 0.7], alpha: [1, 0] });
}

/** A few sparks spitting out of torn metal. */
export function sparks(fx, x, y, z, n = 3, speed = 1.4) {
  for (let i = 0; i < n; i++) fx.glow.emit({ x, y, z, vx: rnd(-speed, speed), vy: rnd(0.6, 2.2), vz: rnd(-speed, speed), life: rnd(0.18, 0.4), size: [0.06, 0.02], color: [7, 4.2, 1.4], alpha: [1, 0], gravity: 7 });
}

/**
 * A vehicle's fuel and ammunition going up: a white-hot core, a rolling orange ball that climbs and
 * darkens, a shower of sparks and a dark mushroom of smoke. k: about 0.7 for a Trike, 1.4 for a Harvester.
 * core: false leaves out the flash (when a big blast of the simulation's own already goes off there).
 */
export function fireball(fx, x, y, z, k = 1, core = true) {
  if (core) fx.glow.emit({ x, y: y + 0.1 * k, z, life: 0.12, size: [0.7 * k, 1.3 * k], color: [4, 3.2, 2.2], alpha: [1, 0] });
  for (let i = 0, n = Math.round(11 * k); i < n; i++) {
    fx.glow.emit({ x: x + rnd(-0.18, 0.18) * k, y: y + rnd(0, 0.25) * k, z: z + rnd(-0.18, 0.18) * k, vx: rnd(-0.6, 0.6) * k, vy: rnd(0.6, 1.5) * k, vz: rnd(-0.6, 0.6) * k, life: rnd(0.6, 1.1), size: [0.3 * k, 1 * k], color: [3.2, 1.3, 0.3], color2: [0.7, 0.14, 0.02], alpha: [1, 0], drag: 2.2 });
  }
  sparks(fx, x, y + 0.1, z, Math.round(8 * k), 3 * k);
  for (let i = 0, n = Math.round(10 * k); i < n; i++) {
    fx.smoke.emit({ x: x + rnd(-0.2, 0.2) * k, y: y + rnd(0.1, 0.4) * k, z: z + rnd(-0.2, 0.2) * k, vx: WIND.x + rnd(-0.35, 0.35), vy: rnd(0.8, 1.5) * k, vz: WIND.z + rnd(-0.35, 0.35), life: rnd(2.6, 4), size: [0.45 * k, 2.1 * k], color: [0.035, 0.03, 0.028], color2: [0.3, 0.28, 0.26], alpha: [0.9, 0], drag: 1.1 });
  }
  fx.flash?.(x, y, z, 8 + 6 * k);
}

/** A secondary blast (ammunition cooking off, a floor of a building going up): orange, never white-hot. */
export function blast(fx, x, y, z, k = 1) {
  for (let i = 0, n = Math.round(7 * k); i < n; i++) {
    fx.glow.emit({ x, y, z, vx: rnd(-0.9, 0.9) * k, vy: rnd(0.4, 1.3) * k, vz: rnd(-0.9, 0.9) * k, life: rnd(0.35, 0.65), size: [0.25 * k, 0.85 * k], color: [3.6, 1.5, 0.35], color2: [0.8, 0.15, 0.02], alpha: [1, 0], drag: 2.8 });
  }
  sparks(fx, x, y, z, Math.round(5 * k), 2.5 * k);
  for (let i = 0, n = Math.round(4 * k); i < n; i++) {
    fx.smoke.emit({ x: x + rnd(-0.15, 0.15) * k, y: y + 0.1, z: z + rnd(-0.15, 0.15) * k, vx: WIND.x + rnd(-0.3, 0.3), vy: rnd(0.5, 1.1), vz: WIND.z + rnd(-0.3, 0.3), life: rnd(1.8, 2.8), size: [0.3 * k, 1.4 * k], color: [0.05, 0.045, 0.04], color2: [0.32, 0.3, 0.28], alpha: [0.8, 0], drag: 1 });
  }
  fx.flash?.(x, y, z, 4 + 3 * k);
}

/** A harvester's load thrown up as a cloud of orange spice dust. */
export function spiceBurst(fx, x, y, z) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, s = rnd(0.8, 2.2);
    fx.smoke.emit({ x, y, z, vx: Math.cos(a) * s, vy: rnd(0.3, 1.1), vz: Math.sin(a) * s, life: rnd(1.4, 2.4), size: [0.3, 1.3], color: [0.86, 0.46, 0.16], color2: [0.8, 0.6, 0.38], alpha: [0.6, 0], drag: 1.6 });
  }
}

/** The dust a building throws out as it comes down: a low ring rolling outward and a pale plume over the footprint. */
export function collapseDust(fx, cx, y, cz, w, h) {
  const r = Math.max(w, h) * 0.5, n = Math.round(10 + 6 * r);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(-0.1, 0.1), s = rnd(1.2, 2.4);
    fx.smoke.emit({ x: cx + Math.cos(a) * r * 0.8, y: y + 0.1, z: cz + Math.sin(a) * r * 0.8, vx: Math.cos(a) * s, vy: rnd(0.1, 0.35), vz: Math.sin(a) * s, life: rnd(1.6, 2.6), size: [0.5, 1.8], color: [0.6, 0.52, 0.42], color2: [0.74, 0.66, 0.55], alpha: [0.55, 0], drag: 1.8 });
  }
  for (let i = 0, m = Math.round(4 + 3 * r); i < m; i++) {
    fx.smoke.emit({ x: cx + rnd(-r, r) * 0.6, y: y + rnd(0.2, 0.6), z: cz + rnd(-r, r) * 0.6, vx: WIND.x + rnd(-0.2, 0.2), vy: rnd(0.4, 0.9), vz: WIND.z + rnd(-0.2, 0.2), life: rnd(2.4, 3.6), size: [0.7, 2.6], color: [0.46, 0.42, 0.37], color2: [0.66, 0.6, 0.52], alpha: [0.5, 0], drag: 0.9 });
  }
}
