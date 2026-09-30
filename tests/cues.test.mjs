import test from 'node:test';
import assert from 'node:assert/strict';
import { cueFor } from '../src/audio/cues.js';

const all = () => true;

test('weapons sound like their weapon; rockets whoosh', () => {
  assert.deepEqual(cueFor({ type: 'fired', weapon: 'cannon', projectile: 'shell', x: 3, y: 4 }, 'atreides', all), { id: 'cannon', x: 3, z: 4 });
  assert.equal(cueFor({ type: 'fired', weapon: 'mg', projectile: 'bullet', x: 0, y: 0 }, 'atreides', all).id, 'mg');
  assert.equal(cueFor({ type: 'fired', weapon: 'trooperRocket', projectile: 'rocket', x: 0, y: 0 }, 'atreides', all).id, 'rocket');
  assert.equal(cueFor({ type: 'impact', projectile: 'rocket', x: 0, y: 0 }, 'atreides', all).id, 'explosionSmall');
  assert.equal(cueFor({ type: 'impact', projectile: 'shell', x: 0, y: 0 }, 'atreides', all).id, 'hit');
  assert.equal(cueFor({ type: 'impact', projectile: 'bullet', x: 0, y: 0 }, 'atreides', all), null);
  assert.equal(cueFor({ type: 'explosion', size: 'large', x: 0, y: 0 }, 'atreides', all).id, 'explosionLarge');
  assert.equal(cueFor({ type: 'unitDestroyed', cause: 'crushed', x: 1, y: 1 }, 'atreides', all).id, 'crush');
});

test('cues respect fog: what the player cannot see is not heard', () => {
  const none = () => false;
  assert.equal(cueFor({ type: 'fired', weapon: 'cannon', projectile: 'shell', x: 3, y: 4 }, 'atreides', none), null);
  assert.equal(cueFor({ type: 'explosion', size: 'medium', x: 0, y: 0 }, 'atreides', none), null);
  assert.equal(cueFor({ type: 'sold', house: 'atreides' }, 'atreides', none).id, 'sell', 'interface sounds are not positional');
});

test('the player hears their own interface, not the enemy\'s', () => {
  assert.equal(cueFor({ type: 'structurePlaced', house: 'atreides', x: 4, y: 4 }, 'atreides', all).id, 'clunk');
  assert.equal(cueFor({ type: 'structurePlaced', house: 'harkonnen', x: 4, y: 4 }, 'atreides', all), null);
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'insufficientFunds' }, 'atreides', all).id, 'error');
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'constructionComplete' }, 'atreides', all).id, 'beep');
  assert.equal(cueFor({ type: 'eva', house: 'harkonnen', key: 'unitLost' }, 'atreides', all), null);
  assert.equal(cueFor({ type: 'productionReady', house: 'atreides' }, 'atreides', all).id, 'ready');
  assert.equal(cueFor({ type: 'repairToggled', house: 'atreides', on: false }, 'atreides', all), null);
  assert.equal(cueFor({ type: 'moveOrdered' }, 'atreides', all), null);
});

test('the repair bay clanks as vehicles roll in and out; a capture thuds for the captor', () => {
  assert.equal(cueFor({ type: 'bayEntered', house: 'atreides', x: 5, y: 5 }, 'atreides', all).id, 'ratchet');
  assert.equal(cueFor({ type: 'unitRepaired', house: 'atreides', x: 5, y: 5 }, 'atreides', all).id, 'clunk');
  assert.equal(cueFor({ type: 'bayEntered', house: 'harkonnen', x: 5, y: 5 }, 'atreides', all), null);
  assert.equal(cueFor({ type: 'structureCaptured', from: 'harkonnen', to: 'atreides', x: 4, y: 4, w: 2, h: 2 }, 'atreides', all).id, 'clunk');
  assert.equal(cueFor({ type: 'structureCaptured', from: 'atreides', to: 'harkonnen', x: 4, y: 4, w: 2, h: 2 }, 'atreides', all), null);
});

test('a Carryall clunks as it picks up and sets down', () => {
  assert.equal(cueFor({ type: 'pickedUp', house: 'atreides', x: 5, y: 5 }, 'atreides', all).id, 'clunk');
  assert.equal(cueFor({ type: 'setDown', house: 'atreides', x: 5, y: 5 }, 'atreides', all).id, 'clunk');
  assert.equal(cueFor({ type: 'setDown', house: 'harkonnen', x: 5, y: 5 }, 'atreides', all), null);
});

test('a sold-out ware or a full Frigate sounds like an error', () => {
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'soldOut' }, 'atreides', all).id, 'error');
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'frigateFull' }, 'atreides', all).id, 'error');
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'frigateArrived' }, 'atreides', all).id, 'beep');
});

test('specials have their own sounds: sonic hum, gas hiss, the Destruct alarm; a weapon not ready buzzes', () => {
  assert.equal(cueFor({ type: 'fired', weapon: 'sonic', projectile: 'sonic', x: 0, y: 0 }, 'atreides', all).id, 'sonic');
  assert.equal(cueFor({ type: 'fired', weapon: 'gasRocket', projectile: 'gas', x: 0, y: 0 }, 'atreides', all).id, 'rocket');
  assert.equal(cueFor({ type: 'fired', weapon: 'deathHand', projectile: 'deathHand', x: 0, y: 0 }, 'atreides', all).id, 'rocket');
  assert.equal(cueFor({ type: 'impact', projectile: 'gas', x: 0, y: 0 }, 'atreides', all).id, 'gas');
  assert.equal(cueFor({ type: 'destructArmed', house: 'harkonnen', x: 0, y: 0 }, 'atreides', all).id, 'alarm');
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'notReady' }, 'atreides', all).id, 'error');
});
