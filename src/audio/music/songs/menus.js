// Music of the campaign's screens (spec §6 Music, §5.8; research.md §9: "Chosen Destiny" on the house selection,
// "Evasive Action" on the region zoom after a briefing). Two original pieces written for this game:
// - houseSelect: one processional on D in four colours, in the order the houses stand on the screen — home in
//   Phrygian dominant (a kanun turning, the destiny theme on brass), the Atreides in Dorian (a horn call over a snare
//   march), the Ordos in Hungarian minor (a reed creeping over bells and a tek), the Harkonnen in Phrygian (low brass
//   and open fifths over war drums and an anvil). Loops while the player chooses.
// - region: about seven seconds, once — a sixteenth-note ostinato in E Phrygian under rising brass, a snare roll and
//   one last hit as the map closes in on the region.
import { rep, rest, at } from './kit.js';

export const houseSelect = {
  id: 'houseSelect', title: 'Three Banners', pool: 'houseSelect',
  bpm: 84, root: 'd', mode: 'phrygian-dominant', passes: 1, gain: 1.1,
  echo: { steps: 6, feedback: 0.32, wet: 0.24, damp: 0.45 },
  channels: {
    low: { patch: 'drone', voices: 2, res: 16, vol: -18 },
    choir: { patch: 'choir', voices: 3, res: 16, vol: -15, pan: 0.2, echo: 0.3 },
    horn: { patch: 'power', res: 2, vol: -7, pan: -0.1, echo: 0.3, glide: 0.05 },
    reed: { patch: 'reed', res: 2, vol: -9, pan: 0.15, echo: 0.35, glide: 0.07 },
    bass: { patch: 'bass', res: 2, vol: -13, gate: 0.8 },
    kanun: { patch: 'kanun', res: 2, vol: -15, pan: 0.3, echo: 0.3, gate: 0.9 },
    bell: { patch: 'bell', res: 2, vol: -16, pan: -0.3, echo: 0.4 },
    drums: { drums: true, vol: -11, echo: 0.12, crush: 13000 },
  },
  patterns: {
    intro: {
      bars: 1,
      low: 'd2+a2',
      choir: 'd3+f#3+a3:4',
      drums: { J: 'x.......g.g.x.x.', X: 'x...............' },
    },
    // home: the destiny theme over a kanun turning in threes — D, E-flat, C minor, D
    H: {
      bars: 4,
      low: 'd2+a2 eb2+bb2 c2+g2 d2+a2',
      choir: 'd3+f#3+a3 eb3+g3+bb3 c3+eb3+g3 d3+f#3+a3',
      kanun: 'a4 d5 f#5 a4 d5 f#5 a4 d5 | bb4 eb5 g5 bb4 eb5 g5 bb4 eb5 | g4 c5 eb5 g4 c5 eb5 g4 c5 | a4 d5 f#5 a4 d5 f#5 a4 d5',
      horn: 'd4*4 a4*4 | bb4*4 g4*2 bb4*2 | c5*3 bb4 g4*2 eb4*2 | d4*6 . .',
      bass: 'd2*4 a1*4 | eb2*4 bb1*4 | c2*4 g1*4 | d2*4 a1*4',
      drums: { J: rep('x.......g.......', 4), M: rep('............x...', 4), X: 'x............... ' + rest(3) },
    },
    // the Atreides: a horn call in D Dorian over a snare march — D minor, C, G, D minor
    A: {
      bars: 4, mode: 'dorian',
      low: 'd2+a2 c2+g2 g1+d2 d2+a2',
      choir: 'd3+f3+a3 c3+e3+g3 b2+d3+g3 d3+f3+a3',
      horn: 'd4*2 a4*3 g4 a4 b4 | c5*4 b4*2 g4*2 | a4*2 b4 c5 d5*2 e5*2 | d5*6 . .',
      bass: '@4 d2 . a1 . | c2 . g1 . | g1 . d2 . | d2 . a1 d2',
      drums: {
        K: rep('x.......x.......', 4),
        P: rep('g.g.x.g.g.g.x.gg', 3) + ' g.g.x.g.x.x.xxxx',
        X: 'x............... ' + rest(3),
      },
    },
    // the Ordos: a reed creeping in D Hungarian minor over bells and a tek — D minor, B-flat, A, D minor
    O: {
      bars: 4, mode: 'hungarian-minor',
      low: 'd2+d3 bb1+f2 a1+e2 d2+d3',
      choir: 'd3+f3+a3:5 bb2+d3+f3:5 a2+c#3+e3:5 d3+f3+a3:5',
      reed: 'a4*2 g#4 a4 bb4*2 a4*2 | f4*2 e4 f4 d4*4 | c#4*2 e4*2 g#4*2 a4*2 | bb4*2 a4 g#4 a4*4',
      bell: 'd5 a4 f5 a4 d5 a4 f5 a4 | bb4 f4 d5 f4 bb4 f4 d5 f4 | a4 e4 c#5 e4 a4 e4 c#5 e4 | d5 a4 f5 a4 g#5 a5 . .',
      bass: 'd2 . d2 . a1 . d2 c#2 | bb1 . bb1 . f2 . bb1 a1 | a1 . a1 . e2 . a1 g#1 | d2 . d2 . a1 . d2 .',
      drums: { k: rep('..x...g...x...g.', 4), C: rep('....x.......x...', 4), F: rep('x.........x.....', 4) },
    },
    // the Harkonnen: low brass and open fifths in D Phrygian over war drums and an anvil — D, E-flat, B-flat, D
    K: {
      bars: 4, mode: 'phrygian',
      low: 'd2+a2 eb2+bb2 bb1+f2 d2+a2',
      choir: 'd3+a3+d4 eb3+bb3+eb4 bb2+f3+bb3 d3+a3+d4',
      horn: at('d3*2 d3 eb3 d3*2 c3*2 | bb2*4 a2*2 bb2*2 | c3*2 eb3*2 d3*2 c3 bb2 | d3*6 . .', 10),
      bass: rep('d2 d2 . d2 eb2 . d2 .', 4),
      drums: {
        D: rep('x...x...x...x...', 4),
        R: rep('....x.......x...', 4),
        B: 'x............... ' + rest(1) + ' x............... ' + rest(1),
        T: rest(3) + ' ........x.x.x.x.',
      },
    },
  },
  intro: ['intro'],
  loop: ['H', 'A', 'O', 'K'],
};

