// Model registry: which model draws which unit or structure type, built lazily and cached.
import { combatTank } from './units/combat-tank.js';
import { siegeTank } from './units/siege-tank.js';
import { missileTank } from './units/missile-tank.js';
import { deviator } from './units/deviator.js';
import { sonicTank } from './units/sonic-tank.js';
import { devastator } from './units/devastator.js';
import { harvester } from './units/harvester.js';
import { mcv } from './units/mcv.js';
import { trike } from './units/trike.js';
import { quad } from './units/quad.js';
import { soldier, trooper } from './units/infantry.js';
import { constructionYard } from './structures/construction-yard.js';
import { windtrap } from './structures/windtrap.js';
import { refinery } from './structures/refinery.js';
import { silo } from './structures/silo.js';
import { outpost } from './structures/outpost.js';
import { barracks } from './structures/barracks.js';
import { wor } from './structures/wor.js';
import { lightFactory } from './structures/light-factory.js';
import { heavyFactory } from './structures/heavy-factory.js';
import { gunTurret, rocketTurret } from './structures/turret.js';
import { wallPost, wallArm } from './structures/wall.js';
import { placeholderStructure, placeholderUnit } from './structures/placeholder.js';

const BUILDERS = {
  combatTank, siegeTank, missileTank, deviator, sonicTank, devastator, harvester, mcv, trike, quad, soldier, trooper,
  constructionYard, windtrap, refinery, silo, outpost, barracks, wor, lightFactory, heavyFactory,
  turret: gunTurret, rocketTurret, wallPost, wallArm, placeholderUnit,
};

export const UNIT_MODEL = {
  soldier: 'soldier', infantry: 'soldier', saboteur: 'soldier', trooper: 'trooper', troopers: 'trooper',
  trike: 'trike', raider: 'trike', quad: 'quad', combatTank: 'combatTank', siegeTank: 'siegeTank',
  missileTank: 'missileTank', deviator: 'deviator', sonicTank: 'sonicTank', devastator: 'devastator',
  harvester: 'harvester', mcv: 'mcv',
};
export const STRUCTURE_MODEL = {
  constructionYard: 'constructionYard', windtrap: 'windtrap', refinery: 'refinery', silo: 'silo', outpost: 'outpost',
  barracks: 'barracks', wor: 'wor', lightFactory: 'lightFactory', heavyFactory: 'heavyFactory',
  turret: 'turret', rocketTurret: 'rocketTurret', wall: 'wallPost',
};

const cache = new Map();

export function modelDef(id) {
  if (!cache.has(id)) {
    const m = /^placeholder(\d)x(\d)$/.exec(id);
    const build = BUILDERS[id] ?? (m ? () => placeholderStructure(+m[1], +m[2]) : placeholderUnit);
    cache.set(id, build());
  }
  return cache.get(id);
}

export const unitModelId = (typeId) => UNIT_MODEL[typeId] ?? 'placeholderUnit';
export const structureModelId = (typeId, w, h) => STRUCTURE_MODEL[typeId] ?? `placeholder${w}x${h}`;
