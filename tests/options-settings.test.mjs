import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, sanitize, loadSettings, saveSettings } from '../src/core/settings.js';
import { readParams } from '../src/core/params.js';
import { OPTION_ROWS, changeSetting } from '../src/ui/options.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('music volume (contract 2): 0..1, 0 is off, 0.5 by default', () => {
  assert.equal(DEFAULTS.musicVolume, 0.5);
  assert.equal(sanitize({}).musicVolume, 0.5);
  assert.equal(sanitize({ musicVolume: 0 }).musicVolume, 0, '0 turns the music off');
  assert.equal(sanitize({ musicVolume: '0.25' }).musicVolume, 0.25, 'from the URL');
  for (const bad of [-0.1, 1.5, 'loud', null, NaN]) assert.equal(sanitize({ musicVolume: bad }).musicVolume, 0.5, String(bad));
});

test('no volume goes past full', () => {
  for (const key of ['volume', 'voiceVolume', 'musicVolume']) {
    assert.equal(sanitize({ [key]: 1 })[key], 1, key);
    assert.equal(sanitize({ [key]: 2 })[key], DEFAULTS[key], `${key} 2 is refused`);
  }
});

test('the music volume is saved and the URL overrides it', () => {
  const store = memory();
  const settings = loadSettings(null, store);
  changeSetting(settings, 'musicVolume', 0, store);
  assert.equal(settings.musicVolume, 0);
  assert.equal(loadSettings(readParams(''), store).musicVolume, 0);
  assert.equal(loadSettings(readParams('?musicVolume=0.8'), store).musicVolume, 0.8);
});

test('the frame-rate check is on by default and can be turned off for good', () => {
  assert.equal(DEFAULTS.perfCheck, true);
  const store = memory();
  saveSettings({ ...DEFAULTS, perfCheck: false }, store);
  assert.equal(loadSettings(null, store).perfCheck, false);
  assert.equal(sanitize({ perfCheck: 'nope' }).perfCheck, false, 'a boolean: anything but true, "true" or "1" is off');
});

test('Options has a Music row (contract 2) next to Voices, from Off to 100%', () => {
  const keys = OPTION_ROWS.map((r) => r.key);
  const music = OPTION_ROWS.find((r) => r.key === 'musicVolume');
  assert.ok(music, 'a Music row');
  assert.equal(music.label, 'Music');
  assert.deepEqual(music.range.slice(0, 2), [0, 1]);
  assert.equal(music.format(0), 'Off');
  assert.equal(music.format(0.5), '50%');
  assert.equal(keys.indexOf('musicVolume'), keys.indexOf('voiceVolume') + 1);
});

test('Options has the frame-rate check under Graphics', () => {
  const keys = OPTION_ROWS.map((r) => r.key);
  const row = OPTION_ROWS.find((r) => r.key === 'perfCheck');
  assert.ok(row);
  assert.equal(keys.indexOf('perfCheck'), keys.indexOf('quality') + 1);
  assert.deepEqual(row.choices.map(([v]) => v), [true, false]);
});

test('every option row keeps working: each choice and range end round-trips through the saved settings', () => {
  for (const row of OPTION_ROWS) {
    assert.ok(row.key in DEFAULTS, row.key);
    const values = row.choices ? row.choices.map(([v]) => v) : row.range.slice(0, 2);
    for (const value of values) {
      const store = memory();
      changeSetting({ ...DEFAULTS }, row.key, value, store);
      assert.equal(loadSettings(null, store)[row.key], value, `${row.key}=${value}`);
    }
  }
});
