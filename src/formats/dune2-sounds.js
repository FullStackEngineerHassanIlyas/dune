// What the clips in the player's own Dune II files mean to this game (spec §6 Original files; research
// audio-ui-controls.md §A.1, after OpenDUNE's g_table_voices and g_feedback). The original builds most
// announcements from word clips played back to back ("Warning" + "Harkonnen" + "unit" + "approaching");
// the announcer's words carry the speaking house's letter (AENEMY.VOC, HENEMY.VOC, OENEMY.VOC; Mercenary
// M, and the Fremen and Sardaukar borrow the Ordos and Harkonnen voices), while the units' replies are
// one set shared by every house (ZAFFIRM.VOC; the 1.07 US data names a few without the Z) and the effects
// carry no letter at all (EXSMALL.VOC). Lines and effects found nowhere in the files stay this game's own.
// Original clips are brought to this game's levels (measured with synth.js's meter, the loudest 400 ms
// K-weighted): the voice to its Kokoro lines', each effect to the synthesized sound it stands in for.
import { RATE, loudness } from '../audio/synth.js';
import { joinClips } from './voc.js';

/** The letter of each house's announcer files. */
export const HOUSE_LETTER = { atreides: 'A', harkonnen: 'H', ordos: 'O', fremen: 'O', sardaukar: 'H', mercenary: 'M' };
/** The word naming a house, as the announcer says it ('*' in LINE_WORDS: the player's own). The Mercenaries have none: "Unit deployed". */
export const HOUSE_WORD = { atreides: 'ATRE', harkonnen: 'HARK', ordos: 'ORDOS', fremen: 'FREMEN', sardaukar: 'SARD' };
/** Prefixes the shared clips may carry: English Z, none (1.07 US), French F, German G. */
export const SHARED_PREFIXES = ['Z', '', 'F', 'G'];

/** A line naming a house (voice.js namedLine): `lead`, the house (or "enemy"), then `tail` — `sard` for the Sardaukar, who are no "unit". */
const named = (group, lead, tail, sard) => Object.fromEntries([
  [`${group}.enemy`, [...lead, 'ENEMY', ...tail]],
  ...['atreides', 'harkonnen', 'ordos', 'fremen'].map((id) => [`${group}.${id}`, [...lead, HOUSE_WORD[id], ...tail]]),
  [`${group}.sardaukar`, [...lead, 'SARD', ...sard]],
]);

/**
 * Announcer lines (src/audio/voice.js ids) → the house-voiced word clips the original strings together.
 * '*' is the player's own house (the original names whose unit was deployed or lost). Lines the original
 * never spoke (building, on hold, insufficient funds, …) are not here: they keep this game's voice.
 */
export const LINE_WORDS = {
  constructionComplete: ['CONST'],
  unitReady: ['*', 'UNIT', 'DEPLOY'],
  harvesterDeployed: ['*', 'HARVEST', 'DEPLOY'],
  unitLost: ['*', 'UNIT', 'DESTROY'],
  structureLost: ['*', 'STRUCT', 'DESTROY'],
  radarOn: ['RADAR', 'ON'],
  radarOff: ['RADAR', 'OFF'],
  wormsign: ['WARNING', 'WORMY'],
  frigateArrived: ['FRIGATE', 'ARRIVE'],
  missileLaunched: ['MISSILE', 'LAUNCH'],
  missileApproaching: ['MISSILE', 'LAUNCH'],   // the original has no "approaching" for it: every launch is "Missile launched"
  baseAttack: ['ATTACK'],                      // the spoken word; "Our base is under attack" was the banner (research §A.1)
  missionAccomplished: ['WIN'],
  missionFailed: ['LOSE'],
  ...named('approaching', ['WARNING'], ['UNIT', 'APPRCH'], ['APPRCH']),        // "Warning, Harkonnen unit approaching"; "Warning, Sardaukar approaching"
  ...named('unitDestroyed', [], ['UNIT', 'DESTROY'], ['DESTROY']),             // "Ordos unit destroyed"; "Sardaukar destroyed"
  ...named('structureDestroyed', [], ['STRUCT', 'DESTROY'], ['STRUCT', 'DESTROY']),
};

/** The units' replies (voice.js ACK_LINES) → the shared clip the original answers with: REPORT1–3 on selection, AFFIRM, MOVEOUT, OVEROUT on orders. */
export const ACK_CLIPS = {
  reporting: 'REPORT1', standingBy: 'REPORT2', awaitingOrders: 'REPORT3',
  affirmative: 'AFFIRM', acknowledged: 'OVEROUT', movingOut: 'MOVEOUT', onOurWay: 'MOVEOUT', engaging: 'AFFIRM', attacking: 'AFFIRM',
};

