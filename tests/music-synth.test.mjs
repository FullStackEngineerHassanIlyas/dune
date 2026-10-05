import test from 'node:test';
import assert from 'node:assert/strict';
import { ALGORITHMS, FmVoice, preparePatch, advance, rateSeconds, midiHz, DB_MAX, ATTACK, DECAY, SUSTAIN, RELEASE, OFF } from '../src/audio/music/fm.js';
import { DrumKit, KIT, softTanh } from '../src/audio/music/drums.js';
import { PATCHES } from '../src/audio/music/patches.js';
import { Deck } from '../src/audio/music/deck.js';
import { compile } from '../src/audio/music/score.js';

const RATE = 48000;

/** Renders n samples of a voice in 32-sample control blocks, as a deck does. */
function voiceOut(v, n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 32) v.render(out, i, Math.min(32, n - i));
  return out;
}

/** The level of frequency hz in x (Goertzel), as an amplitude. */
function tone(x, hz, rate = RATE) {
  const w = (2 * Math.PI * hz) / rate, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (const v of x) { const s = v + c * s1 - s2; s2 = s1; s1 = s; }
  return (2 * Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2))) / x.length;
}

const sineOnly = (op = [1, 0, 0, 31, 0, 0, 0, 15]) => preparePatch({ alg: 7, fb: 0, ops: [op, [1, 0, 127], [1, 0, 127], [1, 0, 127]] });

test('the eight algorithms are the chip\'s: forward connections only, 1/1/1/1/2/3/3/4 carriers', () => {
  assert.deepEqual(ALGORITHMS.map((a) => a.carriers.length), [1, 1, 1, 1, 2, 3, 3, 4]);
  ALGORITHMS.forEach((a) => a.mods.forEach((from, k) => from.forEach((j) => assert.ok(j < k, 'an operator is only modulated by a lower one'))));
  assert.deepEqual(ALGORITHMS[0].mods, [[], [0], [1], [2]], 'algorithm 0 is the 1→2→3→4 stack');
  assert.deepEqual(ALGORITHMS[7].mods, [[], [], [], []], 'algorithm 7 is four sines side by side');
});

test('a lone carrier is a sine at the note\'s pitch and full level; a 1:1 modulator adds harmonics', () => {
  const v = new FmVoice(RATE);
  v.setPatch(sineOnly());
  v.noteOn(69, 1);   // A4
  const x = voiceOut(v, RATE / 2).subarray(RATE / 10);
  assert.ok(Math.abs(tone(x, 440) - 1) < 0.02, `fundamental at full level, got ${tone(x, 440)}`);
  assert.ok(tone(x, 880) < 0.005 && tone(x, 1320) < 0.005, 'no harmonics from a pure carrier');
  assert.ok(Math.abs(midiHz(69) - 440) < 1e-9 && Math.abs(midiHz(81) - 880) < 1e-9);

  const fm = new FmVoice(RATE);   // op1 at TL 28 (21 dB down: a modulation index of about 2.2 radians) into op2
  fm.setPatch(preparePatch({ alg: 4, fb: 0, ops: [[1, 0, 28, 31, 0, 0, 0, 15], [1, 0, 0, 31, 0, 0, 0, 15], [1, 0, 127], [1, 0, 127]] }));
  fm.noteOn(69, 1);
  const y = voiceOut(fm, RATE / 2).subarray(RATE / 10);
  assert.ok(tone(y, 880) > 0.1 && tone(y, 1320) > 0.05, `FM puts energy into the harmonics: ${tone(y, 880)}, ${tone(y, 1320)}`);
});

