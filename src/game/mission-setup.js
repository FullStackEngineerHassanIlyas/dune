// Campaign mission set-up (spec §7; research §2, §6; battle-flow §4, §7): the mission counterpart of
// setupSkirmish. A def (C1, src/data/campaign.js) becomes a world: a fixed map with a rock plateau at every
// site, the houses with their credits, tech level and upgrades, concrete, prebuilt bases (structures before
// units; a Refinery gets its Harvester at the dock rather than by Carryall at t = 0, a prebuilt Palace starts
// charging as the original's did), units with their orders, computer brains with the mission's parameters,
// every computer house allied with every other against the player (as in the original; a house that only drops
// reinforcements joins them, with no base or brain of its own), and the mission's
// objectives and reinforcements on world.mission (game/mission.js). Node-runnable: tests and soaks need no DOM.
import { generateMap } from '../sim/mapgen.js';
import { World } from '../sim/world.js';
import { G } from '../data/terrain.js';
import { UNITS } from '../data/units.js';
import { STRUCTURES } from '../data/structures.js';
import { createBrain } from '../sim/ai.js';
import { updateFog } from '../sim/fog.js';
import { findFreeTile } from '../sim/spawn.js';
import { setAlliances } from '../sim/alliance.js';
import { isArmed } from '../sim/combat.js';
import { createMission, guardOf } from './mission.js';

const VISIBILITY = ['shroud', 'fog', 'revealed'];
const WORMS = ['off', 'few', 'many'];
/** A computer unit's standing order (C1): guard its post, guard a wider area, lie in ambush, or hunt. */
export const UNIT_ORDERS = ['guard', 'areaGuard', 'ambush', 'hunt'];
const SITE_RADIUS = 7;

/** The mission's world: { world, house, def, starts, problems } — problems lists what the def asked for and could not have. */
export function setupMission(def, { seed = null } = {}) {
  const problems = [];
  const mapSeed = Number.isFinite(seed) ? seed : def.map?.seed ?? 1;
  const { map, starts } = missionMap(def, mapSeed);
  const world = new World({ map, seed: mapSeed });
  world.visibility = VISIBILITY.includes(def.visibility) ? def.visibility : 'shroud';
  world.fogOfWar = world.visibility !== 'revealed';
  world.rules.victory = false;   // the mission decides the outcome (game/mission.js)
  world.rules.airDelivery = false;   // the bases stand ready: no Carryall flies a Harvester in at t = 0
  world.rules.worms = WORMS.includes(def.worms) ? def.worms : 'off';
  world.rules.tech = def.rules?.tech ?? null;   // 'sega': the Sega ladder (sim/tech.js)
  const player = def.house, sides = def.houses ?? [];
  const p = def.player ?? {};
  addHouse(world, player, { credits: p.credits ?? 0, techLevel: def.techLevel ?? 9, upgrades: p.upgrades }, problems);
  for (const h of sides) addHouse(world, h.id, { credits: h.credits ?? 0, ai: true, techLevel: h.techLevel ?? def.techLevel ?? 9, upgrades: h.upgrades }, problems);
  // a house named only in the reinforcements (the Sega's Sardaukar drops: no base of their own) joins the computer side
  const dropOnly = [...new Set((def.reinforcements ?? []).map((r) => r.house))].filter((id) => id !== player && !sides.some((h) => h.id === id));
  for (const id of dropOnly) addHouse(world, id, { credits: 0, ai: true, techLevel: def.techLevel ?? 9 }, problems);
  for (const r of def.reinforcements ?? []) for (const t of r.units ?? []) {
    if (!UNITS[t] || UNITS[t].move === 'air') problems.push(`${r.house} reinforcements: ${UNITS[t] ? 'cannot carry' : 'unknown unit'} ${t}`);
  }
  const forces = [{ id: player, ...p }, ...sides];
  for (const f of forces) if (world.houses.has(f.id)) layConcrete(world, f.id, f.concrete ?? []);
  for (const f of forces) if (world.houses.has(f.id)) for (const s of f.structures ?? []) {
    try { world.spawnStructure(s.type, f.id, s.x, s.y); } catch (err) { problems.push(`${f.id} ${s.type} at ${s.x},${s.y}: ${err.message}`); }
  }
  // a prebuilt Refinery's Harvester stands at its dock from the start: nothing to announce
  world.events.items = world.events.items.filter((e) => !(e.type === 'eva' && e.key === 'harvesterDeployed'));
  world.rules.airDelivery = true;   // from now on new Refineries get theirs by Carryall
  const orders = new Map();   // unit id → its standing order, for the mission to keep (hunt, ambush, posts)
  for (const f of forces) if (world.houses.has(f.id)) for (const u of f.units ?? []) {
    const unit = spawnAt(world, f.id, u, problems);
    if (unit && f.id !== player) orders.set(unit.id, giveOrder(unit, u.order ?? 'guard'));
  }
  setAlliances(world, [[...sides.map((h) => h.id), ...dropOnly].filter((id) => world.houses.has(id))]);
  for (const h of sides) if (world.houses.has(h.id)) createBrain(world, h.id, h.ai?.difficulty ?? 'normal', h.ai ?? {});
  world.mission = createMission(world, def, { orders, starts });
  if (world.fogOfWar) updateFog(world);   // shroud from the very first frame
  return { world, house: player, def, starts, problems };
}

