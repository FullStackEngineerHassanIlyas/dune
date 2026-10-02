// The peace pool (spec §6 Music; research audio-ui-controls.md §A.2: the original shuffles a pool of calm tracks
// while the player builds — slower, sparser, a lead over a drone or pad, hand and frame drums). Three original
// pieces written for this game: an open-desert piece in D Phrygian dominant, a dawn piece in A harmonic minor
// over a kanun ostinato, and a night piece in E Phrygian in 12/8.
import { rep, rest } from './kit.js';

// maqsum-like frame-drum rhythm: dum, tek, tek, dum, tek
const MAQSUM_DUM = 'x.......x.......', MAQSUM_TEK = '..x.g.x...g.x.g.';

export const erg = {
  id: 'erg', title: 'The Open Erg', pool: 'peace',
  bpm: 96, swing: 0.08, root: 'd', mode: 'phrygian-dominant', passes: 2, gain: -2.2,
  echo: { steps: 3, feedback: 0.32, wet: 0.25, damp: 0.4 },
  channels: {
    drone: { patch: 'drone', voices: 2, res: 16, vol: -15 },
    oud: { patch: 'oud', res: 2, vol: -10, pan: -0.3, echo: 0.2, gate: 0.85 },
    ney: { patch: 'ney', res: 2, vol: -7, pan: 0.2, echo: 0.4, glide: 0.06 },
    pad: { patch: 'strings', voices: 3, res: 16, vol: -17, pan: 0.15, echo: 0.2 },
    bass: { patch: 'bass', res: 4, vol: -13 },
    drums: { drums: true, vol: -8, echo: 0.1 },
  },
  patterns: {
    intro: {
      bars: 2,
      drone: 'd2+a2*2',
      oud: '.*8 | d3 a3 d4 eb4 d4 a3 f#3 a3',
      drums: { F: rep(MAQSUM_DUM, 2), k: rest(1) + ' ' + MAQSUM_TEK },
    },
    A: {
      bars: 8,
      drone: 'd2+a2*8',
      oud: rep('d3 a3 d4 eb4 d4 a3 f#3 a3 | d3 a3 d4 c4 bb3 a3 g3 f#3', 4),
      ney: 'a4*6 ~bb4 a4 | g4*2 f#4*2 ~g4*4 | f#4 eb4 d4*6 | .*8 | d5*4 c5 bb4 a4*2 | bb4*3 a4 g4*2 a4 bb4 | a4*6 g4 f#4 | g4*2 f#4 eb4 f#4*4',
      bass: 'd2*4 | d2*4 | d2*4 | c2*2 bb1*2 | bb1*4 | g1*4 | a1*4 | d2*4',
      drums: { F: rep(MAQSUM_DUM, 8), k: rep(MAQSUM_TEK, 8), s: rep('......g.......g.', 8) },
    },
    B: {
      bars: 8,
      drone: 'd2+a2*8',
      oud: 'd4 eb4 f#4 g4 a4*2 g4 f#4 | g4 a4 bb4 a4 g4*2 f#4 eb4 | d4*2 eb4 d4 c4*2 d4 eb4 | d4*4 a3*4 | bb3 c4 d4 eb4 f#4*2 eb4 d4 | c4 d4 eb4 d4 c4*2 bb3 a3 | bb3*2 c4 bb3 a3 g3 f#3 g3 | a3*6 . .',
      pad: 'd3+f#3+a3 eb3+g3+bb3 c3+eb3+g3 d3+f#3+a3 bb2+d3+f#3 c3+eb3+g3 g2+bb2+d3 d3+f#3+a3',
      bass: 'd2*4 | eb2*4 | c2*4 | d2*4 | bb1*4 | c2*4 | g1*4 | a1*2 d2*2',
      drums: { F: rep(MAQSUM_DUM, 8), k: rep(MAQSUM_TEK, 8), s: rep('....x.......x...', 8) },
    },
    C: {
      bars: 4,
      drone: 'd2+a2*4',
      ney: '@8 d5*2 c5 bb4 a4*2 f#4*2',
      bass: '@16 d2*4',
      drums: { F: rep('x.......x.......', 3) + ' x...x...x.x.x.xx', k: rep('..x...x.....x...', 3) + ' ..x.x.x.x.x.xxxx' },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B', 'A', 'C'],
};

export const dawn = {
  id: 'dawn', title: 'Harvester at Dawn', pool: 'peace',
  bpm: 104, swing: 0.05, root: 'a', mode: 'harmonic-minor', passes: 2, gain: 2.6,
  echo: { steps: 3, feedback: 0.3, wet: 0.22, damp: 0.4 },
  channels: {
    kanun: { patch: 'kanun', res: 2, vol: -12, pan: -0.25, echo: 0.3, gate: 0.9 },
    reed: { patch: 'reed', res: 2, vol: -9, pan: 0.2, echo: 0.35, glide: 0.05 },
    strings: { patch: 'strings', voices: 3, res: 4, vol: -13, pan: 0.1, echo: 0.2 },
    bass: { patch: 'bass', res: 4, vol: -13, gate: 0.85 },
    drums: { drums: true, vol: -9, echo: 0.08 },
  },
  patterns: {
    intro: {
      bars: 2,
      kanun: rep('a3 e4 a4 c5 b4 a4 e4 c4', 2),
    },
    A: {
      bars: 8,
      kanun: rep('a3 e4 a4 c5 b4 a4 e4 c4 | f3 c4 f4 a4 c5 a4 f4 c4 | d3 a3 d4 f4 a4 f4 d4 a3 | e3 b3 e4 g#4 b4 g#4 e4 b3', 2),
      reed: 'e5*3 d5 c5*2 b4 a4 | c5*4 a4*2 f4*2 | d5*2 c5 d5 f5*2 e5 d5 | e5*4 g#4*2 b4*2 | a4*3 b4 c5*2 e5*2 | f5*4 e5 d5 c5 a4 | b4*2 c5 d5 c5 b4 a4 g#4 | b4*4 g#4*2 e4*2',
      bass: rep('a2*2 e2 a2 | f2*2 c3 f2 | d2*2 a2 d2 | e2*2 b2 e2', 2),
      drums: { K: rep('x.......x.......', 8), k: rep('....x.......x...', 8), s: rep('..x...x...x...x.', 8) },
    },
    B: {
      bars: 8,
      kanun: rep('a3 e4 a4 c5 b4 a4 e4 c4 | f3 c4 f4 a4 c5 a4 f4 c4 | d3 a3 d4 f4 a4 f4 d4 a3 | e3 b3 e4 g#4 b4 g#4 e4 b3', 2),
      strings: 'a4*2 g#4 a4 | c5*2 b4 a4 | f4*2 e4 d4 | e4*4 | e5*2 d5 c5 | a4*2 c5 a4 | d5 c5 b4 a4 | g#4*2 b4*2',
      bass: rep('a2*2 e2 a2 | f2*2 c3 f2 | d2*2 a2 d2 | e2*2 b2 e2', 2),
      drums: { K: rep('x.......x.......', 8), k: rep('....x.......x...', 8), s: rep('..x...x...x...x.', 8), F: rep('......x.......x.', 8) },
    },
    C: {
      bars: 4,
      kanun: 'a3 e4 a4 c5 b4 a4 e4 c4 | f3 c4 f4 a4 c5 a4 f4 c4 | d3 a3 d4 f4 a4 f4 d4 a3 | e3 b3 e4 g#4 b4 g#4 e4 b3',
      strings: '@16 a3+c4+e4 f3+a3+c4 d3+f3+a3 e3+g#3+b3',
      bass: 'a2*4 | f2*4 | d2*4 | e2*4',
      drums: { s: rep('..x...x...x...x.', 4) },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B', 'A', 'C'],
};

export const lanterns = {
  id: 'lanterns', title: 'Sietch Lanterns', pool: 'peace',
  bpm: 54, beat: 3, bar: 12, root: 'e', mode: 'phrygian', passes: 2, gain: -2.9,
  echo: { steps: 3, feedback: 0.38, wet: 0.3, damp: 0.45 },
  channels: {
    choir: { patch: 'choir', voices: 3, res: 12, vol: -15, pan: -0.15, echo: 0.3 },
    oud: { patch: 'oud', res: 1, vol: -12, pan: 0.3, echo: 0.2, gate: 0.9 },
    ney: { patch: 'ney', res: 3, vol: -7, pan: -0.05, echo: 0.45, glide: 0.08 },
    bass: { patch: 'bass', res: 12, vol: -14 },
    drums: { drums: true, vol: -9, echo: 0.1 },
  },
  patterns: {
    intro: {
      bars: 2,
      oud: 'e3 b3 e4 f4 e4 b3 e3 b3 e4 g4 f4 e4 | f3 c4 f4 g4 f4 c4 f3 c4 f4 a4 g4 f4',
      choir: 'e3+g3+b3 f3+a3+c4',
    },
    A: {
      bars: 8,
      oud: rep('e3 b3 e4 f4 e4 b3 e3 b3 e4 g4 f4 e4 | f3 c4 f4 g4 f4 c4 f3 c4 f4 a4 g4 f4', 4),
      ney: 'b4*2 c5 b4 | a4*2 g4 f4 | g4*3 a4 | b4*4 | e5*2 d5 c5 | d5*2 c5 b4 | c5 b4 a4 g4 | f4*2 ~e4*2',
      choir: 'e3+g3+b3 f3+a3+c4 e3+g3+b3 d3+f3+a3 a2+c3+e3 d3+f3+a3 c3+e3+g3 f3+a3+c4',
      bass: 'e2 f2 e2 d2 a1 d2 c2 f2',
      drums: { F: rep('x.....x.....', 8), k: rep('..g..x..g..x', 8) },
    },
    B: {
      bars: 8,
      oud: rep('e3 b3 e4 f4 e4 b3 e3 b3 e4 g4 f4 e4 | f3 c4 f4 g4 f4 c4 f3 c4 f4 a4 g4 f4', 4),
      ney: 'e5*2 f5 e5 | d5*2 c5 b4 | c5*3 d5 | e5*4 | g5*2 f5 e5 | d5*2 e5 f5 | e5 d5 c5 b4 | a4*2 b4*2',
      choir: 'e3+g3+b3 f3+a3+c4 e3+g3+b3 d3+f3+a3 a2+c3+e3 d3+f3+a3 c3+e3+g3 f3+a3+c4',
      bass: 'e2 f2 e2 d2 a1 d2 c2 f2',
      drums: { F: rep('x.....x.....', 8), k: rep('..g..x..g..x', 8), s: rep('.........x..', 8) },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B'],
};
