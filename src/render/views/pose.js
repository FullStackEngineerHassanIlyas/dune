// Root matrix for a model facing `heading` (0 = +x east, π/2 = +z south) standing on `normal`.
import * as THREE from 'three';

const f = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3();

export function poseMatrix(out, x, y, z, heading, normal = null) {
  up.set(normal ? normal.x : 0, normal ? normal.y : 1, normal ? normal.z : 0);
  f.set(Math.cos(heading), 0, Math.sin(heading));
  f.addScaledVector(up, -f.dot(up)).normalize();
  side.crossVectors(f, up);   // right-handed basis: x = forward, y = up, z = forward × up
  out.makeBasis(f, up, side);
  out.setPosition(x, y, z);
  return out;
}
