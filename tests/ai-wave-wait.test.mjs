import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrain, updateAI, DIFFICULTY } from '../src/sim/ai.js';
import { flatWorld } from './helpers.mjs';

function lateWave() {
  const world = flatWorld(64,64);
  world.spawnStructure('constructionYard','harkonnen',3,3);
  world.spawnStructure('constructionYard','atreides',50,50);
  world.houses.get('harkonnen').credits = 0;
  const brain = createBrain(world,'harkonnen','normal');
  brain.waves = 9;
  brain.nextAttack = 0;
  const units = Array.from({length:7},(_,k)=>world.spawnUnit('combatTank','harkonnen',5+k,10));
  return {world,brain,units};
}

test('an undersized late wave waits one wave interval then attacks with available fighters',()=>{
  const {world,brain,units}=lateWave();
  for(let t=0;t<=DIFFICULTY.normal.waveEvery+15;t++) {
    world.time=t; updateAI(world);
    if(t<DIFFICULTY.normal.waveEvery) assert.equal(brain.waves,9,'no premature small wave');
    world.pending=[];
  }
  assert.equal(brain.waves,10,'seven ready tanks must not wait forever for fourteen');
  assert.deepEqual(brain.wave,units.map(u=>u.id));
});

test('passive missions never launch a fallback wave',()=>{
  const {world,brain}=lateWave();
  brain.nextAttack=Infinity;
  for(let t=0;t<=900;t+=15) {world.time=t;updateAI(world);world.pending=[];}
  assert.equal(brain.waves,9);
});

test('a full late wave launches immediately when its normal timer is due',()=>{
  const {world,brain}=lateWave();
  for(let k=0;k<7;k++) world.spawnUnit('combatTank','harkonnen',5+k,12);
  updateAI(world);
  assert.equal(brain.waves,10);
  assert.equal(brain.wave.length,14);
});
