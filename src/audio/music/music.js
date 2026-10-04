// The soundtrack's conductor (spec §6 Music): what plays, where it comes from and how loud. A mood names a moment
// of the game: on the menu 'intro', 'menu', 'houseSelect', 'briefing:<house>', 'region', 'victory:<house>',
// 'defeat:<house>', 'finale' and 'credits' (contract C6); in a battle 'ingame' (the Sega game's tunes in random
// order), or 'peace' and 'battle' (the adaptive director), then 'victory:<house>' / 'defeat:<house>', and 'over'
// (silence). Each mood is played from the player's own files in its slot (sega-tracks.js SLOTS; Original Game
// Files, src/core/user-files.js, read lazily — it may not be there — and again when the store says they changed),
// else from the game's own FM tracks for that role (songs/index.js, contract C7), else from the nearest role (the
// house selection falls back to the menu, a house's victory to the plain victory, ...). Items are FM track ids,
// the player's media files, or their Mega Drive VGM files, which play on the same synth as the FM tracks (C8).
// Shuffled, track after track; a synth track queued behind another starts on the very sample it ends, which is
// also how the intro hands over to the menu; and when the next mood's music is the one already sounding (the
// Sega Opening in both the intro and the menu slot) it simply carries on. The music has its own gain at
// settings.musicVolume (0–1, 0.5 by default), read live; at 0 it is silent and its synth taken down. Under an
// announcer line it dips. BattleMusic follows a battle; MenuMusic plays the menu's moods on a context of its own,
// primed at page load so the intro's first note sounds the moment the player's gesture lets it.
import { MusicOutput, VGM_TYPE, vgmId } from './output.js';
import { MusicDirector, Shuffle, threatsNear, LOOK_EVERY } from './director.js';
import * as SONGS from './songs/index.js';
import { SLOTS } from './sega-tracks.js';

const { POOLS, TRACKS, BRIEFINGS } = SONGS;
/** Each house's own briefing, victory and defeat tracks (songs/index.js, contract C7; a table may lack the last two). */
const THEMES = { briefing: BRIEFINGS, victory: SONGS.VICTORY, defeat: SONGS.DEFEAT };
/** The slots a battle's music can play (its house's ending added); the menu plays all the others. */
const IN_GAME = ['ingame', 'peace', 'battle'];
export const battleSlots = (house) => [...IN_GAME, `victory-${house}`, `defeat-${house}`].filter((n) => SLOTS.includes(n));
export const MENU_SLOTS = SLOTS.filter((n) => !IN_GAME.includes(n));

export const DEFAULT_VOLUME = 0.5;
export const DUCK = 0.6;            // the music under an announcer line: about -4.4 dB
export const PLAYLISTS = SLOTS;     // the moments the player's own files can take over (one list: sega-tracks.js)
const PLAYLIST_WAIT = 3000;         // ms to wait for the player's playlists before playing the game's own music
const INTRO_LIST_WAIT = 400;        // ms past the intro's gesture the cue waits for them at most
const INTRO_AUDIBLE_WAIT = 1500;    // ms intro() waits to hear the cue before it says there is none
const INTRO_LATE = 3000;            // ms past the intro's gesture a cue not yet heard is given up (too far out of step)
const SKIP_FADE = 0.4;              // seconds: a skipped intro's cue fades out under the menu's music
/** How a mood comes in: the old music fades over `fade` s, the new one starts after `wait` s, fading in over `fadeIn`. */
export const ENTRANCES = {
  battle: { fade: 1.2, fadeIn: 0, wait: 0 },     // the battle track's own opening fill takes over at once
  peace: { fade: 3, fadeIn: 2, wait: 1.5 },
  ingame: { fade: 1, fadeIn: 0, wait: 0.5 },     // the Sega game's next tune after a breath
  over: { fade: 2 },                             // the battle is decided: the music stops, as in the original
  victory: { fade: 0.3, fadeIn: 0, wait: 0, once: true },   // once through and rung out: it does not loop on behind
  defeat: { fade: 0.3, fadeIn: 0, wait: 0, once: true },    // "Keep watching" (the original stops the music there)
  intro: { fade: 0.3, fadeIn: 0, wait: 0, once: true, then: 'menu' },   // full force at once; the menu follows it
  region: { fade: 0.8, fadeIn: 0, wait: 0, once: true },    // the region zoom: about 7 s, then quiet until the battle
};
/** On the menu a house's victory or defeat plays on under the results, as the Sega game's did. */
export const MENU_ENTRANCES = { ...ENTRANCES, victory: { fade: 0.8, fadeIn: 0, wait: 0 }, defeat: { fade: 0.8, fadeIn: 0, wait: 0 } };
const ENTRANCE = { fade: 0.8, fadeIn: 0.5, wait: 0 };

