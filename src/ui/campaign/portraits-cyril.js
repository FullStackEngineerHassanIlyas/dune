// Cyril, Mentat of House Atreides (research.md §4), sculpted in 3D: a young man, calm and fair, blond hair swept back
// and lifted by the wind, blue eyes, a high-collared navy cloak over a tunic with a gold-trimmed neckband, a round
// gold pendant with a blue stone, a red book held to his chest. His head is turned a little toward the map (the
// viewer's right) and his eyes are on you. Caladan's daylight comes through the window on his right as the key light,
// the sea behind rims him in cool blue, the lamp on the left warms his shadow side.
import { pose, transpose, mvec, add, sub, norm, mmul, rotX, rotY, rotZ, frameOf, project, posedHand, handGLSL, g1, g3, gm3 } from './portraits-sdf.js';
import { headGLSL, hairGLSL, faceColourGLSL, faceFeatures, HEAD_DEFAULTS } from './portraits-head.js';

// world: centimetres, origin at the notch at the base of the throat
const CAM = [0, 19, 175];
const FRAME = frameOf({ cam: CAM, top: 36, height: 56 });
const HEAD_R = pose({ yaw: 18, pitch: 5, roll: -3 });
const HEAD_POS = [0.3, 17.5, -3.6];
const HEAD_INV = transpose(HEAD_R);
const toWorld = (q) => add(HEAD_POS, mvec(HEAD_R, q));
const toHead = (p) => mvec(HEAD_INV, sub(p, HEAD_POS));
const EYE = HEAD_DEFAULTS.eye.c;
const gazeOf = (eyeHead) => norm(sub(toHead(CAM), eyeHead));
const NECK_TOP = toWorld([0, -6.2, -2.4]);
const NECK_BASE = [0, -1.5, -4.8];
/** The cords of the neck, from behind each ear to the notch of the throat. */
const CORDS = [1, -1].map((k) => [toWorld([4.4 * k, -4.6, -2.6]), [1.15 * k, 0.2, -0.9]]);
/** The head turns about the root of the neck, where the collar hides it. */
const PIVOT = project(FRAME, [0, 1.0, -1.5]).map((v) => Math.round(v));

// the hairline round the head, front to nape: a high brow, the corners a little receded, a short sideburn, round
// the ear, down to the nape
const HAIR = hairGLSL({
  line: [[0, 6.6], [0.42, 6.0], [0.62, 4.6], [0.95, 3.0], [1.22, 1.6], [1.38, -1.2], [1.5, -1.2], [1.6, 2.2], [1.95, 2.0], [2.2, -2.6], [3.1, -5.6]],
  thick: { side: 0.55, top: 1.2, front: 1.35, back: 0.5, edge: 0.15 },
  locks: [21, 0.15], fine: [72, 0.04], lift: 0, wobble: 1.3,
  colours: { root: [0.2, 0.12, 0.05], body: [0.6, 0.45, 0.22], sheen: [0.86, 0.74, 0.5] },
});

const BROWS = { y: 1.95, arch: 0.42, thick: [0.62, 0.3], colour: [0.15, 0.085, 0.035] };
const FACE = faceColourGLSL({
  skin: [0.66, 0.43, 0.32], flush: [0.72, 0.34, 0.26], lips: [0.56, 0.25, 0.21], iris: [[0.08, 0.2, 0.46], [0.3, 0.52, 0.78]],
  brows: BROWS, age: 1,
});

const HEAD = headGLSL({
  eye: { gaze: [gazeOf(EYE), gazeOf([-EYE[0], EYE[1], EYE[2]])] },
  mouth: { fold: 1.35 },
});

