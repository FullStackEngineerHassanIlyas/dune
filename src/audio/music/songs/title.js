// The title theme (spec §6 Music; plays on the main menu, research audio-ui-controls.md §A.2): an original piece in
// D Phrygian dominant — a drone and a choir rising out of silence, the theme on a ney over frame drums, the same
// theme answered by brass over war drums, and a bridge through B-flat and E-flat back home. Written for this game.
import { rep, rest } from './kit.js';

export const title = {
  id: 'title', title: 'Arrakis', pool: 'title',
  bpm: 80, root: 'd', mode: 'phrygian-dominant', passes: 1, gain: -3.6,
  echo: { steps: 6, feedback: 0.35, wet: 0.28, damp: 0.45 },
  channels: {
    drone: { patch: 'drone', voices: 2, res: 16, vol: -13 },
    pad: { patch: 'strings', voices: 3, res: 16, vol: -15, pan: -0.25, echo: 0.2 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -13, pan: 0.25, echo: 0.3 },
    lead: { patch: 'ney', res: 2, vol: -7, pan: 0.1, echo: 0.4, glide: 0.05 },
    horn: { patch: 'brass', res: 2, vol: -9, pan: -0.1, echo: 0.2, glide: 0.04 },
    bass: { patch: 'bass', res: 4, vol: -10, gate: 0.9 },
    drums: { drums: true, vol: -5, echo: 0.12 },
  },
  patterns: {
    intro: {
      bars: 4,
      drone: '@16 d2+a2*4',
      choir: '. eb3+g3+bb3 d3+f#3+a3*2',
      drums: {
        B: 'X............... ' + rest(3),
        D: rest(2) + ' x.......x....... x...x...x.x.x.x.',
        T: rest(3) + ' ............g.x.',
        t: rest(3) + ' ........g.x.....',
      },
    },
    A: {
      bars: 8,
      lead: 'a4*4 bb4 a4 g4 f#4 | g4*2 f#4 eb4 d4*4 | d4 eb4 f#4 g4 a4*2 c5 bb4 | a4*6 . . | d5*3 c5 bb4*2 a4 g4 | a4*2 bb4 a4 g4*2 f#4 g4 | f#4*2 eb4 f#4 g4 f#4 eb4 c4 | d4*6 . .',
      drone: 'd2+a2*8',
      pad: 'd3+f#3+a3 g2+bb2+d3 d3+f#3+a3 c3+eb3+g3 bb2+d3+f#3 g2+bb2+d3 eb3+g3+bb3 d3+f#3+a3',
      bass: 'd2*3 a1 | g1*3 d2 | d2*3 a1 | c2*3 g1 | bb1*3 d2 | g1*3 bb1 | eb2*3 bb1 | d2*2 a1 d2',
      drums: {
        X: 'x...............' + ' ' + rest(7),
        F: rep('x.......x..x....', 8),
        k: rep('....x.......x.x.', 8),
        s: rep('..g...g...g...g.', 8),
      },
    },
    B: {
      bars: 8,
      horn: 'd4*2 a3 d4 f#4*2 g4 a4 | bb4*3 a4 g4*2 f#4 eb4 | d4*2 eb4 d4 c4*2 bb3 c4 | d4*6 . . | g4*2 f#4 g4 a4*2 bb4 c5 | d5*4 c5 bb4 a4 g4 | a4*2 bb4 a4 g4 f#4 eb4*2 | d4*6 . .',
      lead: '@8 .*8 bb4*2 d5 c5 a4*2 .*2',
      drone: 'd2+a2*8',
      pad: 'd3+f#3+a3 g2+bb2+d3 c3+eb3+g3 d3+f#3+a3 g2+bb2+d3 bb2+d3+f#3 eb3+g3+bb3 d3+f#3+a3',
      bass: '@2 d2 . d2 d2 . d2 a1 . | g1 . g1 g1 . g1 d2 . | c2 . c2 c2 . c2 g1 . | d2 . d2 d2 . d2 a1 . | g1 . g1 g1 . g1 d2 . | bb1 . bb1 bb1 . bb1 d2 . | eb2 . eb2 eb2 . eb2 bb1 . | d2 . d2 d2 . a1 d2 .',
      drums: {
        X: 'x............... ' + rest(3) + ' x............... ' + rest(3),
        D: rep('x.....x.x.......', 3) + ' x.....x.x...x.x. ' + rep('x.....x.x.......', 3) + ' x...x.x.x.xxx.x.',
        T: rep('............x...', 8),
        k: rep('..g...g...g...g.', 8),
      },
    },
    C: {
      bars: 4,
      lead: 'f#4*4 d4*2 bb3*2 | g4*4 eb4*2 bb3*2 | c4*2 eb4*2 g4*2 bb4*2 | a4*6 g4 f#4',
      choir: 'bb2+d3+f#3 eb3+g3+bb3 c3+eb3+g3 d3+f#3+a3',
      pad: 'bb2+d3+f#3 eb3+g3+bb3 c3+eb3+g3 d3+f#3+a3',
      drone: 'd2+a2*4',
      bass: 'bb1*4 | eb2*4 | c2*4 | d2*2 a1*2',
      drums: {
        D: 'x............... x............... x.......x....... x...x...x.x.x.x.',
        T: rest(3) + ' ........g.g.x.xX',
        F: rep('....x.......x...', 4),
      },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B', 'C'],
};
