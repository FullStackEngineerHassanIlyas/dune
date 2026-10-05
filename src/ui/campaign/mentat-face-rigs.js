// The Mentats' faces, as rigs for the face engine (mentat-face.js; the format is in mentat-face-rig.js and the notes
// docs/superpowers/notes/2026-10-05-mentat-face.md): where each brow, eye, mouth corner and chin sits on the painting,
// the mouth sprites baked from the very sculpt of the head (assets/campaign/portraits/bake.mjs --mouth, placed by
// mentat-face-art.js), and each Mentat's expressions: Cyril's kindly concern, Radnor's sneer, Ammon's sly half-smile.
// Frame units throughout (the portrait's 400 x 500; left and right are the viewer's). Plain data.
import { PORTRAITS } from './portraits-layers.js';
import { FACE_ART } from './mentat-face-art.js';
import { SPRITE_VISEMES } from './portraits-mouth.js';

const BASE = new URL('../../../assets/campaign/portraits/', import.meta.url).href;
const FRAME = [400, 500];

/**
 * How far each sprite's mouth is open, as a share of the widest (A): it sets how far the jaw drops for the shape
 * (closed lips stay shut however loud the sound).
 */
const OPEN = { rest: 0, MBP: 0, FV: 0.13, A: 1, E: 0.38, O: 0.9, L: 0.56 };

/**
 * Where each Mentat's moving parts lie on his painting (read off the baked head layer, frame units): `brow` the
 * warp box over each brow (stopping above the upper lid) and its outer end; `eye` the box each eye's lids may show
 * in and the opening's top and bottom; `corner` a box over each corner of the mouth; `jaw` the chin and what hangs
 * below it; the sizes of the moves (`raise` units a brow lifts, `furrow` degrees it rolls, `lift` a corner).
 */
const GEOMETRY = {
  atreides: {
    brow: { raise: 3.6, furrow: 8, inward: 1.4 },
    eye: { left: { box: [182, 156, 34, 22], open: [162, 173] }, right: { box: [237, 160, 32, 22], open: [166, 177] } },
    corner: { left: [196, 219, 20, 22], right: [238, 219, 20, 22], lift: 3.6 },
    jaw: { box: [196, 238, 62, 34], drop: 3 },
  },
  harkonnen: {
    brow: { raise: 4.6, furrow: 10, inward: 1.8 },
    eye: { left: { box: [172, 150, 36, 20], open: [156, 165] }, right: { box: [246, 156, 30, 16], open: [160, 167] } },
    corner: { left: [183, 222, 22, 24], right: [244, 222, 22, 24], lift: 4.2 },
    jaw: { box: [188, 244, 70, 36], drop: 3.4 },
  },
  ordos: {
    brow: { raise: 3.8, furrow: 8, inward: 1.3 },
    eye: { left: { box: [168, 138, 40, 18], open: [142, 153] }, right: { box: [227, 134, 38, 18], open: [138, 150] } },
    corner: { left: [192, 202, 18, 20], right: [230, 202, 18, 20], lift: 3.2 },
    jaw: { box: [196, 224, 54, 32], drop: 2.6 },
  },
};

/**
 * The seven expressions (the voice's sentence tags) per Mentat, as engine parameters (mentat-face-rig.js PARAMS):
 * brows (+ up), furrow (+ inner ends down and in: gravity, anger; - inner ends up: concern, sorrow), lids (0 open … 1
 * shut), corners (+ up), tilt and nod of the head. Never more than the face would do: they read at a glance, and
 * stop short of a cartoon.
 */
