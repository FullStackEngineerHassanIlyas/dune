// One VGM playing (spec §6 Original files; research music.md §2.3, contract C8): the player's own rip of a
// Mega Drive track, replayed through the YM2612 (chips/ym2612.js, a port of ymfm) and the PSG
// (chips/sn76489.js). It has Deck's shape (deck.js), so MusicMixer crossfades, queues and rings it out the
// same way: id, delay, gain, pass, ending, pos, endedAt, done; fade(), render() adds into L/R, finish().
//
// Time: the chips run at the YM2612's own rate (clock / 144, 53,267 Hz on an NTSC console), the PSG's steps
// averaged into the same frames; a command logged at VGM sample s (44,100 a second) takes effect before
// chip frame round(s x rate / 44100), in exact integers, however long the track runs. A polyphase
// windowed-sinc filter takes the frames to the context's rate (passed straight through when they match).
// The log: data blocks (type 0x00 is the YM2612's PCM bank) are found by a scan that runs ahead of the
// player, a little each block, so a large file costs the audio thread nothing up front and a loop never
// appends them twice; 0xE0 seeks in the bank, 0x8n writes a bank byte to the DAC then waits n (not n+1);
// DAC streams 0x90-0x95 write at their own frequency. Passes count loops (0 = for ever); a file without a
// loop point starts again from the top; a loop that takes no time ends the track rather than spin. finish()
// keys every channel off and the track rings out until silent or 4 s, fading over the last second (a note
// with no release would otherwise stop with a click). Loads in an AudioWorkletGlobalScope:
// static imports only, no DOM, nothing allocated per block, and render() never throws (a broken file stops
// with `error` set).
import { readHeader, commandLength, VgmError, VGM_RATE } from '../../formats/vgm.js';
import { YM2612, YM_CLOCKS_PER_SAMPLE } from './chips/ym2612.js';
import { SN76489 } from './chips/sn76489.js';

const TAIL = 4;              // seconds a finished track may ring on at most
const TAIL_FADE = 1;         // and the last of them a fade, so a note still sounding is not cut with a click
const CHUNK = 1024;          // output samples worked out at a time
const TAPS = 32;             // resampler taps (each output weighs 32 chip frames)
const HALF = TAPS / 2;
const PHASES = 64;           // filter phases, linearly interpolated between
const BETA = 7;              // Kaiser window: about 70 dB down outside the band
const SCAN_STEP = 8192;      // commands the data-block scan reads ahead per block
const FULL = 32768;          // chip output that maps to 1.0
// The PSG against the YM2612: a full-volume tone swings a quarter of a full-level FM carrier, Genesis Plus GX's
// balance tuned to a VA4 Model 1 (a PSG channel 2,800 x 1.5 against an FM channel's 14 bits). Measured on the
// rips, libvgm's defaults put the PSG 1.1 dB above that; 0.5 here was 3.4 dB above it.
export const PSG_LEVEL = 0.34;
const VGM_DEN = YM_CLOCKS_PER_SAMPLE * VGM_RATE;   // chip frames per VGM sample = clock / VGM_DEN

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

function bessel0(x) {
  let sum = 1, term = 1;
  for (let k = 1; k < 30; k++) { term *= (x / (2 * k)) ** 2; sum += term; }
  return sum;
}

/** Filter rows for fractional positions 0, 1/PHASES ... 1: TAPS weights each, summing to 1. */
const TABLES = new Map();   // by cutoff: every track at one context rate shares one

function filterTable(cutoff) {
  const t = new Float32Array((PHASES + 1) * TAPS), norm = bessel0(BETA);
  for (let p = 0; p <= PHASES; p++) {
    const f = p / PHASES;
    let sum = 0;
    for (let j = 0; j < TAPS; j++) {
      const d = j - HALF + 1 - f;                  // distance of tap j from the output point, in frames
      const x = 2 * cutoff * d;
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const r = d / HALF;
      const w = Math.abs(r) >= 1 ? 0 : bessel0(BETA * Math.sqrt(1 - r * r)) / norm;
      t[p * TAPS + j] = sinc * w;
      sum += sinc * w;
    }
    for (let j = 0; j < TAPS; j++) t[p * TAPS + j] /= sum;
  }
  // each weight beside its step to the next phase, so a fractional position costs one multiply-add
  const pairs = new Float32Array(PHASES * TAPS * 2);
  for (let p = 0; p < PHASES; p++) {
    for (let j = 0; j < TAPS; j++) {
      pairs[(p * TAPS + j) * 2] = t[p * TAPS + j];
      pairs[(p * TAPS + j) * 2 + 1] = t[(p + 1) * TAPS + j] - t[p * TAPS + j];
    }
  }
  return pairs;
}

