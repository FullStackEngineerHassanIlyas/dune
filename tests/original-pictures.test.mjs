// The original game's pictures from the player's own files (src/formats/dune2-pictures.js, src/core/user-files.js,
// src/ui/original-files.js, src/ui/campaign/original-*.js): what is made from which file, the import keeping them
// in the browser's store and the switch, the localhost import, the page's words, the original Mentat — his eyes on
// the original's schedule, his mouth frames for the voice's shapes, the rig the face engine takes — and the
// briefing taking him when he is there. Every file is made up inside the tests (original-art-fakes.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './campaign-dom.mjs';
import { fakeIndexedDB } from './fake-indexeddb.mjs';
import { fakeDunePak, fakeRoom, fakeShapes, fakeHerald, fakePalette6, pakFile, palFile, cpsFile, shpFile, EYES, MOUTH } from './original-art-fakes.mjs';
import { extractPictures, summarizePictures, MENTATS, HERALD, PICTURE_FILES } from '../src/formats/dune2-pictures.js';
import { readPak } from '../src/formats/pak.js';
import { readPal, toRgba } from '../src/formats/pal.js';
import * as files from '../src/core/user-files.js';
import { picturesText, reportText } from '../src/ui/original-files.js';
import { eyeSchedule, otherSchedule, mouthVisemes, measureMouth, buildMentatArt, buildEmblemArt, figureBox, clearSurround, TICKS } from '../src/ui/campaign/original-mentat-art.js';
import { loadOriginalPictures, currentPictures, originalEmblem, resetOriginalPictures } from '../src/ui/campaign/original-pictures.js';
import { originalMentatFigure, originalMentatRig } from '../src/ui/campaign/original-mentat.js';
import { validateRig, VISEMES, EXPRESSIONS } from '../src/ui/campaign/mentat-face-rig.js';
import { MentatTrack } from '../src/audio/mentat-voice.js';
import { attachMentatFace } from '../src/ui/campaign/mentat-face.js';

const HOUSES = ['atreides', 'harkonnen', 'ordos'];
const pakLookup = (bytes) => { const p = readPak(bytes); return (n) => p.file(n); };
const palette = () => readPal(palFile(fakePalette6()));

function freshStore(options = {}) {
  delete globalThis.__duneUserFiles;
  const idb = options === null ? null : fakeIndexedDB(options);
  files.openStorage(idb);
  return idb;
}
const dunePak = (opts) => ({ name: 'DUNE.PAK', data: fakeDunePak(opts).buffer });

// ——— what is made from which file ———

test('the Mentats are made from their rooms and shapes, each part where the original draws it; the emblems from the house selection', () => {
  const { pictures, problems } = extractPictures(pakLookup(fakeDunePak()));
  assert.deepEqual(problems, []);
  assert.deepEqual(pictures.map((p) => p.name).sort(), ['emblem:atreides', 'emblem:harkonnen', 'emblem:ordos', 'mentat:atreides', 'mentat:harkonnen', 'mentat:ordos']);
  const pal = palette();
  for (const house of HOUSES) {
    const m = pictures.find((p) => p.name === `mentat:${house}`), at = MENTATS[house];
    assert.deepEqual([m.width, m.height, m.mentat], [320, 200, at.name]);
    assert.deepEqual([...m.rgba.subarray(0, 64)], [...toRgba(fakeRoom(house), pal).subarray(0, 64)], 'the room through IBM.PAL');
    assert.equal(m.parts.eyes.length, 5);
    assert.equal(m.parts.mouth.length, 5);
    assert.deepEqual([m.parts.eyes[0].x, m.parts.eyes[0].y], at.eyes);
    assert.deepEqual([m.parts.mouth[3].x, m.parts.mouth[3].y, m.parts.mouth[3].width, m.parts.mouth[3].height], [...at.mouth, ...MOUTH]);
    assert.deepEqual([m.parts.shoulder.x, m.parts.shoulder.y], at.shoulder);
    assert.equal(m.parts.other.length, at.other ? 4 : 0, 'Radnor has no book or ring');
    const shape = fakeShapes(house)[5 + 3], px = m.parts.mouth[3].rgba;
    for (let i = 0; i < shape.indices.length; i++) assert.equal(px[i * 4 + 3], shape.indices[i] ? 255 : 0);
    assert.deepEqual(m.from, [`MENTAT${at.letter}.CPS`, `MENSHP${at.letter}.SHP`]);
  }
  const e = pictures.find((p) => p.name === 'emblem:ordos'), [x, y, w, h] = HERALD.ordos, herald = toRgba(fakeHerald(), pal);
  assert.deepEqual([e.width, e.height], [w, h]);
  assert.deepEqual([...e.rgba.subarray(0, 4)], [...herald.subarray((y * 320 + x) * 4, (y * 320 + x) * 4 + 4)]);
  assert.deepEqual(summarizePictures(pictures.map((p) => p.name)), { mentats: HOUSES, emblems: HOUSES, count: 6 });
  assert.ok(PICTURE_FILES.includes('HERALD.CPS') && PICTURE_FILES.includes('MENSHPO.SHP') && PICTURE_FILES.includes('IBM.PAL'));
});

