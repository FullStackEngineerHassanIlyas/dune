// The charges on the crests' shields (crests.js), our own drawings built procedurally: the Atreides hawk
// displayed (wings raised, tail fanned, head in profile), the Harkonnen ram's head with its horns in growth-ringed
// spirals, the Ordos serpent rearing on a scaled tapering body, and for the minor houses the Emperor's lion
// (Sardaukar), crossed swords on a coin (Mercenaries) and a crysknife in a sandworm's maw (Fremen). Each is drawn
// about its own origin and placed by the caller; `m` is the material: gradient ids under m.p, ink and detail
// colours. `detail` false leaves out the engraving that only blurs at badge size.
import { f, pt, add, sub, mul, lerp, turn, unit, normal, smooth, sample, edges, tube, feather, spiral, mirror, rad } from './crests-geometry.js';

/** Attributes for engraved lines (no fill) in colour `c`. */
const line = (c, w = 0.8, o = 0.75) => `fill="none" stroke="${c}" stroke-width="${w}" opacity="${o}" stroke-linecap="round"`;

/** A point at fraction u along an evenly sampled polyline. */
const along = (pts, u) => {
  const x = u * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x));
  return lerp(pts[i], pts[i + 1], x - i);
};

/**
 * Volume for a rounded shape `d`: inside it, a soft shadow along the edge away from the light (its outline moved
 * towards the light) and a highlight along the lit edge (moved away), so a body reads round in any pose. The clip
 * and the outline are defined once (`key`; shape()) and may be reused, mirrored, with volumeAgain.
 */
function volume(m, key, d, w = 9, o = 0.5) {
  return shape(m, key, d) + volumeAgain(m, key, w, o);
}
/** The outline `d` defined once as `key` (for uses) with a clip path of it. */
const shape = (m, key, d) => `<defs><path id="${m.p}-${key}d" d="${d}"/></defs><clipPath id="${m.p}-${key}"><use href="#${m.p}-${key}d"/></clipPath>`;
const volumeAgain = (m, key, w = 9, o = 0.5) => {
  const u = `href="#${m.p}-${key}d"`;
  return `<g clip-path="url(#${m.p}-${key})" fill="none">
    <use ${u} stroke="#000" stroke-width="${f(w)}" opacity="${o}" transform="translate(${f(-w * 0.42)} ${f(-w * 0.5)})" filter="url(#${m.p}-blur)"/>
    <use ${u} stroke="#fff" stroke-width="${f(w * 0.5)}" opacity="${f(o * 0.8)}" transform="translate(${f(w * 0.36)} ${f(w * 0.42)})" filter="url(#${m.p}-blur)"/>
    <use ${u} stroke="#fff" stroke-width="1.6" opacity=".38" transform="translate(-1 -1.2)"/></g>`;
};

/** A mirrored copy of a right-hand half outline, closed through the axis. */
const both = (half) => smooth([...half, ...half.slice(1, -1).reverse().map(([x, y]) => [-x, y])], true);

