// SVG cursors (spec §5.6) in the manner of C&C: a bronze arrow over the whole game, the context
// cursors on the battlefield (select, move and attack pulse, the Palace reticle turns, a Carryall's
// lift is an arrow rising out of its claws), and scroll arrows for all eight directions while the map
// scrolls from an edge or a right-button pull.
const svg = (body, hx, hy) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>${body}</svg>`)}") ${hx} ${hy}, auto`;

export const FRAME_MS = 125;
const INK = '#140b03';
const BRONZE = `<defs><linearGradient id='b' x1='0' y1='0' x2='.8' y2='1'><stop offset='0' stop-color='#fff0c2'/><stop offset='.5' stop-color='#e2a73e'/><stop offset='1' stop-color='#8a5818'/></linearGradient></defs>`;

const ARROW = 'M3 2v22l5.6-5.2 4 9.2 4.4-1.9-4-9h7.6z';
const arrow = svg(`${BRONZE}<path d='${ARROW}' fill='url(#b)' stroke='${INK}' stroke-width='2' stroke-linejoin='round'/><path d='M5 6.5v12.6' stroke='#fff8e0' stroke-width='1.2' opacity='.7'/>`, 3, 2);

const brackets = (i, L = 7) => `M${i} ${i + L}V${i}h${L}M${32 - i - L} ${i}h${L}v${L}M${32 - i} ${32 - i - L}v${L}h${-L}M${i + L} ${32 - i}H${i}v${-L}`;
const select = (i) => svg(`<path d='${brackets(i)}' fill='none' stroke='${INK}' stroke-width='4.5' stroke-linecap='square'/><path d='${brackets(i)}' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='square'/>`, 16, 16);

// four green arrowheads closing in on the spot, as the C&C move cursor does
const inward = (d, fill) => [0, 90, 180, 270].map((a) => `<path transform='rotate(${a} 16 16)' d='M10.5 ${2 + d}h11L16 ${10 + d}z' fill='${fill}' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/>`).join('');
const move = (d) => svg(`${inward(d, '#8dff6a')}<circle cx='16' cy='16' r='2' fill='#8dff6a' stroke='${INK}' stroke-width='1.2'/>`, 16, 16);

const crosshair = (r, color) => `<g fill='none' stroke='${INK}' stroke-width='4.5' stroke-linecap='round'><circle cx='16' cy='16' r='${r}'/><path d='M16 2v6M16 24v6M2 16h6M24 16h6'/></g><g fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round'><circle cx='16' cy='16' r='${r}'/><path d='M16 2v6M16 24v6M2 16h6M24 16h6'/></g><circle cx='16' cy='16' r='1.6' fill='${color}' stroke='${INK}' stroke-width='.8'/>`;
const attack = (r) => svg(crosshair(r, '#ff3b2f'), 16, 16);

const reticle = (a) => svg(`<g transform='rotate(${a} 16 16)' fill='none'><circle cx='16' cy='16' r='12' stroke='${INK}' stroke-width='4.5' stroke-dasharray='12 6.85'/><circle cx='16' cy='16' r='12' stroke='#ffd24a' stroke-width='2' stroke-dasharray='12 6.85'/></g><g fill='none' stroke='${INK}' stroke-width='4'><circle cx='16' cy='16' r='4.5'/><path d='M16 6v5M16 21v5M6 16h5M21 16h5'/></g><g fill='none' stroke='#ffd24a' stroke-width='1.8'><circle cx='16' cy='16' r='4.5'/><path d='M16 6v5M16 21v5M6 16h5M21 16h5'/></g>`, 16, 16);

// a bronze scroll arrow pointing north, turned for the other seven directions; the hotspot sits on its tip
const SCROLL = 'M16 1.5l12 12h-7.5v11h-9v-11H4z';
const DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const scroll = (i) => {
  const a = i * 45, rad = (a * Math.PI) / 180;
  const hx = Math.round(16 + 14.5 * Math.sin(rad)), hy = Math.round(16 - 14.5 * Math.cos(rad));
  return svg(`${BRONZE}<g transform='rotate(${a} 16 16)'><path d='${SCROLL}' fill='url(#b)' stroke='${INK}' stroke-width='2' stroke-linejoin='round'/><path d='M16 5.5l6.5 6.5' stroke='#fff8e0' stroke-width='1.2' opacity='.6'/></g>`, hx, hy);
};
const pan = svg(`${BRONZE}${[0, 90, 180, 270].map((a) => `<path transform='rotate(${a} 16 16)' d='M16 2l6 6.5h-12z' fill='url(#b)' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/>`).join('')}<circle cx='16' cy='16' r='3.2' fill='url(#b)' stroke='${INK}' stroke-width='1.6'/>`, 16, 16);

const WRENCH = 'M21 4a6 6 0 0 0-5.6 8.1L5 22.5 9.5 27l10.4-10.4A6 6 0 0 0 28 11l-3.6 3.6-3.4-.6-.6-3.4L24 7a6 6 0 0 0-3-3z';
const DOLLAR = 'M20 11.5c-.9-1.4-2.5-2-4.2-2-2.3 0-4 1.2-4 3 0 4.4 8.6 2.3 8.6 6.8 0 2-1.8 3.3-4.5 3.3-2 0-3.8-.8-4.7-2.2M16 7v18';
const SLASH = `<path d='M7 25L25 7' stroke='${INK}' stroke-width='5.5' stroke-linecap='round'/><path d='M7 25L25 7' stroke='#ff3b2f' stroke-width='3' stroke-linecap='round'/>`;

