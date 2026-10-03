// Saved campaign progress (spec §7: "Progress is saved in localStorage"), under its own key since the settings
// drop keys they do not know. Per house: the next mission to play (10 once the house has won Arrakis) and the
// best score of each mission won; plus the house played last and the last result, which the results screens
// show after the battle's frame closes. Storage is injected (tests) and may be missing, blocked, full or hold
// junk: a load then starts an empty campaign and a save says it could not, and the game carries on either way.
import { CAMPAIGN_HOUSES, MISSIONS, missionNumber } from './result.js';
import { rankFor } from './score.js';

export const KEY = 'dune2-3d.campaign';
export const VERSION = 1;
export const DONE = MISSIONS + 1;   // a house's "next mission" once it has won the last

export function emptyProgress() { return { version: VERSION, house: null, houses: {}, last: null }; }

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : null);

function cleanHouse(raw) {
  if (!isObject(raw)) return null;
  const n = Math.floor(Number(raw.mission));
  const best = {};
  if (isObject(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (missionNumber(k) && count(v) !== null) best[Number(k)] = count(v);
  return { mission: Number.isFinite(n) ? Math.min(DONE, Math.max(1, n)) : 1, best };
}

function cleanResult(raw) {
  if (!isObject(raw) || !CAMPAIGN_HOUSES.includes(raw.house) || !missionNumber(raw.mission)) return null;
  const pair = (v) => (Array.isArray(v) ? [count(v[0]) ?? 0, count(v[1]) ?? 0] : [0, 0]);
  const score = count(raw.score) ?? 0;
  const out = { house: raw.house, mission: Number(raw.mission), won: raw.won === true, draw: raw.draw === true, seconds: count(raw.seconds) ?? 0 };
  for (const k of ['minutes', 'credits', 'survivingValue', 'killedValue', 'lostValue']) out[k] = count(raw[k]) ?? 0;
  return { ...out, score, rank: rankFor(score), rows: { spice: pair(raw.rows?.spice), units: pair(raw.rows?.units), structures: pair(raw.rows?.structures) } };
}

/** A progress record with every field valid; anything that is not a version-1 record is an empty campaign. */
export function cleanProgress(raw) {
  if (!isObject(raw) || raw.version !== VERSION) return emptyProgress();
  const houses = {};
  for (const id of CAMPAIGN_HOUSES) { const h = cleanHouse(raw.houses?.[id]); if (h) houses[id] = h; }
  return { version: VERSION, house: CAMPAIGN_HOUSES.includes(raw.house) ? raw.house : null, houses, last: cleanResult(raw.last) };
}

function storage() { try { return globalThis.localStorage ?? null; } catch { return null; } }

export function loadProgress(store = storage()) {
  try { return cleanProgress(JSON.parse(store?.getItem(KEY) ?? 'null')); } catch { return emptyProgress(); }
}

/** Saves; false when the store is missing or refuses (private mode, full): the campaign goes on for this visit. */
export function saveProgress(progress, store = storage()) {
  if (!store) return false;
  try { store.setItem(KEY, JSON.stringify(cleanProgress(progress))); return true; } catch { return false; }
}

const withHouse = (p, house, record) => ({ ...p, house, houses: { ...p.houses, [house]: record } });

/** A new campaign for `house` (the house selection's "yes"): mission 1, its best scores kept. */
export function joinHouse(progress, house) {
  return withHouse(progress, house, { mission: 1, best: { ...(progress.houses[house]?.best ?? {}) } });
}

/** A password: `house` goes straight to `mission`. */
export function jumpTo(progress, house, mission) {
  return withHouse(progress, house, { mission, best: { ...(progress.houses[house]?.best ?? {}) } });
}

/** A mission's result (src/campaign/result.js readResult): a win opens the next mission and keeps the best score. */
export function recordResult(progress, result) {
  const { house, mission, won, score } = result;
  const was = progress.houses[house] ?? { mission, best: {} };
  const best = { ...was.best };
  if (won) best[mission] = Math.max(best[mission] ?? 0, score);
  return { ...withHouse(progress, house, { mission: won ? Math.min(DONE, mission + 1) : mission, best }), last: result };
}

const ORDER = (p) => [...(p.house ? [p.house] : []), ...CAMPAIGN_HOUSES.filter((id) => id !== p.house)];

/** The campaigns that can be continued, the current house first: [{ house, mission }]. */
export function continues(progress) {
  return ORDER(progress).filter((id) => progress.houses[id] && progress.houses[id].mission < DONE).map((house) => ({ house, mission: progress.houses[house].mission }));
}

/** Houses that have won the whole campaign. */
export function finished(progress) { return ORDER(progress).filter((id) => progress.houses[id]?.mission === DONE); }
