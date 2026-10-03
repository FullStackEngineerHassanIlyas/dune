// Each house's victory and defeat music (spec §6 Music; research.md §9: on the Sega a won mission plays its house's
// fanfare from the Carryall fly-over to the score screen, and each house has its own short dirge). Six original
// pieces written for this game, in the houses' characters:
// - Atreides, noble and heroic: a horn theme in D major over a snare march and a kanun; a lament in D Aeolian.
// - Harkonnen, brutal and martial: brass in octaves hammering C Phrygian, turning Locrian, over war drums and an
//   anvil; a slow dirge of low brass and a heartbeat drum.
// - Ordos, cold and scheming: a slithering bass in E Hungarian minor under bells and a reed; a dirge for reed and bell.
import { rep, rest } from './kit.js';

export const victoryAtreides = {
  id: 'victory-atreides', title: 'The Duke’s Banner', pool: 'victory', house: 'atreides',
  bpm: 132, root: 'd', mode: 'ionian', passes: 1, gain: -1.7,
  echo: { steps: 6, feedback: 0.3, wet: 0.22, damp: 0.45 },
  channels: {
    horn: { patch: 'power', res: 2, vol: -5, pan: 0.1, echo: 0.25, glide: 0.03 },
    brass: { patch: 'brass', voices: 2, res: 8, vol: -17, pan: -0.15, echo: 0.2 },
    strings: { patch: 'strings', voices: 3, res: 16, vol: -15, pan: -0.25, echo: 0.2 },
    kanun: { patch: 'kanun', res: 2, vol: -16, pan: 0.3, echo: 0.25, gate: 0.9 },
    bass: { patch: 'bass', res: 2, vol: -12, gate: 0.8 },
    drums: { drums: true, vol: -8, echo: 0.08, crush: 13000 },
  },
  patterns: {
    fanfare: {
      bars: 2,
      horn: 'd4 . d4 d4 a4*2 d5*2 | f#5*6 . .',
      brass: 'a3+d4 a3+d4 | a3+f#4*2',
      strings: 'd3+f#3+a3*2',
      drums: { J: 'x.g.x.g.x.ggX... X...............', P: 'x.g.x.g.x.gg.... ' + rest(1), X: rest(1) + ' x...............' },
    },
    A: {
      bars: 4,
      horn: 'd5*3 a4 d5*2 f#5*2 | g5*4 f#5*2 e5*2 | e5*3 c#5 e5*2 a5*2 | f#5*6 . .',
      brass: 'f#4+a4*2 | g4+b4*2 | e4+a4 e4+c#5 | f#4+a4*2',
      strings: 'd3+f#3+a3 g2+b2+d3 a2+c#3+e3 d3+f#3+a3',
      kanun: 'd4 f#4 a4 d5 a4 f#4 d4 f#4 | g4 b4 d5 g5 d5 b4 g4 b4 | a4 c#5 e5 a5 e5 c#5 a4 c#5 | d5 a4 f#4 a4 d5 a4 f#4 a4',
      bass: 'd2 . d2 a1 d2 . a1 . | g1 . g1 d2 g1 . d2 . | a1 . a1 e2 a1 . e2 . | d2 . d2 a1 d2 . a1 d2',
      drums: { X: 'x............... ' + rest(3), K: rep('x.......x.......', 4), P: rep('....x..g....x.gg', 4), s: rep('..x...x...x...x.', 4) },
    },
    B: {
      bars: 4,
      horn: 'g5*3 f#5 e5*2 d5*2 | f#5*3 e5 d5*2 a4*2 | b4*2 c#5 d5 e5*2 g5*2 | f#5*4 e5*4',
      brass: 'g4+b4*2 | f#4+a4*2 | e4+g4*2 | e4+a4 c#4+e4',
      strings: 'g2+b2+d3 d3+f#3+a3 e3+g3+b3 a2+c#3+e3',
      kanun: 'g4 b4 d5 g5 d5 b4 g4 b4 | d4 f#4 a4 d5 a4 f#4 d4 f#4 | e4 g4 b4 e5 b4 g4 e4 g4 | a4 c#5 e5 a5 e5 c#5 a4 c#5',
      bass: 'g1 . g1 d2 g1 . d2 . | d2 . d2 a1 d2 . a1 . | e2 . e2 b1 e2 . b1 . | a1 . a1 e2 a1 . c#2 e2',
      drums: { K: rep('x.......x.......', 4), P: rep('....x..g....x.gg', 4), s: rep('..x...x...x...x.', 4), T: rest(3) + ' ........x.x.x.x.' },
    },
    C: {
      bars: 4,
      horn: 'a5*4 f#5*2 d5*2 | b5*3 a5 f#5*4 | g5*2 f#5 e5 d5*2 b4*2 | c#5*2 e5*2 d5*4',
      brass: 'f#4+a4*2 | f#4+b4*2 | g4+b4*2 | e4+a4 f#4+a4',
      strings: 'd3+f#3+a3 b2+d3+f#3 g2+b2+d3 a2+c#3+e3',
      kanun: 'd5 a4 f#4 a4 d5 a4 f#4 a4 | b4 f#4 d4 f#4 b4 f#4 d4 f#4 | g4 d4 b3 d4 g4 d4 b3 d4 | a4 e4 c#4 e4 d5 a4 f#4 a4',
      bass: 'd2 . d2 a1 d2 . a1 . | b1 . b1 f#2 b1 . f#2 . | g1 . g1 d2 g1 . d2 . | a1 . a1 e2 d2 . a1 .',
      drums: { X: 'x............... ' + rest(3), J: 'x............... ' + rest(2) + ' x.......x.x.xxxx', K: rep('x.......x.......', 4), P: rep('....x..g....x.gg', 4), s: rep('..x...x...x...x.', 4) },
    },
  },
  intro: ['fanfare'],
  loop: ['A', 'B', 'C'],
};

