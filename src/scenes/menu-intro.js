// The Sega-style opening before the title, and the campaign's ending (spec §5.8; phase 3 research §8, §9; the timings
// and the camera's and the ships' paths are game/intro-timeline.js and game/ending-timeline.js).
//   runIntro(ctx): ctx = { params, settings, app, backdrop, menu, music, startBackdrop(opts), debug }. Sound needs a user
//     gesture, so a black screen asks for a key or a click ("PRESS ANY KEY", in pixel capitals of our own); the music
//     is primed at load and its 'intro' cue started inside that gesture (contract C6; silent without the methods). Then
//     the opening plays on the menu backdrop's renderer and planet, timed on the wall clock from the gesture (as the
//     music runs; a hidden page holds both), and hands over to the title on its last frame: the menu shows and the
//     backdrop starts warm on the very shot the opening ends on. Any key, click or Esc skips to the title, and that key
//     never reaches the menu. Once per page load; not with the Intro setting off (?intro=0), a held backdrop
//     (?backdrop=), a menu screen asked for (?screen=), in an automated browser unless ?intro=1, or back from a battle;
//     a short still version under reduced motion or with the background paused. ?introAt=<s> holds it at that moment
//     (screenshots). If anything fails it falls through to the title with a warning. ctx.debug.intro = { phase, t,
//     done, skip(), seek(t), step(dt) } for frame-exact captures.
//   playEnding({ house, app, backdrop, menu, music }) (contract C12): Arrakis from space slowly turns from tan to the
//     victor's colour (the Sega's "planet shimmer", music 'finale'), then the credits roll over it (story's CREDITS,
//     music 'credits'); any key or click skips; resolves when it is over, the title and the backdrop back.
import { introLength, introPhase, blackAt, cardAt, titleAt, nebulaAt, travelOffset, shipPose, SHIP_HOUSES, backdropWork, introRule, returningFromBattle } from '../game/intro-timeline.js';
import { ENDING, endingView, endingLength, rollAt, pageAt } from '../game/ending-timeline.js';
import { PLANET_SUN } from '../render/planet.js';
import { ShipFlight } from '../render/space-travel.js';
import { HOUSES, PLAYABLE_HOUSES } from '../data/houses.js';

// ---- pixel capitals: our own 5 × 7 face, one number per row, bit 4 the leftmost pixel ----------------------------------
export const PIXEL_FONT = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0], "'": [4, 4, 8, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8],
  '-': [0, 0, 0, 31, 0, 0, 0], '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], ':': [0, 12, 12, 0, 12, 12, 0],
  '&': [12, 18, 20, 8, 21, 18, 13], '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8], '/': [0, 1, 2, 4, 8, 16, 0],
};
const GLYPH_W = 5, GLYPH_H = 7, GAP = 1;

/** The pixels of a line of text: { width, height, on(x, y) }; characters the face lacks are left blank. */
export function pixelRows(text) {
  const glyphs = [...String(text).toUpperCase()].map((ch) => PIXEL_FONT[ch] ?? PIXEL_FONT[' ']);
  const width = Math.max(0, glyphs.length * (GLYPH_W + GAP) - GAP);
  return {
    width, height: GLYPH_H,
    on(x, y) {
      const g = glyphs[Math.floor(x / (GLYPH_W + GAP))], col = x % (GLYPH_W + GAP);
      return !!g && col < GLYPH_W && ((g[y] >> (GLYPH_W - 1 - col)) & 1) === 1;
    },
  };
}

/** A canvas with the text in pixel capitals, shown `scale` CSS pixels to a font pixel, crisp (intro.css). */
function pixelCanvas(text, scale, color = '#fff') {
  const rows = pixelRows(text), canvas = document.createElement('canvas');
  canvas.width = Math.max(1, rows.width);
  canvas.height = rows.height;
  canvas.className = 'intro-px';
  canvas.style.width = `${rows.width * scale}px`;
  canvas.style.height = `${rows.height * scale}px`;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = color;
    for (let y = 0; y < rows.height; y++) for (let x = 0; x < rows.width; x++) if (rows.on(x, y)) g.fillRect(x, y, 1, 1);
  }
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

