// The Mentats' shut eyes for the face engine (assets/campaign/portraits/bake.mjs --mouth): one sprite per eye, the head
// with its lids closed and its brows off, kept in a soft ellipse round the eye (the portrait's own lids layer is cut the
// same way, but with the brows on, so a brow that has moved would leave a ghost of itself in it). Here: where each eye's
// ellipse lies, and the render crop and the pixel boxes inside it on the head layer's pixel grid. Pure arithmetic.
import { MENTATS } from './portraits-mentats.js';
import { PIXELS_PER_UNIT } from './portraits-mouth.js';

/** The ellipse's radii as shares of the eye's box (the portrait's lids layer: bake.mjs, 0.58 x 0.62) and its blur. */
export const LID_ELLIPSE = [0.58, 0.62];
export const LID_MARGIN = 7;   // frame units of room round the ellipse for its blur

/**
 * For each eye (the viewer's left and right): `box` (pixels in the render crop), `unitBox` (frame units, on the pixel
 * grid), `ellipse` ([centre x, centre y, radius x, radius y] in pixels in the crop). `render` is the crop (frame units).
 */
export function lidsRegion(house) {
  const m = MENTATS[house], k = PIXELS_PER_UNIT;
  const spots = { left: m.features.eyeL, right: m.features.eyeR };
  const boxes = Object.fromEntries(Object.entries(spots).map(([side, [x, y, w, h]]) => {
    const cx = x + w / 2, cy = y + h / 2, rx = w * LID_ELLIPSE[0], ry = h * LID_ELLIPSE[1];
    return [side, { cx, cy, rx, ry, x0: Math.floor((cx - rx - LID_MARGIN) * k), y0: Math.floor((cy - ry - LID_MARGIN) * k), x1: Math.ceil((cx + rx + LID_MARGIN) * k), y1: Math.ceil((cy + ry + LID_MARGIN) * k) }];
  }));
  const all = Object.values(boxes);
  const gx = Math.min(...all.map((b) => b.x0)) - 24, gy = Math.min(...all.map((b) => b.y0)) - 24;
  const gx1 = Math.max(...all.map((b) => b.x1)) + 24, gy1 = Math.max(...all.map((b) => b.y1)) + 24;
  const render = [gx / k, gy / k, (gx1 - gx) / k, (gy1 - gy) / k];
  const eyes = Object.fromEntries(Object.entries(boxes).map(([side, b]) => [side, {
    box: [b.x0 - gx, b.y0 - gy, b.x1 - b.x0, b.y1 - b.y0],
    unitBox: [b.x0 / k, b.y0 / k, (b.x1 - b.x0) / k, (b.y1 - b.y0) / k].map((v) => Math.round(v * 1e3) / 1e3),
    ellipse: [b.cx * k - gx, b.cy * k - gy, b.rx * k, b.ry * k],
  }]));
  return { render, eyes };
}