test('a damaged or missing file costs only its own pictures, and says what was wrong', () => {
  const broken = cpsFile(fakeRoom('harkonnen')).slice(0, 300);
  const p = pakFile([['IBM.PAL', palFile()], ['MENTATA.CPS', cpsFile(fakeRoom('atreides'))], ['MENTATH.CPS', broken], ['MENSHPH.SHP', shpFile(fakeShapes('harkonnen'))], ['HERALD.CPS', cpsFile(fakeHerald())]]);
  const { pictures, problems } = extractPictures(pakLookup(p));
  assert.deepEqual(pictures.map((x) => x.name).sort(), ['emblem:atreides', 'emblem:harkonnen', 'emblem:ordos', 'mentat:atreides']);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].file, 'MENTATH.CPS');
  assert.match(problems[0].error, /^MENTATH\.CPS: .*byte \d+/);
  const a = pictures.find((x) => x.name === 'mentat:atreides');
  assert.ok(a.parts.eyes.every((q) => q === null), 'no shape file: the room alone');
  const noPal = extractPictures(pakLookup(pakFile([['MENTATO.CPS', cpsFile(fakeRoom('ordos'))]])));
  assert.equal(noPal.pictures.length, 0);
  assert.match(noPal.problems[0].error, /IBM\.PAL is not among the files/);
  const own = extractPictures(pakLookup(pakFile([['MENTATO.CPS', cpsFile(fakeRoom('ordos'), { palette: fakePalette6() })]])));
  assert.deepEqual(own.pictures.map((x) => x.name), ['mentat:ordos'], 'a picture with a palette of its own needs no IBM.PAL');
});

// ——— the store ———

test('reading the PAK files keeps the pictures, switches them on, and the page says what they are', async () => {
  freshStore();
  const seen = [];
  const follower = { picturesChanged: () => seen.push('pictures'), originalsChanged: () => seen.push('sounds') };
  files.follow(follower);
  const r = await files.importFiles([dunePak(), { name: 'SCENARIO.PAK', data: pakFile([['SCEN001.INI', new Uint8Array(3)]]).buffer }]);
  assert.equal(r.pictures, 6);
  assert.equal(r.added, 0);
  const row = r.files[0];
  assert.equal(row.pictures, 8, 'IBM.PAL, HERALD.ENG and three rooms and three shape files');
  assert.equal(r.files[1].note, 'no sound clips or pictures in it');
  assert.deepEqual(reportText(r), [{ text: 'DUNE.PAK: 8 picture files', bad: false }, { text: 'SCENARIO.PAK: no sound clips or pictures in it', bad: false }]);
  assert.deepEqual(seen, ['pictures'], 'the pictures\' followers are told; the sounds\' are not');
  assert.equal(await files.usingPictures(), true);
  assert.equal(await files.usingOriginals(), false, 'no clips: the sounds switch stays as it was');
  const s = await files.pictureSummary();
  assert.deepEqual([s.mentats, s.emblems, s.count, s.sources, s.on], [HOUSES, HOUSES, 6, ['DUNE.PAK'], true]);
  assert.equal(picturesText(s), 'Mentat portraits: 3 (Atreides, Harkonnen, Ordos), house emblems: 3, from DUNE.PAK');
  assert.equal(picturesText({ count: 0 }), 'Nothing yet.');
  const pics = await files.originalPictures();
  assert.ok(pics.get('mentat:ordos').rgba instanceof Uint8Array);
  await files.setUsePictures(false);
  assert.equal(await files.originalPictures(), null, 'off: nothing is shown');
  await files.setUsePictures(true);
  assert.ok(await files.originalPictures());
  await files.forgetGameFiles();
  assert.equal((await files.pictureSummary()).count, 0);
  assert.equal(await files.usingPictures(), false);
  assert.equal(await files.originalPictures(), null);
  assert.ok(seen.length >= 4);
});

