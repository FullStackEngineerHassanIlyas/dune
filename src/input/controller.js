// Mouse and keyboard → selection and commands for the Classic (C&C 1995) and Modern schemes
// (spec §5.7). Classic: left click selects or orders by context, right click deselects.
// Modern: left click selects, right click orders. A house's own Carryalls take orders too: with only
// Carryalls selected, the order click on an own vehicle lifts it if one of them is empty (shift-click
// still selects), on the ground flies there or sets the load down, on the Repair Facility or a Refinery
// delivers the load. Ctrl + click stays force fire: no Carryall lifts the target. Alt + the order click
// (either button in Modern) is force move: onto whatever is there, so tracks crush enemy infantry. Space
// jumps to the last alert, which noteEvent() learns from the simulation's events (listenTo() hands them over).
import { pickAt, inBox } from './selection.js';
import { deploySpot } from '../sim/deploy.js';
import { STRUCTURES } from '../data/structures.js';
import { checkPlacement } from '../sim/placement.js';
import { LINE_FACTORIES } from '../sim/tech.js';
import { isArmed } from '../sim/combat.js';
import { needsRepair } from '../sim/repair-bay.js';
import { canCapture, capturable } from '../sim/capture.js';
import { onFoot } from '../data/units.js';
import { palaceOf, palaceReady } from '../sim/palace.js';
import { isLifter, liftable } from '../sim/carryall.js';

/** Footprint origin that centres a structure of `size` tiles on ground coordinate `g`. */
export const placementOrigin = (g, size) => Math.round(g - size / 2);

const UNIT_FACTORIES = new Set(Object.entries(LINE_FACTORIES).filter(([line]) => line !== 'structure').flatMap(([, types]) => types));
/** An own Carryall with empty claws: one with a load cannot lift another (an order click sets the load down instead). */
const free = (u) => isLifter(u) && !u.cargo;

const HOTKEYS = { s: 'stop', g: 'guard', x: 'scatter', d: 'deploy' };
/** Announcer lines that Space jumps to (spec §5.7), placed at the latest enemy hit on the house; a line that names its own place counts too. */
const ALERTS = new Set(['baseAttack', 'harvesterAttack', 'structureLost']);

export class Controller {
  constructor({ world, house, selection, groups, settings, project, ground, viewport, rig, positionOf, onCursor = () => {}, onMarker = () => {}, onDragBox = () => {}, canSee = () => true, canSeeStructure = () => true, onMode = () => {}, onGhost = () => {}, onNotice = () => {} }) {
    Object.assign(this, { world, house, selection, groups, settings, project, ground, viewport, rig, positionOf, onCursor, onMarker, onDragBox, canSee, canSeeStructure, onMode, onGhost, onNotice });
    this.mouse = { x: -1, y: -1 };
    this.hoverId = null;
    this.hoverStructureId = null;
    this.mode = null;
    this.hurt = { at: false, x: 0, z: 0 };    // the latest enemy hit on the house
    this.alert = { at: false, x: 0, z: 0 };   // the latest alert: where Space looks
  }

  candidates() {
    const out = [];
    for (const u of this.world.units.values()) {
      if ((u.inside && !(u.docked && u.house === this.house)) || u.type.untargetable || !this.canSee(u)) continue;   // held units and the Frigate cannot be picked; our harvester in a refinery's slot can
      const p = this.positionOf(u);
      const s = this.project(p.x, p.z, u.alt ?? 0.12);   // aircraft at their flying height
      if (!s.visible) continue;
      out.push({ id: u.id, unit: u, sx: s.x, sy: s.y, own: u.house === this.house, r: Math.max(10, s.pxPerUnit * (onFoot(u.move) ? 0.3 : 0.42)) });
    }
    return out;
  }

  hitTest(x, y) {
    const hit = pickAt(this.candidates(), x, y);
    if (hit) return { kind: 'unit', unit: hit.unit };
    const g = this.ground(x, y);
    if (!g) return null;
    const map = this.world.map, tx = Math.floor(g.x), ty = Math.floor(g.z);
    if (!map.inBounds(tx, ty)) return null;
    const s = this.world.structures.get(map.structure[map.idx(tx, ty)]);
    if (s && this.canSeeStructure(s)) return { kind: 'structure', structure: s, tx, ty };
    return { kind: 'ground', tx, ty };
  }

