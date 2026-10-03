// The mission scene's lookup (C1): the campaign's def when src/data/campaign.js has it, our sample otherwise;
// and the camera starts on the player's base. The game menu's words for a mission (C2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionFor, baseFocus } from '../src/scenes/mission.js';
import { menuWords } from '../src/ui/game-menu.js';
import { setup } from './missions-helpers.mjs';

test('the campaign\'s def is played when there is one; else the sample, for the asked house and number', async () => {
  const def = { id: 'ordos-4' };
  assert.deepEqual(await missionFor('ordos', 4, async () => ({ missionDef: (h, n) => (h === 'ordos' && n === 4 ? def : null) })), { def, sample: false });
  const none = await missionFor('ordos', 5, async () => ({ missionDef: () => null }));
  assert.equal(none.sample, true);
  assert.deepEqual([none.def.house, none.def.mission], ['ordos', 5]);
  const missing = await missionFor('harkonnen', 2, async () => { throw new Error('404'); });
  assert.deepEqual([missing.sample, missing.def.house], [true, 'harkonnen']);
});

test('the camera starts over the player\'s Construction Yard', () => {
  const { world } = setup();
  const yard = [...world.structures.values()].find((s) => s.house === 'atreides' && s.typeId === 'constructionYard');
  assert.deepEqual(baseFocus(world, 'atreides'), { x: yard.x + 1, z: yard.y + 3 });
  for (const s of [...world.structures.values()]) if (s.house === 'atreides') world.removeStructure(s);
  const f = baseFocus(world, 'atreides');
  assert.ok(Number.isFinite(f.x) && Number.isFinite(f.z), 'a base gone: its units');
});

test('a mission\'s game menu says Restart mission and Quit mission; a skirmish\'s keeps its words', () => {
  assert.deepEqual([menuWords().restart, menuWords().quit], ['Restart battle', 'Quit to main menu']);
  const shell = menuWords({ mission: true, inShell: true }), alone = menuWords({ mission: true });
  assert.deepEqual([shell.restart, shell.quit], ['Restart mission', 'Quit mission']);
  assert.match(shell.quitNote, /campaign/);
  assert.match(alone.quitNote, /main menu/);
});
