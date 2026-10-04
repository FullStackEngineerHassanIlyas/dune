// The house crests (spec §5.8: hawk, ram, serpent), our own drawings: as the Sega house selection frames them
// (research.md §4: left to right Atreides, Ordos, Harkonnen in ornate gold frames), each house's charge on a
// steel-rimmed heater shield over an enamelled field, inside a carved gold frame with jewels in the house colour.
// The Atreides hawk is cast gold on blue-green enamel, the Ordos serpent green and yellow on a pale field, the
// Harkonnen ram dark iron on crimson within a black border. The Emperor's Sardaukar (a lion on purple), the
// Mercenaries (crossed swords on a coin) and the Fremen (a crysknife in a sandworm's maw) have crests too.
// Lit from the top left by SVG lighting filters (cast-metal relief, specular highlights) over gradients, and drawn
// procedurally (crests-charges.js, crests-frame.js). Markup strings for innerHTML.
import { SIZE, filters, gradients, frame, field, shield, shieldPoints, GOLD } from './crests-frame.js';
import { hawk, ram, serpent, lion, swords, crysknife } from './crests-charges.js';

/** Rim metals, as gradient stops from the lit top left to the shadowed bottom right. */
const STEEL = ['#fbfdff', '#bcc6d1', '#66717f', '#dfe5ec', '#8f9aa7', '#2a3038'];
const IRON = ['#c6ccd4', '#6f7884', '#2c3138', '#9aa2ac', '#4c535d', '#121418'];

/** Charge materials: three tones each for the light, middle and dark parts, the outline ink and engraving. */
const GOLD_M = { light: ['#fffbe0', '#f5c95e', '#8a5410'], mid: ['#fbe29a', '#d29a30', '#6a3c08'], dark: ['#e9b54a', '#9c5e14', '#3e2203'],
  ink: '#2a1703', detail: '#5e3a0a', eye: ['#ffe9a0', '#d08a10', '#5a2c00'] };

export const CREST_STYLES = {
  atreides: {
    label: 'The Atreides hawk', charge: hawk, place: 'translate(200 210) scale(.82)',
    field: ['#1f5d8c', '#0c2a4e', '#020814'], diaper: '#9ad6ff', enamel: ['#3bb3bd', '#14728e', '#08294e'], engine: 'rays', rim: STEEL,
    gem: ['#e2f4ff', '#3d8ff0', '#0b2a70'], metal: { ...GOLD_M, eye: '#10233a' },
  },
  ordos: {
    label: 'The Ordos serpent', charge: serpent, place: 'translate(198 204) scale(1)',
    field: ['#1f6a34', '#0c3418', '#020a04'], diaper: '#a6f0a0', enamel: ['#ffffff', '#dde6df', '#97a69e'], engine: 'rosette', rim: STEEL,
    gem: ['#e6ffd8', '#3cc04a', '#0a4a14'],
    metal: { light: ['#b6f08a', '#43a84a', '#11501c'], mid: ['#7fd06a', '#2c8a38', '#0c4416'], dark: ['#2f8a3a', '#145c22', '#062a0c'], ink: '#06200c', detail: '#0a3a14',
      belly: ['#fff8b0', '#f4d43c', '#a07e0c'], eye: ['#fffbd0', '#f4c414', '#8a5a00'], accent: '#d0281c' },
  },
  harkonnen: {
    label: 'The Harkonnen ram', charge: ram, place: 'translate(200 196) scale(1.02)',
    field: ['#6a1410', '#2c0604', '#080101'], diaper: '#ff8a70', enamel: ['#d8392a', '#86140c', '#2a0403'], engine: 'rings', bordure: '#120404', rim: IRON,
    gem: ['#ffd8cc', '#e0281a', '#5a0400'],
    metal: { light: ['#eef2f6', '#9ba5b1', '#3e454e'], mid: ['#c2c9d2', '#6c7682', '#2a3037'], dark: ['#5d6570', '#2c3138', '#0c0e11'], ink: '#0b0c0f', detail: '#20242a',
      horn: ['#c9bfae', '#7a6e60', '#3c342c', '#141110'], eye: ['#fff6b0', '#ff6a1e', '#8a0a00'] },
  },
  sardaukar: {
    label: 'The Sardaukar lion of the Emperor', charge: lion, place: 'translate(200 198) scale(1.1)',
    field: ['#4e2878', '#241040', '#0a0416'], diaper: '#d6a8ff', enamel: ['#a868e0', '#5e2a96', '#22073f'], engine: 'rays', rim: STEEL,
    gem: ['#f4e0ff', '#a25ae6', '#3a0a70'], metal: { ...GOLD_M },
  },
  mercenary: {
    label: 'The Mercenary swords', charge: swords, place: 'translate(200 196) scale(1.1)',
    field: ['#4e4214', '#241e08', '#0a0802'], diaper: '#ffe680', enamel: ['#4a4232', '#211c13', '#0a0806'], engine: 'rings', rim: STEEL,
    gem: ['#fffad0', '#f2cc1c', '#7a5800'], metal: { ...GOLD_M, blade: ['#ffffff', '#c9d1da', '#6a7480'] },
  },
  fremen: {
    label: 'The Fremen crysknife', charge: crysknife, place: 'translate(200 200) scale(.98)',
    field: ['#6a4c24', '#30200c', '#0c0804'], diaper: '#ffd890', enamel: ['#f0d29a', '#b48c50', '#5e421c'], engine: 'rosette', rim: STEEL,
    gem: ['#fff0c8', '#e0962a', '#6a3a06'],
    metal: { ...GOLD_M, mid: ['#e6c48a', '#b08a52', '#6a4c24'], dark: ['#9a7444', '#5e4220', '#2a1c0a'], blade: ['#ffffff', '#ece6d8', '#a8a090'], ink: '#2a1a08', detail: '#4a3418',
      throat: ['#050302', '#1c0e08', '#5a3020', '#8a5636'] },
  },
};

