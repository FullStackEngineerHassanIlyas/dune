// Every word a Mentat says on the campaign's screens, as the clips his voice is rendered in (scripts/voices/mentat.py)
// and played from (src/audio/mentat-voice.js): each house's three pages and the question before house select, each
// mission's briefing, advice, win and lose lines, and the last words after mission 9. The lines are the ones the
// screens show (src/ui/campaign/words.js reads the same story module), so a clip's words and its text match.

/** The kinds of clip, as the campaign screens ask for them. */
export const MISSION_KINDS = ['briefing', 'advice', 'win', 'lose'];
export const KINDS = ['page', 'question', ...MISSION_KINDS, 'ending'];

const lines = (v) => (Array.isArray(v) ? v.filter((l) => typeof l === 'string' && l.trim()) : typeof v === 'string' && v.trim() ? [v] : []);

/**
 * A clip's key within its house: 'page-2' (n: the page, from 1), 'question', 'm4-advice' (n: the mission),
 * 'ending'; null for a kind there is no clip of.
 */
export function clipKey(kind, n = null) {
  if (kind === 'page') return Number.isInteger(n) && n > 0 ? `page-${n}` : null;
  if (kind === 'question' || kind === 'ending') return kind;
  if (MISSION_KINDS.includes(kind)) return Number.isInteger(n) && n > 0 ? `m${n}-${kind}` : null;
  return null;
}

/** 'atreides/m4-advice' and the like. */
export const clipId = (house, kind, n = null) => { const key = clipKey(kind, n); return key && `${house}/${key}`; };

/** The text a clip speaks, as the manifest records it: its lines joined by newlines. */
export const clipText = (lineList) => lines(lineList).join('\n');

/**
 * Every clip of the story module (src/data/story.js): [{ id, house, key, kind, n, lines }] in a fixed order,
 * house by house. A house is one with a Mentat (MENTATS); the question is left out for a house that asks none.
 */
export function mentatClips(story) {
  const out = [];
  for (const house of Object.keys(story?.MENTATS ?? {})) {
    const add = (kind, n, l) => { const ls = lines(l); if (ls.length) out.push({ id: clipId(house, kind, n), house, key: clipKey(kind, n), kind, n, lines: ls }); };
    (story.HOUSE_PAGES?.[house] ?? []).forEach((page, i) => add('page', i + 1, page));
    let question = null;
    try { question = story.joinQuestion?.(house) ?? null; } catch { question = null; }
    add('question', null, question);
    (story.BRIEFINGS?.[house] ?? []).forEach((b, i) => { for (const kind of MISSION_KINDS) add(kind, i + 1, b?.[kind]); });
    add('ending', null, story.ENDINGS?.[house]);
  }
  return out;
}
