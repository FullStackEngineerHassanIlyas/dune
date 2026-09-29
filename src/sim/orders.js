// Player and AI commands (spec §3). Everything is validated here; the simulation never trusts input.
import { findDestinations } from './destinations.js';
import { orderDeploy } from './deploy.js';
import { orderBuild, orderHold, orderPlace, orderRally, orderPrimary } from './production.js';
import { orderSell, orderRepair } from './structure-actions.js';
import { orderHarvest, orderReturn } from './harvest.js';
import { isArmed, deviatable } from './combat.js';
import { WEAPONS } from '../data/weapons.js';
import { orderRepairAt } from './repair-bay.js';
import { orderCapture } from './capture.js';
import { orderStarport, cancelStarport } from './starport.js';
import { orderDestruct } from './specials.js';
import { orderPalace } from './palace.js';

export function applyCommand(world, houseId, cmd) {
  const units = (Array.isArray(cmd?.ids) ? cmd.ids : []).map((id) => world.units.get(id)).filter((u) => u && u.house === houseId && !u.inside && !u.type.autonomous && u.destructAt === undefined);   // nor do units held in a bay or a Carryall, nor Carryalls, nor a Devastator counting down
  switch (cmd?.type) {
    case 'move': orderMove(world, units, cmd.x, cmd.y); return;
    case 'stop': units.forEach(stopUnit); return;
    case 'guard': units.forEach((u) => { stopUnit(u); u.order = { type: 'guard', x: u.tx, y: u.ty }; }); return;
    case 'scatter': scatter(world, units); return;
    case 'deploy': units.forEach((u) => (u.type.destructs ? orderDestruct(world, u) : orderDeploy(world, u))); return;   // D: Deploy or Destruct (spec §5.6)
    case 'destruct': units.forEach((u) => orderDestruct(world, u)); return;
    case 'build': orderBuild(world, houseId, cmd.typeId, cmd.count ?? 1); return;
    case 'hold': orderHold(world, houseId, cmd.typeId); return;
    case 'place': orderPlace(world, houseId, cmd.typeId, cmd.x, cmd.y); return;
    case 'setRally': orderRally(world, houseId, cmd.structureId, cmd.x, cmd.y); return;
    case 'setPrimary': orderPrimary(world, houseId, cmd.structureId); return;
    case 'sell': orderSell(world, houseId, cmd.structureId); return;
    case 'repair': orderRepair(world, houseId, cmd.structureId, cmd.on); return;
    case 'harvest': orderHarvest(world, units, cmd.x, cmd.y); return;
    case 'returnToBase': orderReturn(world, units); return;
    case 'repairAt': orderRepairAt(world, houseId, units, cmd.structureId); return;
    case 'capture': orderCapture(world, houseId, units, cmd.structureId); return;
    case 'starportOrder': orderStarport(world, houseId, cmd.typeId, cmd.count ?? 1); return;
    case 'starportCancel': cancelStarport(world, houseId, cmd.typeId); return;
    case 'palace': orderPalace(world, houseId, cmd.x, cmd.y); return;
    case 'attack': orderAttack(world, units, cmd); return;
    case 'attackMove': orderAttackMove(world, units, cmd.x, cmd.y); return;
    default: world.events.push('commandRejected', { house: houseId, command: cmd?.type });
  }
}

export function stopUnit(u) {
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.goal = -1;
  u.stuckTicks = 0; u.waitTicks = 0; u.repaths = 0;
  u.order = { type: 'idle' };
  u.loiter = null;
}

export function orderMove(world, units, x, y) {
  const map = world.map;
  if (!units.length || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const tx = Math.max(0, Math.min(map.w - 1, Math.floor(x)));
  const ty = Math.max(0, Math.min(map.h - 1, Math.floor(y)));
  const ground = units.filter((u) => u.isGround), air = units.filter((u) => !u.isGround);
  if (ground.length) {
    const slots = findDestinations(world, map.idx(tx, ty), ground);
    for (const u of ground) {
      u.order = { type: 'move', x: tx, y: ty };
      u.stuckTicks = 0; u.waitTicks = 0; u.repaths = 0;
      world.requestPath(u, slots.get(u.id));
    }
  }
  for (const u of air) { u.order = { type: 'move', x: tx, y: ty }; u.target = null; }   // aircraft fly straight there
  world.events.push('moveOrdered', { ids: units.map((u) => u.id), x: tx, y: ty });
}

function scatter(world, units) {
  const map = world.map;
  for (const u of units) {
    if (!u.isGround) continue;
    const options = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = u.tx + dx, y = u.ty + dy;
      if ((dx || dy) && map.inBounds(x, y)) {
        const i = map.idx(x, y);
        if (!map.unit[i] && map.moveFactor(i, u.move) > 0) options.push(i);
      }
    }
    if (!options.length) continue;
    const goal = options[world.rng.int(options.length)];
    u.order = { type: 'move', x: map.xOf(goal), y: map.yOf(goal) };
    u.stuckTicks = 0; u.waitTicks = 0; u.repaths = 0;
    world.requestPath(u, goal);
  }
}

export function orderAttack(world, units, cmd) {
  const force = cmd.force === true;
  const map = world.map;
  let entity = null, target = null;
  if (cmd.targetKind === 'unit') entity = world.units.get(cmd.targetId) ?? null;
  else if (cmd.targetKind === 'structure') entity = world.structures.get(cmd.targetId) ?? null;
  if (entity) target = { kind: cmd.targetKind, id: entity.id };
  else if (force && Number.isFinite(cmd.x) && Number.isFinite(cmd.y)) {
    target = { kind: 'tile', x: Math.max(0, Math.min(map.w - 1, Math.floor(cmd.x))), y: Math.max(0, Math.min(map.h - 1, Math.floor(cmd.y))) };
  }
  if (!target) return;
  const ids = [];
  for (const u of units) {
    if (!isArmed(u.type) || entity === u) continue;
    if (WEAPONS[u.type.weapon]?.gas && entity && !deviatable(entity)) continue;   // gas is wasted on buildings, Harvesters and MCVs
    if (entity?.kind === 'unit' && !entity.isGround && !u.type.targetAir) continue;   // only anti-air reaches aircraft
    if (entity && entity.house === u.house && !force) continue;
    u.order = { type: 'attack', target: { ...target }, force };
    u.target = null;
    u.chaseAt = 0;
    u.chaseBest = Infinity;
    u.chaseStall = 0;
    ids.push(u.id);
  }
  if (ids.length) world.events.push('attackOrdered', { ids, target });
}

export function orderAttackMove(world, units, x, y) {
  orderMove(world, units, x, y);   // slots, paths and the moveOrdered event
  for (const u of units) {
    if (u.order.type !== 'move' || !isArmed(u.type)) continue;   // unarmed units simply move
    u.order = { type: 'attackMove', x: u.order.x, y: u.order.y, goal: u.goal };
    u.target = null;
  }
}
