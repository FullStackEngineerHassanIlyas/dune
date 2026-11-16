// The original pictures' pixel work in a Worker (src/ui/campaign/picture-work.js, picture-worker.js, picture-jobs.js;
// notes docs/superpowers/notes/2026-10-06-ui.md, the Mentat's Review fixes — the main-menu block a Worker was meant
// to close): the pictures are the ones the code made before the Worker, byte for byte —
// held to it as it was at 141d9c5 (tests/fixtures/original-art/), on the page's thread and through the Worker, for
// the made-up files, files as detailed and large as the PC ones, odd sizes, see-through edges and pictures of more than
// 256 colours; the page's thread takes over when there is no Worker or it fails; and a making no longer wanted ends
// its Worker, leaves nothing listening, says nothing and paints nothing. Node has no Worker: tests/fake-worker.mjs
// runs the real worker script's serve() in this process, its messages structured-cloned with their buffers moved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readPak } from '../src/formats/pak.js';
import { extractPictures } from '../src/formats/dune2-pictures.js';
import { pictureWork } from '../src/ui/campaign/picture-work.js';
import { serve } from '../src/ui/campaign/picture-worker.js';
import { pictureJobs, isCancelled } from '../src/ui/campaign/picture-jobs.js';
import { buildMentatArt, buildEmblemArt, figureBox, ENLARGE } from '../src/ui/campaign/original-mentat-art.js';
import { loadOriginalPictures, loadOriginalPicturesWithin, currentPictures, resetOriginalPictures } from '../src/ui/campaign/original-pictures.js';
import * as frozen from './fixtures/original-art/original-mentat-art-141d9c5.mjs';
import { fakeDunePak, detailedDunePak, rng } from './original-art-fakes.mjs';
import { fakeWorkers, withWorker } from './fake-worker.mjs';
import { installDom, FakeEl, memoryStore, settle } from './campaign-dom.mjs';

const HOUSES = ['atreides', 'harkonnen', 'ordos'];
const picturesOf = (pak) => { const p = readPak(pak); return extractPictures((n) => p.file(n)).pictures; };
const FAKE = picturesOf(fakeDunePak()), DETAILED = picturesOf(detailedDunePak());
const turn = () => new Promise((r) => setTimeout(r, 0));
async function until(ok, what, ms = 5000) {
  const t0 = Date.now();
  while (!ok()) { if (Date.now() - t0 > ms) throw new Error(`timed out: ${what}`); await turn(); }
}

/**
 * A Mentat record of odd sizes: a 151 x 117 room of 60 colours; eyes 23 x 7 (one missing), mouth frames of three
 * sizes (padded to one box) and one missing, a 1 x 1 filler, a shoulder and a book frame reaching out of the figure;
 * every frame but the shut mouth with a see-through rim and holes, whatever RGB lies under them.
 */
function oddRecord(seed) {
  const r = rng(seed), W = 151, H = 117;
  const colour = () => [Math.floor(r() * 4) * 60 + 10, Math.floor(r() * 3) * 80 + 5, Math.floor(r() * 5) * 50, 255];
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) rgba.set(colour(), i * 4);
  const frame = (x, y, w, h, rim = true) => {
    const px = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const see = rim && (i === 0 || j === 0 || i === w - 1 || j === h - 1 || r() < 0.15);
      px.set(see ? [Math.floor(r() * 256), Math.floor(r() * 256), 7, 0] : colour(), (j * w + i) * 4);
    }
    return { x, y, width: w, height: h, rgba: px };
  };
  return {
    name: 'mentat:ordos', kind: 'mentat', house: 'ordos', mentat: 'Ammon', width: W, height: H, rgba,
    parts: {
      eyes: [frame(13, 41, 23, 7), frame(13, 41, 23, 7), null, frame(13, 41, 23, 7), frame(13, 41, 23, 7)],
      mouth: [frame(15, 53, 25, 11, false), frame(15, 53, 21, 9), frame(15, 53, 25, 13), null, frame(15, 53, 19, 11)],
      shoulder: frame(139, 90, 15, 29),
      other: [frame(101, 97, 17, 13), frame(101, 97, 17, 13), { x: 101, y: 97, width: 1, height: 1, rgba: new Uint8Array(4) }, frame(141, 101, 17, 13)],
    },
  };
}

