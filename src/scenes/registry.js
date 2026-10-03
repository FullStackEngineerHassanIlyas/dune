// Every scene ?scene= can name, and the ones the player plays (they get the frame-time monitor, spec §8, and
// Space's jump to the last alert, spec §5.7). No DOM at import, so tests can check the smoke scenarios against it.
export const SCENES = {
  boot: () => import('./boot.js'),
  menu: () => import('./menu.js'),
  'render-test': () => import('./render-test.js'),
  terrain: () => import('./terrain.js'),
  gallery: () => import('./gallery.js'),
  skirmish: () => import('./skirmish.js'),
  stress: () => import('./stress.js'),
  structures: () => import('./structures.js'),
  model: () => import('./model.js'),
  icons: () => import('./icons.js'),
  base: () => import('./base.js'),
  battle: () => import('./battle.js'),
  planet: () => import('./planet.js'),
  mission: () => import('./mission.js'),   // one campaign mission (spec §7)
  atlas: () => import('./atlas.js'),       // the territory map of Arrakis on its own (spec §5.8)
  ending: () => import('./ending.js'),     // the campaign's ending on its own (spec §5.8)
};

export const BATTLES = new Set(['skirmish', 'base', 'battle', 'mission']);
