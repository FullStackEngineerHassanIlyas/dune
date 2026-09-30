// Particle effects (spec §5.4): pools of camera-facing soft sprites, one InstancedMesh each — additive
// for fire, flashes, tracers and sparks, alpha-blended for smoke and thrown dirt — simulated on the CPU
// within the quality preset's particle budget. A sprite can stretch along its own velocity into a
// streak (tracers, shell streaks, sparks, rocket flares, flying clods), smoke drifts on a light wind
// with a little turbulence and is broken up by a noise texture turned per particle. Recipes turn
// combat events into muzzle flashes and launch backblast, tracers and trails, impacts that differ by
// weapon and by what they strike, explosions with fireball, sparks, dirt and a smoke column, the sonic
// ripple, Deviator gas and the Death Hand's trail and shockwave (docs/research/raw/units.md
// "Projectiles"; visual-units.md: rockets, Death Hand). Muzzle flashes also borrow one of a fixed set of
// point lights (none on Low), so the lighting setup — and every compiled shader — never changes
// mid-game. Recipes fill particles from constant templates, so a shot allocates nothing.
import * as THREE from 'three';

const VERT = `
attribute vec2 aAlpha;   // opacity, and a per-particle seed that turns the smoke's noise
varying float vAlpha;
varying float vTail;
varying vec3 vColor;
varying vec2 vUv;
varying vec2 vNoiseUv;
void main() {
  vec4 center = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
  float size = instanceMatrix[0].x;
  vec2 tail = (mat3(modelViewMatrix) * instanceMatrix[1].xyz).xy;   // a streak's tail from its head; zero for a round sprite
  float len = length(tail);
  vec2 along = len > 1e-5 ? -tail / len : vec2(1.0, 0.0);
  vec2 side = vec2(-along.y, along.x);
  center.xy += along * (position.x * (len + size) - len * 0.5) + side * (position.y * size);
  gl_Position = projectionMatrix * center;
  vUv = uv;
  vTail = len / (len + size);
  vAlpha = aAlpha.x;
  float a = aAlpha.y * 6.2832, c = cos(a), s = sin(a);
  vNoiseUv = mat2(c, s, -s, c) * (uv - 0.5) * 0.65 + vec2(aAlpha.y * 3.7, aAlpha.y * 9.1);
#ifdef USE_INSTANCING_COLOR
  vColor = instanceColor;
#else
  vColor = vec3(1.0);
#endif
}`;

const FRAG = `
uniform sampler2D uNoise;
varying float vAlpha;
varying float vTail;
varying vec3 vColor;
varying vec2 vUv;
varying vec2 vNoiseUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float tail = mix(1.0, vUv.x, vTail);   // a streak is brightest at its head
#ifdef ADDITIVE
  float soft = pow(clamp(1.0 - r, 0.0, 1.0), 1.6) * tail;
  gl_FragColor = vec4(vColor * soft * vAlpha, 1.0);
#else
  float n = texture2D(uNoise, vNoiseUv).r;
  float soft = pow(clamp(1.0 - r + (n - 0.5) * 0.55, 0.0, 1.0), 1.4) * tail;   // a billowing edge, not a disc
  vec3 c = vColor * (0.8 + 0.3 * vUv.y) * (0.86 + 0.28 * n);   // lit from above, curdled
  gl_FragColor = vec4(c, clamp(soft * (0.55 + 0.9 * n), 0.0, 1.0) * vAlpha);
#endif
}`;

const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

/** A small tileable value-noise texture (shared by every pool): the texture smoke is cut from. */
let noiseTexture = null;
function smokeNoise() {
  if (noiseTexture) return noiseTexture;
  const N = 64, data = new Uint8Array(N * N * 4);
  const lattice = (g) => { const v = new Float32Array(g * g); for (let i = 0; i < v.length; i++) v[i] = Math.random(); return v; };
  const octaves = [[4, 0.5, lattice(4)], [8, 0.3, lattice(8)], [16, 0.2, lattice(16)]];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const [g, w, l] of octaves) {
      const fx = (x / N) * g, fy = (y / N) * g, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i, j) => l[((iy + j) % g) * g + ((ix + i) % g)];
      v += w * ((at(0, 0) * (1 - sx) + at(1, 0) * sx) * (1 - sy) + (at(0, 1) * (1 - sx) + at(1, 1) * sx) * sy);
    }
    data.fill(Math.round(v * 255), (y * N + x) * 4, (y * N + x) * 4 + 4);
  }
  noiseTexture = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;
  noiseTexture.magFilter = noiseTexture.minFilter = THREE.LinearFilter;
  noiseTexture.needsUpdate = true;
  return noiseTexture;
}