// the hand that holds the book to his chest: his left, the back of it to us, fingers spread over the cover toward
// his middle and curled round its edge, the thumb up along the top
const BOOK_C = [8.4, -9.0, 7.9];
const BOOK_R = mmul(rotZ(-14), mmul(rotY(-16), rotX(4)));
const BOOK_HALF = [6.4, 9.2, 1.25];
const bookN = mvec(BOOK_R, [0, 0, 1]);
const coverAt = (u, v, lift = 0) => add(BOOK_C, mvec(BOOK_R, [u, v, BOOK_HALF[2] + lift]));
const HAND = (() => {
  const along = norm(mvec(BOOK_R, [-0.62, 0.78, 0]));
  const out = bookN;
  const thumbSide = norm([along[1] * out[2] - along[2] * out[1], along[2] * out[0] - along[0] * out[2], along[0] * out[1] - along[1] * out[0]]);
  const M = [[thumbSide[0], along[0], out[0]], [thumbSide[1], along[1], out[1]], [thumbSide[2], along[2], out[2]]];
  return posedHand({ at: coverAt(4.0, -7.2, 1.3), M, size: 0.98, spread: -1.2,
    curls: [[6, 10, 8], [4, 8, 8], [5, 9, 8], [9, 12, 10]], thumb: { out: 22, down: 26, curl: [10, 16] } });
})();

