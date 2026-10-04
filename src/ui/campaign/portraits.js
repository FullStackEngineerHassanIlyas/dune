// The three Mentats as painted portraits (research.md §4): Cyril of the Atreides, Radnor of the Harkonnen, Ammon of
// the Ordos, each before his house's chamber. The paintings are our own (portraits-cyril.js, portraits-radnor.js,
// portraits-ammon.js), baked to WebP layers by assets/campaign/portraits/bake.mjs; here the layers are stacked in one
// SVG (the chamber, the body, the head, the closed eyes) and given a little life in CSS: he breathes, his head turns
// a touch, he blinks. Nothing moves when the player asks for less motion. Markup for innerHTML (a string, so it
// builds in Node too).
import { PORTRAITS } from './portraits-layers.js';

const BASE = new URL('../../../assets/campaign/portraits/', import.meta.url).href;
const HOUSE_NAMES = { atreides: 'Atreides', harkonnen: 'Harkonnen', ordos: 'Ordos' };

/** Each Mentat's own pace: breaths, the head's slow turn, the blink (seconds); the turn's reach (degrees). */
const PACE = {
  atreides: { breathe: 5.2, sway: 12, turn: 1.1, blink: 9.6 },
  harkonnen: { breathe: 6.4, sway: 15, turn: 0.8, blink: 12.4 },
  ordos: { breathe: 5.8, sway: 13, turn: 0.9, blink: 10.8 },
};

// One rule set for every portrait (the class names carry the house's numbers as custom properties). The lids show
// for one step of the blink's cycle; the breath lifts the body from its bottom edge and the head with it.
const STYLE = `<style>
.cpm-breathe{transform-box:view-box;transform-origin:200px 500px;animation:cpm-breathe var(--cpm-breathe) ease-in-out infinite alternate}
.cpm-rise{animation:cpm-rise var(--cpm-breathe) ease-in-out infinite alternate}
.cpm-sway{transform-box:view-box;animation:cpm-sway var(--cpm-sway) ease-in-out infinite}
.cpm-blink{opacity:0;animation:cpm-blink var(--cpm-blink) step-end infinite}
@keyframes cpm-breathe{to{transform:scale(1.004,1.009)}}
@keyframes cpm-rise{to{transform:translateY(var(--cpm-rise))}}
@keyframes cpm-sway{0%,100%{transform:rotate(0deg)}30%{transform:rotate(calc(var(--cpm-turn) * -1)) translateX(-.5px)}68%{transform:rotate(calc(var(--cpm-turn) * .6)) translateX(.4px)}}
@keyframes cpm-blink{0%{opacity:0}55%{opacity:1}56.3%{opacity:0}92%{opacity:1}93.3%{opacity:0}96%{opacity:1}97.3%{opacity:0}}
@media (prefers-reduced-motion:reduce){.cpm-breathe,.cpm-rise,.cpm-sway,.cpm-blink{animation:none}.cpm-blink{opacity:0}}
</style>`;

const image = (house, layer, [x, y, w, h]) =>
  `<image href="${BASE}${house}-${layer}.webp" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>`;

/** SVG markup for a house's Mentat (empty for a house without one). */
export function mentatSvg(house) {
  const p = PORTRAITS[house];
  if (!p) return '';
  const pace = PACE[house];
  const [px, py] = p.pivot;
  const rise = -((500 - py) * 0.009).toFixed(2);
  const vars = `--cpm-breathe:${pace.breathe}s;--cpm-sway:${pace.sway}s;--cpm-turn:${pace.turn}deg;--cpm-blink:${pace.blink}s;--cpm-rise:${rise}px`;
  return `<svg class="cp-mentat-art cpm cpm-${house}" viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${p.name}, Mentat of House ${HOUSE_NAMES[house]}" preserveAspectRatio="xMidYMax meet" style="filter:none;${vars}">${STYLE}
${image(house, 'back', p.layers.back)}
<g class="cpm-breathe">${image(house, 'body', p.layers.body)}</g>
<g class="cpm-rise"><g class="cpm-sway" style="transform-origin:${px}px ${py}px">${image(house, 'head', p.layers.head)}<g class="cpm-blink">${image(house, 'lids', p.layers.lids)}</g></g></g>
</svg>`;
}

/** The image files a house's portrait shows (for preloading or tests). */
export function mentatFiles(house) {
  return PORTRAITS[house] ? ['back', 'body', 'head', 'lids'].map((l) => `${BASE}${house}-${l}.webp`) : [];
}
