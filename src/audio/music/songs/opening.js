// The opening cue (spec §6 Music; research.md §8: the Sega intro — stars, the planet, three ships, the title — and
// INTRO_MARKS, contract C6): written to the intro's picture, second by second, and played once; the title theme
// follows it. A hit at the gesture, then a pad rising out of the dark in D harmonic minor (the choir enters with the
// credits at 4.0 s, brass swells with "present" at 10.0 s, a bell run falls on to the planet), the drums arriving with
// the planet at 16.0 s on a dominant resolved, a push for each ship (18.8, 20.3, 21.8 s), a three-bar build through
// B-flat and C, and the theme's first phrase on the title at 26.5 s, ending on the Phrygian cadence E-flat to D.
// Original music written for this game.
import { rep, rest } from './kit.js';

// the drive under the planet: eighths at 160, the pulse the title theme keeps in sixteenths at 80
const OST = 'd2 d2 d3 d2 a2 d2 c3 d2', OST_EB = 'eb2 eb2 eb3 eb2 bb2 eb2 d3 eb2';
const HATS = 'x.x.x.x.x.x.x.x.';

export const opening = {
  id: 'opening', title: 'Approach to Arrakis', pool: 'intro', once: true,
  bpm: 160, root: 'd', mode: 'phrygian-dominant', passes: 1, gain: -1.2,
  echo: { steps: 4, feedback: 0.32, wet: 0.24, damp: 0.45 },
  channels: {
    hit: { patch: 'hit', voices: 3, res: 2, vol: -12, echo: 0.3 },
    low: { patch: 'drone', voices: 2, res: 16, vol: -16 },
    pad: { patch: 'pad', voices: 3, res: 16, vol: -13, pan: -0.25, echo: 0.2 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -12, pan: 0.25, echo: 0.3 },
    lead: { patch: 'power', res: 4, vol: -9, pan: 0.1, echo: 0.3, glide: 0.04 },
    bass: { patch: 'slap', res: 2, vol: -11, gate: 0.7 },
    bell: { patch: 'bell', res: 2, vol: -16, pan: 0.35, echo: 0.45 },
    drums: { drums: true, vol: -10, echo: 0.1, crush: 13000 },
  },
  patterns: {
    // 0.0–4.0 s: the hit, then the dark (two bars of 120)
    impact: {
      bars: 2, bpm: 120, mode: 'harmonic-minor',
      hit: '@4 d3+a3+d4! - . . | . . . .',
      low: 'd2+a2:6 d2+a2:4',
      pad: 'd3+f3+a3:2 d3+f3+a3:3',
      bell: '@2 .*8 | . . a5:3 . . . d6:3 .',
      drums: { X: 'X............... ' + rest(1), B: 'X............... ' + rest(1), J: 'X............... ' + rest(1) },
    },
    // 4.0–10.0 s: the credits — the choir comes in, stars glint
    stars: {
      bars: 3, bpm: 120, mode: 'harmonic-minor',
      low: 'd2+d3:4 d2+d3:4 d2+a2:5',
      pad: 'bb2+d3+f3:4 g2+bb2+d3:4 a2+d3+f3:5',
      choir: 'bb3+d4+f4:4 g3+bb3+d4:5 f3+a3+d4:5',
      bell: '. . f5:3 . . . bb5:4 . | . d6:3 . . g5:4 . . . | . . a5:4 . e6:3 . d6:4 .',
    },
    // 10.0–16.0 s: "present" — brass swells over a rising line to the dominant; a bell run falls on to the planet
    present: {
      bars: 3, bpm: 120, mode: 'harmonic-minor',
      low: 'bb1+f2:6 g1+d2:7 a1+e2:9',
      pad: 'bb2+d3+f3:6 g2+bb2+d3:7 a2+c#3+e3:9',
      choir: 'bb3+d4+f4:6 bb3+d4+g4:7 a3+c#4+e4:9',
      lead: 'f4:5*4 | g4:6*2 bb4:7*2 | a4:8*2 a4:10*2',
      bell: '@1 . . a5:4 - . . . . d6:4 - . . . . . . | . . . . g5:5 - . . bb5:5 - . . d6:5 - . . | .*8 a4:5 bb4:5 c#5:6 d5:6 e5:7 f5:8 g5:9 a5:10',
    },
    // 16.0–19.0 s: the planet — the drums arrive; the first ship's push on the last eighth (18.81 s)
    planet: {
      bars: 2,
      hit: 'd3+f#3+a3! - . . . . . . | . . . . . . . eb3+g3+bb3!',
      low: 'd2+a2*2',
      pad: 'd3+f#3+a3*2',
      choir: 'd4+f#4+a4*2',
      bass: OST + ' | d2 d2 d3 d2 c3 d2 a2 eb2',
      bell: '@4 d6! . . . | . . . .',
      drums: {
        X: 'X............... ..............X.',
        B: 'x............... ..............x.',
        J: 'X............... ' + rest(1),
        K: '........x.x..... x.......x.......',
        P: '....x.......x... ....x.......x...',
        h: rep(HATS, 2),
        T: rest(1) + ' ........x.x.....',
      },
    },
    // 19.0–20.5 s: E-flat; the second ship's push (20.31 s)
    ship2: {
      bars: 1,
      hit: '- . . . . . . d3+f#3+a3!',
      low: 'eb2+bb2',
      pad: 'eb3+g3+bb3',
      choir: 'eb4+g4+bb4',
      bass: OST_EB,
      drums: { X: '..............X.', B: '..............x.', K: '........x.x.....', P: '....x.......x...', h: HATS, t: '........x.x.....' },
    },
    // 20.5–22.0 s: D again; the third ship's push (21.81 s) lands the build
    ship3: {
      bars: 1,
      hit: '- . . . . . . bb2+d3+bb3!',
      low: 'd2+a2',
      pad: 'd3+f#3+a3',
      choir: 'd4+f#4+a4',
      bass: OST,
      drums: { X: '..............X.', B: '..............x.', K: '........x.x.....', P: '....x.......x...', h: HATS, T: '........x.x.....' },
    },
    // 22.0–26.5 s: the build, B-flat and C (borrowed from D Aeolian) climbing to the title
    build: {
      bars: 3, mode: 'aeolian',
      hit: '- . . . . . . . | c3+e3+g3! - . . . . . . | . . . . c3+e3+g3 . c3+e3+g3 .',
      low: 'bb1+f2 c2+g2 c2+g2',
      pad: 'bb2+d3+f3 c3+e3+g3 c3+e3+g3',
      choir: 'bb3+d4+f4 c4+e4+g4 c4+f4+g4',
      lead: 'd4*2 f4*2 | e4*2 g4*2 | g4 a4 bb4 c5',
      bass: 'bb1 bb1 bb2 bb1 f2 bb1 a2 bb1 | c2 c2 c3 c2 g2 c2 bb2 c2 | c2 c2 c3 c2 c2 c2 c3 c2',
      drums: {
        K: 'x.......x....... x.......x.x..... x...x...x...x...',
        P: '....x.......x... ....x.......x... g.g.g.g.xxxxXXXX',
        h: rep(HATS, 2) + ' ' + rest(1),
        T: rest(1) + ' ............x.x. x...x...........',
        J: rest(2) + ' ........g.g.x.x.',
      },
    },
    // 26.5–32.5 s: the title — the theme's first phrase, D to the Phrygian cadence E-flat → D
    title: {
      bars: 4,
      hit: 'd3+f#3+a3! - . . . . . . | . . . . eb3+g3+bb3! - . . | d3+f#3+a3! - . . . . . . | eb3+g3+bb3! - . . d3+f#3+a3! - - -',
      low: '@8 d2+a2*2 | d2+a2 eb2+bb2 | d2+a2*2 | eb2+bb2 d2+a2',
      pad: '@8 d3+f#3+a3*2 | d3+f#3+a3 eb3+g3+bb3 | d3+f#3+a3*2 | eb3+g3+bb3 d3+f#3+a3',
      choir: '@8 d4+f#4+a4*2 | d4+f#4+a4 eb4+g4+bb4 | d4+f#4+a4*2 | eb4+g4+bb4 d4+f#4+a4',
      lead: 'd5*3 a4 | d5*2 eb5*2 | f#5*4 | eb5*2 d5*2',
      bass: OST + ' | d2 d2 d3 d2 eb2 eb2 eb3 eb2 | ' + OST + ' | eb2 eb2 eb3 eb2 d2 - - -',
      bell: '@4 d6! . a5 . | . . bb5 . | f#6 . d6 . | eb6 . d6! .',
      drums: {
        X: 'X............... ' + rest(1) + ' x............... ........X.......',
        B: 'x............... ' + rest(2) + ' ........x.......',
        J: 'X............... ........x....... x............... ........x.......',
        K: '........x.x..... ' + rep('x.......x.x.....', 2) + ' x...............',
        P: rep('....x.......x...', 3) + ' ....x...........',
        h: rep(HATS, 3) + ' x.x.x.x.........',
        T: rest(1) + ' ............x.x. ' + rest(1) + ' ..........x.....',
      },
    },
    // 32.5–34.0 s: the last chord held; the title theme takes over as it rings out
    end: {
      bars: 1,
      hit: '.*8',
      low: '-', pad: '-', choir: '-', lead: '-*4', bass: '.*8',
    },
  },
  intro: ['impact', 'stars', 'present'],
  loop: ['planet', 'ship2', 'ship3', 'build', 'title', 'end'],
};
