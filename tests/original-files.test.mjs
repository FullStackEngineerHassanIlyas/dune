// The player's own Dune II files (spec §6 Original files): the PAK and VOC readers, what the clips mean to
// the game, and the browser storage. Every archive and clip here is made up inside the test — no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readPak, PakError } from '../src/formats/pak.js';
import { readVoc, VocError, rateOf, toFloat, joinClips } from '../src/formats/voc.js';
import { LINE_WORDS, ACK_CLIPS, EFFECT_CLIPS, HOUSE_LETTER, ORIGINAL_LINES, resolveLine, resolveEffects, summarize, level, VOICE_LUFS, RATE } from '../src/formats/dune2-sounds.js';
import { RECIPES, render, loudness } from '../src/audio/synth.js';
import { ACK_LINES, lineInfo } from '../src/audio/voice.js';
import { PLAYABLE_HOUSES } from '../src/data/houses.js';
import * as files from '../src/core/user-files.js';
import { summaryText, reportText, formatSize } from '../src/ui/original-files.js';
import { fakeIndexedDB } from './fake-indexeddb.mjs';

// ——— builders ———

const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const u16 = (n) => [n & 255, (n >> 8) & 255], u24 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255], u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

/** A VOC file: blocks [[type, bytes]] after a correct header (version 0x010A). */
function voc(blocks, { version = 0x010a, checksum = (~version + 0x1234) & 0xffff, end = true } = {}) {
  const out = [...ascii('Creative Voice File'), 0x1a, ...u16(26), ...u16(version), ...u16(checksum)];
  for (const [type, body] of blocks) out.push(type, ...u24(body.length), ...body);
  if (end) out.push(0);
  return new Uint8Array(out);
}
/** A short made-up "word": a ramp of `n` samples around the centre. */
const word = (n = 40, from = 100) => Array.from({ length: n }, (_, i) => (from + i) & 255);
/** Half a second of made-up rumble: seeded noise around the centre. */
const rumble = (seed, n = 6000) => { const r = rng(seed); return Array.from({ length: n }, () => 128 + Math.round((r() - 0.5) * 90)); };
const sound = (samples, tc = 0xa6) => [1, [tc, 0, ...samples]];
const clip = (samples = word(), tc = 0xa6) => voc([sound(samples, tc)]);

/** A version-2 PAK archive of [[name, bytes]]. */
function pak(entries) {
  const index = entries.reduce((s, [name]) => s + 4 + name.length + 1, 0) + 4;
  const out = [];
  let at = index;
  for (const [name, data] of entries) { out.push(...u32(at), ...ascii(name), 0); at += data.length; }
  out.push(0, 0, 0, 0);
  for (const [, data] of entries) out.push(...data);
  return new Uint8Array(out);
}

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// ——— PAK ———

test('a PAK archive lists its files with their offsets and sizes, the last running to the end', () => {
  const a = new Uint8Array([1, 2, 3]), b = new Uint8Array([4, 5]), c = new Uint8Array([6, 7, 8, 9]);
  const bytes = pak([['AENEMY.VOC', a], ['README.TXT', b], ['ZAFFIRM.VOC', c]]);
  const p = readPak(bytes.buffer, 'ATRE.PAK');
  assert.deepEqual(p.entries.map((e) => [e.name, e.size]), [['AENEMY.VOC', 3], ['README.TXT', 2], ['ZAFFIRM.VOC', 4]]);
  assert.equal(p.entries[0].offset, 4 + 11 + 4 + 11 + 4 + 12 + 4);
  assert.deepEqual([...p.file('zaffirm.voc')], [6, 7, 8, 9], 'names are looked up whatever their case');
  assert.equal(p.file('NOPE.VOC'), null);
  assert.deepEqual([...readPak(bytes).file('README.TXT')], [4, 5], 'a Uint8Array reads the same as its buffer');
});

