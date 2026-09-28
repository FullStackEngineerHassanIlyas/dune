// Procedural modelling kit (spec §5.3): primitives with a transform and a flat vertex colour,
// merged per node and material by ModelBuilder into ModelDefs that InstancedModel draws.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const MAT = { PAINT: 'paint', HOUSE: 'house', METAL: 'metal', DARK: 'dark', TREAD: 'tread', GLASS: 'glass', LIGHT: 'light', HOUSE_LIGHT: 'houseLight' };

const KEEP = new Set(['position', 'normal', 'uv', 'color']);
const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler();
const sv = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();

/** Normalise any geometry for merging: non-indexed, position/normal/uv/color only, transformed. */
export function shape(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], color = 0xffffff, glow = 1 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) if (!KEEP.has(name)) g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  euler.set(r[0], r[1], r[2]);
  g.applyMatrix4(m4.compose(pv.set(p[0], p[1], p[2]), quat.setFromEuler(euler), sv.set(s[0], s[1], s[2])));
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  col.set(color);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colors[i * 3] = col.r * glow; colors[i * 3 + 1] = col.g * glow; colors[i * 3 + 2] = col.b * glow; }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export const box = (w, h, d, o) => shape(new THREE.BoxGeometry(w, h, d), o);
export const rbox = (w, h, d, radius, o) => shape(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2) * 0.99), o);
export const cyl = (rTop, rBottom, h, seg, o) => shape(new THREE.CylinderGeometry(rTop, rBottom, h, seg), o);
export const sphere = (r, seg, o) => shape(new THREE.SphereGeometry(r, seg, Math.max(3, Math.ceil(seg / 2))), o);
export const dome = (r, seg, o) => shape(new THREE.SphereGeometry(r, seg, Math.max(2, Math.ceil(seg / 4)), 0, Math.PI * 2, 0, Math.PI / 2), o);
export const cone = (r, h, seg, o) => shape(new THREE.ConeGeometry(r, h, seg), o);
export const torus = (r, tube, radial, tubular, o, arc = Math.PI * 2) => shape(new THREE.TorusGeometry(r, tube, radial, tubular, arc), o);
export const lathe = (points, seg, o) => shape(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg), o);

/** Extrude a 2D side profile (x forward, y up) across z by `depth`, centred on z = 0. */
export function prism(profile, depth, o = {}, bevel = 0) {
  const sh = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return shape(g, o);
}

export function tube(points, radius, radial = 6, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return shape(new THREE.TubeGeometry(curve, Math.max(4, points.length * 6), radius, radial, false), o);
}

export class ModelBuilder {
  constructor(name) {
    this.name = name;
    this.nodes = { root: { parent: null } };
    this.buckets = new Map();
  }

  /** kind 'rot' turns about `axis` by params[param]; 'trans' slides along it; 'scale' scales uniformly. */
  node(name, { parent = 'root', pivot = [0, 0, 0], axis = 'y', kind = 'rot', param = name, value = kind === 'scale' ? 1 : 0 } = {}) {
    if (!this.nodes[parent]) throw new Error(`${this.name}: declare parent ${parent} before ${name}`);
    this.nodes[name] = { parent, pivot, axis, kind, param, value };
    return this;
  }

  add(material, geometry, node = 'root') {
    if (!this.nodes[node]) throw new Error(`${this.name}: unknown node ${node}`);
    const key = `${node}|${material}`;
    if (!this.buckets.has(key)) this.buckets.set(key, { node, material, geos: [] });
    this.buckets.get(key).geos.push(geometry);
    return this;
  }

  build(extra = {}) {
    const parts = [];
    for (const { node, material, geos } of this.buckets.values()) {
      const geometry = mergeGeometries(geos, false);
      if (!geometry) throw new Error(`${this.name}: could not merge ${node}/${material}`);
      geometry.computeBoundingSphere();
      parts.push({ node, material, geometry });
    }
    return { name: this.name, nodes: this.nodes, parts, ...extra };
  }
}
