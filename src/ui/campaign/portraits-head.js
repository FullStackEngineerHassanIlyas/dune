// A head sculpted from signed distance fields (GLSL, head space: centimetres, origin at the middle of the skull, x to
// the head's left, y up, z out of the face), blocked in the way a sculptor builds one: the cranium with its flat
// temples and the frontal bone; the cheekbones and their arches back to the ears; the upper jaw under the nose; the
// lower jaw from under the ear to the chin; the soft mass of the cheek between them; the eye sockets under the brow
// ridge with the eyeballs and lids set in them, a crease over each upper lid; the nose (bridge, tip, wings,
// nostrils); the lips round the teeth; the ears. Every Mentat sets his own numbers (portraits-cyril.js, -radnor.js,
// -ammon.js) and may add his own forms (jowls, wrinkles, a smirk). Material ids: 1 skin, 2 eyeball.
import { g1, g3 } from './portraits-sdf.js';

const g2 = (a) => `vec2(${g1(a[0])}, ${g1(a[1])})`;

/** The default proportions (an adult man, landmarks after the usual anthropometry); a Mentat's numbers override. */
export const HEAD_DEFAULTS = {
  cranium: { c: [0, 2.7, -1.1], r: [7.25, 8.4, 9.4], side: 6.7 },
  forehead: { c: [0, 3.6, 3.3], r: [5.9, 5.4, 5.7], k: 2.6 },
  zygo: { c: [4.85, -0.9, 5.2], r: [1.7, 1.15, 2.2], k: 1.3, arch: [6.2, -0.7, 0.5] },
  maxilla: { c: [0, -4.7, 5.9], r: [3.5, 2.7, 3.5], k: 2.0 },
  cheek: { c: [3.5, -4.0, 4.4], r: [2.6, 3.0, 3.0], k: 2.0 },
  lower: { c: [0, -6.95, 3.4], r: [4.7, 3.5, 5.3], k: 2.2 },
  jaw: { condyle: [5.15, -2.2, -0.9], gonion: [4.55, -7.4, -0.2], mental: [1.9, -9.7, 6.9], r: 1.0, k: 2.4 },
  chin: { c: [0, -9.45, 7.6], r: [1.95, 1.65, 1.45], k: 1.3 },
  eye: { c: [3.2, 0.25, 6.55], r: 1.22, up: 0.46, dn: -0.45, tilt: 0.06, thick: 0.25, closedUp: -0.36, gaze: null },
  socket: { d: [0.1, 0.35, 1.45], r: [1.95, 1.35, 1.25], k: 0.9 },
  brow: { a: [0.7, 1.75, 8.55], b: [4.7, 1.75, 7.0], r: 0.7, k: 1.4 },
  crease: 0.5,
  nose: { radix: [0, 1.0, 8.35], tip: [0, -3.55, 10.85], bridge: [0.5, 0.72], tipR: [0.82, 0.76, 0.8], ala: [1.28, -3.85, 9.35], alaR: [0.66, 0.6, 0.88], width: 1.3, hump: 0 },
  mouth: { c: [0, -6.35, 8.7], w: 2.4, upper: 0.56, lower: 0.68, bend: 0.2, smirk: 0, open: 0.04, fold: 1 },
  ear: { c: [7.0, -1.1, -1.3], h: 3.0, w: 1.65, back: 0.3, flare: 0.4 },
};

const merge = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, typeof a[k] === 'object' && a[k] ? { ...a[k], ...(b?.[k] ?? {}) } : (b?.[k] ?? a[k])]));

/**
 * GLSL for a head: `vec2 headLocal(vec3 q)` (distance, material) in head space, and the eye constants the albedo
 * uses (EYE_C, EYE_R, EYE_DN, EYE_TILT, EYE_THICK, eyeUp(), gazeS(q), lipSpace(q)). `extra` is GLSL run on `d` (with
 * `q` and `s`, the point mirrored to x >= 0) before the lids go in: a Mentat's own forms. The upper lids close with
 * the uniform uClosed. `extraAll` runs on `d` everywhere (forms away from the face: a furrowed forehead, a fat neck).
 */