export const region = {
  id: 'region', title: 'Into the Region', pool: 'region', once: true,
  bpm: 136, root: 'e', mode: 'phrygian', passes: 1, gain: -0.8,
  echo: { steps: 3, feedback: 0.28, wet: 0.2, damp: 0.5 },
  channels: {
    hit: { patch: 'hit', voices: 3, res: 4, vol: -12, echo: 0.25 },
    pad: { patch: 'strings', voices: 3, res: 16, vol: -15, pan: -0.25, echo: 0.2 },
    lead: { patch: 'power', res: 4, vol: -9, pan: 0.15, echo: 0.3, glide: 0.04 },
    bass: { patch: 'slap', res: 2, vol: -12, gate: 0.6 },
    arp: { patch: 'arp', res: 1, vol: -14, pan: 0.3, echo: 0.2, gate: 0.6 },
    drums: { drums: true, vol: -9, echo: 0.08, crush: 13000 },
  },
  patterns: {
    A: {
      bars: 4,
      hit: 'e3+g3+b3! . . . | f3+a3+c4 . . f3+a3+c4 | d3+f3+a3 . f3+a3+c4 . | e3+g3+b3! - - -',
      pad: 'e3+g3+b3:4 f3+a3+c4:6 d3+f3+a3:8 e3+b3+e4:10',
      lead: 'e4*4 | f4*4 | a4*2 c5*2 | e5! - - -',
      bass: 'e2 e2 e3 e2 e2 e2 b2 e2 | f2 f2 f3 f2 f2 f2 c3 f2 | d2 d2 d3 d2 f2 f2 f3 f2 | e2 - - - . . . .',
      arp: rep('e3 e3 b3 e3 f3 e3 c4 e3', 2) + ' | ' + rep('f3 f3 c4 f3 g3 f3 d4 f3', 2) + ' | ' + rep('d3 d3 a3 d3 f3 f3 c4 f3', 2) + ' | e4 .*15',
      drums: {
        X: 'x............... ' + rest(2) + ' X...............',
        K: rep('x...x...x...x...', 3) + ' x...............',
        P: '....x.......x... ....x.......x... g.g.g.g.xxxxXXXX ' + rest(1),
        h: rep('xxxxxxxxxxxxxxxx', 2) + ' ' + rest(2),
        B: rest(3) + ' x...............',
      },
    },
  },
  loop: ['A'],
};
