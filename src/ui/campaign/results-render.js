// The pictures of the screens after a mission, made from this game's own 3D models (src/render/models) and
// rendered once, offline, to the WebP files under assets/campaign/results/ by assets/campaign/results/make.mjs
// (headless Chrome on the real GPU). Nothing here runs in the game: the screens only show the files.
//  - victory-<house>: the house's base at the golden hour on a rock plateau, the CHOAM Frigate coming down over
//    the Starport, a V of Carryalls in the house colour crossing the sky, tanks and a squad by the house banner
//    on a ledge in front (our own composition; the Sega shows one still picture after every won mission).
//  - defeat-<house>: the same base at dusk, burning: black smoke columns, fires, wrecks, a fallen banner and
//    enemy tanks dark on the ridge beyond.
//  - line-<subject>: line art of a Combat Tank, a Soldier or an Ornithopter for the score screen's gold backdrop
//    (research.md §5): the model's silhouette and creases outlined from its depth and normals, its shading
//    engraved as hatching whose strokes thicken where it is dark; dark ink on white, which the page multiplies
//    onto the gold.
// Rendering is deterministic: Math.random is swapped for a seeded generator while a scene is built and run.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GameMap } from '../../sim/map.js';
import { G } from '../../data/terrain.js';
import { HOUSES } from '../../data/houses.js';
import { Heightfield } from '../../render/heightfield.js';
import { TerrainView } from '../../render/terrain.js';
import { createEnvironment } from '../../render/sky.js';
import { Effects } from '../../render/effects.js';
import { InstancedModel } from '../../render/models/instancer.js';
import { modelDef } from '../../render/models/index.js';
import { MAT } from '../../render/models/kit.js';
import { poseMatrix } from '../../render/views/pose.js';

/** Every picture the screens use: file name (without .webp) → what to render. */
export const RESULT_ART = {
  'victory-atreides': { kind: 'victory', house: 'atreides' },
  'victory-ordos': { kind: 'victory', house: 'ordos' },
  'victory-harkonnen': { kind: 'victory', house: 'harkonnen' },
  'defeat-atreides': { kind: 'defeat', house: 'atreides' },
  'defeat-ordos': { kind: 'defeat', house: 'ordos' },
  'defeat-harkonnen': { kind: 'defeat', house: 'harkonnen' },
  'line-tank': { kind: 'line', subject: 'tank' },
  'line-soldier': { kind: 'line', subject: 'soldier' },
  'line-ornithopter': { kind: 'line', subject: 'ornithopter' },
};

const ENEMY = { atreides: 'harkonnen', ordos: 'atreides', harkonnen: 'ordos' };
/** Each house's own heavy unit, drawn up with its tanks after a victory. */
const SPECIAL = { atreides: 'sonicTank', ordos: 'deviator', harkonnen: 'devastator' };

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** Runs `fn` with Math.random seeded, so the same scene comes out the same every time. */
async function withSeed(seed, fn) {
  const real = Math.random;
  Math.random = seeded(seed);
  try { return await fn(); } finally { Math.random = real; }
}

// ---- the sky: a gradient dome with the sun's disc and glow and thin bands of high cloud ----
function skyDome({ zenith, mid, horizon, below, sun, sunColor, sunSize = 1, glow = 1, clouds = 0.5, cloudColor = [1, 0.85, 0.7], cloudDark = [0.5, 0.4, 0.35] }) {
  const v3 = (a) => new THREE.Vector3(...a);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uZenith: { value: v3(zenith) }, uMid: { value: v3(mid) }, uHorizon: { value: v3(horizon) }, uBelow: { value: v3(below) },
      uSun: { value: sun.clone().normalize() }, uSunColor: { value: v3(sunColor) }, uSunSize: { value: sunSize }, uGlow: { value: glow },
      uClouds: { value: clouds }, uCloud: { value: v3(cloudColor) }, uCloudDark: { value: v3(cloudDark) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uMid, uHorizon, uBelow, uSun, uSunColor, uCloud, uCloudDark;
      uniform float uSunSize, uGlow, uClouds;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(mix(uHorizon, uMid, smoothstep(0.0, 0.16, h)), uZenith, smoothstep(0.12, 0.75, h)) : mix(uHorizon, uBelow, smoothstep(0.0, 0.08, -h));
        float s = max(dot(d, uSun), 0.0);
        col += uSunColor * (pow(s, 2200.0 / uSunSize) * 14.0 + pow(s, 260.0) * 1.2 * uGlow + pow(s, 24.0) * 0.35 * uGlow + pow(s, 4.0) * 0.12 * uGlow);
        if (h > 0.0 && uClouds > 0.0) {
          vec2 p = d.xz / (h + 0.18);
          float c = fbm(p * vec2(1.1, 3.6) + vec2(3.0, 1.0));
          c = smoothstep(0.52, 0.85, c) * smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.35, 0.8, h));
          vec3 cc = mix(uCloudDark, uCloud, clamp(pow(s, 3.0) * 1.4 + 0.25, 0.0, 1.0));
          col = mix(col, cc, c * uClouds);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 64, 32), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

// ---- grade, vignette and grain, in display space after the tone mapping ----
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.35 }, uGrain: { value: 0.035 }, uLift: { value: new THREE.Vector3(0.02, 0.015, 0.02) },
    uGain: { value: new THREE.Vector3(1, 1, 1) }, uSaturation: { value: 1.05 }, uContrast: { value: 1.06 }, uAspect: { value: 16 / 9 }, uFloor: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVignette, uGrain, uSaturation, uContrast, uAspect, uFloor; uniform vec3 uLift, uGain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c = (c - 0.5) * uContrast + 0.5;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      c = uLift + c * (uGain - uLift);
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0) / uAspect * 1.6;
      c *= mix(1.0, 1.0 - smoothstep(0.35, 1.05, length(q)), uVignette);
      c *= 1.0 - uFloor * smoothstep(0.34, 0.0, vUv.y);   // the foreground sinks into shade, under the buttons
      c += (hash(vUv * 1931.0) - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

/** A renderer drawing `scene` through bloom and the finish into a canvas of width x height, supersampled. */
function makeRenderer(width, height, ss) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width * ss, height * ss, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

function compose(renderer, scene, camera, { width, height, ss, bloom = [0.45, 0.55, 0.88], finish = {} }) {
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(width * ss, height * ss, { type: THREE.HalfFloatType, samples: 4 }));
  composer.setPixelRatio(1);
  composer.setSize(width * ss, height * ss);
  composer.addPass(new RenderPass(scene, camera));
  if (bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(width * ss / 2, height * ss / 2), ...bloom));
  composer.addPass(new OutputPass());
  const fin = new ShaderPass(FinishShader);
  for (const [k, v] of Object.entries(finish)) {
    if (Array.isArray(v)) fin.uniforms[k].value.set(...v); else fin.uniforms[k].value = v;
  }
  fin.uniforms.uAspect.value = width / height;
  composer.addPass(fin);
  return composer;
}