/** settings.musicVolume as a level 0–1 (contract with Options: 0.5 when it is not set). */
export function musicVolume(settings) {
  const v = Number(settings?.musicVolume ?? DEFAULT_VOLUME);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VOLUME;
}

const USER_FILES = () => import('../../core/user-files.js');
/** A playlist told apart from another without comparing its data. */
const signature = (list) => (list ?? []).map((t) => `${t.id ?? ''}:${t.name}:${t.data.byteLength}`).join('|');
const isFile = (x) => x !== null && typeof x === 'object';
const isVgm = (x) => isFile(x) && x.type === VGM_TYPE;
/** Played by the synth (FM ids and VGMs), so one can be queued behind another to the sample. */
const onSynth = (x) => typeof x === 'string' || isVgm(x);
const synthId = (x) => (typeof x === 'string' ? x : vgmId(x));
/** The same music: one FM track, or one of the player's files (one record of the store, whichever slot it came from). */
const same = (a, b) => a === b || (isFile(a) && isFile(b) && a.id !== undefined && a.id !== null && a.id === b.id);
const fileKey = (f) => (f.id !== undefined && f.id !== null ? `#${f.id}` : `${f.name}:${f.data?.byteLength}`);
const usable = (t) => t && t.data;

/** The player's own tracks for a playlist ([{ name, type, data }]), or none: the module may be missing or fail. */
export async function loadPlaylist(name, importer = USER_FILES) {
  try {
    const list = await (await importer()).playlistTracks?.(name);
    return Array.isArray(list) ? list.filter(usable) : [];
  } catch {
    return [];
  }
}

/**
 * These slots' tracks ({ slot: [...] }), in one read where the store offers it (a file in two slots is one object);
 * only these are read, so a battle does not hold the menu's music.
 */
export async function loadPlaylists(importer = USER_FILES, slots = SLOTS) {
  let m = null;
  try { m = await importer(); } catch { return {}; }
  try {
    if (typeof m?.playlists === 'function') {
      const all = (await m.playlists(slots)) ?? {};
      return Object.fromEntries(slots.map((n) => [n, Array.isArray(all[n]) ? all[n].filter(usable) : []]));
    }
  } catch { /* the one read failed: slot by slot */ }
  const lists = await Promise.all(slots.map((n) => loadPlaylist(n, async () => m)));
  return Object.fromEntries(slots.map((n, i) => [n, lists[i]]));
}

export class Conductor {
  /**
   * audio: { ctx, master } (null ctx until a gesture opens it); pools: role → FM track ids (POOLS, contract C7);
   * themes: { briefing, victory, defeat }, house → its own track id; slots: those of the player's files it reads.
   */
  constructor({ audio, settings, win = globalThis.window, rng = Math.random, importer, pools = POOLS, tracks = TRACKS, themes = THEMES, slots = SLOTS, house = null, entrances = ENTRANCES }) {
    this.settings = settings;
    this.importer = importer;
    this.pools = pools;
    this.tracks = tracks;
    this.themes = { ...THEMES, ...themes };
    this.slots = slots;
    this.house = house;
    this.entrances = entrances;
    this.win = win;
    this.output = new MusicOutput({ audio, win, onEvent: (e) => this.onSynth(e) });
    this.shuffle = new Shuffle(rng);
    this.lists = {};
    this.failed = new Set();   // the player's files that would not play (this session, until the lists change)
    this.loaded = false;
    this.wanted = null;      // the mood asked for
    this.override = null;    // a one-off entrance for the next start (a skipped intro)
    this.playing = null;     // the mood started
    this.source = null;      // what it resolved to: { mood (the role that has music), items }
    this.current = null;     // the item playing: an FM track id or one of the player's files
    this.queued = null;      // the synth item queued to follow it, to the sample
    this.synthNext = null;   // the id the synth was last told to queue, until it starts it or is told otherwise
    this.after = null;       // or the item to start when it ends (a media file is involved)
    this.chain = null;       // the mood the queued/after item belongs to (the intro's hand-over to the menu)
    this.ducked = false;
    this.held = false;       // the game's sound is muted (M, Sound off), or a track is being auditioned: the synth rests
    this.auditioning = false;
    this.paused = false;
    this.on = false;         // the synth is up and the level above zero
    this.level = -1;
    this.reads = 0;
    this.ready = this.reloadPlaylists();
    // the store tells its followers when the player changes their files (user-files.js follow(), held weakly)
    Promise.resolve().then(importer ?? USER_FILES).then((m) => m?.follow?.(this)).catch(() => {});
  }

  /** The store's word that the player changed their files: the playlists are read again. */
  playlistsChanged() { this.reloadPlaylists(); }   // user-files.js notify('playlists')

