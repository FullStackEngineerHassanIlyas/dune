// The Yamaha YM2612 (OPN2) of the Sega Mega Drive, for playing the player's own VGM rips of the original
// soundtrack (spec §6 Original files; research music.md §2.5). A plain-JavaScript, integer-exact port of the
// OPN2 parts of ymfm by Aaron Giles (https://github.com/aaronsgiles/ymfm, commit 81aec25, 2026-07-27):
// ymfm_fm.ipp (operators, envelopes with SSG-EG, phase, LFO, channel algorithms, the engine clock and
// timers) and ymfm_opn.cpp (OPNA registers, ym2612 and ym3438 generate with the DAC). Output matches the
// C++ sample for sample (tests/vgm-ym2612.test.mjs against tests/fixtures/vgm/ym2612-golden.json). One output
// sample per 144 input clocks (6 x 24 operators: 53,267 Hz on an NTSC console). State lives in typed
// arrays: nothing is allocated per sample. Timers follow the clock here (ymfm hands them to its host): each
// counts whole output samples, which is all CSM needs.
//
// ymfm is distributed under this licence, kept here as it asks:
//
// BSD 3-Clause License
//
// Copyright (c) 2021, Aaron Giles
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this
//    list of conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its
//    contributors may be used to endorse or promote products derived from
//    this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
// CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
// OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

export const YM_CLOCKS_PER_SAMPLE = 144;   // prescale 6 x 24 operators

// envelope states (ymfm.h)
const ATTACK = 1, DECAY = 2, SUSTAIN = 3, RELEASE = 4;
const EG_QUIET = 0x380;
const KEYON_NORMAL = 0, KEYON_CSM = 2;
const PHASE_STEP_DYNAMIC = 1;
const ALL_CHANNELS = 0x3f;

// ---- tables (ymfm_fm.ipp, as extracted from the die) ----------------------------------------------------

// abs(sin) as 4.8 logarithmic attenuation, a quarter wave
const SIN = new Uint16Array([
  0x859, 0x6c3, 0x607, 0x58b, 0x52e, 0x4e4, 0x4a6, 0x471, 0x443, 0x41a, 0x3f5, 0x3d3, 0x3b5, 0x398, 0x37e, 0x365,
  0x34e, 0x339, 0x324, 0x311, 0x2ff, 0x2ed, 0x2dc, 0x2cd, 0x2bd, 0x2af, 0x2a0, 0x293, 0x286, 0x279, 0x26d, 0x261,
  0x256, 0x24b, 0x240, 0x236, 0x22c, 0x222, 0x218, 0x20f, 0x206, 0x1fd, 0x1f5, 0x1ec, 0x1e4, 0x1dc, 0x1d4, 0x1cd,
  0x1c5, 0x1be, 0x1b7, 0x1b0, 0x1a9, 0x1a2, 0x19b, 0x195, 0x18f, 0x188, 0x182, 0x17c, 0x177, 0x171, 0x16b, 0x166,
  0x160, 0x15b, 0x155, 0x150, 0x14b, 0x146, 0x141, 0x13c, 0x137, 0x133, 0x12e, 0x129, 0x125, 0x121, 0x11c, 0x118,
  0x114, 0x10f, 0x10b, 0x107, 0x103, 0x0ff, 0x0fb, 0x0f8, 0x0f4, 0x0f0, 0x0ec, 0x0e9, 0x0e5, 0x0e2, 0x0de, 0x0db,
  0x0d7, 0x0d4, 0x0d1, 0x0cd, 0x0ca, 0x0c7, 0x0c4, 0x0c1, 0x0be, 0x0bb, 0x0b8, 0x0b5, 0x0b2, 0x0af, 0x0ac, 0x0a9,
  0x0a7, 0x0a4, 0x0a1, 0x09f, 0x09c, 0x099, 0x097, 0x094, 0x092, 0x08f, 0x08d, 0x08a, 0x088, 0x086, 0x083, 0x081,
  0x07f, 0x07d, 0x07a, 0x078, 0x076, 0x074, 0x072, 0x070, 0x06e, 0x06c, 0x06a, 0x068, 0x066, 0x064, 0x062, 0x060,
  0x05e, 0x05c, 0x05b, 0x059, 0x057, 0x055, 0x053, 0x052, 0x050, 0x04e, 0x04d, 0x04b, 0x04a, 0x048, 0x046, 0x045,
  0x043, 0x042, 0x040, 0x03f, 0x03e, 0x03c, 0x03b, 0x039, 0x038, 0x037, 0x035, 0x034, 0x033, 0x031, 0x030, 0x02f,
  0x02e, 0x02d, 0x02b, 0x02a, 0x029, 0x028, 0x027, 0x026, 0x025, 0x024, 0x023, 0x022, 0x021, 0x020, 0x01f, 0x01e,
  0x01d, 0x01c, 0x01b, 0x01a, 0x019, 0x018, 0x017, 0x017, 0x016, 0x015, 0x014, 0x014, 0x013, 0x012, 0x011, 0x011,
  0x010, 0x00f, 0x00f, 0x00e, 0x00d, 0x00d, 0x00c, 0x00c, 0x00b, 0x00a, 0x00a, 0x009, 0x009, 0x008, 0x008, 0x007,
  0x007, 0x007, 0x006, 0x006, 0x005, 0x005, 0x005, 0x004, 0x004, 0x004, 0x003, 0x003, 0x003, 0x002, 0x002, 0x002,
  0x002, 0x001, 0x001, 0x001, 0x001, 0x001, 0x001, 0x001, 0x000, 0x000, 0x000, 0x000, 0x000, 0x000, 0x000, 0x000,
]);