/** The supersampled frame scaled down to width x height in a 2D canvas (the file is written from it). */
function downsample(src, width, height) {
  let cur = src;
  // halve step by step for a clean box filter
  while (cur.width >= width * 2 && cur.height >= height * 2) {
    const c = document.createElement('canvas');
    c.width = Math.round(cur.width / 2); c.height = Math.round(cur.height / 2);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
  }
  const out = document.createElement('canvas');
  out.width = width; out.height = height;
  const g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(cur, 0, 0, width, height);
  return out;
}

function disposeScene(scene) {
  scene.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); }
  });
}

// ---- the ground: a GameMap painted with rock, sand and dunes, drawn by the game's own terrain ----
function paintGround(w, h, rocks, dunes, mountains = []) {
  const map = new GameMap(w, h);
  map.seed = 7;
  const inside = (x, y, [cx, cy, rx, ry, wob = 0]) => {
    const a = Math.atan2(y - cy, x - cx);
    const r = 1 + wob * (Math.sin(a * 3 + cx) * 0.6 + Math.sin(a * 5 + cy) * 0.4);
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= r * r;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (mountains.some((e) => inside(x + 0.5, y + 0.5, e))) map.ground[i] = G.MOUNTAIN;
    else if (rocks.some((e) => inside(x + 0.5, y + 0.5, e))) map.ground[i] = G.ROCK;
    else if (dunes.some((e) => inside(x + 0.5, y + 0.5, e))) map.ground[i] = G.DUNE;
    else map.ground[i] = G.SAND;
  }
  return map;
}

/** A structure or unit placer over one map: each model type gets one InstancedModel. */
function placer(scene, terrain, hf) {
  const models = new Map(), own = [];
  // A wreck is drawn by a model of its own: its lamps and glowing parts out, every other part burnt to char (one
  // dull near-black, so no clean barrel or bright wheel survives). A tinted model takes `tint` over its painted
  // and metal parts (the Carryalls in the house colour).
  const get = (id, { wreck = false, tint = null } = {}) => {
    const key = wreck ? `${id}:wreck` : tint != null ? `${id}:${tint}` : id;
    if (!models.has(key)) {
      const m = new InstancedModel(modelDef(id), scene, { capacity: 12 });   // never grown: a grown model takes back the shared materials
      m.def.parts.forEach((p, i) => {
        const mesh = m.meshes[i];
        if (wreck && (p.material === MAT.LIGHT || p.material === MAT.HOUSE_LIGHT)) { mesh.visible = false; return; }
        if (wreck) {
          const char = new THREE.MeshStandardMaterial({ vertexColors: true, color: p.material === MAT.TREAD ? 0x2a2622 : 0x1f1b18, roughness: 1, metalness: 0, map: mesh.material.map ?? null });
          mesh.material = char;
          own.push(char);
        } else if (tint != null && (p.material === MAT.PAINT || p.material === MAT.METAL)) {
          // the shared material's grime pass kept: its shader does not depend on the colour
          const base = mesh.material, c = base.clone();
          c.onBeforeCompile = base.onBeforeCompile;
          c.customProgramCacheKey = base.customProgramCacheKey;
          c.color.set(tint);
          mesh.material = c;
          own.push(c);
        }
      });
      models.set(key, m);
    }
    return models.get(key);
  };
  const map = terrain.map;
  return {
    models,
    /** A building with its footprint's top-left tile at (x, y), levelled and on concrete. */
    building(id, x, y, w, h, house, { heading = 0, params = {}, sink = 0, tilt = null, concrete = true, color = null } = {}) {
      const floor = terrain.flattenFootprint(x, y, w, h);
      if (concrete) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) map.concrete[j * map.w + i] = 1;
      map.concreteRevision++;
      const m = get(id), hd = m.add();
      poseMatrix(hd.matrix, x + w / 2, floor - sink, y + h / 2, heading);
      if (tilt) hd.matrix.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...tilt)));
      hd.color.set(color ?? HOUSES[house].color);
      Object.assign(hd.params, params);
      return hd;
    },
    /** A unit standing at (x, z) facing `heading`, `lift` above the ground. */
    unit(id, x, z, heading, house, { lift = 0, params = {}, tilt = null, color = null, scale = 1, wreck = false, tint = null } = {}) {
      const m = get(id, { wreck, tint }), hd = m.add();
      const n = hf.normalAt ? hf.normalAt(x, z) : null;
      poseMatrix(hd.matrix, x, hf.heightAt(x, z) + lift, z, heading, Math.abs(lift) > 0.5 ? null : n);
      if (tilt) hd.matrix.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...tilt)));
      if (scale !== 1) hd.matrix.scale(new THREE.Vector3(scale, scale, scale));
      hd.color.set(wreck ? 0xffffff : color ?? HOUSES[house].color);   // the char is the wreck's only colour
      Object.assign(hd.params, params);
      return hd;
    },
    update() { for (const m of models.values()) m.update(); },
    dispose() { for (const m of models.values()) m.dispose(); for (const c of own) c.dispose(); },
  };
}

/**
 * A house banner: a tall swallow-tailed cloth in the house colour hanging from a crossbar on a pole, gold-trimmed,
 * a gold lozenge on it (a plain heraldic device, not the house's crest), stirred by the wind. `burnt`: after the
 * battle, the cloth dulled and smoke-dark, its trim tarnished, the swallowtail burnt away to a ragged, scorched
 * edge and holes burnt through it.
 */
