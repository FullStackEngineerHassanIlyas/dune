// What the player hears (spec §6): simulation events become sound cues placed where they happen. Only
// what the player can see is heard; interface sounds (placements, errors, sales) belong to the player.
const WEAPON = { rifle: 'rifle', pistol: 'rifle', trooperRocket: 'rifle', mg: 'mg', cannon: 'cannon', turretGun: 'cannon', heavyCannon: 'heavyCannon', plasma: 'heavyCannon', sonic: 'heavyCannon' };
const EXPLOSION = { small: 'explosionSmall', medium: 'explosionMedium', large: 'explosionLarge' };
const ERRORS = new Set(['insufficientFunds', 'cannotPlace', 'busy', 'cannotDeploy', 'soldOut', 'frigateFull']);

export function cueFor(e, me, seen) {
  const at = (id, x, z) => (seen(x, z) ? { id, x, z } : null);
  const mine = e.house === me;
  switch (e.type) {
    case 'fired': return at(e.projectile === 'rocket' ? 'rocket' : WEAPON[e.weapon] ?? 'rifle', e.x, e.y);
    case 'impact': return e.projectile === 'rocket' ? at('explosionSmall', e.x, e.y) : e.projectile === 'shell' ? at('hit', e.x, e.y) : null;
    case 'explosion': return at(EXPLOSION[e.size] ?? 'explosionSmall', e.x, e.y);
    case 'unitDestroyed': return e.cause === 'crushed' ? at('crush', e.x, e.y) : null;
    case 'structurePlaced': case 'deployed': return mine ? at('clunk', e.x + 1, e.y + 1) : null;
    case 'sold': return mine ? { id: 'sell' } : null;
    case 'repairToggled': return mine && e.on ? { id: 'ratchet' } : null;
    case 'productionReady': return mine ? { id: 'ready' } : null;
    case 'eva': return mine ? { id: ERRORS.has(e.key) ? 'error' : 'beep' } : null;
    case 'bayEntered': return mine ? at('ratchet', e.x, e.y) : null;
    case 'unitRepaired': return mine ? at('clunk', e.x, e.y) : null;
    case 'structureCaptured': return e.to === me ? at('clunk', e.x + e.w / 2, e.y + e.h / 2) : null;
    case 'pickedUp': case 'setDown': return mine ? at('clunk', e.x, e.y) : null;
    default: return null;
  }
}
