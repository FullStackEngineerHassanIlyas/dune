// Ammon, Mentat of House Ordos, painted (research.md §4): slim, a narrow face with high cheekbones, swept-back
// dark-brown hair tied at the nape, a dark green robe over a teal collar, a sash across the chest, a pendant, a hand at
// his chest with a ring; mercantile and cold: one brow raised, a closed, satisfied smile. A cold white key light
// from the upper left; the ice of the Ordos hall behind him rims his right side in pale cyan.
import { canvas, rng, P, E, S, soft, inside, grainOver, strands, locks, pick, eye, eyeGlints, lidCurves, capsule, svgDoc } from './portraits-paint.js';

const FACE = 'M156 128 C148 146 146 166 148 186 C150 208 154 230 162 250 C170 272 184 290 200 300 C206 304 214 305 220 302 C232 294 244 276 252 256 C258 236 262 212 262 190 C263 166 260 142 252 124 C236 110 196 106 172 112 C164 116 158 121 156 128Z';
const HAIR = 'M156 134 C146 120 138 104 138 88 C140 70 160 60 186 57 C214 54 240 58 256 70 C268 80 274 94 272 110 C270 122 266 130 260 136 C252 120 236 112 214 110 C192 108 172 112 162 120 C159 124 157 129 156 134Z';
const HAIR_BACK = 'M156 112 C138 104 126 118 124 146 C122 176 124 204 130 228 C134 240 142 246 150 242 C148 226 146 208 146 190 C146 164 150 142 158 124Z';
const EAR = 'M156 180 C145 170 133 174 132 190 C131 206 137 220 146 228 C151 232 156 229 158 223Z';
const NECK = 'M178 252 C180 284 178 314 172 350 L242 350 C238 314 236 286 240 254Z';
const ROBE = 'M0 500 L0 446 C22 410 66 388 120 376 C142 370 156 358 164 346 L252 346 C260 358 276 370 300 376 C352 388 386 412 400 446 L400 500Z';
const LAPEL_L = 'M146 350 C158 378 178 400 204 422 L212 406 C196 386 182 368 170 348Z';
const LAPEL_R = 'M270 350 C258 378 240 400 220 422 L212 406 C228 386 240 368 248 348Z';
const TEAL = 'M164 354 C162 332 166 312 174 298 C194 307 222 307 242 298 C250 312 254 332 252 354 C232 346 186 346 164 354Z';
const SASH = 'M88 388 L124 374 L322 500 L280 500Z';
const DIAMOND = 'M212 384 L227 405 L212 428 L197 405Z';
const GEM = 'M212 391 L221 405 L212 420 L203 405Z';
const SLEEVE = 'M80 500 C90 470 114 452 146 446 L166 498 L158 500Z';
const HAND = 'M146 472 C152 452 172 430 202 414 C210 412 218 416 222 424 L228 452 C206 472 184 488 164 498 C152 494 146 484 146 472Z';

const EYE_L = { cx: 182, cy: 181, w: 29, open: 7.2, tilt: 0.8, look: -1.6, lookY: 0 };
const EYE_R = { cx: 240, cy: 180, w: 25, open: 6.8, tilt: -0.9, look: -1.8, lookY: 0 };

/** The hand laid on his chest: four fingers from the knuckles toward his heart, side by side. */
const curled = () => [[206, 420, 246, 396, 12.4], [212, 431, 256, 405, 12.8], [218, 442, 256, 420, 12], [223, 452, 252, 436, 10.4]].map(([ax, ay, bx, by, w], k) => {
  const a = [ax, ay], b = [bx, by];
  return { k, a, b, d: capsule(a, b, w, { w1: w * 0.84, bend: -2.5 }) };
});
const THUMB = capsule([172, 440], [190, 404], 14, { w1: 11.5, bend: 3 });

