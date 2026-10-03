// What the campaign screens say, from the story stream's words (contract C4, src/data/story.js) and the mission
// list (C1, src/data/campaign.js), both loaded when the campaign first opens. Either may be missing or partial
// while the streams land, so every lookup has a plain fallback and the screens work without them.
import { HOUSES } from '../../data/houses.js';

const name = (house) => HOUSES[house]?.name ?? house;
const lines = (v) => (Array.isArray(v) ? v.filter((l) => typeof l === 'string' && l.trim()) : typeof v === 'string' && v.trim() ? [v] : []);

/** The modules the campaign reads, each imported on its own so one missing does not hide the other. */
export async function loadWords({ story = () => import('../../data/story.js'), missions = () => import('../../data/campaign.js') } = {}) {
  const get = async (load, what) => { try { return await load(); } catch (err) { console.warn(`campaign: ${what} not available (${err?.message ?? err})`); return null; } };
  const [s, m] = await Promise.all([get(story, 'story'), get(missions, 'mission list')]);
  return words(s, m);
}

/** Lookups over the two modules (either may be null). */
export function words(story, missions) {
  const def = (house, n) => { try { return missions?.missionDef?.(house, n) ?? null; } catch { return null; } };
  const brief = (house, n) => story?.BRIEFINGS?.[house]?.[n - 1] ?? null;
  return {
    story: !!story,
    missions: !!missions,
    mentat: (house) => story?.MENTATS?.[house]?.name ?? HOUSES[house]?.mentat ?? 'Mentat',
    /** The house's description pages (three on the Sega), each a few lines. */
    pages(house) {
      const pages = (story?.HOUSE_PAGES?.[house] ?? []).map(lines).filter((p) => p.length);
      return pages.length ? pages : [[`House ${name(house)}.`, 'Its Mentat\'s words are not available.']];
    },
    question(house) {
      try { const q = story?.joinQuestion?.(house); if (typeof q === 'string' && q.trim()) return q; } catch { /* the fallback */ }
      return `Do you wish to join House ${name(house)}?`;
    },
    briefing: (house, n) => { const b = lines(brief(house, n)?.briefing); return b.length ? b : ['Briefing not available.']; },
    advice: (house, n) => { const b = lines(brief(house, n)?.advice); return b.length ? b : ['No advice for this mission.']; },
    win: (house, n) => { const b = lines(brief(house, n)?.win); return b.length ? b : ['You have done well. The land is ours.']; },
    lose: (house, n) => { const b = lines(brief(house, n)?.lose); return b.length ? b : ['You have failed. Try again.']; },
    ending: (house) => lines(story?.ENDINGS?.[house]),
    caption: (house, step) => lines(story?.MAP_CAPTIONS?.[house]?.[step]).join(' ') || null,
    /** The mission's short title from the mission list, or null. */
    title: (house, n) => (typeof def(house, n)?.title === 'string' && def(house, n).title.trim() ? def(house, n).title : null),
    objective(house, n) {
      const o = def(house, n)?.objective;
      const quota = Number(o?.quota).toLocaleString('en-US');
      if (o?.kind === 'quota') return `Harvest ${quota} credits of spice`;
      if (o?.kind === 'quotaOrDestroy') return `Harvest ${quota} credits of spice, or destroy the enemy`;
      if (o?.kind === 'destroy') return 'Destroy every enemy base';
      return null;
    },
    enemies: (house, n) => (Array.isArray(def(house, n)?.enemies) ? def(house, n).enemies.map((id) => (id === 'sardaukar' ? 'the Emperor\'s Sardaukar' : `House ${name(id)}`)) : []),
  };
}