/** A Mentat of more than 256 colours (written as RGBA PNGs, not palette ones), 130 x 60, two eye frames and two mouths. */
function manyColours(seed) {
  const r = rng(seed), W = 130, H = 60, px = (n) => Uint8Array.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : Math.floor(r() * 256)));
  const frame = (x, y, w, h) => ({ x, y, width: w, height: h, rgba: px(w * h) });
  return { name: 'mentat:atreides', kind: 'mentat', house: 'atreides', width: W, height: H, rgba: px(W * H),
    parts: { eyes: [frame(10, 10, 12, 5), frame(10, 10, 12, 5)], mouth: [frame(11, 20, 10, 6), frame(11, 20, 10, 6)], shoulder: null, other: [] } };
}

/** A Mentat whose room is one colour and whose frames are all see-through (one colour in all: the palette's see-through). */
function blank() {
  const W = 128, H = 40, see = (w, h) => ({ width: w, height: h, rgba: new Uint8Array(w * h * 4) });
  return { name: 'mentat:harkonnen', kind: 'mentat', house: 'harkonnen', width: W, height: H, rgba: new Uint8Array(W * H * 4).fill(90),
    parts: { eyes: [{ x: 4, y: 4, ...see(6, 3) }, { x: 4, y: 4, ...see(6, 3) }], mouth: [{ x: 4, y: 12, ...see(8, 4) }, { x: 4, y: 12, ...see(8, 4) }], shoulder: null, other: [] } };
}

/** Emblems: the made-up ones, the detailed ones, an odd 37 x 23 one (black around it and inside it), an all-black one. */
function emblems() {
  const odd = new Uint8Array(37 * 23 * 4), r = rng(5);
  for (let y = 0; y < 23; y++) for (let x = 0; x < 37; x++) {
    const inside = x > 4 && x < 30 && y > 2 && y < 20 && !(x > 14 && x < 18 && y > 9 && y < 12);
    odd.set(inside ? [40 + Math.floor(r() * 3) * 70, 90, 30, 255] : [0, 0, 0, 255], (y * 37 + x) * 4);
  }
  return [...FAKE, ...DETAILED].filter((p) => p.kind === 'emblem')
    .concat([{ name: 'emblem:ordos', kind: 'emblem', house: 'ordos', width: 37, height: 23, rgba: odd },
      { name: 'emblem:harkonnen', kind: 'emblem', house: 'harkonnen', width: 9, height: 7, rgba: Uint8Array.from({ length: 9 * 7 * 4 }, (_, i) => (i % 4 === 3 ? 255 : 0)) }]);
}

const mentats = () => [
  ...FAKE.filter((p) => p.kind === 'mentat').map((record) => ({ record, scale: ENLARGE, what: `made-up ${record.house}` })),
  ...DETAILED.filter((p) => p.kind === 'mentat').map((record) => ({ record, scale: ENLARGE, what: `PC-sized ${record.house}` })),
  ...[2, 4, 8].map((scale) => ({ record: oddRecord(scale), scale, what: `odd sizes at ${scale}x` })),
  { record: manyColours(3), scale: 2, what: 'more than 256 colours' },
  { record: blank(), scale: 4, what: 'one colour, frames all see-through' },
];

const noPause = async () => {};

// ——— the pictures are the ones made before, byte for byte ———

test('on the page\'s thread (no Worker) the figure, its rig and the emblems are the 141d9c5 code\'s, byte for byte', async () => {
  for (const { record, scale, what } of mentats()) {
    const before = await frozen.buildMentatArt(record, { scale, pause: noPause });
    assert.deepEqual(await buildMentatArt(record, { scale, pause: noPause }), before, what);
  }
  for (const record of emblems()) {
    for (const scale of [4, 1]) assert.equal(await buildEmblemArt(record, { scale }), await frozen.buildEmblemArt(record, { scale }), `${record.name} ${record.width}x${record.height} at ${scale}x`);
  }
});