/** Animated cursors: frames shown FRAME_MS apart. */
export const ANIMATED = {
  select: [4, 3, 2, 3].map(select),
  move: [0, 1.5, 3, 1.5].map(move),
  attack: [10, 9, 8, 9].map(attack),
  target: [0, 22.5, 45, 67.5].map(reticle),
};

export const CURSORS = {
  default: arrow,
  target: ANIMATED.target[0],
  select: ANIMATED.select[0],
  move: ANIMATED.move[0],
  attack: ANIMATED.attack[0],
  sabotage: svg(`<circle cx='14' cy='19' r='9' fill='#1d1408' stroke='${INK}' stroke-width='4'/><circle cx='14' cy='19' r='9' fill='#1d1408' stroke='#ffd24a' stroke-width='2'/><path d='M19 12l4-4' stroke='#ffd24a' stroke-width='2.5'/><path d='M23 8l3-2M24 9l3 1M22 6l1-3' stroke='#ff4a36' stroke-width='1.6'/>`, 14, 19),
  noMove: svg(`<circle cx='16' cy='16' r='11' fill='none' stroke='${INK}' stroke-width='5.5'/><circle cx='16' cy='16' r='11' fill='none' stroke='#ff3b2f' stroke-width='3'/>${SLASH}`, 16, 16),
  deploy: svg(`<path d='M6 26h20v-4H6zM9 22l7-12 7 12z' fill='#ffd24a' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/>`, 16, 16),
  noDeploy: svg(`<path d='M6 26h20v-4H6zM9 22l7-12 7 12z' fill='#888' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/>${SLASH}`, 16, 16),
  sell: svg(`<circle cx='16' cy='16' r='12' fill='#1d1408' stroke='${INK}' stroke-width='4.5'/><circle cx='16' cy='16' r='12' fill='#1d1408' stroke='#ffd24a' stroke-width='2.5'/><path d='${DOLLAR}' fill='none' stroke='#ffd24a' stroke-width='2.2' stroke-linecap='round'/>`, 16, 16),
  noSell: svg(`<circle cx='16' cy='16' r='12' fill='#1d1408' stroke='${INK}' stroke-width='4.5'/><circle cx='16' cy='16' r='12' fill='#1d1408' stroke='#8a8a8a' stroke-width='2.5'/><path d='${DOLLAR}' fill='none' stroke='#8a8a8a' stroke-width='2.2' stroke-linecap='round'/>${SLASH}`, 16, 16),
  repair: svg(`<path d='${WRENCH}' fill='#8dff6a' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/>`, 8, 24),
  noRepair: svg(`<path d='${WRENCH}' fill='#8a8a8a' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/>${SLASH}`, 8, 24),
  enter: svg(`<path d='M16 3l11 9h-4v14H9V12H5z' fill='#8dff6a' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/><path d='M13 26v-7h6v7' fill='#1d1408'/>`, 16, 16),
  lift: svg(`<path d='M16 2l8 8h-5v7h-6v-7H8z' fill='#8dff6a' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/><path d='M8 19v7h16v-7' fill='none' stroke='${INK}' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/><path d='M8 19v7h16v-7' fill='none' stroke='#ffd24a' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/>`, 16, 16),
  capture: svg(`<path d='M16 3l11 9h-4v14H9V12H5z' fill='#ffd24a' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/><path d='M12 10v12M12 10h9l-2 3 2 3h-9' fill='#e0412f' stroke='${INK}' stroke-width='1'/>`, 16, 16),
  pan,
  ...Object.fromEntries(DIRS.map((d, i) => [`scroll-${d}`, scroll(i)])),
};

/** The bronze arrow for the whole page (the stylesheet reads --cursor); the battlefield sets its own. */
export function installCursors(doc = document) {
  doc.documentElement.style.setProperty('--cursor', CURSORS.default);
}

/** Context cursor for the battlefield; call it every frame so the animated ones move. */
export function makeCursorSetter(el, now = () => performance.now()) {
  let current = null;
  return (name) => {
    const frames = ANIMATED[name];
    const value = frames ? frames[Math.floor(now() / FRAME_MS) % frames.length] : CURSORS[name] ?? CURSORS.default;
    if (value === current) return;
    current = value;
    el.style.cursor = value;
  };
}

/** Scroll arrows over everything (the sidebar too) while the map scrolls, and the anchor of a right-button pull. */
export function makeScrollCursor(root, anchor) {
  let current = null;
  return (state) => {
    const value = state ? CURSORS[state.dir ? `scroll-${state.dir}` : 'pan'] : null;
    if (value) root.style.setProperty('--scroll-cursor', value);
    if (!!value !== !!current) root.classList.toggle('scrolling', !!value);
    current = value;
    if (!anchor) return;
    anchor.classList.toggle('show', !!state?.anchor);
    if (state?.anchor) anchor.style.transform = `translate(${state.anchor.x}px, ${state.anchor.y}px)`;
  };
}