/** One wing of the hawk (the right; the left is its mirror), about the hawk's chest at (0,0). */
function wing(m, detail) {
  // the wing's leading edge bows up towards the head from the shoulder to the wrist
  const arm = sample([[12, -24], [27, -51], [44, -80], [63, -104]], 10);
  const n = 17, flight = [], veins = [], greater = [], median = [];
  for (let i = n - 1; i >= 0; i--) {
    const u = i / (n - 1), inner = u < 0.5;
    const deg = inner ? 80 - 98 * u : 31 - 200 * (u - 0.5);
    const L = u < 0.78 ? 46 + 38 * u : 75.6 - (u - 0.78) * 55;
    const base = along(arm, u * 0.97);
    const fw = feather(base, deg, L, inner ? 15 : 12, inner ? 8 : 5.5, inner ? 0.75 : 0.35);
    flight.push(`<path d="${fw.d}"/>`);
    veins.push(fw.rachis);
    const gb = add(base, mul(normal([Math.cos(rad(deg)), Math.sin(rad(deg))]), 2));
    greater.push(`<path d="${feather(gb, deg + 3, L * 0.5, 13, 9, 0.9).d}"/>`);
    if (i % 3 === 0) median.push(`<path d="${feather(add(gb, mul(unit(sub(arm[0], gb)), 2)), deg + 6, L * 0.3, 11, 8, 1).d}"/>`);
  }
  // the lesser coverts: rows of small rounded feathers over the arm's trailing side
  const lesser = [];
  for (let i = 1; i < arm.length - 2; i += detail ? 1 : 2) {
    const u = i / (arm.length - 1), deg = 80 - 120 * u;
    lesser.push(`<path d="${feather(add(arm[i], mul(normal(sub(arm[i + 1], arm[i - 1])), -3)), deg, 13 - 4 * u, 6, 5, 1).d}"/>`);
  }
  return `<g fill="url(#${m.p}-fdark)">${flight.join('')}</g>
    ${detail ? `<path d="${veins.join('')}" ${line(m.detail, 0.9, 0.7)}/>` : ''}
    <g fill="url(#${m.p}-fmid)">${greater.join('')}</g>
    <g fill="url(#${m.p}-flight)">${median.join('')}</g>
    <g fill="url(#${m.p}-fmid)" stroke-width=".7">${lesser.join('')}</g>
    <path d="${tube(arm, (s) => 12 - 6 * s + 3 * Math.sin(Math.PI * s), 1)}" fill="url(#${m.p}-flight)"/>`;
}

/**
 * The Atreides hawk displayed: wings raised, tail fanned and barred, legs tucked under with the talons curled, head
 * in profile to the left.
 */