function banner(house, { height = 1.5, width = 0.6, ripple = 1, burnt = false } = {}) {
  const group = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x2e2824, metalness: 0.75, roughness: 0.38 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: 0.95, roughness: 0.28 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.024, height, 12), iron);
  pole.position.y = height / 2;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, width + 0.12, 10), iron);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, height - 0.06, 0);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 10), gold);
  knob.position.y = height + 0.02;
  const ends = [-1, 1].map((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), gold); e.position.set(s * (width / 2 + 0.06), height - 0.06, 0); return e; });
  // the cloth's face, drawn on a canvas: the colour darkening to its foot, gold trim, the lozenge, the swallowtail
  const W = 192, H = 448, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const house3 = new THREE.Color(HOUSES[house].color);
  if (burnt) house3.lerp(new THREE.Color(0x1c1612), 0.5);
  const col = `#${house3.getHexString()}`, trim = burnt ? '#7a5e2c' : '#e2b043', trimLit = burnt ? '#86672f' : '#e8bb52';
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W / 2, H * 0.84); g.lineTo(0, H); g.closePath();
  g.save(); g.clip();
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(255,255,255,0.12)'); shade.addColorStop(0.5, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = col; g.fillRect(0, 0, W, H);
  g.fillStyle = shade; g.fillRect(0, 0, W, H);
  g.strokeStyle = trim; g.lineWidth = 14; g.stroke();
  g.strokeStyle = '#6a4a12'; g.lineWidth = 3; g.stroke();
  g.fillStyle = trim; g.fillRect(0, 34, W, 12);
  g.beginPath(); g.moveTo(W / 2, 130); g.lineTo(W / 2 + 48, 210); g.lineTo(W / 2, 290); g.lineTo(W / 2 - 48, 210); g.closePath();
  g.fillStyle = trimLit; g.fill(); g.lineWidth = 4; g.strokeStyle = '#6a4a12'; g.stroke();
  g.beginPath(); g.moveTo(W / 2, 162); g.lineTo(W / 2 + 28, 210); g.lineTo(W / 2, 258); g.lineTo(W / 2 - 28, 210); g.closePath();
  g.fillStyle = col; g.fill();
  if (burnt) {
    // smoke-dark from the foot up, and soot in drifts
    const soot = g.createLinearGradient(0, H * 0.3, 0, H);
    soot.addColorStop(0, 'rgba(14,9,6,0)'); soot.addColorStop(1, 'rgba(14,9,6,0.85)');
    g.fillStyle = soot; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) {
      const x = rnd(0, W), y = rnd(H * 0.2, H), r = rnd(10, 34);
      const blot = g.createRadialGradient(x, y, 0, x, y, r);
      blot.addColorStop(0, 'rgba(10,6,4,0.55)'); blot.addColorStop(1, 'rgba(10,6,4,0)');
      g.fillStyle = blot; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  g.restore();
  if (burnt) {
    // the foot burnt away to a ragged line, and holes burnt through; every burnt edge charred, a last ember on it
    const edge = [];
    for (let x = -4; x <= W + 4; x += 8) edge.push([x, H * 0.62 + Math.sin(x * 0.07) * 18 + rnd(-14, 14)]);
    const holes = [[W * 0.28, H * 0.44, 15], [W * 0.7, H * 0.53, 11], [W * 0.56, H * 0.3, 7]].map(([x, y, r]) => Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2, rr = r * rnd(0.6, 1.3);
      return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
    }));
    const trace = (pts, close) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); };
    const below = () => { trace(edge, false); g.lineTo(W + 4, H + 4); g.lineTo(-4, H + 4); g.closePath(); };
    g.lineJoin = 'round';
    for (const [w, c] of [[16, 'rgba(12,7,4,0.9)'], [5, 'rgba(255,110,30,0.55)']]) {
      g.strokeStyle = c; g.lineWidth = w;
      trace(edge, false); g.stroke();
      for (const h of holes) { trace(h, true); g.stroke(); }
    }
    g.globalCompositeOperation = 'destination-out';
    below(); g.fill();
    for (const h of holes) { trace(h, true); g.fill(); }
    g.globalCompositeOperation = 'source-over';
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const clothH = width * (H / W);
  const geo = new THREE.PlaneGeometry(width, clothH, 16, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), k = (clothH / 2 - y) / clothH;   // 0 at the bar, 1 at the foot
    pos.setZ(i, (Math.sin(x * 9 + k * 5.5) * 0.045 + Math.sin(k * 11 + x * 3) * 0.02) * (0.25 + k) * ripple);
    pos.setX(i, x + Math.sin(k * 3.2) * 0.05 * k * ripple);
  }
  geo.computeVertexNormals();
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: burnt ? 0.95 : 0.8, metalness: 0, alphaTest: 0.5, envMapIntensity: burnt ? 0.3 : 1 }));
  cloth.position.set(0, height - 0.07 - clothH / 2, 0.02);
  for (const m of [pole, bar, cloth, knob]) m.castShadow = true;
  group.add(pole, bar, knob, ...ends, cloth);
  group.userData.cloth = cloth;
  return group;
}

/** Lays whatever of a placed banner's cloth would pass under the ground on the ground instead (a fallen banner). */
function drape(flag, hf) {
  const cloth = flag.userData.cloth;
  flag.updateMatrixWorld(true);
  const inv = cloth.matrixWorld.clone().invert(), v = new THREE.Vector3(), pos = cloth.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(cloth.matrixWorld);
    const floor = hf.heightAt(v.x, v.z) + 0.015;
    if (v.y < floor) { v.y = floor + (v.y - floor) * 0.04; v.applyMatrix4(inv); pos.setXYZ(i, v.x, v.y, v.z); }
  }
  pos.needsUpdate = true;
  cloth.geometry.computeVertexNormals();
}

