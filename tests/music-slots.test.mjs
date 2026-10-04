// The player's music slots and the Sega soundtrack's place in them (spec §6 Music, Original files; research §9):
// one list of slots for the store, the music and the page; the Sega table putting each track of a rip where the
// Sega game played it; the import of .vgm, .vgz and .zip (inflated here, kept plain with what their tag says) and
// of MP3/OGG/WAV; and the Music Test's words. The VGM files are made up (tests/music-fakes.mjs): no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOTS, SLOT_LABELS, SLOT_CHOICES, SEGA_TRACKS, autoSlots, segaTrack, isGerman, normaliseTitle } from '../src/audio/music/sega-tracks.js';
import * as files from '../src/core/user-files.js';
import { PLAYLISTS, BattleMusic, MenuMusic } from '../src/audio/music/music.js';
import { formatTime, slotValue, musicReportText, coverageText } from '../src/ui/original-music.js';
import { fakeIndexedDB } from './fake-indexeddb.mjs';
import { fakeVgmFormat, vgmFile, vgz, zip } from './music-fakes.mjs';

const format = async () => fakeVgmFormat;
function freshStore() {
  delete globalThis.__duneUserFiles;
  files.openStorage(fakeIndexedDB());
}

/** The 22 tracks of the Mega Drive rip as research §9 lists them (names, lengths and loops are facts of the files). */
const RIP = [
  ['01 - Opening.vgm', 'Opening', 73.5, 16.1], ['02 - Cyril\'s Council.vgm', 'Cyril\'s Council', 48.9, 48.2], ['03 - Ammon\'s Advice.vgm', 'Ammon\'s Advice', 24.3, 24.1],
  ['04 - Radnor\'s Scheme.vgm', 'Radnor\'s Scheme', 62, 60.8], ['05 - The Lego Tune.vgm', 'The Lego Tune', 132.5, 0], ['06 - Turbulence.vgm', 'Turbulence', 162.7, 0],
  ['07 - Spice Trip.vgm', 'Spice Trip', 166.5, 0], ['08 - Command Post.vgm', 'Command Post', 124.9, 0], ['09 - Trenching.vgm', 'Trenching', 122.2, 0],
  ['10 - Starport.vgm', 'Starport', 52.2, 48.2], ['11 - Evasive Action.vgm', 'Evasive Action', 42.1, 0], ['12 - Chosen Destiny.vgm', 'Chosen Destiny', 62.2, 56.5],
  ['13 - Conquest.vgm', 'Conquest', 24.1, 23.5], ['14 - Slitherin.vgm', 'Slitherin', 46.5, 41.3], ['15 - Harkonnen Rules.vgm', 'Harkonnen Rules', 42.5, 41.9],
  ['16 - Atredies Dirge.vgm', 'Atreides Dirge', 17.6, 17.2], ['17 - Ordos Dirge.vgm', 'Ordos Dirge', 18.1, 17.2], ['18 - Harkonnen Dirge.vgm', 'Harkonnen Dirge', 17.6, 17.2],
  ['19 - Finale.vgm', 'Finale', 65.3, 64.5], ['20 - Credit Roll.vgm', 'Credit Roll', 93.6, 93.6], ['21 - Opening (German).vgm', 'Opening (German)', 88, 19.2],
  ['22 - Credit Roll (German).vgm', 'Credit Roll (German)', 112.4, 112.4],
];
const ripZip = () => zip(RIP.map(([name, track, s, l]) => [name, vgmFile({ track, total: Math.round(s * 44100), loop: Math.round(l * 44100) })]));

test('one list of slots for the store, the music and the page, every one named', () => {
  assert.deepEqual(SLOTS, ['intro', 'menu', 'houseSelect', 'briefing-atreides', 'briefing-harkonnen', 'briefing-ordos', 'region', 'ingame', 'peace', 'battle',
    'victory-atreides', 'victory-harkonnen', 'victory-ordos', 'defeat-atreides', 'defeat-harkonnen', 'defeat-ordos', 'finale', 'credits']);
  assert.equal(files.PLAYLISTS, SLOTS);
  assert.equal(PLAYLISTS, SLOTS);
  for (const s of SLOTS) assert.ok(SLOT_LABELS[s], s);
  for (const [value] of SLOT_CHOICES) assert.ok(value.split(',').filter(Boolean).every((s) => SLOTS.includes(s)), value);
  assert.deepEqual(SLOT_CHOICES[1], ['intro,menu', 'Intro, then the title']);
});

