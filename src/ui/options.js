// Options (spec §5.7, §8), shared by the main menu and the in-game menu. Each change is sanitized,
// saved, and written into the live settings object, which the camera, controller and overlay read
// every frame; graphics quality takes effect with the next battle.
import { sanitize, saveSettings } from '../core/settings.js';
import { h } from './dom.js';

const ON_OFF = [[true, 'On'], [false, 'Off']];
export const OPTION_ROWS = [
  { key: 'quality', label: 'Graphics', choices: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], note: 'Takes effect in the next battle.' },
  { key: 'scheme', label: 'Mouse scheme', choices: [['classic', 'Classic'], ['modern', 'Modern']],
    notes: { classic: 'Classic (C&C 1995): left click selects and gives orders, right click deselects.', modern: 'Modern: left click selects, right click gives orders.' } },
  { key: 'edgeScroll', label: 'Edge scrolling', choices: ON_OFF, note: 'Push the pointer against a screen edge; it keeps scrolling past the edge.' },
  { key: 'rightDragScroll', label: 'Right-drag scrolling', choices: ON_OFF, note: 'Hold the right button and pull: the further, the faster.' },
  { key: 'scrollSpeed', label: 'Scroll speed', range: [0.5, 3, 0.25], format: (v) => `${v.toFixed(2)}×` },
  { key: 'healthBars', label: 'Health bars', choices: [['selected', 'Selected'], ['damaged', 'Damaged'], ['always', 'Always']] },
  { key: 'gameSpeed', label: 'Game speed', choices: [['slowest', 'Slowest'], ['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['fastest', 'Fastest']] },
  { key: 'sound', label: 'Sound', choices: ON_OFF },
  { key: 'volume', label: 'Volume', range: [0.05, 1, 0.05], format: (v) => `${Math.round(v * 100)}%` },
];

export function changeSetting(settings, key, value, storage) {
  Object.assign(settings, sanitize({ ...settings, [key]: value }));
  saveSettings(settings, storage);
  return settings;
}

export function optionsPanel(settings, { onChange = () => {}, rows = OPTION_ROWS } = {}) {
  const el = h('div', { class: 'dm-options' });
  const render = () => {
    el.replaceChildren(...rows.map((row) => {
      const value = settings[row.key];
      const note = row.notes?.[value] ?? row.note;
      let control;
      if (row.range) {
        const [min, max, step] = row.range;
        const out = h('output', {}, row.format(value));
        const input = h('input', { type: 'range', min, max, step, value, 'aria-label': row.label, oninput: () => { out.textContent = row.format(Number(input.value)); },
          onchange: () => { changeSetting(settings, row.key, Number(input.value)); onChange(row.key, settings[row.key]); render(); } });
        control = h('div', { class: 'dm-range' }, input, out);
      } else {
        control = h('div', { class: 'dm-seg', role: 'group', 'aria-label': row.label }, row.choices.map(([v, text]) =>
          h('button', { type: 'button', class: v === value ? 'on' : '', 'aria-pressed': String(v === value), dataset: { key: row.key },
            onclick: () => { changeSetting(settings, row.key, v); onChange(row.key, settings[row.key]); render(); } }, text)));
      }
      return h('div', { class: 'dm-row' }, h('span', { class: 'dm-label' }, row.label), h('div', { class: 'dm-control' }, control, note && h('small', {}, note)));
    }));
  };
  render();
  return el;
}
