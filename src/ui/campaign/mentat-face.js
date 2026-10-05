// The Mentat's face (notes docs/superpowers/notes/2026-10-05-mentat-face.md): Cyril, Radnor and Ammon move their
// lips with their voice and their faces with what they say. Each animation frame the engine reads the voice
// (src/audio/mentat-voice.js: voice.now(frame), the contract in docs/superpowers/notes/2026-10-05-mentat-voice.md)
// and drives the portrait: the mouth cross-fades between its shapes' sprites with the jaw opened by the voice's
// loudness, eased so a shape never pops (co-articulation); the brows, lids, mouth corners and head ease towards
// the sentence's expression (critically damped, ~200 ms) and hold it between sentences; he blinks on his own and
// at a phrase's start; his head moves a little as he speaks; when he falls silent the mouth closes. After the line
// his last look is held a moment and eased back to the painting, and the loop sleeps until the next line. Nothing
// is allocated per frame. Options → Mentat voice Off: no line ever plays, so the portrait stays the painting.
// prefers-reduced-motion: the mouth alone moves. All a rig's art is data (mentat-face-rig.js); the three Mentats' rigs, baked
// from the very sculpt of their heads, are in mentat-face-rigs.js.
import { restFrame, VISEMES } from '../../audio/mentat-voice.js';
import { compileRig, rigFiles, P, PARAMS } from './mentat-face-rig.js';
import { springIn, omegaFor, visemeTargets, normalizeWeights, stackAlphas, Blinker, swayIn } from './mentat-face-motion.js';
import { createFaceSvg, headImageOf, POSE, POSE_SIZE } from './mentat-face-svg.js';

const NV = VISEMES.length, NP = PARAMS.length;
// scalar springs (x/v cells): the jaw (fast), its slow average, how much he is speaking, the brows' lift on a loud syllable
const J_JAW = 0, J_SLOW = 1, J_SPEAK = 2, J_FLASH = 3;
// state cells
const S_T = 0, S_LAST_TS = 1, S_SINCE = 2, S_SENTENCE = 3, S_BLINK = 4, S_PHASE = 5, S_DT = 6, S_FIRST = 7, S_LOOK = 8;
// the springs' rates (rad/s), worked out once: the mouth, the jaw, its slow average, speaking, the brows' flash, an
// expression, the head, and the ease back to the painting
const O_MOUTH = 0, O_JAW = 1, O_SLOW = 2, O_SPEAK = 3, O_FLASH = 4, O_EASE = 5, O_HEAD = 6, O_RELEASE = 7;
const SETTLED = 0.01;   // a parameter this close to the painting is under a hundredth of a unit or a degree away
const BLINK_STEP = 89;  // places in the blinks' table of chances (256, which 89 is prime to) between one face and the next
let faces = 0;