  inViewport(x, y) { const v = this.viewport(); return x >= v.left && x <= v.right && y >= v.top && y <= v.bottom; }
  ownSelected() { return this.selection.list().map((id) => this.world.units.get(id)).filter((u) => u && u.house === this.house && (!u.type.autonomous || isLifter(u))); }   // Fremen and visiting Carryalls can be looked at, not ordered
  /** Only own Carryalls selected: an order click on an own vehicle lifts it. */
  liftersOnly(own = this.ownSelected()) { return own.length > 0 && own.every(isLifter); }
  /** An own vehicle one of the selected Carryalls can go and pick up: one of them has its claws free (sim/carryall.js 'lift'). */
  lifts(u, own = this.ownSelected()) { return u.house === this.house && liftable(u) && own.some(free); }
  canLift(u, own = this.ownSelected()) { return this.liftersOnly(own) && this.lifts(u, own); }
  /** The load a selected Carryall holds. */
  loadOf(c) { return c.cargo ? this.world.units.get(c.cargo) ?? null : null; }
  issue(cmd) { this.world.issue(this.house, cmd); }
  /** The radar's order: the selection goes there, or else the selected factory's rally point moves there. */
  orderTile(tx, ty) {
    const hit = { kind: 'ground', tx, ty };
    if (!this.ownSelected().length && this.rally(hit)) return;
    this.order(hit);
  }

  setMode(mode) {
    this.mode = mode;
    if (mode?.kind !== 'place') this.onGhost(null);
    this.onMode(mode);
  }

  startPlacement(typeId) { this.setMode({ kind: 'place', typeId }); }

  placementAt(x, y) {
    if (this.mode?.kind !== 'place') return null;
    const g = this.ground(x, y);
    if (!g) return null;
    const t = STRUCTURES[this.mode.typeId];
    const px = placementOrigin(g.x, t.w), py = placementOrigin(g.z, t.h);
    return { typeId: this.mode.typeId, x: px, y: py, check: checkPlacement(this.world, this.house, this.mode.typeId, px, py) };
  }

  modeClick(x, y, button) {
    if (button === 2) { this.setMode(null); return; }
    if (this.mode.kind === 'palace') {   // the Palace weapon goes where the player clicks (spec §4.7)
      const hit = this.hitTest(x, y);
      this.setMode(null);
      if (!hit) return;
      const tx = hit.kind === 'unit' ? hit.unit.tx : hit.tx, ty = hit.kind === 'unit' ? hit.unit.ty : hit.ty;
      this.issue({ type: 'palace', x: tx, y: ty });
      this.onMarker(tx + 0.5, ty + 0.5);
      return;
    }
    if (this.mode.kind === 'attackMove') {
      const hit = this.hitTest(x, y);
      this.setMode(null);
      const ids = this.ownSelected().map((u) => u.id);
      if (!hit || !ids.length) return;
      const entity = hit.kind === 'unit' ? hit.unit : hit.kind === 'structure' ? hit.structure : null;
      if (entity && entity.house !== this.house) { this.order(hit); return; }
      const tx = hit.kind === 'unit' ? hit.unit.tx : hit.tx, ty = hit.kind === 'unit' ? hit.unit.ty : hit.ty;
      this.issue({ type: 'attackMove', ids, x: tx, y: ty });
      this.onMarker(tx + 0.5, ty + 0.5);
      return;
    }
    const m = this.mode;
    if (m.kind === 'place') {
      const p = this.placementAt(x, y);
      if (!p) return;
      if (!p.check.ok) { this.onNotice(p.check.reason === 'notAdjacent' ? 'Structures must be placed next to your base.' : 'Cannot build there.'); return; }
      this.issue({ type: 'place', typeId: m.typeId, x: p.x, y: p.y });
      this.setMode(null);
      return;
    }
    const s = this.ownStructureAt(x, y);
    if (!s) return;
    if (m.kind === 'sell') this.issue({ type: 'sell', structureId: s.id });
    else if (m.kind === 'repair' && s.hp < s.maxHp) this.issue({ type: 'repair', structureId: s.id });
  }

