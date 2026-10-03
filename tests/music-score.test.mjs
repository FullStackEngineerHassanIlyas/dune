import test from 'node:test';
import assert from 'node:assert/strict';
import { noteNumber, parseLine, parseLane, compile, checkTrack, durations, MODES, ON, OFF, SLIDE, HIT } from '../src/audio/music/score.js';
import { Deck } from '../src/audio/music/deck.js';
import { MusicMixer } from '../src/audio/music/mixer.js';
import { PATCHES } from '../src/audio/music/patches.js';
import { TRACKS, POOLS, BRIEFINGS, VICTORY, DEFEAT } from '../src/audio/music/songs/index.js';
import { at, shift } from '../src/audio/music/songs/kit.js';

const mini = (over = {}) => ({
  id: 'mini', bpm: 120, root: 'd', mode: 'phrygian-dominant', passes: 2,
  channels: { lead: { patch: 'ney', res: 4 }, drums: { drums: true } },
  patterns: { I: { bars: 1, lead: 'd4 . . .', drums: { K: 'x...............' } }, A: { bars: 1, lead: 'd4 f#4 ~a4 .', drums: { S: '....x.......x...' } } },
  intro: ['I'], loop: ['A'], ...over,
});

/** Renders `seconds` from a mixer in 128-sample blocks: { L, R }. */
function renderMixer(m, seconds, rate) {
  const n = Math.round(seconds * rate), L = new Float32Array(n), R = new Float32Array(n), bl = new Float32Array(128), br = new Float32Array(128);
  for (let i = 0; i < n; i += 128) { m.render(bl, br, 128); L.set(bl.subarray(0, Math.min(128, n - i)), i); R.set(br.subarray(0, Math.min(128, n - i)), i); }
  return { L, R };
}

test('notes, lines and drum lanes parse as the format says', () => {
  assert.equal(noteNumber('c4'), 60);
  assert.equal(noteNumber('f#4'), 66);
  assert.equal(noteNumber('bb2'), 46);
  assert.equal(noteNumber('b2'), 47);
  assert.equal(noteNumber('h4'), null);
  const s = parseLine('@2 d4*3 . ~f#4! a3+e4? - |', { vel: 0.8 });
  assert.deepEqual(s.map((x) => x.kind), ['note', 'hold', 'hold', 'rest', 'note', 'note', 'hold']);
  assert.ok(s.every((x) => x.steps === 2), '@2 makes every slot two steps');
  assert.equal(s[4].slide, true);
  assert.equal(s[4].vel, 1);
  assert.deepEqual(s[5].notes, [57, 64]);
  assert.equal(s[5].vel, 0.5);
  assert.throws(() => parseLine('d4 q9'), /not a note/);
  assert.deepEqual(parseLane('x.X. g...|....').hits, [{ at: 0, vel: 0.8 }, { at: 2, vel: 1 }, { at: 4, vel: 0.45 }]);
  assert.equal(parseLane('x.X. g...|....').steps, 12);
  assert.throws(() => parseLane('x.o.'), /drum lane/);
});

test('compiling lays patterns end to end: steps, slides, gates, transposition, a lane per drum', () => {
  const c = compile(mini({ channels: { lead: { patch: 'ney', res: 4, gate: 0.5 }, drums: { drums: true } }, loop: ['A', 'A+2'] }));
  assert.equal(c.intro.len, 16);
  assert.equal(c.loop.len, 32);
  const lead = c.loop.events.filter((e) => e.ch === 0);
  assert.deepEqual(lead.filter((e) => e.type !== OFF).map((e) => [e.t, e.type, e.note]), [[0, ON, 62], [4, ON, 66], [8, SLIDE, 69], [16, ON, 64], [20, ON, 68], [24, SLIDE, 71]]);
  assert.ok(lead.some((e) => e.type === OFF && e.t === 2), 'a gate of 0.5 lets a one-slot note go half-way');
  assert.deepEqual(c.loop.events.filter((e) => e.type === HIT).map((e) => [e.t, e.piece]), [[4, 'S'], [12, 'S'], [20, 'S'], [28, 'S']]);
  assert.throws(() => compile(mini({ patterns: { I: { bars: 1, lead: 'd4 .' }, A: { bars: 1 } } })), /4 steps|8 steps|the pattern has 16/);
});

