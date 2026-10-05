// Skirmish set-up (spec §5.8): the player's house, one to three computer opponents (each its own house and
// difficulty) and whether the computers are allied against the player (default: a free-for-all), tech level,
// sandworms, map size and seed, starting credits, map visibility and game speed. The
// choice is remembered for next time and becomes the battle's URL (opponents=harkonnen:hard,ordos:normal …).
// House rule (docs/superpowers/notes/2026-10-03-phase2-opponents.md): no house plays twice; the player picks a
// Great House, the computer may also field the Sardaukar or the Mercenaries; a Small map holds two opponents.
import { h } from './dom.js';
import { HOUSES, PLAYABLE_HOUSES, SKIRMISH_HOUSES } from '../data/houses.js';
import { DIFFICULTY } from '../sim/ai.js';
import { techOpens } from '../sim/tech.js';
import { maxOpponents, formatOpponents, WORMS, TECH_LEVELS } from '../game/setup.js';
import { changeSetting } from './options.js';

export const MAP_SIZES = [[48, 'Small'], [64, 'Medium'], [96, 'Large'], [128, 'Huge']];
export const CREDITS = [1000, 3000, 5000, 10000];
export const DEFAULT_SETUP = { house: 'atreides', opponents: [{ house: 'random', difficulty: 'normal' }], allied: false, techLevel: 9, worms: 'few', size: 64, seed: null, credits: 3000, visibility: 'shroud' };
const ALLIED_NOTES = {
  false: 'Free for all: the computers fight each other as well as you.',
  true: 'The computers are one side: they never fight each other, share what they see and all come for you. You win when every one of them is out.',
};
export const VISIBILITY_CHOICES = [['shroud', 'Dune II shroud'], ['fog', 'Fog of war'], ['revealed', 'Revealed']];
const VISIBILITY_NOTES = {
  shroud: 'As in the original: black until explored; ground once seen stays in view, enemies on it too.',
  fog: 'C&C style: explored ground goes dim out of sight and hides enemy units; everything sees at least as far as it shoots.',
  revealed: 'The whole map and everything on it, from the start.',
};
const WORM_NOTES = { off: 'No sandworms.', few: 'Sandworms roam the open sand and swallow what crosses it: keep to the rock.', many: 'More worms, and hungrier: the open sand is no place to linger.' };
const KEY = 'dune2-3d.skirmish';
const SPECIALS = { atreides: 'Sonic Tank · Fremen warriors', harkonnen: 'Devastator · Death Hand missile', ordos: 'Deviator · Saboteur' };
const DIFFICULTIES = () => Object.keys(DIFFICULTY);

/** A set-up with every field valid, from whatever was stored; a set-up saved with one `enemy` becomes its one opponent. */
export function cleanSetup(raw = {}) {
  const s = { ...DEFAULT_SETUP, ...raw };
  const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
  const house = pick(s.house, PLAYABLE_HOUSES, DEFAULT_SETUP.house);
  const size = pick(Number(s.size), MAP_SIZES.map(([n]) => n), DEFAULT_SETUP.size);
  const listed = Array.isArray(raw.opponents) ? raw.opponents : [{ house: raw.enemy, difficulty: raw.difficulty }];
  const taken = new Set([house]);
  const opponents = listed.slice(0, maxOpponents(size)).map((o) => {
    let id = pick(o?.house, ['random', ...SKIRMISH_HOUSES], 'random');
    if (id !== 'random' && taken.has(id)) id = 'random';   // a house plays once
    taken.add(id);
    return { house: id, difficulty: pick(o?.difficulty, DIFFICULTIES(), 'normal') };
  });
  return {
    house,
    opponents: opponents.length ? opponents : DEFAULT_SETUP.opponents.map((o) => ({ ...o })),
    allied: s.allied === true,
    techLevel: pick(Number(s.techLevel), TECH_LEVELS, DEFAULT_SETUP.techLevel),
    worms: pick(s.worms, WORMS, DEFAULT_SETUP.worms),
    size,
    seed: Number.isInteger(s.seed) && s.seed > 0 && s.seed < 1e6 ? s.seed : null,
    credits: pick(Number(s.credits), CREDITS, DEFAULT_SETUP.credits),
    visibility: pick(raw.visibility, VISIBILITY_CHOICES.map(([v]) => v), raw.fog === false ? 'revealed' : DEFAULT_SETUP.visibility),   // a setup saved before: fog off was a revealed map
  };
}

