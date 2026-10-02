// Creative Voice (.VOC) files, the format of every Dune II voice and effect clip (spec §6 Original files;
// research audio-ui-controls.md §A.3 "Creative Voice File"): a 26-byte header ("Creative Voice File",
// 0x1A, header size, version, checksum = ~version + 0x1234), then blocks of [type][24-bit length][data]
// until a type 0. Dune II uses type 1 (8-bit unsigned PCM at 1 000 000 / (256 − time constant) Hz),
// type 2 (more of the same) and type 3 (silence); types 8 and 9 (the later extended and new formats) are
// read too, markers, text and repeats are skipped. Damaged input throws a VocError saying what is wrong.
// Below the reader: the small PCM helpers the voice and the effects use to turn clips into lines.

export class VocError extends Error {
  constructor(message) { super(message); this.name = 'VocError'; }
}

const MAGIC = 'Creative Voice File\x1a';
const MIN_RATE = 3000, MAX_RATE = 96000;   // what an AudioBuffer accepts everywhere, and then some

/** The time-constant byte's rate; the two standard rates come out exact, as Dune Legacy and ScummVM read them. */
export function rateOf(timeConstant) {
  if (timeConstant === 0xa5 || timeConstant === 0xa6) return 11025;
  if (timeConstant === 0xd2 || timeConstant === 0xd3) return 22050;
  return Math.round(1e6 / (256 - timeConstant));
}

/**
 * One clip: { rate, pcm: Uint8Array of 8-bit unsigned mono samples (128 is silence), warnings: [text] }.
 * Mixed rates keep the first; stereo and 16-bit sound (types 8 and 9) come out as 8-bit mono.
 */