export const AMMON = {
  house: 'ordos', name: 'Ammon', pivot: [208, 330], eyes: [[182, 181, 28, 13], [240, 180, 25, 13]],
  finish: { r: 1.1, mix: 0.65 },
  outlines: { head: [FACE, HAIR, HAIR_BACK, EAR], body: [ROBE, NECK, LAPEL_L, LAPEL_R, TEAL, SASH, SLEEVE, HAND, THUMB] },
  rig: {
    key: { dir: [-0.74, -0.48, 0.48], color: [0.92, 0.96, 1], i: 1.75, wrap: 0.1 },
    fill: { dir: [0.6, 0.2, 0.78], color: [0.4, 0.7, 0.62], i: 0.14 },
    rim: { dir: [1, -0.25, -0.1], color: [0.62, 0.95, 1], i: 1.6, power: 2.3 },
    sky: [0.09, 0.12, 0.15], ground: [0.04, 0.06, 0.06], skinAmb: [2.2, 1.25, 0.82],
    sss: [0.34, 0.07, 0.03], ao: { r: 9, k: 0.22 }, shadow: { len: 70, soft: 3, bias: 0.5, blur: 1.6, depth: 0.74 }, spec: { power: 34, i: 0.55 }, exposure: 1,
  },
};

function back(c) {
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
  const sides = c.lin('vigx', [[0, '#fff', 0], [0.12, '#fff', 0.3], [0.26, '#fff', 0.85], [0.36, '#fff'], [0.68, '#fff'], [0.8, '#fff', 0.8], [0.92, '#fff', 0.25], [1, '#fff', 0]]);
  const top = c.lin('vigy', [[0, '#fff', 0], [0.12, '#fff', 0.25], [0.3, '#fff', 0.8], [0.44, '#fff']], [0, 0, 0, 1]);
  const mask = c.def('backmask', (id) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="500"><rect width="400" height="500" fill="${sides}"/></mask>`);
  const maskTop = c.def('backmasktop', (id) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="500"><rect width="400" height="500" fill="${top}"/></mask>`);
  return `<g mask="${mask}"><g mask="${maskTop}"><g filter="${c.blur(1.6)}">
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
  </g></g>`;
}

// ---- the head ----

const hairGuides = {
  front: [
    [[260, 138], [274, 112], [256, 72], [204, 62]],
    [[246, 120], [258, 92], [232, 66], [180, 64]],
    [[228, 112], [238, 86], [206, 66], [160, 74]],
    [[208, 110], [214, 86], [182, 70], [146, 90]],
    [[188, 111], [190, 92], [164, 80], [138, 108]],
    [[170, 116], [168, 100], [148, 92], [134, 126]],
    [[158, 130], [152, 114], [140, 108], [132, 146]],
  ],
  back: [
    [[180, 60], [150, 64], [132, 98], [130, 150]],
    [[156, 72], [136, 98], [128, 160], [134, 226]],
    [[146, 104], [132, 146], [132, 206], [140, 242]],
    [[156, 122], [148, 162], [148, 214], [150, 244]],
  ],
};
const brown = pick([['#3e2716', 3], ['#4e3220', 4], ['#5e3e26', 3], ['#6e4a2e', 1.5]]);
const brownDark = pick([['#1e120a', 3], ['#2a1a0e', 4], ['#342012', 2]]);
const brownLight = pick([['#8a6440', 3], ['#a07a52', 2], ['#7a5636', 2]]);
const browCol = pick([['#2a1a0e', 3], ['#3a2616', 2], ['#1e120a', 2]]);
const hairLocks = () => ({
  front: locks(rng(91), { guides: hairGuides.front, count: 50, w: [6, 12], body: brown, dark: brownDark, light: brownLight, jitter: 2 }),
  back: locks(rng(92), { guides: hairGuides.back, count: 22, w: [6, 11], body: brown, dark: brownDark, light: brownLight, jitter: 2.5 }),
});
const eyeShape = (e) => { const { top, bottom } = lidCurves(e); return `M${top[0]} C${top[1]} ${top[2]} ${top[3]} C${bottom[1]} ${bottom[2]} ${bottom[3]}Z`; };

