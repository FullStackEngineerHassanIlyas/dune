// The Mentats' voices at run time (src/audio/mentat-voice.js; notes 2026-10-05-mentat-voice.md): a clip's timing
// track read for the face and the words (at(t) fills one frame, words in order, the mouth and the expression), the
// player with a fake Web Audio (one line at a time, stop, seek, end, ducking, the voice off), the words following
// the voice on the stage (src/ui/campaign/stage.js followSpeech) with a hand-cranked clock, the campaign screens
// asking for the right clips and stopping them, and the setting and its Options row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, FakeEl, settle, memoryStore, byAct } from './campaign-dom.mjs';

installDom();
const { MentatTrack, MentatVoice, VISEMES, EXPRESSIONS, restFrame, UNDUCK_AFTER, JOIN_GAP } = await import('../src/audio/mentat-voice.js');
const { followSpeech, START_WAIT } = await import('../src/ui/campaign/stage.js');
const { DEFAULTS, sanitize, loadSettings, saveSettings } = await import('../src/core/settings.js');
const { OPTION_ROWS } = await import('../src/ui/options.js');

// ——— a small track, as mentat.py writes them ———
const LINES = ['Hello there, Commander.', 'Spice must flow.', 'Go now.'];
const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
const JSON1 = {
  v: 1, id: 'atreides/m1-briefing', ms: 4000, lines: LINES,
  words: [[100, 400, 0, 0, 5], [450, 700, 0, 6, 11], [750, 1300, 0, 13, 22], [1800, 2100, 1, 0, 5], [2150, 2350, 1, 6, 10], [2400, 2800, 1, 11, 15],
    [3200, 3400, 2, 0, 2], [3450, 3900, 2, 3, 6]],
  sentences: [[100, 1300, 0, 2, 'grave'], [1800, 2800, 3, 5, 'warning'], [3200, 3900, 6, 7, 'angry']],
  visemes: { t: [0, 100, 180, 300, 1300, 1800, 1900, 2800], s: 'reaomfar' },
  env: { hz: 30, q: Array.from({ length: 120 }, (_, i) => B64[i < 3 ? 0 : i % 2 ? 63 : 31]).join('') },
};

test('a track: the mouth, the jaw, the face and the word at any time, in one frame object', () => {
  const tr = new MentatTrack(JSON1);
  assert.equal(tr.duration, 4);
  assert.equal(tr.words.length, 8);
  const out = restFrame();
  assert.equal(tr.at(0.05, out), out, 'filled in place: no allocation per frame');
  assert.equal(out.viseme, 'rest');
  assert.equal(out.word, -1);
  assert.equal(out.expression, 'grave', 'the first sentence\'s face from the start');
  assert.equal(out.speaking, false);
  tr.at(0.2, out);
  assert.equal(out.viseme, 'A');
  assert.equal(out.shape, VISEMES.indexOf('A'));
  assert.equal(out.from, VISEMES.indexOf('E'));
  assert.ok(out.mix > 0 && out.mix < 1, `moving from E to A: ${out.mix}`);
  assert.equal(out.word, 0);
  assert.equal(out.speaking, true);
  tr.at(1.5, out);
  assert.equal(out.speaking, false, 'between sentences');
  assert.equal(out.expression, 'grave', 'the face holds between sentences');
  tr.at(1.85, out);
  assert.equal(out.viseme, 'FV');
  assert.equal(out.expression, 'warning');
  assert.equal(out.sentence, 1);
  tr.at(3.5, out);
  assert.equal(out.expression, 'angry');
  assert.equal(out.word, 7);
  tr.at(5, out);
  assert.equal(out.viseme, 'rest');
  assert.equal(out.open, 0);
  assert.equal(out.speaking, false);
  // the envelope, interpolated at 30 Hz between 31/63 and 63/63
  tr.at(10.5 / 30, out);
  assert.ok(Math.abs(out.open - (31 + 63) / 2 / 63) < 1e-6, `open ${out.open}`);
  for (const t of [0, 0.3, 1, 2, 3, 4]) {
    const f = tr.at(t, out);
    assert.ok(VISEMES.includes(f.viseme) && EXPRESSIONS.includes(f.expression) && f.open >= 0 && f.open <= 1);
  }
});

