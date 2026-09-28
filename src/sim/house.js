// A player or computer faction taking part in a game.
import { HOUSES } from '../data/houses.js';
import { createLines } from './production.js';

export class House {
  constructor(id, slot, { credits = 0, ai = false, techLevel = 9 } = {}) {
    if (!HOUSES[id]) throw new Error(`unknown house ${id}`);
    this.id = id;
    this.slot = slot;
    this.info = HOUSES[id];
    this.credits = credits;
    this.startBuffer = credits;          // starting credits count as storage until built storage exceeds them
    this.power = { produced: 0, used: 0, ratio: 1 };
    this.lines = createLines();
    this.isAI = ai;
    this.techLevel = techLevel;
    this.stats = { spiceHarvested: 0, unitsKilled: 0, unitsLost: 0, structuresKilled: 0, structuresLost: 0 };
  }
}
