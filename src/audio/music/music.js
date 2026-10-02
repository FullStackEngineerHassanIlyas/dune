// The soundtrack's conductor (spec §6 Music): what plays, where it comes from and how loud. A mood ('menu', 'peace',
// 'battle', 'victory', 'defeat', a house's 'briefing', or 'over': silence) is played from the player's own files when
// they have assigned some to that playlist (Original Game Files, src/core/user-files.js, read lazily — it may not be
// there), else from the FM pool for it; shuffled, track after track, a queued FM track starting on the sample the
// last one ends. The music has its own gain at settings.musicVolume (0–1, 0.5 by default), read live; at 0 it is
// silent and its synth is taken down. Under an announcer line it dips. BattleMusic follows a battle through the
// director (director.js); MenuMusic plays the title on the main menu, on an audio context of its own.
import { MusicOutput } from './output.js';
import { MusicDirector, Shuffle, threatNear, LOOK_EVERY } from './director.js';
import { POOLS, TRACKS, BRIEFINGS } from './songs/index.js';

export const DEFAULT_VOLUME = 0.5;
export const DUCK = 0.6;            // the music under an announcer line: about -4.4 dB
export const PLAYLISTS = ['menu', 'peace', 'battle'];   // the moods the player's own files can take over
const PLAYLIST_WAIT = 3000;         // ms to wait for the player's playlists before playing the game's own music
/** How a mood comes in: the old music fades over `fade` s, the new one starts after `wait` s, fading in over `fadeIn`. */
export const ENTRANCES = {
  battle: { fade: 1.2, fadeIn: 0, wait: 0 },     // the battle track's own opening fill takes over at once
  peace: { fade: 3, fadeIn: 2, wait: 1.5 },
  over: { fade: 2 },                             // the battle is decided: the music stops, as in the original
  victory: { fade: 0.3, fadeIn: 0, wait: 0 },
  defeat: { fade: 0.3, fadeIn: 0, wait: 0 },
};
const ENTRANCE = { fade: 0.8, fadeIn: 0.5, wait: 0 };

/** settings.musicVolume as a level 0–1 (contract with Options: 0.5 when it is not set). */
export function musicVolume(settings) {
  const v = Number(settings?.musicVolume ?? DEFAULT_VOLUME);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VOLUME;
}

/** The player's own tracks for a playlist ([{ name, type, data }]), or none: the module may be missing or fail. */
export async function loadPlaylist(name, importer = () => import('../../core/user-files.js')) {
  try {
    const list = await (await importer()).playlistTracks?.(name);
    return Array.isArray(list) ? list.filter((t) => t && t.data) : [];
  } catch {
    return [];
  }
}

export class Conductor {
  /** audio: { ctx, master } (null ctx until a gesture opens it); pools: mood → FM track ids. */
  constructor({ audio, settings, win = globalThis.window, rng = Math.random, importer, pools = POOLS, house = null }) {
    this.settings = settings;
    this.pools = pools;
    this.house = house;
    this.win = win;
    this.output = new MusicOutput({ audio, win, onEvent: (e) => this.onSynth(e) });
    this.shuffle = new Shuffle(rng);
    this.lists = {};
    this.loaded = false;
    this.wanted = null;      // the mood asked for
    this.playing = null;     // the mood started
    this.current = null;     // the FM track id or the file now playing
    this.queued = null;      // the FM track queued to follow it
    this.ducked = false;
    this.on = false;         // the synth is up and the level above zero
    this.level = -1;
    const wait = new Promise((resolve) => win?.setTimeout?.(resolve, PLAYLIST_WAIT));
    this.ready = Promise.race([Promise.all(PLAYLISTS.map((n) => loadPlaylist(n, importer))), wait.then(() => null)]).then((lists) => {
      if (lists) PLAYLISTS.forEach((n, i) => { if (lists[i].length) this.lists[n] = lists[i]; });
      this.loaded = true;
    });
  }

  want(mood) { this.wanted = mood; }

  /** Settings, the context, the mood: anything changed since the last call is applied. Cheap; call it often. */
  update() {
    const level = musicVolume(this.settings) * (this.ducked ? DUCK : 1);
    if (level <= 0) {
      if (this.on || this.output.synthUp || this.output.loading) this.halt();
      return;
    }
    if (!this.loaded || !this.output.open()) return;
    this.on = true;
    if (level !== this.level) { this.level = level; this.output.setLevel(level); }
    if (this.playing !== this.wanted) this.start(this.wanted);
  }

