import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameWatch, PerfMonitor, WATCH } from '../src/ui/perf-monitor.js';
import { DEFAULTS, loadSettings } from '../src/core/settings.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

/** Feeds `seconds` of frames at `fps`; returns the second (of this run) at which the watch first said slow, or -1. */
function play(watch, fps, seconds, active = true) {
  let t = 0;
  for (let i = 0, n = Math.round(seconds * fps); i < n; i++) {
    t += 1 / fps;
    if (watch.frame(1 / fps, active)) return t;
  }
  return -1;
}

test('the spec\'s threshold: under 40 fps, for a sustained stretch', () => {
  assert.equal(WATCH.fps, 40);
  assert.ok(WATCH.seconds >= 10, 'a stretch, not a hiccup');
});

test('a battle that stays under 40 fps is noticed once the start-up and the stretch have passed', () => {
  const w = new FrameWatch();
  const at = play(w, 30, 60);
  assert.ok(at > 0, 'noticed');
  assert.ok(at >= WATCH.startup + WATCH.seconds - 0.1 && at <= WATCH.startup + WATCH.seconds + 1.1, `after ${at.toFixed(1)} s`);
});

test('a smooth battle, or one just above 40 fps, is never flagged', () => {
  assert.equal(play(new FrameWatch(), 60, 120), -1);
  assert.equal(play(new FrameWatch(), 42, 120), -1);
  assert.ok(play(new FrameWatch(), 38, 120) > 0);
});

test('short dips amid smooth play do not count; slow play with the odd smooth second does', () => {
  const dips = new FrameWatch();
  let flagged = false;
  for (let k = 0; k < 12 && !flagged; k++) flagged = play(dips, 60, 8) > 0 || play(dips, 12, 2) > 0;   // 2 slow seconds in every 10
  assert.equal(flagged, false);
  const slow = new FrameWatch();
  flagged = false;
  for (let k = 0; k < 12 && !flagged; k++) flagged = play(slow, 30, 4) > 0 || play(slow, 60, 1) > 0;   // 4 slow seconds in every 5
  assert.equal(flagged, true);
});

test('paused, hidden and loading time is ignored', () => {
  // slow only while paused (the menu open): never flagged
  const paused = new FrameWatch();
  assert.equal(play(paused, 20, 120, false), -1);
  // slow play, a long pause, then slow play again: the seconds before the pause still count, the pause does not
  const w = new FrameWatch();
  assert.equal(play(w, 30, WATCH.startup + 10), -1);
  assert.equal(play(w, 30, 300, false), -1);
  const at = play(w, 30, 60);
  assert.ok(at > 0 && at < WATCH.seconds, `the stretch carries on after the pause (${at.toFixed(1)} s)`);
  // a hidden tab shows up as one huge frame interval: it neither counts as slow nor flags
  const h = new FrameWatch();
  play(h, 60, WATCH.startup + 5);
  assert.equal(h.frame(40, true), false);
  assert.equal(play(h, 60, 60), -1);
});

test('options left unset keep the defaults; set ones (the perfFps and perfSeconds flags) replace them', () => {
  const w = new FrameWatch({ fps: undefined, seconds: undefined });
  assert.equal(w.fps, WATCH.fps);
  assert.equal(w.samples.length, WATCH.seconds);
  const quick = new FrameWatch({ fps: 1000, seconds: 3 });
  const at = play(quick, 60, 30);
  assert.ok(at > WATCH.startup + 2.9 && at < WATCH.startup + 4.1, `${at}`);
});

test('the first seconds of a battle (shaders compiling, textures uploading) are not judged', () => {
  const w = new FrameWatch();
  assert.equal(play(w, 5, WATCH.startup - 0.5), -1);
  assert.equal(w.n, 0, 'no samples taken during start-up');
});

function monitor({ running = 'high', live = true, settings = { ...DEFAULTS }, active = () => true } = {}) {
  const store = memory();
  const shown = [], notes = [], applied = [];
  let answer = null;
  const prompt = { show: (offer, choose) => { shown.push(offer); answer = choose; }, hide: () => { answer = null; } };
  const m = new PerfMonitor({
    settings, storage: store, prompt, active,
    running: () => running,
    apply: live ? (name) => { applied.push(name); running = name; return true; } : null,
    notify: (text) => notes.push(text),
  });
  const slowFor = (seconds) => { for (let i = 0; i < seconds * 30; i++) m.frame(1 / 30); };
  return { m, store, shown, notes, applied, settings, slowFor, answer: (c) => answer(c) };
}

