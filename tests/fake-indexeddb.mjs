// A small stand-in for IndexedDB under Node, enough for src/core/user-files.js: open with an upgrade,
// object stores with a key path (and auto-increment), one-store transactions that commit or abort after
// the current task, values stored as structured clones. `quota` bytes, once exceeded, aborts the
// transaction with a QuotaExceededError; `failOpen` makes open() fail, as a browser blocking site data does.
const later = (fn) => setTimeout(fn, 0);

function sizeOf(v) {
  if (v instanceof Blob) return v.size;
  if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return v.byteLength;
  if (v && typeof v === 'object') return Object.values(v).reduce((s, x) => s + sizeOf(x), 0);
  return 8;
}

export function fakeIndexedDB({ quota = Infinity, failOpen = false } = {}) {
  const dbs = new Map();
  const idb = {
    dbs,
    opens: 0,
    open(name, version) {
      const req = { result: null, error: null };
      idb.opens++;
      later(() => {
        if (failOpen) { req.error = new Error('The user denied permission to access the database.'); req.onerror?.(); return; }
        let rec = dbs.get(name);
        const upgrade = !rec || rec.version < version;
        if (!rec) dbs.set(name, (rec = { version, stores: new Map() }));
        req.result = database(rec, () => quota);
        if (upgrade) { rec.version = version; req.onupgradeneeded?.(); }
        req.onsuccess?.();
      });
      return req;
    },
  };
  return idb;
}

function database(rec, quota) {
  return {
    objectStoreNames: { contains: (n) => rec.stores.has(n) },
    createObjectStore(n, { keyPath, autoIncrement = false } = {}) { rec.stores.set(n, { keyPath, autoIncrement, data: new Map(), next: 1 }); },
    close() {},
    transaction(n, mode = 'readonly') {
      const st = rec.stores.get(n);
      if (!st) throw new DOMException(`no store ${n}`, 'NotFoundError');
      const staged = new Map(st.data), tx = { error: null, oncomplete: null, onabort: null, onerror: null };
      let next = st.next;
      const request = (fn) => {
        const r = { result: undefined, error: null };
        if (!tx.error) { try { r.result = fn(); } catch (e) { r.error = e; tx.error = e; } }
        return r;
      };
      const write = () => { if (mode !== 'readwrite') throw new DOMException('read-only transaction', 'ReadOnlyError'); };
      tx.objectStore = () => ({
        put(value) {
          return request(() => {
            write();
            const v = structuredClone(value);
            if (st.autoIncrement && v[st.keyPath] === undefined) v[st.keyPath] = next++;
            const key = v[st.keyPath];
            if (key === undefined) throw new DOMException('no key', 'DataError');
            staged.set(key, v);
            const used = [...staged.values()].reduce((s, x) => s + sizeOf(x), 0);
            if (used > quota()) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
            return key;
          });
        },
        get: (key) => request(() => structuredClone(staged.get(key))),
        getAll: () => request(() => [...staged.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map((k) => structuredClone(staged.get(k)))),
        delete: (key) => request(() => { write(); staged.delete(key); }),
        clear: () => request(() => { write(); staged.clear(); }),
      });
      later(() => {
        if (tx.error) { tx.onerror?.(); tx.onabort?.(); return; }
        st.data = staged;
        st.next = next;
        tx.oncomplete?.();
      });
      return tx;
    },
  };
}
