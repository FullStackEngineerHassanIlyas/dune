// Mouse and keyboard → selection and commands for the Classic (C&C 1995) and Modern schemes
// (spec §5.7). Classic: left click selects or orders by context, right click deselects.
// Modern: left click selects, right click orders.
import { pickAt, inBox } from './selection.js';
import { deploySpot } from '../sim/deploy.js';

const HOTKEYS = { s: 'stop', g: 'guard', x: 'scatter', d: 'deploy' };

export class Controller {
  constructor({ world, house, selection, groups, settings, project, ground, viewport, rig, positionOf, onCursor = () => {}, onMarker = () => {}, onDragBox = () => {} }) {
    Object.assign(this, { world, house, selection, groups, settings, project, ground, viewport, rig, positionOf, onCursor, onMarker, onDragBox });
    this.mouse = { x: -1, y: -1 };
    this.hoverId = null;
  }

  candidates() {
    const out = [];
    for (const u of this.world.units.values()) {
      const p = this.positionOf(u);
      const s = this.project(p.x, p.z, u.isGround ? 0.12 : 1.5);
      if (!s.visible) continue;
      out.push({ id: u.id, unit: u, sx: s.x, sy: s.y, own: u.house === this.house, r: Math.max(10, s.pxPerUnit * (u.move === 'foot' ? 0.3 : 0.42)) });
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
    const sid = map.structure[map.idx(tx, ty)];
    if (sid) return { kind: 'structure', structure: this.world.structures.get(sid), tx, ty };
    return { kind: 'ground', tx, ty };
  }

  inViewport(x, y) { const v = this.viewport(); return x >= v.left && x <= v.right && y >= v.top && y <= v.bottom; }
  ownSelected() { return this.selection.list().map((id) => this.world.units.get(id)).filter((u) => u && u.house === this.house); }
  issue(cmd) { this.world.issue(this.house, cmd); }

  onClick(x, y, button, mods, double) {
    if (!this.inViewport(x, y)) return;
    const classic = this.settings.scheme !== 'modern';
    const hit = this.hitTest(x, y);
    if (button === 2) {
      if (classic) this.selection.clear(); else this.order(hit);
      return;
    }
    if (hit?.kind === 'unit' && hit.unit.house === this.house) {
      const u = hit.unit;
      // a second click on the selected MCV deploys it, even when the two clicks were quick enough to count as a double click
      if (classic && !mods.shift && u.type.deploysTo && this.selection.ids.size === 1 && this.selection.has(u.id)) { this.issue({ type: 'deploy', ids: [u.id] }); return; }
      if (double) { this.selectSameType(u); return; }
      if (mods.shift) this.selection.toggle(u.id); else this.selection.set([u.id]);
      return;
    }
    if (classic && this.ownSelected().length) { this.order(hit); return; }
    if (hit?.kind === 'unit') { this.selection.set([hit.unit.id]); return; }
    if (!mods.shift) this.selection.clear();
  }

  order(hit) {
    const units = this.ownSelected();
    if (!units.length || !hit) return;
    if (hit.kind === 'unit' && units.length === 1 && units[0].id === hit.unit.id && units[0].type.deploysTo) {
      this.issue({ type: 'deploy', ids: [units[0].id] });
      return;
    }
    const tx = hit.kind === 'unit' ? hit.unit.tx : hit.tx, ty = hit.kind === 'unit' ? hit.unit.ty : hit.ty;
    if (hit.kind === 'structure') return;   // structure clicks are handled by selection (Task 15) and combat (plan 1c)
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

  selectSameType(u) {
    const v = this.viewport();
    this.selection.set(this.candidates()
      .filter((c) => c.own && c.unit.typeId === u.typeId && c.sx >= v.left && c.sx <= v.right && c.sy >= v.top && c.sy <= v.bottom)
      .map((c) => c.id));
  }

  onDrag(x0, y0, x1, y1) { this.onDragBox({ x0, y0, x1, y1 }); }

  onDragEnd(x0, y0, x1, y1, mods) {
    this.onDragBox(null);
    const ids = inBox(this.candidates().filter((c) => c.own), x0, y0, x1, y1);
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
    if (HOTKEYS[key]) {
      const ids = this.ownSelected().map((u) => u.id);
      if (ids.length) this.issue({ type: HOTKEYS[key], ids });
      return true;
    }
    if (key === 'Home') { this.rig.reset?.(); this.centerOnBase(); return true; }   // spec §5.5: Home resets the view
    if (key === 'h') { this.centerOnBase(); return true; }
    if (key === 'Escape') { this.selection.clear(); return true; }
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
    const hit = x >= 0 && this.inViewport(x, y) ? this.hitTest(x, y) : null;
    this.hoverId = hit?.kind === 'unit' ? hit.unit.id : null;
    this.onCursor(this.cursorFor(hit));
  }

  cursorFor(hit) {
    const own = this.ownSelected();
    if (!hit) return own.length ? 'noMove' : 'default';
    if (hit.kind === 'unit') {
      if (hit.unit.house !== this.house) return own.length ? 'attack' : 'select';
      if (own.length === 1 && own[0].id === hit.unit.id && hit.unit.type.deploysTo) return deploySpot(this.world, hit.unit) ? 'deploy' : 'noDeploy';
      return 'select';
    }
    if (!own.length) return 'default';
    if (hit.kind === 'structure') return 'noMove';
    const i = this.world.map.idx(hit.tx, hit.ty);
    if (!own.some((u) => this.world.map.moveFactor(i, u.move) > 0)) return 'noMove';
    return own.every((u) => u.harvest) && this.world.map.spice[i] > 0 ? 'attack' : 'move';
  }
}
