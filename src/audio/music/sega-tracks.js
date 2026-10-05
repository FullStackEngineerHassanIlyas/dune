// The player's music slots and the Sega soundtrack's place in them (spec §6 Music, Original files; research.md §9).
// SLOTS is the one list of moments the player's own files can take over: the menu's moods, the in-game tunes and
// the endings. A track imported from the player's own rip of the Mega Drive game is put in its slots by the English
// title in its GD3 tag (else its file name), as research §9 heard each one play in the Sega game: the Opening under
// the intro and the title, the Mentats' themes at the briefings, five tunes in random order in every mission, a
// victory theme and a dirge per house. The Starport loop (the Sega tutorial's) and the German versions go nowhere.
// Pure data: no DOM, no audio.

export const SLOTS = [
  'intro', 'menu', 'houseSelect', 'briefing-atreides', 'briefing-harkonnen', 'briefing-ordos', 'region',
  'ingame', 'peace', 'battle',
  'victory-atreides', 'victory-harkonnen', 'victory-ordos', 'defeat-atreides', 'defeat-harkonnen', 'defeat-ordos',
  'finale', 'credits',
];

/** What each slot is called on the Original Game Files page. */
export const SLOT_LABELS = {
  intro: 'Intro', menu: 'Title and menus', houseSelect: 'House selection',
  'briefing-atreides': 'Atreides Mentat', 'briefing-harkonnen': 'Harkonnen Mentat', 'briefing-ordos': 'Ordos Mentat',
  region: 'Region map', ingame: 'In a mission', peace: 'Peace (adaptive music)', battle: 'Battle (adaptive music)',
  'victory-atreides': 'Atreides victory', 'victory-harkonnen': 'Harkonnen victory', 'victory-ordos': 'Ordos victory',
  'defeat-atreides': 'Atreides defeat', 'defeat-harkonnen': 'Harkonnen defeat', 'defeat-ordos': 'Ordos defeat',
  finale: 'Finale', credits: 'Credits',
};

/**
 * The choices a track's slot selector offers: a value (slots joined by commas; '' = not used) and its words. The
 * Opening's pair comes first, as the Sega game plays it under the intro and on under the title.
 */
export const SLOT_CHOICES = [
  ['', 'Not used'],
  ['intro,menu', 'Intro, then the title'],
  ...SLOTS.map((s) => [s, SLOT_LABELS[s]]),
];

/** The Sega soundtrack by its in-game Music Test names (research §9), and the slots each one plays in. */
export const SEGA_TRACKS = [
  { title: 'Opening', slots: ['intro', 'menu'] },
  { title: 'Cyril\'s Council', slots: ['briefing-atreides'] },
  { title: 'Ammon\'s Advice', slots: ['briefing-ordos'] },
  { title: 'Radnor\'s Scheme', slots: ['briefing-harkonnen'] },
  { title: 'The Lego Tune', slots: ['ingame'] },
  { title: 'Turbulence', slots: ['ingame'] },
  { title: 'Spice Trip', slots: ['ingame'] },
  { title: 'Command Post', slots: ['ingame'] },
  { title: 'Trenching', slots: ['ingame'] },
  { title: 'Starport', slots: [] },                 // the tutorial's loop: no tutorial here
  { title: 'Evasive Action', slots: ['region'] },
  { title: 'Chosen Destiny', slots: ['houseSelect'] },
  { title: 'Conquest', slots: ['victory-atreides'] },
  { title: 'Slitherin', slots: ['victory-ordos'] },
  { title: 'Harkonnen Rules', slots: ['victory-harkonnen'] },
  { title: 'Atreides Dirge', aka: ['Atredies Dirge'], slots: ['defeat-atreides'] },   // the rip's file name misspells it
  { title: 'Ordos Dirge', slots: ['defeat-ordos'] },
  { title: 'Harkonnen Dirge', slots: ['defeat-harkonnen'] },
  { title: 'Finale', slots: ['finale'] },
  { title: 'Credit Roll', slots: ['credits'] },
];

/** A title or file name boiled down for matching: "16 - Atredies Dirge.vgz" → "atredies dirge". */
export function normaliseTitle(text) {
  return String(text ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\.(vgm|vgz|mp3|ogg|oga|wav)$/, '')
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9()]+/g, ' ')
    .replace(/^\s*\d+\s*/, '')          // a track number in front
    .replace(/^the /, '')
    .trim();
}

const BY_NAME = new Map();
for (const t of SEGA_TRACKS) for (const name of [t.title, ...(t.aka ?? [])]) BY_NAME.set(normaliseTitle(name), t);

/** A German version (the German edition's sung Opening and Credit Roll): kept out, English only. */
export function isGerman(text) {
  return /\b(german|deutsch)\b/i.test(String(text ?? ''));
}

/** The Sega track a title (or failing that, a file name) names, or null. */
export function segaTrack(title, fileName = '') {
  for (const t of [title, fileName]) {
    if (!t || isGerman(t)) continue;
    const hit = BY_NAME.get(normaliseTitle(t));
    if (hit) return hit;
  }
  return null;
}

/** The slots an imported track goes in: the Sega table's, else none (the player picks them in the Music Test). */
export function autoSlots(title, fileName = '') {
  return [...(segaTrack(title, fileName)?.slots ?? [])];
}