function headAlbedo(c, { blink = false } = {}) {
  const faceClip = c.clip('face', FACE);
  const backClip = c.clip('hairback', HAIR_BACK);
  const lk = hairLocks();
  const brows = strands(rng(55), { guides: [[[162, 166], [172, 158], [188, 156], [202, 162]], [[164, 168], [174, 161], [189, 159], [202, 165]], [[167, 170], [176, 164], [189, 162], [201, 167]]], count: 80, w: [0.7, 1.4], color: browCol, jitter: 0.7, trim: 0.25, shape: 'both' })
    + strands(rng(56), { guides: [[[224, 160], [234, 150], [250, 149], [262, 156]], [[224, 163], [235, 153], [250, 152], [261, 159]], [[225, 165], [236, 156], [249, 155], [260, 161]]], count: 70, w: [0.7, 1.3], color: browCol, jitter: 0.7, trim: 0.25, shape: 'both' });
  const eyes = `${eye(c, 'l', { ...EYE_L, iris: ['#b8c8a0', '#6a8058', '#3e5236'], irisDark: '#1a2414', skin: ['#d2a27e', '#c49272'], lidShade: 'rgba(90,44,28,.5)', heavy: 1.5, closed: blink, R: rng(45), glints: false })}
    ${eye(c, 'r', { ...EYE_R, iris: ['#acc096', '#5e7650', '#36482e'], irisDark: '#18200f', skin: ['#cc9c78', '#be8e6e'], lidShade: 'rgba(90,44,28,.55)', heavy: 1.5, closed: blink, R: rng(46), glints: false })}`;
  return `
  <path d="${HAIR_BACK}" fill="#3a2414"/>
  ${inside(backClip, `${lk.back.bodies}${soft(c, 1, lk.back.darks, 0.7)}
    ${strands(rng(66), { guides: hairGuides.back, count: 110, w: [0.5, 1.1], color: brownLight, jitter: 3, opacity: [0.2, 0.5] })}`)}
  <path d="${EAR}" fill="#cc9a76"/>
  ${soft(c, 1.5, '<path d="M151 192 C145 190 140 196 142 204 C144 211 148 215 153 213Z" fill="#94584a" opacity=".8"/>')}
  ${soft(c, 2, E(143, 220, 6, 8, '#d0806a', 'opacity=".45"'))}
  <path d="${FACE}" fill="#d4a47e"/>
  ${inside(faceClip, `
    ${soft(c, 10, `${E(204, 132, 38, 20, '#dab08a', 'opacity=".6"')}${E(172, 214, 14, 10, '#d48a70', 'opacity=".3"')}${E(252, 212, 9, 11, '#cc8068', 'opacity=".3"')}${E(220, 214, 7, 12, '#d88c72', 'opacity=".3"')}`)}
    ${soft(c, 9, `${E(210, 282, 24, 16, '#b49a84', 'opacity=".35"')}${E(170, 252, 12, 18, '#b4987e', 'opacity=".3"')}${E(214, 244, 18, 6, '#b49a84', 'opacity=".25"')}`)}
    ${soft(c, 4, `${E(184, 192, 13, 4, '#9a7470', 'opacity=".3"')}${E(240, 191, 11, 4, '#9a7470', 'opacity=".3"')}`)}
    ${soft(c, 0.6, `${E(208, 234, 3.4, 1.5, '#2e140c', 'opacity=".9" transform="rotate(12 208 234)"')}${E(226, 234, 3, 1.4, '#2e140c', 'opacity=".9" transform="rotate(-12 226 234)"')}`)}
    <path d="M196 256 C203 254 209 252 214 253 C218 252 223 252 228 252.5 C231 252.5 234 252 236 250.5 C230 255.5 223 257 215 257 C207 257 201 257 196 256Z" fill="#a8665a"/>
    <path d="M198 257 C204 258.5 210 259.5 216 259.5 C223 259.5 229 258 234 254 C232 261 225 265 215 265 C206 265 201 262 198 257Z" fill="#b8786a"/>
    ${soft(c, 0.7, S('M195 256 C203 257.5 210 258 216 258 C224 258 230 256 237 250', '#4a1e16', 1.5))}
    ${grainOver(c, faceClip, 0.12, 1.3, 15)}
    ${eyes}
    ${brows}
  `)}
  <path d="${HAIR}" fill="#3e2716" filter="${c.blur(0.6)}"/>
  ${lk.front.bodies}
  ${soft(c, 1.1, lk.front.darks, 0.7)}
  ${soft(c, 1.4, lk.front.lights, 0.3)}
  ${strands(rng(67), { guides: hairGuides.front, count: 170, w: [0.4, 1], color: brownDark, jitter: 2.5, opacity: [0.3, 0.7] })}
  ${strands(rng(68), { guides: hairGuides.front, count: 150, w: [0.35, 0.9], color: brownLight, jitter: 2.5, opacity: [0.2, 0.55] })}
  ${strands(rng(69), { guides: [[[158, 134], [154, 150], [154, 166], [156, 180]], [[162, 136], [159, 152], [159, 168], [161, 182]]], count: 22, w: [0.5, 1], color: brownDark, jitter: 1, opacity: [0.4, 0.8] })}
  ${strands(rng(70), { guides: [[[252, 126], [258, 136], [260, 148], [256, 164]], [[256, 128], [263, 140], [265, 152], [261, 168]]], count: 10, w: [0.5, 1.1], color: brown, jitter: 1, opacity: [0.6, 0.95] })}`;
}

