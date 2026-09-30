// Sandworm, after the Genesis sprite: only the head breaking the sand. A churned sand collar with
// thrown-up clods rings a thick ridged neck of brown flesh that leans toward +x; on top, a fleshy lip
// holds three glossy blue-black jaw lobes peeled open like the sprite's three-part maw, and inside
// them two rings of pale crystal teeth point down into the black throat. Sits on y = 0.
import * as THREE from 'three';
import { ModelBuilder, MAT, shape, cyl, cone, torus, lathe, hull, place } from '../kit.js';

const SAND = 0x9c7c4a, SAND_DARK = 0x6e5230, FLESH = 0x86643a, FLESH_DARK = 0x60441e, GROOVE = 0x3a2408;
const MAW = 0x262640, SHEEN = 0x8080a0, TOOTH = 0xe4dcc8, THROAT = 0x0a0610;
const LEAN = 0.3, K = Math.tan(LEAN), TOP = 0.44;
const UP = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), e = new THREE.Euler();

/** A pointed jaw plate lying along +x from its root: broad at the rim, curved over its back, tapering to a tip. */
function jaw(len, half, thick) {
  const pts = [];
  for (const [u, w] of [[0, 1], [0.35, 0.92], [0.7, 0.55], [1, 0.08]]) {
    const x = u * len, z = half * w, t = thick * (1 - u * 0.6);
    pts.push([x, 0, -z], [x, 0, z], [x, t * 0.55, -z * 0.8], [x, t * 0.55, z * 0.8], [x, t, -z * 0.35], [x, t, z * 0.35]);
  }
  return pts;
}

/** Churn a sand ring: wobble its radius and height round the circle, then facet it. */
function churn(geo, cx) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) - cx, z = p.getZ(i), a = Math.atan2(z, x), y = p.getY(i);
    const k = 1 + 0.05 * Math.sin(3 * a + 1) + 0.03 * Math.sin(7 * a + 2);
    p.setXYZ(i, cx + x * k, y * (1 + 0.3 * Math.sin(5 * a + 0.5) + 0.15 * Math.sin(11 * a)), z * k);
  }
  geo.deleteAttribute('normal');
  geo.computeVertexNormals();
  return geo;
}

/** Euler angles that turn +y onto `dir`. */
const aim = (dir) => { e.setFromQuaternion(q.setFromUnitVectors(UP, new THREE.Vector3(...dir).normalize())); return [e.x, e.y, e.z]; };

export function sandworm() {
  const b = new ModelBuilder('sandworm');

  // sand collar and clods
  b.add(MAT.PAINT, churn(lathe([[0.85, 0], [0.82, 0.03], [0.78, 0.05], [0.73, 0.13], [0.66, 0.22]], 30, { p: [0.04, 0, 0], color: SAND }), 0.04));
  b.add(MAT.PAINT, churn(lathe([[0.66, 0.22], [0.6, 0.2], [0.52, 0.11], [0.46, 0.03]], 30, { p: [0.04, 0, 0], color: SAND_DARK }), 0.04));
  const clods = [[150, 0.7, 0.09], [172, 0.63, 0.075], [200, 0.72, 0.08], [228, 0.66, 0.085], [110, 0.74, 0.065], [300, 0.7, 0.075], [62, 0.76, 0.06], [22, 0.82, 0.055], [340, 0.78, 0.05], [262, 0.79, 0.065], [88, 0.66, 0.055], [128, 0.84, 0.045], [322, 0.65, 0.06], [40, 0.68, 0.05], [245, 0.86, 0.04]];
  for (const [deg, r, s] of clods) {
    const a = (deg * Math.PI) / 180;
    b.add(MAT.PAINT, shape(new THREE.IcosahedronGeometry(s, 0), { p: [0.04 + Math.cos(a) * r, 0.21 - Math.abs(r - 0.66) * 0.8 + s * 0.3, Math.sin(a) * r], s: [1.3, 0.7, 1], r: [deg * 0.05, a, deg * 0.03], color: deg % 40 < 20 ? SAND_DARK : SAND }));
  }

  // neck: ridged flesh leaning forward (sheared so every ring stays level), dark grooves
  const shear = new THREE.Matrix4().makeShear(0, 0, K, 0, 0, 0);
  const neck = lathe([[0.54, 0], [0.56, 0.05], [0.52, 0.11], [0.55, 0.18], [0.51, 0.25], [0.53, 0.31], [0.51, 0.36]], 28, { color: FLESH });
  b.add(MAT.PAINT, neck.applyMatrix4(shear));
  for (const y of [0.11, 0.25]) b.add(MAT.DARK, torus(0.515 - y * 0.03, 0.016, 4, 28, { p: [K * y, y, 0], r: [Math.PI / 2, 0, 0], color: GROOVE }));

  // the mouth, tilted to face up and forward: lip, three glossy lobes, rings of teeth, throat
  const mouth = [];
  const M = (mat, geo) => mouth.push([mat, geo]);
  M(MAT.PAINT, lathe([[0.53, -0.3], [0.51, -0.16], [0.53, -0.1], [0.49, 0]], 28, { color: FLESH }));
  M(MAT.DARK, torus(0.52, 0.014, 4, 28, { p: [0, -0.1, 0], r: [Math.PI / 2, 0, 0], color: GROOVE }));
  M(MAT.PAINT, torus(0.46, 0.075, 6, 28, { r: [Math.PI / 2, 0, 0], color: FLESH_DARK }));
  M(MAT.PAINT, torus(0.4, 0.035, 4, 28, { p: [0, 0.02, 0], r: [Math.PI / 2, 0, 0], color: FLESH }));
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3 + Math.PI / 3;
    const lobe = [hull(jaw(0.46, 0.34, 0.11), { color: MAW }), hull(jaw(0.4, 0.06, 0.13).map(([x, y, z]) => [x + 0.02, y, z]), { color: SHEEN })];
    place(lobe, { r: [0, 0, 0.9] });
    place(lobe, { p: [0.34, -0.02, 0] });
    place(lobe, { r: [0, -a, 0] });
    for (const g of lobe) M(MAT.METAL, g);
  }
  for (const [n, r, y, len, rad, tilt, off] of [[14, 0.38, 0.03, 0.13, 0.034, 0.9, 0], [10, 0.26, -0.02, 0.1, 0.027, 1.1, 0.5]]) {
    for (let k = 0; k < n; k++) {
      const a = ((k + off) / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      M(MAT.PAINT, cone(rad, len, 6, { p: [c * (r - len * 0.3), y, s * (r - len * 0.3)], r: aim([-c, -tilt, -s]), color: TOOTH }));
    }
  }
  M(MAT.DARK, cyl(0.43, 0.43, 0.02, 24, { p: [0, -0.07, 0], color: 0x1c1426 }));
  M(MAT.DARK, cyl(0.2, 0.2, 0.02, 16, { p: [0, -0.058, 0], color: THROAT }));
  for (const [mat, geo] of mouth) b.add(mat, place(geo, { p: [K * TOP, TOP, 0], r: [0, 0, -LEAN] }));

  return b.build({ radius: 0.9 });
}
