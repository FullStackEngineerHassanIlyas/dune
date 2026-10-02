// One track playing (spec §6 Music): its compiled score (score.js) stepped through sample by sample, its channels'
// FM voices (fm.js) and drum kit (drums.js), and a ping-pong echo of its own whose time follows the track's tempo.
// The intro plays once, then the loop body over and over; after `passes` passes (0: for ever) it stops sequencing
// and rings out — release tails and echoes — before it reports itself done. Work is split at every event and at
// least every CONTROL samples, where pitch glides, vibrato and fades move on.
import { FmVoice, preparePatch } from './fm.js';
import { DrumKit } from './drums.js';
import { ON, OFF, SLIDE, HIT } from './score.js';

export const CONTROL = 32;     // samples between control updates (0.7 ms at 48 kHz)
const MAX_ECHO = 1.5;          // seconds of echo line
const TAIL = 4;                // seconds a finished track may ring on at most

const dbGain = (db) => Math.pow(10, db / 20);
const panGains = (pan) => { const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4; return [Math.cos(a), Math.sin(a)]; };

export class Deck {
  /** compiled: from score.compile; patches: name → raw patch; passes: loop passes before it ends (0: never). */
  constructor(compiled, patches, rate, { passes = compiled.passes, prepared = new Map() } = {}) {
    this.score = compiled;
    this.id = compiled.id;
    this.rate = rate;
    this.passes = passes;
    this.pass = 0;
    this.sps = (rate * 60) / (compiled.bpm * compiled.beat);   // samples per step
    this.swing = compiled.swing;
    this.channels = compiled.channels.map((d) => {
      const [gl, gr] = panGains(d.pan), vol = dbGain(d.vol);
      if (d.drums) return { d, drums: new DrumKit(rate, 0x5eed + d.name.length), vol, echo: d.echo };
      let patch = prepared.get(d.patch);
      if (!patch) { patch = preparePatch(patches[d.patch]); prepared.set(d.patch, patch); }
      const voices = Array.from({ length: d.voices }, () => { const v = new FmVoice(rate); v.setPatch(patch); v.glide = d.glide; return v; });
      return { d, voices, vol, gl: gl * vol, gr: gr * vol, echo: d.echo };
    });
    this.section = compiled.intro.len ? compiled.intro : compiled.loop;
    this.inLoop = !compiled.intro.len;
    this.start = 0;       // sample at which the current section began (fractional)
    this.next = 0;        // index of the next event in the section
    this.pos = 0;         // samples rendered
    this.ending = false;  // sequencing stopped: ringing out
    this.endedAt = 0;
    this.done = false;
    this.gain = 1;        // fade level
    this.fadeTo = 1;
    this.fadeStep = 0;    // per sample
    const e = compiled.echo, echoLen = Math.min(Math.round(MAX_ECHO * rate), Math.max(1, Math.round(e.steps * this.sps)));
    this.echo = { L: new Float32Array(echoLen), R: new Float32Array(echoLen), i: 0, fb: e.feedback, wet: e.wet, damp: e.damp, lpL: 0, lpR: 0 };
    this.mono = new Float32Array(CONTROL);
    this.sendL = new Float32Array(CONTROL);
    this.sendR = new Float32Array(CONTROL);
    this.drumL = new Float32Array(CONTROL);
    this.drumR = new Float32Array(CONTROL);
  }

  /** Sample at which an event at step t of the current section falls: odd steps late by the swing. */
  eventSample(t) {
    const whole = Math.floor(t);
    return Math.round(this.start + (t + (whole & 1 ? this.swing : 0)) * this.sps);
  }

  sectionEnd() { return Math.round(this.start + this.section.len * this.sps); }

  fade(to, seconds) {
    this.fadeTo = to;
    const n = Math.max(1, seconds * this.rate);
    this.fadeStep = (to - this.gain) / n;
    if (seconds <= 0) { this.gain = to; this.fadeStep = 0; }
  }

  /** Stops sequencing now: every note lets go, and the track rings out. */
  finish() {
    if (this.ending) return;
    this.ending = true;
    this.endedAt = this.pos;
    for (const c of this.channels) if (c.voices) for (const v of c.voices) v.noteOff();
  }

  fire(e) {
    const c = this.channels[e.ch];
    if (e.type === HIT) { c.drums.hit(e.piece, e.vel); return; }
    const v = c.voices[e.sub];
    if (e.type === ON) v.noteOn(e.note, e.vel);
    else if (e.type === SLIDE) { if (v.silent) v.noteOn(e.note, e.vel); else v.slide(e.note, e.vel); }
    else if (e.type === OFF) v.noteOff();
  }

