// The player's own files (spec §6 Original files): clips read out of the .PAK files of their own Dune II
// PC copy, and music: the Mega Drive game's soundtrack as VGM files (.vgm, .vgz, or a .zip of them, as rips
// come), or MP3/OGG/WAV tracks, each in the slots it plays in (src/audio/music/sega-tracks.js). All of it
// stays in this browser — IndexedDB, or memory for the session where the browser keeps no site data — and
// nothing is uploaded. The Original Game Files page (src/ui/original-files.js) fills it; the announcer
// (src/audio/voice.js) and the sound engine (src/audio/engine.js) read the clips when "Use the original
// sounds" is on, the music reads its slots through playlists() / playlistTracks(). Whoever reads them can
// follow() the store and is told (originalsChanged(), playlistsChanged(), auditionChanged()) when the player
// changes them; the store holds followers weakly, so a finished battle's engine is not kept alive by it.
import { readPak } from '../formats/pak.js';
import { readVoc } from '../formats/voc.js';
import { clipKey, summarize, resolveEffects, effectSample } from '../formats/dune2-sounds.js';
import { SLOTS, autoSlots, isGerman } from '../audio/music/sega-tracks.js';

export const PLAYLISTS = SLOTS;
const DB_NAME = 'dune2-3d.user-files', DB_VERSION = 1;
const STORES = { clips: { keyPath: 'name' }, tracks: { keyPath: 'id', autoIncrement: true }, meta: { keyPath: 'key' } };

// ——— storage: IndexedDB, else memory ———

function openDb(idb) {
  return new Promise((resolve, reject) => {
    const r = idb.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const [name, options] of Object.entries(STORES)) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options);
    };
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error ?? new Error('IndexedDB would not open'));
    r.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
  });
}

class IdbStore {
  constructor(db) { this.db = db; this.kind = 'indexeddb'; }

  /** One transaction on one store; resolves with the requests' results once it has committed. */
  run(name, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(name, mode), reqs = fn(t.objectStore(name));
      t.oncomplete = () => resolve(Array.isArray(reqs) ? reqs.map((q) => q.result) : reqs?.result);
      t.onabort = t.onerror = () => reject(t.error ?? reqs?.error ?? new Error('storage failed'));
    });
  }

  get(name, key) { return this.run(name, 'readonly', (s) => s.get(key)); }
  all(name) { return this.run(name, 'readonly', (s) => s.getAll()); }
  put(name, value) { return this.run(name, 'readwrite', (s) => s.put(value)); }
  putMany(name, values) { return this.run(name, 'readwrite', (s) => values.map((v) => s.put(v))); }
  delete(name, key) { return this.run(name, 'readwrite', (s) => s.delete(key)); }
  clear(name) { return this.run(name, 'readwrite', (s) => s.clear()); }
}

/** The fallback: maps on the top window (the battle runs in a frame of the menu's page), so they last the session. */
class MemoryStore {
  constructor(root) {
    this.kind = 'memory';
    this.m = root.__duneUserFiles ??= { clips: new Map(), tracks: new Map(), meta: new Map(), next: 1 };
  }

  key(name, value) {
    const { keyPath, autoIncrement } = STORES[name];
    if (autoIncrement && value[keyPath] === undefined) value[keyPath] = this.m.next++;
    return value[keyPath];
  }

  async get(name, key) { return this.m[name].get(key); }
  async all(name) { return [...this.m[name].values()]; }
  async put(name, value) { const v = { ...value }, k = this.key(name, v); this.m[name].set(k, v); return k; }
  async putMany(name, values) { const keys = []; for (const v of values) keys.push(await this.put(name, v)); return keys; }
  async delete(name, key) { this.m[name].delete(key); }
  async clear(name) { this.m[name].clear(); }
}

function sharedRoot() {
  try { if (globalThis.top && globalThis.top.location.origin === globalThis.location?.origin) return globalThis.top; } catch { /* another origin's frame */ }
  return globalThis;
}

function defaultIdb() {
  try { return globalThis.indexedDB ?? null; } catch { return null; }   // reading it throws where site data is blocked
}

let store = null;

/** (Re)opens the storage: IndexedDB when `idb` opens, else memory. Tests pass a fake. */
export function openStorage(idb = defaultIdb()) {
  store = (async () => {
    if (idb) try { return new IdbStore(await openDb(idb)); } catch { /* private mode, blocked: memory it is */ }
    return new MemoryStore(sharedRoot());
  })();
  return store;
}
const db = () => store ?? openStorage();

