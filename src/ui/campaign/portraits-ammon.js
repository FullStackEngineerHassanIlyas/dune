// Ammon, Mentat of House Ordos (research.md §4), sculpted in 3D: slim, a narrow long face with high cheekbones and
// hollow cheeks, a thin aquiline nose, narrow cool eyes under arched brows, a thin mouth with the ghost of a smile,
// dark-brown hair slicked flat and back from a widow's peak. His chin is lifted a little: he looks down his nose at
// you. A dark green robe open over a teal tunic with a standing collar, an oval pendant with a green stone, his right
// hand laid on his heart. The cold light of the Ordos ice hall falls from above on his right; the ice behind rims
// him in pale teal.
import { pose, transpose, mvec, add, sub, mul, norm, cross, dot, frameOf, project, posedHand, handGLSL, g3, gm3 } from './portraits-sdf.js';
import { headGLSL, hairGLSL, faceColourGLSL, faceFeatures } from './portraits-head.js';

// world: centimetres, origin at the notch at the base of the throat
const CAM = [0, 18, 172];
const FRAME = frameOf({ cam: CAM, top: 33.8, height: 53 });
const HEAD_R = pose({ yaw: 11, pitch: -3, roll: 2 });
const HEAD_POS = [0.2, 17.4, -3.4];
const HEAD_INV = transpose(HEAD_R);
const toWorld = (q) => add(HEAD_POS, mvec(HEAD_R, q));
const toHead = (p) => mvec(HEAD_INV, sub(p, HEAD_POS));
const EYE = [3.1, 0.3, 6.5];
const gazeOf = (eyeHead) => norm(sub(toHead(CAM), eyeHead));
const NECK_TOP = toWorld([0, -6.3, -2.6]);
const NECK_BASE = [0, -1.5, -4.4];
const CORDS = [1, -1].map((k) => [toWorld([4.2 * k, -4.6, -2.7]), [1.0 * k, 0.4, -1.0]]);
const PIVOT = project(FRAME, [0, 1.0, -1.5]).map((v) => Math.round(v));

const PARAMS = {
  cranium: { c: [0, 2.7, -1.1], r: [7.0, 8.6, 9.5], side: 6.45 },
  forehead: { c: [0, 3.7, 3.3], r: [5.6, 5.4, 5.6] },
  zygo: { c: [4.55, -0.8, 5.0], r: [1.7, 1.05, 2.0], k: 2.6, arch: [5.75, -0.8, 0.4] },
  maxilla: { c: [0, -4.8, 5.9], r: [3.2, 2.6, 3.4] },
  cheek: { c: [3.2, -4.4, 3.9], r: [2.1, 2.7, 2.5], k: 1.7 },
  lower: { c: [0, -7.3, 3.3], r: [4.1, 3.6, 5.2] },
  jaw: { condyle: [4.6, -2.4, -1.0], gonion: [4.0, -7.7, -0.3], mental: [1.45, -10.3, 6.8], r: 0.85, k: 2.6 },
  chin: { c: [0, -10.15, 7.45], r: [1.55, 1.85, 1.4] },
  eye: { c: EYE, r: 1.18, up: 0.33, dn: -0.4, tilt: 0.12, thick: 0.25, closedUp: -0.38, gaze: [gazeOf(EYE), gazeOf([-EYE[0], EYE[1], EYE[2]])] },
  socket: { d: [0.1, 0.4, 1.35], r: [1.9, 1.3, 1.25] },
  brow: { a: [0.7, 1.8, 8.5], b: [4.6, 1.95, 6.85], r: 0.62 },
  nose: { radix: [0, 1.15, 8.4], tip: [0, -3.75, 11.05], bridge: [0.44, 0.6], tipR: [0.7, 0.7, 0.72], ala: [1.12, -4.05, 9.4], alaR: [0.58, 0.55, 0.8], width: 1.45, hump: 0.65 },
  mouth: { c: [0, -6.55, 8.6], w: 2.2, upper: 0.4, lower: 0.5, bend: 0.22, smirk: 0.18, fold: 0.9 },
  ear: { c: [6.75, -1.0, -1.4], h: 3.0, w: 1.6 },
};
// his own forms: hollows under the cheekbones, a long philtrum, a crease of disdain at the mouth's corner
const EXTRA = `
    d += 0.08 * blob(s, vec3(3.7, -4.9, 5.0), vec3(1.7, 1.9, 1.5));
    d += 0.05 * smoothstep(5.0, 7.0, q.z) * groove(s.xy, vec2(2.35, -6.2), vec2(2.9, -7.4), 0.2);`;
