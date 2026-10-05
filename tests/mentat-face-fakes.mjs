// Fakes for the Mentat face's tests (mentat-face.test.mjs, mentat-talk.test.mjs): a real timing track, a made-up one,
// a counting fake DOM built from the real portrait markup (portraits.js), a voice that emits what MentatVoice emits and
// a hand-cranked frame scheduler.
import { MentatTrack } from '../src/audio/mentat-voice.js';
import { mentatSvg } from '../src/ui/campaign/portraits.js';

// atreides/m1-advice as the voice renders it (assets/voice/mentat/atreides/m1-advice.json): a real track
export const ADVICE = {"v":1,"id":"atreides/m1-advice","ms":16855,"lines":["Lay concrete before anything else. Buildings set on","bare rock start weakened.","Then raise a Wind Trap for power, and after it a","Spice Refinery. The Refinery brings its own Harvester."],"words":[[93,305,0,0,3],[412,1183,0,4,12],[1263,1635,0,13,19],[1768,2220,0,20,28],[2353,2921,0,29,33],[3605,4216,0,35,44],[4323,4509,0,45,48],[4589,4695,0,49,51],[4775,5094,1,0,4],[5174,5706,1,5,9],[5839,6184,1,10,15],[6264,7019,1,16,24],[7695,7908,2,0,4],[7961,8280,2,5,10],[8333,8386,2,11,12],[8493,8785,2,13,17],[8865,9184,2,18,22],[9238,9291,2,23,26],[9397,10142,2,27,32],[10328,10408,2,34,37],[10514,10807,2,38,43],[10860,11046,2,44,46],[11126,11179,2,47,48],[11285,11844,3,0,5],[11924,12800,3,6,14],[13443,13522,3,16,19],[13575,14533,3,20,28],[14639,14985,3,29,35],[15038,15198,3,36,39],[15331,15597,3,40,43],[15677,16710,3,44,53]],"sentences":[[93,2921,0,4,"neutral"],[3605,7019,5,11,"neutral"],[7695,12800,12,24,"neutral"],[13443,16710,25,30,"neutral"]],"visemes":{"t":[0,93,146,305,412,491,598,837,917,1263,1316,1422,1475,1715,2007,2061,2433,2566,2921,3605,3658,3764,3844,4216,4323,4535,4642,4775,4828,5014,5174,5493,5706,5839,5945,6131,6264,6317,6583,6690,7019,7695,7748,7961,8014,8333,8386,8493,8546,8918,8972,9131,9238,9264,9397,9477,9663,9769,10142,10328,10355,10461,10567,10647,10700,10753,10860,11126,11179,11285,11392,11445,11631,11924,11977,12083,12136,12296,12402,12456,12562,12800,13443,13469,13575,13629,13762,13841,14001,14107,14161,14267,14533,14639,14693,14719,15278,15411,15517,15730,15943,16022,16368,16710],"s":"rlereoeoemefoelelermelereoemeaoereaeoeaerleoearoeoamfomaoaraeafeaoearemaeoefaeaoerlaoefaeaoermoeaoeafear"},"env":{"hz":30,"q":"00x____z__wjEmvuy_z-_-uiounzzzxwrWllSNE0q_ylfez_--pQ7vzz_--zwhasyyyzzzzzzxvutoswvvttnRD62000000000000000000h-zr_____zx_-yzz--zzwwwxvq-xwnt-zz--uld_yyyyyyyxxx-z-yxvjM52idUIC400lwxhn_yyzwdNcxx-_zxpRiiwyuuttsqjbNA81000000000000000000Wy-__zz___-_-yyz-_yxyzyxxwx__z----vhTuuozyxwnVCSddyqVestyxyyyxvvuttnPE00000000000x__-zxxuedZv-zyyxvblf400uzyxyxsXCT-wxyxyxvuwvsdHu-xngbc-yyz--zzwuutrsqlWH62000000000000000008v-_z___wkifdm_zz------yxyxxxvmL9452007__zz--_zwx_vdlykME-z---yyzyzsnoq_yyzzwqwyvvwwvQhvvutsmZTPCE70000"}};

