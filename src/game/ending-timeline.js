// The campaign's ending (spec §5.8, §7; phase 3 research §9: the Sega "Finale" plays while the planet shimmers to the
// victor's colour, then the "Credit Roll"): pure functions of the time since it began. The planet eases into the middle
// of the picture and a little nearer while the victor's colour sweeps across it; then it eases back to the right and the
// credits roll up the left, from below the window until the last line has gone, and the title comes back.
export const ENDING = Object.freeze({
  centre: [0, 3],          // the planet eases to the middle of the picture
  shimmer: [2.5, 12.5],    // the victor's colour sweeps across it
  credits: 13,             // the credits begin to roll, and their music
  back: [12.5, 15.5],      // the planet eases back to the right, clear of the roll
  speed: 0.06,             // the roll's speed: window heights per second
  tail: 2.5,               // seconds of the planet alone after the last line has gone
  page: 3.2,               // reduced motion: seconds each group of credits holds still on screen
  nearer: 0.55,            // planet radii the camera comes in by while the planet is in the middle
});

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };

/**
 * The planet camera at t: { centred (0..1, PlanetShot.update's), travel z (nearer: negative), tint (the colour's spread
 * 0..1) }. Given the ending's length, the colour draws back over the planet alone at the end (the last second under
 * reduced motion), so the title comes back on the tan planet it always stands on.
 */
export function endingView(t, { reduced = false, length = Infinity } = {}) {
  const c = reduced ? (t < ENDING.credits ? 1 : 0) : smoothstep(...ENDING.centre, t) * (1 - smoothstep(...ENDING.back, t));
  let tint = clamp01((t - ENDING.shimmer[0]) / (ENDING.shimmer[1] - ENDING.shimmer[0]));
  if (Number.isFinite(length)) tint *= 1 - smoothstep(length - (reduced ? 1 : ENDING.tail), length, t);
  return { centred: c, z: -ENDING.nearer * c, tint };
}

/** Seconds from the start to the end: the roll (rollHeight px tall in a window viewHeight px tall) has passed, or every page has shown. */
export function endingLength({ rollHeight = 0, viewHeight = 1, pages = 0, reduced = false } = {}) {
  if (reduced) return ENDING.credits + pages * ENDING.page + 1;
  return ENDING.credits + (rollHeight + viewHeight) / (ENDING.speed * viewHeight) + ENDING.tail;
}

/** Where the roll's top edge is at t, in px from the window's top: the window's height before it starts, rising steadily after. */
export function rollAt(t, viewHeight) {
  return viewHeight - Math.max(0, t - ENDING.credits) * ENDING.speed * viewHeight;
}

/** Reduced motion: which group of credits shows at t (-1: none yet), and its opacity. */
export function pageAt(t, pages) {
  if (t < ENDING.credits || pages <= 0) return { index: -1, opacity: 0 };
  const u = (t - ENDING.credits) / ENDING.page, index = Math.floor(u);
  if (index >= pages) return { index: -1, opacity: 0 };
  const k = u - index;
  return { index, opacity: Math.min(1, k / 0.15, (1 - k) / 0.15) };
}
