// The main menu backdrop's loop (menu backdrop spec): planet → dive → battle → rise, and what the fade
// layer, the caption and the battle sound do at each moment. Pure functions of the phase and its clock.
import { CUT_EVERY } from './showcase-camera.js';

export const DURATIONS = { planet: 10, dive: 3, battle: 45, rise: 2 };
const NEXT = { planet: 'dive', dive: 'battle', battle: 'rise', rise: 'planet' };
/** Where a held phase (?backdrop=planet|battle, for screenshots) starts: past its opening fades. */
export const HOLD_AT = { planet: 3, battle: 6.5 };
/** The haze between space and the battle: the renderer's fog colour. */
export const HAZE = '#d9b98a';

const ramp = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

export class BackdropClock {
  constructor({ durations = DURATIONS, hold = null } = {}) {
    this.durations = durations;
    this.hold = Object.hasOwn(HOLD_AT, hold ?? '') ? hold : null;
    this.cycle = 0;
    this.restart();
  }

  get k() { return Math.min(1, this.t / this.durations[this.phase]); }

  /** Moves on by dt seconds; the planet waits for the next battle to be ready. Returns the phase entered, or null. */
  advance(dt, battleReady = true) {
    this.t += dt;
    if (this.phase === this.hold || this.t < this.durations[this.phase]) return null;
    if (this.phase === 'planet' && !battleReady) return null;
    return this.skip();
  }

  /** Straight on to the next phase. */
  skip() {
    this.phase = NEXT[this.phase];
    this.t = 0;
    if (this.phase === 'planet') this.cycle++;
    return this.phase;
  }

  /** Back to the start of the loop (or of the held phase). */
  restart() {
    this.phase = this.hold ?? 'planet';
    this.t = this.hold ? HOLD_AT[this.hold] : 0;
  }
}

/** The layer over the 3D picture: { color: 'black' | 'haze', opacity }. */
export function fadeAt(phase, t, { durations = DURATIONS, reduced = false } = {}) {
  const d = durations[phase];
  if (phase === 'planet') return { color: 'black', opacity: 1 - ramp(t, 0, 0.8) };
  if (phase === 'dive') return { color: 'haze', opacity: reduced ? ramp(t, 0, d) : ramp(t, d - 0.8, d) };
  if (phase === 'battle') {
    let opacity = 1 - ramp(t, 0, reduced ? 1.5 : 1);
    if (!reduced) for (let c = CUT_EVERY; c < d; c += CUT_EVERY) opacity = Math.max(opacity, ramp(t, c - 0.3, c) * (1 - ramp(t, c, c + 0.45)));
    return { color: 'haze', opacity };
  }
  return { color: 'black', opacity: ramp(t, 0, d) };   // rise
}

/** The caption's opacity: in after 1.5 s of the planet, out before the dive. */
export function captionAt(phase, t, { durations = DURATIONS } = {}) {
  if (phase !== 'planet') return 0;
  const d = durations.planet;
  return ramp(t, 1.5, 2.5) * (1 - ramp(t, d - 1.6, d - 0.8));
}

/** Battle sound 0..1: silent in space, in over the battle's first two seconds, out on the rise. */
export function soundLevelAt(phase, t, { durations = DURATIONS } = {}) {
  if (phase === 'battle') return ramp(t, 0, 2);
  if (phase === 'rise') return 1 - ramp(t, 0, durations.rise);
  return 0;
}
