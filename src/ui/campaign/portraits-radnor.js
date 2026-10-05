// Radnor, Mentat of House Harkonnen (research.md §4), sculpted in 3D: bald and heavy-set, past his prime, a great
// domed skull, a heavy brow ridge under thick dark brows drawn down toward the nose, deep-set heavy-lidded eyes that
// look up at you from a lowered head, a broad fleshy nose, a sly smirk lifting one corner of a thin mouth, jowls. He
// leans forward over his clasped hands, the fingers laced, his forearms in the wide sleeves of a dark red-brown robe
// with a low rolled collar. The furnace of Giedi Prime lights him from the right and a little below; a cold grey
// light falls from above; the fires behind rim him in red.
import { pose, transpose, mvec, add, sub, norm, cross, frameOf, project, posedHand, handGLSL, g3, gm3 } from './portraits-sdf.js';
import { headGLSL, faceColourGLSL, faceFeatures } from './portraits-head.js';

// world: centimetres, origin at the notch at the base of the throat
const CAM = [0, 15, 172];
const FRAME = frameOf({ cam: CAM, top: 31.5, height: 49 });
const HEAD_R = pose({ yaw: 13, pitch: 12, roll: -4 });
const HEAD_POS = [0.4, 17.2, -1.6];
const HEAD_INV = transpose(HEAD_R);
const toWorld = (q) => add(HEAD_POS, mvec(HEAD_R, q));
const toHead = (p) => mvec(HEAD_INV, sub(p, HEAD_POS));
const EYE = [3.25, 0.15, 6.4];
const gazeOf = (eyeHead) => norm(sub(toHead(CAM), eyeHead));
const NECK_TOP = toWorld([0, -6.4, -2.6]);
const NECK_BASE = [0, -1.5, -3.6];
const CORDS = [1, -1].map((k) => [toWorld([4.8 * k, -4.8, -2.8]), [1.4 * k, 0.4, -0.4]]);
const PIVOT = project(FRAME, [0, 1.0, -1.0]).map((v) => Math.round(v));

const PARAMS = {
  cranium: { c: [0, 2.6, -1.0], r: [7.65, 8.55, 9.7], side: 7.05 },
  forehead: { c: [0, 3.5, 3.4], r: [6.3, 5.7, 5.8] },
  zygo: { c: [5.0, -0.9, 5.0], r: [1.85, 1.3, 2.3] },
  maxilla: { c: [0, -4.8, 6.0], r: [3.9, 2.9, 3.6] },
  cheek: { c: [3.8, -4.4, 4.6], r: [2.6, 3.0, 2.8], k: 2.0 },
  lower: { c: [0, -7.3, 3.6], r: [5.3, 3.9, 5.4] },
  jaw: { condyle: [5.4, -2.2, -0.9], gonion: [5.0, -7.7, -0.4], mental: [2.1, -9.9, 6.7], r: 1.2, k: 2.6 },
  chin: { c: [0, -9.75, 7.3], r: [2.3, 1.85, 1.6] },
  eye: { c: EYE, r: 1.2, up: 0.3, dn: -0.36, tilt: -0.05, thick: 0.32, closedUp: -0.4, gaze: [gazeOf(EYE), gazeOf([-EYE[0], EYE[1], EYE[2]])] },
  socket: { d: [0.1, 0.5, 1.1], r: [2.05, 1.45, 1.5], k: 1.0 },
  brow: { a: [0.6, 1.45, 8.85], b: [5.0, 1.55, 6.95], r: 1.12, k: 1.5 },
  nose: { radix: [0, 0.75, 8.35], tip: [0, -3.85, 11.1], bridge: [0.62, 0.86], tipR: [0.98, 0.9, 0.92], ala: [1.5, -4.1, 9.3], alaR: [0.74, 0.64, 0.92], width: 1.12, hump: 0.4 },
  mouth: { c: [0, -6.7, 8.8], w: 2.65, upper: 0.42, lower: 0.64, bend: 0.22, smirk: 0.85, fold: 1.7 },
  ear: { c: [7.35, -1.5, -1.4], h: 3.35, w: 1.85 },
};
// his own forms: jowls hanging over the jaw, the fat under the chin, the furrows between the brows
const EXTRA = `
    d = smin(d, sdEllipsoid(s - vec3(4.3, -8.3, 3.7), vec3(1.8, 2.1, 2.3)), 2.0);
    d = smin(d, sdEllipsoid(q - vec3(0.0, -10.7, 4.4), vec3(4.3, 2.1, 3.7)), 2.4);
    d += 0.07 * smoothstep(5.0, 7.0, q.z) * groove(s.xy, vec2(0.42, 0.9), vec2(0.62, 2.9), 0.16);
    d -= 0.1 * blob(s, vec3(1.3, 2.2, 8.4), vec3(1.0, 0.6, 0.8));`;
