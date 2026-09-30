// Shared materials, one per MAT key (spec §5.3). HOUSE parts are white and take the per-instance
// house colour; LIGHT parts are unlit and bright enough to bloom. Painted and metal surfaces carry
// a grime/wear texture projected in model space from three sides (triplanar), so detail stays the
// same size on every part whatever its UVs, and worn spots turn rougher.
import * as THREE from 'three';
import { MAT } from './kit.js';
import { HOUSE_RAMP } from './palette.js';
import { detailTexture, treadTexture } from './textures.js';
import { HOUSES } from '../../data/houses.js';

const cache = new Map();
export const HOUSE_TINTED = new Set([MAT.HOUSE, MAT.HOUSE_LIGHT]);

/** Triplanar grime: `scale` repeats per world unit (one tile), `wear` how much worn spots roughen. */
function withDetail(m, key, { scale = 2.4, wear = 1.1 } = {}) {
  const detail = detailTexture();
  if (!detail) return m;   // Node tests: no canvas
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: detail };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObjPos = position;\n  vObjNrm = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying vec3 vObjPos;\nvarying vec3 vObjNrm;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 dw = pow(abs(normalize(vObjNrm)), vec3(4.0));
  dw /= dw.x + dw.y + dw.z;
  vec3 dp = vObjPos * ${scale.toFixed(2)};
  float detail = texture2D(uDetail, dp.zy).r * dw.x + texture2D(uDetail, dp.xz).r * dw.y + texture2D(uDetail, dp.xy).r * dw.z;
  diffuseColor.rgb *= detail;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor + (1.0 - detail) * ${wear.toFixed(2)}, 0.04, 1.0);`);
  };
  m.customProgramCacheKey = () => `detail-${key}`;
  return m;
}

const RAMPS = Object.entries(HOUSE_RAMP).map(([id, tones]) => [new THREE.Color(HOUSES[id].color), ...tones.map((t) => new THREE.Color(t))]);
// North-west and high, as the Genesis sprites are lit whichever way a unit faces: tops take the body
// tone, north-west bevels and slopes the highlight, south and east faces the shadow tone.
const PAINT_LIGHT = new THREE.Vector3(-0.55, 0.62, -0.55).normalize();

/**
 * House paint as the Genesis three-tone ramp: the instance colour picks its house's ramp (nearest
 * house colour; an unknown colour ramps itself), the world normal against PAINT_LIGHT picks the tone,
 * a grey vertex colour darkens it, and a vertex colour above white (glow > 1) lifts it toward the
 * highlight tone, as the Genesis Ornithopter's wings are painted. Scene lighting then lights the result.
 */
function withHouseRamp(m) {
  const before = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    before?.(shader, renderer);
    shader.uniforms.uRampKey = { value: RAMPS.map((r) => r[0]) };
    shader.uniforms.uRampDark = { value: RAMPS.map((r) => r[1]) };
    shader.uniforms.uRampMid = { value: RAMPS.map((r) => r[2]) };
    shader.uniforms.uRampLight = { value: RAMPS.map((r) => r[3]) };
    shader.uniforms.uPaintLight = { value: PAINT_LIGHT };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHouse;\nvarying vec3 vShade;\nvarying vec3 vWorldNrm;')
      .replace('#include <color_vertex>', `#include <color_vertex>
  vShade = vec3(1.0);
#ifdef USE_COLOR
  vShade = color.rgb;
#endif
  vHouse = vec3(1.0);
#ifdef USE_INSTANCING_COLOR
  vHouse = instanceColor.rgb;
#endif`)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
  vec3 houseNrm = objectNormal;
#ifdef USE_INSTANCING
  houseNrm = mat3(instanceMatrix) * houseNrm;
#endif
  vWorldNrm = mat3(modelMatrix) * houseNrm;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
#define RAMPS ${RAMPS.length}
uniform vec3 uRampKey[RAMPS];
uniform vec3 uRampDark[RAMPS];
uniform vec3 uRampMid[RAMPS];
uniform vec3 uRampLight[RAMPS];
uniform vec3 uPaintLight;
varying vec3 vHouse;
varying vec3 vShade;
varying vec3 vWorldNrm;`)
      .replace('#include <color_fragment>', `
  vec3 rDark = vHouse * 0.3, rMid = vHouse, rLight = min(vHouse * 1.5 + 0.08, vec3(1.0));
  float best = 0.004;
  for (int i = 0; i < RAMPS; i++) {
    vec3 d = vHouse - uRampKey[i];
    float e = dot(d, d);
    if (e < best) { best = e; rDark = uRampDark[i]; rMid = uRampMid[i]; rLight = uRampLight[i]; }
  }
  float tone = dot(normalize(vWorldNrm), uPaintLight);
  vec3 paint = mix(rDark, rMid, smoothstep(-0.45, 0.2, tone));
  paint = mix(paint, rLight, smoothstep(0.7, 0.85, tone));
  paint = mix(paint, rLight, clamp(max(vShade.r, max(vShade.g, vShade.b)) - 1.0, 0.0, 1.0));
  diffuseColor.rgb *= paint * min(vShade, vec3(1.0));`);
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${key()}-ramp`;
  return m;
}

function treadMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.15, map: treadTexture() });   // a vertex colour tints the links
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTread;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv.x += aTread;\n#endif');
  };
  m.customProgramCacheKey = () => 'tread';
  return m;
}

export function getMaterial(key) {
  if (cache.has(key)) return cache.get(key);
  let m;
  switch (key) {
    case MAT.PAINT: m = withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.14 }), key); break;
    case MAT.HOUSE: m = withHouseRamp(withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.2 }), key, { wear: 0.9 })); break;
    case MAT.METAL: m = withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85 }), key, { scale: 3.2, wear: 0.8 }); break;
    case MAT.DARK: m = withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0.1 }), key, { scale: 3.2, wear: 0.3 }); break;
    case MAT.TREAD: m = treadMaterial(); break;
    case MAT.GLASS: m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.5, emissive: 0x08131c }); break;
    case MAT.LIGHT:
    case MAT.HOUSE_LIGHT: m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); break;
    default: throw new Error(`unknown material ${key}`);
  }
  m.name = key;
  cache.set(key, m);
  return m;
}
