// The Mentat's face, its rig (notes docs/superpowers/notes/2026-10-05-mentat-face.md, "Rig format and how to fill
// it"): where the face's parts sit in the portrait's frame, the sprites the mouth cross-fades between, the parts
// that move for an expression (a sprite of their own, or a warp of the head painting), and each Mentat's
// expression targets. validateRig() checks one and says what is wrong; compileRig() turns one into the numbers the
// engine reads every frame. Plain data: a rig can be JSON.
import { VISEMES, EXPRESSIONS } from '../../audio/mentat-voice.js';

export { VISEMES, EXPRESSIONS };
export const RIG_VERSION = 1;

/**
 * An expression's parameters, each with its range. L and R are the viewer's left and right.
 * browL/browR: brow raised (+) or lowered (-), × brows.raise units. furrow: inner brow ends pulled down and in (+,
 * anger, gravity) or up (-, concern, sorrow), × brows.furrow degrees and brows.inward units. lidL/lidR: the upper
 * lid drawn down over the eye (0 open … 1 shut). cornerL/cornerR: the mouth's corner up (+) or down (-), ×
 * corners.lift units. tilt: the head's roll in degrees (+ clockwise, towards his left shoulder on screen). nod:
 * the head's chin down (+) or up (-), in units. jaw: the jaw hanging a little open while he speaks (0..1).
 */
export const PARAMS = ['browL', 'browR', 'furrow', 'lidL', 'lidR', 'cornerL', 'cornerR', 'tilt', 'nod', 'jaw'];
export const PARAM_RANGE = {
  browL: [-1, 1], browR: [-1, 1], furrow: [-1, 1], lidL: [0, 1], lidR: [0, 1],
  cornerL: [-1, 1], cornerR: [-1, 1], tilt: [-6, 6], nod: [-4, 4], jaw: [0, 1],
};
export const P = Object.fromEntries(PARAMS.map((p, i) => [p, i]));

/** How far each mouth shape lets the jaw open (the voice's loudness opens it that far at most). */
export const DEFAULT_OPEN = { rest: 0, MBP: 0, FV: 0.2, A: 1, E: 0.55, O: 0.75, L: 0.6 };