export function hawk(m, { detail = true } = {}) {
  const w = wing(m, detail);
  const tail = [-27, -18, -9, 0, 9, 18, 27].map((a) => feather([0, 52], 90 + a, 58 - Math.abs(a) * 0.3, 8, 8, 0.3).d);
  const bars = detail ? [26, 38, 50].map((r) => `M${pt(add([0, 52], mul(turn([1, 0], 58), r)))}A${r} ${r} 0 0 1 ${pt(add([0, 52], mul(turn([1, 0], 122), r)))}`).join('') : '';
  const body = both([[0, -46], [13, -43], [23, -28], [27, -6], [25, 18], [19, 40], [11, 56], [0, 64]]);
  const halfAt = (y) => (y < -28 ? 13 + (y + 43) * 0.67 : y < -6 ? 23 + (y + 28) * 0.18 : y < 18 ? 27 - (y + 6) * 0.08 : y < 40 ? 25 - (y - 18) * 0.27 : 19 - (y - 40) * 0.5);
  // the breast: rows of scalloped feathers, small under the throat and larger towards the belly, each row bowed
  // with the rounded chest
  let breast = '';
  if (detail) {
    const rows = [];
    for (let r = 0, y = -34; y < 54; r++) { const h = 4.6 + r * 0.55; rows.push([r, y, h]); y += h; }
    for (const [r, y0, h] of rows.reverse()) {
      const hw = 2.4 + r * 0.32, half = halfAt(y0 + h * 0.5) - 1, off = r % 2 ? hw : 0;
      for (let x = -half + off; x <= half; x += hw * 2) {
        const y = y0 + 2.6 * (1 - (x / half) ** 2);
        breast += `<path d="M${f(x - hw)} ${f(y)}C${f(x - hw)} ${f(y + h * 0.6)} ${f(x - hw * 0.4)} ${f(y + h * 0.95)} ${f(x)} ${f(y + h * 1.1)}C${f(x + hw * 0.4)} ${f(y + h * 0.95)} ${f(x + hw)} ${f(y + h * 0.6)} ${f(x + hw)} ${f(y)}Z"/>`;
      }
    }
  }
  // the neck: a ruff of pointed hackles from under the head, fanning out over the shoulders
  const hackles = [];
  for (const [y, l, k] of [[-50, 15, 1], [-46, 12, 0.5]]) {
    for (let x = -18 + (k < 1 ? 3 : 0); x <= 18; x += 6) hackles.push(`<path d="${feather([x, y], 90 - x * 2.2, l, 4.2, 4.2, 0.1).d}"/>`);
  }
  // the legs tucked under the body: feathered thighs, then the feet gripping, talons curled under
  const thigh = smooth([[6, 24], [21, 25], [28, 37], [28, 50], [25, 61], [22, 57], [19, 64], [16, 58], [12, 61], [8, 48]], true);
  const toe = (ankle, deg, l, bend = 1) => {
    const tip = add(ankle, mul([Math.cos(rad(deg)), Math.sin(rad(deg))], l));
    const mid = add(lerp(ankle, tip, 0.55), mul(normal(sub(tip, ankle)), 2.2 * bend));
    const claw = add(tip, mul(turn(unit(sub(tip, mid)), 80 * bend), 6.5));
    return { toe: `M${pt(ankle)}Q${pt(mid)} ${pt(tip)}`, claw: `M${pt(tip)}Q${pt(add(tip, mul(unit(sub(tip, mid)), 4.5)))} ${pt(claw)}` };
  };
  const ankle = [18, 71], toes = [toe(ankle, 42, 14), toe(ankle, 76, 16), toe(ankle, 108, 14, -1), toe(ankle, 150, 9, -1)];
  const legPath = `M18 60L${pt(ankle)}${toes.map((t) => t.toe).join('')}`;
  const leg = `<path d="${legPath}" fill="none" stroke="${m.ink}" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${legPath}" fill="none" stroke="${m.light[1]}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${toes.map((t) => t.claw).join('')}" fill="none" stroke="${m.ink}" stroke-width="3" stroke-linecap="round"/>`;
  const thighs = `<path d="${thigh}"/>`;
  const plumes = detail ? `<path d="M12 34Q15 46 13 58M17 33Q21 46 19 60M22 38Q24 48 22 58" ${line(m.detail, 0.8, 0.6)}/>` : '';
  const head = smooth([[13, -50], [16, -60], [12, -70], [2, -76], [-9, -75], [-17, -69], [-21, -64], [-21, -57], [-17, -52], [-12, -46], [-8, -40], [0, -42], [8, -44]], true);
  const beak = smooth([[-20, -66], [-26, -66.5], [-31, -63], [-34, -57], [-34.5, -51], [-32.5, -47], [-31, -51], [-28, -54.5], [-24, -56.5], [-20, -57.5]], true);
  const jaw = smooth([[-20, -57.5], [-26, -55.5], [-29, -52.5], [-25, -51.5], [-19, -52.5]], true);
  return `<g stroke="${m.ink}" stroke-width="1.1" stroke-linejoin="round">
    <g fill="url(#${m.p}-fdark)">${tail.map((d) => `<path d="${d}"/>`).join('')}</g>
    ${detail ? `<path d="${bars}" ${line(m.detail, 1.6, 0.6)}/>` : ''}
    ${w}${mirror(w, 0)}
    ${shape(m, 'hb', body)}<use href="#${m.p}-hbd" fill="url(#${m.p}-flight)"/>
    ${detail ? `<g clip-path="url(#${m.p}-hb)" fill="url(#${m.p}-flight)" stroke="${m.detail}" stroke-width=".55">${breast}</g>` : ''}
    ${volumeAgain(m, 'hb', 9, 0.45)}
    ${leg}${mirror(leg, 0)}
    <g fill="url(#${m.p}-fmid)">${thighs}${mirror(thighs, 0)}</g>${plumes}${plumes ? mirror(plumes, 0) : ''}
    <g fill="url(#${m.p}-fmid)" stroke-width=".7">${hackles.join('')}</g>
    <g transform="translate(0 -58) scale(1.14) translate(0 58)">
      <path d="${head}" fill="url(#${m.p}-flight)"/>
      <path d="M-12 -61C-8 -61 -7 -57 -8.5 -52C-9.5 -48 -11 -45 -13 -44C-15 -48 -15 -52 -14.5 -56C-14 -59 -13.5 -61 -12 -61Z" fill="url(#${m.p}-fdark)" stroke-width=".7"/>
      <path d="${jaw}" fill="url(#${m.p}-fmid)"/>
      <path d="${beak}" fill="url(#${m.p}-fdark)"/>
      <path d="M-20 -66Q-23 -62 -20 -57.5" fill="none" stroke-width="1.2"/>
      <path d="M-19.5 -68.5C-14 -72.5 -6 -73 0.5 -69.5C-5 -70 -11 -69.5 -16 -66.5Z" fill="url(#${m.p}-fdark)" stroke-width=".8"/>
      <circle cx="-9.5" cy="-63.8" r="4.1" fill="${m.eye}" stroke-width="1.3"/><circle cx="-10.9" cy="-65.2" r="1.25" fill="#fff" stroke="none"/>
      ${detail ? `<path d="M3 -71Q8 -64 7 -55M8 -67Q12 -60 11 -52M-2 -72Q2 -66 1 -61" ${line(m.detail, 0.8, 0.6)}/>` : ''}
    </g>
  </g>`;
}

