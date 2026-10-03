// Unit voices (src/data/unit-voices.js): every kind of unit has a voice group and words for every order it
// takes; the lines rendered (scripts/voices/lines.json, assets/voice/manifest.json) are the ones counted;
// the original-files mode maps each line onto one of the original's shared reply clips.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITS } from '../src/data/units.js';
import { VOICE_GROUPS, SILENT_UNITS, FOOT_GROUPS, VARIANTS, GROUPS, voiceGroup, replyKind, voicedKind, pickVariant, unitLine, parseUnitLine, unitLineIds } from '../src/data/unit-voices.js';
import { UNIT_CLIPS, ACK_CLIPS, ORIGINAL_LINES, resolveLine, summarize } from '../src/formats/dune2-sounds.js';
import { lineInfo, ACK_LINES } from '../src/audio/voice.js';

const root = new URL('../', import.meta.url);
const lines = JSON.parse(readFileSync(new URL('scripts/voices/lines.json', root)));
const manifest = JSON.parse(readFileSync(new URL('assets/voice/manifest.json', root)));
const unit = (typeId, extra = {}) => ({ typeId, type: UNITS[typeId], ...extra });
// Every unit order the player can give (src/sim/orders.js applyCommand), and the panel's.
const ORDERS = ['move', 'attackMove', 'attack', 'guard', 'scatter', 'capture', 'sabotage', 'harvest', 'returnToBase', 'repairAt', 'lift', 'deploy', 'destruct', 'duty', 'drop', 'stop'];

test('every unit type has a voice group, or is one no player ever selects', () => {
  for (const id of Object.keys(UNITS)) {
    const group = voiceGroup(id), silent = SILENT_UNITS.includes(id);
    assert.ok(!!group !== silent, `${id}: a group (${group}) or silent (${silent}), not both or neither`);
    if (group) assert.ok(GROUPS.includes(group), `${id} → ${group}`);
  }
  for (const id of [...Object.keys(VOICE_GROUPS), ...SILENT_UNITS]) assert.ok(UNITS[id], `${id} is a unit type`);
  for (const g of GROUPS) assert.ok(Object.values(VOICE_GROUPS).includes(g), `${g} has units`);
  assert.deepEqual([...FOOT_GROUPS].sort(), ['fremen', 'grunt', 'saboteur', 'trooper']);
  for (const id of ['soldier', 'infantry', 'trooper', 'troopers', 'saboteur', 'fremen']) assert.ok(FOOT_GROUPS.has(voiceGroup(id)), `${id} is on foot`);
  assert.ok(GROUPS.length >= 10, `${GROUPS.length} groups`);
});

test('every group has words for being selected and for every order its units take', () => {
  for (const [typeId, group] of Object.entries(VOICE_GROUPS)) {
    assert.ok(VARIANTS[group].select >= 1, `${group} answers being selected`);
    for (const order of ORDERS) {
      for (const u of [unit(typeId), unit(typeId, { cargo: 5 })]) {
        const kind = replyKind(order, u);
        if (kind) assert.ok(voicedKind(group, kind), `${typeId}: ${order} → ${kind}, which ${group} has no words for`);
      }
    }
    for (const kind of Object.keys(VARIANTS[group])) assert.equal(voicedKind(group, kind), kind);
  }
  // The answers that tell what a unit is doing are its own words, never a stand-in.
  const own = { grunt: ['move', 'attack', 'capture'], trooper: ['move', 'attack', 'capture'], scout: ['move', 'attack'], tanker: ['move', 'attack', 'destruct'],
    harvester: ['move', 'harvest', 'return'], carryall: ['move', 'lift', 'duty', 'drop', 'deliver'], mcv: ['move', 'deploy'], ornithopter: ['move', 'attack'], saboteur: ['move', 'sabotage'] };
  for (const [group, kinds] of Object.entries(own)) for (const kind of kinds) assert.ok(VARIANTS[group][kind] >= 1, `${group} says ${kind}`);
  for (const group of GROUPS) assert.ok(group === 'fremen' || VARIANTS[group].move >= 2, `${group} has more than one way to say it moves`);
});

