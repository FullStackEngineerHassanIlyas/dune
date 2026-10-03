// Helpers for the campaign data tests (scenarios stream): build a mission's world with the real sim APIs, the
// way src/game/mission-setup.js will (generateMap with the sites, addHouse, concrete, spawnStructure, spawnUnit,
// createBrain), and check a definition against contract C1 and the generated map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, plateauHalf } from '../src/sim/mapgen.js';
import { World } from '../src/sim/world.js';
import { createBrain } from '../src/sim/ai.js';
import { applyTechRules, offered, segaUpgrades } from '../src/sim/tech.js';
import { deliverByAir } from '../src/sim/carryall.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { STRUCTURES } from '../src/data/structures.js';
import { UNITS } from '../src/data/units.js';
import { HOUSES } from '../src/data/houses.js';
import { STARPORT } from '../src/data/tuning.js';
import { segaStructureTech, segaUnit } from '../src/data/sega-tech.js';
import { G } from '../src/data/terrain.js';
import { missionDef } from '../src/data/campaign.js';
import { run } from './helpers.mjs';

const ORDERS = ['guard', 'areaGuard', 'ambush', 'hunt'];
const SIDES = ['north', 'east', 'south', 'west'];

/** Every computer house and the player's, with their structures, concrete and units, in the def's order. */
export const allHouses = (def) => [{ id: def.house, player: true, ...def.player }, ...def.houses];

/** A mission's world, built as mission-setup will: the player first, then the computer houses. */
export function buildMissionWorld(def, { brains = true } = {}) {
  const { map, starts } = generateMap(def.map);
  const world = new World({ map, seed: def.map.seed });
  world.visibility = def.visibility;
  world.rules.tech = def.rules.tech;
  world.rules.worms = def.worms;
  world.addHouse(def.house, { credits: def.player.credits, techLevel: def.techLevel });
  for (const h of def.houses) world.addHouse(h.id, { credits: h.credits, ai: true, techLevel: h.techLevel });
  for (const h of allHouses(def)) {
    const house = world.houses.get(h.id);
    Object.assign(house.upgrades, h.upgrades ?? {});
    for (const c of h.concrete) for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) map.concrete[map.idx(x, y)] = house.slot + 1;
  }
  map.concreteRevision++;
  for (const h of allHouses(def)) for (const s of h.structures) world.spawnStructure(s.type, h.id, s.x, s.y);
  const player = def.player.structures[0];
  for (const h of allHouses(def)) {
    for (const u of h.units) {
      const unit = world.spawnUnit(u.type, h.id, u.x, u.y, { heading: u.heading ?? 0 });
      if (u.order === 'hunt') world.issue(h.id, { type: 'attackMove', ids: [unit.id], x: player.x, y: player.y });
      else if (u.order) unit.order = { type: 'guard', x: u.x, y: u.y };   // the sim's guard stands in for areaGuard and ambush here
    }
  }
  world.rules.airDelivery = true;
  applyTechRules(world);
  if (brains) {
    for (const h of def.houses) {
      if (h.ai.passive) continue;
      createBrain(world, h.id, h.ai.difficulty);
      const house = world.houses.get(h.id);
      if (h.ai.buildSpeed) house.buildSpeed = h.ai.buildSpeed;
      if (h.ai.incomeRate) house.incomeRate = h.ai.incomeRate;
      if (h.ai.firstAttack) house.brain.nextAttack = h.ai.firstAttack;
    }
  }
  return { world, starts };
}

function reachableFrom(map, starts, pass) {
  const seen = new Uint8Array(map.w * map.h), queue = [];
  for (const i of starts) if (pass(i)) { seen[i] = 1; queue.push(i); }
  for (let k = 0; k < queue.length; k++) {
    const x = map.xOf(queue[k]), y = map.yOf(queue[k]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const ni = map.idx(nx, ny);
      if (!seen[ni] && pass(ni)) { seen[ni] = 1; queue.push(ni); }
    }
  }
  return seen;
}

