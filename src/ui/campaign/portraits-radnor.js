// Radnor, Mentat of House Harkonnen, painted (research.md §4): bald and heavy-set, thick dark brows drawn down over
// deep-set, heavy-lidded eyes that look up at you, a sly one-sided smirk, hands clasped, a dark red-brown robe, seen
// close. A cold, sickly key light from the upper left; the foundry fires of Giedi Prime behind him rim his right side
// in red and light him from below.
import { canvas, rng, P, E, S, soft, inside, grainOver, strands, pick, eye, eyeGlints, lidCurves, capsule, svgDoc } from './portraits-paint.js';

const HEAD = 'M196 64 C252 62 291 98 293 152 C295 186 290 213 284 238 C278 266 268 292 252 312 C238 328 222 336 204 336 C186 336 170 328 156 314 C140 298 128 272 122 242 C114 210 110 180 113 150 C118 96 150 66 196 64Z';
const EAR_L = 'M124 190 C110 180 100 188 101 206 C102 224 108 240 118 250 C124 256 130 252 132 244Z';
const EAR_R = 'M284 196 C292 190 299 196 297 210 C295 224 291 236 283 244Z';
const NECK = 'M140 272 C142 312 138 352 128 394 L288 394 C278 354 274 314 278 270Z';
const ROBE = 'M0 500 L0 440 C20 404 66 382 120 370 C140 366 152 356 160 346 L256 346 C264 356 278 366 300 372 C350 386 386 410 400 440 L400 500Z';
const ROLL_L = 'M84 432 C70 382 78 322 106 282 C116 270 130 268 138 280 C150 312 160 338 176 362 C150 392 120 412 84 432Z';
const ROLL_R = 'M332 434 C346 386 340 324 314 284 C304 270 290 268 282 280 C270 312 258 338 242 362 C268 392 298 414 332 434Z';
const OPENING = 'M168 352 C184 384 198 414 210 444 C222 414 236 384 252 352Z';
const BACK_L = 'M150 500 C152 482 162 458 178 440 C184 433 194 432 198 440 L204 490 C204 494 203 497 201 500Z';
const BACK_R = 'M270 500 C268 482 258 458 242 440 C236 433 226 432 222 440 L216 490 C216 494 217 497 219 500Z';
const SLEEVE_L = 'M92 500 C100 474 122 456 152 450 L172 500Z';
const SLEEVE_R = 'M328 500 C320 474 298 456 268 450 L248 500Z';

const EYE_L = { cx: 178, cy: 199, w: 32, open: 7.4, tilt: 1.2, look: -2.2, lookY: -1.4 };
const EYE_R = { cx: 244, cy: 198, w: 28, open: 7, tilt: -1.4, look: -2.4, lookY: -1.4 };

/** The clasped hands: the left hand's fingers reach right over the right hand and the right's left, alternating. */
const fingers = () => {
  const out = [];
  for (let k = 0; k < 4; k++) {
    const len = [58, 60, 55, 46][k];
    out.push({ side: 'l', k, a: [186, 440 + k * 12], b: [186 + len, 455 + k * 12.5], w: 16 - k * 1.1, bend: -4 });
    out.push({ side: 'r', k, a: [232, 446 + k * 12], b: [232 - len + 2, 461 + k * 12.5], w: 15.5 - k * 1.1, bend: 4 });
  }
  return out.map((f) => ({ ...f, d: capsule(f.a, f.b, f.w, { w1: f.w * 0.82, bend: f.bend }) }));
};
const THUMB_L = capsule([178, 450], [202, 420], 16, { w1: 13.5, bend: -3 });
const THUMB_R = capsule([240, 454], [216, 424], 15, { w1: 13, bend: 3 });

