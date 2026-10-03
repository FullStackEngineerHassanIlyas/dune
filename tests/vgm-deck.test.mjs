// VgmDeck (contract C8; research music.md §2.3): commands land on their exact sample, the DAC bank and its
// seeks, DAC streams, loops and passes, the zero-length loop guard, ring-out, gain and fades, the resampler,
// and the Deck shape MusicMixer relies on. Files are made up here; most use a YM2612 clock of 144 x 44,100 Hz
// so one chip frame is one VGM sample is one output sample at 44.1 kHz, and times can be checked exactly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VgmDeck, PSG_LEVEL, warmUp } from '../src/audio/music/vgm-deck.js';
import { VgmError } from '../src/formats/vgm.js';
import { MusicMixer } from '../src/audio/music/mixer.js';
import { TRACKS } from '../src/audio/music/songs/index.js';
import { PSG_FULL } from '../src/audio/music/chips/sn76489.js';
import { vgmFile, ym, psg, wait, block, seek, dacWait } from './fixtures/vgm/helpers.mjs';

const UNIT = 144 * 44100;   // a YM2612 clock whose frames are VGM samples
const make = (commands, opts = {}, deck = {}) => new VgmDeck('vgm:test', vgmFile({ ym: UNIT, ...opts, commands }), { sampleRate: 44100, ...deck });

function render(deck, n, block = 128) {
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i += block) deck.render(L, R, i, Math.min(block, n - i));
  return { L, R };
}

// ymfm's YM2612 output for a DAC value with the other five channels silent, less the silent chip's ladder
// offset (6 x 4 -> 504), scaled as the deck scales it
const sx9 = (v) => (v << 23) >> 23;
const disc = (v) => (v < 0 ? v - 3 : v + 4);
const dacLevel = (byte) => ((((disc(sx9((byte ^ 0x80) << 1)) + 5 * 4) * 8192 / 390) | 0) - 504) / 32768;
const DAC_ON = [ym(0, 0x2b, 0x80)];

test('VgmDeck has the shape MusicMixer drives', () => {
  const d = make([wait(100)]);
  for (const k of ['id', 'delay', 'gain', 'pass', 'ending', 'pos', 'endedAt', 'done']) assert.ok(k in d, k);
  for (const k of ['fade', 'render', 'finish']) assert.equal(typeof d[k], 'function', k);
  assert.equal(d.id, 'vgm:test');
  assert.equal(d.delay, 0);
  assert.equal(d.gain, 1);
});

test('a register write lands on the exact sample its wait ends on', () => {
  const d = make([...DAC_ON, wait(1000), ym(0, 0x2a, 0xff), wait(500), ym(0, 0x2a, 0x00), wait(500)], {}, { passes: 1 });
  const { L, R } = render(d, 2100);
  assert.equal(L[999], L[0]);   // unchanged until sample 1000
  assert.ok(Math.abs(L[1000] - dacLevel(0xff)) < 1e-7, `${L[1000]} vs ${dacLevel(0xff)}`);
  assert.ok(Math.abs(L[1499] - dacLevel(0xff)) < 1e-7);
  assert.ok(Math.abs(L[1500] - dacLevel(0x00)) < 1e-7);
  assert.deepEqual(Array.from(R.slice(0, 1600)), Array.from(L.slice(0, 1600)));
});

test('0x8n writes the next bank byte to the DAC and waits n samples (not n + 1); 0xE0 seeks', () => {
  const bank = Array.from({ length: 64 }, (_, i) => (i * 4) & 0xff);
  const d = make([block(0, bank), ...DAC_ON, wait(10), seek(5), dacWait(1), dacWait(2), dacWait(0), dacWait(3), seek(40), dacWait(1), wait(10)], {}, { passes: 1 });
  const { L } = render(d, 40);
  const at = (i, byte) => assert.ok(Math.abs(L[i] - dacLevel(byte)) < 1e-7, `sample ${i}: ${L[i]} vs byte ${byte} (${dacLevel(byte)})`);
  at(10, bank[5]);                       // 0x81: byte 5, one sample
  at(11, bank[6]); at(12, bank[6]);      // 0x82: byte 6, two samples
  at(13, bank[8]);                       // 0x80 wrote byte 7 and waited 0: byte 8 follows on the same sample
  at(14, bank[8]); at(15, bank[8]);
  at(16, bank[40]);                      // seek, then byte 40
});