export class VgmDeck {
  /** bytes: a plain VGM (Uint8Array). passes: loops before it ends (0: for ever). gain: on top of the file's own. */
  constructor(id, bytes, { sampleRate, passes = 0, gain = 1 } = {}) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    const h = readHeader(bytes);
    if (!h.clocks.ym2612 && !h.clocks.sn76489) throw new VgmError('the file has neither a YM2612 nor an SN76489');
    if (!(sampleRate > 0)) throw new VgmError('no sample rate');
    this.id = id;
    this.rate = sampleRate;
    this.header = h;
    this.bytes = bytes;
    // loops: the header's loop base and modifier adjust how many the caller asked for
    this.passes = passes > 0 ? Math.max(1, Math.round((passes * (h.loopModifier || 16)) / 16) - h.loopBase) : 0;
    this.pass = 0;
    this.delay = 0;
    this.gain = 1;
    this.fadeTo = 1;
    this.fadeStep = 0;
    this.pos = 0;
    this.ending = false;
    this.endedAt = 0;
    this.done = false;
    this.error = null;
    this.level = (gain * h.gain) / FULL;
    // chips: with no YM2612 the time base is the clock it would have beside this PSG
    this.clock = h.clocks.ym2612 || Math.round((h.clocks.sn76489 * 15) / 7);
    this.inRate = this.clock / YM_CLOCKS_PER_SAMPLE;
    this.ym = h.clocks.ym2612 ? new YM2612({ ym3438: h.ym3438 }) : null;
    // a silent YM2612 still outputs its DAC ladder's step on all six channels: taken off, so a track
    // starts and ends on silence rather than a step the mixer's high-pass would turn into a thump
    this.dc = this.ym && !h.ym3438 ? ((6 * 4 * 8192) / 390) | 0 : 0;
    this.psg = h.clocks.sn76489 ? new SN76489({ num: 9 * h.clocks.sn76489, den: this.clock, ...h.sn }) : null;
    // the log
    this.at = h.dataOffset;
    this.frame = 0;               // chip frames made
    this.due = 0;                 // frame before which the next command runs
    this.rem = VGM_DEN / 2;       // waits in exact integers (the half rounds to the nearest frame)
    this.passSamples = 0;
    this.dacPtr = 0;
    // data blocks by bank type: [{ at (file offset), size, start (offset in the bank) }]
    this.banks = [];
    this.bankSize = new Uint32Array(64);
    this.scanAt = h.dataOffset;
    this.scanDone = false;
    this.seg = 0;                 // last bank-0 block read (DAC reads are mostly in order)
    this.streams = [];
    this.streamMap = new Map();
    this.scan(SCAN_STEP);
    // the resampler: frames from bufBase on, with HALF - 1 frames of the silent chip before the first
    this.direct = Math.abs(this.inRate - sampleRate) < 1e-9;
    this.bufL = new Float32Array(Math.ceil((CHUNK * this.inRate) / sampleRate) + TAPS + 8);
    this.bufR = new Float32Array(this.bufL.length);
    this.bufLen = this.direct ? 0 : HALF - 1;
    this.bufL.fill(this.dc, 0, this.bufLen);
    this.bufR.fill(this.dc, 0, this.bufLen);
    this.bufBase = -this.bufLen;
    this.ipos = 0;                // input frame at or before the next output sample
    this.inum = 0;                // and how far past it, of D2
    this.D2 = YM_CLOCKS_PER_SAMPLE * sampleRate;
    this.stepInt = Math.floor(this.clock / this.D2);
    this.stepRem = this.clock % this.D2;
    const cutoff = 0.46 * Math.min(1, sampleRate / this.inRate);
    if (!this.direct && !TABLES.has(cutoff)) TABLES.set(cutoff, filterTable(cutoff));
    this.table = this.direct ? null : TABLES.get(cutoff);
  }

  get seconds() { return this.pos / this.rate; }

  fade(to, seconds) {
    this.fadeTo = to;
    const n = Math.max(1, seconds * this.rate);
    this.fadeStep = (to - this.gain) / n;
    if (seconds <= 0) { this.gain = to; this.fadeStep = 0; }
  }

  /** Stops the log now: every channel keys off, the PSG falls silent, streams stop; the chips ring out. */
  finish() {
    if (this.ending) return;
    this.ending = true;
    // the output sample at which the current chip frame is heard
    this.endedAt = Math.max(this.pos, Math.ceil((this.frame * this.D2) / this.clock));
    if (this.ym) this.ym.keyOffAll();
    if (this.psg) this.psg.silence();
    for (const s of this.streams) s.running = false;
  }

  // ---- the data-block scan --------------------------------------------------------------------------------

  /** Reads up to `budget` commands ahead, noting the data blocks; stops at the end of the data. */
  scan(budget) {
    const b = this.bytes, end = this.header.eof, version = this.header.version;
    let at = this.scanAt;
    while (budget-- > 0) {
      if (at >= end) { this.scanDone = true; break; }
      const c = b[at];
      let n;
      if (c === 0x66) { this.scanDone = true; break; }
      if (c >= 0x70 && c <= 0x8f) n = 1;
      else if (c === 0x52 || c === 0x53 || c === 0x61) n = 3;
      else if (c === 0x50) n = 2;
      else if (c === 0x67) {
        if (at + 7 > end) { this.scanDone = true; break; }
        const type = b[at + 2], size = u32(b, at + 3) & 0x7fffffff;
        n = 7 + size;
        if (at + n > end) { this.scanDone = true; break; }
        if (type < 0x40) {
          (this.banks[type] ||= []).push({ at: at + 7, size, start: this.bankSize[type] });
          this.bankSize[type] += size;
        }
      } else n = commandLength(b, at, end, version);
      if (n <= 0) { this.scanDone = true; break; }
      at += n;
    }
    this.scanAt = at;
  }

  /** Byte `p` of bank `type`, or -1 past its end. */
  bankByte(type, p) {
    const list = this.banks[type];
    if (!list || p >= this.bankSize[type] || p < 0) return -1;
    if (list.length === 1) return this.bytes[list[0].at + p];
    let k = type === 0 ? this.seg : 0;
    if (k >= list.length || p < list[k].start || p >= list[k].start + list[k].size) {
      let lo = 0, hi = list.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (list[mid].start <= p) lo = mid; else hi = mid - 1; }
      k = lo;
      if (type === 0) this.seg = k;
    }
    return this.bytes[list[k].at + p - list[k].start];
  }

  // ---- the command interpreter ----------------------------------------------------------------------------

  wait(n) {
    this.passSamples += n;
    this.rem += n * this.clock;
    const whole = Math.floor(this.rem / VGM_DEN);
    this.due += whole;
    this.rem -= whole * VGM_DEN;
  }

  /** Runs the commands due before the frame about to be made; returns when the next one lies ahead. */
  run() {
    const b = this.bytes, h = this.header, end = h.eof, ym = this.ym, psg = this.psg;
    while (this.due <= this.frame && !this.ending) {
      const at = this.at;
      if (!this.scanDone && at >= this.scanAt) this.scan(SCAN_STEP);
      if (at >= end) { this.endOfData(); continue; }
      const c = b[at];
      if (c >= 0x70 && c <= 0x7f) { this.at = at + 1; this.wait((c & 15) + 1); continue; }
      if (c >= 0x80 && c <= 0x8f) {
        const v = this.bankByte(0, this.dacPtr++);
        if (v >= 0 && ym) ym.write(0, 0x2a, v);
        this.at = at + 1;
        this.wait(c & 15);
        continue;
      }
      switch (c) {
        case 0x52: case 0x53:
          if (at + 3 > end) { this.endOfData(); continue; }
          if (ym) ym.write(c & 1, b[at + 1], b[at + 2]);
          this.at = at + 3; continue;
        case 0x50:
          if (at + 2 > end) { this.endOfData(); continue; }
          if (psg) psg.write(b[at + 1]);
          this.at = at + 2; continue;
        case 0x4f:
          if (at + 2 > end) { this.endOfData(); continue; }
          if (psg) psg.stereo(b[at + 1]);
          this.at = at + 2; continue;
        case 0x61:
          if (at + 3 > end) { this.endOfData(); continue; }
          this.at = at + 3; this.wait(u16(b, at + 1)); continue;
        case 0x62: this.at = at + 1; this.wait(735); continue;
        case 0x63: this.at = at + 1; this.wait(882); continue;
        case 0x66: this.endOfData(); continue;
        case 0x67: {
          if (at + 7 > end) { this.endOfData(); continue; }
          const n = 7 + (u32(b, at + 3) & 0x7fffffff);
          if (at + n > end) { this.endOfData(); continue; }
          this.at = at + n; continue;   // already in the bank (the scan runs ahead)
        }
        case 0xe0:
          if (at + 5 > end) { this.endOfData(); continue; }
          this.dacPtr = u32(b, at + 1); this.at = at + 5; continue;
        default: {
          const n = commandLength(b, at, end, h.version);
          if (n < 0) { this.endOfData(); continue; }   // undefined or cut short: the log stops (spec)
          if (c >= 0x90 && c <= 0x95) this.stream(c, at);
          this.at = at + n;   // otherwise another chip's command, skipped
        }
      }
    }
  }

  /** The end of the log: a pass is over; loop, start again, or finish. */
  endOfData() {
    this.pass++;
    const h = this.header, empty = this.passSamples === 0;
    this.passSamples = 0;
    if (empty || (this.passes && this.pass >= this.passes)) { this.finish(); return; }
    this.at = h.loopOffset || h.dataOffset;
  }

  // ---- DAC streams (0x90-0x95) ----------------------------------------------------------------------------

  stream(c, at) {
    const b = this.bytes, id = b[at + 1];
    if (id === 0xff) { if (c === 0x94) for (const s of this.streams) s.running = false; return; }
    let s = this.streamMap.get(id);
    if (c === 0x90) {
      if (!s) {
        s = { type: 0xff, part: 0, reg: 0, bank: 0, stepSize: 1, stepBase: 0, freq: 0, interval: 0, left: 0, total: 0, start: 0, step: 1, loop: false, running: false, next: 0 };
        this.streamMap.set(id, s);
        this.streams.push(s);
      }
      s.type = b[at + 2];   // 0x02 YM2612 (bit 7: a second chip, not played)
      s.part = b[at + 3];
      s.reg = b[at + 4];
      return;
    }
    if (!s) return;
    if (c === 0x91) { s.bank = b[at + 2] & 0x3f; s.stepSize = b[at + 3] || 1; s.stepBase = b[at + 4]; return; }
    if (c === 0x92) { s.freq = u32(b, at + 2); s.interval = s.freq ? this.inRate / s.freq : 0; if (!s.freq) s.running = false; return; }
    if (c === 0x94) { s.running = false; return; }
    let start = s.start, count, flags;
    if (c === 0x93) {
      const pos = u32(b, at + 2), mode = b[at + 6], len = u32(b, at + 7);
      if (pos !== 0xffffffff) start = pos + s.stepBase;
      const kind = mode & 0x0f;
      count = kind === 1 ? len : kind === 2 ? Math.round((len * s.freq) / 1000) : kind === 3 ? Math.floor((this.bankSize[s.bank] - start) / s.stepSize) : s.total;
      flags = mode;
    } else {   // 0x95: a whole block of the bank
      const list = this.banks[s.bank], k = u16(b, at + 2);
      if (!list || !list.length) return;
      const blk = list[k < list.length ? k : 0];
      start = blk.start + s.stepBase;
      count = Math.floor(blk.size / s.stepSize);
      flags = (b[at + 4] & 0x10) | ((b[at + 4] & 1) << 7);
    }
    s.start = start;
    s.total = Math.max(0, count);
    s.step = flags & 0x10 ? -s.stepSize : s.stepSize;
    s.left = s.total;
    s.loop = !!(flags & 0x80);
    s.next = this.frame;
    s.running = s.total > 0 && s.interval > 0 && (s.type & 0x7f) === 0x02 && !(s.type & 0x80) && !!this.ym;
  }

  /**
   * Writes the stream bytes due before frame f; returns the next frame any stream needs (or Infinity). Of the
   * bytes due in one frame only the last is heard (the DAC holds the last write), so only it is written: a
   * stream faster than the chip keeps its time, as VGMPlay's does, at one write a frame however fast it is.
   */
  serviceStreams(f) {
    let soonest = Infinity;
    for (const s of this.streams) {
      if (!s.running) continue;
      if (s.next <= f) {
        const played = s.total - s.left;                       // bytes of this pass already sent
        let k = Math.floor((f - s.next) / s.interval) + 1;     // bytes due by frame f
        if (!s.loop && k > s.left) k = s.left;
        const first = s.step < 0 ? s.start + (s.total - 1) * s.stepSize : s.start;
        const v = this.bankByte(s.bank, first + ((played + k - 1) % s.total) * s.step);
        if (v >= 0) this.ym.write(s.part & 1, s.reg, v);
        s.next += k * s.interval;
        if (!s.loop && played + k >= s.total) { s.running = false; continue; }
        s.left = s.total - ((played + k) % s.total);
      }
      if (s.next < soonest) soonest = s.next;
    }
    return soonest;
  }

  // ---- making frames --------------------------------------------------------------------------------------

  /** Appends `count` chip frames to the buffer, running commands and streams exactly on their frames. */
  produce(count) {
    const L = this.bufL, R = this.bufR, psgGain = PSG_LEVEL;
    let w = this.bufLen;
    while (count > 0) {
      if (!this.ending) this.run();
      let span = count;
      if (!this.ending) span = Math.min(span, this.due - this.frame);
      if (this.streams.length) {
        const next = this.serviceStreams(this.frame);
        if (next !== Infinity) span = Math.min(span, Math.max(1, Math.ceil(next) - this.frame));
      }
      if (this.ym) this.ym.generate(L, R, w, span);
      else { L.fill(0, w, w + span); R.fill(0, w, w + span); }
      if (this.psg) this.psg.render(L, R, w, span, psgGain);
      w += span;
      this.frame += span;
      count -= span;
    }
    this.bufLen = w;
  }

  /** Adds n samples of this track into L/R from `at`. */
  render(L, R, at, n) {
    try {
      for (let i = 0; i < n;) {
        const m = Math.min(n - i, CHUNK);
        if (this.direct) this.copy(L, R, at + i, m);
        else this.resample(L, R, at + i, m);
        i += m;
        this.pos += m;
      }
      if (!this.scanDone) this.scan(SCAN_STEP);
    } catch (err) {
      this.error = String((err && err.message) || err);
      this.ending = true;
      this.done = true;
      return;
    }
    if (this.ending && !this.done) {
      const after = this.pos - this.endedAt;
      if (after > TAIL * this.rate || (after > TAPS && (!this.ym || this.ym.silent))) this.done = true;
      else if (after > (TAIL - TAIL_FADE) * this.rate && this.fadeTo > 0) this.fade(0, TAIL - after / this.rate);
    }
    if (this.gain <= 0 && this.fadeTo <= 0) this.done = true;
  }

  /** The fade, one sample on. */
  stepGain() {
    if (this.fadeStep) {
      this.gain += this.fadeStep;
      if ((this.fadeStep > 0 && this.gain >= this.fadeTo) || (this.fadeStep < 0 && this.gain <= this.fadeTo)) { this.gain = this.fadeTo; this.fadeStep = 0; }
    }
    return this.gain * this.level;
  }

  copy(L, R, at, m) {
    this.bufLen = 0;
    this.produce(m);
    const bL = this.bufL, bR = this.bufR, dc = this.dc;
    for (let k = 0; k < m; k++) {
      const g = this.stepGain();
      L[at + k] += (bL[k] - dc) * g;
      R[at + k] += (bR[k] - dc) * g;
    }
  }

  resample(L, R, at, m) {
    const D2 = this.D2, sInt = this.stepInt, sRem = this.stepRem;
    // frames up to the last output's position plus half the filter
    const last = this.ipos + Math.floor((this.inum + (m - 1) * this.clock) / D2);
    const need = last + HALF - (this.bufBase + this.bufLen) + 1;
    if (need > 0) this.produce(need);
    const bL = this.bufL, bR = this.bufR, t = this.table, dc = this.dc;
    let ipos = this.ipos, inum = this.inum;
    for (let k = 0; k < m; k++) {
      const x = (inum / D2) * PHASES, p = x | 0, frac = x - p;
      let first = ipos - HALF + 1 - this.bufBase, sl = 0, sr = 0;
      for (let j = 0, q = p * TAPS * 2; j < TAPS; j++, first++, q += 2) {
        const c = t[q] + t[q + 1] * frac;
        sl += bL[first] * c;
        sr += bR[first] * c;
      }
      const g = this.stepGain();
      L[at + k] += (sl - dc) * g;
      R[at + k] += (sr - dc) * g;
      ipos += sInt;
      inum += sRem;
      if (inum >= D2) { inum -= D2; ipos++; }
    }
    this.ipos = ipos;
    this.inum = inum;
    // keep only what the next output still needs
    const drop = ipos - HALF + 1 - this.bufBase;
    if (drop > 0) {
      bL.copyWithin(0, drop, this.bufLen);
      bR.copyWithin(0, drop, this.bufLen);
      this.bufLen -= drop;
      this.bufBase += drop;
    }
  }

  debug() {
    return { id: this.id, pass: this.pass, passes: this.passes, seconds: this.seconds, frame: this.frame, ending: this.ending, done: this.done, error: this.error, scanned: this.scanDone };
  }
}