/** Every problem with a definition: schema (C1), types and rosters, the Sega ladder, the map. [] when it is sound. */
export function checkMission(def) {
  const bad = [];
  const say = (msg) => bad.push(`${def.id}: ${msg}`);
  const int = (v) => Number.isInteger(v);
  // schema
  if (def.id !== `${def.house}-${def.mission}`) say(`id ${def.id}`);
  if (typeof def.title !== 'string' || !def.title || def.title.length > 60) say(`title ${def.title}`);
  if (!Array.isArray(def.enemies) || !def.enemies.length || def.enemies.some((e) => !HOUSES[e] || e === def.house)) say(`enemies ${def.enemies}`);
  const o = def.objective;
  if (!(o.kind === 'destroy' || ((o.kind === 'quota' || o.kind === 'quotaOrDestroy') && int(o.quota) && o.quota > 0))) say(`objective ${JSON.stringify(o)}`);
  if (def.minSeconds !== 120) say('minSeconds');
  const m = def.map;
  if (!int(m.w) || !int(m.h) || !int(m.seed) || !Array.isArray(m.sites) || !m.sites.length || !int(m.spiceFields) || !int(m.blooms)) say('map fields');
  for (const s of m.sites) if (typeof s.id !== 'string' || !int(s.x) || !int(s.y) || !int(s.r)) say(`site ${JSON.stringify(s)}`);
  if (new Set(m.sites.map((s) => s.id)).size !== m.sites.length) say('site ids repeat');
  if (m.sites[0].id !== 'player') say('the first site is not the player\'s');
  if (def.visibility !== 'shroud') say('visibility');
  if (!['off', 'few', 'many'].includes(def.worms)) say('worms');
  if (def.rules?.tech !== 'sega') say('rules.tech');
  if (def.techLevel !== def.mission) say('techLevel');
  if (!(def.starport === null || (def.starport && typeof def.starport.stock === 'object'))) say('starport');
  if (new Set(def.houses.map((h) => h.id)).size !== def.houses.length || def.houses.some((h) => h.id === def.house)) say('houses repeat');
  if (JSON.stringify(def.houses.map((h) => h.id)) !== JSON.stringify(def.enemies)) say('houses are not the enemies');
  for (const h of def.houses) {
    const a = h.ai;
    if (!['easy', 'normal', 'hard'].includes(a?.difficulty)) say(`${h.id} ai`);
    if (!int(h.credits) || h.credits < 0 || h.techLevel !== def.mission) say(`${h.id} credits or techLevel`);
  }
  // types, rosters, the Sega ladder
  for (const h of allHouses(def)) {
    for (const s of h.structures) {
      if (!STRUCTURES[s.type] || !offered(s.type, h.id) || segaStructureTech(s.type, h.id) === null) say(`${h.id} structure ${s.type}`);
    }
    for (const u of h.units) {
      if (!UNITS[u.type] || !offered(u.type, h.id) || !segaUnit(u.type, h.id)) say(`${h.id} unit ${u.type}`);
      if (h.player ? u.order !== undefined : !ORDERS.includes(u.order)) say(`${h.id} order ${u.order}`);
      if (u.heading !== undefined && !Number.isFinite(u.heading)) say('heading');
    }
    for (const [type, level] of Object.entries(h.upgrades ?? {})) if (!STRUCTURES[type]?.upgrades || !int(level) || level < 1) say(`${h.id} upgrade ${type}`);
  }
  for (const r of def.reinforcements) {
    if (!HOUSES[r.house] || !(r.house === def.house || def.enemies.includes(r.house))) say(`reinforcement house ${r.house}`);
    if (!Array.isArray(r.units) || !r.units.length || r.units.some((t) => !UNITS[t] || !offered(t, r.house) || !segaUnit(t, r.house))) say(`reinforcement units ${r.units}`);
    if (!int(r.at) || r.at < def.minSeconds) say(`reinforcement at ${r.at}`);
    if (!['carryall', 'edge'].includes(r.via) || !(r.to === 'home' || r.to === 'enemy' || (int(r.to?.x) && int(r.to?.y)))) say(`reinforcement via/to ${r.via} ${r.to}`);
    if (r.from !== undefined && !SIDES.includes(r.from)) say(`reinforcement from ${r.from}`);
  }
  for (const [t, k] of Object.entries(def.starport?.stock ?? {})) if (!UNITS[t] || !int(k) || k < 1) say(`starport ${t}`);
  // the map
  const { map, starts } = generateMap(def.map);
  if (map.w !== m.w || map.h !== m.h || starts.length !== m.sites.length) say('generated map');
  const at = new Map();
  for (const h of allHouses(def)) {
    for (const s of h.structures) {
      const t = STRUCTURES[s.type];
      if (!t) continue;
      for (let dy = 0; dy < t.h; dy++) for (let dx = 0; dx < t.w; dx++) {
        const x = s.x + dx, y = s.y + dy;
        if (!map.inBounds(x, y)) { say(`${s.type} outside the map at ${x},${y}`); continue; }
        if (map.ground[map.idx(x, y)] !== G.ROCK) say(`${h.id} ${s.type} off rock at ${x},${y}`);
        if (at.has(`${x},${y}`)) say(`${s.type} overlaps ${at.get(`${x},${y}`)} at ${x},${y}`);
        at.set(`${x},${y}`, `${h.id} ${s.type}`);
        if (!h.concrete.some((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h)) say(`${h.id} ${s.type} without concrete at ${x},${y}`);
      }
    }
    for (const c of h.concrete) for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) {
      if (!map.inBounds(x, y) || map.ground[map.idx(x, y)] !== G.ROCK) say(`${h.id} concrete off rock at ${x},${y}`);
    }
  }
  const occupied = new Set();
  for (const h of allHouses(def)) for (const u of h.units) {
    const key = `${u.x},${u.y}`;
    if (!map.inBounds(u.x, u.y)) { say(`${u.type} outside the map`); continue; }
    if (at.has(key)) say(`${h.id} ${u.type} on ${at.get(key)} at ${key}`);
    if (occupied.has(key)) say(`two units at ${key}`);
    occupied.add(key);
    if (UNITS[u.type] && map.moveFactor(map.idx(u.x, u.y), UNITS[u.type].move) <= 0) say(`${h.id} ${u.type} on impassable ground at ${key}`);
  }
  // tracked vehicles get from the player's start to every site, round the buildings, and to every enemy building
  const blocked = (i) => at.has(`${map.xOf(i)},${map.yOf(i)}`);
  const tracked = (i) => !blocked(i) && map.moveFactor(i, 'tracked') > 0;
  const pu = def.player.units.find((u) => UNITS[u.type].move === 'tracked' || UNITS[u.type].move === 'wheeled') ?? def.player.units[0];
  const seen = reachableFrom(map, [map.idx(pu.x, pu.y)], tracked);
  for (const s of m.sites) {
    let ok = false;
    for (let dy = -2; dy <= 2 && !ok; dy++) for (let dx = -2; dx <= 2 && !ok; dx++) if (map.inBounds(s.x + dx, s.y + dy) && seen[map.idx(s.x + dx, s.y + dy)]) ok = true;
    if (!ok) say(`site ${s.id} out of reach for tracked units`);
  }
  for (const h of allHouses(def)) {
    for (const s of h.structures) {
      const t = STRUCTURES[s.type];
      let ok = false;
      for (let y = s.y - 1; y <= s.y + t.h && !ok; y++) for (let x = s.x - 1; x <= s.x + t.w && !ok; x++) if (map.inBounds(x, y) && seen[map.idx(x, y)]) ok = true;
      if (!ok) say(`${h.id} ${s.type} at ${s.x},${s.y} cannot be reached`);
    }
    for (const u of h.units) {
      const mv = UNITS[u.type].move;
      if ((mv === 'tracked' || mv === 'wheeled') && !seen[map.idx(u.x, u.y)]) say(`${h.id} ${u.type} at ${u.x},${u.y} is shut in`);
    }
  }
  // spice: within reach of the player's site, and of every Refinery
  const spiceNear = (x, y, r) => {
    let n = 0;
    for (let i = 0; i < map.spice.length; i++) if (map.spice[i] && Math.hypot(map.xOf(i) - x, map.yOf(i) - y) <= r) n++;
    return n;
  };
  const ps = m.sites[0];
  if (spiceNear(ps.x, ps.y, ps.r + 8) < 12) say(`little spice near the player: ${spiceNear(ps.x, ps.y, ps.r + 8)}`);
  for (const h of def.houses) for (const s of h.structures) if (s.type === 'refinery' && spiceNear(s.x + 1, s.y + 1, 16) < 8) say(`${h.id} refinery at ${s.x},${s.y} far from spice`);
  return bad;
}