test('pictures whose files come in different archives, read at different times, are made once all are there', async () => {
  freshStore();
  const first = await files.importFiles([{ name: 'MENTAT.PAK', data: pakFile([['MENTATA.CPS', cpsFile(fakeRoom('atreides'))], ['MENSHPA.SHP', shpFile(fakeShapes('atreides'))]]).buffer }]);
  assert.equal(first.pictures, 0, 'no palette yet');
  assert.match(reportText(first)[0].text, /^MENTAT\.PAK: 2 picture files — MENTATA\.CPS: no palette/);
  const second = await files.importFiles([{ name: 'DUNE.PAK', data: pakFile([['IBM.PAL', palFile()]]).buffer }]);
  assert.equal(second.pictures, 1);
  assert.deepEqual((await files.pictureSummary()).mentats, ['atreides']);
});

test('a damaged picture file in an archive is reported with the archive, and the rest still comes in', async () => {
  freshStore();
  const p = pakFile([['IBM.PAL', palFile()], ['MENTATO.CPS', cpsFile(fakeRoom('ordos')).slice(0, 200)], ['MENTATA.CPS', cpsFile(fakeRoom('atreides'))]]);
  const r = await files.importFiles([{ name: 'DUNE.PAK', data: p.buffer }]);
  assert.equal(r.pictures, 1);
  const [line] = reportText(r);
  assert.equal(line.bad, true);
  assert.match(line.text, /^DUNE\.PAK: 3 picture files — MENTATO\.CPS: .*byte \d+/);
});

test('a browser too full for the pictures says so, and nothing half-kept is switched on', async () => {
  freshStore({ quota: 20000 });
  const r = await files.importFiles([dunePak()]);
  assert.equal(r.pictures, 0);
  assert.match(reportText(r)[0].text, /the pictures could not be kept: not enough storage space left in this browser/);
  assert.equal(reportText(r)[0].bad, true);
  assert.equal(await files.usingPictures(), false);
  assert.equal((await files.pictureSummary()).count, 0);
});

test('a store from before the pictures opens with its clips, and memory keeps pictures where there is no IndexedDB', async () => {
  const idb = fakeIndexedDB();
  // the first version's database: clips, tracks and meta only
  await new Promise((resolve) => {
    const req = idb.open('dune2-3d.user-files', 1);
    req.onupgradeneeded = () => { for (const [n, o] of [['clips', { keyPath: 'name' }], ['tracks', { keyPath: 'id', autoIncrement: true }], ['meta', { keyPath: 'key' }]]) req.result.createObjectStore(n, o); };
    req.onsuccess = () => {
      const t = req.result.transaction('clips', 'readwrite');
      t.objectStore('clips').put({ name: 'AATRE', rate: 11025, pcm: new Uint8Array(4) });
      t.oncomplete = resolve;
    };
  });
  files.openStorage(idb);
  await files.importFiles([dunePak()]);
  assert.equal((await files.clipSummary()).clips, 1, 'the clips of before are still there');
  assert.equal((await files.pictureSummary()).count, 6);
  freshStore(null);
  assert.equal(await files.storageKind(), 'memory');
  await files.importFiles([dunePak()]);
  files.openStorage(null);   // the battle's frame of the same page
  assert.ok((await files.originalPictures()).has('emblem:atreides'));
});