/** 'indexeddb' (kept between visits) or 'memory' (until the page closes). */
export async function storageKind() { return (await db()).kind; }

async function meta(key, fallback) { return (await (await db()).get('meta', key))?.value ?? fallback; }
async function setMeta(key, value) { await (await db()).put('meta', { key, value }); }

// ——— followers ———

const followers = new Set();

/** `target.originalsChanged()` will be called when the clips or the switch change, and `target.playlistsChanged()`
 *  when a playlist does (the music), while the target lives. */
export function follow(target) {
  if (typeof WeakRef === 'function') followers.add(new WeakRef(target));
}

/** The live followers (the debug hooks read what they hold). */
export function followed() {
  const live = [];
  for (const ref of followers) { const t = ref.deref(); if (t) live.push(t); else followers.delete(ref); }
  return live;
}

export function notify(what = 'originals') {
  const call = what === 'playlists' ? 'playlistsChanged' : 'originalsChanged';
  for (const t of followed()) try { t[call]?.(); } catch (err) { console.warn('original files:', err); }
}

let auditioning = false;

/** The Music Test is (not) playing a track: whatever music plays meanwhile makes way (`auditionChanged(on)`). */
export function audition(on) {
  if (auditioning === !!on) return;
  auditioning = !!on;
  for (const t of followed()) try { t.auditionChanged?.(auditioning); } catch (err) { console.warn('original files:', err); }
}

// ——— the original game's clips ———

const extension = (name) => String(name).split('.').pop().toUpperCase();
const bytesOf = async (f) => (f.data !== undefined ? f.data : await f.arrayBuffer());

/**
 * Reads the player's files ([File] or [{ name, data: ArrayBuffer }]): .PAK archives for the .VOC clips in
 * them, or loose .VOC files. Keeps every clip it can read and switches the original sounds on. Returns
 * { added, files: [{ name, clips, skipped, error }] } — `error` for a file that could not be read at all,
 * `skipped` for clips inside it that were damaged.
 */
export async function importFiles(files) {
  const report = [], clips = new Map();
  for (const f of files) {
    const name = String(f.name ?? 'file'), row = { name, clips: 0, skipped: 0, error: null, note: null };
    report.push(row);
    try {
      const ext = extension(name);
      if (ext !== 'PAK' && ext !== 'VOC') throw new Error('not a .PAK or .VOC file');
      const data = await bytesOf(f);
      const entries = ext === 'VOC' ? [{ name, bytes: data }] : (() => {
        const pak = readPak(data, name);
        return pak.entries.filter((e) => extension(e.name) === 'VOC').map((e) => ({ name: e.name, bytes: pak.file(e.name) }));
      })();
      for (const e of entries) {
        try {
          const { rate, pcm } = readVoc(e.bytes, e.name);
          clips.set(clipKey(e.name), { name: clipKey(e.name), rate, pcm, from: name.toUpperCase() });
          row.clips++;
        } catch (err) {
          if (ext === 'VOC') throw err;
          row.skipped++;
          row.note ??= err.message;   // the first damaged clip says what was wrong
        }
      }
      if (ext === 'PAK' && !row.clips && !row.skipped) row.note = 'no sound clips in it';
    } catch (err) {
      row.error = err.message.startsWith(`${name}: `) ? err.message.slice(name.length + 2) : err.message;   // the page names the file itself
    }
  }
  if (clips.size) {
    const s = await db();
    await s.putMany('clips', [...clips.values()]);
    const sources = new Set(await meta('sources', []));
    for (const r of report) if (r.clips) sources.add(r.name.toUpperCase());
    await setMeta('sources', [...sources].sort());
    await setMeta('useOriginals', true);
    notify();
  }
  return { added: clips.size, files: report };
}

/** Forgets every clip (the playlists stay) and switches the original sounds off. */
export async function clearClips() {
  const s = await db();
  await s.clear('clips');
  await setMeta('sources', []);
  await setMeta('useOriginals', false);
  notify();
}

export async function usingOriginals() { return (await meta('useOriginals', false)) === true; }

export async function setUseOriginals(on) {
  await setMeta('useOriginals', !!on);
  notify();
}