test('a velocity digit after a note sets its level in tenths, for crescendos', () => {
  const s = parseLine('d4:3 a3+d4:9 f#4 g4:10', { vel: 0.8 });
  assert.deepEqual(s.filter((x) => x.kind === 'note').map((x) => x.vel), [0.3, 0.9, 0.8, 1]);
  assert.deepEqual(s[1].notes, [57, 62]);
  assert.throws(() => parseLine('d4:0'), /not a note/);
});

test('a pattern may set its own tempo: its steps are stretched onto the track’s grid and the rest follows on', () => {
  // the track runs at 120; pattern S at 60 lasts twice as long, so A after it starts at step 32
  const t = mini({ patterns: { S: { bars: 1, bpm: 60, lead: 'd4 . a3 .', drums: { K: 'x.......x.......' } }, A: { bars: 1, lead: 'd4 f#4 ~a4 .' } }, intro: ['S'], loop: ['A'] });
  const c = compile(t);
  assert.equal(c.intro.len, 32);
  assert.deepEqual(c.intro.events.filter((e) => e.type === HIT).map((e) => e.t), [0, 16]);
  assert.deepEqual(c.intro.events.filter((e) => e.type === ON).map((e) => e.t), [0, 16]);
  assert.equal(durations(t).intro, 4, 'one bar of 60 bpm is four seconds');
  assert.deepEqual(checkTrack(t, PATCHES), []);
  assert.ok(checkTrack({ ...t, swing: 0.1 }, PATCHES).some((p) => /swing/.test(p)), 'swing is on the track’s grid: not with tempo changes');
  assert.ok(checkTrack(mini({ patterns: { ...t.patterns, S: { ...t.patterns.S, bpm: 300 } }, intro: ['S'], loop: ['A'] }), PATCHES).some((p) => /tempo 300/.test(p)));
  // the deck plays it on time: pattern A's first note one bar of 60 bpm (4 s) after the start
  const rate = 16000, d = new Deck(c, PATCHES, rate, { passes: 1 }), at = [];
  const fire = d.fire.bind(d);
  d.fire = (e) => { if (e.type === ON) at.push(d.pos); fire(e); };
  const L = new Float32Array(128), R = new Float32Array(128);
  for (let i = 0; i < 5 * rate; i += 128) d.render(L, R, 0, 128);
  assert.deepEqual(at, [0, 2 * rate, 4 * rate, 4.5 * rate]);
});

test('checkTrack finds what is wrong with a track', () => {
  assert.deepEqual(checkTrack(mini(), PATCHES), []);
  const bad = mini({ channels: { lead: { patch: 'kazoo', res: 4 }, drums: { drums: true } } });
  assert.ok(checkTrack(bad, PATCHES).some((p) => /no patch "kazoo"/.test(p)));
  const offMode = mini({ patterns: { I: { bars: 1, lead: 'd4 . . .' }, A: { bars: 1, lead: 'd4 e4 . .' } } });
  assert.ok(checkTrack(offMode, PATCHES).some((p) => /e4 is outside phrygian-dominant/.test(p)), 'E natural is not in D Phrygian dominant');
  const halfBar = mini({ bar: 16, patterns: { I: { bars: 1 }, A: { bars: 0.5, lead: 'd4 .' } } });
  assert.ok(checkTrack(halfBar, PATCHES).some((p) => /not whole bars/.test(p)));
});