export function headGLSL(params = {}, extra = '', extraAll = '') {
  const P = merge(HEAD_DEFAULTS, params);
  const { cranium, forehead, zygo, maxilla, cheek, lower, jaw, chin, eye, socket, brow, nose, mouth, ear } = P;
  const tip = nose.tip;
  // the bridge ends inside the tip, so the two read as one form
  const bridgeEnd = [tip[0], tip[1] + 0.55, tip[2] - 0.55];
  return `
const vec3 EYE_C = ${g3(eye.c)};
const float EYE_R = ${g1(eye.r)};
const float EYE_DN = ${g1(eye.dn)};
const float EYE_TILT = ${g1(eye.tilt)};
const float EYE_THICK = ${g1(eye.thick)};
const vec3 GAZE_P = ${g3(eye.gaze?.[0] ?? [0, 0, 1])};
const vec3 GAZE_N = ${g3(eye.gaze?.[1] ?? [0, 0, 1])};
const vec3 MOUTH_C = ${g3(mouth.c)};
const float MOUTH_W = ${g1(mouth.w)};
// the gaze of the eye on the point's side, in the mirrored space (x >= 0)
vec3 gazeS(vec3 q) { return q.x >= 0.0 ? GAZE_P : vec3(-GAZE_N.x, GAZE_N.y, GAZE_N.z); }
float eyeUp() { return mix(${g1(eye.up)}, ${g1(eye.closedUp)}, uClosed); }
// the lips' space: centred on the mouth, bent round the teeth, a smirk lifting one corner (the head's left, +x)
vec3 lipSpace(vec3 q) {
  vec3 l = q - MOUTH_C;
  l.z += ${g1(mouth.bend)} * l.x * l.x;
  l.y += 0.1 * (1.0 - smoothstep(0.1, 0.55, abs(l.x))) * step(0.0, l.y);
  l.y -= ${g1(mouth.smirk)} * smoothstep(-0.3, MOUTH_W, l.x) * l.x * l.x / ${g1(mouth.w * mouth.w)};
  return l;
}
// a shallow groove along the segment a-b (in the face's x-y plane), w wide: 1 on the line, fading off it and at its ends
float groove(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float t = min(length(pa - ba * h) / w, 1.0);
  return (1.0 - t * t) * (1.0 - t * t) * smoothstep(0.0, 0.2, h) * smoothstep(1.0, 0.75, h);
}
// the bare skull (cranium and frontal bone, the temples flattened): what the hair lies on
float skullQ(vec3 q) {
  float d = sdEllipsoid(q - ${g3(cranium.c)}, ${g3(cranium.r)});
  d = smin(d, sdEllipsoid(q - ${g3(forehead.c)}, ${g3(forehead.r)}), ${g1(forehead.k)});
  return smax(d, abs(q.x) - ${g1(cranium.side)} - 0.25 * max(-q.y, 0.0), 2.4);
}
float earShape(vec3 e) {
  e = rx(${g1(-ear.back)}) * ry(${g1(ear.flare)}) * e;
  float d = sdEllipsoid(e - vec3(0.0, ${g1(ear.h * 0.12)}, 0.0), vec3(0.5, ${g1(ear.h * 0.86)}, ${g1(ear.w)}));
  d = smin(d, sdEllipsoid(e - vec3(-0.12, ${g1(-ear.h * 0.66)}, 0.25), vec3(0.42, ${g1(ear.h * 0.3)}, ${g1(ear.w * 0.48)})), 0.5);
  // the bowl inside the rim, and the fold of the rim
  d = smax(d, -sdEllipsoid(e - vec3(0.5, ${g1(-ear.h * 0.08)}, 0.15), vec3(0.38, ${g1(ear.h * 0.42)}, ${g1(ear.w * 0.5)})), 0.22);
  d = smax(d, -sdEllipsoid(e - vec3(0.56, ${g1(ear.h * 0.28)}, -0.1), vec3(0.26, ${g1(ear.h * 0.55)}, ${g1(ear.w * 0.7)})), 0.16);
  // the root, so the ear grows out of the head instead of sitting on it
  d = smin(d, sdEllipsoid(e - vec3(-0.6, ${g1(-ear.h * 0.1)}, -0.2), vec3(0.6, ${g1(ear.h * 0.6)}, ${g1(ear.w * 0.6)})), 0.4);
  return d;
}
float noseShape(vec3 q, vec3 s) {
  // the bridge: from between the eyes to inside the tip, narrower across than deep, so its sides slope into the face
  vec3 nq = vec3(q.x * ${g1(nose.width)}, q.y, q.z);
  float nz = sdRoundCone(nq, ${g3(nose.radix)}, ${g3(bridgeEnd)}, ${g1(nose.bridge[0])}, ${g1(nose.bridge[1])}) * ${g1(1 / nose.width)};
  ${nose.hump ? `nz = smin(nz, sdEllipsoid(q - ${g3([0, nose.radix[1] * 0.45 + tip[1] * 0.55 + 0.4, nose.radix[2] * 0.45 + tip[2] * 0.55 + 0.32])}, vec3(0.45, 1.0, 0.5)), ${g1(nose.hump)});` : ''}
  // the tip, a little flattened in front, its two halves just apart
  vec3 tq = q - ${g3([tip[0], tip[1], tip[2] - nose.tipR[2]])};
  float tp = sdEllipsoid(vec3(abs(tq.x) - 0.18, tq.y, tq.z), ${g3(nose.tipR)});
  nz = smin(nz, tp, 0.9);
  // the wings, set apart from the cheek by their crease, swelling back from the tip
  float ala = sdEllipsoid(s - ${g3(nose.ala)}, ${g3(nose.alaR)});
  nz = smin(nz, ala, 0.7);
  // the columella under the tip, down into the lip
  nz = smin(nz, sdCapsule(q, ${g3([0, tip[1] - 0.55, tip[2] - 0.75])}, ${g3([0, tip[1] - 1.0, tip[2] - 1.75])}, 0.28), 0.4);
  // the nostrils, opening downward
  nz = smax(nz, -sdEllipsoid(s - ${g3([nose.ala[0] * 0.48, tip[1] - 0.62, tip[2] - 1.35])}, vec3(0.34, 0.16, 0.5)), 0.16);
  return nz;
}
vec2 headLocal(vec3 q) {
  float bound = sdEllipsoid(q - vec3(0.0, -0.5, 0.6), vec3(10.0, 13.6, 13.0));
  if (bound > 2.5) return vec2(gShadow ? 1e5 : bound, 1.0);
  vec3 s = vec3(abs(q.x), q.y, q.z);
  // the cranium, its sides flattened at the temples, and the frontal bone
  float d = skullQ(q);
  // the cheekbones and the arches back to the ears
  d = smin(d, sdEllipsoid(s - ${g3(zygo.c)}, ${g3(zygo.r)}), ${g1(zygo.k)});
  d = smin(d, sdCapsule(s, ${g3([zygo.c[0] + 0.3, zygo.c[1] + 0.1, zygo.c[2] - 1.2])}, ${g3(zygo.arch)}, 0.22), 1.4);
  // the upper jaw under the nose
  d = smin(d, sdEllipsoid(q - ${g3(maxilla.c)}, ${g3(maxilla.r)}), ${g1(maxilla.k)});
  // the lower jaw: up to the ear, down to the angle, forward to the chin
  d = smin(d, sdEllipsoid(q - ${g3(lower.c)}, ${g3(lower.r)}), ${g1(lower.k)});
  float jw = sdCapsule(s, ${g3(jaw.condyle)}, ${g3(jaw.gonion)}, ${g1(jaw.r * 1.05)});
  jw = smin(jw, sdCapsule(s, ${g3(jaw.gonion)}, ${g3(jaw.mental)}, ${g1(jaw.r)}), 1.0);
  jw = smin(jw, sdEllipsoid(q - ${g3(chin.c)}, ${g3(chin.r)}), ${g1(chin.k)});
  d = smin(d, jw, ${g1(jaw.k)});
  // the soft cheek between the cheekbone, the jaw and the mouth
  d = smin(d, sdEllipsoid(s - ${g3(cheek.c)}, ${g3(cheek.r)}), ${g1(cheek.k)});
  // the face's small forms, only near the face
  if (q.z > 2.0 && q.y < 5.0 && s.x < 7.0) {
    // the eye sockets, under the brow ridge
    d = smax(d, -sdEllipsoid(s - (EYE_C + ${g3(socket.d)}), ${g3(socket.r)}), ${g1(socket.k)});
    d = smin(d, sdCapsule(s, ${g3(brow.a)}, ${g3(brow.b)}, ${g1(brow.r)}), ${g1(brow.k)});
    d = smin(d, noseShape(q, s), 0.55);
    // the crease round the back of each wing, and the fold from the wing past the corner of the mouth
    float front = smoothstep(5.0, 7.0, q.z);
    d += 0.06 * front * groove(s.xy, ${g2([nose.ala[0] + 0.1, nose.ala[1] + 0.75])}, ${g2([nose.ala[0] + nose.alaR[0] * 0.95, nose.ala[1] - 0.35])}, 0.2);
    d += ${g1(0.1 * mouth.fold)} * front * groove(s.xy, ${g2([nose.ala[0] + nose.alaR[0] * 1.05, nose.ala[1] + 0.15])}, ${g2([mouth.w + 0.65, mouth.c[1] - 1.3])}, 0.32);
    // the lips
    vec3 l = lipSpace(q);
    float lips = sdEllipsoid(l - vec3(0.0, ${g1(mouth.upper * 0.75)}, 0.22), vec3(MOUTH_W, ${g1(mouth.upper)}, 0.85));
    lips = min(lips, sdEllipsoid(l - vec3(0.0, ${g1(-mouth.lower * 0.75)}, -0.05), vec3(${g1(mouth.w * 0.84)}, ${g1(mouth.lower)}, 0.9)));
    d = smin(d, lips, 0.45);
    // the line between them, the corners pressed in, the groove above the upper lip, the dip above the chin
    d = smax(d, -sdEllipsoid(l - vec3(0.0, 0.0, 0.75), vec3(${g1(mouth.w * 0.97)}, ${g1(mouth.open)}, 0.9)), 0.08);
    d = smax(d, -sdSphere(vec3(abs(l.x), l.y, l.z) - vec3(${g1(mouth.w * 0.98)}, 0.0, 0.0), 0.12), 0.25);
    d = smin(d, sdCapsule(vec3(abs(q.x), q.y, q.z), ${g3([0.38, tip[1] - 1.25, mouth.c[2] + 0.2])}, ${g3([0.44, mouth.c[1] + mouth.upper * 1.6, mouth.c[2] + 0.42])}, 0.11), 0.2);
    d += 0.11 * front * groove(q.xy, ${g2([-mouth.w * 0.5, mouth.c[1] - mouth.lower * 2.5])}, ${g2([mouth.w * 0.5, mouth.c[1] - mouth.lower * 2.5])}, 0.45);
    ${extra}
    // the lids, folded into the sockets, and the crease over each upper lid
    vec3 e = s - EYE_C;
    float lid = lids(e, EYE_R, eyeUp(), EYE_DN, EYE_TILT, EYE_THICK);
    d = smin(d, lid, 0.4);
    ${P.crease ? `vec3 ce = rx(0.3) * (e - vec3(0.0, ${g1(eye.r * 0.22)}, 0.15));
    float cr = max(sdTorus(ce.xzy, vec2(${g1(eye.r * 1.08)}, 0.05)), -(ce.y - 0.1));
    d = smax(d, -cr, ${g1(0.14 * P.crease)});` : ''}
  }
  ${extraAll}
  // the ears
  d = smin(d, earShape(s - ${g3(ear.c)}), 0.45);
  vec2 r = vec2(d, 1.0);
  vec3 e = s - EYE_C;
  float ball = length(e) - EYE_R;
  if (ball < 1.0) ball = smin(ball, length(e - gazeS(q) * 0.62) - 0.64, 0.18);
  if (ball < r.x) r = vec2(ball, 2.0);
  return r;
}`;
}


