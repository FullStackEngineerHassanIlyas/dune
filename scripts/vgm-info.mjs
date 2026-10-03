// What is inside VGM rips (research music.md §2.2, §3.1): the first thing to run on a soundtrack pack.
//   node scripts/vgm-info.mjs <file.vgm|file.vgz|pack.zip ...> [--json] [--all-opcodes]
// For each track: GD3 tags, version, chip clocks, length and loop, volume modifier, data blocks, DAC writes
// and DAC-stream use, how the YM2612 is driven (LFO, SSG-EG, channel 3 mode, CSM, key-ons), the opcode
// histogram, and anything this game's player leaves out. Reads the player's files where they are; writes nothing.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { inflateVgm, parseVgm, readHeader, scanVgm, readVgmZip, commandLength, isGzip } from '../src/formats/vgm.js';

const OPCODES = {
  0x4f: 'GG stereo', 0x50: 'PSG write', 0x52: 'YM2612 part 0', 0x53: 'YM2612 part 1', 0x61: 'wait n', 0x62: 'wait 1/60 s',
  0x63: 'wait 1/50 s', 0x66: 'end', 0x67: 'data block', 0x68: 'PCM RAM write', 0x90: 'DAC stream setup', 0x91: 'DAC stream data',
  0x92: 'DAC stream frequency', 0x93: 'DAC stream start', 0x94: 'DAC stream stop', 0x95: 'DAC stream block', 0xe0: 'PCM seek',
};
const opName = (c) => OPCODES[c] ?? (c >= 0x70 && c <= 0x7f ? 'wait 1-16' : c >= 0x80 && c <= 0x8f ? 'DAC write + wait 0-15' : 'other');
const time = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const hz = (n) => `${n.toLocaleString('en-GB')} Hz`;

/** How the YM2612 is used: a walk over its writes. */
function ymUse(bytes, h) {
  const use = { keyOns: 0, lfoOn: 0, ssgEg: 0, ch3Special: 0, csm: 0, modeWrites: 0, dacEnable: 0, directDac: 0, ams: 0, pms: 0 };
  const end = h.eof;
  let at = h.dataOffset;
  while (at < end) {
    const c = bytes[at];
    if (c === 0x66) break;
    const n = commandLength(bytes, at, end, h.version);
    if (n < 0) break;
    if (c === 0x52 || c === 0x53) {
      const reg = bytes[at + 1], v = bytes[at + 2];
      if (c === 0x52 && reg === 0x28 && v & 0xf0) use.keyOns++;
      if (c === 0x52 && reg === 0x22 && v & 8) use.lfoOn++;
      if (reg >= 0x90 && reg <= 0x9f && v & 8) use.ssgEg++;
      if (c === 0x52 && reg === 0x27) { use.modeWrites++; if ((v >> 6) === 1) use.ch3Special++; if ((v >> 6) === 2) use.csm++; }
      if (c === 0x52 && reg === 0x2b && v & 0x80) use.dacEnable++;
      if (c === 0x52 && reg === 0x2a) use.directDac++;
      if (reg >= 0xb4 && reg <= 0xb6) { if (v & 0x30) use.ams++; if (v & 0x07) use.pms++; }
    }
    at += n;
  }
  return use;
}

function describe(name, bytes) {
  const info = parseVgm(bytes), h = readHeader(bytes), scan = scanVgm(bytes, h), use = ymUse(bytes, h);
  const histogram = {};
  scan.histogram.forEach((count, c) => { if (count) histogram['0x' + c.toString(16).padStart(2, '0')] = count; });
  const blocks = {};
  for (const b of scan.blocks) {
    const k = '0x' + b.type.toString(16).padStart(2, '0');
    blocks[k] = blocks[k] || { count: 0, bytes: 0 };
    blocks[k].count++;
    blocks[k].bytes += b.size;
  }
  return {
    name, bytes: bytes.length,
    track: info.gd3.track, game: info.gd3.game, system: info.gd3.system, author: info.gd3.author, date: info.gd3.date, ripper: info.gd3.ripper,
    version: (info.version >> 8).toString(16) + '.' + (info.version & 0xff).toString(16).padStart(2, '0'),
    ym2612: info.clocks.ym2612, ym3438: info.ym3438, sn76489: info.clocks.sn76489, sn: info.sn, rate: info.rate,
    samples: info.totalSamples, seconds: info.seconds,
    loop: info.loopOffset ? { offset: info.loopOffset, samples: info.loopSamples, seconds: info.loopSeconds, startsAt: info.seconds - info.loopSeconds } : null,
    volumeModifier: info.volumeModifier, gain: info.gain, loopBase: info.loopBase, loopModifier: info.loopModifier,
    dataBlocks: blocks, dacWrites: scan.dacWrites, dacStreamCommands: scan.streams,
    ymWrites: scan.ymWrites, psgWrites: scan.psgWrites, ym: use,
    end: scan.stop, histogram, unsupported: info.unsupported, warnings: info.warnings,
  };
}

