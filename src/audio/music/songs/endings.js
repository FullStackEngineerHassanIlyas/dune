// The end of a battle (spec §6 Music, §4.11): a victory theme and a defeat theme for the result screen, both
// written for this game. Victory: a brass fanfare, then a broad march in D Mixolydian. Defeat: a lament in
// D Phrygian on a ney over a choir and a slow heartbeat of war drums. Both loop for as long as the screen stays.
import { rep, rest } from './kit.js';

export const victory = {
  id: 'victory', title: 'Banners over the Dunes', pool: 'victory',
  bpm: 108, root: 'd', mode: 'mixolydian', passes: 0, gain: -2.1,
  echo: { steps: 6, feedback: 0.3, wet: 0.22, damp: 0.45 },
  channels: {
    horn: { patch: 'brass', voices: 2, res: 2, vol: -8, echo: 0.25, glide: 0.03 },
    strings: { patch: 'strings', voices: 3, res: 16, vol: -14, pan: -0.25, echo: 0.2 },
    kanun: { patch: 'kanun', res: 2, vol: -15, pan: 0.3, echo: 0.25, gate: 0.9 },
    bass: { patch: 'bass', res: 4, vol: -12, gate: 0.85 },
    drums: { drums: true, vol: -7, echo: 0.08 },
  },
  patterns: {
    fanfare: {
      bars: 2,
      horn: 'd4+a4 . d4+a4 d4+a4 f#4+d5*4 | e4+a4*2 f#4+a4*2 a4+d5*4',
      strings: 'd3+f#3+a3*2',
      drums: { X: 'x............... ' + rest(1), S: 'x.g.x.g.x.ggx.x. x...x...x.x.xxxx', B: 'x............... x...............' },
    },
    A: {
      bars: 8,
      horn: 'd5*3 c5 b4*2 a4*2 | g4*2 a4 b4 a4*4 | f#4*2 g4 a4 d5*2 e5*2 | d5*6 . . | e5*3 d5 c5*2 b4*2 | c5*2 b4 a4 g4*4 | a4*2 b4 c5 d5*2 e5 f#5 | d5*6 . .',
      strings: 'd3+f#3+a3 g3+b3+d4 d3+f#3+a3 d3+f#3+a3 c3+e3+g3 g3+b3+d4 a3+c4+e4 d3+f#3+a3',
      kanun: rep('d4 f#4 a4 d5 a4 f#4 d4 a3', 8),
      bass: 'd2 . a1 . | g1 . d2 . | d2 . a1 . | d2 . . . | c2 . g1 . | g1 . d2 . | a1 . e2 . | d2 . a1 d2',
      drums: { X: 'x............... ' + rest(7), K: rep('x.......x.......', 8), S: rep('....x..g....x.gg', 8), s: rep('..x...x...x...x.', 8) },
    },
  },
  intro: ['fanfare'],
  loop: ['A'],
};

export const defeat = {
  id: 'defeat', title: 'Dust and Silence', pool: 'defeat',
  bpm: 66, root: 'd', mode: 'phrygian', passes: 0, gain: -1.8,
  echo: { steps: 6, feedback: 0.38, wet: 0.3, damp: 0.5 },
  channels: {
    drone: { patch: 'drone', voices: 2, res: 16, vol: -15 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -13, pan: -0.15, echo: 0.3 },
    ney: { patch: 'ney', res: 2, vol: -8, pan: 0.15, echo: 0.45, glide: 0.08 },
    drums: { drums: true, vol: -9, echo: 0.15 },
  },
  patterns: {
    toll: {
      bars: 1,
      drone: 'd2+a2',
      drums: { B: 'x...............' },
    },
    A: {
      bars: 8,
      drone: 'd2+a2*8',
      ney: 'a4*6 g4 f4 | eb4*4 d4*4 | f4*3 g4 a4*2 bb4 a4 | g4*6 . . | bb4*4 a4 g4 f4 eb4 | d4*4 eb4*2 f4*2 | eb4*3 d4 c4*2 bb3 c4 | d4*6 . .',
      choir: 'd3+f3+a3 eb3+g3+bb3 bb2+d3+f3 g2+bb2+d3 eb3+g3+bb3 bb2+d3+f3 c3+eb3+g3 d3+f3+a3',
      drums: { D: rep('x..g............', 8) },
    },
  },
  intro: ['toll'],
  loop: ['A'],
};
