// The three painted Mentats, by house: each with its name, the head's pivot (the head sways about it), its eyes'
// ovals (the blink), its light rig, layer(name) giving a layer's colour, material and overlay SVG and its forms for
// the lit bake, and paint(part) the unlit parts (the chamber behind, the blink's mask). Used by the bake
// (assets/campaign/portraits/bake.mjs) and the tests; the game itself only shows the baked images (portraits.js).
import { CYRIL, cyrilLayer, paintCyril } from './portraits-cyril.js';
import { RADNOR, radnorLayer, paintRadnor } from './portraits-radnor.js';
import { AMMON, ammonLayer, paintAmmon } from './portraits-ammon.js';

export const MENTAT_PAINTINGS = {
  atreides: { ...CYRIL, layer: cyrilLayer, paint: paintCyril },
  harkonnen: { ...RADNOR, layer: radnorLayer, paint: paintRadnor },
  ordos: { ...AMMON, layer: ammonLayer, paint: paintAmmon },
};