/** The engine's timing and life, each overridable per rig (seconds unless said). */
export const DEFAULT_MOTION = {
  ease: 0.2,        // an expression settles in this long (critically damped) …
  headEase: 0.35,   // … and the head's tilt and nod, which is heavier, in this long
  mouthEase: 0.075, // a mouth shape settles in this long: the co-articulation that keeps it from popping
  jawEase: 0.06,    // the jaw follows the loudness this fast
  hold: 1.4,        // after the line the last expression is held this long …
  release: 0.6,     // … then eases back to the painting over this
  speakNod: 0.9,    // units the head dips with the voice's loudness while he speaks
  swayTilt: 0.35,   // degrees of slow roll while he speaks
  swayNod: 0.35,    // units of slow nod while he speaks
  flash: 0.22,      // brow lift on a loud syllable (fraction of brows.raise)
  blink: { min: 2.4, max: 5.6, double: 0.15, close: 0.07, hold: 0.04, open: 0.13, seed: 1 },
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isBox = (b) => Array.isArray(b) && b.length === 4 && b.every(isNum) && b[2] > 0 && b[3] > 0;
const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(isNum);
const isUrl = (u) => typeof u === 'string' && u.length > 0;

/**
 * Checks a rig. Returns { ok, errors } (errors: plain sentences naming the field). Every box is [x, y, width,
 * height] in the portrait's frame (`frame`, 400 x 500 for today's portraits) and must lie inside it.
 */
export function validateRig(rig) {
  const errors = [];
  const err = (msg) => errors.push(msg);
  if (!rig || typeof rig !== 'object') return { ok: false, errors: ['the rig is not an object'] };
  if (rig.v !== RIG_VERSION) err(`v must be ${RIG_VERSION}`);
  const [fw, fh] = Array.isArray(rig.frame) ? rig.frame : [];
  if (!isNum(fw) || !isNum(fh) || fw <= 0 || fh <= 0) { err('frame must be [width, height]'); return { ok: false, errors }; }
  const inside = (b, what) => {
    if (!isBox(b)) { err(`${what} must be a box [x, y, width, height]`); return false; }
    if (b[0] < -1 || b[1] < -1 || b[0] + b[2] > fw + 1 || b[1] + b[3] > fh + 1) { err(`${what} lies outside the frame`); return false; }
    return true;
  };
  const part = (p, what) => {
    if (!p || typeof p !== 'object') { err(`${what} must be a part { box, feather?, src? }`); return; }
    inside(p.box, `${what}.box`);
    if (p.feather !== undefined && (!isNum(p.feather) || p.feather <= 0 || p.feather > 1)) err(`${what}.feather must be in (0, 1]`);
    if (p.src !== undefined && p.src !== null && !isUrl(p.src)) err(`${what}.src must be a URL`);
  };
  const scale = (v, what, lo, hi) => { if (!isNum(v) || v < lo || v > hi) err(`${what} must be a number in ${lo}..${hi}`); };

  const head = rig.head;
  if (!head || typeof head !== 'object') err('head must be { src, box, pivot }');
  else {
    if (!isUrl(head.src)) err('head.src must be the head layer\'s URL');
    inside(head.box, 'head.box');
    if (!isPoint(head.pivot)) err('head.pivot must be [x, y]');
  }

  const m = rig.mouth;
  if (!m || typeof m !== 'object') err('mouth must be { box, hinge, sprites, … }');
  else {
    if (inside(m.box, 'mouth.box')) {
      if (!isNum(m.hinge) || m.hinge < m.box[1] || m.hinge > m.box[1] + m.box[3]) err('mouth.hinge (the lip line\'s y) must lie in mouth.box');
      if (m.center !== undefined && (!isNum(m.center) || m.center < m.box[0] || m.center > m.box[0] + m.box[2])) err('mouth.center must lie in mouth.box');
    }
    if (!m.sprites || typeof m.sprites !== 'object') err('mouth.sprites must map every viseme to a URL or null');
    else {
      for (const v of VISEMES) if (!(v in m.sprites)) err(`mouth.sprites.${v} is missing (null shows the painting)`);
        else if (m.sprites[v] !== null && !isUrl(m.sprites[v])) err(`mouth.sprites.${v} must be a URL or null`);
      for (const k of Object.keys(m.sprites)) if (!VISEMES.includes(k)) err(`mouth.sprites.${k} is not a viseme (${VISEMES.join(' ')})`);
      if (VISEMES.every((v) => !m.sprites[v])) err('mouth.sprites has no sprite at all');
    }
    if (m.open !== undefined) for (const v of VISEMES) if (m.open[v] !== undefined) scale(m.open[v], `mouth.open.${v}`, 0, 1);
    if (m.jaw !== undefined && (!Array.isArray(m.jaw) || m.jaw.length !== 2 || !m.jaw.every(isNum) || m.jaw[0] <= 0 || m.jaw[1] < m.jaw[0] || m.jaw[1] > 2)) err('mouth.jaw must be [closed, open] scales, 0 < closed <= open <= 2');
    if (m.lift !== undefined) scale(m.lift, 'mouth.lift', 0, 10);
    if (m.halfWidth !== undefined) scale(m.halfWidth, 'mouth.halfWidth', 1, 100);
    if (m.widen !== undefined) scale(m.widen, 'mouth.widen', 0, 0.3);
  }

  if (rig.jaw != null) { part(rig.jaw, 'jaw'); scale(rig.jaw.drop, 'jaw.drop', 0, 12); }

  const b = rig.brows;
  if (b != null) {
    part(b.left, 'brows.left'); part(b.right, 'brows.right');
    scale(b.raise, 'brows.raise', 0, 12); scale(b.furrow, 'brows.furrow', 0, 20);
    if (b.inward !== undefined) scale(b.inward, 'brows.inward', 0, 6);
    for (const side of ['left', 'right']) if (b[side] && b[side].origin !== undefined && !isPoint(b[side].origin)) err(`brows.${side}.origin must be [x, y]`);
  }

  const c = rig.corners;
  if (c != null) { part(c.left, 'corners.left'); part(c.right, 'corners.right'); scale(c.lift, 'corners.lift', 0, 10); }

  const l = rig.lids;
  if (l != null) {
    if (!isUrl(l.src)) err('lids.src must be the closed eyes\' URL');
    const lb = inside(l.box, 'lids.box') ? l.box : null;
    for (const side of ['left', 'right']) {
      const e = l[side];
      if (!e || typeof e !== 'object') { err(`lids.${side} must be { box, open: [top, bottom] }`); continue; }
      if (inside(e.box, `lids.${side}.box`) && lb && (e.box[0] < lb[0] - 0.5 || e.box[1] < lb[1] - 0.5 || e.box[0] + e.box[2] > lb[0] + lb[2] + 0.5 || e.box[1] + e.box[3] > lb[1] + lb[3] + 0.5)) err(`lids.${side}.box must lie in lids.box`);
      if (!Array.isArray(e.open) || e.open.length !== 2 || !e.open.every(isNum) || e.open[1] <= e.open[0]) err(`lids.${side}.open must be [top, bottom] of the eye`);
      else if (isBox(e.box) && (e.open[0] < e.box[1] || e.open[1] > e.box[1] + e.box[3])) err(`lids.${side}.open must lie in lids.${side}.box`);
    }
    if (l.soft !== undefined) scale(l.soft, 'lids.soft', 0, 1);
  }

  const x = rig.expressions;
  if (!x || typeof x !== 'object') err('expressions must give targets for every expression');
  else {
    for (const name of EXPRESSIONS) {
      const t = x[name];
      if (!t || typeof t !== 'object') { err(`expressions.${name} is missing`); continue; }
      for (const [k, v] of Object.entries(t)) {
        if (!PARAMS.includes(k)) { err(`expressions.${name}.${k} is not a parameter (${PARAMS.join(' ')})`); continue; }
        const [lo, hi] = PARAM_RANGE[k];
        scale(v, `expressions.${name}.${k}`, lo, hi);
      }
    }
    for (const k of Object.keys(x)) if (!EXPRESSIONS.includes(k)) err(`expressions.${k} is not an expression (${EXPRESSIONS.join(' ')})`);
  }

  const mo = rig.motion;
  if (mo != null) {
    if (typeof mo !== 'object') err('motion must be an object');
    else for (const [k, v] of Object.entries(mo)) {
      if (k === 'blink') {
        if (!v || typeof v !== 'object') { err('motion.blink must be an object'); continue; }
        for (const [bk, bv] of Object.entries(v)) if (!(bk in DEFAULT_MOTION.blink) || !isNum(bv) || bv < 0) err(`motion.blink.${bk} must be a known number >= 0`);
        const mn = v.min ?? DEFAULT_MOTION.blink.min, mx = v.max ?? DEFAULT_MOTION.blink.max;
        if (mx < mn) err('motion.blink.max must be >= min');
      } else if (!(k in DEFAULT_MOTION) || !isNum(v) || v < 0) err(`motion.${k} must be a known number >= 0`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Throws a TypeError listing what is wrong with the rig (for the art step: a bad rig says so at once). */
export function assertRig(rig) {
  const { ok, errors } = validateRig(rig);
  if (!ok) throw new TypeError(`mentat face rig${rig?.house ? ` (${rig.house})` : ''}: ${errors.join('; ')}`);
  return rig;
}

/**
 * The rig as the engine reads it: expression targets as one Float64Array each (PARAMS order, by EXPRESSIONS
 * index), the mouth's openness per viseme, the motion with its defaults. Validates first (throws on a bad rig).
 */
export function compileRig(rig) {
  assertRig(rig);
  const targets = EXPRESSIONS.map((name) => Float64Array.from(PARAMS, (p) => rig.expressions[name][p] ?? 0));
  const exprIndex = Object.fromEntries(EXPRESSIONS.map((e, i) => [e, i]));
  const open = Float64Array.from(VISEMES, (v) => rig.mouth.open?.[v] ?? DEFAULT_OPEN[v]);
  const motion = { ...DEFAULT_MOTION, ...rig.motion, blink: { ...DEFAULT_MOTION.blink, ...rig.motion?.blink } };
  const [bx, , bw] = rig.mouth.box;
  return {
    rig, targets, exprIndex, open, motion,
    mouth: { center: rig.mouth.center ?? bx + bw / 2, hinge: rig.mouth.hinge, halfWidth: rig.mouth.halfWidth ?? bw * 0.36, jaw: rig.mouth.jaw ?? [1, 1.3], lift: rig.mouth.lift ?? rig.corners?.lift ?? 2, widen: rig.mouth.widen ?? 0.04 },
  };
}
