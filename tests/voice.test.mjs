import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { VoiceQueue, VoicePlayer, WebVoiceOutput, lineForEvent, lineInfo, ackForCommand, namedLine, ACK_LINES, SELECT_ACKS, NAMED_HOUSES, EVA_KEYS, GAP, LEAD, VOICE_LEVEL } from '../src/audio/voice.js';
import { PLAYABLE_HOUSES } from '../src/data/houses.js';
import { unitLineIds } from '../src/data/unit-voices.js';
import { DEFAULTS, sanitize } from '../src/core/settings.js';
import { OPTION_ROWS } from '../src/ui/options.js';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('assets/voice/manifest.json', root)));
const lines = JSON.parse(readFileSync(new URL('scripts/voices/lines.json', root)));
const setOf = (house) => manifest.sets[manifest.houses[house]];

// Every 'eva' key the simulation can raise, read from its source: eva(…, 'key' …), key: 'key', announce(…, 'key' …) and refusals.
function simEvaKeys() {
  const keys = new Set();
  const dir = new URL('src/sim/', root);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const re of [/\beva\([^,]+,\s*[^,]+,\s*'(\w+)'/g, /'eva', \{[^}]*key: '(\w+)'/g, /\bannounce\([^,]+,\s*[^,]+,\s*'(\w+)'/g, /refusal = \['(\w+)'/g]) {
      for (const m of src.matchAll(re)) keys.add(m[1]);
    }
  }
  keys.delete('key');   // announce()'s own parameter list
  return keys;
}

test('every announcement the simulation raises has a voiced line for every playable house', () => {
  const keys = simEvaKeys();
  assert.ok(keys.size >= 35, `found ${keys.size} keys`);
  for (const key of keys) assert.ok(EVA_KEYS.includes(key), `eva key ${key} has no line: map it in EVA_LINES (src/audio/voice.js) or list it in SILENT_EVA`);
  for (const house of PLAYABLE_HOUSES) {
    const set = setOf(house);
    for (const key of keys) {
      if (lineForEvent({ type: 'eva', house, key }, house) === null && !['enemyUnitDestroyed', 'enemyStructureDestroyed'].includes(key)) continue;   // silent by choice
      const variants = key === 'enemyUnitDestroyed' || key === 'enemyStructureDestroyed' ? [...NAMED_HOUSES, 'mercenary'] : [null];
      for (const foe of variants) {
        const id = lineForEvent({ type: 'eva', house, key, foe }, house);
        assert.ok(id && set.lines[id], `${house}: ${key}${foe ? ` (${foe})` : ''} → ${id}`);
      }
    }
  }
});

/** A set's words in lines.json, keyed as the manifest keys them: unit groups' lists become '<kind>.<n>'. */
const tableOf = (name, set) => (set.role === 'unit'
  ? Object.fromEntries(Object.entries(lines.unitVoices[set.group]).flatMap(([kind, texts]) => texts.map((t, i) => [`${kind}.${i + 1}`, t])))
  : lines[name === 'units' ? 'units' : 'announcer']);
const idOf = (set, key) => (set.role === 'unit' ? `unit.${set.group}.${key}` : key);

test('every line the game can ask for exists in every set, and every file exists and is small', () => {
  const wanted = new Set([...ACK_LINES, ...SELECT_ACKS, 'radarOn', 'radarOff', 'wormsign', 'selectTarget', 'missileLaunched', 'missileApproaching',
    'yardDeployed', 'structureSold', 'repairing', 'unitRepaired', 'reinforcements', ...NAMED_HOUSES.concat('enemy').map((h) => namedLine('approaching', h)),
    ...unitLineIds()]);
  for (const house of PLAYABLE_HOUSES) {
    const out = new WebVoiceOutput(null, house, { fetchFn: null });   // the lines a battle of this house can say
    out.useManifest(manifest);
    for (const id of wanted) assert.ok(out.lines[id], `${house}: ${id}`);
    assert.ok(out.lines[`weaponReady.${house === 'atreides' ? 'fremen' : house === 'harkonnen' ? 'deathHand' : 'saboteur'}`]);
  }
  let bytes = 0;
  for (const [name, set] of Object.entries(manifest.sets)) {
    const table = tableOf(name, set);
    assert.deepEqual(Object.keys(set.lines).sort(), Object.keys(table).sort(), `${name} renders every line of lines.json`);
    for (const [key, line] of Object.entries(set.lines)) {
      const id = idOf(set, key);
      assert.ok(lineInfo(id), `${id} has a class`);
      assert.equal(line.text, table[key], `${name}/${key} text`);
      const file = new URL(`assets/voice/${line.file}`, root);
      assert.ok(existsSync(file), line.file);
      const size = statSync(file).size;
      assert.ok(size > 1000 && size < 20000, `${line.file}: ${size} bytes`);
      assert.ok(line.seconds > 0.3 && line.seconds < 3.5, `${line.file}: ${line.seconds} s`);
      bytes += size;
    }
  }
  assert.ok(bytes < 2.5e6, `${bytes} bytes of voices`);
});

test('each Great House has an announcer of its own', () => {
  const voices = PLAYABLE_HOUSES.map((h) => setOf(h).voice);
  assert.equal(new Set(voices).size, 3, voices.join(', '));
});

test('only the player\'s own news is voiced; a Death Hand warns only when it is headed for the base', () => {
  assert.equal(lineForEvent({ type: 'eva', house: 'harkonnen', key: 'constructionComplete' }, 'atreides'), null);
  assert.equal(lineForEvent({ type: 'eva', house: 'atreides', key: 'constructionComplete' }, 'atreides'), 'constructionComplete');
  assert.equal(lineForEvent({ type: 'eva', house: 'atreides', key: 'enemyUnitDestroyed', foe: 'harkonnen' }, 'atreides'), 'unitDestroyed.harkonnen');
  assert.equal(lineForEvent({ type: 'eva', house: 'atreides', key: 'enemyStructureDestroyed', foe: 'mercenary' }, 'atreides'), 'structureDestroyed.enemy');
  assert.equal(lineForEvent({ type: 'eva', house: 'harkonnen', key: 'weaponReady' }, 'harkonnen'), 'weaponReady.deathHand');
  assert.equal(lineForEvent({ type: 'eva', house: 'atreides', key: 'somethingNew' }, 'atreides'), null);
  const fired = { type: 'palaceFired', house: 'harkonnen', weapon: 'deathHand', x: 5, y: 5 };
  assert.equal(lineForEvent(fired, 'harkonnen'), 'missileLaunched');
  assert.equal(lineForEvent(fired, 'atreides', { nearBase: () => true }), 'missileApproaching');
  assert.equal(lineForEvent(fired, 'atreides', { nearBase: () => false }), null);
  assert.equal(lineForEvent({ type: 'palaceFired', house: 'atreides', weapon: 'fremen' }, 'atreides'), null);
  assert.equal(lineForEvent({ type: 'repairToggled', house: 'atreides', on: true }, 'atreides'), 'repairing');
  assert.equal(lineForEvent({ type: 'repairToggled', house: 'atreides', on: false }, 'atreides'), null);
  assert.equal(lineForEvent({ type: 'sold', house: 'atreides' }, 'atreides'), 'structureSold');
  assert.equal(lineForEvent({ type: 'fired', house: 'atreides' }, 'atreides'), null);
});

test('unit orders draw an acknowledgement; production and structure orders do not', () => {
  const pick = (type, r = 0) => ackForCommand({ type, ids: [1] }, () => r);
  assert.ok(ACK_LINES.includes(pick('move')));
  assert.notEqual(pick('move', 0), pick('move', 0.99));
  assert.ok(['affirmative', 'engaging', 'attacking'].includes(pick('attack', 0.5)));
  assert.ok(ACK_LINES.includes(pick('lift')), 'a Carryall sent to lift a vehicle answers as one sent somewhere');
  assert.equal(ackForCommand({ type: 'move', ids: [] }), null);
  for (const type of ['build', 'hold', 'place', 'sell', 'repair', 'palace', 'starportOrder', 'setRally', 'deploy', 'stop']) assert.equal(ackForCommand({ type, ids: [1] }), null, type);
  assert.equal(ackForCommand(null), null);
});

test('the queue says alerts before feedback before news before acknowledgements, oldest first among equals', () => {
  const q = new VoiceQueue(8);
  q.push('reporting', 0);
  q.push('constructionComplete', 0);
  q.push('unitReady', 0.1);
  q.push('building', 0.2);
  q.push('baseAttack', 0.3);
  const order = [];
  for (let item = q.peek(0.4); item; item = q.peek(0.4)) { order.push(item.id); q.take(item, 0.4); }
  assert.deepEqual(order, ['baseAttack', 'building', 'constructionComplete', 'unitReady', 'reporting']);
});

test('the queue drops stale lines, a line already waiting, and a line said moments ago', () => {
  const q = new VoiceQueue();
  assert.equal(q.push('building', 0), true);
  assert.equal(q.push('building', 0.2), false, 'already waiting');
  assert.equal(q.peek(0 + lineInfo('building').maxAge + 0.01), null, 'feedback goes stale fast');
  assert.equal(q.push('constructionComplete', 10), true);
  q.take(q.peek(10), 10);
  assert.equal(q.push('constructionComplete', 10.5), false, 'cooldown');
  assert.equal(q.push('constructionComplete', 10 + lineInfo('constructionComplete').cooldown), true);
  assert.equal(q.push('unitDestroyed.harkonnen', 20), true);
  assert.equal(q.push('unitDestroyed.ordos', 20.1), false, 'one kill line waiting at a time');
  q.take(q.peek(20.2), 20.2);
  assert.equal(q.push('affirmative', 30), true);
  q.take(q.peek(30), 30);
  assert.equal(q.push('movingOut', 30.5), false, 'acknowledgements share one cooldown');
  assert.equal(q.push('nonsense', 30), false);
});

test('a full queue sheds its least urgent line, never a more urgent newcomer', () => {
  const q = new VoiceQueue(2);
  q.push('constructionComplete', 0);
  q.push('unitReady', 0);
  assert.equal(q.push('baseAttack', 0), true);
  assert.deepEqual(q.items.map((i) => i.id).sort(), ['baseAttack', 'constructionComplete']);
  assert.equal(q.push('affirmative', 0), false, 'an acknowledgement does not push out news');
});

function fakeOutput({ live = true, lines = null, decoded = true } = {}) {
  const out = {
    live, played: [], loads: [], stopped: 0, ready: new Set(), missing: new Set(),
    has: (id) => (lines ? lines.includes(id) : !!lineInfo(id)),
    status: (id) => (out.missing.has(id) ? 'missing' : decoded || out.ready.has(id) ? 'ready' : 'loading'),
    load: (id) => { out.loads.push(id); },
    play: (id, gain) => { out.played.push([id, gain]); return 1; },
    stop: () => { out.stopped++; },
  };
  return out;
}

test('the player speaks one line at a time with a gap, most urgent first', () => {
  const out = fakeOutput();
  const p = new VoicePlayer({ output: out, volume: 0.5 });
  p.say('constructionComplete', 0);
  p.say('baseAttack', 0);
  p.update(0);
  assert.deepEqual(out.played, [], 'the interface chirps first');
  p.update(LEAD);
  assert.deepEqual(out.played, [['baseAttack', 0.5 * VOICE_LEVEL]]);
  assert.equal(p.speaking, true);
  p.update(LEAD + 1);
  assert.equal(out.played.length, 1, 'still speaking');
  p.update(LEAD + 1 + GAP + 0.01);
  assert.deepEqual(out.played.map(([id]) => id), ['baseAttack', 'constructionComplete']);
});

test('nothing queues while the audio is locked or muted, or with the voice volume off', () => {
  const out = fakeOutput({ live: false });
  const p = new VoicePlayer({ output: out });
  assert.equal(p.say('constructionComplete', 0), false);
  out.live = true;
  p.setVolume(0);
  assert.equal(p.say('constructionComplete', 0), false);
  p.setVolume(1);
  assert.equal(p.say('constructionComplete', 0), true);
  out.live = false;
  p.update(0);
  out.live = true;
  p.update(0.1);
  assert.deepEqual(out.played, [], 'muting clears what was waiting');
});

test('a line waits for its decode while fresh; a missing file is skipped', () => {
  const out = fakeOutput({ decoded: false });
  const p = new VoicePlayer({ output: out });
  p.say('unitReady', 0);
  p.update(0.05);
  assert.deepEqual(out.played, []);
  assert.ok(out.loads.includes('unitReady'));
  out.ready.add('unitReady');
  p.update(0.2);
  assert.deepEqual(out.played.map(([id]) => id), ['unitReady']);
  p.say('lowPower', 5);
  p.say('constructionComplete', 5);
  out.missing.add('lowPower');
  out.ready.add('constructionComplete');
  p.update(5.2);
  p.update(5.21);
  assert.deepEqual(out.played.map(([id]) => id), ['unitReady', 'constructionComplete']);
  assert.equal(new VoicePlayer({ output: fakeOutput({ lines: ['building'] }) }).say('unitReady', 0), false, 'a line the manifest lacks');
});

test('a line the pause held finishes before the next starts', () => {
  const out = fakeOutput();
  const p = new VoicePlayer({ output: out });
  p.say('baseAttack', 0);
  p.update(LEAD);   // a one-second line starts …
  out.live = false;   // … and the battle is paused half-way through it (the audio context is held)
  p.update(10);
  out.live = true;
  p.held(29.5);   // back after 29.5 s: the rest of the line plays on from where it stopped
  p.say('constructionComplete', 30);
  p.update(30 + LEAD);
  assert.deepEqual(out.played.map(([id]) => id), ['baseAttack'], 'not over the half of the line still to come');
  p.update(LEAD + 1 + GAP + 29.5 + 0.01);
  assert.deepEqual(out.played.map(([id]) => id), ['baseAttack', 'constructionComplete']);
});

test('the battle\'s end cuts in over everything else', () => {
  const out = fakeOutput();
  const p = new VoicePlayer({ output: out });
  p.say('unitLost', 0);
  p.update(0.2);
  p.say('constructionComplete', 0.3);
  p.interrupt('missionAccomplished', 0.4);
  p.update(0.6);
  assert.equal(out.stopped, 1);
  assert.deepEqual(out.played.map(([id]) => id), ['unitLost', 'missionAccomplished']);
});

// A browser stand-in: fetch serves the manifest and files; the context decodes and plays.
function fakeBrowser({ missing = [] } = {}) {
  const fetched = [];
  const fetchFn = async (url) => {
    fetched.push(url);
    const path = new URL(url).pathname;
    if (path.endsWith('manifest.json')) return { ok: true, json: async () => manifest };
    if (missing.some((m) => path.endsWith(m))) return { ok: false, status: 404 };
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  class Node { constructor() { this.to = []; } connect(n) { this.to.push(n); return n; } }
  const started = [];
  const ctx = {
    createGain: () => Object.assign(new Node(), { gain: { value: 1 } }),
    createBufferSource: () => { const s = Object.assign(new Node(), { start: () => started.push(s), stop: () => {} }); return s; },
    decodeAudioData: (bytes, ok) => { const b = { duration: 1.2 }; ok?.(b); return Promise.resolve(b); },
  };
  const master = new Node();
  const sound = { ctx, master, running: true, muted: false };
  return { fetchFn, fetched, sound, started, master };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

test('the browser output reads the manifest, decodes a line on demand and plays it into the master bus', async () => {
  const b = fakeBrowser();
  const out = new WebVoiceOutput(b.sound, 'ordos', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn });
  assert.equal(out.live, false, 'no manifest yet');
  await out.ready;
  assert.equal(out.live, true);
  assert.ok(out.has('constructionComplete') && out.has('reporting'));
  assert.equal(out.status('constructionComplete'), 'loading');
  await out.load('constructionComplete');
  assert.ok(b.fetched.some((u) => u.endsWith(`/assets/voice/${manifest.sets[manifest.houses.ordos].lines.constructionComplete.file}`)));
  assert.equal(out.status('constructionComplete'), 'ready');
  assert.equal(out.play('constructionComplete', 0.6), 1.2);
  assert.equal(b.started.length, 1);
  assert.equal(out.bus.gain.value, 0.6);
  assert.ok(out.bus.to.includes(b.master), 'through the engine\'s master gain, so M and the master volume apply');
  b.sound.muted = true;
  assert.equal(out.live, false);
});

test('the browser output marks an unreadable line missing and survives without fetch or a manifest', async () => {
  const b = fakeBrowser({ missing: ['/unitReady.ogg'] });
  const out = new WebVoiceOutput(b.sound, 'atreides', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn });
  await out.ready;
  await out.load('unitReady');
  assert.equal(out.status('unitReady'), 'missing');
  assert.equal(out.play('unitReady', 1), 0);
  const none = new WebVoiceOutput(b.sound, 'atreides', { fetchFn: null });
  assert.equal(none.live, false);
  assert.equal(none.load('unitReady'), null);
  const broken = new WebVoiceOutput(b.sound, 'atreides', { base: 'http://x/', fetchFn: async () => { throw new Error('offline'); } });
  await broken.ready;
  await settle();
  assert.equal(broken.live, false);
});

test('a line cut short lets the battle back up: the battle ending while muted, or the voices turned off mid-line', async () => {
  const b = fakeBrowser(), ducks = [];
  b.sound.duck = (on) => ducks.push(on);
  const out = new WebVoiceOutput(b.sound, 'atreides', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn });
  await out.ready;
  await out.load('unitLost');
  const p = new VoicePlayer({ output: out });
  p.say('unitLost', 0);
  p.update(LEAD);
  assert.deepEqual(ducks, [true], 'the effects dip under the line');
  b.sound.muted = true;   // M, half-way through the line; then the battle ends
  p.interrupt('missionFailed', LEAD + 0.5);
  b.started[0].onended?.();   // a stopped source still ends, after the cut
  assert.deepEqual(ducks, [true, false], 'nothing new can be said, and the effects come back up');
  b.sound.muted = false;
  p.say('unitLost', 10);
  p.update(10 + LEAD);
  assert.equal(p.speaking, true);
  p.setVolume(0);   // Options → Voices: Off, half-way through the line
  assert.deepEqual(ducks, [true, false, true, false], 'the line stops, and the battle is not left dipped under a silent line');
  assert.equal(p.speaking, false);
});

