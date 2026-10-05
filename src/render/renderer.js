// Renderer, lights, sky and post-processing (spec §5.1): ACES tone mapping, soft sun shadows that
// follow the camera, hemisphere sky/sand bounce, exponential haze, bloom and FXAA or MSAA, as the
// graphics preset sets them (spec §8, render/quality.js) — and can set them again while a battle runs.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { createSky, createEnvironment } from './sky.js';
import { QUALITY, qualityPreset, pixelRatioFor, bloomSize } from './quality.js';
import { createGradePass } from './grade-pass.js';

export const SUN_DIRECTION = new THREE.Vector3(-0.55, 0.9, 0.42).normalize();
/** The battlefield's haze (sRGB hex). The menu's planet dives into the same colour, so the seam with the battle matches. */
export const FOG_COLOR = 0xd9bb8e;

// A pixel that comes out NaN or infinite (some GPU drivers produce one where others give a number) is
// harmless on its own, but the bloom blur smears it across its mip chain into large black rectangles.
// The bright pass drops such pixels before they are blurred.
const FINITE = (v) => `(${v} >= 0.0 && ${v} <= 60000.0)`;
function guardBloom(bloom) {
  const m = bloom.materialHighPassFilter;
  m.fragmentShader = m.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );',
    `vec4 texel = texture2D( tDiffuse, vUv );\n\t\t\tif ( !( ${FINITE('texel.r')} && ${FINITE('texel.g')} && ${FINITE('texel.b')} ) ) texel = vec4( 0.0 );`);
  m.needsUpdate = true;
}

/** Bloom whose blur starts at the preset's resolution (Medium half the frame, High the full frame). */
function createBloom(r3d) {
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.9);
  guardBloom(bloom);
  const setSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => setSize(...bloomSize(r3d.quality, w, h));
  return bloom;
}