test('which reply an order draws depends on the unit', () => {
  assert.equal(replyKind('move', unit('trike')), 'move');
  assert.equal(replyKind('attack', unit('harvester')), null, 'nothing to shoot with');
  assert.equal(replyKind('attackMove', unit('harvester')), 'move', 'unarmed units simply move');
  assert.equal(replyKind('attackMove', unit('deviator')), 'attackMove', 'gas is the Deviator\'s weapon');
  assert.equal(replyKind('capture', unit('infantry')), 'capture');
  assert.equal(replyKind('capture', unit('trike')), null);
  assert.equal(replyKind('sabotage', unit('saboteur')), 'sabotage');
  assert.equal(replyKind('harvest', unit('harvester')), 'harvest');
  assert.equal(replyKind('returnToBase', unit('harvester')), 'return');
  assert.equal(replyKind('deploy', unit('mcv')), 'deploy');
  assert.equal(replyKind('deploy', unit('devastator')), 'destruct', 'D blows a Devastator up');
  assert.equal(replyKind('destruct', unit('devastator')), 'destruct');
  assert.equal(replyKind('deploy', unit('combatTank')), null);
  assert.equal(replyKind('guard', unit('carryall')), 'duty', 'G is a Carryall\'s Duty');
  assert.equal(replyKind('deploy', unit('carryall')), null, 'D on an empty Carryall drops nothing');
  assert.equal(replyKind('drop', unit('carryall')), null);
  assert.equal(replyKind('deploy', unit('carryall', { cargo: 9 })), 'drop', 'D is a loaded one\'s Drop');
  assert.equal(replyKind('drop', unit('carryall', { cargo: 9 })), 'drop');
  assert.equal(replyKind('lift', unit('carryall')), 'lift');
  assert.equal(replyKind('returnToBase', unit('carryall')), null, 'nothing to bring home');
  assert.equal(replyKind('repairAt', unit('carryall', { cargo: 9 })), 'deliver');
  assert.equal(replyKind('scatter', unit('carryall')), null);
  for (const order of ORDERS) assert.equal(replyKind(order, unit('fremen')), null, `the Fremen take no ${order} order`);
  for (const id of ['trike', 'combatTank', 'soldier', 'carryall']) assert.equal(replyKind('stop', unit(id)), null, 'a stop goes unanswered');
  assert.equal(replyKind('build', unit('trike')), null);
  assert.equal(replyKind('move', unit('frigate')), null);
  assert.equal(replyKind('move', null), null);
  assert.equal(voicedKind('harvester', 'scatter'), 'move', 'a kind without words borrows the nearest');
  assert.equal(voicedKind('mcv', 'guard'), 'select');
  assert.equal(voicedKind('fremen', 'move'), null);
});

test('a variant is never the same twice in a row, and every one comes up', () => {
  assert.equal(pickVariant(1, 1, () => 0.5), 1);
  for (const count of [2, 3]) {
    const seen = new Set();
    let last = 0;
    for (let i = 0; i < 200; i++) {
      const r = ((i * 7919) % 1000) / 1000;
      const n = pickVariant(count, last, () => r);
      assert.ok(n >= 1 && n <= count && n !== last, `${n} after ${last} of ${count}`);
      seen.add(n);
      last = n;
    }
    assert.equal(seen.size, count);
  }
  assert.equal(pickVariant(3, 0, () => 0.99), 3, 'no last: any of them');
  assert.equal(pickVariant(3, 3, () => 0.99), 2);
});

test('line ids name their group, kind and variant, and every one has a class', () => {
  assert.equal(unitLine('tanker', 'move', 2), 'unit.tanker.move.2');
  assert.deepEqual(parseUnitLine('unit.tanker.move.2'), { group: 'tanker', kind: 'move', n: 2 });
  for (const bad of ['unit.tanker.move.9', 'unit.tanker.lift.1', 'unit.nobody.move.1', 'reporting', 'unit.tanker.move.0']) assert.equal(parseUnitLine(bad), null, bad);
  const ids = unitLineIds();
  assert.equal(ids.length, Object.values(VARIANTS).reduce((s, k) => s + Object.values(k).reduce((a, b) => a + b, 0), 0));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(lineInfo(id), `${id} has a class`);
  assert.equal(lineInfo('unit.grunt.select.1').cls, 'select');
  assert.equal(lineInfo('unit.grunt.move.1').cls, 'order');
  assert.equal(lineInfo('unit.grunt.move.1').lead, 0, 'a unit answers at once');
});

