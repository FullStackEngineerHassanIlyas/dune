// The original game's pictures on the campaign's screens, from the player's own Dune II PC files (Options →
// Original Game Files; src/core/user-files.js keeps them in this browser): each house's Mentat as the original
// drew him (original-mentat-art.js) and the house emblems of the original's house selection. While "Original
// pictures" is on and the files gave them, loadOriginalPictures() makes them once (pictures enlarged by whole pixels,
// as PNG data: URLs) and keeps them here for the screens to take synchronously; switching them off, forgetting the
// files or reading new ones makes them again (the store tells this module). Without them every screen keeps this
// game's own art.
import { buildMentatArt, buildEmblemArt } from './original-mentat-art.js';

const state = { value: null, loading: null, generation: 0, files: null, followed: false };

// told by the store (user-files.js follow(), held weakly there, so kept here) when the pictures or their switch change
const follower = {
  picturesChanged() {
    state.generation++;
    state.value = null;
    state.loading = null;
    if (state.files) loadOriginalPictures({ files: state.files }).catch(() => {});
  },
};

/**
 * Makes the pictures (once; again after a change): resolves { mentats: { house: { figure, rig, info } }, emblems:
 * { house: markup } }, or null while the original pictures are off or not there. `files`: the store module
 * (tests pass a fake; by default src/core/user-files.js, loaded on first use).
 */
export function loadOriginalPictures({ files = null } = {}) {
  if (state.loading) return state.loading;
  const generation = state.generation;
  state.loading = (async () => {
    const store = files ?? state.files ?? await import('../../core/user-files.js');
    state.files = store;
    if (!state.followed && typeof store.follow === 'function') { store.follow(follower); state.followed = true; }
    let pictures = null;
    try { pictures = await store.originalPictures(); } catch (err) { console.warn('original pictures:', err?.message ?? err); }
    let value = null;
    if (pictures?.size) {
      value = { mentats: {}, emblems: {} };
      await Promise.all([...pictures.values()].map(async (p) => {   // side by side: the PNGs are packed off the main thread
        try {
          if (p.kind === 'mentat') value.mentats[p.house] = await buildMentatArt(p);
          else if (p.kind === 'emblem') value.emblems[p.house] = await buildEmblemArt(p);
        } catch (err) { console.warn(`original pictures: ${p.name}:`, err?.message ?? err); }
      }));
    }
    if (generation === state.generation) state.value = value;
    return value;
  })();
  return state.loading;
}

export const PICTURES_WAIT = 1500;   // ms the campaign's first words wait for the pictures at most

/**
 * loadOriginalPictures(), waited for `wait` ms at most: resolves what was made, or null when it failed or takes
 * longer (a browser whose store never answers, as Safari's indexedDB.open has been known to hang, must not hold the
 * campaign's words up). What is made later is still kept for the screens after.
 */
export function loadOriginalPicturesWithin(wait = PICTURES_WAIT, options = {}) {
  let timer = null;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(null), wait); });
  return Promise.race([loadOriginalPictures(options).catch(() => null), late]).finally(() => clearTimeout(timer));
}

/** What loadOriginalPictures() made, or null (not loaded yet, off, or not there). */
export function currentPictures() { return state.value; }

/** The house's emblem from the original's house selection, as markup for the crest box (.cp-crest), or null. */
export function originalEmblem(house, pictures = state.value) { return pictures?.emblems?.[house] ?? null; }

/** Forgets what was made (tests; the next load makes it again). */
export function resetOriginalPictures() {
  state.generation++;
  Object.assign(state, { value: null, loading: null, files: null });
}