/**
 * Synthesized effects (src/audio/synth.js ids) → [the original clips that stand in for them, loudness in
 * LUFS of the synthesized sound]. Clip meanings from the research's file list; ROCKET, BUTTON, STATICP and
 * MISLTINP are read from their names alone (?). The screams (VSCREAM1–5), the worm (WORMET3P) and
 * EXDUD have no sound of ours to replace yet.
 */
export const EFFECT_CLIPS = {
  rifle: [['GUN'], -20.2], mg: [['GUNMULTI'], -18.1], cannon: [['EXCANNON'], -15.2], heavyCannon: [['EXCANNON'], -14.2],
  rocket: [['ROCKET'], -15], launchHeavy: [['MISLTINP'], -13], sandHit: [['EXSAND'], -19],
  explosionSmall: [['EXSMALL'], -14.1], explosionMedium: [['EXMED'], -13.1], explosionLarge: [['EXLARGE'], -12.1], explosionHuge: [['EXLARGE'], -11.1],
  gas: [['EXGAS'], -19], collapse: [['CRUMBLE'], -15], crush: [['SQUISH2'], -19], click: [['BUTTON'], -27.1], static: [['STATICP'], -23],
};
export const VOICE_LUFS = -14.3;   // the Kokoro lines' median on the same meter (they range -15.9 to -12.5)

/** A clip's name as stored: the file name in capitals without its extension ('AENEMY'). */
export const clipKey = (fileName) => String(fileName).toUpperCase().replace(/\.VOC$/, '');

/** The clip names a line needs for `house`, in order, or null when `has(name)` lacks one of them. */
export function resolveLine(id, house, has) {
  if (ACK_CLIPS[id]) {
    const name = SHARED_PREFIXES.map((p) => p + ACK_CLIPS[id]).find(has);
    return name ? [name] : null;
  }
  const words = LINE_WORDS[id], letter = HOUSE_LETTER[house];
  if (!words || !letter) return null;
  const names = [];
  for (const w of words) {
    const word = w === '*' ? HOUSE_WORD[house] : w;
    if (!word) continue;   // a house without a name of its own: "Unit deployed"
    const name = letter + word;
    if (!has(name)) return null;
    names.push(name);
  }
  return names;
}

/** Every line id the original files can voice. */
export const ORIGINAL_LINES = [...Object.keys(LINE_WORDS), ...Object.keys(ACK_CLIPS)];

/** Sound id → the clip names `has` holds for it ({ id: [names] }): its variations, when there are several. */
export function resolveEffects(has) {
  const out = {};
  for (const [id, [names]] of Object.entries(EFFECT_CLIPS)) {
    const found = names.filter(has);
    if (found.length) out[id] = found;
  }
  return out;
}

/** What a set of clip names holds, for the Original Files page: lines per playable house, replies, effects. */
export function summarize(names) {
  const has = (n) => names.has(n);
  const houses = {};
  for (const house of ['atreides', 'harkonnen', 'ordos']) {
    const ids = Object.keys(LINE_WORDS);
    houses[house] = { lines: ids.filter((id) => resolveLine(id, house, has)).length, of: ids.length };
  }
  const acks = Object.keys(ACK_CLIPS), effects = Object.keys(EFFECT_CLIPS);
  return {
    clips: names.size, houses,
    acknowledgements: { lines: acks.filter((id) => resolveLine(id, 'atreides', has)).length, of: acks.length },
    effects: { sounds: Object.keys(resolveEffects(has)).length, of: effects.length },
  };
}

// ——— levels ———

const KNEE = 0.5, CEILING = 0.97, MAX_GAIN = 24;   // dB: a near-silent clip is not blown up into hiss

/** Samples (at RATE) brought to `lufs` on synth.js's meter, rounding into a ceiling rather than clipping. In place. */
export function level(a, lufs) {
  const g = Math.pow(10, Math.min(MAX_GAIN, lufs - loudness(a)) / 20);
  for (let i = 0; i < a.length; i++) {
    const x = a[i] * g, m = Math.abs(x);
    a[i] = m <= KNEE ? x : Math.sign(x) * (KNEE + (CEILING - KNEE) * Math.tanh((m - KNEE) / (CEILING - KNEE)));
  }
  return a;
}

/** A line spoken from its word clips ([{ rate, pcm }]): played back to back at RATE, at the voices' level. */
export const voiceLine = (clips) => level(joinClips(clips, RATE), VOICE_LUFS);

/** An effect clip at RATE, at the level of the synthesized sound it replaces. */
export const effectSample = (clip, id) => level(joinClips([clip], RATE), EFFECT_CLIPS[id]?.[1] ?? -18);

export { RATE };
