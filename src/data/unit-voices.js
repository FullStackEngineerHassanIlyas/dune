// Unit voices (spec §6 Announcer; docs/superpowers/notes/2026-10-03-phase3-voices.md): every kind of unit
// answers the player in a voice of its own — foot soldiers on a field radio, tank crews on the intercom,
// pilots in a headset — with a few short lines for each kind of order. A line id is
// unit.<group>.<kind>.<n> (n from 1), its file assets/voice/<group>/<kind>.<n>.ogg; the words are in
// scripts/voices/lines.json ("unitVoices"), and VARIANTS here must count the same lines (tests check it).
// The original PC game had one shared set of replies (REPORT1-3, AFFIRM, OVEROUT, MOVEOUT) and the Mega
// Drive one unit voice; per-kind voices go further, by the manager's wish, and the original-files mode
// still maps every line here onto those clips (src/formats/dune2-sounds.js UNIT_CLIPS).
import { WEAPONS } from './weapons.js';

/** Unit type → voice group. Types missing here and listed in SILENT_UNITS never speak. */
export const VOICE_GROUPS = {
  soldier: 'grunt', infantry: 'grunt',
  trooper: 'trooper', troopers: 'trooper',
  trike: 'scout', raider: 'scout', quad: 'scout',
  combatTank: 'tanker', siegeTank: 'tanker', missileTank: 'tanker', sonicTank: 'tanker', deviator: 'tanker', devastator: 'tanker',
  harvester: 'harvester', mcv: 'mcv', carryall: 'carryall', ornithopter: 'ornithopter', saboteur: 'saboteur', fremen: 'fremen',
};
/** Types no player ever selects: the Frigate (untargetable) and the sandworm (nobody's). */
export const SILENT_UNITS = ['frigate', 'sandworm'];
/** Groups of men on foot: the original answered them with other clips than its vehicles (OpenDUNE unit.c, viewport.c). */
export const FOOT_GROUPS = new Set(['grunt', 'trooper', 'saboteur', 'fremen']);

/** Lines per group and kind (scripts/voices/lines.json "unitVoices" holds the words). */
export const VARIANTS = {
  grunt: { select: 3, move: 3, attack: 3, attackMove: 1, guard: 2, scatter: 1, capture: 2 },
  trooper: { select: 3, move: 3, attack: 3, attackMove: 1, guard: 2, scatter: 1, capture: 2 },
  scout: { select: 3, move: 3, attack: 3, attackMove: 1, guard: 2, scatter: 1, repair: 1 },
  tanker: { select: 3, move: 3, attack: 3, attackMove: 1, guard: 2, scatter: 1, repair: 1, destruct: 2 },
  harvester: { select: 3, move: 3, harvest: 3, return: 3, repair: 1 },
  carryall: { select: 3, move: 3, lift: 3, duty: 2, drop: 2, deliver: 1 },
  mcv: { select: 2, move: 3, deploy: 2 },
  ornithopter: { select: 3, move: 3, attack: 3, attackMove: 1, guard: 2 },
  saboteur: { select: 3, move: 3, sabotage: 3, attack: 1 },
  fremen: { select: 3 },   // they take no orders (src/sim/orders.js: autonomous), so they only answer being looked at
};
export const GROUPS = Object.keys(VARIANTS);

/** A kind a group has no words for borrows the nearest one it has: a Harvester told to scatter just moves. */
const FALLBACK = { attackMove: ['attack', 'move'], scatter: ['move'], guard: ['select'], repair: ['move'], capture: ['attack', 'move'], return: ['move'], deliver: ['move'] };

// A Carryall's orders are its own (src/sim/carryall.js orderCarryalls): G is its Duty, D its Drop.
const CARRYALL = { move: 'move', lift: 'lift', guard: 'duty', duty: 'duty', deploy: 'drop', drop: 'drop' };
const CAPTURERS = new Set(['soldier', 'infantry', 'trooper', 'troopers']);   // src/sim/capture.js canCapture
const REPAIRED = new Set(['tracked', 'wheeled', 'harvester']);                // src/sim/repair-bay.js: ground vehicles
const armed = (t) => !!(t?.weapon && WEAPONS[t.weapon] && (t.damage > 0 || WEAPONS[t.weapon].gas));   // src/sim/combat.js isArmed

export const voiceGroup = (typeId) => VOICE_GROUPS[typeId] ?? null;
export const unitLine = (group, kind, n) => `unit.${group}.${kind}.${n}`;
export const isFootLine = (id) => FOOT_GROUPS.has(parseUnitLine(id)?.group);

/** { group, kind, n } of a unit line id, or null. */
export function parseUnitLine(id) {
  const m = /^unit\.(\w+)\.(\w+)\.(\d+)$/.exec(String(id));
  return m && VARIANTS[m[1]]?.[m[2]] >= +m[3] && +m[3] > 0 ? { group: m[1], kind: m[2], n: +m[3] } : null;
}

/**
 * The kind of reply a unit gives to a sim command (src/sim/orders.js applyCommand types), or null when
 * it would not take that order or the order goes unanswered (stop). `unit` is a world unit or any
 * { typeId, type, cargo }.
 */
export function replyKind(cmdType, unit) {
  const t = unit?.type, id = unit?.typeId;
  if (!t || !voiceGroup(id)) return null;
  if (id === 'carryall') {
    if (cmdType === 'returnToBase' || cmdType === 'repairAt') return unit.cargo ? 'deliver' : null;   // it brings its load home
    return CARRYALL[cmdType] ?? null;
  }
  if (t.autonomous) return null;   // the Fremen go their own way
  switch (cmdType) {
    case 'move': return 'move';
    case 'attackMove': return armed(t) ? 'attackMove' : 'move';   // unarmed units simply move (orderAttackMove)
    case 'attack': return armed(t) ? 'attack' : null;
    case 'guard': return 'guard';
    case 'scatter': return 'scatter';
    case 'capture': return CAPTURERS.has(id) ? 'capture' : null;
    case 'sabotage': return t.sabotage ? 'sabotage' : null;
    case 'harvest': return id === 'harvester' ? 'harvest' : null;
    case 'returnToBase': return id === 'harvester' ? 'return' : null;
    case 'repairAt': return REPAIRED.has(t.move) ? 'repair' : null;
    case 'deploy': return t.deploysTo ? 'deploy' : t.destructs ? 'destruct' : null;   // D: an MCV deploys, a Devastator blows up
    case 'destruct': return t.destructs ? 'destruct' : null;
    default: return null;   // stop, and every production or structure order
  }
}

/** The kind a group actually has words for: `kind` itself, else its nearest stand-in; null: none. */
export function voicedKind(group, kind) {
  const have = VARIANTS[group];
  if (!have || !kind) return null;
  return [kind, ...(FALLBACK[kind] ?? [])].find((k) => have[k] > 0) ?? null;
}

/** A variant 1..count drawn by `rng`, never `last` again when there is another. */
export function pickVariant(count, last, rng = Math.random) {
  if (!(count > 1)) return 1;
  const fresh = last >= 1 && last <= count, choices = fresh ? count - 1 : count;
  const n = 1 + (Math.floor(rng() * choices) % choices);
  return fresh && n >= last ? n + 1 : n;
}

/** Every unit line id there is, in a stable order. */
export function unitLineIds() {
  const ids = [];
  for (const [group, kinds] of Object.entries(VARIANTS)) for (const [kind, count] of Object.entries(kinds)) for (let n = 1; n <= count; n++) ids.push(unitLine(group, kind, n));
  return ids;
}
