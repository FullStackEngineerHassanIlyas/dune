import test from 'node:test';
import assert from 'node:assert/strict';

// A small stand-in for the DOM: enough for src/ui/dom.js h() and the menus to build their screens.
class FakeEl {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.nodeType = 1; this.children = []; this.attrs = {}; this.dataset = {}; this.listeners = {}; this.className = ''; this.hidden = false; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  append(...cs) { this.children.push(...cs); }
  appendChild(c) { this.children.push(c); return c; }
  replaceChildren(...cs) { this.children = cs; }
  focus() {}
  get classList() { return { add: (c) => { if (!this.className.split(' ').includes(c)) this.className = `${this.className} ${c}`.trim(); }, remove: (c) => { this.className = this.className.split(' ').filter((x) => x !== c).join(' '); } }; }
  get textContent() { return this.children.map((c) => (typeof c === 'string' ? c : c.textContent)).join(''); }
  set textContent(v) { this.children = [String(v)]; }
  querySelector() { return null; }
  all() { return [this, ...this.children.filter((c) => typeof c !== 'string').flatMap((c) => c.all())]; }
  find(pred) { return this.all().find(pred) ?? null; }
  click() { for (const fn of this.listeners.click ?? []) fn({ preventDefault() {} }); }
}
globalThis.Node = FakeEl;
globalThis.document = { createElement: (tag) => new FakeEl(tag), querySelectorAll: () => [] };
const keyListeners = [];
globalThis.addEventListener = (type, fn) => { if (type === 'keydown') keyListeners.push(fn); };
globalThis.localStorage = undefined;
const tick = () => new Promise((r) => setTimeout(r, 0));
const pressEscape = () => { for (const fn of keyListeners) fn({ key: 'Escape', preventDefault() {} }); };

const { MainMenu, MENU_ITEMS } = await import('../src/ui/main-menu.js');
const { GameMenu } = await import('../src/ui/game-menu.js');
const { originalFilesPage } = await import('../src/ui/options.js');
const { DEFAULTS } = await import('../src/core/settings.js');

const byAct = (root, act) => root.find((el) => el.dataset?.act === act);
const panelTitle = (root) => root.find((el) => el.tagName === 'H2')?.textContent;

test('the main menu lists Original Game Files after Options (spec §5.8)', () => {
  const acts = MENU_ITEMS.map(([act]) => act);
  assert.equal(acts.indexOf('original-files'), acts.indexOf('options') + 1);
  assert.equal(MENU_ITEMS.find(([act]) => act === 'original-files')[1], 'Original Game Files');
  const menu = new MainMenu(new FakeEl('div'), { settings: { ...DEFAULTS }, onStart() {}, onFullscreen() {} });
  for (const act of ['skirmish', 'options', 'original-files', 'controls', 'credits']) assert.ok(byAct(menu.el, act), act);
});

test('without the original-files module the entry opens a "Not available" page, and Back returns', async () => {
  const menu = new MainMenu(new FakeEl('div'), { settings: { ...DEFAULTS }, onStart() {}, onFullscreen() {} });
  byAct(menu.el, 'original-files').click();
  assert.equal(menu.screen, 'original-files');
  for (let i = 0; i < 20 && !menu.el.find((el) => el.dataset?.state === 'unavailable'); i++) await tick();
  assert.equal(menu.el.find((el) => el.dataset?.state === 'unavailable')?.textContent, 'Not available');
  menu.el.find((el) => el.tagName === 'BUTTON' && el.textContent === 'Back').click();
  assert.equal(menu.screen, 'title');
});

test('the Options page has the Original Game Files button and the Music row; Esc from the files page goes back to Options', async () => {
  const changes = [];
  const menu = new MainMenu(new FakeEl('div'), { settings: { ...DEFAULTS }, onStart() {}, onFullscreen() {}, onSettings: (k, v) => changes.push([k, v]) });
  byAct(menu.el, 'options').click();
  assert.ok(menu.el.find((el) => el.className === 'dm-label' && el.textContent === 'Music'));
  byAct(menu.el, 'original-files').click();
  assert.equal(menu.screen, 'original-files');
  pressEscape();
  assert.equal(menu.screen, 'options', 'Esc leads back to the page that opened it');
  pressEscape();
  assert.equal(menu.screen, 'title');
  // an option change reaches onSettings (the music follows its volume live)
  byAct(menu.el, 'options').click();
  menu.el.find((el) => el.dataset?.key === 'scheme' && el.textContent === 'Modern').click();
  assert.deepEqual(changes, [['scheme', 'modern']]);
});

test('a late answer from the files module does not replace the screen the player moved on to', async () => {
  const menu = new MainMenu(new FakeEl('div'), { settings: { ...DEFAULTS }, onStart() {}, onFullscreen() {} });
  byAct(menu.el, 'original-files').click();
  menu.go('credits');
  for (let i = 0; i < 10; i++) await tick();
  assert.equal(panelTitle(menu.el), 'Credits');
});

test('the files page is the module\'s panel when it loads, and "Not available" when it is missing, throws or returns nothing', async () => {
  const onBack = () => {};
  const panel = new FakeEl('div');
  let got = null;
  const real = await originalFilesPage({ a: 1 }, { onBack, load: async () => ({ originalFilesPanel: (settings, opts) => { got = [settings, opts.onBack]; return panel; } }) });
  assert.equal(real, panel);
  assert.deepEqual(got, [{ a: 1 }, onBack]);
  assert.equal(await originalFilesPage({}, { onBack, load: async () => ({ originalFilesPanel: async () => panel }) }), panel, 'an async panel too');
  const warn = console.warn;
  console.warn = () => {};
  try {
    for (const load of [async () => { throw new TypeError('Failed to fetch dynamically imported module'); }, async () => ({}), async () => ({ originalFilesPanel: () => null }), async () => ({ originalFilesPanel: () => { throw new Error('boom'); } })]) {
      const page = await originalFilesPage({}, { onBack, load });
      assert.equal(page.find((el) => el.dataset?.state === 'unavailable')?.textContent, 'Not available');
    }
  } finally { console.warn = warn; }
});

test('the in-game Options page opens the files page; Esc goes back to Options, then to the main page', async () => {
  const menu = new GameMenu(new FakeEl('div'), { settings: { ...DEFAULTS }, onClose() {}, onRestart() {}, onQuit() {}, onFullscreen() {} });
  menu.open();
  byAct(menu.el, 'options').click();
  assert.ok(menu.el.find((el) => el.className === 'dm-label' && el.textContent === 'Music'));
  byAct(menu.el, 'original-files').click();
  assert.equal(menu.page, 'original-files');
  for (let i = 0; i < 20 && !menu.el.find((el) => el.dataset?.state === 'unavailable'); i++) await tick();
  assert.ok(menu.el.find((el) => el.dataset?.state === 'unavailable'));
  menu.onKey('Escape');
  assert.equal(menu.page, 'options');
  menu.onKey('Escape');
  assert.equal(menu.page, 'main');
});

test('closing the in-game menu while the files page loads leaves it closed', async () => {
  const menu = new GameMenu(new FakeEl('div'), { settings: { ...DEFAULTS }, onClose() {}, onRestart() {}, onQuit() {}, onFullscreen() {} });
  menu.show('original-files');
  menu.close();
  for (let i = 0; i < 10; i++) await tick();
  assert.equal(menu.el.children.length, 0);
});
