// The shared announcer (Options → Announcer): by default one deep voice speaks for every house, as the Mega
// Drive release had one announcer (credited to Frank Klepacki, the PC's Harkonnen voice); "Each house" brings
// back the three house announcers, as on the PC; the player's own original clips still win over either.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { WebVoiceOutput, announcerSet, savedAnnouncer, lineForEvent } from '../src/audio/voice.js';
import { PLAYABLE_HOUSES } from '../src/data/houses.js';
import { DEFAULTS, sanitize, loadSettings } from '../src/core/settings.js';
import { readParams } from '../src/core/params.js';
import { OPTION_ROWS, changeSetting } from '../src/ui/options.js';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('assets/voice/manifest.json', root)));
const lines = JSON.parse(readFileSync(new URL('scripts/voices/lines.json', root)));
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const settle = () => new Promise((r) => setTimeout(r, 0));

function fakeBrowser() {
  const fetched = [], made = [];
  const fetchFn = async (url) => {
    fetched.push(url);
    if (url.endsWith('manifest.json')) return { ok: true, json: async () => manifest };
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  class Node { constructor() { this.to = []; } connect(n) { this.to.push(n); return n; } }
  const ctx = {
    createGain: () => Object.assign(new Node(), { gain: { value: 1 } }),
    createBufferSource: () => Object.assign(new Node(), { start() {}, stop() {} }),
    decodeAudioData: (bytes, ok) => { const b = { duration: 1.2 }; ok?.(b); return Promise.resolve(b); },
    createBuffer: (channels, length, sampleRate) => { const b = { length, sampleRate, duration: length / sampleRate, copyToChannel() {} }; made.push(b); return b; },
  };
  return { fetchFn, fetched, made, sound: { ctx, master: new Node(), running: true, muted: false } };
}
const at = (fetched) => fetched.filter((u) => !u.endsWith('manifest.json')).map((u) => u.split('/assets/voice/')[1]);

test('the Announcer setting: one voice by default, each house as the option; saved, and the URL overrides it', () => {
  assert.equal(DEFAULTS.announcer, 'one');
  assert.equal(sanitize({}).announcer, 'one');
  assert.equal(sanitize({ announcer: 'house' }).announcer, 'house');
  for (const bad of ['harkonnen', 'ONE', '', null, 1, true]) assert.equal(sanitize({ announcer: bad }).announcer, 'one', String(bad));
  const store = memory();
  const settings = loadSettings(null, store);
  changeSetting(settings, 'announcer', 'house', store);
  assert.equal(loadSettings(null, store).announcer, 'house');
  assert.equal(loadSettings(readParams('?announcer=one'), store).announcer, 'one');
  assert.equal(savedAnnouncer(), 'one', 'no storage, no URL (node): the default');
});

test('Options has an Announcer row beside the voices: "One voice (original)" first, "Each house", each explained', () => {
  const keys = OPTION_ROWS.map((r) => r.key);
  const row = OPTION_ROWS.find((r) => r.key === 'announcer');
  assert.ok(row, 'an Announcer row');
  assert.equal(row.label, 'Announcer');
  assert.deepEqual(row.choices, [['one', 'One voice (original)'], ['house', 'Each house']]);
  assert.match(row.notes.one, /every house/);
  assert.match(row.notes.house, /own/);
  assert.equal(keys.indexOf('voiceVolume'), keys.indexOf('announcer') + 1, 'right above Voices');
});

test('the manifest has one shared announcer set: every announcer line, in one deep male voice, small files', () => {
  assert.equal(manifest.shared, 'announcer');
  const set = manifest.sets[manifest.shared];
  assert.equal(set.role, 'announcer');
  const voices = set.voice.split('+').map((v) => v.split('*')[0]);
  for (const v of voices) assert.match(v, /^[ab]m_/, `${v}: a male Kokoro voice`);
  assert.equal(Object.keys(lines.announcer).length, 63, '62 announcements and "Reinforcements have arrived."');
  assert.deepEqual(Object.keys(set.lines).sort(), Object.keys(lines.announcer).sort());
  for (const [key, line] of Object.entries(set.lines)) {
    assert.equal(line.text, lines.announcer[key], key);
    assert.equal(line.file, `announcer/${key}.ogg`);
    const size = statSync(new URL(`assets/voice/${line.file}`, root)).size;
    assert.ok(size > 1000 && size < 20000, `${line.file}: ${size} bytes`);
    assert.ok(line.seconds > 0.5 && line.seconds < 3.5, `${line.file}: ${line.seconds} s`);
  }
  for (const house of PLAYABLE_HOUSES) assert.ok(manifest.sets[manifest.houses[house]], `${house}'s own set stays for "Each house"`);
});

test('every house hears the shared set by default and its own set under "Each house"; the units\' voices are the same either way', () => {
  for (const house of PLAYABLE_HOUSES) {
    assert.equal(announcerSet(manifest, house), 'announcer', house);
    assert.equal(announcerSet(manifest, house, 'one'), 'announcer', house);
    assert.equal(announcerSet(manifest, house, 'house'), manifest.houses[house], house);
    const one = new WebVoiceOutput(null, house, { fetchFn: null });
    one.useManifest(manifest);
    const own = new WebVoiceOutput(null, house, { fetchFn: null, announcer: 'house' });
    own.useManifest(manifest);
    for (const id of ['constructionComplete', 'approaching.harkonnen', 'missionAccomplished', 'reinforcements', lineForEvent({ type: 'eva', house, key: 'weaponReady' }, house)]) {
      assert.equal(one.lines[id].file, `announcer/${id}.ogg`, `${house}: ${id}`);
      assert.equal(own.lines[id].file, `${manifest.houses[house]}/${id}.ogg`, `${house}: ${id}`);
    }
    for (const id of ['unit.tanker.move.1', 'reporting']) assert.equal(one.lines[id].file, own.lines[id].file, id);
  }
});

test('a set that is not there falls back: no shared set, each house its own; no house set, the shared one', () => {
  const sets = { announcer: {}, atreides: {}, harkonnen: {} };
  const m = { houses: { atreides: 'atreides', harkonnen: 'harkonnen', ordos: 'ordos' }, shared: 'announcer', sets };
  assert.equal(announcerSet(m, 'ordos', 'house'), 'announcer', 'no Ordos set: the shared one');
  assert.equal(announcerSet({ ...m, shared: undefined }, 'harkonnen'), 'harkonnen', 'an older manifest: the house\'s own');
  assert.equal(announcerSet({ ...m, shared: 'gone' }, 'ordos'), 'atreides', 'neither: the Atreides set, as before');
  assert.equal(announcerSet({ sets: {} }, 'ordos'), null);
  assert.equal(announcerSet(null, 'ordos'), null);
});

test('the option changed mid-battle: the next line comes in the other voice, the old voice\'s lines are let go', async () => {
  const b = fakeBrowser();
  const out = new WebVoiceOutput(b.sound, 'ordos', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: null });
  await out.ready;
  assert.equal(out.announcer, 'one');
  await out.load('constructionComplete');
  assert.equal(out.status('constructionComplete'), 'ready');
  out.setAnnouncer('house');
  assert.equal(out.status('constructionComplete'), 'loading', 'decoded in the shared voice: let go');
  await out.load('constructionComplete');
  out.setAnnouncer('house');   // the same again: nothing changes
  assert.equal(out.status('constructionComplete'), 'ready');
  assert.deepEqual(at(b.fetched), ['announcer/constructionComplete.ogg', 'ordos/constructionComplete.ogg']);
  const pending = out.load('unitReady');   // a decode for the old voice still on its way is not kept
  out.setAnnouncer('one');
  await pending;
  assert.equal(out.status('unitReady'), 'loading');
  const early = new WebVoiceOutput(null, 'atreides', { fetchFn: null, announcer: 'house' });
  early.setAnnouncer('one');   // before the manifest: just remembered
  early.useManifest(manifest);
  assert.equal(early.lines.unitReady.file, 'announcer/unitReady.ogg');
  await settle();
});

test('with the player\'s original clips, the original lines still win whichever announcer is chosen', async () => {
  const words = ['HCONST', 'HHARK', 'HUNIT', 'HDEPLOY', 'ZAFFIRM'];
  const m = new Map(words.map((n, i) => [n, { rate: 11025, pcm: Uint8Array.from({ length: 1000 + 10 * i }, (_, k) => 128 + Math.round(40 * Math.sin(k / 4))) }]));
  for (const announcer of ['one', 'house']) {
    const b = fakeBrowser();
    const out = new WebVoiceOutput(b.sound, 'harkonnen', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: async () => m, announcer });
    await out.ready;
    assert.ok(out.original.unitReady, announcer);
    await out.load('unitReady');
    assert.equal(b.made.length, 1, `${announcer}: the original's own words`);
    assert.deepEqual(at(b.fetched), [], `${announcer}: no pre-rendered line fetched`);
    await out.load('wormsign');   // a line the clips cannot make keeps the pre-rendered voice the option chose
    assert.deepEqual(at(b.fetched), [`${announcer === 'one' ? 'announcer' : 'harkonnen'}/wormsign.ogg`]);
  }
});
