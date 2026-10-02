// Sand thrown about by sandworms and spice blooms (spec §4.8, §5.5 "worm sand ridge and eruption, bloom
// eruption"): particle bursts spawned into the battle's shared pools (render/effects.js), so they count
// against the quality preset's particle budget like every other effect and scale with its detail.
// Positions are in world units: x and z on the map, y the ground height there.
const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

// Templates (effects.js ParticlePool.spawn): sizes in tiles, colours as effects.js gives them, glow above 1. The
// spice thrown up is darker than the field it lands on, and its dust paler, so a burst reads over the new spice.
const JET = { size: [0.08, 0.42], color: [0.82, 0.66, 0.44], color2: [0.88, 0.76, 0.58], alpha: [0.85, 0], drag: 1.1, gravity: 6, stretch: 0.03 };   // thrown sand, falling back in streaks
const SPRAY = { size: [0.1, 0.55], color: [0.84, 0.68, 0.46], color2: [0.9, 0.79, 0.62], alpha: [0.7, 0], drag: 2, gravity: 1.2, turb: 0.25 };
const CLOD = { size: [0.05, 0.035], color: [0.55, 0.42, 0.27], alpha: [0.95, 0.85], drag: 0.3, gravity: 9, stretch: 0.02 };
const DUST = { size: [0.3, 1.3], color: [0.8, 0.66, 0.47], color2: [0.86, 0.75, 0.6], alpha: [0.45, 0], drag: 1.4, turb: 0.4 };
const LOW_DUST = { ...DUST, alpha: [0.25, 0] };   // a bloom's ring: thin, so it never veils the fountain (the pool's draw order shifts as particles die)
const SPICE_JET = { size: [0.18, 0.5], color: [0.46, 0.12, 0.04], color2: [0.7, 0.32, 0.13], alpha: [1, 0.3], drag: 1, gravity: 4.5 };
const SPICE_CLOD = { size: [0.06, 0.045], color: [0.3, 0.08, 0.03], alpha: [0.95, 0.85], drag: 0.3, gravity: 9, stretch: 0.02 };
const SPICE_CLOUD = { size: [0.6, 2.4], color: [0.8, 0.5, 0.3], color2: [0.88, 0.7, 0.54], alpha: [0.42, 0], drag: 1.1, gravity: -0.05, turb: 0.45 };
const GLINT = { size: [0.05, 0.02], color: [3.2, 1.6, 0.6], color2: [1.2, 0.4, 0.1], drag: 0.8, gravity: 3, stretch: 0.02 };   // spice glitter (glow pool)

/** A ring of sand thrown up and out around (x, z): a worm's head breaking the surface (k sizes it) or sinking back. */
export function collarBurst(fx, x, y, z, k = 1) {
  const n = fx.count(14 * k);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(-0.2, 0.2), r = rnd(0.45, 0.75), v = rnd(1.2, 2.4) * k;
    fx.smoke.spawn(JET, x + Math.cos(a) * r, y + 0.1, z + Math.sin(a) * r, Math.cos(a) * v, rnd(2, 4.5) * k, Math.sin(a) * v, rnd(0.6, 1), k);
  }
  for (let i = 0; i < fx.count(10 * k); i++) {
    const a = rnd(0, TAU), v = rnd(0.8, 2.2) * k;
    fx.smoke.spawn(CLOD, x + Math.cos(a) * 0.6, y + 0.15, z + Math.sin(a) * 0.6, Math.cos(a) * v, rnd(2.5, 4.5), Math.sin(a) * v, rnd(0.5, 0.9), 1.1);
  }
  const ring = fx.count(10 * k);
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * TAU, v = rnd(1, 1.8) * k;
    fx.smoke.spawn(DUST, x + Math.cos(a) * 0.7, y + 0.05, z + Math.sin(a) * 0.7, Math.cos(a) * v, rnd(0.1, 0.35), Math.sin(a) * v, rnd(1.2, 2), k);
  }
}

/** The bow wave of a worm's ridge travelling along `heading`: sand peeling off both flanks of the swell's front. */
export function wake(fx, x, y, z, heading, puff = false) {
  const c = Math.cos(heading), s = Math.sin(heading);
  for (let side = -1; side <= 1; side += 2) {
    const a = heading + side * rnd(1.2, 1.9), v = rnd(0.6, 1.3);
    fx.smoke.spawn(JET, x + c * 0.3 - s * side * 0.22, y + 0.06, z + s * 0.3 + c * side * 0.22, Math.cos(a) * v, rnd(0.9, 1.8), Math.sin(a) * v, rnd(0.35, 0.6), 0.7);
  }
  if (puff) fx.smoke.spawn(SPRAY, x - c * 0.2, y + 0.04, z - s * 0.2, rnd(-0.15, 0.15), rnd(0.15, 0.35), rnd(-0.15, 0.15), rnd(0.9, 1.4), 1.1, rnd(0.92, 1.04));
}

