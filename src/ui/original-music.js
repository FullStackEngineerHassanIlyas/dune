// Original Game Files → Your music (spec §6 Music, Original files): the player's own music, chiefly the Mega Drive
// game's soundtrack from their own copy (VGM rips: .vgm, .vgz or the .zip they come in), else MP3/OGG/WAV. A Music
// Test, as the Sega game had one: every imported track with its title, length and loop, where it plays (put there
// by its title as the Sega game played it — sega-tracks.js — and changeable), Play/Stop to hear it, and Remove.
// Mounted by original-files.js inside its page; the files are read in the browser and kept in its storage
// (src/core/user-files.js), never uploaded. A track being heard here plays on a context of its own and the menu's
// music makes way meanwhile (user-files audition()).
import { h } from './dom.js';
import { SLOTS, SLOT_LABELS, SLOT_CHOICES } from '../audio/music/sega-tracks.js';
import { MusicOutput, VGM_TYPE } from '../audio/music/output.js';
import { musicVolume } from '../audio/music/music.js';

export const MUSIC_ACCEPT = '.vgm,.vgz,.zip,.mp3,.ogg,.oga,.wav,audio/mpeg,audio/ogg,audio/wav';

/** "1:13"; "—" when unknown. */
export function formatTime(seconds) {
  if (!(seconds > 0)) return '—';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Slots in the page's order, as a selector value ('' = not used). */
export function slotValue(lists) {
  return SLOTS.filter((s) => (lists ?? []).includes(s)).join(',');
}

const where = (slots) => slots.map((s) => SLOT_LABELS[s] ?? s).join(', ');

/** One line per track read (from user-files importMusic()): [{ text, bad }]. */
export function musicReportText(result) {
  return result.files.map((f) => {
    const what = f.title && f.title !== f.name ? `${f.title} (${f.name})` : f.name;
    if (f.error) return { text: `${what}: ${f.error}`, bad: true };
    if (f.note && !f.slots?.length && /German|already/.test(f.note)) return { text: `${what}: ${f.note}`, bad: false };
    const plays = f.slots?.length ? `plays as ${where(f.slots)}` : 'kept; pick where it plays below';
    return { text: `${what}: ${plays}${f.note ? ` — ${f.note}` : ''}`, bad: false };
  });
}

/** How much of the game the player's music covers: "Your music plays in 15 of 18 places; this game's own in the rest." */
export function coverageText(tracks) {
  const used = new Set(tracks.flatMap((t) => t.lists ?? []));
  if (!used.size) return 'None of it plays yet: this game’s own music plays everywhere.';
  return used.size === SLOTS.length ? 'Your music plays everywhere.' : `Your music plays in ${used.size} of ${SLOTS.length} places; this game’s own in the rest.`;
}

export const MUSIC_STYLE = `
.of-music { margin: 6px 0 8px; padding: 0; list-style: none; }
.of-music li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 6px 0; border-bottom: 1px dashed rgba(184,137,58,.22); font-size: 13px; }
.of-music li.playing { background: rgba(255,210,74,.07); }
.of-music .of-title { flex: 1 1 180px; min-width: 0; color: #f2d7a0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.of-music .of-title small { display: block; color: #8e7650; font-size: 11px; overflow: hidden; text-overflow: ellipsis; }
.of-music .of-time { width: 92px; color: #a88a5c; font: 12px Consolas, "Courier New", monospace; }
.of-music .of-play { min-width: 66px; }
.of-music select { max-width: 190px; padding: 4px 6px; font: 12px "Trebuchet MS", sans-serif; color: #f2d7a0; background: #120c06; border: 1px solid #8e6843; border-radius: 3px; }
.of-music select:focus-visible { outline: none; border-color: #ffd24a; box-shadow: 0 0 8px rgba(255,210,74,.3); }
.of-music .bad { flex-basis: 100%; color: #ff9c84; font-size: 12px; }
.of-cover { margin: 2px 0 0; font-size: 12px; color: #a88a5c; }
`;

/**
 * Plays one track for the Music Test on an audio context of its own, made by the click that asks for it; the menu's
 * music makes way while it plays. onChange(): what plays changed (the page draws itself again).
 */
export class MusicTest {
  constructor(settings, { win = globalThis.window, files, onChange = () => {} } = {}) {
    Object.assign(this, { settings, win, files, onChange });
    this.ctx = null;
    this.out = null;
    this.id = null;          // the track playing (or being read)
    this.error = null;       // { id, text }: the last track that would not play
    this.watch = 0;
  }

  /** The page this lives on is gone (Esc, Back): the track stops with it. */
  bind(el) { this.el = el; }

  context() {
    if (!this.ctx) {
      const Context = this.win.AudioContext ?? this.win.webkitAudioContext;
      if (typeof Context !== 'function') throw new Error('this browser plays no sound');
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    this.ctx.resume?.()?.catch?.(() => {});
    this.master.gain.value = this.settings.sound === false ? 0 : Number(this.settings.volume ?? 0.8);
    return this.ctx;
  }

  async play(id) {
    this.stop(false);
    this.id = id;
    this.error = null;
    this.onChange();
    try {
      const ctx = this.context(), file = await this.files.trackData(id);
      if (this.id !== id) return;
      if (!file) throw new Error('that track is gone');
      const out = (this.out = new MusicOutput({ audio: { ctx, master: this.master }, win: this.win, onEvent: (e) => this.event(id, e) }));
      out.open();
      const v = musicVolume(this.settings);
      out.setLevel(v > 0 ? v : 0.5);   // heard here even with the music turned off
      if (file.type === VGM_TYPE) out.playVgm(file, { passes: file.meta?.loopSeconds > 0 ? 0 : 1 });
      else out.playFile(file, { fadeIn: 0, fade: 0, onEnded: (failed) => (failed ? this.fail(id, 'this browser cannot play it') : this.ended(id)) });
      this.files.audition?.(true);
      this.watch = this.win.setInterval?.(() => { if (this.el && !this.el.isConnected) this.stop(); }, 500) ?? 0;
    } catch (err) {
      this.fail(id, err.message);
    }
  }

  event(id, e) {
    if (e.type === 'ended') this.ended(id);
    else if (e.type === 'error') this.fail(id, e.message === 'no VGM player' ? 'the VGM player is missing from this copy of the game' : e.message);
  }

  ended(id) { if (this.id === id) this.stop(); }

  fail(id, text) {
    if (this.id !== id) return;
    this.stop(false);
    this.error = { id, text };
    this.onChange();
  }

  stop(tell = true) {
    if (this.watch) { this.win.clearInterval?.(this.watch); this.watch = 0; }
    const was = this.id;
    this.id = null;
    if (this.out) { this.out.release(); this.out = null; }
    if (was !== null) this.files.audition?.(false);
    if (tell && was !== null) this.onChange();
  }
}

/**
 * The section's elements (a flat list), drawn from `state` ({ musicTracks, musicReport }): the picker, what was
 * read, the Music Test list. act(label, fn) runs a change and draws the page again; picker(accept, onFiles) makes a file input.
 */
export function musicSection({ state, busy, act, picker, test, files }) {
  const input = picker(MUSIC_ACCEPT, (list) => act(`Reading ${list.map((f) => f.name).join(', ')}…`, async () => {
    state.musicReport = musicReportText(await files.importMusic(list));
  }));
  const tracks = state.musicTracks ?? [];
  const select = (t) => {
    const value = slotValue(t.lists), choices = SLOT_CHOICES.some(([v]) => v === value) ? SLOT_CHOICES : [...SLOT_CHOICES, [value, where(value.split(','))]];
    return h('select', { 'aria-label': `Where ${t.meta?.title ?? t.name} plays`, disabled: busy, dataset: { focus: `slot-${t.id}` },
      onchange: (e) => act(null, () => files.assignTrack(t.id, e.target.value.split(',').filter(Boolean))) },
    choices.map(([v, text]) => h('option', { value: v, selected: v === value }, text)));
  };
  const row = (t, i) => {
    const title = t.meta?.title ?? t.name, playing = test.id === t.id, err = test.error?.id === t.id ? test.error.text : null;
    const loop = t.meta?.loopSeconds > 0 ? `loop ${formatTime(t.meta.loopSeconds)}` : t.type === VGM_TYPE ? 'no loop' : '';
    return h('li', { class: playing ? 'playing' : '' },
      h('span', { class: 'of-title', title: `${title} — ${t.name}` }, `${i + 1}. ${title}`, h('small', {}, t.name)),
      h('span', { class: 'of-time', title: 'Length, and the part that loops' }, formatTime(t.meta?.seconds), loop && h('br'), loop),
      select(t),
      h('button', { type: 'button', class: 'dm-btn small of-play', disabled: busy, 'aria-pressed': String(playing), 'aria-label': `${playing ? 'Stop' : 'Play'} ${title}`, dataset: { focus: `play-${t.id}` },
        onclick: () => (playing ? test.stop() : test.play(t.id)) }, playing ? 'Stop' : 'Play'),
      h('button', { type: 'button', class: 'dm-btn small', disabled: busy, 'aria-label': `Remove ${title}`, dataset: { focus: `rm-${t.id}` },
        onclick: () => act(null, async () => { if (test.id === t.id) test.stop(false); await files.removeTrack(t.id); }) }, 'Remove'),
      err && h('span', { class: 'bad', role: 'alert' }, err));
  };
  return [
    h('h3', {}, 'Your music'),
    h('p', {}, 'The Mega Drive game’s own soundtrack, from your copy of it: choose its VGM files (.vgm or .vgz, or the .zip they came in) and each track plays where the Sega game played it. MP3, OGG or WAV tracks of your own work too. Where you have none, this game’s own music plays.'),
    h('p', { class: 'of-privacy' }, 'Music files are read here in the browser and kept in its storage, never uploaded.'),
    h('div', { class: 'dm-row' }, h('span', { class: 'dm-label' }, 'Music files'), h('div', { class: 'dm-control' },
      h('div', { class: 'of-pick' },
        h('button', { type: 'button', class: 'dm-btn small primary', disabled: busy, dataset: { focus: 'pick-music' }, onclick: () => input.click() }, 'Choose music files…'),
        input),
      state.musicReport && h('ul', { class: 'of-report' }, state.musicReport.map((r) => h('li', { class: r.bad ? 'bad' : '' }, r.text))),
      h('small', {}, 'German versions are left out: the game is in English.'))),
    h('h3', {}, 'Music test'),
    tracks.length
      ? [h('ul', { class: 'of-music', 'aria-label': 'Music test' }, tracks.map(row)), h('p', { class: 'of-cover' }, coverageText(tracks))]
      : h('div', { class: 'of-empty' }, 'No tracks yet: this game’s own music plays everywhere.'),
  ].flat();
}
