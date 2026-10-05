// The three Mentats' chambers, painted in SVG behind them (soft-focus, as if far behind a sharp figure): Caladan's
// stone hall with an arched window on the sea and a warm lamp (Atreides), a Giedi Prime foundry with a furnace
// grate, iron pillars and embers (Harkonnen), the Ordos ice hall with frosted pillars and a cold light (Ordos). Baked
// to <house>-back.webp by assets/campaign/portraits/bake.mjs. Our own drawing.
import { canvas, rng, E, soft, svgDoc } from './portraits-paint.js';

/** The chamber melts into the stage: an ellipse round the figure, fading out well before the frame's edges. */
const vignette = (c) => c.rad('vig', [[0, '#fff'], [0.5, '#fff'], [0.72, '#fff', 0.6], [0.88, '#fff', 0.16], [1, '#fff', 0]], { cx: 0.5, cy: 0.6, r: 0.6 });

function caladan(c) {
  const R = rng(11);
  const stones = [];
  for (let y = 18; y < 500; y += 34) stones.push(`M0 ${y}H240`);
  for (let y = 18, k = 0; y < 500; y += 34, k++) for (let x = (k % 2) * 40; x < 240; x += 80) stones.push(`M${x} ${y}V${y + 34}`);
  const sparkles = [];
  for (let i = 0; i < 40; i++) {
    const x = 250 + R() * 140, y = 302 + R() * 50;
    sparkles.push(`M${x.toFixed(1)} ${y.toFixed(1)}h${(2 + R() * 6).toFixed(1)}`);
  }
  const sky = c.lin('sky', [[0, '#21587e'], [0.45, '#5aa6c2'], [0.8, '#a6dcd6'], [1, '#d8f0e2']], [0, 50, 0, 300], true);
  const sea = c.lin('sea', [[0, '#3b97a2'], [0.3, '#1f6c7e'], [1, '#0d3444']], [0, 300, 0, 390], true);
  const wall = c.lin('wall', [[0, '#14262c'], [0.55, '#0c1a20'], [1, '#060c10']], [0, 0, 0, 1]);
  const column = c.lin('column', [[0, '#3a2a1c'], [0.35, '#6b4a2c'], [0.6, '#2a2018'], [1, '#0c0d0e']]);
  const sides = vignette(c);
  const top = c.lin('vigy', [[0, '#fff', 0], [0.12, '#fff', 0.25], [0.3, '#fff', 0.8], [0.44, '#fff']], [0, 0, 0, 1]);
  const mask = c.def('backmask', (id) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="500"><rect width="400" height="500" fill="${sides}"/></mask>`);
  const maskTop = c.def('backmasktop', (id) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="500"><rect width="400" height="500" fill="${top}"/></mask>`);
  const lift = c.def('lift', (id) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="500" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="1.38" intercept=".012"/><feFuncG type="linear" slope="1.38" intercept=".012"/><feFuncB type="linear" slope="1.38" intercept=".012"/></feComponentTransfer></filter>`);
  return `<g mask="${mask}"><g mask="${maskTop}"><g filter="${lift}"><g filter="${c.blur(1.6)}">
    <rect width="400" height="500" fill="${wall}"/>
    <path d="${stones.join('')}" stroke="#03080a" stroke-width="2" opacity=".55"/>
    <path d="${stones.join('')}" stroke="#2d4a50" stroke-width="1" opacity=".25" transform="translate(1.5 1.5)"/>
    ${soft(c, 40, E(316, 220, 150, 200, '#2f8a9a', 'opacity=".35"'))}
    <path d="M226 400 L226 150 C226 86 270 42 318 42 C366 42 410 86 410 150 L410 400Z" fill="#081216"/>
    <path d="M238 396 L238 154 C238 98 276 58 318 58 C360 58 398 98 398 154 L398 396Z" fill="${sky}"/>
    <path d="M238 300 H398 V396 H238Z" fill="${sea}"/>
    ${soft(c, 6, `${E(300, 150, 46, 12, '#e6f6f0', 'opacity=".55"')}${E(352, 118, 38, 9, '#f2fbf6', 'opacity=".45"')}${E(276, 214, 40, 8, '#eaf8f0', 'opacity=".4"')}${E(360, 250, 50, 10, '#f6fff8', 'opacity=".35"')}`)}
    ${soft(c, 3, E(332, 296, 70, 6, '#fffbe8', 'opacity=".7"'))}
    <path d="${sparkles.join('')}" stroke="#e8fff8" stroke-width="1.2" opacity=".55" stroke-linecap="round"/>
    <path d="M314 58 V396 M238 206 H398 M238 300 H398" stroke="#071014" stroke-width="7"/>
    <path d="M318 46 V396" stroke="#0a1418" stroke-width="5"/>
    <path d="M238 396 L238 154 C238 98 276 58 318 58 C360 58 398 98 398 154 L398 396" fill="none" stroke="#38606a" stroke-width="3" opacity=".7"/>
    <path d="M208 410 H420 V432 H208Z" fill="#0d1a1e"/><path d="M208 410 H420" stroke="#4a7c84" stroke-width="2" opacity=".6"/>
    ${soft(c, 18, '<path d="M244 140 L398 140 L250 500 L40 500Z" fill="#a9ecf0"/>', 0.07)}
    <rect x="14" y="0" width="64" height="500" fill="${column}"/>
    <path d="M26 0V500M40 0V500M54 0V500M66 0V500" stroke="#0a0806" stroke-width="2.5" opacity=".6"/>
    <path d="M27.5 0V500M41.5 0V500M55.5 0V500" stroke="#c48a4a" stroke-width="1" opacity=".35"/>
    <path d="M6 60 H86 V76 H6Z M6 420 H86 V440 H6Z" fill="#1a130c"/>
    ${soft(c, 26, E(60, 236, 70, 90, '#ff8a2a', 'opacity=".28"'))}
    <path d="M52 244 C52 236 66 232 74 238 L70 252 C64 256 56 254 52 244Z" fill="#3a2614"/>
    ${soft(c, 2.5, E(64, 226, 5, 10, '#ffe2a0'))}${soft(c, 7, E(64, 226, 14, 22, '#ffb050', 'opacity=".55"'))}
    ${soft(c, 40, E(200, 340, 230, 210, '#0e2a32', 'opacity=".55"'))}
  </g>
  ${soft(c, 34, E(206, 330, 140, 200, '#000', 'opacity=".42"'))}
  </g></g></g>`;
}

function giediPrime(c) {
  const R = rng(13);
  const embers = [];
  for (let i = 0; i < 70; i++) {
    const x = R() * 400, y = 120 + R() * 380, r = 0.6 + R() * 1.8;
    embers.push(E(x, y, r, r * (1 + R()), R() < 0.3 ? '#ffd27a' : '#ff6a2a', `opacity="${(0.35 + R() * 0.6).toFixed(2)}"`));
  }
  const rivets = [];
  for (let y = 30; y < 500; y += 26) rivets.push(E(32, y, 2.2, 2.2, '#6a2a1a'), E(56, y + 13, 2.2, 2.2, '#6a2a1a'), E(352, y, 2.2, 2.2, '#8a3a20'), E(376, y + 13, 2.2, 2.2, '#8a3a20'));
  const wall = c.lin('wall', [[0, '#1c0a08'], [0.6, '#120504'], [1, '#050101']], [0, 0, 0, 1]);
  const furnace = c.rad('furnace', [[0, '#ffd27a'], [0.25, '#ff7a2a'], [0.6, '#b0200e', 0.7], [1, '#3a0404', 0]], { cx: 0.5, cy: 0.5, r: 0.5 });
  const sides = vignette(c);
  const top = c.lin('vigy', [[0, '#fff', 0], [0.12, '#fff', 0.25], [0.3, '#fff', 0.8], [0.44, '#fff']], [0, 0, 0, 1]);
  const mask = c.def('backmask', (id) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="500"><rect width="400" height="500" fill="${sides}"/></mask>`);
  const maskTop = c.def('backmasktop', (id) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="500"><rect width="400" height="500" fill="${top}"/></mask>`);
  const grate = [];
  for (let k = -5; k <= 5; k++) grate.push(`M${300 + k * 12} 70 V230`);
  for (let k = 0; k < 7; k++) grate.push(`M236 ${82 + k * 22} H364`);
  const lift = c.def('lift', (id) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="500" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="1.38" intercept=".012"/><feFuncG type="linear" slope="1.38" intercept=".012"/><feFuncB type="linear" slope="1.38" intercept=".012"/></feComponentTransfer></filter>`);
  return `<g mask="${mask}"><g mask="${maskTop}"><g filter="${lift}"><g filter="${c.blur(1.6)}">
    <rect width="400" height="500" fill="${wall}"/>
    ${soft(c, 50, E(300, 420, 220, 170, '#c02a10', 'opacity=".45"'))}
    ${soft(c, 30, E(300, 150, 90, 90, '#a8200c', 'opacity=".5"'))}
    <circle cx="300" cy="150" r="86" fill="#140504"/>
    <circle cx="300" cy="150" r="72" fill="${furnace}" opacity=".85"/>
    <g clip-path="${c.clip('grate', 'M300 78 A72 72 0 1 1 299.9 78Z')}"><path d="${grate.join('')}" stroke="#120302" stroke-width="5"/></g>
    <circle cx="300" cy="150" r="78" fill="none" stroke="#3a120a" stroke-width="12"/>
    <circle cx="300" cy="150" r="84" fill="none" stroke="#ff7a3a" stroke-width="1.5" opacity=".35"/>
    <path d="M160 0 L182 0 L120 500 L98 500Z M232 0 L246 0 L270 500 L256 500Z" fill="#0c0302" opacity=".9"/>
    <rect x="18" y="0" width="52" height="500" fill="#100403"/>
    <path d="M70 0 V500" stroke="#7a2412" stroke-width="2" opacity=".5"/>
    <rect x="336" y="0" width="52" height="500" fill="#140504"/>
    <path d="M336 0 V500" stroke="#ff6a2a" stroke-width="2.5" opacity=".55"/>
    ${rivets.join('')}
    <path d="M70 60 L336 110 M70 74 L336 124" stroke="#0a0202" stroke-width="7"/>
    <path d="M70 60 L336 110" stroke="#ff5a20" stroke-width="1" opacity=".3"/>
    ${soft(c, 30, '<path d="M0 500 L0 380 C100 340 300 330 400 360 L400 500Z" fill="#ff4a1a" opacity=".22"/>')}
    ${soft(c, 1.2, embers.join(''))}
    ${soft(c, 40, E(200, 300, 220, 200, '#2a0604', 'opacity=".45"'))}
  </g>
  ${soft(c, 34, E(206, 320, 150, 210, '#000', 'opacity=".45"'))}
  </g></g></g>`;
}

