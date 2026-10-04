// Cyril, Mentat of House Atreides, painted (research.md §4): a young man, calm and fair, swept-back blond hair, blue
// eyes, a high-collared navy cloak with a round gold pendant, a red book in hand. His face is turned a little toward
// the map (the viewer's right); a warm lamp lights him from the left, Caladan's sea light from the arched window
// behind him rims his right side in cool blue.
import { canvas, rng, P, E, S, soft, inside, grainOver, strands, locks, pick, eye, eyeGlints, lidCurves, svgDoc } from './portraits-paint.js';

const FACE = 'M150 124 C142 140 138 160 139 182 C140 204 144 222 151 238 C158 256 172 272 190 284 C198 289 206 291 214 291 C222 291 228 288 234 282 C247 268 257 250 261 226 C265 206 268 188 266 170 C266 150 262 130 254 116 C238 102 196 98 172 106 C162 110 154 116 150 124Z';
const HAIR = 'M154 138 C142 124 131 110 128 94 C124 80 132 70 144 66 C150 60 160 56 172 57 C182 51 196 50 207 54 C219 49 237 51 249 59 C263 63 275 73 280 87 C286 99 285 112 280 122 C276 131 270 138 265 143 L260 137 C256 125 246 117 232 113 C214 108 190 109 172 115 C164 119 158 127 154 138Z';
const HAIR_BACK = 'M150 106 C132 100 118 116 116 146 C113 176 116 204 122 228 C128 244 140 250 150 244 C146 230 142 214 141 196 C140 170 144 146 152 128Z';
const EAR = 'M152 178 C140 166 127 170 126 187 C125 204 131 220 141 230 C147 236 153 233 156 226Z';
const NECK = 'M174 236 C177 270 176 304 170 348 L244 348 C239 308 237 280 242 240Z';
const CLOAK = 'M0 500 L0 448 C18 410 60 386 112 374 C146 366 168 352 178 340 L242 340 C252 352 274 366 308 374 C356 386 388 414 400 446 L400 500Z';
const COLLAR_BACK = 'M128 250 C168 232 240 230 292 244 L266 356 L156 356Z';
const WING_L = 'M112 390 C98 338 96 280 108 222 C110 212 118 208 126 214 C142 228 156 246 166 266 C172 298 178 326 188 352 C168 366 142 379 112 390Z';
const WING_R = 'M304 392 C318 340 320 282 306 222 C303 212 294 210 288 216 C274 230 262 248 254 268 C248 300 242 328 234 352 C254 366 278 380 304 392Z';
const VEE = 'M178 344 C190 368 200 390 210 404 C220 390 232 368 244 344Z';
const BAND = 'M170 352 C169 336 171 322 175 310 C192 317 224 317 241 310 C245 322 247 336 246 352 C226 346 190 346 170 352Z';
const BOOK = 'M232 432 L330 396 L366 500 L262 500Z';
const SPINE = 'M219 440 L232 432 L262 500 L247 500Z';
const PAGES = 'M230 427 L328 391 L330 396 L232 432Z';

const EYE_L = { cx: 181, cy: 182, w: 31, open: 8.6, tilt: 0.6, look: -1.4 };
const EYE_R = { cx: 243, cy: 181.5, w: 26, open: 8, tilt: -0.5, look: -1.6 };

export const CYRIL = {
  house: 'atreides', name: 'Cyril', pivot: [208, 318], eyes: [[181, 182, 30, 15], [243, 181, 26, 14]],
  finish: { r: 1.1, mix: 0.65 },
  outlines: { head: [FACE, HAIR, HAIR_BACK, EAR], body: [CLOAK, COLLAR_BACK, NECK, BAND, WING_L, WING_R, BOOK, SPINE, PAGES] },
  rig: {
    key: { dir: [-0.76, -0.46, 0.5], color: [1, 0.9, 0.8], i: 1.5, wrap: 0.14 },
    fill: { dir: [0.6, 0.1, 0.8], color: [0.42, 0.6, 0.85], i: 0.14 },
    rim: { dir: [0.78, -0.22, -0.6], color: [0.5, 0.85, 1], i: 1.7, power: 2 },
    sky: [0.14, 0.17, 0.23], ground: [0.06, 0.05, 0.055], skinAmb: [2.4, 1.4, 0.95],
    sss: [0.36, 0.07, 0.03], ao: { r: 9, k: 0.22 }, shadow: { len: 70, soft: 3.4, bias: 0.5, blur: 2, depth: 0.6 }, spec: { power: 34, i: 0.5 }, exposure: 1,
  },
};