/** The battle's query string; random opponents (a free Great House first, then a sub-house) and an empty seed are rolled here. */
export function skirmishQuery(setup, random = Math.random) {
  const s = cleanSetup(setup);
  const taken = new Set([s.house, ...s.opponents.map((o) => o.house)]);
  const opponents = s.opponents.map((o) => {
    if (o.house !== 'random') return o;
    const great = PLAYABLE_HOUSES.filter((id) => !taken.has(id));
    const pool = great.length ? great : SKIRMISH_HOUSES.filter((id) => !taken.has(id));
    const id = pool[Math.floor(random() * pool.length)];
    taken.add(id);
    return { house: id, difficulty: o.difficulty };
  });
  const seed = s.seed ?? 1 + Math.floor(random() * 99999);
  return new URLSearchParams({ scene: 'skirmish', house: s.house, opponents: formatOpponents(opponents), ...(s.allied ? { allied: '1' } : {}), tech: String(s.techLevel), worms: s.worms,
    size: String(s.size), seed: String(seed), credits: String(s.credits), visibility: s.visibility }).toString();
}

function storage() { try { return globalThis.localStorage ?? null; } catch { return null; } }
export function loadSetup(store = storage()) {
  try { return cleanSetup(JSON.parse(store?.getItem(KEY) ?? '{}') ?? {}); } catch { return cleanSetup(); }
}
export function saveSetup(setup, store = storage()) {
  try { store?.setItem(KEY, JSON.stringify(cleanSetup(setup))); } catch { /* private mode: this session only */ }
}

/** The set-up screen's note for a tech level: what it adds for the player's house. */
export function techNote(level, houseId) {
  if (level >= 9) return 'Level 9: everything, as in the last missions.';
  if (level <= 1) return 'Level 1: Wind Traps, Refineries and concrete only — the opening forces fight it out.';
  const opens = techOpens(level, houseId);
  return `Level ${level} adds ${opens.length ? opens.join(', ') : 'nothing new for this house'}.`;
}

const hex = (id) => `#${HOUSES[id].color.toString(16).padStart(6, '0')}`;
const SELECT = 'width: 190px; max-width: 100%; padding: 6px 8px; font: bold 13px "Trebuchet MS", sans-serif; color: #f2d7a0; background: #120c06; border: 2px solid #8e6843; border-radius: 3px;';
const seg = (label, choices, value, set, note = null) => h('div', { class: 'dm-row' }, h('span', { class: 'dm-label' }, label),
  h('div', { class: 'dm-control' }, segButtons(label, choices, value, set), note && h('small', {}, note)));
function segButtons(label, choices, value, set) {
  return h('div', { class: 'dm-seg', role: 'group', 'aria-label': label }, choices.map(([v, text]) =>
    h('button', { type: 'button', class: v === value ? 'on' : '', 'aria-pressed': String(v === value), dataset: { value: String(v) }, onclick: () => set(v) }, text)));
}

