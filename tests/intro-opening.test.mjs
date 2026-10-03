// The opening and the ending at work (src/scenes/menu-intro.js), in Node on a small stand-in for the DOM: the music
// hears of every way past the opening (contract C6), a music that breaks never holds the gate, the browser's own keys
// keep working, the still version holds the moon, the backdrop's work runs behind the gate's black, and the ending
// hands the planet back tan.
import test from 'node:test';
import assert from 'node:assert/strict';

// ---- a stand-in for the DOM: elements, the window's and the document's listeners, animation frames run by hand ----------
function listeners() {
  const list = [];
  return {
    add: (type, fn, opts) => list.push({ type, fn, capture: opts === true || !!opts?.capture, once: !!opts?.once }),
    remove: (type, fn, opts) => { const capture = opts === true || !!opts?.capture; const i = list.findIndex((l) => l.type === type && l.fn === fn && l.capture === capture); if (i >= 0) list.splice(i, 1); },
    fire(e) {
      for (const phase of [true, false]) {
        for (const l of list.filter((x) => x.type === e.type && x.capture === phase)) {
          if (e.stopped) return e;
          if (l.once) this.remove(l.type, l.fn, l.capture);
          l.fn(e);
        }
      }
      return e;
    },
    count: (type) => list.filter((l) => l.type === type).length,
  };
}
class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.attrs = {}; this.className = ''; this.parent = null; this.on = listeners(); this.text = ''; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  append(...cs) { for (const c of cs) { c.remove?.(); c.parent = this; this.children.push(c); } }
  appendChild(c) { this.append(c); return c; }
  replaceChildren(...cs) { this.children = []; this.append(...cs); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
  set textContent(v) { this.text = String(v); }
  get textContent() { return this.text; }
  get classList() {
    const names = () => this.className.split(' ').filter(Boolean);
    return { add: (...cs) => { this.className = [...new Set([...names(), ...cs])].join(' '); }, remove: (...cs) => { this.className = names().filter((c) => !cs.includes(c)).join(' '); }, contains: (c) => names().includes(c) };
  }
  addEventListener(type, fn, opts) { this.on.add(type, fn, opts); }
  removeEventListener(type, fn, opts) { this.on.remove(type, fn, opts); }
  querySelector(sel) {
    const cls = sel.replace(/^\./, '');
    for (const c of this.children) { if (c.classList.contains(cls)) return c; const deep = c.querySelector(sel); if (deep) return deep; }
    return null;
  }
  focus() {}
  getContext() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; }
  get offsetHeight() { return 0; }
}
const win = listeners(), doc = listeners();
let frames = new Map(), nextFrame = 1;
Object.assign(globalThis, {
  document: { createElement: (tag) => new El(tag), addEventListener: doc.add, removeEventListener: doc.remove, hidden: false, referrer: '' },
  addEventListener: win.add, removeEventListener: win.remove,
  requestAnimationFrame: (fn) => { frames.set(nextFrame, fn); return nextFrame++; },
  cancelAnimationFrame: (id) => { frames.delete(id); },
  innerWidth: 1600, innerHeight: 900,
});
/** Runs the animation frames waiting now, `ms` after this moment. */
function frame(ms = 16) {
  const waiting = frames;
  frames = new Map();
  const now = performance.now() + ms;
  for (const fn of waiting.values()) fn(now);
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const keyEvent = (key, more = {}) => ({
  type: 'keydown', key, code: more.code ?? (key.length === 1 ? `Key${key.toUpperCase()}` : key), repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...more,
  defaultPrevented: false, stopped: false,
  preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, stopPropagation() { this.stopped = true; },
});
/** A key pressed and let go: the keydown's event, after both have gone round the window's listeners. */
const press = (key, more) => { const e = win.fire(keyEvent(key, more)); win.fire({ ...keyEvent(key, more), type: 'keyup' }); return e; };
const pointer = (target) => target.on.fire({ type: 'pointerdown', preventDefault() {}, stopPropagation() {} });

const { runIntro, playEnding, browserKey } = await import('../src/scenes/menu-intro.js');

/** runIntro's context, forced on (?intro=1) in its still version unless `full`; calls are logged. */
function opening({ music = {}, query = 'intro=1', reduced = true } = {}) {
  const calls = [], moon = [];
  const p = new URLSearchParams(query);
  const params = { str: (k) => (p.has(k) ? p.get(k) : null), num: (k) => (p.has(k) ? Number(p.get(k)) : null) };
  const backdrop = {
    reduced, next: null, prepared: 0,
    planet: { framing: { distance: 4.14, shiftX: 0.5, shiftY: 0.05 }, startPass: (t) => moon.push(t) },
    r3d: { compile() {}, width: 1600, height: 900 },
    drawSpace() {}, lend: () => true,
    prepare() { if (++this.prepared === 3) this.next = { ready: true }; },
  };
  const app = new El('div');
  const menu = { hide: () => calls.push('menu.hide'), show: () => calls.push('menu.show') };
  const fake = { prime: () => calls.push('music.prime'), intro: () => { calls.push('music.intro'); return Promise.resolve(false); }, skipIntro: () => calls.push('music.skipIntro'), ...music };
  const ctx = { params, settings: {}, app, backdrop, menu, music: fake, startBackdrop: () => calls.push('startBackdrop'), debug: {} };
  return { ctx, calls, moon, backdrop, layer: () => app.children[0] };
}

test('Escape at the gate, or the debug skip there, tells the music: the title\'s theme follows, not the opening\'s cue', async () => {
  for (const how of ['escape', 'debug']) {
    const { ctx, calls } = opening();
    const run = runIntro(ctx);
    if (how === 'escape') assert.equal(press('Escape').defaultPrevented, true);
    else ctx.debug.intro.skip();
    assert.deepEqual(await run, { played: true, skipped: true }, how);
    assert.ok(calls.includes('music.skipIntro'), `${how}: ${calls.join(' ')}`);
    assert.ok(!calls.includes('music.intro'), `${how}: Escape cannot start sound`);
    assert.ok(calls.indexOf('music.skipIntro') < calls.indexOf('menu.show'), how);
  }
});

test('a key during the opening skips it and tells the music; its natural end leaves the cue to run on', async () => {
  const { ctx, calls } = opening();
  const run = runIntro(ctx);
  press('a');
  await tick();
  frame();
  assert.equal(ctx.debug.intro.phase, 'credits');
  press('b');
  assert.deepEqual(await run, { played: true, skipped: true });
  assert.deepEqual(calls.filter((c) => c.startsWith('music.')), ['music.prime', 'music.intro', 'music.skipIntro']);

  const second = opening();
  const run2 = runIntro(second.ctx);
  pointer(second.layer());
  await tick();
  second.ctx.debug.intro.step(7);
  assert.deepEqual(await run2, { played: true, skipped: false });
  assert.ok(!second.calls.includes('music.skipIntro'), second.calls.join(' '));
});

test('if the music throws inside the gesture, the opening still starts, silent, with a warning; no exception escapes', async () => {
  for (const how of ['key', 'click']) {
    const { ctx, calls, layer } = opening({ music: { intro: () => { throw new Error('music broke'); } } });
    const warned = [], { warn } = console;
    console.warn = (...a) => warned.push(a.join(' '));
    try {
      const run = runIntro(ctx);
      if (how === 'key') press('a'); else pointer(layer());
      await tick();
      frame();
      assert.notEqual(ctx.debug.intro.phase, 'gate', how);
      assert.ok(warned.some((w) => w.includes('music broke')), `${how}: ${warned.join(' | ')}`);
      press('b');
      assert.deepEqual(await run, { played: true, skipped: true }, how);
      assert.ok(calls.includes('menu.show'), how);
    } finally { console.warn = warn; }
  }
});

test('the browser\'s own keys skip the opening but keep their default (F5 reloads); the game\'s keys are consumed', async () => {
  assert.ok(browserKey(keyEvent('F5')) && browserKey(keyEvent('F12')) && browserKey(keyEvent('r', { ctrlKey: true })) && browserKey(keyEvent('ArrowLeft', { altKey: true })));
  assert.ok(!browserKey(keyEvent('a')) && !browserKey(keyEvent('Enter')) && !browserKey(keyEvent('Escape')) && !browserKey(keyEvent('F')));
  for (const [key, more, prevented] of [['F5', {}, false], ['r', { ctrlKey: true }, false], ['r', { metaKey: true }, false], ['Enter', {}, true], ['Escape', {}, true]]) {
    const { ctx } = opening();
    const run = runIntro(ctx);
    press('a');
    await tick();
    const e = press(key, more);
    assert.equal(e.defaultPrevented, prevented, `${key} ${JSON.stringify(more)}`);
    assert.equal(e.stopped, true, `${key}: the menu never sees it`);
    assert.deepEqual(await run, { played: true, skipped: true }, key);
  }
});

test('the still version holds the moon at the backdrop\'s moon time 0 all through', async () => {
  const { ctx, moon } = opening();
  const run = runIntro(ctx);
  press('a');
  await tick();
  for (let i = 0; i < 5; i++) ctx.debug.intro.step(1);
  ctx.debug.intro.step(2);
  await run;
  assert.ok(moon.length >= 6 && moon.every((t) => t === 0), moon.join(' '));
});

test('the backdrop prepares its first battle behind the gate\'s black, a slice a frame, and stops when it is ready', async () => {
  const { ctx, backdrop } = opening();
  const run = runIntro(ctx);
  for (let i = 0; i < 6; i++) frame();
  assert.equal(backdrop.prepared, 3);
  assert.equal(ctx.debug.intro.phase, 'gate');
  press('a');
  await tick();
  ctx.debug.intro.skip();
  await run;
});

test('without the opening the music still hears of it: no cue at the first click on the title', async () => {
  for (const query of ['intro=0', 'screen=options', 'backdrop=planet']) {
    const { ctx, calls } = opening({ query: `${query}&` });
    if (query === 'intro=0') ctx.settings.intro = false;
    const out = await runIntro(ctx);
    assert.equal(out.played, false, query);
    assert.deepEqual(calls, ['music.prime', 'music.skipIntro'], query);
  }
});

// ---- the ending ------------------------------------------------------------------------------------------------------------
function ending() {
  const calls = [], tints = [];
  const backdrop = { planet: {}, reduced: false, lend: () => true, drawSpace: (dt, view) => tints.push(view.tint?.amount ?? 0), start: () => calls.push('backdrop.start') };
  const app = new El('div');
  const menu = { hide() {}, show: () => calls.push('menu.show') };
  const music = { mood: (m) => calls.push(`mood:${m}`) };
  const debug = {};
  return { calls, tints, debug, play: () => playEnding({ house: 'ordos', app, backdrop, menu, music, debug }) };
}

test('the ending, skipped in the victor\'s colour, draws the colour back to tan before the backdrop carries on', async () => {
  const e = ending();
  const done = e.play();
  for (let i = 0; i < 20 && !e.debug.ending; i++) await tick();
  e.debug.ending.seek(14);
  assert.equal(e.tints.at(-1), 1, 'all in the victor\'s colour');
  const from = e.tints.length;
  const f5 = press('F5');
  assert.equal(f5.defaultPrevented, false, 'F5 still reloads');
  for (const ms of [200, 400, 600, 900]) frame(ms);
  assert.deepEqual(await done, { played: true, skipped: true });
  const after = e.tints.slice(from);
  assert.ok(after.length >= 4, after.join(' '));
  for (let i = 1; i < after.length; i++) assert.ok(after[i] <= after[i - 1], `the colour comes back: ${after.join(' ')}`);
  assert.ok(after.some((k) => k > 0.2 && k < 0.8), `no snap: ${after.join(' ')}`);
  assert.equal(after.at(-1), 0);
  assert.equal(e.calls.at(-1), 'backdrop.start', e.calls.join(' '));
});
