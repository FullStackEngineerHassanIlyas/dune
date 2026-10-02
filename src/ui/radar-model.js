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
// Radar paint for the skirmish houses, [structures, units]: buildings in the house colour, units lighter. The
// Sardaukar purple is pushed off the Atreides blue and the units brightened clear of the sand and spice they
// cross, so up to four houses stay apart on a pixel per tile (tests/radar-model.test.mjs measures it).
const RADAR_HOUSE = {
  atreides: [[47, 111, 224], [120, 170, 255]],
  harkonnen: [[200, 38, 30], [255, 60, 50]],
  ordos: [[46, 158, 62], [100, 225, 100]],
  sardaukar: [[150, 60, 210], [205, 125, 255]],
  mercenary: [[225, 200, 20], [255, 245, 90]],
};
/** A house's radar colours, [structure, unit]; houses without their own get the house colour and a lighter one. */
export function radarColours(houseId) {
  if (RADAR_HOUSE[houseId]) return RADAR_HOUSE[houseId];
  const c = rgb(HOUSES[houseId]?.color ?? 0xffffff);
  return [c, c.map((v) => Math.round(v + (255 - v) * 0.4))];
}
const STRUCTURE_RGB = Object.fromEntries(Object.keys(HOUSES).map((id) => [id, radarColours(id)[0]]));
const UNIT_RGB = Object.fromEntries(Object.keys(HOUSES).map((id) => [id, radarColours(id)[1]]));

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