export const RADNOR = {
  house: 'harkonnen', name: 'Radnor', pivot: [210, 360], eyes: [[178, 199, 30, 14], [244, 198, 27, 14]],
  finish: { r: 1.1, mix: 0.65 },
  outlines: { head: [HEAD, EAR_L, EAR_R], body: [ROBE, NECK, ROLL_L, ROLL_R, SLEEVE_L, SLEEVE_R, BACK_L, BACK_R, THUMB_L, THUMB_R] },
  rig: {
    key: { dir: [-0.74, -0.5, 0.45], color: [0.9, 0.98, 0.86], i: 1.7, wrap: 0.08 },
    fill: { dir: [0.3, 0.8, 0.5], color: [0.9, 0.3, 0.12], i: 0.22 },
    rim: { dir: [1, 0.1, -0.1], color: [1, 0.42, 0.14], i: 1.9, power: 2.2 },
    sky: [0.06, 0.055, 0.06], ground: [0.13, 0.045, 0.025], skinAmb: [1.9, 1.15, 0.85],
    sss: [0.45, 0.08, 0.03], ao: { r: 10, k: 0.26 }, shadow: { len: 80, soft: 3, bias: 0.5, blur: 1.6, depth: 0.78 }, spec: { power: 28, i: 0.6 }, exposure: 1,
  },
};

function back(c) {
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
  const sides = c.lin('vigx', [[0, '#fff', 0], [0.12, '#fff', 0.3], [0.26, '#fff', 0.85], [0.36, '#fff'], [0.68, '#fff'], [0.8, '#fff', 0.8], [0.92, '#fff', 0.25], [1, '#fff', 0]]);
  const top = c.lin('vigy', [[0, '#fff', 0], [0.12, '#fff', 0.25], [0.3, '#fff', 0.8], [0.44, '#fff']], [0, 0, 0, 1]);
  const mask = c.def('backmask', (id) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="500"><rect width="400" height="500" fill="${sides}"/></mask>`);
  const maskTop = c.def('backmasktop', (id) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="500"><rect width="400" height="500" fill="${top}"/></mask>`);
  const grate = [];
  for (let k = -5; k <= 5; k++) grate.push(`M${300 + k * 12} 70 V230`);
  for (let k = 0; k < 7; k++) grate.push(`M236 ${82 + k * 22} H364`);
  return `<g mask="${mask}"><g mask="${maskTop}"><g filter="${c.blur(1.6)}">
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
  </g></g>`;
}

// ---- the head ----

const browCol = pick([['#140c08', 4], ['#24160c', 3], ['#3a2618', 1.5]]);
const eyeShape = (e) => { const { top, bottom } = lidCurves(e); return `M${top[0]} C${top[1]} ${top[2]} ${top[3]} C${bottom[1]} ${bottom[2]} ${bottom[3]}Z`; };