/** True when the player asked the system for less motion. */
export function prefersReducedMotion() {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** The system's reduced-motion setting as a MediaQueryList (null where there is none), to follow it while a face lives. */
function motionQuery() {
  try { return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null; } catch { return null; }
}
const follow = (q, fn) => { if (typeof q?.addEventListener === 'function') q.addEventListener('change', fn); else q?.addListener?.(fn); };
const unfollow = (q, fn) => { if (typeof q?.removeEventListener === 'function') q.removeEventListener('change', fn); else q?.removeListener?.(fn); };

export class MentatFace {
  /**
   * rig: a rig (mentat-face-rig.js; throws a TypeError naming what is wrong). voice: a MentatVoice (or anything
   * with now(frame), current and on('line' | 'end')). el: the element whose leaving the page ends the face (the
   * stage's section); art: the portrait's `.cp-mentat-art` (default: the first in `el`; `svg` is the old name).
   * reducedMotion: the mouth alone (default: the system's setting, followed while the face lives, as the map and the
   * portrait's own CSS follow it). warm: get ready before the first line (see warm()).
   * raf / caf: the frame scheduler (tests pass their own).
   */
  constructor({ rig, voice, el = null, art = null, svg = null, reducedMotion, raf = null, caf = null, warm = false } = {}) {
    this.c = compileRig(rig);
    this.rig = rig;
    this.voice = voice;
    this.art = art ?? svg ?? el?.querySelector?.('.cp-mentat-art') ?? null;
    if (!this.art) throw new Error('mentat face: no portrait (.cp-mentat-art)');
    this.svg = this.art;
    this.el = el ?? this.art;
    this.motionQuery = reducedMotion === undefined ? motionQuery() : null;
    this.reduced = reducedMotion === undefined ? !!this.motionQuery?.matches : !!reducedMotion;
    this.raf = raf ?? ((fn) => globalThis.requestAnimationFrame(fn));
    this.caf = caf ?? ((id) => globalThis.cancelAnimationFrame(id));
    this.uid = `cpmf${++faces}`;
    this.view = null;
    this.frame = restFrame();
    this.pose = new Float64Array(POSE_SIZE);
    this.w = new Float64Array(NV); this.wv = new Float64Array(NV); this.wt = new Float64Array(NV); this.alpha = new Float64Array(NV); this.ws = new Float64Array(NV);
    this.e = new Float64Array(NP); this.ev = new Float64Array(NP); this.zero = new Float64Array(NP);
    this.x = new Float64Array(4); this.v = new Float64Array(4);
    this.s = new Float64Array(9); this.tmp = new Float64Array(2);
    const mo = this.c.motion;
    this.om = Float64Array.of(omegaFor(mo.mouthEase), omegaFor(mo.jawEase), omegaFor(0.45), omegaFor(0.5), omegaFor(0.16), omegaFor(mo.ease), omegaFor(mo.headEase), omegaFor(mo.release));
    this.k = new Float64Array(3);   // a spring step's [target, omega, dt] (springIn)
    // each face (each screen) starts at its own place in its Mentat's seeded blinks: screen after screen he would
    // otherwise blink at the very same moments of his first line (Cyril 0.67 s and 3.72 s in, Radnor 2.75 s, on the GPU)
    this.blinker = new Blinker({ ...this.c.motion.blink, start: (faces * BLINK_STEP) % 256 });
    this.rafId = 0;
    this.running = false;
    this.settled = false;
    this.destroyed = false;
    this.warming = null;
    this.images = [];
    this.wasConnected = false;
    this.missing = 0;
    this.frames = 0;
    this.reset();
    this.tick = this.tick.bind(this);
    this.offLine = voice?.on?.('line', () => this.onLine()) ?? null;
    this.offEnd = voice?.on?.('end', () => { this.s[S_SINCE] = 0; }) ?? null;
    this.onMotion = () => this.setReduced(this.motionQuery.matches);
    follow(this.motionQuery, this.onMotion);
    if (voice?.current?.state === 'playing') this.start();
    else if (warm) this.warm();
  }

  /**
   * Gets the face ready before his first word, so the line does not pay for it: once the head painting has loaded (the
   * corners' and the chin's patches are cut from it) the face is built, out of the picture, and its own pictures (the
   * mouth's sprites, the brows, the lids) are fetched and decoded. Built at the line's start otherwise: a few frames
   * of stall just as he opens his mouth, and the first shapes drawn late. Resolves true when ready, false when the
   * face went first (destroyed, or a bad build). Safe to call again: the same promise.
   */
  warm() {
    this.warming ??= new Promise((resolve) => {
      const build = () => {
        if (this.destroyed) { resolve(false); return; }
        try { this.view ??= createFaceSvg({ art: this.art, rig: this.rig, uid: this.uid, visemes: VISEMES }); } catch (err) { console.warn('mentat face:', err?.message ?? err); resolve(false); return; }
        if (typeof Image !== 'function') { resolve(true); return; }
        // each file once through an image of its own: fetched, and decoded ahead of the first frame that shows it
        const decoded = rigFiles(this.rig).map((src) => {
          const im = new Image();
          im.src = src;
          this.images.push(im);
          return im.decode?.().catch(() => {});
        });
        Promise.all(decoded).then(() => resolve(!this.destroyed));
      };
      const head = headImageOf(this.art);
      const wait = head && head.complete === false && typeof head.addEventListener === 'function';
      const soon = () => setTimeout(build, 0);
      if (wait) { head.addEventListener('load', soon, { once: true }); head.addEventListener('error', soon, { once: true }); } else soon();
    });
    return this.warming;
  }

  /** The face at the painting: mouth at rest, no expression, no blink. */
  reset() {
    this.w.fill(0); this.w[0] = 1; this.wv.fill(0);
    this.e.fill(0); this.ev.fill(0); this.x.fill(0); this.v.fill(0);
    this.s[S_LAST_TS] = -1; this.s[S_SINCE] = 0; this.s[S_SENTENCE] = -1; this.s[S_BLINK] = 0;
    this.s[S_PHASE] = (this.rig.house?.length ?? 3) * 1.3;
    this.compose();
  }

  onLine() {
    if (this.destroyed) return;
    if (this.el.isConnected === false && this.wasConnected) { this.destroy(); return; }
    this.s[S_SINCE] = 0;
    this.s[S_FIRST] = 1;   // its first frame catches up a late start, also when the face is still awake (Advice right after the briefing)
    this.start();
  }

  /** Runs the face (a line is starting); a no-op while it runs. */
  start() {
    if (this.destroyed || this.running) return;
    this.view ??= createFaceSvg({ art: this.art, rig: this.rig, uid: this.uid, visemes: VISEMES });
    this.running = true;
    this.settled = false;
    this.missing = 0;
    this.s[S_LAST_TS] = -1;
    this.s[S_FIRST] = 1;
    this.blinker.reset(this.s[S_T]);
    this.view.setActive(true, !this.reduced);
    this.rafId = this.raf(this.tick);
  }

  /**
   * Reduced motion switched while he is on screen (the system's setting): from now on the mouth alone moves (his brows,
   * lids and corners ease back to the painting, his head is still, the portrait's own eyes are back), or all of him again.
   */
  setReduced(on) {
    on = !!on;
    if (this.destroyed || on === this.reduced) return;
    this.reduced = on;
    this.blinker.reset(this.s[S_T]);   // his own blinks, when they come back, start afresh (not at once)
    if (this.running) this.view?.setActive(true, !on);
  }

  /** Stops the loop and shows the painting again (the mouth closed); the next line starts it again. */
  stop() {
    if (this.rafId) this.caf(this.rafId);
    this.rafId = 0;
    this.running = false;
    this.reset();
    this.view?.setActive(false);
  }

  /** Stops for good: the voice is let go and the portrait is put back as it was. */
  destroy() {
    if (this.destroyed) return;
    this.stop();
    this.destroyed = true;
    this.offLine?.(); this.offEnd?.();
    unfollow(this.motionQuery, this.onMotion);
    this.view?.restore();
    this.view = null;
    this.images = [];
  }

  /** One animation frame (the scheduler's timestamp in ms). */
  tick(ts) {
    this.rafId = 0;
    if (this.destroyed || !this.running) return;
    if (this.el.isConnected === false) {
      if (this.wasConnected || ++this.missing > 3) { this.destroy(); return; }
    } else this.wasConnected = true;
    const s = this.s, last = s[S_LAST_TS];
    s[S_DT] = last < 0 ? 1 / 60 : (ts - last) / 1000;
    if (!(s[S_DT] >= 0)) s[S_DT] = 0; else if (s[S_DT] > 0.1) s[S_DT] = 0.1;
    s[S_LAST_TS] = ts;
    this.update();
    this.view.write(this.pose);
    this.frames++;
    if (this.settled) { this.stop(); return; }
    this.rafId = this.raf(this.tick);
  }

  /**
   * Advances the face by `dt` seconds (default: the frame's, set by tick) from the voice's frame now: the pose
   * (this.pose) is ready to draw. The frame's numbers stay in typed arrays: no call in here passes a number or returns
   * one (a number that crosses a call the optimiser did not inline is boxed, and which calls it inlines into a
   * function this large changes from run to run: a spring step passed its numbers allocated 16-45 bytes a frame in
   * some runs and none in others).
   */
  update(step) {
    const s = this.s, c = this.c, m = c.motion, f = this.frame, x = this.x, v = this.v, om = this.om, k = this.k;
    if (step !== undefined) s[S_DT] = step;
    const dt = s[S_DT];
    s[S_T] += dt;
    const t = s[S_T];
    const voice = this.voice;
    this.look(f);
    const line = voice.current;
    const live = line != null && line.state === 'playing';
    if (live) s[S_SINCE] = 0; else s[S_SINCE] += dt;
    const speaking = live && f.speaking === true;

    // the mouth: the shapes' weights spring to the frame's (co-articulation: no shape pops in or out). The first frame
    // of a line may come late (the page was busy as the sound began): the mouth catches up the time the voice has run
    // (the time heard, not the look ahead; not past 0.1 s), so his first word is not shown a stall late
    let dm = dt;
    if (s[S_FIRST] === 1) { s[S_FIRST] = 0; const ran = f.t - s[S_LOOK]; if (step === undefined && ran > dt) dm = ran < 0.1 ? ran : 0.1; }
    visemeTargets(f, speaking, this.wt);
    const wt = this.wt;
    k[1] = om[O_MOUTH]; k[2] = dm;
    for (let i = 0; i < NV; i++) { k[0] = wt[i]; springIn(this.w, this.wv, i, k); }
    normalizeWeights(this.w);
    let loud = speaking ? +f.open || 0 : 0;
    loud = loud < 0 ? 0 : loud > 1 ? 1 : loud;
    k[0] = loud; k[1] = om[O_JAW]; springIn(x, v, J_JAW, k);
    k[1] = om[O_SLOW]; springIn(x, v, J_SLOW, k);
    k[0] = speaking ? 1 : 0; k[1] = om[O_SPEAK]; k[2] = dt; springIn(x, v, J_SPEAK, k);
    if (x[J_JAW] < 0) x[J_JAW] = 0;
    const rise = x[J_JAW] - x[J_SLOW];
    k[0] = rise > 0 ? rise : 0; k[1] = om[O_FLASH]; springIn(x, v, J_FLASH, k);

    // the expression: the sentence's (held between sentences and a moment after the line), else the painting
    const holding = live || s[S_SINCE] < m.hold;
    let target = this.zero;
    if (!this.reduced && holding) {
      const ki = c.exprIndex[f.expression];
      target = c.targets[ki === undefined ? 0 : ki];
    }
    const eo = holding ? om[O_EASE] : om[O_RELEASE], ho = holding ? om[O_HEAD] : om[O_RELEASE];
    for (let p = 0; p < NP; p++) { k[0] = target[p]; k[1] = p === P.tilt || p === P.nod ? ho : eo; springIn(this.e, this.ev, p, k); }   // k[2]: dt

    // blinks: on their schedule, and soon after a sentence starts
    let blink = 0;
    if (!this.reduced) {
      const b = this.blinker;
      b.t[0] = t;
      b.step(live && f.sentence !== s[S_SENTENCE] && f.sentence >= 0);
      if (live) s[S_SENTENCE] = f.sentence;
      blink = b.c[0];
    }
    s[S_BLINK] = blink;
    this.compose();

    if (!live && s[S_SINCE] >= m.hold) {
      let still = this.w[0] > 0.995 && x[J_JAW] < SETTLED && blink === 0;
      for (let p = 0; still && p < NP; p++) still = Math.abs(this.e[p]) < SETTLED && Math.abs(this.ev[p]) < 0.05;
      this.settled = still;
    }
    return this.pose;
  }

  /**
   * The voice's frame into `f`: what is heard now, looked at `motion.lead` ahead (the mouth moves before the sound it
   * makes, and the blend and springs trail the frame by about as much), or the voice's own frame when it cannot say.
   */
  look(f) {
    const voice = this.voice, lead = this.c.motion.lead, line = voice.current;
    if (lead > 0 && line != null && line.state === 'playing' && typeof line.smooth === 'function' && typeof line.at === 'function') { this.s[S_LOOK] = lead; return line.at(line.smooth() + lead, f); }
    this.s[S_LOOK] = 0;
    return voice.now(f);
  }

  /** The pose from the springs: head, brows, corners, jaw, mouth, lids and the sprites' opacities. */
  compose() {
    const pose = this.pose, e = this.e, x = this.x, c = this.c, m = c.motion, rig = this.rig, mouth = c.mouth;
    const blink = this.s[S_BLINK];
    const reduced = this.reduced;
    const sp = x[J_SPEAK];
    swayIn(this.s, S_T, S_PHASE, this.tmp, 0);
    pose[POSE.tilt] = reduced ? 0 : e[P.tilt] + sp * m.swayTilt * this.tmp[0];
    pose[POSE.nod] = reduced ? 0 : e[P.nod] + sp * (m.swayNod * this.tmp[1] + m.speakNod * x[J_SLOW]);
    const flash = reduced ? 0 : m.flash * x[J_FLASH] * 3 * sp;
    const b = rig.brows;
    if (b) {
      const inward = b.inward ?? 1, fu = e[P.furrow], afu = fu < 0 ? -fu : fu;
      pose[POSE.browLy] = -(e[P.browL] + flash) * b.raise;
      pose[POSE.browRy] = -(e[P.browR] + flash) * b.raise;
      pose[POSE.browLr] = fu * b.furrow;
      pose[POSE.browRr] = -fu * b.furrow;
      pose[POSE.browLx] = afu * inward;
      pose[POSE.browRx] = -afu * inward;
    }
    const cl = e[P.cornerL], cr = e[P.cornerR];
    if (rig.corners) {
      pose[POSE.cornerLy] = -cl * rig.corners.lift;
      pose[POSE.cornerRy] = -cr * rig.corners.lift;
    }
    const sym = (cl + cr) / 2;
    pose[POSE.mouthY] = -sym * mouth.lift * 0.35;
    pose[POSE.mouthSkew] = Math.atan(cl * mouth.lift / mouth.halfWidth) * 57.29578;
    pose[POSE.mouthSkewR] = Math.atan(-cr * mouth.lift / mouth.halfWidth) * 57.29578;
    pose[POSE.mouthSx] = 1 + sym * mouth.widen;
    // how far the shapes let the jaw open (their weighted openness), times the voice's loudness
    const w = this.w, open = c.open;
    let opens = 0;
    for (let i = 0; i < NV; i++) opens += w[i] * open[i];
    let jaw = x[J_JAW] * opens + e[P.jaw] * 0.25 * sp;
    jaw = jaw < 0 ? 0 : jaw > 1 ? 1 : jaw;
    pose[POSE.mouthSy] = mouth.jaw[0] + (mouth.jaw[1] - mouth.jaw[0]) * jaw;
    pose[POSE.jawY] = rig.jaw ? rig.jaw.drop * jaw : 0;
    const ll = reduced ? 0 : e[P.lidL], lr = reduced ? 0 : e[P.lidR];
    const cL = ll + (1 - ll) * blink, cR = lr + (1 - lr) * blink;
    pose[POSE.lidL] = cL < 0 ? 0 : cL > 1 ? 1 : cL;
    pose[POSE.lidR] = cR < 0 ? 0 : cR > 1 ? 1 : cR;
    // the sprites are cross-faded along an S: the shape that is leaving fades while the one arriving rises, and the two
    // dark-and-light ghosts of a half-way mouth are seen for as short a time as the weights allow
    const ws = this.ws, sharp = m.sharpen;
    for (let i = 0; i < NV; i++) ws[i] = Math.pow(w[i], sharp);
    stackAlphas(ws, this.alpha);
    for (let i = 0; i < NV; i++) pose[POSE.alpha + i] = this.alpha[i];
    return pose;
  }

  /** What the face is doing (for tests and the browser check; allocates). */
  debug() {
    return {
      running: this.running, destroyed: this.destroyed, frames: this.frames, reduced: this.reduced,
      frame: { ...this.frame }, weights: Object.fromEntries(VISEMES.map((n, i) => [n, +this.w[i].toFixed(3)])),
      expression: Object.fromEntries(PARAMS.map((n, i) => [n, +this.e[i].toFixed(3)])),
      jaw: +this.x[J_JAW].toFixed(3), blink: this.s[S_BLINK],
      pose: Object.fromEntries(Object.entries(POSE).map(([k, i]) => [k, +this.pose[i].toFixed(3)])),
    };
  }
}

/** A face for `rig` on the portrait in `el`, following `voice` (see MentatFace). Throws on a bad rig. */
export function createMentatFace(opts) { return new MentatFace(opts); }

/**
 * For mentatStage (stage.js): the face on `stage.portrait`, following `stage.voice`, ending when `stage.el` leaves
 * the page. `rig`: the house's rig (rigFor(house) of mentat-face-rigs.js). Returns the
 * face, or null when there is nothing to animate (no voice, no portrait) or the rig is bad (a warning says why):
 * the briefing never breaks for its face.
 */
export function attachMentatFace(stage, rig, opts = {}) {
  const art = stage?.portrait?.querySelector?.('.cp-mentat-art');
  if (!stage?.voice || !art || !rig) return null;
  try {
    return new MentatFace({ rig, voice: stage.voice, el: stage.el ?? stage.portrait, art, ...opts });
  } catch (err) {
    console.warn('mentat face:', err?.message ?? err);
    return null;
  }
}
