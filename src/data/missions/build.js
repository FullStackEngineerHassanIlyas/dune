// Builds the plain-data mission definitions of contract C1 from plan.js (the shape every house shares) and a
// house file (seeds, enemies, the start): sites through the mission's map symmetry, the player's yard and start
// force, each computer base laid out on its plateau (layout.js) with the factory levels its mission allows,
// the M1 patrols, reinforcements on the PC timing, the Starport stock. Deterministic; no map is generated here.
import { HOUSES } from '../houses.js';
import { UNITS } from '../units.js';
import { STARPORT } from '../tuning.js';
import { SEGA_STARPORT } from '../sega-tech.js';
import { segaUpgrades } from '../../sim/tech.js';
import { siteSpiceSpot } from '../../sim/mapgen.js';
import { PLAN, ARRANGEMENTS, OWN_REINFORCEMENTS, FOE_REINFORCEMENTS, STARPORT_STOCK, launcher, infantryBuildings, roleOf } from './plan.js';
import { layoutBase, musterTiles, symmetry, nearestSide, headingOf } from './layout.js';

const ROLE_ORDER = ['special', 'siege', 'missile', 'tank', 'quad', 'light', 'inf3', 'inf1'];
const onFoot = (type) => UNITS[type].move === 'foot';
const dir = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
const nearest = (p, list) => list.reduce((a, b) => (Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a));
const name = (id) => HOUSES[id].name;

/** { type: count } → [type, ...] in the order given. */
const expand = (counts) => Object.entries(counts).flatMap(([type, k]) => Array(k).fill(type));

function roleUnits(house, n, roles) {
  return roles.map((r) => (r === 'launcher' ? launcher(house, n) : roleOf(house, n, r)));
}

function titleOf(n, plan, bases) {
  const o = plan.objective;
  if (o.kind === 'quota') return `Harvest ${o.quota} credits`;
  if (o.kind === 'quotaOrDestroy') return `Harvest ${o.quota} credits or destroy the ${name(bases[0])} base`;
  if (bases.length === 2 && bases[0] === bases[1]) return `Destroy both ${name(bases[0])} bases`;
  if (bases.length === 2) return `Destroy the ${name(bases[0])} and ${name(bases[1])} bases`;
  return `Destroy the ${name(bases[0])} base`;
}

/** A computer base's structures, concrete and units on its site. */
function buildBase(house, n, spec, site, { foe, size, sites, taken }) {
  const extra = infantryBuildings(house, n);
  const buildings = spec.buildings.flatMap((t) => (t === 'inf' ? [extra[0]] : t === 'inf2' ? extra.slice(1, 2) : [t]));
  const front = dir(site, foe);
  const lay = layoutBase(site, buildings, { front, spice: dir(site, siteSpiceSpot(site, size, size, sites)), turrets: spec.turrets });
  const roles = ROLE_ORDER.flatMap((r) => Array(spec.units[r] ?? 0).fill(r));
  const tiles = musterTiles(site, lay.rects, roles.length, { front, taken });
  let hunters = spec.hunt ?? 0;
  const units = roles.map((role, k) => {
    const type = roleOf(house, n, role);
    const order = (role === 'light' || role === 'quad') && hunters > 0 ? (hunters--, 'hunt') : onFoot(type) ? 'guard' : 'areaGuard';
    return { type, x: tiles[k].x, y: tiles[k].y, heading: headingOf(front), order };
  });
  return { structures: lay.structures, concrete: lay.concrete, units };
}

