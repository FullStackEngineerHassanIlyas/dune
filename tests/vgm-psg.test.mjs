// The Mega Drive PSG (research music.md §2.3): pitch, the 2 dB attenuation steps, the noise generator and its
// reset, noise tied to tone 2, the Sega power-up register and period-0 behaviour, Game Gear stereo, and the
// averaging that keeps ultrasonic tones from aliasing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SN76489, PSG_FULL } from '../src/audio/music/chips/sn76489.js';

const CLOCK = 3579545, RATE = 44100;
const make = (opts = {}) => new SN76489({ num: CLOCK, den: 16 * RATE, ...opts });   // clock / 16 steps a second
const tone = (psg, ch, period, vol) => {
  psg.write(0x80 | (ch << 5) | (period & 15));
  psg.write((period >> 4) & 0x3f);
  psg.write(0x90 | (ch << 5) | vol);
};
function render(psg, n) {
  const L = new Float64Array(n), R = new Float64Array(n);
  psg.render(L, R, 0, n);
  return { L, R };
}
/** Frequency from rising crossings of the mean. */
function pitch(x, rate = RATE) {
  let mean = 0;
  for (const v of x) mean += v / x.length;
  const ups = [];
  for (let i = 1; i < x.length; i++) if (x[i - 1] < mean && x[i] >= mean) ups.push(i);
  return ((ups.length - 1) * rate) / (ups[ups.length - 1] - ups[0]);
}
const span = (x) => Math.max(...x) - Math.min(...x);

test('a tone of period N sounds at clock / (32 N): 254 gives 440 Hz', () => {
  for (const [ch, n] of [[0, 254], [1, 127], [2, 1016]]) {
    const psg = make();
    tone(psg, ch, n, 0);
    const { L } = render(psg, RATE);
    const want = CLOCK / (32 * n);
    assert.ok(Math.abs(pitch(L) - want) < want * 0.002, `${ch}: ${pitch(L)} vs ${want}`);
  }
});

test('attenuation goes down in 2 dB steps and 15 is off', () => {
  const levels = [];
  for (let v = 0; v < 16; v++) {
    const psg = make();
    tone(psg, 0, 400, v);
    levels.push(span(render(psg, 4000).L));
  }
  assert.ok(Math.abs(levels[0] - PSG_FULL) < 1);
  for (let v = 1; v < 15; v++) {
    const db = 20 * Math.log10(levels[v] / levels[v - 1]);
    assert.ok(Math.abs(db + 2) < 0.01, `step ${v}: ${db} dB`);
  }
  assert.equal(levels[15], 0);
});

test('the chip powers up silent, with register 3 (tone 1 volume) latched on a Sega PSG', () => {
  const psg = make();
  assert.equal(psg.silent, true);
  assert.equal(span(render(psg, 2000).L), 0);
  psg.write(0x05);                       // a data byte with nothing latched yet
  assert.equal(psg.reg[3], 5);
  assert.equal(psg.silent, false);
  const ti = make({ feedback: 0x0003, width: 15 });
  ti.write(0x05);
  assert.equal(ti.reg[3], 15);           // other chips latch tone 0's frequency
  assert.equal(ti.reg[0], 5 << 4);
});

test('period 0 is 0 on a Sega PSG (flipping every step: a steady half level), 0x400 when the header says so', () => {
  const sega = make();
  tone(sega, 0, 0, 0);
  const s = render(sega, 4000).L;
  assert.equal(span(s.slice(10)), 0);
  assert.ok(Math.abs(s[100] - PSG_FULL / 2) < 1e-6);
  const ti = make({ flags: 1 });
  tone(ti, 0, 0, 0);
  const t = render(ti, RATE).L;
  assert.ok(Math.abs(pitch(t) - CLOCK / (32 * 1024)) < 0.5);
});

