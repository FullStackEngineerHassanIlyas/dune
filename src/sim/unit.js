// Unit records: plain objects so systems read them cheaply and tests can inspect them.
import { UNITS, MOVE } from '../data/units.js';

export function createUnit(id, typeId, house, x, y, { heading = 0 } = {}) {
  const type = UNITS[typeId];
  if (!type) throw new Error(`unknown unit type ${typeId}`);
  return {
    id, typeId, type, house, kind: 'unit',
    move: type.move,
    isGround: type.move !== MOVE.AIR,
    tx: x, ty: y,               // tile the unit stands on (or is leaving)
    x: x + 0.5, y: y + 0.5,     // continuous position in tile units
    px: x + 0.5, py: y + 0.5,   // position at the previous tick, for render interpolation
    heading, pheading: heading,
    turret: heading, pturret: heading,
    hp: type.hp, maxHp: type.hp,
    order: { type: 'idle' },
    goal: -1, path: [], pathIndex: 0, pathState: 'none', pathReached: false, queued: false, avoidUnits: false,
    step: null, carry: 0,
    waitTicks: 0, stuckTicks: 0, repaths: 0, nudgedAt: -1000,
    distance: 0, pdistance: 0,  // tiles travelled in total (wheel, tread and walk animation)
  };
}