/**
 * GLSL for a head of hair lying on the skull (head space): `float hairShape(vec3 q)` and `vec3 hairColour(vec3 q)`.
 * line: the hairline as knots [azimuth (radians round the head from the front, 0 to PI), height (cm)], front to
 * nape (a sideburn is a dip in front of the ear, the ear a rise); thick: { side, top, front (the swept volume over
 * the forehead), back, edge (the share left at the hairline) }; locks/fine: [count round the head, depth] of the
 * combed ridges; lift: the wind lifting the ends at the crown; colours: root, body, sheen (linear RGB).
 */
export function hairGLSL({ line, thick, locks = [13, 0.28], fine = [46, 0.06], lift = 0, wobble = 2.4, colours }) {
  const knots = line.map(([a, y], i) => (i === 0 ? `  float y = ${g1(y)};` : `  y = mix(y, ${g1(y)}, smoothstep(${g1(line[i - 1][0])}, ${g1(a)}, a));`)).join('\n');
  return `
float hairLine(vec3 q) {
  float a = abs(atan(q.x, q.z));
${knots}
  return y;
}
float hairAng(vec3 q) { return atan(q.x, q.y + 3.0); }
float hairWob(vec3 q, float ang) { return vnoise(vec3(q.z * 0.12, ang * 1.6, 1.3)) * ${g1(wobble)} + vnoise(vec3(q.z * 0.3, ang * 4.0, 3.1)) * ${g1(wobble * 0.3)}; }
float hairThick(vec3 q, float inH) {
  float t = mix(${g1(thick.side)}, ${g1(thick.top)}, smoothstep(1.0, 8.0, q.y));
  t += ${g1(thick.front)} * exp(-q.x * q.x / 16.0) * smoothstep(-2.0, 5.5, q.z) * smoothstep(3.5, 8.5, q.y);
  t += ${g1(thick.back ?? 0)} * smoothstep(-1.0, -6.0, q.z) * smoothstep(-6.0, 2.0, q.y);
  return t * mix(${g1(thick.edge ?? 0.35)}, 1.0, smoothstep(0.0, 1.8, inH));
}
float hairShape(vec3 q) {
  float inH = q.y - hairLine(q);
  float d = skullQ(q) - hairThick(q, inH);
  d = smax(d, -inH, 0.45);
  // combed back: locks in long ridges from front to back, finer strands in them
  float ang = hairAng(q), wob = hairWob(q, ang);
  d -= (${g1(locks[1])} * sin(ang * ${g1(locks[0])} + wob * 2.6) + ${g1(fine[1])} * sin(ang * ${g1(fine[0])} + wob * 5.0)) * smoothstep(0.2, 2.0, inH);
  ${lift ? `d -= ${g1(lift)} * smoothstep(0.45, 0.8, vnoise(vec3(ang * 3.0, q.z * 0.25, 4.0))) * smoothstep(-2.0, -7.0, q.z) * smoothstep(5.0, 9.0, q.y);` : ''}
  return d * 0.8;
}
vec3 hairColour(vec3 q) {
  float ang = hairAng(q), wob = hairWob(q, ang);
  float st = 0.5 + 0.5 * sin(ang * ${g1(fine[0])} + wob * 5.0);
  float lk = 0.5 + 0.5 * sin(ang * ${g1(locks[0])} + wob * 2.6);
  float inH = q.y - hairLine(q);
  float depth = clamp((skullQ(q) + 0.15) / max(hairThick(q, inH), 0.2), 0.0, 1.0);
  vec3 c = mix(${g3(colours.root)}, ${g3(colours.body)}, smoothstep(0.0, 0.8, depth + 0.35 * lk - 0.2));
  c = mix(c, ${g3(colours.sheen)}, st * 0.35 * depth);
  return c * (0.85 + 0.3 * vnoise(vec3(ang * 60.0, q.z * 0.6, 2.0)));
}`;
}

