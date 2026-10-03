// Every track of the soundtrack by id, and which of them each moment of the game draws from (spec §6 Music;
// research audio-ui-controls.md §A.2 and research.md §9, where each Sega cue plays): the opening cue and the title
// theme on the menu, the house selection, the region screen after a briefing, a peace pool shuffled while the player
// builds, a battle pool that takes over when fighting starts, each house's briefing, victory and defeat music, the
// finale of a won campaign and the credits. A track marked `once` (the opening, the region) plays one pass and never
// loops. All of it is original music written for this game.
import { opening } from './opening.js';
import { title } from './title.js';
import { houseSelect, region } from './menus.js';
import { erg, dawn, lanterns } from './peace.js';
import { assault, iron, shieldwall } from './battle.js';
import { atreides, harkonnen, ordos } from './houses.js';
import { victory, defeat } from './endings.js';
import { victoryAtreides, victoryHarkonnen, victoryOrdos, defeatAtreides, defeatHarkonnen, defeatOrdos } from './victories.js';
import { finale, credits } from './finale.js';
import { harvest, stormfront } from './ingame.js';

const ALL = [
  opening, title, houseSelect, region, atreides, harkonnen, ordos, erg, dawn, lanterns, harvest, assault, iron, shieldwall, stormfront,
  victory, defeat, victoryAtreides, victoryHarkonnen, victoryOrdos, defeatAtreides, defeatHarkonnen, defeatOrdos, finale, credits,
];

export const TRACKS = Object.fromEntries(ALL.map((t) => [t.id, t]));

export const POOLS = {
  intro: ['opening'],
  menu: ['title'],
  houseSelect: ['houseSelect'],
  region: ['region'],
  peace: ['erg', 'dawn', 'lanterns', 'harvest'],
  battle: ['assault', 'iron', 'shieldwall', 'stormfront'],
  victory: ['victory'],
  defeat: ['defeat'],
  finale: ['finale'],
  credits: ['credits'],
};

// a house's own music, the Fremen with the Atreides, the Sardaukar with the Harkonnen, the mercenaries with the Ordos
const byHouse = (of) => ({ atreides: of.atreides, fremen: of.atreides, harkonnen: of.harkonnen, sardaukar: of.harkonnen, ordos: of.ordos, mercenary: of.ordos });

/** The briefing theme of a house. */
export const BRIEFINGS = byHouse({ atreides: 'atreides', harkonnen: 'harkonnen', ordos: 'ordos' });

/** The fanfare of a house's won mission (from the Carryall fly-over to the score). */
export const VICTORY = byHouse({ atreides: 'victory-atreides', harkonnen: 'victory-harkonnen', ordos: 'victory-ordos' });

/** The dirge of a house's lost mission. */
export const DEFEAT = byHouse({ atreides: 'defeat-atreides', harkonnen: 'defeat-harkonnen', ordos: 'defeat-ordos' });
