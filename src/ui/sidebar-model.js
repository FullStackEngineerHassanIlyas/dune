// Pure view-model of the C&C sidebar (spec §4.4, §5.6): credits and storage, the power bar's level,
// radar availability and the two build strips — structures, then the units of every line — with each
// icon's state, progress and queue count. It reads the world and never changes it.
import { STRUCTURES } from '../data/structures.js';
import { UNITS } from '../data/units.js';
import { buildSeconds } from '../data/tuning.js';
import { buildOptions } from '../sim/tech.js';
import { computePower, builtStorage, radarOnline } from '../sim/economy.js';

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
    return { typeId, line, name: t.name, cost: t.cost, seconds: Math.round(buildSeconds(t.buildTime)), ...itemState(house.lines[line], typeId, line) };
  };
  const power = computePower(world, houseId);
  return {
    credits: Math.floor(house.credits),
    storage: Math.max(builtStorage(world, houseId), house.startBuffer ?? 0),
    power: { ...power, level: powerLevel(power) },
    radar: radarOnline(world, houseId),
    structures: options.structure.map(entry('structure')),
    units: UNIT_LINES.flatMap((line) => options[line].map(entry(line))),
  };
}

/** Rolling credits counter (C&C): moves towards the target and settles in about a second. */
export function rollCredits(shown, target, dt) {
  const diff = target - shown;
  const step = Math.max(300, Math.abs(diff) * 4) * dt;
  return Math.abs(diff) <= step ? target : shown + Math.sign(diff) * step;
}