test('the words in lines.json are the lines counted here, and the manifest renders each in its group\'s voice', () => {
  const table = lines.unitVoices;
  assert.deepEqual(Object.keys(table).sort(), [...GROUPS].sort());
  for (const g of GROUPS) {
    assert.deepEqual(Object.fromEntries(Object.entries(table[g]).map(([k, v]) => [k, v.length])), VARIANTS[g], `${g}: lines.json counts`);
    for (const [kind, texts] of Object.entries(table[g])) {
      for (const text of texts) {
        assert.ok(text.split(/\s+/).length <= 4, `${g}.${kind}: "${text}" is short`);
        assert.match(text, /^[A-Z][\w ,'-]*[.!?]$/, `${g}.${kind}: "${text}"`);
      }
      assert.equal(new Set(texts).size, texts.length, `${g}.${kind}: no line twice`);
    }
    const set = manifest.sets[g];
    assert.ok(set, `the manifest has the ${g} set`);
    assert.equal(set.role, 'unit');
    assert.equal(set.group, g);
    const keys = Object.entries(VARIANTS[g]).flatMap(([kind, n]) => Array.from({ length: n }, (_, i) => `${kind}.${i + 1}`));
    assert.deepEqual(Object.keys(set.lines).sort(), keys.sort(), `${g}: every line rendered`);
    for (const [key, line] of Object.entries(set.lines)) {
      const [kind, n] = key.split('.');
      assert.equal(line.text, table[g][kind][n - 1]);
      assert.equal(line.file, `${g}/${key}.ogg`);
    }
  }
  const voices = GROUPS.map((g) => JSON.stringify(manifest.sets[g].voice));
  assert.ok(new Set(voices).size >= 8, `different voices for different units: ${voices.join(' ')}`);
});

test('in the original-files mode every unit line is one of the original\'s shared reply clips, as it chose them', () => {
  const ids = unitLineIds();
  assert.deepEqual(Object.keys(UNIT_CLIPS).sort(), [...ids].sort());
  for (const id of ids) {
    const { group, kind, n } = parseUnitLine(id), clip = UNIT_CLIPS[id], foot = FOOT_GROUPS.has(group);
    assert.match(clip, /^(AFFIRM|REPORT[123]|OVEROUT|MOVEOUT)$/, id);
    if (kind === 'select') assert.equal(clip, foot ? 'REPORT1' : 'REPORT2', `${id}: selecting a ${foot ? 'foot unit' : 'vehicle'}`);
    else if (!foot) assert.equal(clip, n % 2 ? 'REPORT3' : 'AFFIRM', `${id}: a vehicle answers REPORT3 or AFFIRM (viewport.c)`);
  }
  assert.equal(UNIT_CLIPS['unit.grunt.move.2'], 'MOVEOUT');
  assert.equal(UNIT_CLIPS['unit.trooper.attack.1'], 'OVEROUT');
  assert.equal(UNIT_CLIPS['unit.grunt.guard.1'], 'OVEROUT');
  assert.equal(UNIT_CLIPS['unit.saboteur.sabotage.1'], 'REPORT3');
  assert.equal(UNIT_CLIPS['unit.fremen.select.3'], 'REPORT1');
  assert.deepEqual(Object.keys(ACK_CLIPS).sort(), [...ACK_LINES].sort(), 'the old replies keep their table');
  for (const id of ids) assert.ok(ORIGINAL_LINES.includes(id), id);
  assert.equal(new Set(ORIGINAL_LINES).size, ORIGINAL_LINES.length);
  const has = (n) => ['ZREPORT2', 'MOVEOUT', 'FAFFIRM'].includes(n);
  assert.deepEqual(resolveLine('unit.tanker.select.1', 'harkonnen', has), ['ZREPORT2']);
  assert.deepEqual(resolveLine('unit.grunt.move.3', 'ordos', has), ['MOVEOUT']);
  assert.deepEqual(resolveLine('unit.scout.move.2', 'atreides', has), ['FAFFIRM']);
  assert.equal(resolveLine('unit.grunt.select.1', 'atreides', has), null, 'no REPORT1: the line keeps its own voice');
  assert.deepEqual(summarize(new Set(['ZAFFIRM'])).acknowledgements, { lines: 1, of: ACK_LINES.length }, 'the page counts the replies as before');
});