test('the Sega table puts each track where the Sega game played it (research §9)', () => {
  const table = Object.fromEntries(SEGA_TRACKS.map((t) => [t.title, t.slots.join()]));
  assert.deepEqual(table, {
    Opening: 'intro,menu', 'Cyril\'s Council': 'briefing-atreides', 'Ammon\'s Advice': 'briefing-ordos', 'Radnor\'s Scheme': 'briefing-harkonnen',
    'The Lego Tune': 'ingame', Turbulence: 'ingame', 'Spice Trip': 'ingame', 'Command Post': 'ingame', Trenching: 'ingame',
    Starport: '', 'Evasive Action': 'region', 'Chosen Destiny': 'houseSelect',
    Conquest: 'victory-atreides', Slitherin: 'victory-ordos', 'Harkonnen Rules': 'victory-harkonnen',
    'Atreides Dirge': 'defeat-atreides', 'Ordos Dirge': 'defeat-ordos', 'Harkonnen Dirge': 'defeat-harkonnen', Finale: 'finale', 'Credit Roll': 'credits',
  });
  for (const t of SEGA_TRACKS) for (const s of t.slots) assert.ok(SLOTS.includes(s), s);
  // by the tag's title, or the file name when there is no tag; whatever the spelling around it
  assert.deepEqual(autoSlots('Opening'), ['intro', 'menu']);
  assert.deepEqual(autoSlots('', '16 - Atredies Dirge.vgz'), ['defeat-atreides'], 'the rip\'s file name misspells it');
  assert.deepEqual(autoSlots('Cyril’s Council'), ['briefing-atreides'], 'a curly apostrophe');
  assert.deepEqual(autoSlots('LEGO TUNE'), ['ingame']);
  assert.deepEqual(autoSlots('Unknown Song', '05 - The Lego Tune.mp3'), ['ingame'], 'an unknown tag: the file name');
  assert.deepEqual(autoSlots('Opening (German)'), [], 'the German edition\'s sung version goes nowhere');
  assert.deepEqual(autoSlots('Starport'), [], 'the tutorial\'s loop: no tutorial here');
  assert.deepEqual(autoSlots('Something else'), []);
  assert.equal(segaTrack('Credit Roll (German)'), null);
  assert.ok(isGerman('21 - Opening (German).vgm') && !isGerman('Germanic'));
  assert.equal(normaliseTitle('02 - Cyril\'s Council.vgm'), 'cyrils council');
});

test('a whole rip in its .zip: twenty tracks kept plain, each in its slots, the German two left out', async () => {
  freshStore();
  const seen = [];
  files.follow({ playlistsChanged: () => seen.push('playlists') });
  const r = await files.importMusic([{ name: 'dune_emu.zip', data: ripZip().buffer }], { format });
  assert.equal(r.added, 20);
  assert.equal(r.files.length, 22);
  assert.deepEqual(r.files.filter((f) => f.note?.startsWith('German')).map((f) => f.name), ['21 - Opening (German).vgm', '22 - Credit Roll (German).vgm']);
  assert.deepEqual(r.files.filter((f) => f.error), []);
  assert.deepEqual(seen, ['playlists'], 'the music is told once');
  const listed = await files.listTracks();
  assert.equal(listed.length, 20);
  const opening = listed.find((t) => t.meta.title === 'Opening');
  assert.deepEqual(opening.lists, ['intro', 'menu']);
  assert.equal(opening.type, files.VGM_TYPE);
  assert.ok(Math.abs(opening.meta.seconds - 73.5) < 0.01 && Math.abs(opening.meta.loopSeconds - 16.1) < 0.01);
  assert.deepEqual(opening.meta.chips, ['YM2612', 'SN76489']);
  assert.equal(opening.meta.game, 'Dune: The Battle for Arrakis');
  assert.equal(listed.find((t) => t.meta.title === 'Atreides Dirge').name, '16 - Atredies Dirge.vgm');
  assert.equal(listed.find((t) => t.meta.title === 'Trenching').meta.loopSeconds, 0, 'no loop');
  assert.deepEqual(listed.find((t) => t.meta.title === 'Starport').lists, [], 'kept, for the Music Test, but plays nowhere');
  const all = await files.playlists();
  assert.equal(all.ingame.length, 5);
  assert.equal(all.intro[0], all.menu[0], 'the Opening is one object in both slots');
  assert.equal(String.fromCharCode(...new Uint8Array(all.intro[0].data, 0, 4)), 'Vgm ', 'kept plain');
  for (const s of SLOTS.filter((n) => !['peace', 'battle'].includes(n))) assert.ok(all[s].length >= 1, `${s} has a track`);
  assert.equal((await files.playlistTracks('credits'))[0].meta.title, 'Credit Roll');
  const again = await files.importMusic([{ name: 'dune_emu.zip', data: ripZip().buffer }], { format });
  assert.equal(again.added, 0, 'the same files twice: kept once');
  assert.ok(again.files.filter((f) => !f.note?.startsWith('German')).every((f) => f.note === 'already here'));
});