const EXPRESSIONS = {
  // Cyril: a young counsellor's kindly concern; he warns and grieves gently, and smiles with his whole face
  atreides: {
    neutral: { lidL: 0.03, lidR: 0.03, cornerL: 0.08, cornerR: 0.08 },
    grave: { browL: -0.25, browR: -0.25, furrow: 0.3, lidL: 0.12, lidR: 0.12, cornerL: -0.25, cornerR: -0.25, nod: 1.2, tilt: -0.6 },
    pleased: { browL: 0.35, browR: 0.35, lidL: 0.14, lidR: 0.14, cornerL: 0.8, cornerR: 0.8, tilt: 1.2, nod: -0.4 },
    warning: { browL: 0.6, browR: 0.6, furrow: -0.1, cornerL: -0.15, cornerR: -0.15, nod: -0.8 },
    angry: { browL: -0.4, browR: -0.4, furrow: 0.7, lidL: 0.16, lidR: 0.16, cornerL: -0.35, cornerR: -0.35, nod: 1.5 },
    sly: { browR: 0.5, lidL: 0.1, lidR: 0.08, cornerL: 0.25, cornerR: 0.65, tilt: 1.4 },
    sad: { browL: 0.2, browR: 0.2, furrow: -0.75, lidL: 0.2, lidR: 0.2, cornerL: -0.5, cornerR: -0.5, nod: 1.8, tilt: -1.4 },
  },
  // Radnor: heavy-lidded, a one-sided sneer that sours to anger and widens when he is pleased
  harkonnen: {
    neutral: { browL: -0.12, browR: -0.12, lidL: 0.05, lidR: 0.06, cornerL: -0.1, cornerR: 0.3 },
    grave: { browL: -0.3, browR: -0.3, furrow: 0.6, lidL: 0.14, lidR: 0.15, cornerL: -0.35, cornerR: 0, nod: 1.4 },
    pleased: { browL: 0.1, browR: 0.25, lidL: 0.16, lidR: 0.14, cornerL: 0.35, cornerR: 1, tilt: 1.4, nod: -0.4 },
    warning: { browL: 0.15, browR: 0.3, furrow: 0.6, lidL: 0.08, lidR: 0.08, cornerL: -0.35, cornerR: 0.1, nod: 0.8 },
    angry: { browL: -0.45, browR: -0.45, furrow: 1, lidL: 0.2, lidR: 0.22, cornerL: -0.6, cornerR: 0.5, nod: 2.2, tilt: -0.9 },
    sly: { browL: -0.2, browR: 0.7, lidL: 0.2, lidR: 0.14, cornerL: 0.15, cornerR: 1, tilt: 1.6 },
    sad: { browL: 0.1, browR: 0.1, furrow: -0.55, lidL: 0.2, lidR: 0.2, cornerL: -0.5, cornerR: -0.25, nod: 1.8 },
  },
  // Ammon: cool and amused, one brow raised, a thin smile that deepens on one side
  ordos: {
    neutral: { browR: 0.25, lidL: 0.04, lidR: 0.05, cornerL: 0.05, cornerR: 0.25 },
    grave: { browL: -0.25, browR: 0, furrow: 0.45, lidL: 0.14, lidR: 0.14, cornerL: -0.25, cornerR: 0, nod: 1.2 },
    pleased: { browL: 0.2, browR: 0.4, lidL: 0.14, lidR: 0.14, cornerL: 0.55, cornerR: 0.9, tilt: 1 },
    warning: { browL: 0.3, browR: 0.5, furrow: 0.35, lidL: 0.05, lidR: 0.05, cornerL: -0.25, cornerR: 0, nod: 0.6 },
    angry: { browL: -0.4, browR: -0.35, furrow: 0.75, lidL: 0.2, lidR: 0.22, cornerL: -0.4, cornerR: 0.1, nod: 1.6 },
    sly: { browL: -0.1, browR: 0.8, lidL: 0.2, lidR: 0.14, cornerL: 0.2, cornerR: 0.9, tilt: 1.5 },
    sad: { browL: 0.1, browR: 0.2, furrow: -0.6, lidL: 0.18, lidR: 0.18, cornerL: -0.4, cornerR: -0.25, nod: 1.6 },
  },
};

/** Each Mentat's own life: how he blinks (seconds) and how heavy his head is. */
const MOTION = {
  atreides: { blink: { min: 2.6, max: 5.4, seed: 3 } },
  harkonnen: { ease: 0.24, headEase: 0.42, swayTilt: 0.25, swayNod: 0.3, blink: { min: 3.4, max: 7, close: 0.09, hold: 0.06, open: 0.16, seed: 5 } },
  ordos: { blink: { min: 3, max: 6.4, seed: 7 } },
};

/** The rig of a house's Mentat (see mentat-face-rig.js). */
function buildRig(house) {
  const P = PORTRAITS[house], A = FACE_ART[house], G = GEOMETRY[house];
  const url = (name) => `${BASE}${house}-${name}.webp`;
  return {
    v: 1, house, name: P.name, frame: FRAME,
    head: { src: url('head'), box: P.layers.head, pivot: P.pivot },
    mouth: {
      box: A.box, hinge: A.hinge, center: A.center, halfWidth: A.halfWidth,
      sprites: { rest: null, ...Object.fromEntries(SPRITE_VISEMES.map((v) => [v, url(`mouth-${v}`)])) },
      open: OPEN, jaw: [1, 1.1], lift: G.corner.lift, widen: 0.04,
    },
    jaw: { box: G.jaw.box, feather: 0.55, drop: G.jaw.drop },
    // each brow a cut-out of the very sculpt (hair, soft edge) over the same head with no brow, which stays
    brows: {
      left: { box: A.brows.left.box, src: url('brow-left'), base: { src: url('browbase-left'), box: A.brows.left.base } },
      right: { box: A.brows.right.box, src: url('brow-right'), base: { src: url('browbase-right'), box: A.brows.right.base } },
      raise: G.brow.raise, furrow: G.brow.furrow, inward: G.brow.inward,
    },
    corners: { left: { box: G.corner.left, feather: 0.55 }, right: { box: G.corner.right, feather: 0.55 }, lift: G.corner.lift },
    // the eyes shut, a sprite each (the sculpt's head, lids closed, brows off), drawn down over the open eye
    lids: {
      left: { src: url('lid-left'), box: A.lids.left.box, open: G.eye.left.open },
      right: { src: url('lid-right'), box: A.lids.right.box, open: G.eye.right.open },
      soft: 0.1,
    },
    expressions: EXPRESSIONS[house],
    motion: MOTION[house],
  };
}

/** The rigs, by house: Cyril (atreides), Radnor (harkonnen), Ammon (ordos). */
export const MENTAT_RIGS = Object.freeze(Object.fromEntries(Object.keys(GEOMETRY).map((h) => [h, buildRig(h)])));

/** The rig for a house, or null when it has no Mentat. */
export function rigFor(house) {
  return MENTAT_RIGS[house] ?? null;
}