const SCENE = `
const float TMIN = 120.0, TMAX = 240.0;
const vec3 HEAD_POS = ${g3(HEAD_POS)};
const mat3 HEAD_INV = ${gm3(HEAD_INV)};
const vec3 NECK_TOP = ${g3(NECK_TOP)};
const vec3 NECK_BASE = ${g3(NECK_BASE)};
const vec3 BOOK_C = ${g3(BOOK_C)};
const mat3 BOOK_INV = ${gm3(transpose(BOOK_R))};
const vec3 BOOK_HALF = ${g3(BOOK_HALF)};
${HEAD}
${handGLSL('handL', HAND)}

// ---- light ----
const vec3 KEY_DIR = vec3(0.7, 0.46, 0.55);
const vec3 KEY_COL = vec3(1.55, 1.5, 1.4);
const float KEY_SOFT = 3.0;
const vec3 FILL_DIR = vec3(-0.8, 0.0, 0.6);
const vec3 FILL_COL = vec3(0.13, 0.075, 0.036);
const vec3 RIM_DIR = vec3(-0.5, 0.3, -0.8);
const vec3 RIM_COL = vec3(0.45, 0.85, 1.15);
const vec3 SKY_COL = vec3(0.02, 0.026, 0.036);
const vec3 GROUND_COL = vec3(0.03, 0.035, 0.06);
const vec3 SKIN_AMB = vec3(1.25, 1.0, 0.9);
const vec3 SSS_COL = vec3(0.45, 0.1, 0.04);
const float AO_REACH = 1.6, AO_K = 0.45, EXPOSURE = 0.95;

// ---- hair: swept back from the brow and lifted by the wind, a little grey at the temples ----
${HAIR}

vec2 mapHead(vec3 p) {
  float hbd = length(p - (HEAD_POS + vec3(0.0, -5.0, 0.0)));
  if (hbd > 22.0) return vec2(gShadow ? 1e5 : hbd - 20.0, 1.0);
  vec3 q = HEAD_INV * (p - HEAD_POS);
  vec2 r = headLocal(q);
  // the neck: a column from under the skull into the collar, the two cords running down to the throat
  float neck = sdRoundCone(p, NECK_BASE + vec3(0.0, -6.0, 0.0), NECK_TOP, 4.9, 4.3);
  neck = smin(neck, sdCapsule(p, ${g3(CORDS[0][0])}, ${g3(CORDS[0][1])}, 0.85), 1.3);
  neck = smin(neck, sdCapsule(p, ${g3(CORDS[1][0])}, ${g3(CORDS[1][1])}, 0.85), 1.3);
  r.x = smin(r.x, neck, 1.4);
#ifndef NO_HAIR
  if (skullQ(q) < 4.0) {
    float h = hairShape(q);
    if (h < r.x) r = vec2(h, 3.0);
  }
#endif
  return r;
}

// ---- the body: shoulders under the cloak, the tunic, the high collar, the pendant, the book and the hand ----
float torso(vec3 p) {
  vec3 s = vec3(abs(p.x), p.y, p.z);
  float d = sdEllipsoid(p - vec3(0.0, -14.5, -4.8), vec3(13.8, 13.5, 9.4));
  d = smin(d, sdCapsule(s, vec3(4.0, -1.0, -5.4), vec3(16.2, -5.6, -4.9), 3.5), 4.5);
  d = smin(d, sdEllipsoid(s - vec3(17.2, -9.6, -4.6), vec3(5.0, 6.4, 5.5)), 3.0);
  d = smin(d, sdCapsule(s, vec3(18.4, -9.0, -4.6), vec3(19.4, -36.0, -3.4), 4.6), 2.5);
  d = smin(d, sdEllipsoid(s - vec3(7.4, -11.0, 0.2), vec3(6.6, 4.6, 3.2)), 3.0);
  return d;
}
float folds(vec3 p, float amp) {
  float n = vnoise(p * 0.07) + 0.5 * vnoise(p * 0.15);
  float hang = sin(p.x * 0.62 + 2.4 * n + 0.6 * sin(p.y * 0.11));
  float diag = sin((p.x * 0.5 + p.y * 0.45) * (sign(p.x) * 0.5 + 0.5) * 1.0 + 3.0 * n);
  float down = smoothstep(-4.0, -26.0, p.y);
  return amp * (hang * (0.35 + 0.65 * down) + 0.35 * diag * smoothstep(9.0, 16.0, abs(p.x)));
}
float collarShell(vec3 p, out float inner) {
  vec3 c = p - vec3(0.0, 0.0, -5.4);
  float rr = 8.3 + max(c.y + 1.0, 0.0) * 0.48;
  float rad = length(c.xz * vec2(1.0, 1.12));
  inner = rad - rr;
  float ring = abs(inner) - 0.42;
  float ang = atan(c.x, -c.z);
  float top = 13.0 - 6.0 * smoothstep(0.6, 2.4, abs(ang));
  float d = smax(ring, c.y - top, 0.5);
  d = smax(d, -c.y - 3.0, 0.5);
  d = smax(d, (abs(ang) - 2.15) * rr, 0.6);
  return d * 0.8;
}
float bookShape(vec3 p, out vec3 b) {
  b = BOOK_INV * (p - BOOK_C);
  float d = sdRoundBox(b, BOOK_HALF, 0.35);
  // the pages: inset from the covers on three sides
  float pages = sdRoundBox(b - vec3(0.25, 0.0, 0.0), BOOK_HALF - vec3(0.2, 0.25, 0.32), 0.05);
  d = smax(d, -smax(sdRoundBox(b - vec3(0.6, 0.0, 0.0), BOOK_HALF + vec3(0.0, 0.5, -0.32), 0.0), -pages, 0.02), 0.04);
  return d;
}
vec2 mapBody(vec3 p) {
  float bb = sdBox(p - vec3(0.0, -14.0, 1.0), vec3(28.0, 34.0, 17.0));
  if (bb > 1.0) return vec2(gShadow ? 1e5 : bb, 20.0);
  float base = torso(p);
  // the tunic: close over the chest
  float tunic = base - 1.0;
  vec2 r = vec2(tunic, 21.0);
  // the cloak over it: hanging from the shoulders, open in front down the middle
  float cloak = smin(base - 2.0, sdEllipsoid(p - vec3(0.0, -24.0, -4.6), vec3(22.0, 20.0, 11.5)), 7.0);
  cloak = smax(cloak, p.y - (-2.0 + 0.0), 3.0) ;
  cloak = smin(cloak, sdCapsule(vec3(abs(p.x), p.y, p.z), vec3(5.0, -1.4, -5.4), vec3(16.4, -5.4, -4.8), 5.4), 3.0);
  cloak -= folds(p, 0.85);
  float openW = 4.0 + max(-p.y - 2.0, 0.0) * 0.32;
  cloak = smax(cloak, openW - abs(p.x + 0.4 * sin(p.y * 0.2)), 0.7);
  if (cloak < r.x) r = vec2(cloak, 20.0);
  // the neckband: a stiff band round the neck's root, gold-edged
  vec3 nb = p - vec3(0.0, -0.4, -4.7);
  float band = max(abs(length(nb.xz * vec2(1.0, 1.08)) - 6.1) - 0.5, abs(nb.y) - 1.9);
  band = sdRoundBox(vec3(length(nb.xz * vec2(1.0, 1.08)) - 6.1, nb.y, 0.0), vec3(0.55, 1.9, 1.0), 0.45);
  if (band < r.x) r = vec2(band, nb.y > 1.4 ? 22.0 : 21.0);
  // the neck's root, kept a little inside the head layer's neck so the swaying head always covers it
  float stub = sdRoundCone(p, NECK_BASE + vec3(0.0, -6.0, 0.0), NECK_TOP, 4.1, 3.5);
  if (stub < r.x) r = vec2(stub, 25.0);
  float inner;
  float col = collarShell(p, inner);
  if (col < r.x) r = vec2(col, inner < 0.0 ? 28.0 : 30.0);
  // the pendant on its chain
  vec3 pd = p - vec3(0.4, -11.2, 6.4);
  float disc = sdRoundBox(pd, vec3(1.75, 1.75, 0.22), 0.2);
  disc = max(disc, length(pd.xy) - 1.85);
  float rim = sdTorus(pd.xzy, vec2(1.6, 0.26));
  disc = min(disc, rim);
  if (disc < r.x) r = vec2(disc, 22.0);
  float gem = sdEllipsoid(pd - vec3(0.0, 0.0, 0.3), vec3(0.85, 0.85, 0.45));
  if (gem < r.x) r = vec2(gem, 23.0);
  vec3 sx = vec3(abs(p.x - 0.4), p.y, p.z);
  float chain = min(sdCapsule(sx, vec3(4.2, 0.4, -0.6), vec3(2.6, -5.0, 4.2), 0.14), sdCapsule(sx, vec3(2.6, -5.0, 4.2), vec3(0.6, -9.3, 6.1), 0.14));
  if (chain < r.x) r = vec2(chain, 22.0);
  // the book and the hand on it, the sleeve coming in from below
  vec3 bk;
  float book = bookShape(p, bk);
  if (book < r.x) r = vec2(book, abs(bk.z) < BOOK_HALF.z - 0.3 && bk.x > -BOOK_HALF.x + 0.6 ? 27.0 : 26.0);
  float hb = length(p - ${g3(HAND.palm.c)}) - 11.0;
  float hand = hb > 1.0 ? (gShadow ? 1e5 : hb) : handL(p);
  if (hand < r.x) r = vec2(hand, 24.0);
  float sleeve = sdRoundCone(p, vec3(18.0, -32.0, 5.0), ${g3(add(HAND.palm.c, mvec(HAND.palm.M, [0, -6.2, -0.4])))}, 4.6, 3.6);
  sleeve -= 0.25 * sin(length(p - vec3(18.0, -32.0, 5.0)) * 1.3 + vnoise(p * 0.2) * 2.0);
  if (sleeve * 0.8 < r.x) r = vec2(sleeve * 0.8, 29.0);
  return r;
}

// ---- colour ----
// the gold piping along the cloak's opening and round the collar's edge
float cloakTrim(vec3 p, bool collar) {
  float openW = 4.0 + max(-p.y - 2.0, 0.0) * 0.32;
  float e = abs(abs(p.x + 0.4 * sin(p.y * 0.2)) - openW) * step(p.y, -2.5);
  vec3 c = p - vec3(0.0, 0.0, -5.4);
  float ang = atan(c.x, -c.z);
  float top = 13.0 - 6.0 * smoothstep(0.6, 2.4, abs(ang));
  float rr = 8.3 + max(c.y + 1.0, 0.0) * 0.48;
  float ce = min(top - c.y, (2.15 - abs(ang)) * rr) + (c.y < -3.5 ? 9.0 : 0.0);
  return collar ? 1.0 - step(0.6, ce) : 1.0 - step(0.55, e + (p.y > -2.5 ? 9.0 : 0.0));
}
${FACE}
vec3 albedo(vec3 p, vec3 n, float mat, out vec4 surf) {
  surf = vec4(0.55, 0.25, 0.0, 0.0);
  if (mat < 1.5) { surf = vec4(0.55, 0.22, 1.0, 0.0); return skinAlbedo(HEAD_INV * (p - HEAD_POS)); }
  if (mat < 2.5) return eyeAlbedo(HEAD_INV * (p - HEAD_POS), surf);
  if (mat < 3.5) { surf = vec4(0.35, 0.55, 0.0, 0.0); vec3 hq = HEAD_INV * (p - HEAD_POS); return mix(hairColour(hq), vec3(0.5, 0.47, 0.42), 0.45 * smoothstep(4.6, 6.4, abs(hq.x)) * smoothstep(5.5, 1.0, hq.y)); }
  // the cloth: a fine weave, and the dye a little uneven over larger patches
  float weave = 0.9 + 0.12 * vnoise(p * vec3(9.0, 3.0, 9.0)) + 0.22 * (vnoise(p * vec3(0.6, 0.25, 0.6)) - 0.5);
  if (mat < 20.5) {
    surf = vec4(0.86, 0.07, 0.0, 0.0);
    float tr = cloakTrim(p, false);
    if (tr > 0.5) { surf = vec4(0.38, 0.85, 0.0, 1.0); return vec3(0.8, 0.58, 0.24) * (0.9 + 0.2 * vnoise(p * 6.0)); }
    return vec3(0.02, 0.03, 0.095) * weave;
  }
  if (mat < 21.5) { surf = vec4(0.88, 0.06, 0.0, 0.0); return vec3(0.03, 0.045, 0.12) * weave; }
  if (mat < 22.5) { surf = vec4(0.28, 1.0, 0.0, 1.0); return vec3(0.85, 0.6, 0.24); }
  if (mat < 23.5) { surf = vec4(0.08, 1.2, 0.0, 0.0); return vec3(0.04, 0.16, 0.55); }
  if (mat < 25.5) { surf = vec4(0.55, 0.22, 1.0, 0.0); return vec3(0.64, 0.41, 0.31) * (0.94 + 0.12 * fbm(p * 2.0)); }
  if (mat < 26.5) {
    vec3 b = BOOK_INV * (p - BOOK_C);
    surf = vec4(0.45, 0.4, 0.0, 0.0);
    float edge = min(BOOK_HALF.x - abs(b.x), BOOK_HALF.y - abs(b.y));
    float trim = (1.0 - smoothstep(0.08, 0.16, abs(edge - 0.9))) * step(0.0, b.z);
    vec3 leather = vec3(0.32, 0.035, 0.025) * (0.85 + 0.3 * fbm(p * 3.0));
    if (trim > 0.5) surf = vec4(0.3, 0.9, 0.0, 1.0);
    return mix(leather, vec3(0.8, 0.56, 0.2), trim);
  }
  if (mat < 27.5) { surf = vec4(0.8, 0.05, 0.0, 0.0); return vec3(0.62, 0.55, 0.42) * (0.9 + 0.1 * sin(p.z * 60.0)); }
  if (mat < 28.5) { surf = vec4(0.7, 0.16, 0.0, 0.0); return vec3(0.035, 0.06, 0.17) * weave; }
  if (mat > 29.5) {
    surf = vec4(0.86, 0.07, 0.0, 0.0);
    if (cloakTrim(p, true) > 0.5) { surf = vec4(0.38, 0.85, 0.0, 1.0); return vec3(0.8, 0.58, 0.24) * (0.9 + 0.2 * vnoise(p * 6.0)); }
    return vec3(0.02, 0.03, 0.095) * weave;
  }
  surf = vec4(0.86, 0.07, 0.0, 0.0);
  return vec3(0.02, 0.03, 0.095) * weave;
}
vec3 grade(vec3 c, vec3 p) { return c; }
`;

export const CYRIL = {
  house: 'atreides', name: 'Cyril', pivot: PIVOT, frame: FRAME, head: { pos: HEAD_POS, R: HEAD_R },
  /** The lids layer: where the closed eyes differ from the open ones (frame units). */
  eyes: [toWorld(EYE), toWorld([-EYE[0], EYE[1], EYE[2]])].map((p) => project(FRAME, p)),
  /** Where his mouth, brows and eyes fall in the frame (for animating them). */
  features: faceFeatures({ mouth: { fold: 1.35 } }, BROWS, (q) => project(FRAME, toWorld(q))),
  scene: SCENE,
};