test('a data block is read once: looping does not grow the bank, and blocks join in order', () => {
  const d = make([block(0, [1, 2, 3, 4]), block(0, [5, 6]), wait(10)], {}, { passes: 3 });
  d.scan(1e6);
  assert.equal(d.bankSize[0], 6);
  assert.deepEqual([0, 3, 4, 5].map((p) => d.bankByte(0, p)), [1, 4, 5, 6]);
  assert.equal(d.bankByte(0, 6), -1);
  render(d, 100);
  assert.equal(d.pass, 3);
  assert.equal(d.bankSize[0], 6);
  assert.equal(d.banks[0].length, 2);
});

test('a data block far into the log is found by the scan before the player gets there', () => {
  const filler = Array.from({ length: 30000 }, () => ym(0, 0x30, 0x01));   // more than one scan step
  const d = make([...DAC_ON, ...filler, wait(10), block(0, [0x10, 0x20, 0x30]), seek(1), dacWait(1), dacWait(1), wait(5)], {}, { passes: 1 });
  assert.equal(d.scanDone, false);
  const { L } = render(d, 30);
  assert.equal(d.scanDone, true);
  assert.ok(Math.abs(L[10] - dacLevel(0x20)) < 1e-7);
  assert.ok(Math.abs(L[11] - dacLevel(0x30)) < 1e-7);
});

test('passes: the intro once, the loop body until the passes are done, ending on the exact sample', () => {
  const d = make([...DAC_ON, wait(1000), ym(0, 0x2a, 0xc0), wait(300), ym(0, 0x2a, 0x40), wait(200)], { loop: 2 }, { passes: 3 });
  const passes = [];
  const L = new Float32Array(3000), R = new Float32Array(3000);
  for (let i = 0; i < 3000; i += 100) { d.render(L, R, i, 100); passes.push(d.pass); }
  // 1000 + 500 (intro and first body) + 2 more bodies of 500
  assert.equal(d.endedAt, 2500);
  assert.equal(d.ending, true);
  assert.equal(d.pass, 3);
  assert.ok(passes.indexOf(1) === 15 && passes.indexOf(2) === 20, passes.join());
  assert.ok(Math.abs(L[1000] - dacLevel(0xc0)) < 1e-7 && Math.abs(L[1300] - dacLevel(0x40)) < 1e-7);
  assert.ok(Math.abs(L[1500] - dacLevel(0xc0)) < 1e-7 && Math.abs(L[1800] - dacLevel(0x40)) < 1e-7);
});

test('passes 0 loops for ever; the header loop modifier and base scale the passes asked for', () => {
  const d = make([wait(100), wait(50)], { loop: 1 });
  render(d, 100 + 50 * 40 + 1);   // the 40th pass ends as sample 2100 is about to be made
  assert.equal(d.ending, false);
  assert.equal(d.pass, 40);
  const doubled = make([wait(100), wait(50)], { loop: 1, version: 0x160, headerSize: 0x80, header: { 0x7f: { value: 0x20, bytes: 1 } } }, { passes: 2 });
  assert.equal(doubled.passes, 4);
  const based = make([wait(100), wait(50)], { loop: 1, version: 0x160, headerSize: 0x80, header: { 0x7e: { value: 1, bytes: 1 } } }, { passes: 3 });
  assert.equal(based.passes, 2);
});

