// The title theme (spec §6 Music; research.md §9: the Sega menu plays under the opening's loop): the menu's music,
// following the opening cue on the same pulse. D Phrygian dominant on the Mega Drive's own colours — a slapped bass
// ostinato in sixteenths, a choir and a swelling pad, power brass for the theme, half-time sampled drums. A low horn
// calls over the bass; the theme (the phrase the opening's title ends on) runs on through C minor and back; it climbs
// through G minor and E-flat; then everything falls away to a kanun and a bell until the drums bring it round again.
// Original music written for this game.
import { rep, rest, at } from './kit.js';

// the bass's sixteenths, one bar on each chord
const B_D = 'd2 d2 d3 d2 a2 d2 c3 d2 d2 d2 d3 d2 eb3 d3 c3 a2';
const B_EB = 'eb2 eb2 eb3 eb2 bb2 eb2 d3 eb2 eb2 eb2 eb3 eb2 g2 bb2 d3 bb2';
const B_CM = 'c2 c2 c3 c2 g2 c2 bb2 c2 c2 c2 c3 c2 eb3 d3 c3 g2';
const B_GM = 'g1 g1 g2 g1 d2 g1 f#2 g1 g1 g1 g2 g1 bb2 a2 g2 d2';
const B_DEB = 'd2 d2 d3 d2 a2 d2 c3 d2 eb2 eb2 eb3 eb2 g2 bb2 d3 bb2';
const B_CBB = 'c2 c2 c3 c2 g2 c2 bb2 c2 bb1 bb1 bb2 bb1 f#2 bb1 d2 f#2';
const GROOVE = { K: 'x.....x...x.....', P: '........x.......' };