// the OPN waveform: abs(sin) attenuation over a full period, the sign in bit 15
const WAVE = new Uint16Array(1024);
for (let i = 0; i < 1024; i++) {
  const input = (i >> 8) & 1 ? ~i : i;
  WAVE[i] = SIN[input & 0xff] | (((i >> 9) & 1) << 15);
}

// 10-bit power mantissas with the implicit 0x400, shifted left 2, in reverse order
const POWER = new Uint16Array([
  0x3fa, 0x3f5, 0x3ef, 0x3ea, 0x3e4, 0x3df, 0x3da, 0x3d4, 0x3cf, 0x3c9, 0x3c4, 0x3bf, 0x3b9, 0x3b4, 0x3ae, 0x3a9,
  0x3a4, 0x39f, 0x399, 0x394, 0x38f, 0x38a, 0x384, 0x37f, 0x37a, 0x375, 0x370, 0x36a, 0x365, 0x360, 0x35b, 0x356,
  0x351, 0x34c, 0x347, 0x342, 0x33d, 0x338, 0x333, 0x32e, 0x329, 0x324, 0x31f, 0x31a, 0x315, 0x310, 0x30b, 0x306,
  0x302, 0x2fd, 0x2f8, 0x2f3, 0x2ee, 0x2e9, 0x2e5, 0x2e0, 0x2db, 0x2d6, 0x2d2, 0x2cd, 0x2c8, 0x2c4, 0x2bf, 0x2ba,
  0x2b5, 0x2b1, 0x2ac, 0x2a8, 0x2a3, 0x29e, 0x29a, 0x295, 0x291, 0x28c, 0x288, 0x283, 0x27f, 0x27a, 0x276, 0x271,
  0x26d, 0x268, 0x264, 0x25f, 0x25b, 0x257, 0x252, 0x24e, 0x249, 0x245, 0x241, 0x23c, 0x238, 0x234, 0x230, 0x22b,
  0x227, 0x223, 0x21e, 0x21a, 0x216, 0x212, 0x20e, 0x209, 0x205, 0x201, 0x1fd, 0x1f9, 0x1f5, 0x1f0, 0x1ec, 0x1e8,
  0x1e4, 0x1e0, 0x1dc, 0x1d8, 0x1d4, 0x1d0, 0x1cc, 0x1c8, 0x1c4, 0x1c0, 0x1bc, 0x1b8, 0x1b4, 0x1b0, 0x1ac, 0x1a8,
  0x1a4, 0x1a0, 0x19c, 0x199, 0x195, 0x191, 0x18d, 0x189, 0x185, 0x181, 0x17e, 0x17a, 0x176, 0x172, 0x16f, 0x16b,
  0x167, 0x163, 0x160, 0x15c, 0x158, 0x154, 0x151, 0x14d, 0x149, 0x146, 0x142, 0x13e, 0x13b, 0x137, 0x134, 0x130,
  0x12c, 0x129, 0x125, 0x122, 0x11e, 0x11b, 0x117, 0x114, 0x110, 0x10c, 0x109, 0x106, 0x102, 0x0ff, 0x0fb, 0x0f8,
  0x0f4, 0x0f1, 0x0ed, 0x0ea, 0x0e7, 0x0e3, 0x0e0, 0x0dc, 0x0d9, 0x0d6, 0x0d2, 0x0cf, 0x0cc, 0x0c8, 0x0c5, 0x0c2,
  0x0be, 0x0bb, 0x0b8, 0x0b5, 0x0b1, 0x0ae, 0x0ab, 0x0a8, 0x0a4, 0x0a1, 0x09e, 0x09b, 0x098, 0x094, 0x091, 0x08e,
  0x08b, 0x088, 0x085, 0x082, 0x07e, 0x07b, 0x078, 0x075, 0x072, 0x06f, 0x06c, 0x069, 0x066, 0x063, 0x060, 0x05d,
  0x05a, 0x057, 0x054, 0x051, 0x04e, 0x04b, 0x048, 0x045, 0x042, 0x03f, 0x03c, 0x039, 0x036, 0x033, 0x030, 0x02d,
  0x02a, 0x028, 0x025, 0x022, 0x01f, 0x01c, 0x019, 0x016, 0x014, 0x011, 0x00e, 0x00b, 0x008, 0x006, 0x003, 0x000,
].map((a) => (a | 0x400) << 2));

