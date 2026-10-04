// The sculptor's kit for the Mentat portraits: each Mentat is modelled in 3D as signed distance fields (GLSL: skull,
// jaw, nose, lips, eyes and lids, ears, hair masses, neck, shoulders, cloth with folds, hands posed joint by joint)
// and raymarched once at bake time (assets/campaign/portraits/bake.mjs) in WebGL2: a key light with soft shadows, a
// fill, a rim light from behind, ambient occlusion, light scattered through skin, specular sheen. The bake renders
// the body, the head (it sways) and the head with closed eyes (the blink) as separate layers; the game shows only the
// baked images (portraits.js). Units are centimetres; y up, x to the viewer's right, z toward the viewer.
// Everything here is our own modelling, after the descriptions in research.md §4.

export const VIEW_W = 400, VIEW_H = 500;
/** The layers a portrait is baked into: the chamber, the body, the head (it sways), the closed eyes (the blink). */
export const LAYERS = ['back', 'body', 'head', 'lids'];

// ---- small vector math for posing (JS side) ----
export const v3 = (x, y, z) => [x, y, z];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => mul(a, 1 / (len(a) || 1));
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** 3x3 matrices as row arrays; rotations in degrees. */
export const rotX = (deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
export const rotY = (deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
export const rotZ = (deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
export const mmul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
export const mvec = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
export const transpose = (M) => [0, 1, 2].map((i) => [M[0][i], M[1][i], M[2][i]]);
/** A rotation from yaw (about y, turning the face toward the viewer's right), pitch (about x, nodding down) and roll. */
export const pose = ({ yaw = 0, pitch = 0, roll = 0 }) => mmul(rotY(yaw), mmul(rotX(pitch), rotZ(roll)));

const f = (v) => {
  const s = (Math.round(v * 10000) / 10000).toString();
  return s.includes('.') || s.includes('e') ? s : `${s}.0`;
};
/** GLSL literals. */
export const g1 = f;
export const g3 = (a) => `vec3(${a.map(f).join(', ')})`;
/** A GLSL mat3 (column-major) from a row-major JS matrix, so `M * v` in GLSL is `mvec(M, v)` here. */
export const gm3 = (M) => `mat3(${[0, 1, 2].flatMap((c) => [M[0][c], M[1][c], M[2][c]]).map(f).join(', ')})`;

// ---- the camera: a pinhole in front of the figure, the frame being the 400 x 500 window on the plane z = 0 ----

/** The frame's window on the plane z = 0 (cm): left, top, width, height; and the camera position. */
export function frameOf({ cam, top, height }) {
  const width = (height * VIEW_W) / VIEW_H;
  return { cam, x0: cam[0] - width / 2, y0: top, w: width, h: height };
}

/** Where a point (cm) lands in the frame (SVG units). */
export function project(frame, p) {
  const [cx, cy, cz] = frame.cam;
  const t = cz / (cz - p[2]);
  const X = cx + (p[0] - cx) * t, Y = cy + (p[1] - cy) * t;
  return [((X - frame.x0) / frame.w) * VIEW_W, ((frame.y0 - Y) / frame.h) * VIEW_H];
}

// ---- hands, posed joint by joint (JS), emitted as GLSL capsules ----

/**
 * A hand in world space. `at` is the wrist; `M` its orientation (columns: across the knuckles toward the thumb,
 * along the hand toward the fingers, out of the back of the hand). curls: per finger [base, middle, tip] bend in
 * degrees (toward the palm), index to little finger; spread (degrees) fans the fingers; thumb { yaw, pitch, curl }.
 * Returns { palm: { c, M, half }, bones: [[a, b, ra, rb], ...] (finger segments), nails: [[c, dir, up]] }.
 */
export function posedHand({ at, M, size = 1, curls, spread = 6, thumb = { out: 40, down: 20, curl: [10, 20] }, mirror = false, lengths = null }) {
  const s = size, side = mirror ? -1 : 1;
  const W = (v) => add(at, mvec(M, [v[0] * side, v[1], v[2]]));
  const R = (v) => mvec(M, [v[0] * side, v[1], v[2]]);
  const palm = { c: W([0, 4.6 * s, 0]), M, half: [3.9 * s, 4.5 * s, 1.0 * s], mirror };
  const bones = [], nails = [];
  // knuckles: index (toward the thumb, +x) to little finger
  const knuckles = [[2.75, 9.2, 0.15], [0.92, 9.5, 0.25], [-0.92, 9.3, 0.15], [-2.7, 8.7, 0.0]];
  const lens = lengths ?? [[3.9, 2.3, 1.85], [4.3, 2.6, 1.95], [4.1, 2.5, 1.9], [3.2, 1.95, 1.7]];
  const radii = [[0.92, 0.86, 0.78, 0.68], [0.95, 0.9, 0.8, 0.7], [0.92, 0.86, 0.78, 0.68], [0.84, 0.78, 0.7, 0.6]];
  for (let k = 0; k < 4; k++) {
    const fan = (1.5 - k) * spread;
    let dir = [Math.sin((fan * Math.PI) / 180), Math.cos((fan * Math.PI) / 180), 0];
    let p = knuckles[k].map((v) => v * s);
    let bend = 0;
    for (let j = 0; j < 3; j++) {
      bend += curls[k][j];
      const b = (bend * Math.PI) / 180;
      // bend toward the palm (-z) about the finger's sideways axis
      const d = norm([dir[0] * Math.cos(b), dir[1] * Math.cos(b), -Math.sin(b)]);
      const q = add(p, mul(d, lens[k][j] * s));
      bones.push([W(p), W(q), radii[k][j] * s, radii[k][j + 1] * s]);
      if (j === 2) nails.push([W(add(q, mul(d, -0.75 * s))), norm(R(d)), norm(R(norm([d[0] * Math.sin(b), d[1] * Math.sin(b), Math.cos(b)])))]);
      p = q;
    }
  }
  // the thumb: from the heel of the hand on the index side, out and down toward the palm
  const t0 = [3.0 * s, 1.6 * s, -0.6 * s];
  const o = (thumb.out * Math.PI) / 180, dn = (thumb.down * Math.PI) / 180;
  let tdir = norm([Math.sin(o), Math.cos(o), -Math.sin(dn)]);
  let tp = t0;
  const tl = [3.6 * s, 3.0 * s, 2.5 * s], tr = [1.25 * s, 1.0 * s, 0.86 * s, 0.7 * s];
  for (let j = 0; j < 3; j++) {
    const c = ((j === 0 ? 0 : thumb.curl[j - 1]) * Math.PI) / 180;
    tdir = norm([tdir[0] * Math.cos(c), tdir[1] * Math.cos(c), tdir[2] - Math.sin(c)]);
    const q = add(tp, mul(tdir, tl[j]));
    bones.push([W(tp), W(q), tr[j], tr[j + 1]]);
    if (j === 2) nails.push([W(add(q, mul(tdir, -0.7 * s))), norm(R(tdir)), norm(R(cross(tdir, [side, 0, 0])))]);
    tp = q;
  }
  return { palm, bones, nails };
}

/** GLSL for a posed hand: float name(vec3 p) the distance to the hand. */
export function handGLSL(name, hand, { k = 0.5 } = {}) {
  const { palm, bones } = hand;
  const Minv = transpose(palm.M);
  const lines = [`float ${name}(vec3 p) {`,
    `  vec3 q = ${gm3(Minv)} * (p - ${g3(palm.c)});`,
    hand.palm.mirror ? '  q.x = -q.x;' : '',
    // the palm: a rounded slab, thicker at the heel and the knuckles, the back gently arched
    `  float d = sdRoundBox(q - vec3(0.0, 0.0, -0.25), vec3(${f(palm.half[0] - 0.7)}, ${f(palm.half[1] - 0.5)}, 1.15), 0.9);`,
    `  d = smin(d, sdEllipsoid(q - vec3(0.0, 0.0, 0.15), vec3(${f(palm.half[0] * 0.85)}, ${f(palm.half[1] * 0.9)}, 0.95)), 0.8);`,
    `  d = smin(d, sdEllipsoid(q - vec3(${f(palm.half[0] * 0.55)}, ${f(-palm.half[1] * 0.45)}, -0.8), vec3(${f(palm.half[0] * 0.55)}, ${f(palm.half[1] * 0.55)}, 1.0)), 0.8);`,
    `  d = smin(d, sdCapsule(q, vec3(${f(-palm.half[0] * 0.75)}, ${f(palm.half[1] * 0.95)}, 0.05), vec3(${f(palm.half[0] * 0.75)}, ${f(palm.half[1] * 1.05)}, 0.15), 0.85), 0.9);`,
    `  vec3 wq = q * vec3(1.0, 1.0, 1.35);`,
    `  d = smin(d, sdRoundCone(wq, vec3(0.0, ${f(-palm.half[1] - 2.0)}, -0.4), vec3(0.0, ${f(-palm.half[1] + 0.6)}, -0.3), 2.4, 2.6) / 1.35, 1.2);`,
    // the tendons on the back of the hand, from the wrist fanning out to the knuckles
    ...[2.2, 0.75, -0.8, -2.3].map((x) => `  d = smin(d, sdCapsule(q, vec3(${f(x * 0.35)}, ${f(-palm.half[1] * 0.75)}, 0.78), vec3(${f(x)}, ${f(palm.half[1] * 0.8)}, 0.88), 0.15), 0.35);`),
    '  float fg = 1e5;',
    ...bones.map(([a, b, ra, rb]) => `  fg = smin(fg, sdRoundCone(p, ${g3(a)}, ${g3(b)}, ${f(ra)}, ${f(rb)}), 0.5);`),
    `  return smin(d, fg, ${f(k)});`, '}'];
  return lines.filter(Boolean).join('\n');
}

// ---- the GLSL library ----

export const GLSL_LIB = `
#define PI 3.14159265
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-6); }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2; vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv);
  float y2 = y * y * l2; float z2 = z * z * l2; float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdBox(vec3 p, vec3 b) { vec3 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0); }
float sdRoundBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sdCylY(vec3 p, float h, float r) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
mat3 rx(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
mat3 ry(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rz(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0, -s, c, 0, 0, 0, 1); }
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 x) {
  vec3 i = floor(x), u = fract(x); u = u * u * (3.0 - 2.0 * u);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
// a smooth step between two colours along t, for painting zones
vec3 zone(vec3 base, vec3 c, float t) { return mix(base, c, clamp(t, 0.0, 1.0)); }
// an ellipse-shaped soft zone (1 inside, fading to 0 at the edge)
float blob(vec3 p, vec3 c, vec3 r) { return 1.0 - smoothstep(0.2, 1.0, length((p - c) / r)); }
`;

/**
 * The eye kit (GLSL, head space): eyeball with iris, pupil and cornea, lids as shells cut by two planes through the
 * eye's centre, so the opening is an almond, the lids have thickness, and closing them is a turn of the upper plane.
 * Parameters per eye: centre, radius, upper and lower opening angles (radians, from straight ahead), tilt (radians).
 */
export const GLSL_EYES = `
// lid planes' normals for an opening angle a (up positive) and the eye's tilt
vec3 lidUpN(float a, float tilt) { return rz(tilt) * vec3(0.0, cos(a), -sin(a)); }
vec3 lidDnN(float a, float tilt) { return rz(tilt) * vec3(0.0, -cos(a), sin(a)); }
// the lids around one eye: e is the point relative to the eye centre; returns the lids' distance
float lids(vec3 e, float r, float up, float dn, float tilt, float thick) {
  float shell = length(e) - (r + thick);
  float u = smax(shell, -dot(e, lidUpN(up, tilt)), 0.12);
  float l = smax(shell, -dot(e, lidDnN(dn, tilt)), 0.12);
  // the lids end at the eye's corners: no shell behind the eye's equator
  return smax(min(u, l), -(e.z + r * 0.35), 0.4);
}
`;

/**
 * The full fragment shader for one Mentat: the library, his scene (mapHead, mapBody, albedo, rig constants) and the
 * renderer. Passes (uPass): 0 body (only the body is seen; everything casts shadows), 1 head (the whole figure is
 * seen, only the head's pixels kept: the collar hides the neck's root), 2 the head with the eyes shut, 3 the body's
 * material ids (for the seam checks).
 */
export function fragmentShader(scene) {
  return `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uSize;
uniform vec3 uCam;
uniform vec4 uFrame;
uniform int uPass;
uniform float uClosed;
out vec4 fragColor;
// (the loops start at ZERO, which the compiler cannot see is 0, so it keeps one copy of the scene per loop instead
// of unrolling and inlining it many times over: the shader compiles in seconds, not minutes)
#define ZERO (min(uPass, 0))
// true while a shadow ray is marched: a figure's bounding box then stands for nothing at all outside it (a box is a
// fine bound for finding the surface but, read as a near miss, would darken everything near it)
bool gShadow = false;
${GLSL_LIB}
${GLSL_EYES}
${scene}

vec2 mapAll(vec3 p, int groups) {
  vec2 r = vec2(1e5, 0.0);
  if ((groups & 1) != 0) r = mapBody(p);
  if ((groups & 2) != 0) { vec2 h = mapHead(p); if (h.x < r.x) r = h; }
  return r;
}
vec2 march(vec3 ro, vec3 rd, int groups) {
  float t = TMIN;
  for (int i = ZERO; i < 220; i++) {
    vec2 h = mapAll(ro + rd * t, groups);
    if (abs(h.x) < 0.002) return vec2(t, h.y);
    t += h.x * 0.75;
    if (t > TMAX) break;
  }
  return vec2(-1.0, 0.0);
}
vec3 calcNormal(vec3 p, int groups) {
  vec3 n = vec3(0.0);
  for (int i = ZERO; i < 4; i++) {
    vec3 e = 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
    n += e * mapAll(p + 0.006 * e, groups).x;
  }
  return normalize(n);
}
float softShadow(vec3 ro, vec3 rd, float tmax, float k) {
  // started a little off the surface, at a per-pixel jittered distance, so the penumbra's steps dither into grain
  // (the supersampling and the painter's finish smooth it) instead of banding
  float res = 1.0, t = 0.08 + 0.1 * hash13(vec3(gl_FragCoord.xy, 7.0));
  gShadow = true;
  for (int i = ZERO; i < 72; i++) {
    float h = mapAll(ro + rd * t, 3).x;
    res = min(res, k * h / t);
    t += clamp(h, 0.06, 1.2);
    if (res < 0.003 || t > tmax) break;
  }
  gShadow = false;
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = ZERO; i < 5; i++) {
    float h = 0.06 + AO_REACH * float(i) / 4.0;
    float d = mapAll(p + h * n, 3).x;
    occ += (h - d) * sca;
    sca *= 0.8;
  }
  return clamp(1.0 - AO_K * occ, 0.0, 1.0);
}

// surf: x roughness, y specular strength, z skin (scattering), w metal
vec3 lightIt(vec3 p, vec3 n, vec3 rd, vec3 alb, vec4 surf, float occ) {
  vec3 L = normalize(KEY_DIR);
  vec3 R = normalize(RIM_DIR);
  float ndl = dot(n, L);
  // both lights' shadows in one loop (one copy of the scene in the compiled shader)
  float shs[2];
  for (int i = ZERO; i < 2; i++) {
#ifdef NO_SHADOW
    shs[i] = 1.0;
#else
    shs[i] = softShadow(p + n * 0.05, i == 0 ? L : R, i == 0 ? 90.0 : 60.0, i == 0 ? KEY_SOFT : 10.0);
#endif
  }
  float sh = shs[0], rimSh = shs[1];
  float skin = surf.z;
  // diffuse: on skin the red light wraps further round into the shadow than the green and blue (light scattered
  // under the skin), so the terminator turns warm gradually; the cast shadow's edge warms the same way
  vec3 wrap = vec3(0.04) + skin * vec3(0.45, 0.2, 0.13);
  vec3 dif = clamp((vec3(ndl) + wrap) / (1.0 + wrap), 0.0, 1.0);
  // light bled through the skin keeps a cast shadow warm and never quite black
  vec3 shc = mix(vec3(sh), 0.12 * vec3(1.0, 0.45, 0.3) + 0.88 * pow(vec3(sh), vec3(0.6, 0.95, 1.15)), skin);
  vec3 key = KEY_COL * dif * shc;
  vec3 F = normalize(FILL_DIR);
  float fdl = clamp(dot(n, F) * 0.5 + 0.5, 0.0, 1.0);
  vec3 fill = FILL_COL * fdl * fdl * occ;
  vec3 amb = mix(GROUND_COL, SKY_COL, clamp(n.y * 0.5 + 0.5, 0.0, 1.0)) * occ * mix(vec3(1.0), SKIN_AMB, skin);
  float rdl = clamp(dot(n, R), 0.0, 1.0);
  float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 2.5);
  vec3 rim = RIM_COL * rdl * fres * rimSh * (0.6 + 0.4 * occ);
  vec3 diffuse = alb * (key + fill + amb) * (1.0 - surf.w * 0.8);
  vec3 col = diffuse + rim * (0.2 + alb) * (1.0 - surf.w * 0.5);
  vec3 H = normalize(L - rd);
  float gloss = 1.0 - surf.x;
  float shin = exp2(1.0 + 10.0 * gloss);
  float spec = pow(max(dot(n, H), 0.0), shin) * (shin + 2.0) / 8.0;
  float vf = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 5.0);
  float fr = mix(0.04, 1.0, surf.w) + (1.0 - mix(0.04, 1.0, surf.w)) * pow(1.0 - clamp(dot(H, -rd), 0.0, 1.0), 5.0);
  vec3 specCol = mix(vec3(1.0), alb * 1.4, surf.w);
  col += KEY_COL * specCol * spec * fr * surf.y * clamp(ndl * 4.0, 0.0, 1.0) * sh;
  // what glossy things mirror: the room's dim light, the key's window, the rim's glow
  vec3 rr = reflect(rd, n);
  vec3 env = mix(GROUND_COL, SKY_COL, clamp(rr.y * 0.5 + 0.5, 0.0, 1.0)) * 2.5
    + KEY_COL * 0.7 * pow(max(dot(rr, L), 0.0), 6.0) * (0.3 + 0.7 * sh) + RIM_COL * 0.5 * pow(max(dot(rr, R), 0.0), 4.0) * rimSh;
  col += env * mix(vec3(0.04 + 0.5 * vf), alb, surf.w) * surf.y * occ * (surf.w > 0.5 ? 1.0 : 0.35);
  // a soft sheen of the rim on glossy things
  vec3 Hr = normalize(R - rd);
  col += RIM_COL * specCol * pow(max(dot(n, Hr), 0.0), shin * 0.5) * surf.y * 0.4 * rimSh * fr;
  return col;
}
vec3 tonemap(vec3 c) { c *= EXPOSURE; c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14); return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }

void main() {
  vec2 px = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  vec2 fr = px / uSize;
  vec3 target = vec3(uFrame.x + fr.x * uFrame.z, uFrame.y - fr.y * uFrame.w, 0.0);
  vec3 ro = uCam, rd = normalize(target - uCam);
#ifdef TURN
  mat3 T = ry(TURN);
  ro = HEAD_POS + T * (ro - HEAD_POS); rd = T * rd;
#endif
  int groups = (uPass == 0 || uPass == 3) ? 1 : 3;
  vec2 h = march(ro, rd, groups);
  if (h.x < 0.0) { fragColor = vec4(0.0); return; }
  bool head = h.y < 20.0;
  if ((uPass == 1 || uPass == 2) && !head) { fragColor = vec4(0.0); return; }
  if (uPass == 3) { fragColor = vec4(h.y / 255.0, 0.0, 0.0, 1.0); return; }
  vec3 p = ro + rd * h.x;
  vec3 n = calcNormal(p, groups);
  vec4 surf;
  vec3 alb = albedo(p, n, h.y, surf);
#ifdef NO_AO
  float occ = 1.0;
#else
  float occ = calcAO(p, n);
#endif
#ifdef CLAY
  vec3 Lc = normalize(vec3(-0.45, 0.55, 0.7));
  float shc = 1.0;
  for (int i = ZERO; i < 1; i++) shc = softShadow(p + n * 0.05, Lc, 90.0, 12.0);
  vec3 col = vec3(0.55) * (0.12 + 0.25 * occ + 0.9 * max(dot(n, Lc), 0.0) * shc) + 0.15 * pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  if (h.y > 1.5 && h.y < 2.5) col *= vec3(0.8, 0.85, 1.0);
#else
  vec3 col = lightIt(p, n, rd, alb, surf, occ);
#endif
  fragColor = vec4(grade(tonemap(col), p), 1.0);
}`;
}

/** The vertex shader: one triangle over the whole target. */
export const VERTEX_SHADER = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0); gl_Position = vec4(p, 0.0, 1.0); }`;