test('made in the Worker they are the same, byte for byte; the page\'s thread takes no step of the work, and the record keeps its pixels', async () => {
  const { FakeWorker, made } = fakeWorkers(), jobs = pictureJobs({ start: () => new FakeWorker('picture-worker.js', { type: 'module' }) });
  let paused = 0;
  const pause = async () => { paused++; };
  for (const { record, scale, what } of mentats()) {
    const sizes = [record.rgba.byteLength, ...Object.values(record.parts).flat().filter(Boolean).map((q) => q.rgba.byteLength)];
    const before = await frozen.buildMentatArt(record, { scale, pause: noPause });
    assert.deepEqual(await buildMentatArt(record, { scale, pause, run: jobs.run }), before, what);
    assert.deepEqual([record.rgba.byteLength, ...Object.values(record.parts).flat().filter(Boolean).map((q) => q.rgba.byteLength)], sizes, `${what}: the record's own buffers are not moved`);
  }
  for (const record of emblems()) assert.equal(await buildEmblemArt(record, { run: jobs.run }), await frozen.buildEmblemArt(record), record.name);
  // none of the enlarging steps ran here (those are the Worker's); the two pauses buildMentatArt takes itself
  // around its own main-thread work (the schedules and mouth measure, after the pictures come back) still do,
  // once each of the 11 records in mentats()
  assert.equal(paused, mentats().length * 2, 'only buildMentatArt\'s own two pauses, not the enlarging steps');
  assert.equal(made.length, 1, 'one Worker, reused for every picture');
  // what went over: a copy of each pixel buffer, moved (detached here), one buffer for a frame met twice
  const posted = made[0].posted, first = posted[0];
  assert.equal(first.data.job.kind, 'mentat');
  assert.ok(first.transfer.length > 1 && first.transfer.every((b) => b.byteLength === 0), 'the copies were transferred, not cloned');
  assert.equal(new Set(first.transfer).size, first.transfer.length);
  const record = FAKE.find((p) => p.name === 'mentat:atreides'), frames = new Set([...record.parts.eyes, ...record.parts.mouth, ...record.parts.other, record.parts.shoulder].filter(Boolean));
  assert.equal(first.transfer.length, 1 + frames.size, 'the room and each frame once');
  jobs.close();
  assert.ok(made[0].terminated);
  assert.equal(made[0].listening, 0);
});

test('the pure function gives the very pictures the 141d9c5 code put in the figure and the rig', async () => {
  for (const record of [...FAKE, ...DETAILED].filter((p) => p.kind === 'mentat')) {
    const before = await frozen.buildMentatArt(record, { pause: noPause });
    const { eyes, mouth, other, shoulder } = record.parts;   // (their mouths are one size: no box to pad them to)
    const made = await pictureWork({ kind: 'mentat', rgba: record.rgba, width: record.width, box: figureBox(record), eyes, mouth, other, shoulder, scale: ENLARGE });
    assert.equal(made.head, before.rig.head.src, `${record.name}: the head`);
    assert.deepEqual(made.eyes[4], { src: before.rig.lids.src, box: before.rig.lids.box }, 'the shut eyes');
    assert.ok([made.eyes[0], made.mouth[0], made.other[0] ?? null].every((a) => a === null), 'the frames at rest are in the head');
    const sprites = new Set(Object.values(before.rig.mouth.sprites).filter(Boolean));
    assert.ok([...sprites].every((src) => made.mouth.some((a) => a?.src === src)), 'every mouth sprite');
    for (const a of [...made.eyes, ...made.other].filter(Boolean)) assert.ok((before.figure + JSON.stringify(before.rig)).includes(a.src), `${record.name}: a frame in the figure or the rig`);
  }
  for (const record of emblems()) {
    const { src, width, height } = await pictureWork({ kind: 'emblem', rgba: record.rgba, width: record.width, height: record.height, scale: 4 });
    const before = await frozen.buildEmblemArt(record);
    assert.ok(before.includes(`viewBox="0 0 ${width} ${height}"`) && before.includes(`href="${src}"`), record.name);
  }
  await assert.rejects(pictureWork({ kind: 'nothing' }), /no job of kind "nothing"/);
});

test('the worker script answers each job with what the pure function makes, and an error with its message', async () => {
  const scope = new EventTarget(), replies = [];
  scope.postMessage = (data) => replies.push(data);
  serve(scope);
  const emblem = FAKE.find((p) => p.name === 'emblem:ordos'), job = { kind: 'emblem', rgba: emblem.rgba, width: 96, height: 104, scale: 4 };
  scope.dispatchEvent(new MessageEvent('message', { data: { id: 7, job } }));
  scope.dispatchEvent(new MessageEvent('message', { data: { id: 8, job: { kind: 'nothing' } } }));
  await until(() => replies.length === 2, 'two replies');
  const byId = Object.fromEntries(replies.map((r) => [r.id, r]));
  assert.deepEqual(byId[7], { id: 7, result: await pictureWork(job) });
  assert.match(byId[8].error, /no job of kind "nothing"/);
});

