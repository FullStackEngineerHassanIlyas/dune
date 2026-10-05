// The shared announcer (Options → Announcer): by default one deep voice speaks for every house, as the Mega
// Drive release had one announcer (credited to Frank Klepacki, the PC's Harkonnen voice); "Each house" brings
// back the three house announcers, as on the PC; the player's own original clips still win over either.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { WebVoiceOutput, VoicePlayer, announcerSet, savedAnnouncer, lineForEvent, originalLine } from '../src/audio/voice.js';
import { GameView } from '../src/game/game-view.js';
import { voiceLine } from '../src/formats/dune2-sounds.js';
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
const voiceLength = (m, names) => voiceLine(names.map((n) => m.get(n))).length;
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

test('"One voice" with the player\'s original clips: every house hears the Harkonnen announcer (Klepacki\'s), naming its own house', async () => {
  const words = ['ACONST', 'AATRE', 'AUNIT', 'ADEPLOY', 'HCONST', 'HATRE', 'HUNIT', 'ZAFFIRM'];   // no HDEPLOY: that line keeps the house's own
  const m = new Map(words.map((n, i) => [n, { rate: 11025, pcm: Uint8Array.from({ length: 1000 + 10 * i }, (_, k) => 128 + Math.round(40 * Math.sin(k / 4))) }]));
  const has = (n) => m.has(n);
  assert.deepEqual(originalLine('constructionComplete', 'atreides', 'one', has), ['HCONST']);
  assert.deepEqual(originalLine('constructionComplete', 'atreides', 'house', has), ['ACONST']);
  assert.deepEqual(originalLine('unitReady', 'atreides', 'one', has), ['AATRE', 'AUNIT', 'ADEPLOY'], 'a word missing in that voice: the house\'s own, whole');
  assert.deepEqual(originalLine('unitReady', 'atreides', 'one', (n) => has(n) || n === 'HDEPLOY'), ['HATRE', 'HUNIT', 'HDEPLOY'], 'Atreides named, in the one voice');
  assert.deepEqual(originalLine('affirmative', 'ordos', 'one', has), ['ZAFFIRM'], 'the units\' replies are shared anyway');
  assert.equal(originalLine('constructionComplete', 'ordos', 'one', () => false), null);
  const b = fakeBrowser();
  const out = new WebVoiceOutput(b.sound, 'atreides', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: async () => m });
  await out.ready;
  assert.equal(out.announcer, 'one');
  assert.deepEqual(out.original.constructionComplete, ['HCONST']);
  await out.load('constructionComplete');
  assert.equal(out.status('constructionComplete'), 'ready');
  out.setAnnouncer('house');   // mid-battle: the house's own clips from the next line on
  assert.deepEqual(out.original.constructionComplete, ['ACONST']);
  assert.equal(out.status('constructionComplete'), 'loading');
  await out.load('constructionComplete');
  assert.deepEqual(b.made.map((x) => x.length).slice(-1), [voiceLength(m, ['ACONST'])]);
  assert.deepEqual(at(b.fetched), [], 'no pre-rendered line fetched');
});

test('switching the announcer lets go only of the lines whose voice changed, and decodes the commonest again at once', async () => {
  const b = fakeBrowser();
  const out = new WebVoiceOutput(b.sound, 'ordos', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: null });
  await out.ready;
  const unit = Object.keys(out.lines).find((id) => id.startsWith('unit.'));
  await out.warm();
  await out.load(unit);
  await out.load('wormsign');
  const fetched = b.fetched.length;
  out.setAnnouncer('house');
  assert.equal(out.status(unit), 'ready', 'a unit\'s reply is the same file in either mode: kept');
  assert.equal(out.status('wormsign'), 'loading', 'in the old voice: let go');
  for (let i = 0; i < 40; i++) await settle();   // the background decodes, one after another
  const again = at(b.fetched.slice(fetched));
  assert.ok(again.includes('ordos/constructionComplete.ogg') && again.includes('ordos/unitReady.ogg'), 'the commonest lines decoded again in the new voice');
  assert.ok(!again.includes('ordos/wormsign.ogg') && !again.some((f) => !f.startsWith('ordos/')), 'only those, only the new voice');
  assert.equal(out.status('constructionComplete'), 'ready');
});

test('Options → Announcer in the game menu applies at once, mid-battle, like the other live options', async () => {
  const b = fakeBrowser();
  const out = new WebVoiceOutput(b.sound, 'ordos', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: null, announcer: 'one' });
  await out.ready;
  const settings = { ...DEFAULTS }, store = memory();
  const view = Object.assign(Object.create(GameView.prototype), { settings, announcer: { player: new VoicePlayer({ output: out }) } });
  await out.load('constructionComplete');
  for (const [mode, set] of [['house', 'ordos'], ['one', 'announcer']]) {
    changeSetting(settings, 'announcer', mode, store);   // what the options panel does before it tells the game (GameMenu onSettings)
    view.applySetting('announcer', settings.announcer);
    assert.equal(out.announcer, mode, mode);
    assert.equal(out.status('constructionComplete'), 'loading', `${mode}: the line said in the old voice is let go`);
    await out.load('constructionComplete');
    assert.equal(at(b.fetched).at(-1), `${set}/constructionComplete.ogg`, `${mode}: the next one comes in the voice chosen`);
  }
});