  /** The store's word that a track is being auditioned on the Original Game Files page: the music makes way. */
  auditionChanged(on) { this.auditioning = !!on; this.update(); }

  /**
   * The player's playlists, read (again): the first read waits PLAYLIST_WAIT at most before the game's own music
   * plays. A mood playing whose music changed starts again from it (or from the FM, the list emptied).
   */
  reloadPlaylists() {
    const read = ++this.reads, wait = new Promise((resolve) => this.win?.setTimeout?.(resolve, PLAYLIST_WAIT));
    return Promise.race([loadPlaylists(this.importer, this.slots), wait.then(() => null)]).then((lists) => {
      if (read !== this.reads) return;   // a later read is on its way
      let changed = false;
      if (lists) for (const n of this.slots) {
        const list = lists[n] ?? [];
        if (signature(list) === signature(this.lists[n])) continue;   // unchanged: the same objects stay (the shuffle knows them)
        if (list.length) this.lists[n] = list; else delete this.lists[n];
        changed = true;
      }
      const first = !this.loaded;
      this.loaded = true;
      if (changed) { this.failed.clear(); this.listsChanged(); }
      if (first) this.update();
    });
  }

  /** The lists changed under a mood that plays: it starts again if its music is now another (the intro's cue plays on). */
  listsChanged() {
    if (!this.playing || !this.on) return;
    if (this.chain || this.playing === 'intro') { this.queued = this.after = null; this.planNext(); return; }   // what follows the cue is planned again
    const now = this.resolve(this.playing);
    if (signature((now?.items ?? []).filter(isFile)) === signature((this.source?.items ?? []).filter(isFile)) && now?.mood === this.source?.mood) return;
    this.playing = null;
    this.update();
  }

  want(mood, how = null) {
    this.wanted = mood;
    this.override = mood === this.playing ? null : how;
  }

  /** Settings, the context, the mood: anything changed since the last call is applied. Cheap; call it often. */
  update() {
    const level = musicVolume(this.settings) * (this.ducked ? DUCK : 1);
    if (level <= 0) {
      if (this.on || this.output.synthUp || this.output.loading) this.halt();
      return;
    }
    const open = this.output.open();   // the synth loads while the playlists are read (and while a context waits for a gesture)
    if (!this.loaded || !open) return;
    this.on = true;
    if (level !== this.level) { this.level = level; this.output.setLevel(level); }
    if (this.playing !== this.wanted) this.start(this.wanted);
    const held = !!this.output.audio?.muted || this.auditioning;
    if (held !== this.held) {
      this.held = held;
      this.output.send({ cmd: 'hold', on: held });
      this.output.setPaused(this.paused || held);
    }
  }

  /** Music volume 0: silent and not running — the synth is taken down; it comes back with the mood when raised. */
  halt() {
    this.output.send({ cmd: 'stop', fade: 0 });
    this.output.release();
    this.on = false;
    this.playing = null;
    this.current = this.queued = this.after = this.chain = this.synthNext = null;
    this.level = -1;
    this.held = false;   // a new synth starts unheld; the next update holds it again if need be
  }

  entranceOf(mood) {
    const kind = String(mood).split(':')[0];
    return { ...ENTRANCE, ...this.entrances[kind] };
  }

  /** The game's own tracks of the ids that exist (the score may not have written them all). */
  fm(ids) { return (ids ?? []).filter((id) => this.tracks[id]); }

  /**
   * A mood's role: the slot of the player's files for it, the FM tracks for it, and the nearest role to fall back
   * on. null: silence ('over', null, anything unknown).
   */
  role(mood) {
    const [kind, who] = String(mood ?? '').split(':'), p = this.pools;
    switch (kind) {
      case 'intro': return { slot: 'intro', pool: this.fm(p.intro ?? ['opening']), near: 'menu' };
      case 'menu': return { slot: 'menu', pool: this.fm(p.menu ?? ['title']) };
      case 'houseSelect': return { slot: 'houseSelect', pool: this.fm(p.houseSelect ?? ['houseSelect']), near: 'menu' };
      case 'briefing': {
        const theme = this.themes.briefing?.[who ?? this.house] ?? 'atreides';   // the Fremen fight with the Atreides, ...
        return { slot: `briefing-${theme}`, pool: this.fm([theme]), near: 'menu' };
      }
      case 'region': return { slot: 'region', pool: this.fm(p.region ?? ['region']), near: this.house ? 'briefing' : 'menu' };
      case 'victory': case 'defeat': {
        if (!who) return { slot: null, pool: this.fm(p[kind] ?? [kind]) };
        const own = `${kind}-${who}`, table = this.themes[kind];
        return { slot: SLOTS.includes(own) ? own : null, pool: this.fm([table?.[who] ?? own]), near: kind };
      }
      case 'finale': return { slot: 'finale', pool: this.fm(p.finale ?? ['finale']), near: 'credits' };
      case 'credits': return { slot: 'credits', pool: this.fm(p.credits ?? ['credits']), near: 'menu' };
      case 'peace': case 'battle': return { slot: kind, pool: this.fm(p[kind]) };
      // the Sega game: its five tunes; the player's peace and battle files before ours
      case 'ingame': return { slot: 'ingame', also: ['peace', 'battle'], pool: this.fm([...(p.peace ?? []), ...(p.battle ?? [])]) };
      default: return null;
    }
  }

