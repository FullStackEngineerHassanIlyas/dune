// Pure view-model of the C&C sidebar (spec §4.4, §5.6): credits and storage, the power bar's level,
// radar availability and the two build strips — structures and factory upgrades, then the units of every line — with each
// icon's state, progress and queue count. It reads the world and never changes it.
import { STRUCTURES } from '../data/structures.js';
import { UNITS } from '../data/units.js';
import { buildSeconds, UPGRADE_BUILD_TIME, STARPORT } from '../data/tuning.js';
import { buildOptions, lineOfItem, upgradeTarget, upgradeLevel, upgradeResult, upgradeCost, upgradeUnlocks } from '../sim/tech.js';
import { computePower, builtStorage, radarOnline } from '../sim/economy.js';
import { starportOf } from '../sim/starport.js';

const UNIT_LINES = ['infantry', 'light', 'heavy', 'air'];

export function powerLevel({ produced, used }) {
  if (used <= produced) return 'ok';
  return used > 2 * produced ? 'critical' : 'low';
}

function itemState(l, typeId, line) {
  const cur = l.current;
  const queued = l.queue.reduce((n, t) => n + (t === typeId ? 1 : 0), 0);
  if (cur?.typeId === typeId) return { state: cur.state, progress: cur.progress, count: queued + 1, starved: cur.starved };
  if (queued) return { state: 'queued', progress: 0, count: queued, starved: false };
  return { state: line === 'structure' && cur ? 'locked' : 'idle', progress: 0, count: 0, starved: false };
}

export function sidebarModel(world, houseId) {
  const house = world.houses.get(houseId);
  const options = buildOptions(world, houseId);
  const entry = (line) => (typeId) => {
    const t = STRUCTURES[typeId] ?? UNITS[typeId];
    return { typeId, line, icon: typeId, name: t.name, cost: t.cost, seconds: Math.round(buildSeconds(t.buildTime)), ...itemState(house.lines[line], typeId, line) };
  };
  const upgrade = (typeId) => {
    const target = upgradeTarget(typeId), line = lineOfItem(typeId);
    const cur = house.lines[line].current?.typeId === typeId ? house.lines[line].current : null;
    const level = cur?.level ?? upgradeResult(house, target);
    const opens = upgradeUnlocks(houseId, target, upgradeLevel(house, target), level);
    return {
      typeId, line, icon: `${typeId}:${level}`, name: `${STRUCTURES[target].name} upgrade`, cost: cur?.cost ?? upgradeCost(house, target),
      seconds: Math.round(buildSeconds(UPGRADE_BUILD_TIME)), note: `Level ${level}${opens.length ? ` — unlocks ${opens.join(', ')}` : ''}`,
      ...itemState(house.lines[line], typeId, line),
    };
  };
  const m = house.starport, open = m && starportOf(world, houseId);
  const ware = (t) => {
    const b = m.batch, ordered = b ? b.items.filter((i) => i.typeId === t).length : 0;
    const locked = m.stock[t] <= 0 || !!b?.landed || (b && b.items.length >= STARPORT.load);
    const eta = b && !b.landed ? ` · Frigate in ${Math.max(0, Math.ceil(b.landAt - world.time))} s` : '';
    return {
      typeId: `starport:${t}`, line: 'starport', icon: `starport:${t}`, name: UNITS[t].name, cost: m.price[t], seconds: STARPORT.delivery,
      note: `Starport · ${m.stock[t]} in stock${eta}`, state: locked ? 'locked' : ordered ? 'queued' : 'idle', progress: 0, count: ordered, starved: false,
      order: { type: 'starportOrder', typeId: t }, cancel: { type: 'starportCancel', typeId: t },
    };
  };
  const power = computePower(world, houseId);
  return {
    credits: Math.floor(house.credits),
    storage: Math.max(builtStorage(world, houseId), house.startBuffer ?? 0),
    power: { ...power, level: powerLevel(power) },
    radar: radarOnline(world, houseId),
    structures: [...options.structure.map(entry('structure')), ...options.upgrades.map(upgrade)],
    units: [...UNIT_LINES.flatMap((line) => options[line].map(entry(line))), ...(open ? Object.keys(m.stock).map(ware) : [])],
  };
}

/** Rolling credits counter (C&C): moves towards the target and settles in about a second. */
export function rollCredits(shown, target, dt) {
  const diff = target - shown;
  const step = Math.max(300, Math.abs(diff) * 4) * dt;
  return Math.abs(diff) <= step ? target : shown + Math.sign(diff) * step;
}
