// Register scripts that drive the YM2612 through every part of the chip (made up here, no game data): each is
// a list of steps run on a freshly reset chip, ['w', part, reg, data] a register write, ['p', offset, data] a
// raw bus write (ymfm's write(offset, data)), ['n', samples] generate. The same scripts ran through the C++
// ymfm (commit 81aec25) in scratch; ym2612-golden.json holds the CRC32 of each 8192-sample chunk of its
// Int16 stereo output, and tests/vgm-ym2612.test.mjs expects the JavaScript port to give the same.

/** A deterministic generator (32-bit LCG), so the fuzz scripts are the same everywhere. */
export function lcg(seed) {
  let s = seed >>> 0;
  return (n) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s % n; };
}

const SLOT = [0, 8, 4, 12];   // register offsets of operators 1-4 (the chip's order is 1, 3, 2, 4)

class Script {
  constructor(name, mode = 'ym2612') { this.name = name; this.mode = mode; this.steps = []; }
  w(part, reg, data) { this.steps.push(['w', part, reg & 0xff, data & 0xff]); return this; }
  p(offset, data) { this.steps.push(['p', offset, data & 0xff]); return this; }
  n(samples) { this.steps.push(['n', samples]); return this; }
  /** ch 0-5 -> (part, channel in part) */
  static at(ch) { return [ch >= 3 ? 1 : 0, ch % 3]; }
  /** One channel's patch: alg, fb, pan/ams/pms, and four operators. */
  patch(ch, { alg = 7, fb = 0, pan = 0xc0, ams = 0, pms = 0, ops }) {
    const [part, c] = Script.at(ch);
    ops.forEach((op, k) => {
      const o = c + SLOT[k];
      this.w(part, 0x30 + o, ((op.dt ?? 0) << 4) | (op.mul ?? 1));
      this.w(part, 0x40 + o, op.tl ?? 0);
      this.w(part, 0x50 + o, ((op.ks ?? 0) << 6) | (op.ar ?? 31));
      this.w(part, 0x60 + o, ((op.am ?? 0) << 7) | (op.dr ?? 0));
      this.w(part, 0x70 + o, op.sr ?? 0);
      this.w(part, 0x80 + o, ((op.sl ?? 0) << 4) | (op.rr ?? 15));
      this.w(part, 0x90 + o, op.ssg ?? 0);
    });
    this.w(part, 0xb0 + c, (fb << 3) | alg);
    this.w(part, 0xb4 + c, pan | (ams << 4) | pms);
    return this;
  }
  freq(ch, block, fnum) {
    const [part, c] = Script.at(ch);
    return this.w(part, 0xa4 + c, (block << 3) | (fnum >> 8)).w(part, 0xa0 + c, fnum);
  }
  key(ch, mask = 0xf) { return this.w(0, 0x28, (mask << 4) | (ch >= 3 ? ch + 1 : ch)); }
}

const carrier = (o = {}) => ({ tl: 0, ar: 31, dr: 0, sr: 0, sl: 0, rr: 15, ...o });
const silentOp = { tl: 127, ar: 31, rr: 15 };
const FNUM = [0x269, 0x28e, 0x2b5, 0x2de, 0x30a, 0x338, 0x369, 0x39d, 0x3d4, 0x40e, 0x44c, 0x48d];