/** Houses with a crest. */
export const CREST_HOUSES = Object.keys(CREST_STYLES);

const f2 = (v) => String(Math.round(v * 100) / 100);
const stops = (list) => list.map((c, i) => `<stop offset="${f2(i / (list.length - 1))}" stop-color="${c}"/>`).join('');

/** The charge's own gradients: three tones, the eye, the horn, the belly, the blade, and the scale pattern. */
function chargeDefs(p, m) {
  const eye = Array.isArray(m.eye) ? m.eye : [m.eye, m.eye];
  return `
  <linearGradient id="${p}-flight" x1="0" y1="0" x2="1" y2="1">${stops(m.light)}</linearGradient>
  <linearGradient id="${p}-fmid" x1="0" y1="0" x2="1" y2="1">${stops(m.mid)}</linearGradient>
  <linearGradient id="${p}-fdark" x1="0" y1="0" x2="1" y2="1">${stops(m.dark)}</linearGradient>
  <radialGradient id="${p}-eye" cx=".4" cy=".4" r=".7">${stops(eye)}</radialGradient>
  ${m.horn ? `<linearGradient id="${p}-horn" x1="0" y1="0" x2="1" y2="1">${stops(m.horn)}</linearGradient>` : ''}
  ${m.belly ? `<linearGradient id="${p}-belly" x1="0" y1="0" x2="1" y2="1">${stops(m.belly)}</linearGradient>` : ''}
  ${m.blade ? `<linearGradient id="${p}-blade" x1="0" y1="0" x2="1" y2="0">${stops(m.blade)}</linearGradient>` : ''}
  ${m.throat ? `<radialGradient id="${p}-throat" cx=".5" cy=".5" r=".5">${stops(m.throat)}</radialGradient>` : ''}
  <pattern id="${p}-scales" width="7" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
    <path d="M0 6Q3.5 0 7 6M-3.5 3Q0 -3 3.5 3M3.5 3Q7 -3 10.5 3" fill="none" stroke="${m.ink}" stroke-width=".55" opacity=".45"/>
  </pattern>`;
}

/** The crests' view boxes: the framed crest is square, the bare shield 4:5. */
export const VIEWBOX = { framed: [0, 0, SIZE, SIZE], shield: [76, 52, 248, 310] };

let serial = 0;

/**
 * The crest as a standalone SVG document (empty for a house without one): variant 'framed' (the default) is the
 * full crest in its gold frame; 'shield' the shield and its charge alone, cropped to the shield. detail (default:
 * on for framed, off for the shield) adds the fine engraving (feather veins, breast scales, horn rings, rivets,
 * engine turning), which only blurs below about 96 px. Its ids are unique per call, so it can also go inline.
 */
export function crestArt(house, { variant = 'framed', detail } = {}) {
  const s = CREST_STYLES[house];
  if (!s) return '';
  const p = `cr${++serial}${house.slice(0, 2)}`;
  const framed = variant !== 'shield';
  const fine = detail ?? framed;
  const m = { ...s.metal, p };
  const [x, y, w, h] = VIEWBOX[framed ? 'framed' : 'shield'];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">
  <defs>${filters(p)}${gradients(p, s)}${chargeDefs(p, m)}</defs>
  ${framed ? field(p) : ''}
  ${shield(p, s, { rivets: fine, engraving: fine })}
  <g filter="url(#${p}-drop)"><g filter="url(#${p}-relief)"><g transform="${s.place}">${s.charge(m, { detail: fine })}</g></g></g>
  ${framed ? frame(p) : ''}
</svg>`;
}

/**
 * A data: URL for an SVG document, escaped as little as an attribute allows: one line, single quotes inside, and
 * only %, #, < and > encoded.
 */
export function svgDataUrl(svg) {
  const body = svg.replace(/\s+/g, ' ').replace(/> </g, '><').replace(/"/g, "'")
    .replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E');
  return `data:image/svg+xml,${body}`;
}

const made = new Map();

/**
 * SVG markup for a house's crest, for innerHTML (empty for a house without one). The art (crestArt) is drawn
 * inside as an image, so the browser rasterises its lighting filters once and reuses the picture while the
 * crest moves or glows (as inline SVG they would run again on every hover frame); the outer <svg> keeps the
 * class, role and label and fills its box. variant 'framed' (the default) is for the house selection and
 * anything from about 120 px up; 'shield' (4:5) for small places such as a 48 px badge; detail as in crestArt.
 */
export function crestSvg(house, { variant = 'framed', detail } = {}) {
  const s = CREST_STYLES[house];
  if (!s) return '';
  const framed = variant !== 'shield';
  const key = `${house}/${framed ? 'framed' : 'shield'}/${detail ?? framed}`;
  if (!made.has(key)) {
    const [x, y, w, h] = VIEWBOX[framed ? 'framed' : 'shield'];
    made.set(key, `<svg class="cp-crest-art${framed ? '' : ' cp-crest-shield'}" viewBox="${x} ${y} ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${s.label}">`
      + `<image href="${svgDataUrl(crestArt(house, { variant, detail }))}" x="${x}" y="${y}" width="${w}" height="${h}"/></svg>`);
  }
  return made.get(key);
}

export { GOLD, shieldPoints };
