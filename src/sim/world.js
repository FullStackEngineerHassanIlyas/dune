// The simulation world: map, houses, entities and the fixed-step update (spec §3).
import { Rng, hashString } from '../core/rng.js';
import { EventQueue } from '../core/events.js';
import { STRUCTURES } from '../data/structures.js';
import { MOVE } from '../data/units.js';
import { DT, AIR } from '../data/tuning.js';
import { PathFinder } from './pathfind.js';
import { Reachability } from './reach.js';
import { House } from './house.js';
import { createUnit } from './unit.js';
import { createStructure, footprint } from './structure.js';
import { updateMovement } from './movement.js';
import { applyCommand } from './orders.js';
import { tryDeploy } from './deploy.js';
import { updatePower, revokeStartBuffer } from './economy.js';
import { updateProduction, revalidateProduction } from './production.js';
import { updateRepairs } from './structure-actions.js';
import { initHarvester, updateHarvester, updateRefineries, spawnFreeHarvester, ensureHarvesters, HARVESTER_CHECK } from './harvest.js';
import { updateFog } from './fog.js';
import { updateCombat, updateProjectiles, killUnit, retaliate } from './combat.js';
import { aftermathOfUnit, aftermathOfStructure } from './aftermath.js';
import { updateVictory } from './victory.js';
import { updateAI } from './ai.js';
import { alertDamage, alertUnitKilled, alertStructureKilled } from './announce.js';
import { updateRepairOrder, updateRepairBays, emptyBay } from './repair-bay.js';
import { updateCapture } from './capture.js';
import { updateAircraft } from './air.js';
import { updateStarports } from './starport.js';
import { deviate, updateDeviations, destruct, updateSabotage } from './specials.js';
import { armPalace, updatePalaces, deathHandBlast, updateHunters } from './palace.js';
import { initWorm, updateWorm, updateWorms } from './worm.js';
import { bloomStep, eruptBloom, updateBlooms } from './bloom.js';

export class World {
  constructor({ map, seed = 1 }) {
    this.map = map;
    this.rng = new Rng(seed);
    this.wildRng = new Rng(seed ^ hashString('shai-hulud'));   // worms and blooms (sim/worm.js): their own dice, so they never reshuffle the rest
    this.tick = 0;
    this.fogOfWar = true;    // false reveals everything
    this.visibility = 'fog';   // 'shroud' (Dune II), 'fog' (C&C-style fog of war) or 'revealed' (sim/fog.js); skirmishes start in 'shroud'
    // Skirmish and campaign switch victory checks and Carryall deliveries on and set the worms ('off', 'few' or
    // 'many'; sim/worm.js reads a missing setting as 'few'). A bare world — tests, showcases — has none.
    this.rules = { victory: false, airDelivery: false, worms: 'off' };
    this.outcome = null;
    this.mission = null;   // a campaign mission's objectives and reinforcements (game/mission.js): update(world) every 5 ticks
    this.teams = null;     // who is allied with whom (sim/alliance.js); null: a free-for-all
    this.time = 0;
    this.houses = new Map();
    this.units = new Map();
    this.structures = new Map();
    this.projectiles = new Map();
    this.nextProjectileId = 1;
    this.nextId = 1;
    this.events = new EventQueue();
    this.pending = [];
    this.pathfinder = new PathFinder(map);
    this.reach = new Reachability(map);
    this.pathQueue = [];
    this.pathNodeBudget = 6000;    // A* expansions per tick across all units (~8 ms on the target laptop)
    this.pathSearchCap = 10000;    // expansions for any single search; longer ones return a partial path
    this.onDeploy = (u) => tryDeploy(this, u);
    this.bloomRevision = 0;        // bumps whenever a bloom mound bursts or grows (render/bloom-views.js)
    this.onTileEntered = (u) => bloomStep(this, u);   // a ground unit driving onto a bloom sets it off
    this.onBloomHit = (i, by) => eruptBloom(this, i, by);   // so does a shot landing on one
    this.onStructurePlaced = (s) => {
      if (s.type.storage) revokeStartBuffer(this, this.houses.get(s.house));
      if (s.typeId === 'refinery') spawnFreeHarvester(this, s);
      if (s.typeId === 'palace') armPalace(this, s);
    };
    this.onUnitKilled = (u, attacker, cause) => {   // swallowed whole by a worm: no wreck, no blast, no spilled spice; a worm sinks
      if (cause !== 'eaten' && u.move !== MOVE.WORM) aftermathOfUnit(this, u, attacker);
      alertUnitKilled(this, u, attacker);
    };
    this.onStructureKilled = (s, attacker) => { emptyBay(this, s, 'destroyed', attacker); aftermathOfStructure(this, s); alertStructureKilled(this, s, attacker); };
    this.onCrush = (tank, victim) => killUnit(this, victim, { house: tank.house, id: tank.id, kind: 'unit' }, 'crushed');
    this.onGas = (p) => deviate(this, p);
    this.onDeathHand = (p) => deathHandBlast(this, p);
    this.onDamaged = (victim, attacker) => { retaliate(this, victim, attacker); alertDamage(this, victim, attacker); };
  }

