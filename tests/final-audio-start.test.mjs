// A battle in the menu shell's frame starts with its sound (spec §6): the frame may play at once (the player's
// gestures on the menu let it, allow="autoplay"), so the engine opens its context as the battle is built and the
// music's first tune starts with the mission — no click or key of its own needed. Where the browser still holds
// the context, the first gesture lets it run, as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundEngine } from '../src/audio/engine.js';
import { BattleMusic } from '../src/audio/music/music.js';
import { POOLS } from '../src/audio/music/songs/index.js';
import { fakeWindow, fakeStore, settle, plays } from './music-fakes.mjs';

/** A frame's window: Web Audio and a sound worker that is still at work (nothing rendered in the page meanwhile). */
function frameWindow(opts) {
  const win = fakeWindow(opts);
  win.Worker = class { postMessage() {} terminate() {} };
  return win;
}
const gestures = (win) => (win.listeners.pointerdown?.length ?? 0) + (win.listeners.keydown?.length ?? 0);

async function battle(win, { early }) {
  const engine = new SoundEngine({ win, early, originals: null });
  const music = new BattleMusic({ world: { time: 0 }, house: 'atreides', engine, settings: {}, win, importer: fakeStore().importer });
  await music.conductor.ready;
  for (let k = 0; k < 4; k++) { music.frame(); await settle(); }
  return { engine, music };
}

test('in the shell\'s frame a mission starts with its sound: the context runs and the first tune plays, no gesture needed', async () => {
  const win = frameWindow();
  const { engine, music } = await battle(win, { early: true });
  assert.equal(engine.ctx?.state, 'running', 'the context is open from the start');
  assert.equal(gestures(win), 0, 'nothing is left waiting for a gesture');
  const ingame = [...POOLS.peace, ...POOLS.battle];
  assert.equal(plays(win).length, 1, 'one tune');
  assert.ok(ingame.includes(plays(win)[0].id), `an in-game tune (${plays(win)[0].id})`);
  assert.equal(music.debug().context, 'running');
});

test('a battle on its own still waits for the first gesture (browser autoplay rules)', async () => {
  const win = frameWindow();
  const { engine } = await battle(win, { early: false });
  assert.equal(engine.ctx, null);
  assert.equal(plays(win).length, 0);
});

test('where the browser holds the frame\'s context, the first real gesture lets it run, and the music starts then', async () => {
  const win = frameWindow({ suspended: true });
  win.noActivation = true;
  const { engine, music } = await battle(win, { early: true });
  assert.equal(engine.ctx?.state, 'suspended', 'made, but held by the browser');
  assert.ok(gestures(win) > 0, 'the gesture listeners stay');
  assert.equal(engine.play('click'), false, 'no voices taken meanwhile');
  win.noActivation = false;
  for (const fn of [...win.listeners.pointerdown]) fn();
  assert.equal(engine.ctx.state, 'running');
  assert.equal(gestures(win), 0, 'and then they go');
  music.frame();
  await settle();
  assert.ok(plays(win).length >= 1, 'the tune sounds');
});