test('a file without a loop point starts again from the top when it plays for ever, and ends after its passes', () => {
  const song = [...DAC_ON, ym(0, 0x2a, 0xf0), wait(100), ym(0, 0x2a, 0x10), wait(100)];
  const forever = make(song);
  const { L } = render(forever, 650);
  assert.ok(Math.abs(L[0] - dacLevel(0xf0)) < 1e-7 && Math.abs(L[200] - dacLevel(0xf0)) < 1e-7 && Math.abs(L[300] - dacLevel(0x10)) < 1e-7 && Math.abs(L[400] - dacLevel(0xf0)) < 1e-7);
  assert.equal(forever.pass, 3);
  assert.equal(forever.ending, false);
  const once = make(song, {}, { passes: 1 });
  render(once, 400);
  assert.equal(once.ending, true);
  assert.equal(once.endedAt, 200);
});

test('a loop that takes no time ends the track instead of spinning the audio thread', () => {
  const d = make([wait(500), ym(0, 0x30, 0x01), ym(0, 0x30, 0x02)], { loop: 1 });   // the loop body has no wait
  const t = Date.now();
  render(d, 2000);
  assert.ok(Date.now() - t < 1000);
  assert.equal(d.ending, true);
  assert.equal(d.endedAt, 500);
  const empty = make([ym(0, 0x30, 0x01)]);
  render(empty, 100);
  assert.equal(empty.ending, true);
});

const NOTE = (rr) => [
  ym(0, 0xb0, 0x07), ym(0, 0xb4, 0xc0), ym(0, 0x30, 0x01), ym(0, 0x40, 0x00), ym(0, 0x50, 0x1f), ym(0, 0x80, rr),
  ym(0, 0x44, 0x7f), ym(0, 0x48, 0x7f), ym(0, 0x4c, 0x7f), ym(0, 0xa4, 0x22), ym(0, 0xa0, 0x69), ym(0, 0x28, 0x10),
];
const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };

test('at the end every channel keys off and the track rings out: done once silent, or after 4 s at most', () => {
  const quick = make([...NOTE(0x0c), wait(4410)], {}, { passes: 1 });
  const q = render(quick, 44100);
  assert.equal(quick.endedAt, 4410);
  assert.ok(rms(q.L, 4500, 5000) < rms(q.L, 3000, 4400), 'the release fades');
  assert.equal(quick.done, true);
  const slow = make([...NOTE(0x01), wait(4410)], {}, { passes: 1 });
  const s = render(slow, 44100 * 3);
  assert.equal(slow.done, false);
  assert.ok(rms(s.L, 44100 * 2, 44100 * 2 + 4000) > 0.001, 'still ringing');
  render(slow, 44100 * 2);
  assert.equal(slow.done, true);
  // finish() from outside does the same
  const cut = make([...NOTE(0x0f), wait(44100)], {}, { passes: 0 });
  render(cut, 1000);
  cut.finish();
  assert.equal(cut.ending, true);
  assert.equal(cut.endedAt, 1000);
  render(cut, 4000);
  assert.equal(cut.done, true);
});

test('gain and the header volume modifier scale the output; a fade to 0 ends the deck', () => {
  const song = [...NOTE(0x0f), wait(4000)];
  const a = render(make(song), 2000).L;
  const half = render(make(song, {}, { gain: 0.5 }), 2000).L;
  const loud = render(make(song, { version: 0x160, headerSize: 0x80, header: { 0x7c: { value: 0x20, bytes: 1 } } }), 2000).L;
  for (let i = 0; i < 2000; i += 37) {
    assert.ok(Math.abs(half[i] - a[i] / 2) < 1e-7);
    assert.ok(Math.abs(loud[i] - a[i] * 2) < 1e-6);
  }
  const d = make(song);
  render(d, 500);
  d.fade(0, 0.01);
  render(d, 1000);
  assert.equal(d.gain, 0);
  assert.equal(d.done, true);
});