test('two clips joined: times and lines of the second follow the first after the gap', () => {
  const a = new MentatTrack(JSON1), b = new MentatTrack({ ...JSON1, id: 'atreides/ending', lines: ['End.'], ms: 1000,
    words: [[100, 500, 0, 0, 3]], sentences: [[100, 500, 0, 0, 'pleased']], visemes: { t: [0, 100, 500], s: 'rer' }, env: { hz: 30, q: '0z0' } });
  const j = MentatTrack.join([a, b]);
  assert.equal(j.duration, 4 + JOIN_GAP + 1);
  assert.deepEqual(j.lines, [...LINES, 'End.']);
  const w = j.words.at(-1);
  assert.equal(w.line, 3);
  assert.ok(Math.abs(w.start - (4 + JOIN_GAP + 0.1)) < 1e-9);
  assert.equal(j.sentences.at(-1).first, 8);
  assert.equal(j.at(4 + JOIN_GAP + 0.2).expression, 'pleased');
  assert.equal(j.at(4 + JOIN_GAP + 0.2).word, 8);
});

// ——— a fake Web Audio and fetch ———
function fakeAudio() {
  const made = { sources: [], gains: [], resumed: 0, contexts: 0 };
  class Ctx {
    constructor() { made.contexts++; this.state = made.startState ?? 'running'; this.currentTime = 0; this.destination = {}; this.baseLatency = 0; made.ctx = this; this.listeners = []; }
    createGain() { const g = { gain: { value: 1, setTargetAtTime(v) { this.value = v; } }, connect() {}, disconnect() {} }; made.gains.push(g); return g; }
    createBufferSource() {
      const s = { buffer: null, connect() {}, disconnect() {}, onended: null, start(when, offset) { s.when = when; s.offset = offset; }, stop(t) { s.stopped = t; } };
      made.sources.push(s);
      return s;
    }
    decodeAudioData(data) { return Promise.resolve({ duration: 4, data }); }
    resume() { made.resumed++; return Promise.resolve(); }
    addEventListener(type, fn) { this.listeners.push(fn); }
    removeEventListener() {}
    run() { this.state = 'running'; for (const fn of this.listeners) fn(); }
  }
  return { made, context: () => new Ctx() };
}
function fakeFetch(clips = { 'atreides/m1-briefing': JSON1 }, { fail = new Set() } = {}) {
  const asked = [];
  const manifest = { version: 1, clips: Object.fromEntries(Object.entries(clips).map(([id, j]) => [id, { file: `${id}.ogg`, track: `${id}.json`, seconds: j.ms / 1000, text: j.lines.join('\n') }])) };
  const fetch = async (url) => {
    const path = new URL(url).pathname.replace(/^\/m\//, '');
    asked.push(path);
    if (fail.has(path)) return { ok: false, status: 404 };
    if (path === 'manifest.json') return { ok: true, json: async () => manifest };
    const id = path.replace(/\.(ogg|json)$/, '');
    if (!clips[id]) return { ok: false, status: 404 };
    return path.endsWith('.json') ? { ok: true, json: async () => clips[id] } : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  return { fetch, asked };
}
function timers() {
  const q = [];
  return { later: (fn, ms) => q.push({ fn, ms }), flush() { while (q.length) q.shift().fn(); }, q };
}
function voiceRig(settings = {}, opts = {}) {
  const audio = fakeAudio(), f = fakeFetch(opts.clips, opts), t = timers(), ducks = [];
  const voice = new MentatVoice({ settings: { ...DEFAULTS, ...settings }, base: 'http://x/m/', fetch: f.fetch, context: audio.context, later: t.later, duck: (on) => ducks.push(on) });
  return { voice, audio, f, t, ducks };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test('a line plays: loading, then playing on the context\'s clock; the music ducks; the end is told once', async () => {
  const { voice, audio, ducks, t } = voiceRig();
  const lines = [];
  voice.on('line', (l) => lines.push(l.id));
  const ends = [];
  voice.on('end', (l, why) => ends.push(why));
  await voice.manifest();   // fetched while the campaign's words load (prepare())
  const line = voice.speak('atreides', 1, 'briefing', { lines: LINES });
  assert.ok(line);
  assert.equal(line.state, 'loading');
  assert.equal(line.duration, 4, 'known from the manifest at once');
  assert.equal(line.time, 0);
  assert.equal(await line.started, true);
  assert.equal(line.state, 'playing');
  assert.deepEqual(lines, ['atreides/m1-briefing']);
  assert.deepEqual(ducks, [true]);
  const src = audio.made.sources[0];
  assert.equal(src.offset, 0);
  audio.made.ctx.currentTime = src.when + 1.95;
  assert.ok(Math.abs(line.time - 1.95) < 1e-9);
  assert.equal(line.now().viseme, 'A');
  assert.equal(voice.now().word, 3, 'the voice\'s frame follows its line');
  let ended = null;
  line.onEnd((why) => { ended = why; });
  src.onended();
  assert.equal(line.state, 'ended');
  assert.equal(ended, 'ended');
  assert.equal(line.time, 4);
  assert.deepEqual(ends, ['ended']);
  t.flush();
  assert.deepEqual(ducks, [true, false], 'the music comes back after the line');
  assert.equal(voice.current, null);
});

test('a new line stops the old one; stop() fades it; seek() restarts it further on', async () => {
  const two = { 'atreides/m1-briefing': JSON1, 'atreides/m1-advice': { ...JSON1, id: 'atreides/m1-advice' } };
  const { voice, audio, ducks, t } = voiceRig({}, { clips: two });
  const a = voice.speak('atreides', 1, 'briefing');
  await a.started;
  const b = voice.speak('atreides', 1, 'advice');
  assert.equal(a.state, 'stopped');
  assert.ok(audio.made.sources[0].stopped !== undefined, 'the old sound is stopped');
  assert.equal(await b.started, true);
  t.flush();
  assert.deepEqual(ducks, [true], 'no dip back up between two lines');
  audio.made.ctx.currentTime = 1;
  assert.equal(b.seek(3.1), true);
  const src = audio.made.sources.at(-1);
  assert.ok(Math.abs(src.offset - 3.1) < 1e-9);
  audio.made.ctx.currentTime = src.when + 0.2;
  assert.ok(Math.abs(b.time - 3.3) < 1e-9);
  b.stop();
  assert.equal(b.state, 'stopped');
  assert.equal(voice.current, null);
  t.flush();
  assert.deepEqual(ducks, [true, false]);
  assert.equal(voice.now().viseme, 'rest');
});

test('the voice says nothing when it is off, the sound is off, a clip is missing or says other words', async () => {
  for (const s of [{ mentatVoice: false }, { sound: false }, { voiceVolume: 0 }, { volume: 0 }]) {
    const { voice } = voiceRig(s);
    assert.equal(voice.enabled, false, JSON.stringify(s));
    assert.equal(voice.speak('atreides', 1, 'briefing'), null);
  }
  const { voice, f } = voiceRig();
  await voice.manifest();
  assert.equal(voice.speak('atreides', 2, 'briefing'), null, 'no such clip');
  assert.equal(voice.speak('atreides', 1, 'briefing', { lines: ['Other words.'] }), null, 'the screen says other words');
  assert.equal(voice.speak('atreides', null, 'nonsense'), null);
  assert.equal(f.asked.filter((p) => p === 'manifest.json').length, 1, 'the manifest is fetched once');
  // before the manifest is in: the line is made, then fails
  const late = voiceRig({}, { fail: new Set(['atreides/m1-briefing.ogg']) });
  const line = late.voice.speak('atreides', 1, 'briefing');
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(await line.started, false); } finally { console.warn = warn; }
  assert.equal(line.state, 'failed');
  // without Web Audio
  assert.equal(new MentatVoice({ settings: DEFAULTS, context: null, fetch: async () => ({}) }).speak('atreides', 1, 'briefing'), null);
});

test('a line stopped while it loads never sounds; a context waiting for a gesture holds it', async () => {
  const { voice, audio } = voiceRig();
  const line = voice.speak('atreides', 1, 'briefing');
  line.stop();
  assert.equal(await line.started, false);
  await flush();
  assert.equal(audio.made.sources.length, 0);
  const held = voiceRig();
  held.audio.made.startState = 'suspended';
  const l2 = held.voice.speak('atreides', 1, 'briefing');
  for (let i = 0; i < 5; i++) await flush();
  assert.equal(l2.state, 'loading', 'waits for the context to run');
  assert.ok(held.audio.made.resumed >= 1, 'asked to resume');
  held.audio.made.ctx.run();
  assert.equal(await l2.started, true);
});

// ——— the words follow the voice ———
function clock() {
  let now = 0;
  const queue = [];
  return {
    later: (fn, ms) => queue.push({ at: now + ms, fn }),
    run(ms) {
      const end = now + ms;
      for (;;) {
        queue.sort((a, b) => a.at - b.at);
        if (!queue.length || queue[0].at > end) break;
        const job = queue.shift();
        now = job.at;
        job.fn();
      }
      now = end;
    },
    get now() { return now; },
  };
}
/** A line whose time is the clock's, from when it is let start. */
function fakeSpeech(c, track = new MentatTrack(JSON1)) {
  let t0 = null, resolve;
  const s = {
    track, duration: track.duration, state: 'loading', seeks: [], stops: 0,
    started: new Promise((r) => { resolve = r; }),
    start() { t0 = c.now; s.state = 'playing'; resolve(true); },
    fail() { s.state = 'failed'; resolve(false); },
    get time() { return s.state === 'playing' ? Math.min(track.duration, (c.now - t0) / 1000) : 0; },
    seek(t) { s.seeks.push(t); t0 = c.now - t * 1000; return true; },
    stop() { s.stops++; if (s.state === 'loading' || s.state === 'playing') { s.state = 'stopped'; resolve(false); } },
  };
  return s;
}
const rows = (box) => box.children.map((c) => c.textContent);
const marked = (box) => box.findAll((el) => el.className === 'cp-now').map((el) => el.textContent);

test('the words follow the voice: the pair being said, typed up to the word, the word marked', async () => {
  const c = clock(), box = new FakeEl('div'), sp = fakeSpeech(c);
  let done = 0;
  const typer = followSpeech(box, LINES, sp, { later: c.later, instant: false, onDone: () => done++ });
  c.run(200);
  assert.deepEqual(rows(box), ['', ''], 'nothing before the voice starts');
  sp.start();
  c.run(50);
  assert.deepEqual(rows(box), ['', '']);
  c.run(200);   // 0.25 s: half way through "Hello"
  assert.equal(rows(box)[0], 'Hel');
  assert.deepEqual(marked(box), ['Hel']);
  assert.equal(typer.following, true);
  c.run(1250);  // 1.5 s: "Commander." said, its stop shown, the mark gone in the pause
  assert.deepEqual(rows(box), ['Hello there, Commander.', '']);
  assert.deepEqual(marked(box), []);
  c.run(700);   // 2.2 s: "must" begins on the second line
  assert.deepEqual(rows(box), ['Hello there, Commander.', 'Spice m']);
  assert.deepEqual(marked(box), ['m']);
  c.run(1050);  // 3.25 s: the third line is the next pair
  assert.deepEqual(rows(box), ['G', '']);
  sp.state = 'ended';
  c.run(40);
  assert.deepEqual(rows(box), ['Go now.', '']);
  assert.equal(done, 1);
  assert.equal(typer.done, true);
});

test('read on: skip takes the voice to the next pair; on the last pair it ends the line and shows it whole', async () => {
  const c = clock(), box = new FakeEl('div'), sp = fakeSpeech(c);
  let done = 0;
  const typer = followSpeech(box, LINES, sp, { later: c.later, instant: false, onDone: () => done++ });
  sp.start();
  c.run(500);
  typer.skip();
  assert.equal(sp.seeks.length, 1);
  assert.ok(Math.abs(sp.seeks[0] - 3.16) < 1e-9, `to just before "Go": ${sp.seeks[0]}`);
  c.run(100);
  assert.deepEqual(rows(box), ['G', '']);
  typer.skip();
  assert.equal(sp.stops, 1, 'the voice ends');
  assert.deepEqual(rows(box), ['Go now.', '']);
  assert.equal(done, 1);
  typer.skip();
  assert.equal(done, 1);
});

test('without the voice in time, or when it fails, the words are typed as before and the voice is stopped', async () => {
  const c = clock(), box = new FakeEl('div'), sp = fakeSpeech(c);
  const typer = followSpeech(box, LINES, sp, { later: c.later, instant: false });
  c.run(START_WAIT + 30);
  assert.equal(sp.stops, 1);
  assert.equal(typer.following, false);
  c.run(26 * 40);
  assert.deepEqual(rows(box), ['Hello there, Commander.', 'Spice must flow.']);
  const c2 = clock(), box2 = new FakeEl('div'), sp2 = fakeSpeech(c2);
  followSpeech(box2, LINES, sp2, { later: c2.later, instant: true });
  sp2.fail();
  await flush();
  c2.run(10);
  assert.deepEqual(rows(box2), ['Hello there, Commander.', 'Spice must flow.'], 'typed (instant) without it');
  // stop() (the screen changes) stops the voice too
  const c3 = clock(), sp3 = fakeSpeech(c3);
  const t3 = followSpeech(new FakeEl('div'), LINES, sp3, { later: c3.later });
  sp3.start();
  t3.stop();
  assert.equal(sp3.state, 'stopped');
});

test('reduced motion: each pair whole once the voice reaches it, the word still marked', () => {
  const c = clock(), box = new FakeEl('div'), sp = fakeSpeech(c);
  followSpeech(box, LINES, sp, { later: c.later, instant: true });
  sp.start();
  c.run(250);
  assert.deepEqual(rows(box), LINES.slice(0, 2));
  assert.deepEqual(marked(box), ['Hello']);
});

// ——— the campaign screens ask for the clips and stop them ———
test('the campaign screens: each Mentat line asks for its clip; Advice, Back and leaving stop the old one', async () => {
  const { MainMenu } = await import('../src/ui/main-menu.js');
  const STORY = await import('../src/data/story.js');
  const MISSIONS = await import('../src/data/campaign.js');
  const calls = [];
  let stops = 0;
  const voice = { say: (ids, { lines }) => { calls.push([ids.join('+'), lines.length]); return null; }, stop: () => { stops++; }, preload: (ids) => calls.push(['preload', ids.join('+')]), prepare() {} };
  const music = { mood() {} };
  const menu = new MainMenu(new FakeEl('div'), { settings: { ...DEFAULTS }, onStart() {}, onFullscreen() {}, music, shell: { launch() {}, quit() {}, on() {} }, backdrop: { setPaused() {}, start() {}, stop() {} },
    campaign: { store: memoryStore(), load: { story: async () => STORY, missions: async () => MISSIONS, atlas: async () => { throw new Error('none'); } }, voice } });
  menu.go('campaign-join');
  await settle();
  menu.campaign.state = { screen: 'campaign-join', house: 'ordos', mission: 1 };
  menu.go('campaign-join');
  await settle();
  assert.deepEqual(calls.find(([id]) => id.startsWith('ordos/page')), ['ordos/page-1', 3]);
  assert.ok(calls.some(([k, id]) => k === 'preload' && id === 'ordos/page-2'));
  calls.length = 0;
  menu.campaign.state = { screen: 'campaign-briefing', house: 'atreides', mission: 4 };
  menu.go('campaign-briefing');
  await settle();
  assert.deepEqual(calls[0], ['atreides/m4-briefing', STORY.BRIEFINGS.atreides[3].briefing.length]);
  assert.deepEqual(calls[1], ['preload', 'atreides/m4-advice']);
  const before = stops;
  byAct(menu.el, 'advice').click();
  assert.equal(calls.at(-2)[0], 'atreides/m4-advice');
  byAct(menu.el, 'back').click();
  assert.ok(stops > before, 'Back stops the Mentat');
  const s2 = stops;
  menu.go('title');
  assert.ok(stops > s2, 'leaving the campaign stops him');
  // the last win: the win and the ending, as one line
  calls.length = 0;
  menu.campaign.result = { house: 'harkonnen', mission: 9, won: true, stats: { rows: [] }, score: {} };
  menu.campaign.stage = 1;
  menu.campaign.state = { screen: 'campaign-results', house: 'harkonnen', mission: 9 };
  menu.go('campaign-results');
  await settle();
  assert.equal(calls[0]?.[0], 'harkonnen/m9-win+harkonnen/ending');
});

test('a real voice on the campaign\'s briefing: it plays and the words follow it; Back stops it', async () => {
  const { MainMenu } = await import('../src/ui/main-menu.js');
  const STORY = await import('../src/data/story.js');
  const lines = STORY.BRIEFINGS.atreides[0].briefing;
  const audio = fakeAudio();
  const track = { ...JSON1, lines, words: [[100, 400, 0, 0, 7]], sentences: [[100, 400, 0, 0, 'grave']] };
  const f = fakeFetch({ 'atreides/m1-briefing': track });
  const voice = new MentatVoice({ settings: { ...DEFAULTS }, base: 'http://x/m/', fetch: f.fetch, context: audio.context });
  const menu = new MainMenu(new FakeEl('div'), { settings: { ...DEFAULTS }, onStart() {}, onFullscreen() {}, music: { mood() {} }, shell: { launch() {}, quit() {}, on() {} }, backdrop: { setPaused() {}, start() {}, stop() {} },
    campaign: { store: memoryStore(), load: { story: async () => STORY, missions: async () => ({ missionDef: () => null }), atlas: async () => { throw new Error('none'); } }, voice } });
  menu.campaign.state = { screen: 'campaign-briefing', house: 'atreides', mission: 1 };
  menu.go('campaign-briefing');
  await settle();
  const line = voice.current;
  assert.equal(line?.id, 'atreides/m1-briefing');
  assert.equal(await line.started, true);
  assert.equal(menu.campaign.typer.following, true);
  byAct(menu.el, 'back').click();
  assert.equal(line.state, 'stopped');
  assert.equal(voice.current, null);
});

// ——— the setting ———
test('Mentat voice: On by default, kept, read from the address, and an Options row', () => {
  assert.equal(DEFAULTS.mentatVoice, true);
  assert.equal(sanitize({ mentatVoice: '0' }).mentatVoice, false);
  assert.equal(sanitize({ mentatVoice: false }).mentatVoice, false);
  assert.equal(sanitize({ mentatVoice: 'maybe' }).mentatVoice, false);
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  saveSettings({ ...DEFAULTS, mentatVoice: false }, storage);
  assert.equal(loadSettings(null, storage).mentatVoice, false);
  assert.equal(loadSettings({ str: (k) => (k === 'mentatVoice' ? '1' : null) }, storage).mentatVoice, true, 'the address wins');
  const row = OPTION_ROWS.find((r) => r.key === 'mentatVoice');
  assert.deepEqual(row.choices, [[true, 'On'], [false, 'Off']]);
  assert.match(row.label, /Mentat voice/);
});

test('the menu music ducks under a Mentat and comes back', async () => {
  const { MenuMusic, SPEECH_DUCK, DUCK } = await import('../src/audio/music/music.js');
  const music = new MenuMusic({ settings: { ...DEFAULTS }, win: {} });
  assert.equal(music.conductor.duckLevel, DUCK);
  music.duck(true);
  assert.equal(music.conductor.ducked, true);
  assert.equal(music.conductor.duckLevel, SPEECH_DUCK);
  assert.ok(SPEECH_DUCK < DUCK, 'deeper than under the announcer');
  music.duck(false);
  assert.equal(music.conductor.ducked, false);
  assert.ok(UNDUCK_AFTER > 0);
});