function headMat() {
  const skin = 'rgb(55,70,255)', hair = 'rgb(110,90,0)';
  return `<path d="${HAIR_BACK}" fill="${hair}"/><path d="${EAR}" fill="${skin}"/><path d="${FACE}" fill="${skin}"/>
    <path d="M196 256 C210 251 228 251 237 250 C232 262 225 265 215 265 C205 265 199 262 196 256Z" fill="rgb(120,110,200)"/>
    <path d="${eyeShape(EYE_L)}" fill="rgb(255,255,0)"/><path d="${eyeShape(EYE_R)}" fill="rgb(255,255,0)"/>
    <path d="${HAIR}" fill="${hair}"/>`;
}

function headForms({ blink = false } = {}) {
  const lk = hairLocks();
  const L = lidCurves(EYE_L), Rr = lidCurves(EYE_R);
  return [
    { t: 'slab', d: FACE, h: 8, r: 18, cut: false, op: 'max' },
    { t: 'dome', cx: 192, cy: 166, rx: 74, ry: 104, h: 44, e: 0.5, op: 'max' },
    { t: 'dome', cx: 206, cy: 236, rx: 56, ry: 74, h: 42, e: 0.6, op: 'smax', k: 16 },
    { t: 'dome', cx: 196, cy: 156, rx: 78, ry: 102, h: 47, e: 0.5, op: 'smax', k: 6, mask: HAIR, maskOut: `${FACE} ${EAR}`, maskR: 6 },
    ...lk.back.forms,
    { t: 'slab', d: EAR, h: 7, r: 3.5, base: 10, op: 'max' },
    { t: 'bump', cx: 147, cy: 202, rx: 5, ry: 9, h: 4, op: 'sub' },
    { t: 'bump', cx: 206, cy: 134, rx: 42, ry: 24, h: 4 },
    { t: 'ridge', pts: [[162, 168], [184, 160], [206, 165], [222, 163], [244, 152], [264, 158]], w: 6.5, h: 4 },
    { t: 'bump', cx: 182, cy: 180, rx: 21, ry: 14, h: 10, op: 'sub' },
    { t: 'bump', cx: 240, cy: 179, rx: 18, ry: 14, h: 10, op: 'sub' },
    { t: 'dome', cx: 182, cy: 182, rx: 16, ry: 10, h: 8 },
    { t: 'dome', cx: 240, cy: 181, rx: 13.5, ry: 9.5, h: 7.5 },
    { t: 'ridge', bz: blink ? L.closed : L.top, w: 3.2, h: 2.2 },
    { t: 'ridge', bz: blink ? Rr.closed : Rr.top, w: 3, h: 2.1 },
    { t: 'ridge', bz: L.bottom, w: 2.2, h: 0.9 },
    { t: 'ridge', bz: Rr.bottom, w: 2.2, h: 0.8 },
    { t: 'ridge', pts: [[212, 168], [214, 186], [216, 202]], w: 4.2, h: 5 },
    { t: 'ridge', pts: [[215, 198], [217, 212], [220, 224]], w: 6, h: 8 },
    { t: 'bump', cx: 220, cy: 226, rx: 7.5, ry: 6.5, h: 5 },
    { t: 'bump', cx: 207, cy: 230, rx: 5.5, ry: 4.5, h: 3.5 },
    { t: 'bump', cx: 233, cy: 229, rx: 4.5, ry: 4.5, h: 3 },
    { t: 'bump', cx: 208, cy: 234, rx: 3.4, ry: 2, h: 3, op: 'sub' },
    { t: 'bump', cx: 226, cy: 234, rx: 3, ry: 1.9, h: 3, op: 'sub' },
    { t: 'bump', cx: 168, cy: 206, rx: 18, ry: 11, h: 6, rot: -25 },
    { t: 'bump', cx: 256, cy: 200, rx: 10, ry: 12, h: 3.5 },
    { t: 'bump', cx: 176, cy: 242, rx: 13, ry: 18, h: 3, op: 'sub' },
    { t: 'bump', cx: 250, cy: 238, rx: 9, ry: 16, h: 2.5, op: 'sub' },
    { t: 'bump', cx: 215, cy: 254, rx: 24, ry: 18, h: 5 },
    { t: 'ridge', pts: [[215, 238], [215, 249]], w: 3, h: -0.5 },
    { t: 'ridge', pts: [[198, 255.5], [207, 253.5], [215, 253.5], [224, 253], [235, 251]], w: 3, h: 2 },
    { t: 'bump', cx: 216, cy: 261, rx: 13, ry: 4.5, h: 2.6 },
    { t: 'ridge', pts: [[195, 256], [205, 257.5], [216, 258], [228, 257], [237, 250]], w: 1.4, h: -2 },
    { t: 'bump', cx: 215, cy: 270, rx: 11, ry: 3.5, h: 2, op: 'sub' },
    { t: 'bump', cx: 211, cy: 288, rx: 13, ry: 11, h: 6 },
    { t: 'ridge', pts: [[160, 244], [176, 274], [196, 294], [212, 302], [232, 292]], w: 5, h: 2.2 },
    { t: 'ridge', pts: [[205, 236], [199, 245], [196, 254]], w: 4, h: -0.9 },
    { t: 'ridge', pts: [[231, 235], [235, 243], [237, 250]], w: 4, h: -0.9 },
    { t: 'bump', cx: 156, cy: 150, rx: 9, ry: 18, h: 3, op: 'sub' },
    { t: 'bump', cx: 256, cy: 146, rx: 7, ry: 16, h: 3, op: 'sub' },
    { t: 'slab', d: HAIR, h: 3, r: 8 },
    ...lk.front.forms,
  ];
}