test('the sequencer fires every event on its sample, with swing, and loops for ever without drift', () => {
  const rate = 32000, c = compile(mini({ swing: 0.25, loop: ['A'] })), sps = (rate * 60) / (120 * 4);
  const d = new Deck(c, PATCHES, rate, { passes: 0 });
  const fired = [];
  const fire = d.fire.bind(d);
  d.fire = (e) => { fired.push({ at: d.pos, t: e.t, type: e.type, loopPass: d.inLoop ? d.pass : -1 }); fire(e); };
  const L = new Float32Array(128), R = new Float32Array(128);
  const passes = 40, total = Math.ceil((16 + passes * 16) * sps);
  for (let i = 0; i < total; i += 128) d.render(L, R, 0, 128);
  const swung = (t) => t + (Math.floor(t) & 1 ? 0.25 : 0);
  for (const f of fired) {
    const sectionStart = f.loopPass < 0 ? 0 : 16 * sps + f.loopPass * 16 * sps;
    assert.equal(f.at, Math.round(sectionStart + swung(f.t) * sps), `event at step ${f.t} of pass ${f.loopPass}`);
  }
  assert.ok(d.pass >= passes - 1, `it looped: ${d.pass}`);
  assert.ok(fired.filter((f) => f.type === HIT).length >= passes * 2);
});

const HOUSES = ['atreides', 'harkonnen', 'ordos'];
const ONCE = Object.values(TRACKS).filter((t) => t.once);
/** Seconds of a track's one pass: its intro and its loop body played once. */
const once = (t) => { const d = durations(t); return d.intro + d.loop; };

test('every track is valid, in its mode, loops on whole bars, and the pools name real tracks', () => {
  assert.equal(Object.keys(TRACKS).length, 25);
  for (const t of Object.values(TRACKS)) {
    assert.deepEqual(checkTrack(t, PATCHES), [], t.id);
    assert.ok(MODES[t.mode], `${t.id} declares a mode`);
    if (t.once) continue;   // the opening and the region cue play once: their lengths are below
    const d = durations(t);
    assert.ok(d.loop >= 15 && d.loop <= 90, `${t.id}: loop body ${d.loop.toFixed(1)} s`);
    assert.ok(d.intro <= 15, `${t.id}: intro ${d.intro.toFixed(1)} s`);
  }
  for (const [pool, ids] of Object.entries(POOLS)) for (const id of ids) assert.ok(TRACKS[id], `${pool}: ${id}`);
  assert.equal(POOLS.peace.length, 4);
  assert.equal(POOLS.battle.length, 4);
  for (const pool of ['intro', 'menu', 'houseSelect', 'region', 'victory', 'defeat', 'finale', 'credits']) assert.ok(POOLS[pool]?.length, pool);
  for (const house of HOUSES) {
    assert.equal(TRACKS[BRIEFINGS[house]].house, house);
    assert.equal(TRACKS[VICTORY[house]].house, house);
    assert.equal(TRACKS[DEFEAT[house]].house, house);
    assert.equal(VICTORY[house], `victory-${house}`);
    assert.equal(DEFEAT[house], `defeat-${house}`);
    assert.ok(Math.abs(once(TRACKS[DEFEAT[house]]) - 18) <= 1, `${DEFEAT[house]} is a short dirge: ${once(TRACKS[DEFEAT[house]]).toFixed(1)} s`);
  }
  assert.deepEqual([VICTORY.fremen, VICTORY.sardaukar, DEFEAT.mercenary], ['victory-atreides', 'victory-harkonnen', 'defeat-ordos']);
  assert.ok(Object.values(TRACKS).filter((t) => t.pool === 'battle').every((t) => t.bpm >= 125), 'battle tracks drive');
  assert.ok(Object.values(TRACKS).filter((t) => t.pool === 'peace').every((t) => t.bpm * (t.beat ?? 4) / 4 <= 110), 'peace tracks breathe');
  // the cues that play once: the opening runs from the gesture past the menu's arrival, the region about 7 s
  assert.deepEqual(ONCE.map((t) => t.id).sort(), ['opening', 'region']);
  for (const t of ONCE) assert.equal(t.passes, 1, t.id);
  assert.ok(once(TRACKS.opening) > MARKS.menu && once(TRACKS.opening) <= 36, `opening ${once(TRACKS.opening)} s`);
  assert.ok(Math.abs(once(TRACKS.region) - 7) <= 0.5, `region ${once(TRACKS.region)} s`);
});