const HEAD = headGLSL(PARAMS, EXTRA);
const HAIR = hairGLSL({
  line: [[0, 5.5], [0.17, 6.25], [0.45, 5.9], [0.66, 4.3], [0.95, 3.1], [1.22, 1.7], [1.38, -0.8], [1.5, -0.8], [1.6, 2.1], [1.95, 1.9], [2.2, -2.6], [3.1, -5.8]],
  thick: { side: 0.42, top: 0.7, front: 0.5, back: 0.35, edge: 0.18 },
  locks: [30, 0.03], fine: [96, 0.02], lift: 0, wobble: 0.8,
  colours: { root: [0.025, 0.015, 0.008], body: [0.1, 0.058, 0.03], sheen: [0.36, 0.27, 0.18] },
});
const BROWS = { y: 2.0, arch: 0.62, thick: [0.42, 0.18], tilt: -0.05, colour: [0.04, 0.025, 0.015] };
const FACE = faceColourGLSL({
  skin: [0.6, 0.4, 0.29], flush: [0.64, 0.33, 0.25], lips: [0.48, 0.25, 0.22], iris: [[0.08, 0.14, 0.07], [0.32, 0.42, 0.22]],
  whites: [0.5, 0.47, 0.44], brows: BROWS, age: 0.35, stubble: 0.12,
  nose: PARAMS.nose, ear: PARAMS.ear, mouth: PARAMS.mouth, eye: PARAMS.eye,
});

// the right hand laid on his heart: across his chest from the lower left, the back of it to us, the fingers together
// and pointing up toward his left shoulder, the thumb tucked along the index finger
const CHEST = (x, y) => [x, y, 7.4 - 0.004 * x * x - 0.006 * (y + 10) * (y + 10)];
const HAND = (() => {
  const at = CHEST(-3.2, -16.6);
  const tip = CHEST(7.0, -8.6);
  const along = norm(sub(tip, at));
  let out = norm([-0.12, -0.1, 1]);
  out = norm(sub(out, mul(along, dot(out, along))));
  const side = norm(cross(along, out));
  const M = [[side[0], along[0], out[0]], [side[1], along[1], out[1]], [side[2], along[2], out[2]]];
  return posedHand({ at: add(at, mul(out, 1.3)), M, size: 0.95, spread: -1.0, mirror: true,
    curls: [[8, 12, 8], [6, 10, 8], [8, 12, 8], [12, 14, 10]], thumb: { out: 14, down: 18, curl: [8, 10] } });
})();
const WRIST = add(HAND.palm.c, mvec(HAND.palm.M, [0, -10.0, -0.6]));