/** One horn of the ram (the right): a tapering spiral tube with doubled growth rings; { d, markup }. */
function horn(m, detail) {
  const spine = spiral([52, -4], 52, 9, -134, 1.12, 72);
  const width = (s) => 34 * (1 - s) ** 0.85 + 5;
  const { left, right, s } = edges(spine, width);
  const d = tube(spine, width, 2);
  let rings = '';
  if (detail) {
    for (let i = 3; i < spine.length - 3; i += 3) {
      const bow = mul(unit(sub(spine[i + 1], spine[i - 1])), 3 * (1 - s[i]));
      rings += `M${pt(left[i])}Q${pt(add(spine[i], bow))} ${pt(right[i])}`;
    }
  }
  return { d, markup: `<use href="#${m.p}-rhd" fill="url(#${m.p}-horn)"/>${volumeAgain(m, 'rh', 10, 0.5)}
    ${detail ? `<path d="${rings}" ${line(m.ink, 1.4, 0.85)}/><path d="${rings}" ${line(m.light[0], 0.9, 0.4)} transform="translate(-1.2 -1)"/>` : ''}` };
}

/**
 * The Harkonnen ram's head, full face, in dark iron: horns curled, a short wedge of a face with a Roman-nose ridge,
 * a heavy ridged brow over narrow slit eyes (their glow is ramGlow, drawn over the relief light), layered locks of
 * wool on the poll and slit nostrils on a blunt muzzle.
 */