test('the PSG joins the YM2612 in the same frames, at its level', () => {
  const d = make([psg(0x80 | 14), psg(254 >> 4), psg(0x90), wait(44100)], { sn: 3579545 });
  const { L } = render(d, 44100);
  let lo = Infinity, hi = -Infinity;
  for (let i = 1000; i < 44100; i++) { lo = Math.min(lo, L[i]); hi = Math.max(hi, L[i]); }
  assert.ok(Math.abs(hi - lo - (PSG_FULL * PSG_LEVEL) / 32768) < 1e-4, `${hi - lo}`);
  let mean = 0;
  for (let i = 1000; i < 44100; i++) mean += L[i] / 43100;
  let ups = 0;
  for (let i = 1001; i < 44100; i++) if (L[i - 1] < mean && L[i] >= mean) ups++;
  assert.ok(Math.abs(ups / (43100 / 44100) - 3579545 / (32 * 254)) < 2, `${ups}`);
});

test('DAC streams write their bank at their own frequency, by start/length, by block, looped and stopped', () => {
  const bank = Array.from({ length: 32 }, (_, i) => 0x80 + i * 3);
  const setup = [block(0, bank.slice(0, 16)), block(0, bank.slice(16)), ...DAC_ON,
    [0x90, 0x00, 0x02, 0x00, 0x2a], [0x91, 0x00, 0x00, 0x01, 0x00], [0x92, 0x00, 11025 & 0xff, 11025 >> 8, 0, 0]];   // 11,025 Hz: every 4 samples
  // start at byte 2, four commands
  const d = make([...setup, wait(10), [0x93, 0x00, 2, 0, 0, 0, 0x01, 4, 0, 0, 0], wait(40)], {}, { passes: 1 });
  const { L } = render(d, 40);
  const at = (i, byte) => assert.ok(Math.abs(L[i] - dacLevel(byte)) < 1e-7, `sample ${i}: byte ${byte}`);
  at(10, bank[2]); at(13, bank[2]); at(14, bank[3]); at(18, bank[4]); at(22, bank[5]); at(26, bank[5]); at(30, bank[5]);
  // reversed (length mode bit 4): the same four bytes from the far end
  const rev = make([...setup, wait(10), [0x93, 0x00, 2, 0, 0, 0, 0x11, 4, 0, 0, 0], wait(40)], {}, { passes: 1 });
  const V = render(rev, 40).L;
  for (const [i, byte] of [[10, bank[5]], [14, bank[4]], [18, bank[3]], [22, bank[2]], [30, bank[2]]]) assert.ok(Math.abs(V[i] - dacLevel(byte)) < 1e-7, `reversed ${i}`);
  // the fast call plays block 1 (bytes 16-31) and loops; 0x94 stops it
  const e = make([...setup, wait(10), [0x95, 0x00, 1, 0, 0x01], wait(16 * 4 + 8), [0x94, 0x00], wait(20)], {}, { passes: 1 });
  const E = render(e, 100).L;
  assert.ok(Math.abs(E[10] - dacLevel(bank[16])) < 1e-7);
  assert.ok(Math.abs(E[10 + 4 * 15] - dacLevel(bank[31])) < 1e-7);
  assert.ok(Math.abs(E[10 + 4 * 16] - dacLevel(bank[16])) < 1e-7, 'looped');
  assert.ok(Math.abs(E[90] - E[83]) < 1e-9, 'stopped');
});

test('resampled to 48 kHz: a tone keeps its pitch, a step keeps its time, nothing is NaN', () => {
  const rate = 48000, clock = 7670453;
  const song = [...NOTE(0x0f), ...DAC_ON, wait(22050), ym(0, 0x2b, 0x00), wait(22050)];
  const d = new VgmDeck('t', vgmFile({ ym: clock, commands: song }), { sampleRate: rate, passes: 1 });
  const { L } = render(d, rate);
  for (const v of L) assert.ok(Number.isFinite(v));
  // the FM note joins at 22050 VGM samples = 0.5 s = 24000 output samples (the DAC took channel 6 until then)
  const want = (0x269 * (clock / 144)) / 2 ** (21 - 4);
  const seg = L.slice(30000, 46000);
  let mean = 0;
  for (const v of seg) mean += v / seg.length;
  const ups = [];
  for (let i = 1; i < seg.length; i++) if (seg[i - 1] < mean && seg[i] >= mean) ups.push(i);
  const hz = ((ups.length - 1) * rate) / (ups[ups.length - 1] - ups[0]);
  assert.ok(Math.abs(hz - want) < 0.5, `${hz} vs ${want}`);
  // a DAC step at VGM sample 1000 crosses half way at output sample 1000 x 48000 / 44100
  const s = new VgmDeck('s', vgmFile({ ym: clock, commands: [...DAC_ON, ym(0, 0x2a, 0x00), wait(1000), ym(0, 0x2a, 0xff), wait(1000)] }), { sampleRate: rate, passes: 1 });
  const S = render(s, 3000).L;
  const lo = S[900], hi = S[1200], mid = (lo + hi) / 2;
  let cross = -1;
  for (let i = 1000; i < 1200; i++) if (S[i] >= mid) { cross = i - 1 + (mid - S[i - 1]) / (S[i] - S[i - 1]); break; }
  assert.ok(Math.abs(cross - (1000 * rate) / 44100) < 0.6, `${cross}`);
});

