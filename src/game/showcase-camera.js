// Cinematic camera for the main menu battle (menu backdrop spec, revision 2): the battle opens looking
// straight down from deep in the haze, zooming at the dive's own rate so the zoom into the planet carries
// on without a cut, then settles into a slow orbit around the fighting with a cut to a new angle every
// CUT_EVERY seconds; one still wide shot when the viewer asks for reduced motion. The rise is the
// descent's mirror image. Pure math: the backdrop hands the result to a CameraRig.
const deg = (d) => (d * Math.PI) / 180;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
// a * (1 - t) + b * t, not a + (b - a) * t: exactly a at t = 0 and exactly b at t = 1
const mix = (a, b, t) => a * (1 - t) + b * t;
const smoothstep = (a, b, t) => { const u = clamp01((t - a) / (b - a)); return u * u * (3 - 2 * u); };
export const easeOutCubic = (t) => 1 - (1 - clamp01(t)) ** 3;
export const easeInCubic = (t) => clamp01(t) ** 3;

export const CUT_EVERY = 12;       // seconds between cuts to a new angle
export const DESCENT = 5.5;        // seconds of the opening descent
export const ORBIT_RATE = 0.045;   // radians per second around the focus
// The 64 × 40 map is small: lower or wider than these and the frame shows the edge of the world.
export const SHOT = Object.freeze({ distance: 22, pitch: deg(42) });
export const WIDE = Object.freeze({ distance: 32, pitch: deg(50) });
// Where the dive hands over: far up in the battlefield's sand-coloured fog, looking down. 88°, not 90°,
// so a lookAt with world-up stays defined.
export const ENTRY = Object.freeze({ distance: 240, pitch: deg(88) });
const SPAN = Math.log(ENTRY.distance / SHOT.distance);   // the descent's log-distance to cover, ≈ 2.39
const PUSH = (ts) => Math.sin(ts * 0.35) * 2.5;          // a gentle push in and out, from each shot's start

/** The yaw a shot starts from: spread round the compass, new for every shot and battle (the multipliers must not sum to 1, or battle n+1 replays n's bearings a shot later). */
export function shotYaw(seed, shot) {
  return (((seed * 0.7548776662 + shot * 0.3819660113) % 1) + 1) % 1 * Math.PI * 2;
}

/** How far the descent's target has moved from `from` to the focus, 0..1, so a caller can blend its own framing offset in step. */
export function descentBlend(t) {
  return smoothstep(0.5, DESCENT - 1, t);
}

/**
 * Camera for second `t` of the battle phase, looking at `focus` ({ x, z }): { x, z, distance, pitch, yaw, shot }.
 * The descent starts over `from` (the map centre, where the dive landed) at ENTRY and zooms in at
 * `entryRate` (log-distance per second, the dive's closing rate), easing out to SHOT.
 */
export function battleCamera(t, focus, { reduced = false, seed = 0, from = focus, entryRate = 1.7 } = {}) {
  if (reduced) return { x: focus.x, z: focus.z, distance: WIDE.distance, pitch: WIDE.pitch, yaw: shotYaw(seed, 0), shot: 0 };
  t = Math.max(0, t);
  const shot = Math.floor(t / CUT_EVERY);
  const ts = t - shot * CUT_EVERY;
  const yaw = shotYaw(seed, shot) + ts * ORBIT_RATE;
  if (shot > 0) return { x: focus.x, z: focus.z, distance: SHOT.distance + PUSH(ts), pitch: SHOT.pitch, yaw, shot };
  // Shot 0 is one smooth curve with no seam at DESCENT. Log-distance ln(SHOT) + SPAN·e^(−ct), c = entryRate / SPAN:
  // it leaves ENTRY at exactly entryRate and decays towards SHOT. Its tail (about a tile at DESCENT with the
  // default rate) runs on past DESCENT and is gone by the first cut; clamping it there would kink the zoom.
  // The push blends in over the whole descent, flat at both ends. It rises while it blends in, so an
  // entryRate above about 2.6 lets the camera back off briefly before the orbit: keep the dive's closing rate below that.
  const tail = SPAN * Math.exp(-(entryRate / SPAN) * t);
  const b = descentBlend(t);
  return {
    x: mix(from.x, focus.x, b),
    z: mix(from.z, focus.z, b),
    distance: SHOT.distance * Math.exp(tail) + smoothstep(0, DESCENT, t) * PUSH(ts),
    pitch: mix(ENTRY.pitch, SHOT.pitch, smoothstep(1, DESCENT, t)),
    yaw,
    shot,
  };
}

/**
 * The climb away at the end of a battle, k 0..1 through the rise (`duration` s), from the last battle
 * shot: it tilts back to top-down and climbs to ENTRY, accelerating to `exitRate` (log-distance per
 * second, the emerge's opening zoom-out rate). Target, yaw and shot stay `from`'s.
 */
export function riseCamera(k, from, { exitRate = 1.9, duration = 3 } = {}) {
  k = clamp01(k);
  const span = Math.log(ENTRY.distance / from.distance);
  // Log-distance follows the cubic Hermite h = (m − 2)k³ + (3 − m)k², with h(0) = 0, h'(0) = 0, h(1) = 1
  // and h'(1) = m, so the climb ends at exitRate. h' ≥ 0 on [0, 1] only while 0 ≤ m ≤ 3; past 3 the camera
  // would first dip in towards the ground. Clamped at 3 (h = k³), the climb ends slower than exitRate, at
  // 3 · span / duration: that takes a from.distance above ENTRY / e^(exitRate · duration / 3) ≈ 36 with the
  // defaults, and battle shots sit between 19.5 and 32.
  const m = span > 0 ? Math.max(0, Math.min(3, (exitRate * duration) / span)) : 0;
  const h = (m - 2) * k ** 3 + (3 - m) * k ** 2;
  return {
    ...from,
    distance: from.distance * Math.exp(span * h),
    pitch: mix(from.pitch, ENTRY.pitch, smoothstep(0, 0.55, k)),
  };
}
