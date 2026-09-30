// Arrakis from space for the main menu (menu backdrop spec): a planet shaded in code — sand, rock and
// wind-drawn dune bands from 3D value noise on the sphere, lit from the upper left — a thin blue rim of
// atmosphere, stars and a faint nebula. Its own scene and camera; update(dt, { dive }) pushes the
// camera into the planet for the cut to the battle.
import * as THREE from 'three';
import { Rng } from '../core/rng.js';

const FOV = 38;
const SPIN = 0.035, SPIN_REDUCED = 0.012;   // radians per second
const STARS = 2400;                          // inside the 1,000–3,000 particle budget
const DIVE_TO = 1.3;                         // camera distance from the centre at the end of the dive (radius 1)
const ATMO_RADIUS = 1.12;
// on the back of the atmosphere shell -n.z runs from 0 at its outline to this where it meets the planet's limb
const ATMO_INNER = Math.sqrt(1 - 1 / (ATMO_RADIUS * ATMO_RADIUS));
const LIGHT = new THREE.Vector3(-0.8, 0.45, 0.35).normalize();   // view space: from the upper left, a little in front

const NOISE = /* glsl */ `
  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int k = 0; k < 5; k++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.4); a *= 0.5; }
    return s;
  }`;

/**
 * Camera distance and sideways offset, in planet radii, for an aspect ratio. Wide screens: the planet
 * fills ~78 % of the height and sits well right of centre, past the menu, a little cut off by the edge.
 * Tall screens: centred, half the width.
 */
export function planetFraming(aspect, fov = FOV) {
  const t = Math.tan(((fov / 2) * Math.PI) / 180);
  if (aspect < 1) return { distance: 1 / (0.5 * aspect) / t, offsetX: 0 };
  const halfH = 1 / 0.78;
  return { distance: halfH / t, offsetX: halfH * aspect * 0.65 };
}

function planetMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uLight: { value: LIGHT.clone() } },
    vertexShader: /* glsl */ `
      varying vec3 vObj;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vObj = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLight;
      varying vec3 vObj;
      varying vec3 vNormal;
      varying vec3 vView;
      ${NOISE}
      void main() {
        vec3 p = normalize(vObj);
        float base = fbm(p * 2.2);
        float detail = fbm(p * 9.0 + base * 2.0);
        float bands = 0.5 + 0.5 * sin(p.y * 22.0 + base * 7.0 + detail * 3.0);
        vec3 dark = vec3(0.12, 0.045, 0.018), mid = vec3(0.43, 0.155, 0.06), light = vec3(0.76, 0.27, 0.11);
        vec3 col = mix(dark, mid, smoothstep(0.28, 0.52, base));
        col = mix(col, light, smoothstep(0.5, 0.78, base + bands * 0.1));
        col *= 0.66 + 0.68 * detail;
        col = mix(col, dark * 1.4, smoothstep(0.6, 0.7, fbm(p * 4.0 + 3.1)) * 0.55);
        vec3 n = normalize(vNormal), v = normalize(vView);
        float lit = smoothstep(-0.12, 0.65, dot(n, uLight));
        float rim = pow(1.0 - max(dot(n, v), 0.0), 6.0);
        col = col * (0.012 + 1.3 * lit) + vec3(0.03, 0.08, 0.4) * rim * (0.1 + 0.9 * lit);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function atmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uLight: { value: LIGHT.clone() }, uInner: { value: ATMO_INNER } },
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLight;
      uniform float uInner;
      varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal);
        float glow = pow(clamp(-n.z / uInner, 0.0, 1.0), 3.0);
        float side = dot(normalize(n.xy + vec2(1e-5)), normalize(uLight.xy));
        float lit = 0.2 + 0.8 * smoothstep(-0.6, 0.7, side);
        gl_FragColor = vec4(vec3(0.08, 0.2, 1.0) * glow * lit * 1.2, 1.0);
      }`,
  });
}

function starField(rng) {
  const pos = new Float32Array(STARS * 3), size = new Float32Array(STARS), tone = new Float32Array(STARS * 3), phase = new Float32Array(STARS);
  for (let i = 0; i < STARS; i++) {
    const u = rng.range(-1, 1), a = rng.range(0, Math.PI * 2), s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * 900, u * 900, Math.sin(a) * s * 900], i * 3);
    size[i] = 2 + Math.pow(rng.next(), 6) * 3;
    const warm = rng.next(), b = 0.45 + 1.0 * Math.pow(rng.next(), 2.5);
    tone.set([b * (0.85 + 0.15 * warm), b * 0.92, b * (1.05 - 0.2 * warm)], i * 3);
    phase[i] = rng.next();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aTone', new THREE.BufferAttribute(tone, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTwinkle: { value: 1 }, uPixelRatio: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 aTone;
      attribute float aPhase;
      uniform float uTime;
      uniform float uTwinkle;
      uniform float uPixelRatio;
      varying vec3 vTone;
      void main() {
        vTone = aTone * (1.0 - uTwinkle * 0.3 * (0.5 + 0.5 * sin(uTime * (0.6 + aPhase * 1.8) + aPhase * 6.2832)));
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vTone;
      void main() {
        float a = 1.0 - smoothstep(0.25, 0.6, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vTone * a, 1.0);
      }`,
  });
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  return points;
}

function nebula() {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      ${NOISE}
      void main() {
        float fall = 1.0 - smoothstep(0.05, 0.5, length((vUv - 0.5) * vec2(1.0, 1.4)));
        float wisps = smoothstep(0.42, 0.8, fbm(vec3(vUv * 3.5, 1.7))) * fall;
        gl_FragColor = vec4(vec3(0.05, 0.14, 0.42) * wisps * 2.0, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1100, 700), m);
  mesh.position.set(250, -150, -700);   // low on the right, behind the planet and round its lower-left limb
  return mesh;
}

export class PlanetShot {
  constructor({ seed = 1 } = {}) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.02, 2000);
    this.aspect = 0;
    this.time = 0;
    const tilt = new THREE.Group();
    tilt.rotation.z = 0.32;
    this.spin = new THREE.Group();
    this.spin.rotation.y = new Rng(seed).range(0, Math.PI * 2);   // another face of Arrakis every visit
    this.spin.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), planetMaterial()));
    tilt.add(this.spin);
    this.atmosphere = new THREE.Mesh(new THREE.SphereGeometry(ATMO_RADIUS, 96, 64), atmosphereMaterial());   // not spun: the glow follows the light
    this.stars = starField(new Rng(seed * 7 + 3));
    this.scene.add(tilt, this.atmosphere, this.stars, nebula());
  }

  /** dive 0..1 pushes the camera in; aspect frames the planet; reduced slows the turn and stills the stars; pixelRatio keeps star size on high-DPI screens. */
  update(dt, { dive = 0, aspect = 16 / 9, reduced = false, pixelRatio = 1 } = {}) {
    this.time += dt;
    this.spin.rotation.y += dt * (reduced ? SPIN_REDUCED : SPIN);
    const u = this.stars.material.uniforms;
    u.uTime.value = this.time;
    u.uTwinkle.value = reduced ? 0 : 1;
    u.uPixelRatio.value = pixelRatio;
    if (aspect !== this.aspect) {
      this.aspect = aspect;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    const { distance, offsetX } = planetFraming(aspect);
    const e = Math.min(1, Math.max(0, dive));
    this.camera.position.set(-offsetX * (1 - e), 0, distance + (DIVE_TO - distance) * e);
    this.camera.updateMatrixWorld();
  }

  dispose() {
    this.scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }
}
