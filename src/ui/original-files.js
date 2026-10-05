// Options → Original Game Files (spec §6 Original files, §5.8): the player picks the .PAK files of their own
// Dune II PC copy; the page shows what was found in them (each house's announcer, the units' replies, the
// effects; the Mentats' and the house emblems' pictures), switches "Original sounds" and "Original pictures" on
// and off and forgets them. Below, their music: the Mega Drive game's soundtrack from their own copy, or tracks of
// their own, with a Music Test to hear each track and say where it plays (original-music.js). Everything stays in
// this browser (src/core/user-files.js); the page says so. Opened by the main menu and the Options page with
// (await import('./original-files.js')).originalFilesPanel(settings, { onBack }).
import { h } from './dom.js';
import * as files from '../core/user-files.js';
import { HOUSES } from '../data/houses.js';
import { musicSection, MusicTest, MUSIC_STYLE } from './original-music.js';
const ARM_SECONDS = 4;   // Remove asks for a second click within this long

/** "1.2 MB", "640 KB". */
export function formatSize(bytes) {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

/** What was found, in words (from user-files clipSummary()). */
export function summaryText(s) {
  const houses = ['atreides', 'harkonnen', 'ordos'].map((id) => {
    const { lines, of } = s.houses[id];
    return { id, name: HOUSES[id].name, state: lines === of ? 'full' : lines ? 'part' : 'none', text: lines ? `${HOUSES[id].name} ${lines}/${of}` : `${HOUSES[id].name} —` };
  });
  const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
  return {
    houses,
    replies: `${s.acknowledgements.lines} of ${s.acknowledgements.of}`,
    effects: `${s.effects.sounds} of ${s.effects.of}`,
    from: s.clips ? `${n(s.clips, 'clip')} from ${s.sources.join(', ') || 'your files'}` : 'Nothing yet.',
    announcer: s.translated ? `From a ${s.translated} copy: not used, as it words its lines its own way; the announcements keep this game’s voice.` : null,
  };
}

const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;

/** What the pictures cover, in words (from user-files pictureSummary()): "Mentat portraits: 3, house emblems: 3". */
export function picturesText(p) {
  if (!p?.count) return 'Nothing yet.';
  const names = (list) => list.map((id) => HOUSES[id]?.name ?? id).join(', ');
  const parts = [];
  if (p.mentats.length) parts.push(`Mentat portraits: ${p.mentats.length} (${names(p.mentats)})`);
  if (p.emblems.length) parts.push(`house emblems: ${p.emblems.length}`);
  const text = parts.join(', ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}${p.sources?.length ? `, from ${p.sources.join(', ')}` : ''}`;
}

/** One line per file read (from user-files importFiles()): [{ text, bad }]. */
export function reportText(result) {
  return result.files.map((f) => {
    if (f.error) return { text: `${f.name}: ${f.error}`, bad: true };
    const pictures = f.pictures ? plural(f.pictures, 'picture file') : '';
    if (!f.clips && !pictures) return { text: `${f.name}: ${f.note ?? 'nothing usable in it'}`, bad: f.skipped > 0 };
    const skipped = f.skipped ? `; ${f.skipped} damaged clip${f.skipped === 1 ? '' : 's'} skipped — ${f.note}` : '';
    const damaged = !f.skipped && f.note && pictures ? ` — ${f.note}` : '';
    const found = [f.clips ? plural(f.clips, 'sound clip') : '', pictures].filter(Boolean).join(' and ');
    return { text: `${f.name}: ${found}${skipped}${damaged}`, bad: !!damaged };
  });
}

const STYLE = `
.page-original-files h3 { margin: 22px 0 6px; font: bold 15px "Trebuchet MS", sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #ffd24a; }
.of-privacy { margin: 0 0 12px !important; padding: 8px 12px; border-left: 3px solid #d9a52e; background: rgba(10,6,2,.35); font-size: 13px; }
.of-pick { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.of-status { font-size: 13px; color: #c9a063; }
.of-report { margin: 8px 0 0; padding: 0; list-style: none; font-size: 12px; line-height: 1.5; color: #c9b48a; }
.of-report .bad { color: #ff9c84; }
.of-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.of-chip { padding: 3px 9px; font: bold 12px "Trebuchet MS", sans-serif; letter-spacing: .04em; color: #a88a5c; border: 1px solid rgba(142,104,67,.7); border-radius: 3px; background: #120c06; }
.of-chip.full { color: #ffd24a; border-color: #d9a52e; }
.of-chip.part { color: #f2d7a0; }
.of-facts { margin: 8px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; font-size: 13px; }
.of-facts dt { color: #a88a5c; }
.of-facts dd { margin: 0; color: #f2d7a0; }
.of-empty { margin: 4px 0 8px; font-size: 13px; color: #8e7650; }
.page-original-files small.bad { color: #ff9c84; }
${MUSIC_STYLE}`;

function addStyle() {
  if (document.getElementById('of-style')) return;
  document.head.append(h('style', { id: 'of-style' }, STYLE));
}

/** The page: a .dm-panel element. `onBack` leaves it. */
export function originalFilesPanel(settings, { onBack = () => {} } = {}) {
  addStyle();
  const el = h('div', { class: 'dm-panel wide page-original-files', role: 'region', 'aria-label': 'Original game files' });
  const state = { busy: null, report: null, armed: 0, summary: null, pictures: null, musicTracks: [], musicReport: null, storage: 'indexeddb', focus: null };
  const test = new MusicTest(settings, { files, onChange: () => render() });
  test.bind(el);

  const picker = (accept, onFiles) => {
    const input = h('input', { type: 'file', accept, multiple: true, hidden: true, onchange: () => { const list = [...input.files]; input.value = ''; if (list.length) onFiles(list); } });
    return input;
  };

  const act = async (label, fn) => {
    state.busy = label;
    await render();
    try { await fn(); } catch (err) { state.report = [{ text: err.message, bad: true }]; }
    state.busy = null;
    await render();
  };

  const pakInput = picker('.pak,.PAK,.voc,.VOC', (list) => act(`Reading ${list.map((f) => f.name).join(', ')}…`, async () => {
    state.report = reportText(await files.importFiles(list));
  }));

  const row = (label, ...control) => h('div', { class: 'dm-row' }, h('span', { class: 'dm-label' }, label), h('div', { class: 'dm-control' }, ...control));

  async function render() {
    if (el.contains(document.activeElement) && document.activeElement.dataset.focus) state.focus = document.activeElement.dataset.focus;   // kept across a busy spell, when the button is disabled
    try {
      state.summary = await files.clipSummary();
      state.pictures = await files.pictureSummary();
      state.musicTracks = await files.listTracks();
      state.storage = state.summary.storage;
    } catch (err) {
      state.report = [{ text: `Storage is not available: ${err.message}`, bad: true }];
    }
    const s = state.summary, pics = state.pictures, busy = !!state.busy, words = s ? summaryText(s) : null;
    const anyClips = (s?.clips ?? 0) > 0, anyPictures = (pics?.count ?? 0) > 0, any = anyClips || anyPictures;
    if (state.armed && Date.now() > state.armed) state.armed = 0;
    el.replaceChildren(
      h('h2', {}, 'Original game files'),
      h('p', {}, 'Hear Dune II’s own announcers, unit replies and battle sounds, and see its own Mentats and house emblems, from your own copy of the PC game (1992). Choose the .PAK files in its folder — all of them will do; the sounds and pictures are picked out (each house’s announcer is in ATRE.PAK, HARK.PAK or ORDOS.PAK, the pictures in DUNE.PAK and ENGLISH.PAK).'),
      h('p', { class: 'of-privacy' }, 'Your files stay in this browser: they are read here and kept in its storage, never uploaded, and none of them becomes part of this game.',
        state.storage === 'memory' ? ' This browser keeps no site data, so they last only until this page is closed.' : ''),
      row('Game files',
        h('div', { class: 'of-pick' },
          h('button', { type: 'button', class: 'dm-btn small primary', disabled: busy, dataset: { focus: 'pick' }, onclick: () => pakInput.click() }, 'Choose .PAK files…'),
          pakInput,
          h('span', { class: 'of-status', role: 'status', 'aria-live': 'polite' }, state.busy ?? '')),
        state.report && h('ul', { class: 'of-report' }, state.report.map((r) => h('li', { class: r.bad ? 'bad' : '' }, r.text)))),
      row('Found',
        words && h('div', { class: 'of-chips', 'aria-label': 'Announcer lines found per house' }, words.houses.map((x) => h('span', { class: `of-chip ${x.state}`, title: `${x.name} announcer lines` }, x.text))),
        words && h('dl', { class: 'of-facts' },
          h('dt', {}, 'Unit replies'), h('dd', {}, words.replies),
          h('dt', {}, 'Effects'), h('dd', {}, words.effects),
          words.announcer && [h('dt', {}, 'Announcer'), h('dd', {}, words.announcer)],
          h('dt', {}, 'Clips'), h('dd', {}, words.from),
          h('dt', {}, 'Pictures'), h('dd', {}, picturesText(pics)))),
      row('Original sounds',
        h('div', { class: 'dm-seg', role: 'group', 'aria-label': 'Use the original sounds' }, [[true, 'On'], [false, 'Off']].map(([v, text]) =>
          h('button', { type: 'button', class: (s?.on ?? false) === v ? 'on' : '', 'aria-pressed': String((s?.on ?? false) === v), disabled: busy || !anyClips, dataset: { focus: `use-${v}` },
            onclick: () => act(null, () => files.setUseOriginals(v)) }, text))),
        h('small', {}, anyClips ? 'On: the lines and effects found replace this game’s own; whatever is missing keeps ours.' : 'Choose the game’s files first.')),
      row('Original pictures',
        h('div', { class: 'dm-seg', role: 'group', 'aria-label': 'Use the original pictures' }, [[true, 'On'], [false, 'Off']].map(([v, text]) =>
          h('button', { type: 'button', class: (pics?.on ?? false) === v ? 'on' : '', 'aria-pressed': String((pics?.on ?? false) === v), disabled: busy || !anyPictures, dataset: { focus: `pictures-${v}` },
            onclick: () => act(null, () => files.setUsePictures(v)) }, text))),
        h('small', {}, anyPictures ? 'On: the campaign shows the original Mentats — their eyes and mouths as the original drew them, the mouth moving with the voice — and the original house emblems; whatever is missing keeps ours.' : 'Choose the game’s files first (the pictures are in DUNE.PAK and ENGLISH.PAK).')),
      row('Remove',
        h('button', { type: 'button', class: 'dm-btn small danger', disabled: busy || !any, dataset: { focus: 'clear' },
          onclick: () => {
            if (!state.armed) { state.armed = Date.now() + ARM_SECONDS * 1000; render(); setTimeout(() => { if (state.armed && Date.now() >= state.armed) { state.armed = 0; render(); } }, ARM_SECONDS * 1000 + 20); return; }
            state.armed = 0;
            act('Removing…', async () => { await files.forgetGameFiles(); state.report = null; });
          } }, state.armed ? 'Click again to remove them' : 'Forget the game files'),
        h('small', {}, 'Deletes the clips and pictures from this browser; your music below stays.')),
      ...musicSection({ state, busy, act, picker, test, files }),
      h('div', { class: 'dm-actions' }, h('button', { type: 'button', class: 'dm-btn', dataset: { focus: 'back' }, onclick: () => { test.close(); onBack(); } }, 'Back')),
    );
    if (state.focus && (!document.activeElement || document.activeElement === document.body || el.contains(document.activeElement))) {
      (el.querySelector(`[data-focus="${state.focus}"]:not(:disabled)`) ?? (busy ? null : el.querySelector('[data-focus="back"]')))?.focus({ preventScroll: true });
    }
  }

  render();
  return el;
}