test('feedback on operator 1 turns its sine towards a sawtooth', () => {
  const plain = new FmVoice(RATE), fb = new FmVoice(RATE);
  plain.setPatch(preparePatch({ alg: 7, fb: 0, ops: [[1, 0, 0, 31, 0, 0, 0, 15], [1, 0, 127], [1, 0, 127], [1, 0, 127]] }));
  fb.setPatch(preparePatch({ alg: 7, fb: 6, ops: [[1, 0, 0, 31, 0, 0, 0, 15], [1, 0, 127], [1, 0, 127], [1, 0, 127]] }));
  plain.noteOn(57, 1); fb.noteOn(57, 1);
  const a = voiceOut(plain, RATE / 4).subarray(RATE / 10), b = voiceOut(fb, RATE / 4).subarray(RATE / 10);
  assert.ok(tone(a, 440) < 0.005);
  assert.ok(tone(b, 440) > 0.1 && tone(b, 660) > 0.05, 'second and third harmonics appear');
});

test('envelopes follow the chip\'s rates: decay and release are straight lines in dB, attack ~1/10 of a decay', () => {
  const o = { att: 0, stage: DECAY, d1: DB_MAX / (rateSeconds(32) * RATE), sl: 24, d2: DB_MAX / (rateSeconds(20) * RATE), rr: DB_MAX / (rateSeconds(42) * RATE), lnA: 0 };
  const toSl = 24 / DB_MAX * rateSeconds(32);   // seconds to fall to the sustain level
  advance(o, Math.round(toSl * RATE * 0.5));
  assert.ok(Math.abs(o.att - 12) < 0.1, `half way down to the sustain level at half the time: ${o.att}`);
  advance(o, Math.round(toSl * RATE * 0.5) + 2);
  assert.equal(o.stage, SUSTAIN);
  advance(o, RATE);   // a second of the slow second decay
  assert.ok(Math.abs(o.att - (24 + DB_MAX / rateSeconds(20))) < 0.2, `second decay: ${o.att}`);
  o.stage = RELEASE;
  advance(o, Math.round(rateSeconds(42) * RATE) + 10);
  assert.equal(o.stage, OFF);
  assert.equal(o.att, DB_MAX);
  assert.ok(rateSeconds(0) === Infinity && rateSeconds(63) < rateSeconds(62) && rateSeconds(4) > 20, 'rate 0 never moves; higher is faster');

  // the attack, through a voice: rate 20 reaches full level in ~0.114 of its 96 dB decay time
  const v = new FmVoice(RATE);
  v.setPatch(sineOnly([1, 0, 0, 20, 0, 0, 0, 15]));
  v.noteOn(60, 1);
  assert.equal(v.ops[0].stage, ATTACK);
  const t = 0.114 * rateSeconds(40);
  voiceOut(v, Math.round(t * 0.5 * RATE));
  assert.equal(v.ops[0].stage, ATTACK, 'still rising half way');
  voiceOut(v, Math.round(t * 0.6 * RATE));
  assert.equal(v.ops[0].stage, DECAY, 'arrived just after');
  // rate 0 attack never rises; an instant attack is full at once
  const z = new FmVoice(RATE);
  z.setPatch(sineOnly([1, 0, 0, 0, 0, 0, 0, 15]));
  z.noteOn(60, 1);
  assert.ok(voiceOut(z, 4800).every((s) => Math.abs(s) < 1e-4), "silent but for the other operators at total level 127 (-95 dB)");
});

test('a note let go fades out over its release and the voice falls silent; a retrigger does not click', () => {
  const v = new FmVoice(RATE);
  v.setPatch(sineOnly([1, 0, 0, 31, 0, 0, 0, 8]));
  v.noteOn(60, 1);
  voiceOut(v, 4800);
  v.noteOff();
  voiceOut(v, Math.round(rateSeconds(34) * RATE) + 64);
  assert.ok(v.silent);
  assert.equal(v.render(new Float32Array(32), 0, 32), false, 'a silent voice costs nothing');
  // retriggered mid-note: the level runs on from where it stood, no jump between two samples
  const w = new FmVoice(RATE);
  w.setPatch(sineOnly([1, 0, 0, 31, 6, 4, 0, 8]));
  w.noteOn(48, 1);
  const a = voiceOut(w, 9600);
  w.noteOn(55, 1);
  const b = voiceOut(w, 960), jump = Math.abs(b[0] - a[a.length - 1]);
  assert.ok(jump < 0.1, `no click on a retrigger: ${jump}`);
});

