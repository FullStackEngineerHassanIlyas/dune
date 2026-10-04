// What the player hears (spec §6): simulation events become sound cues placed where they happen. Only
// what the player can see is heard; interface sounds (placements, errors, sales) belong to the player.
// A shell that finds its target clangs, one that misses thumps into the sand; a vehicle that blows up
// rains debris after its blast, and a structure that goes up collapses with a rumble (a wall only bursts,
// as it does on screen: render/destruction.js). A sandworm roars as it breaks the sand, gulps down what it
// swallows (eaten units leave no debris) and roars again as it flees or dies; a spice bloom bursts with a
// whump and a hiss. The rumble of a worm under the sand is the battle stage's (game/battle-stage.js).
import { UNITS, onFoot } from '../data/units.js';
import { STRUCTURES } from '../data/structures.js';

const WEAPON = { rifle: 'rifle', pistol: 'rifle', trooperRocket: 'rifle', mg: 'mg', cannon: 'cannon', turretGun: 'cannon', heavyCannon: 'heavyCannon', plasma: 'heavyCannon', sonic: 'sonic' };
const EXPLOSION = { small: 'explosionSmall', medium: 'explosionMedium', large: 'explosionLarge' };
const LAUNCH = { rocket: 'rocket', gas: 'rocket', deathHand: 'launchHeavy' };   // shots that whoosh away
// what a shot sounds like where it lands: armour (vehicles, aircraft, a worm's hide) knocks dull and deep; a man takes a
// soft thwack; a building chips and crumbles; sand swallows it
const SHELL_ON = { structure: 'hitStructure', foot: 'sandHit' }, BULLET_ON = { foot: 'bulletSoft', structure: 'bulletChip' };
const IMPACT = { rocket: () => 'explosionSmall', gas: () => 'gas', shell: (hit, on) => (hit ? SHELL_ON[on] ?? 'hit' : 'sandHit'), bullet: (hit, on) => (hit ? BULLET_ON[on] ?? 'bulletHit' : null) };
const ERRORS = new Set(['insufficientFunds', 'cannotPlace', 'busy', 'cannotDeploy', 'soldOut', 'frigateFull', 'notReady']);

export function cueFor(e, me, seen) {
  const at = (id, x, z) => (id && seen(x, z) ? { id, x, z } : null);
  const mine = e.house === me;
  switch (e.type) {
    case 'fired': return at(LAUNCH[e.projectile] ?? WEAPON[e.weapon] ?? 'rifle', e.x, e.y);
    case 'impact': return at(IMPACT[e.projectile]?.(e.hit, e.target) ?? null, e.x, e.y);
    case 'explosion': return at(EXPLOSION[e.size] ?? 'explosionSmall', e.x, e.y);
    case 'deathHandBlast': return at('explosionHuge', e.x, e.y);
    case 'unitDestroyed':
      if (e.cause === 'eaten') return null;   // the worm's gulp ('wormAte') says it all
      if (e.typeId === 'sandworm') return at('wormRoar', e.x, e.y);
      return e.cause === 'crushed' ? at('crush', e.x, e.y) : UNITS[e.typeId] && !onFoot(UNITS[e.typeId].move) ? at('debris', e.x, e.y) : null;
    case 'wormSurfaced': case 'wormFled': return at('wormRoar', e.x, e.y);
    case 'wormAte': return at('wormGulp', e.x, e.y);
    case 'bloomErupted': return at('bloom', e.x, e.y);
    case 'structureDestroyed': return STRUCTURES[e.typeId]?.isWall ? null : at('collapse', e.x + e.w / 2, e.y + e.h / 2);
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