function print(d, allOpcodes) {
  const out = [];
  out.push(`${d.name}  (${d.bytes.toLocaleString('en-GB')} bytes)`);
  if (d.track || d.game) out.push(`  ${d.track || '?'} — ${d.game || '?'}${d.system ? ' (' + d.system + ')' : ''}${d.author ? ', ' + d.author : ''}${d.date ? ', ' + d.date : ''}`);
  out.push(`  VGM ${d.version}, rate ${d.rate || '-'}; YM${d.ym3438 ? '3438' : '2612'} ${d.ym2612 ? hz(d.ym2612) : 'none'}, SN76489 ${d.sn76489 ? hz(d.sn76489) + ` (taps 0x${d.sn.feedback.toString(16).padStart(4, '0')}, ${d.sn.width} bits, flags 0x${d.sn.flags.toString(16)})` : 'none'}`);
  out.push(`  length ${time(d.seconds)} (${d.samples} samples)` + (d.loop ? `, loop ${time(d.loop.seconds)} from ${time(d.loop.startsAt)}` : ', no loop'));
  if (d.volumeModifier || d.loopBase || d.loopModifier) out.push(`  volume modifier ${d.volumeModifier} (x${d.gain.toFixed(3)}), loop base ${d.loopBase}, loop modifier ${d.loopModifier}`);
  const blocks = Object.entries(d.dataBlocks).map(([t, b]) => `type ${t}: ${b.count} (${b.bytes.toLocaleString('en-GB')} bytes)`).join(', ');
  out.push(`  data blocks: ${blocks || 'none'}; DAC writes (0x8n) ${d.dacWrites}, direct 0x2A ${d.ym.directDac}; DAC stream commands ${d.dacStreamCommands}`);
  out.push(`  writes: YM2612 ${d.ymWrites}, PSG ${d.psgWrites}; key-ons ${d.ym.keyOns}; LFO on ${d.ym.lfoOn}, AMS ${d.ym.ams}, PMS ${d.ym.pms}; SSG-EG ${d.ym.ssgEg}; mode 0x27 ${d.ym.modeWrites} (CH3 special ${d.ym.ch3Special}, CSM ${d.ym.csm}); DAC on ${d.ym.dacEnable}`);
  const ops = Object.entries(d.histogram).sort((a, b) => b[1] - a[1]);
  const shown = allOpcodes ? ops : ops.slice(0, 8);
  out.push('  opcodes: ' + shown.map(([c, n]) => `${c} ${opName(Number(c))} ${n}`).join(', ') + (shown.length < ops.length ? `, … ${ops.length - shown.length} more` : ''));
  if (d.end !== 'end') out.push(`  the log stops: ${d.end}`);
  for (const u of d.unsupported) out.push(`  not played: ${u}`);
  for (const w of d.warnings) out.push(`  note: ${w}`);
  console.log(out.join('\n'));
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json'), all = args.includes('--all-opcodes');
  const paths = args.filter((a) => !a.startsWith('--'));
  if (!paths.length) {
    console.error('usage: node scripts/vgm-info.mjs <file.vgm|file.vgz|pack.zip ...> [--json] [--all-opcodes]');
    process.exit(2);
  }
  const results = [];
  for (const path of paths) {
    const raw = new Uint8Array(readFileSync(path));
    const entries = /\.zip$/i.test(path) ? await readVgmZip(raw) : [{ name: basename(path), bytes: raw }];
    for (const e of entries) {
      try {
        const d = describe(e.name + (isGzip(e.bytes) ? ' (gzipped)' : ''), await inflateVgm(e.bytes));
        results.push(d);
        if (!json) print(d, all);
      } catch (err) {
        results.push({ name: e.name, error: err.message });
        if (!json) console.log(`${e.name}\n  cannot read: ${err.message}`);
      }
    }
  }
  if (json) console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