  /** What a mood plays: { mood: the role that has music, items }, or null for silence. */
  resolve(mood) {
    for (let m = mood, hops = 0; m && hops < 6; hops++) {
      const r = this.role(m);
      if (!r) return null;
      const files = this.usableFiles(r.slot ? this.lists[r.slot] : null) ?? (r.also ? this.usableFiles(r.also.flatMap((s) => this.lists[s] ?? [])) : null);
      if (files) return { mood: m, items: files };
      if (r.pool.length) return { mood: m, items: r.pool };
      m = r.near;
    }
    return null;
  }

  usableFiles(list) {
    const ok = (list ?? []).filter((f) => !this.failed.has(fileKey(f)));
    return ok.length ? ok : null;
  }

  /** Starts a mood's music; `fresh`: another tune even when the one sounding would do (the Sega mode's re-roll). */
  start(mood, { fresh = false } = {}) {
    const how = { ...this.entranceOf(mood), ...this.override };
    this.override = null;
    this.playing = mood;
    this.queued = this.after = this.chain = null;
    this.endedCurrent = false;
    let src = (this.source = this.resolve(mood));
    if (!src) { this.silence(how.fade ?? 1); return; }
    const sounding = this.current !== null && src.items.some((x) => same(x, this.current));
    if (sounding) this.shuffle.last.set(mood, this.current);   // never the same tune twice running
    const carry = sounding && !fresh, item = carry ? this.current : this.shuffle.pick(mood, src.items);
    let loop = !how.once;
    if (how.then) {
      const then = this.resolve(how.then);
      if (then && then.items.some((x) => same(x, item))) {
        // the cue is the next mood's music too (the Sega Opening in the intro and the menu slots): it plays on for good
        this.wanted = this.playing = mood = how.then;
        this.source = src = then;
        this.shuffle.last.set(mood, item);
        loop = !this.entranceOf(mood).once;
      } else this.chain = how.then;
    }
    if (carry) {
      // the music the mood wants is the one sounding: on it goes, and what follows it is planned again
      this.planNext();
      return;
    }
    this.play(item, how, this.passesFor(item, src.items.length, loop));
    this.planNext();
  }

  silence(fade) {
    this.output.send({ cmd: 'stop', fade });
    this.output.stopFile(fade);
    this.current = this.synthNext = null;
  }

  /** How many times through: one of many plays its own number, one alone loops for ever (or once, for a once mood). */
  passesFor(item, many, loop) {
    if (typeof item === 'string') return many > 1 ? this.tracks[item]?.passes ?? 1 : loop ? 0 : 1;
    if (isVgm(item)) return many > 1 ? (item.meta?.loopSeconds > 0 ? 2 : 1) : loop ? 0 : 1;
    return 1;
  }

  play(item, how, passes) {
    const out = this.output, fade = how.fade ?? ENTRANCE.fade, fadeIn = how.fadeIn ?? 0, wait = how.wait ?? 0;
    this.current = item;
    this.synthNext = null;   // a play or a stop empties the synth's queue
    if (typeof item === 'string') {
      out.stopFile(fade);
      out.send({ cmd: 'play', id: item, fade, fadeIn, wait, passes });
    } else if (isVgm(item)) {
      out.stopFile(fade);
      out.playVgm(item, { fade, fadeIn, wait, passes });
    } else {
      out.send({ cmd: 'stop', fade });
      out.playFile(item, {
        fade, fadeIn: fadeIn || 0.6, paused: this.paused || this.held,   // a new file waits with the rest
        onEnded: (failed) => {
          if (this.current !== item) return;
          if (failed) this.failedItem(item); else this.next();
        },
      });
    }
  }

  /** What follows the item playing: queued on the synth to the sample, or started when it ends. False: nothing. */
  planNext() {
    const cur = this.current;
    if (cur === null) return false;
    let mood = this.playing, src = this.source;
    if (this.chain) {
      mood = this.chain;
      src = this.resolve(mood);
      if (!src) { this.chain = null; this.unqueue(); return false; }
    } else if (!src || src.items.length < 2) {
      if (isFile(cur) && !isVgm(cur) && !this.entranceOf(mood).once) this.after = cur;   // a file alone plays again
      this.unqueue();
      return this.after !== null;
    }
    const next = this.shuffle.pick(mood, src.items), passes = this.passesFor(next, src.items.length, !this.entranceOf(mood).once);
    if (onSynth(cur) && onSynth(next) && !this.endedCurrent) {
      this.queued = next;
      this.synthNext = synthId(next);
      if (typeof next === 'string') this.output.send({ cmd: 'next', id: next, passes });
      else this.output.queueVgm(next, passes);
    } else {
      this.after = next;
      this.unqueue();
    }
    return true;
  }

