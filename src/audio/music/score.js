// The soundtrack's pattern format (spec §6 Music): a track is a tempo, a key and mode, named channels (an FM patch
// each, or the drum kit) and named patterns, played as an intro once and then a loop body over and over. A melodic
// line is a string of tokens, one per `res` steps: a note (`d4`, `f#3`, `bb2`), a chord for a channel of several
// voices (`d3+a3`), `-` to hold, `.` to let go; `~` before a note slides to it without a new attack, `!` after it
// accents and `?` softens it, `*n` stretches any token over n slots, `|` is only for the eye, and a leading `@n`
// sets the slot to n steps. Drum lanes are one character per step: `x` a hit, `X` an accent, `g` a ghost. An order
// entry `A+5` plays pattern A five semitones up. compile() turns a track into time-ordered events; checkTrack()
// lists everything wrong with one, including notes outside the track's mode — the style the soundtrack keeps to.
import { KIT } from './drums.js';

export const ON = 1, OFF = 2, SLIDE = 3, HIT = 4;
const LETTER = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** Scales as semitones above the root: the desert modes the soundtrack is written in (research §A.2). */
export const MODES = {
  'phrygian-dominant': [0, 1, 4, 5, 7, 8, 10],
  'double-harmonic': [0, 1, 4, 5, 7, 8, 11],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'hungarian-minor': [0, 2, 3, 6, 7, 8, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  'lydian-dominant': [0, 2, 4, 6, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  ionian: [0, 2, 4, 5, 7, 9, 11],
};

/** 'f#4' → 66 (c4 is middle C, 60); null if it is not a note. */
export function noteNumber(name) {
  const m = /^([a-g])(#|b)?(\d)$/.exec(name);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

const pitchClass = (name) => { const m = /^([a-g])(#|b)?/.exec(name); return m ? (LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12 : null; };

/**
 * One melodic line → slots: [{ kind: 'note'|'hold'|'rest', notes: [midi], slide, vel, steps }], or throws with what is wrong.
 * `vel` is the channel's default velocity.
 */
export function parseLine(text, { res = 1, vel = 0.8 } = {}) {
  const tokens = text.trim().split(/\s+/).filter((t) => t && t !== '|');
  if (tokens[0]?.startsWith('@')) {
    res = Number(tokens.shift().slice(1));
    if (!(res >= 1) || !Number.isInteger(res)) throw new Error(`bad slot size in "${text.slice(0, 24)}"`);
  }
  const out = [];
  for (const raw of tokens) {
    let tok = raw, n = 1;
    const star = /^(.*)\*(\d+)$/.exec(tok);
    if (star) { tok = star[1]; n = Number(star[2]); }
    if (tok === '.' || tok === '-') { for (let i = 0; i < n; i++) out.push({ kind: tok === '.' ? 'rest' : 'hold', steps: res }); continue; }
    const slide = tok.startsWith('~');
    if (slide) tok = tok.slice(1);
    const notes = [], names = [];
    let v = vel;
    for (let part of tok.split('+')) {
      if (part.endsWith('!')) { v = 1; part = part.slice(0, -1); }
      else if (part.endsWith('?')) { v = 0.5; part = part.slice(0, -1); }
      const midi = noteNumber(part);
      if (midi === null) throw new Error(`not a note: "${raw}"`);
      notes.push(midi);
      names.push(part);
    }
    out.push({ kind: 'note', notes, names, slide, vel: v, steps: res });
    for (let i = 1; i < n; i++) out.push({ kind: 'hold', steps: res });
  }
  return out;
}

const VELS = { x: 0.8, X: 1, g: 0.45 };

/** One drum lane → [{ at (step), vel }], or throws. */
export function parseLane(text) {
  const chars = text.replace(/[\s|]/g, '');
  const hits = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '.') continue;
    if (!(c in VELS)) throw new Error(`drum lane: "${c}" is not x, X, g or .`);
    hits.push({ at: i, vel: VELS[c] });
  }
  return { hits, steps: chars.length };
}

/** 'A+5' → { name: 'A', shift: 5 }. */
export function orderEntry(entry) {
  const m = /^(.+?)([+-]\d+)?$/.exec(entry);
  return { name: m[1], shift: m[2] ? Number(m[2]) : 0 };
}

const patternSteps = (track, p) => (p.bars ?? 4) * (track.bar ?? 16);

/** A channel's settings with their defaults. */
export function channelDef(name, c) {
  return {
    name, drums: !!c.drums, patch: c.patch ?? null, voices: c.voices ?? 1, res: c.res ?? 1,
    vol: c.vol ?? 0, pan: c.pan ?? 0, echo: c.echo ?? 0, glide: c.glide ?? 0.06, gate: c.gate ?? 1, vel: c.vel ?? 0.8, oct: c.oct ?? 0,
  };
}

/** Events of one section (the intro, or the loop body): patterns in order, each channel's slots laid end to end. */
function section(track, names, defs) {
  const events = [];
  let at = 0;
  for (const entry of names) {
    const { name, shift } = orderEntry(entry);
    const p = track.patterns[name];
    if (!p) throw new Error(`no pattern "${name}"`);
    const len = patternSteps(track, p);
    defs.forEach((d, ch) => {
      const line = p[d.name];
      if (d.drums) {
        if (!line) return;
        for (const [piece, lane] of Object.entries(line)) {
          const { hits, steps } = parseLane(lane);
          if (steps !== len) throw new Error(`${name}.${d.name}.${piece}: ${steps} steps, the pattern has ${len}`);
          for (const h of hits) events.push({ t: at + h.at, ch, type: HIT, piece, vel: h.vel });
        }
        return;
      }
      const slots = line ? parseLine(line, { res: d.res, vel: d.vel }) : [{ kind: 'rest', steps: len }];
      const steps = slots.reduce((s, x) => s + x.steps, 0);
      if (steps !== len) throw new Error(`${name}.${d.name}: ${steps} steps, the pattern has ${len}`);
      let t = at;
      slots.forEach((s, i) => {
        if (s.kind === 'rest') for (let v = 0; v < d.voices; v++) events.push({ t, ch, type: OFF, sub: v });
        else if (s.kind === 'note') {
          // how long it sounds: to the next note or rest in this pattern, for a channel whose notes let go early
          let held = s.steps;
          for (let j = i + 1; j < slots.length && slots[j].kind === 'hold'; j++) held += slots[j].steps;
          for (let v = 0; v < d.voices; v++) {
            const midi = s.notes[v];
            if (midi === undefined) { events.push({ t, ch, type: OFF, sub: v }); continue; }
            events.push({ t, ch, type: s.slide ? SLIDE : ON, sub: v, note: midi + shift + 12 * d.oct, vel: s.vel });
            if (d.gate < 1) events.push({ t: t + held * d.gate, ch, type: OFF, sub: v });
          }
        }
        t += s.steps;
      });
    });
    at += len;
  }
  // in time order; at the same moment a note lets go before the next one starts
  events.sort((a, b) => a.t - b.t || (a.type === OFF ? 0 : 1) - (b.type === OFF ? 0 : 1));
  return { len: at, events };
}

/** A track ready to play: its channels, and the events of its intro and of its loop body, in steps. */
export function compile(track) {
  const defs = Object.entries(track.channels).map(([name, c]) => channelDef(name, c));
  return {
    id: track.id, title: track.title, bpm: track.bpm, beat: track.beat ?? 4, bar: track.bar ?? 16, swing: track.swing ?? 0,
    gain: Math.pow(10, (track.gain ?? 0) / 20), passes: track.passes ?? 1,
    echo: { steps: 3, feedback: 0.3, wet: 0.25, damp: 0.35, ...track.echo },
    channels: defs,
    intro: section(track, track.intro ?? [], defs),
    loop: section(track, track.loop, defs),
  };
}

/** Seconds in one pass of the loop body (and in the intro). */
export function durations(track) {
  const c = compile(track), step = 60 / (c.bpm * c.beat);
  return { intro: c.intro.len * step, loop: c.loop.len * step };
}

/**
 * Everything wrong with a track, as messages (none: it is fine): unknown patches, pieces and patterns, lines of the
 * wrong length, notes out of range or outside the mode its pattern is in (`mode`/`root` per track, a pattern may
 * change them; `free: true` on a channel exempts it), and a loop body that is not whole bars.
 */
export function checkTrack(track, patches = {}) {
  const problems = [];
  const say = (m) => problems.push(`${track.id}: ${m}`);
  if (!(track.bpm >= 40 && track.bpm <= 220)) say(`tempo ${track.bpm}`);
  if (!track.loop?.length) say('no loop body');
  for (const [name, c] of Object.entries(track.channels ?? {})) {
    if (c.drums) continue;
    if (!patches[c.patch]) say(`channel ${name}: no patch "${c.patch}"`);
  }
  for (const [pname, p] of Object.entries(track.patterns ?? {})) {
    for (const key of Object.keys(p)) if (!['bars', 'mode', 'root'].includes(key) && !track.channels[key]) say(`${pname}: no channel "${key}"`);
  }
  let compiled = null;
  try { compiled = compile(track); } catch (err) { say(err.message); return problems; }
  if (compiled.loop.len % compiled.bar) say(`loop body is ${compiled.loop.len} steps, not whole bars of ${compiled.bar}`);
  for (const e of [...compiled.intro.events, ...compiled.loop.events]) {
    if (e.type === HIT && !KIT[e.piece]) say(`no drum "${e.piece}"`);
    if ((e.type === ON || e.type === SLIDE) && (e.note < 24 || e.note > 100)) say(`note ${e.note} out of range`);
  }
  // the mode: every note of every pattern played (an order entry's transposition moves the root with the notes)
  for (const name of new Set([...(track.intro ?? []), ...track.loop].map((e) => orderEntry(e).name))) {
    const p = track.patterns[name];
    if (!p) continue;
    const mode = MODES[p.mode ?? track.mode], root = pitchClass(p.root ?? track.root);
    if (!mode || root === null) { say(`${name}: unknown mode ${p.mode ?? track.mode} on ${p.root ?? track.root}`); continue; }
    for (const [ch, line] of Object.entries(p)) {
      const c = track.channels[ch];
      if (!c || c.drums || c.free || typeof line !== 'string') continue;
      for (const s of parseLine(line)) {
        if (s.kind !== 'note') continue;
        for (const midi of s.notes) {
          const pc = (((midi - root) % 12) + 12) % 12;
          if (!mode.includes(pc)) say(`${name}.${ch}: ${s.names.join('+')} is outside ${p.mode ?? track.mode} on ${p.root ?? track.root}`);
        }
      }
    }
  }
  return problems;
}