export function ram(m, { detail = true } = {}) {
  const ear = `<path d="${smooth([[24, 2], [40, 6], [58, 17], [55, 24], [38, 21], [25, 12]], true)}" fill="url(#${m.p}-fdark)"/>`;
  const face = both([[0, -48], [14, -46], [24, -36], [28, -20], [27, -4], [23, 12], [18, 27], [15, 38], [12, 46], [6, 51], [0, 52]]);
  // the Roman nose: a raised ridge from the brow to the muzzle, broadening as it falls
  const ridge = both([[0, -22], [4, -18], [6, 2], [8, 24], [10, 36], [6, 41], [0, 42]]);
  const muzzle = both([[0, 36], [9, 35], [13, 41], [11, 48], [6, 52], [0, 53]]);
  const nostril = `<path d="M3.5 41.5Q8 41 10.5 45.5Q7.5 44.5 4.5 45Z" fill="${m.ink}" stroke-width=".6"/>`;
  // the brow: a heavy ridge sloping down to the nose, its creases cut across
  const brow = `<path d="${smooth([[3, -12], [12, -21], [24, -25], [32, -20], [30, -14], [18, -13], [7, -6]], true)}" fill="url(#${m.p}-fdark)"/>`;
  const creases = detail ? '<path d="M9 -14.5L13 -19.5M15 -15L19 -22M21 -15L25 -23M27 -16L30 -21" fill="none" stroke-width=".9" opacity=".8"/>' : '';
  const socket = `<path d="M6 -4L15 -11.5L29 -12L26 -5.5L13 -1Z" fill="${m.ink}" stroke="none"/>`;
  const eye = `<path d="${RAM_EYE}" fill="url(#${m.p}-eye)" stroke-width=".7"/>`;
  // wool: two rows of heavy curled locks on the poll, hanging over the brow
  const lockAt = ([x, y], k, flip) => {
    const pts = [[-6, 0], [-7.5, 6], [-4, 12.5], [1.5, 16], [0, 9.5], [4.5, 6], [6.5, 0], [0, -3]].map(([a, b]) => [x + (flip ? -a : a) * k, y + b * k]);
    return `<path d="${smooth(pts, true)}"/>`;
  };
  const back = [[-17, -46], [-6, -49], [6, -49], [17, -46]].map((q, i) => lockAt(q, 1.05, i < 2)).join('');
  const front = [[-11, -40], [0, -42], [11, -40]].map((q, i) => lockAt(q, 1.1, i === 0)).join('');
  const { d: hornD, markup: h } = horn(m, detail);
  return `<g stroke="${m.ink}" stroke-width="1.2" stroke-linejoin="round">
    ${shape(m, 'rh', hornD)}
    ${ear}${mirror(ear, 0)}
    <path d="${face}" fill="url(#${m.p}-fmid)"/>${volume(m, 'rf', face, 11, 0.55)}
    <path d="${ridge}" fill="url(#${m.p}-flight)" stroke="none" opacity=".9"/>
    <path d="M0 -18V38" ${line(m.light[0], 1.4, 0.45)}/>
    ${detail ? `<path d="M-25 2Q-21 16 -12 33M25 2Q21 16 12 33M-9 -2Q-8 16 -10 34M9 -2Q8 16 10 34" ${line(m.ink, 0.9, 0.5)}/>` : ''}
    <path d="${muzzle}" fill="url(#${m.p}-fdark)" stroke-width="1"/>
    ${nostril}${mirror(nostril, 0)}
    <path d="M-5 49.5Q0 48 5 49.5" fill="none" stroke-width="1"/>
    ${h}${mirror(h, 0)}
    ${socket}${mirror(socket, 0)}${eye}${mirror(eye, 0)}
    ${brow}${mirror(brow, 0)}${creases}${creases ? mirror(creases, 0) : ''}
    <g fill="url(#${m.p}-fdark)">${back}</g><g fill="url(#${m.p}-fmid)">${front}</g>
    ${detail ? `<path d="M-14 -40Q-12 -34 -9 -31M-3 -42Q-1 -36 2 -33M8 -40Q10 -34 13 -31M-20 -45Q-19 -40 -16 -38M14 -47Q17 -42 20 -41" ${line(m.ink, 0.9, 0.6)}/>` : ''}
  </g>`;
}

/** The ram's slit eye (the right), shared by the charge and its glow. */
const RAM_EYE = 'M8 -4.5L16 -9.5L27 -10L23.5 -6.5L13 -3Z';

/** The ram's eyes burning: drawn over the relief light, a bright slit in a soft red-orange halo. */
export function ramGlow(m) {
  const one = `<path d="${RAM_EYE}" fill="#ff7a1a" opacity=".55" stroke="#ff3a00" stroke-width="3" stroke-linejoin="round" filter="url(#${m.p}-glow)"/>
    <path d="${RAM_EYE}" fill="url(#${m.p}-eye)"/><path d="M12 -5.6L17.5 -8.4L23.5 -8.6" fill="none" stroke="#fff6c8" stroke-width="1.1" stroke-linecap="round" opacity=".9"/>`;
  return `${one}${mirror(one, 0)}`;
}

