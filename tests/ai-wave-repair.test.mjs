import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrain, updateAI } from '../src/sim/ai.js';
import { applyCommand } from '../src/sim/orders.js';
import { flatWorld } from './helpers.mjs';

test('a wave never overrides a repair order issued in the same AI turn',()=>{
 const w=flatWorld(64,64);
 w.spawnStructure('constructionYard','harkonnen',2,2);
 const bay=w.spawnStructure('repair','harkonnen',6,2);
 w.spawnStructure('constructionYard','atreides',50,50);
 const h=w.houses.get('harkonnen');h.credits=0;
 const worn=w.spawnUnit('combatTank',h.id,6,10);worn.hp=worn.maxHp/4;
 const healthy=Array.from({length:5},(_,k)=>w.spawnUnit('combatTank',h.id,8+k*2,10));
 const b=createBrain(w,h.id,'hard');b.nextAttack=0;
 updateAI(w);
 const commands=w.pending.splice(0);
 assert.ok(commands.some(c=>c.command.type==='repairAt'&&c.command.ids.includes(worn.id)));
 for(const c of commands)applyCommand(w,c.houseId,c.command);
 assert.equal(worn.order.type,'repairAt','the later attackMove must not cancel treatment');
 assert.equal(worn.order.structureId,bay.id);
 assert.ok(!b.wave.includes(worn.id));
 assert.deepEqual(b.wave,healthy.map(u=>u.id));
});
