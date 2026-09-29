// Debug-mode consistency checks (spec §9): positions are finite, every ground unit holds its tile(s)
// (a vehicle in a repair bay none, or the one it drives out to), no tile is held by a missing unit,
// structures own their footprint. Returns a list of problems.
export function checkInvariants(world) {
  const problems = [];
  const map = world.map;
  const held = new Map();
  for (let i = 0; i < map.unit.length; i++) { const id = map.unit[i]; if (id) held.set(id, (held.get(id) ?? 0) + 1); }
  for (const u of world.units.values()) {
    if (!Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.heading)) problems.push(`unit ${u.id} has a non-finite position`);
    if (!u.isGround) continue;
    const n = held.get(u.id) ?? 0;
    if (u.inside) {
      const s = world.structures.get(u.inside);
      if (!s || s.occupant !== u.id) problems.push(`unit ${u.id} is inside a structure that does not hold it`);
      if (n > 1) problems.push(`unit ${u.id} in a bay holds ${n} tiles`);
      continue;
    }
    if (n < 1 || n > 2) problems.push(`unit ${u.id} holds ${n} tiles`);
    if (map.unit[map.idx(u.tx, u.ty)] !== u.id && !(u.step && u.step.released)) problems.push(`unit ${u.id} lost its tile ${u.tx},${u.ty}`);
  }
  for (const id of held.keys()) if (!world.units.has(id)) problems.push(`tile held by missing unit ${id}`);
  for (const s of world.structures.values()) {
    for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) {
      if (map.structure[map.idx(s.x + dx, s.y + dy)] !== s.id) problems.push(`structure ${s.id} lost tile ${s.x + dx},${s.y + dy}`);
    }
  }
  for (const p of world.projectiles?.values() ?? []) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.tx) || !Number.isFinite(p.ty)) problems.push(`projectile ${p.id} has a non-finite position`);
  }
  return problems;
}
