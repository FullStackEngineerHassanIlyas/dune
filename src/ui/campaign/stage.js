// The Mentat's stage (research.md §4, §6: the Sega screens): the house's Mentat at the bottom left, the territory map
// beside him, his words typed at the top two lines at a time, and the buttons below the map. The house pages, the
// "join?" question, the briefing and its advice, the win and lose lines and the final words all play on it.
// The whole text is also in a visually hidden live region, so a screen reader hears it at once.
import { h } from '../dom.js';
import { mentatSvg } from './portraits.js';
import { attachMentatFace } from './mentat-face.js';
import { rigFor } from './mentat-face-rigs.js';
import { originalMentatFigure, originalMentatRig } from './original-mentat.js';

const CHAR_MS = 26, HOLD_MS = 2600;

/** True when the player asked the system for less motion: the words then appear a pair at a time, untyped. */
export function reducedMotion() {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/**
 * Types `lines` into `box` two at a time: each pair letter by letter, held, then the next; the last pair stays.
 * `later(fn, ms)` schedules (the caller cancels everything when the screen changes). skip() finishes the pair
 * being typed, or moves on to the next one; done is true once the last pair is out. `room`, unseen in the box's
 * place, gets every pair whole, so the box is as tall as the tallest from the start and nothing below it moves
 * as the words wrap (a narrow window).
 */
export function typeLines(box, lines, { later, instant = reducedMotion(), onDone = () => {}, room = null } = {}) {
  const pairs = [];
  for (let i = 0; i < lines.length; i += 2) pairs.push(lines.slice(i, i + 2));
  if (!pairs.length) pairs.push(['']);
  const rows = [h('div', { class: 'cp-line' }), h('div', { class: 'cp-line' })];
  box.replaceChildren(...rows);
  room?.replaceChildren(...pairs.map((pair) => h('div', {}, h('div', { class: 'cp-line' }, pair[0]), h('div', { class: 'cp-line' }, pair[1] ?? ''))));
  let pair = 0, shown = 0, token = 0;
  const typer = { done: false, typing: false };
  const total = () => pairs[pair].join('').length;
  const draw = () => {
    let left = shown;
    for (let i = 0; i < 2; i++) {
      const line = pairs[pair][i] ?? '';
      rows[i].textContent = line.slice(0, Math.max(0, left));
      left -= line.length;
    }
  };
  const finishPair = () => {
    shown = total();
    typer.typing = false;
    draw();
    if (pair === pairs.length - 1) { if (!typer.done) { typer.done = true; onDone(); } return; }
    const t = ++token;
    later(() => { if (t === token) next(); }, HOLD_MS);
  };
  const tick = (t) => {
    if (t !== token) return;
    shown += 1;
    draw();
    if (shown >= total()) finishPair();
    else later(() => tick(t), CHAR_MS);
  };
  const next = () => {
    if (pair >= pairs.length - 1) return;
    pair += 1;
    start();
  };
  const start = () => {
    shown = 0;
    const t = ++token;
    if (instant) { finishPair(); return; }
    typer.typing = true;
    draw();
    later(() => tick(t), CHAR_MS);
  };
  typer.skip = () => {
    if (typer.typing) { token++; finishPair(); } else if (!typer.done) { token++; next(); }
  };
  typer.stop = () => { token++; typer.typing = false; };
  start();
  return typer;
}

export const START_WAIT = 1500;   // ms the voice may take to start before the words are typed without it
export const TICK_MS = 33;        // the words follow the voice this often
const MARK_AFTER = 0.15;          // seconds a word stays marked after it is said (into a pause)
// the word being said: spice gold over the cream text, underlined too so it is not told by colour alone
const MARK_STYLE = 'color:#ffd27a;text-decoration:underline 2px rgba(255,210,122,.55);text-underline-offset:.22em';

/**
 * The words follow the Mentat's voice: `speech` (a MentatLine, src/audio/mentat-voice.js) says `lines`, and the
 * pair of lines holding the word being said shows, typed up to that word, the word itself letter by letter as it is
 * said, and marked. Instant (reduced motion): each pair whole once the voice reaches it. skip() takes the voice and
 * the words on to the next pair; on the last pair it ends the line and shows it whole. When the voice has not
 * started within START_WAIT ms, or cannot, it is stopped and the words are typed as typeLines does (from the pair
 * reached, if it gave out midway). Same typer as typeLines: { done, typing, skip(), stop() }, plus `speech`.
 */
export function followSpeech(box, lines, speech, { later, instant = reducedMotion(), onDone = () => {}, room = null } = {}) {
  const pairs = [];
  for (let i = 0; i < lines.length; i += 2) pairs.push(lines.slice(i, i + 2));
  if (!pairs.length) pairs.push(['']);
  const rows = [h('div', { class: 'cp-line' }), h('div', { class: 'cp-line' })];
  box.replaceChildren(...rows);
  room?.replaceChildren(...pairs.map((pair) => h('div', {}, h('div', { class: 'cp-line' }, pair[0]), h('div', { class: 'cp-line' }, pair[1] ?? ''))));
  let inner = null, stopped = false, started = false, finished = false, pair = 0, drawn = '';
  const frame = { word: -1 };
  const typer = {
    speech,
    get done() { return inner ? inner.done : finished; },
    get typing() { return inner ? inner.typing : !finished && !stopped; },
    /** True while the words follow the voice (false once typed without it). */
    get following() { return !inner && !finished && !stopped; },
  };
  const end = () => { if (!finished) { finished = true; onDone(); } };
  // draws rows as [text, cut (letters shown), mark start, mark end] once they change
  const paint = (spec) => {
    const key = JSON.stringify(spec);
    if (key === drawn) return;
    drawn = key;
    spec.forEach(([text, cut, m0, m1], i) => {
      if (m1 > m0) rows[i].replaceChildren(text.slice(0, m0), h('span', { class: 'cp-now', style: MARK_STYLE }, text.slice(m0, m1)), text.slice(m1, cut));
      else rows[i].textContent = text.slice(0, cut);
    });
  };
  const whole = (p) => paint([0, 1].map((i) => { const text = pairs[p][i] ?? ''; return [text, text.length, 0, 0]; }));
  const draw = (t) => {
    const track = speech.track;
    track.at(t, frame);
    const w = track.words[frame.word];
    pair = w ? Math.min(pairs.length - 1, Math.floor(w.line / 2)) : 0;
    paint([0, 1].map((i) => {
      const li = pair * 2 + i, text = lines[li] ?? '';
      if (!w || instant && li !== w.line) return [text, instant && w ? text.length : 0, 0, 0];
      if (li < w.line) return [text, text.length, 0, 0];
      if (li > w.line) return [text, 0, 0, 0];
      const next = track.words[frame.word + 1];
      const tail = next && next.line === li ? next.c0 : text.length;   // the word's punctuation and space
      const k = instant ? 1 : Math.min(1, Math.max(0, (t - w.start) / Math.max(0.05, w.end - w.start)));
      const cut = instant ? text.length : t >= w.end ? tail : w.c0 + Math.ceil(k * (w.c1 - w.c0));
      return t <= w.end + MARK_AFTER ? [text, cut, w.c0, Math.min(cut, w.c1)] : [text, cut, 0, 0];
    }));
  };
  // without the voice: typed from the pair reached (the room already holds every pair)
  const fallback = () => {
    if (stopped || inner || finished) return;
    speech.stop();
    drawn = '';
    inner = typeLines(box, lines.slice(pair * 2), { later, instant, onDone: () => { finished = true; onDone(); }, room: null });
  };
  const tick = () => {
    if (stopped || inner || finished) return;
    const state = speech.state;
    if (state === 'playing') { started = true; draw(speech.time); later(tick, TICK_MS); return; }
    if (state === 'ended') { whole(pairs.length - 1); end(); return; }
    if (state === 'loading') { later(tick, TICK_MS); return; }
    fallback();   // stopped from outside, or failed
  };
  speech.started?.then?.((ok) => { if (!ok && !started) fallback(); });
  later(() => { if (speech.state === 'loading') fallback(); }, START_WAIT);
  paint([['', 0, 0, 0], ['', 0, 0, 0]]);
  tick();
  typer.skip = () => {
    if (inner) { inner.skip(); return; }
    if (stopped || finished) return;
    if (speech.state !== 'playing') { fallback(); inner?.skip(); return; }
    const first = pair < pairs.length - 1 ? speech.track.firstWordOn((pair + 1) * 2) : -1;
    if (first >= 0 && speech.seek(Math.max(0, speech.track.words[first].start - 0.04))) { draw(speech.time); return; }
    speech.stop();   // the last pair: the rest of it at once, and the voice ends
    whole(pairs.length - 1);
    end();
  };
  typer.stop = () => { stopped = true; inner?.stop(); speech.stop(); };
  return typer;
}

/**
 * Builds the stage for `house`: { el, say(lines, { kicker, title, speech }), actions(buttons), mapBox, portrait,
 * voice }. Buttons are [label, act, onclick, { primary }]; every one carries data-act. `warn` (a save failed)
 * stands above the note. `voice` (src/audio/mentat-voice.js MentatVoice, or null) is kept for the portrait: the
 * face follows voice.now() (the contract in docs/superpowers/notes/2026-10-05-mentat-voice.md).
 */
export function mentatStage(house, { mentatName, later, className = '', label = '', warn = null, voice = null } = {}) {
  const kicker = h('div', { class: 'cp-kicker' });
  const title = h('h2', { class: 'cp-title' });
  const box = h('div', { class: 'cp-lines', 'aria-hidden': 'true', title: 'Click to read on', dataset: { act: 'read-on' } });
  const room = h('div', { class: 'cp-lines cp-room', 'aria-hidden': 'true' });
  const spoken = h('div', { class: 'cp-sr', 'aria-live': 'polite' });
  const note = h('p', { class: 'cp-note', hidden: true });
  const portrait = h('figure', { class: 'cp-mentat', 'aria-label': `${mentatName}, Mentat of House ${label || house}` });
  const figure = originalMentatFigure(house);   // the player's own Dune II Mentat, when the original pictures are on
  portrait.innerHTML = figure ?? mentatSvg(house);
  const mapBox = h('div', { class: 'cp-mapbox' });
  const bar = h('div', { class: 'cp-bar' });
  const el = h('section', { class: `cp-stage cp-mentat-stage ${className}`.trim(), dataset: { house } },
    h('div', { class: 'cp-text' }, kicker, title, h('div', { class: 'cp-say' }, box, room), spoken), portrait, mapBox,
    h('div', { class: 'cp-foot' }, warn && h('p', { class: 'cp-warn', role: 'status' }, warn), note, bar));
  let typer = null;
  box.addEventListener('click', () => typer?.skip());
  const stage = {
    el, mapBox, portrait, voice,
    get typer() { return typer; },
    /** New words: typed in the box (following `speech`, the Mentat's voice saying them, when given), the whole of them in the live region. */
    say(lines, { kicker: k = null, title: t = null, onDone, speech = null } = {}) {
      kicker.textContent = k ?? '';
      title.textContent = t ?? '';
      title.hidden = !t;
      spoken.textContent = lines.join(' ');
      typer?.stop();
      typer = speech ? followSpeech(box, lines, speech, { later, onDone, room }) : typeLines(box, lines, { later, onDone, room });
      return typer;
    },
    /** A small line under the map (the objective, a warning); null hides it. */
    note(text) { note.textContent = text ?? ''; note.hidden = !text; },
    /** The buttons under the map; `focus` (an act) or the primary one (or the first) takes the focus. */
    actions(buttons, { focus = null } = {}) {
      const els = buttons.filter(Boolean).map(([text, act, onclick, { primary = false, data = {} } = {}]) =>
        h('button', { type: 'button', class: `dm-btn cp-btn${primary ? ' primary' : ''}`, dataset: { act, ...data }, onclick }, text));
      bar.replaceChildren(...els);
      (els.find((b) => focus && b.dataset.act === focus) ?? els.find((b) => b.className.includes('primary')) ?? els[0])?.focus?.({ preventScroll: true });
      return els;
    },
  };
  stage.face = voice ? attachMentatFace(stage, figure ? originalMentatRig(house) : rigFor(house)) : null;
  return stage;
}
