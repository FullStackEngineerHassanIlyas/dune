// The SN76489 PSG as built into the Mega Drive's video chip (research music.md §2.3), our own code from the
// documented behaviour: three square-wave tones and a noise channel, a counter step every 16 input clocks;
// a tone flips each time its 10-bit counter runs out; attenuation in 2 dB steps (15 is off); the noise is
// a shift register whose feedback taps and width come from the VGM header (Sega: taps 0x0009, 16 bits),
// reloaded whenever the noise register is written; noise rate 3 follows tone 2's period; a period of 0 is 0
// on Sega chips (0x400 when the header says so); register 3 is selected at power-up and every channel
// starts silent. Each output sample is the time-exact average of the chip's steps it covers, and a tone
// pitched above 18.6 kHz is heard as its average (half its volume), as the console's filters make it, so
// neither aliases into a whistle. Game Gear stereo is honoured.

export const PSG_FULL = 8191;   // one channel at full volume (four make about full scale, as on the chip)
// Periods below 6 flip at 18.6 kHz and up: inaudible as a tone, and what games use them for (volume writes
// as sample playback) needs the steady average, so such a tone is its average (as VGMPlay's PSG does).
const CUTOFF = 6;
const VOLUME = new Float64Array(16);
for (let k = 0; k < 15; k++) VOLUME[k] = PSG_FULL * Math.pow(10, -k / 10);   // 2 dB a step

export class SN76489 {
  /**
   * stepsPerFrame = num / den chip steps (input clock / 16) per output sample, kept as integers so the
   * time base never drifts. feedback / width / flags as in the VGM header (0x28, 0x2A, 0x2B).
   */
  constructor({ num, den, feedback = 0x0009, width = 16, flags = 0 }) {
    this.num = num;
    this.den = den;
    this.feedback = feedback;
    this.width = width;
    this.zeroIs400 = !!(flags & 1);
    this.negate = flags & 2 ? -1 : 1;
    this.xnor = !!(flags & 16);
    this.sega = feedback === 0x0009 && width === 16;
    this.reg = new Uint16Array(8);
    this.period = new Int32Array(4);
    this.count = new Int32Array(4);
    this.out = new Uint8Array(4);
    this.vol = new Float64Array(4);
    this.reset();
  }

  reset() {
    this.last = this.sega ? 3 : 0;
    for (let i = 0; i < 8; i++) this.reg[i] = i & 1 ? 15 : 0;
    for (let c = 0; c < 4; c++) { this.vol[c] = 0; this.count[c] = 0; this.out[c] = 0; }
    for (let c = 0; c < 3; c++) this.period[c] = this.zeroIs400 ? 0x400 : 0;
    this.period[3] = 1 << 5;
    this.lfsr = 1 << (this.width - 1);
    this.out[3] = this.lfsr & 1;
    this.mask = 0xff;
    this.phase = 0;   // where in the current step the time base is (of den)
  }

  /** A byte to the chip's one port: a latch (bit 7 set) or a data byte for the latched register. */
  write(data) {
    let r;
    if (data & 0x80) {
      r = (data >> 4) & 7;
      this.last = r;
      this.reg[r] = (this.reg[r] & 0x3f0) | (data & 0x0f);
    } else r = this.last;
    const c = r >> 1;
    if (r === 6) {
      if (!(data & 0x80)) this.reg[6] = (this.reg[6] & 0x3f0) | (data & 0x0f);
      this.noisePeriod();
      this.lfsr = 1 << (this.width - 1);
    } else if (r & 1) {
      this.vol[c] = VOLUME[data & 0x0f];
      if (!(data & 0x80)) this.reg[r] = (this.reg[r] & 0x3f0) | (data & 0x0f);
    } else {
      if (!(data & 0x80)) this.reg[r] = (this.reg[r] & 0x0f) | ((data & 0x3f) << 4);
      this.period[c] = this.reg[r] === 0 && this.zeroIs400 ? 0x400 : this.reg[r];
      if (r === 4 && (this.reg[6] & 3) === 3) this.noisePeriod();
    }
  }

  noisePeriod() {
    const n = this.reg[6] & 3;
    this.period[3] = n === 3 ? this.period[2] << 1 : 1 << (5 + n);
  }

  /** Game Gear stereo: bits 7-4 left enables of noise, tone 2, 1, 0; bits 3-0 right. */
  stereo(data) { this.mask = data & 0xff; }

  /** Every channel to silence (a finished track: the PSG has no release of its own). */
  silence() { for (let r = 1; r < 8; r += 2) this.write(0x80 | (r << 4) | 15); }

  get silent() { return this.vol[0] === 0 && this.vol[1] === 0 && this.vol[2] === 0 && this.vol[3] === 0; }

  step() {
    const count = this.count, period = this.period, out = this.out;
    for (let c = 0; c < 3; c++) {
      if (--count[c] <= 0) { out[c] ^= 1; count[c] = period[c]; }
    }
    if (--count[3] <= 0) {
      const s = this.lfsr;
      let fb;
      if (this.reg[6] & 4) {
        let x = s & this.feedback;
        x ^= x >> 8; x ^= x >> 4; x ^= x >> 2; x ^= x >> 1;
        fb = (x & 1) ^ (this.xnor ? 1 : 0);
      } else fb = s & 1;
      this.lfsr = (s >> 1) | (fb << (this.width - 1));
      out[3] = this.lfsr & 1;
      count[3] = period[3];
    }
  }

  /** The output now: a tone above CUTOFF's pitch is heard as its average, half its volume, as on the console. */
  level(mask) {
    const out = this.out, vol = this.vol, p = this.period;
    return ((mask & 1) ? (p[0] < CUTOFF ? vol[0] / 2 : out[0] ? vol[0] : 0) : 0)
      + ((mask & 2) ? (p[1] < CUTOFF ? vol[1] / 2 : out[1] ? vol[1] : 0) : 0)
      + ((mask & 4) ? (p[2] < CUTOFF ? vol[2] / 2 : out[2] ? vol[2] : 0) : 0)
      + ((mask & 8) && out[3] ? vol[3] : 0);
  }

  /** Adds n output samples, times `gain`, into L and R from `at` (each the average over its stretch of steps). */
  render(L, R, at, n, gain = 1) {
    const num = this.num, den = this.den, g = (gain * this.negate) / num;
    let phase = this.phase;
    if (this.silent) {
      // nothing to hear: the counters and the noise still run, so a channel comes back where it would be
      for (let i = 0; i < n; i++) {
        let left = num;
        while (phase + left >= den) { left -= den - phase; phase = 0; this.step(); }
        phase += left;
      }
      this.phase = phase;
      return;
    }
    const stereo = this.mask !== 0xff, mL = stereo ? this.mask >> 4 : 15, mR = this.mask & 15;
    let curL = this.level(mL), curR = stereo ? this.level(mR) : curL;
    for (let i = at, end = at + n; i < end; i++) {
      let left = num, sumL = 0, sumR = 0;
      while (phase + left >= den) {
        const seg = den - phase;
        sumL += curL * seg;
        sumR += curR * seg;
        left -= seg;
        phase = 0;
        this.step();
        curL = this.level(mL);
        curR = stereo ? this.level(mR) : curL;
      }
      sumL += curL * left;
      sumR += curR * left;
      phase += left;
      L[i] += sumL * g;
      R[i] += sumR * g;
    }
    this.phase = phase;
  }
}
