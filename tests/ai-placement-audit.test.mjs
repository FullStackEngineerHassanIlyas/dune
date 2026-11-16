import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrain, updateAI } from '../src/sim/ai.js';
import { G } from '../src/data/terrain.js';
import { orderBuild, updateProduction } from '../src/sim/production.js';
import { flatWorld, run } from './helpers.mjs';

test('AI does not spend a build cycle on a structure with no legal footprint',()=>{
 const world=flatWorld(24,24,G.MOUNTAIN);
 const m=world.map;
 for(let y=8;y<10;y++) for(let x=8;x<10;x++) m.ground[m.idx(x,y)]=G.ROCK;
 world.spawnStructure('constructionYard','harkonnen',8,8);
 const h=world.houses.get('harkonnen');h.credits=5000;h.startBuffer=5000;
 createBrain(world,h.id);
 run(world,120);
 const cancelled=world.events.drain().filter(e=>e.type==='productionCancelled');
 assert.equal(cancelled.length,0,'no repeated build/refund loop');
 assert.equal(h.lines.structure.current,null);
 assert.equal(h.credits,5000,'no construction spending');
});

test('AI skips an unplaceable Refinery and starts a useful smaller building',()=>{
 const world=flatWorld(24,24,G.MOUNTAIN),m=world.map;
 for(let y=8;y<10;y++) for(let x=8;x<14;x++) m.ground[m.idx(x,y)]=G.ROCK;
 world.spawnStructure('constructionYard','harkonnen',8,8);
 world.spawnStructure('windtrap','harkonnen',10,8);
 const h=world.houses.get('harkonnen');h.credits=5000;
 createBrain(world,h.id);updateAI(world);
 const build=world.pending.find(c=>c.command.type==='build')?.command.typeId;
 assert.equal(build,'windtrap','2x2 space is useful even when a 3x2 Refinery cannot fit');
});

function blockedReadyBuilding() {
 const world=flatWorld(24,24,G.MOUNTAIN),m=world.map;
 for(let y=8;y<10;y++)for(let x=8;x<12;x++)m.ground[m.idx(x,y)]=G.ROCK;
 world.spawnStructure('constructionYard','harkonnen',8,8);
 const h=world.houses.get('harkonnen');h.credits=5000;h.startBuffer=5000;
 orderBuild(world,h.id,'windtrap');
 for(let k=0;k<2000&&h.lines.structure.current.state!=='ready';k++)updateProduction(world);
 assert.equal(h.lines.structure.current.state,'ready');
 const blocker=world.spawnUnit('combatTank',h.id,10,8);blocker.noNudge=true;
 createBrain(world,h.id);
 return {world,h,blocker};
}

test('a finished AI building waits for temporary traffic instead of refunding and rebuilding',()=>{
 const {world,h,blocker}=blockedReadyBuilding();
 run(world,2);
 assert.equal(h.lines.structure.current?.state,'ready','keep the paid building while the exit clears');
 assert.equal(world.events.drain().filter(e=>e.type==='productionCancelled').length,0);
 world.removeUnit(blocker);run(world,2);
 assert.ok([...world.structures.values()].some(s=>s.house===h.id&&s.typeId==='windtrap'));
});

test('an AI building with a permanently blocked site still refunds after the existing retry window',()=>{
 const {world,h}=blockedReadyBuilding();
 run(world,65);
 assert.equal(world.events.drain().filter(e=>e.type==='productionCancelled').length,1);
 assert.equal(h.lines.structure.current,null);
 assert.ok(Math.abs(h.credits-5000)<1e-6);
});