function headOverlay(c) {
  const g = (e) => eyeGlints({ ix: e.cx + e.look, iy: e.cy + e.lookY + e.open * 0.05, rI: e.open * 0.76 });
  return `${soft(c, 0.3, g(EYE_L) + g(EYE_R))}`;
}

// ---- the body ----

function bodyAlbedo(c) {
  const robeClip = c.clip('robe', ROBE);
  const sashClip = c.clip('sash', SASH);
  const R = rng(29);
  const stitches = [];
  for (let t = 0.05; t < 1; t += 0.035) stitches.push(`M${(88 + 194 * t).toFixed(1)} ${(388 + 112 * t).toFixed(1)}l4 2.4`, `M${(124 + 198 * t).toFixed(1)} ${(374 + 126 * t).toFixed(1)}l4 2.4`);
  const fingers = curled().map((f) => {
    const [ax, ay] = f.a, [bx, by] = f.b, dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    const crease = (t) => `M${(ax + dx * t - uy * 4).toFixed(1)} ${(ay + dy * t + ux * 4).toFixed(1)}l${(uy * 8).toFixed(1)} ${(-ux * 8).toFixed(1)}`;
    return `${P(f.d, f.k % 2 ? '#c89470' : '#d09c78')}${soft(c, 0.8, S(crease(0.42) + crease(0.72), '#8a5238', 1), 0.55)}${soft(c, 0.6, E(bx - ux * 3.5, by - uy * 3.5, 3.6, 3, '#ead0c0', `opacity=".7" transform="rotate(${(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1)} ${(bx - ux * 3.5).toFixed(1)} ${(by - uy * 3.5).toFixed(1)})"`))}`;
  }).join('');
  return `
  <path d="${NECK}" fill="#cc9a76"/>
  ${inside(c.clip('neck', NECK), `${soft(c, 8, E(210, 304, 30, 24, '#c08a6c', 'opacity=".5"'))}${grainOver(c, c.clip('neck', NECK), 0.1, 1.1, 8)}`)}
  <path d="${ROBE}" fill="#1c4424"/>
  ${inside(robeClip, `${soft(c, 22, `${E(70, 430, 80, 40, '#245430', 'opacity=".6"')}${E(340, 480, 90, 50, '#0c2412', 'opacity=".6"')}`)}
    ${grainOver(c, robeClip, 0.22, 0.75, 4)}
    <g clip-path="${robeClip}" style="mix-blend-mode:overlay" opacity=".12"><rect width="400" height="500" filter="${c.streaks(0.008, 0.45, 9)}" transform="rotate(-70 200 430)"/></g>`)}
  <path d="${TEAL}" fill="#22948a"/>
  ${inside(c.clip('teal', TEAL), grainOver(c, c.clip('teal', TEAL), 0.2, 1, 23))}
  ${S('M174 298 C194 307 222 307 242 298', '#8aeee2', 1.3, 'opacity=".85"')}
  <path d="${LAPEL_L}" fill="#22502c"/><path d="${LAPEL_R}" fill="#1c4626"/>
  ${S('M146 350 C158 378 178 400 204 422 M270 350 C258 378 240 400 220 422', '#c9a44a', 1.5)}
  <path d="${SASH}" fill="#7e6c32"/>
  ${inside(sashClip, `${grainOver(c, sashClip, 0.28, 1, 21)}<path d="${stitches.join('')}" stroke="#d8c070" stroke-width=".9" opacity=".7"/>`)}
  ${S('M88 388 L280 500 M124 374 L322 500', '#4a3e14', 1.6)}
  ${S('M196 330 L212 384 M228 330 L212 384', '#c9a44a', 1.2)}
  <path d="${DIAMOND}" fill="#c8a040"/>
  <path d="${GEM}" fill="#2aa84a"/>
  ${E(209, 400, 2.5, 4, '#9af0aa', 'opacity=".7"')}
  <path d="${SLEEVE}" fill="#173a1f"/>
  ${S('M146 446 L166 498', '#c9a44a', 1.4)}
  <path d="${HAND}" fill="#c99672"/>
  ${soft(c, 1.2, S('M196 424 L214 452 M188 432 L204 460', '#a8704e', 1.2), 0.4)}
  <path d="${THUMB}" fill="#cf9c78"/>
  ${soft(c, 0.6, E(188, 408, 4.2, 3.4, '#ead0c0', 'opacity=".7"'))}
  ${fingers}
  ${E(226, 438, 3.4, 3, '#2aa84a')}${E(226, 438, 4.2, 3.8, 'none', 'stroke="#c8a040" stroke-width="1.4"')}`;
}