/** The base both scenes stand on: a rock plateau in the middle of a 96 x 72 map, the house's buildings on it. */
function baseScene(house, { damaged = false } = {}) {
  // a rock plateau for the base, dunes round it, and a ridge of mountains along the north that hides the map's edge
  const map = paintGround(96, 72,
    [[50, 39, 19, 11.5, 0.1], [36, 30, 7, 4, 0.3], [68, 46, 5, 3, 0.25]],
    [[22, 28, 16, 8, 0.2], [80, 30, 18, 8, 0.2], [50, 19, 38, 5, 0.15], [86, 54, 12, 7, 0.2], [16, 54, 14, 8, 0.2], [50, 62, 30, 6, 0.2]],
    [[6, 8, 12, 6, 0.3], [24, 6, 12, 5, 0.35], [44, 7, 10, 5.5, 0.3], [62, 6, 12, 5, 0.35], [80, 8, 11, 6, 0.3], [94, 10, 8, 7, 0.3], [2, 22, 5, 10, 0.3]]);
  const hf = new Heightfield(map, { sub: 3, seed: 5 });
  const terrain = new TerrainView(map, hf);
  return { map, hf, terrain, house, damaged };
}

// The layout: [model, x, y, w, h, extra]
function baseLayout(house) {
  const infantryHall = house === 'harkonnen' ? 'wor' : 'barracks';
  return [
    ['constructionYard', 46, 36, 2, 2, { params: { crane: 0.6 } }],
    ['windtrap', 41, 34, 2, 2],
    ['windtrap', 38, 37, 2, 2],
    ['windtrap', 41, 31, 2, 2],
    ['refinery', 49, 33, 3, 2, { params: { door: 0.3 } }],
    ['silo', 53, 30, 2, 2],
    ['silo', 55, 33, 2, 2],
    ['outpost', 35, 33, 2, 2, { params: { dish: 0.6 } }],
    [infantryHall, 43, 39, 2, 2],
    ['heavyFactory', 49, 39, 3, 2, { params: { door: 0.4 } }],
    ['starport', 57, 36, 3, 3, { params: { padLights: 1 } }],
    ['palace', 45, 29, 3, 3, { params: { flag: 0.3 } }],
    ['hiTechFactory', 37, 40, 3, 2],
    ['repairFacility', 53, 41, 3, 2],
    ['rocketTurret', 40, 44, 1, 1, { params: { turret: 0.5 } }],
    ['turret', 59, 42, 1, 1, { params: { turret: -0.4 } }],
    ['rocketTurret', 61, 34, 1, 1, { params: { turret: 0.9 } }],
  ];
}

function setupLights(scene, { sunDir, sunColor, sunPower, hemiSky, hemiGround, hemiPower, rimDir = null, rimColor = 0x9fc4ff, rimPower = 0, target, extent = 30, envPower = 0.5, renderer }) {
  const sun = new THREE.DirectionalLight(sunColor, sunPower);
  sun.position.copy(target).addScaledVector(sunDir.clone().normalize(), 80);
  sun.target.position.copy(target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const cam = sun.shadow.camera;
  cam.left = -extent; cam.right = extent; cam.top = extent; cam.bottom = -extent; cam.near = 10; cam.far = 200;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(hemiSky, hemiGround, hemiPower));
  if (rimDir) {
    const rim = new THREE.DirectionalLight(rimColor, rimPower);
    rim.position.copy(target).addScaledVector(rimDir.clone().normalize(), 80);
    rim.target.position.copy(target);
    scene.add(rim, rim.target);
  }
  scene.environment = createEnvironment(renderer);
  scene.environmentIntensity = envPower;
  return sun;
}

// Dust and haze particle templates of our own (the burn-fx ones are private to it)
const P = {
  dust: { size: [0.5, 2.4], color: [0.78, 0.6, 0.42], color2: [0.86, 0.72, 0.56], alpha: [0.42, 0], drag: 1.6 },
  haze: { size: [2.5, 4.5], color: [0.9, 0.72, 0.5], color2: [0.95, 0.8, 0.6], alpha: [0.12, 0], drag: 0.5 },
  thrust: { size: [0.22, 0.05], color: [3.5, 2.6, 1.6], color2: [1.4, 0.5, 0.2], alpha: [1, 0], drag: 2 },
  black: { size: [0.3, 3.0], color: [0.02, 0.018, 0.017], color2: [0.12, 0.1, 0.1], alpha: [0.9, 0], drag: 0.04, turb: 0.5 },
  grey: { size: [0.3, 1.6], color: [0.2, 0.18, 0.17], color2: [0.36, 0.32, 0.3], alpha: [0.5, 0], drag: 0.3, turb: 0.3 },
  flame: { size: [0.22, 0.08], color: [2.4, 0.85, 0.16], color2: [0.8, 0.14, 0.02], alpha: [0.9, 0] },
  tip: { size: [0.11, 0.035], color: [2.8, 1.6, 0.5], alpha: [0.9, 0] },
  ember: { size: [0.05, 0.02], color: [6, 2.6, 0.6], alpha: [1, 0], drag: 0.6 },
};
const rnd = (a, b) => a + Math.random() * (b - a);

/** Runs the particle pools for `seconds`, calling `emit(t)` every step, so columns of smoke have built up. */
function simulate(fx, seconds, emit, dt = 1 / 30) {
  for (let t = 0; t < seconds; t += dt) {
    emit(t);
    fx.smoke.update(dt);
    fx.glow.update(dt);
  }
}

/**
 * The camera both cards share (the victory and the defeat are the same view, before and after), and spot(u, d):
 * the ground point at `d` tiles ahead of it and across the frame at u (-1 the left edge, 1 the right), so the
 * foreground can be composed in the frame's own terms. face(x, z, turn) heads a unit toward the camera.
 */
function cardShot(hf, width, height) {
  const FOV = 32;
  const eye = new THREE.Vector3(48.6, 0, 55.5);
  eye.y = hf.heightAt(eye.x, eye.z) + 1.05;
  const look = new THREE.Vector3(52.2, 2.35, 38);
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.3, 900);
  camera.position.copy(eye);
  camera.lookAt(look);
  const f = new THREE.Vector2(look.x - eye.x, look.z - eye.z).normalize();
  const r = new THREE.Vector2(-f.y, f.x);
  const half = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (width / height);
  const spot = (u, d) => ({ x: eye.x + f.x * d + r.x * u * d * half, z: eye.z + f.y * d + r.y * u * d * half });
  const face = (x, z, turn = 0) => Math.atan2(eye.z - z, eye.x - x) + turn;
  const across = Math.atan2(r.y, r.x);   // the heading that crosses the frame left to right
  return { camera, spot, face, across, eye };
}

