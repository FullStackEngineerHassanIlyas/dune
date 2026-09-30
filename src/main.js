// Entry point: checks WebGL2, then loads the scene named by ?scene= — the main menu when the address
// has no query at all, a skirmish when it has one without a scene (older links and flags).
import { installCursors } from './ui/cursors.js';

const SCENES = {
  boot: () => import('./scenes/boot.js'),
  menu: () => import('./scenes/menu.js'),
  'render-test': () => import('./scenes/render-test.js'),
  terrain: () => import('./scenes/terrain.js'),
  gallery: () => import('./scenes/gallery.js'),
  skirmish: () => import('./scenes/skirmish.js'),
  stress: () => import('./scenes/stress.js'),
  structures: () => import('./scenes/structures.js'),
  model: () => import('./scenes/model.js'),
  icons: () => import('./scenes/icons.js'),
  base: () => import('./scenes/base.js'),
  battle: () => import('./scenes/battle.js'),
  planet: () => import('./scenes/planet.js'),
};

function fatal(message) {
  const div = document.createElement('div');
  div.className = 'fatal';
  div.textContent = message;
  document.getElementById('ui').appendChild(div);
}

const params = new URLSearchParams(location.search);
const name = params.get('scene') || (location.search.length > 1 ? 'skirmish' : 'menu');
installCursors();
if (!document.createElement('canvas').getContext('webgl2')) {
  fatal('Dune II 3D needs WebGL 2. Please use a current Chrome, Edge or Firefox with hardware acceleration enabled.');
} else if (!SCENES[name]) {
  fatal(`Unknown scene "${name}".`);
} else {
  SCENES[name]()
    .then((scene) => scene.start({ search: location.search }))
    .catch((err) => { console.error(err); fatal(`Something went wrong while starting the game:\n${err.message}`); });
}