test('the copy in original/ (or original/dune2/) is read by itself on a local server, once, and again when it changes', async () => {
  freshStore();
  const bytes = fakeDunePak();
  let stamp = 'a';
  const asked = [];
  const fetch = (have) => async (url, { method = 'GET' } = {}) => {
    asked.push(`${method} ${url}`);
    if (!have.includes(url)) return { status: 204, headers: { get: () => null } };
    return { status: 200, headers: { get: (k) => (k === 'content-length' ? String(bytes.length) : k === 'last-modified' ? stamp : null) }, arrayBuffer: async () => bytes.buffer.slice(0) };
  };
  const r = await files.importLocalPaks({ fetch: fetch(['original/dune2/dune.pak']) });
  assert.equal(r.pictures, 6);
  assert.equal(r.files[0].name, 'DUNE.PAK');
  assert.ok(asked.includes('HEAD original/DUNE.PAK') && asked.includes('HEAD original/dune2/ENGLISH.PAK') && asked.includes('GET original/dune2/dune.pak'));
  assert.equal(await files.usingPictures(), true);
  asked.length = 0;
  assert.equal(await files.importLocalPaks({ fetch: fetch(['original/dune2/dune.pak']) }), null, 'the same files: not read again');
  assert.ok(asked.every((a) => a.startsWith('HEAD ')), 'nothing downloaded');
  stamp = 'b';
  assert.equal((await files.importLocalPaks({ fetch: fetch(['original/dune2/dune.pak']) })).pictures, 6, 'a changed file is read again');
  const both = await files.importLocalPaks({ fetch: fetch(['original/DUNE.PAK', 'original/dune.pak']) });
  assert.equal(both.files.length, 1, 'one archive answering in both cases is read once');
  freshStore();
  assert.equal(await files.importLocalPaks({ fetch: fetch([]) }), null);
  assert.equal(await files.importLocalPaks({ fetch: async () => { throw new Error('offline'); } }), null);
  assert.equal(await files.importLocalPaks({ fetch: null }), null);
  assert.equal((await files.pictureSummary()).count, 0);
});

// ——— the original Mentat ———

test('his eyes, while he is silent, move by the original\'s rules: shutting and opening through "down", side to side through ahead', () => {
  for (const seed of [1, 7, 99]) {
    const s = eyeSchedule(seed);
    assert.equal(s[0].frame, 0);
    assert.equal(s.at(-1).frame, 0, 'the cycle ends looking ahead, as it starts');
    assert.ok(s.at(-1).to >= 90 * TICKS);
    for (let i = 1; i < s.length; i++) {
      const [a, b] = [s[i - 1], s[i]];
      assert.equal(b.from, a.to, 'no gaps');
      assert.notEqual(a.frame, b.frame);
      if (a.frame === 4 || b.frame === 4) assert.ok(a.frame === 3 || b.frame === 3, `shut ↔ ${a.frame}/${b.frame} passes "down"`);
      if ((a.frame === 1 && b.frame === 2) || (a.frame === 2 && b.frame === 1)) assert.fail('side to side passes ahead');
      const d = b.to - b.from;
      if (b.frame === 4) assert.ok(d >= 6, `shut ${d}`);
      if (b.frame === 1 || b.frame === 2) assert.ok(d >= 15, `held ${d}`);
      if (b.frame === 3 && (a.frame === 4 || s[i + 1]?.frame === 4)) assert.ok(d >= 1, 'down a moment on the way');
    }
    const shown = new Set(s.map((x) => x.frame));
    for (const f of [0, 1, 2, 3, 4]) assert.ok(shown.has(f), `frame ${f} shown`);
  }
});

test('Cyril\'s book turns through its frames and back every one to three seconds; Ammon\'s ring glints quickly every 10 to 19; Radnor has none', () => {
  const all = [true, true, true, true];
  const a = otherSchedule('atreides', all, 3);
  assert.deepEqual(a.slice(0, 8).map((x) => x.frame), [0, 1, 2, 3, 2, 1, 0, 1]);
  assert.ok(a.every((x) => [60, 120, 180].includes(x.to - x.from)));
  const o = otherSchedule('ordos', all, 3);
  assert.deepEqual(o.slice(0, 7).map((x) => x.frame), [0, 1, 2, 3, 2, 1, 0]);
  for (const x of o) assert.ok(x.frame === 0 ? x.to - x.from >= 600 && x.to - x.from <= 1140 : x.to - x.from === 6);
  assert.equal(o.at(-1).frame, 1, 'the cycle comes back to the ring at rest');
  // two book frames and two 1 x 1 fillers (as the files have them): the second frame stays through the fillers
  const b = otherSchedule('atreides', [true, true, false, false], 3);
  assert.deepEqual(b.slice(0, 4).map((x) => x.frame), [0, 1, 0, 1]);
  assert.ok(b[1].to - b[1].from >= 5 * 60, 'held through 1, 2, 3, 2, 1');
  assert.deepEqual(otherSchedule('harkonnen', all, 3), []);
  assert.deepEqual(otherSchedule('atreides', [true, false, false, false], 3), [], 'nothing to move between');
});

