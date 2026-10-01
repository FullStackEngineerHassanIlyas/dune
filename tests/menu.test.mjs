import test from 'node:test';
import assert from 'node:assert/strict';
import { skirmishQuery, cleanSetup, loadSetup, saveSetup, DEFAULT_SETUP } from '../src/ui/skirmish-setup.js';
import { changeSetting, OPTION_ROWS } from '../src/ui/options.js';
import { controlRows } from '../src/ui/controls-help.js';
import { DEFAULTS, sanitize, loadSettings, saveSettings } from '../src/core/settings.js';
import { readParams } from '../src/core/params.js';
import { GameMenu } from '../src/ui/game-menu.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('the skirmish set-up becomes the battle URL', () => {
  const q = new URLSearchParams(skirmishQuery({ house: 'harkonnen', enemy: 'ordos', difficulty: 'hard', size: 96, seed: 42, credits: 5000, visibility: 'fog' }));
  assert.deepEqual(Object.fromEntries(q), { scene: 'skirmish', house: 'harkonnen', enemy: 'ordos', ai: 'hard', size: '96', seed: '42', credits: '5000', visibility: 'fog' });
});

test('a random opponent is another house and an empty seed is rolled', () => {
  for (const r of [0, 0.49, 0.5, 0.99]) {
    const q = new URLSearchParams(skirmishQuery({ house: 'atreides', enemy: 'random', seed: null }, () => r));
    assert.ok(['harkonnen', 'ordos'].includes(q.get('enemy')));
    assert.ok(Number(q.get('seed')) >= 1);
  }
});

test('stored set-ups are cleaned: unknown houses, sizes, seeds and credits fall back', () => {
  assert.deepEqual(cleanSetup({ house: 'fremen', enemy: 'sardaukar', difficulty: 'insane', size: 1000, seed: -3, credits: 7, visibility: 'darkness' }), { ...DEFAULT_SETUP });
  assert.equal(cleanSetup({ fog: false }).visibility, 'revealed', 'a setup saved with fog off keeps its revealed map');
  assert.equal(cleanSetup({ fog: true }).visibility, 'shroud', 'and one saved with fog on now gets the Dune II shroud');
  assert.equal(cleanSetup({ house: 'ordos', enemy: 'ordos' }).enemy, 'ordos', 'cleanSetup keeps it; the query replaces a clash');
  assert.notEqual(new URLSearchParams(skirmishQuery({ house: 'ordos', enemy: 'ordos' }, () => 0)).get('enemy'), 'ordos');
});

test('the set-up is remembered', () => {
  const store = memory();
  saveSetup({ ...DEFAULT_SETUP, house: 'ordos', size: 128 }, store);
  assert.equal(loadSetup(store).house, 'ordos');
  assert.equal(loadSetup(store).size, 128);
  store.setItem('dune2-3d.skirmish', '{broken');
  assert.deepEqual(loadSetup(store), DEFAULT_SETUP);
});

test('an option change is sanitized, kept in the live settings object and saved', () => {
  const store = memory();
  const settings = { ...DEFAULTS };
  const same = changeSetting(settings, 'scrollSpeed', 2.5, store);
  assert.equal(same, settings);
  assert.equal(settings.scrollSpeed, 2.5);
  changeSetting(settings, 'quality', 'ultra', store);
  assert.equal(settings.quality, DEFAULTS.quality);
  assert.equal(JSON.parse(store.getItem('dune2-3d.settings')).scrollSpeed, 2.5);
});

test('every option row names a real setting, with choices inside what settings accept', () => {
  for (const row of OPTION_ROWS) {
    assert.ok(row.key in DEFAULTS, row.key);
    for (const [value] of row.choices ?? []) assert.equal(changeSetting({ ...DEFAULTS }, row.key, value, memory())[row.key], value, `${row.key}=${value}`);
    if (row.range) for (const value of row.range.slice(0, 2)) assert.equal(changeSetting({ ...DEFAULTS }, row.key, value, memory())[row.key], value);
  }
});

test('the menu backdrop moves by default, and pausing it is remembered as a boolean', () => {
  assert.equal(DEFAULTS.menuMotion, true);
  assert.equal(sanitize({}).menuMotion, true);
  for (const off of [false, 'false', '0']) assert.equal(sanitize({ menuMotion: off }).menuMotion, false, JSON.stringify(off));
  for (const on of [true, 'true', '1']) assert.equal(sanitize({ menuMotion: on }).menuMotion, true, JSON.stringify(on));
  const store = memory();
  saveSettings({ ...DEFAULTS, menuMotion: false }, store);
  assert.equal(JSON.parse(store.getItem('dune2-3d.settings')).menuMotion, false);
  assert.equal(loadSettings(readParams(''), store).menuMotion, false);
  assert.equal(loadSettings(readParams('?menuMotion=1'), store).menuMotion, true, 'the URL still overrides');
  assert.equal(changeSetting(loadSettings(null, store), 'menuMotion', true, store).menuMotion, true);
  assert.equal(loadSettings(null, store).menuMotion, true);
});

test('pausing the backdrop is a menu button, not an Options row', () => {
  assert.ok(!OPTION_ROWS.some((row) => row.key === 'menuMotion'));
});

test('the controls screen follows the mouse scheme', () => {
  const find = (rows, what) => rows.find(([w]) => w === what)[1];
  assert.match(find(controlRows('classic'), 'Deselect'), /Right click/);
  assert.match(find(controlRows('modern'), 'Move · attack · harvest'), /Right click/);
  assert.match(find(controlRows('classic'), 'Scroll the map'), /right button/);
});

test('the game menu keeps Esc and F10 and lets Tab and Enter work its buttons', () => {
  const menu = Object.create(GameMenu.prototype);
  let closed = 0, shown = null;
  Object.assign(menu, { page: 'options', close: () => { closed++; }, show: (p) => { shown = p; } });
  assert.equal(menu.onKey('Enter'), false);
  assert.equal(menu.onKey('Escape'), true);
  assert.equal(shown, 'main', 'Esc on a sub-page steps back');
  menu.page = 'main';
  menu.onKey('F10');
  assert.equal(closed, 1, 'Esc or F10 on the main page closes');
});