test('tones above 18.6 kHz hold at their average, so volume writes play samples; 6 and up are tones', () => {
  for (const period of [1, 3, 5]) {
    const psg = make();
    tone(psg, 1, period, 0);
    const x = render(psg, 3000).L.slice(10);
    assert.equal(span(x), 0, `period ${period}`);
    // the volume register then is the sample: a step of the level
    psg.write(0xb4);
    assert.ok(Math.abs(render(psg, 10).L[5] - (PSG_FULL * 10 ** -0.4) / 2) < 1e-6);
  }
  const psg = make();
  tone(psg, 1, 6, 0);                    // 18.6 kHz: still a tone
  const x = render(psg, 4000).L.slice(10);
  assert.ok(span(x) > PSG_FULL * 0.5);
});

test('periodic noise repeats every 16 shifts at clock / 512, / 1024, / 2048', () => {
  for (const rate of [0, 1, 2]) {
    const psg = make();
    psg.write(0xe0 | rate);              // periodic noise
    psg.write(0xf0);                     // noise volume 0
    const { L } = render(psg, RATE);
    const want = CLOCK / (16 * (32 << rate) * 16);
    assert.ok(Math.abs(pitch(L) - want) < want * 0.01, `${rate}: ${pitch(L)} vs ${want}`);
  }
});

test('noise rate 3 follows tone 2: shifts at twice its period, and moves when it does', () => {
  const psg = make();
  tone(psg, 2, 100, 15);                 // tone 2 silent, only its period counts
  psg.write(0xe3);
  psg.write(0xf0);
  let { L } = render(psg, RATE);
  assert.ok(Math.abs(pitch(L) - CLOCK / (16 * 200 * 16)) < 0.5, `${pitch(L)}`);
  tone(psg, 2, 50, 15);
  ({ L } = render(psg, RATE));
  assert.ok(Math.abs(pitch(L) - CLOCK / (16 * 100 * 16)) < 1, `${pitch(L)}`);
});

test('writing the noise register reloads the shift register: the same white noise starts again', () => {
  const psg = make();
  psg.write(0xf0);
  /** The register's next 400 values after a noise write. */
  const sequence = (data) => {
    psg.write(data);
    assert.equal(psg.lfsr, 0x8000);
    const seen = [];
    let last = psg.lfsr;
    while (seen.length < 400) { psg.step(); if (psg.lfsr !== last) seen.push(last = psg.lfsr); }
    return seen;
  };
  const a = sequence(0xe4);              // white noise, rate 0
  render(psg, 1234);                     // somewhere else in the sequence
  const b = sequence(0xe4);
  assert.deepEqual(a, b);
  const c = sequence(0x02);              // a data byte to the latched noise register reloads it too
  assert.deepEqual(c.slice(0, 10), sequence(0xe6).slice(0, 10));
  // and it is noise: at rate 0 (7 kHz shifts) the output changes often
  psg.write(0xe4);
  const { L } = render(psg, 3000);
  let changes = 0;
  for (let i = 1; i < L.length; i++) if (L[i] !== L[i - 1]) changes++;
  assert.ok(changes > 300, `${changes}`);
});

test('the Sega shift register (taps 0x0009, 16 bits) runs 57,337 steps before white noise repeats', () => {
  const psg = make();
  psg.write(0xe4);
  const start = psg.lfsr;
  let n = 0;
  do { psg.count[3] = 0; psg.step(); n++; } while (psg.lfsr !== start && n < 70000);
  assert.equal(n, 57337);
});

test('silence() mutes every channel at once; Game Gear stereo routes channels left and right', () => {
  const psg = make();
  tone(psg, 0, 200, 0);
  tone(psg, 1, 300, 0);
  psg.stereo(0x1f);                      // tone 0 left; all four right... except tone 1 left
  let { L, R } = render(psg, 4000);
  assert.ok(Math.abs(pitch(L) - CLOCK / (32 * 200)) < 1);
  assert.ok(span(R) > span(L));
  psg.stereo(0xf0);                      // everything left, nothing right
  ({ L, R } = render(psg, 2000));
  assert.equal(span(R), 0);
  psg.silence();
  assert.equal(psg.silent, true);
  ({ L } = render(psg, 2000));
  assert.equal(span(L), 0);
});
