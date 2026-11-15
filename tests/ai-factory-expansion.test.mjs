import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrain, updateAI } from '../src/sim/ai.js';
import { STRUCTURES } from '../src/data/structures.js';
import { flatWorld } from './helpers.mjs';

function expansion({credits=20000,busy=true,factories=1,campaign=false,full=false}={}) {
  const world=flatWorld(64,64);
  const types=['constructionYard',...Array(6).fill('windtrap'),...Array(3).fill('refinery'),'outpost','wor',...Array(factories).fill('heavyFactory'),...Array(4).fill('silo'),'repair','hiTech','turret','turret','starport','ix','palace'];
  for(const [k,type] of types.entries()) world.spawnStructure(type,'harkonnen',2+(k%6)*7,2+Math.floor(k/6)*7);
  const h=world.houses.get('harkonnen');h.credits=credits;
  createBrain(world,h.id,'normal',campaign?{firstAttack:300}:null);
  if(busy)h.lines.heavy.current={typeId:'combatTank',state:'building',cost:300,paid:100,progress:0.3};
  if(full)for(let k=0;k<20;k++)world.spawnUnit('combatTank',h.id,k+2,40);
  updateAI(world);
  return world.pending.filter(c=>c.command.type==='build'&&c.command.typeId==='heavyFactory');
}

test('a funded skirmish AI expands its busy vehicle production after completing its base',()=>{
  assert.equal(expansion().length,1);
});

test('vehicle expansion stops at three factories and does not spend scarce money',()=>{
  assert.equal(expansion({factories:3}).length,0);
  assert.equal(expansion({credits:STRUCTURES.heavyFactory.cost-1}).length,0);
});

test('idle factories and a full army do not trigger more factory construction',()=>{
  assert.equal(expansion({busy:false}).length,0);
  assert.equal(expansion({full:true}).length,0);
});

test('campaign AI retains its authored base plan instead of skirmish expansion',()=>{
  assert.equal(expansion({campaign:true}).length,0);
});