test('a damaged PAK archive is refused with a message saying what is wrong', () => {
  const good = pak([['A.VOC', new Uint8Array([1, 2, 3])], ['B.VOC', new Uint8Array([4])]]);
  const cases = [
    [new Uint8Array(0), /too short/],
    [new Uint8Array([0, 0, 0, 0]), /empty/],
    [good.slice(0, 12), /not terminated|runs into|past the end/],
    [(() => { const b = good.slice(); b.set(u32(9999), 0); return b; })(), /past the end/],
    [(() => { const b = good.slice(); b.set(u32(19), 10); return b; })(), /starts before/],
    [(() => { const b = good.slice(); b[5] = 7; return b; })(), /non-printable/],
    [(() => { const b = good.slice(); b.set([0x41, 0x41, 0x41, 0x41, 0x41, 0x41], 4); return b; })(), /not terminated|non-printable|runs into/],
    [new Uint8Array([8, 0, 0, 0, ...ascii('A.VOC'), 0, 0, 0, 0, 0, 1, 2]), /runs into the data/],
  ];
  for (const [bytes, message] of cases) assert.throws(() => readPak(bytes, 'X.PAK'), (e) => e instanceof PakError && message.test(e.message) && e.message.startsWith('X.PAK'), `${message}`);
  assert.throws(() => readPak('text'), PakError);
});

test('random bytes never get past the PAK reader as anything but a PakError or a consistent index', () => {
  const r = rng(7);
  for (let k = 0; k < 400; k++) {
    const b = Uint8Array.from({ length: Math.floor(r() * 120) }, () => (r() < 0.3 ? 0 : Math.floor(r() * 256)));
    try {
      const p = readPak(b);
      for (const e of p.entries) assert.ok(e.offset + e.size <= b.length && e.size >= 0);
    } catch (e) {
      assert.ok(e instanceof PakError, `${e}`);
    }
  }
});

// ——— VOC ———

test('a VOC clip gives 8-bit samples at the rate of its time constant, the standard rates exact', () => {
  assert.equal(rateOf(0xa6), 11025);
  assert.equal(rateOf(0xa5), 11025);
  assert.equal(rateOf(0xd3), 22050);
  assert.equal(rateOf(156), 10000);
  const v = readVoc(clip([10, 20, 30], 0xa6));
  assert.equal(v.rate, 11025);
  assert.deepEqual([...v.pcm], [10, 20, 30]);
  assert.deepEqual(v.warnings, []);
});

test('continuation and silence blocks run on; markers and text are skipped; nothing after the terminator is read', () => {
  const v = readVoc(voc([sound([1, 2], 0xd3), [4, u16(7)], [5, [...ascii('hi'), 0]], [2, [3, 4]], [3, [...u16(2), 0xd3]], [2, [5]], [0, []], [1, [0xa6, 0, 99, 99]]], { end: false }));
  assert.equal(v.rate, 22050);
  assert.deepEqual([...v.pcm], [1, 2, 3, 4, 128, 128, 128, 5]);
});

test('the later VOC formats are read too: extended rates, new-format 16-bit stereo', () => {
  const ext = readVoc(voc([[8, [...u16(65536 - 256e6 / 22050 | 0), 0, 0]], [1, [0, 0, 7, 8]]]));
  assert.ok(Math.abs(ext.rate - 22050) < 5, `${ext.rate}`);
  assert.deepEqual([...ext.pcm], [7, 8]);
  const s16 = [...u16(0x4000), ...u16(0x4000), ...u16(0xc000), ...u16(0xc000)];   // two stereo frames: +half, -half
  const v9 = readVoc(voc([[9, [...u32(16000), 16, 2, ...u16(4), ...u32(0), ...s16]]]));
  assert.equal(v9.rate, 16000);
  assert.deepEqual([...v9.pcm], [192, 64]);
});

test('a damaged VOC clip is refused with a message saying what is wrong', () => {
  const cases = [
    [new Uint8Array(10), /too short/],
    [(() => { const b = clip(); b[0] = 0x63; return b; })(), /not a Creative Voice/],
    [clip().slice(0, 34), /past the end/],
    [voc([[1, [0xa6, 4, 1, 2]]]), /codec 4.*not supported/],
    [voc([[2, [1, 2]]]), /no sound block before/],
    [voc([[9, [...u32(100), 8, 1, ...u16(0), ...u32(0), 1, 2]]]), /100 Hz.*not plausible/],
    [voc([]), /no sound/],
    [(() => { const b = clip(); b.set(u16(4000), 20); return b; })(), /header claims/],
  ];
  for (const [bytes, message] of cases) assert.throws(() => readVoc(bytes, 'HHARK.VOC'), (e) => e instanceof VocError && message.test(e.message) && e.message.startsWith('HHARK.VOC'), `${message}`);
  assert.deepEqual(readVoc(voc([sound([1])], { checksum: 0 })).warnings, ['header checksum does not match'], 'a wrong checksum alone is let through');
});

