// Skirmish set-up (spec §5.8): house, opponent, difficulty, map size and seed, starting credits,
// fog and game speed. The choice is remembered for next time and becomes the battle's URL.
import { h } from './dom.js';
import { HOUSES, PLAYABLE_HOUSES } from '../data/houses.js';
import { DIFFICULTY } from '../sim/ai.js';
import { changeSetting } from './options.js';

export const MAP_SIZES = [[48, 'Small'], [64, 'Medium'], [96, 'Large'], [128, 'Huge']];
export const CREDITS = [1000, 3000, 5000, 10000];
export const DEFAULT_SETUP = { house: 'atreides', enemy: 'random', difficulty: 'normal', size: 64, seed: null, credits: 3000, fog: true };
const KEY = 'dune2-3d.skirmish';
const SPECIALS = { atreides: 'Sonic Tank · Fremen warriors', harkonnen: 'Devastator · Death Hand missile', ordos: 'Deviator · Saboteur' };

/** A set-up with every field valid, from whatever was stored. */
export function cleanSetup(raw = {}) {
  const s = { ...DEFAULT_SETUP, ...raw };
  const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
  return {
    house: pick(s.house, PLAYABLE_HOUSES, DEFAULT_SETUP.house),
    enemy: pick(s.enemy, ['random', ...PLAYABLE_HOUSES], 'random'),
    difficulty: pick(s.difficulty, Object.keys(DIFFICULTY), DEFAULT_SETUP.difficulty),
    size: pick(Number(s.size), MAP_SIZES.map(([n]) => n), DEFAULT_SETUP.size),
    seed: Number.isInteger(s.seed) && s.seed > 0 && s.seed < 1e6 ? s.seed : null,
    credits: pick(Number(s.credits), CREDITS, DEFAULT_SETUP.credits),
    fog: s.fog !== false,
  };
}

/** The battle's query string; a random opponent and an empty seed are rolled here. */
export function skirmishQuery(setup, random = Math.random) {
  const s = cleanSetup(setup);
  const rivals = PLAYABLE_HOUSES.filter((id) => id !== s.house);
  const enemy = rivals.includes(s.enemy) ? s.enemy : rivals[Math.floor(random() * rivals.length)];
  const seed = s.seed ?? 1 + Math.floor(random() * 99999);
  return new URLSearchParams({ scene: 'skirmish', house: s.house, enemy, ai: s.difficulty, size: String(s.size), seed: String(seed), credits: String(s.credits), fog: s.fog ? '1' : '0' }).toString();
}

function storage() { try { return globalThis.localStorage ?? null; } catch { return null; } }
export function loadSetup(store = storage()) {
  try { return cleanSetup(JSON.parse(store?.getItem(KEY) ?? '{}') ?? {}); } catch { return cleanSetup(); }
}
export function saveSetup(setup, store = storage()) {
  try { store?.setItem(KEY, JSON.stringify(cleanSetup(setup))); } catch { /* private mode: this session only */ }
}

const hex = (id) => `#${HOUSES[id].color.toString(16).padStart(6, '0')}`;
const seg = (label, choices, value, set) => h('div', { class: 'dm-row' }, h('span', { class: 'dm-label' }, label),
  h('div', { class: 'dm-control' }, h('div', { class: 'dm-seg', role: 'group', 'aria-label': label }, choices.map(([v, text]) =>
    h('button', { type: 'button', class: v === value ? 'on' : '', 'aria-pressed': String(v === value), onclick: () => set(v) }, text)))));

/** The set-up screen; `onStart(query)` launches the battle. */
export function skirmishPanel(settings, { onBack, onStart }) {
  const setup = loadSetup();
  const el = h('div', { class: 'dm-panel wide page-skirmish' });
  const set = (key, value) => { setup[key] = value; saveSetup(setup); render(); };
  const render = () => {
    const rivals = PLAYABLE_HOUSES.filter((id) => id !== setup.house);
    if (!rivals.includes(setup.enemy)) setup.enemy = 'random';
    const seed = h('input', { type: 'number', min: 1, max: 999999, placeholder: 'random', value: setup.seed ?? '', 'aria-label': 'Map seed',
      onchange: () => { const n = Math.floor(Number(seed.value)); setup.seed = n > 0 && n < 1e6 ? n : null; saveSetup(setup); } });
    el.replaceChildren(
      h('h2', {}, 'Skirmish'),
      h('div', { class: 'mm-houses', role: 'radiogroup', 'aria-label': 'Your house' }, PLAYABLE_HOUSES.map((id) =>
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(id === setup.house), class: `mm-house${id === setup.house ? ' on' : ''}`, style: `--house:${hex(id)}`, dataset: { house: id }, onclick: () => set('house', id) },
          h('span', { class: 'mm-crest' }, HOUSES[id].name[0]),
          h('b', {}, HOUSES[id].name),
          h('small', {}, SPECIALS[id])))),
      seg('Opponent', [['random', 'Random'], ...rivals.map((id) => [id, HOUSES[id].name])], setup.enemy, (v) => set('enemy', v)),
      seg('Difficulty', Object.keys(DIFFICULTY).map((d) => [d, d[0].toUpperCase() + d.slice(1)]), setup.difficulty, (v) => set('difficulty', v)),
      seg('Map size', MAP_SIZES.map(([n, text]) => [n, `${text} ${n}`]), setup.size, (v) => set('size', v)),
      h('div', { class: 'dm-row' }, h('span', { class: 'dm-label' }, 'Map seed'), h('div', { class: 'dm-control' }, h('div', { class: 'mm-seed' }, seed,
        h('button', { type: 'button', class: 'dm-btn small', title: 'A new random map every battle', onclick: () => set('seed', null) }, 'Random')),
        h('small', {}, 'The same seed gives the same map; leave it empty for a new one each time.'))),
      seg('Starting credits', CREDITS.map((c) => [c, c.toLocaleString('en-US')]), setup.credits, (v) => set('credits', v)),
      seg('Fog of war', [[true, 'On'], [false, 'Off']], setup.fog, (v) => set('fog', v)),
      seg('Game speed', [['slowest', 'Slowest'], ['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['fastest', 'Fastest']], settings.gameSpeed, (v) => { changeSetting(settings, 'gameSpeed', v); render(); }),
      h('div', { class: 'dm-actions' },
        h('button', { type: 'button', class: 'dm-btn', onclick: onBack }, 'Back'),
        h('button', { type: 'button', class: 'dm-btn primary', dataset: { act: 'start' }, onclick: () => { saveSetup(setup); onStart(skirmishQuery(setup)); } }, 'Start battle')),
    );
  };
  render();
  return el;
}
