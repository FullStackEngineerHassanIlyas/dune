// The soundtrack's instruments as YM2612 patches (fm.js; research audio-ui-controls.md §A.2: synth strings, reed
// and shakuhachi-like leads, gated brass, plucked strings, drones). Each operator is
// [mul, detune cents, total level 0–127, attack 0–31, decay 0–31, sustain level 0–15, second decay 0–31, release 0–15, key scaling 0–3, tremolo 0|1].
// Everything heard low also has strong upper partials, so a laptop speaker that cannot move below 150 Hz still
// carries the bass line and the drone. `gain` (dB) evens the patches out, so a channel's volume means the same
// on every instrument.
export const PATCHES = {
  // a bowed-reed drone: two 1:1 pairs slightly apart, brightness breathing with a slow tremolo on the modulators
  drone: {
    alg: 4, fb: 3, lfo: { rate: 0.23, am: 6 }, gain: -3,
    ops: [[1, 0, 20, 12, 0, 0, 0, 6, 0, 1], [1, 2, 6, 11, 0, 0, 0, 6], [3, -3, 26, 12, 0, 0, 0, 6, 0, 1], [1, -2, 8, 11, 0, 0, 0, 6]],
  },
  // a plucked FM bass: the bite fades from the fundamental's modulator, a second carrier an octave up for small speakers
  bass: {
    alg: 4, fb: 4, gain: -2,
    ops: [[1, 0, 22, 31, 15, 6, 5, 8], [1, 0, 6, 31, 7, 2, 3, 9], [3, 4, 36, 31, 17, 9, 6, 8], [2, -3, 6, 31, 8, 3, 4, 9]],
  },
  // a driving battle bass: harder, brighter, shorter
  drive: {
    alg: 0, fb: 5, gain: -1,
    ops: [[1, 0, 28, 31, 14, 5, 6, 9], [3, 0, 34, 31, 16, 7, 6, 9], [2, 0, 24, 31, 12, 4, 5, 9], [1, 0, 0, 31, 8, 2, 4, 10]],
  },
  // a shakuhachi / ney: sines at 1, 2 and 3 with a breath of feedback noise that puffs at the start
  ney: {
    alg: 7, fb: 7, lfo: { rate: 5.2, pm: 14, delay: 0.35 }, gain: -2,
    ops: [[1, 0, 34, 24, 18, 8, 6, 9], [1, 0, 0, 17, 0, 0, 0, 8], [2, 3, 18, 16, 6, 3, 2, 8], [3, -3, 24, 16, 8, 4, 3, 8]],
  },
  // a mizmar-like double reed: nasal odd partials from a 3:1 pair over a fuller 1:1 pair
  reed: {
    alg: 4, fb: 4, lfo: { rate: 5.6, pm: 16, delay: 0.25 }, gain: -3,
    ops: [[3, 0, 30, 22, 8, 3, 2, 9], [1, 2, 6, 20, 4, 1, 1, 8], [1, -2, 28, 22, 8, 3, 2, 9], [1, -2, 10, 20, 4, 1, 1, 8]],
  },
  // synth strings: two detuned sawtooth-like pairs, slow bow, vibrato coming in late
  strings: {
    alg: 4, fb: 5, lfo: { rate: 5, pm: 8, delay: 0.5 }, gain: -4,
    ops: [[1, 0, 23, 11, 4, 2, 1, 6], [1, 6, 4, 10, 2, 1, 0, 6], [1, 0, 25, 11, 4, 2, 1, 6], [1, -6, 6, 10, 2, 1, 0, 6]],
  },
  // a choir-like pad: additive partials leaning on the third and fourth, slow and wide
  choir: {
    alg: 7, fb: 0, lfo: { rate: 4.6, pm: 10, am: 1.5, delay: 0.4 }, gain: -7,
    ops: [[1, 4, 8, 9, 0, 0, 0, 6, 0, 1], [2, -4, 10, 9, 0, 0, 0, 6], [3, 3, 10, 10, 0, 0, 0, 6, 0, 1], [5, -3, 12, 10, 0, 0, 0, 6]],
  },
  // gated brass: the modulators open a little after the carriers, the blare of a brass section
  brass: {
    alg: 4, fb: 5, lfo: { rate: 5.4, pm: 7, delay: 0.3 }, gain: -3,
    ops: [[1, 0, 19, 17, 6, 3, 2, 8], [1, 3, 2, 21, 5, 2, 2, 8], [1, -3, 23, 16, 6, 3, 2, 8], [1, -3, 6, 20, 5, 2, 2, 8]],
  },
  // a short orchestral stab for the battle tracks
  stab: {
    alg: 4, fb: 6, gain: -3,
    ops: [[1, 0, 18, 31, 13, 6, 9, 9], [1, 4, 0, 31, 9, 4, 7, 9], [2, -4, 22, 31, 13, 6, 9, 9], [1, -4, 4, 31, 9, 4, 7, 9]],
  },
  // an oud-like pluck: a bright attack that darkens, with a little twang from a 5:1 pair
  oud: {
    alg: 4, fb: 3, gain: -1,
    ops: [[1, 0, 16, 31, 16, 7, 6, 8], [1, 0, 0, 31, 9, 4, 5, 7], [5, 3, 26, 31, 19, 10, 8, 8], [2, -3, 8, 31, 11, 5, 6, 7]],
  },
  // a kanun / dulcimer: brighter and longer ringing than the oud, for arpeggios
  kanun: {
    alg: 5, fb: 4, gain: -6,
    ops: [[1, 0, 30, 31, 15, 7, 6, 7], [1, 3, 2, 31, 8, 4, 5, 6], [3, 0, 18, 31, 10, 5, 6, 6], [1, -3, 6, 31, 8, 4, 5, 6]],
  },
  // a glassy bell: inharmonic 7:2 modulation, a long clear ring
  bell: {
    alg: 4, fb: 0, gain: -3,
    ops: [[7, 0, 34, 31, 12, 8, 4, 6], [2, 0, 4, 31, 6, 4, 3, 5], [5, 7, 40, 31, 14, 9, 5, 6], [1, -7, 10, 31, 7, 4, 3, 5]],
  },
  // the battle lead: a saw-like feedback chain, cutting but not shrill
  lead: {
    alg: 3, fb: 6, lfo: { rate: 5.8, pm: 12, delay: 0.25 }, gain: -3,
    ops: [[1, 0, 28, 28, 6, 3, 2, 9], [1, 0, 30, 28, 6, 3, 2, 9], [2, 3, 34, 26, 6, 3, 2, 9], [1, 0, 2, 26, 3, 1, 1, 9]],
  },
  // a sequenced synth pluck for the battle ostinati
  arp: {
    alg: 5, fb: 5, gain: -6,
    ops: [[1, 0, 28, 31, 16, 7, 8, 9], [1, 3, 4, 31, 10, 5, 7, 10], [2, 0, 14, 31, 12, 6, 7, 10], [1, -3, 6, 31, 10, 5, 7, 10]],
  },
  // phase 3 (the menus, the opening, the endings): the Mega Drive's own colours
  // an orchestra hit: two hard-driven pairs, one an octave up, a bright blare that dies within half a second
  hit: {
    alg: 4, fb: 7, gain: -4,
    ops: [[1, 0, 12, 31, 13, 5, 9, 8], [1, 5, 0, 31, 8, 3, 6, 8], [2, -5, 16, 31, 15, 6, 10, 8], [1, -5, 3, 31, 9, 4, 6, 8]],
  },
  // a picked and slapped bass: a 7:1 pop on top of a round 1:1 body, for driving ostinati
  slap: {
    alg: 4, fb: 5, gain: -2,
    ops: [[1, 0, 20, 31, 17, 7, 6, 9], [1, 0, 4, 31, 6, 2, 3, 9], [7, 0, 26, 31, 24, 15, 0, 9], [1, 0, 8, 31, 9, 3, 4, 9]],
  },
  // power brass: the bright, saw-edged synth brass of the cartridge era, an octave pair for its bite
  power: {
    alg: 4, fb: 6, lfo: { rate: 5.5, pm: 9, delay: 0.35 }, gain: -4,
    ops: [[1, 0, 20, 27, 6, 2, 2, 8], [1, 3, 2, 26, 3, 1, 1, 8], [2, -3, 30, 28, 8, 3, 2, 8], [1, -3, 6, 26, 3, 1, 1, 8]],
  },
  // a warm pad that swells: the modulators open more slowly than the carriers, so it brightens as it grows
  pad: {
    alg: 4, fb: 4, lfo: { rate: 0.4, pm: 6, am: 2 }, gain: -4,
    ops: [[1, 0, 26, 6, 0, 0, 0, 5, 0, 1], [1, 5, 6, 8, 0, 0, 0, 5], [2, -5, 32, 6, 0, 0, 0, 5, 0, 1], [1, -5, 8, 8, 0, 0, 0, 5]],
  },
};
