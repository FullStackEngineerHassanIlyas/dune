// Space around Arrakis for the opening (spec §5.8; phase 3 research §8): what the planet scene (render/planet.js) needs
// beyond the planet to read as the Mega Drive intro. Near stars strewn along the camera's way, so they drift right to
// left with parallax as it travels and stand still once it stops: pale blue points, the brighter ones small four-point
// crosses as the Sega draws its stars. A band of blue dust behind the planet, specked like the Sega's dithered nebula,
// that slides in with it. And the three house ships' flight: one instanced model, lit by the planet's sun and a fill.
// The star and dust layer stays in the scene after the opening, so the menu backdrop's shot is the opening's last frame;
// it fades with the rest of space on the dive.
import * as THREE from 'three';
import { Rng } from '../core/rng.js';
import { InstancedModel } from './models/instancer.js';
import { modelDef } from './models/index.js';
import { HOUSES } from '../data/houses.js';

const NEAR_STARS = 600;          // with the far shell's 2,400, the 3,000 particle budget
// how far in front of the camera's way, log-uniform, in framing distances (4.1 planet radii on a wide window, so 3.6-8):
// the Sega's narrow band of drift speeds, 0.47-0.72 screen widths a second for most of them
const DEPTH = [0.87, 1.93];
// never nearer than the planet's far side in what the camera sees when it has stopped: behind z, or left of that shot's
// left edge (slope × depth from the camera's stop, plus a margin: wide enough for a 21:9 window)
const KEEP_CLEAR = { z: -1.5, slope: 1.3, margin: 1 };
const T = Math.tan((19 * Math.PI) / 180), WIDE = 16 / 9;
const SIZE = { min: 1.7, span: 3.2 };     // pixels; from about 3.2 up a star is drawn as a cross, as the Sega's are

