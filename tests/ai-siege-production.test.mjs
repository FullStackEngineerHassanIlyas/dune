import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrain, updateAI } from '../src/sim/ai.js';
import { UNITS } from '../src/data/units.js';
import { orderRepair } from '../src/sim/structure-actions.js';
import { flatWorld, run } from './helpers.mjs';

function purchase({house='harkonnen',fortified=true,light=2,level=4,seed=1,ix=true}={}) {
  const world=flatWorld(48,48,undefined,seed);
  for(const [t,x,y] of [['constructionYard',2,2],['windtrap',5,2],['windtrap',8,2],['refinery',2,6],['outpost',6,6],['heavyFactory',9,6],['starport',13,6],['ix',17,6]])if(t!=='ix'||ix)world.spawnStructure(t,house,x,y);
  if(fortified)world.spawnStructure('turret','atreides',40,40);
  const h=world.houses.get(house);h.credits=10000;h.upgrades.heavyFactory=level;
  createBrain(world,house,'normal');
  for(let k=0;k<light;k++)world.spawnUnit('quad',house,4+k*2,20);
  for(let k=0;k<3;k++)world.spawnUnit('combatTank',house,10+k*2,20);
  updateAI(world);
  return world.pending.filter(c=>c.command.type==='build').map(c=>c.command.typeId).find(t=>UNITS[t]?.builtAt==='heavyFactory'&&UNITS[t].weapon);
}

test('a fortified opponent prompts ranged siege production without gas-only substitutes',()=>{
  for(let seed=1;seed<=4;seed++) {
    assert.equal(purchase({seed}),'missileTank');
    assert.equal(purchase({house:'ordos',seed}),'siegeTank');
  }
});

test('siege production keeps light escorts and obeys available factory tech',()=>{
  assert.equal(purchase({light:0}),'quad');
  assert.equal(purchase({level:0,ix:false}),'combatTank');
  assert.equal(purchase({level:0,ix:true}),'devastator','IX opens the house tank without missile-level upgrades');
});

test('without hostile fortifications the AI retains a varied heavy vehicle mix',()=>{
  const choices=new Set();for(let seed=1;seed<=8;seed++)choices.add(purchase({seed,fortified:false}));
  assert.ok(choices.size>1);
});

test('a Missile Tank can dismantle a repaired gun turret from beyond its return-fire range',()=>{
  const world=flatWorld(32,32);
  const turret=world.spawnStructure('turret','atreides',18,10);
  const tank=world.spawnUnit('missileTank','harkonnen',10,10);
  world.houses.get('atreides').credits=10000;
  world.issue('harkonnen',{type:'attack',ids:[tank.id],targetKind:'structure',targetId:turret.id});
  for(let k=0;k<60&&world.structures.has(turret.id);k++) {
    orderRepair(world,'atreides',turret.id,true);run(world,1);
  }
  assert.equal(world.structures.has(turret.id),false);
  assert.equal(tank.hp,tank.maxHp,'the counter wins by range, not a hidden damage bonus');
});
