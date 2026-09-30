// What the player hears (spec §6): simulation events become sound cues placed where they happen. Only
// what the player can see is heard; interface sounds (placements, errors, sales) belong to the player.
// A shell that finds its target clangs, one that misses thumps into the sand; a vehicle that blows up
// rains debris after its blast, and a structure that goes up collapses with a rumble.
import { UNITS, onFoot } from '../data/units.js';

const WEAPON = { rifle: 'rifle', pistol: 'rifle', trooperRocket: 'rifle', mg: 'mg', cannon: 'cannon', turretGun: 'cannon', heavyCannon: 'heavyCannon', plasma: 'heavyCannon', sonic: 'sonic' };
const EXPLOSION = { small: 'explosionSmall', medium: 'explosionMedium', large: 'explosionLarge' };
const LAUNCH = { rocket: 'rocket', gas: 'rocket', deathHand: 'launchHeavy' };   // shots that whoosh away
const IMPACT = { rocket: () => 'explosionSmall', gas: () => 'gas', shell: (hit) => (hit ? 'hit' : 'sandHit'), bullet: (hit) => (hit ? 'bulletHit' : null) };
const ERRORS = new Set(['insufficientFunds', 'cannotPlace', 'busy', 'cannotDeploy', 'soldOut', 'frigateFull', 'notReady']);

export function cueFor(e, me, seen) {
  const at = (id, x, z) => (id && seen(x, z) ? { id, x, z } : null);
  const mine = e.house === me;
  switch (e.type) {
    case 'fired': return at(LAUNCH[e.projectile] ?? WEAPON[e.weapon] ?? 'rifle', e.x, e.y);
    case 'impact': return at(IMPACT[e.projectile]?.(e.hit) ?? null, e.x, e.y);
    case 'explosion': return at(EXPLOSION[e.size] ?? 'explosionSmall', e.x, e.y);
    case 'deathHandBlast': return at('explosionHuge', e.x, e.y);
    case 'unitDestroyed': return e.cause === 'crushed' ? at('crush', e.x, e.y) : UNITS[e.typeId] && !onFoot(UNITS[e.typeId].move) ? at('debris', e.x, e.y) : null;
    case 'structureDestroyed': return at('collapse', e.x + e.w / 2, e.y + e.h / 2);
    case 'structurePlaced': case 'deployed': return mine ? at('clunk', e.x + 1, e.y + 1) : null;
    case 'concretePlaced': return mine ? at('slab', e.x + e.w / 2, e.y + e.h / 2) : null;
    case 'sold': return mine ? { id: 'sell' } : null;
    case 'repairToggled': return mine && e.on ? { id: 'ratchet' } : null;
    case 'productionReady': return mine ? { id: 'ready' } : null;
    case 'eva': return mine ? { id: ERRORS.has(e.key) ? 'error' : 'beep' } : null;
    case 'bayEntered': return mine ? at('ratchet', e.x, e.y) : null;
    case 'unitRepaired': return mine ? at('clunk', e.x, e.y) : null;
    case 'structureCaptured': return e.to === me ? at('clunk', e.x + e.w / 2, e.y + e.h / 2) : null;
    case 'destructArmed': return at('alarm', e.x, e.y);
    case 'pickedUp': case 'setDown': return mine ? at('clunk', e.x, e.y) : null;
    case 'frigateLanded': return at('jet', e.x, e.y);
    case 'docked': return Number.isFinite(e.x) && Number.isFinite(e.y) ? at('harvesterUnload', e.x, e.y) : null;   // the event needs a place to be heard
    default: return null;
  }
}