  ownStructureAt(x, y) {
    const hit = this.hitTest(x, y);
    return hit?.kind === 'structure' && hit.structure?.house === this.house ? hit.structure : null;
  }

  onClick(x, y, button, mods, double) {
    if (!this.inViewport(x, y)) return;
    if (this.mode) { this.modeClick(x, y, button); return; }
    const classic = this.settings.scheme !== 'modern';
    const hit = this.hitTest(x, y);
    if (mods.alt && (button === 0 || !classic) && hit && this.ownSelected().length) { this.forceMove(hit); return; }
    if (button === 2) {
      if (classic) this.selection.clear();
      else if (!this.rally(hit)) this.order(hit, mods);
      return;
    }
    if (mods.ctrl && hit && this.ownSelected().some((u) => isArmed(u.type))) { this.order(hit, mods); return; }   // force fire
    if (hit?.kind === 'unit' && hit.unit.house === this.house) {
      const u = hit.unit;
      if (classic && !mods.shift && this.canLift(u)) { this.order(hit); return; }   // the selected Carryall lifts it
      // a second click on the selected MCV deploys it, even when the two clicks were quick enough to count as a double click
      if (classic && !mods.shift && u.type.deploysTo && this.selection.ids.size === 1 && this.selection.has(u.id)) { this.issue({ type: 'deploy', ids: [u.id] }); return; }
      if (double) { this.selectSameType(u); return; }
      if (mods.shift) this.selection.toggle(u.id); else this.selection.set([u.id]);
      return;
    }
    if (hit?.kind === 'structure' && hit.structure) { this.clickStructure(hit.structure, classic, double); return; }
    if (classic && this.ownSelected().length) { this.order(hit); return; }
    if (classic && this.rally(hit)) return;
    if (hit?.kind === 'unit') { this.selection.set([hit.unit.id]); return; }
    if (!mods.shift) this.selection.clear();
  }

  clickStructure(s, classic, double) {
    const units = this.ownSelected();
    if (classic && units.length) {
      if (this.structureOrder(s, units)) return;
      if (s.house !== this.house) { this.order({ kind: 'structure', structure: s, tx: s.x, ty: s.y }); return; }
    }
    if (double && s.house === this.house && UNIT_FACTORIES.has(s.typeId)) this.issue({ type: 'setPrimary', structureId: s.id });
    this.selection.setStructure(s.id);
  }

  /** What a click on an own building tells the selection: harvesters unload at a refinery, damaged vehicles drive into a repair bay, Carryalls deliver their loads there. */
  structureOrder(s, units) {
    if (s.house !== this.house) return false;
    const done = this.deliverOrder(s, units.filter(isLifter));
    units = units.filter((u) => !isLifter(u));
    if (s.typeId === 'refinery' && units.length && units.every((u) => u.harvest)) { this.issue({ type: 'returnToBase', ids: units.map((u) => u.id) }); return true; }
    const fix = s.typeId === 'repair' ? units.filter(needsRepair) : [];
    if (!fix.length) return done;
    this.issue({ type: 'repairAt', ids: fix.map((u) => u.id), structureId: s.id });
    return true;
  }

  /** Carryalls take a worn load into the Repair Facility, a Harvester load to a Refinery. */
  deliverOrder(s, lifters) {
    const ids = lifters.filter((c) => this.delivers(c, s)).map((c) => c.id);
    if (!ids.length) return false;
    this.issue({ type: s.typeId === 'repair' ? 'repairAt' : 'returnToBase', ids, structureId: s.id });
    return true;
  }

  delivers(c, s) {
    const load = this.loadOf(c);
    return !!load && s.house === this.house && ((s.typeId === 'repair' && load.hp < load.maxHp) || (s.typeId === 'refinery' && !!load.harvest));
  }

  /** The selected own unit factory, whose rally point a ground click sets. */
  rallyTarget() {
    const s = this.world.structures.get(this.selection.structureId);
    return s && s.house === this.house && UNIT_FACTORIES.has(s.typeId) ? s : null;
  }