// envelope increments: eight 4-bit steps per 6-bit rate
const INCREMENT = new Uint32Array([
  0x00000000, 0x00000000, 0x10101010, 0x10101010, 0x10101010, 0x10101010, 0x11101110, 0x11101110,
  0x10101010, 0x10111010, 0x11101110, 0x11111110, 0x10101010, 0x10111010, 0x11101110, 0x11111110,
  0x10101010, 0x10111010, 0x11101110, 0x11111110, 0x10101010, 0x10111010, 0x11101110, 0x11111110,
  0x10101010, 0x10111010, 0x11101110, 0x11111110, 0x10101010, 0x10111010, 0x11101110, 0x11111110,
  0x10101010, 0x10111010, 0x11101110, 0x11111110, 0x10101010, 0x10111010, 0x11101110, 0x11111110,
  0x10101010, 0x10111010, 0x11101110, 0x11111110, 0x10101010, 0x10111010, 0x11101110, 0x11111110,
  0x11111111, 0x21112111, 0x21212121, 0x22212221, 0x22222222, 0x42224222, 0x42424242, 0x44424442,
  0x44444444, 0x84448444, 0x84848484, 0x88848884, 0x88888888, 0x88888888, 0x88888888, 0x88888888,
]);

// detune: phase displacement by 5-bit key code and detune 0-3
const DETUNE = new Uint8Array([
  0, 0, 1, 2, 0, 0, 1, 2, 0, 0, 1, 2, 0, 0, 1, 2, 0, 1, 2, 2, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3,
  0, 1, 2, 4, 0, 1, 3, 4, 0, 1, 3, 4, 0, 1, 3, 5, 0, 2, 4, 5, 0, 2, 4, 6, 0, 2, 4, 6, 0, 2, 5, 7,
  0, 2, 5, 8, 0, 3, 6, 8, 0, 3, 6, 9, 0, 3, 7, 10, 0, 4, 8, 11, 0, 4, 8, 12, 0, 4, 9, 13, 0, 5, 10, 14,
  0, 5, 11, 16, 0, 6, 12, 17, 0, 6, 13, 19, 0, 7, 14, 20, 0, 8, 16, 22, 0, 8, 16, 22, 0, 8, 16, 22, 0, 8, 16, 22,
]);

// LFO PM: two shifts applied to the top 7 fnum bits, by PM depth and the low 3 bits of the raw PM value
const PM_SHIFTS = new Uint8Array([
  0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77,
  0x77, 0x77, 0x77, 0x77, 0x72, 0x72, 0x72, 0x72,
  0x77, 0x77, 0x77, 0x72, 0x72, 0x72, 0x17, 0x17,
  0x77, 0x77, 0x72, 0x72, 0x17, 0x17, 0x12, 0x12,
  0x77, 0x77, 0x72, 0x17, 0x17, 0x17, 0x12, 0x07,
  0x77, 0x77, 0x17, 0x12, 0x07, 0x07, 0x02, 0x01,
  0x77, 0x77, 0x17, 0x12, 0x07, 0x07, 0x02, 0x01,
  0x77, 0x77, 0x17, 0x12, 0x07, 0x07, 0x02, 0x01,
]);

const LFO_MAX_COUNT = new Uint8Array([109, 78, 72, 68, 63, 45, 9, 6]);

// the connections: bit 0 operator 2's input, bits 1-3 operator 3's, bits 4-6 operator 4's (an index into
// the opout table), bits 7-9 which of operators 1-3 also reach the output
const alg = (op2in, op3in, op4in, op1out, op2out, op3out) => op2in | (op3in << 1) | (op4in << 4) | (op1out << 7) | (op2out << 8) | (op3out << 9);
const ALGORITHMS = new Uint16Array([
  alg(1, 2, 3, 0, 0, 0), alg(0, 5, 3, 0, 0, 0), alg(0, 2, 6, 0, 0, 0), alg(1, 0, 7, 0, 0, 0),
  alg(1, 0, 3, 0, 1, 0), alg(1, 1, 1, 0, 1, 1), alg(1, 0, 0, 0, 1, 1), alg(0, 0, 0, 1, 1, 1),
]);

