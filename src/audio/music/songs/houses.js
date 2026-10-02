// A briefing theme for each Great House (spec §6 Music; research mechanics-campaign.md §10: the original gives every
// house its own briefing music), written for this game in the character the houses are known by: the noble
// Atreides in D Dorian with horns and a snare march, the brutal Harkonnen in C Phrygian turning Locrian with low
// brass, war drums and an anvil, the insidious Ordos in E Hungarian minor with bells and a creeping bass.
import { rep, rest } from './kit.js';

export const atreides = {
  id: 'atreides', title: 'Banner of Caladan', pool: 'briefing', house: 'atreides',
  bpm: 88, root: 'd', mode: 'dorian', passes: 1, gain: -0.5,
  echo: { steps: 6, feedback: 0.3, wet: 0.22, damp: 0.45 },
  channels: {
    horn: { patch: 'brass', res: 2, vol: -8, pan: 0.1, echo: 0.25, glide: 0.04 },
    strings: { patch: 'strings', voices: 3, res: 16, vol: -15, pan: -0.2, echo: 0.2 },
    oud: { patch: 'oud', res: 2, vol: -12, pan: 0.3, echo: 0.2, gate: 0.85 },
    bass: { patch: 'bass', res: 4, vol: -12, gate: 0.85 },
    drums: { drums: true, vol: -8, echo: 0.08 },
  },
  patterns: {
    intro: {
      bars: 2,
      horn: 'd4 . d4 d4 a4*4 | g4*2 f4 e4 d4*4',
      drums: { S: 'x.g.x.g.x.ggx.x. x.g.x.g.x.x.xxxx' },
    },
    A: {
      bars: 8,
      horn: 'd4*2 a4*3 g4 f4 e4 | f4*2 g4 a4 c5*2 b4*2 | a4*4 g4 f4 e4 f4 | d4*6 . . | a4*2 c5 d5 e5*3 d5 | c5*2 b4 a4 g4*2 a4 b4 | c5*2 a4 f4 g4*2 e4 c4 | d4*6 . .',
      strings: 'd3+f3+a3 g3+b3+d4 f3+a3+c4 d3+f3+a3 a2+c3+e3 g2+b2+d3 f3+a3+c4 d3+f3+a3',
      bass: 'd2 . a1 . | g2 . d2 . | f2 . c2 . | d2 . a1 . | a1 . e2 . | g1 . d2 . | f2 . c2 . | d2 . a1 d2',
      drums: { K: rep('x.......x.......', 8), S: rep('....x..g....x.gg', 8) },
    },
    B: {
      bars: 8,
      oud: 'd4 f4 a4 d5 a4 f4 d4 f4 | c4 e4 g4 c5 g4 e4 c4 e4 | g3 b3 d4 g4 d4 b3 g3 b3 | a3 c4 e4 a4 e4 c4 a3 c4 | d4 f4 a4 d5 a4 f4 d4 f4 | c4 e4 g4 c5 g4 e4 c4 e4 | f3 a3 c4 f4 c4 a3 f3 a3 | d4 f4 a4 d5 a4 f4 d4 a3',
      horn: '@4 a4*4 | g4*4 | b4*3 a4 | e4*4 | f4*4 | e4*4 | c5*2 b4*2 | a4*2 . .',
      strings: 'd3+f3+a3 c3+e3+g3 g2+b2+d3 a2+c3+e3 d3+f3+a3 c3+e3+g3 f2+a2+c3 d3+f3+a3',
      bass: 'd2*4 | c2*4 | g1*4 | a1*4 | d2*4 | c2*4 | f1*4 | d2*4',
      drums: { K: rep('x.......x.......', 8), S: rep('....x.......x...', 8), s: rep('..x...x...x...x.', 8) },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B'],
};

export const harkonnen = {
  id: 'harkonnen', title: 'Furnace of Giedi Prime', pool: 'briefing', house: 'harkonnen',
  bpm: 72, root: 'c', mode: 'phrygian', passes: 1, gain: -2.0,
  echo: { steps: 4, feedback: 0.3, wet: 0.2, damp: 0.55 },
  channels: {
    drone: { patch: 'drone', voices: 2, res: 16, vol: -14 },
    brass: { patch: 'brass', voices: 2, res: 2, vol: -8, echo: 0.2, glide: 0.05 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -15, pan: 0.2, echo: 0.3 },
    bass: { patch: 'drive', res: 2, vol: -15, gate: 0.6 },
    drums: { drums: true, vol: -8, echo: 0.1 },
  },
  patterns: {
    intro: {
      bars: 2,
      drone: 'c2+g2*2',
      drums: { B: 'x............... x...............', R: rest(1) + ' ........x.......' },
    },
    A: {
      bars: 4,
      drone: 'c2+g2*4',
      brass: 'c3+c4*3 db3+db4 c3+c4*2 bb2+bb3*2 | ab2+ab3*2 g2+g3*2 ab2+ab3 bb2+bb3 c3+c4*2 | eb3+eb4*3 db3+db4 c3+c4*2 db3+db4*2 | c3+c4*6 . .',
      bass: rep('c2 . c2 c2 db2 . c2 .', 4),
      drums: { D: rep('x...x...x...x...', 4), R: rep('....x.......x...', 4), T: rest(3) + ' ............x.x.' },
    },
    B: {
      bars: 4,
      mode: 'locrian',
      drone: 'c2+c3*4',
      brass: 'gb3+gb4*4 ab3+ab4*2 gb3+gb4 f3+f4 | eb3+eb4*4 f3+f4 eb3+eb4 db3+db4*2 | c3+c4*2 db3+db4 eb3+eb4 f3+f4*2 gb3+gb4 f3+f4 | c3+c4*6 . .',
      choir: 'gb3+bb3+db4 eb3+gb3+bb3 db3+f3+ab3 c3+eb3+gb3',
      bass: rep('c2 . c2 c2 db2 . c2 .', 4),
      drums: { D: rep('x...x...x...x...', 4), R: rep('....x.......x...', 4), X: 'x............... ' + rest(3), B: rest(3) + ' x...............' },
    },
  },
  intro: ['intro'],
  loop: ['A', 'A', 'B', 'A'],
};

export const ordos = {
  id: 'ordos', title: 'Ledger of Shadows', pool: 'briefing', house: 'ordos',
  bpm: 100, swing: 0.06, root: 'e', mode: 'hungarian-minor', passes: 1, gain: 2.9,
  echo: { steps: 3, feedback: 0.4, wet: 0.3, damp: 0.35 },
  channels: {
    bell: { patch: 'bell', res: 2, vol: -14, pan: 0.3, echo: 0.35 },
    bass: { patch: 'bass', res: 2, vol: -12, gate: 0.45 },
    reed: { patch: 'reed', res: 2, vol: -10, pan: -0.2, echo: 0.35, glide: 0.07 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -17, echo: 0.3 },
    drums: { drums: true, vol: -9, echo: 0.15 },
  },
  patterns: {
    intro: {
      bars: 2,
      bell: 'e4 b4 g4 b4 a#4 b4 g4 b4 | e4 b4 g4 b4 c5 b4 g4 f#4',
    },
    A: {
      bars: 8,
      bell: rep('e4 b4 g4 b4 a#4 b4 g4 b4 | e4 b4 g4 b4 c5 b4 g4 f#4', 4),
      bass: rep('e2 . e2 . b1 . e2 d#2 | e2 . e2 . c2 . b1 .', 4),
      reed: 'b4*4 c5*2 b4*2 | a#4*2 b4*2 g4*4 | f#4*2 g4 a#4 b4*2 d#5*2 | e5*6 . . | d#5*2 c5*2 b4*2 a#4*2 | b4*4 g4*4 | f#4*2 e4*2 d#4*2 f#4*2 | e4*6 . .',
      choir: 'e3+g3+b3*2 c3+e3+g3*2 e3+g3+b3 c3+e3+g3 b2+d#3+f#3*2',
      drums: { k: rep('..x...g...x...g.', 8), C: rep('....x.......x...', 8), F: rep('x.........x.....', 8) },
    },
    B: {
      bars: 4,
      bell: '@4 b4 a#4 g4 f#4 | e4 f#4 g4 a#4 | b4 c5 b4 a#4 | b4*4',
      bass: rep('e2 . e2 . b1 . e2 d#2 | e2 . e2 . c2 . b1 .', 2),
      choir: 'e3+g3+b3 c3+e3+g3 f#3+a#3+c4 b2+d#3+f#3',
      drums: { k: rep('..x...g...x...g.', 4), h: rep('..x...x...x...x.', 4), F: rep('x.........x.....', 4) },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B'],
};