test('every patch is valid and sounds at a sensible level', () => {
  for (const [name, p] of Object.entries(PATCHES)) {
    const v = new FmVoice(RATE);
    v.setPatch(preparePatch(p));
    v.noteOn(57, 0.8);
    const x = voiceOut(v, RATE / 2);
    let peak = 0, sum = 0;
    for (const s of x) { peak = Math.max(peak, Math.abs(s)); sum += s * s; }
    const rms = Math.sqrt(sum / x.length);
    assert.ok(Number.isFinite(rms) && peak < 2, `${name}: peak ${peak}`);
    assert.ok(rms > 0.03, `${name} is heard: rms ${rms}`);
  }
});

test('the synthesis is deterministic', () => {
  const run = () => { const v = new FmVoice(RATE); v.setPatch(preparePatch(PATCHES.brass)); v.noteOn(62, 0.9); return voiceOut(v, 9000); };
  assert.deepEqual(run(), run());
  const kit = () => { const k = new DrumKit(RATE); k.hit('S', 1); k.hit('h', 0.8); const L = new Float32Array(4800), R = new Float32Array(4800); k.render(L, R, 0, 4800, 1); return L; };
  assert.deepEqual(kit(), kit());
});

test('every drum hit sounds, stays finite and dies away; the kit caps its polyphony', () => {
  for (const piece of Object.keys(KIT)) {
    const k = new DrumKit(RATE), L = new Float32Array(RATE * 3), R = new Float32Array(RATE * 3);
    k.hit(piece, 1);
    k.render(L, R, 0, L.length, 1);
    let peak = 0;
    for (const s of L) peak = Math.max(peak, Math.abs(s));
    assert.ok(peak > 0.05 && peak < 2, `${piece}: peak ${peak}`);
    assert.equal(k.busy, false, `${KIT[piece].name} has ended after 3 s`);
  }
  const k = new DrumKit(RATE);
  for (let i = 0; i < 30; i++) k.hit('X', 1);
  assert.equal(k.hits.length, 10);
  assert.ok(Math.abs(softTanh(0.5) - Math.tanh(0.5)) < 0.01 && softTanh(5) === 1 && softTanh(-5) === -1);
});

test('a crushed drum channel sounds like the Mega Drive’s PCM: held at a low sample rate, on 8-bit steps, silent when done', () => {
  const rate = 32000, track = (crush) => ({
    id: 'pcm', bpm: 120, root: 'd', mode: 'aeolian', echo: { wet: 0 },
    channels: { drums: { drums: true, crush } },
    patterns: { A: { bars: 1, drums: { P: 'x...............', K: '....x...........' } } }, loop: ['A'],
  });
  const out = (crush) => {
    const d = new Deck(compile(track(crush)), PATCHES, rate, { passes: 1 }), L = new Float32Array(rate * 3), R = new Float32Array(rate * 3);
    for (let i = 0; i < L.length; i += 128) d.render(L, R, i, 128);
    return L;
  };
  const plain = out(0), pcm = out(8000);
  let runs = 0, offGrid = 0, peak = 0;
  for (let i = 0; i < 8000; i++) {
    peak = Math.max(peak, Math.abs(pcm[i]));
    if (Math.abs(pcm[i] * 128 - Math.round(pcm[i] * 128)) > 1e-4) offGrid++;
    if (i % 4 && pcm[i] !== pcm[i - 1]) runs++;
  }
  assert.ok(peak > 0.1, `it sounds: ${peak}`);
  assert.equal(offGrid, 0, 'every sample on a 1/128 step');
  assert.ok(runs < 40, `held for four samples at a time (8 kHz in 32 kHz): ${runs} changes inside a hold`);
  assert.notDeepEqual(pcm.subarray(0, 4000), plain.subarray(0, 4000));
  assert.ok(pcm.subarray(rate * 2.5).every((v) => v === 0), 'nothing held on after the hits have died away');
});

test('the new kit pieces are there: big snare, timpani, mid tom', () => {
  for (const piece of ['P', 'J', 'M']) assert.ok(KIT[piece], piece);
});
