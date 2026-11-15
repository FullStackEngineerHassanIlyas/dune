// Screen ↔ ground conversions. screenToGround ray-marches the heightfield and returns null when the
// ray never meets the ground (sky, horizon), so callers can simply ignore such clicks.
import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const v = new THREE.Vector3();

export function screenToGround(camera, ndcX, ndcY, heightAt, maxHeight = 3.5) {
  ndc.set(ndcX, ndcY);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  if (d.y > -1e-4) return null;
  const tStart = Math.max(0, (o.y - maxHeight) / -d.y);
  const tEnd = (o.y + 1) / -d.y;
  const step = 0.25;
  const above = (t) => o.y + d.y * t - heightAt(o.x + d.x * t, o.z + d.z * t) > 0;
  if (!above(tStart)) return null;
  for (let t = tStart + step; t <= tEnd + step; t += step) {
    if (!above(t)) {
      let a = t - step, b = t;
      for (let k = 0; k < 14; k++) { const m = (a + b) / 2; if (above(m)) a = m; else b = m; }
      const x = o.x + d.x * b, z = o.z + d.z * b;
      return { x, y: heightAt(x, z), z };
    }
  }
  return null;
}

/** Where the ray through an NDC point meets the plane y = h, or null at or above the horizon. */
export function screenToPlane(camera, ndcX, ndcY, h = 0) {
  ndc.set(ndcX, ndcY);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  if (d.y > -1e-4) return null;
  const t = (o.y - h) / -d.y;
  return { x: o.x + d.x * t, z: o.z + d.z * t };
}

const box = new THREE.Box3(), entry = new THREE.Vector3();

/**
 * The building whose body the ray through an NDC point meets first, or null: seen from above and the south, a
 * roof and a back wall stand in front of the ground behind the footprint, and a click on them means the building.
 * `structures` are { x, y, w, h } footprints, `topOf` and `baseOf` give a body's height and the ground it stands
 * on; `ground` is where the same ray meets the terrain, if it does (a body behind that point is hidden by it).
 * Returns { structure, tx, ty } with the tile of the footprint the ray comes in over.
 */
export function screenToStructure(camera, ndcX, ndcY, structures, topOf, baseOf, ground = null) {
  ndc.set(ndcX, ndcY);
  raycaster.setFromCamera(ndc, camera);
  const ray = raycaster.ray, o = ray.origin;
  let best = null, x = 0, z = 0;
  let nearest = ground ? (ground.x - o.x) ** 2 + (ground.y - o.y) ** 2 + (ground.z - o.z) ** 2 + 1e-6 : Infinity;
  for (const s of structures) {
    const y = baseOf(s);
    box.min.set(s.x, y, s.y);
    box.max.set(s.x + s.w, y + topOf(s), s.y + s.h);
    if (!ray.intersectBox(box, entry)) continue;
    const d = entry.distanceToSquared(o);
    if (d < nearest) { nearest = d; best = s; x = entry.x; z = entry.z; }
  }
  if (!best) return null;
  const tile = (v, from, n) => Math.max(from, Math.min(from + n - 1, Math.floor(v)));
  return { structure: best, tx: tile(x, best.x, best.w), ty: tile(z, best.y, best.h) };
}

export function worldToScreen(camera, x, y, z, width, height, out = {}) {
  v.set(x, y, z).project(camera);
  out.x = ((v.x + 1) / 2) * width;
  out.y = ((1 - v.y) / 2) * height;
  out.visible = v.z > -1 && v.z < 1;
  return out;
}

export function pixelsPerUnit(camera, x, y, z, height) {
  const dist = camera.position.distanceTo(v.set(x, y, z));
  return height / (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.max(dist, 0.001));
}