// contract C6: the intro's picture, in seconds after the gesture (src/game/intro-timeline.js exports the same)
const MARKS = { credits: 4.0, present: 10.0, planet: 16.0, stop: 17.8, ships: [18.8, 20.3, 21.8], title: 26.5, menu: 30.0 };

test('the opening is written to the intro: a hit at the gesture, the drums with the planet, a push per ship, the climax on the title', async () => {
  const timeline = await import('../src/game/intro-timeline.js').catch(() => null);
  if (timeline?.INTRO_MARKS) for (const [k, v] of Object.entries(MARKS)) assert.deepEqual(timeline.INTRO_MARKS[k], v, `INTRO_MARKS.${k}`);
  const rate = 16000, t = TRACKS.opening, c = compile(t), d = new Deck(c, PATCHES, rate, { passes: t.passes }), fired = [];
  const fire = d.fire.bind(d), channel = (e) => c.channels[e.ch].name;
  d.fire = (e) => { fired.push({ s: d.pos / rate, e }); fire(e); };
  const L = new Float32Array(128), R = new Float32Array(128);
  while (!d.done && d.pos < 40 * rate) d.render(L, R, 0, 128);
  const hits = fired.filter((f) => f.e.type === HIT), accents = hits.filter((f) => f.e.vel === 1);
  const accentAt = (s, tol) => accents.some((f) => Math.abs(f.s - s) <= tol);
  const first = (name) => fired.find((f) => f.e.type === ON && channel(f.e) === name)?.s;
  assert.ok(accentAt(0, 0.001) && fired.some((f) => f.s === 0 && f.e.type === ON && channel(f.e) === 'hit'), 'a strong hit at the gesture');
  assert.deepEqual(hits.filter((f) => f.s > 0.05 && f.s < MARKS.planet - 0.01), [], 'no drums between the hit and the planet');
  assert.ok(accentAt(MARKS.planet, 0.01), 'the drums arrive with the planet');
  for (const s of MARKS.ships) assert.ok(accentAt(s, 0.03), `a push for the ship at ${s} s`);
  assert.ok(accentAt(MARKS.title, 0.01), 'the climax on the title');
  assert.ok(Math.abs(first('choir') - MARKS.credits) < 0.01, `the choir enters with the credits: ${first('choir')}`);
  assert.ok(Math.abs(first('lead') - MARKS.present) < 0.01, `the brass swells from "present": ${first('lead')}`);
  assert.ok(fired.some((f) => Math.abs(f.s - MARKS.title) < 0.01 && f.e.type === ON && channel(f.e) === 'lead'), 'the theme starts on the title');
  assert.ok(d.ending && Math.abs(d.endedAt / rate - once(t)) < 0.01 && d.endedAt / rate > MARKS.menu, `one pass, then it rings out: ${d.endedAt / rate}`);
  assert.ok(d.done, 'and it falls silent');
});

test('a once-through cue hands over on the sample it ends: the title follows the opening, the region simply ends', () => {
  const rate = 16000, events = [], m = new MusicMixer({ rate, onEvent: (e) => events.push(e) });
  m.play('opening', { passes: TRACKS.opening.passes });
  m.command({ cmd: 'next', id: 'title', passes: 0 });
  renderMixer(m, once(TRACKS.opening) + 2, rate);
  const ended = events.find((e) => e.type === 'ended' && e.id === 'opening'), started = events.find((e) => e.type === 'started' && e.id === 'title');
  assert.ok(ended && started && started.time === ended.time && Math.abs(ended.time - once(TRACKS.opening)) < 1e-3, JSON.stringify(events));
  const r = new MusicMixer({ rate });
  r.play('region', { passes: TRACKS.region.passes });
  const { L } = renderMixer(r, once(TRACKS.region) + 5, rate);
  let tail = 0;
  for (let i = L.length - rate; i < L.length; i++) tail = Math.max(tail, Math.abs(L[i]));
  assert.ok(tail < 0.002 && !r.active, `the region cue has rung out: ${tail}`);
});

