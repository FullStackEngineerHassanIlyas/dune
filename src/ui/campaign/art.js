// The campaign screens' pictures, all our own SVG (markup strings for innerHTML): the victory card (research.md §5
// describes the Sega's: a still picture after every won mission; ours is a house banner planted on a dune with
// three troopers cheering and a frigate lifting off), the line art behind the score screen, and the flat map of
// Arrakis drawn when the 3D territory map (src/render/atlas) is missing or fails: one cell per region, each in its
// owner's colour, the player's land growing from its corner mission by mission.
import { HOUSES } from '../../data/houses.js';

const hex = (id) => `#${(HOUSES[id]?.color ?? 0xa8834a).toString(16).padStart(6, '0')}`;

/** A trooper on the skyline, arm and rifle raised. */
const trooper = (x, y, s, flip) => `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})" fill="#24140a" stroke="#24140a" stroke-linecap="round">
  <circle cx="0" cy="-58" r="8"/><path d="M-9 -62 Q0 -74 9 -62Z"/><path d="M-9 -48 L9 -48 L11 -14 L-11 -14Z"/>
  <path d="M-7 -14 L-11 14 M7 -14 L11 14" stroke-width="7" fill="none"/><path d="M8 -44 L22 -76" stroke-width="6" fill="none"/>
  <path d="M18 -70 L30 -104" stroke-width="4" fill="none"/><path d="M-8 -44 L-20 -24" stroke-width="6" fill="none"/></g>`;

/** The victory card's picture (16:9). */
export function victorySvg(house) {
  const c = hex(house);
  return `<svg class="cp-victory-art" viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="v-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fcfb2"/><stop offset=".55" stop-color="#e8e2a4"/><stop offset="1" stop-color="#f4c47a"/></linearGradient>
    <radialGradient id="v-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe0"/><stop offset=".6" stop-color="#fff2b0" stop-opacity=".8"/><stop offset="1" stop-color="#fff2b0" stop-opacity="0"/></radialGradient>
    <linearGradient id="v-flag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#0a0604"/></linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#v-sky)"/>
  <circle cx="250" cy="250" r="120" fill="url(#v-sun)"/>
  <g transform="translate(560 96) rotate(-8)">
    <path d="M-120 10 C-90 -14 60 -18 110 -6 C124 -2 124 12 110 16 C60 26 -90 26 -120 10Z" fill="#5d6470"/>
    <path d="M-100 4 L90 -2 M-60 -10 L-50 18 M0 -14 L6 20 M50 -12 L56 18" stroke="#3a3f48" stroke-width="3"/>
    <rect x="-130" y="14" width="40" height="14" rx="5" fill="#40454e"/><rect x="80" y="12" width="40" height="14" rx="5" fill="#40454e"/>
    <ellipse cx="-110" cy="38" rx="12" ry="22" fill="#fff4c0" opacity=".7"/><ellipse cx="100" cy="36" rx="12" ry="22" fill="#fff4c0" opacity=".7"/>
  </g>
  <path d="M0 300 C120 270 220 286 330 268 C450 248 560 276 800 252 L800 450 L0 450Z" fill="#e1aa6a"/>
  <path d="M0 340 C140 312 260 332 420 304 C560 282 680 312 800 296 L800 450 L0 450Z" fill="#c88a48"/>
  <path d="M0 400 C110 372 230 330 360 322 C480 316 600 350 800 362 L800 450 L0 450Z" fill="#8e5a2a"/>
  <path d="M360 322 L360 150" stroke="#24140a" stroke-width="6"/><circle cx="360" cy="146" r="7" fill="#e2b043" stroke="#24140a" stroke-width="2"/>
  <path d="M363 156 C410 146 440 172 492 160 L492 236 C440 248 410 222 363 232Z" fill="url(#v-flag)" stroke="#24140a" stroke-width="3"/>
  <circle cx="428" cy="195" r="20" fill="none" stroke="#f4e2a0" stroke-width="5"/><circle cx="428" cy="195" r="8" fill="#f4e2a0"/>
  ${trooper(300, 336, 1.25, false)}${trooper(424, 330, 1.35, true)}${trooper(470, 346, 1.15, false)}
  <path d="M0 450 L0 420 C160 402 300 418 420 412 C560 404 680 420 800 410 L800 450Z" fill="#5c3616"/>
</svg>`;
}