test('the voice\'s mouth shapes take the original frames that fit: A the most open, F V the least, O the roundest, E the widest', () => {
  const pal = palette();
  const frames = fakeShapes('atreides').slice(5, 10).map((s) => ({ width: s.width, height: s.height, rgba: toRgba(s.indices, pal, s.indices.map((v) => (v ? 1 : 0))) }));
  const m = measureMouth(frames);
  assert.equal(m[0].area, 0);
  assert.deepEqual(m.slice(1).map((x) => [x.area, x.width, x.height]), [[10, 10, 1], [30, 6, 5], [84, 12, 7], [54, 18, 3]]);
  assert.deepEqual(mouthVisemes(frames), { rest: null, MBP: null, FV: 1, A: 3, E: 4, O: 2, L: 4 }, 'all four open frames used');
  assert.deepEqual(mouthVisemes([frames[0], frames[0]]), Object.fromEntries(VISEMES.map((v) => [v, null])), 'nothing opens: every shape shut');
  const one = mouthVisemes([frames[0], null, frames[3]]);
  assert.deepEqual([one.A, one.FV, one.O, one.E, one.L], [2, 2, 2, 2, 2]);
});

test('his figure and rig: the room cut to him, the face engine\'s rig valid, his mouth frames and shut eyes in it', async () => {
  const { pictures } = extractPictures(pakLookup(fakeDunePak()));
  for (const house of HOUSES) {
    const record = pictures.find((p) => p.name === `mentat:${house}`);
    const box = figureBox(record), top = 200 - 190;
    assert.deepEqual(box, [0, top, MENTATS[house].shoulder[0] + 24, 190], 'from the left to his shoulder, 4 wide by 5 high');
    const art = await buildMentatArt(record);
    const { ok, errors } = validateRig(art.rig);
    assert.ok(ok, errors.join('; '));
    assert.deepEqual(art.rig.frame, [box[2], box[3]]);
    assert.deepEqual(art.rig.mouth.box, [MENTATS[house].mouth[0], MENTATS[house].mouth[1] - top, ...MOUTH]);
    assert.equal(art.rig.mouth.sprites.rest, null);
    assert.equal(art.rig.mouth.sprites.MBP, null);
    for (const v of ['FV', 'A', 'E', 'O', 'L']) assert.match(art.rig.mouth.sprites[v], /^data:image\/png;base64,/);
    assert.notEqual(art.rig.mouth.sprites.A, art.rig.mouth.sprites.FV);
    assert.deepEqual(art.rig.lids.box, [MENTATS[house].eyes[0], MENTATS[house].eyes[1] - top, ...EYES]);
    assert.equal(art.rig.lids.soft, 0);
    assert.deepEqual(Object.keys(art.rig.expressions), EXPRESSIONS);
    assert.ok(Object.values(art.rig.expressions).every((e) => Object.keys(e).length === 0), 'no warps: pixel art does not bend');
    assert.deepEqual([art.rig.motion.swayTilt, art.rig.motion.speakNod, art.rig.mouth.jaw], [0, 0, [1, 1]]);
    // the markup: what the face engine needs (the head image first in .cpm-sway, a .cpm-blink group), drawn unsmoothed
    assert.match(art.figure, new RegExp(`^<svg class="cp-mentat-art cpo cpo-${house}" viewBox="0 0 ${box[2]} ${box[3]}"`));
    assert.match(art.figure, /<g class="cpm-sway"><image href="data:image\/png;base64,[^"]+" x="0" y="0"/);
    assert.match(art.figure, /<g class="cpm-blink">(<image [^>]*class="cpo-anim cpo-\w+-eye[1-4]"\/>){4}<\/g>/);
    assert.match(art.figure, /image-rendering:pixelated/);
    assert.match(art.figure, /@media \(prefers-reduced-motion:reduce\)\{\.cpo \.cpo-anim\{animation:none;opacity:0\}\}/);
    assert.equal((art.figure.match(/cpo-anim cpo-\w+-other/g) ?? []).length, house === 'harkonnen' ? 0 : 3);
    assert.match(art.figure, /aria-label="(Cyril|Radnor|Ammon), Mentat of House \w+, from your copy of the original game"/);
  }
});

// ——— the campaign takes them ———

/** The store's side of the campaign's loader, as a fake. */
function fakeStore(pictures) {
  const followers = [];
  return { pictures, followers, follow: (t) => followers.push(t), async originalPictures() { return this.pictures; }, change(p) { this.pictures = p; for (const f of followers) f.picturesChanged(); } };
}