const ONE = [1, 1, 1], SIZE = [0.3, 0.3], FADE = [1, 0];
const WIND_X = 0.16, WIND_Z = 0.07;   // tiles/s² for fully turbulent smoke: a light breeze across the battle

export class ParticlePool {
  constructor(scene, capacity, { additive = false } = {}) {
    const N = (this.capacity = Math.max(16, Math.floor(capacity)));
    this.n = 0;
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.age = new Float32Array(N);
    this.life = new Float32Array(N);
    this.size = new Float32Array(N * 2);
    this.col = new Float32Array(N * 6);
    this.alpha = new Float32Array(N * 2);
    this.phys = new Float32Array(N * 4);   // drag, gravity, turbulence, stretch (seconds of velocity drawn as a streak)
    this.seed = new Float32Array(N);
    const geo = new THREE.PlaneGeometry(1, 1);
    this.alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2);
    this.alphaAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAlpha', this.alphaAttr);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      uniforms: { uNoise: { value: smokeNoise() } },
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, defines: additive ? { ADDITIVE: '' } : {},
    });
    this.mesh = new THREE.InstancedMesh(geo, material, N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 11 : 10;
    scene.add(this.mesh);
  }

  /**
   * One particle from template `t` (size, color, color2, alpha, drag, gravity, turb, stretch; all optional)
   * at a position with a velocity, living `life` seconds; `scale` multiplies its size and `shade` its
   * colour. Returns its slot, or -1 when the pool is full. Allocates nothing.
   */
  spawn(t, x, y, z, vx, vy, vz, life, scale = 1, shade = 1) {
    if (this.n >= this.capacity) return -1;
    const i = this.n++, p = i * 3, q = i * 6, f = i * 4;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.vel[p] = vx; this.vel[p + 1] = vy; this.vel[p + 2] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    const s = t.size ?? SIZE, c = t.color ?? ONE, c2 = t.color2 ?? c, a = t.alpha ?? FADE;
    this.size[i * 2] = s[0] * scale; this.size[i * 2 + 1] = s[1] * scale;
    for (let k = 0; k < 3; k++) { this.col[q + k] = c[k] * shade; this.col[q + 3 + k] = c2[k] * shade; }
    this.alpha[i * 2] = a[0]; this.alpha[i * 2 + 1] = a[1];
    this.phys[f] = t.drag ?? 0; this.phys[f + 1] = t.gravity ?? 0; this.phys[f + 2] = t.turb ?? 0; this.phys[f + 3] = t.stretch ?? 0;
    this.seed[i] = Math.random();
    return i;
  }

  /** The object form: { x, y, z, vx, vy, vz, life, …template fields }. False when the pool is full. */
  emit(o) { return this.spawn(o, o.x, o.y, o.z, o.vx ?? 0, o.vy ?? 0, o.vz ?? 0, o.life ?? 1) >= 0; }

  kill(i) {
    const last = --this.n;
    if (i === last) return;
    this.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.vel.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.age[i] = this.age[last];
    this.life[i] = this.life[last];
    this.seed[i] = this.seed[last];
    this.size.copyWithin(i * 2, last * 2, last * 2 + 2);
    this.col.copyWithin(i * 6, last * 6, last * 6 + 6);
    this.alpha.copyWithin(i * 2, last * 2, last * 2 + 2);
    this.phys.copyWithin(i * 4, last * 4, last * 4 + 4);
  }

  update(dt) {
    if (this.n === 0 && this.mesh.count === 0) return;   // nothing alive and nothing left on screen: no upload
    const m = this.mesh.instanceMatrix.array, c = this.mesh.instanceColor.array, a = this.alphaAttr.array;
    const pos = this.pos, vel = this.vel, phys = this.phys;
    let i = 0;
    while (i < this.n) {
      if (this.age[i] > 0 && this.age[i] + dt >= this.life[i]) { this.kill(i); continue; }   // everything shows for at least one frame
      const age = (this.age[i] = Math.min(this.age[i] + dt, this.life[i] * 0.999));
      const p = i * 3, f = i * 4, drag = Math.max(0, 1 - phys[f] * dt), turb = phys[f + 2];
      let vx = vel[p] * drag, vy = vel[p + 1] * drag - phys[f + 1] * dt, vz = vel[p + 2] * drag;
      if (turb) {   // drift on the wind and curl a little, each particle to its own rhythm
        const ph = this.seed[i] * 40 + age * 2.1;
        vx += (WIND_X + Math.sin(ph) * 1.4) * turb * dt;
        vz += (WIND_Z + Math.cos(ph * 1.31) * 1.4) * turb * dt;
        vy += Math.sin(ph * 0.73) * 0.5 * turb * dt;
      }
      vel[p] = vx; vel[p + 1] = vy; vel[p + 2] = vz;
      pos[p] += vx * dt;
      pos[p + 1] += vy * dt;
      pos[p + 2] += vz * dt;
      const t = age / this.life[i];
      const s = this.size[i * 2] + (this.size[i * 2 + 1] - this.size[i * 2]) * t, st = phys[f + 3];
      const o = i * 16;
      m.fill(0, o, o + 16);
      m[o] = s; m[o + 15] = 1;
      if (st) { m[o + 4] = -vx * st; m[o + 5] = -vy * st; m[o + 6] = -vz * st; }
      m[o + 12] = pos[p]; m[o + 13] = pos[p + 1]; m[o + 14] = pos[p + 2];
      const q = i * 6;
      for (let k = 0; k < 3; k++) c[p + k] = this.col[q + k] + (this.col[q + 3 + k] - this.col[q + k]) * t;
      a[i * 2] = this.alpha[i * 2] + (this.alpha[i * 2 + 1] - this.alpha[i * 2]) * t;
      a[i * 2 + 1] = this.seed[i];
      i++;
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  /** Takes the pool off the scene and frees its geometry, material and instance buffers (the shared noise stays). */
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}

// Templates: what a kind of particle looks like and how it moves. Glow colours run above 1 for the bloom.
const T = {
  flash:     { size: [0.3, 0.45], color: [7, 4.5, 1.6] },
  jet:       { size: [0.16, 0.08], color: [8, 5.5, 2.2], color2: [3, 1.2, 0.3], drag: 9, stretch: 0.05 },
  spark:     { size: [0.05, 0.02], color: [7, 4.5, 1.6], color2: [3, 0.8, 0.1], drag: 1.2, gravity: 7, stretch: 0.03 },
  metal:     { size: [0.045, 0.02], color: [9, 8, 6], color2: [4, 1.6, 0.3], drag: 1.5, gravity: 6, stretch: 0.035 },
  tracer:    { size: [0.055, 0.05], color: [8, 6.2, 2.6], stretch: 0.042 },
  shell:     { size: [0.1, 0.08], color: [9, 5, 1.6], stretch: 0.034 },
  plasma:    { size: [0.13, 0.1], color: [9, 7.5, 5], stretch: 0.03 },
  flare:     { size: [0.17, 0.11], color: [9, 6, 2.4], color2: [4, 1.4, 0.2], stretch: 0.022 },
  fireball:  { size: [0.6, 1.4], color: [8, 3.4, 0.9], color2: [1.8, 0.35, 0.08], drag: 3 },
  core:      { size: [0.8, 1.3], color: [8, 6, 3.4], color2: [4, 1.5, 0.35] },
  ember:     { size: [0.06, 0.03], color: [6, 2.4, 0.5], color2: [1.5, 0.25, 0.02], drag: 0.8, gravity: 2.5, stretch: 0.02 },
  flame:     { size: [0.28, 0.08], color: [6, 2.4, 0.5], color2: [1.4, 0.3, 0.05] },
  weld:      { size: [0.05, 0.02], color: [5, 6, 8], gravity: 7 },
  sonic:     { size: [0.22, 0.55], color: [0.7, 0.95, 1.5], alpha: [0.45, 0] },
  gasGlow:   { size: [0.2, 0.1], color: [2.5, 6, 1.5] },
  dhFlare:   { size: [0.5, 0.2], color: [9, 5, 2] },
  dhFlash:   { size: [2, 6], color: [8, 5, 2.5] },

  gunSmoke:  { size: [0.2, 0.6], color: [0.36, 0.34, 0.31], alpha: [0.5, 0], drag: 1.5, turb: 0.3 },
  backblast: { size: [0.16, 0.85], color: [0.74, 0.71, 0.66], color2: [0.62, 0.6, 0.57], alpha: [0.55, 0], drag: 3, turb: 0.5 },
  trail:     { size: [0.18, 0.75], color: [0.8, 0.78, 0.74], color2: [0.6, 0.59, 0.57], alpha: [0.6, 0], drag: 1.6, turb: 0.45 },
  gasTrail:  { size: [0.12, 0.5], color: [0.4, 0.75, 0.3], alpha: [0.5, 0], drag: 1.2, turb: 0.4 },
  dhSmoke:   { size: [0.25, 1.2], color: [0.82, 0.8, 0.76], color2: [0.6, 0.59, 0.57], alpha: [0.6, 0], drag: 0.8, turb: 0.5 },
  soot:      { size: [0.6, 2.2], color: [0.17, 0.15, 0.13], color2: [0.42, 0.4, 0.38], alpha: [0.78, 0], drag: 1, turb: 0.35 },
  puff:      { size: [0.2, 0.7], color: [0.3, 0.28, 0.26], alpha: [0.6, 0], drag: 1, turb: 0.3 },
  wreck:     { size: [0.15, 0.7], color: [0.16, 0.15, 0.14], color2: [0.4, 0.38, 0.36], alpha: [0.6, 0], drag: 0.6, turb: 0.3 },
  dust:      { size: [0.2, 0.9], color: [0.78, 0.64, 0.45], color2: [0.86, 0.75, 0.6], drag: 1.2 },
  spray:     { size: [0.08, 0.5], color: [0.8, 0.65, 0.45], color2: [0.86, 0.76, 0.6], alpha: [0.55, 0], drag: 2.4, gravity: 0.4, turb: 0.25 },
  clod:      { size: [0.055, 0.04], color: [0.34, 0.25, 0.16], alpha: [0.95, 0.85], drag: 0.3, gravity: 9, stretch: 0.02 },
  ring:      { size: [0.4, 1.4], color: [0.8, 0.66, 0.46], alpha: [0.55, 0], drag: 2.5 },
  gas:       { size: [0.4, 1.6], color: [0.33, 0.8, 0.2], color2: [0.55, 0.72, 0.4], alpha: [0.6, 0], drag: 1.2, turb: 0.4 },
};

// What each ground looks like thrown up: [spray colour, spray colour faded, clod colour]
const GROUND = {
  sand:     [[0.82, 0.66, 0.45], [0.88, 0.77, 0.6], [0.5, 0.37, 0.22]],
  rock:     [[0.58, 0.52, 0.45], [0.66, 0.61, 0.55], [0.3, 0.26, 0.22]],
  concrete: [[0.5, 0.5, 0.44], [0.62, 0.62, 0.56], [0.26, 0.26, 0.22]],
};
GROUND.dune = GROUND.sand;
GROUND.mountain = GROUND.rock;
const SPRAY = { ...T.spray }, CLOD = { ...T.clod }, RING = { ...T.ring };   // recoloured per ground in place (no allocation)
function tintGround(surface) {
  const g = GROUND[surface] ?? GROUND.sand;
  SPRAY.color = RING.color = g[0];
  SPRAY.color2 = g[1];
  CLOD.color = g[2];
}

const SIZES = { small: { n: 6, s: 0.45 }, medium: { n: 14, s: 0.8 }, large: { n: 28, s: 1.4 } };
/** How big a rocket's blast is, by the weapon that fired it. */
const ROCKET_SCALE = { rocket: 1, turretRocket: 0.95, miniRocket: 0.62, trooperRocket: 0.62, gasRocket: 0.8 };
/** A tracer or streak, by the weapon that fired it. */
const STREAK = { mg: T.tracer, rifle: T.tracer, pistol: T.tracer, trooperRocket: T.tracer, cannon: T.shell, heavyCannon: T.shell, turretGun: T.shell, plasma: T.plasma };

export class Effects {
  constructor(scene, quality) {
    const budget = quality.particles ?? 4000;
    this.detail = Math.max(0.35, Math.min(2, budget / 4000));   // Low throws fewer particles, High more
    this.glow = new ParticlePool(scene, budget * 0.45, { additive: true });
    this.smoke = new ParticlePool(scene, budget * 0.55, { additive: false });
    this.lights = [];
    for (let k = 0; k < (quality.flashLights ?? 0); k++) {
      const light = new THREE.PointLight(0xffb060, 0, 3.5, 2);
      scene.add(light);
      this.lights.push({ light, t: 0 });
    }
    this.nextLight = 0;
  }

  /** `base` particles scaled by the preset's detail, at least one. */
  count(base) { return Math.max(1, Math.round(base * this.detail)); }

  flash(x, y, z, intensity) {
    if (!this.lights.length) return;
    const l = this.lights[this.nextLight++ % this.lights.length];
    l.light.position.set(x, y + 0.25, z);
    l.light.intensity = intensity;
    l.t = 0.09;
  }

  /** A gun's flash: a bright bloom and, given the direction it fired (radians), a jet of flame out of the barrel. */
  muzzle(x, y, z, big = false, dir = null) {
    this.glow.spawn(T.flash, x, y, z, 0, 0, 0, 0.07, big ? 1.8 : 1);
    if (dir !== null) {
      const c = Math.cos(dir), s = Math.sin(dir), v = big ? 5 : 3.5;
      this.glow.spawn(T.jet, x, y, z, c * v, 0, s * v, 0.06, big ? 1.5 : 0.8);
      if (big) for (const side of [-1, 1]) this.glow.spawn(T.jet, x, y, z, -s * side * 2.5 + c, 0, c * side * 2.5 + s, 0.05, 0.7);   // the muzzle brake's side vents
    }
    if (big) for (let k = 0; k < this.count(3); k++) this.smoke.spawn(T.gunSmoke, x, y, z, rnd(-0.3, 0.3) + (dir === null ? 0 : Math.cos(dir) * 0.6), rnd(0.2, 0.6), rnd(-0.3, 0.3) + (dir === null ? 0 : Math.sin(dir) * 0.6), rnd(0.5, 0.9));
    this.flash(x, y, z, big ? 6 : 2.5);
  }

  /** A cannon's blast kicking up the ground under its barrel (y: ground level). */
  groundBlast(x, y, z, dir, surface = 'sand') {
    tintGround(surface);
    const c = Math.cos(dir), s = Math.sin(dir);
    for (let k = 0; k < this.count(4); k++) {
      const a = dir + rnd(-1.1, 1.1), v = rnd(0.8, 1.6);
      this.smoke.spawn(SPRAY, x + c * 0.1, y + 0.04, z + s * 0.1, Math.cos(a) * v, rnd(0.1, 0.3), Math.sin(a) * v, rnd(0.5, 0.9), 0.9, 0.95);
    }
  }

  /**
   * A rocket leaving its launcher at (x, y, z) toward `dir` (radians): the launch flash, a jet of flame
   * and a cloud of backblast thrown out behind and to the sides, dust off the ground below (at height `ground`;
   * surface null: fired from the air).
   */
  launch(x, y, z, dir, ground = y - 0.35, surface = 'sand', scale = 1) {
    const c = Math.cos(dir), s = Math.sin(dir);
    this.glow.spawn(T.flash, x, y, z, 0, 0, 0, 0.09, 1.5 * scale);
    this.glow.spawn(T.jet, x, y, z, -c * 4, 0.3, -s * 4, 0.08, 1.4 * scale);
    for (let k = 0; k < this.count(7 * scale); k++) {
      const a = dir + Math.PI + rnd(-0.7, 0.7), v = rnd(1, 2.6);
      this.smoke.spawn(T.backblast, x - c * 0.1, y + rnd(-0.05, 0.05), z - s * 0.1, Math.cos(a) * v, rnd(0.1, 0.5), Math.sin(a) * v, rnd(0.9, 1.6), scale, rnd(0.9, 1.05));
    }
    if (!surface) { this.flash(x, y, z, 5 * scale); return; }   // fired from the air: nothing to kick up
    tintGround(surface);
    for (let k = 0; k < this.count(3 * scale); k++) {
      const a = dir + Math.PI + rnd(-1.2, 1.2), v = rnd(0.6, 1.4);
      this.smoke.spawn(SPRAY, x - c * 0.3, ground + 0.05, z - s * 0.3, Math.cos(a) * v, rnd(0.1, 0.3), Math.sin(a) * v, rnd(0.6, 1.1), scale);
    }
    this.flash(x, y, z, 5 * scale);
  }

  trail(kind, x, y, z) {
    if (kind === 'rocket') {
      this.glow.spawn(T.flare, x, y, z, 0, 0, 0, 0.06, 1);
      this.smoke.spawn(T.trail, x, y, z, rnd(-0.08, 0.08), rnd(0.05, 0.2), rnd(-0.08, 0.08), rnd(1.6, 2.6));
    } else if (kind === 'gas') {
      this.smoke.spawn(T.gasTrail, x, y, z, rnd(-0.08, 0.08), rnd(0.05, 0.2), rnd(-0.08, 0.08), rnd(0.8, 1.3));
      this.glow.spawn(T.gasGlow, x, y, z, 0, 0, 0, 0.06);
    } else if (kind === 'deathHand') {
      this.glow.spawn(T.dhFlare, x, y, z, 0, 0, 0, 0.1);
      for (let k = 0; k < 2; k++) this.smoke.spawn(T.dhSmoke, x, y, z, rnd(-0.15, 0.15), rnd(0, 0.2), rnd(-0.15, 0.15), rnd(2.5, 3.5));
    } else if (kind === 'shell') this.glow.spawn(T.shell, x, y, z, 0, 0, 0, 0.05);
    else this.glow.spawn(T.tracer, x, y, z, 0, 0, 0, 0.04);
  }

  /** A bullet or shell in flight at (x, y, z) moving by (vx, vy, vz) tiles/s: a glowing streak for one frame. */
  tracer(x, y, z, vx, vy, vz, weapon = null, kind = 'bullet') {
    this.glow.spawn(STREAK[weapon] ?? (kind === 'shell' ? T.shell : T.tracer), x, y, z, vx, vy, vz, 0.03);
  }

  /**
   * A rocket's trail over the stretch it flew this frame, (x0, y0, z0) to (x1, y1, z1), heading (dx, dy, dz)
   * at `speed`: smoke puffs laid evenly along it that linger, spread and drift, and the exhaust flare at the tail.
   * kind: 'rocket', 'gas' or 'deathHand'; scale: 1 for a full rocket, less for a mini-rocket.
   */
  rocketTrail(kind, x0, y0, z0, x1, y1, z1, dx, dy, dz, speed, scale = 1) {
    const dist = Math.hypot(x1 - x0, y1 - y0, z1 - z0), dh = kind === 'deathHand';
    const gap = (dh ? 0.14 : 0.1) / Math.sqrt(this.detail) / (dh ? 1 : Math.max(0.6, scale));
    const n = Math.min(12, Math.floor(dist / gap));   // twelve at most in one frame
    const smoke = dh ? T.dhSmoke : kind === 'gas' ? T.gasTrail : T.trail;
    for (let k = 1; k <= n; k++) {
      const f = (k * gap) / dist, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, z = z0 + (z1 - z0) * f;
      const life = dh ? rnd(3, 4.5) : kind === 'gas' ? rnd(1, 1.6) : rnd(2.2, 3.4);
      this.smoke.spawn(smoke, x, y, z, rnd(-0.1, 0.1) - dx * 0.4, rnd(0.02, 0.15), rnd(-0.1, 0.1) - dz * 0.4, life, scale, rnd(0.92, 1.06));
    }
    const back = dh ? 0.42 : 0.16 * scale;
    this.glow.spawn(dh ? T.dhFlare : kind === 'gas' ? T.gasGlow : T.flare, x1 - dx * back, y1 - dy * back, z1 - dz * back, dx * speed, dy * speed, dz * speed, 0.03, dh ? 1 : scale);
    return n < 12 ? n * gap : dist;   // how far along the stretch the trail now reaches (a long frame skips ahead rather than lag)
  }

  /**
   * Where a shot lands. kind: the projectile; hit: it struck a vehicle or building (sparks off metal) rather
   * than the ground (a spray of whatever `surface` it hit: sand, dune, rock, mountain, concrete). weapon: the
   * weapon that fired it, which sizes a rocket's blast.
   */
  impact(x, y, z, kind, hit, weapon = null, surface = 'sand') {
    if (kind === 'rocket') { this.rocketBlast(x, y, z, ROCKET_SCALE[weapon] ?? 1, hit, surface); return; }
    if (kind === 'gas') { this.gasCloud(x, y, z); return; }
    const shell = kind === 'shell';
    if (hit) {
      for (let k = 0; k < this.count(shell ? 7 : 3); k++) this.glow.spawn(T.metal, x, y, z, rnd(-2, 2), rnd(0.6, 2.4), rnd(-2, 2), rnd(0.15, 0.35));
      this.glow.spawn(T.flash, x, y, z, 0, 0, 0, 0.05, shell ? 1.2 : 0.5);
      if (shell) {
        for (let k = 0; k < 2; k++) this.glow.spawn(T.fireball, x + rnd(-0.08, 0.08), y, z + rnd(-0.08, 0.08), rnd(-0.3, 0.3), rnd(0.2, 0.6), rnd(-0.3, 0.3), rnd(0.2, 0.35), 0.35);
        this.smoke.spawn(T.puff, x, y, z, 0, 0.3, 0, rnd(0.9, 1.4), 1, 0.9);
        this.flash(x, y, z, 3);
      }
      return;
    }
    tintGround(surface);
    for (let k = 0; k < this.count(shell ? 6 : 2); k++) this.smoke.spawn(CLOD, x, y, z, rnd(-1, 1) * (shell ? 1.3 : 0.8), rnd(1.5, 3) * (shell ? 1.2 : 0.8), rnd(-1, 1) * (shell ? 1.3 : 0.8), rnd(0.35, 0.7), shell ? 1.1 : 0.8);
    for (let k = 0; k < (shell ? this.count(3) : 1); k++) this.smoke.spawn(SPRAY, x + rnd(-0.05, 0.05), y, z + rnd(-0.05, 0.05), rnd(-0.3, 0.3), rnd(0.5, 1.1), rnd(-0.3, 0.3), rnd(0.6, 1.1), shell ? 1.3 : 0.7);
    if (surface === 'rock' || surface === 'mountain' || surface === 'concrete') for (let k = 0; k < (shell ? 3 : 1); k++) this.glow.spawn(T.spark, x, y, z, rnd(-1.5, 1.5), rnd(0.5, 2), rnd(-1.5, 1.5), rnd(0.12, 0.25));
    if (shell) {
      this.glow.spawn(T.fireball, x, y + 0.05, z, 0, 0.4, 0, 0.22, 0.3);
      this.smoke.spawn(T.puff, x, y, z, 0, 0.3, 0, rnd(0.9, 1.3), 0.9, 0.95);
      this.flash(x, y, z, 2.5);
    }
  }

  /** A rocket going off: a small explosion sized by `scale`, throwing dirt when it lands on the ground. */
  rocketBlast(x, y, z, scale = 1, hit = false, surface = 'sand') {
    this.burst(x, y, z, 0.5 * scale, Math.round(9 * scale), hit ? null : surface);
  }

  /** size: small, medium or large; surface: the ground it throws up (sand, rock, concrete …), or null in the air. */
  explosion(x, y, z, size = 'medium', surface = 'sand') {
    const { n, s } = SIZES[size] ?? SIZES.medium;
    this.burst(x, y, z, s, n, surface);
  }

  /** The body of every explosion: a white-hot core, a fireball, sparks and embers, thrown dirt (on the ground), a ring of dust and a column of smoke. */
  burst(x, y, z, s, n, surface) {
    const N = this.count(n);
    this.glow.spawn(T.core, x, y + 0.1 * s, z, 0, 0, 0, 0.12, s);
    for (let k = 0; k < N; k++) {
      this.glow.spawn(T.fireball, x + rnd(-0.15, 0.15) * s, y, z + rnd(-0.15, 0.15) * s, rnd(-1, 1) * s * 1.6, rnd(0.2, 1.4) * s * 1.6, rnd(-1, 1) * s * 1.6, rnd(0.35, 0.7), s);
    }
    for (let k = 0; k < Math.ceil(N / 2); k++) this.glow.spawn(T.spark, x, y, z, rnd(-4, 4) * s, rnd(1, 4.5) * s, rnd(-4, 4) * s, rnd(0.3, 0.7));
    for (let k = 0; k < Math.ceil(N / 5); k++) this.glow.spawn(T.ember, x, y + 0.1, z, rnd(-1.5, 1.5) * s, rnd(1.5, 3) * s, rnd(-1.5, 1.5) * s, rnd(0.8, 1.5));
    for (let k = 0; k < Math.ceil(N / 2); k++) {
      this.smoke.spawn(T.soot, x + rnd(-0.3, 0.3) * s, y, z + rnd(-0.3, 0.3) * s, rnd(-0.4, 0.4), rnd(0.3, 0.9), rnd(-0.4, 0.4), rnd(1.8, 3.4), s, rnd(0.85, 1.1));
    }
    if (!surface) return;
    tintGround(surface);
    for (let k = 0; k < Math.ceil(N / 2); k++) {
      const a = rnd(0, TAU), v = rnd(0.8, 2.2) * s;
      this.smoke.spawn(CLOD, x, y, z, Math.cos(a) * v, rnd(2, 4) * Math.sqrt(s), Math.sin(a) * v, rnd(0.5, 0.9), 0.8 + s * 0.6);
    }
    const ring = Math.ceil(N / 2);
    for (let k = 0; k < ring; k++) {
      const a = (k / ring) * TAU + rnd(-0.2, 0.2), v = rnd(1.6, 2.6) * s;
      this.smoke.spawn(RING, x, y - 0.1, z, Math.cos(a) * v, 0.15, Math.sin(a) * v, rnd(0.7, 1.1), s * 0.7);
    }
    this.flash(x, y, z, 4 + s * 6);
  }

  smokePuff(x, y, z) {
    this.smoke.spawn(T.wreck, x, y, z, rnd(-0.1, 0.1), rnd(0.35, 0.7), rnd(-0.1, 0.1), rnd(1.2, 2));
  }

  flame(x, y, z) {
    this.glow.spawn(T.flame, x + rnd(-0.1, 0.1), y, z + rnd(-0.1, 0.1), 0, rnd(0.4, 0.9), 0, rnd(0.3, 0.6));
  }

  dust(x, y, z, strength = 1) {
    const i = this.smoke.spawn(T.dust, x + rnd(-0.1, 0.1), y, z + rnd(-0.1, 0.1), rnd(-0.15, 0.15), rnd(0.15, 0.35), rnd(-0.15, 0.15), rnd(0.9, 1.5));
    if (i >= 0) { this.smoke.size[i * 2 + 1] = 0.9 * strength; this.smoke.alpha[i * 2] = 0.32 * strength; }
  }

  weld(x, y, z) {
    for (let k = 0; k < 3; k++) this.glow.spawn(T.weld, x, y, z, rnd(-1.2, 1.2), rnd(0.2, 1.4), rnd(-1.2, 1.2), rnd(0.12, 0.28));
  }

  /** The sonic wave's front: a pale shimmer across its path, drifting on. */
  sonic(x, y, z, dir) {
    const sx = -Math.sin(dir), sz = Math.cos(dir);
    for (let k = -2; k <= 2; k++) this.glow.spawn(T.sonic, x + sx * k * 0.16, y + rnd(-0.05, 0.05), z + sz * k * 0.16, Math.cos(dir) * 0.6, 0, Math.sin(dir) * 0.6, 0.3);
  }

  /** Deviator gas bursting: a green cloud that lingers. */
  gasCloud(x, y, z) {
    for (let k = 0; k < 16; k++) this.smoke.spawn(T.gas, x + rnd(-0.3, 0.3), y, z + rnd(-0.3, 0.3), rnd(-0.7, 0.7), rnd(0.1, 0.4), rnd(-0.7, 0.7), rnd(1.6, 2.6));
  }

  /** Where the Death Hand comes down: a ring of dust racing outward and a white-hot flash. */
  shockwave(x, y, z) {
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * TAU;
      this.smoke.spawn(T.ring, x, y, z, Math.cos(a) * 7, 0.2, Math.sin(a) * 7, 0.9);
    }
    this.glow.spawn(T.dhFlash, x, y + 0.3, z, 0, 0, 0, 0.35);
    this.flash(x, y, z, 14);
  }

  /** Fremen rising out of the sand. */
  rise(x, y, z) {
    for (let k = 0; k < 5; k++) this.dust(x + rnd(-0.3, 0.3), y, z + rnd(-0.3, 0.3), 1.3);
  }

  update(dt) {
    this.glow.update(dt);
    this.smoke.update(dt);
    for (const l of this.lights) if (l.t > 0 && (l.t -= dt) <= 0) { l.t = 0; l.light.intensity = 0; }
  }

  /** Takes the pools and the flash lights off the scene and frees them. */
  dispose() {
    this.glow.dispose();
    this.smoke.dispose();
    for (const { light } of this.lights) { light.removeFromParent(); light.dispose(); }
    this.lights = [];
  }
}