  /** Runs the events due at this sample; wraps the loop body; ends after the passes asked for. */
  sequence() {
    for (;;) {
      if (this.ending) return Infinity;
      const s = this.section, ev = s.events;
      if (this.next < ev.length) {
        const at = this.eventSample(ev[this.next].t);
        if (at > this.pos) return at;
        this.fire(ev[this.next++]);
        continue;
      }
      const end = this.sectionEnd();
      if (end > this.pos) return end;
      // the section is over: on into the loop body (again)
      if (!this.score.loop.len) { this.finish(); return Infinity; }
      if (this.inLoop) {
        this.pass++;
        if (this.passes && this.pass >= this.passes) { this.finish(); return Infinity; }
      }
      this.start += s.len * this.sps;
      this.section = this.score.loop;
      this.inLoop = true;
      this.next = 0;
    }
  }

  get silent() {
    for (const c of this.channels) {
      if (c.drums ? c.drums.busy : c.voices.some((v) => !v.silent)) return false;
    }
    return true;
  }

  /** Adds n samples of this track into L/R from `at`. */
  render(L, R, at, n) {
    let i = 0;
    while (i < n) {
      const due = this.sequence();
      const len = Math.min(n - i, CONTROL, due - this.pos);
      this.block(L, R, at + i, len);
      i += len;
      this.pos += len;
    }
    if (this.ending && !this.done && (this.pos - this.endedAt > TAIL * this.rate || (this.silent && this.pos - this.endedAt > this.echo.L.length * 3))) this.done = true;
    if (this.gain <= 0 && this.fadeTo <= 0) this.done = true;
  }

  block(L, R, at, n) {
    // the fade moves once a block: 0.7 ms steps are smooth enough for a crossfade lasting seconds
    if (this.fadeStep) {
      this.gain += this.fadeStep * n;
      if ((this.fadeStep > 0 && this.gain >= this.fadeTo) || (this.fadeStep < 0 && this.gain <= this.fadeTo)) { this.gain = this.fadeTo; this.fadeStep = 0; }
    }
    const g = this.gain * this.score.gain, mono = this.mono, sL = this.sendL, sR = this.sendR;
    sL.fill(0, 0, n); sR.fill(0, 0, n);
    for (const c of this.channels) {
      if (c.drums) {
        // the kit is stereo: straight in, and a little of it into the echo
        if (!c.drums.busy) continue;
        const dL = this.drumL, dR = this.drumR, gd = c.vol * g, ed = gd * c.echo;
        dL.fill(0, 0, n); dR.fill(0, 0, n);
        c.drums.render(dL, dR, 0, n, 1);
        for (let k = 0; k < n; k++) {
          L[at + k] += dL[k] * gd; R[at + k] += dR[k] * gd;
          sL[k] += dL[k] * ed; sR[k] += dR[k] * ed;
        }
        continue;
      }
      let any = false;
      mono.fill(0, 0, n);
      for (const v of c.voices) {
        if (v.render(mono, 0, n)) any = true;
      }
      if (!any) continue;
      const gl = c.gl * g, gr = c.gr * g, el = gl * c.echo, er = gr * c.echo;
      if (c.echo) {
        for (let k = 0; k < n; k++) {
          const m = mono[k];
          L[at + k] += m * gl; R[at + k] += m * gr;
          sL[k] += m * el; sR[k] += m * er;
        }
      } else for (let k = 0; k < n; k++) { L[at + k] += mono[k] * gl; R[at + k] += mono[k] * gr; }
    }
    // the echo: each side's repeats cross to the other, darker each time
    const e = this.echo, len = e.L.length, damp = e.damp, fb = e.fb, wet = e.wet;
    let j = e.i, lpL = e.lpL, lpR = e.lpR;
    for (let k = 0; k < n; k++) {
      const yl = e.L[j], yr = e.R[j];
      lpL += (yr - lpL) * (1 - damp); lpR += (yl - lpR) * (1 - damp);
      e.L[j] = sL[k] + fb * lpL; e.R[j] = sR[k] + fb * lpR;
      L[at + k] += yl * wet; R[at + k] += yr * wet;
      if (++j >= len) j = 0;
    }
    e.i = j; e.lpL = lpL; e.lpR = lpR;
  }
}
