// The sidebar's tooltip (C&C 3 style): a dark translucent card beside the hovered build icon, headed in the house
// colour with the icon, then compact rows — the state line, price and build time, stats, weapon, strong / weak,
// abilities, what it builds or leads to and what is still missing. It opens after a short rest (at once when moving
// from one icon to the next, and on keyboard focus), sits left of the sidebar level with the icon so it never covers
// it, and stays inside the window. The card is built only when it opens (tooltip-model.js); every frame after that
// only the state line is touched, and only when what it says has changed.
import { statusLine, clock } from './tooltip-model.js';

export const REST_MS = 260;     // the pointer rests this long before the card opens …
export const WARM_MS = 450;     // … unless a card closed this recently: then the next one opens at once
const REFRESH_MS = 1000;        // while open, the card is rebuilt this often (factories built, prices re-rolled)
const MARGIN = 8;               // px kept clear of the window's edges

const PATHS = {
  credits: 'M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zm0 2a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9zM7 5h2v6H7z',
  time: 'M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zm0 2a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9zM7.2 5h1.6v3.2l2.2 1.3l-.8 1.4L7.2 9z',
  power: 'M9.5 1L3 9h4l-1 6l6.5-8h-4z',
  hp: 'M6 2h4v4h4v4h-4v4H6v-4H2V6h4z',
  speed: 'M2 3l5 5l-5 5V3zm7 0l5 5l-5 5V3z',
  class: 'M2 5h12v6H2zm2 2v2h8V7z',
  sight: 'M8 3C4 3 1.5 8 1.5 8S4 13 8 13s6.5-5 6.5-5S12 3 8 3zm0 2.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z',
  storage: 'M3 3h10v3H3zm0 4h10v6H3zm4 2v2h2V9z',
  size: 'M2 2h5v5H2zm7 0h5v5H9zM2 9h5v5H2zm7 0h5v5H9z',
  weapon: 'M7 1h2v3.1A4 4 0 0 1 11.9 7H15v2h-3.1A4 4 0 0 1 9 11.9V15H7v-3.1A4 4 0 0 1 4.1 9H1V7h3.1A4 4 0 0 1 7 4.1zm1 5a2 2 0 1 0 0 4a2 2 0 1 0 0-4z',
  strong: 'M8 2l6.5 11h-13z',
  weak: 'M8 14L1.5 3h13z',
  ability: 'M8 1l3 7l-3 7l-3-7z',
  lock: 'M5 7V5a3 3 0 0 1 6 0v2h1.5v8h-9V7zm2 0h2V5a1 1 0 0 0-2 0z',
};

const SVG = 'http://www.w3.org/2000/svg';
function icon(name) {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', `tt-i tt-i-${name}`);
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', PATHS[name]);
  p.setAttribute('fill-rule', 'evenodd');
  s.appendChild(p);
  return s;
}

function el(tag, cls, ...children) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

export class BuildTooltip {
  constructor(host) {
    this.host = host;
    this.el = el('div', 'sb-tip');
    this.el.id = 'sb-tip';
    this.el.setAttribute('role', 'tooltip');
    host.appendChild(this.el);
    this.describe = null;   // item → tooltip model, from the sidebar model
    this.anchor = null;
    this.timer = 0;
    this.visible = false;
    this.closedAt = -Infinity;
    this.trackUntil = 0;
    this.tip = null;
    this.power = null;
    this.statusEl = el('span', 'tt-status');   // one node for good, moved into each card: scripts read `.sb-tip span`
    this.el.appendChild(this.statusEl);
    this.builtAt = 0;
    this.seen = { typeId: null, cost: NaN, state: null, done: -1, count: -1, note: null, starved: null, seconds: -1, ready: null, produced: NaN, used: NaN };
  }

  /** The pointer (or keyboard focus, `now`) came to an icon. */
  hover(anchor, now = false) {
    if (this.anchor === anchor && (this.visible || this.timer)) return;
    this.cancel();
    if (this.anchor && this.anchor !== anchor) this.anchor.removeAttribute('aria-describedby');
    this.anchor = anchor;
    if (now || this.visible || performance.now() - this.closedAt < WARM_MS) this.open();
    else this.timer = setTimeout(() => { this.timer = 0; this.open(); }, REST_MS);
  }

  /** The pointer left `anchor` (or anything, when none is named). */
  leave(anchor = null) {
    if (anchor && anchor !== this.anchor) return;
    this.cancel();
    if (this.visible) this.closedAt = performance.now();
    this.visible = false;
    this.anchor?.removeAttribute('aria-describedby');
    this.anchor = null;
    this.el.classList.remove('show');
  }

  cancel() { if (this.timer) { clearTimeout(this.timer); this.timer = 0; } }

  /** An icon was rebuilt under the card (a strip's set changed): carry on on its successor. */
  reanchor(next) {
    if (!next || next === this.anchor) return;
    this.anchor = next;
    if (this.visible) { next.setAttribute('aria-describedby', this.el.id); this.render(); this.place(); }
  }

  /** The strip scrolled: follow the icon while it slides. */
  track(ms = 220) { this.trackUntil = performance.now() + ms; }

  open() {
    const a = this.anchor;
    if (!a?.isConnected || !a.item || !this.describe) return;
    this.render();
    this.visible = true;
    this.el.classList.add('show');
    this.place();
    a.setAttribute('aria-describedby', this.el.id);
  }

