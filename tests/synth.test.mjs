import test from 'node:test';
import assert from 'node:assert/strict';
import { RATE, RECIPES, render, noise, lowpass, envelope, tone } from '../src/audio/synth.js';

test('every sound renders short, finite and loud enough without clipping', () => {
  for (const id of Object.keys(RECIPES)) {
    const a = render(id);
    let peak = 0;
    for (const v of a) { assert.ok(Number.isFinite(v), id); peak = Math.max(peak, Math.abs(v)); }
    assert.ok(a.length > RATE * 0.02 && a.length < RATE * 2.5, `${id} lasts ${(a.length / RATE).toFixed(2)} s`);
    assert.ok(peak > 0.2 && peak <= 1, `${id} peaks at ${peak.toFixed(2)}`);
  }
  assert.throws(() => render('nope'));
});

test('rendering is deterministic', () => {
  assert.deepEqual(render('cannon'), render('cannon'));
  assert.deepEqual(render('explosionLarge'), render('explosionLarge'));
});

test('bigger explosions last longer', () => {
  assert.ok(render('explosionLarge').length > 2 * render('explosionSmall').length);
  assert.ok(render('explosionMedium').length > render('explosionSmall').length);
});

test('the building blocks behave', () => {
  const roughness = (a) => a.reduce((n, v, i) => n + (i ? Math.abs(v - a[i - 1]) : 0), 0) / a.length;
  assert.ok(roughness(lowpass(noise(0.5, 1), 200)) < roughness(noise(0.5, 1)) / 4, 'a low-pass smooths noise');
  const e = envelope(new Float32Array(100).fill(1), 0, 3);
  assert.ok(e[1] > 0.9 && e[99] < 0.01);
  assert.equal(tone(1, 440).length, RATE);
});

test('the specials\' sounds are there: sonic hum, gas hiss, Destruct alarm', () => {
  for (const id of ['sonic', 'gas', 'alarm']) assert.ok(RECIPES[id] && render(id).length > 0, id);
});
