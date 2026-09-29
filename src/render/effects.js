// Particle effects (spec §5.4): pools of camera-facing soft sprites, one InstancedMesh each — additive
// for fire, flashes, tracers and sparks, alpha-blended for smoke — simulated on the CPU within the
// quality preset's particle budget. Recipes turn combat events into muzzle flashes, projectile trails,
// impacts, explosions, smoke and flames, the sonic ripple, Deviator gas and the Death Hand's trail and
// shockwave. Muzzle flashes also borrow one of a fixed set of point lights
// (none on Low), so the lighting setup — and every compiled shader — never changes mid-game.
import * as THREE from 'three';

const VERT = `
attribute float aAlpha;
varying float vAlpha;
varying vec3 vColor;
varying vec2 vUv;
void main() {
  vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  center.xy += position.xy * length(instanceMatrix[0].xyz);
  gl_Position = projectionMatrix * center;
  vUv = uv;
  vAlpha = aAlpha;
#ifdef USE_INSTANCING_COLOR
  vColor = instanceColor;
#else
  vColor = vec3(1.0);
#endif
}`;

const FRAG = `
varying float vAlpha;
varying vec3 vColor;
varying vec2 vUv;
void main() {
  float soft = pow(clamp(1.0 - length(vUv - 0.5) * 2.0, 0.0, 1.0), 1.6);
#ifdef ADDITIVE
  gl_FragColor = vec4(vColor * soft * vAlpha, 1.0);
#else
  gl_FragColor = vec4(vColor, soft * vAlpha);
#endif
}`;

const rnd = (a, b) => a + Math.random() * (b - a);

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
    this.phys = new Float32Array(N * 2);
    const geo = new THREE.PlaneGeometry(1, 1);
    this.alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.alphaAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAlpha', this.alphaAttr);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
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

  emit({ x, y, z, vx = 0, vy = 0, vz = 0, life = 1, size = [0.3, 0.3], color = [1, 1, 1], color2 = color, alpha = [1, 0], drag = 0, gravity = 0 }) {
    if (this.n >= this.capacity) return false;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.age[i] = 0;
    this.life[i] = life;
    this.size.set(size, i * 2);
    this.col.set([color[0], color[1], color[2], color2[0], color2[1], color2[2]], i * 6);
    this.alpha.set(alpha, i * 2);
    this.phys.set([drag, gravity], i * 2);
    return true;
  }

  kill(i) {
    const last = --this.n;
    if (i === last) return;
    this.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.vel.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.age[i] = this.age[last];
    this.life[i] = this.life[last];
    this.size.copyWithin(i * 2, last * 2, last * 2 + 2);
    this.col.copyWithin(i * 6, last * 6, last * 6 + 6);
    this.alpha.copyWithin(i * 2, last * 2, last * 2 + 2);
    this.phys.copyWithin(i * 2, last * 2, last * 2 + 2);
  }

  update(dt) {
    if (this.n === 0 && this.mesh.count === 0) return;   // nothing alive and nothing left on screen: no upload
    const m = this.mesh.instanceMatrix.array, c = this.mesh.instanceColor.array, a = this.alphaAttr.array;
    let i = 0;
    while (i < this.n) {
      if (this.age[i] > 0 && this.age[i] + dt >= this.life[i]) { this.kill(i); continue; }   // everything shows for at least one frame
      this.age[i] = Math.min(this.age[i] + dt, this.life[i] * 0.999);
      const p = i * 3, drag = Math.max(0, 1 - this.phys[i * 2] * dt), g = this.phys[i * 2 + 1];
      this.vel[p] *= drag;
      this.vel[p + 1] = this.vel[p + 1] * drag - g * dt;
      this.vel[p + 2] *= drag;
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      const t = this.age[i] / this.life[i];
      const s = this.size[i * 2] + (this.size[i * 2 + 1] - this.size[i * 2]) * t;
      const o = i * 16;
      m.fill(0, o, o + 16);
      m[o] = s; m[o + 5] = s; m[o + 10] = s; m[o + 15] = 1;
      m[o + 12] = this.pos[p]; m[o + 13] = this.pos[p + 1]; m[o + 14] = this.pos[p + 2];
      const q = i * 6;
      for (let k = 0; k < 3; k++) c[p + k] = this.col[q + k] + (this.col[q + 3 + k] - this.col[q + k]) * t;
      a[i] = this.alpha[i * 2] + (this.alpha[i * 2 + 1] - this.alpha[i * 2]) * t;
      i++;
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }
}

