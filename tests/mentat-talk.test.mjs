// The Mentat's talking face hooked into the stage (notes docs/superpowers/notes/2026-10-05-mentat-talk.md): mentatStage
// (src/ui/campaign/stage.js) gives a stage that has a voice a face (stage.face), made ready before his first word, moving
// with each line, resting between lines, gone when the screen leaves, still with Options → Mentat voice Off and mouth
// only with reduced motion. The stage is built by the real mentatStage over the real portrait markup, in the counting
// fake DOM of mentat-face-fakes.mjs; the voices are the fakes' (lines of real timing tracks on a hand-cranked clock) and,
// for Off, the real MentatVoice.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { FakeEl, fakeDocument, parseSvg, fakeVoice, frames, shape, ADVICE, synth } from './mentat-face-fakes.mjs';
import { VISEMES, MentatVoice } from '../src/audio/mentat-voice.js';
import { MentatFace } from '../src/ui/campaign/mentat-face.js';
import { POSE } from '../src/ui/campaign/mentat-face-svg.js';
import { rigFor } from '../src/ui/campaign/mentat-face-rigs.js';

// the fakes' elements, with the little more that dom.js's h() and mentatStage ask of one
class El extends FakeEl {
  constructor(doc, tag) { super(doc, tag); this.dataset = {}; this.listeners = {}; this.className = ''; this.hidden = false; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  append(...cs) { for (const c of cs) if (c instanceof FakeEl) this.appendChild(c); else this.text = (this.text ?? '') + c; }
  replaceChildren(...cs) { this.childNodes.length = 0; this.text = ''; this.append(...cs); }
  focus() {}
  set textContent(v) { this.text = String(v); }
  get textContent() { return this.text ?? ''; }
  // the portrait's markup is parsed into the fake's elements, as the browser would
  set innerHTML(markup) { this.childNodes.length = 0; if (markup) this.appendChild(parseSvg(this.ownerDocument, markup)); }
}

const doc = fakeDocument();
doc.createElement = (tag) => new El(doc, tag);
globalThis.document = doc;
globalThis.Node = FakeEl;
const { mentatStage } = await import('../src/ui/campaign/stage.js');

const art = (stage) => stage.portrait.querySelector('.cp-mentat-art');
const sprite = (stage, v) => art(stage).querySelector(`.cpmf-v-${v}`);
const opacity = (el) => Number(el.getAttribute('opacity'));

/** A stage as CampaignScreens builds it, on the page, with a voice playing real tracks and a hand-cranked frame clock. */
const built = [];
function build(house = 'atreides', json = ADVICE, faceOptions = {}, extra = {}) {
  const voice = fakeVoice(json), d = frames(voice);
  const stage = mentatStage(house, { mentatName: 'Cyril', label: house, later: () => {}, voice, faceOptions: { raf: d.raf, caf: d.caf, reducedMotion: false, ...faceOptions }, ...extra });
  doc.body.appendChild(stage.el);
  built.push(stage);
  return { stage, voice, d };
}
const leave = (stage) => stage.el.parentNode?.removeChild(stage.el);
// each test's stages leave the page with it: the page does not pile up screens from test to test
afterEach(() => { for (const stage of built.splice(0)) { stage.face?.destroy(); leave(stage); } });

test('a stage with a voice has a face, and the portrait is untouched until the face is made ready, ahead of his first word', async () => {
  const { stage, voice, d } = build();
  assert.ok(stage.face instanceof MentatFace);
  assert.equal(art(stage).getAttribute('class').includes('cp-mentat-art'), true);
  const before = shape(stage.portrait);
  assert.ok(art(stage).querySelector('.cpmf-head') === null, 'built at the next turn, not inside the screen\'s own construction');
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(art(stage).querySelector('.cpmf-head'), 'the stage asked for it: the face is built without anyone calling warm()');
  assert.equal(await stage.face.warm(), true, 'ready');
  assert.ok(art(stage).querySelector('.cpmf-head'), 'the face is in the portrait before any line');
  assert.equal(art(stage).querySelector('.cpmf-face').getAttribute('display'), 'none', 'but out of the picture: the painting alone');
  assert.equal(d.requests, 0, 'and no frame is drawn');
  assert.equal(stage.face.running, false);
  // his first line: the face starts at once, nothing is built then
  const made = doc.created;
  voice.play();
  assert.equal(doc.created, made, 'nothing made at the line\'s start');
  assert.equal(stage.face.running, true);
  assert.equal(art(stage).querySelector('.cpmf-face').getAttribute('display'), 'inline');
  d.run(2.5);
  assert.ok(VISEMES.slice(1).some((v) => opacity(sprite(stage, v)) > 0.5) || stage.face.w.some((w, k) => k > 0 && w > 0.5), 'the mouth moves');
  stage.face.destroy();
  assert.equal(shape(stage.portrait), before, 'and when it is done the portrait is as portraits.js made it');
});

test('the face follows each line, rests between them and when Advice and Briefing switch, and the next line carries on in the same face', async () => {
  const { stage, voice, d } = build('harkonnen', synth([[100, 1500, 'angry'], [1900, 3300, 'sly']], { every: 90 }));
  const face = stage.face;
  await face.warm();
  const moving = (k) => { let max = 0; d.run(k, () => { max = Math.max(max, 1 - face.w[0]); }); return max; };
  voice.play();
  assert.ok(moving(1.2) > 0.5, 'line one: the mouth moves');
  assert.equal(face.frame.expression, 'angry');
  // Advice: the old line is stopped, the mouth settles, the look is held a moment; the new one comes
  voice.end('stopped');
  d.run(0.3);
  assert.ok(face.w[0] > 0.99, 'the mouth is shut 0.3 s after the line stops');
  assert.ok(Math.abs(face.pose[POSE.mouthSy] - 1) < 0.01, 'and the jaw');
  assert.ok(face.e[0] < -0.1, 'the angry brows are held for a moment (1.4 s)');
  assert.equal(face.running, true, 'the face is awake for the next line');
  voice.play();
  assert.ok(moving(1.2) > 0.5, 'line two: the same face moves again');
  assert.equal(art(stage).querySelectorAll('.cpmf-head').length, 1, 'one face, not one for each line');
  assert.equal(voice.listeners.line.size, 1);
  // the line ends: the look is held, then eased back to the painting, and the loop sleeps (the next line starts it)
  voice.end('ended');
  d.run(4);
  assert.equal(face.running, false, 'the loop sleeps once he has settled');
  assert.equal(art(stage).querySelector('.cpmf-face').getAttribute('display'), 'none');
  assert.equal(art(stage).querySelector('.cpm-blink').style.visibility, '', 'the portrait\'s own blink is back');
  voice.play();
  assert.equal(face.running, true, 'a line after the sleep wakes it');
});

test('the face is gone with the screen: Proceed, Back or leaving take the stage off the page, and he lets the voice go', async () => {
  // (a) the stage leaves while he speaks: seen at the next frame
  let { stage, voice, d } = build();
  const before = shape(stage.portrait);
  await stage.face.warm();
  voice.play();
  d.run(0.5);
  assert.equal(voice.listeners.line.size, 1);
  leave(stage);
  d.step();
  assert.equal(stage.face.destroyed, true);
  assert.equal(voice.listeners.line.size + voice.listeners.end.size, 0, 'the voice is let go');
  assert.ok(d.pending === null, 'no frame is asked for any more');
  assert.equal(shape(stage.portrait), before, 'and the portrait is put back as it was');
  // (b) it leaves while he is asleep between lines: the next line ends the face without a frame
  ({ stage, voice, d } = build());
  await stage.face.warm();
  voice.play(); d.run(0.3); voice.end('ended'); d.run(4);
  assert.equal(stage.face.running, false);
  leave(stage);
  voice.play();
  assert.equal(stage.face.destroyed, true);
  assert.ok(d.pending === null);
  // (c) it leaves before the face is ready, or the face is destroyed before its first line
  ({ stage } = build());
  stage.face.destroy();
  assert.equal(await stage.face.warm(), false, 'a face that is gone is never built');
  assert.ok(art(stage).querySelector('.cpmf-head') === null);
});

test('Options → Mentat voice Off: the stage has no face, the portrait stays the still painting with its mouth shut', async () => {
  // no voice at all (a stage for something that is not spoken)
  let { stage } = build('ordos', ADVICE, {}, { voice: null });
  assert.ok(stage.face === null, 'no face');
  assert.ok(art(stage).querySelector('.cpmf-head') === null);
  // the voice is there but silent: a fake that says it is not enabled, and the real one with the setting Off
  const silent = fakeVoice(ADVICE);
  silent.enabled = false;
  stage = mentatStage('ordos', { mentatName: 'Ammon', later: () => {}, voice: silent });
  assert.ok(stage.face === null, 'no face');
  assert.equal(silent.listeners.line.size, 0, 'nobody listens to the voice');
  const off = new MentatVoice({ settings: { mentatVoice: false }, context: () => ({}), fetch: async () => ({ ok: false }), later: () => {} });
  stage = mentatStage('atreides', { mentatName: 'Cyril', later: () => {}, voice: off });
  const before = shape(stage.portrait);
  assert.equal(off.enabled, false);
  assert.ok(stage.face === null, 'no face');
  assert.ok(off.say(['atreides/m1-briefing']) === null, 'no line is ever made, so no face ever starts');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(shape(stage.portrait), before, 'the portrait is exactly as portraits.js made it');
  assert.equal(art(stage).querySelector('.cpm-blink').style.visibility, '');
  // On: the same real voice with the setting On gets a face
  const on = new MentatVoice({ settings: { mentatVoice: true }, context: () => ({}), fetch: async () => ({ ok: false }), later: () => {} });
  stage = mentatStage('atreides', { mentatName: 'Cyril', later: () => {}, voice: on });
  assert.ok(stage.face instanceof MentatFace);
  stage.face.destroy();
});

test('reduced motion: the mouth alone moves; brows, lids, corners and the head keep the painting', async () => {
  const { stage, voice, d } = build('harkonnen', synth([[100, 2500, 'angry']], { every: 90 }), { reducedMotion: true });
  assert.equal(stage.face.reduced, true);
  await stage.face.warm();
  voice.play();
  let mouth = 0, other = 0;
  d.run(2.2, () => {
    const p = stage.face.pose;
    mouth = Math.max(mouth, 1 - stage.face.w[0]);
    other = Math.max(other, Math.abs(p[POSE.browLy]), Math.abs(p[POSE.browRy]), Math.abs(p[POSE.cornerLy]), Math.abs(p[POSE.tilt]), Math.abs(p[POSE.nod]), p[POSE.lidL], p[POSE.lidR]);
  });
  assert.ok(mouth > 0.5, 'the lips move with the voice');
  assert.equal(other, 0, 'nothing else does');
  assert.equal(art(stage).querySelector('.cpm-blink').style.visibility, '', 'the engine does not blink: the CSS (switched off by the same setting) keeps the eyes as they are');
});

test('reduced motion switched while he is on screen: from then on his mouth alone moves, and all of him again when it is switched back', async () => {
  const had = globalThis.matchMedia;
  // the system's setting, as a MediaQueryList the test switches
  const query = { matches: false, listeners: new Set(), addEventListener(type, fn) { if (type === 'change') this.listeners.add(fn); }, removeEventListener(type, fn) { this.listeners.delete(fn); } };
  const flip = (on) => { query.matches = on; for (const fn of [...query.listeners]) fn({ matches: on }); };
  try {
    globalThis.matchMedia = () => query;
    const { stage, voice, d } = build('harkonnen', synth([[100, 6000, 'angry']], { every: 90 }), { reducedMotion: undefined });
    const face = stage.face;
    assert.equal(face.reduced, false);
    await face.warm();
    voice.play();
    const eyes = () => art(stage).querySelector('.cpm-blink').style.visibility;
    const watch = (seconds) => {
      let mouth = 0, other = 0;
      d.run(seconds, () => {
        const p = face.pose;
        mouth = Math.max(mouth, 1 - face.w[0]);
        other = Math.max(other, Math.abs(p[POSE.browLy]), Math.abs(p[POSE.browRy]), Math.abs(p[POSE.cornerLy]), Math.abs(p[POSE.tilt]), Math.abs(p[POSE.nod]), p[POSE.lidL], p[POSE.lidR]);
      });
      return { mouth, other };
    };
    assert.ok(watch(1.5).other > 0.5, 'his brows and head move with his anger');
    assert.equal(eyes(), 'hidden', 'and he blinks for the portrait\'s CSS');
    flip(true);
    assert.equal(face.reduced, true);
    assert.equal(eyes(), '', 'the portrait\'s own eyes are back (its CSS, under reduced motion too, keeps them open)');
    d.run(0.6);   // the brows and corners ease back to the painting
    const calm = watch(1.5);
    assert.ok(calm.mouth > 0.5, 'his lips still move with the voice');
    assert.ok(calm.other < 0.01, `nothing else does: ${calm.other}`);
    flip(false);
    assert.equal(face.reduced, false);
    assert.equal(eyes(), 'hidden');
    assert.ok(watch(1.5).other > 0.5, 'all of him again');
    face.destroy();
    assert.equal(query.listeners.size, 0, 'the face lets the setting go');
  } finally { if (had === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = had; }
});

test('the player\'s own setting is read when the stage is built: prefers-reduced-motion on or off', () => {
  const had = globalThis.matchMedia;
  try {
    globalThis.matchMedia = (q) => ({ matches: /reduce/.test(q) });
    const voice = fakeVoice(ADVICE);
    const calm = mentatStage('atreides', { mentatName: 'Cyril', later: () => {}, voice });
    assert.equal(calm.face.reduced, true);
    globalThis.matchMedia = () => ({ matches: false });
    const full = mentatStage('atreides', { mentatName: 'Cyril', later: () => {}, voice: fakeVoice(ADVICE) });
    assert.equal(full.face.reduced, false);
    calm.face.destroy(); full.face.destroy();
  } finally { if (had === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = had; }
});

test('a house without a Mentat has no face, and nothing breaks', () => {
  assert.ok(rigFor('fremen') === null);
  const none = mentatStage('fremen', { mentatName: 'Stilgar', later: () => {}, voice: fakeVoice(ADVICE) });
  assert.ok(none.face === null, 'no face');
});