  /** Music volume 0: silent and not running — the synth is taken down; it comes back with the mood when raised. */
  halt() {
    this.output.send({ cmd: 'stop', fade: 0 });
    this.output.release();
    this.on = false;
    this.playing = null;
    this.current = this.queued = null;
    this.level = -1;
  }

  poolFor(mood) {
    if (mood === 'briefing') return [BRIEFINGS[this.house] ?? 'atreides'];
    return this.pools[mood] ?? [];
  }

  start(mood) {
    const how = ENTRANCES[mood] ?? ENTRANCE, out = this.output;
    this.playing = mood;
    this.queued = null;
    const files = this.lists[mood];
    if (!mood || mood === 'over' || (!files?.length && !this.poolFor(mood).length)) {
      out.send({ cmd: 'stop', fade: how.fade ?? 1 });
      out.stopFile(how.fade ?? 1);
      this.current = null;
      return;
    }
    if (files?.length) {
      out.send({ cmd: 'stop', fade: how.fade });
      this.playFile(mood, how);
      return;
    }
    out.stopFile(how.fade);
    const pool = this.poolFor(mood), id = this.shuffle.pick(mood, pool), loops = pool.length > 1;
    out.send({ cmd: 'play', id, fade: how.fade, fadeIn: how.fadeIn, wait: how.wait, passes: loops ? TRACKS[id]?.passes ?? 1 : 0 });
    this.current = id;
    if (loops) this.queueNext(mood, pool);
  }

  queueNext(mood, pool) {
    const id = this.shuffle.pick(mood, pool);
    this.queued = id;
    this.output.send({ cmd: 'next', id, passes: TRACKS[id]?.passes ?? 1 });
  }

  /** The player's files, one after another: a file that ends or cannot be played gives way to the next. */
  playFile(mood, how, tries = 0) {
    const list = this.lists[mood], file = this.shuffle.pick(mood, list);
    this.current = file;
    this.output.playFile(file, {
      fade: how.fade, fadeIn: how.fadeIn || 0.6,
      onEnded: (failed) => {
        if (this.playing !== mood || this.current !== file) return;
        if (failed && tries + 1 >= list.length) { delete this.lists[mood]; this.playing = null; return; }   // none of them plays: the game's own music
        this.playFile(mood, { fade: 0.5, fadeIn: 0.3 }, failed ? tries + 1 : 0);
      },
    });
  }

  /** The synth's events: a queued track has started, so the next one is queued behind it. */
  onSynth(e) {
    if (e.type === 'started' && e.id === this.queued) {
      this.current = e.id;
      const pool = this.poolFor(this.playing);
      if (pool.length > 1) this.queueNext(this.playing, pool);
      else this.queued = null;
    }
  }

  setPaused(paused) { this.output.setPaused(paused); }

  debug() {
    const self = this;
    return {
      get mood() { return self.wanted; },
      get playing() { return self.playing; },
      get track() { return typeof self.current === 'string' ? self.current : self.current?.name ?? null; },
      get queued() { return self.queued; },
      get level() { return self.on ? self.level : 0; },
      get synth() { return self.output.node ? 'worklet' : self.output.worker ? 'worker' : null; },
      /** Share of the audio thread the FM synth takes (from the worklet's own clock), when known. */
      get load() { return self.output.load; },
      get playlists() { return Object.fromEntries(PLAYLISTS.map((n) => [n, self.lists[n]?.length ?? 0])); },
      /** The audio context's state, and the music's level after its gain in dB RMS (a test's proof that it sounds). */
      get context() { return self.output.ctx?.state ?? null; },
      meter: () => self.output.meter(),
      /** The settings object the game reads (musicVolume can be changed here as Options would). */
      get settings() { return self.settings; },
    };
  }
}

/** A battle's music: the director's mood, looked after every frame. */
export class BattleMusic {
  constructor({ world, house, engine, settings, win, rng, importer }) {
    this.world = world;
    this.house = house;
    this.engine = engine;
    this.director = new MusicDirector({ house });
    this.conductor = new Conductor({ audio: engine, settings, win, rng, importer, house });
    this.nextLook = 0;
  }

  onEvent(e) { this.director.onEvent(e, this.world.time); }

