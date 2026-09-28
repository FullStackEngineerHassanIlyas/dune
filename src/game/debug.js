// window.__dune: read-only hooks for smoke and end-to-end tests (no cheats).
import { findFreeTile } from './setup.js';

export function createDebugApi({ world, house, selection, project, positionOf, rig }) {
  const brief = (u) => u && { id: u.id, typeId: u.typeId, house: u.house, tx: u.tx, ty: u.ty, x: u.x, y: u.y, order: u.order.type, hp: u.hp };
  const screen = (x, z, lift) => { const s = project(x, z, lift); return { x: Math.round(s.x), y: Math.round(s.y), visible: s.visible }; };
  return {
    ready: false,
    scene: 'skirmish',
    world,
    house,
    selection: () => selection.list(),
    units: (typeId = null, h = house) => [...world.units.values()].filter((u) => u.house === h && (!typeId || u.typeId === typeId)).map(brief),
    unit: (id) => brief(world.units.get(id)),
    structures: (typeId = null) => [...world.structures.values()].filter((s) => !typeId || s.typeId === typeId).map((s) => ({ id: s.id, typeId: s.typeId, house: s.house, x: s.x, y: s.y })),
    screenOfUnit: (id) => { const u = world.units.get(id); if (!u) return null; const p = positionOf(u); return screen(p.x, p.z, 0.12); },
    screenOfTile: (x, y) => screen(x + 0.5, y + 0.5, 0),
    freeTileNear: (x, y, moveClass = 'tracked') => findFreeTile(world, x, y, moveClass, 6),
    lookAt: (x, z) => rig.lookAt(x, z, true),
  };
}