test('the voice waits out the error buzz before it speaks; other lines follow the chirp sooner', () => {
  assert.ok(lineInfo('insufficientFunds').lead >= 0.3 - 0.07, 'the buzz lasts 0.31 s and speech starts ~0.06 s into a line');
  for (const id of ['cannotPlace', 'unableToComply', 'cannotDeploy', 'soldOut', 'frigateFull', 'notReady']) assert.equal(lineInfo(id).lead, lineInfo('insufficientFunds').lead, id);
  assert.equal(lineInfo('constructionComplete').lead, LEAD);
  assert.equal(lineInfo('affirmative').lead, 0, 'acknowledgements come at once');
  const out = fakeOutput();
  const p = new VoicePlayer({ output: out });
  p.say('insufficientFunds', 0);
  p.update(LEAD + 0.01);
  assert.deepEqual(out.played, [], 'still buzzing');
  p.update(lineInfo('insufficientFunds').lead);
  assert.deepEqual(out.played.map(([id]) => id), ['insufficientFunds']);
});

test('a Carryall sent to lift a unit answers like any unit given an order', () => {
  const ack = ackForCommand({ type: 'lift', ids: [7], targetId: 3 }, () => 0);   // right-click on a unit with a Carryall selected
  assert.ok(ACK_LINES.includes(ack), String(ack));
});