function headAlbedo(c, { blink = false } = {}) {
  const headClip = c.clip('head', HEAD);
  const R = rng(17);
  const spots = [];
  for (let i = 0; i < 9; i++) spots.push(E(150 + R() * 100, 78 + R() * 60, 1.5 + R() * 3, 1.2 + R() * 2.4, '#a87a52', `opacity="${(0.25 + R() * 0.3).toFixed(2)}"`));
  const brows = strands(rng(53), { guides: [[[152, 175], [168, 166], [190, 172], [206, 188]], [[153, 179], [169, 171], [190, 177], [205, 191]], [[156, 183], [171, 176], [190, 181], [204, 193]]], count: 150, w: [0.9, 2], color: browCol, jitter: 1, trim: 0.2, shape: 'both' })
    + strands(rng(54), { guides: [[[224, 188], [238, 172], [258, 168], [274, 177]], [[225, 191], [239, 177], [258, 173], [273, 181]], [[226, 194], [240, 181], [257, 178], [271, 184]]], count: 130, w: [0.9, 1.9], color: browCol, jitter: 1, trim: 0.2, shape: 'both' });
  const eyes = `${eye(c, 'l', { ...EYE_L, iris: ['#a0824e', '#5e3e1c', '#3a2410'], irisDark: '#140a04', skin: ['#c69c78', '#b88c6c'], lidShade: 'rgba(80,36,22,.55)', lash: '#1a0c06', heavy: 3, closed: blink, R: rng(43), irisR: 6.4, glints: false })}
    ${eye(c, 'r', { ...EYE_R, iris: ['#94784a', '#523618', '#34200e'], irisDark: '#120804', skin: ['#c49a76', '#b48868'], lidShade: 'rgba(80,36,22,.6)', lash: '#1a0c06', heavy: 3, closed: blink, R: rng(44), irisR: 6, glints: false })}`;
  return `
  ${P(EAR_L, '#cc9672')}
  ${soft(c, 1.5, P('M118 200 C111 198 108 206 110 214 C112 224 116 228 121 226Z', '#8a4a34', 'opacity=".8"'))}
  ${soft(c, 2.5, E(110, 240, 7, 9, '#d06a56', 'opacity=".5"'))}
  ${P(EAR_R, '#c08c6a')}
  <path d="${HEAD}" fill="#d4ac88"/>
  ${inside(headClip, `
    ${soft(c, 18, `${E(196, 116, 70, 46, '#d8b892', 'opacity=".6"')}`)}
    ${spots.join('')}
    ${soft(c, 9, `${E(170, 262, 18, 16, '#d08a72', 'opacity=".4"')}${E(256, 256, 14, 16, '#c88068', 'opacity=".35"')}${E(220, 236, 13, 15, '#d48870', 'opacity=".45"')}`)}
    ${soft(c, 5, `${E(178, 212, 17, 6, '#8a6070', 'opacity=".35"')}${E(244, 211, 15, 6, '#8a6070', 'opacity=".35"')}`)}
    ${soft(c, 10, `${E(212, 300, 50, 26, '#b4987c', 'opacity=".3"')}`)}
    ${soft(c, 0.7, `${E(207, 257, 5, 2.2, '#2a0e08', 'opacity=".9" transform="rotate(14 207 257)"')}${E(232, 256, 4.4, 2, '#2a0e08', 'opacity=".9" transform="rotate(-14 232 256)"')}`)}
    <path d="M190 284 C200 280 210 278 218 279 C226 278 234 276 241 270 C235 279 227 283 217 284.5 C207 285.5 197 285.5 190 284Z" fill="#9a5e4c"/>
    <path d="M193 285 C202 287 212 288 220 287 C228 286 235 281 240 274 C238 285 229 292 216 293.5 C204 294 196 291 193 285Z" fill="#b0705e"/>
    ${soft(c, 0.7, S('M188 284.5 C198 285.5 208 285.5 218 284.5 C227 283.5 235 279 242 269', '#3a140c', 1.8))}
    ${soft(c, 1.2, S('M242 269 C246 266 248 262 247 258', '#5a2416', 1.6), 0.7)}
    ${grainOver(c, headClip, 0.14, 1.3, 15)}
    ${eyes}
    ${brows}
  `)}`;
}

function headMat() {
  const skin = 'rgb(75,70,255)';
  return `<path d="${EAR_L}" fill="${skin}"/><path d="${EAR_R}" fill="${skin}"/><path d="${HEAD}" fill="${skin}"/>
    ${E(185, 108, 70, 50, 'rgb(120,110,255)')}
    <path d="M190 284 C210 277 230 277 242 269 C240 285 230 294 216 294 C204 294 195 291 190 284Z" fill="rgb(120,110,200)"/>
    <path d="${eyeShape(EYE_L)}" fill="rgb(255,255,0)"/><path d="${eyeShape(EYE_R)}" fill="rgb(255,255,0)"/>
    <path d="M150 176 C168 160 192 168 207 190 L203 196 C190 180 170 176 154 186Z M223 190 C238 168 262 162 276 176 L272 186 C258 176 240 180 227 196Z" fill="rgb(10,10,30)"/>`;
}

