import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrain, updateAI } from '../src/sim/ai.js';
import { updateRepairs, REPAIR_COST_FRACTION } from '../src/sim/structure-actions.js';
import { applyCommand } from '../src/sim/orders.js';
import { computePower } from '../src/sim/economy.js';
import { itemCost } from '../src/sim/tech.js';
import { flatWorld } from './helpers.mjs';

function thinkAndApply(world, house) {
  updateAI(world);
  const commands = world.pending.splice(0);
  for (const c of commands) applyCommand(world, c.houseId, c.command);
  return commands.map(c => c.command);
}

test('AI repairs a damaged Wind Trap through paid player repair orders', () => {
  const world = flatWorld();
  const house = world.houses.get('harkonnen');
  house.credits = 1000;
  const trap = world.spawnStructure('windtrap', house.id, 4, 4);
  trap.hp = trap.maxHp / 2;
  createBrain(world, house.id);
  const commands = thinkAndApply(world, house);
  assert.ok(commands.some(c => c.type === 'repair' && c.structureId === trap.id && c.on === true));
  assert.equal(trap.repairing, true);
  const before = house.credits;
  for (let i = 0; i < 240; i++) updateRepairs(world);
  assert.equal(trap.hp, trap.maxHp);
  assert.ok(Math.abs(before - house.credits - trap.type.cost * REPAIR_COST_FRACTION / 2) < 1e-6);
  assert.equal(computePower(world, house.id).produced, -trap.type.power);
});

test('AI repairs neither healthy structures nor unaffordable damage and never toggles active repairs off', () => {
  const world = flatWorld();
  const house = world.houses.get('harkonnen');
  const trap = world.spawnStructure('windtrap', house.id, 4, 4);
  createBrain(world, house.id);
  house.credits = 1000;
  assert.equal(thinkAndApply(world, house).filter(c => c.type === 'repair').length, 0);
  trap.hp /= 2;
  house.credits = 0;
  assert.equal(thinkAndApply(world, house).filter(c => c.type === 'repair').length, 0);
  house.credits = 1000;
  trap.repairing = true;
  assert.equal(thinkAndApply(world, house).filter(c => c.type === 'repair').length, 0);
  assert.equal(trap.repairing, true);
});

test('AI keeps production debts and its reserve available when choosing repairs', () => {
  const world = flatWorld();
  const house = world.houses.get('harkonnen');
  const trap = world.spawnStructure('windtrap', house.id, 4, 4);
  trap.hp = trap.maxHp / 2;
  createBrain(world, house.id);
  house.credits = 1000;
  house.lines.heavy.current = { typeId: 'combatTank', state: 'building', cost: 900, paid: 0 };
  assert.equal(thinkAndApply(world, house).filter(c => c.type === 'repair').length, 0);
});

test('ongoing building repairs remain reserved before campaign production purchases',()=>{
 const world=flatWorld(48,48),h=world.houses.get('atreides');
 h.techRules='sega';h.techLevel=2;
 for(const [t,x,y]of[['constructionYard',2,2],['windtrap',5,2],['windtrap',8,2],['refinery',2,6],['outpost',8,6],['barracks',12,6]])world.spawnStructure(t,h.id,x,y);
 const yard=[...world.structures.values()].find(s=>s.typeId==='constructionYard');
 yard.hp=yard.maxHp/10;yard.repairing=true;
 const repairCost=(1-yard.hp/yard.maxHp)*yard.type.cost*REPAIR_COST_FRACTION;
 const keep=itemCost(h,'refinery');h.credits=keep+itemCost(h,'windtrap')+200;
 createBrain(world,h.id);
 const commands=thinkAndApply(world,h);
 const committed=commands.filter(c=>c.type==='build').reduce((n,c)=>n+itemCost(h,c.typeId),0);
 assert.ok(committed<=h.credits-keep-repairCost,`committed ${committed}, spare after ongoing repair ${h.credits-keep-repairCost}`);
});