const SCENE = `
const float TMIN = 115.0, TMAX = 240.0;
const vec3 HEAD_POS = ${g3(HEAD_POS)};
const mat3 HEAD_INV = ${gm3(HEAD_INV)};
const vec3 NECK_TOP = ${g3(NECK_TOP)};
const vec3 NECK_BASE = ${g3(NECK_BASE)};
${HEAD}
${HAIR}
${handGLSL('handR', HAND)}

// ---- light: the ice hall's cold light from above on his right, a faint warm lamp far on the left, pale teal behind ----
const vec3 KEY_DIR = vec3(0.6, 0.62, 0.5);
const vec3 KEY_COL = vec3(1.5, 1.5, 1.55);
const float KEY_SOFT = 3.0;
const vec3 FILL_DIR = vec3(-0.85, 0.05, 0.5);
const vec3 FILL_COL = vec3(0.1, 0.075, 0.05);
const vec3 RIM_DIR = vec3(-0.62, 0.3, -0.72);
const vec3 RIM_COL = vec3(0.45, 1.15, 1.1);
const vec3 SKY_COL = vec3(0.02, 0.03, 0.036);
const vec3 GROUND_COL = vec3(0.02, 0.05, 0.045);
const vec3 SKIN_AMB = vec3(1.2, 1.0, 0.95);
const float AO_REACH = 1.6, AO_K = 0.45, EXPOSURE = 0.95;

${FACE}

vec2 mapHead(vec3 p) {
  float hbd = length(p - (HEAD_POS + vec3(0.0, -5.0, 0.0)));
  if (hbd > 22.0) return vec2(gShadow ? 1e5 : hbd - 20.0, 1.0);
  vec3 q = HEAD_INV * (p - HEAD_POS);
  vec2 r = headLocal(q);
  // a slim neck, the cords standing out a little
  float neck = sdRoundCone(p, NECK_BASE + vec3(0.0, -6.0, 0.0), NECK_TOP, 4.6, 4.1);
  neck = smin(neck, sdCapsule(p, ${g3(CORDS[0][0])}, ${g3(CORDS[0][1])}, 0.8), 1.2);
  neck = smin(neck, sdCapsule(p, ${g3(CORDS[1][0])}, ${g3(CORDS[1][1])}, 0.8), 1.2);
  r.x = smin(r.x, neck, 1.3);
#ifndef NO_HAIR
  if (skullQ(q) < 3.0) {
    float h = hairShape(q);
    if (h < r.x) r = vec2(h, 3.0);
  }
#endif
  return r;
}

// ---- the body: narrow shoulders, the robe open over the tunic, the standing collar, the pendant, the hand ----
float torso(vec3 p) {
  vec3 s = vec3(abs(p.x), p.y, p.z);
  float d = sdEllipsoid(p - vec3(0.0, -15.0, -4.4), vec3(13.2, 14.0, 9.2));
  d = smin(d, sdCapsule(s, vec3(4.2, -1.6, -5.0), vec3(15.0, -5.2, -4.4), 3.3), 4.4);
  d = smin(d, sdEllipsoid(s - vec3(16.0, -9.0, -4.0), vec3(4.6, 6.0, 5.2)), 3.0);
  d = smin(d, sdCapsule(s, vec3(17.0, -9.0, -4.0), vec3(17.6, -36.0, -3.0), 4.3), 2.5);
  return d;
}
float folds(vec3 p, float amp) {
  float n = vnoise(p * 0.07) + 0.5 * vnoise(p * 0.15);
  float hang = sin(p.x * 0.7 + 2.0 * n + 0.5 * sin(p.y * 0.12));
  float down = smoothstep(-4.0, -26.0, p.y);
  return amp * hang * (0.3 + 0.7 * down);
}
vec2 mapBody(vec3 p) {
  float bb = sdBox(p - vec3(0.0, -14.0, 1.0), vec3(28.0, 34.0, 17.0));
  if (bb > 1.0) return vec2(gShadow ? 1e5 : bb, 20.0);
  float base = torso(p);
  // the teal tunic, close over the chest
  vec2 r = vec2(base - 0.8, 21.0);
  // the robe over it, open in a long V
  float robe = base - 1.9 - folds(p, 0.8);
  float openW = 3.0 + max(-p.y - 1.0, 0.0) * 0.3;
  robe = smax(robe, openW - abs(p.x), 0.8);
  // the robe's edges turned back as narrow lapels
  vec3 sx = vec3(abs(p.x), p.y, p.z);
  float lap = sdRoundCone(sx, vec3(5.6, -1.0, 1.0), vec3(3.4, -12.0, 7.6), 1.1, 0.9);
  lap = smin(lap, sdRoundCone(sx, vec3(3.4, -12.0, 7.6), vec3(3.9, -28.0, 7.2), 0.9, 0.9), 1.0);
  robe = smin(robe, lap, 1.2);
  if (robe < r.x) r = vec2(robe, 20.0);
  // the tunic's standing collar, a stiff band round the neck, open a little at the throat
  vec3 nb = p - vec3(0.0, 0.6, -4.2);
  float rad = length(nb.xz * vec2(1.0, 1.06));
  float band = sdRoundBox(vec3(rad - 5.5, nb.y - 0.4 * max(nb.z, 0.0) * 0.0, 0.0), vec3(0.45, 2.5, 1.0), 0.4);
  band = smax(band, (0.9 - abs(nb.x)) * step(0.0, nb.z), 0.3);
  if (band < r.x) r = vec2(band, 22.0);
  // the neck's root, kept a little inside the head layer's neck so the swaying head always covers it
  float stub = sdRoundCone(p, NECK_BASE + vec3(0.0, -6.0, 0.0), NECK_TOP, 3.8, 3.3);
  if (stub < r.x) r = vec2(stub, 25.0);
  // the pendant: a pale gold oval with a green stone, on a fine chain
  vec3 pd = p - vec3(0.3, -9.6, 7.0);
  float disc = sdEllipsoid(pd, vec3(1.2, 1.7, 0.35));
  disc = smin(disc, sdTorus((pd * vec3(1.0, 0.72, 1.0)).xzy, vec2(1.15, 0.2)), 0.2);
  if (disc < r.x) r = vec2(disc, 26.0);
  float gem = sdEllipsoid(pd - vec3(0.0, 0.0, 0.32), vec3(0.6, 0.9, 0.38));
  if (gem < r.x) r = vec2(gem, 27.0);
  vec3 cx = vec3(abs(p.x - 0.3), p.y, p.z);
  float chain = min(sdCapsule(cx, vec3(4.6, 0.6, -0.4), vec3(2.6, -4.6, 4.8), 0.12), sdCapsule(cx, vec3(2.6, -4.6, 4.8), vec3(0.2, -7.9, 6.9), 0.12));
  if (chain < r.x) r = vec2(chain, 26.0);
  // the hand and its sleeve, coming up from below on the left
  float hb = length(p - ${g3(HAND.palm.c)}) - 11.0;
  float hand = hb > 1.0 ? (gShadow ? 1e5 : hb) : handR(p);
  if (hand < r.x) r = vec2(hand, 24.0);
  float sleeve = sdRoundCone(p, vec3(-15.0, -34.0, 2.0), ${g3(WRIST)}, 4.6, 3.5);
  sleeve -= 0.25 * sin(length(p - vec3(-15.0, -34.0, 2.0)) * 1.2 + vnoise(p * 0.2) * 2.0);
  sleeve = smax(sleeve, -sdCapsule(p, ${g3(WRIST)}, ${g3(add(WRIST, mvec(HAND.palm.M, [0, -3, 0])))}, 2.6), 0.4);
  if (sleeve * 0.8 < r.x) r = vec2(sleeve * 0.8, 23.0);
  return r;
}

// ---- colour ----
vec3 albedo(vec3 p, vec3 n, float mat, out vec4 surf) {
  surf = vec4(0.55, 0.25, 0.0, 0.0);
  vec3 q = HEAD_INV * (p - HEAD_POS);
  if (mat < 1.5) { surf = vec4(0.55, 0.22, 1.0, 0.0); return skinAlbedo(q); }
  if (mat < 2.5) return eyeAlbedo(q, surf);
  if (mat < 3.5) { surf = vec4(0.22, 0.85, 0.0, 0.0); return hairColour(q); }
  // the cloth: a fine weave, and the dye a little uneven over larger patches
  float weave = 0.9 + 0.12 * vnoise(p * vec3(9.0, 3.0, 9.0)) + 0.22 * (vnoise(p * vec3(0.6, 0.25, 0.6)) - 0.5);
  if (mat < 20.5) { surf = vec4(0.84, 0.08, 0.0, 0.0); return vec3(0.016, 0.05, 0.03) * weave; }
  if (mat < 21.5) { surf = vec4(0.7, 0.14, 0.0, 0.0); return vec3(0.025, 0.12, 0.12) * weave; }
  if (mat < 22.5) { surf = vec4(0.62, 0.2, 0.0, 0.0); return vec3(0.035, 0.17, 0.16) * weave; }
  if (mat < 23.5) { surf = vec4(0.84, 0.08, 0.0, 0.0); return vec3(0.016, 0.05, 0.03) * weave; }
  if (mat < 25.5) { surf = vec4(0.55, 0.22, 1.0, 0.0); return vec3(0.58, 0.39, 0.29) * (0.94 + 0.12 * fbm(p * 2.0)); }
  if (mat < 26.5) { surf = vec4(0.25, 1.0, 0.0, 1.0); return vec3(0.82, 0.68, 0.4); }
  surf = vec4(0.06, 1.2, 0.0, 0.0);
  return vec3(0.03, 0.4, 0.16);
}
vec3 grade(vec3 c, vec3 p) { return c; }
`;

export const AMMON = {
  house: 'ordos', name: 'Ammon', pivot: PIVOT, frame: FRAME, head: { pos: HEAD_POS, R: HEAD_R },
  /** Where his eyes fall in the frame (the blink's layer is cut round them). */
  eyes: [toWorld(EYE), toWorld([-EYE[0], EYE[1], EYE[2]])].map((p) => project(FRAME, p)),
  /** Where his mouth, brows and eyes fall in the frame (for animating them). */
  features: faceFeatures(PARAMS, BROWS, (q) => project(FRAME, toWorld(q))),
  scene: SCENE,
};