// the furrowed forehead and the folds at the back of the neck
const EXTRA_ALL = `
  d += 0.055 * sin(q.y * 5.2 + 0.4 * sin(q.x * 0.6)) * smoothstep(2.6, 3.6, q.y) * (1.0 - smoothstep(6.4, 7.6, q.y)) * smoothstep(5.0, 8.0, q.z) * (1.0 - smoothstep(3.5, 5.5, abs(q.x)));`;
const HEAD = headGLSL(PARAMS, EXTRA, EXTRA_ALL);
const BROWS = { y: 1.75, arch: 0.18, thick: [0.92, 0.5], tilt: 0.48, colour: [0.03, 0.02, 0.016] };
const FACE = faceColourGLSL({
  skin: [0.6, 0.43, 0.35], flush: [0.66, 0.3, 0.25], lips: [0.46, 0.22, 0.2], iris: [[0.12, 0.1, 0.05], [0.42, 0.34, 0.14]],
  whites: [0.48, 0.42, 0.34], brows: BROWS, age: 1, stubble: 0.35,
  nose: PARAMS.nose, ear: PARAMS.ear, mouth: PARAMS.mouth, eye: PARAMS.eye,
});

// the clasped hands: a shallow V in front of his chest, the backs of the hands to us, the fingers laced at the apex,
// each hand's fingers curled over the other's back; his left hand (the viewer's right) a finger's width higher, so
// the fingers alternate
const APEX = [0.2, -11.0, 11.6];
const handAt = (k) => {
  // k = 1 his left hand (viewer's right), -1 his right
  const along = norm([-0.86 * k, 0.08, 0.5]);
  const out = norm([0.5 * k, 0.06, 0.86]);
  const thumbSide = norm(cross(along, out));
  const M = [[thumbSide[0], along[0], out[0]], [thumbSide[1], along[1], out[1]], [thumbSide[2], along[2], out[2]]];
  const knuck = add(APEX, [1.4 * k, k > 0 ? 0.48 : -0.45, -0.6]);
  const at = sub(knuck, mvec(M, [0, 9.3, 0.2]));
  return posedHand({ at, M, size: 1.02, spread: 6.5, mirror: k < 0,
    curls: [[50, 70, 40], [52, 72, 40], [52, 72, 40], [50, 68, 38]], thumb: { out: 20, down: -2, curl: [14, 20] } });
};
const HAND_L = handAt(1), HAND_R = handAt(-1);
const wristOf = (h) => add(h.palm.c, mvec(h.palm.M, [0, -10.2, -0.4]));

