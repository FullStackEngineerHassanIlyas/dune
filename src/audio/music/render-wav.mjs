// Development tool, Node only (never loaded by the game): renders soundtrack tracks to 16-bit stereo WAV files,
// so they can be listened to and measured (for example with ffmpeg's ebur128 and astats filters), and reports how
// long the synthesis took against the music's own length.
//   node src/audio/music/render-wav.mjs [track ids, comma-separated | all] [seconds | full] [out dir] [rate]
// `full` renders the intro, two passes of the loop body and the ring-out of a track set to end after them.
import { writeFileSync, mkdirSync } from 'node:fs';
import { MusicMixer } from './mixer.js';
import { TRACKS } from './songs/index.js';
import { durations } from './score.js';

export function wavBytes(L, R, rate) {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  return b;
}

/** `seconds` of track `id` from its start, rendered in 128-sample blocks as an AudioWorklet would: { L, R, ms of CPU time }. */
export function renderTrack(id, seconds, rate = 48000, { passes } = {}) {
  const m = new MusicMixer({ rate });
  m.play(id, { passes });
  const N = Math.round(seconds * rate), L = new Float32Array(N), R = new Float32Array(N), bl = new Float32Array(128), br = new Float32Array(128);
  const t0 = process.cpuUsage();
  for (let i = 0; i < N; i += 128) {
    const k = Math.min(128, N - i);
    m.render(bl, br, 128);
    L.set(bl.subarray(0, k), i);
    R.set(br.subarray(0, k), i);
  }
  const used = process.cpuUsage(t0);
  return { L, R, ms: (used.user + used.system) / 1000 };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [ids = 'all', length = '30', out = '.', rateArg = '48000'] = process.argv.slice(2);
  const rate = Number(rateArg);
  mkdirSync(out, { recursive: true });
  for (const id of ids === 'all' ? Object.keys(TRACKS) : ids.split(',')) {
    const d = durations(TRACKS[id]), full = length === 'full';
    const seconds = full ? d.intro + 2 * d.loop + 4 : Number(length);
    const { L, R, ms } = renderTrack(id, seconds, rate, full ? { passes: 2 } : {});
    writeFileSync(`${out}/${id}.wav`, wavBytes(L, R, rate));
    console.log(`${id}: ${seconds.toFixed(1)} s (intro ${d.intro.toFixed(1)} s, loop ${d.loop.toFixed(1)} s) rendered in ${ms.toFixed(0)} ms of CPU — ${((100 * ms) / 1000 / seconds).toFixed(2)}% of one core`);
  }
}
