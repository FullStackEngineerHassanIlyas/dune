// The main menu battle's dust veil (menu backdrop spec, revision 2): a layer of the battlefield's own haze lying
// just over the ground, clear over the middle of the map and thick beyond it, with ragged edges and lighter and
// darker banks. From high up the battle shows as a clearing in the dust, not as a board lying on a table; the veil
// lifts as the camera comes down, and gathers again on the way back up. One flat sheet in the fog's own colour,
// drawn over everything below it and fogged like the ground, so deep in the haze it cannot be told from it.
import * as THREE from 'three';

const HEIGHT = 4;     // tiles above the ground: over the tallest mountain and structure
const SIZE = 1600;    // tiles across: past the edges of the widest view, from the top of the descent
const LAYER = 12;     // drawn after the effects (10, 11), so smoke under the dust is veiled too

export class DustVeil {
  /** w × h: the map, whose middle stays clear; color: the scene fog's colour (linear). */
  constructor({ w, h, color }) {
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uColor: { value: color.clone() },
        uCentre: { value: new THREE.Vector2(w / 2, h / 2) },
        uRadii: { value: new THREE.Vector2(w / 2, h / 2) },
        uStrength: { value: 1 },
      }]),
      transparent: true, depthWrite: false, fog: true,
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        varying vec2 vXZ;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vXZ = world.xz;
          vec4 mvPosition = viewMatrix * world;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform vec3 uColor;
        uniform vec2 uCentre;
        uniform vec2 uRadii;
        uniform float uStrength;
        varying vec2 vXZ;
        const float CLEAR = 0.42, THICK = 0.95;   // clear inside this share of the map's half-size, thick past it
        const float RAGGED = 0.4;                  // how far the noise pushes the edge in and out
        const float BANKS = 0.12;                  // lighter and darker banks of dust
        float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float cloud(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.3 + 7.3) + 0.15 * noise(p * 5.1 + 3.1); }
        void main() {
          float r = length((vXZ - uCentre) / uRadii) + (cloud(vXZ * 0.09) - 0.5) * RAGGED;
          float body = 1.0 + BANKS * (cloud(vXZ * 0.035 + 11.0) - 0.5) * 2.0;
          gl_FragColor = vec4(uColor * body, smoothstep(CLEAR, THICK, r) * uStrength);
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2), material);
    this.mesh.position.set(w / 2, HEIGHT, h / 2);
    this.mesh.renderOrder = LAYER;
    this.mesh.frustumCulled = false;
  }

  /** 0: gone; 1: the whole veil. */
  set strength(s) {
    this.mesh.material.uniforms.uStrength.value = s;
    this.mesh.visible = s > 0.001;
  }

  get strength() { return this.mesh.material.uniforms.uStrength.value; }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
