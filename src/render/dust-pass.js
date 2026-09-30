// Dust in the air for the menu backdrop's seams (menu backdrop spec, revision 2). Deep in the haze where the dive
// meets the battle the ground is gone, and a flat colour would read as a fade: soft blotches of lighter and darker
// dust are laid over the picture instead, growing (or shrinking) with the camera's zoom through three layers an octave
// apart, each fading out as it wraps round, so the zoom never visibly stops or starts over. The same pattern belongs
// to both sides of a seam: it follows the zoom, not the scene. Applied in linear light, before the grade.
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const DustShader = {
  name: 'DustShader',
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0 },   // how strongly the dust shows: 0 none
    uZoom: { value: 0 },     // ln of how far the camera has zoomed in: continuous across the seams
    uAspect: { value: 16 / 9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uZoom;
    uniform float uAspect;
    varying vec2 vUv;
    const float FEATURES = 2.2;   // blotches across the frame's height, for a layer in mid-life
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float cloud(vec2 p) { return 0.6 * noise(p) + 0.28 * noise(p * 2.1 + 5.2) + 0.12 * noise(p * 4.3 + 1.7); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
      float octave = uZoom / log(2.0);
      float dust = 0.0;
      for (int i = 0; i < 3; i++) {
        // this layer's age in octaves, 0..3: it grows by 2^age, and weighs nothing as it is born and as it wraps
        float age = mod(octave + float(i), 3.0);
        float life = floor((octave + float(i)) / 3.0);   // a fresh pattern each time round
        vec2 seed = vec2(hash(vec2(life, float(i))), hash(vec2(float(i), life + 7.0))) * 97.0;
        dust += sin(3.14159265 * age / 3.0) * (cloud(q * FEATURES * 4.0 * exp2(-age) + seed) - 0.5);
      }
      c.rgb *= 1.0 + uAmount * dust;
      gl_FragColor = c;
    }`,
};

export function createDustPass() {
  const pass = new ShaderPass(DustShader);
  pass.enabled = false;
  return pass;
}