/**
 * GLSL for a face's colours (head space): `vec3 skinAlbedo(vec3 q)` (the skin with its warmer cheeks, nose and ears,
 * the brows, the lips, the lash lines, a little mottling) and `vec3 eyeAlbedo(vec3 q, out vec4 surf)`. Colours are
 * linear RGB. brows: { y (height of the inner end), arch, thick: [inner, outer], tilt (the inner end lowered, for a
 * scowl), colour }; iris: [deep, light]; age (0..1) darkens the creases; stubble darkens the jaw.
 */
export function faceColourGLSL({ skin, flush, lips, brows, iris, whites = [0.5, 0.45, 0.41], age = 0, stubble = 0, nose = HEAD_DEFAULTS.nose, ear = HEAD_DEFAULTS.ear, mouth = HEAD_DEFAULTS.mouth, eye = HEAD_DEFAULTS.eye }) {
  const b = brows;
  return `
float browMask(vec3 s, out float strand) {
  float bx = s.x;
  float t = clamp((bx - 0.8) / 4.4, 0.0, 1.0);
  float y = ${g1(b.y)} + ${g1(b.arch)} * sin(t * 2.7) - ${g1(b.tilt ?? 0)} * (1.0 - smoothstep(0.0, 0.45, t)) - 0.25 * t;
  float th = mix(${g1(b.thick[0])}, ${g1(b.thick[1])}, smoothstep(0.1, 1.0, t));
  float by = s.y - y;
  // hairs: rising and fanning out from the inner end, lying flat along the tail
  float ang = mix(1.1, 0.15, smoothstep(0.0, 0.4, t));
  strand = 0.5 + 0.5 * sin((bx * sin(ang) - by * cos(ang)) * 26.0 + vnoise(s * 5.0) * 5.0);
  float edge = vnoise(s * vec3(9.0, 9.0, 9.0)) * 0.12;
  return (1.0 - smoothstep(th * 0.45, th + edge, abs(by + 0.08 * t))) * smoothstep(0.75, 1.15, bx) * (1.0 - smoothstep(4.9, 5.6, bx)) * step(5.0, s.z);
}
vec3 skinAlbedo(vec3 q) {
  vec3 s = vec3(abs(q.x), q.y, q.z);
  vec3 c = ${g3(skin)};
  vec3 fl = ${g3(flush)};
  // a painter's skin: a warmer, yellower forehead, red in the cheeks, nose and ears, cool round the mouth and jaw,
  // a violet shadow in the sockets
  c = zone(c, c * vec3(1.06, 1.02, 0.86), 0.6 * blob(q, vec3(0.0, 4.0, 7.0), vec3(5.0, 2.6, 3.0)));
  c = zone(c, fl, 0.62 * blob(s, vec3(4.0, -2.8, 7.0), vec3(2.6, 2.2, 2.4)));
  c = zone(c, c * vec3(0.86, 0.8, 0.95), 0.4 * blob(s, ${g3([eye.c[0] - 0.4, eye.c[1] + 0.5, eye.c[2] + 0.6])}, vec3(1.8, 1.0, 1.0)));
  c = zone(c, fl, 0.5 * blob(q, ${g3([0, nose.tip[1], nose.tip[2] - 0.2])}, vec3(1.6, 1.4, 1.4)));
  c = zone(c, fl * 0.95, 0.6 * blob(s, ${g3(ear.c)}, vec3(1.4, 3.4, 2.3)));
  // the thin skin under the eyes, a little cooler; the jaw and chin, a little greyer
  c = zone(c, c * vec3(0.84, 0.9, 1.0), 0.45 * blob(s, ${g3([eye.c[0], eye.c[1] - 1.25, eye.c[2] + 0.75])}, vec3(1.7, 0.65, 1.0)));
  c = zone(c, c * vec3(0.88, 0.92, 0.98), ${g1(0.3 + stubble)} * blob(q, ${g3([0, mouth.c[1] - 2.6, mouth.c[2] - 0.6])}, vec3(4.6, 3.2, 3.2)) * (1.0 - blob(s, ${g3([0, mouth.c[1], mouth.c[2] + 0.4])}, vec3(2.6, 1.1, 1.0))));
  float strand;
  float brow = browMask(s, strand);
  c = mix(c, ${g3(b.colour)}, brow * (0.72 + 0.28 * strand));
  vec3 l = lipSpace(q);
  float lip = 1.0 - smoothstep(0.7, 1.05, length(vec2(l.x / ${g1(mouth.w * 0.98)}, (l.y - 0.05) / ${g1(Math.max(mouth.upper, mouth.lower) * 1.7)})));
  c = mix(c, ${g3(lips)}, lip * 0.8);
  // the lash line along each lid's edge, darkest along the upper lid
  vec3 e = s - EYE_C;
  float rr = length(e) - (EYE_R + EYE_THICK);
  float up = abs(dot(e, lidUpN(eyeUp(), EYE_TILT)));
  float dn = abs(dot(e, lidDnN(EYE_DN, EYE_TILT)));
  float near = 1.0 - smoothstep(0.0, 0.35, abs(rr));
  c = mix(c, vec3(0.05, 0.03, 0.022), near * (1.0 - smoothstep(0.05, 0.2, up)) * step(-0.3, e.z));
  c = mix(c, c * vec3(0.55, 0.42, 0.4), near * (1.0 - smoothstep(0.03, 0.12, dn)) * 0.7 * step(-0.3, e.z));
  // the lid's own crease, a touch darker
  c *= 1.0 - 0.18 * near * smoothstep(0.25, 0.45, dot(e, lidUpN(eyeUp(), EYE_TILT))) * (1.0 - smoothstep(0.45, 0.8, dot(e, lidUpN(eyeUp(), EYE_TILT)))) * step(0.0, e.z);
  ${age ? `// age: the brow's furrows and the crow's feet, as darker lines
  float fur = sin(q.y * 6.5 + vnoise(q * 1.5) * 2.0) * smoothstep(2.6, 3.4, q.y) * (1.0 - smoothstep(5.5, 6.5, q.y)) * (1.0 - smoothstep(3.0, 5.0, s.x)) * step(6.0, q.z);
  c *= 1.0 - ${g1(0.07 * age)} * smoothstep(0.6, 1.0, fur);
  float crow = sin(atan(e.y, e.x) * 9.0 + vnoise(q * 3.0) * 2.0) * smoothstep(1.7, 2.1, length(e.xy)) * (1.0 - smoothstep(2.4, 3.0, length(e.xy))) * smoothstep(0.6, 1.4, e.x);
  c *= 1.0 - ${g1(0.1 * age)} * smoothstep(0.5, 1.0, crow);` : ''}
  c *= 0.93 + 0.14 * fbm(q * 3.0);
  ${stubble ? `c = mix(c, c * vec3(0.72, 0.72, 0.76), ${g1(stubble)} * smoothstep(0.45, 0.75, vnoise(q * 14.0)) * blob(q, ${g3([0, mouth.c[1] - 2.0, mouth.c[2] - 1.0])}, vec3(5.8, 3.8, 4.2)) * (1.0 - lip));` : ''}
  return c;
}
vec3 eyeAlbedo(vec3 q, out vec4 surf) {
  vec3 s = vec3(abs(q.x), q.y, q.z);
  vec3 e = normalize(s - EYE_C);
  vec3 g = gazeS(q);
  float ang = acos(clamp(dot(e, g), -1.0, 1.0));
  surf = vec4(0.22, 1.5, 0.0, 0.0);
  // the white: never white, warmer and darker toward the corners
  vec3 white = mix(${g3(whites)}, ${g3(whites.map((v, i) => v * [0.85, 0.62, 0.6][i]))}, smoothstep(0.6, 1.3, ang) * 0.75);
  float iris = 1.0 - smoothstep(0.47, 0.5, ang);
  float pupil = 1.0 - smoothstep(0.16, 0.18, ang);
  vec3 side = normalize(cross(g, vec3(0.0, 1.0, 0.0)));
  float pa = atan(dot(e, cross(g, side)), dot(e, side));
  float fib = vnoise(vec3(pa * 9.0, ang * 30.0, 0.0));
  vec3 ic = mix(${g3(iris[0])}, ${g3(iris[1])}, smoothstep(0.45, 0.2, ang) * (0.5 + 0.5 * fib));
  ic = mix(ic, ${g3(iris[0])} * 0.3, smoothstep(0.36, 0.49, ang));
  ic = mix(ic, vec3(0.45, 0.38, 0.18), (1.0 - smoothstep(0.17, 0.27, ang)) * 0.35);
  return mix(mix(white, ic, iris), vec3(0.01), pupil);
}`;
}

