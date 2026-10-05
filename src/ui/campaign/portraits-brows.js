// The Mentats' brows as cut-outs (assets/campaign/portraits/bake.mjs --mouth): each brow is baked twice from the very
// sculpt of the head, with the hair and without, so that the brow itself (a sprite with its own soft edge) can lift,
// lower and roll over a patch of the same head with no brow on it, and leave no ghost of itself and no box edge behind.
// Here: where the bake looks for each brow (frame units, measured off the baked heads: wide enough to hold the brow
// with room) and how the render crop and the pixel boxes inside it fall on the head layer's pixel grid. Pure data.
import { PIXELS_PER_UNIT } from './portraits-mouth.js';

/** Where each brow is, with room: [x, y, width, height] in frame units, left and right as the viewer sees them. */
export const BROW_SEARCH = {
  atreides: { left: [176, 138, 54, 24], right: [232, 142, 46, 24] },
  harkonnen: { left: [164, 130, 62, 32], right: [232, 134, 54, 30] },
  ordos: { left: [157, 113, 64, 26], right: [219, 111, 52, 26] },
};

/** The margin (frame units) the bake draws round the brows, for the painter's finish to settle in. */
export const BROW_MARGIN = 10;

/**
 * The bake's render crop (snapped to the head layer's pixel grid) and, in pixels inside it, each side's search box.
 * `px` converts a pixel box inside the crop to frame units.
 */
export function browRegion(house) {
  const k = PIXELS_PER_UNIT, S = BROW_SEARCH[house];
  const boxes = Object.values(S);
  const x0 = Math.min(...boxes.map((b) => b[0])) - BROW_MARGIN, y0 = Math.min(...boxes.map((b) => b[1])) - BROW_MARGIN;
  const x1 = Math.max(...boxes.map((b) => b[0] + b[2])) + BROW_MARGIN, y1 = Math.max(...boxes.map((b) => b[1] + b[3])) + BROW_MARGIN;
  const gx = Math.floor(x0 * k), gy = Math.floor(y0 * k);
  const render = [gx / k, gy / k, Math.ceil(x1 * k - gx) / k, Math.ceil(y1 * k - gy) / k];
  const sides = Object.fromEntries(Object.entries(S).map(([side, b]) => [side, [Math.round(b[0] * k) - gx, Math.round(b[1] * k) - gy, Math.round(b[2] * k), Math.round(b[3] * k)]]));
  return { render, sides, origin: [gx, gy] };
}