// channel and operator register offsets, and the operators of each channel in connection order
const CH_OFFS = new Int32Array(6);
for (let c = 0; c < 6; c++) CH_OFFS[c] = (c % 3) + 0x100 * ((c / 3) | 0);
const OP_OFFS = new Int32Array(24);
for (let o = 0; o < 24; o++) OP_OFFS[o] = (o % 12) + (((o % 12) / 3) | 0) + 0x100 * ((o / 12) | 0);
const CH_OPS = new Int32Array(24);
{
  const map = [[0, 6, 3, 9], [1, 7, 4, 10], [2, 8, 5, 11], [12, 18, 15, 21], [13, 19, 16, 22], [14, 20, 17, 23]];
  for (let c = 0; c < 6; c++) for (let k = 0; k < 4; k++) CH_OPS[c * 4 + k] = map[c][k];
}
const OP_CH = new Int32Array(24);
for (let c = 0; c < 6; c++) for (let k = 0; k < 4; k++) OP_CH[CH_OPS[c * 4 + k]] = c;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** A raw rate with key scaling: 0 stays 0, the rest add the KSR value and stop at 63. */
const effectiveRate = (raw, ksr) => (raw === 0 ? 0 : Math.min(raw + ksr, 63));
const discontinuity = (v) => (v < 0 ? v - 3 : v + 4);

export class YM2612 {
  /** ym3438: the CMOS YM3438 (no DAC ladder step) instead of the console's YM2612. */
  constructor({ ym3438 = false } = {}) {
    this.ym3438 = ym3438;
    this.regs = new Uint8Array(0x200);
    // operators
    this.phase = new Int32Array(24);          // 10.10, wraps as uint32
    this.att = new Int32Array(24);            // envelope attenuation, 4.6
    this.state = new Uint8Array(24);
    this.ssgInv = new Uint8Array(24);
    this.keyState = new Uint8Array(24);
    this.keyLive = new Uint8Array(24);
    // per-operator cache, refreshed by prepare()
    this.cStep = new Int32Array(24);
    this.cLevel = new Int32Array(24);
    this.cBlockFreq = new Int32Array(24);
    this.cDetune = new Int32Array(24);
    this.cMultiple = new Int32Array(24);
    this.cSustain = new Int32Array(24);
    this.cSsg = new Uint8Array(24);           // the SSG-EG register and the AM enable (live in ymfm; every
    this.cAm = new Uint8Array(24);            // write that changes them re-prepares before the next clock)
    this.cRate = new Uint8Array(24 * 5);
    // channels
    this.fb0 = new Int16Array(6);
    this.fb1 = new Int16Array(6);
    this.fbIn = new Int16Array(6);
    this.opout = new Int32Array(8);
    this.outL = 0;
    this.outR = 0;
    // engine
    this.envCounter = 0;
    this.status = 0;
    this.timerRunning = new Uint8Array(2);
    this.timerLeft = new Int32Array([-1, -1]);
    this.totalClocks = 0;
    this.active = ALL_CHANNELS;
    this.modified = ALL_CHANNELS;
    this.prepareCount = 0;
    this.csmLive = false;     // a CSM key on lasts until the next prepare
    this.lfoCounter = 0;
    this.lfoAm = 0;
    // the YM2612 wrapper
    this.address = 0;
    this.dacData = 0;
    this.dacEnable = 0;
    this.reset();
  }

  reset() {
    this.status = 0;
    this.regs.fill(0);
    this.regs[0xb4] = this.regs[0xb5] = this.regs[0xb6] = 0xc0;
    this.regs[0x1b4] = this.regs[0x1b5] = this.regs[0x1b6] = 0xc0;
    this.fmWrite(0x27, 0);
    this.modified = ALL_CHANNELS;
    this.fb0.fill(0); this.fb1.fill(0); this.fbIn.fill(0);
    this.phase.fill(0);
    this.att.fill(0x3ff);
    this.state.fill(RELEASE);
    this.ssgInv.fill(0);
    this.keyState.fill(0);
    this.keyLive.fill(0);
  }

  // ---- the bus ------------------------------------------------------------------------------------------

  /** ymfm's write(offset, data): 0 address, 1 data, 2 upper address, 3 upper data. */
  writePort(offset, data) {
    switch (offset & 3) {
      case 0: this.address = data & 0xff; break;
      case 1: this.writeData(data & 0xff); break;
      case 2: this.address = 0x100 | (data & 0xff); break;
      case 3: if (this.address & 0x100) this.fmWrite(this.address, data & 0xff); break;
    }
  }

