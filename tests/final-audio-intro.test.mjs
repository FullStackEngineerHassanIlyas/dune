// The intro's opening hit at full force (music ENTRANCES.intro: "full force at once"): the menu's context is made
// suspended at page load and first runs at the player's gesture, on the cue's very first sample. Nothing may blunt
// it there: not the music's gain easing up from 0 (a level eased in while the context waited only starts moving
// when it runs), nor the limiter's start (a fresh compressor starts fully down and releases at its release time).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicOutput } from '../src/audio/music/output.js';
import { MenuAudio } from '../src/audio/music/music.js';

/** An AudioParam that keeps its automation: what it holds from `t` on (the last event at or before t, eased or not). */
function param(value) {
  return {
    value, events: [],
    setValueAtTime(v, t) { this.events.push({ kind: 'set', v, t }); },
    setTargetAtTime(v, t, tau) { this.events.push({ kind: 'target', v, t, tau }); },
    cancelScheduledValues(t) { this.events = this.events.filter((e) => e.t < t); },
    /** The value at time t (a target counts as reached only past 5 time constants). */
    at(t) {
      let v = this.value;
      for (const e of this.events) {
        if (e.t > t) continue;
        v = e.kind === 'set' ? e.v : t - e.t >= 5 * e.tau ? e.v : v + (e.v - v) * (1 - Math.exp(-(t - e.t) / e.tau));
      }
      return v;
    },
  };
}
/** A page whose synth loads in a worker (that never answers): the output's gain is what is looked at. */
const WIN = { Worker: class { postMessage() {} } };
class Node { connect(n) { return n; } disconnect() {} }
function context({ state = 'suspended' } = {}) {
  return {
    state, currentTime: 0, sampleRate: 48000, destination: new Node(),
    createGain() { return Object.assign(new Node(), { gain: param(1) }); },
    createDynamicsCompressor() { return Object.assign(new Node(), { threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25) }); },
    suspend() { this.state = 'suspended'; return Promise.resolve(); },
    resume() { this.state = 'running'; return Promise.resolve(); },
  };
}

test('a level set before the context ever ran holds from its first sample: the cue is not faded in from silence', () => {
  const ctx = context(), out = new MusicOutput({ audio: { ctx, master: ctx.createGain() }, win: WIN });
  out.open();
  out.setLevel(0.5);   // primed at page load, the gesture still to come
  const g = out.gain.gain;
  assert.equal(g.at(0), 0.5, `the first sample at ${g.at(0).toFixed(3)} of 0.5`);
  assert.equal(g.at(0.01), 0.5);
  out.setLevel(0.25);   // the Options slider moved before the gesture
  assert.equal(g.at(0), 0.25);
});

test('once music has sounded through it, a level change eases, even while the context is held (no step on resuming)', () => {
  const ctx = context({ state: 'running' }), out = new MusicOutput({ audio: { ctx, master: ctx.createGain() }, win: WIN });
  out.open();
  out.setLevel(0.5);
  ctx.currentTime = 12;
  out.setLevel(0.3);   // ducked under an announcer line
  const g = out.gain.gain;
  assert.ok(g.at(12.01) > 0.4, 'eased, not a step');
  assert.ok(Math.abs(g.at(13) - 0.3) < 1e-9);
  ctx.state = 'suspended';   // the battle paused under its menu, the music volume changed there
  out.setLevel(0.1);
  assert.ok(g.at(12.001) > 0.25, 'eased from where it stood when the context runs again');
});

test('the menu\'s limiter lets the first sample through at full force: a short release at first, its usual one a quarter second on', () => {
  const limiters = [];
  const win = {
    AudioContext: class { constructor() { const c = Object.assign(this, context()), make = c.createDynamicsCompressor; c.createDynamicsCompressor = () => { const l = make(); limiters.push(l); return l; }; } },
    addEventListener() {}, removeEventListener() {},
  };
  new MenuAudio({ sound: true, volume: 0.8 }, win).open({ start: false });   // primed at page load
  const [lim] = limiters;
  assert.equal(limiters.length, 1, 'a limiter before the output');
  assert.ok(lim.release.at(0) <= 0.005, `release ${lim.release.at(0)} s while the context first runs`);
  assert.equal(lim.release.at(0.3), 0.15, 'the usual release once it has settled');
  assert.equal(lim.attack.at(0), 0.003);
  assert.equal(lim.threshold.at(0), -6);
});