// ---- the victory ----
async function victory(house, renderer, { width, height, ss }) {
  const scene = new THREE.Scene();
  const base = baseScene(house);
  const { hf, terrain } = base;
  scene.add(terrain.group);
  const place = placer(scene, terrain, hf);
  for (const [id, x, y, w, h, extra] of baseLayout(house)) place.building(id, x, y, w, h, house, extra);
  const { camera, spot, face, across } = cardShot(hf, width, height);
  // vehicles about the base; in front, tanks drawn up on the right and the squad round the banner on the left
  place.unit('harvester', 50.6, 35.6, Math.PI / 2, house, { params: { claws: 0 } });
  place.unit('quad', 44.6, 41.6, -0.5, house);
  place.unit('trike', 43.2, 42.4, -0.4, house);
  place.unit('mcv', 61.0, 42.6, 2.4, house);
  // the house's own heavy unit at the head of the line
  const armour = [['siegeTank', 0.3, 10.5, 0.5, -0.3], ['combatTank', 0.52, 8.8, 0.45, -0.15], ['combatTank', 0.78, 10.2, 0.5, 0.1], [SPECIAL[house], 0.62, 13.4, 0.55, 0.2]];
  for (const [id, u, d, turn, turret] of armour) { const p = spot(u, d); place.unit(id, p.x, p.z, face(p.x, p.z, turn), house, { params: { turret } }); }
  // the squad gathered round the banner, not in a line: two at the pole turned to it, the rest in a loose ring,
  // some striding up, some turned to the camera or to each other
  const trooperId = house === 'harkonnen' ? 'trooper' : 'soldier';
  const pole = spot(-0.5, 9.0);
  const squad = [[-0.56, 8.75, 'pole', 0.1, 0], [-0.43, 8.85, 'pole', -0.2, 0.3], [-0.64, 9.55, 'cam', 0.5, 0], [-0.36, 9.7, 'pole', 0.4, -0.35],
    [-0.5, 7.4, 'cam', -0.35, 0.4], [-0.71, 8.6, 'cam', 0.9, 0], [-0.3, 7.8, 'cam', -0.8, -0.3]];
  for (const [u, d, look, turn, stride] of squad) {
    const p = spot(u, d);
    const heading = look === 'pole' ? Math.atan2(pole.z - p.z, pole.x - p.x) + turn : face(p.x, p.z, turn);
    place.unit(trooperId, p.x, p.z, heading, house, { scale: 1.35, params: { legL: stride, legR: -stride * 0.8 } });
  }
  const flag = banner(house, { height: 1.5, width: 0.62 });
  flag.position.set(pole.x, hf.heightAt(pole.x, pole.z), pole.z);
  flag.rotation.y = across + 0.5;
  scene.add(flag);
  // the Frigate coming down over the Starport; a V of Carryalls in the house colour crossing the sky toward it,
  // the arrowhead to the right, the whole V inside the frame
  place.unit('frigate', 58.6, 37.4, Math.PI - 0.45, house, { lift: 3.7, tilt: [0.05, 0, -0.04], scale: 1.3 });
  const hull = new THREE.Color(HOUSES[house].color).lerp(new THREE.Color(0xffffff), 0.15).getHex();
  for (const b of [0, -1, 1, -2, 2, -3, 3]) {
    const p = spot(-0.44 - Math.abs(b) * 0.088, 30 + b * 0.8);
    place.unit('carryall', p.x, p.z, across, house, { lift: 6.1 + b * 0.55, tilt: [0.06, 0, 0.03], tint: hull });
  }
  // an enemy tank burnt out on the near ground, the last of the battle
  const near = spot(0.02, 6.6);
  place.unit('combatTank', near.x, near.z, face(near.x, near.z, 2.2), ENEMY[house], { lift: -0.08, tilt: [0.22, 0, -0.16], params: { turret: 1.9 }, wreck: true });
  place.update();
  terrain.update(0);

  const sunDir = new THREE.Vector3(-0.8, 0.16, -0.45);
  scene.add(skyDome({ zenith: [0.07, 0.2, 0.24], mid: [0.3, 0.42, 0.38], horizon: [0.95, 0.6, 0.32], below: [0.62, 0.42, 0.26], sun: sunDir, sunColor: [1.5, 0.95, 0.5], sunSize: 1.4, glow: 1.5, clouds: 0.6, cloudColor: [1.3, 0.85, 0.5], cloudDark: [0.35, 0.32, 0.34] }));
  scene.fog = new THREE.FogExp2(new THREE.Color(0.9, 0.62, 0.38), 0.0135);
  const target = new THREE.Vector3(50, 0, 42);
  setupLights(scene, { sunDir, sunColor: 0xffc890, sunPower: 3.6, hemiSky: 0x9cc8c0, hemiGround: 0x9a6a3c, hemiPower: 0.75, rimDir: new THREE.Vector3(0.6, 0.35, -0.7), rimColor: 0xa8d0ff, rimPower: 0.9, target, extent: 34, envPower: 0.45, renderer });

  // dust thrown up under the Frigate's lift thrusters, a thin smoke still rising off the wreck
  const fx = new Effects(scene, { particles: 6000, flashLights: 0 });
  const wy = hf.heightAt(near.x, near.z) + 0.25;
  simulate(fx, 7, () => {
    if (Math.random() < 0.7) { const a = rnd(0, Math.PI * 2), v = rnd(0.8, 1.6); fx.smoke.spawn(P.dust, 58.5 + Math.cos(a) * 0.8, hf.heightAt(58.5, 37.5) + 0.2, 37.5 + Math.sin(a) * 0.8, Math.cos(a) * v, rnd(0.05, 0.3), Math.sin(a) * v, rnd(1.6, 2.6)); }
    if (Math.random() < 0.6) fx.glow.spawn(P.thrust, rnd(58.4, 60.2), hf.heightAt(59, 37) + 3.0, rnd(36.6, 37.6), 0, rnd(-2.2, -1.4), 0, rnd(0.12, 0.2), 1.2);
    if (Math.random() < 0.35) fx.smoke.spawn(P.grey, near.x + rnd(-0.08, 0.08), wy, near.z + rnd(-0.08, 0.08), 0, rnd(0.45, 0.7), 0, rnd(4, 6), 0.55);
    if (Math.random() < 0.12) fx.glow.spawn(P.ember, near.x + rnd(-0.15, 0.15), wy - 0.05, near.z + rnd(-0.15, 0.15), rnd(-0.1, 0.1), rnd(0.2, 0.6), rnd(-0.1, 0.1), rnd(0.6, 1.4));
  });
  const smoulder = new THREE.PointLight(0xff6a20, 1.2, 1.6, 2);
  smoulder.position.set(near.x, wy + 0.05, near.z);
  scene.add(smoulder);

  const composer = compose(renderer, scene, camera, { width, height, ss, bloom: [0.5, 0.6, 0.9],
    finish: { uVignette: 0.42, uGrain: 0.03, uLift: [0.025, 0.02, 0.03], uGain: [1.0, 0.98, 0.95], uSaturation: 1.1, uContrast: 1.08, uFloor: 0.38 } });
  composer.render();
  const out = downsample(renderer.domElement, width, height);
  composer.dispose();
  fx.glow.dispose(); fx.smoke.dispose();
  place.dispose();
  disposeScene(scene);
  return out;
}