test('each reader of the playlists reads only the slots it can play: a battle the in-game music and its house\'s ending', async () => {
  freshStore();
  await files.importMusic([{ name: 'dune_emu.zip', data: ripZip().buffer }], { format });
  const read = [], arrayBuffer = Blob.prototype.arrayBuffer;
  Blob.prototype.arrayBuffer = function () { read.push(this.size); return arrayBuffer.call(this); };
  try {
    const some = await files.playlists(['ingame', 'victory-atreides']);
    assert.deepEqual(Object.keys(some), ['ingame', 'victory-atreides']);
    assert.deepEqual([some.ingame.length, some['victory-atreides'][0].meta.title], [5, 'Conquest']);
    assert.equal(read.length, 6, 'the other fourteen tracks are not read');
  } finally { Blob.prototype.arrayBuffer = arrayBuffer; }
  const asked = [];
  const importer = async () => ({ playlists: async (names) => { asked.push(names); return files.playlists(names); } });
  const world = { time: 0 }, win = { setTimeout: () => 0 };
  const battle = new BattleMusic({ world, house: 'atreides', engine: { ctx: null, master: null }, settings: {}, win, importer });
  await battle.conductor.ready;
  assert.deepEqual(asked[0], ['ingame', 'peace', 'battle', 'victory-atreides', 'defeat-atreides']);
  assert.deepEqual(Object.keys(battle.conductor.lists).sort(), ['defeat-atreides', 'ingame', 'victory-atreides']);
  const menu = new MenuMusic({ settings: {}, win: { setTimeout: () => 0 }, importer });
  await menu.conductor.ready;
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(asked[1], ['intro', 'menu'], 'the menu reads the music it wants at once first');
  assert.deepEqual([...asked[1], ...asked[2]].sort(), SLOTS.filter((n) => !['ingame', 'peace', 'battle'].includes(n)).sort(), 'the menu: every slot but the in-game ones');
  assert.equal(menu.conductor.lists.ingame, undefined);
});