/** The maw snapping shut over its prey: sand and grit pouring up and in. */
export function gulp(fx, x, y, z) {
  for (let i = 0; i < fx.count(10); i++) {
    const a = rnd(0, TAU), r = rnd(0.2, 0.5);
    fx.smoke.spawn(JET, x + Math.cos(a) * r, y + 0.5, z + Math.sin(a) * r, Math.cos(a) * 0.6, rnd(1.5, 3), Math.sin(a) * 0.6, rnd(0.5, 0.8), 0.9);
  }
  for (let i = 0; i < fx.count(6); i++) { const a = rnd(0, TAU); fx.smoke.spawn(CLOD, x, y + 0.6, z, Math.cos(a) * rnd(0.5, 1.5), rnd(2, 3.5), Math.sin(a) * rnd(0.5, 1.5), rnd(0.5, 0.8), 1.2); }
  for (let i = 0; i < fx.count(4); i++) fx.smoke.spawn(SPRAY, x + rnd(-0.3, 0.3), y + 0.4, z + rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(0.3, 0.7), rnd(-0.3, 0.3), rnd(1, 1.6), 1.4);
}

/** A worm killed: it heaves and goes down for good in a great burst of sand. */
export function wormDeath(fx, x, y, z) {
  collarBurst(fx, x, y, z, 1.5);
  for (let i = 0; i < fx.count(8); i++) fx.smoke.spawn(SPRAY, x + rnd(-0.5, 0.5), y + 0.2, z + rnd(-0.5, 0.5), rnd(-0.4, 0.4), rnd(0.4, 1), rnd(-0.4, 0.4), rnd(1.6, 2.6), 1.8);
}

/** A spice bloom bursting at (x, z): a fountain of spice and sand thrown up and out, clods raining round it, a ring of dust. Its dust cloud follows (bloomCloud). */
export function bloomBurst(fx, x, y, z) {
  const ring = fx.count(14);
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * TAU, v = rnd(2, 3.2);
    fx.smoke.spawn(LOW_DUST, x, y + 0.05, z, Math.cos(a) * v, 0.15, Math.sin(a) * v, rnd(1.3, 2), 0.9);
  }
  for (let i = 0; i < fx.count(10); i++) {
    const a = rnd(0, TAU), v = rnd(1.5, 3);
    fx.smoke.spawn(JET, x, y + 0.1, z, Math.cos(a) * v, rnd(2, 4), Math.sin(a) * v, rnd(0.8, 1.3), 1.2);
  }
  for (let i = 0; i < fx.count(16); i++) {
    const a = rnd(0, TAU), v = rnd(1.5, 4);
    fx.smoke.spawn(SPICE_CLOD, x, y + 0.2, z, Math.cos(a) * v, rnd(3, 6), Math.sin(a) * v, rnd(0.8, 1.3), 1.3);
  }
  for (let i = 0; i < fx.count(36); i++) {
    const a = rnd(0, TAU), v = rnd(0.8, 3.2);
    fx.smoke.spawn(SPICE_JET, x + rnd(-0.15, 0.15), y + 0.1, z + rnd(-0.15, 0.15), Math.cos(a) * v, rnd(3, 7), Math.sin(a) * v, rnd(1, 1.6), rnd(1, 1.6));
  }
  for (let i = 0; i < fx.count(12); i++) fx.glow.spawn(GLINT, x, y + 0.3, z, rnd(-1.6, 1.6), rnd(2, 5), rnd(-1.6, 1.6), rnd(0.6, 1.1));
}

/** The dust a bloom's fountain leaves hanging as it falls back (raised by BloomViews once the fountain falls back, so it never hides it). */
export function bloomCloud(fx, x, y, z) {
  for (let i = 0; i < fx.count(18); i++) {
    const a = rnd(0, TAU), v = rnd(0.4, 1.2);
    fx.smoke.spawn(SPICE_CLOUD, x + Math.cos(a) * 0.5, y + rnd(0.1, 0.8), z + Math.sin(a) * 0.5, Math.cos(a) * v, rnd(0.3, 0.9), Math.sin(a) * v, rnd(3, 5), rnd(1.2, 1.8), rnd(0.9, 1.05));
  }
}