  rally(hit) {
    const s = hit?.kind === 'ground' ? this.rallyTarget() : null;
    if (!s) return false;
    this.issue({ type: 'setRally', structureId: s.id, x: hit.tx, y: hit.ty });
    this.onMarker(hit.tx + 0.5, hit.ty + 0.5);
    return true;
  }


  order(hit, mods = {}) {
    let units = this.ownSelected();
    if (!units.length || !hit) return;
    if (hit.kind === 'unit' && units.length === 1 && units[0].id === hit.unit.id && units[0].type.deploysTo) {
      this.issue({ type: 'deploy', ids: [units[0].id] });
      return;
    }
    const force = !!mods.ctrl && units.some((u) => isArmed(u.type));
    if (hit.kind === 'unit' && !force && this.lifts(hit.unit, units)) {   // empty Carryalls lift it (not a Ctrl force-fire target); the rest carry on
      this.issue({ type: 'lift', ids: units.filter(free).map((u) => u.id), targetId: hit.unit.id });
      this.onMarker(hit.unit.x, hit.unit.y);
      units = units.filter((u) => !free(u));
      if (!units.length) return;
    }
    const entity = hit.kind === 'unit' ? hit.unit : hit.kind === 'structure' ? hit.structure : null;
    const enemy = !!entity && entity.house !== this.house;
    if (hit.kind === 'structure' && enemy && !mods.ctrl && !entity.type.isWall && units.some((u) => u.type.sabotage)) {   // Saboteurs go in; the rest carry on
      this.issue({ type: 'sabotage', ids: units.filter((u) => u.type.sabotage).map((u) => u.id), structureId: entity.id });
      units = units.filter((u) => !u.type.sabotage);
      if (!units.length) return;
    }
    const armed = units.filter((u) => isArmed(u.type));
    if (hit.kind === 'structure' && !mods.ctrl && capturable(entity, this.house)) {   // infantry walk in, the rest open fire
      const takers = units.filter(canCapture);
      if (takers.length) {
        this.issue({ type: 'capture', ids: takers.map((u) => u.id), structureId: entity.id });
        const rest = armed.filter((u) => !canCapture(u));
        if (rest.length) this.issue({ type: 'attack', ids: rest.map((u) => u.id), targetKind: 'structure', targetId: entity.id, force: false });
        return;
      }
    }
    if (armed.length && (enemy || mods.ctrl)) {
      const ids = armed.map((u) => u.id);
      if (entity) this.issue({ type: 'attack', ids, targetKind: entity.kind, targetId: entity.id, force: !enemy });
      else this.issue({ type: 'attack', ids, x: hit.tx, y: hit.ty, force: true });
      return;
    }
    const tx = hit.kind === 'unit' ? hit.unit.tx : hit.tx, ty = hit.kind === 'unit' ? hit.unit.ty : hit.ty;
    if (hit.kind === 'structure') { this.structureOrder(hit.structure, units); return; }   // own buildings: unload, repair
    const map = this.world.map, i = map.idx(tx, ty);
    if (!units.some((u) => map.moveFactor(i, u.move) > 0)) return;   // nobody selected can go there
    if (units.every((u) => u.harvest) && map.spice[i] > 0) {
      this.issue({ type: 'harvest', ids: units.map((u) => u.id), x: tx, y: ty });
      this.onMarker(tx + 0.5, ty + 0.5);
      return;
    }
    this.issue({ type: 'move', ids: units.map((u) => u.id), x: tx, y: ty });
    this.onMarker(tx + 0.5, ty + 0.5);
  }

  /** Alt + click (spec §5.7): go there whatever is there — no attack, harvest, lift or selection; tracks crush enemy infantry on the way. */
  forceMove(hit) {
    const tx = hit.kind === 'unit' ? hit.unit.tx : hit.tx, ty = hit.kind === 'unit' ? hit.unit.ty : hit.ty;
    this.issue({ type: 'move', ids: this.ownSelected().map((u) => u.id), x: tx, y: ty });
    this.onMarker(tx + 0.5, ty + 0.5);
  }