const fingersAt = () => [[0.38, 25, -0.1], [0.53, 28, -0.03], [0.68, 27, 0.04], [0.82, 22, 0.1]].map(([t, len, fan], k) => {
  const x = 232 + 98 * t, y = 432 - 36 * t - 4;
  const dx = 0.36 + fan, dy = 0.93;
  const ex = x + dx * len, ey = y + dy * len;
  const w = 7.6 - k * 0.5;
  const f = (v) => v.toFixed(1);
  const d = `M${f(x - w)} ${f(y - 3)} C${f(x - w * 1.1)} ${f(y + len * 0.5)} ${f(ex - w * 1.05)} ${f(ey - 3)} ${f(ex - w * 0.55)} ${f(ey + 2)} C${f(ex)} ${f(ey + 6)} ${f(ex + w * 0.9)} ${f(ey + 4)} ${f(ex + w * 0.85)} ${f(ey - 2)} C${f(x + w * 1.2)} ${f(y + len * 0.5)} ${f(x + w)} ${f(y + 2)} ${f(x + w)} ${f(y - 3)}Z`;
  return { x, y, ex, ey, w, dx, dy, len, d };
});

function back(c) {
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
  const sides = c.lin('vigx', [[0, '#fff', 0], [0.1, '#fff', 0.35], [0.22, '#fff', 0.88], [0.3, '#fff'], [0.74, '#fff'], [0.84, '#fff', 0.85], [0.94, '#fff', 0.3], [1, '#fff', 0]]);
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

// ---- the head ----

const hairGuides = {
  front: [
    [[276, 112], [288, 84], [246, 50], [180, 52]],
    [[268, 128], [286, 96], [252, 58], [196, 56]],
    [[264, 142], [286, 112], [264, 66], [200, 58]],
    [[250, 122], [272, 88], [238, 60], [174, 60]],
    [[232, 112], [250, 80], [212, 58], [154, 68]],
    [[212, 110], [222, 82], [186, 62], [138, 86]],
    [[190, 111], [194, 88], [162, 72], [130, 108]],
    [[170, 116], [170, 98], [146, 90], [126, 128]],
    [[156, 132], [150, 114], [136, 106], [124, 148]],
  ],
  back: [
    [[236, 52], [196, 48], [154, 56], [132, 90]],
    [[214, 54], [176, 52], [140, 66], [126, 104]],
    [[184, 58], [146, 60], [126, 96], [124, 150]],
    [[154, 68], [130, 94], [120, 160], [128, 226]],
    [[138, 100], [122, 144], [124, 206], [136, 246]],
    [[150, 118], [140, 160], [142, 214], [146, 246]],
  ],
};
const blond = pick([['#a07626', 3], ['#b88c34', 4], ['#cfa448', 3], ['#e2bc5e', 2]]);
const blondDark = pick([['#5a3e12', 3], ['#6a4a18', 4], ['#7e5a20', 2]]);
const blondLight = pick([['#f6dc8c', 3], ['#fff0b8', 2], ['#ecca72', 2]]);
const browCol = pick([['#7a5420', 3], ['#9a6e2e', 2], ['#5e4016', 2]]);
const hairLocks = () => ({
  front: locks(rng(81), { guides: hairGuides.front, count: 72, w: [7, 14], body: blond, dark: blondDark, light: blondLight, jitter: 2.5 }),
  back: locks(rng(82), { guides: hairGuides.back, count: 40, w: [7, 13], body: pick([['#8a6424', 2], ['#a07626', 2]]), dark: blondDark, light: pick([['#d8b45a', 1]]), jitter: 3 }),
});
const eyeShape = (e) => { const { top, bottom } = lidCurves(e); return `M${top[0]} C${top[1]} ${top[2]} ${top[3]} C${bottom[1]} ${bottom[2]} ${bottom[3]}Z`; };

function headAlbedo(c, { blink = false } = {}) {
  const faceClip = c.clip('face', FACE);
  const backClip = c.clip('hairback', HAIR_BACK);
  const lk = hairLocks();
  const brows = strands(rng(51), { guides: [[[161, 165], [170, 155], [187, 152], [202, 159]], [[163, 167], [172, 159], [188, 156], [202, 162]], [[166, 169], [175, 162], [189, 160], [201, 165]]], count: 70, w: [0.7, 1.4], color: browCol, jitter: 0.8, trim: 0.25, shape: 'both' })
    + strands(rng(52), { guides: [[[227, 160], [238, 153], [253, 153], [264, 160]], [[227, 163], [238, 156], [253, 156], [263, 163]], [[228, 165], [239, 159], [252, 159], [262, 165]]], count: 56, w: [0.7, 1.3], color: browCol, jitter: 0.8, trim: 0.25, shape: 'both' });
  const eyes = `${eye(c, 'l', { ...EYE_L, iris: ['#b8dcff', '#4b8fd8', '#2a5ca8'], irisDark: '#10223e', skin: ['#e8b494', '#dca486'], lidShade: 'rgba(110,56,40,.45)', closed: blink, R: rng(41), glints: false })}
    ${eye(c, 'r', { ...EYE_R, iris: ['#a8d2ff', '#3f80cc', '#22508f'], irisDark: '#0c1c34', skin: ['#e6b292', '#d8a284'], lidShade: 'rgba(110,56,40,.45)', closed: blink, R: rng(42), glints: false })}`;
  return `
  <path d="${HAIR_BACK}" fill="#8e6626"/>
  ${inside(backClip, `${lk.back.bodies}${soft(c, 1, lk.back.darks, 0.7)}
    ${strands(rng(62), { guides: hairGuides.back, count: 110, w: [0.5, 1.2], color: blond, jitter: 3, opacity: [0.3, 0.7] })}`)}
  <path d="${EAR}" fill="#e2a68a"/>
  ${S('M150 176 C138 168 129 176 129 190 C129 204 134 216 142 226', '#f0bca0', 2.4)}
  ${soft(c, 1.2, '<path d="M147 190 C141 188 136 194 138 202 C140 209 144 213 149 211Z" fill="#9a5444" opacity=".9"/>')}
  ${soft(c, 2, E(138, 220, 7, 9, '#e8806e', 'opacity=".5"'))}
  <path d="${FACE}" fill="#ebb998"/>
  ${inside(faceClip, `
    ${soft(c, 10, `${E(200, 130, 40, 22, '#f0c6a4', 'opacity=".7"')}${E(172, 222, 16, 12, '#e8907a', 'opacity=".4"')}${E(252, 220, 10, 12, '#e08a78', 'opacity=".35"')}${E(218, 212, 8, 12, '#e8907a', 'opacity=".35"')}`)}
    ${soft(c, 9, `${E(212, 274, 26, 14, '#d8a490', 'opacity=".35"')}${E(160, 252, 12, 16, '#d6a490', 'opacity=".3"')}`)}
    ${soft(c, 4, `${E(183, 192, 14, 4, '#c89088', 'opacity=".3"')}${E(243, 191, 12, 4, '#c89088', 'opacity=".3"')}`)}
    ${soft(c, 4, S('M152 132 C160 120 180 110 210 108 C232 108 252 116 262 132', '#c89a72', 5), 0.35)}
    ${soft(c, 0.6, `${E(209, 228, 3.8, 1.7, '#3a1610', 'opacity=".9" transform="rotate(12 209 228)"')}${E(227, 228, 3.2, 1.5, '#3a1610', 'opacity=".9" transform="rotate(-12 227 228)"')}`)}
    ${soft(c, 0.8, `${S('M203 220 C198 223 199 229 206 230', '#b87660', 1.6)}${S('M233 219 C238 222 237 228 231 230', '#b87660', 1.6)}`, 0.7)}
    <path d="M194 249 C201 246.5 207 244 213 245 C216 244 219 244 222 245 C228 244 234 246 238.5 248.5 C230 251 222 252 215 252 C206 252 200 251 194 249Z" fill="#b8665a"/>
    <path d="M196 250.5 C203 252.5 210 253.5 216 253.5 C224 253.5 230.5 252 236.5 249.5 C233.5 257 226 261.5 215 261.5 C205 261.5 199 257 196 250.5Z" fill="#cc7e6e"/>
    ${soft(c, 0.7, S('M193 249.5 C202 251.5 210 252 216 252 C224 252 231 251 239.5 248.5', '#5e261e', 1.6))}
    ${soft(c, 1, `${E(193, 249.5, 2, 1.5, '#6a2e24', 'opacity=".6"')}${E(239.5, 248.5, 2, 1.5, '#6a2e24', 'opacity=".6"')}`)}
    ${soft(c, 3.5, S('M151 126 C143 146 141 170 143 196 C145 216 149 230 155 244', '#b07458', 7), 0.4)}
    ${grainOver(c, faceClip, 0.12, 1.3, 15)}
    ${eyes}
    ${brows}
  `)}
  <path d="${HAIR}" fill="#9c7024" filter="${c.blur(0.6)}"/>
  ${inside(c.clip('hairtop0', HAIR), lk.back.bodies)}
  ${lk.front.bodies}
  ${soft(c, 1.2, lk.front.darks, 0.85)}
  ${inside(c.clip('hairtop', HAIR), soft(c, 5, S('M156 134 C166 120 186 112 212 111 C236 111 254 120 262 136', '#5e3e12', 8), 0.55))}
  ${soft(c, 1.6, lk.front.lights, 0.35)}
  ${strands(rng(63), { guides: hairGuides.front, count: 170, w: [0.4, 1.1], color: blondDark, jitter: 3, opacity: [0.25, 0.6] })}
  ${strands(rng(64), { guides: hairGuides.front, count: 170, w: [0.4, 1], color: blondLight, jitter: 3, opacity: [0.25, 0.6] })}
  ${strands(rng(71), { guides: [[[151, 132], [147, 150], [146, 170], [149, 190]], [[156, 134], [153, 152], [152, 172], [155, 190]], [[160, 136], [158, 154], [157, 172], [159, 186]]], count: 44, w: [0.4, 1], color: blondDark, jitter: 1.2, opacity: [0.25, 0.7] })}
  ${strands(rng(72), { guides: [[[236, 110], [250, 118], [258, 130], [256, 150]], [[244, 112], [260, 122], [266, 136], [263, 156]]], count: 16, w: [0.7, 1.5], color: blond, jitter: 1.5, opacity: [0.6, 0.95] })}
  ${strands(rng(73), { guides: [[[176, 58], [208, 48], [244, 52], [270, 70]], [[150, 66], [176, 52], [214, 48], [250, 56]]], count: 14, w: [0.3, 0.7], color: blondLight, jitter: 3, opacity: [0.3, 0.6] })}`;
}

function headMat() {
  const skin = 'rgb(55,70,255)', hair = 'rgb(95,70,0)';
  return `<path d="${HAIR_BACK}" fill="${hair}"/><path d="${EAR}" fill="${skin}"/><path d="${FACE}" fill="${skin}"/>
    <path d="M194 249 C201 246 213 244 222 245 C230 245 236 247 239 249 C234 258 226 262 215 262 C205 262 198 258 194 249Z" fill="rgb(130,120,200)"/>
    <path d="${eyeShape(EYE_L)}" fill="rgb(255,255,0)"/><path d="${eyeShape(EYE_R)}" fill="rgb(255,255,0)"/>
    <path d="M160 166 C172 152 190 150 202 160 L201 167 C190 160 174 160 166 170Z M227 159 C240 150 256 152 264 160 L262 166 C254 160 240 159 228 165Z" fill="rgb(10,10,40)"/>
    <path d="${HAIR}" fill="${hair}"/>`;
}

function headForms({ blink = false } = {}) {
  const lk = hairLocks();
  const lid = (e) => lidCurves(e);
  const L = lid(EYE_L), Rr = lid(EYE_R);
  return [
    { t: 'slab', d: FACE, h: 10, r: 20, cut: false, op: 'max' },
    { t: 'dome', cx: 188, cy: 166, rx: 82, ry: 100, h: 46, e: 0.5, op: 'max' },
    { t: 'dome', cx: 204, cy: 226, rx: 64, ry: 72, h: 44, e: 0.6, op: 'smax', k: 16 },
    { t: 'dome', cx: 196, cy: 150, rx: 90, ry: 104, h: 54, e: 0.5, op: 'smax', k: 6, mask: HAIR, maskOut: `${FACE} ${EAR}`, maskR: 6 },
    ...lk.back.forms,
    { t: 'slab', d: EAR, h: 8, r: 3.5, base: 10, op: 'max' },
    { t: 'bump', cx: 143, cy: 200, rx: 5, ry: 9, h: 4, op: 'sub' },
    { t: 'bump', cx: 204, cy: 132, rx: 46, ry: 26, h: 5 },
    { t: 'ridge', pts: [[160, 166], [184, 158], [206, 163], [224, 163], [246, 157], [266, 163]], w: 7, h: 4.5 },
    { t: 'bump', cx: 213, cy: 166, rx: 8, ry: 7, h: 2 },
    { t: 'bump', cx: 182, cy: 181, rx: 23, ry: 15, h: 11, op: 'sub' },
    { t: 'bump', cx: 243, cy: 180, rx: 19, ry: 15, h: 11, op: 'sub' },
    { t: 'dome', cx: 181, cy: 183, rx: 17.5, ry: 11.5, h: 8.5 },
    { t: 'dome', cx: 243, cy: 182.5, rx: 14.5, ry: 11, h: 8 },
    ...(blink ? [
      { t: 'ridge', bz: L.closed, w: 1.6, h: -0.7 },
      { t: 'ridge', bz: Rr.closed, w: 1.6, h: -0.7 },
    ] : [
      { t: 'ridge', bz: L.top, w: 3.2, h: 2 },
      { t: 'ridge', bz: Rr.top, w: 3, h: 1.9 },
      { t: 'ridge', bz: L.bottom, w: 2.2, h: 0.9 },
      { t: 'ridge', bz: Rr.bottom, w: 2.2, h: 0.8 },
    ]),
    { t: 'ridge', pts: [[212, 168], [213, 180], [215, 194]], w: 4.5, h: 5 },
    { t: 'ridge', pts: [[214.5, 190], [216.5, 203], [218.5, 214]], w: 8.5, h: 7 },
    { t: 'bump', cx: 218, cy: 217, rx: 8.5, ry: 7.5, h: 5.5 },
    { t: 'bump', cx: 205, cy: 224, rx: 6.5, ry: 5, h: 4.5 },
    { t: 'bump', cx: 232, cy: 223, rx: 5.5, ry: 5, h: 3.5 },
    { t: 'bump', cx: 209, cy: 228.5, rx: 3.8, ry: 2.2, h: 3.5, op: 'sub' },
    { t: 'bump', cx: 227, cy: 228.5, rx: 3.2, ry: 2, h: 3.5, op: 'sub' },
    { t: 'bump', cx: 165, cy: 205, rx: 20, ry: 13, h: 5, rot: -20 },
    { t: 'bump', cx: 255, cy: 199, rx: 12, ry: 14, h: 3 },
    { t: 'bump', cx: 167, cy: 238, rx: 12, ry: 16, h: 2.2, op: 'sub' },
    { t: 'bump', cx: 215, cy: 247, rx: 28, ry: 22, h: 6 },
    { t: 'ridge', pts: [[215, 234], [215, 243]], w: 3, h: -0.5 },
    { t: 'ridge', pts: [[196, 248.5], [205, 246.5], [215, 247.5], [226, 246.5], [237, 248]], w: 3.6, h: 3 },
    { t: 'bump', cx: 216, cy: 256, rx: 15, ry: 5.5, h: 4 },
    { t: 'ridge', pts: [[193, 249.5], [205, 251.5], [216, 252], [228, 251.5], [239.5, 248.5]], w: 1.5, h: -2.4 },
    { t: 'bump', cx: 193, cy: 250, rx: 3, ry: 3, h: 1.5, op: 'sub' },
    { t: 'bump', cx: 240, cy: 249, rx: 3, ry: 3, h: 1.5, op: 'sub' },
    { t: 'bump', cx: 215, cy: 266, rx: 12, ry: 4, h: 2.5, op: 'sub' },
    { t: 'bump', cx: 210, cy: 278, rx: 16, ry: 11, h: 7 },
    { t: 'ridge', pts: [[150, 236], [166, 262], [186, 280], [210, 289], [234, 280]], w: 6, h: 2.5 },
    { t: 'ridge', pts: [[203, 231], [197, 239], [193, 247]], w: 4.5, h: -0.9 },
    { t: 'ridge', pts: [[233, 229], [238, 237], [240, 245]], w: 4.5, h: -0.9 },
    { t: 'bump', cx: 150, cy: 148, rx: 10, ry: 20, h: 3, op: 'sub' },
    { t: 'bump', cx: 262, cy: 142, rx: 8, ry: 18, h: 3, op: 'sub' },
    { t: 'slab', d: HAIR, h: 4, r: 9 },
    { t: 'bump', cx: 240, cy: 90, rx: 34, ry: 26, h: 4 },
    ...lk.front.forms,
  ];
}

function headOverlay(c) {
  const g = (e) => eyeGlints({ ix: e.cx + e.look, iy: e.cy + e.open * 0.05, rI: e.open * 0.76 });
  return `${soft(c, 0.3, g(EYE_L) + g(EYE_R))}
    ${soft(c, 2.4, S('M289 96 C287 116 279 130 267 143', '#c2ecff', 2.4), 0.4)}`;
}

// ---- the body ----

function bodyAlbedo(c) {
  const neckClip = c.clip('neck', NECK);
  const cloakClip = c.clip('cloak', CLOAK);
  const bookClip = c.clip('book', BOOK);
  const fingers = fingersAt().map(({ d, ex, ey, w }) => `${P(d, '#e6b092')}
    ${soft(c, 0.7, `<path d="M${(ex - w * 0.5).toFixed(1)} ${(ey - 4).toFixed(1)} Q${ex.toFixed(1)} ${(ey + 3).toFixed(1)} ${(ex + w * 0.55).toFixed(1)} ${(ey - 4).toFixed(1)} Q${ex.toFixed(1)} ${(ey - 9).toFixed(1)} ${(ex - w * 0.5).toFixed(1)} ${(ey - 4).toFixed(1)}Z" fill="#f6d4c4" opacity=".85"/>`)}`).join('');
  return `
  <path d="${COLLAR_BACK}" fill="#121c48"/>
  <path d="${NECK}" fill="#e2aa8c"/>
  ${inside(neckClip, `${soft(c, 8, E(208, 300, 40, 30, '#d89a84', 'opacity=".5"'))}${grainOver(c, neckClip, 0.1, 1.1, 8)}`)}
  <path d="${CLOAK}" fill="#1e2c66"/>
  ${inside(cloakClip, `${soft(c, 20, `${E(330, 480, 90, 60, '#141e4c', 'opacity=".6"')}${E(80, 420, 70, 40, '#24357a', 'opacity=".5"')}`)}
    ${grainOver(c, cloakClip, 0.22, 0.75, 4)}
    <g clip-path="${cloakClip}" style="mix-blend-mode:overlay" opacity=".12"><rect width="400" height="500" filter="${c.streaks(0.008, 0.45, 9)}" transform="rotate(-70 200 430)"/></g>`)}
  <path d="${VEE}" fill="#0b1130"/>
  ${S('M179 345 C191 369 201 390 210 404 C219 390 231 369 243 345', '#c99a3e', 2.6)}
  <path d="${BAND}" fill="#18235a"/>
  ${S('M175 310 C192 317 224 317 241 310', '#d4a642', 1.8)}
  ${S('M172 330 C192 336 224 336 244 330', '#d4a642', 0.8, 'opacity=".7"')}
  <path d="${WING_L}" fill="#28407e"/>
  ${S('M112 390 C98 338 96 280 108 222', '#141e4a', 5)}
  ${S('M110 388 C97 336 95 280 107 223', '#c4d4f4', 1.4)}
  ${S('M108 222 C110 212 118 208 126 214 C142 228 156 246 166 266', '#d4e0ff', 1.3)}
  ${S('M114 380 C102 334 100 282 109 232', '#d4a642', 1.2)}
  <path d="${WING_R}" fill="#243a74"/>
  ${S('M304 392 C318 340 320 282 306 222', '#141e4a', 5)}
  ${S('M306 390 C319 339 321 282 307 223', '#c4d4f4', 1.4)}
  ${S('M306 222 C303 212 294 210 288 216 C274 230 262 248 254 268', '#d4e0ff', 1.2)}
  ${S('M300 384 C312 338 314 286 303 232', '#d4a642', 1.2)}
  ${S('M182 346 C192 366 202 384 210 392 C218 384 228 366 238 346', '#d8b25a', 0.9)}
  ${E(210, 410, 17, 17, '#d6a640')}
  ${E(210, 410, 13.5, 13.5, 'none', 'stroke="#7a5414" stroke-width="1.4"')}
  ${E(210, 410, 16.3, 16.3, 'none', 'stroke="#5a3c0c" stroke-width="1.2"')}
  ${E(210, 410, 8.5, 8.5, '#2a68d0')}
  ${E(208, 408, 4, 3.5, '#6aa8ff', 'opacity=".7"')}
  <path d="${SPINE}" fill="#6a0e0a"/>
  ${S('M222 448 L232 442 M229 463 L239 457 M236 478 L246 472', '#d9b04a', 2.2)}
  <path d="${PAGES}" fill="#efe0bc"/>
  ${S('M234 429 L328 394', '#b8a47e', 0.5, 'opacity=".8"')}
  <path d="${BOOK}" fill="#ac2a1e"/>
  ${inside(bookClip, `
    ${S('M245 442 L326 412 L354 496 L272 500Z', '#e0bc58', 1.4)}
    ${S('M251 448 L322 421 L347 494 L279 500Z', '#e0bc58', 0.7, 'opacity=".6"')}
    <path d="M296 452 L306 464 L299 478 L289 466Z" fill="#e0bc58"/>
    ${grainOver(c, bookClip, 0.25, 1.2, 12)}`)}
  ${fingers}`;
}

function bodyMat() {
  const skin = 'rgb(50,60,255)', cloth = 'rgb(28,22,0)', gold = 'rgb(250,170,0)';
  const fingers = fingersAt().map(({ d }) => `<path d="${d}" fill="${skin}"/>`).join('');
  return `<path d="${COLLAR_BACK}" fill="${cloth}"/><path d="${NECK}" fill="${skin}"/><path d="${CLOAK}" fill="${cloth}"/>
    <path d="${VEE}" fill="${cloth}"/><path d="${BAND}" fill="rgb(60,45,0)"/>${S('M175 310 C192 317 224 317 241 310', 'rgb(250,170,0)', 1.8)}<path d="${WING_L}" fill="rgb(55,40,0)"/><path d="${WING_R}" fill="rgb(55,40,0)"/>
    ${S('M112 390 C98 338 96 280 108 222 M304 392 C318 340 320 282 306 222', 'rgb(120,90,0)', 5)}
    ${S('M114 380 C102 334 100 282 109 232 M300 384 C312 338 314 286 303 232 M179 345 C191 369 201 390 210 404 C219 390 231 369 243 345', gold, 2.4)}
    ${E(210, 410, 17, 17, gold)}${E(210, 410, 8.5, 8.5, 'rgb(255,255,0)')}
    <path d="${SPINE}" fill="rgb(70,60,0)"/><path d="${PAGES}" fill="rgb(15,10,0)"/><path d="${BOOK}" fill="rgb(70,60,0)"/>
    <path d="M296 452 L306 464 L299 478 L289 466Z" fill="${gold}"/>
    ${fingers}`;
}

function bodyForms() {
  const fingerForms = fingersAt().flatMap(({ d, x, y, dx, dy, len, w }) => [
    { t: 'slab', d, h: 7, r: w * 0.5, base: 58, op: 'max' },
    { t: 'bump', cx: x + dx * len * 0.42, cy: y + dy * len * 0.42, rx: w * 0.9, ry: 3, h: -0.8 },
  ]);
  return [
    { t: 'slab', d: COLLAR_BACK, h: 4, r: 6, base: 2, op: 'max' },
    { t: 'slab', d: CLOAK, h: 34, r: 30, op: 'max' },
    { t: 'bump', cx: 210, cy: 470, rx: 120, ry: 90, h: 10 },
    { t: 'bump', cx: 60, cy: 420, rx: 70, ry: 40, h: 8 },
    { t: 'bump', cx: 350, cy: 420, rx: 60, ry: 40, h: 8 },
    { t: 'ridge', bz: [[188, 380], [176, 420], [160, 460], [150, 500]], w: 7, h: -4.5 },
    { t: 'ridge', bz: [[232, 380], [246, 420], [262, 460], [270, 500]], w: 6, h: -4 },
    { t: 'ridge', bz: [[124, 390], [112, 430], [98, 470], [90, 500]], w: 6, h: -3.5 },
    { t: 'ridge', bz: [[170, 384], [158, 424], [142, 464], [132, 500]], w: 8, h: 4 },
    { t: 'ridge', bz: [[108, 392], [94, 430], [80, 468], [70, 500]], w: 7, h: 3.5 },
    { t: 'ridge', bz: [[212, 396], [214, 430], [214, 466], [212, 500]], w: 7, h: 3 },
    { t: 'slab', d: VEE, h: 3, r: 2, base: 26, op: 'max' },
    { t: 'slab', d: NECK, h: 24, r: 16, base: 10, op: 'max' },
    { t: 'slab', d: BAND, h: 9, r: 8, base: 30, op: 'max' },
    { t: 'ridge', pts: [[175, 310], [192, 317], [224, 317], [241, 310]], w: 1.6, h: 1 },
    { t: 'slab', d: WING_L, h: 9, r: 5, base: 34, op: 'max' },
    { t: 'slab', d: WING_R, h: 9, r: 5, base: 34, op: 'max' },
    { t: 'ridge', bz: [[112, 390], [98, 338], [96, 280], [108, 222]], w: 3, h: 2 },
    { t: 'ridge', bz: [[304, 392], [318, 340], [320, 282], [306, 222]], w: 3, h: 2 },
    { t: 'dome', cx: 210, cy: 410, rx: 17, ry: 17, h: 8, e: 0.7 },
    { t: 'ridge', pts: Array.from({ length: 25 }, (_, k) => [210 + 15 * Math.cos(k * Math.PI / 12), 410 + 15 * Math.sin(k * Math.PI / 12)]), w: 1.6, h: 1.4 },
    { t: 'dome', cx: 210, cy: 410, rx: 8.5, ry: 8.5, h: 3.5, e: 0.5 },
    { t: 'slab', d: SPINE, h: 6, r: 3, base: 46, op: 'max' },
    { t: 'slab', d: PAGES, h: 1, r: 1, base: 54, op: 'max' },
    { t: 'slab', d: BOOK, h: 3, r: 1.5, base: 52, op: 'max' },
    { t: 'noise', mask: CLOAK, h: 0.35, cell: 1.8, stretch: [0.5, 1.8], seed: 3 },
    { t: 'noise', mask: `${WING_L} ${WING_R}`, h: 0.15, cell: 1.6, seed: 4 },
    { t: 'noise', mask: BOOK, h: 0.25, cell: 1.2, seed: 5 },
    ...fingerForms,
  ];
}

function lidsMaskDoc(c) {
  return `<g filter="${c.blur(2.5)}">${CYRIL.eyes.map(([x, y, rx, ry]) => E(x, y - 2, rx, ry, '#fff')).join('')}</g>`;
}

/** One layer of the painting for the lit bake: its colour (albedo), material and overlay as SVG, and its forms. */
export function cyrilLayer(layer, { blink = false } = {}) {
  if (layer === 'head') {
    const a = canvas('cyril-ha'), m = canvas('cyril-hm'), o = canvas('cyril-ho');
    return { albedo: svgDoc(a, headAlbedo(a, { blink })), mat: svgDoc(m, headMat()), overlay: blink ? null : svgDoc(o, headOverlay(o)), forms: headForms({ blink }) };
  }
  const a = canvas('cyril-ba'), m = canvas('cyril-bm');
  return { albedo: svgDoc(a, bodyAlbedo(a)), mat: svgDoc(m, bodyMat()), overlay: null, forms: bodyForms() };
}

/** The painted (unlit) parts as SVG documents: the chamber behind him, and the mask of the blink. */
export function paintCyril(part) {
  const c = canvas(`cyril-${part}`);
  return svgDoc(c, part === 'back' ? back(c) : lidsMaskDoc(c));
}
