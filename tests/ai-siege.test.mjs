import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrain, updateAI } from '../src/sim/ai.js';
import { flatWorld, run } from './helpers.mjs';

function siege(type='combatTank', x=12, y=12) {
  const world=flatWorld(48,48);
  world.spawnStructure('constructionYard','harkonnen',2,2);
  const target=world.spawnStructure('constructionYard','atreides',15,10);
  const tank=world.spawnUnit(type,'harkonnen',x,y);
  tank.order={type:'attackMove',x:16,y:12};
  const h=world.houses.get('harkonnen');h.credits=0;
  const b=createBrain(world,h.id);b.nextAttack=Infinity;b.wave=[tank.id];b.waveFoe[tank.id]='atreides';
  return {world,target,tank,b};
}
const attacks=world=>world.pending.filter(c=>c.command.type==='attack').map(c=>c.command);

test('a wave tank in range commits to an enemy production building despite closer defenders',()=>{
  const {world,target,tank}=siege();
  world.spawnUnit('infantry','atreides',13,12);
  updateAI(world);
  assert.ok(attacks(world).some(c=>c.ids.includes(tank.id)&&c.targetKind==='structure'&&c.targetId===target.id));
  const before=target.hp;run(world,8);
  assert.ok(target.hp<before,'the siege damages infrastructure instead of only engaging the screen');
});

test('siege prefers the Construction Yard over a nearer storage building',()=>{
  const {world,target}=siege();
  world.spawnStructure('silo','atreides',12,14);
  updateAI(world);
  assert.equal(attacks(world)[0]?.targetId,target.id);
});

test('siege does not send distant tanks past defenders or use gas against structures',()=>{
  for(const [type,x,y] of [['combatTank',8,12],['deviator',12,12],['trike',12,12]]) {
    const {world}=siege(type,x,y);updateAI(world);
    assert.equal(attacks(world).length,0,`${type} retains its attack-move`);
  }
});

test('siege keeps to the wave foe instead of a nearer third house',()=>{
  const {world,target}=siege();
  world.spawnStructure('constructionYard','ordos',12,14);
  updateAI(world);
  assert.equal(attacks(world)[0]?.targetId,target.id);
});

test('siege does not override a retreat to repairs',()=>{
  const {world,tank}=siege();
  world.spawnStructure('repair','harkonnen',5,5);tank.hp=tank.maxHp*0.2;
  updateAI(world);
  assert.ok(world.pending.some(c=>c.command.type==='repairAt'&&c.command.ids.includes(tank.id)));
  assert.equal(attacks(world).length,0);
});