/**
 * A made-up track: sentences [startMs, endMs, expression] with the mouth cycling `cycle` (track letters) every
 * `every` ms inside each and the voice loud (`loud` 0..63) there, quiet between.
 */
export function synth(sentences, { cycle = 'maeofl', every = 110, loud = 50, tail = 600 } = {}) {
  const ms = sentences.at(-1)[1] + tail;
  const vt = [0], vs = ['r'], words = [], sents = [];
  sentences.forEach(([a, b, expression], i) => {
    for (let t = a, k = 0; t < b; t += every, k++) { vt.push(t); vs.push(cycle[k % cycle.length]); }
    vt.push(b); vs.push('r');
    words.push([a, b, i, 0, 4]);
    sents.push([a, b, i, i, expression]);
  });
  const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
  let q = '';
  for (let f = 0; f < Math.ceil((ms / 1000) * 30); f++) {
    const t = (f / 30) * 1000, on = sentences.some(([a, b]) => t >= a && t <= b);
    q += B64[on ? (f % 3 === 0 ? Math.round(loud * 0.6) : loud) : 0];
  }
  return { v: 1, id: 'test/synth', ms, lines: sentences.map((_, i) => `Line ${i}.`), words, sentences: sents, visemes: { t: vt, s: vs.join('') }, env: { hz: 30, q } };
}

export const clone = (o) => JSON.parse(JSON.stringify(o));