/** CSS pixels per font pixel for a line `cols` font pixels wide: about 1/120 of the window's height (big) or 1/190, never wider than the window. */
function pixelScale(cols, size) {
  const fit = Math.floor((0.92 * innerWidth) / Math.max(1, cols));
  return Math.max(1, Math.min(fit, Math.round(innerHeight / (size === 'big' ? 120 : 190))));
}

// ---- input ---------------------------------------------------------------------------------------------------------------
const NOT_A_KEY = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'FnLock', 'Hyper', 'Super', 'Symbol', 'SymbolLock', 'Unidentified', 'Dead']);

/** A key that counts as the player's gesture: browsers do not let Escape, or a modifier alone, start sound. */
export function unlocksAudio(key) {
  return key !== 'Escape' && !NOT_A_KEY.has(key);
}

/** Swallows the rest of a key press (its repeats and its release) so it cannot also press the button the menu focuses. */
function swallowKey(code) {
  let timer = 0;
  const eat = (e) => {
    if (e.code !== code) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === 'keyup') done();
  };
  const done = () => { removeEventListener('keydown', eat, true); removeEventListener('keyup', eat, true); clearTimeout(timer); };
  addEventListener('keydown', eat, true);
  addEventListener('keyup', eat, true);
  timer = setTimeout(done, 1500);
}