export const DIFFICULTY_RANK = { easy: 0, normal: 1, hard: 2 };

/** The houses holding a base: one entry per site whose plateau carries a computer house's Construction Yard, sorted. */
export const basesOf = (def) => def.map.sites.slice(1).flatMap((site) => {
  const half = plateauHalf(site.r);
  const owner = def.houses.find((h) => h.structures.some((s) => s.type === 'constructionYard' && Math.abs(s.x - site.x) <= half && Math.abs(s.y - site.y) <= half));
  return owner ? [owner.id] : [];
}).sort();

/** { type: count } of a unit list. */
export const countUnits = (units) => units.reduce((o, u) => ({ ...o, [u.type]: (o[u.type] ?? 0) + 1 }), {});

/**
 * The table-driven tests every house file runs. `table[n-1]` is the Mega Drive row (research.md §6) for mission n:
 * { objective, enemies, bases, credits, units }.
 */
export function campaignHouseTests(house, table) {
  const defs = () => Array.from({ length: 9 }, (_, k) => missionDef(house, k + 1));

  test(`${house}: every mission validates against contract C1 and its generated map`, () => {
    for (const def of defs()) assert.deepEqual(checkMission(def), []);
  });

  test(`${house}: objectives, enemies, bases, credits and the start force follow the Mega Drive table`, () => {
    defs().forEach((def, k) => {
      const row = table[k], n = k + 1;
      assert.deepEqual(def.objective, row.objective, `mission ${n} objective`);
      assert.deepEqual(def.enemies, row.enemies, `mission ${n} enemies`);
      assert.deepEqual(basesOf(def), [...row.bases].sort(), `mission ${n} bases`);
      assert.equal(def.player.credits, row.credits, `mission ${n} credits`);
      assert.deepEqual(countUnits(def.player.units), row.units, `mission ${n} start force`);
      assert.deepEqual(def.player.structures.map((s) => s.type), ['constructionYard'], `mission ${n}: a Construction Yard, no MCV`);
      if (n === 1) assert.ok(def.houses[0].units.length >= 6 && !def.houses[0].structures.length, 'mission 1: patrols, no base');
    });
  });

  test(`${house}: maps of 32 tiles for missions 1-2 and 64 from 3, worms from 3, the same map from the same def`, () => {
    for (const def of defs()) {
      const n = def.mission;
      assert.equal(def.map.w, n <= 2 ? 32 : 64);
      assert.equal(def.map.h, def.map.w);
      assert.equal(def.worms, n <= 2 ? 'off' : 'few');
      const a = generateMap(def.map), b = generateMap(missionDef(house, n).map);
      assert.deepEqual(a.map.ground, b.map.ground);
      assert.deepEqual(a.map.spice, b.map.spice);
    }
    assert.deepEqual(missionDef(house, 9).map, missionDef('atreides', 9).map, 'the last battlefield is the same for every house');
  });

  test(`${house}: enemy bases grow with the mission and keep to the Mega Drive ladder`, () => {
    for (const def of defs()) {
      const n = def.mission;
      const types = new Set(def.houses.flatMap((h) => h.structures.map((s) => s.type)));
      const has = (t) => types.has(t);
      assert.equal(has('turret') || has('rocketTurret'), n >= 5, `mission ${n} turrets`);
      assert.equal(has('rocketTurret'), n >= 6, `mission ${n} rocket turrets`);
      assert.equal(has('hiTech') && has('repair'), n >= 5, `mission ${n} Hi-Tech and Repair`);
      assert.equal(has('starport'), n >= 6, `mission ${n} Starport`);
      assert.equal(has('palace'), n >= 8, `mission ${n} Palace`);
      assert.equal(has('heavyFactory'), n >= 3, `mission ${n} vehicle factory`);
      for (const h of def.houses) for (const s of h.structures) assert.ok(segaStructureTech(s.type, h.id) <= n, `mission ${n}: ${h.id} ${s.type} ahead of the ladder`);
      assert.ok(!has('ix') && !has('concrete') && !has('wall'));
      for (const h of def.houses) {
        assert.deepEqual(h.upgrades, segaUpgrades(h.id, n), `mission ${n} ${h.id} factory levels`);
        if (h.structures.length) assert.ok(h.structures.some((s) => s.type === 'refinery') && h.structures.some((s) => s.type === 'windtrap'));
      }
      const sizes = def.houses.map((h) => h.structures.filter((s) => !['turret', 'rocketTurret'].includes(s.type)).length).filter(Boolean);
      if (n >= 3 && n <= 6 && sizes.length === 1) assert.ok(sizes[0] >= [0, 0, 0, 8, 9, 14, 17][n], `mission ${n} base of ${sizes[0]} buildings`);
    }
  });

  test(`${house}: the computer gets harder mission by mission`, () => {
    let last = null;
    for (const def of defs().slice(1)) {
      const ai = def.houses.find((h) => h.structures.length).ai;
      if (last) {
        assert.ok(DIFFICULTY_RANK[ai.difficulty] >= DIFFICULTY_RANK[last.difficulty], `mission ${def.mission} difficulty`);
        assert.ok(ai.firstAttack <= last.firstAttack && ai.attackEvery <= last.attackEvery, `mission ${def.mission} attack timing`);
        assert.ok(ai.buildSpeed >= last.buildSpeed && ai.incomeRate >= last.incomeRate, `mission ${def.mission} economy`);
      }
      last = ai;
    }
    assert.equal(missionDef(house, 1).houses[0].ai.passive, true, 'mission 1 patrols do not build or send waves');
  });

  test(`${house}: reinforcements on the PC timing, the Emperor's Troopers dropping in 4 and 8`, () => {
    for (const def of defs()) {
      const n = def.mission, own = def.reinforcements.filter((r) => r.house === house);
      assert.equal(own.length > 0, n >= 3, `mission ${n} own reinforcements`);
      for (const r of own) assert.ok(r.via === 'carryall' && r.to === 'home');
      assert.equal(def.reinforcements.length > own.length, n >= 3, `mission ${n} enemy reinforcements`);
      const emperor = def.reinforcements.filter((r) => r.house === 'sardaukar' && r.units.every((t) => t === 'troopers'));
      if (n === 4 || n === 8) assert.ok(emperor.some((r) => r.via === 'carryall' && r.to === 'enemy' && r.units.length === 4), `mission ${n} Sardaukar drop`);
      assert.deepEqual(def.reinforcements.map((r) => r.at), [...def.reinforcements.map((r) => r.at)].sort((a, b) => a - b));
    }
    assert.deepEqual(missionDef(house, 4).reinforcements.filter((r) => r.house === house).map((r) => r.at), [720, 1260]);
  });

  test(`${house}: Starport stock from mission 6, only what the house may buy`, () => {
    for (const def of defs()) {
      assert.equal(def.starport !== null, def.mission >= 6);
      for (const t of Object.keys(def.starport?.stock ?? {})) assert.ok(UNITS[t].houses.includes(house) || STARPORT.extra[t]?.includes(house), t);
    }
  });

  test(`${house}: each mission's world builds with the real sim and runs 60 game seconds cleanly`, () => {
    for (const def of defs()) {
      const { world } = buildMissionWorld(def);
      assert.deepEqual(checkInvariants(world), [], `${def.id} at set-up`);
      const r = def.reinforcements.find((x) => x.house === house);
      if (r) for (const t of r.units) deliverByAir(world, house, t, { x: def.player.structures[0].x, y: def.player.structures[0].y + 3 });
      const before = world.units.size;
      run(world, 60);
      assert.deepEqual(checkInvariants(world), [], `${def.id} after a minute`);
      assert.ok([...world.structures.values()].some((s) => s.house === house && s.typeId === 'constructionYard'), `${def.id}: the player's yard stands`);
      if (r) assert.ok(r.units.every((t) => [...world.units.values()].some((u) => u.house === house && u.typeId === t && !u.inside)), `${def.id}: the reinforcements landed`);
      for (const h of def.houses) if (!h.ai.passive) assert.ok(world.houses.get(h.id).brain.commands > 0, `${def.id}: ${h.id} thinks`);
      assert.ok(world.units.size >= before - 12, `${def.id}: no mass loss in a minute`);
    }
  });
}