/** For the page: what the stored clips cover (formats/dune2-sounds.js summarize), where they came from, and the switch. */
export async function clipSummary() {
  const s = await db(), clips = await s.all('clips');
  return { ...summarize(new Set(clips.map((c) => c.name))), sources: await meta('sources', []), on: await usingOriginals(), storage: s.kind };
}

/** The stored clips (name → { rate, pcm }) while the original sounds are on, else null. */
export async function originalVoices() {
  if (!(await usingOriginals())) return null;
  const clips = await (await db()).all('clips');
  return clips.length ? new Map(clips.map((c) => [c.name, { rate: c.rate, pcm: c.pcm }])) : null;
}

/** Sound id → [samples at synth.js's RATE, levelled to the sound they replace] while the original sounds are on, else null. */
export async function originalEffects() {
  const clips = await originalVoices();
  if (!clips) return null;
  const out = {};
  for (const [id, names] of Object.entries(resolveEffects((n) => clips.has(n)))) out[id] = names.map((n) => effectSample(clips.get(n), id));
  return Object.keys(out).length ? out : null;
}

// ——— the player's music ———

export const VGM_TYPE = 'audio/x-vgm';   // the player's VGM files are stored plain (inflated), under this type
const VGM_FORMAT = () => import('../formats/vgm.js');   // the VGM reader (contract C8): gzip, zip, header, GD3
const VGM_RATE = 44100;                 // VGM's own clock: samples per second