/** The Ordos serpent rearing: a scaled tapering body in an S over its coiled tail, a viper's head to the left. */
export function serpent(m, { detail = true } = {}) {
  // the S fills the heater shield: the neck arched high to the right, the body across to the left, the tail
  // coiled where the shield narrows
  const spine = sample([[-16, -72], [14, -74], [42, -60], [52, -34], [30, -8], [-10, 8], [-40, 28], [-40, 54], [-18, 70], [10, 72], [34, 58], [40, 36], [26, 24], [12, 32], [14, 48], [28, 48]], 10);
  // a slim neck behind the head, the body swelling to its middle and tapering to a fine tail
  const width = (s) => (s < 0.08 ? 20 - s * 60 : s < 0.38 ? 15.2 + ((s - 0.08) / 0.3) * 20.8 : 36 * (1 - (s - 0.38) / 0.62) ** 1.1 + 2.5);
  const { left, right, s } = edges(spine, width);
  const body = tube(spine, width, 2);
  const belly = smooth([...right.filter((_, i) => i % 2 === 0), ...spine.map((p, i) => lerp(right[i], p, 0.45)).filter((_, i) => i % 2 === 0).reverse()], true);
  let scutes = '', marks = '';
  if (detail) {
    for (let i = 3; i < spine.length - 8; i += 3) scutes += `M${pt(lerp(right[i], spine[i], 0.45))}L${pt(right[i])}`;
    for (let i = 7; i < spine.length - 16; i += 8) {
      const t = unit(sub(spine[i + 1], spine[i - 1])), nrm = normal(t), c = lerp(spine[i], left[i], 0.22), w = width(s[i]) * 0.24;
      marks += `M${pt(add(c, mul(t, -w * 1.7)))}L${pt(add(c, mul(nrm, w)))}L${pt(add(c, mul(t, w * 1.7)))}L${pt(add(c, mul(nrm, -w)))}Z`;
    }
  }
  const head = smooth([[-8, -82], [-30, -88], [-48, -86], [-62, -79], [-69, -71], [-66, -64], [-52, -59], [-34, -57], [-14, -60], [-5, -70]], true);
  return `<g stroke="${m.ink}" stroke-width="1.2" stroke-linejoin="round">
    <path d="M-67 -66L-78 -64M-78 -64L-85 -69M-78 -64L-84 -58" fill="none" stroke="${m.accent}" stroke-width="2.2" stroke-linecap="round"/>
    ${shape(m, 'sb', body)}<use href="#${m.p}-sbd" fill="url(#${m.p}-flight)"/>
    ${detail ? `<use href="#${m.p}-sbd" fill="url(#${m.p}-scales)" stroke="none"/>` : ''}
    <path d="${belly}" fill="url(#${m.p}-belly)" stroke-width=".8"/>
    ${detail ? `<path d="${scutes}" ${line(m.ink, 0.9, 0.6)}/><path d="${marks}" fill="url(#${m.p}-fdark)" stroke="${m.belly[1]}" stroke-width="1"/>` : ''}
    ${volumeAgain(m, 'sb', 11, 0.55)}
    <path d="${head}" fill="url(#${m.p}-flight)"/>${volume(m, 'sh', head, 8, 0.45)}
    <path d="M-62 -64L-60 -58.5L-57.5 -63.5ZM-55 -62.5L-53.5 -57.5L-51 -62Z" fill="#fff8e8" stroke-width=".6"/>
    <path d="M-67 -66Q-50 -63 -30 -62" fill="none" stroke-width="1.4"/>
    <path d="M-50 -83C-44 -86.5 -36 -86.5 -30 -82.5C-36 -81.5 -43 -81 -48.5 -79Z" fill="url(#${m.p}-fmid)" stroke-width=".8"/>
    <ellipse cx="-41" cy="-75" rx="5" ry="4.3" fill="url(#${m.p}-eye)" stroke-width="1.1"/><path d="M-41 -78.6V-71.4" stroke="#000" stroke-width="1.5"/>
    <circle cx="-62" cy="-74" r="1.3" fill="${m.ink}" stroke="none"/>
    ${detail ? `<path d="M-26 -84Q-20 -76 -22 -64M-18 -82Q-13 -74 -15 -62M-56 -80Q-50 -76 -46 -80" ${line(m.ink, 0.8, 0.55)}/>` : ''}
  </g>`;
}

