// Two more tracks for the battle's pools (spec §6 Music; research.md §9: the Sega's five in-game tunes are bass-led
// rock in FM — a picked bass driving eighths, bright synth brass on top, sampled rock drums). Two original pieces
// written for this game in that manner, one for each pool:
// - harvest (peace): G Dorian at 104, a slapped-bass groove under a power-brass tune, a reed bridge over a kanun.
// - stormfront (battle): A Phrygian at 140, the bass hammering the half step, brass riffs, toms, a choir breakdown.
import { rep, rest } from './kit.js';

const GROOVE = { K: 'x.....x...x.....', P: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' };
const groove = (bars, extra = {}) => ({ K: rep(GROOVE.K, bars), P: rep(GROOVE.P, bars), h: rep(GROOVE.h, bars), ...extra });

// the harvest bass, a bar on each chord
const HB = {
  gm: 'g1 . g2 g1 . g1 f2 g2', f: 'f1 . f2 f1 . f1 e2 f2', c: 'c2 . c3 c2 . c2 bb2 c3', dm: 'd2 . d3 d2 . d2 c3 d3',
  bb: 'bb1 . bb2 bb1 . bb1 a2 bb2',
};

export const harvest = {
  id: 'harvest', title: 'Spice Harvest', pool: 'peace',
  bpm: 104, root: 'g', mode: 'dorian', passes: 2, gain: 1.8,
  echo: { steps: 3, feedback: 0.3, wet: 0.22, damp: 0.45 },
  channels: {
    lead: { patch: 'power', res: 2, vol: -7, pan: 0.1, echo: 0.3, glide: 0.04 },
    reed: { patch: 'reed', res: 2, vol: -9, pan: -0.15, echo: 0.35, glide: 0.07 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -16, pan: 0.2, echo: 0.3 },
    bass: { patch: 'slap', res: 2, vol: -11, gate: 0.6 },
    kanun: { patch: 'kanun', res: 1, vol: -14, pan: 0.3, echo: 0.25, gate: 0.8 },
    drums: { drums: true, vol: -10, echo: 0.08, crush: 13000 },
  },
  patterns: {
    intro: {
      bars: 2,
      bass: '.*8 | ' + HB.gm,
      drums: { K: 'x.....x...x..... x.....x...x.....', h: rep(GROOVE.h, 2), P: rest(1) + ' ....x.......x.xx' },
    },
    // the groove: G minor, F, C, D minor, twice, the kanun turning; the reed calls the second time round
    A: {
      bars: 8,
      choir: rep('g2+bb2+d3 f2+a2+c3 e2+g2+c3 f2+a2+d3', 2),
      reed: '.*8 | .*8 | .*8 | .*8 | g4*2 bb4 c5 d5*4 | c5*2 a4*2 f4*4 | e4*2 g4 a4 c5*2 bb4*2 | a4*6 . .',
      bass: rep([HB.gm, HB.f, HB.c, HB.dm].join(' | '), 2),
      kanun: rep([rep('g4 bb4 d5 bb4', 4), rep('f4 a4 c5 a4', 4), rep('e4 g4 c5 g4', 4), rep('f4 a4 d5 a4', 4)].join(' | '), 2),
      drums: groove(8, { X: 'x............... ' + rest(7) }),
    },
    // the tune on power brass
    B: {
      bars: 8,
      choir: 'g2+bb2+d3 f2+a2+c3 e2+g2+c3 f2+a2+d3 g2+bb2+d3 f2+a2+c3 e2+g2+c3 g2+bb2+d3',
      lead: 'd5*3 c5 bb4*2 a4*2 | c5*4 a4*2 f4*2 | e5*3 d5 c5*2 g4*2 | a4*6 . . | d5*3 f5 e5*2 d5*2 | c5*4 a4*2 c5*2 | bb4*2 a4*2 g4*2 e4*2 | g4*6 . .',
      bass: [HB.gm, HB.f, HB.c, HB.dm, HB.gm, HB.f, HB.c, HB.gm].join(' | '),
      drums: groove(8, { X: 'x............... ' + rest(7), T: rest(7) + ' ............x.x.' }),
    },
    // the bridge: the reed over B-flat, C, D minor and F
    C: {
      bars: 8,
      choir: 'bb2+d3+f3 c3+e3+g3 d3+f3+a3 d3+f3+a3 bb2+d3+f3 c3+e3+g3 f2+a2+c3 f2+a2+c3',
      reed: 'f4*4 g4*2 a4*2 | e4*4 g4*4 | a4*3 bb4 c5*2 d5*2 | a4*8 | f4*4 g4*2 a4*2 | e4*4 g4*2 c5*2 | c5*4 d5*2 e5*2 | f5*6 . .',
      bass: [HB.bb, HB.c, HB.dm, HB.dm, HB.bb, HB.c, HB.f, HB.f].join(' | '),
      kanun: [rep('bb4 d5 f5 d5', 4), rep('c5 e5 g5 e5', 4), rep('d5 f5 a5 f5', 4), rep('d5 f5 a5 f5', 4), rep('bb4 d5 f5 d5', 4), rep('c5 e5 g5 e5', 4), rep('c5 f5 a5 f5', 4), rep('c5 f5 a5 f5', 4)].join(' | '),
      drums: { K: rep('x.......x.......', 8), C: rep('....x.......x...', 8), s: rep('..x...x...x...x.', 8), T: rest(7) + ' ........x.x.x.x.' },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B', 'C', 'B'],
};

// the battle bass: eighths on A with the Phrygian half step
const SB = { a: 'a1 a1 a2 a1 a1 a1 bb1 a1', f: 'f1 f1 f2 f1 f1 f1 g1 f1', g: 'g1 g1 g2 g1 g1 g1 a1 g1', bb: 'bb1 bb1 bb2 bb1 bb1 bb1 c2 bb1' };

export const stormfront = {
  id: 'stormfront', title: 'Storm Front', pool: 'battle',
  bpm: 140, root: 'a', mode: 'phrygian', passes: 3, gain: 0.5,
  echo: { steps: 3, feedback: 0.25, wet: 0.18, damp: 0.5 },
  channels: {
    brass: { patch: 'power', voices: 2, res: 2, vol: -5, pan: -0.15, echo: 0.15, gate: 0.7 },
    lead: { patch: 'lead', res: 2, vol: -9, pan: 0.15, echo: 0.25, glide: 0.03 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -16, pan: 0.2, echo: 0.3 },
    bass: { patch: 'slap', res: 2, vol: -10, gate: 0.6 },
    drums: { drums: true, vol: -8, echo: 0.06, crush: 12000 },
  },
  patterns: {
    intro: {
      bars: 2,
      bass: '.*8 | ' + SB.a,
      drums: { T: 'x...x...x.x.x.x. ' + rest(1), M: '..x...x.....x... ' + rest(1), P: rest(1) + ' x.x.x.x.xxxxXXXX' },
    },
    // the riff: brass fifths answering the bass
    A: {
      bars: 8,
      brass: rep('a3+e4 . . a3+e4 . . bb3+f4 . | a3+e4 . . . g3+d4 . f3+c4 .', 4),
      bass: rep([SB.a, SB.a].join(' | '), 4),
      drums: groove(8, { X: 'x............... ' + rest(7), K: rep('x.....x.x.x.....', 8), T: rest(7) + ' ........x.x.x.x.' }),
    },
    // the lead over F, G, A and B-flat
    B: {
      bars: 8,
      lead: 'a4*3 c5 e5*2 d5 c5 | bb4*4 a4*2 g4*2 | a4*2 bb4 c5 d5*2 e5*2 | f5*4 e5*2 d5*2 | c5*3 bb4 a4*2 g4*2 | f4*2 g4*2 a4*2 bb4*2 | a4*6 . . | .*8',
      brass: ['a3+e4', 'bb3+f4', 'a3+e4', 'f3+c4', 'f3+c4', 'g3+d4', 'a3+e4'].map((c) => `${c} . . . . . . .`).join(' | ') + ' | bb3+f4 . . bb3+f4 . . bb3+f4 .',
      choir: 'a2+c3+e3 bb2+d3+f3 a2+c3+e3 f2+a2+d3 f2+a2+c3 g2+bb2+d3 a2+c3+e3 bb2+d3+f3',
      bass: [SB.a, SB.bb, SB.a, SB.f, SB.f, SB.g, SB.a, SB.bb].join(' | '),
      drums: groove(8, { X: 'x............... ' + rest(7), K: rep('x.....x.x.x.....', 8) }),
    },
    // the breakdown: toms and the choir, the bass pedalling, building back
    C: {
      bars: 4,
      choir: 'a2+c3+e3:6 bb2+d3+f3:7 g2+bb2+d3:8 a2+c3+e3:10',
      bass: rep('a1 . a1 . a1 . a1 .', 3) + ' | ' + SB.a,
      drums: { T: rep('x..x..x.x..x..x.', 3) + ' x.x.x.x.xxxxXXXX', M: rep('....x.......x...', 4), B: 'x............... ' + rest(3) },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B', 'C'],
};
