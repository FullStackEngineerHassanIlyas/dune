// Options (spec §5.7, §6, §8), shared by the main menu and the in-game menu. Each change is sanitized,
// saved, and written into the live settings object, which the camera, controller, overlay and music read
// every frame; graphics quality takes effect with the next battle. The Original Game Files page (spec §6)
// is src/ui/original-files.js's panel when that module is there, and a "Not available" page when it is not.
import { sanitize, saveSettings } from '../core/settings.js';
import { h } from './dom.js';

const ON_OFF = [[true, 'On'], [false, 'Off']];
export const OPTION_ROWS = [
  { key: 'quality', label: 'Graphics', choices: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], note: 'Takes effect in the next battle.' },
  { key: 'perfCheck', label: 'Frame-rate check', choices: ON_OFF, note: 'Offers a lower graphics setting when a battle runs below 40 frames a second.' },
  { key: 'scheme', label: 'Mouse scheme', choices: [['classic', 'Classic'], ['modern', 'Modern']],
    notes: { classic: 'Classic (C&C 1995): left click selects and gives orders, right click deselects.', modern: 'Modern: left click selects, right click gives orders.' } },
  { key: 'edgeScroll', label: 'Edge scrolling', choices: ON_OFF, note: 'Push the pointer against a screen edge; it keeps scrolling past the edge.' },
  { key: 'rightDragScroll', label: 'Right-drag scrolling', choices: ON_OFF, note: 'Hold the right button and pull: the further, the faster.' },
  { key: 'scrollSpeed', label: 'Scroll speed', range: [0.5, 3, 0.25], format: (v) => `${v.toFixed(2)}×` },
  { key: 'healthBars', label: 'Health bars', choices: [['selected', 'Selected'], ['damaged', 'Damaged'], ['always', 'Always']] },
  { key: 'gameSpeed', label: 'Game speed', choices: [['slowest', 'Slowest'], ['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['fastest', 'Fastest']] },
  { key: 'sound', label: 'Sound', choices: ON_OFF },
  { key: 'volume', label: 'Volume', range: [0.05, 1, 0.05], format: (v) => `${Math.round(v * 100)}%` },
  { key: 'announcer', label: 'Announcer', choices: [['one', 'One voice (original)'], ['house', 'Each house']],
    notes: { one: 'One deep voice speaks for every house, as in the Mega Drive game.', house: 'Atreides, Harkonnen and Ordos each have an announcer of their own, as in the PC game.' } },
  { key: 'voiceVolume', label: 'Voices', range: [0, 1, 0.05], format: (v) => (v > 0 ? `${Math.round(v * 100)}%` : 'Off'), note: 'The announcer, the units\' replies and the Mentats; M mutes them with the rest.' },
  { key: 'musicVolume', label: 'Music', range: [0, 1, 0.05], format: (v) => (v > 0 ? `${Math.round(v * 100)}%` : 'Off') },
  { key: 'musicMode', label: 'Battle music', choices: [['sega', 'Sega'], ['adaptive', 'Adaptive']],
    notes: { sega: 'Like the Sega game: the battle tunes play one after another in random order.', adaptive: 'Calm music in peace; battle music takes over when fighting starts near your forces.' } },
  { key: 'mentatVoice', label: 'Mentat voice', choices: ON_OFF, note: 'Your Mentat speaks his briefings, advice and verdicts, and the words follow his voice. Any key or click reads on.' },
  { key: 'intro', label: 'Intro', choices: ON_OFF, note: 'The opening before the title. Any key or click skips it.' },
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

/** The Options page's way to the Original Game Files page. */
export function originalFilesRow(onOpen) {
  return h('div', { class: 'dm-row' }, h('span', { class: 'dm-label' }, 'Game files'),
    h('div', { class: 'dm-control' },
      h('button', { type: 'button', class: 'dm-btn small', dataset: { act: 'original-files' }, onclick: onOpen }, 'Original Game Files'),
      h('small', {}, 'Voices and music from your own copy of Dune II. Nothing is uploaded.')));
}

/**
 * The Original Game Files page (spec §6, contract 3): originalFilesPanel(settings, { onBack }) from
 * src/ui/original-files.js, or a "Not available" page when that module cannot be loaded or fails.
 */
export async function originalFilesPage(settings, { onBack, load = () => import('./original-files.js') } = {}) {
  let mod = null;
  try { mod = await load(); } catch { /* not part of this build */ }
  if (typeof mod?.originalFilesPanel === 'function') {
    try {
      const panel = await mod.originalFilesPanel(settings, { onBack });
      if (panel?.nodeType === 1) return panel;
    } catch (err) { console.warn('Original Game Files:', err); }
  }
  return h('div', { class: 'dm-panel page-original-files' }, h('h2', {}, 'Original Game Files'),
    h('p', { dataset: { state: 'unavailable' } }, 'Not available'),
    h('p', { class: 'dm-hint' }, 'This build cannot read the original game files.'),
    h('div', { class: 'dm-actions' }, h('button', { type: 'button', class: 'dm-btn', onclick: onBack }, 'Back')));
}
