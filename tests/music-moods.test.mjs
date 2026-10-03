// The menu's moods (contract C6, C7): each screen's music from the player's file in its slot, else the game's own
// track of that role, else the nearest role's; the music already sounding carries on when the next screen's is
// the same; briefing(house) is mood('briefing:<house>').
import test from 'node:test';
import assert from 'node:assert/strict';
import { MenuMusic, Conductor } from '../src/audio/music/music.js';
import { TRACKS } from '../src/audio/music/songs/index.js';
import { fakeWindow, fakeStore, settle, plays, userVgm, userOgg } from './music-fakes.mjs';

/** Every role's FM track (contract C7), standing in for those the score has not written yet. */
const as = (id, like = 'victory') => ({ ...(TRACKS[id] ?? TRACKS[like]), id });
const C7 = Object.fromEntries(['opening', 'houseSelect', 'region', 'finale', 'credits', ...['atreides', 'harkonnen', 'ordos'].flatMap((h) => [`victory-${h}`, `defeat-${h}`])].map((id) => [id, as(id)]));
const FULL = { ...TRACKS, ...C7 };

async function onMenu({ tracks = FULL, store = fakeStore() } = {}) {
  const win = fakeWindow();
  win.document = { hidden: false, addEventListener() {} };
  const music = new MenuMusic({ settings: { sound: true, volume: 0.8 }, win, importer: store.importer, tracks, rng: () => 0 });
  await music.conductor.ready;
  win.listeners.pointerdown[0]();
  music.update();
  await settle();
  return { win, music };
}
const last = (win) => { const p = plays(win).at(-1); return p && [p.id, p.passes]; };

test('every screen has its music: the game\'s own track of each role', async () => {
  const { win, music } = await onMenu();
  const expect = [
    ['houseSelect', 'houseSelect', 0], ['briefing:atreides', 'atreides', 0], ['briefing:harkonnen', 'harkonnen', 0], ['briefing:ordos', 'ordos', 0],
    ['region', 'region', 1], ['victory:atreides', 'victory-atreides', 0], ['victory:harkonnen', 'victory-harkonnen', 0], ['victory:ordos', 'victory-ordos', 0],
    ['defeat:atreides', 'defeat-atreides', 0], ['defeat:harkonnen', 'defeat-harkonnen', 0], ['defeat:ordos', 'defeat-ordos', 0],
    ['finale', 'finale', 0], ['credits', 'credits', 0], ['menu', 'title', 0],
  ];
  for (const [mood, id, passes] of expect) {
    music.mood(mood);
    assert.deepEqual(last(win), [id, passes], mood);
    assert.equal(music.debug().mood, mood);
  }
  assert.equal(expect.find(([m]) => m === 'region')[2], 1, 'the region zoom plays its cue once (about 7 s), then quiet until the battle');
  music.briefing('sardaukar');
  assert.deepEqual(last(win), ['harkonnen', 0], 'briefing(house) still works: the Emperor\'s troops have the Harkonnen theme');
  music.briefing(null);
  assert.deepEqual(last(win), ['title', 0]);
});

test('the player\'s file in a slot comes first; one in two slots carries on from screen to screen', async () => {
  const destiny = userVgm(3, { track: 'Chosen Destiny' }), radnor = userOgg(4, 'radnor.ogg');
  const { win, music } = await onMenu({ store: fakeStore({ houseSelect: [destiny], 'briefing-harkonnen': [radnor], region: [destiny] }) });
  music.mood('houseSelect');
  await settle(); await settle();   // the VGM player is loaded into the worklet first
  assert.deepEqual(last(win), ['vgm:3', 0]);
  music.mood('briefing:harkonnen');
  assert.equal(win.elements.length, 1, 'the Harkonnen Mentat\'s file');
  assert.equal(music.debug().track, 'radnor.ogg');
  music.mood('briefing:ordos');
  assert.deepEqual(last(win), ['ordos', 0], 'no Ordos file: the game\'s own theme');
  music.mood('region');
  music.mood('houseSelect');
  const n = plays(win).length;
  music.mood('region');
  assert.equal(plays(win).length, n, 'the same file for the next screen: it plays on');
});

test('a role the game has no track for falls back on the nearest: the menu, the briefing, the plain victory, the credits', async () => {
  const { win, music } = await onMenu({ tracks: TRACKS });
  assert.deepEqual(last(win), ['title', 0]);
  music.mood('houseSelect');
  assert.equal(plays(win).length, 1, 'no house-selection track yet: the title plays on, not restarted');
  assert.equal(music.debug().from, 'menu');
  music.mood('briefing:ordos');
  music.mood('region');
  assert.deepEqual([last(win), plays(win).length], [['ordos', 0], 2], 'no region cue: the Mentat\'s theme carries on');
  music.mood('victory:ordos');
  assert.deepEqual(last(win), ['victory', 0], 'the plain victory, on under the results');
  music.mood('defeat:atreides');
  assert.deepEqual(last(win), ['defeat', 0]);
  music.mood('finale');
  assert.deepEqual(last(win), ['title', 0], 'no finale nor credits yet: the title');
  assert.equal(music.debug().from, 'menu');
});

test('a mood\'s role, slot and fallback, for every name in the contract', () => {
  const c = new Conductor({ audio: { ctx: null, master: null }, settings: {}, win: null, importer: async () => ({}), tracks: FULL });
  const pick = (mood) => { const r = c.resolve(mood); return r && [r.mood, r.items.join()]; };
  assert.deepEqual(pick('intro'), ['intro', 'opening']);
  assert.deepEqual(pick('briefing:fremen'), ['briefing:fremen', 'atreides']);
  assert.deepEqual(c.role('briefing:mercenary').slot, 'briefing-ordos');
  assert.deepEqual(c.role('victory:sardaukar'), { slot: null, pool: [], near: 'victory' }, 'a house without a theme of its own: the plain victory');
  assert.deepEqual(pick('victory:sardaukar'), ['victory', 'victory']);
  assert.deepEqual(pick('ingame'), ['ingame', 'erg,dawn,lanterns,assault,iron,shieldwall']);
  for (const mood of ['over', null, 'nonsense']) assert.equal(c.resolve(mood), null, `${mood}: silence`);
  c.lists = { peace: [userOgg(1)], ingame: [] };
  assert.deepEqual(c.resolve('ingame').items.map((f) => f.name), ['mine.ogg'], 'no in-game files: the player\'s peace and battle files before ours');
  c.failed.add('#1');
  assert.deepEqual(pick('ingame')[0], 'ingame', 'a file that would not play is left out');
  assert.equal(typeof c.resolve('ingame').items[0], 'string');
});
