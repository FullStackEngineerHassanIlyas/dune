// The Mentat's face on the real voice's clock (notes docs/superpowers/notes/2026-10-05-mentat-talk.md, the GPU rounds):
// the mouth is looked at motion.lead ahead of what is heard (a line's smooth() time, as MentatLine gives it), so its
// shapes reach the screen with their sound; a line's first frame catches up only the time heard, not the look ahead;
// screen after screen his blinks do not repeat. A voice like the fakes' (mentat-face-fakes.mjs), its line with smooth()
// as the real one has.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachMentatFace } from '../src/ui/campaign/mentat-face.js';
import { rigFor } from '../src/ui/campaign/mentat-face-rigs.js';
import { DEFAULT_MOTION } from '../src/ui/campaign/mentat-face-rig.js';
import { Blinker } from '../src/ui/campaign/mentat-face-motion.js';
import { ADVICE } from './mentat-face-fakes.mjs';
import { synth, clone, makeStage, fakeVoice, frames } from './mentat-face-fakes.mjs';

/** The fakes' voice, its line answering smooth() (the heard time carried on) as MentatLine does. */
function smoothVoice(json) {
  const voice = fakeVoice(json);
  voice.line.smooth = () => voice.clock[0];
  return voice;
}
function setup(json, house = 'ordos', opts = {}) {
  const voice = smoothVoice(json);
  const stage = makeStage(house, voice);
  const d = frames(voice);
  const face = attachMentatFace(stage, clone(rigFor(house)), { raf: d.raf, caf: d.caf, reducedMotion: false, ...opts });
  return { voice, d, face };
}

test('the mouth is looked at motion.lead ahead of what is heard: 70 ms, so its shapes are on screen with their sound', () => {
  assert.equal(DEFAULT_MOTION.lead, 0.07);
  for (const house of ['atreides', 'harkonnen', 'ordos']) assert.equal(rigFor(house).motion.lead, undefined, `${house} keeps the default`);
  const { voice, d, face } = setup(synth([[200, 2200, 'neutral']], { every: 100 }));
  voice.play();
  d.run(1);
  assert.ok(Math.abs(face.frame.t - (voice.clock[0] + 0.07)) < 1e-9, `the frame read is ${face.frame.t} at ${voice.clock[0]} heard`);
  // a shape takes over (outweighs the one before) about when its sound starts: the 60 ms blend and the spring take the rest
  const track = voice.track, switches = [];
  let prev = -1;
  d.run(1.5, () => {
    let k = 0;
    for (let i = 1; i < 7; i++) if (face.w[i] > face.w[k]) k = i;
    if (k !== prev && prev >= 0) switches.push([voice.clock[0], k]);
    prev = k;
  });
  const lags = switches.map(([t, k]) => {
    let best = Infinity;
    for (let i = 0; i < track.visemeTimes.length; i++) if (track.visemeShapes[i] === k && Math.abs(t - track.visemeTimes[i]) < Math.abs(best)) best = t - track.visemeTimes[i];
    return best;
  }).filter((x) => Math.abs(x) < 0.1).sort((a, b) => a - b);
  assert.ok(lags.length >= 10, `${lags.length} shape changes`);
  const median = lags[lags.length >> 1];
  assert.ok(median < -0.015 && median > -0.06, `a shape takes over ${(median * 1000).toFixed(0)} ms from its start in the track (heard time)`);
});

test('a line\'s first frame catches up the time heard (a late first frame), not the look ahead: no jump at a line\'s start', () => {
  // he speaks at once: an open shape from the line's first instant
  const json = synth([[0, 1500, 'neutral']], { cycle: 'a', every: 400 });
  // on time: the first frame 16 ms in moves the mouth one frame's way, not 86 ms of it
  let { voice, d, face } = setup(json);
  voice.play();
  d.step(16);
  // (one frame of the 50 ms spring is half the way; catching up the 86 ms looked ahead would be all of it at once)
  assert.ok(face.w[0] > 0.4, `on time, the first frame takes one frame's step from rest: rest ${face.w[0].toFixed(2)}`);
  d.run(0.2);
  assert.ok(face.w[3] > 0.95, 'and it opens over the next frames');
  // late: the page was busy as the sound began, 90 ms heard by the first frame: the mouth is shown where the voice is
  ({ voice, d, face } = setup(json));
  voice.play();
  voice.clock[0] = 0.074;
  d.step(16);
  assert.ok(face.w[3] > 0.7, `late, the first frame catches up: A ${face.w[3].toFixed(2)}`);
});

test('screen after screen the same Mentat does not blink at the same moments: each face starts at its own place in his blinks', () => {
  // the schedule itself: the same seed from another place in its table of chances, still within the Mentat's interval
  const a = new Blinker({ min: 2.6, max: 5.4, seed: 3 }), b = new Blinker({ min: 2.6, max: 5.4, seed: 3, start: 89 });
  assert.notEqual(a.next, b.next);
  assert.equal(new Blinker({ min: 2.6, max: 5.4, seed: 3, start: 89 }).next, b.next, 'still seeded: the same start, the same blinks');
  const starts = (house) => {
    const { voice, d, face } = setup(ADVICE, house);
    voice.play();
    const out = [];
    let was = 0, t = 0;
    d.run(8, () => { t += 1 / 60; if (face.s[4] > 0 && was === 0) out.push(+t.toFixed(2)); was = face.s[4]; });
    face.destroy();
    return out;
  };
  for (const house of ['atreides', 'harkonnen', 'ordos']) {
    const one = starts(house), two = starts(house), three = starts(house);
    assert.ok(one.length >= 2 && two.length >= 2 && three.length >= 2, `${house} blinks: ${one} | ${two} | ${three}`);
    assert.notDeepEqual(one, two, `${house}: two screens, two schedules`);
    assert.notDeepEqual(two, three, `${house}: and a third`);
    assert.ok(new Set([one[0], two[0], three[0]]).size === 3, `${house}: his first blink comes at another moment each screen: ${one[0]}, ${two[0]}, ${three[0]}`);
  }
});