  /** Space's alerts (spec §5.7): has the battle's GameView hand every simulation event it handles to noteEvent as
   *  well. main.js calls it for the battle scenes, at once, so not even the first frame's events are missed. */
  listenTo(view) {
    const onEvent = view.onEvent;
    view.onEvent = (e) => { onEvent.call(view, e); this.noteEvent(e); };
  }

  /** A simulation event (GameView hands each one over, see listenTo): keeps where the latest alert for Space happened. No allocation. */
  noteEvent(e) {
    if (e.house !== this.house) return;
    if (e.type === 'damaged' && e.by && e.by !== this.house) {
      const thing = e.kind === 'unit' ? this.world.units.get(e.id) : this.world.structures.get(e.id);
      if (thing) setSpot(this.hurt, e.kind === 'unit' ? thing.x : thing.x + thing.w / 2, e.kind === 'unit' ? thing.y : thing.y + thing.h / 2);
    } else if (e.type === 'structureDestroyed' && e.by && e.by !== this.house) setSpot(this.hurt, e.x + e.w / 2, e.y + e.h / 2);
    else if (e.type === 'eva') {
      if (Number.isFinite(e.x) && Number.isFinite(e.y)) setSpot(this.alert, e.x, e.y);
      else if (ALERTS.has(e.key) && this.hurt.at) setSpot(this.alert, this.hurt.x, this.hurt.z);
    }
  }

  selectSameType(u) {
    const v = this.viewport();
    this.selection.set(this.candidates()
      .filter((c) => c.own && c.unit.typeId === u.typeId && c.sx >= v.left && c.sx <= v.right && c.sy >= v.top && c.sy <= v.bottom)
      .map((c) => c.id));
  }

  onDrag(x0, y0, x1, y1) { this.onDragBox({ x0, y0, x1, y1 }); }

  onDragEnd(x0, y0, x1, y1, mods) {
    this.onDragBox(null);
    let ids = inBox(this.candidates().filter((c) => c.own), x0, y0, x1, y1);
    // a box round the army leaves out the Carryalls waiting on duty over it — an order would take them off duty and
    // along to the front; a box round Carryalls alone (or a click, or a double click) still picks them up
    const lifter = (id) => isLifter(this.world.units.get(id));
    if (!ids.every(lifter)) ids = ids.filter((id) => !lifter(id));
    if (mods.shift) this.selection.add(ids);
    else if (ids.length) this.selection.set(ids);
    else this.selection.clear();
  }

  onDragCancel() { this.onDragBox(null); }
  onMove(x, y) { this.mouse.x = x; this.mouse.y = y; }

  onKey(key, code, mods) {
    const digit = code?.startsWith('Digit') ? Number(code.slice(5)) : null;
    if (mods.repeat && (digit !== null || HOTKEYS[key])) return true;   // held keys must not repeat orders
    if (digit !== null) {
      if (mods.ctrl) { this.groups.assign(digit, this.ownSelected().map((u) => u.id)); return true; }
      const ids = this.groups.get(digit, (id) => this.world.units.has(id));
      if (!ids.length) return true;
      if (mods.shift) this.selection.add(ids); else this.selection.set(ids);
      if (this.groups.tap(digit, performance.now()) === 'center' || mods.alt) this.centerOn(ids);
      return true;
    }
    if (key === 'a' && !mods.ctrl) {
      if (this.ownSelected().some((u) => isArmed(u.type))) this.setMode({ kind: 'attackMove' });
      return true;
    }
    if (HOTKEYS[key]) {
      const ids = this.ownSelected().map((u) => u.id);
      if (ids.length) this.issue({ type: HOTKEYS[key], ids });
      return true;
    }
    if (key === 'Home') { this.rig.reset?.(); this.centerOnBase(); return true; }   // spec §5.5: Home resets the view
    if (key === 'h') { this.centerOnBase(); return true; }
    if (key === ' ') { if (this.alert.at) this.rig.lookAt(this.alert.x, this.alert.z); return true; }   // the last alert
    if (key === 'Escape') { if (this.mode) this.setMode(null); else this.selection.clear(); return true; }
    return false;
  }