test('the Voices option may be turned off; the master volume may not', () => {
  assert.equal(DEFAULTS.voiceVolume, 0.8);
  assert.equal(sanitize({ voiceVolume: '0' }).voiceVolume, 0);
  assert.equal(sanitize({ voiceVolume: 0.35 }).voiceVolume, 0.35);
  assert.equal(sanitize({ voiceVolume: -1 }).voiceVolume, DEFAULTS.voiceVolume);
  for (const junk of [null, '', ' ', false, []]) assert.equal(sanitize({ voiceVolume: junk }).voiceVolume, DEFAULTS.voiceVolume, `${JSON.stringify(junk)} is not 0`);
  assert.equal(sanitize({ volume: 0 }).volume, DEFAULTS.volume);
  const row = OPTION_ROWS.find((r) => r.key === 'voiceVolume');
  assert.deepEqual([row.format(0), row.format(0.5)], ['Off', '50%']);
});

// ——— unit voices (src/data/unit-voices.js) ———

test('a unit\'s order reply is not lost to the reply to its selection: it takes the waiting one\'s place, or cuts in', () => {
  const q = new VoiceQueue();
  assert.equal(q.push('unit.tanker.select.1', 0), true);
  assert.equal(q.push('unit.tanker.move.2', 0.1), true, 'not the same class as the selection reply');
  assert.deepEqual(q.items.map((i) => i.id), ['unit.tanker.move.2'], 'the order\'s answer replaces the selection\'s still waiting');
  assert.equal(q.push('unit.tanker.select.2', 0.2), false, 'nor does a new selection push the order\'s answer out');
  const out = fakeOutput();
  const p = new VoicePlayer({ output: out });
  p.say('unit.scout.select.1', 0);
  p.update(0);
  assert.equal(p.current, 'unit.scout.select.1');
  p.say('unit.scout.move.1', 0.3);
  p.update(0.3);
  assert.equal(out.stopped, 1, 'the selection reply is cut short …');
  assert.deepEqual(out.played.map(([id]) => id), ['unit.scout.select.1', 'unit.scout.move.1'], '… by the order\'s, at once');
  p.say('unit.scout.attack.1', 0.5);
  p.update(0.5);
  assert.equal(out.played.length, 2, 'an order\'s reply is not cut by another');
});