export function readVoc(data, label = 'clip') {
  if (!(data instanceof ArrayBuffer || ArrayBuffer.isView(data))) throw new VocError(`${label}: not binary data`);
  const b = data instanceof Uint8Array ? data : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
  const n = b.length, u16 = (p) => b[p] | (b[p + 1] << 8), u24 = (p) => b[p] | (b[p + 1] << 8) | (b[p + 2] << 16);
  if (n < 26) throw new VocError(`${label}: too short to be a VOC file (${n} bytes)`);
  for (let i = 0; i < MAGIC.length; i++) if (b[i] !== MAGIC.charCodeAt(i)) throw new VocError(`${label}: not a Creative Voice file (no "Creative Voice File" signature)`);
  const start = u16(20), version = u16(22), warnings = [];
  if (start < 26 || start > n) throw new VocError(`${label}: the header claims ${start} bytes, the file has ${n}`);
  if (u16(24) !== ((~version + 0x1234) & 0xffff)) warnings.push('header checksum does not match');
  const parts = [];   // Uint8Arrays of 8-bit samples, in order
  let rate = 0, extended = null, length = 0, pos = start;
  const setRate = (r, where) => {
    if (!(r >= MIN_RATE && r <= MAX_RATE)) throw new VocError(`${label}: sample rate ${r} Hz at byte ${where} is not plausible`);
    if (!rate) rate = r;
    else if (Math.abs(r - rate) > rate * 0.01 && !warnings.includes('mixed sample rates')) warnings.push('mixed sample rates');
  };
  const add = (part) => { parts.push(part); length += part.length; };
  while (pos < n) {
    const type = b[pos];
    if (type === 0) break;
    if (pos + 4 > n) throw new VocError(`${label}: block header at byte ${pos} is cut off`);
    const size = u24(pos + 1), body = pos + 4, end = body + size;
    if (end > n) throw new VocError(`${label}: block ${type} at byte ${pos} runs ${end - n} bytes past the end`);
    switch (type) {
      case 1: {   // sound data: time constant, codec, samples
        if (size < 2) throw new VocError(`${label}: sound block at byte ${pos} is too short`);
        const codec = b[body + 1];
        if (codec !== 0 && !extended) throw new VocError(`${label}: codec ${codec} at byte ${pos} is not supported (8-bit PCM only)`);
        if (extended) { setRate(extended.rate, pos); add(extended.stereo ? downmix8(b.subarray(body + 2, end)) : b.subarray(body + 2, end)); extended = null; }
        else { setRate(rateOf(b[body]), pos); add(b.subarray(body + 2, end)); }
        break;
      }
      case 2:   // more samples, as the block before
        if (!rate) throw new VocError(`${label}: continuation block at byte ${pos} has no sound block before it`);
        add(b.subarray(body, end));
        break;
      case 3: {   // silence: length − 1, time constant
        if (size < 3) throw new VocError(`${label}: silence block at byte ${pos} is too short`);
        if (!rate) setRate(rateOf(b[body + 2]), pos);
        add(new Uint8Array(u16(body) + 1).fill(128));
        break;
      }
      case 8: {   // extended: a 16-bit time constant, packing, stereo — for the next sound block
        if (size < 4) throw new VocError(`${label}: extended block at byte ${pos} is too short`);
        const stereo = b[body + 3] ? 1 : 0;
        if (b[body + 2] !== 0) throw new VocError(`${label}: packed sound at byte ${pos} is not supported (8-bit PCM only)`);
        extended = { rate: Math.round(256e6 / ((stereo + 1) * (65536 - u16(body)))), stereo };
        break;
      }
      case 9: {   // new format: rate, bits, channels, codec, reserved, samples
        if (size < 12) throw new VocError(`${label}: sound block at byte ${pos} is too short`);
        const r = (b[body] | (b[body + 1] << 8) | (b[body + 2] << 16) | (b[body + 3] << 24)) >>> 0, bits = b[body + 4], channels = b[body + 5], codec = u16(body + 6);
        const pcm8 = codec === 0 && bits === 8, pcm16 = codec === 4 && bits === 16;
        if (!pcm8 && !pcm16) throw new VocError(`${label}: codec ${codec} (${bits}-bit) at byte ${pos} is not supported (PCM only)`);
        if (channels < 1 || channels > 2) throw new VocError(`${label}: ${channels} channels at byte ${pos}`);
        setRate(r, pos);
        add(to8bitMono(b.subarray(body + 12, end), bits, channels));
        break;
      }
      default:   // 4 marker, 5 text, 6 and 7 repeats (played once), anything newer: skipped
        if (type > 9) warnings.push(`unknown block ${type} skipped`);
    }
    pos = end;
  }
  if (!length) throw new VocError(`${label}: no sound in it`);
  const pcm = new Uint8Array(length);
  let o = 0;
  for (const p of parts) { pcm.set(p, o); o += p.length; }
  return { rate, pcm, warnings };
}

function downmix8(a) {
  const out = new Uint8Array(a.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = (a[2 * i] + a[2 * i + 1]) >> 1;
  return out;
}

function to8bitMono(a, bits, channels) {
  const frame = (bits / 8) * channels, out = new Uint8Array(Math.floor(a.length / frame));
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let c = 0; c < channels; c++) {
      const p = i * frame + c * (bits / 8);
      s += bits === 8 ? a[p] - 128 : (((a[p] | (a[p + 1] << 8)) << 16) >> 16) / 256;
    }
    out[i] = Math.max(0, Math.min(255, Math.round(s / channels + 128)));
  }
  return out;
}

// ——— PCM helpers ———

/** 8-bit unsigned samples as floats in [-1, 1), resampled (linearly) from `from` to `to` Hz. */
export function toFloat(pcm, from, to = from) {
  const step = from / to, out = new Float32Array(Math.max(1, Math.round(pcm.length / step)));
  for (let i = 0; i < out.length; i++) {
    const x = i * step, k = Math.floor(x), f = x - k;
    const a = pcm[Math.min(k, pcm.length - 1)], c = pcm[Math.min(k + 1, pcm.length - 1)];
    out[i] = (a + (c - a) * f - 128) / 128;
  }
  return out;
}

/** Clips played back to back, as the original strings its word clips into a sentence (research §A.1), at `rate` Hz. */
export function joinClips(clips, rate) {
  const parts = clips.map((c) => toFloat(c.pcm, c.rate, rate));
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
