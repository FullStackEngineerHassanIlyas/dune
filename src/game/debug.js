// window.__dune: read-only hooks for smoke and end-to-end tests (no cheats).
import { findFreeTile } from './setup.js';
import { STRUCTURES } from '../data/structures.js';
import { findPlacement } from '../sim/placement.js';
import { sidebarModel } from '../ui/sidebar-model.js';

export function createDebugApi({ world, house, selection, project, positionOf, rig, controller, view }) {
  const brief = (u) => u && { id: u.id, typeId: u.typeId, house: u.house, tx: u.tx, ty: u.ty, x: u.x, y: u.y, order: u.order.type, hp: u.hp, inside: u.inside ?? 0 };
  const screen = (x, z, lift) => { const s = project(x, z, lift); return { x: Math.round(s.x), y: Math.round(s.y), visible: s.visible }; };
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight };
  };
  const yard = () => [...world.structures.values()].find((s) => s.house === house && s.typeId === 'constructionYard');
  return {
    ready: false,
    scene: 'skirmish',
    world,
    house,
    selection: () => selection.list(),
    units: (typeId = null, h = house) => [...world.units.values()].filter((u) => u.house === h && (!typeId || u.typeId === typeId)).map(brief),
    unit: (id) => brief(world.units.get(id)),
    structures: (typeId = null) => [...world.structures.values()].filter((s) => !typeId || s.typeId === typeId).map((s) => ({ id: s.id, typeId: s.typeId, house: s.house, x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp })),
    screenOfUnit: (id) => { const u = world.units.get(id); if (!u) return null; const p = positionOf(u); return screen(p.x, p.z, u.alt ?? 0.12); },
    screenOfTile: (x, y) => screen(x + 0.5, y + 0.5, 0),
    screenOfFootprint: (typeId, x, y) => { const t = STRUCTURES[typeId]; return screen(x + t.w / 2, y + t.h / 2, 0); },
    freeTileNear: (x, y, moveClass = 'tracked') => findFreeTile(world, x, y, moveClass, 6),
    findPlacement: (typeId) => { const y = yard(); return y ? findPlacement(world, house, typeId, y.x, y.y) : null; },
    credits: () => Math.floor(world.houses.get(house).credits),
    sidebar: () => sidebarModel(world, house),
    mode: () => controller?.mode?.kind ?? null,
    buttonRect: (typeId) => {   // visible only when not scrolled out of its strip
      const b = document.querySelector(`.sidebar .sb-item[data-type="${typeId}"]`);
      const r = rect(b);
      const box = b?.closest('.sb-slots')?.getBoundingClientRect(), br = b?.getBoundingClientRect();
      if (r && box) r.visible = r.visible && br.top >= box.top - 1 && br.bottom <= box.bottom + 1;
      return r;
    },
    arrowRect: (strip, dir) => rect(document.querySelector(`.sidebar .sb-strip[data-strip="${strip}"] .sb-arrow[data-dir="${dir}"]`)),
    upgradeLevel: (type) => world.houses.get(house).upgrades?.[type] ?? 0,
    toolRect: (tool) => rect(document.querySelector(`.sidebar .sb-tool[data-tool="${tool}"]`)),
    lookAt: (x, z) => rig.lookAt(x, z, true),
    tick: () => world.tick,
    paused: () => !!view?.paused,
    outcome: () => world.outcome,
    sound: () => ({ ready: !!view?.sound?.ctx, buffers: view?.sound?.buffers.size ?? 0, voices: view?.sound?.limiter.total ?? 0 }),
  };
}