function headForms({ blink = false } = {}) {
  const L = lidCurves(EYE_L), Rr = lidCurves(EYE_R);
  return [
    { t: 'slab', d: HEAD, h: 10, r: 22, cut: false, op: 'max' },
    { t: 'dome', cx: 190, cy: 182, rx: 98, ry: 122, h: 52, e: 0.5, op: 'max' },
    { t: 'dome', cx: 208, cy: 262, rx: 82, ry: 78, h: 50, e: 0.6, op: 'smax', k: 18 },
    { t: 'slab', d: EAR_L, h: 8, r: 4, base: 10, op: 'max' },
    { t: 'bump', cx: 116, cy: 212, rx: 5, ry: 10, h: 4, op: 'sub' },
    { t: 'slab', d: EAR_R, h: 4, r: 3, base: 14, op: 'max' },
    { t: 'ridge', pts: [[158, 136], [176, 129], [196, 127], [212, 130], [228, 127], [246, 131]], w: 4, h: -1.3, taper: true },
    { t: 'ridge', pts: [[166, 150], [186, 145], [204, 146], [220, 143], [240, 147]], w: 3.6, h: -1.1, taper: true },
    { t: 'ridge', pts: [[184, 162], [200, 159], [214, 161], [230, 158]], w: 3, h: -0.8, taper: true },
    { t: 'ridge', pts: [[206, 168], [208, 180]], w: 2.6, h: -1.4, taper: true },
    { t: 'ridge', pts: [[219, 168], [218, 180]], w: 2.4, h: -1.2, taper: true },
    { t: 'ridge', pts: [[152, 180], [176, 170], [200, 180], [212, 188], [226, 186], [248, 172], [274, 180]], w: 9, h: 6.5 },
    { t: 'bump', cx: 214, cy: 186, rx: 9, ry: 8, h: 2.5 },
    { t: 'bump', cx: 179, cy: 198, rx: 24, ry: 15, h: 12, op: 'sub' },
    { t: 'bump', cx: 244, cy: 197, rx: 21, ry: 15, h: 12, op: 'sub' },
    { t: 'dome', cx: 178, cy: 200, rx: 18, ry: 11, h: 8.5 },
    { t: 'dome', cx: 244, cy: 199, rx: 15.5, ry: 10.5, h: 8 },
    { t: 'ridge', bz: blink ? L.closed : L.top, w: 4.2, h: 2.8 },
    { t: 'ridge', bz: blink ? Rr.closed : Rr.top, w: 4, h: 2.6 },
    { t: 'ridge', bz: L.bottom, w: 2.6, h: 1 },
    { t: 'ridge', bz: Rr.bottom, w: 2.6, h: 0.9 },
    { t: 'ridge', pts: [[160, 212], [178, 218], [196, 213]], w: 4, h: 1.6 },
    { t: 'ridge', pts: [[230, 214], [246, 219], [262, 211]], w: 4, h: 1.5 },
    { t: 'ridge', pts: [[212, 190], [214, 205], [216, 220]], w: 6.5, h: 5 },
    { t: 'ridge', pts: [[215, 214], [217, 230], [220, 242]], w: 10, h: 8 },
    { t: 'bump', cx: 220, cy: 244, rx: 11, ry: 9, h: 6.5 },
    { t: 'bump', cx: 200, cy: 251, rx: 9, ry: 7, h: 5.5 },
    { t: 'bump', cx: 241, cy: 249, rx: 8, ry: 7, h: 4.5 },
    { t: 'bump', cx: 207, cy: 257, rx: 4.6, ry: 2.4, h: 4, op: 'sub' },
    { t: 'bump', cx: 232, cy: 256, rx: 4, ry: 2.2, h: 4, op: 'sub' },
    { t: 'bump', cx: 160, cy: 228, rx: 22, ry: 15, h: 6, rot: -15 },
    { t: 'bump', cx: 262, cy: 222, rx: 14, ry: 15, h: 4 },
    { t: 'bump', cx: 216, cy: 280, rx: 34, ry: 24, h: 6 },
    { t: 'ridge', pts: [[197, 256], [189, 270], [183, 286], [181, 302]], w: 6.5, h: -2.2, taper: true },
    { t: 'ridge', pts: [[242, 254], [251, 266], [255, 278], [254, 292]], w: 6.5, h: -2.2, taper: true },
    { t: 'bump', cx: 172, cy: 286, rx: 16, ry: 22, h: 5 },
    { t: 'bump', cx: 262, cy: 280, rx: 12, ry: 20, h: 4 },
    { t: 'bump', cx: 158, cy: 300, rx: 16, ry: 20, h: 5 },
    { t: 'bump', cx: 266, cy: 296, rx: 12, ry: 18, h: 4 },
    { t: 'ridge', pts: [[193, 282], [208, 279.5], [222, 279], [240, 272]], w: 2.6, h: 1.6 },
    { t: 'bump', cx: 216, cy: 289, rx: 17, ry: 4.5, h: 3 },
    { t: 'ridge', pts: [[188, 284.5], [203, 285.5], [218, 284.5], [230, 281], [242, 269]], w: 1.5, h: -2.4 },
    { t: 'bump', cx: 244, cy: 270, rx: 4, ry: 6, h: 2, op: 'sub' },
    { t: 'bump', cx: 214, cy: 300, rx: 16, ry: 4, h: 2.5, op: 'sub' },
    { t: 'bump', cx: 212, cy: 316, rx: 22, ry: 14, h: 7 },
    { t: 'ridge', pts: [[150, 262], [168, 300], [190, 324], [214, 334], [240, 324], [262, 300]], w: 7, h: 2.5 },
    { t: 'bump', cx: 128, cy: 172, rx: 14, ry: 26, h: 3, op: 'sub' },
  ];
}