  addHouse(id, opts = {}) {
    const house = new House(id, this.houses.size, opts);
    this.houses.set(id, house);
    return house;
  }

  spawnUnit(typeId, houseId, x, y, opts = {}) {
    if (!this.map.inBounds(x, y)) throw new Error(`spawn outside the map at ${x},${y}`);
    const unit = createUnit(this.nextId++, typeId, houseId, x, y, opts);
    if (opts.inside) unit.inside = opts.inside;   // born in a Carryall's claws (a delivery)
    else if (unit.move === MOVE.WORM) initWorm(unit);   // under the sand: a worm holds no tile
    else if (unit.isGround) {
      const i = this.map.idx(x, y);
      if (this.map.unit[i] || this.map.structure[i]) throw new Error(`tile ${x},${y} is taken`);
      this.map.unit[i] = unit.id;
    }
    if (!unit.isGround) unit.alt = opts.alt ?? AIR.cruise;
    if (unit.typeId === 'harvester') initHarvester(unit);
    this.units.set(unit.id, unit);
    this.events.push('unitSpawned', { id: unit.id, house: houseId, unitType: typeId });
    return unit;
  }

  spawnStructure(typeId, houseId, x, y, opts = {}) {
    const t = STRUCTURES[typeId];
    if (!t) throw new Error(`unknown structure type ${typeId}`);
    for (const [fx, fy] of footprint(x, y, t.w, t.h)) {
      if (!this.map.inBounds(fx, fy) || this.map.structure[this.map.idx(fx, fy)]) throw new Error(`cannot place ${typeId} at ${x},${y}`);
    }
    const s = createStructure(this.nextId++, typeId, houseId, x, y, opts);
    s.placedAt = this.tick;
    for (const [fx, fy] of footprint(x, y, t.w, t.h)) {
      const i = this.map.idx(fx, fy);
      this.map.structure[i] = s.id;
      if (t.isWall) this.map.wall[i] = 1;
    }
    this.map.revision++;
    this.structures.set(s.id, s);
    this.events.push('structurePlaced', { id: s.id, house: houseId, structureType: typeId, x, y });
    this.onStructurePlaced?.(s);
    return s;
  }

  removeUnit(u, reason = 'removed') {
    if (!this.units.has(u.id)) return;
    const m = this.map;
    for (const i of [m.idx(u.tx, u.ty), u.step?.from, u.step?.to]) if (i !== undefined && m.unit[i] === u.id) m.unit[i] = 0;
    this.units.delete(u.id);
    this.events.push('unitRemoved', { id: u.id, reason });
  }

  removeStructure(s, reason = 'removed') {
    if (!this.structures.has(s.id)) return;
    for (const [fx, fy] of footprint(s.x, s.y, s.w, s.h)) {
      const i = this.map.idx(fx, fy);
      if (this.map.structure[i] === s.id) { this.map.structure[i] = 0; this.map.wall[i] = 0; }
    }
    this.map.revision++;
    this.structures.delete(s.id);
    this.events.push('structureRemoved', { id: s.id, reason });
  }

  issue(houseId, command) { this.pending.push({ houseId, command }); }

