// The tooltip card's behaviour (src/ui/tooltip.js) on a small stand-in DOM: it opens after a rest (at once from one
// icon to the next and on keyboard focus), is built once and then only its state line changes, keeps inside the
// window level with its icon, and goes when its icon does.
import test from 'node:test';
import assert from 'node:assert/strict';

class Node0 {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this.attrs = {}; this.dataset = {}; this.text = ''; this.className = '';
    this.rect = { top: 0, height: 0, left: 0, width: 0, bottom: 0 }; this.offsetHeight = 200;
    const props = {};
    this.style = { setProperty: (k, v) => { props[k] = v; }, getPropertyValue: (k) => props[k] ?? '' };
    const self = this;
    this.classList = {
      add: (c) => { if (!self.classList.contains(c)) self.className = `${self.className} ${c}`.trim(); },
      remove: (c) => { self.className = self.className.split(' ').filter((x) => x && x !== c).join(' '); },
      contains: (c) => self.className.split(' ').includes(c),
    };
  }
  append(...cs) {
    for (let c of cs) {
      if (typeof c === 'string') { const t = new Node0('#text'); t.text = c; c = t; }
      if (c.parent) c.parent.children = c.parent.children.filter((x) => x !== c);
      c.parent = this;
      this.children.push(c);
    }
  }
  appendChild(c) { this.append(c); return c; }
  replaceChildren(...cs) { for (const c of this.children) c.parent = null; this.children = []; this.append(...cs); }
  get isConnected() { let n = this; while (n.parent) n = n.parent; return n === globalThis.document.body; }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { for (const c of this.children) c.parent = null; this.children = []; this.text = String(v); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener() {}
  getBoundingClientRect() { return this.rect; }
  all() { return this.children.flatMap((c) => [c, ...c.all()]); }
  querySelector(tag) { return this.all().find((n) => n.tagName === tag.toUpperCase()) ?? null; }
}
globalThis.document = { body: new Node0('body'), createElement: (t) => new Node0(t), createElementNS: (ns, t) => new Node0(t) };
globalThis.window = { innerHeight: 768 };

const { BuildTooltip, REST_MS, WARM_MS } = await import('../src/ui/tooltip.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const power = { produced: 100, used: 50 };

function setup() {
  const host = new Node0('div');
  document.body.append(host);
  const tip = new BuildTooltip(host);
  let built = 0;
  tip.describe = (item) => {
    built++;
    return { kind: 'unit', typeId: item.typeId, name: item.name, role: 'Main battle tank', cost: { value: item.cost, note: null, short: false }, time: { seconds: 29, base: 28.8, speed: 1, notes: [] },
      base: 28.8, speed: 1, stats: [{ icon: 'hp', label: 'Hit points', value: '200' }], weapon: null, strong: ['Tanks'], weak: ['Aircraft'], unarmed: false, abilities: [], lists: [], needs: ['Radar Outpost'] };
  };
  const icon = (typeId, top) => {
    const b = new Node0('button');
    b.dataset.type = typeId;
    b.item = { typeId, name: 'Combat Tank', cost: 300, state: 'idle', progress: 0, count: 0, line: 'heavy' };
    b.rect = { top, height: 88, left: 1100, width: 110, bottom: top + 88 };
    host.append(b);
    return b;
  };
  tip.frame(power);
  return { host, tip, icon, builds: () => built };
}

test('it opens after a short rest, or at once on keyboard focus', async () => {
  const { tip, icon, builds } = setup();
  const b = icon('combatTank', 100);
  tip.hover(b);
  assert.equal(tip.el.classList.contains('show'), false, 'not while the pointer passes over');
  await sleep(REST_MS + 40);
  assert.equal(tip.el.classList.contains('show'), true);
  assert.equal(builds(), 1);
  assert.equal(b.getAttribute('aria-describedby'), tip.el.id);
  tip.leave(b);
  assert.equal(tip.el.classList.contains('show'), false);
  assert.equal(b.getAttribute('aria-describedby'), null);
  const c = icon('trike', 200);
  tip.hover(c, true);
  assert.equal(tip.el.classList.contains('show'), true, 'keyboard focus');
});

test('from one icon to the next it follows at once; a pass that leaves early never opens it', async () => {
  const { tip, icon } = setup();
  const a = icon('combatTank', 100), b = icon('quad', 200);
  tip.hover(a, true);
  tip.leave(a);
  tip.hover(b);
  assert.equal(tip.el.classList.contains('show'), true, `within ${WARM_MS} ms of the last card`);
  tip.leave(b);
  await sleep(WARM_MS + 40);
  tip.hover(a);
  tip.leave(a);
  await sleep(REST_MS + 40);
  assert.equal(tip.el.classList.contains('show'), false);
});

test('the card is built once; each frame after that touches only the state line, and only on a change', () => {
  const { tip, icon, builds } = setup();
  const b = icon('combatTank', 100);
  tip.hover(b, true);
  const card = tip.el.children.find((c) => c.className === 'tt-card');
  const status = tip.statusEl;
  assert.equal(status.textContent, 'Click to build · Shift + click for five');
  assert.equal(tip.el.all().find((n) => n.tagName === 'SPAN'), status, 'the state line is the card\'s first span');
  for (let k = 0; k < 30; k++) tip.frame(power);
  assert.equal(builds(), 1);
  assert.equal(tip.el.children.find((c) => c.className === 'tt-card'), card, 'the same card');
  b.item = { ...b.item, state: 'building', progress: 0.25, count: 1 };
  tip.frame(power);
  assert.equal(status.textContent, 'Building 25 % · 22 s left');
  assert.equal(builds(), 1, 'progress does not rebuild the card');
  b.item = { ...b.item, cost: 250 };
  tip.frame(power);
  assert.equal(builds(), 2, 'a new price does');
  tip.frame({ produced: 100, used: 150 });
  assert.equal(builds(), 3, 'so does the power changing');
  const needs = tip.el.all().find((n) => n.className === 'tt-needs');
  assert.match(needs.textContent, /Needs.*Radar Outpost/);
});

test('it sits level with its icon, inside the window, its notch on the icon', () => {
  const { tip, icon } = setup();
  const low = icon('combatTank', 700);
  tip.hover(low, true);
  assert.equal(tip.el.style.top, `${768 - 200 - 8}px`, 'pushed up off the bottom edge');
  assert.equal(tip.el.style.getPropertyValue('--notch'), '184px', 'the notch on the icon\'s middle (744 - 560)');
  const high = icon('trike', 120);
  tip.hover(high, true);
  assert.equal(tip.el.style.top, '120px');
  assert.equal(tip.el.style.getPropertyValue('--notch'), '44px');
});

test('it goes when its icon goes, and carries on on an icon rebuilt in its place', () => {
  const { host, tip, icon } = setup();
  const b = icon('combatTank', 100);
  tip.hover(b, true);
  const next = icon('combatTank', 100);
  host.children = host.children.filter((c) => c !== b);
  b.parent = null;
  tip.reanchor(next);
  tip.frame(power);
  assert.equal(tip.el.classList.contains('show'), true);
  host.children = host.children.filter((c) => c !== next);
  next.parent = null;
  tip.frame(power);
  assert.equal(tip.el.classList.contains('show'), false);
});