test('a unit reply never cuts the announcer, and waits its turn behind it only while fresh', () => {
  const out = fakeOutput();
  const p = new VoicePlayer({ output: out });
  p.say('baseAttack', 0);
  p.update(LEAD);
  p.say('unit.grunt.move.1', LEAD + 0.1);
  p.update(LEAD + 0.2);
  assert.equal(out.stopped, 0);
  assert.deepEqual(out.played.map(([id]) => id), ['baseAttack']);
  p.update(LEAD + 1 + GAP);
  assert.deepEqual(out.played.map(([id]) => id), ['baseAttack', 'unit.grunt.move.1'], 'still fresh after a one-second line');
  assert.ok(lineInfo('unit.grunt.select.1').maxAge < lineInfo('unit.grunt.move.1').maxAge, 'an order\'s answer may wait a little longer than a selection\'s');
});

test('the manifest\'s unit groups are spoken under their unit ids for every house; the old shared replies stay', () => {
  const m = {
    version: 1, houses: { atreides: 'atreides' },
    sets: {
      atreides: { voice: 'af_heart', role: 'announcer', lines: { building: { file: 'atreides/building.ogg' } } },
      units: { voice: 'am_michael', role: 'units', lines: { reporting: { file: 'units/reporting.ogg' } } },
      tanker: { voice: 'bm_fable', role: 'unit', group: 'tanker', lines: { 'move.1': { file: 'tanker/move.1.ogg' } } },
    },
  };
  const out = new WebVoiceOutput(null, 'atreides', { fetchFn: null });
  out.useManifest(m);
  assert.deepEqual(Object.keys(out.lines).sort(), ['building', 'reporting', 'unit.tanker.move.1']);
  assert.equal(out.lines['unit.tanker.move.1'].file, 'tanker/move.1.ogg');
});

