// Concrete slabs (1x1 and 2x2), after the Genesis tile: each tile is a flat dark olive plate whose
// bevel is lit khaki on the north and west edges and shaded near-black on the south and east, so a
// 2x2 slab shows the seams between its four tiles. Placed slabs are drawn by the terrain shader; these
// models give the sidebar its icons.
import { ModelBuilder, MAT, box, hull } from '../kit.js';
import { PAL } from '../palette.js';

const LIT = 0xb5b594, SHADE = 0x262610;

/** One tile centred on (x, z): dark footing, four mitred bevel strips and the olive face. */
function tile(b, x, z, s = 0.98, h = 0.03, c = 0.07) {
  const e = s / 2, i = e - c;
  b.add(MAT.PAINT, box(s, 0.06, s, { p: [x, -0.03, z], color: PAL.slabSeam }));
  const strip = (o0, o1, i0, i1, color) => hull([
    [x + o0[0], 0, z + o0[1]], [x + o1[0], 0, z + o1[1]], [x + i0[0], 0, z + i0[1]], [x + i1[0], 0, z + i1[1]],
    [x + i0[0], h, z + i0[1]], [x + i1[0], h, z + i1[1]],
  ], { color });
  b.add(MAT.PAINT, strip([-e, -e], [e, -e], [-i, -i], [i, -i], LIT));
  b.add(MAT.PAINT, strip([-e, -e], [-e, e], [-i, -i], [-i, i], LIT));
  b.add(MAT.PAINT, strip([-e, e], [e, e], [-i, i], [i, i], SHADE));
  b.add(MAT.PAINT, strip([e, -e], [e, e], [i, -i], [i, i], SHADE));
  b.add(MAT.PAINT, box(2 * i, h, 2 * i, { p: [x, h / 2, z], color: PAL.slab }));
}

export const concreteSlab = (size) => () => {
  const b = new ModelBuilder(`concrete${size}`);
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) tile(b, i - (size - 1) / 2, j - (size - 1) / 2);
  return b.build({ radius: size / 2, shade: false });
};