  /** A register write as a VGM logs it: part (0 or 1), register, value. */
  write(part, reg, data) {
    if (part) { this.address = 0x100 | (reg & 0xff); this.fmWrite(this.address, data & 0xff); }
    else { this.address = reg & 0xff; this.writeData(data & 0xff); }
  }

  writeData(data) {
    if (this.address & 0x100) return;
    if (this.address === 0x2a) this.dacData = (this.dacData & ~0x1fe) | ((data ^ 0x80) << 1);
    else if (this.address === 0x2b) this.dacEnable = (data >> 7) & 1;
    else if (this.address === 0x2c) this.dacData = (this.dacData & ~1) | ((data >> 3) & 1);
    else this.fmWrite(this.address, data);
  }

  /**
   * fm_engine_base::write with opn_registers_base::write folded in. ymfm re-prepares every channel after
   * any write; here a write that changes no register (sound drivers acknowledge timers thousands of times a
   * second) leaves the channels as they are, which changes nothing heard: the caches would come out the same
   * and no key changes. In CSM mode every write still counts, as there a prepare also ends the timer's key on.
   */
  fmWrite(index, data) {
    const r = this.regs;
    if (index === 0x27) { this.modeWrite(data); return; }
    if ((index & 0xf0) === 0xa0) {
      // frequency pairs: the upper half latches (one latch shared by both parts), the lower half applies it
      if ((index & 3) === 3) { this.touch(false); return; }
      const latch = 0xb8 | ((index >> 3) & 1);
      if ((index >> 2) & 1) { r[latch] = data & 0x3f; this.touch(false); return; }
      const changed = r[index] !== data || r[index | 4] !== r[latch];
      r[index] = data;
      r[index | 4] = r[latch];
      this.touch(changed);
      return;
    }
    if ((index & 0xf8) === 0xb8) { this.touch(false); return; }
    const changed = r[index] !== data || index === 0x28;
    r[index] = data;
    this.touch(changed);
    if (index === 0x28) {
      let ch = data & 3;
      if (ch === 3) return;
      ch += ((data >> 2) & 1) * 3;
      this.keyOnOff(ch, data >> 4, KEYON_NORMAL);
    }
  }

  touch(changed) {
    if (changed || this.csmLive || ((this.regs[0x27] >> 6) & 3) === 2) this.modified = ALL_CHANNELS;
  }

  keyOnOff(ch, states, type) {
    const live = this.keyLive, bit = 1 << type;
    for (let k = 0; k < 4; k++) {
      const o = CH_OPS[ch * 4 + k];
      live[o] = (live[o] & ~bit) | (((states >> k) & 1) << type);
    }
  }

  modeWrite(data) {
    const changed = this.regs[0x27] !== data;
    this.regs[0x27] = data;
    this.touch(changed);
    let reset = 0;
    if (data & 0x20) reset |= 2;
    if (data & 0x10) reset |= 1;
    this.status &= ~(reset | 0x80);
    this.updateTimer(1, (data >> 1) & 1, -(this.totalClocks & 15));
    this.updateTimer(0, data & 1, 0);
  }

  updateTimer(t, enable, delta) {
    if (enable && !this.timerRunning[t]) {
      const r = this.regs;
      const period = (t === 0 ? 1024 - ((r[0x24] << 2) | (r[0x25] & 3)) : 16 * (256 - r[0x26])) + delta;
      this.timerLeft[t] = period;
      this.timerRunning[t] = 1;
    } else if (!enable) {
      this.timerLeft[t] = -1;
      this.timerRunning[t] = 0;
    }
  }

  timerExpired(t) {
    const mode = this.regs[0x27];
    if (t === 0 && (mode >> 2) & 1) this.status |= 1;
    else if (t === 1 && (mode >> 3) & 1) this.status |= 2;
    if (t === 0 && ((mode >> 6) & 3) === 2) {
      // CSM: timer A keys every operator of channel 3 on
      this.keyOnOff(2, 0xf, KEYON_CSM);
      this.modified |= 1 << 2;
      this.csmLive = true;
    }
    this.timerRunning[t] = 0;
    this.updateTimer(t, 1, 0);
  }

  // ---- per-operator work --------------------------------------------------------------------------------