export class Renderer3D {
  constructor(canvas, qualityName = 'medium') {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft was removed in r186: soft is PCF with a wider radius

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0085);
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 700);

    this.sun = new THREE.DirectionalLight(0xfff0d6, 3.1);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe0ff, 0xb0824c, 0.75);
    this.scene.add(this.hemi);
    this.scene.environment = createEnvironment(r);
    this.scene.environmentIntensity = 0.55;
    this.sky = createSky(SUN_DIRECTION);
    this.scene.add(this.sky);
    this.shadowExtent = 0;

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.grade = createGradePass();   // the menu backdrop eases its vignette out in the haze of the dive
    this.output = new OutputPass();
    this.setQuality(qualityName);

    this.resize();
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      if (this.cycling) { this.cycling = false; setTimeout(() => this.renderer.forceContextRestore()); }
      else if (!this.held) this.onContextLost?.();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      // everything re-uploads from the CPU side except what the GPU drew itself: the sky's light probe
      const probe = this.scene.environment;
      try { this.scene.environment = createEnvironment(this.renderer); probe?.dispose(); } catch { /* keep the old one */ }
      this.onContextRestored?.();
    });
  }

  /**
   * Applies a graphics preset (spec §8): shadows, anti-aliasing, bloom and pixel ratio change at once — the next
   * frame recompiles the materials for the new shadow state, a short stall. Particle budgets, flash lights and
   * terrain detail are read when a battle is built, so those follow in the next battle.
   */
  setQuality(name) {
    const q = qualityPreset(name), live = !!this.quality, r = this.renderer, sun = this.sun;
    this.qualityName = QUALITY[name] ? name : 'medium';
    this.quality = q;
    r.shadowMap.enabled = sun.castShadow = q.shadows > 0;
    if (sun.shadow.map && sun.shadow.mapSize.x !== q.shadows) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    if (q.shadows) sun.shadow.mapSize.set(q.shadows, q.shadows);
    sun.shadow.radius = q.shadowRadius;
    this.shadowExtent = 0;   // follow() sizes the new frustum
    const own = [this.renderPass, this.bloom, this.grade, this.output, this.fxaa];
    const extras = this.composer?.passes.filter((p) => !own.includes(p)) ?? [];   // such as the menu backdrop's dust, ahead of the grade
    this.composer?.dispose();
    const target = q.msaa ? new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: q.msaa }) : undefined;
    this.composer = new EffectComposer(r, target);
    this.composer.addPass(this.renderPass);
    if (q.bloom) this.composer.addPass(this.bloom ??= createBloom(this));
    else if (this.bloom) { this.bloom.dispose(); this.bloom = null; }
    for (const p of extras) this.composer.addPass(p);
    this.composer.addPass(this.grade);
    this.composer.addPass(this.output);
    if (q.fxaa) this.composer.addPass(this.fxaa ??= new FXAAPass());
    if (live) this.resize();
  }

  /** Drop the WebGL context and take it straight back: three.js re-uploads every buffer, texture and
   *  shader from what the CPU keeps. The cure for a driver that woke from sleep with scrambled memory. */
  refresh() {
    if (this.lost || this.held || this.cycling) return false;
    this.cycling = true;
    this.renderer.forceContextLoss();
    return true;
  }

  /** Give the GPU memory back while something else draws (the menu behind a battle)… */
  release() {
    if (this.held) return;
    this.held = true;
    if (!this.lost) this.renderer.forceContextLoss();
  }

  /** …and take it again, rebuilt from scratch. */
  reclaim() {
    if (!this.held) return;
    this.held = false;
    if (this.lost) this.renderer.forceContextRestore();
    else this.cycling = true;   // the loss has not landed yet: restore as soon as it does
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth || innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || innerHeight);
    const pr = pixelRatioFor(this.quality, devicePixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.width = w;
    this.height = h;
  }

  /** Keep the sun, its shadow frustum and the sky centred on the point the camera looks at. */
  follow(x, z, extent = 26) {
    const sx = Math.round(x), sz = Math.round(z);
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + SUN_DIRECTION.x * 70, SUN_DIRECTION.y * 70, sz + SUN_DIRECTION.z * 70);
    const e = Math.round(Math.max(18, Math.min(64, extent)));
    if (this.sun.castShadow && e !== this.shadowExtent) {
      const c = this.sun.shadow.camera;
      c.left = -e; c.right = e; c.top = e; c.bottom = -e;
      c.updateProjectionMatrix();
      this.shadowExtent = e;
    }
    this.sky.position.set(x, 0, z);
  }

  /** Compiles every material in `scene` for the variant it is really drawn with: the RenderPass draws into the
   *  composer's buffer, and three.js keys programs by the bound target (off screen: no tone mapping, linear output). */
  compile(scene = this.scene, camera = this.camera) {
    const r = this.renderer, previous = r.getRenderTarget();
    r.setRenderTarget(this.composer.readBuffer);
    try { r.compile(scene, camera); } finally { r.setRenderTarget(previous); }
  }

  /**
   * Draws the battlefield once into a small off-screen target, from `height` straight above (x, z): every program is
   * linked (the shadow map's too) and every texture uploaded ahead of its first real frame, and nothing shows.
   */
  warm(x, z, height) {
    const r = this.renderer, previous = r.getRenderTarget(), cam = (this.warmCamera ??= new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 1000));
    this.warmTarget ??= new THREE.WebGLRenderTarget(64, 36, { type: THREE.HalfFloatType });
    cam.position.set(x, height, z + 0.01);
    cam.lookAt(x, 0, z);
    cam.updateMatrixWorld();
    this.follow(x, z, 64);
    r.setRenderTarget(this.warmTarget);
    try { r.render(this.scene, cam); } finally { r.setRenderTarget(previous); }
  }

  /** Draws `scene` through `camera` (the battlefield by default) with the whole post-processing chain. */
  render(scene = this.scene, camera = this.camera) {
    if (this.lost) return;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render();
  }
}
