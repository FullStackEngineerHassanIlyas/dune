import { GameMap } from '../src/sim/map.js';
import { World } from '../src/sim/world.js';
import { G } from '../src/data/terrain.js';

export function flatWorld(w = 24, h = 24, ground = G.ROCK, seed = 1) {
  const map = new GameMap(w, h);
  map.ground.fill(ground);
  const world = new World({ map, seed });
  world.addHouse('atreides');
  world.addHouse('harkonnen');
  world.addHouse('ordos');
  return world;
}

export function run(world, seconds) {
  for (let i = 0, n = Math.round(seconds * 20); i < n; i++) world.step();
}

/** Steps until pred() holds; returns the elapsed seconds, or -1 if it never did. */
export function runUntil(world, pred, maxSeconds) {
  for (let i = 0; i <= maxSeconds * 20; i++) {
    if (pred()) return i / 20;
    world.step();
  }
  return -1;
}
