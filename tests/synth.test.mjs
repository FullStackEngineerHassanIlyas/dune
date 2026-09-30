import test from 'node:test';
import assert from 'node:assert/strict';
import { RATE, RECIPES, VARIANTS, render, variants, noise, lowpass, envelope, tone, biquad, loudness, reverbImpulse } from '../src/audio/synth.js';

const bank = Object.fromEntries(Object.keys(RECIPES).map((id) => [id, Array.from({ length: variants(id) }, (_, v) => render(id, v))]));
const peakOf = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const energy = (a) => a.reduce((s, v) => s + v * v, 0);
/** Share of a sound's energy above `hz`. */
const above = (a, hz) => energy(biquad(Float32Array.from(a), 'hp', hz)) / energy(a);

test('every sound and every variation renders short, finite and loud enough without clipping', () => {
  for (const [id, vs] of Object.entries(bank)) vs.forEach((a, v) => {
    for (const x of a) assert.ok(Number.isFinite(x), `${id}/${v}`);
    assert.ok(a.length > RATE * 0.02 && a.length <= RATE * 3.6, `${id}/${v} lasts ${(a.length / RATE).toFixed(2)} s`);
    const peak = peakOf(a);
    assert.ok(peak > 0.1 && peak <= 0.97, `${id}/${v} peaks at ${peak.toFixed(2)}`);
    assert.ok(Math.abs(a[a.length - 1]) < 1e-3 && Math.abs(a[0]) < 0.2, `${id}/${v} starts and ends without a click`);
  });
  assert.throws(() => render('nope'));
});

test('rendering is deterministic per sound and variation; the variations differ', () => {
  assert.deepEqual(render('cannon', 1), bank.cannon[1]);
  assert.deepEqual(render('explosionLarge'), bank.explosionLarge[0]);
  for (const [id, n] of Object.entries(VARIANTS)) {
    assert.ok(n >= 2, id);
    for (let v = 1; v < n; v++) assert.notDeepEqual(bank[id][v], bank[id][0], `${id} variation ${v} is not variation 0`);
  }
  for (const id of ['rifle', 'mg', 'cannon', 'explosionSmall', 'hit', 'sandHit', 'rocket']) assert.ok(variants(id) >= 3, `${id} is heard often: three variations at least`);
});

test('loudness follows the design: blasts over guns over the interface, and variations match each other', () => {
  const L = (id) => loudness(bank[id][0]);
  const order = ['explosionHuge', 'explosionLarge', 'explosionMedium', 'explosionSmall', 'cannon', 'mg', 'rifle', 'bulletHit', 'click'];
  for (let k = 1; k < order.length; k++) assert.ok(L(order[k - 1]) > L(order[k]), `${order[k - 1]} (${L(order[k - 1]).toFixed(1)}) is louder than ${order[k]} (${L(order[k]).toFixed(1)})`);
  for (const [id, vs] of Object.entries(bank)) {
    const ls = vs.map(loudness);
    assert.ok(Math.max(...ls) - Math.min(...ls) < 1.5, `${id} variations within 1.5 LU: ${ls.map((l) => l.toFixed(1))}`);
    assert.ok(ls[0] > -30 && ls[0] < -9, `${id} at ${ls[0].toFixed(1)} LUFS`);
  }
});

test('loudness is measured as EBU R128 does', () => {
  const sine = tone(1, 1000);
  assert.ok(Math.abs(loudness(sine) - -3.01) < 0.3, `a full-scale 1 kHz sine reads ${loudness(sine).toFixed(2)} LUFS`);
  const half = sine.map((v) => v * 0.5);
  assert.ok(Math.abs(loudness(sine) - loudness(half) - 6.02) < 0.05, 'half the amplitude is 6 dB quieter');
  assert.ok(loudness(tone(1, 30)) < loudness(sine) - 6, 'deep bass counts for less, as it does to the ear');
});