  /** What the synth was told to queue is not what follows now (a file, or nothing): it forgets it. */
  unqueue() {
    if (this.synthNext === null) return;
    this.synthNext = null;
    this.output.send({ cmd: 'next', id: null });
  }

  /** The intro's queued music has begun: the mood is the menu's now. */
  handOver() {
    if (!this.chain) return;
    if (this.wanted === this.playing) this.wanted = this.chain;
    this.playing = this.chain;
    this.source = this.resolve(this.chain);
    this.chain = null;
  }

  /** The item playing is over: the one planned after it, or nothing. */
  next() {
    const item = this.after;
    this.after = null;
    this.endedCurrent = false;
    if (item === null) { this.current = null; return; }
    this.handOver();
    const n = this.source?.items.length ?? 1;
    this.play(item, { fade: 0.5, fadeIn: isFile(item) && !isVgm(item) ? 0.3 : 0, wait: 0 }, this.passesFor(item, n, !this.entranceOf(this.playing).once));
    this.planNext();
  }

  /** One of the player's files would not play: it is left out, and another (or the FM, if none is left) takes its place. */
  failedItem(item) {
    console.warn('music: cannot play', item?.name);
    this.failed.add(fileKey(item));
    const following = (same(this.queued, item) || same(this.after, item)) && !same(this.current, item);
    this.queued = this.after = null;
    if (following && !this.endedCurrent) { this.planNext(); return; }   // another is planned behind the one playing
    // the item playing would not, or the one to start as it ended: the mood (the intro's next one) starts without it
    if (following) this.handOver();
    this.current = null;
    const mood = this.playing;
    this.playing = null;
    this.start(mood);
  }

  /** The synth's events: the queued item has started, an item has ended, or a VGM would not play. */
  onSynth(e) {
    // only the queue's own start counts: a play command's 'started' (of the same id, maybe long gone) is not it
    const fromQueue = e.type === 'started' && e.queued;
    if ((fromQueue || e.type === 'error') && e.id === this.synthNext) this.synthNext = null;   // taken from the queue
    if (fromQueue && this.queued !== null && e.id === synthId(this.queued)) {
      this.current = this.queued;
      this.queued = null;
      this.endedCurrent = false;
      this.handOver();
      this.planNext();
    } else if (e.type === 'ended' && this.current !== null && onSynth(this.current) && e.id === synthId(this.current)) {
      if (this.queued === null) this.next();   // a queued one starts on this very sample by itself
      else this.endedCurrent = true;
    } else if (e.type === 'error') {
      const bad = [this.current, this.queued].find((x) => isVgm(x) && synthId(x) === e.id);
      if (bad) this.failedItem(bad);
    }
  }

  setPaused(paused) {
    this.paused = !!paused;
    this.output.setPaused(this.paused || this.held);
  }

  debug() {
    const self = this;
    const name = (x) => (x === null ? null : typeof x === 'string' ? x : x.name ?? null);
    return {
      get mood() { return self.wanted; },
      get playing() { return self.playing; },
      get track() { return name(self.current); },
      /** Where it comes from: 'fm' (the game's own), 'vgm' or 'file' (the player's), or null. */
      get source() { const c = self.current; return c === null ? null : typeof c === 'string' ? 'fm' : isVgm(c) ? 'vgm' : 'file'; },
      /** The role whose music plays (another than the mood's when it fell back). */
      get from() { return self.source?.mood ?? null; },
      get queued() { return name(self.queued ?? self.after); },
      get level() { return self.on ? self.level : 0; },
      /** Resting where it is: the game's sound muted, or a track being heard in the Music Test. */
      get held() { return self.held; },
      get synth() { return self.output.node ? 'worklet' : self.output.worker ? 'worker' : null; },
      /** Share of the audio thread the synth takes (from the worklet's own clock), when known. */
      get load() { return self.output.load; },
      get playlists() { return Object.fromEntries(PLAYLISTS.map((n) => [n, self.lists[n]?.length ?? 0])); },
      /** The audio context's state, and (a promise) the music's level after its gain in dB RMS: a test's proof that it sounds. */
      get context() { return self.output.ctx?.state ?? null; },
      meter: () => self.output.meter(),
      /** The settings object the game reads (musicVolume can be changed here as Options would). */
      get settings() { return self.settings; },
    };
  }
}

