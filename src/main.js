// Entry point: checks WebGL2, then loads the scene named by ?scene= — the main menu when the address
// has no query at all, a skirmish when it has one without a scene (older links and flags). Battles also
// get the frame-time monitor (spec §8, ui/perf-monitor.js) and Space's jump to the last alert (spec §5.7).
import { installCursors } from './ui/cursors.js';
import { SCENES, BATTLES } from './scenes/registry.js';

function watchBattle(view) {
  view?.controller?.listenTo?.(view);   // Space's jump to the last alert hears the battle's events from the first frame
  import('./ui/perf-monitor.js').then((m) => m.startPerfMonitor(view)).catch((err) => console.warn('frame-time monitor:', err));
}

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
    .then((view) => { if (BATTLES.has(name)) watchBattle(view); })
    .catch((err) => { console.error(err); fatal(`Something went wrong while starting the game:\n${err.message}`); });
}