/** A biquad at `rate` (RBJ cookbook): 'hs' a high shelf of `db`, 'hp' a high-pass. */
function biquad(x, type, hz, q, db, rate) {
  const w = (2 * Math.PI * hz) / rate, cw = Math.cos(w), al = Math.sin(w) / (2 * q), A = Math.pow(10, db / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'hs') {
    const s = 2 * Math.sqrt(A) * al;
    [b0, b1, b2] = [A * (A + 1 + (A - 1) * cw + s), -2 * A * (A - 1 + (A + 1) * cw), A * (A + 1 + (A - 1) * cw - s)];
    [a0, a1, a2] = [A + 1 - (A - 1) * cw + s, 2 * (A - 1 - (A + 1) * cw), A + 1 - (A - 1) * cw - s];
  } else {
    [b0, b1, b2] = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2];
    [a0, a1, a2] = [1 + al, -2 * cw, 1 - al];
  }
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/** Integrated loudness (EBU R128: K-weighting, 400 ms blocks, -70 LUFS and -10 LU gates) of a stereo signal. */
function lufs(L, R, rate) {
  const k = (x) => biquad(biquad(x, 'hs', 1500, Math.SQRT1_2, 4, rate), 'hp', 38, 0.5, 0, rate);
  const kl = k(L), kr = k(R), block = Math.round(0.4 * rate), hop = Math.round(0.1 * rate), z = [];
  for (let i = 0; i + block <= kl.length; i += hop) {
    let s = 0;
    for (let j = i; j < i + block; j++) s += kl[j] * kl[j] + kr[j] * kr[j];
    z.push(s / block);
  }
  const loud = (ms) => -0.691 + 10 * Math.log10(ms.reduce((a, b) => a + b, 0) / ms.length);
  const abs = z.filter((m) => -0.691 + 10 * Math.log10(m) > -70);
  const rel = loud(abs) - 10;
  return loud(abs.filter((m) => -0.691 + 10 * Math.log10(m) > rel));
}

test('every track plays at the same loudness and under full scale', () => {
  const rate = 16000;   // the rendered tracks measure -18.0 LUFS at 48 kHz with ffmpeg's ebur128; 16 kHz is close enough here
  for (const t of Object.values(TRACKS)) {
    // a looping track over its first 24 s; a cue that plays once over the whole of it (the opening rises from a hush)
    const m = new MusicMixer({ rate });
    m.play(t.id, { passes: t.once ? 1 : 0 });
    const { L, R } = renderMixer(m, t.once ? once(t) + 1 : 24, rate);
    const level = lufs(L, R, rate);
    let peak = 0;
    for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    assert.ok(Math.abs(level + 18) <= 2, `${t.id}: ${level.toFixed(1)} LUFS`);
    assert.ok(peak < 0.99, `${t.id}: peak ${peak.toFixed(3)}`);
  }
});

test('every track loops without a click: at the seam the waveform runs on as smoothly as anywhere else', () => {
  const rate = 12000;   // enough to see a jump, at a quarter of the cost
  for (const t of Object.values(TRACKS)) {
    if (t.once) continue;   // never loops (its hand-over is tested above)
    const d = durations(t), m = new MusicMixer({ rate });
    m.play(t.id, { passes: 0 });
    const { L } = renderMixer(m, d.intro + d.loop + 0.5, rate);
    const seam = Math.round((d.intro + d.loop) * rate);
    let worst = 0, seamJump = 0;
    for (let i = 1; i < L.length; i++) worst = Math.max(worst, Math.abs(L[i] - L[i - 1]));
    for (let i = seam - 32; i < seam + 32; i++) seamJump = Math.max(seamJump, Math.abs(L[i] - L[i - 1]));
    assert.ok(seamJump <= worst * 0.999 || seamJump < 0.05, `${t.id}: seam ${seamJump.toFixed(3)} vs ${worst.toFixed(3)}`);
  }
});

