// Cinematic camera for the main menu battle (menu backdrop spec): a descent from high above, a slow
// orbit around the fighting and a cut to a new angle every CUT_EVERY seconds; one still wide shot
// when the viewer asks for reduced motion. Pure math: the backdrop hands the result to a CameraRig.
const deg = (d) => (d * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const easeOutCubic = (t) => 1 - (1 - clamp01(t)) ** 3;
export const easeInCubic = (t) => clamp01(t) ** 3;

export const CUT_EVERY = 12;   // seconds between cuts to a new angle
export const DESCENT = 6;      // seconds of the opening descent
const ORBIT_RATE = 0.045;      // radians per second around the focus
const HIGH = { distance: 95, pitch: deg(72) };
const SHOT = { distance: 26, pitch: deg(31) };
const WIDE = { distance: 40, pitch: deg(40) };

/** The yaw a shot starts from: spread round the compass, new for every shot and battle (the multipliers must not sum to 1, or battle n+1 replays n's bearings a shot later). */
export function shotYaw(seed, shot) {
  return (((seed * 0.7548776662 + shot * 0.3819660113) % 1) + 1) % 1 * Math.PI * 2;
}

/** Camera for second `t` of the battle phase, looking at `focus` ({ x, z }). */
export function battleCamera(t, focus, { reduced = false, seed = 0 } = {}) {
  if (reduced) return { x: focus.x, z: focus.z, distance: WIDE.distance, pitch: WIDE.pitch, yaw: shotYaw(seed, 0), shot: 0 };
  const shot = Math.max(0, Math.floor(t / CUT_EVERY));
  const ts = t - shot * CUT_EVERY;
  let distance = SHOT.distance + Math.sin(ts * 0.35) * 2.5, pitch = SHOT.pitch;   // a gentle push in and out
  if (shot === 0 && t < DESCENT) {
    const e = easeOutCubic(t / DESCENT);
    distance = lerp(HIGH.distance, distance, e);
    pitch = lerp(HIGH.pitch, pitch, e);
  }
  return { x: focus.x, z: focus.z, distance, pitch, yaw: shotYaw(seed, shot) + ts * ORBIT_RATE, shot };
}

/** The climb away at the end of a battle, k 0..1 through the rise, from the last battle shot. */
export function riseCamera(k, from) {
  const e = easeInCubic(k);
  return { ...from, distance: lerp(from.distance, from.distance + 60, e), pitch: lerp(from.pitch, deg(75), e) };
}