// ---- the defeat ----
async function defeat(house, renderer, { width, height, ss }) {
  const scene = new THREE.Scene();
  const base = baseScene(house, { damaged: true });
  const { hf, terrain } = base;
  scene.add(terrain.group);
  const place = placer(scene, terrain, hf);
  // the base from the same ledge as the victory, after the battle: the Starport and the Palace gone, the hardest
  // hit buildings sunk and askew, fires in them
  const fires = [];
  const GONE = new Set(['starport', 'palace']);
  const BURNING = { constructionYard: 1.3, refinery: 1.5, heavyFactory: 1.2, outpost: 1.0 };
  let k = 0;
  for (const [id, x, y, w, h, extra = {}] of baseLayout(house)) {
    k++;
    if (GONE.has(id)) continue;
    const burn = BURNING[id] ?? 0;
    place.building(id, x, y, w, h, house, { ...extra, sink: burn ? 0.1 : 0, tilt: burn ? [(k % 2 ? 0.05 : -0.04), 0, (k % 3 ? -0.06 : 0.05)] : null });
    if (burn) fires.push([x + w * 0.5 + rnd(-0.3, 0.3), hf.heightAt(x + w / 2, y + h / 2) + 0.3, y + h * 0.5 + rnd(-0.2, 0.2), burn]);
  }
  // burnt-out tanks where the victory's stood, the banner fallen, the enemy's tanks rolling in on the right
  const { camera, spot, face, across } = cardShot(hf, width, height);
  const wrecks = [['siegeTank', 0.3, 10.5, 1.1, -0.9, [-0.08, 0, 0.12]], ['combatTank', 0.55, 8.8, -0.6, 1.1, [0.1, 0, 0.08]], ['harvester', -0.05, 12.5, 1.6, 0, [0.16, 0, 0]]];
  for (const [id, u, d, turn, turret, tilt] of wrecks) {
    const p = spot(u, d);
    place.unit(id, p.x, p.z, face(p.x, p.z, turn), house, { lift: -0.06, tilt, params: { turret }, wreck: true });
    if (id !== 'harvester') fires.push([p.x, hf.heightAt(p.x, p.z) + 0.25, p.z, 0.7]);
  }
  const enemy = ENEMY[house];
  const advance = [['combatTank', 0.92, 14], ['siegeTank', 0.75, 17.5], ['combatTank', 1.02, 19], ['missileTank', 0.6, 21], ['combatTank', 0.88, 23]];
  for (const [id, u, d] of advance) { const p = spot(u, d); place.unit(id, p.x, p.z, face(p.x, p.z, 0.9), enemy, { params: { turret: -0.5 } }); }
  // the banner fallen back across the ground in the shade, burnt, smaller and further off than the victory's
  const pole = spot(-0.4, 8.6);
  const flag = banner(house, { height: 1.15, width: 0.44, ripple: 0.35, burnt: true });
  flag.position.set(pole.x, hf.heightAt(pole.x, pole.z) - 0.04, pole.z);
  flag.rotation.order = 'YXZ';
  flag.rotation.set(-1.2, across + 0.35, 0.1);
  scene.add(flag);
  drape(flag, hf);
  place.update();
  terrain.update(0);

  const sunDir = new THREE.Vector3(-0.8, 0.045, -0.5);
  scene.add(skyDome({ zenith: [0.025, 0.025, 0.05], mid: [0.16, 0.07, 0.07], horizon: [0.8, 0.26, 0.1], below: [0.18, 0.1, 0.07], sun: sunDir, sunColor: [1.4, 0.4, 0.12], sunSize: 2.4, glow: 1.4, clouds: 0.75, cloudColor: [0.8, 0.26, 0.12], cloudDark: [0.06, 0.04, 0.05] }));
  scene.fog = new THREE.FogExp2(new THREE.Color(0.3, 0.12, 0.07), 0.016);
  const target = new THREE.Vector3(50, 0, 42);
  setupLights(scene, { sunDir: new THREE.Vector3(-0.85, 0.18, -0.5), sunColor: 0xff6a30, sunPower: 1.6, hemiSky: 0x303a5a, hemiGround: 0x3a2014, hemiPower: 0.45, rimDir: new THREE.Vector3(0.5, 0.4, -0.8), rimColor: 0xff8a50, rimPower: 0.5, target, extent: 34, envPower: 0.2, renderer });
  for (const [x, y, z, s] of fires) {
    const l = new THREE.PointLight(0xff7a2a, 9 * s, 8, 1.7);
    l.position.set(x, y + 0.7, z);
    scene.add(l);
  }
  // tall columns of oil smoke leaning on the wind, flames at their feet, embers
  const fx = new Effects(scene, { particles: 30000, flashLights: 0 });
  simulate(fx, 14, () => {
    for (const [x, y, z, s] of fires) {
      if (Math.random() < 0.6) fx.smoke.spawn(P.black, x + rnd(-0.12, 0.12) * s, y + 0.1, z + rnd(-0.12, 0.12) * s, rnd(-0.04, 0.04), rnd(0.8, 1.05) * (0.8 + s * 0.2), rnd(-0.04, 0.04), rnd(6, 8.5), 0.6 + s * 0.3);
      if (Math.random() < 0.15) fx.smoke.spawn(P.grey, x + rnd(-0.3, 0.3), y, z + rnd(-0.3, 0.3), 0, rnd(0.4, 0.7), 0, rnd(3, 5), s);
      for (let n = 0; n < 3; n++) fx.glow.spawn(P.flame, x + rnd(-0.25, 0.25) * s, y - 0.15, z + rnd(-0.25, 0.25) * s, 0.04, rnd(0.3, 0.6) * s, 0.02, rnd(0.25, 0.45), s * 0.8);
      if (Math.random() < 0.6) fx.glow.spawn(P.tip, x + rnd(-0.15, 0.15) * s, y + 0.05 * s, z + rnd(-0.15, 0.15) * s, 0.04, rnd(0.6, 1.0) * s, 0.02, rnd(0.2, 0.3), s * 0.8);
      if (Math.random() < 0.1) fx.glow.spawn(P.ember, x, y + 0.2, z, rnd(-0.2, 0.5), rnd(0.8, 1.8), rnd(-0.3, 0.3), rnd(1.5, 3));
    }
  });

  const composer = compose(renderer, scene, camera, { width, height, ss, bloom: [0.7, 0.65, 0.82],
    finish: { uVignette: 0.6, uGrain: 0.04, uLift: [0.02, 0.012, 0.015], uGain: [1.0, 0.93, 0.88], uSaturation: 1.0, uContrast: 1.1, uFloor: 0.3 } });
  composer.render();
  const out = downsample(renderer.domElement, width, height);
  composer.dispose();
  fx.glow.dispose(); fx.smoke.dispose();
  place.dispose();
  disposeScene(scene);
  return out;
}

