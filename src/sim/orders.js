// Player and AI commands (spec §3). Everything is validated here; the simulation never trusts input.
import { findDestinations } from './destinations.js';
import { orderDeploy } from './deploy.js';

export function applyCommand(world, houseId, cmd) {
  const units = (Array.isArray(cmd?.ids) ? cmd.ids : []).map((id) => world.units.get(id)).filter((u) => u && u.house === houseId);
  switch (cmd?.type) {
    case 'move': orderMove(world, units, cmd.x, cmd.y); return;
    case 'stop': units.forEach(stopUnit); return;
    case 'guard': units.forEach((u) => { stopUnit(u); u.order = { type: 'guard', x: u.tx, y: u.ty }; }); return;
    case 'scatter': scatter(world, units); return;
    case 'deploy': units.forEach((u) => orderDeploy(world, u)); return;
    default: world.events.push('commandRejected', { house: houseId, command: cmd?.type });
  }
}

export function stopUnit(u) {
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.goal = -1;
  u.stuckTicks = 0; u.waitTicks = 0; u.repaths = 0;
  u.order = { type: 'idle' };
}

export function orderMove(world, units, x, y) {
  const map = world.map;
  const ground = units.filter((u) => u.isGround);
  if (!ground.length || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const tx = Math.max(0, Math.min(map.w - 1, Math.floor(x)));
  const ty = Math.max(0, Math.min(map.h - 1, Math.floor(y)));
  const slots = findDestinations(world, map.idx(tx, ty), ground);
  for (const u of ground) {
    u.order = { type: 'move', x: tx, y: ty };
    u.stuckTicks = 0; u.waitTicks = 0; u.repaths = 0;
    world.requestPath(u, slots.get(u.id));
  }
  world.events.push('moveOrdered', { ids: ground.map((u) => u.id), x: tx, y: ty });
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
