// Weapons and projectiles (spec §4.6; docs/research/raw/units.md "Projectiles", structures.md
// "Turrets — combat detail"). Units and structures name a weapon here; damage, range and fire delay
// stay on the unit or structure. Accurate weapons always hit their target; the others scatter.
// Deviator gas, the sonic wave and Devastator plasma get their special behaviour in plan 2.
export const WEAPONS = {
  rifle:         { projectile: 'bullet', speed: 250, accurate: true },
  pistol:        { projectile: 'bullet', speed: 250, accurate: true },
  mg:            { projectile: 'bullet', speed: 250, accurate: true },
  cannon:        { projectile: 'shell', speed: 250, accurate: true },
  heavyCannon:   { projectile: 'shell', speed: 250, accurate: true },
  plasma:        { projectile: 'shell', speed: 250, accurate: true },
  sonic:         { projectile: 'shell', speed: 200, accurate: true },
  rocket:        { projectile: 'rocket', speed: 200, accurate: false },
  miniRocket:    { projectile: 'rocket', speed: 180, accurate: false },
  gasRocket:     { projectile: 'rocket', speed: 200, accurate: false },
  trooperRocket: { projectile: 'bullet', speed: 250, accurate: true, far: { beyond: 2, projectile: 'rocket', speed: 180, accurate: false, damageScale: 0.75 } },
  turretGun:     { projectile: 'shell', speed: 250, accurate: true },
  turretRocket:  { projectile: 'rocket', speed: 200, accurate: true, homing: true },
};

/** The shot a weapon makes at `dist` tiles (troopers switch to mini-rockets beyond two tiles). */
export function shotFor(weaponId, dist) {
  const w = WEAPONS[weaponId];
  if (!w) return null;
  const base = { id: weaponId, projectile: w.projectile, speed: w.speed, accurate: w.accurate, homing: !!w.homing, damageScale: 1 };
  return w.far && dist > w.far.beyond ? { ...base, ...w.far, homing: false } : base;
}