/**
 * The Emperor's lion, full face (Sardaukar): a heavy mane of swept locks in three rows, longer towards the chin,
 * round a stern face: brows drawn down, a broad nose, the muzzle closed with its corners turned down.
 */
export function lion(m, { detail = true } = {}) {
  // a lock of the mane from radius r0 to r1 at angle a (clockwise from up), its tip swept down the sides
  const lock = (r0, r1, w, a) => {
    const sw = 17 * Math.sin(rad(a)), mid = (r0 + r1) / 2;
    return `<path d="M${pt(turn([-w * 0.5, -r0], a))}Q${pt(turn([-w * 0.75 + sw * 0.3, -mid], a))} ${pt(turn([sw, -r1], a))}Q${pt(turn([w * 0.65 + sw * 0.5, -mid + 2], a))} ${pt(turn([w * 0.5, -r0], a))}Z"/>`;
  };
  const reach = (a, r) => r + 12 * (1 - Math.cos(rad(a))) / 2;
  const row = (n, r0, r1, w, off) => Array.from({ length: n }, (_, i) => { const a = (i + off) * (360 / n); return lock(r0, reach(a, r1), w, a); }).join('');
  const face = both([[0, -42], [17, -40], [30, -29], [36, -10], [35, 12], [27, 32], [14, 45], [0, 48]]);
  const eye = `<path d="M8 -6L21 -12.5L26 -8L13 -2.5Z" fill="url(#${m.p}-eye)" stroke-width="1"/><circle cx="18" cy="-7.5" r="2.4" fill="${m.ink}" stroke="none"/>
    <path d="M3 -11L15 -20.5L29 -20L30 -14L17 -13L7 -6Z" fill="url(#${m.p}-fdark)"/>`;
  const pad = `<path d="M0 21C-3 18 -12 18 -16 24C-19 30 -12 35 -4 33C-2 32.5 -1 31.5 0 30Z" fill="url(#${m.p}-fmid)" stroke-width=".9"/>`;
  return `<g stroke="${m.ink}" stroke-width="1.1" stroke-linejoin="round">
    <g fill="url(#${m.p}-fdark)">${row(18, 40, 84, 30, 0.5)}</g><g fill="url(#${m.p}-fmid)">${row(18, 36, 70, 26, 0)}</g>
    <g fill="url(#${m.p}-flight)">${row(16, 33, 52, 18, 0.5)}</g>
    <path d="${face}" fill="url(#${m.p}-flight)"/>${volume(m, 'lf', face, 9, 0.45)}
    ${detail ? `<path d="M0 -36V-4M-3 -34Q-6 -22 -5 -8M3 -34Q6 -22 5 -8" ${line(m.ink, 1, 0.6)}/>` : ''}
    ${eye}${mirror(eye, 0)}
    ${pad}${mirror(pad, 0)}
    <path d="M-11 12L11 12L7 20L0 23L-7 20Z" fill="${m.ink}"/>
    <path d="M0 23V30M-12 36Q-6 32.5 0 33Q6 32.5 12 36" fill="none" stroke-width="1.6"/>
    <path d="M-9 37Q0 43 9 37Q6 45 0 46Q-6 45 -9 37Z" fill="url(#${m.p}-fmid)" stroke-width=".9"/>
    ${detail ? `<path d="M-21 25q-6 3 -11 1M21 25q6 3 11 1M-21 30q-6 4 -11 3M21 30q6 4 11 3" ${line(m.ink, 1, 0.7)}/>` : ''}
  </g>`;
}

