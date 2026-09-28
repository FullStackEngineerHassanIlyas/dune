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
