// Every track of the soundtrack by id, and which of them each moment of the game draws from (spec §6 Music;
// research audio-ui-controls.md §A.2: a peace pool shuffled while the player builds, a battle pool that takes over
// when fighting starts, the house's own briefing theme, and a theme for winning and one for losing). All of it is
// original music written for this game.
import { title } from './title.js';
import { erg, dawn, lanterns } from './peace.js';
import { assault, iron, shieldwall } from './battle.js';
import { atreides, harkonnen, ordos } from './houses.js';
import { victory, defeat } from './endings.js';

const ALL = [title, atreides, harkonnen, ordos, erg, dawn, lanterns, assault, iron, shieldwall, victory, defeat];

export const TRACKS = Object.fromEntries(ALL.map((t) => [t.id, t]));

export const POOLS = {
  menu: ['title'],
  peace: ['erg', 'dawn', 'lanterns'],
  battle: ['assault', 'iron', 'shieldwall'],
  victory: ['victory'],
  defeat: ['defeat'],
};

/** The briefing theme of a house (the Fremen fight with the Atreides, the Sardaukar with the Harkonnen). */
export const BRIEFINGS = { atreides: 'atreides', fremen: 'atreides', harkonnen: 'harkonnen', sardaukar: 'harkonnen', ordos: 'ordos', mercenary: 'ordos' };