test('a VOC clip cut short at any byte, or with any byte changed, reads or fails cleanly', () => {
  const good = voc([sound(word(30)), [3, [...u16(5), 0xa6]], [2, word(10)]]);
  for (let n = 0; n < good.length; n++) {
    try { readVoc(good.slice(0, n)); } catch (e) { assert.ok(e instanceof VocError, `${e}`); }
  }
  const r = rng(3);
  for (let k = 0; k < 300; k++) {
    const b = good.slice();
    b[Math.floor(r() * b.length)] = Math.floor(r() * 256);
    try { const v = readVoc(b); assert.ok(v.pcm.length > 0 && v.rate >= 3000); } catch (e) { assert.ok(e instanceof VocError, `${e}`); }
  }
});

test('clips play back to back at one rate, resampled', () => {
  assert.deepEqual([...toFloat(new Uint8Array([128, 192, 64]), 1000)], [0, 0.5, -0.5]);
  assert.equal(toFloat(new Uint8Array(11025), 11025, 32000).length, 32000);
  const joined = joinClips([{ rate: 1000, pcm: new Uint8Array([192, 192]) }, { rate: 2000, pcm: new Uint8Array([64, 64, 64, 64]) }], 1000);
  assert.deepEqual([...joined], [0.5, 0.5, -0.5, -0.5]);
});

// ——— what the clips mean ———

const RESEARCH_WORDS = new Set(['CONST', 'DEPLOY', 'ENEMY', 'APPRCH', 'WARNING', 'WORMY', 'ATTACK', 'RADAR', 'ON', 'OFF', 'FRIGATE', 'ARRIVE', 'MISSILE', 'LAUNCH',
  'WIN', 'LOSE', 'HARK', 'ATRE', 'ORDOS', 'FREMEN', 'SARD', 'UNIT', 'STRUCT', 'DESTROY', 'HARVEST', '*']);

test('every original line maps to an announcer line of ours, in words of the original\'s file list', () => {
  for (const [id, words] of Object.entries(LINE_WORDS)) {
    assert.ok(lineInfo(id), `${id} is not a line of src/audio/voice.js`);
    for (const w of words) assert.ok(RESEARCH_WORDS.has(w), `${id}: ${w}`);
  }
  for (const id of ['constructionComplete', 'unitReady', 'harvesterDeployed', 'radarOn', 'radarOff', 'wormsign', 'frigateArrived', 'missileLaunched', 'baseAttack',
    'missionAccomplished', 'missionFailed', 'approaching.enemy', 'approaching.harkonnen', 'approaching.sardaukar', 'unitDestroyed.ordos', 'structureDestroyed.enemy']) {
    assert.ok(LINE_WORDS[id], `the original spoke ${id} (research §A.1)`);
  }
  assert.deepEqual(LINE_WORDS['approaching.harkonnen'], ['WARNING', 'HARK', 'UNIT', 'APPRCH']);
  assert.deepEqual(LINE_WORDS['approaching.sardaukar'], ['WARNING', 'SARD', 'APPRCH'], '"Warning, Sardaukar approaching": no "unit"');
  assert.deepEqual(LINE_WORDS.wormsign, ['WARNING', 'WORMY']);
});

test('every unit reply has its shared clip, and every effect stands in for a sound of ours at its level', () => {
  assert.deepEqual(Object.keys(ACK_CLIPS).sort(), [...ACK_LINES].sort());
  for (const name of Object.values(ACK_CLIPS)) assert.match(name, /^(AFFIRM|REPORT[123]|OVEROUT|MOVEOUT)$/);
  for (const [id, [names, lufs]] of Object.entries(EFFECT_CLIPS)) {
    assert.ok(RECIPES[id], `${id} is not a synthesized sound`);
    assert.ok(names.length && names.every((n) => /^[A-Z0-9]+$/.test(n)));
    const ours = loudness(render(id, 0));
    assert.ok(Math.abs(ours - lufs) < 3, `${id}: the table says ${lufs} LUFS, synth.js renders ${ours.toFixed(1)}: measure it again`);
  }
  for (const house of PLAYABLE_HOUSES) assert.ok(HOUSE_LETTER[house]);
});

