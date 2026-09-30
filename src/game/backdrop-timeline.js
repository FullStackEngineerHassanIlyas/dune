// The main menu backdrop's loop (menu backdrop spec, revision 2): planet → dive → battle → rise → emerge,
// and what the fade layer, the caption and the battle sound do at each moment. Pure functions of the
// phase and its clock. The dive and the rise are single continuous zooms: nothing covers them unless the
// viewer asks for reduced motion, when they become plain haze crossfades.
import { CUT_EVERY, DESCENT } from './showcase-camera.js';

export const DURATIONS = { planet: 10, dive: 4, battle: 45, rise: 3, emerge: 3.5 };
const NEXT = { planet: 'dive', dive: 'battle', battle: 'rise', rise: 'emerge', emerge: 'planet' };
/** Where a held phase (?backdrop=planet|battle, for screenshots) starts: past its opening fades (the battle, past its descent). */
export const HOLD_AT = { planet: 3, battle: DESCENT + 0.5 };
/** The haze between space and the battle: the renderer's fog colour as the post chain puts it on screen (measured deep in the fog), so a haze fade meets the picture with no step. */
export const HAZE = '#d9c49b';

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
    if (this.phase === 'planet' && this.hold === 'planet') return null;   // a held planet stays put, caption showing
    this.t += dt;
    if (this.phase === this.hold || this.t < this.durations[this.phase]) return null;
    if (this.phase === 'planet' && !battleReady) return null;
    return this.skip();
  }

  /** Straight on to the next phase. Once the loop has moved on it is warm: no more black fade-ins. */
  skip() {
    this.phase = NEXT[this.phase];
    this.t = 0;
    this.cold = false;
    if (this.phase === 'planet') this.cycle++;
    return this.phase;
  }

  /** Back to the start of the loop (or of the held phase), cold: the menu opening, or back from a skirmish. */
  restart() {
    this.phase = this.hold ?? 'planet';
    this.t = this.hold ? HOLD_AT[this.hold] : 0;
    this.cold = true;
  }
}

/** The layer over the 3D picture: { color: 'black' | 'haze', opacity }. */
export function fadeAt(phase, t, { durations = DURATIONS, reduced = false, cold = false } = {}) {
  const d = durations[phase];
  const haze = (opacity) => ({ color: 'haze', opacity });
  switch (phase) {
    case 'planet': return { color: 'black', opacity: cold ? 1 - ramp(t, 0, 0.8) : 0 };   // in from black on a cold start only
    // The planet shader hazes itself on the way down and the zoom overlay covers the seams, so the zooms
    // run uncovered; reduced motion swaps them for crossfades through the haze.
    case 'dive': case 'rise': return haze(reduced ? ramp(t, 0, d) : 0);
    case 'emerge': return haze(reduced ? 1 - ramp(t, 0, 1.5) : 0);
    case 'battle': {
      if (reduced) return haze(1 - ramp(t, 0, 1.5));
      // a dip at every cut, however long the battle is held; none at t = 0, where the zoom carries straight on
      const c = Math.round(t / CUT_EVERY) * CUT_EVERY, u = t - c;
      return haze(c >= CUT_EVERY ? (u < 0 ? ramp(u, -0.3, 0) : 1 - ramp(u, 0, 0.45)) : 0);
    }
    default: return { color: 'black', opacity: 0 };
  }
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