  /** opn_registers_base::cache_operator_data */
  cache(ch, o) {
    const r = this.regs, choffs = CH_OFFS[ch], opoffs = OP_OFFS[o];
    let bf = ((r[0xa4 + choffs] & 0x3f) << 8) | r[0xa0 + choffs];
    if (((r[0x27] >> 6) & 3) !== 0 && choffs === 2) {
      // channel 3 special mode: operators 1-3 have frequencies of their own
      if (opoffs === 2) bf = ((r[0xad] & 0x3f) << 8) | r[0xa9];
      else if (opoffs === 10) bf = ((r[0xae] & 0x3f) << 8) | r[0xaa];
      else if (opoffs === 6) bf = ((r[0xac] & 0x3f) << 8) | r[0xa8];
    }
    this.cBlockFreq[o] = bf;
    let keycode = ((bf >> 10) & 0xf) << 1;
    keycode |= (0xfe80 >> ((bf >> 7) & 0xf)) & 1;
    const dt = (r[0x30 + opoffs] >> 4) & 7;
    const adj = DETUNE[keycode * 4 + (dt & 3)];
    this.cDetune[o] = dt & 4 ? -adj : adj;
    const mul = (r[0x30 + opoffs] & 0xf) * 2;
    this.cMultiple[o] = mul || 1;
    if (((r[0x22] >> 3) & 1) === 0 || (r[0xb4 + choffs] & 7) === 0) this.cStep[o] = this.phaseStep(o, choffs, 0);
    else this.cStep[o] = PHASE_STEP_DYNAMIC;
    this.cLevel[o] = (r[0x40 + opoffs] & 0x7f) << 3;
    let sl = (r[0x80 + opoffs] >> 4) & 0xf;
    sl |= (sl + 1) & 0x10;
    this.cSustain[o] = sl << 5;
    this.cSsg[o] = r[0x90 + opoffs];
    this.cAm[o] = (r[0x60 + opoffs] >> 7) & 1;
    const ksr = keycode >> (((r[0x50 + opoffs] >> 6) & 3) ^ 3);
    const base = o * 5;
    this.cRate[base + ATTACK] = effectiveRate((r[0x50 + opoffs] & 0x1f) * 2, ksr);
    this.cRate[base + DECAY] = effectiveRate((r[0x60 + opoffs] & 0x1f) * 2, ksr);
    this.cRate[base + SUSTAIN] = effectiveRate((r[0x70 + opoffs] & 0x1f) * 2, ksr);
    this.cRate[base + RELEASE] = effectiveRate((r[0x80 + opoffs] & 0xf) * 4 + 2, ksr);
  }

  /** opn_registers_base::compute_phase_step */
  phaseStep(o, choffs, pm) {
    const bf = this.cBlockFreq[o];
    let fnum = (bf & 0x7ff) << 1;
    const pms = this.regs[0xb4 + choffs] & 7;
    if (pms !== 0) {
      const bits = (bf >> 4) & 0x7f;
      const abs = pm < 0 ? -pm : pm;
      const sh = PM_SHIFTS[pms * 8 + (abs & 7)];
      let adjust = (bits >> (sh & 0xf)) + (bits >> ((sh >> 4) & 0xf));
      if (pms > 5) adjust <<= pms - 5;
      adjust >>= 2;
      fnum = (fnum + (pm < 0 ? -adjust : adjust)) & 0xfff;
    }
    const block = (bf >> 11) & 7;
    const step = ((((fnum << block) >> 2) + this.cDetune[o]) & 0x1ffff);
    return (step * this.cMultiple[o]) >> 1;
  }

  startAttack(o, restart) {
    if (this.state[o] === ATTACK) return;
    this.state[o] = ATTACK;
    if (!restart) {
      const ssg = this.cSsg[o];
      this.ssgInv[o] = (ssg >> 3) & 1 & (ssg >> 2);
      this.phase[o] = 0;
    }
    if (this.cRate[o * 5 + ATTACK] >= 62) this.att[o] = 0;
  }

  startRelease(o) {
    if (this.state[o] >= RELEASE) return;
    this.state[o] = RELEASE;
    if (this.ssgInv[o]) {
      this.att[o] = (0x200 - this.att[o]) & 0x3ff;
      this.ssgInv[o] = 0;
    }
  }

  /** fm_operator::prepare: true while the operator is not quiet after its release. */
  prepareOp(ch, o) {
    this.cache(ch, o);
    const key = this.keyLive[o] !== 0 ? 1 : 0;
    if (key !== this.keyState[o]) {
      this.keyState[o] = key;
      if (key) this.startAttack(o, false);
      else this.startRelease(o);
    }
    this.keyLive[o] &= ~(1 << KEYON_CSM);
    return this.state[o] !== RELEASE || this.att[o] < EG_QUIET;
  }

