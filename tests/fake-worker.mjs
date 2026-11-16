// A stand-in for the browser's module Worker in Node, which has none: each FakeWorker runs the real worker script's
// serve() (src/ui/campaign/picture-worker.js) on a scope of its own in this process. Messages cross by
// structuredClone a turn later, the transferred buffers detached on the sending side as a browser detaches them.
// `hold` keeps the jobs posted to it until release(); fail() fires 'error' (the script did not load, or broke) or
// 'messageerror'; `reply` rewrites what the worker answers. It counts the listeners on it and remembers what was
// posted, so a test can see a job go over, the Worker end, and nothing left listening.
import { serve } from '../src/ui/campaign/picture-worker.js';

export function fakeWorkers({ hold = false, reply = (data) => data } = {}) {
  const made = [];
  class FakeWorker {
    constructor(url, options) {
      Object.assign(this, { url: String(url), options, terminated: false, hold, held: [], posted: [], listeners: new Map() });
      this.scope = new EventTarget();
      this.scope.postMessage = (data) => {
        const copy = structuredClone(reply(data));
        setTimeout(() => this.deliver('message', { data: copy }), 0);
      };
      serve(this.scope);
      made.push(this);
    }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    /** How many listeners are on it. */
    get listening() { return [...this.listeners.values()].reduce((n, s) => n + s.size, 0); }
    deliver(type, init = {}) {
      if (this.terminated) return;   // a Worker ended says nothing more
      for (const fn of [...(this.listeners.get(type) ?? [])]) fn({ type, preventDefault() {}, ...init });
    }
    postMessage(data, transfer = []) {
      if (this.terminated) return;
      const copy = structuredClone(data, { transfer });
      this.posted.push({ data: copy, transfer });
      if (this.hold) this.held.push(copy);
      else setTimeout(() => this.scope.dispatchEvent(new MessageEvent('message', { data: copy })), 0);
    }
    /** The jobs held so far go to the worker, and the ones after go straight on. */
    release() {
      this.hold = false;
      for (const data of this.held.splice(0)) this.scope.dispatchEvent(new MessageEvent('message', { data }));
    }
    fail(type = 'error') { this.deliver(type); }
    terminate() { this.terminated = true; }
  }
  return { FakeWorker, made };
}

/** Runs `fn` with `Worker` on globalThis (undefined: none), as it was afterwards. */
export async function withWorker(Worker, fn) {
  const had = Object.hasOwn(globalThis, 'Worker'), was = globalThis.Worker;
  if (Worker === undefined) delete globalThis.Worker; else globalThis.Worker = Worker;
  try { return await fn(); } finally { if (had) globalThis.Worker = was; else delete globalThis.Worker; }
}