/** The set-up screen; `onStart(query)` launches the battle. */
export function skirmishPanel(settings, { onBack, onStart }) {
  let setup = loadSetup();
  const el = h('div', { class: 'dm-panel wide page-skirmish' });
  const save = () => { setup = cleanSetup(setup); saveSetup(setup); render(); };
  const set = (key, value) => { setup[key] = value; save(); };
  const setOpponent = (k, key, value) => { setup.opponents = setup.opponents.map((o, i) => (i === k ? { ...o, [key]: value } : o)); save(); };
  const difficulties = DIFFICULTIES().map((d) => [d, d[0].toUpperCase() + d.slice(1)]);
  /** One line per opponent: its colour, its house (houses already in the battle are greyed out), its difficulty. */
  const opponentLine = (o, k) => {
    const others = new Set([setup.house, ...setup.opponents.filter((_, i) => i !== k).map((x) => x.house)]);
    const pickHouse = h('select', { 'aria-label': `Opponent ${k + 1} house`, dataset: { field: 'house' }, onchange: () => setOpponent(k, 'house', pickHouse.value), style: SELECT },
      [['random', 'Random house'], ...SKIRMISH_HOUSES.map((id) => [id, HOUSES[id].plural ?? HOUSES[id].name])].map(([v, text]) => {
        const taken = v !== 'random' && others.has(v);
        return h('option', { value: v, selected: v === o.house, disabled: taken }, taken ? `${text} (in this battle)` : text);
      }));
    const colour = o.house === 'random' ? 'conic-gradient(#2f6fe0 0 25%, #c8261e 0 50%, #2e9e3e 0 75%, #7a3fb0 0)' : hex(o.house);
    return h('div', { dataset: { opponent: String(k) }, style: 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px;' },
      h('span', { 'aria-hidden': 'true', style: `width: 14px; height: 14px; border-radius: 50%; background: ${colour}; box-shadow: 0 0 0 2px #120c06, 0 0 0 3px #8e6843;` }),
      pickHouse,
      segButtons(`Opponent ${k + 1} difficulty`, difficulties, o.difficulty, (v) => setOpponent(k, 'difficulty', v)),
      setup.opponents.length > 1 && h('button', { type: 'button', class: 'dm-btn small', 'aria-label': `Remove opponent ${k + 1}`, dataset: { act: 'remove' },
        onclick: () => { setup.opponents = setup.opponents.filter((_, i) => i !== k); save(); } }, 'Remove'));
  };
  const opponentRows = () => {
    const cap = maxOpponents(setup.size);
    return h('div', { class: 'dm-row' }, h('span', { class: 'dm-label' }, 'Opponents'), h('div', { class: 'dm-control' },
      setup.opponents.map(opponentLine),
      setup.opponents.length < cap && h('button', { type: 'button', class: 'dm-btn small', dataset: { act: 'add' },
        onclick: () => { setup.opponents = [...setup.opponents, { house: 'random', difficulty: setup.opponents.at(-1)?.difficulty ?? 'normal' }]; save(); } }, 'Add opponent'),
      h('small', {}, `${setup.allied && setup.opponents.length > 1 ? 'The computers fight as one side' : 'Every house for itself'}; each house plays once. The Sardaukar and the Mercenaries fight only as computer houses. ${cap < 3 ? 'A Small map holds two opponents.' : 'Up to three, one in each corner.'}`)));
  };
  const render = () => {
    const seed = h('input', { type: 'number', min: 1, max: 999999, placeholder: 'random', value: setup.seed ?? '', 'aria-label': 'Map seed',
      onchange: () => { const n = Math.floor(Number(seed.value)); setup.seed = n > 0 && n < 1e6 ? n : null; saveSetup(setup); } });
    el.replaceChildren(
      h('h2', {}, 'Skirmish'),
      h('div', { class: 'mm-houses', role: 'radiogroup', 'aria-label': 'Your house' }, PLAYABLE_HOUSES.map((id) =>
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(id === setup.house), class: `mm-house${id === setup.house ? ' on' : ''}`, style: `--house:${hex(id)}`, dataset: { house: id }, onclick: () => set('house', id) },
          h('span', { class: 'mm-crest' }, HOUSES[id].name[0]),
          h('b', {}, HOUSES[id].name),
          h('small', {}, SPECIALS[id])))),
      opponentRows(),
      seg('Computers allied', [[false, 'Off'], [true, 'On']], setup.allied, (v) => set('allied', v),
        `${ALLIED_NOTES[setup.allied]}${setup.allied && setup.opponents.length < 2 ? ' It takes two opponents or more.' : ''}`),
      seg('Tech level', TECH_LEVELS.map((n) => [n, String(n)]), setup.techLevel, (v) => set('techLevel', v), techNote(setup.techLevel, setup.house)),
      seg('Sandworms', [['off', 'Off'], ['few', 'Few'], ['many', 'Many']], setup.worms, (v) => set('worms', v), WORM_NOTES[setup.worms]),
      seg('Map size', MAP_SIZES.map(([n, text]) => [n, `${text} ${n}`]), setup.size, (v) => set('size', v)),
      h('div', { class: 'dm-row' }, h('span', { class: 'dm-label' }, 'Map seed'), h('div', { class: 'dm-control' }, h('div', { class: 'mm-seed' }, seed,
        h('button', { type: 'button', class: 'dm-btn small', title: 'A new random map every battle', onclick: () => set('seed', null) }, 'Random')),
        h('small', {}, 'The same seed gives the same map; leave it empty for a new one each time.'))),
      seg('Starting credits', CREDITS.map((c) => [c, c.toLocaleString('en-US')]), setup.credits, (v) => set('credits', v)),
      seg('Visibility', VISIBILITY_CHOICES, setup.visibility, (v) => set('visibility', v), VISIBILITY_NOTES[setup.visibility]),
      seg('Game speed', [['slowest', 'Slowest'], ['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['fastest', 'Fastest']], settings.gameSpeed, (v) => { changeSetting(settings, 'gameSpeed', v); render(); }),
      h('div', { class: 'dm-actions', style: 'position: sticky; bottom: -20px; margin-bottom: -20px; padding: 10px 0 20px; background: linear-gradient(rgba(29,20,9,0), #1d1409 30%);' },   // Start stays in reach on a short window
        h('button', { type: 'button', class: 'dm-btn', onclick: onBack }, 'Back'),
        h('button', { type: 'button', class: 'dm-btn primary', dataset: { act: 'start' }, onclick: () => { saveSetup(setup); onStart(skirmishQuery(setup)); } }, 'Start battle')),
    );
  };
  render();
  return el;
}
