// The Music Test on the Original Game Files page (src/ui/original-music.js): one row per track with its slots,
// Play/Stop and Remove, built as plain elements the page can put in place; and the Music Test's player, which
// plays a track on a context of its own and has the menu's music make way meanwhile.
import test from 'node:test';
import assert from 'node:assert/strict';

class FakeEl {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.dataset = {}; this.listeners = {}; this.className = ''; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  append(...cs) { this.children.push(...cs); }
  get textContent() { return this.children.map((c) => (typeof c === 'string' ? c : c.textContent)).join(''); }
  all() { return [this, ...this.children.filter((c) => typeof c !== 'string').flatMap((c) => c.all())]; }
  fire(type, e = {}) { for (const fn of this.listeners[type] ?? []) fn({ target: this, ...e }); }
}
globalThis.Node = FakeEl;
globalThis.document = { createElement: (tag) => new FakeEl(tag) };

const { musicSection, MusicTest } = await import('../src/ui/original-music.js');
const { fakeWindow, settle, userVgm } = await import('./music-fakes.mjs');

const TRACKS = [
  { id: 1, name: '01 - Opening.vgm', type: 'audio/x-vgm', lists: ['intro', 'menu'], meta: { title: 'Opening', seconds: 73.5, loopSeconds: 16.1 } },
  { id: 2, name: 'mine.ogg', type: 'audio/ogg', lists: ['credits', 'peace'], meta: { title: 'mine.ogg' } },
];

test('the Music Test lists each track with where it plays, Play and Remove — as elements the page can place', async () => {
  const calls = [];
  const files = { importMusic: async () => ({ files: [] }), assignTrack: async (id, lists) => calls.push(['assign', id, lists]), removeTrack: async (id) => calls.push(['remove', id]) };
  const tester = { id: null, error: { id: 2, text: 'this browser cannot play it' }, play: (id) => calls.push(['play', id]), stop: () => calls.push(['stop']) };
  const act = async (label, fn) => fn();
  const els = musicSection({ state: { musicTracks: TRACKS, musicReport: null }, busy: false, act, picker: () => new FakeEl('input'), test: tester, files });
  assert.ok(els.every((e) => e instanceof FakeEl), 'a flat list of elements (an array in it would show as text)');
  const rows = els.flatMap((e) => e.all()).filter((e) => e.tagName === 'LI');
  assert.equal(rows.length, 2);
  const select = rows[0].all().find((e) => e.tagName === 'SELECT');
  assert.equal(select.all().find((o) => o.tagName === 'OPTION' && 'selected' in o.attrs).textContent, 'Intro, then the title');
  const odd = rows[1].all().find((e) => e.tagName === 'SELECT').all().find((o) => o.tagName === 'OPTION' && 'selected' in o.attrs);
  assert.deepEqual([odd.attrs.value, odd.textContent], ['peace,credits', 'Peace (adaptive music), Credits'], 'slots the list does not offer as one choice still show');
  select.fire('change', { target: { value: 'ingame' } });
  await settle();
  const [play, remove] = rows[0].all().filter((e) => e.tagName === 'BUTTON');
  play.fire('click');
  remove.fire('click');
  await settle();
  assert.deepEqual(calls, [['assign', 1, ['ingame']], ['play', 1], ['remove', 1]]);
  assert.match(rows[1].textContent, /this browser cannot play it/);
  assert.match(rows[0].textContent, /1:14loop 0:16/);
});

test('the Music Test plays a VGM on a context of its own, the menu\'s music making way until it stops', async () => {
  const win = fakeWindow();
  const auditions = [];
  const files = { trackData: async (id) => userVgm(id), audition: (on) => auditions.push(on) };
  const changes = [];
  const player = new MusicTest({ sound: true, volume: 0.6, musicVolume: 0 }, { win, files, onChange: () => changes.push(player.id) });
  await player.play(1);
  await settle(); await settle();
  assert.equal(player.id, 1);
  assert.equal(win.contexts.length, 1);
  assert.equal(player.master.gain.value, 0.6, 'at the Options volume');
  assert.equal(player.out.level, 0.5, 'heard even with the music turned off');
  const node = win.nodes[0];
  assert.deepEqual(node.sent.map((m) => m.cmd), ['vgm', 'play']);
  assert.equal(node.sent[1].passes, 0, 'a track with a loop loops, as in the Sega game\'s music test');
  assert.deepEqual(auditions, [true]);
  node.port.onmessage({ data: { type: 'error', id: 'vgm:1', message: 'no VGM player' } });
  assert.equal(player.id, null);
  assert.match(player.error.text, /VGM player is missing/);
  assert.deepEqual(auditions, [true, false], 'the menu\'s music back');
  await player.play(1);
  await settle(); await settle();
  player.stop();
  assert.ok(win.nodes[1].disconnected, 'stopped: its synth goes');
  assert.equal(win.contexts.length, 1, 'one context for every track heard here');
});