function addHouse(world, id, { credits, ai = false, techLevel, upgrades }, problems) {
  if (world.houses.has(id)) { problems.push(`house ${id} twice`); return; }
  try {
    const house = world.addHouse(id, { credits, ai, techLevel });
    Object.assign(house.upgrades, upgrades ?? {});
  } catch (err) { problems.push(err.message); }
}

/** The def's map: generated from its seed with plateaus at its sites (sim/mapgen.js). A generator that does
 *  not know sites yet leaves the corners' plateaus; then the sites get their rock here, so a def still plays. */
function missionMap(def, seed) {
  const m = def.map ?? {}, sites = m.sites ?? [];
  const players = sites.length || 1 + (def.houses?.length ?? 1);
  const { map, starts } = generateMap({ w: m.w ?? 64, h: m.h ?? 64, seed, players, sites, spiceFields: m.spiceFields ?? null, blooms: m.blooms ?? null });
  if (!sites.length || sitesHonoured(map, sites, starts)) return { map, starts };
  for (const s of sites) stampSite(map, s);
  map.spiceRevision++;
  return { map, starts: sites.map((s) => ({ x: s.x, y: s.y })) };
}

function sitesHonoured(map, sites, starts) {
  return starts.length === sites.length && sites.every((s, k) => Math.hypot(starts[k].x - s.x, starts[k].y - s.y) <= 1.5 && map.ground[map.idx(s.x, s.y)] === G.ROCK);
}

/** A round rock plateau at a site, mountains near its rim worn to rock, no spice or bloom on it. */
function stampSite(map, s) {
  const r = s.r ?? SITE_RADIUS;
  for (let dy = -r - 2; dy <= r + 2; dy++) for (let dx = -r - 2; dx <= r + 2; dx++) {
    const x = s.x + dx, y = s.y + dy;
    if (!map.inBounds(x, y)) continue;
    const i = map.idx(x, y), d = Math.hypot(dx, dy);
    if (d <= r) { map.ground[i] = G.ROCK; map.spice[i] = 0; map.bloom[i] = 0; }
    else if (d <= r + 2 && map.ground[i] === G.MOUNTAIN) map.ground[i] = G.ROCK;
  }
}

/** Concrete slabs ({ x, y, w, h }) on the rock they cover. */
function layConcrete(world, houseId, areas) {
  const map = world.map, slot = world.houses.get(houseId).slot + 1;
  let laid = false;
  for (const a of areas) for (let y = a.y; y < a.y + (a.h ?? 1); y++) for (let x = a.x; x < a.x + (a.w ?? 1); x++) {
    if (!map.inBounds(x, y)) continue;
    const i = map.idx(x, y);
    if (map.ground[i] !== G.ROCK) continue;
    map.concrete[i] = slot;
    laid = true;
  }
  if (laid) map.concreteRevision++;
}

/** A unit on its tile, or the nearest free one, facing its heading (the map's centre by default). */
function spawnAt(world, houseId, u, problems) {
  const type = UNITS[u.type];
  if (!type) { problems.push(`${houseId}: unknown unit ${u.type}`); return null; }
  const map = world.map;
  const heading = Number.isFinite(u.heading) ? u.heading : Math.atan2(map.h / 2 - u.y, map.w / 2 - u.x);
  let { x, y } = u;
  const ground = type.move !== 'air';
  if (ground && (!map.inBounds(x, y) || map.unit[map.idx(x, y)] || map.structure[map.idx(x, y)] || map.moveFactor(map.idx(x, y), type.move) <= 0)) {
    const spot = map.inBounds(x, y) ? findFreeTile(world, x, y, type.move, 4, 1) : null;
    if (!spot) { problems.push(`${houseId} ${u.type} at ${u.x},${u.y}: no room`); return null; }
    ({ x, y } = spot);
  }
  try { return world.spawnUnit(u.type, houseId, x, y, { heading }); } catch (err) { problems.push(`${houseId} ${u.type}: ${err.message}`); return null; }
}

