// One campaign mission (spec §7; C1, C2): ?scene=mission&house=<house>&mission=<1-9>[&seed=] looks the mission up
// in src/data/campaign.js (missionDef; while that data is missing, our own sample mission stands in), sets it up
// (game/mission-setup.js) and plays it through the shared GameView with the camera on the player's base. Its
// objective line, menu words and end hand-off come with world.mission. Development flags: ticks= pre-steps the
// world, focus=<house> looks at that house's base instead, visibility=revealed lifts the shroud.
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { GameView } from '../game/game-view.js';
import { setupMission, sampleMission } from '../game/mission-setup.js';

export const CAMPAIGN = ['atreides', 'ordos', 'harkonnen'];

/** The def for a house's mission n: the campaign's own, else the sample (sample: true). */
export async function missionFor(house, n, load = () => import('../data/campaign.js')) {
  try {
    const def = (await load())?.missionDef?.(house, n);
    if (def) return { def, sample: false };
  } catch { /* the campaign data has not landed yet */ }
  return { def: sampleMission(house, n), sample: true };
}

/** Where the camera starts: the house's Construction Yard, else any building of it, else its first unit. */
export function baseFocus(world, house) {
  let any = null;
  for (const s of world.structures.values()) {
    if (s.house !== house || s.type.isWall) continue;
    if (s.typeId === 'constructionYard') return { x: s.x + s.w / 2, z: s.y + s.h / 2 + 2 };
    any ??= { x: s.x + s.w / 2, z: s.y + s.h / 2 + 2 };
  }
  if (any) return any;
  for (const u of world.units.values()) if (u.house === house) return { x: u.x, z: u.y + 2 };
  return { x: world.map.w / 2, z: world.map.h / 2 };
}

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const asked = params.str('house', 'atreides');
  const house = CAMPAIGN.includes(asked) ? asked : 'atreides';
  const n = Math.max(1, Math.min(9, Math.floor(params.num('mission', 1)) || 1));
  const { def, sample } = await missionFor(house, n);
  if (sample) console.info(`mission: no campaign data for ${house} ${n} yet; playing the sample mission`);
  const seed = params.num('seed', NaN);
  const { world, problems } = setupMission(def, { seed: Number.isFinite(seed) ? seed : null });
  if (problems.length) console.warn(`mission ${def.id}: ${problems.join('; ')}`);
  if (params.str('visibility') === 'revealed') { world.visibility = 'revealed'; world.fogOfWar = false; }
  for (let i = 0, t = params.num('ticks', 0); i < t; i++) world.step();
  const focus = baseFocus(world, world.houses.has(params.str('focus')) ? params.str('focus') : house);
  const view = new GameView({ world, house, settings, params, focus, scene: 'mission' });
  view.start();
  return view;
}