test('.vgz and .vgm one by one, MP3/OGG/WAV beside them; anything else is refused, and the slots can be changed', async () => {
  freshStore();
  const ogg = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0, 0, 0, 0, 0]);
  const r = await files.importMusic([
    { name: '19 - Finale.vgz', data: vgz(vgmFile({ track: 'Finale' })).buffer },
    { name: 'mine.vgm', data: vgmFile({ track: 'My Own Tune', loop: 0 }).buffer },
    { name: '13 - Conquest.ogg', data: ogg.buffer },
    { name: 'cover.jpg', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer },
    { name: 'psg-less.vgm', data: vgmFile({ track: 'Nothing', ym: 0, sn: 0 }).buffer },
    { name: 'broken.vgz', data: vgz(new Uint8Array([1, 2, 3, 4])).buffer },
  ], { format });
  assert.equal(r.added, 3);
  assert.deepEqual(r.files.map((f) => [f.name, f.slots?.join() ?? null, f.error]), [
    ['19 - Finale.vgz', 'finale', null], ['mine.vgm', '', null], ['13 - Conquest.ogg', 'victory-atreides', null],
    ['cover.jpg', '', 'not a music file (VGM, VGZ, ZIP, MP3, OGG or WAV)'], ['psg-less.vgm', '', 'no Mega Drive sound chips in it'], ['broken.vgz', '', 'not a VGM file'],
  ]);
  const listed = await files.listTracks();
  const finale = listed.find((t) => t.name === '19 - Finale.vgz');
  assert.equal(finale.size, vgmFile({ track: 'Finale' }).length, 'kept inflated');
  const mine = listed.find((t) => t.name === 'mine.vgm');
  await files.assignTrack(mine.id, ['ingame', 'credits', 'nonsense']);
  assert.deepEqual((await files.listTracks('credits')).map((t) => t.name), ['mine.vgm']);
  assert.deepEqual((await files.playlistTracks('ingame')).map((t) => t.name), ['mine.vgm']);
  await files.assignTrack(mine.id, []);
  assert.deepEqual(await files.playlistTracks('ingame'), [], 'not used: kept, not played');
  assert.equal((await files.trackData(mine.id)).meta.title, 'My Own Tune');
  const into = await files.importMusic([{ name: 'x.ogg', data: ogg.buffer }], { slot: 'peace', format });
  assert.deepEqual(into.files[0].slots, ['peace'], 'into a slot when one is given');
  await assert.rejects(files.importMusic([], { slot: 'nope' }), /no playlist/);
  const none = await files.importMusic([{ name: 'a.vgm', data: vgmFile().buffer }], { format: async () => { throw new Error('404'); } });
  assert.match(none.files[0].error, /cannot read VGM files/, 'without the VGM reader the page says so');
});

test('tracks stored before the slots (one playlist each) still play there', async () => {
  delete globalThis.__duneUserFiles;
  files.openStorage(null);   // the memory store, to put a record of the first version in by hand
  const ogg = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0, 0, 0, 0, 0]);
  globalThis.__duneUserFiles.tracks.set(1, { id: 1, list: 'battle', name: 'war.ogg', type: 'audio/ogg', size: 12, blob: new Blob([ogg]) });
  const [t] = await files.listTracks('battle');
  assert.deepEqual([t.name, t.lists, t.meta], ['war.ogg', ['battle'], null]);
  assert.equal((await files.playlists()).battle[0].name, 'war.ogg');
  assert.equal((await files.playlistTracks('battle'))[0].name, 'war.ogg');
});

test('the Music Test\'s words: times, slots, what was read and how much it covers', () => {
  assert.equal(formatTime(73.5), '1:14');
  assert.equal(formatTime(17.2), '0:17');
  assert.equal(formatTime(0), '—');
  assert.equal(formatTime(undefined), '—');
  assert.equal(slotValue(['menu', 'intro']), 'intro,menu', 'in the page\'s order');
  assert.equal(slotValue([]), '');
  assert.deepEqual(musicReportText({ files: [
    { name: '01 - Opening.vgm', title: 'Opening', slots: ['intro', 'menu'] },
    { name: '10 - Starport.vgm', title: 'Starport', slots: [] },
    { name: '21 - Opening (German).vgm', title: 'Opening (German)', slots: [], note: 'German version: left out (English only)' },
    { name: 'a.zip', error: 'no VGM files in it' },
  ] }), [
    { text: 'Opening (01 - Opening.vgm): plays as Intro, Title and menus', bad: false },
    { text: 'Starport (10 - Starport.vgm): kept; pick where it plays below', bad: false },
    { text: 'Opening (German) (21 - Opening (German).vgm): German version: left out (English only)', bad: false },
    { text: 'a.zip: no VGM files in it', bad: true },
  ]);
  assert.match(coverageText([]), /this game’s own music plays everywhere/);
  assert.equal(coverageText([{ lists: ['intro', 'menu'] }, { lists: ['menu'] }]), 'Your music plays in 2 of 18 places; this game’s own in the rest.');
  assert.equal(coverageText([{ lists: SLOTS }]), 'Your music plays everywhere.');
});
