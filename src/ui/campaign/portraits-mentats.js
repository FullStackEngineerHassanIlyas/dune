// The three Mentats, by house, as 3D figures: each with his name, the head's pivot (the head sways about it), the
// frame (camera and window), where his eyes fall in the frame (the blink), and his scene in GLSL (head, body,
// colours, light). Used by the bake (assets/campaign/portraits/bake.mjs) and the tests; the game itself only shows
// the baked images (portraits.js).
import { CYRIL } from './portraits-cyril.js';
import { RADNOR } from './portraits-radnor.js';
import { AMMON } from './portraits-ammon.js';

export const MENTATS = {
  atreides: CYRIL,
  harkonnen: RADNOR,
  ordos: AMMON,
};