// ---- line art ----
// Each subject's pose and camera. The Soldier advances side-on, rifle levelled and legs apart in his stride (he reads
// as a man better than the Trooper, whose pauldrons make a second head in profile); the Ornithopter flies level,
// seen three-quarters from above; `mirror` would flip a drawing left to right. All three face left, into the screen.
const LINE_SUBJECTS = {
  tank: { id: 'combatTank', heading: Math.PI / 2 + 0.55, params: { turret: -0.35 }, cam: [1.25, 0.62, 1.2], look: [0.02, 0.17, 0], fov: 28 },
  soldier: { id: 'soldier', heading: -0.3, params: { legL: 0.42, legR: -0.36 }, cam: [0.1, 0.25, -0.8], look: [0, 0.13, 0], fov: 22 },
  ornithopter: { id: 'ornithopter', heading: Math.PI - 0.62, params: { flap: 0.1, flapR: -0.1 }, cam: [0.55, 1.05, 1.3], look: [0.0, 0.14, 0.02], fov: 31 },
};

// The model drawn once into a float target: its view normal (octahedral, so no direction is lost), the light on
// the face, and its view depth (0 where there is no model).
const NormalDepthShader = {
  vertexShader: /* glsl */ `
    #include <common>
    varying vec3 vN; varying float vDepth; varying vec3 vWorldN;
    void main() {
      vec3 p = position; vec3 n = normal;
      #ifdef USE_INSTANCING
        p = (instanceMatrix * vec4(p, 1.0)).xyz; n = mat3(instanceMatrix) * n;
      #endif
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * n);
      vWorldN = normalize(mat3(modelMatrix) * n);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uLight;
    varying vec3 vN; varying float vDepth; varying vec3 vWorldN;
    vec2 oct(vec3 n) {
      n /= abs(n.x) + abs(n.y) + abs(n.z);
      vec2 s = vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
      return n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * s;
    }
    void main() {
      vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
      vec3 wn = normalize(vWorldN) * (gl_FrontFacing ? 1.0 : -1.0);
      // the light comes from the viewer's upper left (uLight is in view space), so the faces turned to us are mostly
      // lit and only those turned away are shaded, the way an engraver lights a plate; tops catch a little more
      float lit = 0.25 + 0.75 * clamp(dot(n, normalize(uLight)), 0.0, 1.0) + 0.1 * clamp(wn.y, 0.0, 1.0);
      gl_FragColor = vec4(oct(n), clamp(lit, 0.0, 1.0), vDepth);
    }`,
};