const el = (tag, cls, attrs = {}) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const prefersReduced = () => { try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/** A clock on the page's own time (performance.now): never slows down when frames are dropped; held while the page is hidden. */
class WallClock {
  constructor() { this.t0 = 0; this.heldAt = null; this.running = false; }
  start(t = 0) { this.t0 = performance.now() - t * 1000; this.running = true; this.heldAt = null; }
  get t() { return this.running ? ((this.heldAt ?? performance.now()) - this.t0) / 1000 : 0; }
  hold(held) {
    if (!this.running) return;
    if (held && this.heldAt === null) this.heldAt = performance.now();
    else if (!held && this.heldAt !== null) { this.t0 += performance.now() - this.heldAt; this.heldAt = null; }
  }
}

// ---- the opening ---------------------------------------------------------------------------------------------------------
const ZERO = Object.freeze({ x: 0, y: 0, z: 0 });
const AUDIO_WAIT = 1600;   // ms the picture waits at black for the music to become audible (contract C6: it says within 1.5 s)

class Opening {
  constructor({ backdrop, app, menu, music, startBackdrop, rule }) {
    Object.assign(this, { backdrop, app, menu, music, startBackdrop, rule });
    this.planet = backdrop.planet;
    this.reduced = rule.reduced;
    this.length = introLength({ reduced: this.reduced });
    this.frozen = rule.frozen;
    this.clock = new WallClock();
    this.t = rule.at ?? 0;
    this.phase = 'gate';
    this.done = false;
    this.skipped = false;
    this.stepping = false;
    this.raf = 0;
    this.last = 0;
    this.offset = { x: 0, y: 0, z: 0 };
    this.pose = { position: [0, 0, 0], forward: [0, 0, -1], up: [0, 1, 0] };
    this.shown = { black: -1, title: -1, card: null, cardOpacity: -1 };
    this.ended = new Promise((resolve) => { this.resolve = resolve; });
    // the layer over everything but a battle's frame: the black, the gate's prompt, the words and the title
    this.layer = el('div', 'intro');
    this.black = el('div', 'intro-black');
    this.gate = el('div', 'intro-gate', { role: 'button', tabindex: '-1', 'aria-label': 'Press any key or click to start' });
    this.card = el('div', 'intro-card', { 'aria-hidden': 'true' });
    this.title = el('div', 'intro-title', { 'aria-hidden': 'true' });
    const dune = el('div', 'intro-dune'), sub = el('div', 'intro-sub');
    for (const part of ['intro-dune-shade', 'intro-dune-face']) { const span = el('span', part); span.textContent = 'Dune'; dune.append(span); }
    sub.textContent = 'The Battle for Arrakis';
    this.title.append(dune, sub);
    this.layer.append(this.black, this.card, this.title, this.gate);
    if (this.reduced) this.layer.classList.add('still');
    app.appendChild(this.layer);
    this.ships = this.reduced ? null : new ShipFlight(this.planet.scene, { houses: SHIP_HOUSES, sun: PLANET_SUN });
    this.onVisibility = () => this.clock.hold(document.hidden);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.frameBound = (now) => this.frame(now);
  }

  /** Everything the opening draws compiles and uploads now, behind the black, rather than on the frame it first shows. */
  warm() {
    const r3d = this.backdrop.r3d;
    if (this.ships) this.placeShips(19.3);
    this.backdrop.drawSpace(0, { travel: ZERO });
    r3d.compile(this.planet.scene, this.planet.camera);
    this.backdrop.drawSpace(0, { travel: ZERO });
    this.ships?.hide();
    this.ships?.update();
  }

  /** The black screen and its prompt until a key or a click: 'start', or 'skip' for Escape (it cannot start sound). */
  waitForGesture() {
    this.gate.append(pixelCanvas('PRESS ANY KEY', pixelScale(13 * 6, 'small'), '#dfe6ff'));
    this.gate.focus?.({ preventScroll: true });
    return new Promise((resolve) => {
      const finish = (how) => {
        removeEventListener('keydown', onKey);
        this.layer.removeEventListener('pointerdown', onPointer);
        this.gateDone = null;
        resolve(how);
      };
      // window listeners in the bubbling phase, after the music's own: the event is never stopped, so every
      // audio-unlock listener sees the gesture; the cue starts inside it
      const onKey = (e) => {
        if (e.repeat) return;
        if (e.key === 'Escape') { e.preventDefault(); finish('skip'); return; }
        if (!unlocksAudio(e.key)) return;
        this.audible = this.music?.intro?.();
        swallowKey(e.code);
        finish('start');
      };
      const onPointer = () => { this.audible = this.music?.intro?.(); finish('start'); };
      addEventListener('keydown', onKey);
      this.layer.addEventListener('pointerdown', onPointer);
      this.gateDone = finish;   // seek() and skip() from the debug hook answer the gate too
    });
  }

  /** Runs the opening: the gate (unless held at a moment), then the clock from the gesture, then the hand-over. */
  async run() {
    this.warm();
    if (this.frozen) {
      this.gate.remove();
      this.layer.classList.add('frozen');
      this.listen();
      this.draw(0);
      this.raf = requestAnimationFrame(this.frameBound);
      return this.ended;
    }
    const how = await this.waitForGesture();
    this.gate.remove();
    if (this.done) return this.ended;
    if (how === 'skip') { this.finish(true); return this.ended; }
    // the picture holds at black until the music is audible (or says it will not be), so the two start together
    if (this.audible && typeof this.audible.then === 'function') await Promise.race([this.audible.catch(() => false), wait(AUDIO_WAIT)]);
    if (this.done) return this.ended;
    this.listen();
    if (!this.clock.running) this.clock.start(this.t);
    this.clock.hold(document.hidden);
    this.last = performance.now();
    if (!this.stepping) this.raf = requestAnimationFrame(this.frameBound);
    return this.ended;
  }

  /** From the gesture on: any key or click skips to the title, and is consumed. */
  listen() {
    this.onKey = (e) => {
      if (e.repeat || NOT_A_KEY.has(e.key) || (e.altKey && e.key === 'Enter')) return;   // Alt+Enter stays full screen
      e.preventDefault();
      e.stopImmediatePropagation();
      swallowKey(e.code);
      this.skip();
    };
    this.onPointer = (e) => {
      e.preventDefault();
      // the release lands on this layer too: its click is eaten here rather than reaching the menu that shows beneath
      this.layer.classList.add('catch');
      const eat = (c) => { c.stopPropagation(); c.preventDefault(); release(); };
      const release = () => { this.layer.removeEventListener('click', eat, true); this.layer.classList.remove('catch'); };
      this.layer.addEventListener('click', eat, true);
      setTimeout(release, 800);
      this.skip();
    };
    addEventListener('keydown', this.onKey, true);
    this.layer.addEventListener('pointerdown', this.onPointer);
  }

  frame(now) {
    this.raf = requestAnimationFrame(this.frameBound);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.frozen) this.t = this.clock.t;
    try {
      this.draw(this.frozen ? 0 : dt);
      if (!this.frozen && this.t >= this.length) this.finish(false);
    } catch (err) { this.fail(err); }
  }

  placeShips(t) {
    const r3d = this.backdrop.r3d, aspect = r3d.width / r3d.height;
    for (let i = 0; i < SHIP_HOUSES.length; i++) this.ships.place(i, shipPose(i, t, { aspect, framing: this.planet.framing }, this.pose));
    this.ships.update();
  }

  /** One frame at the clock's time: the picture, the words and the title, and the backdrop's background work. */
  draw(dt) {
    const t = this.t, reduced = this.reduced;
    this.phase = introPhase(t, { reduced });
    travelOffset(t, this.offset, { reduced });
    this.planet.startPass(t - this.length);   // the moon reaches the backdrop's moon time 0 as the menu takes over
    if (this.ships) this.placeShips(t);
    this.backdrop.drawSpace(reduced ? 0 : dt, { travel: this.offset, nebula: nebulaAt(t, { reduced }) });   // the still version: no spin, no twinkle
    this.overlays(t);
    const work = this.frozen || this.stepping ? null : backdropWork(t, { reduced });
    if (work === 'run' || (work === 'build' && !this.backdrop.next)) {
      try { this.backdrop.prepare?.(); } catch (err) { console.warn('intro: preparing the backdrop:', err); }
    }
  }

  overlays(t) {
    const reduced = this.reduced, s = this.shown;
    const black = blackAt(t, { reduced });
    if (black !== s.black) { this.black.style.opacity = black.toFixed(3); s.black = black; }
    const title = titleAt(t, { reduced });
    if (title !== s.title) { this.title.style.opacity = title.toFixed(3); s.title = title; }
    const card = cardAt(t, { reduced });
    if ((card?.card.id ?? null) !== s.card) {
      s.card = card?.card.id ?? null;
      this.card.replaceChildren(...(card ? card.card.lines.map((line) => pixelCanvas(line.text, pixelScale(line.text.length * 6, line.size))) : []));
    }
    const opacity = card?.opacity ?? 0;
    if (opacity !== s.cardOpacity) { this.card.style.opacity = opacity.toFixed(3); s.cardOpacity = opacity; }
  }

  skip() {
    if (this.done) return;
    if (this.gateDone) { this.gateDone('skip'); return; }
    this.music?.skipIntro?.();
    this.finish(true);
  }

  /** The hand-over: the framing shot on the canvas, the menu in, the backdrop carrying on from this frame. */
  finish(skipped) {
    if (this.done) return;
    this.done = true;
    this.skipped = skipped;
    this.phase = 'done';
    cancelAnimationFrame(this.raf);
    this.cleanup();
    try {
      this.planet.startPass(0);
      this.backdrop.drawSpace(0, { travel: ZERO });
    } catch (err) { console.warn('intro:', err); }
    this.black.style.opacity = '0';
    this.card.style.opacity = '0';
    if (skipped) this.title.style.opacity = '0';
    this.layer.classList.add('out');
    this.app.classList.add('intro-reveal');
    this.startBackdrop?.({ warm: true });
    this.menu.show();
    setTimeout(() => { this.layer.remove(); this.app.classList.remove('intro-reveal'); }, 1000);
    this.resolve({ played: true, skipped });
  }

  cleanup() {
    removeEventListener('keydown', this.onKey, true);
    this.layer.removeEventListener('pointerdown', this.onPointer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.ships?.dispose();
    this.ships = null;
  }

  fail(err) {
    console.warn('intro:', err);
    try { this.music?.skipIntro?.(); } catch { /* the music carries on */ }
    this.finish(true);
  }

  /** window.__dune.intro: where it stands, and frame-exact control for captures and tests. */
  debug() {
    const self = this;
    return {
      get phase() { return self.phase; },
      get t() { return self.t; },
      get done() { return self.done; },
      get skipped() { return self.skipped; },
      get reduced() { return self.reduced; },
      get frozen() { return self.frozen; },
      skip: () => self.skip(),
      /** Jumps to t (from the gate, starting silently): real time runs on from there unless held or stepped. */
      seek: (t) => {
        if (self.done) return;
        self.t = Math.max(0, Number(t) || 0);
        if (self.gateDone) self.gateDone('start');
        if (!self.frozen && !self.stepping) self.clock.start(self.t);
        self.draw(0);
      },
      /** Stops real time for good; each call runs one frame dt seconds on. */
      step: (dt = 1 / 30) => {
        if (self.done) return;
        self.stepping = true;
        if (self.gateDone) self.gateDone('start');
        cancelAnimationFrame(self.raf);
        self.t += dt;
        self.draw(dt);
        if (self.t >= self.length) self.finish(false);
      },
    };
  }
}

/** The opening before the title: see the header. Resolves { played, skipped, reason }. */
export async function runIntro(ctx = {}) {
  const { params, settings = {}, app, backdrop, menu, music, startBackdrop, debug } = ctx;
  try { music?.prime?.(); } catch (err) { console.warn('intro: music prime:', err); }
  let opening = null;
  try {
    const nav = globalThis.navigator, loc = globalThis.location;
    const rule = introRule({
      setting: settings.intro !== false, param: params?.str?.('intro') ?? null, at: params?.num?.('introAt') ?? null,
      hold: params?.str?.('backdrop') ?? null, screen: params?.str?.('screen') ?? null,
      automated: !!nav?.webdriver || /HeadlessChrome/.test(nav?.userAgent ?? ''),   // headless Chrome under CDP does not set webdriver
      returning: returningFromBattle(globalThis.document?.referrer ?? '', loc?.origin ?? ''),
      planet: !!(backdrop?.planet && backdrop?.drawSpace), reduced: prefersReduced() || !!backdrop?.reduced, still: settings.menuMotion === false,
    });
    app?.classList.add('intro-checked');   // intro.css keeps the menu out of sight until this is known
    if (!rule.play) return { played: false, reason: rule.reason };
    menu.hide();
    backdrop.lend();
    opening = new Opening({ backdrop, app, menu, music, startBackdrop, rule });
    if (debug) debug.intro = opening.debug();
    return await opening.run();
  } catch (err) {
    console.warn('intro:', err);
    try { opening?.cleanup(); opening?.layer.remove(); } catch { /* already gone */ }
    app?.classList.add('intro-checked');
    menu?.show?.();
    return { played: false, reason: 'failed' };
  }
}

// ---- the ending ----------------------------------------------------------------------------------------------------------
const FALLBACK_CREDITS = [
  { role: 'Dune II 3D', names: ['A non-commercial fan remake'] },
  { role: 'After', names: ['Westwood Studios’ 1992 game', 'Dune: The Battle for Arrakis'] },
  { role: 'Built with', names: ['three.js'] },
  { role: 'Voices', names: ['Rendered with the Kokoro-82M speech model'] },
  { role: '', names: ['Thank you for playing'] },
];

/** The credits: story's CREDITS (src/data/story.js, contract C4) when it is there, else our short list. */
async function loadCredits() {
  try {
    const { CREDITS } = await import('../data/story.js');
    if (Array.isArray(CREDITS) && CREDITS.length) return CREDITS;
  } catch { /* not built yet */ }
  return FALLBACK_CREDITS;
}

function creditGroup({ role, names = [] }) {
  const g = el('div', 'ending-group');
  if (role) { const r = el('div', 'ending-role'); r.textContent = role; g.append(r); }
  for (const name of names) { const n = el('div', 'ending-name'); n.textContent = name; g.append(n); }
  return g;
}

/** The campaign's ending: see the header. Optional `at` holds it at that moment (the dev scene's screenshots), `debug` gets .ending. */
export async function playEnding({ house, app, backdrop, menu, music, at = null, debug = null } = {}) {
  const colour = HOUSES[PLAYABLE_HOUSES.includes(house) ? house : 'atreides'].color;
  const reduced = prefersReduced() || !!backdrop?.reduced;
  const space = !!(backdrop?.planet && backdrop?.drawSpace);
  const credits = await loadCredits();
  const lent = space ? backdrop.lend() : false;
  menu?.hide?.();
  try { music?.mood?.('finale'); } catch (err) { console.warn('ending: music:', err); }
  const layer = el('div', `ending${space ? '' : ' black'}${reduced ? ' still' : ''}`);
  const roll = el('div', 'ending-roll', { role: 'region', 'aria-label': 'Credits' });
  const groups = credits.map(creditGroup);
  roll.append(...groups);
  layer.append(roll);
  (app ?? document.body).appendChild(layer);
  const clock = new WallClock();
  const state = { t: at ?? 0, done: false, skipped: false, phase: 'shimmer', creditsMusic: false };
  const view = { travel: { x: 0, y: 0, z: 0 }, centred: 0, tint: { color: colour, amount: 0 } };
  let raf = 0, last = performance.now(), length = Infinity, resolve;
  const ended = new Promise((r) => { resolve = r; });
  const measure = () => {
    const h = innerHeight;
    length = endingLength({ rollHeight: roll.offsetHeight, viewHeight: h, pages: groups.length, reduced });
  };
  const draw = (dt) => {
    const t = state.t, v = endingView(t, { reduced });
    state.phase = t < ENDING.credits ? 'shimmer' : t < length ? 'credits' : 'done';
    if (t >= ENDING.credits && !state.creditsMusic) {
      state.creditsMusic = true;
      try { music?.mood?.('credits'); } catch (err) { console.warn('ending: music:', err); }
    }
    if (space) {
      view.travel.z = v.z;
      view.centred = v.centred;
      view.tint.amount = v.tint;
      backdrop.drawSpace(reduced ? 0 : dt, view);
    }
    if (reduced) {
      const p = pageAt(t, groups.length);
      groups.forEach((g, i) => { g.style.opacity = i === p.index ? p.opacity.toFixed(3) : '0'; });
    } else roll.style.transform = `translateY(${rollAt(t, innerHeight).toFixed(1)}px)`;
  };
  const finish = (skipped) => {
    if (state.done) return;
    state.done = true;
    state.skipped = skipped;
    state.phase = 'done';
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true);
    layer.removeEventListener('pointerdown', onPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    removeEventListener('resize', measure);
    layer.classList.add('out');
    setTimeout(() => layer.remove(), 700);
    if (space) {
      try { backdrop.drawSpace(0, { travel: ZERO }); } catch (err) { console.warn('ending:', err); }
      if (lent) backdrop.start({ warm: true });
    }
    menu?.show?.();
    try { music?.mood?.('menu'); } catch { /* the title plays when it can */ }
    resolve({ played: true, skipped });
  };
  const onKey = (e) => {
    if (e.repeat || NOT_A_KEY.has(e.key) || (e.altKey && e.key === 'Enter')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    swallowKey(e.code);
    finish(true);
  };
  const onPointer = (e) => {
    e.preventDefault();
    // the release lands on this layer while it fades, not on the title coming back beneath it
    layer.classList.add('catch');
    layer.addEventListener('click', (c) => { c.stopPropagation(); c.preventDefault(); layer.classList.remove('catch'); }, { capture: true, once: true });
    setTimeout(() => layer.classList.remove('catch'), 600);
    finish(true);
  };
  const onVisibility = () => clock.hold(document.hidden);
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (at === null) state.t = clock.t;
    try {
      draw(at === null ? dt : 0);
      if (at === null && state.t >= length) finish(false);
    } catch (err) { console.warn('ending:', err); finish(true); }
  };
  measure();
  addEventListener('resize', measure);
  addEventListener('keydown', onKey, true);
  layer.addEventListener('pointerdown', onPointer);
  document.addEventListener('visibilitychange', onVisibility);
  if (debug) {
    debug.ending = {
      get phase() { return state.phase; }, get t() { return state.t; }, get done() { return state.done; }, get length() { return length; },
      skip: () => finish(true),
      seek: (t) => { state.t = Math.max(0, Number(t) || 0); if (at === null) clock.start(state.t); draw(0); },
    };
  }
  try { draw(0); } catch (err) { console.warn('ending:', err); }
  clock.start(state.t);
  raf = requestAnimationFrame((now) => { last = now; frame(now); });
  return ended;
}