function bodyMat() {
  const skin = 'rgb(55,60,255)', cloth = 'rgb(30,25,0)', gold = 'rgb(250,170,0)';
  return `<path d="${NECK}" fill="${skin}"/><path d="${ROBE}" fill="${cloth}"/>
    <path d="${TEAL}" fill="rgb(90,80,0)"/><path d="${LAPEL_L}" fill="${cloth}"/><path d="${LAPEL_R}" fill="${cloth}"/>
    <path d="${SASH}" fill="rgb(50,40,0)"/><path d="${DIAMOND}" fill="${gold}"/><path d="${GEM}" fill="rgb(255,255,0)"/>
    <path d="${SLEEVE}" fill="${cloth}"/><path d="${HAND}" fill="${skin}"/>
    ${curled().map((f) => `<path d="${f.d}" fill="${skin}"/>`).join('')}<path d="${THUMB}" fill="${skin}"/>
    ${E(226, 438, 4.2, 3.8, 'rgb(255,255,0)')}`;
}

function bodyForms() {
  return [
    { t: 'slab', d: ROBE, h: 34, r: 30, op: 'max' },
    { t: 'bump', cx: 210, cy: 450, rx: 170, ry: 110, h: 5 },
    { t: 'bump', cx: 60, cy: 420, rx: 70, ry: 40, h: 8 },
    { t: 'bump', cx: 352, cy: 420, rx: 60, ry: 40, h: 8 },
    { t: 'ridge', bz: [[250, 390], [266, 430], [282, 466], [290, 500]], w: 7, h: -4 },
    { t: 'ridge', bz: [[70, 410], [60, 440], [52, 470], [46, 500]], w: 7, h: 3.5 },
    { t: 'ridge', bz: [[340, 400], [352, 440], [362, 470], [366, 500]], w: 7, h: 3.5 },
    { t: 'slab', d: NECK, h: 24, r: 16, base: 10, op: 'max' },
    { t: 'slab', d: TEAL, h: 10, r: 7, base: 30, op: 'max' },
    { t: 'slab', d: LAPEL_L, h: 4, r: 3, base: 34, op: 'max' },
    { t: 'slab', d: LAPEL_R, h: 4, r: 3, base: 34, op: 'max' },
    { t: 'slab', d: SASH, h: 3, r: 2.5, base: 0 },
    { t: 'slab', d: DIAMOND, h: 3, r: 1.5, base: 0 },
    { t: 'dome', cx: 212, cy: 405, rx: 9, ry: 14, h: 2.5 },
    { t: 'slab', d: SLEEVE, h: 8, r: 8, base: 42, op: 'max' },
    { t: 'slab', d: HAND, h: 7, r: 10, base: 46, op: 'max' },
    ...curled().map((f) => ({ t: 'slab', d: f.d, h: 6, r: f.k === 3 ? 5 : 6, base: 48 + f.k * 0.3, op: 'max' })),
    ...curled().map((f) => ({ t: 'bump', cx: f.a[0], cy: f.a[1], rx: 6, ry: 6, h: 1.8 })),
    { t: 'slab', d: THUMB, h: 6, r: 6.5, base: 49, op: 'max' },
    { t: 'dome', cx: 226, cy: 438, rx: 4.2, ry: 3.8, h: 2.5 },
    { t: 'noise', mask: `${ROBE} ${SLEEVE}`, h: 0.35, cell: 1.8, stretch: [0.5, 1.8], seed: 9 },
    { t: 'noise', mask: SASH, h: 0.35, cell: 1.3, stretch: [2, 0.5], seed: 10 },
  ];
}

function lidsMaskDoc(c) {
  return `<g filter="${c.blur(2.5)}">${AMMON.eyes.map(([x, y, rx, ry]) => E(x, y - 2, rx, ry, '#fff')).join('')}</g>`;
}

/** One layer of the painting for the lit bake: its colour (albedo), material and overlay as SVG, and its forms. */
export function ammonLayer(layer, { blink = false } = {}) {
  if (layer === 'head') {
    const a = canvas('ammon-ha'), m = canvas('ammon-hm'), o = canvas('ammon-ho');
    return { albedo: svgDoc(a, headAlbedo(a, { blink })), mat: svgDoc(m, headMat()), overlay: blink ? null : svgDoc(o, headOverlay(o)), forms: headForms({ blink }) };
  }
  const a = canvas('ammon-ba'), m = canvas('ammon-bm');
  return { albedo: svgDoc(a, bodyAlbedo(a)), mat: svgDoc(m, bodyMat()), overlay: null, forms: bodyForms() };
}

/** The painted (unlit) parts as SVG documents: the icy hall behind him, and the mask of the blink. */
export function paintAmmon(part) {
  const c = canvas(`ammon-${part}`);
  return svgDoc(c, part === 'back' ? back(c) : lidsMaskDoc(c));
}
