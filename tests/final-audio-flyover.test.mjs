// A won mission's end as the Sega game plays it (research §9): the battle's music stops as it is decided, and the
// house's victory theme comes in with the Carryall fly-over — not silence until the results screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GameView } from '../src/game/game-view.js';
import { BattleMusic } from '../src/audio/music/music.js';
import { setup, razeBase } from './missions-helpers.mjs';
import { runUntil } from './helpers.mjs';
import { fakeWindow, fakeEngine, fakeStore, settle, plays } from './music-fakes.mjs';

function wonMission() {
  const { world } = setup({ minSeconds: 10 });
  razeBase(world, 'harkonnen', 'atreides');
  assert.ok(runUntil(world, () => world.outcome, 12) >= 0);
  assert.equal(world.outcome.winner, 'atreides');
  return world;
}

/** A GameView with only what a mission's end touches, and a real BattleMusic on a running context. */
async function endOfMission() {
  const world = wonMission(), win = fakeWindow(), log = [];
  const music = new BattleMusic({ world, house: 'atreides', engine: fakeEngine(win), settings: {}, win, importer: fakeStore().importer });
  await music.conductor.ready;
  for (let k = 0; k < 3; k++) { music.frame(); await settle(); }
  const v = Object.create(GameView.prototype);
  Object.assign(v, {
    world, house: 'atreides', handoff: null, missionEndAt: 0, music, hud: { objective() {} }, heightAt: () => 1,
    r3d: { scene: { add() {}, remove() {} } }, rig: { yaw: 0, distance: 16, target: { x: 16, y: 0, z: 16 } },
    endScreen: { show: () => log.push('endScreen') },
  });
  return { v, music, win, log };
}

test('the house\'s victory theme plays over the Carryall fly-over, and on through the end screen without starting again', async () => {
  const { v, music, win, log } = await endOfMission();
  music.onEvent({ type: 'gameOver', winner: 'atreides' });
  music.frame();
  assert.equal(music.debug().mood, 'over', 'the battle is decided: its music stops');
  v.missionEndAt = 1;
  v.missionFrame(2, 1 / 60);   // "Mission accomplished" has been said: the Carryalls come
  assert.equal(v.handoff, 'flyover');
  music.frame();
  await settle();
  assert.equal(music.debug().mood, 'victory:atreides', 'the fanfare starts with the fly-over');
  assert.equal(plays(win).at(-1).id, 'victory-atreides');
  const n = plays(win).length;
  for (let k = 0; k < 600 && v.handoff === 'flyover'; k++) { v.missionFrame(3 + k, 1 / 60); music.frame(); }
  assert.deepEqual(log, ['endScreen'], 'alone (no shell), the end screen follows the fly-over');
  await settle();
  assert.equal(plays(win).length, n, 'and the fanfare plays on under it: it is not started again');
});

test('a lost mission has no fly-over: the defeat theme waits for the result', async () => {
  const { v, music, win } = await endOfMission();
  v.world.outcome = { ...v.world.outcome, winner: 'harkonnen' };
  const n = plays(win).length;
  v.missionEndAt = 1;
  v.missionFrame(2, 1 / 60);
  assert.equal(v.handoff, 'screen');
  music.frame();
  await settle();
  assert.equal(music.debug().mood, 'defeat:atreides');
  assert.equal(plays(win).length, n + 1);
});
