// The original pictures' pixel work (picture-work.js) in a module Worker (picture-worker.js), so making them never
// holds the page still. pictureJobs() is one Worker for one making of the pictures (original-pictures.js): started
// with the first job, reused for the rest (the house on the screen's pictures, then the others when the browser is
// idle), ended by close() once they are made — or at once when the switch or the files change, which cancels the job
// it is doing (its promise rejects with an AbortError and nothing it made is used). Each job's pixels are copied and
// the copies transferred, so the caller's stay as they were. Where there is no Worker, or it cannot start, fails or
// errs, the job runs on the page's thread as it always did (pictureWork, with the caller's pauses between the steps),
// so the pictures come out the same either way, only sooner or later.
import { pictureWork } from './picture-work.js';

/** The error a cancelled job rejects with. */
export function cancelled() {
  const err = new Error('the picture job was cancelled');
  err.name = 'AbortError';
  return err;
}
export const isCancelled = (err) => err?.name === 'AbortError';

const startWorker = () => {
  if (typeof globalThis.Worker !== 'function') throw new Error('no Worker here');
  return new Worker(new URL('./picture-worker.js', import.meta.url), { type: 'module' });
};

/**
 * `job` to post: its typed arrays copied (an object met twice stays one object), and the copies' buffers to
 * transfer (moved to the Worker, not copied again).
 */
function forTransfer(job) {
  const seen = new Map(), transfer = [];
  const copy = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return seen.get(v);
    let out;
    if (ArrayBuffer.isView(v)) { out = v.slice(); transfer.push(out.buffer); }
    else if (Array.isArray(v)) { out = []; seen.set(v, out); for (const x of v) out.push(copy(x)); }
    else { out = {}; seen.set(v, out); for (const [k, x] of Object.entries(v)) out[k] = copy(x); }
    seen.set(v, out);
    return out;
  };
  return { job: copy(job), transfer };
}

/**
 * run(job, { pause }) resolves what pictureWork(job) makes: in the Worker, else on the page's thread with `pause()`
 * between the steps. close() ends the Worker and cancels what is under way; a job asked for after it rejects at
 * once. `start` makes the Worker (tests). status(): { started, live, failed, closed, pending } (tests, debugging).
 */
export function pictureJobs({ start = startWorker } = {}) {
  let worker = null, started = 0, failed = false, closed = false, nextId = 0;
  const pending = new Map();   // id → { job, pause, resolve, reject }
  // on the page's thread: a closed run stops at its next pause (a cancelled run's work is not wanted)
  const here = (job, pause) => pictureWork(job, { pause: async () => { await pause(); if (closed) throw cancelled(); } });
  const settleHere = (p) => { here(p.job, p.pause).then(p.resolve, p.reject); };
  const onMessage = ({ data }) => {
    const p = pending.get(data?.id);
    if (!p) return;
    pending.delete(data.id);
    if (data.error === undefined) p.resolve(data.result);
    else settleHere(p);   // it threw there: the page's thread does it as it did before (and throws as it did)
  };
  const stop = () => {
    if (!worker) return;
    worker.removeEventListener('message', onMessage);
    worker.removeEventListener('error', onError);
    worker.removeEventListener('messageerror', onError);
    worker.terminate();
    worker = null;
  };
  // the Worker cannot do them (its script did not load, it broke, a message did not arrive whole): what it had and
  // every job after on the page's thread
  function onError(e) {
    e?.preventDefault?.();
    failed = true;
    stop();
    const left = [...pending.values()];
    pending.clear();
    for (const p of left) settleHere(p);
  }
  const ready = () => {
    if (!worker && !failed) {
      try {
        worker = start();
        started++;
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        worker.addEventListener('messageerror', onError);
      } catch {   // no Worker, no module Workers, or not allowed here (a page opened from a file)
        if (worker) stop();
        failed = true;
      }
    }
    return worker;
  };
  return {
    run(job, { pause = async () => {} } = {}) {
      if (closed) return Promise.reject(cancelled());
      if (!ready()) return here(job, pause);
      return new Promise((resolve, reject) => {
        const id = ++nextId, p = { job, pause, resolve, reject };
        pending.set(id, p);
        try {
          const out = forTransfer(job);
          worker.postMessage({ id, job: out.job }, out.transfer);
        } catch {   // it could not be posted: here
          pending.delete(id);
          settleHere(p);
        }
      });
    },
    close() {
      if (closed) return;
      closed = true;
      stop();
      const left = [...pending.values()];
      pending.clear();
      for (const p of left) p.reject(cancelled());
    },
    status: () => ({ started, live: !!worker, failed, closed, pending: pending.size }),
  };
}
