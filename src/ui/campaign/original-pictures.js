// The original game's pictures on the campaign's screens, from the player's own Dune II PC files (Options →
// Original Game Files; src/core/user-files.js keeps them in this browser): each house's Mentat as the original
// drew him (original-mentat-art.js) and the house emblems of the original's house selection. While "Original
// pictures" is on and the files gave them, loadOriginalPictures() makes them once (the Mentats enlarged by a
// pixel-art scaler, the emblems by whole pixels, as PNG data: URLs; the house on the screen first, the others when
// the browser is idle) and keeps them here for the screens to take synchronously; switching them off, forgetting
// the files or reading new ones makes them again (the store tells this module). Without them every screen keeps
// this game's own art.
import { buildMentatArt, buildEmblemArt } from './original-mentat-art.js';

const state = { value: null, loading: null, ready: null, generation: 0, files: null, followed: false };

// told by the store (user-files.js follow(), held weakly there, so kept here) when the pictures or their switch change
const follower = {
  picturesChanged() {
    state.generation++;
    state.value = null;
    state.loading = null;
    state.ready = null;
    if (state.files) loadOriginalPictures({ files: state.files }).catch(() => {});
  },
};

/** Waits until the browser has nothing else to do (a second at most), or a moment where it cannot say. */
const idle = () => new Promise((resolve) => {
  if (typeof globalThis.requestIdleCallback === 'function') globalThis.requestIdleCallback(() => resolve(), { timeout: 1000 });
  else setTimeout(resolve, 0);
});

/**
 * Makes the pictures (once; again after a change): resolves { mentats: { house: { figure, rig, info } }, emblems:
 * { house: markup } }, or null while the original pictures are off or not there. `files`: the store module
 * (tests pass a fake; by default src/core/user-files.js, loaded on first use). With `first` (the house on the
 * screen) the emblems and that house's Mentat are made first and given to the screens (currentPictures(),
 * loadOriginalPicturesWithin()); the other Mentats are added one at a time when the browser is idle. Without it they
 * are given when all are made.
 */
export function loadOriginalPictures({ files = null, first = null } = {}) {
  if (state.loading) return state.loading;
  const generation = state.generation;
  let shown = null;
  state.ready = new Promise((resolve) => { shown = resolve; });
  const publish = (value) => {
    if (generation === state.generation) state.value = value;
    shown(value);
  };
  state.loading = (async () => {
    const store = files ?? state.files ?? await import('../../core/user-files.js');
    state.files = store;
    if (!state.followed && typeof store.follow === 'function') { store.follow(follower); state.followed = true; }
    let pictures = null;
    try { pictures = await store.originalPictures(); } catch (err) { console.warn('original pictures:', err?.message ?? err); }
    let value = null;
    if (pictures?.size) {
      value = { mentats: {}, emblems: {} };
      const make = async (p) => {
        try {
          if (p.kind === 'mentat') value.mentats[p.house] = await buildMentatArt(p);
          else if (p.kind === 'emblem') value.emblems[p.house] = await buildEmblemArt(p);
        } catch (err) { console.warn(`original pictures: ${p.name}:`, err?.message ?? err); }
      };
      // one at a time (side by side their work would run on in one long task and hold the page still)
      const all = [...pictures.values()], later = (p) => !!first && p.kind === 'mentat' && p.house !== first;
      for (const p of all.filter((q) => !later(q))) {
        if (generation !== state.generation) break;   // switched or read again: a newer load makes them
        await make(p);
      }
      publish(value);
      for (const p of all.filter(later)) {
        await idle();
        if (generation !== state.generation) break;
        await make(p);
      }
    }
    publish(value);
    return value;
  })();
  state.loading.catch(() => shown(null));
  return state.loading;
}

export const PICTURES_WAIT = 1500;   // ms the campaign's first words wait for the pictures at most

/**
 * loadOriginalPictures(), waited for `wait` ms at most: resolves what was made (with `first`, once that house's
 * Mentat is), or null when it failed or takes longer (a browser whose store never answers, as Safari's
 * indexedDB.open has been known to hang, must not hold the campaign's words up). What is made later is still kept
 * for the screens after.
 */
export function loadOriginalPicturesWithin(wait = PICTURES_WAIT, options = {}) {
  let timer = null;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(null), wait); });
  const loading = loadOriginalPictures(options).catch(() => null);
  return Promise.race([state.ready ?? loading, late]).finally(() => clearTimeout(timer));
}

/** What loadOriginalPictures() made, or null (not loaded yet, off, or not there). */
export function currentPictures() { return state.value; }

/** The house's emblem from the original's house selection, as markup for the crest box (.cp-crest), or null. */
export function originalEmblem(house, pictures = state.value) { return pictures?.emblems?.[house] ?? null; }

/** Forgets what was made (tests; the next load makes it again). */
export function resetOriginalPictures() {
  state.generation++;
  Object.assign(state, { value: null, loading: null, ready: null, files: null });
}
