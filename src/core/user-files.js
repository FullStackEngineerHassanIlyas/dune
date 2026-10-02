// The player's own files (spec §6 Original files): clips read out of the .PAK files of their own Dune II
// PC copy, and MP3/OGG/WAV tracks for the menu, peace and battle playlists. All of it stays in this
// browser — IndexedDB, or memory for the session where the browser keeps no site data — and nothing is
// uploaded. The Original Game Files page (src/ui/original-files.js) fills it; the announcer
// (src/audio/voice.js) and the sound engine (src/audio/engine.js) read the clips when "Use the original
// sounds" is on, the music reads its playlists through playlistTracks(). Whoever reads the clips can
// follow() the store and is told (originalsChanged()) when the player changes them; the store holds
// followers weakly, so a finished battle's engine is not kept alive by it.
import { readPak } from '../formats/pak.js';
import { readVoc } from '../formats/voc.js';
import { clipKey, summarize, resolveEffects, effectSample } from '../formats/dune2-sounds.js';

export const PLAYLISTS = ['menu', 'peace', 'battle'];
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

/** `target.originalsChanged()` will be called when the clips or the switch change, while the target lives. */
export function follow(target) {
  if (typeof WeakRef === 'function') followers.add(new WeakRef(target));
}

/** The live followers (the debug hooks read what they hold). */
export function followed() {
  const live = [];
  for (const ref of followers) { const t = ref.deref(); if (t) live.push(t); else followers.delete(ref); }
  return live;
}

export function notify() {
  for (const t of followed()) try { t.originalsChanged?.(); } catch (err) { console.warn('original files:', err); }
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

/** The audio type the first bytes give away (MP3, OGG or WAV), or null. */
export function sniffAudio(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const text = (i, s) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (text(0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (text(0, 'OggS')) return 'audio/ogg';
  if (text(0, 'RIFF') && text(8, 'WAVE')) return 'audio/wav';
  return null;
}

/**
 * Adds tracks ([File] or [{ name, data: ArrayBuffer }]) to playlist `list` ('menu', 'peace' or 'battle').
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
      const head = f.data !== undefined ? (ArrayBuffer.isView(f.data) ? new Uint8Array(f.data.buffer, f.data.byteOffset, f.data.byteLength) : new Uint8Array(f.data)).subarray(0, 12) : new Uint8Array(await f.slice(0, 12).arrayBuffer());
      const type = sniffAudio(head);
      if (!type) throw new Error('not an MP3, OGG or WAV file');
      const blob = f.data !== undefined ? new Blob([f.data], { type }) : f;
      await s.put('tracks', { list, name, type, size: blob.size, blob });
      added++;
    } catch (err) {
      row.error = /quota/i.test(`${err?.name} ${err?.message}`) ? 'not enough storage space left in this browser' : err.message;
    }
  }
  if (added) try { await globalThis.navigator?.storage?.persist?.(); } catch { /* best effort: ask the browser not to evict them */ }
  return { added, files: report };
}

/** A playlist's tracks without their data: [{ id, list, name, type, size }], in the order added. */
export async function listTracks(list) {
  const all = await (await db()).all('tracks');
  return all.filter((t) => !list || t.list === list).sort((a, b) => a.id - b.id).map(({ id, list: l, name, type, size }) => ({ id, list: l, name, type, size }));
}

export async function removeTrack(id) { await (await db()).delete('tracks', id); }

/** Contract with the music (src/audio/music): a playlist's tracks as [{ name, type, data: ArrayBuffer }]; empty when there are none. */
export async function playlistTracks(name) {
  if (!PLAYLISTS.includes(name)) return [];
  const all = (await (await db()).all('tracks')).filter((t) => t.list === name).sort((a, b) => a.id - b.id);
  const out = [];
  for (const t of all) {
    try { out.push({ name: t.name, type: t.type, data: await t.blob.arrayBuffer() }); } catch { /* a track the browser lost: skipped */ }
  }
  return out;
}