test('the prompt offers the next lower preset; Switch saves it, applies it live and keeps watching', () => {
  const t = monitor();
  t.slowFor(40);
  assert.deepEqual(t.shown, [{ from: 'High', to: 'Medium' }]);
  assert.equal(t.m.state, 'asking');
  t.slowFor(60);
  assert.equal(t.shown.length, 1, 'one prompt at a time');
  t.answer('switch');
  assert.equal(t.settings.quality, 'medium');
  assert.equal(loadSettings(null, t.store).quality, 'medium', 'saved');
  assert.deepEqual(t.applied, ['medium']);
  assert.match(t.notes[0], /Medium/);
  assert.match(t.notes[0], /next battle/, 'says what waits for the next battle (particle budgets)');
  t.slowFor(40);
  assert.deepEqual(t.shown[1], { from: 'Medium', to: 'Low' }, 'still slow on Medium: Low is offered later');
  t.answer('switch');
  t.slowFor(60);
  assert.equal(t.shown.length, 2, 'nothing below Low');
  assert.equal(t.m.state, 'done');
});

test('Switch without a live renderer saves the preset for the next battle and stops asking', () => {
  const t = monitor({ running: 'medium', live: false });
  t.slowFor(40);
  t.answer('switch');
  assert.equal(t.settings.quality, 'low');
  assert.match(t.notes[0], /next battle/);
  t.slowFor(120);
  assert.equal(t.shown.length, 1);
});

test('Not now: no more prompts in this battle, nothing saved', () => {
  const t = monitor();
  t.slowFor(40);
  t.answer('later');
  t.slowFor(200);
  assert.equal(t.shown.length, 1);
  assert.equal(t.settings.quality, DEFAULTS.quality);
  assert.equal(t.store.getItem('dune2-3d.settings'), null);
});

test('Don\'t ask again turns the frame-rate check off for good', () => {
  const t = monitor();
  t.slowFor(40);
  t.answer('never');
  assert.equal(t.settings.perfCheck, false);
  assert.equal(loadSettings(null, t.store).perfCheck, false);
  t.slowFor(200);
  assert.equal(t.shown.length, 1);
});

test('no prompt on Low, with the check turned off, or while the battle is paused', () => {
  const low = monitor({ running: 'low' });
  low.slowFor(120);
  assert.equal(low.shown.length, 0);
  const off = monitor({ settings: { ...DEFAULTS, perfCheck: false } });
  off.slowFor(120);
  assert.equal(off.shown.length, 0);
  const paused = monitor({ active: () => false });
  paused.slowFor(120);
  assert.equal(paused.shown.length, 0);
});

test('the battle ending takes an open prompt away for good: the end screen is never covered, a late click does nothing', () => {
  let over = false, hidden = 0, choose = null;
  const settings = { ...DEFAULTS };
  const m = new PerfMonitor({
    settings, storage: memory(), running: () => 'high', apply: () => true, ended: () => over,
    prompt: { show: (offer, fn) => { choose = fn; }, hide: () => { hidden++; } },
  });
  for (let i = 0; i < 40 * 30; i++) m.frame(1 / 30);
  assert.equal(m.state, 'asking');
  over = true;
  m.frame(1 / 30);
  assert.equal(hidden, 1, 'hidden as the battle ends');
  assert.equal(m.state, 'done');
  choose('switch');
  assert.equal(settings.quality, DEFAULTS.quality, 'a click on a card already gone changes nothing');
  assert.equal(hidden, 1);
});

test('it starts for a battle, but not in a headless browser unless the address asks, nor with the check off', async () => {
  const { startPerfMonitor } = await import('../src/ui/perf-monitor.js');
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const frames = [];
  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  const as = (userAgent) => Object.defineProperty(globalThis, 'navigator', { value: { userAgent, webdriver: false }, configurable: true });
  const view = (settings = { ...DEFAULTS }, r3d = { qualityName: 'high', setQuality() {} }) => ({ settings, r3d, paused: false, world: {} });
  const root = { appendChild() {} };
  try {
    as('Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0');
    const m = startPerfMonitor(view(), { search: '?scene=skirmish', root });
    assert.ok(m, 'a player\'s browser');
    assert.equal(m.running(), 'high', 'judges the preset the renderer runs, not the saved one');
    assert.equal(typeof m.apply, 'function');
    assert.equal(frames.length, 1, 'on its own animation frames');
    assert.equal(m.ended(), false);
    const won = view();
    won.world.outcome = 'win';
    assert.equal(startPerfMonitor(won, { search: '', root }).ended(), true, 'a battle with an outcome has ended');
    assert.equal(startPerfMonitor(view({ ...DEFAULTS, perfCheck: false }), { search: '', root }), null, 'turned off in Options');
    assert.equal(startPerfMonitor(view(undefined, {}), { search: '', root }).apply, null, 'no live switch without setQuality');
    as('Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/140.0');
    assert.equal(startPerfMonitor(view(), { search: '?scene=skirmish', root }), null, 'smoke and e2e runs stay clean');
    const forced = startPerfMonitor(view(), { search: '?scene=skirmish&perfCheck=1&perfFps=1000&perfSeconds=3', root });
    assert.ok(forced, 'perfCheck in the address turns it on');
    assert.equal(forced.watch.fps, 1000);
    assert.equal(forced.watch.samples.length, 3);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'navigator', saved); else delete globalThis.navigator;
    delete globalThis.requestAnimationFrame;
  }
});