const SCENE = `
const float TMIN = 115.0, TMAX = 240.0;
const vec3 HEAD_POS = ${g3(HEAD_POS)};
const mat3 HEAD_INV = ${gm3(HEAD_INV)};
const vec3 NECK_TOP = ${g3(NECK_TOP)};
const vec3 NECK_BASE = ${g3(NECK_BASE)};
${HEAD}
${handGLSL('handL', HAND_L)}
${handGLSL('handR', HAND_R)}

// ---- light: the furnace on his right, a little below; cold grey from above; red fire behind ----
const vec3 KEY_DIR = vec3(0.62, -0.26, 0.74);
const vec3 KEY_COL = vec3(1.75, 0.9, 0.45);
const float KEY_SOFT = 3.2;
const vec3 FILL_DIR = vec3(-0.72, 0.35, 0.6);
const vec3 FILL_COL = vec3(0.1, 0.105, 0.135);
const vec3 RIM_DIR = vec3(-0.66, 0.2, -0.72);
const vec3 RIM_COL = vec3(1.5, 0.36, 0.12);
const vec3 SKY_COL = vec3(0.015, 0.014, 0.016);
const vec3 GROUND_COL = vec3(0.09, 0.025, 0.014);
const vec3 SKIN_AMB = vec3(1.3, 0.95, 0.85);
const float AO_REACH = 1.7, AO_K = 0.45, EXPOSURE = 0.95;

${FACE}

vec2 mapHead(vec3 p) {
  float hbd = length(p - (HEAD_POS + vec3(0.0, -5.0, 0.0)));
  if (hbd > 23.0) return vec2(gShadow ? 1e5 : hbd - 21.0, 1.0);
  vec3 q = HEAD_INV * (p - HEAD_POS);
  vec2 r = headLocal(q);
  // a thick neck, short under the heavy jaw, the cords under it
  float neck = sdRoundCone(p, NECK_BASE + vec3(0.0, -6.0, 0.0), NECK_TOP, 5.9, 5.3);
  neck = smin(neck, sdCapsule(p, ${g3(CORDS[0][0])}, ${g3(CORDS[0][1])}, 1.0), 1.6);
  neck = smin(neck, sdCapsule(p, ${g3(CORDS[1][0])}, ${g3(CORDS[1][1])}, 1.0), 1.6);
  r.x = smin(r.x, neck, 1.8);
  return r;
}

// ---- the body: heavy shoulders hunched forward, the robe, the rolled collar, the sleeves, the clasped hands ----
float torso(vec3 p) {
  vec3 s = vec3(abs(p.x), p.y, p.z);
  float d = sdEllipsoid(p - vec3(0.0, -15.0, -3.2), vec3(15.6, 14.5, 10.4));
  // the trapezius rising to the neck, the shoulders rolled forward
  d = smin(d, sdCapsule(s, vec3(5.0, -1.6, -4.2), vec3(17.0, -5.2, -2.6), 4.0), 5.0);
  d = smin(d, sdEllipsoid(s - vec3(18.2, -8.6, -2.2), vec3(5.6, 6.8, 6.0)), 3.2);
  return d;
}
float folds(vec3 p, float amp) {
  float n = vnoise(p * 0.07) + 0.5 * vnoise(p * 0.15);
  float hang = sin(p.x * 0.5 + 2.4 * n + 0.6 * sin(p.y * 0.11));
  float down = smoothstep(-2.0, -26.0, p.y);
  return amp * hang * (0.3 + 0.7 * down);
}
float sleeve(vec3 p, vec3 sh, vec3 el, vec3 wr) {
  float d = sdRoundCone(p, sh, el, 5.0, 4.6);
  d = smin(d, sdRoundCone(p, el, wr, 4.6, 4.4), 2.0);
  // the cuff, open round the wrist
  d = smax(d, -sdCapsule(p, wr + normalize(wr - el) * 0.5, wr - normalize(wr - el) * 2.5, 3.0), 0.4);
  // the cloth gathers in the crook of the elbow
  d -= 0.35 * sin(dot(p - el, normalize(wr - el)) * 0.9 + vnoise(p * 0.3) * 3.0) * smoothstep(9.0, 2.0, length(p - el));
  return d;
}
vec2 mapBody(vec3 p) {
  float bb = sdBox(p - vec3(0.0, -16.0, 1.0), vec3(28.0, 33.0, 17.0));
  if (bb > 1.0) return vec2(gShadow ? 1e5 : bb, 20.0);
  float base = torso(p);
  float robe = base - 1.6 - folds(p, 0.85);
  // the robe opens in a V over a black under-tunic
  float openW = 2.6 + max(-p.y - 1.0, 0.0) * 0.36;
  float tunic = base - 0.9;
  vec2 r = vec2(tunic, 21.0);
  robe = smax(robe, openW - abs(p.x - 0.3 * sin(p.y * 0.15)), 0.8);
  if (robe < r.x) r = vec2(robe, 20.0);
  // the black under-tunic's band round the neck, and the low rolled collar on the robe, open in front
  float band = sdRoundCone(p, vec3(0.0, -7.0, -3.4), vec3(0.0, 0.0, -3.4), 6.9, 6.6);
  band = smax(band, p.y + 0.4, 0.5);
  if (band < r.x) r = vec2(band, 21.0);
  vec3 c = rx(0.28) * (p - vec3(0.0, -0.2, -3.4));
  float roll = sdTorus(c, vec2(8.0, 2.1));
  roll = smax(roll, -max(abs(c.x) - 4.5, -c.z), 0.7);
  // its two ends run down the edges of the robe's opening, as lapels
  vec3 sx = vec3(abs(p.x), p.y, p.z);
  float lap = sdRoundCone(sx, vec3(6.2, -1.2, 2.6), vec3(3.4, -12.0, 8.3), 2.0, 1.6);
  lap = smin(lap, sdRoundCone(sx, vec3(3.4, -12.0, 8.3), vec3(3.2, -26.0, 8.0), 1.6, 1.5), 1.0);
  roll = smin(roll, lap, 1.6);
  roll -= 0.14 * sin(atan(c.x, c.z) * 9.0 + p.y * 0.6 + vnoise(p * 0.4) * 2.0);
  if (roll < r.x) r = vec2(roll, 22.0);
  // the neck's root, kept a little inside the head layer's neck so the swaying head always covers it
  float stub = sdRoundCone(p, NECK_BASE + vec3(0.0, -6.0, 0.0), NECK_TOP, 5.1, 4.5);
  if (stub < r.x) r = vec2(stub, 25.0);
  // the sleeves, from the shoulders down to the elbows and in to the hands
  float sl = min(sleeve(p, vec3(16.5, -7.0, -2.0), vec3(18.6, -24.0, 1.0), ${g3(wristOf(HAND_L))}),
                 sleeve(p, vec3(-16.5, -7.0, -2.0), vec3(-18.6, -24.0, 1.0), ${g3(wristOf(HAND_R))}));
  if (sl < r.x) r = vec2(sl, 23.0);
  float hb = length(p - ${g3(APEX)}) - 16.0;
  float hand = hb > 1.0 ? (gShadow ? 1e5 : hb) : min(handL(p), handR(p));
  if (hand < r.x) r = vec2(hand, 24.0);
  return r;
}

// ---- colour ----
vec3 albedo(vec3 p, vec3 n, float mat, out vec4 surf) {
  surf = vec4(0.55, 0.25, 0.0, 0.0);
  vec3 q = HEAD_INV * (p - HEAD_POS);
  if (mat < 1.5) {
    surf = vec4(0.48, 0.3, 1.0, 0.0);
    vec3 c = skinAlbedo(q);
    // the scalp: age spots, a sheen
    c = mix(c, c * vec3(0.8, 0.68, 0.6), smoothstep(0.66, 0.8, vnoise(q * 1.1 + 3.0)) * smoothstep(5.0, 8.0, q.y) * 0.5);
    return c;
  }
  if (mat < 2.5) return eyeAlbedo(q, surf);
  if (mat > 3.5 && mat < 6.5) return mouthAlbedo(q, mat, surf);
  // the cloth: a fine weave, and the dye a little uneven over larger patches
  float weave = 0.9 + 0.12 * vnoise(p * vec3(9.0, 3.0, 9.0)) + 0.22 * (vnoise(p * vec3(0.6, 0.25, 0.6)) - 0.5);
  if (mat < 20.5) { surf = vec4(0.86, 0.07, 0.0, 0.0); return vec3(0.085, 0.026, 0.02) * weave; }
  if (mat < 21.5) { surf = vec4(0.88, 0.06, 0.0, 0.0); return vec3(0.02, 0.016, 0.016) * weave; }
  if (mat < 22.5) { surf = vec4(0.78, 0.12, 0.0, 0.0); return vec3(0.11, 0.022, 0.018) * (0.85 + 0.3 * vnoise(p * 2.0)); }
  if (mat < 23.5) { surf = vec4(0.86, 0.07, 0.0, 0.0); return vec3(0.085, 0.026, 0.02) * weave; }
  surf = vec4(0.55, 0.22, 1.0, 0.0);
  return vec3(0.5, 0.34, 0.28) * (0.94 + 0.12 * fbm(p * 2.0));
}
vec3 grade(vec3 c, vec3 p) { return c; }
`;

export const RADNOR = {
  house: 'harkonnen', name: 'Radnor', pivot: PIVOT, frame: FRAME, head: { pos: HEAD_POS, R: HEAD_R },
  /** Where his eyes fall in the frame (the blink's layer is cut round them). */
  eyes: [toWorld(EYE), toWorld([-EYE[0], EYE[1], EYE[2]])].map((p) => project(FRAME, p)),
  /** Where his mouth, brows and eyes fall in the frame (for animating them). */
  features: faceFeatures(PARAMS, BROWS, (q) => project(FRAME, toWorld(q))),
  /** The mouth's own numbers (head space, cm) over HEAD_DEFAULTS.mouth, for the mouth sprites. */
  mouth: PARAMS.mouth,
  scene: SCENE,
};
