// Renderer, lights, sky and post-processing (spec §5.1): ACES tone mapping, soft sun shadows that
// follow the camera, hemisphere sky/sand bounce, exponential haze, bloom and FXAA or MSAA.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { createSky, createEnvironment } from './sky.js';
import { qualityPreset } from './quality.js';
import { createGradePass } from './grade-pass.js';

export const SUN_DIRECTION = new THREE.Vector3(-0.55, 0.9, 0.42).normalize();

export class Renderer3D {
  constructor(canvas, qualityName = 'medium') {
    this.canvas = canvas;
    this.quality = qualityPreset(qualityName);
    const q = this.quality;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = q.shadows > 0;
    r.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft was removed in r186

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xd9bb8e, 0.0085);
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 700);

    this.sun = new THREE.DirectionalLight(0xfff0d6, 3.1);
    this.sun.castShadow = q.shadows > 0;
    if (this.sun.castShadow) {
      this.sun.shadow.mapSize.set(q.shadows, q.shadows);
      const c = this.sun.shadow.camera;
      c.near = 1; c.far = 160;
      this.sun.shadow.bias = -0.0005;
      this.sun.shadow.normalBias = 0.03;
    }
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe0ff, 0xb0824c, 0.75);
    this.scene.add(this.hemi);
    this.scene.environment = createEnvironment(r);
    this.scene.environmentIntensity = 0.55;
    this.sky = createSky(SUN_DIRECTION);
    this.scene.add(this.sky);
    this.shadowExtent = 0;

    const target = q.msaa ? new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: q.msaa }) : undefined;
    this.composer = new EffectComposer(r, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.9);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(createGradePass());
    this.composer.addPass(new OutputPass());
    if (q.fxaa) this.composer.addPass(new FXAAPass());

    this.resize();
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      if (this.cycling) { this.cycling = false; setTimeout(() => this.renderer.forceContextRestore()); }
      else if (!this.held) this.onContextLost?.();
    });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.onContextRestored?.(); });
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
    const pr = Math.min(devicePixelRatio || 1, this.quality.pixelRatio);
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

  render() { if (!this.lost) this.composer.render(); }
}