test('the campaign makes them once, gives the briefing the original Mentat and the house page the emblem, and follows the switch', async () => {
  resetOriginalPictures();
  assert.equal(originalMentatFigure('atreides'), null, 'before loading: our painting');
  const { pictures } = extractPictures(pakLookup(fakeDunePak()));
  const store = fakeStore(new Map(pictures.map((p) => [p.name, p])));
  const value = await loadOriginalPictures({ files: store });
  assert.equal(currentPictures(), value);
  assert.equal(await loadOriginalPictures({ files: store }), value, 'made once');
  for (const house of HOUSES) {
    assert.match(originalMentatFigure(house), /class="cp-mentat-art cpo /);
    const rig = originalMentatRig(house);
    assert.ok(validateRig(rig).ok);
    assert.notEqual(rig, originalMentatRig(house), 'a fresh copy each time');
    assert.match(originalEmblem(house), /^<svg class="cp-crest-art cpo-emblem" viewBox="0 0 96 104"/);
  }
  store.change(null);   // switched off
  assert.equal(originalMentatFigure('ordos'), null);
  assert.equal(originalMentatRig('ordos'), null);
  await loadOriginalPictures();
  assert.equal(originalEmblem('ordos'), null, 'off: our own crests');
  store.change(new Map([['mentat:ordos', pictures.find((p) => p.name === 'mentat:ordos')]]));
  await loadOriginalPictures();
  assert.ok(originalMentatFigure('ordos'));
  assert.equal(originalMentatFigure('atreides'), null, 'only what is there');
  resetOriginalPictures();
});

// a small fake SVG DOM (as tests/mentat-face.test.mjs builds one) and a voice playing a made-up track
class SvgEl {
  constructor(doc, tag) { Object.assign(this, { ownerDocument: doc, localName: tag, tagName: tag, nodeType: 1, attrs: new Map(), childNodes: [], parentNode: null, style: { visibility: '' } }); }
  setAttribute(k, v) { this.attrs.set(k, v); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  appendChild(n) { n.parentNode?.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
  insertBefore(n, ref) { if (!ref) return this.appendChild(n); n.parentNode?.removeChild(n); this.childNodes.splice(this.childNodes.indexOf(ref), 0, n); n.parentNode = this; return n; }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) this.childNodes.splice(i, 1); n.parentNode = null; return n; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get nextSibling() { const p = this.parentNode; return p ? p.childNodes[p.childNodes.indexOf(this) + 1] ?? null : null; }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === this.ownerDocument.body; }
  matches(sel) { return sel.startsWith('.') ? (this.attrs.get('class') ?? '').split(/\s+/).includes(sel.slice(1)) : this.localName === sel; }
  querySelector(sel) { for (const c of this.childNodes) { if (c.matches(sel)) return c; const f = c.querySelector(sel); if (f) return f; } return null; }
  querySelectorAll(sel) { const out = []; const walk = (n) => { for (const c of n.childNodes) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
}
function svgDom(markup) {
  const doc = { createElementNS: (ns, tag) => new SvgEl(doc, tag) };
  doc.body = new SvgEl(doc, 'body');
  const root = new SvgEl(doc, '#root'), stack = [root];
  for (const m of markup.replace(/<style>[\s\S]*?<\/style>/, '<style/>').matchAll(/<(\/?)([\w-]+)([^>]*?)(\/?)>/g)) {
    const [, close, tag, attrs, self] = m;
    if (close) { stack.pop(); continue; }
    const el = new SvgEl(doc, tag);
    for (const [, k, v] of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) el.attrs.set(k, v);
    stack.at(-1).appendChild(el);
    if (!self) stack.push(el);
  }
  return { doc, svg: root.childNodes[0] };
}
function voiceSaying(shape) {
  const ms = 3000, q = 'z'.repeat(Math.ceil(ms / 1000 * 30));
  const track = new MentatTrack({ v: 1, id: 'test/a', ms, lines: ['Ah.'], words: [[0, 2800, 0, 0, 3]], sentences: [[0, 2800, 0, 0, 'neutral']], visemes: { t: [0, 100, 2800], s: `r${shape}r` }, env: { hz: 30, q } });
  const clock = new Float64Array(1), listeners = { line: new Set(), end: new Set() };
  const line = { state: 'loading', track, duration: track.duration, now(out) { return track.at(clock[0], out); } };
  return {
    current: null, clock,
    on(type, fn) { listeners[type].add(fn); return () => listeners[type].delete(fn); },
    now(out) { return this.current?.state === 'playing' ? this.current.now(out) : Object.assign(out, { speaking: false, shape: 0, viseme: 'rest', open: 0, sentence: -1 }); },
    play() { line.state = 'playing'; this.current = line; for (const fn of [...listeners.line]) fn(line); },
  };
}

test('the briefing (mentatStage with the lead\'s hook) shows the original Mentat when he is there, and his mouth frames move with the voice', async () => {
  installDom();
  const { mentatStage } = await import('../src/ui/campaign/stage.js');
  const { mentatSvg } = await import('../src/ui/campaign/portraits.js');
  resetOriginalPictures();
  const { pictures } = extractPictures(pakLookup(fakeDunePak()));
  await loadOriginalPictures({ files: fakeStore(new Map(pictures.map((p) => [p.name, p]))) });
  // the hook as the notes give it (## Hook for the lead): the figure in place of the painting, its rig for the face
  const hooked = (house, voice) => {
    const stage = mentatStage(house, { mentatName: 'M', later: () => {}, voice });
    const figure = originalMentatFigure(house);
    stage.portrait.innerHTML = figure ?? mentatSvg(house);
    return { stage, rig: figure ? originalMentatRig(house) : null };
  };
  const { stage, rig } = hooked('harkonnen', null);
  assert.match(stage.portrait.innerHTML, /cpo-harkonnen/);
  assert.ok(rig);
  // the face on that figure (parsed into a fake SVG), following a voice that holds an A
  const { doc, svg } = svgDom(stage.portrait.innerHTML);
  const section = new SvgEl(doc, 'section'), portrait = new SvgEl(doc, 'figure');
  portrait.appendChild(svg); section.appendChild(portrait); doc.body.appendChild(section);
  const voice = voiceSaying('a');
  const frames = [];
  const face = attachMentatFace({ el: section, portrait, voice }, rig, { raf: (fn) => { frames.push(fn); return frames.length; }, caf: () => {}, reducedMotion: false });
  assert.ok(face, 'the engine takes the rig');
  voice.play();
  let ts = 0;
  for (let i = 0; i < 30; i++) { voice.clock[0] = 0.6 + i / 60; frames.shift()?.((ts += 1000 / 60)); }
  assert.ok(svg.querySelector('.cpmf-head'), 'the face is built into the figure');
  const a = svg.querySelector('.cpmf-v-A');
  assert.equal(a.getAttribute('href'), rig.mouth.sprites.A, 'the A is the original\'s most open mouth frame');
  assert.equal(a.getAttribute('display'), 'inline');
  assert.equal(Number(a.getAttribute('opacity')), 1);
  assert.equal(svg.querySelector('.cpm-blink').style.visibility, 'hidden', 'while he speaks, the engine blinks with his shut eyes; the silent look-about waits');
  face.destroy();
  // without the originals: the painting, and no rig of ours on it
  resetOriginalPictures();
  const plain = hooked('ordos', null);
  assert.match(plain.stage.portrait.innerHTML, /cpm-ordos/);
  assert.equal(plain.rig, null);
});

test('an emblem: the screen\'s black around it see-through and trimmed, black inside it kept, its pixels unsmoothed', async () => {
  // a 6 x 5 picture: black around a 3 x 3 piece whose middle is black
  const px = [
    0, 0, 0, 0, 0, 0,
    0, 9, 9, 9, 0, 0,
    0, 9, 0, 9, 0, 0,
    0, 9, 9, 9, 0, 0,
    0, 0, 0, 0, 0, 0];
  const rgba = Uint8Array.from(px.flatMap((v) => [v, v, v, 255]));
  const c = clearSurround(rgba, 6, 5);
  assert.deepEqual([c.width, c.height], [3, 3]);
  assert.deepEqual([...c.rgba].filter((_, i) => i % 4 === 3), [255, 255, 255, 255, 255, 255, 255, 255, 255], 'the black inside stays');
  const { pictures } = extractPictures(pakLookup(fakeDunePak()));
  const markup = await buildEmblemArt(pictures.find((p) => p.name === 'emblem:atreides'));
  assert.match(markup, /image-rendering:pixelated/);
  assert.match(markup, /aria-label="The emblem of House Atreides, from your copy of the original game"/);
  assert.match(markup, /\.cp-house:has\(\.cpo-emblem\) \.cp-plaque\{display:none\}/, 'the piece names the house: the card\'s plate steps aside');
});