  centerOn(ids) {
    let x = 0, z = 0, n = 0;
    for (const id of ids) { const u = this.world.units.get(id); if (!u) continue; const p = this.positionOf(u); x += p.x; z += p.z; n++; }
    if (n) this.rig.lookAt(x / n, z / n);
  }

  centerOnBase() {
    const yard = [...this.world.structures.values()].find((s) => s.house === this.house && s.typeId === 'constructionYard');
    if (yard) { this.rig.lookAt(yard.x + yard.w / 2, yard.y + yard.h / 2); return; }
    const mcv = [...this.world.units.values()].find((u) => u.house === this.house && u.typeId === 'mcv');
    if (mcv) this.rig.lookAt(mcv.x, mcv.y);
  }

  frame() {
    const { x, y } = this.mouse;
    const inside = x >= 0 && this.inViewport(x, y);
    if (this.mode?.kind === 'place') {
      const item = this.world.houses.get(this.house)?.lines?.structure.current;
      if (item?.typeId !== this.mode.typeId || item.state !== 'ready') this.setMode(null);
    }
    if (this.mode?.kind === 'palace' && !palaceReady(this.world, palaceOf(this.world, this.house))) this.setMode(null);   // it fired, or the Palace fell
    const hit = inside ? this.hitTest(x, y) : null;
    this.hoverId = hit?.kind === 'unit' ? hit.unit.id : null;
    this.hoverStructureId = hit?.kind === 'structure' ? hit.structure?.id ?? null : null;
    if (this.mode?.kind === 'place') this.onGhost(inside ? this.placementAt(x, y) : null);
    this.onCursor(this.cursorFor(hit));
  }

  cursorFor(hit) {
    if (this.mode) {
      if (this.mode.kind === 'palace') return 'target';
      if (this.mode.kind === 'attackMove') return 'attack';
      if (this.mode.kind === 'place') return 'default';
      const s = hit?.kind === 'structure' && hit.structure?.house === this.house ? hit.structure : null;
      if (this.mode.kind === 'sell') return s ? 'sell' : 'noSell';
      return s && s.hp < s.maxHp ? 'repair' : 'noRepair';
    }
    const own = this.ownSelected();
    if (!hit) return own.length ? 'noMove' : 'default';
    if (hit.kind === 'unit') {
      if (hit.unit.house !== this.house) return !own.length ? 'select' : this.liftersOnly(own) ? 'move' : hit.unit.isGround || own.some((u) => u.type.targetAir) ? 'attack' : 'noMove';   // aircraft: anti-air only; Carryalls fly over
      if (own.length === 1 && own[0].id === hit.unit.id && hit.unit.type.deploysTo) return deploySpot(this.world, hit.unit) ? 'deploy' : 'noDeploy';
      return this.canLift(hit.unit, own) ? 'lift' : 'select';
    }
    if (hit.kind === 'structure') {
      const s = hit.structure;
      const deliver = own.filter(isLifter).find((c) => this.delivers(c, s));
      if (deliver) return s.typeId === 'repair' ? 'enter' : 'move';
      if (own.length && s?.house === this.house && s.typeId === 'refinery' && own.every((u) => u.harvest)) return 'move';
      if (own.length && s?.house === this.house && s.typeId === 'repair' && own.some(needsRepair)) return 'enter';
      if (own.length && s?.house !== this.house && !s.type.isWall && own.some((u) => u.type.sabotage)) return 'sabotage';
      if (own.length && s?.house !== this.house) return capturable(s, this.house) && own.some(canCapture) ? 'capture' : own.some((u) => isArmed(u.type)) ? 'attack' : 'noMove';
      return 'select';
    }
    if (!own.length) return this.rallyTarget() ? 'move' : 'default';
    const i = this.world.map.idx(hit.tx, hit.ty);
    if (!own.some((u) => this.world.map.moveFactor(i, u.move) > 0)) return 'noMove';
    return own.every((u) => u.harvest) && this.world.map.spice[i] > 0 ? 'attack' : 'move';
  }

}

function setSpot(spot, x, z) { spot.at = true; spot.x = x; spot.z = z; }