test('reinforcements arriving are announced in the house\'s voice (the missions\' C9 line)', () => {
  assert.equal(lineForEvent({ type: 'eva', house: 'ordos', key: 'reinforcements', text: 'Reinforcements have arrived.', x: 3, y: 4 }, 'ordos'), 'reinforcements');
  assert.equal(lineForEvent({ type: 'eva', house: 'ordos', key: 'reinforcements' }, 'atreides'), null);
  assert.ok(EVA_KEYS.includes('reinforcements'));
  assert.equal(lineInfo('reinforcements').cls, 'news');
  assert.equal(lines.announcer.reinforcements, 'Reinforcements have arrived.');
  for (const house of PLAYABLE_HOUSES) assert.equal(setOf(house).lines.reinforcements?.text, 'Reinforcements have arrived.', house);
});

test('the browser output fetches lines it is told to expect, one after another, once', async () => {
  const b = fakeBrowser();
  const out = new WebVoiceOutput(b.sound, 'atreides', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn });
  await out.ready;
  const ids = ['unitReady', 'constructionComplete', 'nonsense'];
  await out.prefetch(ids);
  await out.prefetch(ids);
  assert.equal(b.fetched.filter((u) => u.endsWith('/unitReady.ogg')).length, 1);
  assert.equal(out.status('unitReady'), 'ready');
  assert.equal(out.status('constructionComplete'), 'ready');
  await new WebVoiceOutput(null, 'atreides', { fetchFn: null }).prefetch(ids);   // no audio, no manifest: nothing, and no throw
});