  /** Every frame from the sidebar: keep the open card true, touching the page only when something changed. */
  frame(power) {
    this.power = power;
    if (!this.visible) return;
    const a = this.anchor;
    if (!a?.isConnected || !a.item) { this.leave(); return; }
    const i = a.item, s = this.seen, now = performance.now();
    if (i.typeId !== s.typeId || i.cost !== s.cost || power.produced !== s.produced || power.used !== s.used || now - this.builtAt > REFRESH_MS) {
      this.render();
      this.place();
      return;
    }
    const done = Math.floor((i.progress ?? 0) * 100);
    if (i.state !== s.state || done !== s.done || i.count !== s.count || i.note !== s.note || i.starved !== s.starved || i.seconds !== s.seconds || i.ready !== s.ready) {
      this.remember(i);
      const text = statusLine(i, this.tip);
      if (this.statusEl.textContent !== text) this.statusEl.textContent = text;
    }
    if (now < this.trackUntil) this.place();
  }

  /** What the card was built from (plain fields: nothing allocated per frame). */
  remember(i) {
    const s = this.seen;
    s.typeId = i.typeId; s.cost = i.cost; s.state = i.state; s.done = Math.floor((i.progress ?? 0) * 100); s.count = i.count;
    s.note = i.note; s.starved = i.starved; s.seconds = i.seconds; s.ready = i.ready;
    s.produced = this.power?.produced ?? NaN; s.used = this.power?.used ?? NaN;
  }

  render() {
    const item = this.anchor.item, t = (this.tip = this.describe(item));
    this.builtAt = performance.now();
    this.remember(item);
    if (!t) { this.statusEl.textContent = ''; this.el.replaceChildren(this.statusEl); return; }
    this.el.dataset.kind = t.kind;
    const card = el('div', 'tt-card');
    const img = this.anchor.querySelector('img');
    const head = el('div', 'tt-head', img?.src ? Object.assign(el('img', 'tt-icon'), { src: img.src, alt: '' }) : null,
      el('div', 'tt-title', el('b', 'tt-name', t.name), t.role ? el('em', 'tt-role', t.role) : null));
    this.statusEl.textContent = statusLine(item, t);
    card.append(head, this.statusEl);
    if (t.cost || t.time) {
      const price = el('div', 'tt-price');
      if (t.cost) price.append(el('div', `tt-cost${t.cost.short ? ' short' : ''}`, icon('credits'), el('b', null, String(t.cost.value)), el('small', null, t.cost.short ? 'credits — not enough yet' : 'credits')));
      if (t.time) price.append(el('div', 'tt-time', icon('time'), el('b', null, t.time.seconds >= 100 ? clock(t.time.seconds) : String(t.time.seconds)), el('small', null, `${t.time.seconds >= 100 ? '' : 'sec '}${(t.time.label ?? 'build time').toLowerCase()}`)));
      card.append(price);
      const notes = [...(t.cost?.note ? [{ text: t.cost.note, tone: null }] : []), ...(t.time?.notes ?? [])];
      if (notes.length) card.append(el('ul', 'tt-notes', ...notes.map((n) => el('li', n.tone ?? '', n.text))));
    }
    if (t.stats.length) {
      card.append(el('dl', 'tt-stats', ...t.stats.map((s) => el('div', `tt-stat${s.tone ? ` ${s.tone}` : ''}${s.wide ? ' wide' : ''}`,
        el('dt', null, icon(s.icon), s.label), el('dd', null, s.value, s.note ? el('small', null, s.note) : null)))));
    }
    if (t.weapon) {
      card.append(el('div', 'tt-weapon', el('h4', null, icon('weapon'), t.weapon.name), el('p', null, t.weapon.text),
        t.weapon.tags.length ? el('ul', 'tt-tags', ...t.weapon.tags.map((g) => el('li', null, g))) : null));
    }
    if (t.unarmed) card.append(el('div', 'tt-vs', el('b', null, icon('weapon'), 'Unarmed'), el('p', null, 'Keep it away from the fighting')));
    if (t.strong.length) card.append(el('div', 'tt-vs good', el('b', null, icon('strong'), 'Strong vs'), el('p', null, t.strong.join(' · '))));
    if (t.weak.length) card.append(el('div', 'tt-vs bad', el('b', null, icon('weak'), 'Weak vs'), el('p', null, t.weak.join(' · '))));
    if (t.abilities.length) card.append(el('ul', 'tt-abilities', ...t.abilities.map((a) => el('li', null, icon('ability'), a))));
    for (const list of t.lists) {
      card.append(el('div', 'tt-list', el('b', null, list.label),
        el('ul', null, ...list.items.map((x) => el('li', x.needs.length ? 'needs' : '', x.needs.length ? icon('lock') : null, x.name, x.needs.length ? el('i', null, x.needs.join(', ')) : null)))));
    }
    if (t.needs.length) card.append(el('div', 'tt-needs', icon('lock'), el('b', null, 'Needs'), t.needs.join(', ')));
    this.el.replaceChildren(card);
  }

  /** Level with the icon, left of the sidebar, inside the window; the notch points at the icon. */
  place() {
    const a = this.anchor.getBoundingClientRect(), host = this.host.getBoundingClientRect();
    const h = this.el.offsetHeight, vh = window.innerHeight;
    const top = Math.max(MARGIN - host.top, Math.min(a.top - host.top, vh - host.top - h - MARGIN));
    const notch = Math.max(12, Math.min(h - 12, a.top + a.height / 2 - host.top - top));
    const px = `${Math.round(top)}px`, nx = `${Math.round(notch)}px`;
    if (this.el.style.top !== px) this.el.style.top = px;
    if (this.el.style.getPropertyValue('--notch') !== nx) this.el.style.setProperty('--notch', nx);
  }
}