/**
 * Where the face's moving parts fall in the portrait's frame ([x, y, w, h], SVG units), for whoever animates them
 * later: the mouth (both lips, corner to corner), each brow, each eye with its lids. `brows` as for faceColourGLSL;
 * `project(q)` takes a head-space point to the frame. Left and right are the viewer's.
 */
export function faceFeatures(params, brows, project) {
  const P = merge(HEAD_DEFAULTS, params);
  const { mouth, eye } = P;
  const bbox = (pts) => {
    const xy = pts.map(project);
    const xs = xy.map((v) => v[0]), ys = xy.map((v) => v[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0].map((v) => Math.round(v * 10) / 10);
  };
  const grid = (xr, yr, z) => {
    const out = [];
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
      const x = xr[0] + ((xr[1] - xr[0]) * i) / 6, y = yr[0] + ((yr[1] - yr[0]) * j) / 6;
      out.push([x, y, z(x, y)]);
    }
    return out;
  };
  const mouthBox = bbox(grid([-mouth.w - 0.4, mouth.w + 0.4], [mouth.c[1] - mouth.lower * 2 - 0.3, mouth.c[1] + mouth.upper * 2 + 0.3],
    (x) => mouth.c[2] + 0.6 - mouth.bend * x * x));
  const browBox = (k) => bbox(grid([0.7 * k, 5.5 * k], [brows.y - 0.25 - (brows.tilt ?? 0) - brows.thick[0], brows.y + brows.arch + brows.thick[0]],
    (x) => 8.6 - 0.36 * Math.abs(x)));
  const eyeBox = (k) => bbox(grid([eye.c[0] * k - eye.r * 1.35, eye.c[0] * k + eye.r * 1.35], [eye.c[1] - eye.r * 0.95, eye.c[1] + eye.r * 1.05],
    () => eye.c[2] + eye.r * 0.9));
  // the head's +x is its own left: on the viewer's right when he faces us
  const [bl, br] = [browBox(-1), browBox(1)], [el, er] = [eyeBox(-1), eyeBox(1)];
  const left = (a, b) => (a[0] <= b[0] ? [a, b] : [b, a]);
  const [browL, browR] = left(bl, br), [eyeL, eyeR] = left(el, er);
  return { mouth: mouthBox, browL, browR, eyeL, eyeR };
}