export function ym2612Scripts() {
  const out = [];

  // every algorithm with its own feedback and modulator depths, on every channel
  const algs = (name, mode) => {
    const s = new Script(name, mode);
    for (let a = 0; a < 8; a++) {
      const ch = a % 6;
      s.patch(ch, { alg: a, fb: a, ops: [
        { dt: 1, mul: 1, tl: 20 + a, ar: 31, dr: 5, sr: 2, sl: 3, rr: 6 },
        { dt: 5, mul: 2, tl: 30, ar: 28, dr: 8, sr: 3, sl: 4, rr: 7 },
        { dt: 3, mul: 3, tl: 25, ar: 25, dr: 6, sr: 1, sl: 2, rr: 8 },
        carrier({ mul: 1, tl: 8, dr: 4, sr: 2, sl: 2, rr: 9 }),
      ] });
      s.freq(ch, 3 + (a % 3), FNUM[a]).key(ch).n(2600).key(ch, 0).n(700);
    }
    return s;
  };
  out.push(algs('algorithms'));

  // feedback 0-7 on a lone operator 1 into the output (algorithm 7) and through a chain (algorithm 0)
  {
    const s = new Script('feedback');
    for (let fb = 0; fb < 8; fb++) for (const a of [7, 0]) {
      s.patch(1, { alg: a, fb, ops: [carrier({ tl: a ? 0 : 12 }), a ? silentOp : carrier({ tl: 10 }), a ? silentOp : carrier({ tl: 10 }), a ? silentOp : carrier()] });
      s.freq(1, 4, 0x2a0).key(1).n(900).key(1, 0).n(200);
    }
    out.push(s);
  }

  // detune x multiple on one carrier, then the key codes across blocks and fnum bits
  {
    const s = new Script('detune-multiple');
    for (let dt = 0; dt < 8; dt++) for (let mul = 0; mul < 16; mul++) {
      s.patch(2, { alg: 7, ops: [carrier({ dt, mul }), silentOp, silentOp, silentOp] });
      s.freq(2, 1 + ((dt + mul) % 7), 0x400 + mul * 37).key(2, 1).n(160).key(2, 0).n(16);
    }
    for (let block = 0; block < 8; block++) for (let f = 0; f < 16; f++) {
      s.freq(2, block, (f << 7) | 0x35).key(2, 1).n(60).key(2, 0).n(4);
    }
    out.push(s);
  }

  // envelopes: key scaling, every rate region, sustain levels, the attack 62/63 quirk, releases
  {
    const s = new Script('envelopes');
    let i = 0;
    for (let ks = 0; ks < 4; ks++) for (const [ar, dr, sr, sl, rr] of [[31, 0, 0, 0, 15], [20, 12, 6, 7, 5], [12, 20, 10, 15, 2], [5, 3, 1, 1, 1], [26, 31, 31, 2, 15], [16, 9, 0, 12, 10]]) {
      const ch = i++ % 6;
      s.patch(ch, { alg: 7, ops: [carrier({ ks, ar, dr, sr, sl, rr }), silentOp, silentOp, carrier({ ks, ar: Math.max(1, ar - 4), dr, sr, sl, rr, tl: 6 })] });
      s.freq(ch, 1 + ks * 2, FNUM[i % 12]).key(ch).n(1800).key(ch, 0).n(1400);
    }
    // the attack rate pushed to 31 after the key is on (rates 62/63 then never move)
    const [part, c] = Script.at(4);
    s.patch(4, { alg: 7, ops: [carrier({ ar: 8 }), silentOp, silentOp, silentOp] }).freq(4, 4, 0x300).key(4, 1).n(500);
    s.w(part, 0x50 + c, 0xdf).n(3000).key(4, 0).n(800);
    out.push(s);
  }

  // SSG-EG: the eight shapes, held and keyed off mid-cycle
  {
    const s = new Script('ssg-eg');
    for (let mode = 8; mode < 16; mode++) {
      const ch = mode % 6;
      s.patch(ch, { alg: 4, fb: 2, ops: [
        { mul: 1, tl: 28, ar: 31, dr: 24, sr: 18, sl: 4, rr: 8, ssg: mode },
        carrier({ ar: 31, dr: 22, sr: 16, sl: 6, rr: 9, ssg: mode }),
        { mul: 2, tl: 34, ar: 24, dr: 20, sr: 14, sl: 3, rr: 7, ssg: mode ^ 2 },
        carrier({ ar: 29, dr: 26, sr: 20, sl: 5, rr: 6, ssg: mode }),
      ] });
      s.freq(ch, 4, FNUM[mode % 12]).key(ch).n(3500).key(ch, 0).n(500).key(ch).n(400).key(ch, 0).n(600);
    }
    out.push(s);
  }

  // the LFO: every rate, AM depth with and without the operator enable, PM depth, then AM with the LFO off
  {
    const s = new Script('lfo');
    for (let rate = 0; rate < 8; rate++) {
      s.w(0, 0x22, 0x08 | rate);
      const ch = rate % 6;
      s.patch(ch, { alg: 6, fb: 3, ams: rate & 3, pms: rate, ops: [
        { mul: 2, tl: 30, ar: 31, am: 1, sl: 1, rr: 8 }, carrier({ am: rate & 1 }), carrier({ am: 1, tl: 4, mul: 2 }), carrier({ am: 0, tl: 2, mul: 3, dt: 6 }),
      ] });
      s.freq(ch, 3 + (rate % 4), FNUM[rate]).key(ch).n(4200).key(ch, 0).n(300);
    }
    s.w(0, 0x22, 0x00);
    s.patch(0, { alg: 7, ams: 3, pms: 7, ops: [carrier({ am: 1 }), silentOp, silentOp, carrier({ am: 0, tl: 10 })] }).freq(0, 4, 0x2c0).key(0).n(2000);
    s.w(0, 0x22, 0x0f).n(2000).w(0, 0x22, 0x00).n(1000).key(0, 0).n(400);
    out.push(s);
  }

  // channel 3 special mode: four frequencies, the mode switched while playing
  {
    const s = new Script('ch3-special');
    s.patch(2, { alg: 7, ops: [carrier({ tl: 4 }), carrier({ tl: 6, dt: 2 }), carrier({ tl: 8 }), carrier({ tl: 10, mul: 2 })] });
    s.freq(2, 4, 0x26a);
    s.w(0, 0xac, 0x22).w(0, 0xa8, 0x9d).w(0, 0xad, 0x23).w(0, 0xa9, 0x0e).w(0, 0xae, 0x1a).w(0, 0xaa, 0x8d);
    s.w(0, 0x27, 0x40).key(2).n(3000);
    s.w(0, 0x27, 0x00).n(1500).w(0, 0x27, 0x40).n(1500);
    s.w(0, 0xad, 0x2b).w(0, 0xa9, 0x40).n(1200).key(2, 0).n(800);
    out.push(s);
  }

  // CSM: timer A keys channel 3 on; timers loaded, re-armed and acknowledged like a sound driver does
  {
    const s = new Script('csm-timers');
    s.patch(2, { alg: 7, ops: [carrier({ rr: 12, dr: 10, sl: 6 }), carrier({ tl: 8, rr: 11 }), silentOp, carrier({ tl: 12, rr: 10, mul: 3 })] });
    s.freq(2, 5, 0x300);
    s.w(0, 0x24, 0xf0).w(0, 0x25, 0x01).w(0, 0x26, 0xc8);
    s.w(0, 0x27, 0x85).n(5000);
    s.w(0, 0x27, 0x8f).n(4000);
    for (let k = 0; k < 40; k++) s.w(0, 0x27, k & 1 ? 0x95 : 0x55).n(37 + k * 11);
    s.w(0, 0x24, 0xc0).w(0, 0x27, 0x80).n(300).w(0, 0x27, 0x81).n(4000).w(0, 0x27, 0x00).n(1000);
    out.push(s);
  }

  // the DAC: a ramp and a square through channel 6's pan, the low bit, FM on the other channels, DAC off again
  const dac = (name, mode) => {
    const s = new Script(name, mode);
    s.patch(0, { alg: 4, fb: 4, ops: [{ mul: 1, tl: 30, rr: 6 }, carrier({ rr: 6 }), { mul: 3, tl: 36 }, carrier({ tl: 8, rr: 6 })] }).freq(0, 4, 0x2b5).key(0);
    s.patch(5, { alg: 7, ops: [carrier(), silentOp, silentOp, silentOp] }).freq(5, 5, 0x300).key(5);
    s.n(200).w(0, 0x2b, 0x80);
    for (const pan of [0xc0, 0x80, 0x40, 0x00, 0xc0]) {
      s.w(1, 0xb6, pan);
      for (let k = 0; k < 256; k++) s.w(0, 0x2a, k).n(1 + (k % 3));
      for (let k = 0; k < 64; k++) s.w(0, 0x2a, k & 8 ? 0xf0 : 0x10).w(0, 0x2c, k & 4 ? 0x08 : 0x00).n(5);
    }
    s.w(0, 0x2b, 0x00).n(1500).w(0, 0x2b, 0x80).w(0, 0x2a, 0x00).n(500).key(0, 0).key(5, 0).n(800);
    return s;
  };
  out.push(dac('dac'));

  // pan: every channel left, right, both, none
  {
    const s = new Script('pan');
    for (let ch = 0; ch < 6; ch++) {
      s.patch(ch, { alg: 7, ops: [carrier({ tl: 10 }), silentOp, silentOp, silentOp] }).freq(ch, 3, FNUM[ch * 2]).key(ch, 1);
    }
    for (const pan of [0x80, 0x40, 0x00, 0xc0]) for (let ch = 0; ch < 6; ch++) {
      const [part, c] = Script.at(ch);
      s.w(part, 0xb4 + c, pan).n(300);
    }
    out.push(s);
  }

  // the frequency latch: upper halves latch, lower halves apply; one latch for both parts; ignored registers
  {
    const s = new Script('latch');
    s.patch(0, { alg: 7, ops: [carrier({ tl: 6 }), silentOp, silentOp, silentOp] });
    s.patch(4, { alg: 7, ops: [carrier({ tl: 6 }), silentOp, silentOp, silentOp] });
    s.key(0, 1).key(4, 1);
    s.w(0, 0xa4, 0x22).n(400).w(0, 0xa0, 0x69).n(400);
    s.w(0, 0xa5, 0x2c).w(1, 0xa1, 0x10).n(400).w(1, 0xa5, 0x14).n(300).w(0, 0xa0, 0x40).n(400);
    s.w(0, 0xa3, 0x55).w(0, 0xa7, 0x3f).w(0, 0xb8, 0x3f).w(1, 0xbc, 0x12).w(0, 0xa0, 0x80).n(400);
    s.w(0, 0xac, 0x2a).w(0, 0xa4, 0x1a).w(0, 0xa8, 0x77).w(0, 0xa0, 0x33).n(400);
    out.push(s);
  }

  // keys: operator masks, on and off within a few samples, invalid channel numbers, the raw bus
  {
    const s = new Script('keys');
    s.patch(1, { alg: 7, ops: [carrier({ tl: 4, rr: 12 }), carrier({ tl: 8, mul: 2, rr: 10 }), carrier({ tl: 12, mul: 3, rr: 8 }), carrier({ tl: 16, mul: 4, rr: 6 })] }).freq(1, 4, 0x2b5);
    for (let m = 1; m < 16; m++) s.key(1, m).n(1 + m * 9).key(1, m >> 1).n(130);
    s.w(0, 0x28, 0xf3).w(0, 0x28, 0xf7).n(200).key(1, 0).n(10).key(1).n(3).key(1, 0).n(400);
    s.p(2, 0x28).p(1, 0xf1).n(100).p(0, 0x28).p(3, 0xf1).n(100).p(0, 0x28).p(1, 0xf1).n(500).p(2, 0x28).p(3, 0x01).n(300);
    out.push(s);
  }

  // fuzz: seeded random writes over the whole register map with random waits
  const fuzz = (name, seed, mode) => {
    const s = new Script(name, mode), rnd = lcg(seed);
    s.w(0, 0x2b, 0x00);
    for (let ch = 0; ch < 6; ch++) s.patch(ch, { alg: rnd(8), fb: rnd(8), ops: [0, 1, 2, 3].map(() => ({ dt: rnd(8), mul: rnd(16), tl: rnd(48), ks: rnd(4), ar: 10 + rnd(22), am: rnd(2), dr: rnd(32), sr: rnd(32), sl: rnd(16), rr: rnd(16), ssg: rnd(4) ? 0 : 8 + rnd(8) })) });
    for (let k = 0; k < 900; k++) {
      const roll = rnd(100);
      if (roll < 22) s.w(0, 0x28, (rnd(16) << 4) | [0, 1, 2, 4, 5, 6][rnd(6)]);
      else if (roll < 30) { const ch = rnd(6); s.freq(ch, rnd(8), rnd(0x800)); }
      else if (roll < 33) s.w(0, 0x22, rnd(16));
      else if (roll < 35) s.w(0, 0x27, [0x00, 0x40, 0x55, 0x15, 0x80, 0x85][rnd(6)]);
      else if (roll < 37) s.w(0, 0x24 + rnd(3), rnd(256));
      else if (roll < 39) s.w(0, 0x2b, rnd(2) ? 0x80 : 0);
      else if (roll < 45) s.w(0, 0x2a, rnd(256));
      else if (roll < 47) s.w(rnd(2), 0xa8 + rnd(7), rnd(256));
      else { const part = rnd(2), reg = 0x30 + rnd(0x88); s.w(part, reg, rnd(256)); }
      if (rnd(3) === 0) s.n(rnd(300));
    }
    s.n(4000);
    return s;
  };
  out.push(fuzz('fuzz-1', 0x5eed1));
  out.push(fuzz('fuzz-2', 0xd00e2));

  // a sound driver's habits: timers acknowledged thousands of times a second with the same mode value,
  // registers rewritten with what they hold, the DAC fed between; then the same in CSM mode
  {
    const s = new Script('redundant');
    s.w(0, 0x22, 0x0a);
    s.patch(0, { alg: 4, fb: 5, ams: 1, pms: 3, ops: [{ mul: 1, tl: 28, ar: 31, dr: 6, sr: 2, sl: 3, rr: 5, am: 1 }, carrier({ dr: 4, sr: 1, sl: 2, rr: 4 }), { mul: 3, tl: 34, ar: 26, dr: 8, rr: 6 }, carrier({ tl: 6, dr: 3, sl: 3, rr: 5 })] });
    s.patch(2, { alg: 7, ops: [carrier({ tl: 8, rr: 3 }), carrier({ tl: 10, rr: 4 }), carrier({ tl: 12, rr: 5 }), carrier({ tl: 14, rr: 6, mul: 2 })] });
    s.w(0, 0xac, 0x22).w(0, 0xa8, 0x9d).w(0, 0xad, 0x23).w(0, 0xa9, 0x0e).w(0, 0xae, 0x1a).w(0, 0xaa, 0x8d);
    s.w(0, 0x24, 0xfe).w(0, 0x25, 0x02).w(0, 0x27, 0x55);
    s.freq(0, 4, 0x2b5).freq(2, 4, 0x26a).key(0).key(2);
    s.w(0, 0x2b, 0x80);
    for (let k = 0; k < 1500; k++) {
      s.w(0, 0x27, 0x55);
      if (k % 7 === 0) s.w(0, 0x40, 28);
      if (k % 11 === 0) s.freq(0, 4, 0x2b5);
      if (k % 13 === 0) s.w(0, 0xa4, 0x22);
      if (k % 5 === 0) s.w(0, 0x2a, (k * 37) & 0xff);
      if (k === 700) s.key(0, 0).key(2, 0);
      if (k === 900) s.key(0).key(2);
      s.n(3 + (k % 9));
    }
    s.w(0, 0x2b, 0x00).key(2, 0).n(3000);
    s.w(0, 0x24, 0xce).w(0, 0x25, 0x00).w(0, 0x27, 0x85);
    for (let k = 0; k < 300; k++) s.w(0, 0x27, 0x85).w(0, 0x40, 28).n(23 + (k % 37));
    s.w(0, 0x27, 0x00).key(0, 0).key(2, 0).n(2000);
    out.push(s);
  }

  // a long run: the periodic prepare sweep, the envelope counter and the LFO over many periods
  {
    const s = new Script('long');
    s.w(0, 0x22, 0x0b);
    s.patch(3, { alg: 2, fb: 5, ams: 2, pms: 4, ops: [{ mul: 1, tl: 26, ar: 18, dr: 3, sr: 1, sl: 6, rr: 4, am: 1 }, { mul: 4, tl: 40, ar: 12, rr: 3 }, { mul: 2, tl: 30, ar: 20, dr: 2, sl: 4, rr: 4 }, carrier({ ar: 14, dr: 2, sr: 1, sl: 3, rr: 3, am: 1 })] });
    s.freq(3, 3, 0x30a).key(3).n(60000).key(3, 0).n(30000);
    out.push(s);
  }

  // the CMOS YM3438: no DAC ladder step
  out.push(algs('algorithms-3438', 'ym3438'));
  out.push(dac('dac-3438', 'ym3438'));
  out.push(fuzz('fuzz-3438', 0x3438, 'ym3438'));
  return out;
}

/** The scripts as the C++ harness reads them: 's <name> <mode>', 'w p r d', 'p o d', 'n count'. */
export function scriptText(scripts = ym2612Scripts()) {
  const lines = [];
  for (const s of scripts) {
    lines.push(`s ${s.name} ${s.mode}`);
    for (const st of s.steps) lines.push(st.join(' '));
  }
  return lines.join('\n') + '\n';
}