/** Crossed swords over a coin (the Mercenaries). */
export function swords(m, { detail = true } = {}) {
  const b = detail ? 4 : 6.5;   // the blades broader on the small shield, so they still read at badge size
  const sword = `<g>
    <path d="M${-b} -80L0 ${-80 - 3.5 * b}L${b} -80L${b} 38L${-b} 38Z" fill="url(#${m.p}-blade)"/>
    ${detail ? `<path d="M0 -86V34" ${line(m.detail, 0.8, 0.6)}/>` : ''}
    <path d="M-24 38Q0 30 24 38L22 46Q0 41 -22 46Z" fill="url(#${m.p}-flight)"/>
    <rect x="-4" y="46" width="8" height="22" rx="2" fill="url(#${m.p}-fdark)"/>
    <circle cx="0" cy="73" r="7" fill="url(#${m.p}-flight)"/>
  </g>`;
  const teeth = detail ? `<path d="${Array.from({ length: 36 }, (_, i) => `M${pt(turn([0, -39], i * 10))}L${pt(turn([0, -45], i * 10))}`).join('')}" fill="none"/>` : '';
  return `<g stroke="${m.ink}" stroke-width="1.1" stroke-linejoin="round">
    <circle r="48" fill="url(#${m.p}-flight)"/><circle r="38" fill="url(#${m.p}-fmid)" stroke-width="1.4"/>${teeth}
    <g transform="rotate(-38)">${sword}</g><g transform="rotate(38)">${sword}</g></g>`;
}

/** A crysknife, point up, inside a sandworm's ringed maw (the Fremen). */
export function crysknife(m, { detail = true } = {}) {
  const blade = smooth([[0, -94], [10, -66], [14, -32], [10, 0], [6, 18], [-6, 18], [-8, 0], [-6, -32], [-4, -66]], true);
  // the maw: a ringed rim, then two rows of inward-curving teeth round the dark throat
  const row = (n, r0, l, w, off) => Array.from({ length: n }, (_, i) => {
    const a = (i + off) * (360 / n);
    return `<path d="M${pt(turn([-w, -r0], a))}Q${pt(turn([-w * 0.2, -r0 + l * 0.55], a))} ${pt(turn([w * 0.5, -r0 + l], a))}Q${pt(turn([w * 0.5, -r0 + l * 0.4], a))} ${pt(turn([w, -r0], a))}Z"/>`;
  }).join('');
  const rims = detail ? Array.from({ length: 4 }, (_, i) => `<circle r="${80 - i * 3.2}"/>`).join('') : '';
  return `<g stroke="${m.ink}" stroke-width="1.1" stroke-linejoin="round">
    <circle r="86" fill="url(#${m.p}-fmid)"/><g ${line(m.detail, 1, 0.55)}>${rims}</g>
    <circle r="68" fill="url(#${m.p}-throat)"/>
    <g fill="url(#${m.p}-blade)">${row(28, 68, 18, 4.6, 0)}${row(28, 52, 12, 3.4, 0.5)}</g>
    <path d="${blade}" fill="url(#${m.p}-blade)" transform="translate(0 6)"/>
    ${detail ? `<path d="M2 -80Q8 -40 2 18" ${line(m.detail, 0.8, 0.5)}/>` : ''}
    <path d="M-20 24Q0 18 20 24L18 32Q0 28 -18 32Z" fill="url(#${m.p}-flight)"/>
    <rect x="-5" y="32" width="10" height="26" rx="3" fill="url(#${m.p}-fdark)"/>
    <circle cx="0" cy="62" r="7" fill="url(#${m.p}-flight)"/>
  </g>`;
}
