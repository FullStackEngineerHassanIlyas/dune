// Pure radar picture (spec §4.9, §5.6): one RGBA pixel per tile — black where unexplored, terrain
// colours where explored, house colours for own units and structures, enemy units in current sight
// and enemy structures once seen. Units are drawn lighter than structures.
import { HOUSES } from '../data/houses.js';
import { SPICE_PER_TILE } from '../data/tuning.js';
import { unitVisibleTo, structureVisibleTo } from '../sim/fog.js';

export const RADAR_GROUND = [[196, 154, 96], [214, 172, 112], [124, 106, 88], [78, 66, 56]];   // sand, dune, rock, mountain
export const RADAR_SPICE = [214, 110, 52];
export const RADAR_THICK_SPICE = [170, 66, 34];
export const RADAR_CONCRETE = [158, 154, 144];

const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const STRUCTURE_RGB = Object.fromEntries(Object.entries(HOUSES).map(([id, h]) => [id, rgb(h.color)]));
const UNIT_RGB = Object.fromEntries(Object.entries(STRUCTURE_RGB).map(([id, c]) => [id, c.map((v) => Math.round(v + (255 - v) * 0.4))]));

export function radarImage(world, houseId, out = new Uint8ClampedArray(world.map.w * world.map.h * 4)) {
  const map = world.map, n = map.w * map.h;
  const fog = world.fogOfWar ? world.houses.get(houseId)?.fog : null;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    out[o + 3] = 255;
    if (fog && !fog.explored[i]) { out[o] = out[o + 1] = out[o + 2] = 0; continue; }
    const c = map.concrete[i] ? RADAR_CONCRETE : map.spice[i] > SPICE_PER_TILE ? RADAR_THICK_SPICE : map.spice[i] > 0 ? RADAR_SPICE : RADAR_GROUND[map.ground[i]];
    out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2];
  }
  const put = (x, y, c) => { const o = (y * map.w + x) * 4; out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; };
  for (const s of world.structures.values()) {
    if (!structureVisibleTo(world, houseId, s)) continue;
    const c = STRUCTURE_RGB[s.house] ?? [255, 255, 255];
    for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) put(s.x + dx, s.y + dy, c);
  }
  for (const u of world.units.values()) {
    if (!map.inBounds(u.tx, u.ty) || !unitVisibleTo(world, houseId, u)) continue;
    put(u.tx, u.ty, UNIT_RGB[u.house] ?? [255, 255, 255]);
  }
  return out;
}
