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
  const arm = sample([[12, -24], [31, -48], [49, -77], [63, -104]], 10);
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
  let lesser = '';
  if (detail) {
    for (let i = 2; i < arm.length - 3; i += 2) {
      const p = arm[i], t = unit(sub(arm[i + 1], arm[i - 1])), nrm = normal(t);
      lesser += `M${pt(add(p, mul(t, -4)))}Q${pt(add(p, mul(nrm, -6)))} ${pt(add(p, mul(t, 4)))}`;
    }
  }
  return `<g fill="url(#${m.p}-fdark)">${flight.join('')}</g>
    ${detail ? `<path d="${veins.join('')}" ${line(m.detail, 0.9, 0.7)}/>` : ''}
    <g fill="url(#${m.p}-fmid)">${greater.join('')}</g>
    <g fill="url(#${m.p}-flight)">${median.join('')}</g>
    <path d="${tube(arm, (s) => 14 - 7 * s, 1)}" fill="url(#${m.p}-flight)"/>
    ${detail ? `<path d="${lesser}" ${line(m.detail, 0.8, 0.7)}/>` : ''}`;
}

/** The Atreides hawk displayed: wings raised, tail fanned and barred, talons out, head in profile to the left. */
export function hawk(m, { detail = true } = {}) {
  const w = wing(m, detail);
  const tail = [-27, -18, -9, 0, 9, 18, 27].map((a) => feather([0, 52], 90 + a, 58 - Math.abs(a) * 0.3, 8, 8, 0.3).d);
  const bars = detail ? [26, 38, 50].map((r) => `M${pt(add([0, 52], mul(turn([1, 0], 58), r)))}A${r} ${r} 0 0 1 ${pt(add([0, 52], mul(turn([1, 0], 122), r)))}`).join('') : '';
  const body = both([[0, -46], [12, -42], [23, -26], [28, -2], [25, 26], [16, 50], [8, 62], [0, 66]]);
  let breast = '';
  if (detail) {
    for (let r = 10; r >= 0; r--) {
      const y = -32 + r * 7.6, half = 24 - Math.abs(r - 4) * 1.6, off = r % 2 ? 3.6 : 0;
      for (let x = -half + off; x <= half; x += 7.2) breast += `<path d="M${f(x - 3.6)} ${f(y)}C${f(x - 3.6)} ${f(y + 4.5)} ${f(x - 1.5)} ${f(y + 7)} ${f(x)} ${f(y + 8)}C${f(x + 1.5)} ${f(y + 7)} ${f(x + 3.6)} ${f(y + 4.5)} ${f(x + 3.6)} ${f(y)}Z"/>`;
    }
  }
  const thigh = smooth([[10, 28], [24, 34], [34, 48], [37, 62], [31, 57], [29, 65], [23, 59], [18, 64], [12, 52]], true);
  const toe = (ankle, deg, l) => {
    const tip = add(ankle, mul([Math.cos(rad(deg)), Math.sin(rad(deg))], l));
    const mid = add(lerp(ankle, tip, 0.55), mul(normal(sub(tip, ankle)), 2.5));
    const claw = add(tip, mul(turn(unit(sub(tip, mid)), 75), 7.5));
    return { toe: `M${pt(ankle)}Q${pt(mid)} ${pt(tip)}`, claw: `M${pt(tip)}Q${pt(add(tip, mul(unit(sub(tip, mid)), 5)))} ${pt(claw)}` };
  };
  const ankle = [38, 70], toes = [toe(ankle, 20, 19), toe(ankle, 52, 21), toe(ankle, 86, 17), toe(ankle, 200, 11)];
  const legPath = `M33 60L${pt(ankle)}${toes.map((t) => t.toe).join('')}`;
  const leg = `<path d="${legPath}" fill="none" stroke="${m.ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${legPath}" fill="none" stroke="${m.light[1]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${toes.map((t) => t.claw).join('')}" fill="none" stroke="${m.ink}" stroke-width="3.2" stroke-linecap="round"/>`;
  const thighs = `<path d="${thigh}"/>`;
  const head = smooth([[13, -50], [16, -60], [12, -70], [2, -76], [-9, -75], [-17, -69], [-21, -64], [-21, -57], [-17, -52], [-12, -46], [-8, -40], [0, -42], [8, -44]], true);
  const beak = smooth([[-20, -66], [-26, -66.5], [-31, -63], [-34, -57], [-34.5, -51], [-32.5, -47], [-31, -51], [-28, -54.5], [-24, -56.5], [-20, -57.5]], true);
  const jaw = smooth([[-20, -57.5], [-26, -55.5], [-29, -52.5], [-25, -51.5], [-19, -52.5]], true);
  return `<g stroke="${m.ink}" stroke-width="1.1" stroke-linejoin="round">
    <g fill="url(#${m.p}-fdark)">${tail.map((d) => `<path d="${d}"/>`).join('')}</g>
    ${detail ? `<path d="${bars}" ${line(m.detail, 1.6, 0.6)}/>` : ''}
    ${w}${mirror(w, 0)}
    ${leg}${mirror(leg, 0)}
    <g fill="url(#${m.p}-fmid)">${thighs}${mirror(thighs, 0)}</g>
    ${shape(m, 'hb', body)}<use href="#${m.p}-hbd" fill="url(#${m.p}-flight)"/>
    ${detail ? `<g clip-path="url(#${m.p}-hb)" fill="url(#${m.p}-flight)" stroke="${m.detail}" stroke-width=".55">${breast}</g>` : ''}
    ${volumeAgain(m, 'hb', 9, 0.45)}
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

/** The Harkonnen ram's head, full face: horns curled, a dark mask round burning eyes, wool on the brow. */
export function ram(m, { detail = true } = {}) {
  const ear = `<path d="${smooth([[24, 4], [40, 8], [60, 20], [56, 27], [38, 24], [25, 14]], true)}" fill="url(#${m.p}-fmid)"/>`;
  const face = both([[0, -46], [13, -44], [22, -34], [26, -18], [27, -2], [23, 16], [18, 34], [16, 48], [13, 58], [7, 65], [0, 67]]);
  const mask = `<path d="${smooth([[4, -6], [16, -17], [30, -13], [31, 3], [17, 9], [6, 4]], true)}" fill="url(#${m.p}-fdark)" stroke-width=".8"/>`;
  const eye = `<path d="M9 -2L17 -9.5L27.5 -7L23 1.5L14 2.5Z" fill="url(#${m.p}-eye)" stroke-width="1.1"/><path d="M15.5 -6.5L20 -6L18.5 -1L15 -1.5Z" fill="#200" stroke="none"/>`;
  const brow = `<path d="M2.5 -12L30 -19L32 -12L6 -7.5Z" fill="url(#${m.p}-fdark)"/>`;
  let wool = '';
  if (detail) for (const [x, y] of [[0, -38], [-10, -32], [10, -32], [-18, -24], [0, -26], [18, -24], [-9, -18], [9, -18], [-5, -40], [5, -40]]) wool += `M${f(x - 4)} ${f(y + 2)}a4.2 4.2 0 1 1 6 3.4`;
  const nostril = `<path d="M4.5 53.5q4.5 -1.5 5.5 4q-2.5 2.5 -5.5 -1Z" fill="${m.ink}"/>`;
  const { d: hornD, markup: h } = horn(m, detail);
  return `<g stroke="${m.ink}" stroke-width="1.2" stroke-linejoin="round">
    ${shape(m, 'rh', hornD)}
    ${ear}${mirror(ear, 0)}
    <path d="${face}" fill="url(#${m.p}-flight)"/>${volume(m, 'rf', face, 11, 0.5)}
    ${detail ? `<path d="M-9 4Q-12 28 -11 50M9 4Q12 28 11 50M-7 64Q0 70 7 64" ${line(m.detail, 1.1, 0.7)}/>` : '<path d="M-7 64Q0 70 7 64" fill="none"/>'}
    ${h}${mirror(h, 0)}
    ${mask}${mirror(mask, 0)}${eye}${mirror(eye, 0)}${brow}${mirror(brow, 0)}
    ${nostril}${mirror(nostril, 0)}
    ${detail ? `<path d="${wool}" ${line(m.ink, 1.5, 0.75)}/>` : ''}
  </g>`;
}

/** The Ordos serpent rearing: a scaled tapering body in an S over its coiled tail, a viper's head to the left. */
export function serpent(m, { detail = true } = {}) {
  const spine = sample([[-16, -70], [12, -72], [38, -58], [46, -32], [24, -8], [-14, 8], [-42, 30], [-38, 60], [-10, 78], [26, 78], [52, 58], [54, 32], [36, 20], [18, 32], [20, 50], [34, 50]], 10);
  const width = (s) => (s < 0.05 ? 19 + s * 120 : s < 0.32 ? 25 + (s - 0.05) * 34 : 34 * (1 - (s - 0.32) / 0.68) ** 0.9 + 2.5);
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

/** The Emperor's lion, full face (Sardaukar): a mane of flame-like locks round a broad face. */
export function lion(m, { detail = true } = {}) {
  const lock = (r0, r1, w, a) => {
    const l = turn([-w * 0.6, -(r0 + r1) / 2], a), rr = turn([w * 0.7, -(r0 + r1) / 2 + 2], a), tip = turn([w * 0.5, -r1], a);
    return `<path d="M${pt(turn([-w * 0.5, -r0], a))}Q${pt(l)} ${pt(tip)}Q${pt(rr)} ${pt(turn([w * 0.5, -r0], a))}Z"/>`;
  };
  const outer = Array.from({ length: 16 }, (_, i) => lock(40, 86, 26, i * 22.5 + 11)).join('');
  const inner = Array.from({ length: 16 }, (_, i) => lock(34, 68, 22, i * 22.5)).join('');
  const face = both([[0, -42], [18, -40], [32, -28], [38, -8], [36, 14], [26, 34], [12, 46], [0, 48]]);
  const eye = `<path d="M8 -10L22 -14L26 -8L13 -4Z" fill="url(#${m.p}-eye)" stroke-width="1"/><circle cx="17.5" cy="-9" r="2.6" fill="${m.ink}" stroke="none"/>
    <path d="M5 -18L26 -20L28 -15L8 -13Z" fill="url(#${m.p}-fdark)"/>`;
  return `<g stroke="${m.ink}" stroke-width="1.1" stroke-linejoin="round">
    <g fill="url(#${m.p}-fdark)">${outer}</g><g fill="url(#${m.p}-fmid)">${inner}</g>
    <path d="${face}" fill="url(#${m.p}-flight)"/>${volume(m, 'lf', face, 9, 0.4)}
    ${eye}${mirror(eye, 0)}
    <path d="M-10 14L10 14L6 22L0 25L-6 22Z" fill="${m.ink}"/>
    <path d="M0 25V31M-14 30Q-7 38 0 31Q7 38 14 30" fill="none" stroke-width="1.6"/>
    ${detail ? `<path d="M0 -36V8M-12 -30Q-6 -26 0 -30Q6 -26 12 -30M-20 20q-6 4 -10 2M20 20q6 4 10 2M-21 26q-6 4 -10 3M21 26q6 4 10 3" ${line(m.ink, 1, 0.7)}/>` : ''}
  </g>`;
}

/** Crossed swords over a coin (the Mercenaries). */
export function swords(m, { detail = true } = {}) {
  const sword = `<g>
    <path d="M-4 -80L0 -94L4 -80L4 38L-4 38Z" fill="url(#${m.p}-blade)"/>
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