test('the song helpers: a line at one velocity, a line moved by semitones', () => {
  assert.equal(at('d2 . a1*2 ~eb3+g3! - bb4?', 5), 'd2:5 . a1:5*2 ~eb3+g3:5 - bb4:5');
  assert.equal(shift('d4 f#4*2 | bb3 . c#5!', 12), 'd5 f#5*2 | bb4 . c#6!');
  assert.equal(shift('c4 eb4', -1), 'b3 d4');
});

test('a loop body repeats at the same level pass after pass', () => {
  const t = TRACKS.iron, d = durations(t), rate = 16000, m = new MusicMixer({ rate });
  m.play('iron', { passes: 0 });
  const { L } = renderMixer(m, d.intro + 2 * d.loop + 4, rate);
  const rms = (from) => { let s = 0; const a = Math.round(from * rate), n = Math.round(4 * rate); for (let i = a; i < a + n; i++) s += L[i] * L[i]; return 10 * Math.log10(s / n); };
  const first = rms(d.intro), second = rms(d.intro + d.loop), third = rms(d.intro + 2 * d.loop);
  assert.ok(Math.abs(second - third) < 0.5 && Math.abs(first - second) < 1, `passes 1-3: ${first.toFixed(2)}, ${second.toFixed(2)}, ${third.toFixed(2)} dB`);
});

test('the mixer crossfades, queues the next track onto the very sample the last one ends, and stops', () => {
  const rate = 32000, events = [];
  const tracks = { a: mini({ id: 'a', passes: 1 }), b: mini({ id: 'b', passes: 1 }) };
  const m = new MusicMixer({ rate, tracks, patches: PATCHES, onEvent: (e) => events.push(e) });
  m.play('a');
  m.command({ cmd: 'next', id: 'b', passes: 1 });
  const d = durations(tracks.a);
  renderMixer(m, d.intro + d.loop + 0.5, rate);
  const ended = events.find((e) => e.type === 'ended' && e.id === 'a'), started = events.filter((e) => e.type === 'started' && e.id === 'b');
  assert.ok(ended && started.length === 1);
  assert.ok(Math.abs(ended.time - (d.intro + d.loop)) < 1 / rate + 1e-9, `a ends after its one pass: ${ended.time}`);
  assert.equal(started[0].time, ended.time, 'b starts on that same sample');
  // a change of track fades the old one out while the new one starts
  m.play('a', { fade: 0.5 });
  assert.equal(m.decks.length >= 2, true);
  renderMixer(m, 1, rate);
  assert.equal(m.decks.filter((x) => x.id === 'b').length, 0, 'b has faded out and gone');
  m.stop(0.2);
  renderMixer(m, 0.5, rate);
  assert.equal(m.active, false, 'stopped: nothing left to render');
  const quiet = renderMixer(m, 0.1, rate);
  assert.ok(quiet.L.every((s) => s === 0));
});

test('a track still waiting to come in is dropped, not heard, when another takes over', () => {
  const rate = 16000, tracks = { a: mini({ id: 'a', passes: 0 }), b: mini({ id: 'b', passes: 0 }) };
  const m = new MusicMixer({ rate, tracks, patches: PATCHES });
  m.play('a', { wait: 1.5, fadeIn: 2 });   // peace coming back after a pause...
  renderMixer(m, 0.5, rate);
  m.play('b', { fade: 1.2 });              // ...but the fighting starts again first
  assert.deepEqual(m.decks.map((d) => d.id), ['b'], 'the waiting track is gone at once');
  m.play('a', { wait: 1 });
  m.stop(0.5);
  assert.equal(m.decks.some((d) => d.delay > 0), false, 'a stop drops a waiting track too');
});