// ——— where there is no Worker, or it fails ———

test('with no Worker (as in Node) every job runs on the page\'s thread, with the caller\'s pauses, as before', async () => {
  await withWorker(undefined, async () => {
    const jobs = pictureJobs(), record = FAKE.find((p) => p.name === 'mentat:ordos');
    let paused = 0;
    const art = await buildMentatArt(record, { run: jobs.run, pause: async () => { paused++; } });
    assert.deepEqual(art, await frozen.buildMentatArt(record, { pause: noPause }));
    assert.equal(paused, 6, 'the four pauses it always had (after the head\'s scaling, before the eyes, the mouth and the '
      + 'book) and the two buildMentatArt takes itself, after the pictures come back and before it measures the mouth');
    assert.deepEqual(jobs.status(), { started: 0, live: false, failed: true, closed: false, pending: 0 });
    jobs.close();
  });
});

test('a Worker that cannot start, fails, breaks a message, cannot take one or throws: the page\'s thread makes the pictures, the same', async () => {
  const record = FAKE.find((p) => p.name === 'mentat:harkonnen'), emblem = FAKE.find((p) => p.name === 'emblem:atreides');
  const want = await frozen.buildMentatArt(record, { pause: noPause }), wantEmblem = await frozen.buildEmblemArt(emblem);
  // cannot start (a page opened from a file, no module Workers)
  const none = pictureJobs({ start: () => { throw new Error('SecurityError'); } });
  assert.deepEqual(await buildMentatArt(record, { run: none.run, pause: noPause }), want, 'cannot start');
  assert.deepEqual(none.status(), { started: 0, live: false, failed: true, closed: false, pending: 0 });
  // its script does not load ('error' while a job waits): that job and the ones after here; it is ended, not listened to
  for (const type of ['error', 'messageerror']) {
    const { FakeWorker, made } = fakeWorkers({ hold: true }), jobs = pictureJobs({ start: () => new FakeWorker('w', {}) });
    const art = buildMentatArt(record, { run: jobs.run, pause: noPause });
    await until(() => made[0]?.posted.length === 1, 'the job posted');
    made[0].fail(type);
    assert.deepEqual(await art, want, type);
    assert.equal(await buildEmblemArt(emblem, { run: jobs.run }), wantEmblem, `${type}: the next job too`);
    assert.ok(made[0].terminated && made[0].listening === 0, `${type}: the Worker ended`);
    assert.deepEqual(jobs.status(), { started: 1, live: false, failed: true, closed: false, pending: 0 }, 'no second Worker');
  }
  // a job it throws on (or answers with an error) is done here, which says what was wrong as it always did
  const { FakeWorker: Erring, made: erring } = fakeWorkers({ reply: (data) => ({ id: data.id, error: 'out of memory' }) });
  const errs = pictureJobs({ start: () => new Erring('w', {}) });
  assert.deepEqual(await buildMentatArt(record, { run: errs.run, pause: noPause }), want, 'answered with an error');
  await assert.rejects(errs.run({ kind: 'nothing' }), /no job of kind "nothing"/, 'a bad job fails here as it did');
  assert.equal(erring.length, 1);
  assert.ok(errs.status().live, 'the Worker stays for the jobs after');
  errs.close();
  // a job that cannot be posted
  const { FakeWorker: Picky } = fakeWorkers();
  Picky.prototype.postMessage = () => { throw new DOMException('could not be cloned', 'DataCloneError'); };
  const picky = pictureJobs({ start: () => new Picky('w', {}) });
  assert.equal(await buildEmblemArt(emblem, { run: picky.run }), wantEmblem, 'not posted: done here');
  assert.equal(picky.status().pending, 0);
  picky.close();
});

// ——— a making no longer wanted ———

