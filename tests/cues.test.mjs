import test from 'node:test';
import assert from 'node:assert/strict';
import { cueFor } from '../src/audio/cues.js';

const all = () => true;

test('weapons sound like their weapon; rockets whoosh', () => {
  assert.deepEqual(cueFor({ type: 'fired', weapon: 'cannon', projectile: 'shell', x: 3, y: 4 }, 'atreides', all), { id: 'cannon', x: 3, z: 4 });
  assert.equal(cueFor({ type: 'fired', weapon: 'mg', projectile: 'bullet', x: 0, y: 0 }, 'atreides', all).id, 'mg');
  assert.equal(cueFor({ type: 'fired', weapon: 'trooperRocket', projectile: 'rocket', x: 0, y: 0 }, 'atreides', all).id, 'rocket');
  assert.equal(cueFor({ type: 'impact', projectile: 'rocket', x: 0, y: 0 }, 'atreides', all).id, 'explosionSmall');
  assert.equal(cueFor({ type: 'impact', projectile: 'shell', hit: true, x: 0, y: 0 }, 'atreides', all).id, 'hit');
  assert.equal(cueFor({ type: 'impact', projectile: 'shell', hit: false, x: 0, y: 0 }, 'atreides', all).id, 'sandHit', 'a miss thumps into the sand');
  assert.equal(cueFor({ type: 'impact', projectile: 'bullet', x: 0, y: 0 }, 'atreides', all), null, 'a bullet that misses is lost in the gunfire');
  assert.equal(cueFor({ type: 'impact', projectile: 'bullet', hit: true, x: 0, y: 0 }, 'atreides', all).id, 'bulletHit');
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
  assert.equal(cueFor({ type: 'fired', weapon: 'deathHand', projectile: 'deathHand', x: 0, y: 0 }, 'atreides', all).id, 'launchHeavy');
  assert.equal(cueFor({ type: 'deathHandBlast', house: 'harkonnen', x: 0, y: 0 }, 'atreides', all).id, 'explosionHuge');
  assert.equal(cueFor({ type: 'impact', projectile: 'gas', x: 0, y: 0 }, 'atreides', all).id, 'gas');
  assert.equal(cueFor({ type: 'destructArmed', house: 'harkonnen', x: 0, y: 0 }, 'atreides', all).id, 'alarm');
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'notReady' }, 'atreides', all).id, 'error');
});

test('destruction has its aftermath: debris after a vehicle, a collapse after a structure', () => {
  assert.equal(cueFor({ type: 'unitDestroyed', typeId: 'combatTank', cause: 'shot', x: 1, y: 1 }, 'atreides', all).id, 'debris');
  assert.equal(cueFor({ type: 'unitDestroyed', typeId: 'ornithopter', cause: 'shot', x: 1, y: 1 }, 'atreides', all).id, 'debris');
  assert.equal(cueFor({ type: 'unitDestroyed', typeId: 'soldier', cause: 'shot', x: 1, y: 1 }, 'atreides', all), null, 'a soldier leaves no wreck');
  assert.equal(cueFor({ type: 'unitDestroyed', typeId: 'soldier', cause: 'crushed', x: 1, y: 1 }, 'atreides', all).id, 'crush');
  assert.deepEqual(cueFor({ type: 'structureDestroyed', typeId: 'windtrap', x: 4, y: 6, w: 2, h: 2 }, 'atreides', all), { id: 'collapse', x: 5, z: 7 });
  assert.equal(cueFor({ type: 'structureDestroyed', x: 4, y: 6, w: 2, h: 2 }, 'atreides', () => false), null, 'unseen, unheard');
});

test('the base at work: slabs laid, a Frigate landing, a Harvester unloading where it docks', () => {
  assert.deepEqual(cueFor({ type: 'concretePlaced', house: 'atreides', x: 2, y: 2, w: 2, h: 2 }, 'atreides', all), { id: 'slab', x: 3, z: 3 });
  assert.equal(cueFor({ type: 'concretePlaced', house: 'ordos', x: 2, y: 2, w: 2, h: 2 }, 'atreides', all), null);
  assert.equal(cueFor({ type: 'frigateLanded', house: 'atreides', x: 9, y: 9 }, 'atreides', all).id, 'jet');
  assert.equal(cueFor({ type: 'docked', id: 7, refinery: 3, x: 5, y: 6 }, 'atreides', all).id, 'harvesterUnload');
  assert.equal(cueFor({ type: 'docked', id: 7, refinery: 3 }, 'atreides', all), null, 'without a place it stays silent');
});