/**
 * A battle's music. Settings musicMode 'sega' (the default) plays the in-game tunes one after another in random
 * order, never the same twice running, as the Sega game did — a new one each time its menu closes; 'adaptive'
 * follows the director (peace, then battle when fighting starts near the player's forces). Read live. The end:
 * the battle house's own victory or defeat, else the plain one.
 */
export class BattleMusic {
  constructor({ world, house, engine, settings, win, rng, importer, tracks, pools, themes }) {
    this.world = world;
    this.house = house;
    this.engine = engine;
    this.settings = settings;
    this.director = new MusicDirector({ house });
    this.conductor = new Conductor({ audio: engine, settings, win, rng, importer, house, tracks, pools, themes, slots: battleSlots(house) });
    this.nextLook = 0;
    this.near = [];   // the enemies near the player's forces at the last look (reused)
  }

  get mode() { return this.settings?.musicMode === 'adaptive' ? 'adaptive' : 'sega'; }

  onEvent(e) { this.director.onEvent(e, this.world.time); }

  /** Once a frame: (adaptive) a look for enemies coming near the player's forces each second, then the mood and the settings. */
  frame() {
    const now = this.world.time, d = this.director, adaptive = this.mode === 'adaptive';
    if (adaptive && now >= this.nextLook && (d.mood === 'peace' || d.mood === 'battle')) {
      this.nextLook = now + LOOK_EVERY;
      d.sight(threatsNear(this.world, this.house, this.near), now);
    }
    this.conductor.ducked = !!this.engine?.ducked;
    this.conductor.want(this.moodOf(d.update(now), adaptive));
    this.conductor.update();
  }

  moodOf(mood, adaptive) {
    if (mood === 'peace' || mood === 'battle') return adaptive ? mood : 'ingame';
    if (mood === 'victory' || mood === 'defeat') return `${mood}:${this.house}`;
    return mood;
  }

  /** The game menu has closed: in the Sega mode another tune, as the Sega game rolled one when its Options closed. */
  reroll() {
    const c = this.conductor;
    if (this.mode !== 'sega' || c.playing !== 'ingame' || !c.on) return;
    c.start('ingame', { fresh: true });
  }

  /** The result screen shows: won or lost, or a draw (silence). */
  end(won, draw = false) { this.director.end(won, draw); this.frame(); }

  setPaused(paused) { this.conductor.setPaused(paused); }

  debug() {
    const self = this;
    return Object.defineProperties(this.conductor.debug(), {
      director: { value: this.director, enumerable: true },
      mode: { get: () => self.mode, enumerable: true },   // 'sega' or 'adaptive', as the settings say now
    });
  }
}

const LIMITER_RELEASE = 0.15;         // seconds: the menu limiter's release
const LIMITER_START_RELEASE = 0.003;  // and while a fresh one settles, over its first LIMITER_SETTLE s of audio
const LIMITER_SETTLE = 0.25;

/**
 * The main menu's own audio: a context made at page load for the intro (suspended until a gesture lets it run),
 * or by the first click or key (browser autoplay rules), a master at the Options volume (off with Sound off) and a
 * limiter. Separate from the menu backdrop's sound, which sleeps whenever the backdrop is paused.
 */
export class MenuAudio {
  constructor(settings, win = globalThis.window) {
    this.settings = settings;
    this.win = win ?? {};
    this.ctx = null;
    this.master = null;
    this.held = false;
    this.started = false;   // let run (a gesture, or the intro's word); a context primed before that waits for it
    this.onStart = null;    // told once, as it is first let run, before it resumes
    const Context = this.win.AudioContext ?? this.win.webkitAudioContext;
    this.available = typeof Context === 'function';
    if (this.available) {
      this.onGesture = () => this.open();
      this.win.addEventListener?.('pointerdown', this.onGesture);
      this.win.addEventListener?.('keydown', this.onGesture);
    }
  }