function headOverlay(c) {
  const g = (e, rI) => eyeGlints({ ix: e.cx + e.look, iy: e.cy + e.lookY + e.open * 0.05, rI });
  return `${soft(c, 0.3, g(EYE_L, 6.4) + g(EYE_R, 6))}`;
}

// ---- the body ----

function handAlbedo(c) {
  const F = fingers();
  const finger = (f) => {
    const [ax, ay] = f.a, [bx, by] = f.b, dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len, nx = -uy * Math.sign(dx), ny = ux * Math.sign(dx);
    const at = (t, o = 0) => [ax + dx * t + nx * o, ay + dy * t + ny * o];
    const crease = (t) => { const [x0, y0] = at(t, -f.w * 0.28), [x1, y1] = at(t + 0.02, f.w * 0.05); return `M${x0.toFixed(1)} ${y0.toFixed(1)}Q${(x0 + x1) / 2 + ux * 1.5} ${(y0 + y1) / 2 + uy * 1.5} ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    const [nx0, ny0] = at(1 - 5.5 / len, -f.w * 0.06);
    const rot = (Math.atan2(dy, dx) * 180) / Math.PI;
    return `${P(f.d, f.side === 'l' ? '#c4916c' : '#b88664')}
      ${soft(c, 1.1, S(`M${at(0.05, f.w * 0.42).map((v) => v.toFixed(1)).join(' ')}L${at(0.95, f.w * 0.36).map((v) => v.toFixed(1)).join(' ')}`, '#5a3020', 2.2), 0.55)}
      ${soft(c, 0.6, S(crease(0.4) + crease(0.68), '#7a4630', 0.9), 0.5)}
      ${soft(c, 0.5, E(nx0, ny0, 4.6, f.w * 0.24, '#d49a88', `opacity=".75" transform="rotate(${rot.toFixed(1)} ${nx0.toFixed(1)} ${ny0.toFixed(1)})"`))}`;
  };
  const order = [];
  for (let k = 0; k < 4; k++) order.push(F.find((f) => f.side === 'r' && f.k === k), F.find((f) => f.side === 'l' && f.k === k));
  return `${P(SLEEVE_L, '#3e160e')}${P(SLEEVE_R, '#36120a')}${S('M152 450 L172 500 M268 450 L248 500', '#9a6a32', 2)}
    ${P(BACK_L, '#c4946e')}${P(BACK_R, '#b88a66')}
    ${order.map(finger).join('')}
    ${P(THUMB_R, '#bd8e6c')}${P(THUMB_L, '#c99a74')}
    ${soft(c, 0.5, `${E(217, 428, 4.2, 3.2, '#d49a88', 'opacity=".75" transform="rotate(-50 217 428)"')}${E(201, 424.5, 4.4, 3.4, '#d49a88', 'opacity=".75" transform="rotate(-130 201 424.5)"')}`)}`;
}

function bodyAlbedo(c) {
  const robeClip = c.clip('robe', ROBE);
  return `
  <path d="${NECK}" fill="#c89c78"/>
  ${inside(c.clip('neck', NECK), `${soft(c, 8, E(210, 344, 40, 10, '#a87c60', 'opacity=".5"'))}${grainOver(c, c.clip('neck', NECK), 0.1, 1.1, 8)}`)}
  <path d="${ROBE}" fill="#4e1c12"/>
  ${inside(robeClip, `${soft(c, 22, `${E(80, 430, 80, 40, '#62261a', 'opacity=".6"')}${E(340, 480, 90, 50, '#2e0c06', 'opacity=".6"')}`)}
    ${grainOver(c, robeClip, 0.24, 0.75, 4)}
    <g clip-path="${robeClip}" style="mix-blend-mode:overlay" opacity=".14"><rect width="400" height="500" filter="${c.streaks(0.008, 0.45, 9)}" transform="rotate(-70 200 430)"/></g>`)}
  <path d="${OPENING}" fill="#140504"/>
  ${S('M168 352 C184 384 198 414 210 444 C222 414 236 384 252 352', '#9a6a32', 2.4)}
  <path d="${ROLL_L}" fill="#44160e"/><path d="${ROLL_R}" fill="#3e140c"/>
  ${inside(c.clip('rolll', ROLL_L), grainOver(c, c.clip('rolll', ROLL_L), 0.2, 0.9, 6))}
  ${inside(c.clip('rollr', ROLL_R), grainOver(c, c.clip('rollr', ROLL_R), 0.2, 0.9, 7))}
  ${handAlbedo(c)}`;
}

function bodyMat() {
  const skin = 'rgb(60,60,255)', cloth = 'rgb(30,25,0)';
  return `<path d="${NECK}" fill="${skin}"/><path d="${ROBE}" fill="${cloth}"/><path d="${OPENING}" fill="${cloth}"/>
    ${S('M168 352 C184 384 198 414 210 444 C222 414 236 384 252 352', 'rgb(240,150,0)', 2.4)}
    <path d="${ROLL_L}" fill="rgb(18,12,0)"/><path d="${ROLL_R}" fill="rgb(18,12,0)"/><path d="${SLEEVE_L}" fill="${cloth}"/><path d="${SLEEVE_R}" fill="${cloth}"/>
    <path d="${BACK_L}" fill="${skin}"/><path d="${BACK_R}" fill="${skin}"/>
    ${fingers().map((f) => `<path d="${f.d}" fill="${skin}"/>`).join('')}<path d="${THUMB_L}" fill="${skin}"/><path d="${THUMB_R}" fill="${skin}"/>`;
}

function bodyForms() {
  const F = fingers();
  const order = [];
  for (let k = 0; k < 4; k++) order.push(F.find((f) => f.side === 'r' && f.k === k), F.find((f) => f.side === 'l' && f.k === k));
  return [
    { t: 'slab', d: ROBE, h: 36, r: 32, op: 'max' },
    { t: 'bump', cx: 210, cy: 450, rx: 170, ry: 110, h: 5 },
    { t: 'bump', cx: 60, cy: 420, rx: 70, ry: 40, h: 8 },
    { t: 'bump', cx: 352, cy: 420, rx: 60, ry: 40, h: 8 },
    { t: 'ridge', bz: [[150, 380], [136, 420], [120, 460], [110, 500]], w: 8, h: -4.5 },
    { t: 'ridge', bz: [[270, 382], [286, 420], [300, 460], [306, 500]], w: 7, h: -4 },
    { t: 'ridge', bz: [[118, 392], [104, 432], [90, 470], [80, 500]], w: 8, h: 4 },
    { t: 'ridge', bz: [[300, 392], [316, 430], [330, 468], [338, 500]], w: 8, h: 3.5 },
    { t: 'slab', d: OPENING, h: 2, r: 2, base: 24, op: 'max' },
    { t: 'slab', d: NECK, h: 28, r: 20, base: 10, op: 'max' },
    { t: 'bump', cx: 210, cy: 350, rx: 34, ry: 10, h: 3 },
    { t: 'slab', d: ROLL_L, h: 7, r: 8, base: 32, op: 'max' },
    { t: 'slab', d: ROLL_R, h: 7, r: 8, base: 32, op: 'max' },
    { t: 'ridge', bz: [[110, 400], [104, 360], [110, 320], [124, 292]], w: 4, h: -1.2 },
    { t: 'ridge', bz: [[306, 402], [312, 362], [306, 322], [292, 294]], w: 4, h: -1.2 },
    { t: 'slab', d: SLEEVE_L, h: 8, r: 8, base: 48, op: 'max' },
    { t: 'slab', d: SLEEVE_R, h: 8, r: 8, base: 48, op: 'max' },
    { t: 'ridge', bz: [[96, 420], [86, 370], [92, 316], [112, 284]], w: 5, h: -1.5 },
    { t: 'ridge', bz: [[320, 420], [330, 372], [326, 318], [306, 286]], w: 5, h: -1.5 },
    { t: 'slab', d: BACK_L, h: 9, r: 9, base: 56, op: 'max' },
    { t: 'slab', d: BACK_R, h: 9, r: 9, base: 56, op: 'max' },
    ...order.map((f, n) => ({ t: 'slab', d: f.d, h: 7, r: f.w * 0.5, base: 62 + n * 0.4, op: 'max' })),
    { t: 'slab', d: THUMB_R, h: 7, r: 6.5, base: 68, op: 'max' },
    { t: 'slab', d: THUMB_L, h: 7, r: 7, base: 69, op: 'max' },
    { t: 'noise', mask: `${ROBE} ${ROLL_L} ${ROLL_R} ${SLEEVE_L} ${SLEEVE_R}`, h: 0.45, cell: 1.9, stretch: [0.5, 1.8], seed: 7 },
  ];
}

function lidsMaskDoc(c) {
  return `<g filter="${c.blur(2.5)}">${RADNOR.eyes.map(([x, y, rx, ry]) => E(x, y - 2, rx, ry, '#fff')).join('')}</g>`;
}

/** One layer of the painting for the lit bake: its colour (albedo), material and overlay as SVG, and its forms. */
export function radnorLayer(layer, { blink = false } = {}) {
  if (layer === 'head') {
    const a = canvas('radnor-ha'), m = canvas('radnor-hm'), o = canvas('radnor-ho');
    return { albedo: svgDoc(a, headAlbedo(a, { blink })), mat: svgDoc(m, headMat()), overlay: blink ? null : svgDoc(o, headOverlay(o)), forms: headForms({ blink }) };
  }
  const a = canvas('radnor-ba'), m = canvas('radnor-bm');
  return { albedo: svgDoc(a, bodyAlbedo(a)), mat: svgDoc(m, bodyMat()), overlay: null, forms: bodyForms() };
}

/** The painted (unlit) parts as SVG documents: the foundry hall behind him, and the mask of the blink. */
export function paintRadnor(part) {
  const c = canvas(`radnor-${part}`);
  return svgDoc(c, part === 'back' ? back(c) : lidsMaskDoc(c));
}