  /** Once a frame: a look for enemies near the player's forces each second of battle, then the mood and the settings. */
  frame() {
    const now = this.world.time, d = this.director;
    if (now >= this.nextLook && (d.mood === 'peace' || d.mood === 'battle')) {
      this.nextLook = now + LOOK_EVERY;
      if (threatNear(this.world, this.house)) d.fight(now);
    }
    this.conductor.ducked = !!this.engine?.ducked;
    this.conductor.want(d.update(now));
    this.conductor.update();
  }

  /** The result screen shows. */
  end(won) { this.director.end(won); this.frame(); }

  setPaused(paused) { this.conductor.setPaused(paused); }

  debug() { return Object.assign(this.conductor.debug(), { director: this.director }); }
}

/**
 * The main menu's own audio: a context opened by the first click or key (browser autoplay rules), a master at the
 * Options volume (off with Sound off) and a limiter. Separate from the menu backdrop's sound, which sleeps whenever
 * the backdrop is paused.
 */
export class MenuAudio {
  constructor(settings, win = globalThis.window) {
    this.settings = settings;
    this.win = win ?? {};
    this.ctx = null;
    this.master = null;
    this.held = false;
    const Context = this.win.AudioContext ?? this.win.webkitAudioContext;
    this.available = typeof Context === 'function';
    if (this.available) {
      this.onGesture = () => this.open();
      this.win.addEventListener?.('pointerdown', this.onGesture);
      this.win.addEventListener?.('keydown', this.onGesture);
    }
  }

  open() {
    if (!this.ctx) {
      try {
        const Context = this.win.AudioContext ?? this.win.webkitAudioContext, ctx = new Context();
        const master = ctx.createGain(), limiter = ctx.createDynamicsCompressor?.();
        if (limiter) {
          limiter.threshold.value = -6; limiter.knee.value = 4; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.15;
          master.connect(limiter);
          limiter.connect(ctx.destination);
        } else master.connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
        this.update();
      } catch (err) {
        console.warn('menu music disabled:', err);
        this.available = false;
        return;
      }
    }
    this.hold(this.held);
    if (this.ctx.state === 'running' && this.onGesture) {
      this.win.removeEventListener?.('pointerdown', this.onGesture);
      this.win.removeEventListener?.('keydown', this.onGesture);
      this.onGesture = null;
    }
  }

  /** The Options volume and Sound on/off, read live. */
  update() {
    if (!this.master) return;
    const v = this.settings.sound === false ? 0 : Number(this.settings.volume ?? 0.8);
    if (this.master.gain.value !== v) this.master.gain.value = v;
  }

  /** Held: suspended (a battle in the frame, a hidden page); otherwise running. */
  hold(held) {
    this.held = !!held;
    try { (held ? this.ctx?.suspend?.() : this.ctx?.resume?.())?.catch?.(() => {}); } catch { /* it plays on */ }
  }
}

const POLL_MS = 250;

/** The main menu's music: the title theme from the first gesture; silent behind a battle and on a hidden page. */
export class MenuMusic {
  /** track: a track id to play instead of the title (the menu's ?music= flag, for listening to any track). */
  constructor({ settings, win = globalThis.window, track = null, importer, rng }) {
    this.win = win;
    this.audio = new MenuAudio(settings, win);
    const pools = track && TRACKS[track] ? { ...POOLS, menu: [track] } : POOLS;
    this.conductor = new Conductor({ audio: this.audio, settings, win, rng, pools, importer: track ? async () => ({}) : importer });
    this.conductor.want('menu');
    this.away = false;
    this.timer = win?.setInterval?.(() => this.update(), POLL_MS);
    win?.document?.addEventListener?.('visibilitychange', () => this.audio.hold(this.away || win.document.hidden));
  }

  update() {
    this.audio.update();
    this.conductor.update();
  }

  /** A battle opens in the frame over the menu: the title fades out and the menu's audio rests. */
  leave() {
    this.away = true;
    this.conductor.want(null);
    this.conductor.update();
    this.win?.setTimeout?.(() => { if (this.away) this.audio.hold(true); }, 1000);
  }

  /** Back from the battle: the title again from its start. */
  enter() {
    this.away = false;
    this.audio.hold(!!this.win?.document?.hidden);
    this.conductor.playing = null;
    this.conductor.want('menu');
    this.update();
  }

  /** A house's briefing theme (for a house chosen on a menu screen); `null` goes back to the title. */
  briefing(house) {
    this.conductor.house = house;
    this.conductor.want(house ? 'briefing' : 'menu');
    if (house) this.conductor.playing = null;
    this.update();
  }

  debug() { return this.conductor.debug(); }
}
