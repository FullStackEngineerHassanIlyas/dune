// A won mission's end as the Sega game plays it (research §9): the battle's music stops as it is decided, and the
// house's victory theme comes in with the Carryall fly-over — not silence until the results screen — and in the menu
// shell it plays on, one fanfare, through the win picture, the Mentat and the score.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GameView } from '../src/game/game-view.js';
import { BattleMusic, MenuMusic } from '../src/audio/music/music.js';
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

// ——— in the menu shell: one fanfare from the fly-over through the results ———

/** The menu shell's music as a battle opens in its frame: the title after the player's click, then resting behind the frame. */
async function shellMusic() {
  const win = fakeWindow();
  win.document = { hidden: false, addEventListener() {} };
  const music = new MenuMusic({ settings: { sound: true, volume: 0.8 }, win, importer: fakeStore().importer });
  await music.conductor.ready;
  win.listeners.pointerdown[0]();
  music.update();
  await settle();
  music.leave();
  win.flush();
  assert.equal(music.audio.ctx.state, 'suspended', 'resting behind the battle');
  return { music, win };
}

/**
 * Runs fn as the battle in the menu shell's frame, then hands what it posted to the shell as scenes/menu.js does:
 * 'fanfare' to the menu's music; 'missionEnd' to the campaign, which closes the frame on its results
 * (shell.quit('campaign-results'): music.enter({ carry: true })) and asks for their mood.
 */
function asFrame(fn, shell) {
  const posted = [], before = globalThis.window;
  globalThis.window = { location: { origin: 'http://localhost', pathname: '/' }, parent: { __duneShell: {}, postMessage: (m) => posted.push(structuredClone(m)) } };
  try { fn(); } finally { if (before === undefined) delete globalThis.window; else globalThis.window = before; }
  for (const m of posted) {
    if (m.dune === 'fanfare') shell.music.fanfare(m.house, { held: m.held });
    else if (m.dune === 'missionEnd') { shell.music.enter({ carry: true }); shell.music.mood(`victory:${m.house}`); }
  }
  return posted;
}
const victories = (win) => plays(win).filter((p) => p.id === 'victory-atreides').length;

test('in the menu shell the fanfare starts once, over the Carryalls, and plays on through the victory card, the Mentat and the score', async () => {
  const shell = await shellMusic();
  const { v, music, win } = await endOfMission();
  music.onEvent({ type: 'gameOver', winner: 'atreides' });
  music.frame();
  v.missionEndAt = 1;
  const posted = asFrame(() => v.missionFrame(2, 1 / 60), shell);
  assert.deepEqual(posted.map((m) => m.dune), ['fanfare'], 'the Carryalls come: the shell is asked for the fanfare');
  music.frame();
  await settle();
  assert.equal(victories(win), 0, 'the battle does not play it itself: its frame is about to close');
  assert.equal(victories(shell.win), 1, 'the menu\'s music plays it');
  assert.equal(shell.music.audio.ctx.state, 'running', 'awake behind the frame for it');
  for (let k = 0; k < 600 && v.handoff === 'flyover'; k++) asFrame(() => { v.missionFrame(3 + k, 1 / 60); music.frame(); }, shell);
  assert.equal(v.handoff, 'posted', 'the result went to the shell');
  await settle();
  const titles = () => plays(shell.win).filter((p) => p.id === 'title').length, before = titles();
  for (const part of ['victory card', 'Mentat', 'score']) {
    shell.music.duck(part === 'Mentat');   // the Mentat's words: the music steps back under them
    shell.music.mood('victory:atreides');
    assert.equal(victories(shell.win), 1, `${part}: the same fanfare plays on, not started again`);
  }
  shell.music.duck(false);
  assert.equal(titles(), before, 'the title never cut in');
  assert.equal(shell.music.debug().track, 'victory-atreides');
  assert.equal(shell.music.audio.ctx.state, 'running');
  assert.equal(victories(win), 0);
});

test('in the shell the fanfare rests while the battle is paused or muted, as the battle\'s own music would', async () => {
  const shell = await shellMusic();
  const { v, music } = await endOfMission();
  music.onEvent({ type: 'gameOver', winner: 'atreides' });
  v.sound = { muted: false };
  v.missionEndAt = 1;
  asFrame(() => v.missionFrame(2, 1 / 60), shell);
  assert.equal(shell.music.audio.ctx.state, 'running');
  v.paused = true;   // P
  asFrame(() => v.missionFrame(3, 0), shell);
  assert.equal(shell.music.audio.ctx.state, 'suspended', 'paused: it rests');
  v.paused = false;
  v.sound.muted = true;   // M
  asFrame(() => v.missionFrame(4, 1 / 60), shell);
  assert.equal(shell.music.audio.ctx.state, 'suspended', 'muted: it rests');
  v.sound.muted = false;
  const posted = asFrame(() => v.missionFrame(5, 1 / 60), shell);
  assert.equal(shell.music.audio.ctx.state, 'running', 'and plays on with the battle');
  assert.equal(posted.length, 1, 'one word per change, not one a frame');
  assert.equal(asFrame(() => v.missionFrame(6, 1 / 60), shell).length, 0);
});

test('back from a battle with no fanfare to carry on, or to another screen, the menu\'s music starts the title again', async () => {
  const shell = await shellMusic();
  shell.music.enter({ carry: true });   // the result handed over before the Carryalls came (Esc): nothing to carry on
  assert.equal(plays(shell.win).at(-1).id, 'title');
  const other = await shellMusic();
  other.music.fanfare('atreides');
  other.music.enter();   // a result the campaign could not read: back to its hub, not its results
  assert.equal(plays(other.win).at(-1).id, 'title', 'the fanfare does not loop on under the hub');
});