// ---- a counting fake DOM, enough for the portrait's boxes and the face's SVG ----
export class FakeEl {
  constructor(doc, tag) {
    // the ways back up (the document, the parent) are not enumerable: an assertion that fails on an element prints
    // the element and what is under it, not the whole fake page again through every element's way back up (node's
    // assert diffs what it prints, and a page of faces printed that way took gigabytes). Tests still compare nodes
    // by identity (assert.ok(a === b)), never with assert.equal.
    Object.defineProperty(this, 'ownerDocument', { value: doc, writable: true, configurable: true, enumerable: false });
    Object.defineProperty(this, 'parentNode', { value: null, writable: true, configurable: true, enumerable: false });
    this.localName = tag; this.tagName = tag; this.nodeType = 1;
    this.attrs = new Map(); this.childNodes = [];
    // the style's transform is counted (and watched) like an attribute: the head's boxes are moved by it
    const el = this;
    this.style = { visibility: '', set transform(v) { el.ownerDocument.sets++; this.t = v; if (el.ownerDocument.watch !== null) el.ownerDocument.watch(v); }, get transform() { return this.t ?? ''; } };
  }
  setAttribute(k, v) { const d = this.ownerDocument; d.sets++; this.attrs.set(k, v); if (d.watch !== null) d.watch(v); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  appendChild(n) { n.parentNode?.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
  insertBefore(n, ref) {
    if (!ref) return this.appendChild(n);
    n.parentNode?.removeChild(n);
    this.childNodes.splice(this.childNodes.indexOf(ref), 0, n);
    n.parentNode = this;
    return n;
  }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) this.childNodes.splice(i, 1); n.parentNode = null; return n; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get nextSibling() { const p = this.parentNode; return p ? p.childNodes[p.childNodes.indexOf(this) + 1] ?? null : null; }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === this.ownerDocument.body; }
  matches(sel) { return sel.startsWith('.') ? (this.attrs.get('class') ?? '').split(/\s+/).includes(sel.slice(1)) : this.localName === sel; }
  querySelector(sel) {
    for (const c of this.childNodes) { if (c.matches(sel)) return c; const f = c.querySelector(sel); if (f) return f; }
    return null;
  }
  querySelectorAll(sel) { const out = []; const walk = (n) => { for (const c of n.childNodes) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
}
export function fakeDocument() {
  const doc = { created: 0, sets: 0, watch: null };
  doc.createElementNS = (ns, tag) => { doc.created++; return new FakeEl(doc, tag); };
  doc.createElement = (tag) => { doc.created++; return new FakeEl(doc, tag); };
  doc.body = new FakeEl(doc, 'body');
  return doc;
}
/** The portrait's markup (mentatSvg) as fake elements: tags and attributes, the <style>'s text left out. */
export function parseSvg(doc, markup) {
  const root = new FakeEl(doc, '#root');
  const stack = [root];
  for (const m of markup.replace(/<style>[\s\S]*?<\/style>/, '<style/>').matchAll(/<(\/?)([\w-]+)([^>]*?)(\/?)>/g)) {
    const [, close, tag, attrs, self] = m;
    if (close) { stack.pop(); continue; }
    const el = new FakeEl(doc, tag);
    for (const [, k, v] of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) el.attrs.set(k, v);
    stack.at(-1).appendChild(el);
    if (!self && tag !== 'img') stack.push(el);   // an <img> has no end tag
  }
  return root.childNodes[0];
}
export const shape = (n) => `${n.localName}${[...n.attrs].map(([k, v]) => ` ${k}=${v}`).join('')}[${n.childNodes.map(shape).join(',')}]`;

/** A stage as mentatStage makes it: the section in the page, the figure with the portrait's boxes, the voice. */
export function makeStage(house, voice, { attach = true } = {}) {
  const doc = fakeDocument();
  const el = new FakeEl(doc, 'section'), portrait = new FakeEl(doc, 'figure');
  const svg = parseSvg(doc, mentatSvg(house));
  portrait.appendChild(svg);
  el.appendChild(portrait);
  if (attach) doc.body.appendChild(el);
  return { doc, el, portrait, svg, voice };
}

/** A voice like MentatVoice for the face: on(), current, now(out); play() / end() as the real one emits them. */
export function fakeVoice(json) {
  const track = new MentatTrack(json);
  const clock = new Float64Array(1);
  const listeners = { line: new Set(), end: new Set() };
  const line = { state: 'loading', track, duration: track.duration, at(t, out) { return track.at(t, out); }, now(out) { return track.at(clock[0], out); } };
  return {
    enabled: true, current: null, clock, listeners, line, track,
    on(type, fn) { listeners[type].add(fn); return () => listeners[type].delete(fn); },
    now(out) {
      const l = this.current;
      if (l !== null && l.state === 'playing') return l.now(out);
      out.t = 0; out.speaking = false; out.from = out.shape; out.shape = 0; out.viseme = 'rest'; out.mix = 1; out.open = 0; out.word = -1; out.sentence = -1;
      return out;
    },
    play() { line.state = 'playing'; this.current = line; clock[0] = 0; for (const fn of [...listeners.line]) fn(line); },
    end(reason = 'ended') { line.state = reason; this.current = null; for (const fn of [...listeners.end]) fn(line, reason); },
  };
}

/** The frame scheduler, cranked by hand: step(ms) runs the pending frame `ms` later (and moves the voice's clock). */
export function frames(voice) {
  const d = { pending: null, id: 0, ms: 0, requests: 0 };
  d.raf = (fn) => { d.pending = fn; d.requests++; return ++d.id; };
  d.caf = (id) => { if (id === d.id) d.pending = null; };
  d.step = (dms = 16) => {
    d.ms += dms;
    if (voice && voice.current !== null) voice.clock[0] += dms / 1000;
    const fn = d.pending;
    d.pending = null;
    if (fn !== null) fn(d.ms);
    return fn !== null;
  };
  d.run = (seconds, each = null) => { for (let i = 0, n = Math.round(seconds * 60); i < n; i++) { d.step(i % 3 === 2 ? 18 : 16); each?.(); } };
  return d;
}