/** The type the first bytes give away: MP3, OGG, WAV, a VGM ('audio/x-vgm'), a gzip (a .vgz) or a zip; else null. */
export function sniffAudio(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const text = (i, s) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (text(0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (text(0, 'OggS')) return 'audio/ogg';
  if (text(0, 'RIFF') && text(8, 'WAVE')) return 'audio/wav';
  if (text(0, 'Vgm ')) return VGM_TYPE;
  if (b[0] === 0x1f && b[1] === 0x8b) return 'application/gzip';
  if (text(0, 'PK\x03\x04')) return 'application/zip';
  return null;
}
const MEDIA = new Set(['audio/mpeg', 'audio/ogg', 'audio/wav']);

const bytesView = (d) => (ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : new Uint8Array(d));
const storageError = (err) => (/quota/i.test(`${err?.name} ${err?.message}`) ? 'not enough storage space left in this browser' : err?.message ?? String(err));
/** The slots a stored track plays in (one 'list' in the store's first version). */
const slotsOf = (t) => (Array.isArray(t.lists) ? t.lists : t.list ? [t.list] : []).filter((n) => SLOTS.includes(n));
/** "16 - Atredies Dirge.vgm" → "Atredies Dirge": a title when a file has no tag. */
const titleFromName = (name) => String(name).split(/[\\/]/).pop().replace(/\.[^.]+$/, '').replace(/^\s*\d+\s*[-._)]?\s*/, '').trim() || String(name);

async function settle(added) {
  if (!added) return;
  try { await globalThis.navigator?.storage?.persist?.(); } catch { /* best effort: ask the browser not to evict them */ }
  notify('playlists');   // the music takes the new tracks at once
}

/**
 * Adds MP3, OGG or WAV tracks ([File] or [{ name, data: ArrayBuffer }]) to slot `list` (one of SLOTS).
 * Returns { added, files: [{ name, error }] }: a file that is not MP3, OGG or WAV is refused.
 */
export async function addTracks(list, files) {
  if (!PLAYLISTS.includes(list)) throw new Error(`no playlist "${list}"`);
  const report = [], s = await db();
  let added = 0;
  for (const f of files) {
    const name = String(f.name ?? 'track'), row = { name, error: null };
    report.push(row);
    try {
      const head = f.data !== undefined ? bytesView(f.data).subarray(0, 12) : new Uint8Array(await f.slice(0, 12).arrayBuffer());
      const type = sniffAudio(head);
      if (!MEDIA.has(type)) throw new Error('not an MP3, OGG or WAV file');
      const blob = f.data !== undefined ? new Blob([f.data], { type }) : f;
      await s.put('tracks', { list, lists: [list], name, type, size: blob.size, blob, meta: { title: titleFromName(name) } });
      added++;
    } catch (err) {
      row.error = storageError(err);
    }
  }
  await settle(added);
  return { added, files: report };
}

/**
 * The Music Test's import: VGM files (.vgm, .vgz, or .zip packs of them — the Mega Drive game's soundtrack as rips
 * come) and MP3/OGG/WAV ([File] or [{ name, data }]). VGMs are inflated here and kept plain with what their header
 * and tag say ({ title, game, seconds, loopSeconds, chips }); each track goes in the slots its title names in the
 * Sega table (sega-tracks.js), or in `slot` when one is given, or none (the player picks them). German versions are
 * left out (English only), and a file already here is not added twice. `format`: the VGM reader (tests).
 * Returns { added, files: [{ name, title, slots, seconds, loopSeconds, error, note }] }, one row per track.
 */
export async function importMusic(files, { slot = null, format = VGM_FORMAT } = {}) {
  if (slot !== null && !SLOTS.includes(slot)) throw new Error(`no playlist "${slot}"`);
  const report = [], s = await db(), have = new Set((await s.all('tracks')).map((t) => `${t.name}|${t.size}`));
  let added = 0, fmt = null;
  const reader = async () => {
    if (!fmt) {
      try { fmt = await format(); } catch { fmt = {}; }
    }
    if (typeof fmt.parseVgm !== 'function') throw new Error('this copy of the game cannot read VGM files');
    return fmt;
  };
  const keep = async (row, record) => {
    if (have.has(`${record.name}|${record.size}`)) { row.note = 'already here'; return; }
    try {
      await s.put('tracks', record);
      have.add(`${record.name}|${record.size}`);
      added++;
    } catch (err) { row.error = storageError(err); }
  };
  const vgm = async (name, bytes, row) => {
    const r = await reader();
    let plain = bytes;
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) plain = await r.inflateVgm(bytes);
    const v = r.parseVgm(plain), tag = v.gd3 ?? {};
    row.title = String(tag.track || '').trim() || titleFromName(name);
    if (isGerman(row.title) || isGerman(name)) { row.note = 'German version: left out (English only)'; return; }
    const chips = [v.clocks?.ym2612 ? 'YM2612' : null, v.clocks?.sn76489 ? 'SN76489' : null].filter(Boolean);
    if (!chips.length) throw new Error('no Mega Drive sound chips in it');
    row.seconds = (v.totalSamples ?? 0) / VGM_RATE;
    row.loopSeconds = v.loopOffset ? (v.loopSamples ?? 0) / VGM_RATE : 0;
    row.slots = slot ? [slot] : autoSlots(row.title, name);
    if (v.unsupported?.length) row.note = `not all of it can be played: ${v.unsupported.join(', ')}`;
    const blob = new Blob([plain], { type: VGM_TYPE });
    await keep(row, {
      list: row.slots[0] ?? '', lists: row.slots, name, type: VGM_TYPE, size: blob.size, blob,
      meta: { title: row.title, game: String(tag.game || ''), seconds: row.seconds, loopSeconds: row.loopSeconds, chips, version: v.version ?? null },
    });
  };
  for (const f of files) {
    const name = String(f.name ?? 'track');
    try {
      const bytes = f.data !== undefined ? bytesView(f.data) : new Uint8Array(await f.arrayBuffer());
      const type = sniffAudio(bytes.subarray(0, 12));
      if (type === 'application/zip') {
        const entries = (await (await reader()).readVgmZip(bytes)).filter((e) => /\.(vgm|vgz)$/i.test(e.name));
        if (!entries.length) report.push({ name, error: 'no VGM files in it' });
        for (const e of entries) {
          const entry = e.name.split(/[\\/]/).pop(), row = { name: entry, from: name, title: titleFromName(entry), slots: [], error: null, note: null };
          report.push(row);
          try { await vgm(entry, bytesView(e.bytes), row); } catch (err) { row.error = err.message; }
        }
        continue;
      }
      const row = { name, title: titleFromName(name), slots: [], error: null, note: null };
      report.push(row);
      try {
        if (type === VGM_TYPE || type === 'application/gzip') await vgm(name, bytes, row);
        else if (MEDIA.has(type)) {
          row.slots = slot ? [slot] : autoSlots(null, name);
          const blob = new Blob([bytes], { type });
          await keep(row, { list: row.slots[0] ?? '', lists: row.slots, name, type, size: blob.size, blob, meta: { title: row.title } });
        } else throw new Error('not a music file (VGM, VGZ, ZIP, MP3, OGG or WAV)');
      } catch (err) { row.error = err.message; }
    } catch (err) {
      report.push({ name, error: err.message });
    }
  }
  await settle(added);
  return { added, files: report };
}

