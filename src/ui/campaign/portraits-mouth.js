// The Mentats' mouth shapes: what the bake (assets/campaign/portraits/bake.mjs --mouth) sets on each head's sculpt
// (portraits-head.js: the mouth pose, uMouthA/B/C) to render one sprite per viseme of the voice (rest, MBP, FV, A, E,
// O, L: src/audio/mentat-voice.js), and where each sprite lies on the portrait. The sculpt, the light and the
// painter's finish are the head layer's own, so the teeth, the lips, the shadow and the skin of a sprite are the
// painting's, drawn with the mouth in another shape; outside the mouth a sprite is the very same picture as the head
// layer, and fades into it. Units: centimetres in head space for the shapes, frame units (the portrait's 400 x 500)
// for the regions. Pure data and arithmetic: no GL here.
import { project, add, mvec } from './portraits-sdf.js';
import { HEAD_DEFAULTS } from './portraits-head.js';
import { MENTATS } from './portraits-mentats.js';

/** Pixels per frame unit of the baked head layer (the sprites share its pixel grid, so they lie on it exactly). */
export const PIXELS_PER_UNIT = 2.4;
/** The visemes that have a sprite (rest is the painting's own mouth). */
export const SPRITE_VISEMES = ['MBP', 'FV', 'A', 'E', 'O', 'L'];

/**
 * One shape as the sculpt's parameters: open (the gap between the lip lines), wide (corners drawn apart +, together
 * -), tuck (the lower lip drawn under the upper teeth), tongue (lifted behind them), round (lips pursed forward),
 * lift (the upper lip raised), smile (the corners raised), press (lips pressed together), upper / lower (the teeth
 * shown, below and above the lips), push (the lower lip pushed out). All cm, or 0..1.
 */
export const SHAPES = {
  MBP: { press: 1, lift: -0.04 },
  FV: { open: 0.14, tuck: 0.5, lift: 0.14, upper: 0.34 },
  A: { open: 1.1, wide: 0.1, lift: 0.1, upper: 0.5, lower: 0.1 },
  E: { open: 0.42, wide: 1, lift: 0.1, press: 0.3, upper: 0.32, lower: 0.2 },
  O: { open: 1, round: 0.6, lift: 0.05, upper: 0.1, lower: 0.04 },
  L: { open: 0.62, wide: 0.15, lift: 0.1, upper: 0.4, tongue: 1 },
};

/** Each Mentat's own measure of those shapes: how far he opens, how wide he spreads, how much of his teeth show. */
export const CHARACTER = {
  atreides: { open: 1, wide: 1, teeth: 1 },
  harkonnen: { open: 0.95, wide: 1, teeth: 0.85 },
  ordos: { open: 0.85, wide: 0.9, teeth: 0.8 },
};

/** The sculpt's three vec4 uniforms (uMouthA, uMouthB, uMouthC) for a viseme of a house's Mentat (rest: all zero). */
export function mouthPose(house, viseme, shapes = SHAPES) {
  const s = shapes[viseme] ?? {}, c = CHARACTER[house] ?? CHARACTER.atreides;
  const g = (k) => s[k] ?? 0;
  const r = (v) => Math.round(v * 1e4) / 1e4;
  return [
    [g('open') * c.open, g('wide') * c.wide, g('tuck'), g('tongue')],
    [g('round'), g('lift'), g('smile'), g('press')],
    [g('upper') * c.teeth, g('lower') * c.teeth, g('push'), 0],
  ].map((v) => v.map(r));
}

/**
 * Where a house's mouth sprites lie, in frame units: `box` (all the same, snapped to the head layer's pixel grid),
 * `hinge` (the y of the lip line), `center` (the x of the mouth's middle) and `halfWidth` (corner to middle), and
 * `render`, the box with a margin the bake draws round it (the painter's finish needs room, and is cut away).
 */
export function mouthRegion(house, { margin = 10 } = {}) {
  const m = MENTATS[house];
  const P = { ...HEAD_DEFAULTS.mouth, ...m.mouth };
  const at = (x, y, z) => project(m.frame, add(m.head.pos, mvec(m.head.R, [x, y, z])));
  const z = P.c[2] + 0.8, [, cy] = P.c;
  // wide enough for the corners drawn apart and the lips pursed, tall enough for the lip lines apart and the chin dip
  const corners = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => at(sx * (P.w + 2.5), cy + (sy > 0 ? P.upper * 2 + 1.4 : -P.lower * 2 - 2.4), z));
  const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
  const k = PIXELS_PER_UNIT;
  const x0 = Math.floor(Math.min(...xs) * k) / k, y0 = Math.floor(Math.min(...ys) * k) / k;
  const x1 = Math.ceil(Math.max(...xs) * k) / k, y1 = Math.ceil(Math.max(...ys) * k) / k;
  const round = (v) => Math.round(v * 1e3) / 1e3;
  const box = [x0, y0, x1 - x0, y1 - y0].map(round);
  const [mx, hy] = at(0, cy + 0.1, z);
  const halfWidth = Math.abs(at(P.w, cy, z)[0] - at(-P.w, cy, z)[0]) / 2;
  const render = [x0 - margin, y0 - margin, x1 - x0 + 2 * margin, y1 - y0 + 2 * margin].map(round);
  return { box, hinge: round(hy), center: round(mx), halfWidth: round(halfWidth), render };
}