test('a line is the house\'s own word clips; the replies are shared, with or without their Z', () => {
  const has = (set) => (n) => set.has(n);
  const a = new Set(['AATRE', 'AUNIT', 'ADEPLOY', 'ACONST', 'AWARNING', 'AHARK', 'AAPPRCH', 'ASARD', 'ADESTROY', 'ZAFFIRM', 'MOVEOUT', 'GREPORT1']);
  assert.deepEqual(resolveLine('unitReady', 'atreides', has(a)), ['AATRE', 'AUNIT', 'ADEPLOY'], '"Atreides unit deployed"');
  assert.deepEqual(resolveLine('approaching.harkonnen', 'atreides', has(a)), ['AWARNING', 'AHARK', 'AUNIT', 'AAPPRCH']);
  assert.deepEqual(resolveLine('unitDestroyed.sardaukar', 'atreides', has(a)), ['ASARD', 'ADESTROY']);
  assert.equal(resolveLine('unitReady', 'harkonnen', has(a)), null, 'the Harkonnen announcer is not among these clips');
  assert.equal(resolveLine('wormsign', 'atreides', has(a)), null, 'a word missing: the whole line keeps our voice');
  assert.equal(resolveLine('building', 'atreides', has(a)), null, 'the original never said it');
  assert.deepEqual(resolveLine('affirmative', 'ordos', has(a)), ['ZAFFIRM']);
  assert.deepEqual(resolveLine('movingOut', 'harkonnen', has(a)), ['MOVEOUT'], 'the 1.07 US data names a few replies without the Z');
  assert.deepEqual(resolveLine('reporting', 'atreides', has(a)), ['GREPORT1']);
  const o = new Set(['OFREMEN', 'OUNIT', 'ODEPLOY', 'MUNIT', 'MDEPLOY']);
  assert.deepEqual(resolveLine('unitReady', 'fremen', has(o)), ['OFREMEN', 'OUNIT', 'ODEPLOY'], 'the Fremen borrow the Ordos voice');
  assert.deepEqual(resolveLine('unitReady', 'mercenary', has(o)), ['MUNIT', 'MDEPLOY'], 'the Mercenaries\' "Unit deployed"');
  assert.deepEqual(resolveEffects(has(new Set(['EXSMALL', 'GUN', 'EXLARGE']))), { rifle: ['GUN'], explosionSmall: ['EXSMALL'], explosionLarge: ['EXLARGE'], explosionHuge: ['EXLARGE'] });
});

test('levels: an original line comes out at the voices\' loudness, never past the ceiling', () => {
  const quiet = Float32Array.from({ length: RATE }, (_, i) => 0.05 * Math.sin(i / 3));
  level(quiet, VOICE_LUFS);
  assert.ok(Math.abs(loudness(quiet) - VOICE_LUFS) < 1.5, `${loudness(quiet)}`);
  const loud = Float32Array.from({ length: RATE }, (_, i) => (i % 40 < 20 ? 1 : -1));
  level(loud, -5);
  assert.ok(Math.max(...loud.map(Math.abs)) <= 0.97 + 1e-6);
  const hiss = new Float32Array(RATE).fill(1e-5);
  level(hiss, VOICE_LUFS);
  assert.ok(Math.max(...hiss) < 1e-3, 'a silent clip is not blown up into noise');
});

// ——— storage ———

/** The made-up files of a player's copy: an announcer archive, the shared one, and some that are not. */
function playerFiles() {
  const words = new Set(Object.values(LINE_WORDS).flat().filter((w) => w !== '*'));
  words.add('ATRE');
  const atre = pak([...words].map((w) => [`A${w}.VOC`, clip(word(30 + w.length))]));
  const shared = pak([
    ...['AFFIRM', 'REPORT1', 'REPORT2', 'REPORT3', 'OVEROUT'].map((w) => [`Z${w}.VOC`, clip()]),
    ['MOVEOUT.VOC', clip()],
    ['EXSMALL.VOC', clip(rumble(1))], ['GUN.VOC', clip(rumble(2, 2000))],
    ['BROKEN.VOC', clip().slice(0, 30)],
  ]);
  return [
    { name: 'ATRE.PAK', data: atre.buffer }, { name: 'VOC.PAK', data: shared.buffer },
    { name: 'SCENARIO.PAK', data: pak([['SCENA001.INI', new Uint8Array(ascii('[BASIC]'))]]).buffer },
    { name: 'HARK.PAK', data: new Uint8Array([1, 2, 3, 4, 5, 6]).buffer },
    { name: 'notes.txt', data: new Uint8Array(ascii('hello')).buffer },
  ];
}

function freshStore(options) {
  delete globalThis.__duneUserFiles;
  const idb = options === null ? null : fakeIndexedDB(options);
  files.openStorage(idb);
  return idb;
}