/** The tracks without their data: [{ id, list, lists, name, type, size, meta }], in the order added; `list` filters by slot. */
/** Where a player may keep their own copy of the Sega soundtrack beside the game (the folder is git-ignored). */
export const LOCAL_MUSIC = 'original/sega-music.zip';

/**
 * The player's own soundtrack kept in the game's git-ignored original/ folder is imported once by itself, so a copy
 * already on the player's disk plays without the Original Game Files page; a changed file is imported again. Nothing
 * is fetched from anywhere else, and a missing file is quietly nothing. Resolves the import's report, or null.
 */
export async function importLocalMusic({ fetch: get = globalThis.fetch, url = LOCAL_MUSIC, format } = {}) {
  if (typeof get !== 'function') return null;
  let res;
  try { res = await get(url, { method: 'HEAD', cache: 'no-store' }); } catch { return null; }
  if (res?.status !== 200) return null;   // the dev server answers 204 when the player keeps no copy there
  const stamp = `${res.headers?.get?.('content-length') ?? ''}|${res.headers?.get?.('last-modified') ?? ''}`;
  if ((await meta('localMusic', null)) === stamp) return null;   // already in: the file is not even downloaded
  try { res = await get(url, { cache: 'no-store' }); } catch { return null; }
  if (res?.status !== 200) return null;
  const data = await res.arrayBuffer();
  const report = await importMusic([{ name: url.split('/').pop(), data }], format ? { format } : {});
  if (!report.files.some((f) => f.error && !f.from)) await setMeta('localMusic', stamp);
  return report;
}

export async function listTracks(list) {
  const all = await (await db()).all('tracks');
  return all.filter((t) => !list || slotsOf(t).includes(list)).sort((a, b) => a.id - b.id)
    .map((t) => ({ id: t.id, list: t.list ?? '', lists: slotsOf(t), name: t.name, type: t.type, size: t.size, meta: t.meta ?? null }));
}

/** Puts a track in these slots (none: kept, but not played). */
export async function assignTrack(id, lists) {
  const s = await db(), t = await s.get('tracks', id);
  if (!t) throw new Error('that track is gone');
  const slots = [...new Set(lists ?? [])].filter((n) => SLOTS.includes(n));
  await s.put('tracks', { ...t, list: slots[0] ?? '', lists: slots });
  notify('playlists');
}

export async function removeTrack(id) { await (await db()).delete('tracks', id); notify('playlists'); }

/** One track with its data ({ id, name, type, data, meta }), for the Music Test to play; null when it is gone. */
export async function trackData(id) {
  const t = await (await db()).get('tracks', id);
  return t ? { id: t.id, name: t.name, type: t.type, data: await t.blob.arrayBuffer(), meta: t.meta ?? null } : null;
}

/** Contract with the music (src/audio/music): a slot's tracks as [{ id, name, type, data: ArrayBuffer, meta }]; empty when there are none. */
export async function playlistTracks(name) {
  if (!PLAYLISTS.includes(name)) return [];
  const all = (await (await db()).all('tracks')).filter((t) => slotsOf(t).includes(name)).sort((a, b) => a.id - b.id);
  const out = [];
  for (const t of all) {
    try { out.push({ id: t.id, name: t.name, type: t.type, data: await t.blob.arrayBuffer(), meta: t.meta ?? null }); } catch { /* a track the browser lost: skipped */ }
  }
  return out;
}

/**
 * These slots' tracks (every slot's by default; { slot: [...] } as playlistTracks gives them) in one read; a track in
 * two slots is one object in both. Only the tracks in these slots are read (a battle need not hold the menu's music).
 */
export async function playlists(names = SLOTS) {
  const want = SLOTS.filter((n) => names.includes(n));
  const all = (await (await db()).all('tracks')).sort((a, b) => a.id - b.id), out = Object.fromEntries(want.map((n) => [n, []]));
  for (const t of all) {
    const lists = slotsOf(t).filter((n) => want.includes(n));
    if (!lists.length) continue;
    let data;
    try { data = await t.blob.arrayBuffer(); } catch { continue; }   // a track the browser lost: skipped
    const item = { id: t.id, name: t.name, type: t.type, data, meta: t.meta ?? null };
    for (const n of lists) out[n].push(item);
  }
  return out;
}
