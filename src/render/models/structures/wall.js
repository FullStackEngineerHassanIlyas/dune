// Wall pieces (auto-joining), after the Genesis sprites: every wall tile is an olive concrete plate under
// a khaki rampart half a tile wide, its top edges bevelled into a pale lip round a flat band, crowned by
// a hipped ridge with pale slopes and a flat khaki walk (0.36 up) that Saboteurs cross on; a dark string
// course runs round the sides and a panel joint marks each tile edge. The post is the tile's own square
// block with a pyramid cap; an arm carries rampart and ridge on to the tile edge toward each walled
// neighbour (the views add and turn the arms), so posts and arms merge into straights, corners, tees and
// crosses: the post's pyramid hides inside the arms' ridges and each arm fills the post's lip bevel on
// its side, so no two instances share a face.
import * as THREE from 'three';
import { ModelBuilder, MAT, box, hull, frustum } from '../kit.js';
import { foundation, FOUNDATION_TOP as T } from '../detail.js';

const W = 0.25, LIP = 0.235, C = 0.03, RB = 0.165, RT = 0.0625, TOP = 0.36, E = 0.004, BAND = LIP - C - 0.04;
const SIDE = 0x8c8c6c, KHAKI = 0x9c9c7a, PALE = 0xc6c6a8, JOINT = 0x3a3a24;

/** Paint a flat-shaded piece: faces looking straight up get `top`, the rest (bevels, slopes) `slope`. */
const paint = (geo, top, slope) => {
  const n = geo.attributes.normal, c = geo.attributes.color, a = new THREE.Color(top), s = new THREE.Color(slope);
  for (let i = 0; i < n.count; i++) { const k = n.getY(i) > 0.98 ? a : s; c.setXYZ(i, k.r, k.g, k.b); }
  return geo;
};

export function wallPost() {
  const b = new ModelBuilder('wallPost');
  foundation(b, 1, 1);
  b.add(MAT.PAINT, box(2 * W, LIP - C - T + 0.01, 2 * W, { p: [0, (LIP - C + T - 0.01) / 2, 0], color: SIDE }));
  b.add(MAT.PAINT, paint(frustum(2 * W, 2 * W, 2 * (W - C), 2 * (W - C), C, { p: [0, LIP - C, 0] }), KHAKI, PALE));
  b.add(MAT.PAINT, paint(frustum(2 * (RB - E), 2 * (RB - E), 2 * (RT - E), 2 * (RT - E), TOP - LIP - E, { p: [0, LIP, 0] }), KHAKI, PALE));
  b.add(MAT.DARK, [box(2 * W + 0.006, 0.014, 2 * W + 0.006, { p: [0, BAND, 0], color: JOINT })]);
  return b.build({ radius: 0.72 });
}

export function wallArm() {
  const b = new ModelBuilder('wallArm');
  const x1 = 0.5, along = (x0, pts) => [x0, x1].flatMap((x) => pts.map(([y, z]) => [x, y, z]));
  b.add(MAT.PAINT, box(x1 - W, LIP - C - T + 0.01, 2 * W, { p: [(W + x1) / 2, (LIP - C + T - 0.01) / 2, 0], color: SIDE }));
  b.add(MAT.PAINT, paint(hull(along(W, [[LIP - C, -W], [LIP - C, W], [LIP, -(W - C)], [LIP, W - C]])), KHAKI, PALE));
  b.add(MAT.PAINT, paint(hull([[W, LIP - C, -W], [W, LIP - C, W], [W - C, LIP, -(W - C)], [W - C, LIP, W - C], [W, LIP, -(W - C)], [W, LIP, W - C]]), KHAKI, PALE));
  b.add(MAT.PAINT, paint(hull(along(0, [[LIP, -RB], [LIP, RB], [TOP, -RT], [TOP, RT]])), KHAKI, PALE));
  b.add(MAT.DARK, [box(x1 - W - 0.003, 0.014, 2 * W + 0.006, { p: [(W + 0.003 + x1) / 2, BAND, 0], color: JOINT }),
    box(0.012, LIP - C - T, 2 * W + 0.004, { p: [x1 - 0.006, (LIP - C + T) / 2, 0], color: JOINT }),
    ...[-1, 1].map((s) => box(0.006, 0.002, W - C - RB, { p: [x1 - 0.003, LIP + 0.001, s * (W - C + RB) / 2], color: JOINT })),
    box(0.006, 0.002, 2 * RT, { p: [x1 - 0.003, TOP + 0.001, 0], color: JOINT })]);
  return b.build({ radius: 0.5 });
}