function nearStars(rng, { from, to }) {
  const pos = new Float32Array(NEAR_STARS * 3), size = new Float32Array(NEAR_STARS), tone = new Float32Array(NEAR_STARS * 3), phase = new Float32Array(NEAR_STARS);
  for (let i = 0; i < NEAR_STARS;) {
    const s = rng.range(-0.08, 1.06), d = to[2] * DEPTH[0] * (DEPTH[1] / DEPTH[0]) ** rng.next();
    const x = from[0] + (to[0] - from[0]) * s + rng.range(-1.65, 1.25) * d * T * WIDE;
    const y = from[1] + (to[1] - from[1]) * s + rng.range(-1.15, 1.15) * d * T;
    const z = from[2] + (to[2] - from[2]) * s - d;
    if ((z > KEEP_CLEAR.z && x > to[0] - KEEP_CLEAR.slope * (to[2] - z) - KEEP_CLEAR.margin) || Math.hypot(x, y, z) < 1.3) continue;
    pos.set([x, y, z], i * 3);
    size[i] = SIZE.min + SIZE.span * rng.next() ** 2.5;
    const b = 0.62 + 0.9 * rng.next() ** 2;
    tone.set([b * 0.78, b * 0.88, b * 1.06], i * 3);   // the Sega's pale blue
    phase[i] = rng.next();
    i++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aTone', new THREE.BufferAttribute(tone, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTwinkle: { value: 1 }, uPixelRatio: { value: 1 }, uFade: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 aTone;
      attribute float aPhase;
      uniform float uTime, uTwinkle, uPixelRatio, uFade;
      varying vec3 vTone;
      varying float vSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vTone = aTone * uFade * (1.0 - uTwinkle * 0.25 * (0.5 + 0.5 * sin(uTime * (0.8 + aPhase * 2.0) + aPhase * 6.2832)));
        vSize = aSize * uPixelRatio * clamp(10.0 / -mv.z, 0.85, 1.4);   // the nearest a touch larger
        gl_PointSize = ceil(vSize) + 2.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vTone;
      varying float vSize;
      void main() {
        vec2 q = abs(gl_PointCoord - 0.5) * (ceil(vSize) + 2.0);   // pixels from the centre
        float core = 1.0 - smoothstep(0.45, 1.15, length(q));   // a dot of about two pixels
        float arm = (1.0 - smoothstep(0.25, 0.75, min(q.x, q.y))) * max(0.0, 1.0 - max(q.x, q.y) / (0.5 * vSize + 0.5));
        float a = max(core, arm * 0.8 * smoothstep(2.8, 3.6, vSize));
        gl_FragColor = vec4(vTone * a, 1.0);
      }`,
  });
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  return points;
}

function dustBand() {
  const m = new THREE.ShaderMaterial({
    uniforms: { uFade: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying vec2 vUv;
      const vec3 HAZE = vec3(0.012, 0.03, 0.2);    // the Sega's #000034-#000057 haze, lifted for the grade
      const vec3 SPECK = vec3(0.14, 0.3, 1.0);     // and its brighter blue specks
      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec2 p = vUv * vec2(5.0, 2.6);
        float n = 0.5 * noise(p) + 0.25 * noise(p * 2.1 + 3.7) + 0.125 * noise(p * 4.3 + 1.3) + 0.0625 * noise(p * 8.9 + 7.1);
        float across = (vUv.y - 0.5) / 0.3;
        float band = exp(-across * across) * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.72, vUv.x);
        float cloud = smoothstep(0.38, 0.8, n) * band;
        // specks: one per small cell at a hashed spot, soft, in the denser dust
        vec2 cell = vUv * vec2(520.0, 290.0), id = floor(cell);
        float h = hash(id), d = length(fract(cell) - 0.25 - 0.5 * vec2(hash(id + 7.1), hash(id + 3.3)));
        float speck = step(0.8, h) * (1.0 - smoothstep(0.08, 0.3, d)) * smoothstep(0.3, 0.75, cloud);
        gl_FragColor = vec4((HAZE * cloud * 2.2 + SPECK * speck * 0.9) * uFade, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(19, 10), m);
  mesh.position.set(0.6, -0.25, -7);
  mesh.rotation.z = 0.32;   // lower left to upper right behind the planet, as on the Sega title
  return mesh;
}

/**
 * The near stars and the dust: corridor { from, to } is the camera's way through them (world positions; see
 * travelCorridor in game/intro-timeline.js). PlanetShot.attach() adds `group` and calls update() every frame.
 */
export class SpaceTravel {
  constructor({ seed = 1, corridor }) {
    this.stars = nearStars(new Rng(seed * 11 + 5), corridor);
    this.dust = dustBand();
    this.group = new THREE.Group();
    this.group.add(this.stars, this.dust);
  }

  /** fade: space's share of the picture (0 deep in the dive); nebula: the dust's share on top; time drives the twinkle, none under reduced motion. */
  update({ fade = 1, nebula = 1, time = 0, pixelRatio = 1, reduced = false } = {}) {
    const u = this.stars.material.uniforms;
    u.uFade.value = fade;
    u.uTime.value = time;
    u.uTwinkle.value = reduced ? 0 : 1;
    u.uPixelRatio.value = pixelRatio;
    this.dust.material.uniforms.uFade.value = fade * nebula;
    this.dust.visible = fade * nebula > 0.001;
    this.group.visible = fade > 0.001;
  }

  get count() { return NEAR_STARS; }
}

const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _p = new THREE.Vector3();

/** The house ships in the planet scene, with the light they need there: sun along `sun` (towards it), and a fill. */
export class ShipFlight {
  constructor(scene, { houses, sun }) {
    this.scene = scene;
    this.model = new InstancedModel(modelDef('houseShip'), scene, { capacity: houses.length, castShadow: false });
    this.handles = houses.map((id) => {
      const h = this.model.add();
      h.color.set(HOUSES[id].color);
      h.visible = false;
      return h;
    });
    this.sun = new THREE.DirectionalLight(0xfff0dc, 3.4);
    this.sun.position.copy(sun).multiplyScalar(10);
    this.fill = new THREE.HemisphereLight(0x9cb0ff, 0xc08a58, 1.1);   // space above, the lit sand below
    scene.add(this.sun, this.sun.target, this.fill);
    this.model.update();
  }

  /** Ship i at a pose from shipPose(): position, forward (its +x), up, uniform scale; hidden when not visible. */
  place(i, pose) {
    const h = this.handles[i];
    h.visible = !!pose.visible && pose.scale > 1e-5;
    if (!h.visible) return;
    _x.fromArray(pose.forward);
    _y.fromArray(pose.up);
    _z.crossVectors(_x, _y);
    h.matrix.makeBasis(_x, _y, _z).scale(_p.setScalar(pose.scale)).setPosition(_p.fromArray(pose.position));
  }

  hide() { for (const h of this.handles) h.visible = false; }

  update() { this.model.update(); }

  dispose() {
    this.model.dispose();
    this.scene.remove(this.sun, this.sun.target, this.fill);
    this.sun.dispose?.();
    this.fill.dispose?.();
  }
}
