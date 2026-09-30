// Terrain mesh + apron + live data textures (spice, concrete, shroud) + decal map.
import * as THREE from 'three';
import { injectTerrainShader } from './terrain-shader.js';
import { rockDetailTexture } from './terrain-textures.js';

let rockTexture = null;   // shared by every TerrainView, so it outlives them

export function buildTerrainGeometry(hf) {
  const { vw, vh, sub } = hf;
  const n = vw * vh;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), ter = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const tmp = { x: 0, y: 1, z: 0 };
  for (let vy = 0; vy < vh; vy++) for (let vx = 0; vx < vw; vx++) {
    const k = vy * vw + vx, x = vx / sub, z = vy / sub;
    pos[k * 3] = x; pos[k * 3 + 1] = hf.data[k]; pos[k * 3 + 2] = z;
    hf.normalAt(x, z, tmp);
    nor[k * 3] = tmp.x; nor[k * 3 + 1] = tmp.y; nor[k * 3 + 2] = tmp.z;
    ter[k * 3] = hf.rock[k]; ter[k * 3 + 1] = hf.mountain[k]; ter[k * 3 + 2] = hf.dune[k];
    uv[k * 2] = x / hf.map.w; uv[k * 2 + 1] = z / hf.map.h;
  }
  const index = new Uint32Array((vw - 1) * (vh - 1) * 6);
  let p = 0;
  for (let vy = 0; vy < vh - 1; vy++) for (let vx = 0; vx < vw - 1; vx++) {
    const a = vy * vw + vx, b = a + 1, c = a + vw, d = c + 1;
    index[p++] = a; index[p++] = c; index[p++] = b;
    index[p++] = b; index[p++] = c; index[p++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aTerrain', new THREE.BufferAttribute(ter, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

// Flat desert around the playable map: a ring of four quads at y = 0 (the terrain fades to 0 at its
// border), so it can never show through dips inside the map.
function apronGeometry(w, h, margin = 250) {
  const X0 = -margin, X1 = w + margin, Z0 = -margin, Z1 = h + margin;
  const quads = [[X0, Z0, X1, 0], [X0, h, X1, Z1], [X0, 0, 0, h], [w, 0, X1, h]];
  const pos = [];
  for (const [ax, az, bx, bz] of quads) pos.push(ax, 0, az, ax, 0, bz, bx, 0, az, bx, 0, az, ax, 0, bz, bx, 0, bz);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const n = pos.length / 3;
  g.setAttribute('aTerrain', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

/** Rewrite heights and normals of the vertices inside a tile rectangle after the heightfield changed. */
export function updateTerrainGeometry(geometry, hf, x0, y0, w, h) {
  const pos = geometry.attributes.position, nor = geometry.attributes.normal, s = hf.sub, tmp = { x: 0, y: 1, z: 0 };
  const vx0 = Math.max(0, x0 * s), vy0 = Math.max(0, y0 * s), vx1 = Math.min(hf.vw - 1, (x0 + w) * s), vy1 = Math.min(hf.vh - 1, (y0 + h) * s);
  for (let vy = vy0; vy <= vy1; vy++) for (let vx = vx0; vx <= vx1; vx++) {
    const k = vy * hf.vw + vx;
    pos.setY(k, hf.data[k]);
    hf.normalAt(vx / s, vy / s, tmp);
    nor.setXYZ(k, tmp.x, tmp.y, tmp.z);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
}

function dataTexture(w, h, channels, fill = 0) {
  const data = new Uint8Array(w * h * channels).fill(fill);
  const t = new THREE.DataTexture(data, w, h, channels === 1 ? THREE.RedFormat : THREE.RGFormat, THREE.UnsignedByteType);
  t.unpackAlignment = 1;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// The apron's albedo and brightness against the map's: a game marks the ground past the edge as out of play; the
// menu's battle wants one unbroken desert (plainApron).
const APRON_DIM = [0.8, 0.62], APRON_PLAIN = [1, 1];

export class TerrainView {
  constructor(map, hf, { plainApron = false } = {}) {
    this.map = map;
    this.hf = hf;
    this.spiceTex = dataTexture(map.w, map.h, 1);
    this.concreteTex = dataTexture(map.w, map.h, 1);
    this.concreteTex.magFilter = this.concreteTex.minFilter = THREE.NearestFilter;
    this.shroudTex = dataTexture(map.w, map.h, 2, 255);
    const { DecalMap } = DECALS;
    this.decals = new DecalMap(map.w, map.h);
    this.uniforms = {
      uSpice: { value: this.spiceTex }, uConcrete: { value: this.concreteTex }, uShroud: { value: this.shroudTex },
      uDecals: { value: this.decals.texture }, uRockTex: { value: (rockTexture ??= rockDetailTexture()) }, uMapSize: { value: new THREE.Vector2(map.w, map.h) }, uTime: { value: 0 },
      uApron: { value: new THREE.Vector2(...(plainApron ? APRON_PLAIN : APRON_DIM)) },
    };
    const material = injectTerrainShader(new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }), this.uniforms);
    this.mesh = new THREE.Mesh(buildTerrainGeometry(hf), material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    const apronGeo = apronGeometry(map.w, map.h);
    const apronMat = injectTerrainShader(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }), this.uniforms, { apron: true });
    this.apron = new THREE.Mesh(apronGeo, apronMat);
    this.apron.receiveShadow = true;
    this.group = new THREE.Group();
    this.group.add(this.mesh, this.apron);
    this.spiceRev = -1;
    this.concreteRev = -1;
    this.update(0);
  }

  update(now) {
    const m = this.map;
    if (m.spiceRevision !== this.spiceRev) {
      this.spiceRev = m.spiceRevision;
      const a = this.spiceTex.image.data;
      for (let i = 0; i < m.spice.length; i++) a[i] = m.spice[i] ? Math.min(255, 90 + Math.round((m.spice[i] / 750) * 165)) : 0;
      this.spiceTex.needsUpdate = true;
    }
    if (m.concreteRevision !== this.concreteRev) {
      this.concreteRev = m.concreteRevision;
      const a = this.concreteTex.image.data;
      for (let i = 0; i < m.concrete.length; i++) a[i] = m.concrete[i] ? 255 : 0;
      this.concreteTex.needsUpdate = true;
    }
    this.uniforms.uTime.value = now / 1000;
    this.decals.flush(now);
  }

  /** Level the ground under a new structure so it neither floats nor sinks. Returns the floor height. */
  flattenFootprint(x, y, w, h) {
    const floor = this.hf.flatten(x, y, w, h);
    updateTerrainGeometry(this.mesh.geometry, this.hf, x - 1, y - 1, w + 2, h + 2);
    return floor;
  }

  /** explored/visible: one byte per tile (0 or 255). */
  setShroud(explored, visible) {
    const a = this.shroudTex.image.data;
    for (let i = 0; i < explored.length; i++) { a[i * 2] = explored[i]; a[i * 2 + 1] = visible[i]; }
    this.shroudTex.needsUpdate = true;
  }

  /** Takes the ground off the scene and frees its geometry, materials and textures. */
  dispose() {
    this.group.removeFromParent();
    for (const mesh of [this.mesh, this.apron]) { mesh.geometry.dispose(); mesh.material.dispose(); }
    for (const t of [this.spiceTex, this.concreteTex, this.shroudTex, this.decals.texture]) t?.dispose();
    if (this.decals.canvas) this.decals.canvas.width = 0;   // drop the 2D backing store now, not at GC
  }
}

// DecalMap needs a DOM canvas; it is loaded lazily so buildTerrainGeometry stays testable under Node.
const DECALS = typeof document !== 'undefined' ? await import('./decals.js') : { DecalMap: class { constructor() { this.texture = null; } flush() {} } };
