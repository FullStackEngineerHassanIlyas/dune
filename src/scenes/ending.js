// Dev scene: the campaign's ending on its own (spec §5.8; scenes/menu-intro.js playEnding, contract C12), on a menu
// backdrop of its own that never starts its loop. ?house=atreides|harkonnen|ordos picks the victor, ?at=<s> holds it at
// that moment (screenshots), ?seed= the planet's face. It plays again two seconds after it ends or is skipped. The music
// follows the menu's (its 'finale' and 'credits' moods), from the first key or click.
import { MenuBackdrop } from './menu-backdrop.js';
import { playEnding } from './menu-intro.js';
import { MenuMusic } from '../audio/music/music.js';
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { PLAYABLE_HOUSES } from '../data/houses.js';

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const app = document.getElementById('app');
  app.classList.add('in-menu', 'intro-checked');
  const house = PLAYABLE_HOUSES.includes(params.str('house')) ? params.str('house') : 'atreides';
  const backdrop = new MenuBackdrop({ settings, seed: params.num('seed', 5) });
  const music = new MenuMusic({ settings });
  const menu = { hide() {}, show() {} };   // no menu here
  const debug = { ready: false, scene: 'ending', house, backdrop: backdrop.debug(), music: music.debug() };
  window.__dune = debug;
  const at = params.num('at');
  const play = () => playEnding({ house, app, backdrop, menu, music, at, debug }).then(() => setTimeout(play, 2000));
  play();
  // ready once its first frames are on screen
  const ready = () => { if (debug.ending) requestAnimationFrame(() => requestAnimationFrame(() => { debug.ready = true; })); else setTimeout(ready, 20); };
  ready();
}
