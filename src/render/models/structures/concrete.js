// Concrete slabs (1x1 and 2x2): flat plates with seams. Placed slabs are drawn by the terrain shader;
// these models give the sidebar its icons.
import { ModelBuilder } from '../kit.js';
import { slab } from './common.js';

export const concreteSlab = (size) => () => {
  const b = new ModelBuilder(`concrete${size}`);
  slab(b, size, size);
  return b.build({ radius: size / 2 });
};
