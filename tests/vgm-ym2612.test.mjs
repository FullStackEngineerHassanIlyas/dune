// The YM2612 port is bit-exact with the C++ ymfm it comes from (research music.md §2.6): the register scripts in
// fixtures/vgm/ym2612-scripts.mjs ran through ymfm 81aec25 in scratch, and the CRC32 of every 8192-sample chunk
// of its Int16 stereo output is in ym2612-golden.json. No C++ is needed here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { YM2612 } from '../src/audio/music/chips/ym2612.js';
import { ym2612Scripts } from './fixtures/vgm/ym2612-scripts.mjs';
import { chunkCrcs } from './fixtures/vgm/helpers.mjs';

const GOLDEN = JSON.parse(readFileSync(new URL('./fixtures/vgm/ym2612-golden.json', import.meta.url), 'utf8'));

/** Runs a script as the harness does: Int16 stereo, clamped, interleaved. */
function render(script) {
  const chip = new YM2612({ ym3438: script.mode === 'ym3438' });
  const total = script.steps.reduce((n, s) => n + (s[0] === 'n' ? s[1] : 0), 0);
  const pcm = new Int16Array(total * 2);
  const L = new Int32Array(1024), R = new Int32Array(1024);
  let at = 0;
  for (const s of script.steps) {
    if (s[0] === 'w') chip.write(s[1], s[2], s[3]);
    else if (s[0] === 'p') chip.writePort(s[1], s[2]);
    else for (let left = s[1]; left > 0;) {
      const n = Math.min(left, 1024);
      chip.generate(L, R, 0, n);
      for (let i = 0; i < n; i++, at++) {
        pcm[2 * at] = Math.max(-32768, Math.min(32767, L[i]));
        pcm[2 * at + 1] = Math.max(-32768, Math.min(32767, R[i]));
      }
      left -= n;
    }
  }
  return pcm;
}

const scripts = ym2612Scripts();

test('the golden file covers every register script', () => {
  assert.deepEqual(Object.keys(GOLDEN.scripts).sort(), scripts.map((s) => s.name).sort());
});

for (const script of scripts) {
  test(`YM2612 port matches C++ ymfm sample for sample: ${script.name}`, () => {
    const pcm = render(script);
    const want = GOLDEN.scripts[script.name];
    assert.equal(pcm.length / 2, want.samples);
    const got = chunkCrcs(pcm, GOLDEN.chunk);
    const first = got.findIndex((c, i) => c !== want.crc[i]);
    assert.equal(first, -1, `first differing chunk: ${first} (samples ${first * GOLDEN.chunk}-${(first + 1) * GOLDEN.chunk})`);
    // and the script made sound (a silent chip would match a silent reference)
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
    assert.ok(peak > 2000, `peak ${peak}`);
  });
}

test('one output sample per 144 clocks: a carrier at fnum 0x200, block 4 sounds at fnum x rate / 2^(21 - block)', () => {
  const chip = new YM2612();
  // one sine carrier (algorithm 7, operator 1 only), multiple 1, full level
  chip.write(0, 0xb0, 0x07);
  chip.write(0, 0x30, 0x01); chip.write(0, 0x40, 0x00); chip.write(0, 0x50, 0x1f); chip.write(0, 0x80, 0x0f);
  for (const o of [4, 8, 12]) chip.write(0, 0x40 + o, 0x7f);
  chip.write(0, 0xa4, (4 << 3) | 0x02); chip.write(0, 0xa0, 0x00);
  chip.write(0, 0x28, 0x10);
  const rate = 7670453 / 144, n = 8192;
  const L = new Int32Array(n), R = new Int32Array(n);
  chip.generate(L, R, 0, n);
  const hz = (0x200 * rate) / 2 ** (21 - 4);
  assert.ok(Math.abs(hz - 208.07) < 0.1);
  // rising zero crossings around the mean (the DAC ladder offsets every channel a little)
  let mean = 0;
  for (let i = 1024; i < n; i++) mean += L[i] / (n - 1024);
  const ups = [];
  for (let i = 1025; i < n; i++) if (L[i - 1] < mean && L[i] >= mean) ups.push(i);
  const measured = ((ups.length - 1) * rate) / (ups[ups.length - 1] - ups[0]);
  assert.ok(Math.abs(measured - hz) < 0.5, `${measured} Hz`);
});

test('keyOffAll releases every channel until the chip is silent', () => {
  const chip = new YM2612();
  chip.write(0, 0xb0, 0x07); chip.write(0, 0x50, 0x1f); chip.write(0, 0x80, 0x0f); chip.write(0, 0xa4, 0x22); chip.write(0, 0xa0, 0x69);
  chip.write(0, 0x28, 0xf0);
  const L = new Int32Array(4096), R = new Int32Array(4096);
  chip.generate(L, R, 0, 4096);
  assert.equal(chip.silent, false);
  chip.keyOffAll();
  chip.generate(L, R, 0, 4096);
  assert.equal(chip.silent, true);
});