// The ink: r the outlines (the silhouette heavier, overlaps and folds finer), g the hatching.
const EngraveShader = {
  uniforms: { tND: { value: null }, uRes: { value: new THREE.Vector2() }, uPeriod: { value: 7 }, uSS: { value: 2 }, uJump: { value: 0.012 }, uFold: { value: 0.86 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tND; uniform vec2 uRes; uniform float uPeriod, uSS, uJump, uFold;
    varying vec2 vUv;
    vec4 at(vec2 o) { return texture2D(tND, vUv + o / uRes); }
    vec3 unoct(vec2 e) {
      vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y));
      if (n.z < 0.0) n.xy = (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
      return normalize(n);
    }
    float stroke(float coord, float width) {
      float d = abs(fract(coord) - 0.5) * uPeriod;   // distance to the stroke's centre line, in pixels
      float aa = 0.7 * uSS;
      return (1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, d)) * clamp(width / (2.0 * aa), 0.0, 1.0);   // a stroke too thin to draw fades
    }
    void main() {
      vec4 c = at(vec2(0.0));
      float inside = step(0.0001, c.a);
      vec3 nc = unoct(c.rg);
      float sil = 0.0, fold = 0.0;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.5235988;
        vec2 dir = vec2(cos(a), sin(a));
        sil = max(sil, abs(inside - step(0.0001, at(dir * 2.2 * uSS).a)));
        if (inside < 0.5) continue;
        // a fold: the face turns sharply (the world normal jumps), whether lit or not
        vec4 t = at(dir * 1.1 * uSS);
        if (t.a > 0.0001) fold = max(fold, smoothstep(uFold, uFold - 0.12, dot(unoct(t.rg), nc)));
        // an overlap: the depth jumps. 1/depth is flat across a plane on screen, so its second difference is
        // zero on every face and large only where one part passes in front of another
        if (i < 6) {
          vec4 p = at(dir * 1.3 * uSS), q = at(-dir * 1.3 * uSS);
          if (p.a > 0.0001 && q.a > 0.0001) {
            float w = 1.0 / c.a;
            fold = max(fold, smoothstep(uJump, uJump * 2.2, abs(1.0 / p.a + 1.0 / q.a - 2.0 * w) / w));
          }
        }
      }
      // tone: the light on the face. Strokes run one way on faces turned up, another on those turned left or
      // right; a fine stroke on the lit faces, thicker as the face darkens, crossed in the shade
      float tone = 1.0 - c.b;
      vec2 dir = nc.y > 0.5 ? vec2(0.0, 1.0) : (nc.x < 0.0 ? vec2(0.866, 0.5) : vec2(-0.866, 0.5));
      vec2 cross_ = vec2(-dir.y, dir.x);
      vec2 p = gl_FragCoord.xy / uPeriod;
      float h1 = stroke(dot(p, dir), uPeriod * clamp(0.07 + (tone - 0.16) * 0.9, 0.07, 0.48));
      float h2 = stroke(dot(p, cross_) + 0.5, uPeriod * clamp((tone - 0.5) * 1.0, 0.0, 0.4));
      gl_FragColor = vec4(max(sil, fold * 0.9), max(h1, h2 * 0.95) * inside, 0.0, 1.0);
    }`,
};

// The print: outlines with too little ink round them (specks from slivers of the model) are wiped off, the
// hatching laid under, dark ink on white; `uMirror` flips it left to right.
const PrintShader = {
  uniforms: { tInk: { value: null }, uRes: { value: new THREE.Vector2() }, uSS: { value: 2 }, uMirror: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tInk; uniform vec2 uRes; uniform float uSS, uMirror;
    varying vec2 vUv;
    void main() {
      vec2 uv = vec2(uMirror > 0.5 ? 1.0 - vUv.x : vUv.x, vUv.y);
      vec4 c = texture2D(tInk, uv);
      float cover = 0.0;
      for (int y = -3; y <= 3; y++) for (int x = -3; x <= 3; x++) cover += step(0.5, texture2D(tInk, uv + vec2(float(x), float(y)) * 2.0 * uSS / uRes).r);
      float ink = max(c.r * smoothstep(3.5, 7.0, cover), c.g);
      gl_FragColor = vec4(vec3(1.0 - ink), 1.0);
    }`,
};

async function lineArt(subject, renderer, { width, height, ss, pose = null }) {
  const s = { ...LINE_SUBJECTS[subject], ...(pose ?? {}) };
  const scene = new THREE.Scene();
  const model = new InstancedModel(modelDef(s.id), scene, { capacity: 1, castShadow: false });
  const hd = model.add();
  poseMatrix(hd.matrix, 0, 0, 0, s.heading);
  Object.assign(hd.params, s.params);
  model.update();
  const camera = new THREE.PerspectiveCamera(s.fov, width / height, 0.05, 20);
  camera.position.set(...s.cam);
  camera.lookAt(...s.look);
  const nd = new THREE.ShaderMaterial({ vertexShader: NormalDepthShader.vertexShader, fragmentShader: NormalDepthShader.fragmentShader, side: THREE.DoubleSide,
    uniforms: { uLight: { value: new THREE.Vector3(s.mirror ? 0.55 : -0.55, 0.62, 0.56) } } });   // from the left once printed
  scene.overrideMaterial = nd;
  const W = width * ss, H = height * ss;
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, samples: 0 });
  const inkRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 0 });
  const tm = renderer.toneMapping, outputSpace = renderer.outputColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, camera);
  const pass = (shader, target, uniforms) => {
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ ...shader, uniforms: THREE.UniformsUtils.clone(shader.uniforms), depthTest: false, depthWrite: false }));
    Object.assign(quad.material.uniforms, Object.fromEntries(Object.entries(uniforms).map(([k, v]) => [k, { value: v }])));
    const post = new THREE.Scene();
    post.add(quad);
    renderer.setRenderTarget(target);
    renderer.render(post, new THREE.Camera());
    quad.geometry.dispose(); quad.material.dispose();
  };
  pass(EngraveShader, inkRT, { tND: rt.texture, uRes: new THREE.Vector2(W, H), uPeriod: 8 * ss, uSS: ss });
  pass(PrintShader, null, { tInk: inkRT.texture, uRes: new THREE.Vector2(W, H), uSS: ss, uMirror: s.mirror ? 1 : 0 });
  renderer.setRenderTarget(null);
  renderer.outputColorSpace = outputSpace;
  renderer.toneMapping = tm;
  const out = downsample(renderer.domElement, width, height);
  rt.dispose(); inkRT.dispose(); nd.dispose();
  model.dispose();
  return out;
}

/**
 * Renders one picture of RESULT_ART into a 2D canvas of width x height (supersampled `ss` times).
 * { name, width = 1920, height = 1080, ss = 2, pose }: `pose` overrides a line-art subject's pose and camera (previews).
 */
export async function renderResultArt({ name, width = 1920, height = 1080, ss = 2, pose = null }) {
  const job = RESULT_ART[name];
  if (!job) throw new Error(`no such picture: ${name}`);
  const renderer = makeRenderer(width, height, ss);
  try {
    return await withSeed(name.length * 7919 + name.charCodeAt(0), () => {
      if (job.kind === 'victory') return victory(job.house, renderer, { width, height, ss });
      if (job.kind === 'defeat') return defeat(job.house, renderer, { width, height, ss });
      return lineArt(job.subject, renderer, { width, height, ss, pose });
    });
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
