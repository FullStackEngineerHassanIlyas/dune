// The end of the campaign (spec §6 Music, §7; research.md §9: the Sega "Finale" plays while the planet turns to the
// victor's colour, then the "Credit Roll"). Two original pieces written for this game:
// - finale: the title theme in triumph — first as the menu knows it in D Phrygian dominant, then turned to D major
//   (Mixolydian) under choir and brass, a climb through B-flat and C, and the Phrygian cadence home again.
// - credits: a steady medley at 120 — the groove, the title theme, then each house's tune from the house selection
//   (the Atreides horn call, the Ordos reed, the Harkonnen brass), a new song for the reed, and the theme in major.
import { rep, rest, shift } from './kit.js';

const FULL = { K: 'x.......x.x.....', P: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' };
const drums = (bars, extra = {}) => ({ K: rep(FULL.K, bars), P: rep(FULL.P, bars), h: rep(FULL.h, bars), ...extra });

export const finale = {
  id: 'finale', title: 'Arrakis Reborn', pool: 'finale',
  bpm: 100, root: 'd', mode: 'phrygian-dominant', passes: 1, gain: -2.3,
  echo: { steps: 6, feedback: 0.3, wet: 0.24, damp: 0.45 },
  channels: {
    hit: { patch: 'hit', voices: 3, res: 2, vol: -13, echo: 0.25 },
    lead: { patch: 'power', res: 2, vol: -4, pan: 0.1, echo: 0.3, glide: 0.04 },
    horn: { patch: 'brass', voices: 2, res: 8, vol: -17, pan: -0.15, echo: 0.2 },
    choir: { patch: 'choir', voices: 3, res: 8, vol: -14, pan: 0.25, echo: 0.3 },
    pad: { patch: 'pad', voices: 3, res: 16, vol: -17, pan: -0.25, echo: 0.2 },
    bass: { patch: 'slap', res: 2, vol: -13, gate: 0.65 },
    kanun: { patch: 'kanun', res: 1, vol: -17, pan: 0.3, echo: 0.25, gate: 0.8 },
    drums: { drums: true, vol: -9, echo: 0.1, crush: 13000 },
  },
  patterns: {
    intro: {
      bars: 2,
      hit: 'd3+f#3+a3! - . . . . . . | eb3+g3+bb3! - . . d3+f#3+a3! - . .',
      choir: 'd4+f#4+a4*2 | eb4+g4+bb4 d4+f#4+a4',
      pad: '@8 d3+f#3+a3*2 | eb3+g3+bb3 d3+f#3+a3',
      drums: { X: 'x............... ........x.......', J: 'x.......g.g.g.g. x.......x...x.xX', B: 'x............... ........x.......' },
    },
    // the theme as the menu knows it
    A: {
      bars: 4,
      hit: 'd3+f#3+a3! - . . . . . . | .*8 | .*8 | .*8',
      lead: 'd5*3 a4 d5*2 eb5*2 | f#5*4 eb5*2 d5*2 | c5*3 bb4 c5*2 eb5*2 | d5*4 c5 bb4 a4*2',
      horn: 'f#4+a4*2 | f#4+a4 g4+bb4 | g4+c5*2 | f#4+a4*2',
      choir: 'd4+f#4+a4*2 | d4+f#4+a4 eb4+g4+bb4 | c4+eb4+g4*2 | d4+f#4+a4*2',
      pad: 'd3+f#3+a3 d3+g3+bb3 c3+eb3+g3 d3+f#3+a3',
      bass: 'd2 d2 d3 d2 a2 d2 c3 d2 | d2 d2 d3 d2 eb2 eb2 eb3 eb2 | c2 c2 c3 c2 g2 c2 bb2 c2 | d2 d2 d3 d2 a2 d2 c3 a2',
      drums: drums(4, { X: 'x............... ' + rest(3), B: 'x............... ' + rest(3) }),
    },
    // the theme turned to D major, the choir over it
    B: {
      bars: 4, mode: 'mixolydian',
      hit: 'd3+f#3+a3! - . . . . . . | .*8 | c3+e3+g3! - . . . . . . | d3+f#3+a3! - . . . . . .',
      lead: 'd5*3 a4 d5*2 e5*2 | f#5*4 e5*2 d5*2 | c5*3 b4 c5*2 e5*2 | d5*6 . .',
      horn: 'f#4+a4*2 | f#4+a4 g4+b4 | e4+g4*2 | f#4+a4*2',
      choir: 'd4+f#4+a4*2 | d4+f#4+a4 d4+g4+b4 | c4+e4+g4*2 | d4+f#4+a4*2',
      pad: 'd3+f#3+a3 g2+b2+d3 c3+e3+g3 d3+f#3+a3',
      bass: 'd2 d2 d3 d2 a2 d2 c3 d2 | d2 d2 d3 d2 g2 g2 g3 g2 | c2 c2 c3 c2 g2 c2 e3 c2 | d2 d2 d3 d2 a2 d2 c3 a2',
      kanun: rep('d5 a4 f#4 a4', 4) + ' | ' + rep('d5 a4 f#4 a4', 2) + ' ' + rep('d5 b4 g4 b4', 2) + ' | ' + rep('c5 g4 e4 g4', 4) + ' | ' + rep('d5 a4 f#4 a4', 4),
      drums: drums(4, { X: 'x............... ' + rest(1) + ' x............... x...............', J: 'x............... ' + rest(3) }),
    },
    // the choir's climax: G, D, C, D
    C: {
      bars: 4, mode: 'mixolydian',
      lead: 'b5*4 a5*2 g5*2 | a5*4 f#5*2 d5*2 | e5*3 d5 c5*2 e5*2 | d5*6 . .',
      horn: 'g4+b4*2 | f#4+a4*2 | e4+g4*2 | f#4+a4*2',
      choir: 'g3+b3+d4*2 | f#3+a3+d4*2 | e3+g3+c4*2 | f#3+a3+d4*2',
      pad: 'g2+b2+d3 d3+f#3+a3 c3+e3+g3 d3+f#3+a3',
      bass: 'g1 g1 g2 g1 d2 g1 f#2 g1 | d2 d2 d3 d2 a2 d2 c3 d2 | c2 c2 c3 c2 g2 c2 e3 c2 | d2 d2 d3 d2 a2 d2 c3 a2',
      kanun: rep('g4 b4 d5 b4', 4) + ' | ' + rep('f#4 a4 d5 a4', 4) + ' | ' + rep('e4 g4 c5 g4', 4) + ' | ' + rep('f#4 a4 d5 a4', 4),
      drums: drums(4, { X: 'x............... ' + rest(3), T: rest(3) + ' ........x.x.x.x.' }),
    },
    // the climb: B-flat and C from D Aeolian, the hits pushing up to the major theme again
    D: {
      bars: 4, mode: 'aeolian',
      hit: 'bb2+d3+f3! - . . . . . . | c3+e3+g3! - . . . . . . | bb2+d3+f3! - . . . . . . | c3+e3+g3! - . . c3+e3+g3 . c3+e3+g3 .',
      lead: 'f5*4 d5*2 bb4*2 | g5*4 e5*2 c5*2 | f5*3 g5 a5*2 bb5*2 | c6*6 . .',
      horn: 'd4+f4*2 | e4+g4*2 | d4+f4*2 | e4+g4*2',
      choir: 'bb3+d4+f4*2 | c4+e4+g4*2 | bb3+d4+f4*2 | c4+e4+g4*2',
      pad: 'bb2+d3+f3 c3+e3+g3 bb2+d3+f3 c3+e3+g3',
      bass: 'bb1 bb1 bb2 bb1 f2 bb1 a2 bb1 | c2 c2 c3 c2 g2 c2 bb2 c2 | bb1 bb1 bb2 bb1 f2 bb1 a2 bb1 | c2 c2 c3 c2 c2 c2 c3 c2',
      drums: { K: rep(FULL.K, 3) + ' x...x...x...x...', P: rep(FULL.P, 3) + ' g.g.g.g.xxxxXXXX', h: rep(FULL.h, 3) + ' ' + rest(1), J: rest(3) + ' g.g.g.g.x.x.x.x.' },
    },
    // the coda: the Phrygian cadence, E-flat to D, round to the start
    F: {
      bars: 4,
      hit: 'd3+f#3+a3! - . . . . . . | eb3+g3+bb3! - . . . . . . | d3+f#3+a3! - . . . . . . | eb3+g3+bb3! - . . d3+f#3+a3! - . .',
      lead: 'a5*4 bb5*2 a5*2 | g5*4 f#5*2 eb5*2 | d5*4 eb5*2 f#5*2 | eb5*4 d5*4',
      horn: 'f#4+a4*2 | g4+bb4*2 | f#4+a4*2 | g4+bb4 f#4+a4',
      choir: 'd4+f#4+a4*2 | eb4+g4+bb4*2 | d4+f#4+a4*2 | eb4+g4+bb4 d4+f#4+a4',
      pad: 'd3+f#3+a3 eb3+g3+bb3 d3+f#3+a3 d3+f#3+a3',
      bass: 'd2 d2 d3 d2 a2 d2 c3 d2 | eb2 eb2 eb3 eb2 bb2 eb2 d3 eb2 | d2 d2 d3 d2 a2 d2 c3 d2 | eb2 eb2 eb3 eb2 d2 d2 d3 d2',
      drums: drums(4, { X: 'x............... x............... x............... x.......x.......', T: rest(3) + ' ............x.x.' }),
    },
  },
  intro: ['intro'],
  loop: ['A', 'B', 'C', 'D', 'B', 'F'],
};

// the house tunes, as the house selection plays them
const CALL = 'd4*2 a4*3 g4 a4 b4 | c5*4 b4*2 g4*2 | a4*2 b4 c5 d5*2 e5*2 | d5*6 . .';
const CREEP = 'a4*2 g#4 a4 bb4*2 a4*2 | f4*2 e4 f4 d4*4 | c#4*2 e4*2 g#4*2 a4*2 | bb4*2 a4 g#4 a4*4';
const HAMMER = 'd3*2 d3 eb3 d3*2 c3*2 | bb2*4 a2*2 bb2*2 | c3*2 eb3*2 d3*2 c3 bb2 | d3*6 . .';

export const credits = {
  id: 'credits', title: 'Songs of the Spice', pool: 'credits',
  bpm: 120, root: 'd', mode: 'phrygian-dominant', passes: 1, gain: 0.9,
  echo: { steps: 3, feedback: 0.3, wet: 0.22, damp: 0.45 },
  channels: {
    lead: { patch: 'power', res: 2, vol: -6, pan: 0.1, echo: 0.3, glide: 0.04 },
    reed: { patch: 'reed', res: 2, vol: -9, pan: -0.15, echo: 0.35, glide: 0.07 },
    horn: { patch: 'brass', res: 2, vol: -13, pan: -0.1, echo: 0.25, glide: 0.05 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -15, pan: 0.2, echo: 0.3 },
    bass: { patch: 'slap', res: 2, vol: -12, gate: 0.65 },
    arp: { patch: 'arp', res: 1, vol: -17, pan: 0.3, echo: 0.2, gate: 0.6 },
    bell: { patch: 'bell', res: 2, vol: -17, pan: -0.3, echo: 0.4 },
    drums: { drums: true, vol: -9, echo: 0.08, crush: 13000 },
  },
  patterns: {
    intro: {
      bars: 2,
      bass: '.*8 | d2 d2 d3 d2 a2 d2 c3 d2',
      drums: { K: 'x.......x....... x.......x.x.....', P: rest(1) + ' ....x.......xxxx', h: rep(FULL.h, 2) },
    },
    // the groove
    A: {
      bars: 4,
      choir: 'd3+f#3+a3 eb3+g3+bb3 c3+eb3+g3 d3+f#3+a3',
      bass: 'd2 d2 d3 d2 a2 d2 c3 d2 | eb2 eb2 eb3 eb2 bb2 eb2 d3 eb2 | c2 c2 c3 c2 g2 c2 bb2 c2 | d2 d2 d3 d2 a2 d2 c3 a2',
      arp: rep('d4 a4 d5 a4', 4) + ' | ' + rep('eb4 bb4 eb5 bb4', 4) + ' | ' + rep('c4 g4 c5 g4', 4) + ' | ' + rep('d4 a4 d5 a4', 4),
      bell: '@4 . . a5 . | . . bb5 . | . . g5 . | . . f#5 .',
      drums: drums(4, { X: 'x............... ' + rest(3) }),
    },
    // the title theme, both halves
    B1: {
      bars: 4,
      choir: 'd3+f#3+a3 eb3+g3+bb3 c3+eb3+g3 d3+f#3+a3',
      lead: 'd5*3 a4 d5*2 eb5*2 | f#5*4 eb5*2 d5*2 | c5*3 bb4 c5*2 eb5*2 | d5*4 c5 bb4 a4*2',
      bass: 'd2 d2 d3 d2 a2 d2 c3 d2 | d2 d2 d3 d2 eb2 eb2 eb3 eb2 | c2 c2 c3 c2 g2 c2 bb2 c2 | d2 d2 d3 d2 a2 d2 c3 a2',
      drums: drums(4, { X: 'x............... ' + rest(3) }),
    },
    B2: {
      bars: 4,
      choir: 'g2+bb2+d3 eb3+g3+bb3 c3+eb3+g3 d3+f#3+a3',
      lead: 'g4*3 a4 bb4*2 d5*2 | eb5*4 d5*2 c5*2 | bb4*2 c5*2 d5*2 eb5*2 | f#5*6 . .',
      bass: 'g1 g1 g2 g1 d2 g1 f#2 g1 | eb2 eb2 eb3 eb2 bb2 eb2 d3 eb2 | c2 c2 c3 c2 bb1 bb1 bb2 d2 | d2 d2 d3 d2 a2 d2 c3 a2',
      arp: '.*48 | ' + rep('d4 f#4 a4 d5', 4),
      drums: drums(4, { T: rest(3) + ' ........x.x.x.x.' }),
    },
    // the Atreides: the horn call over a march
    C: {
      bars: 4, mode: 'dorian',
      choir: 'd3+f3+a3 c3+e3+g3 b2+d3+g3 d3+f3+a3',
      horn: CALL,
      bass: 'd2 . d2 a1 d2 . a1 . | c2 . c2 g1 c2 . g1 . | g1 . g1 d2 g1 . d2 . | d2 . d2 a1 d2 . a1 d2',
      drums: { X: 'x............... ' + rest(3), K: rep('x.......x.......', 4), P: rep('g.g.x.g.g.g.x.gg', 4) },
    },
    // the Ordos: the reed creeping over bells
    D: {
      bars: 4, mode: 'hungarian-minor',
      choir: 'd3+f3+a3:6 bb2+d3+f3:6 a2+c#3+e3:6 d3+f3+a3:6',
      reed: CREEP,
      bell: 'd5 a4 f5 a4 d5 a4 f5 a4 | bb4 f4 d5 f4 bb4 f4 d5 f4 | a4 e4 c#5 e4 a4 e4 c#5 e4 | d5 a4 f5 a4 g#5 a5 . .',
      bass: 'd2 . d2 . a1 . d2 c#2 | bb1 . bb1 . f2 . bb1 a1 | a1 . a1 . e2 . a1 g#1 | d2 . d2 . a1 . d2 .',
      drums: { k: rep('..x...g...x...g.', 4), C: rep('....x.......x...', 4), F: rep('x.........x.....', 4) },
    },
    // the Harkonnen: the brass hammering over war drums
    E: {
      bars: 4, mode: 'phrygian',
      choir: 'd3+a3+d4 eb3+bb3+eb4 bb2+f3+bb3 d3+a3+d4',
      horn: shift(HAMMER, 12),
      bass: rep('d2 d2 . d2 eb2 . d2 .', 4),
      drums: { D: rep('x...x...x...x...', 4), R: rep('....x.......x...', 4), B: 'x............... ' + rest(1) + ' x............... ' + rest(1), T: rest(3) + ' ........x.x.x.x.' },
    },
    // a song for the reed: D Dorian, then down through F and C
    F: {
      bars: 8, mode: 'dorian',
      choir: 'd3+f3+a3 b2+d3+g3 c3+e3+g3 a2+c3+e3 f3+a3+c4 c3+e3+g3 b2+d3+g3 d3+f3+a3',
      reed: 'a4*4 c5*2 d5*2 | b4*4 g4*4 | c5*3 b4 a4*2 g4*2 | a4*8 | f4*4 g4*2 a4*2 | c5*4 b4*2 a4*2 | g4*3 f4 e4*2 g4*2 | d4*6 . .',
      bass: '@4 d2 . a1 . | g1 . d2 . | c2 . g1 . | a1 . e2 . | f1 . c2 . | c2 . g1 . | g1 . d2 . | d2 . a1 .',
      arp: rep('d4 f4 a4 d5', 4) + ' | ' + rep('d4 g4 b4 d5', 4) + ' | ' + rep('c4 e4 g4 c5', 4) + ' | ' + rep('c4 e4 a4 c5', 4) + ' | '
        + rep('c4 f4 a4 c5', 4) + ' | ' + rep('c4 e4 g4 c5', 4) + ' | ' + rep('b3 d4 g4 b4', 4) + ' | ' + rep('a3 d4 f4 a4', 4),
      drums: { K: rep('x.......x.......', 8), C: rep('....x.......x...', 8), s: rep('..x...x...x...x.', 8) },
    },
    // the theme in major, then the Phrygian cadence home to the groove
    G: {
      bars: 8, mode: 'mixolydian',
      choir: 'd3+f#3+a3 d3+g3+b3 c3+e3+g3 d3+f#3+a3 d3+f#3+a3 c3+e3+g3 c3+e3+g3 d3+f#3+a3',
      lead: 'd5*3 a4 d5*2 e5*2 | f#5*4 e5*2 d5*2 | c5*3 b4 c5*2 e5*2 | d5*8 | a5*4 g5*2 f#5*2 | e5*4 d5*2 c5*2 | e5*3 d5 c5*2 b4*2 | d5*6 . .',
      bass: 'd2 d2 d3 d2 a2 d2 c3 d2 | g1 g1 g2 g1 d2 g1 b1 d2 | c2 c2 c3 c2 g2 c2 e3 c2 | d2 d2 d3 d2 a2 d2 c3 d2 | d2 d2 d3 d2 a2 d2 c3 d2 | c2 c2 c3 c2 g2 c2 e3 c2 | c2 c2 c3 c2 g2 c2 e3 c2 | d2 d2 d3 d2 a2 d2 c3 a2',
      drums: drums(8, { X: 'x............... ' + rest(3) + ' x............... ' + rest(3), T: rest(7) + ' ........x.x.x.x.' }),
    },
  },
  intro: ['intro'],
  loop: ['A', 'B1', 'B2', 'C', 'D', 'E', 'F', 'G'],
};