  step() {
    const commands = this.pending;
    this.pending = [];
    for (const { houseId, command } of commands) applyCommand(this, houseId, command);
    this.processPathQueue();
    for (const u of this.units.values()) { u.px = u.x; u.py = u.y; u.pheading = u.heading; u.pturret = u.turret; u.pdistance = u.distance; }
    for (const u of [...this.units.values()]) {
      if (!this.units.has(u.id) || u.inside) continue;   // a vehicle in a repair bay or a refinery's slot is moved by the building
      if (u.move === MOVE.WORM) { updateWorm(this, u); continue; }
      if (!u.isGround) { updateAircraft(this, u); continue; }
      if (u.destructAt !== undefined && this.time >= u.destructAt) { destruct(this, u); continue; }
      if (u.harvest) updateHarvester(this, u);
      if (u.order.type === 'repairAt') updateRepairOrder(this, u);
      if (u.order.type === 'capture') { updateCapture(this, u); if (!this.units.has(u.id)) continue; }   // a squad that walked in is gone
      if (u.order.type === 'sabotage') { updateSabotage(this, u); if (!this.units.has(u.id)) continue; }   // a Saboteur that went off is gone
      updateMovement(this, u);
    }
    updateCombat(this);
    updateProjectiles(this);
    updateProduction(this);
    updateRepairs(this);
    updateRepairBays(this);
    updateRefineries(this);
    updateStarports(this);
    if (this.tick % 10 === 0) updatePower(this);
    if (this.tick % 10 === 5) updateDeviations(this);
    if (this.tick % 20 === 5) updatePalaces(this);
    if (this.tick % 20 === 15) updateHunters(this);
    if (this.tick % 20 === 12) updateWorms(this);
    if (this.tick % 20 === 17) updateBlooms(this);
    if (this.fogOfWar && this.tick % 5 === 0) updateFog(this);
    if (this.tick % 20 === 0) revalidateProduction(this);
    if (this.tick % 20 === 10) updateAI(this);
    if (this.tick % 5 === 0) updateVictory(this);
    if (this.mission && this.tick % 5 === 0) this.mission.update(this);
    if (this.tick % Math.round(HARVESTER_CHECK / DT) === 150) ensureHarvesters(this);
    this.tick++;
    this.time = this.tick * DT;
  }

  requestPath(u, goal, { avoidUnits = false, keepIfEmpty = false } = {}) {
    if (goal !== u.goal) u.bestGoalDist = Infinity;   // a new destination: progress is measured afresh
    u.goal = goal;
    u.pathState = 'waiting';
    u.avoidUnits = avoidUnits;
    u.keepIfEmpty = keepIfEmpty;
    if (!u.queued) { u.queued = true; this.pathQueue.push(u.id); }
  }

  processPathQueue() {
    const map = this.map;
    let budget = this.pathNodeBudget;
    while (this.pathQueue.length && budget > 0) {
      const u = this.units.get(this.pathQueue.shift());
      if (!u) continue;
      u.queued = false;
      if (u.pathState !== 'waiting') continue;
      const near = (i) => Math.max(Math.abs(map.xOf(i) - u.tx), Math.abs(map.yOf(i) - u.ty)) <= 3;
      const blocked = u.avoidUnits ? (i) => map.unit[i] !== 0 && map.unit[i] !== u.id && near(i) : null;
      const extraCost = (i) => {
        const o = map.unit[i];
        if (!o || o === u.id) return 0;
        const other = this.units.get(o);
        return other && !other.step && other.pathState !== 'ready' ? 6 : 0.5;
      };
      const start = map.idx(u.tx, u.ty);
      if (u.goal !== start && !this.reach.connected(start, u.goal, u.move)) {
        u.goal = this.reach.nearestReachable(u.goal, start, u.move) ?? start;   // retarget instead of an exhaustive search
      }
      let res = this.pathfinder.find(start, u.goal, u.move, { maxNodes: this.pathSearchCap, blocked, extraCost });
      budget -= this.pathfinder.expanded + 1;
      if (!res.path.length && blocked && u.keepIfEmpty) {
        // no way around the crowd: keep the normal route and wait behind it
        res = this.pathfinder.find(start, u.goal, u.move, { maxNodes: this.pathSearchCap, extraCost });
        budget -= this.pathfinder.expanded + 1;
      }
      u.path = res.path;
      u.pathIndex = 0;
      u.pathReached = res.reached;
      u.pathState = res.path.length ? 'ready' : 'none';
    }
  }
}
