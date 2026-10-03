// The results after a won mission (research.md §5, §6; the Sega order): the victory card, then (on the Mentat's
// stage, in index.js) his win lines while the map takes the new land, then the score screen — SCORE and TIME,
// "You have attained the rank of …", and Spice harvested, Units destroyed and Structures destroyed (not in
// mission 1), each with a red bar for the player and a blue one for the enemy filling step by step — and last the
// password for the next mission.
import { h } from '../dom.js';
import { HOUSES } from '../../data/houses.js';
import { formatTime } from '../../campaign/score.js';
import { victorySvg, tankSvg } from './art.js';

const name = (house) => HOUSES[house]?.name ?? house;
const fmt = (n) => Math.round(n).toLocaleString('en-US');

/** The victory card: our picture, VICTORY across it and the mission done; Continue (or the timer) moves on. */
export function victoryCard(house, mission, { onContinue }) {
  const art = h('div', { class: 'cp-victory-pic' });
  art.innerHTML = victorySvg(house);
  return h('section', { class: 'cp-stage cp-victory', dataset: { house } }, art,
    h('div', { class: 'cp-victory-words' },
      h('h2', { class: 'cp-victory-title', dataset: { text: 'Victory' } }, 'Victory'),
      h('p', {}, `House ${name(house)} · mission ${mission} accomplished`)),
    h('div', { class: 'cp-bar' }, h('button', { type: 'button', class: 'dm-btn cp-btn primary', dataset: { act: 'continue' }, onclick: onContinue }, 'Continue')));
}

/** The rows the score screen shows for a mission: the structures row only from mission 2 on, as on the Sega. */
export function scoreRows(result) {
  const rows = [['spice', 'Spice harvested by'], ['units', 'Units destroyed by'], ['structures', 'Structures destroyed by']];
  return (result.mission === 1 ? rows.slice(0, 2) : rows).map(([key, label]) => ({ key, label, you: result.rows[key][0], enemy: result.rows[key][1] }));
}

/**
 * The score screen. Bars fill row by row in `steps` steps (`later` schedules, and the caller cancels it when the
 * screen changes); `instant` shows them full at once (reduced motion, tests).
 */
export function scoreScreen(result, { later, instant = false, onContinue, steps = 20, stepMs = 45 }) {
  const rows = scoreRows(result);
  const bars = [];
  const rowEls = rows.map((row) => {
    const scale = Math.max(row.you, row.enemy, 1);
    const line = (who, cls, value) => {
      const fill = h('span', { class: `cp-fill ${cls}` });
      const num = h('b', { class: 'cp-num' }, '0');
      bars.push({ fill, num, value, share: value / scale });
      return h('div', { class: 'cp-score-bar' }, h('span', { class: 'cp-who' }, who), h('span', { class: 'cp-track' }, fill), num);
    };
    return h('div', { class: 'cp-score-row', dataset: { row: row.key } }, h('div', { class: 'cp-score-label' }, row.label),
      line('You', 'you', row.you), line('Enemy', 'enemy', row.enemy));
  });
  const set = (bar, k) => { bar.fill.style.width = `${(bar.share * k * 100).toFixed(1)}%`; bar.num.textContent = fmt(bar.value * k); };
  const art = h('div', { class: 'cp-score-art' });
  art.innerHTML = tankSvg();
  const el = h('section', { class: 'cp-stage cp-score', dataset: { house: result.house } }, art,
    h('div', { class: 'cp-score-card' },
      h('div', { class: 'cp-score-head' },
        h('div', {}, h('span', {}, 'Score'), h('b', { dataset: { field: 'score' } }, String(result.score))),
        h('div', {}, h('span', {}, 'Time'), h('b', { dataset: { field: 'time' } }, formatTime(result.seconds)))),
      h('p', { class: 'cp-rank' }, 'You have attained the rank of', h('strong', { dataset: { field: 'rank' } }, result.rank)),
      ...rowEls),
    h('div', { class: 'cp-bar' }, h('button', { type: 'button', class: 'dm-btn cp-btn primary', dataset: { act: 'continue' }, onclick: onContinue }, 'Continue')));
  for (const bar of bars) set(bar, instant ? 1 : 0);
  if (!instant) {
    // row by row, both bars of a row together, as the original counts them up
    const pairs = [];
    for (let i = 0; i < bars.length; i += 2) pairs.push(bars.slice(i, i + 2));
    const run = (p, s) => {
      if (p >= pairs.length) return;
      for (const bar of pairs[p]) set(bar, s / steps);
      if (s < steps) later(() => run(p, s + 1), stepMs);
      else later(() => run(p + 1, 1), stepMs * 6);
    };
    later(() => run(0, 1), 500);
  }
  return el;
}

/** The password for the next mission, letter by letter in tiles; `kept` false when this browser could not save. */
export function passwordReveal(house, mission, word, { onContinue, kept = true }) {
  return h('section', { class: 'cp-stage cp-password-reveal', dataset: { house } },
    h('div', { class: 'cp-reveal-card' },
      h('p', {}, `Your password for completing House ${name(house)} mission ${mission} is`),
      h('div', { class: 'cp-tiles', role: 'text', 'aria-label': word, dataset: { field: 'password' } }, [...word].map((c) => h('span', { 'aria-hidden': 'true' }, c))),
      kept ? h('p', { class: 'cp-reveal-note' }, 'Progress is also saved in this browser; the password brings you back here on any computer.')
        : h('p', { class: 'cp-reveal-note', role: 'status', dataset: { unsaved: '1' } }, 'This browser is not keeping your progress: note this password. It brings you back here on any computer.')),
    h('div', { class: 'cp-bar' }, h('button', { type: 'button', class: 'dm-btn cp-btn primary', dataset: { act: 'continue' }, onclick: onContinue }, 'Continue')));
}