  ssgClock(o, ssg) {
    if (!((this.att[o] >> 9) & 1)) return;
    const mode = ssg & 7;
    if (mode & 1) {
      // hold modes
      this.ssgInv[o] = ((mode >> 2) ^ (mode >> 1)) & 1;
      if (this.state[o] !== ATTACK) this.att[o] = this.ssgInv[o] ? 0x200 : 0x3ff;
    } else {
      // continuous modes
      this.ssgInv[o] ^= (mode >> 1) & 1;
      if (this.state[o] === DECAY || this.state[o] === SUSTAIN) this.startAttack(o, true);
      if (((mode >> 1) & 1) === 0) this.phase[o] = 0;
    }
    if (this.state[o] === RELEASE) this.att[o] = 0x3ff;
  }

  envClock(o, counter, ssgOn) {
    let state = this.state[o], att = this.att[o];
    if (state === ATTACK && att === 0) state = DECAY;
    if (state === DECAY && att >= this.cSustain[o]) state = SUSTAIN;
    this.state[o] = state;
    const rate = this.cRate[o * 5 + state];
    const shift = rate >> 2;
    const ec = (counter << shift) >>> 0;
    if ((ec & 0x7ff) !== 0) return;
    const bits = (ec >>> (shift <= 11 ? 11 : shift)) & 7;
    const inc = (INCREMENT[rate] >>> (4 * bits)) & 0xf;
    if (state === ATTACK) {
      // rates 62 and 63 do not move once the key is on (they act at key on)
      if (rate < 62) att = (att + ((~att * inc) >> 4)) & 0xffff;
    } else {
      if (!ssgOn) att += inc;
      else if (att < 0x200) att += 4 * inc;
      if (att >= 0x400) att = 0x3ff;
    }
    this.att[o] = att;
  }

  /** fm_operator::compute_volume: a 14-bit signed sample at this phase. */
  volume(o, phase, am) {
    if (this.att[o] > EG_QUIET) return 0;
    const sin = WAVE[phase & 0x3ff];
    // fm_operator::envelope_attenuation
    let env = this.att[o];
    if (this.ssgInv[o]) env = (0x200 - env) & 0x3ff;
    if (this.cAm[o]) env += am;
    env += this.cLevel[o];
    if (env > 0x3ff) env = 0x3ff;
    const a = (sin & 0x7fff) + (env << 2);
    const v = POWER[a & 0xff] >> (a >> 8);
    return sin & 0x8000 ? -v : v;
  }

  // ---- the engine ---------------------------------------------------------------------------------------

  /** fm_engine_base::clock: keys, envelopes, LFO and phases one sample on. */
  clock() {
    this.totalClocks = (this.totalClocks + 1) & 0xff;
    if (this.modified !== 0 || this.prepareCount++ >= 4096) {
      let active = 0;
      for (let ch = 0; ch < 6; ch++) {
        let any = false;
        for (let k = 0; k < 4; k++) if (this.prepareOp(ch, CH_OPS[ch * 4 + k])) any = true;
        if (any) active |= 1 << ch;
      }
      this.active = active;
      this.modified = this.prepareCount = 0;
      this.csmLive = false;
    }
    let ec = (this.envCounter + 1) >>> 0;
    if ((ec & 3) === 3) ec = (ec + 1) >>> 0;
    this.envCounter = ec;
    // the LFO (opn_registers_base::clock_noise_and_lfo)
    const r = this.regs;
    let pm = 0;
    if (((r[0x22] >> 3) & 1) === 0) {
      this.lfoCounter = 0;
      this.lfoAm = 0x3f;
    } else {
      const sub = this.lfoCounter & 0xff;
      let c = (this.lfoCounter + 1) >>> 0;
      if (sub >= LFO_MAX_COUNT[r[0x22] & 7]) c = (c + 0x101 - sub) >>> 0;
      this.lfoCounter = c;
      let am = (c >>> 8) & 0x3f;
      if (((c >>> 14) & 1) === 0) am ^= 0x3f;
      this.lfoAm = am;
      pm = (c >>> 10) & 7;
      if ((c >>> 13) & 1) pm ^= 7;
      if ((c >>> 14) & 1) pm = -pm;
    }
    const envTick = (ec & 3) === 0, counter = ec >>> 2;
    const fb0 = this.fb0, fb1 = this.fb1, fbIn = this.fbIn;
    for (let ch = 0; ch < 6; ch++) { fb0[ch] = fb1[ch]; fb1[ch] = fbIn[ch]; }
    // operators clock independently of each other, so in register order; one fully released (attenuation
    // at its floor, which only a key on changes, and a key on also restarts its phase and SSG state) can
    // change nothing that is heard, and is passed over
    const state = this.state, att = this.att, phase = this.phase, cStep = this.cStep, ssgInv = this.ssgInv, cSsg = this.cSsg;
    for (let o = 0; o < 24; o++) {
      if (state[o] === RELEASE && att[o] === 0x3ff) continue;
      const ssg = cSsg[o];
      const ssgOn = (ssg >> 3) & 1;
      if (ssgOn) this.ssgClock(o, ssg);
      else ssgInv[o] = 0;
      if (envTick) this.envClock(o, counter, ssgOn);
      let step = cStep[o];
      if (step === PHASE_STEP_DYNAMIC) step = this.phaseStep(o, CH_OFFS[OP_CH[o]], pm);
      phase[o] = (phase[o] + step) | 0;
    }
  }