export function buildMission(data, n) {
  const plan = PLAN[n], m = data.missions[n - 1], house = data.house;
  const size = plan.size, centre = { x: (size - 1) / 2, y: (size - 1) / 2 };
  const sym = symmetry(n === 9 ? 0 : data.symmetry + n, size);   // the last battlefield is the same for every house
  const arrangement = ARRANGEMENTS[plan.arrangement ?? (m.bases.length === 2 ? 'two' : 'one')];
  const specs = m.bases.length === 0 ? [] : m.bases.length === 1 ? [plan.single] : m.bases[0] === m.bases[1] ? plan.double : plan.pair;
  const count = {};
  const baseSites = specs.map((spec, k) => {
    const id = m.bases[k];
    count[id] = (count[id] ?? 0) + 1;
    return { id: count[id] > 1 ? `${id}-${count[id]}` : id, house: id, ...sym(arrangement.bases[k]), r: spec.r };
  });
  const player = { id: 'player', ...sym(arrangement.player) };
  const posts = (arrangement.posts ?? []).map((p, k) => ({ id: `post-${k + 1}`, ...sym(p) }));
  const sites = [player, ...baseSites, ...posts];
  const taken = new Set();

  // the player: a Construction Yard on concrete and the Mega Drive start force in front of it
  const foeSite = baseSites.length ? nearest(player, baseSites) : centre;
  const front = dir(player, foeSite);
  const yard = layoutBase(player, ['constructionYard'], { front });
  const start = expand(m.units);
  const startTiles = musterTiles(player, yard.rects, start.length, { front, taken, reach: 0.35 });
  const playerDef = {
    credits: m.credits,
    structures: yard.structures,
    units: start.map((type, k) => ({ type, x: startTiles[k].x, y: startTiles[k].y, heading: headingOf(front) })),
    upgrades: { ...(HOUSES[house].startUpgrades ?? {}) },
    concrete: yard.concrete,
  };

  // the computer houses: every enemy the mission names; those holding no base (M1's patrols, the Emperor's drops) own none
  const holders = [...new Set(m.bases)];
  const houses = m.enemies.map((id) => {
    const holds = holders.includes(id), patrols = n === 1 && id === m.enemies[0];
    const ai = holds || patrols ? { ...plan.ai } : { difficulty: 'hard', passive: true };
    if (holds && holders.indexOf(id) > 0) ai.firstAttack += 60;   // the second house of mission 8 strikes a minute later
    return { id, credits: holds ? plan.credits : 0, techLevel: n, upgrades: segaUpgrades(id, n), ai, structures: [], units: [], concrete: [] };
  });
  const entry = (id) => houses.find((h) => h.id === id);
  baseSites.forEach((site, k) => {
    const spec = specs[k];
    const base = buildBase(site.house, n, spec, site, { foe: player, size, sites, taken });
    const h = entry(site.house);
    h.structures.push(...base.structures);
    h.concrete.push(...base.concrete);
    h.units.push(...base.units);
  });
  posts.forEach((post, k) => {
    const foe = m.enemies[0], patrol = (plan.patrolsBy?.[foe] ?? plan.patrols)[k];
    const types = roleUnits(foe, n, patrol.units);
    const tiles = musterTiles(post, [], types.length, { front: dir(post, player), taken, reach: 0 });
    entry(foe).units.push(...types.map((type, j) => ({ type, x: tiles[j].x, y: tiles[j].y, heading: headingOf(dir(post, player)), order: patrol.order })));
  });

  // reinforcements: the player's by Carryall home; the computer's into the player's base or from its own side
  const sideOf = (id) => {
    const site = baseSites.find((s) => s.house === id);
    return site ? nearestSide(site, size, size) : nearestSide({ x: size - 1 - player.x, y: size - 1 - player.y }, size, size);
  };
  const reinforcements = [
    ...(OWN_REINFORCEMENTS[n] ?? []).map(([at, roles]) => ({ house, units: roleUnits(house, n, roles), at, via: 'carryall', to: 'home', from: nearestSide(player, size, size) })),
    ...(FOE_REINFORCEMENTS[n] ?? []).map((e) => {
      const id = e.house ?? holders[e.foe ?? 0];
      return { house: id, units: roleUnits(id, n, e.units), at: e.at, via: e.via, to: e.to, from: sideOf(id) };
    }),
  ].sort((a, b) => a.at - b.at);

  const stock = STARPORT_STOCK[n];
  const starport = stock ? { stock: Object.fromEntries(Object.entries(stock).filter(([t]) => SEGA_STARPORT[t] <= n && (UNITS[t].houses.includes(house) || STARPORT.extra[t]?.includes(house)))) } : null;

  return {
    id: `${house}-${n}`,
    house,
    mission: n,
    title: titleOf(n, plan, m.bases),
    enemies: [...m.enemies],
    objective: { ...plan.objective },
    minSeconds: 120,
    map: { w: size, h: size, seed: m.seed, sites: sites.map(({ id, x, y, r }) => ({ id, x, y, r })), spiceFields: plan.spiceFields, blooms: plan.blooms },
    visibility: 'shroud',
    worms: plan.worms,
    rules: { tech: 'sega' },
    techLevel: n,
    player: playerDef,
    houses,
    reinforcements,
    starport,
  };
}