  /** The context, made if need be; `start`: and running (inside a gesture), else left as the browser made it. */
  open({ start = true } = {}) {
    if (!this.available) return;
    if (!this.ctx) {
      try {
        const Context = this.win.AudioContext ?? this.win.webkitAudioContext, ctx = new Context();
        const master = ctx.createGain(), limiter = ctx.createDynamicsCompressor?.();
        if (limiter) {
          limiter.threshold.value = -6; limiter.knee.value = 4; limiter.ratio.value = 20; limiter.attack.value = 0.003;
          // a fresh compressor starts fully down and comes up at its release time, and the intro's cue starts on the
          // very first sample the context runs: a short release at first, so the opening hit is not blunted (by 4 dB
          // over its first 50 ms in Chrome with 0.15), and the usual one from a quarter second of audio on
          const r = limiter.release, t = ctx.currentTime ?? 0;
          if (r.setValueAtTime) { r.setValueAtTime(LIMITER_START_RELEASE, t); r.setValueAtTime(LIMITER_RELEASE, t + LIMITER_SETTLE); } else r.value = LIMITER_RELEASE;
          master.connect(limiter);
          limiter.connect(ctx.destination);
        } else master.connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
        this.update();
        // made ahead of the gesture: it waits for it, even where the browser would let it run at once
        if (!start && ctx.state === 'running') ctx.suspend?.()?.catch?.(() => {});
      } catch (err) {
        console.warn('menu music disabled:', err);
        this.available = false;
        return;
      }
    }
    if (!start) return;
    if (!this.started) { this.started = true; this.onStart?.(); }
    this.hold(this.held);
    if (this.ctx.state === 'running' && this.onGesture) {
      this.win.removeEventListener?.('pointerdown', this.onGesture);
      this.win.removeEventListener?.('keydown', this.onGesture);
      this.onGesture = null;
    }
  }

  /** Silent anyway (Sound off, volume 0): the music rests rather than play into a closed master. */
  get muted() { return this.settings.sound === false || !(Number(this.settings.volume ?? 0.8) > 0); }

  /** The Options volume and Sound on/off, read live. */
  update() {
    if (!this.master) return;
    const v = this.settings.sound === false ? 0 : Number(this.settings.volume ?? 0.8);
    if (this.master.gain.value !== v) this.master.gain.value = v;
  }

  /** Held: suspended (a battle in the frame, a hidden page, nothing to hear); otherwise running — once let run. */
  hold(held) {
    this.held = !!held;
    if (!held && !this.started) return;   // primed ahead of the gesture: a page shown again does not start it
    try { (held ? this.ctx?.suspend?.() : this.ctx?.resume?.())?.catch?.(() => {}); } catch { /* it plays on */ }
  }
}

const POLL_MS = 250;

/**
 * The main menu's music (contract C6): the intro's cue and the menu's moods. prime() at page load makes the context
 * (suspended), loads the synth and queues the cue; intro() inside the player's gesture lets it run, so it starts at
 * once, and says whether it is heard; the menu follows the cue by itself, or at once on skipIntro(). mood(name) for
 * every other screen. Its context rests (suspended: no gain, no compressor on the audio thread) behind a battle, on
 * a hidden page, at music volume 0 and with Sound off; a player's file, which a suspended context does not stop,
 * is paused with it.
 */
export class MenuMusic {
  /** track: a track id to play instead of the menu's music, everywhere on the menu (the ?music= flag, for listening). */
  constructor({ settings, win = globalThis.window, track = null, importer, rng, tracks = TRACKS, pools = POOLS, themes }) {
    this.win = win;
    this.settings = settings;
    this.audio = new MenuAudio(settings, win);
    this.audio.onStart = () => this.update();   // a gesture that is not the intro's: the primed cue gives way first
    this.track = track && tracks[track] ? track : null;
    this.conductor = new Conductor({
      audio: this.audio, settings, win, rng, tracks, themes, slots: MENU_SLOTS, pools: this.track ? { ...pools, menu: [this.track] } : pools,
      importer: this.track ? async () => ({}) : importer, entrances: MENU_ENTRANCES,
    });
    this.conductor.want('menu');
    this.primed = false;
    this.introAt = null;     // when intro() was called (performance.now ms): the cue is the intro's to play
    this.introHeard = false; // and it has been heard
    this.introDelay = null;  // ms from intro() to the cue sounding (debug)
    this.away = false;       // a battle is in the frame
    this.behind = false;     // and the music has faded out behind it
    this.hidden = false;
    this.timer = win?.setInterval?.(() => this.update(), POLL_MS);
    win?.document?.addEventListener?.('visibilitychange', () => this.rest());
  }

  update() {
    this.giveUpCue();
    this.audio.update();
    this.conductor.update();
    this.rest();
    if (this.audio.ctx?.state === 'running') this.conductor.output.kick();
  }

  /**
   * The intro's cue belongs to the intro: primed for one that never asks for it (the intro off, a return from a
   * battle) once sound is let run, or not heard within INTRO_LATE of the intro's gesture (Sound off, music volume 0,
   * a browser that kept the context from running), it gives way to the menu's music — and a cue never heard is
   * dropped by the synth without a sound.
   */
  giveUpCue() {
    const c = this.conductor;
    if (c.wanted !== 'intro' || !this.audio.started || this.introHeard) return;
    if (this.introAt !== null && this.sounding()) { this.introHeard = true; return; }
    if (this.introAt === null || this.now() - this.introAt > INTRO_LATE) c.want('menu');
  }

  now() { return this.win?.performance?.now?.() ?? Date.now(); }