  /** fm_channel::output_4op with rshift 5 and clipmax 256 (9 bits): leaves the sample in outL/outR. */
  channel(ch) {
    this.outL = this.outR = 0;
    if (!((this.active >> ch) & 1)) return;
    const r = this.regs, choffs = CH_OFFS[ch], base = ch * 4, ph = this.phase, out = this.opout;
    const amShift = (1 << (((r[0xb4 + choffs] >> 4) & 3) ^ 3)) - 1;
    const am = (this.lfoAm << 1) >> amShift;
    const fb = (r[0xb0 + choffs] >> 3) & 7;
    const o1 = CH_OPS[base], o2 = CH_OPS[base + 1], o3 = CH_OPS[base + 2], o4 = CH_OPS[base + 3];
    const mod = fb !== 0 ? (this.fb0[ch] + this.fb1[ch]) >> (10 - fb) : 0;
    const op1 = this.volume(o1, (ph[o1] >>> 10) + mod, am);
    this.fbIn[ch] = op1;
    const pan = r[0xb4 + choffs];
    if (((pan >> 6) & 3) === 0) return;
    const a = ALGORITHMS[r[0xb0 + choffs] & 7];
    out[0] = 0;
    out[1] = op1;
    out[2] = this.volume(o2, (ph[o2] >>> 10) + (out[a & 1] >> 1), am);
    out[5] = (out[1] + out[2]) << 16 >> 16;
    out[3] = this.volume(o3, (ph[o3] >>> 10) + (out[(a >> 1) & 7] >> 1), am);
    out[6] = (out[1] + out[3]) << 16 >> 16;
    out[7] = (out[2] + out[3]) << 16 >> 16;
    let result = this.volume(o4, (ph[o4] >>> 10) + (out[(a >> 4) & 7] >> 1), am) >> 5;
    if (a & 0x80) result = clamp(result + (out[1] >> 5), -257, 256);
    if (a & 0x100) result = clamp(result + (out[2] >> 5), -257, 256);
    if (a & 0x200) result = clamp(result + (out[3] >> 5), -257, 256);
    if (pan & 0x80) this.outL = result;
    if (pan & 0x40) this.outR = result;
  }

  /** Writes n samples into L and R from `at` (Int32Array or Float32Array; ymfm's integer output). */
  generate(L, R, at, n) {
    const r = this.regs, left = this.timerLeft;
    for (let i = at, end = at + n; i < end; i++) {
      if (left[0] > 0 && --left[0] === 0) this.timerExpired(0);
      if (left[1] > 0 && --left[1] === 0) this.timerExpired(1);
      this.clock();
      let l = 0, rr = 0;
      const dac = this.dacEnable, dacPan = r[0x1b6];
      const dv = (this.dacData << 23) >> 23;
      if (this.ym3438) {
        if (dac) { if (dacPan & 0x80) l = dv; if (dacPan & 0x40) rr = dv; }
        const last = dac ? 5 : 6;
        for (let ch = 0; ch < last; ch++) { this.channel(ch); l += this.outL; rr += this.outR; }
        L[i] = ((l * 128) / 6) | 0;
        R[i] = ((rr * 128) / 6) | 0;
      } else {
        const last = dac ? 5 : 6;
        for (let ch = 0; ch < last; ch++) { this.channel(ch); l += discontinuity(this.outL); rr += discontinuity(this.outR); }
        if (dac) {
          const d = discontinuity(dv), z = discontinuity(0);
          l += dacPan & 0x80 ? d : z;
          rr += dacPan & 0x40 ? d : z;
        }
        L[i] = ((l * 8192) / 390) | 0;
        R[i] = ((rr * 8192) / 390) | 0;
      }
    }
  }

  /** Every channel's key off and the DAC off: what is playing rings out on its release. */
  keyOffAll() {
    for (let c = 0; c < 7; c++) if (c !== 3) this.write(0, 0x28, c);
    this.write(0, 0x2b, 0);
  }

  /** Every operator quiet after its release, and the DAC off. */
  get silent() {
    if (this.dacEnable) return false;
    for (let o = 0; o < 24; o++) if (this.state[o] !== RELEASE || this.att[o] < EG_QUIET) return false;
    return true;
  }
}