test('reading the player\'s files keeps every clip, reports each file, and switches the original sounds on', async () => {
  const idb = freshStore();
  const result = await files.importFiles(playerFiles());
  const byName = Object.fromEntries(result.files.map((f) => [f.name, f]));
  assert.ok(byName['ATRE.PAK'].clips >= 25 && !byName['ATRE.PAK'].error);
  assert.equal(byName['VOC.PAK'].clips, 8);
  assert.equal(byName['VOC.PAK'].skipped, 1);
  assert.match(byName['VOC.PAK'].note, /BROKEN\.VOC/);
  assert.equal(byName['SCENARIO.PAK'].note, 'no sound clips in it');
  assert.match(byName['HARK.PAK'].error, /HARK\.PAK/);
  assert.match(byName['notes.txt'].error, /not a \.PAK or \.VOC/);
  assert.equal(result.added, byName['ATRE.PAK'].clips + 8);
  assert.equal(await files.storageKind(), 'indexeddb');
  assert.equal(await files.usingOriginals(), true);
  const s = await files.clipSummary();
  assert.deepEqual(s.houses.atreides, { lines: Object.keys(LINE_WORDS).length, of: Object.keys(LINE_WORDS).length });
  assert.equal(s.houses.harkonnen.lines, 0);
  assert.deepEqual(s.acknowledgements, { lines: ACK_LINES.length, of: ACK_LINES.length });
  assert.deepEqual(s.effects, { sounds: 2, of: Object.keys(EFFECT_CLIPS).length });
  assert.deepEqual(s.sources, ['ATRE.PAK', 'VOC.PAK']);
  // a page loaded again finds them where they were
  files.openStorage(idb);
  const again = await files.originalVoices();
  assert.ok(again.get('ZAFFIRM').pcm instanceof Uint8Array && again.get('ZAFFIRM').rate === 11025);
  assert.ok(again.has('AWORMY'));
});

test('the switch and the forget button: originals off give nothing, forgetting keeps the music', async () => {
  freshStore();
  await files.importFiles(playerFiles());
  await files.addTracks('menu', [{ name: 'theme.ogg', data: new Uint8Array([...ascii('OggS'), 0, 2, 0, 0]).buffer }]);
  const fx = await files.originalEffects();
  assert.deepEqual(Object.keys(fx).sort(), ['explosionSmall', 'rifle']);
  assert.ok(fx.rifle[0] instanceof Float32Array && fx.rifle[0].length > 0);
  assert.ok(Math.abs(loudness(fx.explosionSmall[0]) - EFFECT_CLIPS.explosionSmall[1]) < 1.5, 'at the level of the sound it replaces');
  await files.setUseOriginals(false);
  assert.equal(await files.originalVoices(), null);
  assert.equal(await files.originalEffects(), null);
  await files.setUseOriginals(true);
  assert.ok(await files.originalVoices());
  await files.clearClips();
  assert.equal((await files.clipSummary()).clips, 0);
  assert.equal(await files.usingOriginals(), false);
  assert.equal(await files.originalVoices(), null);
  assert.equal((await files.listTracks('menu')).length, 1);
});

test('who follows the store hears of every change to the clips or the switch', async () => {
  freshStore();
  const seen = [];
  const target = { originalsChanged: () => seen.push('changed') };
  files.follow(target);
  await files.importFiles(playerFiles());
  await files.setUseOriginals(false);
  await files.clearClips();
  assert.equal(seen.length, 3);
  assert.ok(files.followed().includes(target));
  await files.importFiles([{ name: 'DUNE.PAK', data: pak([['X.CPS', new Uint8Array(4)]]).buffer }]);
  assert.equal(seen.length, 3, 'nothing new kept: nobody is told');
});

test('without IndexedDB, or where it will not open, the files are kept in memory for the session', async () => {
  freshStore(null);
  assert.equal(await files.storageKind(), 'memory');
  await files.importFiles(playerFiles());
  assert.ok((await files.clipSummary()).clips > 0);
  files.openStorage(null);   // the battle's frame of the same page
  assert.ok((await files.originalVoices()).has('AATRE'), 'shared with the battle running in a frame');
  freshStore({ failOpen: true });
  assert.equal(await files.storageKind(), 'memory');
  assert.equal(await files.usingOriginals(), false);
});

