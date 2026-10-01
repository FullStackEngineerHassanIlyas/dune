// After a laptop sleeps, some GPU drivers (Intel on Linux) hand WebGL back scrambled textures and
// black tiles without reporting a lost context. A long idle stretch between frames — sleep, or a long
// time hidden — is the sign to rebuild the GPU side (Renderer3D.refresh). Only the idle time counts:
// a frame that is itself slow (shaders compiling on a weak machine) must not set off a refresh, and
// a cooldown keeps one from following another. Wall-clock time, because the monotonic clock behind
// performance.now() stands still while the machine sleeps.
export const WAKE_GAP_MS = 20000;
export const WAKE_COOLDOWN_MS = 60000;

/** check() at the start of a frame, check.idle() at its end. */
export function wakeCheck(onWake, { gap = WAKE_GAP_MS, cooldown = WAKE_COOLDOWN_MS, now = () => Date.now() } = {}) {
  let idleSince = null, lastWake = -Infinity;
  const check = () => {
    const t = now();
    if (idleSince !== null && t - idleSince > gap && t - lastWake > cooldown) { lastWake = t; onWake(t - idleSince); }
    idleSince = null;
  };
  check.idle = () => { idleSince = now(); };
  check.reset = () => { idleSince = null; };
  return check;
}
