// A mission's end in GameView (C2): once the outcome is set, the result is handed over and never thrown away —
// Esc (or the menu button) during the wait or the fly-over skips to the hand-off, and Quit mission or Restart
// mission at that point hand the result to the menu shell instead of leaving or reloading.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GameView } from '../src/game/game-view.js';
import { setup, razeBase } from './missions-helpers.mjs';
import { runUntil } from './helpers.mjs';

function wonMission() {
  const { world } = setup({ minSeconds: 10 });
  razeBase(world, 'harkonnen', 'atreides');
  assert.ok(runUntil(world, () => world.outcome, 12) >= 0);
  return world;
}

/** A GameView with only what the end of a mission touches. */
function fakeView(world, { handoff = 'flyover', menuOpen = false } = {}) {
  const log = [];
  const v = Object.create(GameView.prototype);
  Object.assign(v, {
    world, house: 'atreides', handoff, missionEndAt: handoff ? 0 : performance.now() + 1500, controller: { mode: null },
    flyover: handoff === 'flyover' ? { dispose: () => log.push('dispose'), update: () => false } : null,
    menu: { isOpen: menuOpen, open() { log.push('menu'); this.isOpen = true; }, close() { if (this.isOpen) { this.isOpen = false; log.push('close'); } }, onKey: () => true },
    endScreen: { show: (stats, o) => log.push(['endScreen', o?.mission?.title]) }, music: { end: () => {} },
  });
  return { v, log };
}

/** Runs fn inside a battle frame of the menu shell; returns what the frame posted to it. */
function inShell(fn) {
  const posted = [], before = globalThis.window;
  globalThis.window = { location: { origin: 'http://localhost', pathname: '/' }, parent: { __duneShell: {}, postMessage: (m) => posted.push(structuredClone(m)) } };
  try { fn(); } finally { if (before === undefined) delete globalThis.window; else globalThis.window = before; }
  return posted;
}

test('in the shell, Esc during the fly-over hands the won mission over at once, and only once', () => {
  const { v, log } = fakeView(wonMission());
  const posted = inShell(() => {
    v.onKey('Escape', 'Escape', {});
    assert.equal(v.finishNow(), false, 'nothing left to skip');
  });
  assert.deepEqual(posted.map((m) => [m.dune, m.won]), [['missionEnd', true]]);
  assert.ok(log.includes('dispose') && !log.includes('menu'), `the fly-over ends, no menu opens (${JSON.stringify(log)})`);
  assert.equal(v.handoff, 'posted');
  assert.equal(v.flyover, null);
});

test('Quit mission or Restart mission while the result is still to come hands it over instead of throwing it away', () => {
  for (const act of ['quit', 'restart']) {
    const { v, log } = fakeView(wonMission(), { handoff: null, menuOpen: true });   // in the 1.5 s before the fly-over
    const posted = inShell(() => v[act]());
    assert.deepEqual(posted.map((m) => [m.dune, m.won]), [['missionEnd', true]], act);
    assert.ok(log.includes('close'), `${act}: the menu closes`);
    assert.equal(v.missionEndAt, 0, `${act}: no fly-over follows`);
  }
});

test('alone, Esc during the fly-over goes straight to the end screen', () => {
  const { v, log } = fakeView(wonMission());
  v.onKey('Escape', 'Escape', {});
  assert.deepEqual(log, ['dispose', ['endScreen', 'Destroy the Harkonnen base']]);
  assert.equal(v.handoff, 'screen');
});

test('before the outcome, or once the result has gone, Quit mission goes back to the campaign as before', () => {
  const { world } = setup();
  const { v } = fakeView(world, { handoff: null });
  assert.deepEqual(inShell(() => v.quit()), [{ dune: 'quit', screen: 'campaign' }]);
  const after = fakeView(wonMission(), { handoff: 'posted' }).v;
  assert.deepEqual(inShell(() => after.quit()), [{ dune: 'quit', screen: 'campaign' }]);
});
