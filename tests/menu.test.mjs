import test from 'node:test';
import assert from 'node:assert/strict';
import { skirmishQuery, cleanSetup, loadSetup, saveSetup, DEFAULT_SETUP } from '../src/ui/skirmish-setup.js';
import { changeSetting, OPTION_ROWS } from '../src/ui/options.js';
import { controlRows } from '../src/ui/controls-help.js';
import { DEFAULTS, sanitize, loadSettings, saveSettings } from '../src/core/settings.js';
import { readParams } from '../src/core/params.js';
import { GameMenu } from '../src/ui/game-menu.js';
import { setupSkirmish, skirmishOptions } from '../src/game/setup.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('the skirmish set-up becomes the battle URL', () => {
  const q = new URLSearchParams(skirmishQuery({ house: 'harkonnen', opponents: [{ house: 'ordos', difficulty: 'hard' }, { house: 'mercenary', difficulty: 'easy' }],
    techLevel: 6, worms: 'many', size: 96, seed: 42, credits: 5000, visibility: 'fog' }));
  assert.deepEqual(Object.fromEntries(q), { scene: 'skirmish', house: 'harkonnen', opponents: 'ordos:hard,mercenary:easy', tech: '6', worms: 'many', size: '96', seed: '42', credits: '5000', visibility: 'fog' });
});

test('the battle URL brings the set-up back into the world: houses, difficulties, tech level and worms', () => {
  const setup = { house: 'ordos', opponents: [{ house: 'sardaukar', difficulty: 'hard' }, { house: 'random', difficulty: 'easy' }, { house: 'atreides', difficulty: 'normal' }],
    techLevel: 5, worms: 'off', size: 64, seed: 7, credits: 1000, visibility: 'revealed' };
  const q = skirmishQuery(setup, () => 0);
  const { world, opponents } = setupSkirmish(skirmishOptions(readParams(`?${q}`)));
  assert.deepEqual(opponents, ['sardaukar', 'harkonnen', 'atreides'], 'the random one rolled the free Great House');
  assert.deepEqual(opponents.map((id) => world.houses.get(id).brain.difficulty), ['hard', 'easy', 'normal']);
  assert.deepEqual([...world.houses.values()].map((h) => h.techLevel), [5, 5, 5, 5]);
  assert.deepEqual([world.rules.worms, world.visibility, world.map.w, world.houses.get('ordos').credits], ['off', 'revealed', 64, 1000]);
});

test('an older battle URL with enemy= and ai= still sets up its battle', () => {
  const { world, opponents } = setupSkirmish(skirmishOptions(readParams('?scene=skirmish&house=atreides&enemy=ordos&ai=hard&seed=3')));
  assert.deepEqual(opponents, ['ordos']);
  assert.equal(world.houses.get('ordos').brain.difficulty, 'hard');
  assert.deepEqual([world.rules.worms, world.houses.get('atreides').techLevel], ['few', 9]);
});

test('a random opponent is another house, Great Houses first, and an empty seed is rolled', () => {
  for (const r of [0, 0.49, 0.5, 0.99]) {
    const q = new URLSearchParams(skirmishQuery({ house: 'atreides', opponents: [{ house: 'random', difficulty: 'normal' }], seed: null }, () => r));
    assert.ok(['harkonnen:normal', 'ordos:normal'].includes(q.get('opponents')), q.get('opponents'));
    assert.ok(Number(q.get('seed')) >= 1);
  }
  const three = new URLSearchParams(skirmishQuery({ house: 'atreides', opponents: [{ house: 'random' }, { house: 'harkonnen' }, { house: 'random' }] }, () => 0.99)).get('opponents');
  assert.equal(three, 'ordos:normal,harkonnen:normal,mercenary:normal', 'a fixed pick is never rolled away; then the sub-houses');
});

test('stored set-ups are cleaned: unknown houses, sizes, seeds, credits, tech levels and worms fall back', () => {
  assert.deepEqual(cleanSetup({ house: 'fremen', opponents: [{ house: 'fremen', difficulty: 'insane' }], size: 1000, seed: -3, credits: 7, visibility: 'darkness', techLevel: 12, worms: 'plenty' }), { ...DEFAULT_SETUP });
  assert.equal(cleanSetup({ fog: false }).visibility, 'revealed', 'a setup saved with fog off keeps its revealed map');
  assert.equal(cleanSetup({ fog: true }).visibility, 'shroud', 'and one saved with fog on now gets the Dune II shroud');
  assert.deepEqual(cleanSetup({ house: 'ordos', opponents: [{ house: 'ordos' }, { house: 'harkonnen' }, { house: 'harkonnen' }] }).opponents.map((o) => o.house), ['random', 'harkonnen', 'random'], 'a house is never taken twice');
  assert.deepEqual(cleanSetup({ size: 48, opponents: [{ house: 'harkonnen' }, { house: 'ordos' }, { house: 'sardaukar' }] }).opponents.map((o) => o.house), ['harkonnen', 'ordos'], 'a Small map holds two opponents');
  assert.deepEqual(cleanSetup({ opponents: [] }).opponents, DEFAULT_SETUP.opponents, 'never fewer than one');
});

test('a set-up saved before phase 2 (one enemy and a difficulty) becomes the one opponent', () => {
  const old = cleanSetup({ house: 'harkonnen', enemy: 'ordos', difficulty: 'hard', size: 96, seed: 5, credits: 5000, visibility: 'fog' });
  assert.deepEqual(old.opponents, [{ house: 'ordos', difficulty: 'hard' }]);
  assert.deepEqual([old.techLevel, old.worms, old.size, old.seed], [9, 'few', 96, 5]);
  assert.ok(!('enemy' in old) && !('difficulty' in old));
  assert.deepEqual(cleanSetup({ house: 'ordos', enemy: 'ordos', difficulty: 'easy' }).opponents, [{ house: 'random', difficulty: 'easy' }], 'a clash with the player becomes random');
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