export const victoryHarkonnen = {
  id: 'victory-harkonnen', title: 'Iron Heel', pool: 'victory', house: 'harkonnen',
  bpm: 100, root: 'c', mode: 'phrygian', passes: 1, gain: -1.5,
  echo: { steps: 4, feedback: 0.28, wet: 0.2, damp: 0.55 },
  channels: {
    brass: { patch: 'power', voices: 2, res: 2, vol: -7, echo: 0.2, glide: 0.04 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -15, pan: 0.2, echo: 0.3 },
    low: { patch: 'drone', voices: 2, res: 16, vol: -17 },
    bass: { patch: 'drive', res: 1, vol: -13, gate: 0.5 },
    drums: { drums: true, vol: -8, echo: 0.1, crush: 11000 },
  },
  patterns: {
    intro: {
      bars: 1,
      brass: 'c3+c4! . . . . . . .',
      low: 'c2+g2',
      drums: { B: 'X...............', R: '........x...x...', D: '........x.x.x.xx' },
    },
    A: {
      bars: 4,
      brass: 'c3+c4*2 . c3+c4 db3+db4*2 c3+c4*2 | eb3+eb4*2 db3+db4 c3+c4 bb2+bb3*4 | c3+c4*2 . c3+c4 db3+db4*2 eb3+eb4*2 | f3+f4*2 eb3+eb4 db3+db4 c3+c4*4',
      choir: 'c3+g3+c4 bb2+f3+bb3 c3+g3+c4 db3+ab3+db4',
      low: 'c2+g2*4',
      bass: rep('c2 c2 c3 c2 c2 c2 db3 c2 c2 c2 c3 c2 bb2 c3 db3 c3', 4),
      drums: {
        B: 'x............... ' + rest(1) + ' x............... ' + rest(1),
        D: rep('x...x...x...x...', 4),
        R: rep('....x.......x...', 4),
        P: rep('........x.......', 3) + ' ........x...x.x.',
      },
    },
    B: {
      bars: 4, mode: 'locrian',
      brass: 'gb3+gb4*4 f3+f4*2 eb3+eb4*2 | db3+db4*2 eb3+eb4*2 f3+f4*4 | gb3+gb4*2 ab3+ab4*2 bb3+bb4*2 ab3+ab4*2 | gb3+gb4*2 f3+f4*2 c3+c4*4',
      choir: 'gb2+db3+gb3 db3+ab3+db4 gb2+db3+gb3 c3+gb3+c4',
      low: 'c2+gb2*4',
      bass: rep('c2 c2 c3 c2 c2 c2 db3 c2 c2 c2 c3 c2 bb2 c3 db3 c3', 4),
      drums: {
        X: 'x............... ' + rest(3),
        D: rep('x.x.x...x.x.x...', 4),
        R: rep('....x.......x...', 4),
        P: rep('........x.......', 4),
        T: rest(3) + ' ........x.x.x.x.',
      },
    },
    // the war drums alone with the choir, the brass climbing back
    C: {
      bars: 4,
      brass: '@8 c3+c4*2 | db3+db4*2 | eb3+eb4*2 | f3+f4 db3+db4',
      choir: 'c3+g3+c4:6 db3+ab3+db4:7 eb3+bb3+eb4:8 f3+c4+f4:9',
      low: 'c2+g2*4',
      drums: {
        D: rep('x...x...x...x...', 3) + ' x.x.x.x.xxxxXXXX',
        R: rep('....x.......x...', 4),
        B: 'x............... ' + rest(3),
      },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B', 'A', 'C'],
};

// the Ordos bass, slithering up through the mode's augmented second and back
const SLITHER = 'e2 . e2 g2 f#2 . e2 d#2 | e2 . e2 g2 a#2 . b2 . | c3 . b2 a#2 g2 . f#2 . | e2 . d#2 . e2 . b1 .';

export const victoryOrdos = {
  id: 'victory-ordos', title: 'The Silent Partner', pool: 'victory', house: 'ordos',
  bpm: 92, swing: 0.08, root: 'e', mode: 'hungarian-minor', passes: 1, gain: 2.6,
  echo: { steps: 3, feedback: 0.4, wet: 0.3, damp: 0.35 },
  channels: {
    bass: { patch: 'slap', res: 2, vol: -10, gate: 0.5 },
    bell: { patch: 'bell', res: 2, vol: -15, pan: 0.3, echo: 0.35 },
    reed: { patch: 'reed', res: 2, vol: -9, pan: -0.2, echo: 0.35, glide: 0.07 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -17, echo: 0.3 },
    drums: { drums: true, vol: -9, echo: 0.15, crush: 13000 },
  },
  patterns: {
    intro: {
      bars: 2,
      bell: 'e5 . b4 g4 . e5 f#5 g5 | . a#4 b4 . g4 . f#4 .',
      drums: { k: rest(1) + ' ..x...g...x.g.g.' },
    },
    A: {
      bars: 4,
      bass: SLITHER,
      bell: 'e5 . b4 g4 . e5 f#5 g5 | . a#4 b4 . g4 . f#4 . | e5 . c5 g4 . e5 f#5 g5 | . f#4 d#4 . b4 . . .',
      choir: 'e3+g3+b3:6 e3+g3+b3:6 c3+e3+g3:6 b2+d#3+f#3:6',
      drums: { k: rep('..x...g...x...g.', 4), C: rep('....x.......x...', 4), F: rep('x.........x.....', 4) },
    },
    B: {
      bars: 4,
      bass: SLITHER,
      reed: 'b4*3 a#4 b4 c5 b4 g4 | f#4*4 g4*2 a#4*2 | b4*2 d#5 e5 d#5*2 c5 b4 | a#4*4 b4*4',
      bell: '@4 e5 . g5 . | e5 . a#4 . | c5 . e5 . | b4 . d#5 .',
      choir: 'e3+g3+b3 e3+g3+b3 c3+e3+g3 b2+d#3+f#3',
      drums: { k: rep('..x...g...x...g.', 4), C: rep('....x.......x...', 4), F: rep('x.........x.....', 4), h: rep('..x...x...x...x.', 4) },
    },
    C: {
      bars: 4,
      bass: SLITHER,
      reed: 'e5*3 d#5 e5 f#5 g5 f#5 | e5*2 d#5 c5 b4*4 | c5*2 b4 a#4 g4*2 f#4 g4 | a#4*2 g4 f#4 e4*4',
      bell: 'e5 . b4 g4 . e5 f#5 g5 | . a#4 b4 . g4 . f#4 . | e5 . c5 g4 . e5 f#5 g5 | . f#4 d#4 . b4 . . .',
      choir: 'e3+g3+b3 e3+g3+b3 c3+e3+g3 b2+d#3+f#3',
      drums: { k: rep('..x...g...x...g.', 4), C: rep('....x.......x...', 4), F: rep('x.........x.....', 4), h: rep('..x...x...x...x.', 4) },
    },
    // the bass and the tek alone, the choir counting in the bells again
    D: {
      bars: 4,
      bass: SLITHER,
      choir: 'e3+g3+b3:5 e3+g3+b3:6 c3+e3+g3:7 b2+d#3+f#3:8',
      bell: '.*24 | . . . . b4 . d#5 f#5',
      drums: { k: rep('..x...g...x...g.', 4), F: rep('x.........x.....', 3) + ' x.........x.x.x.' },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B', 'C', 'D'],
};

export const defeatAtreides = {
  id: 'defeat-atreides', title: 'The Fallen Banner', pool: 'defeat', house: 'atreides',
  bpm: 68, root: 'd', mode: 'aeolian', passes: 1, gain: 0.8,
  echo: { steps: 6, feedback: 0.36, wet: 0.28, damp: 0.5 },
  channels: {
    horn: { patch: 'brass', res: 2, vol: -9, pan: 0.1, echo: 0.35, glide: 0.06 },
    strings: { patch: 'strings', voices: 3, res: 16, vol: -14, pan: -0.2, echo: 0.25 },
    low: { patch: 'drone', voices: 2, res: 16, vol: -17 },
    drums: { drums: true, vol: -10, echo: 0.15 },
  },
  patterns: {
    A: {
      bars: 5,
      horn: 'a4*4 g4*2 f4*2 | f4*3 g4 d4*4 | c5*4 a4*2 f4*2 | bb4*3 a4 g4*2 bb4*2 | a4*6 . .',
      strings: 'd3+f3+a3 bb2+d3+f3 f2+a2+c3 g2+bb2+d3 a2+c3+e3',
      low: 'd2+a2 bb1+f2 f1+c2 g1+d2 a1+e2',
      drums: { J: rep('x...............', 5), P: rep('............g.g.', 4) + ' ' + rest(1) },
    },
  },
  loop: ['A'],
};

export const defeatHarkonnen = {
  id: 'defeat-harkonnen', title: 'Ashes of the Furnace', pool: 'defeat', house: 'harkonnen',
  bpm: 54, root: 'c', mode: 'phrygian', passes: 1, gain: 1.1,
  echo: { steps: 4, feedback: 0.34, wet: 0.25, damp: 0.55 },
  channels: {
    brass: { patch: 'brass', voices: 2, res: 4, vol: -10, echo: 0.25, glide: 0.06 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -14, pan: 0.2, echo: 0.3 },
    low: { patch: 'drone', voices: 2, res: 16, vol: -16 },
    drums: { drums: true, vol: -9, echo: 0.12 },
  },
  patterns: {
    A: {
      bars: 4,
      brass: 'c3+c4*2 db3+db4 c3+c4 | bb2+bb3*2 ab2+ab3 g2+g3 | ab2+ab3*2 bb2+bb3 db3+db4 | c3+c4*4',
      choir: 'c3+eb3+g3 bb2+db3+f3 ab2+c3+eb3 c3+eb3+g3',
      low: 'c2+g2 bb1+f2 ab1+eb2 c2+g2',
      drums: { D: rep('x..g............', 4), R: rep('........x.......', 4) },
    },
  },
  loop: ['A'],
};

export const defeatOrdos = {
  id: 'defeat-ordos', title: 'The Ledger Closed', pool: 'defeat', house: 'ordos',
  bpm: 68, root: 'e', mode: 'hungarian-minor', passes: 1, gain: 3.1,
  echo: { steps: 3, feedback: 0.42, wet: 0.32, damp: 0.4 },
  channels: {
    reed: { patch: 'reed', res: 2, vol: -10, pan: -0.15, echo: 0.4, glide: 0.08 },
    bell: { patch: 'bell', res: 2, vol: -16, pan: 0.3, echo: 0.45 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -15, echo: 0.3 },
    low: { patch: 'drone', voices: 2, res: 16, vol: -17 },
    drums: { drums: true, vol: -11, echo: 0.2 },
  },
  patterns: {
    A: {
      bars: 5,
      reed: 'b4*4 a#4*2 g4*2 | f#4*3 g4 e4*4 | c5*4 b4*2 a#4*2 | b4*3 a#4 g4*2 f#4*2 | e4*6 . .',
      bell: 'e5 . . . b4 . . . | g4 . . . e5 . . . | c5 . . . g4 . . . | d#5 . . . f#4 . . . | e5 . . . . . . .',
      choir: 'e3+g3+b3 e3+g3+b3 c3+e3+g3 b2+d#3+f#3 e3+g3+b3',
      low: 'e2+e3*5',
      drums: { F: rep('x.........g.....', 5) },
    },
  },
  loop: ['A'],
};
