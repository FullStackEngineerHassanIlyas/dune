// The three Mentats (research.md §4): Cyril of the Atreides, Radnor of the Harkonnen, Ammon of the Ordos, each before
// his house's chamber. Each is our own 3D figure (portraits-cyril.js, -radnor.js, -ammon.js), baked once to WebP
// layers by assets/campaign/portraits/bake.mjs; here the layers are stacked as images in the portrait's 400 x 500
// frame (the chamber, the body, the head, the closed eyes) and given a little life: he breathes, his head turns a
// touch, he blinks. Only transforms and opacity move, so the browser's compositor runs it without repainting; nothing
// moves when the player asks for less motion. Markup for innerHTML (a string, so it builds in Node too).
//
// The frame keeps the old SVG's contract: the root (.cp-mentat-art) fills its box, and the 400 x 500 frame inside
// is scaled to fit it whole, centred, standing on its bottom edge (an SVG's xMidYMax meet), by container units.
import { PORTRAITS } from './portraits-layers.js';

const BASE = new URL('../../../assets/campaign/portraits/', import.meta.url).href;
const HOUSE_NAMES = { atreides: 'Atreides', harkonnen: 'Harkonnen', ordos: 'Ordos' };
export const LAYERS = ['back', 'body', 'head', 'lids'];

/** Each Mentat's own pace: breaths, the head's slow turn, the blink (seconds); the turn's reach (degrees). */
export const PACE = {
  atreides: { breathe: 5.2, sway: 12, turn: 1.1, blink: 9.6 },
  harkonnen: { breathe: 6.4, sway: 15, turn: 0.8, blink: 12.4 },
  ordos: { breathe: 5.8, sway: 13, turn: 0.9, blink: 10.8 },
};

const pct = (v, of) => `${+((v / of) * 100).toFixed(3)}%`;
const box = ([x, y, w, h]) => `left:${pct(x, 400)};top:${pct(y, 500)};width:${pct(w, 400)};height:${pct(h, 500)}`;

/**
 * The rules for one house's portrait, every value written out (no custom properties in the keyframes, so the
 * compositor can take the animations as they are). The breath lifts the body from its bottom edge and the head with
 * it; the head turns about the root of the neck; the closed eyes show for one step of the blink's cycle.
 */
function style(house, p) {
  const k = `cpm-${house}`, pace = PACE[house], [px, py] = p.pivot;
  const rise = ((500 - py) * 0.009 / 500) * 100;
  const t = pace.turn;
  return `<style>
.${k} .cpm-l{position:absolute;display:block;max-width:none;user-select:none;-webkit-user-drag:none}
.${k} .cpm-w{position:absolute;inset:0;will-change:transform}
.${k} .cpm-breathe{transform-origin:50% 100%;animation:${k}-breathe ${pace.breathe}s ease-in-out infinite alternate}
.${k} .cpm-rise{animation:${k}-rise ${pace.breathe}s ease-in-out infinite alternate}
.${k} .cpm-sway{transform-origin:${pct(px, 400)} ${pct(py, 500)};animation:${k}-sway ${pace.sway}s ease-in-out infinite}
.${k} .cpm-blink{opacity:0;will-change:opacity;animation:${k}-blink ${pace.blink}s step-end infinite}
@keyframes ${k}-breathe{from{transform:scale(1,1)}to{transform:scale(1.004,1.009)}}
@keyframes ${k}-rise{from{transform:translateY(0)}to{transform:translateY(-${rise.toFixed(3)}%)}}
@keyframes ${k}-sway{0%,100%{transform:rotate(0deg) translateX(0)}30%{transform:rotate(${(-t).toFixed(2)}deg) translateX(-0.12%)}68%{transform:rotate(${(t * 0.6).toFixed(2)}deg) translateX(0.1%)}}
@keyframes ${k}-blink{0%{opacity:0}55%{opacity:1}56.3%{opacity:0}92%{opacity:1}93.3%{opacity:0}96%{opacity:1}97.3%{opacity:0}}
@media (prefers-reduced-motion:reduce){.${k} .cpm-breathe,.${k} .cpm-rise,.${k} .cpm-sway,.${k} .cpm-blink{animation:none}.${k} .cpm-blink{opacity:0}}
</style>`;
}

const image = (house, layer, b, cls = '') =>
  `<img class="cpm-l${cls}" src="${BASE}${house}-${layer}.webp" alt="" draggable="false" decoding="async" style="${box(b)}">`;

/** The markup of a house's Mentat (empty for a house without one). The name is the old one: callers keep working. */
export function mentatSvg(house) {
  const p = PORTRAITS[house];
  if (!p) return '';
  const L = p.layers;
  return `<div class="cp-mentat-art cpm cpm-${house}" role="img" aria-label="${p.name}, Mentat of House ${HOUSE_NAMES[house]}" style="filter:none;position:relative;overflow:hidden;container-type:size">${style(house, p)}
<div class="cpm-frame" style="position:absolute;left:50%;bottom:0;width:min(100cqw,80cqh);height:min(125cqw,100cqh);transform:translateX(-50%)">
${image(house, 'back', L.back)}
<div class="cpm-w cpm-breathe">${image(house, 'body', L.body)}</div>
<div class="cpm-w cpm-rise"><div class="cpm-w cpm-sway">${image(house, 'head', L.head)}${image(house, 'lids', L.lids, ' cpm-blink')}</div></div>
</div></div>`;
}

/** The image files a house's portrait shows (for preloading or tests). */
export function mentatFiles(house) {
  return PORTRAITS[house] ? LAYERS.map((l) => `${BASE}${house}-${l}.webp`) : [];
}
