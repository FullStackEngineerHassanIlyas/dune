// Procedural modelling kit (spec §5.3): primitives with a transform and a flat vertex colour,
// merged per node and material by ModelBuilder into ModelDefs that InstancedModel draws.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const MAT = { PAINT: 'paint', HOUSE: 'house', METAL: 'metal', DARK: 'dark', TREAD: 'tread', GLASS: 'glass', LIGHT: 'light', HOUSE_LIGHT: 'houseLight' };

const KEEP = new Set(['position', 'normal', 'uv', 'color']);
const UNLIT = new Set([MAT.LIGHT, MAT.HOUSE_LIGHT]);
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

/** Move an already shaped geometry (or a list of them) by a further transform: builds pieces in local space, then places them. */
export function place(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  euler.set(r[0], r[1], r[2]);
  m4.compose(pv.set(p[0], p[1], p[2]), quat.setFromEuler(euler), sv.set(s[0], s[1], s[2]));
  for (const g of Array.isArray(geo) ? geo : [geo]) g.applyMatrix4(m4);
  return geo;
}

export const box = (w, h, d, o) => shape(new THREE.BoxGeometry(w, h, d), o);
export const rbox = (w, h, d, radius, o) => shape(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2) * 0.99), o);
export const cyl = (rTop, rBottom, h, seg, o) => shape(new THREE.CylinderGeometry(rTop, rBottom, h, seg), o);
export const sphere = (r, seg, o) => shape(new THREE.SphereGeometry(r, seg, Math.max(3, Math.ceil(seg / 2))), o);
export const dome = (r, seg, o) => shape(new THREE.SphereGeometry(r, seg, Math.max(2, Math.ceil(seg / 4)), 0, Math.PI * 2, 0, Math.PI / 2), o);
export const cone = (r, h, seg, o) => shape(new THREE.ConeGeometry(r, h, seg), o);
export const torus = (r, tube, radial, tubular, o, arc = Math.PI * 2) => shape(new THREE.TorusGeometry(r, tube, radial, tubular, arc), o);
export const lathe = (points, seg, o) => shape(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg), o);

/** Flat-shaded convex hull of [x, y, z] points: armour plates, wedges, sloped hulls and turrets. */
export const hull = (points, o) => shape(new ConvexGeometry(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), o);

/**
 * Geodesic dome of radius r standing on y = 0: the upper half of a subdivided icosahedron turned to put
 * a vertex at the crown, as a flat-faceted hull (the sprite's facet lines and dithered panels).
 */
export function geodesic(r, detail, o) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, (1 + Math.sqrt(5)) / 2, 0).normalize(), new THREE.Vector3(0, 1, 0)));
  const pos = g.attributes.position, seen = new Set(), pts = [];
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)], key = p.map((v) => v.toFixed(4)).join();
    if (p[1] > 0.04 * r && !seen.has(key)) { seen.add(key); pts.push(p); }
  }
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; pts.push([Math.cos(a) * r, 0, Math.sin(a) * r]); }
  const geo = hull(pts, o), c = geo.attributes.color, p = geo.attributes.position;
  for (let i = 0; i < c.count; i += 3) {   // each facet a shade lighter or darker, like the sprite's dithered panels
    const h = Math.sin((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) * 91.7 + (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) * 47.3) * 43758.5;
    const k = 0.88 + 0.14 * (h - Math.floor(h));
    for (let j = i; j < i + 3; j++) c.setXYZ(j, c.getX(j) * k, c.getY(j) * k, c.getZ(j) * k);
  }
  return geo;
}

/** Box with every edge chamfered by `c`: crisp machined edges that catch the light (rbox reads as soft plastic). */
export function cbox(w, h, d, c, o) {
  c = Math.min(c, w / 2, h / 2, d / 2) * 0.99;
  if (c <= 0.0005) return box(w, h, d, o);
  const pts = [], x = w / 2, y = h / 2, z = d / 2;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push([sx * (x - c), sy * y, sz * z], [sx * x, sy * (y - c), sz * z], [sx * x, sy * y, sz * (z - c)]);
  }
  return hull(pts, o);
}

/** A box whose top is smaller than its base (w×d at the bottom, tw×td at the top, shifted by dx/dz), standing on y = 0. */
export function frustum(w, d, tw, td, h, o = {}, { dx = 0, dz = 0 } = {}) {
  const pts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push([sx * w / 2, 0, sz * d / 2], [dx + sx * tw / 2, h, dz + sz * td / 2]);
  return hull(pts, o);
}

/** A flat washer / collar standing on y = 0: outer radius r, inner radius ri, height h. */
export const ring = (r, ri, h, seg, o) => lathe([[ri, 0], [r, 0], [r, h], [ri, h], [ri, 0]], seg, o);

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

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

/** Rest-pose matrix of every node, parents before children (instancer.nodeMatricesAtRest without the import cycle). */
function restMatrices(nodes) {
  const out = {}, local = new THREE.Matrix4(), t = new THREE.Matrix4();
  for (const [name, n] of Object.entries(nodes)) {
    if (!n.parent) { out[name] = new THREE.Matrix4(); continue; }
    local.makeTranslation(n.pivot[0], n.pivot[1], n.pivot[2]);
    if (n.kind === 'rot') local.multiply(t.makeRotationAxis(AXES[n.axis], n.value));
    else if (n.kind === 'trans') { const a = AXES[n.axis]; local.multiply(t.makeTranslation(a.x * n.value, a.y * n.value, a.z * n.value)); }
    else if (n.kind === 'scale') local.multiply(t.makeScale(n.value || 1, n.value || 1, n.value || 1));
    out[name] = new THREE.Matrix4().multiplyMatrices(out[n.parent], local);
  }
  return out;
}

/**
 * Contact shading baked into the vertex colours: side faces darken towards the ground (y = 0 in the
 * model's rest pose) over `height`, as ambient occlusion would; faces looking up stay lit.
 */
function bakeGroundShade(geometry, matrix, height, strength) {
  const pos = geometry.attributes.position, nrm = geometry.attributes.normal, colors = geometry.attributes.color;
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(matrix);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
    const t = Math.min(1, Math.max(0, v.y / height));
    const near = 1 - t * t * (3 - 2 * t);
    const k = 1 - strength * near * (1 - Math.max(0, n.y));
    colors.setXYZ(i, colors.getX(i) * k, colors.getY(i) * k, colors.getZ(i) * k);
  }
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
    const bucket = this.buckets.get(key);
    for (const g of Array.isArray(geometry) ? geometry : [geometry]) bucket.geos.push(g);
    return this;
  }

  /** `shade` sets the contact shading: { height, strength } (default 0.14 and 0.42), or false for aircraft. */
  build({ shade = {}, ...extra } = {}) {
    const parts = [];
    const rest = shade ? restMatrices(this.nodes) : null;
    for (const { node, material, geos } of this.buckets.values()) {
      const geometry = mergeGeometries(geos, false);
      if (!geometry) throw new Error(`${this.name}: could not merge ${node}/${material}`);
      if (shade && !UNLIT.has(material)) bakeGroundShade(geometry, rest[node], shade.height ?? 0.14, shade.strength ?? 0.42);
      geometry.computeBoundingSphere();
      parts.push({ node, material, geometry });
    }
    return { name: this.name, nodes: this.nodes, parts, ...extra };
  }
}
