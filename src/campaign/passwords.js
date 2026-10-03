// The Sega release's passwords (research.md §6): one word per house for missions 2 to 9. Completing a mission shows
// the word for the next one; typing it on the password screen starts that mission. Entry ignores case and anything
// but letters, as the original's letter grid only had letters.

export const PASSWORDS = {
  atreides: ['DIPLOMATIC', 'SPICEDANCE', 'ETERNALSUN', 'DEFTHUNTER', 'FAIRMENTAT', 'ASHLIKENNY', 'SONICBLAST', 'DUNERUNNER'],
  ordos: ['DOMINATION', 'SPICESABRE', 'ARRAKISSUN', 'COLDHUNTER', 'WILYMENTAT', 'SLYMELANIE', 'STEALTHWAR', 'POWERCRUSH'],
  harkonnen: ['DEMOLITION', 'SPICESATYR', 'BURNINGSUN', 'DARKHUNTER', 'EVILMENTAT', 'ITSJOEBWAN', 'DEVASTATOR', 'DEATHRULER'],
};
export const PASSWORD_LENGTH = 10;

/** The word that starts `house`'s mission `mission` (2..9), or null. */
export function passwordFor(house, mission) {
  return Number.isInteger(mission) && mission >= 2 && mission <= 9 ? PASSWORDS[house]?.[mission - 2] ?? null : null;
}

/** The word shown for completing `house`'s mission `mission`: the next mission's; none after the last. */
export function completionPassword(house, mission) { return passwordFor(house, mission + 1); }

export function normalisePassword(text) { return String(text ?? '').toUpperCase().replace(/[^A-Z]/g, ''); }

/** { house, mission } for a password, or null when it opens nothing. */
export function readPassword(text) {
  if (typeof text !== 'string') return null;
  const word = normalisePassword(text);
  for (const [house, words] of Object.entries(PASSWORDS)) {
    const i = words.indexOf(word);
    if (i >= 0) return { house, mission: i + 2 };
  }
  return null;
}
