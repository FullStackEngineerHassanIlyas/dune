// The battle pool (spec §6 Music; research audio-ui-controls.md §A.2: when fighting starts the original switches
// to a pool of combat tracks — faster, percussive, built on repeated ostinati, war drums and gated brass). Three
// original pieces written for this game: a D Phrygian dominant charge that climbs a semitone half-way, an
// E Phrygian tom-driven piece over a synth arpeggio, and a C harmonic minor half-time march for taiko and brass.
import { rep, rest } from './kit.js';

const ROCK_K = 'x.....x...x.....', BACKBEAT = '....x.......x...', EIGHTHS = 'x.x.x.x.x.x.x.x.';

export const assault = {
  id: 'assault', title: 'Sand Assault', pool: 'battle',
  bpm: 144, root: 'd', mode: 'phrygian-dominant', passes: 2, gain: 1.3,
  echo: { steps: 3, feedback: 0.25, wet: 0.18, damp: 0.5 },
  channels: {
    bass: { patch: 'drive', res: 1, vol: -19, gate: 0.6 },
    stab: { patch: 'stab', voices: 3, res: 2, vol: -15, pan: -0.2, echo: 0.15, gate: 0.5 },
    lead: { patch: 'lead', res: 2, vol: -10, pan: 0.15, echo: 0.25, glide: 0.03 },
    horn: { patch: 'brass', voices: 2, res: 16, vol: -13, pan: -0.1, echo: 0.2 },
    drums: { drums: true, vol: -13, echo: 0.06 },
  },
  patterns: {
    intro: {
      bars: 2,
      bass: '.*16 | d2 d2 d3 d2 eb2 d2 d3 d2 d2 d2 d3 d2 eb2 d2 c3 d2',
      drums: {
        D: 'x.....x.x.....x. x...x...x.x.xxxx',
        T: rest(1) + ' ........x.x.x.x.',
        X: 'x............... ' + rest(1),
      },
    },
    A: {
      bars: 4,
      bass: rep('d2 d2 d3 d2 eb2 d2 d3 d2 d2 d2 d3 d2 eb2 d2 c3 d2 | d2 d2 d3 d2 eb2 d2 d3 d2 bb1 bb1 bb2 bb1 c2 c2 c3 c2', 2),
      lead: 'd4*2 . d4 f#4 g4 a4*2 | bb4*2 a4 g4 f#4*2 eb4*2 | d4*2 . d4 a4*2 c5 bb4 | a4*4 . . g4 f#4',
      stab: rep('d3+f#3+a3 . . d3+f#3+a3 . . d3+f#3+a3 .', 2) + ' | ' + 'eb3+g3+bb3 . . eb3+g3+bb3 . . eb3+g3+bb3 . | d3+f#3+a3 . . . . . . .',
      drums: {
        X: 'x............... ' + rest(3),
        K: rep(ROCK_K, 4), S: rep(BACKBEAT, 4), h: rep(EIGHTHS, 4),
        D: rep('x.......x.......', 3) + ' x.......x...x.x.',
        T: rest(3) + ' ............x.x.',
      },
    },
    B: {
      bars: 4,
      bass: rep('d2 d2 d3 d2 eb2 d2 d3 d2 d2 d2 d3 d2 eb2 d2 c3 d2 | d2 d2 d3 d2 eb2 d2 d3 d2 bb1 bb1 bb2 bb1 c2 c2 c3 c2', 2),
      lead: 'd5*2 c5 bb4 a4*2 g4 a4 | bb4*2 a4 g4 f#4 g4 a4*2 | g4*2 f#4 eb4 d4*2 eb4 f#4 | d4*6 . .',
      horn: 'd4+a4 eb4+bb4 c4+g4 d4+a4',
      drums: {
        K: rep(ROCK_K, 4), S: rep(BACKBEAT, 4), h: rep(EIGHTHS, 4),
        D: rep('x.....x.x.......', 3) + ' x.....x.x.x.x.x.',
        t: rep('..........x.....', 4),
      },
    },
    C: {
      bars: 4,
      bass: rep('d2 . d2 . d3 . d2 . eb2 . d2 . c3 . d2 .', 4),
      horn: 'd4+a4 eb4+g4 d4+a4 d4+f#4',
      drums: {
        D: rep('x..x..x.x..x..x.', 3) + ' x..x..x.x.x.xxxx',
        T: rep('....x.......x...', 3) + ' ....x...x.x.x.x.',
        s: rep('..x...x...x...x.', 4),
      },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B', 'A+1', 'B+1', 'A', 'C'],
};

export const iron = {
  id: 'iron', title: 'Iron Dunes', pool: 'battle',
  bpm: 150, root: 'e', mode: 'phrygian', passes: 3, gain: 1.1,
  echo: { steps: 3, feedback: 0.28, wet: 0.2, damp: 0.5 },
  channels: {
    arp: { patch: 'arp', res: 1, vol: -12, pan: 0.25, echo: 0.25, gate: 0.7 },
    bass: { patch: 'drive', res: 4, vol: -17, gate: 0.5 },
    lead: { patch: 'lead', res: 2, vol: -10, pan: -0.1, echo: 0.25, glide: 0.03 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -16, pan: -0.25, echo: 0.3 },
    drums: { drums: true, vol: -12, echo: 0.05 },
  },
  patterns: {
    intro: {
      bars: 2,
      arp: 'e3 b3 e4 b3 g4 b3 e4 b3 e3 b3 e4 b3 f4 b3 e4 b3 | d3 a3 d4 a3 f4 a3 d4 a3 c3 g3 c4 g3 e4 g3 c4 g3',
      drums: { t: rest(1) + ' x.x.x.x.x.x.x.x.', T: rest(1) + ' ........x.x.xxxx' },
    },
    A: {
      bars: 4,
      arp: rep('e3 b3 e4 b3 g4 b3 e4 b3 e3 b3 e4 b3 f4 b3 e4 b3 | d3 a3 d4 a3 f4 a3 d4 a3 c3 g3 c4 g3 e4 g3 c4 g3', 2),
      bass: rep('e2 e2 e2 e2 | d2 d2 c2 c2', 2),
      lead: 'e4*3 f4 g4*2 a4 b4 | c5*2 b4 a4 g4*2 f4*2 | e4*2 g4 f4 e4 d4 e4*2 | e4*6 . .',
      drums: {
        X: 'x............... ' + rest(3),
        K: rep('x.....x.x.......', 4), S: rep(BACKBEAT, 4), h: rep('x.xxx.xxx.xxx.xx', 4),
        t: rep('..x.......x.....', 4), T: rep('......x.......x.', 4),
      },
    },
    B: {
      bars: 4,
      arp: rep('e3 b3 e4 b3 g4 b3 e4 b3 e3 b3 e4 b3 f4 b3 e4 b3 | d3 a3 d4 a3 f4 a3 d4 a3 c3 g3 c4 g3 e4 g3 c4 g3', 2),
      bass: rep('e2 e2 e2 e2 | d2 d2 c2 c2', 2),
      lead: 'b4*2 c5 d5 e5*2 d5 c5 | d5*2 c5 b4 a4*2 g4*2 | c5*2 b4 a4 g4 f4 g4*2 | e4*4 f4*2 e4*2',
      choir: 'e3+g3+b3 d3+f3+a3 c3+e3+g3 e3+g3+b3',
      drums: {
        K: rep('x.....x.x.......', 4), S: rep(BACKBEAT, 4), h: rep('x.xxx.xxx.xxx.xx', 4),
        D: rep('x.......x.......', 4), T: rest(3) + ' ........x.x.xxxx',
      },
    },
    C: {
      bars: 4,
      bass: '@16 e2 f2 d2 e2',
      choir: 'e3+g3+b3 f3+a3+c4 d3+f3+a3 e3+g3+b3',
      lead: '@8 b4*2 c5*2 a4*2 b4*2',
      drums: {
        t: rep('x.x...x.x.x...x.', 4), T: rep('....x.......x...', 4),
        D: rep('x...............', 3) + ' x.......x.x.x.x.',
      },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B', 'A', 'B', 'C'],
};

export const shieldwall = {
  id: 'shieldwall', title: 'Shield Wall', pool: 'battle',
  bpm: 132, root: 'c', mode: 'harmonic-minor', passes: 3, gain: -0.7,
  echo: { steps: 3, feedback: 0.3, wet: 0.2, damp: 0.45 },
  channels: {
    strings: { patch: 'strings', res: 2, vol: -12, pan: -0.2, echo: 0.15, gate: 0.75 },
    brass: { patch: 'brass', res: 2, vol: -9, pan: 0.15, echo: 0.2, glide: 0.03 },
    bass: { patch: 'bass', res: 2, vol: -14, gate: 0.7 },
    drums: { drums: true, vol: -12, echo: 0.06 },
  },
  patterns: {
    intro: {
      bars: 2,
      drums: {
        D: 'x.....x...x..... x.....x...x.x.x.',
        B: 'x............... ' + rest(1),
        t: rest(1) + ' ............xxxx',
      },
    },
    A: {
      bars: 4,
      strings: 'c4 g3 c4 eb4 d4 g3 c4 g3 | c4 ab3 c4 eb4 c4 ab3 eb3 ab3 | c4 f3 ab3 c4 f4 c4 ab3 f3 | b3 g3 d4 b3 g4 d4 b3 g3',
      brass: 'g4*4 ab4 g4 f4 eb4 | eb4*2 c4*2 ab3*2 c4 eb4 | f4*3 g4 ab4*2 c5 ab4 | g4*6 . .',
      bass: 'c2 . c2 c2 . c2 g2 . | ab2 . ab2 ab2 . ab2 eb2 . | f2 . f2 f2 . f2 c3 . | g2 . g2 g2 . b2 d3 .',
      drums: {
        X: 'x............... ' + rest(3),
        D: rep('x.....x...x.....', 4), t: rep('....x.......x...', 4), T: rep('..........x...x.', 4),
        S: rep('........x.......', 4), h: rep(EIGHTHS, 4),
      },
    },
    B: {
      bars: 4,
      strings: 'c4 g3 c4 eb4 d4 g3 c4 g3 | c4 ab3 c4 eb4 c4 ab3 eb3 ab3 | c4 f3 ab3 c4 f4 c4 ab3 f3 | b3 g3 d4 b3 g4 d4 b3 g3',
      brass: 'c5*3 b4 c5 d5 eb5 d5 | c5*2 ab4 c5 eb5*2 d5 c5 | f4*2 ab4 c5 d5*2 c5 b4 | c5*4 b4*2 g4*2',
      bass: 'c2 . c2 c2 . c2 g2 . | ab2 . ab2 ab2 . ab2 eb2 . | f2 . f2 f2 . f2 c3 . | g2 . g2 g2 . b2 d3 .',
      drums: {
        D: rep('x.....x...x.....', 4), t: rep('....x.......x...', 4), T: rep('..........x...x.', 4),
        K: rep('x.......x.......', 4), S: rep('........x.......', 4), h: rep(EIGHTHS, 4), R: rep('....x...........', 4),
      },
    },
    C: {
      bars: 4,
      strings: '@16 c4 ab3 f3 g3',
      bass: '@4 c2*4 | ab1*4 | f1*4 | g1*2 b1 d2',
      drums: {
        D: rep('x..x..x.x.....x.', 3) + ' x..x..x.x.x.x.x.', B: 'x............... ' + rest(3),
        t: rep('....x.......x...', 3) + ' ....x...xxxxxxxx',
      },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B', 'A', 'B', 'C'],
};
