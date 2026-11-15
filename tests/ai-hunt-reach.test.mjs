import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrain, updateAI } from '../src/sim/ai.js';
import { flatWorld, run } from './helpers.mjs';

function trappedWave() {
 const world=flatWorld(48,48);
 world.spawnStructure('constructionYard','harkonnen',2,2);
 world.spawnStructure('constructionYard','atreides',38,38);
 const u=world.spawnUnit('infantry','harkonnen',8,8);
 for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(dx||dy) world.spawnStructure('wall','harkonnen',8+dx,8+dy);
 world.map.revision++;
 const h=world.houses.get('harkonnen');h.credits=0;
 const b=createBrain(world,h.id);b.nextAttack=Infinity;b.wave=[u.id];b.waveFoe[u.id]='atreides';
 return {world,u,b};
}

test('an unreachable wave member stays idle instead of receiving the same impossible attack move forever',()=>{
 const {world,u}=trappedWave();
 let attempts=0;
 const issue=world.issue.bind(world);world.issue=(house,c)=>{if(c.type==='attackMove'&&c.ids.includes(u.id)) attempts++;issue(house,c);};
 run(world,180);
 assert.equal(u.target,null);
 assert.equal(u.order.type,'idle');
 assert.equal(attempts,0,'no path out: stop reissuing orders after every hunt timer');
});

test('an idle trapped wave member resumes the hunt when an exit opens',()=>{
 const {world,u}=trappedWave();
 run(world,30);
 world.removeStructure(world.structures.get(world.map.structure[world.map.idx(9,8)]));
 run(world,25);
 assert.ok(u.tx>9||u.ty>9,'terrain change lets the wave leave its pocket');
});

test('a trapped leader does not stop reachable members of the same wave',()=>{
 const {world,u,b}=trappedWave();
 const free=world.spawnUnit('combatTank','harkonnen',12,12);
 b.wave.push(free.id);b.waveFoe[free.id]='atreides';
 updateAI(world);
 const ids=world.pending.filter(c=>c.command.type==='attackMove').flatMap(c=>c.command.ids);
 assert.ok(ids.includes(free.id));
 assert.ok(!ids.includes(u.id));
});

test('a wave also stops retrying a unit-blocked exit and retries when that unit clears',()=>{
 const {world,u}=trappedWave();
 world.removeStructure(world.structures.get(world.map.structure[world.map.idx(9,8)]));
 const blocker=world.spawnUnit('combatTank','harkonnen',9,8);blocker.noNudge=true;
 let attempts=0;
 const issue=world.issue.bind(world);world.issue=(house,c)=>{if(c.type==='attackMove'&&c.ids.includes(u.id)) attempts++;issue(house,c);};
 run(world,180);
 assert.ok(attempts<=1,`${attempts} repeated orders while the same unit blocks the only exit`);
 assert.equal(u.order.type,'idle');
 world.removeUnit(blocker); // occupancy changes without a terrain revision
 run(world,30);
 assert.ok(u.tx>9||u.ty>9,'retry when the occupying unit leaves');
});