test('a silent chip is silence: the ladder offset is taken off, from the first sample, at any rate', () => {
  for (const rate of [44100, 48000]) {
    const d = new VgmDeck('q', vgmFile({ commands: [ym(0, 0x30, 0x01), wait(20000)] }), { sampleRate: rate });
    const { L, R } = render(d, 6000);
    let peak = 0;
    for (let i = 0; i < 6000; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    assert.ok(peak < 1e-6, `${rate}: ${peak}`);
  }
});

test('warmUp runs the player on a made-up moment of sound without a file, and leaves nothing behind', () => {
  assert.equal(warmUp(48000), undefined);
  assert.equal(warmUp(44100, 4), undefined);
  // a deck made afterwards plays as it would have
  const a = render(make([...NOTE(0x0f), wait(3000)]), 2000).L;
  warmUp(44100);
  const b = render(make([...NOTE(0x0f), wait(3000)]), 2000).L;
  assert.deepEqual(Array.from(a), Array.from(b));
});

test('the mixer starts the queued track on the very sample a VgmDeck ends', () => {
  const events = [];
  const mixer = new MusicMixer({ rate: 44100, onEvent: (e) => events.push(e) });
  const d = make([...DAC_ON, wait(1000), wait(234)], {}, { passes: 1 });
  mixer.decks.push(d);
  mixer.current = d;
  mixer.queued = { id: Object.keys(TRACKS)[0], passes: 1 };
  const L = new Float32Array(128), R = new Float32Array(128);
  for (let k = 0; k < 20; k++) mixer.render(L, R, 128);
  const ended = events.find((e) => e.type === 'ended'), started = events.find((e) => e.type === 'started');
  assert.equal(ended.id, 'vgm:test');
  assert.ok(Math.abs(ended.time - 1234 / 44100) < 1e-9);
  assert.ok(Math.abs(started.time - 1234 / 44100) < 1e-9);
  assert.equal(events.filter((e) => e.type === 'pass').length, 1);
});

test('bad input: no sound chip or no file is a VgmError; garbage in the log never throws from render', () => {
  assert.throws(() => new VgmDeck('x', vgmFile({ ym: 0, sn: 0, commands: [wait(10)] }), { sampleRate: 48000 }), VgmError);
  assert.throws(() => new VgmDeck('x', new Uint8Array(20), { sampleRate: 48000 }), VgmError);
  let seed = 99;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed >>> 16; };
  for (let k = 0; k < 40; k++) {
    const head = vgmFile({ commands: [], end: false });
    const f = new Uint8Array(head.length + 3000);
    f.set(head);
    for (let i = head.length; i < f.length; i++) f[i] = rnd() & 0xff;
    new DataView(f.buffer).setUint32(4, f.length - 4, true);
    const d = new VgmDeck('x', f, { sampleRate: 48000, passes: k % 2 });
    const { L, R } = render(d, 4800);
    for (let i = 0; i < 4800; i += 7) assert.ok(Number.isFinite(L[i]) && Number.isFinite(R[i]));
    assert.equal(d.error, null);
  }
});