test('playlists take MP3, OGG and WAV by their contents, and give them back as the music expects (contract 4)', async () => {
  freshStore();
  const mp3 = new Uint8Array([...ascii('ID3'), 4, 0, 0, 1, 2, 3]), raw = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 9]);
  const ogg = new Uint8Array([...ascii('OggS'), 0, 2, 7]), wav = new Uint8Array([...ascii('RIFF'), 1, 0, 0, 0, ...ascii('WAVE'), 5]);
  const r = await files.addTracks('peace', [
    { name: 'dunes.mp3', data: mp3.buffer }, { name: 'raw.mp3', data: raw.buffer }, { name: 'wind.ogg', data: ogg.buffer },
    { name: 'drums.wav', data: wav.buffer }, { name: 'cover.jpg', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer }, { name: 'empty.mp3', data: new ArrayBuffer(0) },
  ]);
  assert.equal(r.added, 4);
  assert.deepEqual(r.files.filter((f) => f.error).map((f) => f.name), ['cover.jpg', 'empty.mp3']);
  await files.addTracks('battle', [{ name: 'war.ogg', data: ogg.buffer }]);
  const peace = await files.playlistTracks('peace');
  assert.deepEqual(peace.map((t) => [t.name, t.type]), [['dunes.mp3', 'audio/mpeg'], ['raw.mp3', 'audio/mpeg'], ['wind.ogg', 'audio/ogg'], ['drums.wav', 'audio/wav']]);
  for (const t of peace) assert.ok(t.data instanceof ArrayBuffer && Object.keys(t).sort().join() === 'data,name,type');
  assert.deepEqual([...new Uint8Array(peace[2].data)], [...ogg]);
  assert.deepEqual(await files.playlistTracks('menu'), []);
  assert.deepEqual(await files.playlistTracks('credits'), []);
  const listed = await files.listTracks('peace');
  assert.deepEqual(Object.keys(listed[0]).sort(), ['id', 'list', 'name', 'size', 'type'], 'listing does not read the music itself');
  await files.removeTrack(listed[1].id);
  assert.deepEqual((await files.playlistTracks('peace')).map((t) => t.name), ['dunes.mp3', 'wind.ogg', 'drums.wav']);
  assert.equal((await files.listTracks()).length, 4);
  await assert.rejects(files.addTracks('credits', []), /no playlist/);
});

test('a full browser says so instead of failing silently', async () => {
  freshStore({ quota: 40 });
  const r = await files.addTracks('battle', [{ name: 'long.wav', data: new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE'), ...new Array(100).fill(1)]).buffer }]);
  assert.equal(r.added, 0);
  assert.match(r.files[0].error, /not enough storage space/);
  assert.deepEqual(await files.listTracks('battle'), []);
});

test('the page puts what was found and what was read into words', () => {
  const s = { clips: 214, sources: ['ATRE.PAK', 'VOC.PAK'], houses: { atreides: { lines: 32, of: 32 }, harkonnen: { lines: 0, of: 32 }, ordos: { lines: 5, of: 32 } },
    acknowledgements: { lines: 9, of: 9 }, effects: { sounds: 12, of: 16 } };
  const t = summaryText(s);
  assert.deepEqual(t.houses.map((x) => [x.text, x.state]), [['Atreides 32/32', 'full'], ['Harkonnen —', 'none'], ['Ordos 5/32', 'part']]);
  assert.equal(t.replies, '9 of 9');
  assert.equal(t.from, '214 clips from ATRE.PAK, VOC.PAK');
  assert.equal(summaryText({ ...s, clips: 0, sources: [] }).from, 'Nothing yet.');
  const lines = reportText({ files: [{ name: 'A.PAK', clips: 1, skipped: 0 }, { name: 'B.PAK', clips: 3, skipped: 2, note: 'X.VOC: no sound in it' }, { name: 'C.PAK', clips: 0, skipped: 0, note: 'no sound clips in it' }, { name: 'D', error: 'not a .PAK or .VOC file' }] });
  assert.deepEqual(lines, [
    { text: 'A.PAK: 1 sound clip', bad: false }, { text: 'B.PAK: 3 sound clips; 2 damaged clips skipped — X.VOC: no sound in it', bad: false },
    { text: 'C.PAK: no sound clips in it', bad: false }, { text: 'D: not a .PAK or .VOC file', bad: true },
  ]);
  assert.equal(formatSize(1_234_567), '1.2 MB');
  assert.equal(formatSize(640_000), '640 KB');
  assert.equal(formatSize(12), '1 KB');
});

test('every line the originals can voice is listed once', () => {
  assert.equal(new Set(ORIGINAL_LINES).size, ORIGINAL_LINES.length);
  assert.deepEqual(summarize(new Set()).houses.ordos, { lines: 0, of: Object.keys(LINE_WORDS).length });
});
