// The simulation world: map, houses, entities and the fixed-step update (spec §3).
import { Rng } from '../core/rng.js';
import { EventQueue } from '../core/events.js';
import { STRUCTURES } from '../data/structures.js';
import { DT } from '../data/tuning.js';
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
import { initHarvester, updateHarvester, spawnFreeHarvester } from './harvest.js';
import { updateFog } from './fog.js';
import { updateCombat, updateProjectiles, killUnit, retaliate } from './combat.js';
import { aftermathOfUnit, aftermathOfStructure } from './aftermath.js';
import { updateVictory } from './victory.js';
import { updateAI } from './ai.js';
import { alertDamage, alertUnitKilled, alertStructureKilled } from './announce.js';

export class World {
  constructor({ map, seed = 1 }) {
    this.map = map;
    this.rng = new Rng(seed);
    this.tick = 0;
    this.fogOfWar = true;    // skirmish option; false reveals everything
    this.rules = { victory: false };   // skirmish and campaign switch victory checks on
    this.outcome = null;
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
    this.onTileEntered = null;     // crush, bloom and worm hooks (plan 1b and later)
    this.onStructurePlaced = (s) => {
      if (s.type.storage) revokeStartBuffer(this, this.houses.get(s.house));
      if (s.typeId === 'refinery') spawnFreeHarvester(this, s);
    };
    this.onUnitKilled = (u, attacker) => { aftermathOfUnit(this, u, attacker); alertUnitKilled(this, u, attacker); };
    this.onStructureKilled = (s, attacker) => { aftermathOfStructure(this, s); alertStructureKilled(this, s, attacker); };
    this.onCrush = (tank, victim) => killUnit(this, victim, { house: tank.house, id: tank.id, kind: 'unit' }, 'crushed');
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
    if (unit.isGround) {
      const i = this.map.idx(x, y);
      if (this.map.unit[i] || this.map.structure[i]) throw new Error(`tile ${x},${y} is taken`);
      this.map.unit[i] = unit.id;
    }
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
    for (const [fx, fy] of footprint(x, y, t.w, t.h)) this.map.structure[this.map.idx(fx, fy)] = s.id;
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
      if (this.map.structure[i] === s.id) this.map.structure[i] = 0;
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
      if (!this.units.has(u.id)) continue;
      if (u.harvest) updateHarvester(this, u);
      updateMovement(this, u);
    }
    updateCombat(this);
    updateProjectiles(this);
    updateProduction(this);
    updateRepairs(this);
    if (this.tick % 10 === 0) updatePower(this);
    if (this.fogOfWar && this.tick % 5 === 0) updateFog(this);
    if (this.tick % 20 === 0) revalidateProduction(this);
    if (this.tick % 20 === 10) updateAI(this);
    if (this.tick % 20 === 0) updateVictory(this);
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
