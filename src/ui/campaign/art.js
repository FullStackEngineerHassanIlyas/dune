// The flat map of Arrakis, our own SVG (a markup string for innerHTML), drawn when the 3D territory map
// (src/render/atlas) is missing or fails: one cell per region, each in its owner's colour, the player's land growing
// from its corner mission by mission. (The pictures of the screens after a mission are rendered from the game's own
// models: src/ui/campaign/results-render.js, assets/campaign/results/.)
import { HOUSES } from '../../data/houses.js';

const hex = (id) => `#${(HOUSES[id]?.color ?? 0xa8834a).toString(16).padStart(6, '0')}`;

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