test('heavy sounds keep energy a laptop speaker can play; small arms and sparks are bright', () => {
  for (const id of ['cannon', 'heavyCannon', 'explosionSmall', 'explosionMedium', 'explosionLarge', 'explosionHuge', 'collapse', 'sandHit', 'clunk']) {
    const share = above(bank[id][0], 200);
    assert.ok(share > 0.28, `${id}: ${(share * 100).toFixed(0)}% of its energy above 200 Hz`);
  }
  assert.ok(above(bank.rifle[0], 1000) > above(bank.cannon[0], 1000), 'a rifle is brighter than a cannon');
  assert.ok(above(bank.weld[0], 2000) > 0.5 && above(bank.static[0], 2000) > 0.5, 'a welding arc and radio static hiss');
});

test('bigger explosions last longer; debris lands after the blast', () => {
  assert.ok(bank.explosionLarge[0].length > 1.5 * bank.explosionSmall[0].length);
  assert.ok(bank.explosionMedium[0].length > bank.explosionSmall[0].length);
  assert.ok(bank.explosionHuge[0].length > bank.explosionLarge[0].length);
  for (const a of bank.debris) assert.ok(peakOf(a.subarray(0, Math.round(0.1 * RATE))) < 0.01, 'the first chunk comes down a moment after the blast');
});

test('every sound the game and the other workstreams call for is there', () => {
  for (const id of ['rifle', 'mg', 'cannon', 'heavyCannon', 'rocket', 'rocketFly', 'launchHeavy', 'sonic', 'gas', 'hit', 'sandHit', 'bulletHit',
    'explosionSmall', 'explosionMedium', 'explosionLarge', 'explosionHuge', 'debris', 'collapse', 'crush', 'clunk', 'slab', 'ratchet', 'weld',
    'harvesterUnload', 'rotor', 'jet', 'ready', 'sell', 'click', 'error', 'beep', 'alarm', 'static']) assert.ok(RECIPES[id], id);
});

test('the whole bank stays small: under 80 s of audio, about 10 MB as float samples', () => {
  const seconds = Object.values(bank).flat().reduce((s, a) => s + a.length, 0) / RATE;
  assert.ok(seconds < 80, `${seconds.toFixed(1)} s`);
});

test('the desert reverb: stereo, decorrelated, decaying and darkening', () => {
  const [l, r] = reverbImpulse(48000);
  assert.equal(l.length, r.length);
  assert.equal(l.length, 72000);
  for (const x of l) assert.ok(Number.isFinite(x));
  const window = (a, from, to) => energy(a.subarray(Math.round(from * 48000), Math.round(to * 48000)));
  assert.ok(window(l, 1.3, 1.5) < window(l, 0.05, 0.25) * 1e-3, 'the tail dies away');
  let dot = 0;
  for (let i = 0; i < l.length; i++) dot += l[i] * r[i];
  assert.ok(Math.abs(dot) / Math.sqrt(energy(l) * energy(r)) < 0.2, 'left and right differ, so the space is wide');
  const early = l.subarray(Math.round(0.05 * 48000), Math.round(0.3 * 48000)), late = l.subarray(Math.round(0.6 * 48000), Math.round(0.9 * 48000));
  const bright = (a) => energy(a.map((v, i) => (i ? v - a[i - 1] : 0))) / energy(a);
  assert.ok(bright(late) < bright(early), 'high frequencies fade first');
});

test('the building blocks behave', () => {
  const roughness = (a) => a.reduce((n, v, i) => n + (i ? Math.abs(v - a[i - 1]) : 0), 0) / a.length;
  assert.ok(roughness(lowpass(noise(0.5, 1), 200)) < roughness(noise(0.5, 1)) / 4, 'a low-pass smooths noise');
  assert.ok(roughness(biquad(noise(0.5, 1), 'lp', 200)) < roughness(noise(0.5, 1)) / 8, 'a two-pole low-pass smooths it more');
  const dc = biquad(new Float32Array(RATE).fill(1), 'hp', 100);
  assert.ok(Math.abs(dc[RATE - 1]) < 1e-3, 'a high-pass removes a constant');
  const e = envelope(new Float32Array(100).fill(1), 0, 3);
  assert.ok(e[1] > 0.9 && e[99] < 0.01);
  assert.equal(tone(1, 440).length, RATE);
});