/** Line art of a combat tank, drawn behind the score screen in a darker shade of its gold. */
export function tankSvg() {
  return `<svg class="cp-score-art" viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
  <path d="M40 150 L360 150 L340 196 L60 196Z"/>
  ${[86, 136, 186, 236, 286, 330].map((x) => `<circle cx="${x}" cy="176" r="16"/><circle cx="${x}" cy="176" r="5"/>`).join('')}
  <path d="M60 150 L80 112 L320 112 L344 150"/><path d="M120 112 L140 70 L260 70 L282 112"/>
  <path d="M260 88 L392 72 L394 90 L262 104"/><path d="M160 70 L164 52 L200 52 L204 70"/><path d="M94 132 L306 132"/>
  <path d="M30 206 L370 206" stroke-dasharray="10 12"/></svg>`;
}

// The flat map: a lattice of 7 x 5 points jittered by a fixed seed gives 24 cells that share their edges.
const COLS = 6, ROWS = 4, W = 600, H = 380;
const START = { harkonnen: [0, 0], atreides: [COLS - 1, 0], ordos: [COLS - 1, ROWS - 1], sardaukar: [0, ROWS - 1] };
function lattice() {
  let s = 1234567;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  return Array.from({ length: COLS + 1 }, (_, i) => Array.from({ length: ROWS + 1 }, (_, j) => {
    const edgeX = i === 0 || i === COLS, edgeY = j === 0 || j === ROWS;
    return [i * W / COLS + (edgeX ? 0 : (rnd() - 0.5) * 60), j * H / ROWS + (edgeY ? 0 : (rnd() - 0.5) * 50)];
  }));
}

/** Who owns each cell after `step` missions won by `house`: the player spreads from its corner, the rivals shrink
 *  into theirs, and before the last mission the Emperor's Sardaukar hold the far corner. */
export function flatOwners(house, step) {
  const rivals = Object.keys(START).filter((id) => id !== house && id !== 'sardaukar');
  const reach = 1.2 + step * 0.62, hold = Math.max(0.9, 2.3 - step * 0.2);
  const far = Object.values(START).reduce((best, s) => (Math.hypot(s[0] - START[house][0], s[1] - START[house][1]) > Math.hypot(best[0] - START[house][0], best[1] - START[house][1]) ? s : best));
  const owners = [];
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const d = (s) => Math.hypot(i - s[0], (j - s[1]) * 1.3);
    let owner = null;
    if (step === 8 && i === far[0] && j === far[1]) owner = 'sardaukar';
    else if (d(START[house]) <= reach) owner = house;
    else for (const r of rivals) if (step < 9 && d(START[r]) <= hold) owner = r;
    owners.push(owner);
  }
  return owners;
}

/** The flat coloured map of Arrakis for `house` after `step` missions; `target` (a cell index) is ringed. */
export function flatMapSvg(house, step, { target = null } = {}) {
  const P = lattice();
  const owners = flatOwners(house, step);
  const cells = owners.map((owner, k) => {
    const i = k % COLS, j = Math.floor(k / COLS);
    const pts = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const cell = `<polygon points="${pts}" fill="${owner ? hex(owner) : 'transparent'}" fill-opacity="${owner ? 0.62 : 0}" stroke="#3a2210" stroke-width="2"/>`;
    return k === target ? `${cell}<polygon class="cp-flat-target" points="${pts}" fill="#fff3c4" fill-opacity=".35" stroke="#fff3c4" stroke-width="6"/>` : cell;
  });
  return `<svg class="cp-flat-map" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of Arrakis">
  <defs><filter id="f-sand" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .36  0 0 0 0 .18  0 0 0 .55 0"/></filter>
    <linearGradient id="f-ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9a868"/><stop offset="1" stop-color="#a8703a"/></linearGradient></defs>
  <rect width="${W}" height="${H}" rx="10" fill="url(#f-ground)"/><rect width="${W}" height="${H}" rx="10" filter="url(#f-sand)"/>
  ${cells.join('')}
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10" fill="none" stroke="#e2b043" stroke-width="3"/></svg>`;
}

/** A flat-map cell's centre as fractions of the map's width and height (the zoom heads for it). */
export function flatCentre(k) {
  if (!(k >= 0 && k < COLS * ROWS)) return [0.5, 0.5];
  const P = lattice(), i = k % COLS, j = Math.floor(k / COLS);
  const pts = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]];
  return [pts.reduce((n, p) => n + p[0], 0) / 4 / W, pts.reduce((n, p) => n + p[1], 0) / 4 / H];
}

/** The cell a mission's region zoom points at on the flat map: the next one beyond the player's land. */
export function flatTarget(house, mission) {
  const before = flatOwners(house, mission - 1), after = flatOwners(house, mission);
  const k = after.findIndex((o, i) => o === house && before[i] !== house);
  return k >= 0 ? k : before.findIndex((o) => o && o !== house);
}
