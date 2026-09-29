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
