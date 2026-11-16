// The module Worker the original pictures are made in (picture-jobs.js starts one each time they are made): each
// message { id, job } is answered with { id, result } — pictureWork(job) (picture-work.js), the very function the
// page's thread runs where there is no Worker — or with { id, error } when it throws. The job's pixels arrive as
// transferred buffers; nothing of the page is touched here. Loaded outside a Worker (the tests), it only exports serve.
import { pictureWork } from './picture-work.js';

/** Answers the jobs posted to `scope` (a Worker's global scope, or a stand-in for one). */
export function serve(scope) {
  scope.addEventListener('message', async ({ data }) => {
    const { id, job } = data ?? {};
    let reply;
    try { reply = { id, result: await pictureWork(job) }; } catch (err) { reply = { id, error: String(err?.message ?? err) }; }
    try { scope.postMessage(reply); } catch (err) { scope.postMessage({ id, error: String(err?.message ?? err) }); }   // a reply that cannot be sent still answers
  });
}

if (typeof globalThis.WorkerGlobalScope === 'function' && globalThis instanceof globalThis.WorkerGlobalScope) serve(globalThis);