  /** The context suspended whenever nothing is to be heard, and a player's file paused on a hidden page. */
  rest() {
    const hidden = !!this.win?.document?.hidden, a = this.audio;
    const held = this.behind || hidden || a.muted || musicVolume(a.settings) <= 0;
    if (held !== a.held) a.hold(held);
    if (hidden !== this.hidden) { this.hidden = hidden; this.conductor.setPaused(hidden); }
  }

  /** At page load, before any gesture: the context (suspended), the synth loading, the intro's cue queued in it. */
  prime() {
    if (this.primed || !this.audio.available) return;
    this.primed = true;
    if (!this.track && this.conductor.wanted === 'menu' && this.conductor.playing === null) this.conductor.want('intro');
    this.audio.open({ start: false });
    this.update();
  }

  /**
   * Inside the player's gesture: the intro's cue (the player's file in the 'intro' slot, else the game's 'opening')
   * starts now. Resolves true once it is heard; false at once when the music is off, muted or unavailable, and in
   * any case if nothing is heard within 1.5 s. The menu follows the cue by itself; a cue still unheard a moment
   * later is given up for the menu's music (giveUpCue), so it never plays later on the title.
   */
  intro() {
    const c = this.conductor;
    this.introAt = this.now();
    this.introHeard = false;
    if (this.track) c.want('menu');
    else if (c.playing !== 'intro') c.want('intro');
    this.prime();
    this.audio.open();   // the gesture lets the context run
    this.update();
    if (!c.loaded) {
      // the player's files are still being read: past a moment the game's own cue goes ahead
      this.win?.setTimeout?.(() => { if (!c.loaded) { c.loaded = true; this.update(); } }, INTRO_LIST_WAIT);
    }
    return this.audible(INTRO_AUDIBLE_WAIT);
  }

  /** The intro is skipped: its cue fades out quickly under the menu's music (which carries on if it is the same). */
  skipIntro() {
    const c = this.conductor;
    if (c.wanted !== 'intro' && c.playing !== 'intro') return;
    c.want('menu', { fade: SKIP_FADE, fadeIn: 0, wait: 0 });
    this.update();
  }

  /** A screen's music: 'menu', 'houseSelect', 'briefing:<house>', 'region', 'victory:<house>', 'defeat:<house>', 'finale', 'credits'. */
  mood(name) {
    const c = this.conductor, [kind, house] = String(name ?? 'menu').split(':');
    if ((kind === 'briefing' || kind === 'victory' || kind === 'defeat') && house) c.house = house;
    if (!this.track) c.want(name ?? 'menu');
    this.update();
  }

  /** A house's briefing theme (for a house chosen on a menu screen); `null` goes back to the title. */
  briefing(house) { this.mood(house ? `briefing:${house}` : 'menu'); }

  /** Resolves true when the music is heard, false when it cannot be (at once) or is not within `ms`. */
  audible(ms) {
    const t0 = this.now();
    return new Promise((resolve) => {
      const look = () => {
        if (this.sounding()) { this.introDelay = Math.round(this.now() - t0); this.introHeard = true; resolve(true); return; }
        if (this.silentAnyway() || this.now() - t0 >= ms || !this.win?.setTimeout) { resolve(false); return; }
        this.win.setTimeout(look, 20);
      };
      look();
    });
  }

  silentAnyway() {
    const a = this.audio;
    return !a.available || a.muted || musicVolume(this.settings) <= 0 || !!this.win?.document?.hidden;
  }

  /** The context runs and the item playing is in the synth's hands (or a file is playing). */
  sounding() {
    const c = this.conductor, out = c.output;
    if (this.audio.ctx?.state !== 'running' || !c.on || c.held || c.current === null) return false;
    if (isFile(c.current) && !isVgm(c.current)) return !!out.file && !out.file.el.paused;
    return out.synthUp && !out.gated && !out.pending.length;
  }

  /** A battle opens in the frame over the menu: the music fades out and the menu's audio rests. */
  leave() {
    this.away = true;
    this.conductor.want(null);
    this.conductor.update();
    this.win?.setTimeout?.(() => { if (this.away) { this.behind = true; this.rest(); } }, 1000);
  }

  /** Back from the battle: the menu's music again from its start (never the intro). */
  enter() {
    this.away = this.behind = false;
    this.conductor.playing = null;
    this.conductor.want('menu');
    this.update();
    this.reloadPlaylists();
  }

  /** The player's playlists read again (for whoever knows they changed: the Original Game Files page closing). */
  reloadPlaylists() { return this.conductor.reloadPlaylists(); }

  debug() {
    return Object.defineProperties(this.conductor.debug(), {
      primed: { get: () => this.primed, enumerable: true },
      introDelay: { get: () => this.introDelay, enumerable: true },   // ms from intro() to the cue being heard (null until then)
    });
  }
}