test('close() ends the Worker at once: the job under way rejects as cancelled, nothing listens, a late answer is dropped, later jobs are refused', async () => {
  const { FakeWorker, made } = fakeWorkers({ hold: true }), jobs = pictureJobs({ start: () => new FakeWorker('w', {}) });
  const record = FAKE.find((p) => p.name === 'mentat:atreides');
  const art = buildMentatArt(record, { run: jobs.run, pause: noPause });
  await until(() => made[0]?.posted.length === 1, 'the job posted');
  assert.deepEqual(jobs.status(), { started: 1, live: true, failed: false, closed: false, pending: 1 });
  jobs.close();
  await assert.rejects(art, (err) => isCancelled(err));
  assert.ok(made[0].terminated);
  assert.equal(made[0].listening, 0, 'its listeners taken off');
  made[0].release();   // the worker answers after all: nobody hears it
  await turn(); await turn();
  assert.deepEqual(jobs.status(), { started: 1, live: false, failed: false, closed: true, pending: 0 });
  await assert.rejects(jobs.run({ kind: 'emblem' }), (err) => isCancelled(err), 'a job after close');
  jobs.close();   // twice: nothing more
  // on the page's thread (no Worker), a closed making stops at its next pause, its work not finished
  const here = pictureJobs({ start: () => { throw new Error('no Worker'); } });
  let steps = 0;
  const slow = buildMentatArt(record, { run: here.run, pause: async () => { steps++; if (steps === 2) here.close(); await turn(); } });
  await assert.rejects(slow, (err) => isCancelled(err));
  assert.equal(steps, 2, 'stopped at the pause it was closed in');
});

/** The store's side of the campaign's loader, as a fake (as tests/original-pictures.test.mjs has it). The loader
 *  follows the first store it is given for good, so every test here uses this one, its pictures set for the test. */
const STORE = (() => {
  const followers = [];
  return { pictures: null, followers, follow: (t) => followers.push(t), async originalPictures() { return this.pictures; }, change(p) { this.pictures = p; for (const f of followers) f.picturesChanged(); } };
})();
const storeOf = (list) => { STORE.pictures = new Map(list.map((p) => [p.name, p])); return STORE; };
const houseOf = (job) => ({ 40: 'atreides', 32: 'harkonnen', 16: 'ordos' })[job.eyes?.[0]?.x];

/** Collects the loader's warnings and any unhandled rejection while `fn` runs. */
async function quietly(fn) {
  const warned = [], rejected = [], warn = console.warn, onReject = (err) => rejected.push(err);
  console.warn = (...a) => { const line = a.join(' '); if (line.startsWith('original pictures')) warned.push(line); else warn(...a); };
  process.on('unhandledRejection', onReject);
  try { await fn(); await settle(); } finally { console.warn = warn; process.off('unhandledRejection', onReject); }
  return { warned, rejected };
}

test('the campaign\'s loader: one Worker for the making, the house on the screen first, the same pictures as without, the Worker ended after', async () => {
  resetOriginalPictures();
  const without = await withWorker(undefined, () => loadOriginalPictures({ files: storeOf(FAKE), first: 'ordos' }));
  resetOriginalPictures();
  const { FakeWorker, made } = fakeWorkers();
  await withWorker(FakeWorker, async () => {
    const store = storeOf(FAKE);
    const shown = await loadOriginalPicturesWithin(10000, { files: store, first: 'ordos' });
    assert.deepEqual(Object.keys(shown.mentats), ['ordos'], 'given to the screens with the house on the screen\'s Mentat');
    assert.ok(currentPictures() === shown);
    const value = await loadOriginalPictures({ files: store });
    assert.deepEqual(value, without, 'the same figures, rigs and emblems as made on the page\'s thread');
    assert.equal(made.length, 1, 'one Worker');
    assert.match(made[0].url, /\/src\/ui\/campaign\/picture-worker\.js$/);
    assert.deepEqual(made[0].options, { type: 'module' });
    assert.deepEqual(made[0].posted.map(({ data: { job } }) => (job.kind === 'mentat' ? houseOf(job) : job.kind)),
      ['ordos', 'emblem', 'emblem', 'emblem', 'atreides', 'harkonnen'], 'the house on the screen and the emblems, then the others');
    assert.ok(made[0].terminated && made[0].listening === 0, 'ended once they are made');
  });
  resetOriginalPictures();
});