export const title = {
  id: 'title', title: 'Dunes of Arrakis', pool: 'title',
  bpm: 80, root: 'd', mode: 'phrygian-dominant', passes: 0, gain: 0,
  echo: { steps: 6, feedback: 0.32, wet: 0.24, damp: 0.45 },
  channels: {
    low: { patch: 'drone', voices: 2, res: 16, vol: -17 },
    pad: { patch: 'pad', voices: 3, res: 16, vol: -16, pan: -0.25, echo: 0.2 },
    choir: { patch: 'choir', voices: 3, res: 8, vol: -14, pan: 0.25, echo: 0.3 },
    lead: { patch: 'power', res: 2, vol: -6, pan: 0.1, echo: 0.35, glide: 0.04 },
    horn: { patch: 'brass', res: 2, vol: -14, pan: -0.15, echo: 0.2, glide: 0.05 },
    bass: { patch: 'slap', res: 1, vol: -13, gate: 0.6 },
    arp: { patch: 'kanun', res: 1, vol: -16, pan: 0.3, echo: 0.3, gate: 0.8 },
    bell: { patch: 'bell', res: 2, vol: -18, pan: -0.3, echo: 0.45 },
    drums: { drums: true, vol: -6, echo: 0.1, crush: 13000 },
  },
  patterns: {
    // the dark before the theme: a drone, the choir turning E-flat to D, the bass creeping in
    intro: {
      bars: 2,
      low: 'd2+a2*2',
      pad: 'a3+d4+f#4:3 bb3+eb4+g4:4',
      choir: 'd3+f#3+a3:4*2 eb3+g3+bb3:5*2',
      bass: '.*16 | ' + at(B_EB, 4),
      bell: '. . a5:4 . . . d6:4 . | . eb6:4 . . bb5:4 . . .',
      drums: { J: 'X............... ' + rest(1), M: rest(1) + ' ............g.g.', T: rest(1) + ' ..............x.' },
    },
    // the low horn calls over the bass: D, E-flat, D, C minor
    A: {
      bars: 4,
      low: 'd2+a2 eb2+bb2 d2+a2 c2+g2',
      choir: 'd3+f#3+a3*2 | eb3+g3+bb3*2 | d3+f#3+a3*2 | c3+eb3+g3 d3+f#3+a3',
      horn: '.*4 a3 d4 eb4*2 | g4*4 f#4*2 eb4*2 | .*4 a3 d4 eb4*2 | c4*4 ~d4*4',
      bass: [B_D, B_EB, B_D, B_CM].join(' | '),
      drums: {
        X: 'x............... ' + rest(3),
        B: 'x............... ' + rest(3),
        K: rep(GROOVE.K, 4), P: rep(GROOVE.P, 4),
        h: rep('x...x...x...x...', 4),
        T: rest(3) + ' ............x.x.',
      },
    },
    // the theme on power brass, the horn holding under it
    B: {
      bars: 4,
      low: 'd2+a2 d2+a2 c2+g2 d2+a2',
      choir: 'd3+f#3+a3*2 | d3+f#3+a3 eb3+g3+bb3 | c3+eb3+g3*2 | d3+f#3+a3*2',
      lead: 'd5*3 a4 d5*2 eb5*2 | f#5*4 eb5*2 d5*2 | c5*3 bb4 c5*2 eb5*2 | d5*4 c5 bb4 a4*2',
      horn: '@8 f#4*2 | a4 bb4 | g4*2 | f#4*2',
      bass: [B_D, B_DEB, B_CM, B_D].join(' | '),
      drums: {
        X: 'x............... ' + rest(3),
        K: rep(GROOVE.K, 4), P: rep(GROOVE.P, 4),
        h: rep('x.x.x.x.x.x.x.x.', 4),
        s: rep('....x.......x...', 4),
        M: rest(3) + ' ..........x.x...',
      },
    },
    // the theme climbs: G minor, E-flat, C minor to B-flat augmented, D — the horn an octave under the lead
    C: {
      bars: 4,
      low: 'g1+d2 eb2+bb2 c2+g2 d2+a2',
      choir: 'g3+bb3+d4*2 | eb3+g3+bb3*2 | c3+eb3+g3 bb2+d3+f#3 | d3+f#3+a3*2',
      lead: 'g4*3 a4 bb4*2 d5*2 | eb5*4 d5*2 c5*2 | bb4*2 c5*2 d5*2 eb5*2 | f#5*6 . .',
      horn: 'g3*3 a3 bb3*2 d4*2 | eb4*4 d4*2 c4*2 | bb3*2 c4*2 d4*2 eb4*2 | f#4*6 . .',
      bass: [B_GM, B_EB, B_CBB, B_D].join(' | '),
      drums: {
        X: 'x............... ' + rest(1) + ' x............... ' + rest(1),
        J: 'x............... ' + rest(1) + ' x............... ' + rest(1),
        K: rep(GROOVE.K, 4), P: rep(GROOVE.P, 4),
        h: rep('x.x.x.x.x.x.x.x.', 4),
        T: rest(1) + ' ............x.x. ' + rest(1) + ' ........x...x.x.',
        t: rest(1) + ' ..........x..... ' + rest(1) + ' ..........x.....',
      },
    },
    // it falls away: a kanun turning over the chords, the bell remembering the theme; the drums bring it round
    D: {
      bars: 4,
      low: 'd2+a2*4',
      choir: 'd3+f#3+a3*2 | eb3+g3+bb3*2 | c3+eb3+g3*2 | d3+f#3+a3*2',
      arp: [rep('d4 a4 f#4 a4 d5 a4 f#4 a4', 2), rep('eb4 bb4 g4 bb4 eb5 bb4 g4 bb4', 2), rep('c4 g4 eb4 g4 c5 g4 eb4 g4', 2),
        'd4 a4 f#4 a4 d5 a4 f#4 a4 d5 eb5 f#5 g5 a5 bb5 c6 d6'].join(' | '),
      bell: '@4 d6 . a5 . | eb6 . d6 . | c6 . bb5 . | a5 . . .',
      bass: '.*48 | ' + at('d2 . . . d2 . . . d2 . d2 . d2 d2 d2 d2', 6),
      drums: {
        J: 'x............... x............... x............... x...............',
        M: rep('........g.......', 3) + ' ' + rest(1),
        P: rest(3) + ' g.g.g.g.x.x.xxXX',
        T: rest(3) + ' x...x...........',
      },
    },
  },
  intro: ['intro'],
  loop: ['A', 'B', 'C', 'D'],
};