/** A computer unit's standing order. Guards hold their post and stay out of the attack waves; an ambush holds its
 *  fire to its weapon's reach until the enemy comes in sight; hunters go after the nearest enemy (game/mission.js). */
function giveOrder(u, order) {
  const kind = UNIT_ORDERS.includes(order) ? order : 'guard';
  if (!isArmed(u.type) || u.harvest || u.type.deploysTo || !u.isGround) return null;   // harvesters harvest, MCVs deploy, aircraft fly
  const post = { x: u.tx, y: u.ty };
  if (kind !== 'hunt') { u.order = { type: 'guard', ...post, ...guardOf(kind) }; u.garrison = true; }
  return { kind, post };
}

/** A small mission of our own (C1 shape) for when src/data/campaign.js has no def: the player's base in the
 *  south-west, two allied computer outposts, every unit order, Carryall and edge reinforcements, worms. */
export function sampleMission(house = 'atreides', n = 3) {
  const rivals = ['atreides', 'harkonnen', 'ordos'].filter((h) => h !== house);
  const [a, b] = rivals, name = (id) => id[0].toUpperCase() + id.slice(1);
  const infantry = (id) => (id === 'harkonnen' ? 'troopers' : 'infantry');
  const light = (id) => (id === 'ordos' ? 'raider' : 'trike');
  return {
    id: `${house}-sample`, house, mission: n, title: `Destroy the ${name(a)} and ${name(b)} outposts`, enemies: [a, b],
    objective: { kind: 'destroy' }, minSeconds: 120,
    map: { w: 56, h: 56, seed: 7, sites: [{ id: house, x: 13, y: 42, r: 8 }, { id: a, x: 42, y: 13, r: 7 }, { id: b, x: 43, y: 42, r: 6 }], spiceFields: 7, blooms: 2 },
    visibility: 'shroud', worms: 'few', rules: { tech: 'sega' }, techLevel: n,
    player: {
      credits: 1500, upgrades: {},
      structures: [{ type: 'constructionYard', x: 11, y: 40 }, { type: 'windtrap', x: 14, y: 40 }, { type: 'refinery', x: 10, y: 43 }, { type: 'windtrap', x: 14, y: 43 }, { type: 'barracks', x: 8, y: 40 }, { type: 'silo', x: 7, y: 43 }],
      units: [{ type: 'combatTank', x: 17, y: 39 }, { type: 'combatTank', x: 18, y: 41 }, { type: 'quad', x: 17, y: 43 }, { type: light(house), x: 16, y: 46 }, { type: infantry(house), x: 13, y: 47 }],
      concrete: [{ x: 11, y: 38, w: 4, h: 2 }],
    },
    houses: [
      { id: a, credits: 600, techLevel: n, ai: { difficulty: 'easy', firstAttack: 360, attackEvery: 240 },
        structures: [{ type: 'constructionYard', x: 41, y: 11 }, { type: 'windtrap', x: 44, y: 11 }, { type: 'refinery', x: 40, y: 14 }, { type: 'barracks', x: 44, y: 14 }, { type: 'turret', x: 39, y: 17 }],
        units: [{ type: 'combatTank', x: 38, y: 19, order: 'guard' }, { type: 'quad', x: 35, y: 15, order: 'areaGuard' }, { type: infantry(a), x: 30, y: 24, order: 'ambush' }, { type: light(a), x: 33, y: 22, order: 'hunt' }],
        concrete: [{ x: 41, y: 9, w: 4, h: 2 }] },
      { id: b, credits: 400, techLevel: n, ai: { difficulty: 'easy', passive: true },
        structures: [{ type: 'constructionYard', x: 42, y: 41 }, { type: 'windtrap', x: 45, y: 41 }, { type: 'silo', x: 42, y: 44 }],
        units: [{ type: 'quad', x: 39, y: 42, order: 'guard' }, { type: infantry(b), x: 40, y: 46, order: 'areaGuard' }] },
    ],
    reinforcements: [
      { house, units: ['combatTank', 'quad'], at: 40, via: 'carryall', to: 'home', from: 'south' },
      { house: a, units: [infantry(a), infantry(a)], at: 90, via: 'carryall', to: 'home' },
      { house, units: [light(house), light(house)], at: 150, via: 'edge', to: 'home', from: 'west' },
    ],
    starport: null,
  };
}
