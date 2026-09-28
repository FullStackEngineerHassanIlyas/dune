// MCV deployment: the Construction Yard's 2x2 footprint must cover the MCV's tile. Candidate corners
// follow the original order (own tile, west, north, north-west; OpenDUNE Script_Unit_MCVDeploy).
import { STRUCTURES } from '../data/structures.js';
import { G } from '../data/terrain.js';

export const DEPLOY_OFFSETS = [[0, 0], [-1, 0], [0, -1], [-1, -1]];

export function footprintClear(world, x, y, w, h, ignoreUnit = 0) {
  const map = world.map;
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const fx = x + dx, fy = y + dy;
    if (!map.inBounds(fx, fy)) return false;
    const i = map.idx(fx, fy);
    if (map.structure[i] || !(map.ground[i] === G.ROCK || map.concrete[i])) return false;
    if (map.unit[i] && map.unit[i] !== ignoreUnit) return false;
  }
  return true;
}

export function deploySpot(world, u) {
  const t = STRUCTURES[u.type.deploysTo];
  if (!t) return null;
  for (const [ox, oy] of DEPLOY_OFFSETS) {
    if (footprintClear(world, u.tx + ox, u.ty + oy, t.w, t.h, u.id)) return { x: u.tx + ox, y: u.ty + oy };
  }
  return null;
}

export function tryDeploy(world, u) {
  if (!u.type.deploysTo || !world.units.has(u.id)) return null;
  const spot = u.step ? null : deploySpot(world, u);
  if (!spot) {
    u.order = { type: 'idle' };
    world.events.push('eva', { house: u.house, key: 'cannotDeploy', text: 'Unable to deploy here.' });
    return null;
  }
  world.removeUnit(u, 'deployed');
  const s = world.spawnStructure(u.type.deploysTo, u.house, spot.x, spot.y);
  world.events.push('deployed', { id: s.id, house: u.house, x: spot.x, y: spot.y });
  return s;
}

export function orderDeploy(world, u) {
  if (!u.type.deploysTo) return;
  u.path = []; u.pathIndex = 0; u.goal = -1; u.pathState = 'none';
  u.order = { type: 'deploy' };
  if (!u.step) tryDeploy(world, u);   // otherwise movement finishes the current tile and calls world.onDeploy
}