/**
 * Runs the player once on a made-up moment of sound (an FM note, a DAC ramp from a data block, a PSG tone)
 * so its code is compiled and its filter built before the first real track: the first deck in a fresh
 * audio thread otherwise costs tens of milliseconds. Call it when the synth starts (worklet or worker)
 * and the player has VGM tracks.
 */
export function warmUp(sampleRate, blocks = 48) {
  const cmd = [];
  const ym = (part, reg, v) => cmd.push(part ? 0x53 : 0x52, reg, v);
  cmd.push(0x67, 0x66, 0x00, 0x00, 0x01, 0, 0);            // a 256-byte PCM block: a ramp
  for (let i = 0; i < 256; i++) cmd.push(i);
  ym(0, 0x22, 0x08); ym(0, 0xb0, 0x32); ym(0, 0xb4, 0xc0);
  for (const o of [0, 4, 8, 12]) { ym(0, 0x30 + o, 0x01); ym(0, 0x40 + o, o ? 0x20 : 0x10); ym(0, 0x50 + o, 0x1f); ym(0, 0x60 + o, 0x05); ym(0, 0x80 + o, 0x37); }
  ym(0, 0xa4, 0x22); ym(0, 0xa0, 0x69); ym(0, 0x28, 0xf0);
  cmd.push(0x50, 0x8e, 0x50, 0x0f, 0x50, 0x92);          // a PSG tone
  ym(0, 0x2b, 0x80);
  cmd.push(0xe0, 0, 0, 0, 0);
  for (let i = 0; i < 255; i++) cmd.push(0x83);            // the ramp through the DAC
  cmd.push(0x61, 0x44, 0xac, 0x66);
  const bytes = new Uint8Array(0x40 + cmd.length);
  const put = (o, v) => { for (let i = 0; i < 4; i++) bytes[o + i] = (v >>> (8 * i)) & 0xff; };
  bytes.set([0x56, 0x67, 0x6d, 0x20]);
  put(0x04, bytes.length - 4); put(0x08, 0x150); put(0x0c, 3579545); put(0x2c, 7670453); put(0x34, 0x0c);
  bytes[0x28] = 0x09; bytes[0x2a] = 16;
  bytes.set(cmd, 0x40);
  const deck = new VgmDeck('warm-up', bytes, { sampleRate, passes: 1 });
  const L = new Float32Array(128), R = new Float32Array(128);
  for (let k = 0; k < blocks && !deck.done; k++) deck.render(L, R, 0, 128);
}