function ordosHall(c) {
  const R = rng(19);
  const snow = [];
  for (let i = 0; i < 90; i++) {
    const x = R() * 400, y = R() * 500, r = 0.5 + R() * 1.6;
    snow.push(E(x, y, r, r, '#f4fbff', `opacity="${(0.25 + R() * 0.55).toFixed(2)}"`));
  }
  const frost = [];
  for (let i = 0; i < 60; i++) {
    const x = (R() < 0.5 ? 20 + R() * 60 : 300 + R() * 70), y = R() * 500;
    frost.push(`M${x.toFixed(1)} ${y.toFixed(1)}l${((R() - 0.5) * 6).toFixed(1)} ${(8 + R() * 30).toFixed(1)}`);
  }
  const wall = c.lin('wall', [[0, '#1c3442'], [0.5, '#122430'], [1, '#08121a']], [0, 0, 0, 1]);
  const ice = c.lin('ice', [[0, '#9fd0e0'], [0.35, '#e8f8ff'], [0.6, '#7fb0c6'], [1, '#2a5468']]);
  const light = c.rad('coldlight', [[0, '#f4fcff'], [0.4, '#bfe6f4', 0.8], [1, '#5a9ab4', 0]], { cx: 0.5, cy: 0.5, r: 0.5 });
  const sides = vignette(c);
  const top = c.lin('vigy', [[0, '#fff', 0], [0.12, '#fff', 0.25], [0.3, '#fff', 0.8], [0.44, '#fff']], [0, 0, 0, 1]);
  const mask = c.def('backmask', (id) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="500"><rect width="400" height="500" fill="${sides}"/></mask>`);
  const maskTop = c.def('backmasktop', (id) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="500"><rect width="400" height="500" fill="${top}"/></mask>`);
  const lift = c.def('lift', (id) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="500" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="1.38" intercept=".012"/><feFuncG type="linear" slope="1.38" intercept=".012"/><feFuncB type="linear" slope="1.38" intercept=".012"/></feComponentTransfer></filter>`);
  return `<g mask="${mask}"><g mask="${maskTop}"><g filter="${lift}"><g filter="${c.blur(1.6)}">
    <rect width="400" height="500" fill="${wall}"/>
    ${soft(c, 40, E(210, 160, 170, 150, '#4a8aa4', 'opacity=".4"'))}
    <path d="M110 420 L110 170 C110 96 156 50 210 50 C264 50 310 96 310 170 L310 420Z" fill="#0c1a22"/>
    <path d="M124 420 L124 176 C124 108 162 66 210 66 C258 66 296 108 296 176 L296 420Z" fill="${light}"/>
    ${soft(c, 10, '<path d="M150 420 L170 200 L196 420Z M226 420 L250 190 L270 420Z" fill="#e8f8ff" opacity=".35"/>')}
    <rect x="16" y="0" width="70" height="500" fill="${ice}" opacity=".8"/>
    <rect x="318" y="0" width="66" height="500" fill="${ice}" opacity=".7"/>
    <path d="${frost.join('')}" stroke="#ffffff" stroke-width="1.4" opacity=".45" stroke-linecap="round"/>
    <path d="M16 0V500M86 0V500M318 0V500M384 0V500" stroke="#0e2430" stroke-width="3" opacity=".7"/>
    <path d="M6 70 H96 V86 H6Z M308 70 H394 V86 H308Z" fill="#0e1c26"/>
    ${soft(c, 18, '<path d="M150 120 L270 120 L340 500 L60 500Z" fill="#dff6ff"/>', 0.06)}
    ${soft(c, 1, snow.join(''))}
    ${soft(c, 40, E(200, 330, 220, 200, '#0c1c26', 'opacity=".5"'))}
  </g>
  ${soft(c, 34, E(206, 320, 150, 210, '#000', 'opacity=".42"'))}
  </g></g></g>`;
}

const CHAMBERS = { atreides: caladan, harkonnen: giediPrime, ordos: ordosHall };

/** The chamber behind a house's Mentat, as an SVG document of the portrait's size. */
export function chamber(house) {
  const c = canvas(`${house}-back`);
  return svgDoc(c, CHAMBERS[house](c));
}