const SIZES = { small: { n: 6, s: 0.45 }, medium: { n: 14, s: 0.8 }, large: { n: 28, s: 1.4 } };

export class Effects {
  constructor(scene, quality) {
    const budget = quality.particles ?? 4000;
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

  flash(x, y, z, intensity) {
    if (!this.lights.length) return;
    const l = this.lights[this.nextLight++ % this.lights.length];
    l.light.position.set(x, y + 0.25, z);
    l.light.intensity = intensity;
    l.t = 0.09;
  }

  muzzle(x, y, z, big = false) {
    this.glow.emit({ x, y, z, life: 0.07, size: [big ? 0.55 : 0.3, big ? 0.9 : 0.45], color: [7, 4.5, 1.6], alpha: [1, 0] });
    if (big) for (let k = 0; k < 3; k++) this.smoke.emit({ x, y, z, vx: rnd(-0.3, 0.3), vy: rnd(0.2, 0.6), vz: rnd(-0.3, 0.3), life: rnd(0.4, 0.8), size: [0.2, 0.6], color: [0.36, 0.34, 0.31], alpha: [0.5, 0], drag: 1.5 });
    this.flash(x, y, z, big ? 6 : 2.5);
  }

  trail(kind, x, y, z) {
    if (kind === 'rocket') {
      this.glow.emit({ x, y, z, life: 0.06, size: [0.22, 0.1], color: [8, 5, 2], alpha: [1, 0] });
      this.smoke.emit({ x, y, z, vx: rnd(-0.08, 0.08), vy: rnd(0.05, 0.2), vz: rnd(-0.08, 0.08), life: rnd(0.6, 1.0), size: [0.12, 0.5], color: [0.62, 0.6, 0.57], alpha: [0.55, 0], drag: 1 });
    } else if (kind === 'gas') {
      this.smoke.emit({ x, y, z, vx: rnd(-0.08, 0.08), vy: rnd(0.05, 0.2), vz: rnd(-0.08, 0.08), life: rnd(0.5, 0.9), size: [0.12, 0.45], color: [0.4, 0.75, 0.3], alpha: [0.5, 0], drag: 1 });
      this.glow.emit({ x, y, z, life: 0.06, size: [0.2, 0.1], color: [2.5, 6, 1.5], alpha: [1, 0] });
    } else if (kind === 'deathHand') {
      this.glow.emit({ x, y, z, life: 0.1, size: [0.5, 0.2], color: [9, 5, 2], alpha: [1, 0] });
      for (let k = 0; k < 2; k++) this.smoke.emit({ x, y, z, vx: rnd(-0.15, 0.15), vy: rnd(0, 0.2), vz: rnd(-0.15, 0.15), life: rnd(1.5, 2.5), size: [0.25, 1.1], color: [0.8, 0.78, 0.74], alpha: [0.6, 0], drag: 0.8 });
    } else if (kind === 'shell') this.glow.emit({ x, y, z, life: 0.05, size: [0.16, 0.08], color: [6, 3, 0.8], alpha: [1, 0] });
    else this.glow.emit({ x, y, z, life: 0.04, size: [0.09, 0.05], color: [6, 5, 2], alpha: [1, 0] });
  }

  impact(x, y, z, kind, hit) {
    if (kind === 'rocket') { this.explosion(x, y, z, 'small'); return; }
    if (kind === 'gas') { this.gasCloud(x, y, z); return; }
    const sparks = kind === 'shell' ? 6 : 2;
    for (let k = 0; k < sparks; k++) this.glow.emit({ x, y, z, vx: rnd(-1.5, 1.5), vy: rnd(0.5, 2), vz: rnd(-1.5, 1.5), life: rnd(0.15, 0.3), size: [0.07, 0.03], color: [6, 4, 1.5], alpha: [1, 0], gravity: 6 });
    if (kind === 'shell') this.smoke.emit({ x, y, z, vy: 0.3, life: 0.9, size: [0.2, 0.7], color: hit ? [0.3, 0.28, 0.26] : [0.62, 0.5, 0.36], alpha: [0.6, 0], drag: 1 });
  }

  explosion(x, y, z, size = 'medium') {
    const { n, s } = SIZES[size] ?? SIZES.medium;
    for (let k = 0; k < n; k++) {
      this.glow.emit({ x, y, z, vx: rnd(-1, 1) * s * 1.6, vy: rnd(0.2, 1.4) * s * 1.6, vz: rnd(-1, 1) * s * 1.6, life: rnd(0.35, 0.7), size: [s * 0.6, s * 1.4], color: [8, 3.2, 0.8], color2: [2, 0.4, 0.1], alpha: [1, 0], drag: 3 });
    }
    for (let k = 0; k < n / 2; k++) this.glow.emit({ x, y, z, vx: rnd(-4, 4) * s, vy: rnd(1, 4) * s, vz: rnd(-4, 4) * s, life: rnd(0.3, 0.6), size: [0.08, 0.03], color: [7, 4, 1.2], alpha: [1, 0], gravity: 7 });
    for (let k = 0; k < n / 2; k++) {
      this.smoke.emit({ x: x + rnd(-0.3, 0.3) * s, y, z: z + rnd(-0.3, 0.3) * s, vx: rnd(-0.4, 0.4), vy: rnd(0.3, 0.9), vz: rnd(-0.4, 0.4), life: rnd(1.5, 3), size: [s * 0.6, s * 2.2], color: [0.2, 0.18, 0.16], color2: [0.42, 0.4, 0.38], alpha: [0.75, 0], drag: 1 });
    }
    this.flash(x, y, z, 4 + s * 6);
  }

  smokePuff(x, y, z) {
    this.smoke.emit({ x, y, z, vx: rnd(-0.1, 0.1), vy: rnd(0.35, 0.7), vz: rnd(-0.1, 0.1), life: rnd(1.2, 2), size: [0.15, 0.7], color: [0.16, 0.15, 0.14], color2: [0.4, 0.38, 0.36], alpha: [0.6, 0], drag: 0.6 });
  }

  flame(x, y, z) {
    this.glow.emit({ x: x + rnd(-0.1, 0.1), y, z: z + rnd(-0.1, 0.1), vy: rnd(0.4, 0.9), life: rnd(0.3, 0.6), size: [0.28, 0.08], color: [6, 2.4, 0.5], color2: [1.4, 0.3, 0.05], alpha: [1, 0] });
  }

  dust(x, y, z, strength = 1) {
    this.smoke.emit({ x: x + rnd(-0.1, 0.1), y, z: z + rnd(-0.1, 0.1), vx: rnd(-0.15, 0.15), vy: rnd(0.15, 0.35), vz: rnd(-0.15, 0.15), life: rnd(0.9, 1.5), size: [0.2, 0.9 * strength], color: [0.78, 0.64, 0.45], color2: [0.86, 0.75, 0.6], alpha: [0.32 * strength, 0], drag: 1.2 });
  }

  weld(x, y, z) {
    for (let k = 0; k < 3; k++) this.glow.emit({ x, y, z, vx: rnd(-1.2, 1.2), vy: rnd(0.2, 1.4), vz: rnd(-1.2, 1.2), life: rnd(0.12, 0.28), size: [0.05, 0.02], color: [5, 6, 8], alpha: [1, 0], gravity: 7 });
  }

  /** The sonic wave's front: a pale shimmer across its path, drifting on. */
  sonic(x, y, z, dir) {
    const sx = -Math.sin(dir), sz = Math.cos(dir);
    for (let k = -2; k <= 2; k++) this.glow.emit({ x: x + sx * k * 0.16, y: y + rnd(-0.05, 0.05), z: z + sz * k * 0.16, vx: Math.cos(dir) * 0.6, vz: Math.sin(dir) * 0.6, life: 0.3, size: [0.22, 0.55], color: [0.7, 0.95, 1.5], alpha: [0.45, 0] });
  }

  /** Deviator gas bursting: a green cloud that lingers. */
  gasCloud(x, y, z) {
    for (let k = 0; k < 16; k++) this.smoke.emit({ x: x + rnd(-0.3, 0.3), y, z: z + rnd(-0.3, 0.3), vx: rnd(-0.7, 0.7), vy: rnd(0.1, 0.4), vz: rnd(-0.7, 0.7), life: rnd(1.6, 2.6), size: [0.4, 1.6], color: [0.33, 0.8, 0.2], color2: [0.55, 0.72, 0.4], alpha: [0.6, 0], drag: 1.2 });
  }

  /** Where the Death Hand comes down: a ring of dust racing outward and a white-hot flash. */
  shockwave(x, y, z) {
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      this.smoke.emit({ x, y, z, vx: Math.cos(a) * 7, vy: 0.2, vz: Math.sin(a) * 7, life: 0.9, size: [0.4, 1.4], color: [0.8, 0.66, 0.46], alpha: [0.55, 0], drag: 2.5 });
    }
    this.glow.emit({ x, y: y + 0.3, z, life: 0.35, size: [2, 6], color: [8, 5, 2.5], alpha: [1, 0] });
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
}
