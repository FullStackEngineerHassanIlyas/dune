// The Mentat's stage (research.md §4, §6: the Sega screens): the house's Mentat at the bottom left, the territory map
// beside him, his words typed at the top two lines at a time, and the buttons below the map. The house pages, the
// "join?" question, the briefing and its advice, the win and lose lines and the final words all play on it.
// The whole text is also in a visually hidden live region, so a screen reader hears it at once.
import { h } from '../dom.js';
import { mentatSvg } from './portraits.js';

const CHAR_MS = 26, HOLD_MS = 2600;

/** True when the player asked the system for less motion: the words then appear a pair at a time, untyped. */
export function reducedMotion() {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/**
 * Types `lines` into `box` two at a time: each pair letter by letter, held, then the next; the last pair stays.
 * `later(fn, ms)` schedules (the caller cancels everything when the screen changes). skip() finishes the pair
 * being typed, or moves on to the next one; done is true once the last pair is out.
 */
export function typeLines(box, lines, { later, instant = reducedMotion(), onDone = () => {} } = {}) {
  const pairs = [];
  for (let i = 0; i < lines.length; i += 2) pairs.push(lines.slice(i, i + 2));
  if (!pairs.length) pairs.push(['']);
  const rows = [h('div', { class: 'cp-line' }), h('div', { class: 'cp-line' })];
  box.replaceChildren(...rows);
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

/**
 * Builds the stage for `house`: { el, say(lines, { kicker, title }), actions(buttons), mapBox }. Buttons are
 * [label, act, onclick, { primary }]; every one carries data-act.
 */
export function mentatStage(house, { mentatName, later, className = '', label = '' } = {}) {
  const kicker = h('div', { class: 'cp-kicker' });
  const title = h('h2', { class: 'cp-title' });
  const box = h('div', { class: 'cp-lines', 'aria-hidden': 'true', title: 'Click to read on', dataset: { act: 'read-on' } });
  const spoken = h('div', { class: 'cp-sr', 'aria-live': 'polite' });
  const note = h('p', { class: 'cp-note', hidden: true });
  const portrait = h('figure', { class: 'cp-mentat', 'aria-label': `${mentatName}, Mentat of House ${label || house}` });
  portrait.innerHTML = mentatSvg(house);
  const mapBox = h('div', { class: 'cp-mapbox' });
  const bar = h('div', { class: 'cp-bar' });
  const el = h('section', { class: `cp-stage cp-mentat-stage ${className}`.trim(), dataset: { house } },
    h('div', { class: 'cp-text' }, kicker, title, box, spoken), portrait, mapBox, h('div', { class: 'cp-foot' }, note, bar));
  let typer = null;
  box.addEventListener('click', () => typer?.skip());
  const stage = {
    el, mapBox,
    get typer() { return typer; },
    /** New words: typed in the box, the whole of them in the live region. */
    say(lines, { kicker: k = null, title: t = null, onDone } = {}) {
      kicker.textContent = k ?? '';
      title.textContent = t ?? '';
      title.hidden = !t;
      spoken.textContent = lines.join(' ');
      typer?.stop();
      typer = typeLines(box, lines, { later, onDone });
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
  return stage;
}