test('switched off or read again while the Worker works: it is ended at once, says nothing, and what it made is not shown', async () => {
  resetOriginalPictures();
  const { FakeWorker, made } = fakeWorkers({ hold: true });
  const { warned, rejected } = await quietly(() => withWorker(FakeWorker, async () => {
    const store = storeOf(FAKE);
    const making = loadOriginalPictures({ files: store, first: 'atreides' });
    await until(() => made[0]?.posted.length === 1, 'the first job posted');
    store.change(null);   // Options → Original pictures off
    assert.ok(made[0].terminated, 'ended at once');
    assert.equal(made[0].listening, 0);
    made[0].release();
    const stale = await making;
    assert.deepEqual(stale, { mentats: {}, emblems: {} }, 'the making no longer wanted made nothing');
    assert.equal(await loadOriginalPictures(), null, 'the new making: nothing to show');
    assert.equal(currentPictures(), null);
    assert.equal(made.length, 1, 'no Worker for a making with nothing to make');
    // and forgetting them in the middle of a making (the tests' reset) ends its Worker the same way
    store.change(new Map(FAKE.map((p) => [p.name, p])));
    await until(() => made[1]?.posted.length === 1, 'the next making\'s first job');
    const next = loadOriginalPictures();
    resetOriginalPictures();
    assert.ok(made[1].terminated && made[1].listening === 0);
    await next;
    assert.equal(currentPictures(), null);
  }));
  assert.deepEqual(warned, [], 'a cancelled job is not a failure');
  assert.deepEqual(rejected, []);
});

test('the campaign screen or the menu left while the Worker works: no screen is drawn again, nothing throws, the Worker ends', async () => {
  installDom();
  const { MainMenu } = await import('../src/ui/main-menu.js');
  const { DEFAULTS } = await import('../src/core/settings.js');
  const nine = (house) => Array.from({ length: 9 }, (_, i) => ({ briefing: [`${house} briefing ${i + 1}`], advice: ['advice'], win: ['win'], lose: ['lose'] }));
  const story = {
    MENTATS: { atreides: { name: 'Cyril' }, harkonnen: { name: 'Radnor' }, ordos: { name: 'Ammon' } },
    HOUSE_PAGES: Object.fromEntries(HOUSES.map((id) => [id, [[`${id} page one`], [`${id} page two`], [`${id} page three`]]])),
    joinQuestion: (house) => `Join ${house}?`, BRIEFINGS: Object.fromEntries(HOUSES.map((id) => [id, nine(id)])), ENDINGS: {}, MAP_CAPTIONS: {}, CREDITS: [],
  };
  const missions = { missionDef: (house, n) => (n >= 1 && n <= 9 ? { id: `${house}-${n}`, house, mission: n, title: `Title ${n}`, objective: { kind: 'destroy' }, enemies: ['harkonnen'] } : null) };
  const load = { story: async () => story, missions: async () => missions, atlas: async () => { throw new Error('no atlas yet'); }, ending: async () => ({ playEnding: async () => {} }) };
  const menuWith = () => new MainMenu(new FakeEl('div'), { settings: { ...DEFAULTS }, onStart() {}, onFullscreen() {}, music: { briefing() {} },
    shell: { launch() {}, quit() {}, on() {} }, backdrop: { setPaused() {}, start() {}, stop() {} }, campaign: { store: memoryStore(), load } });
  for (const leave of ['the screen', 'the menu']) {
    resetOriginalPictures();
    const { FakeWorker, made } = fakeWorkers({ hold: true });
    const { warned, rejected } = await quietly(() => withWorker(FakeWorker, async () => {
      const making = loadOriginalPictures({ files: storeOf(FAKE) });   // (the campaign's own call finds it under way)
      const menu = menuWith();
      menu.go('campaign');
      await settle();
      assert.ok(menu.el.find((el) => el.className?.includes?.('cp-loading')), 'the hub waits for its words');
      await until(() => made[0]?.posted.length === 1, 'a job in the Worker');
      if (leave === 'the screen') menu.go('title'); else menu.hide();   // back to the title, or a battle launched
      const drawn = [], go = menu.go.bind(menu);
      menu.go = (...a) => { drawn.push(a[0]); return go(...a); };
      made[0].release();
      await making;
      await menu.campaign.wordsLoading;
      await settle();
      assert.deepEqual(drawn, [], `${leave} left: no screen drawn again when the pictures came`);
      assert.equal(menu.screen, leave === 'the screen' ? 'title' : 'campaign');
      assert.ok(made[0].terminated && made[0].listening === 0, `${leave}: the Worker ended when the making was done`);
      assert.ok(currentPictures()?.mentats?.atreides, 'what was made is kept for the next screen');
    }));
    assert.deepEqual(warned, [], leave);
    assert.deepEqual(rejected, [], leave);
  }
  resetOriginalPictures();
});
