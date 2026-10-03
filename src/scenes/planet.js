// Dev scene: the main menu's planet on its own, for inspection and screenshots. ?dive=0..1 holds the camera that far
// down the dive, ?moon= sets the moon time in seconds (0: the start of its pass), ?spin= the planet's turn in radians,
// ?freeze=1 stops all motion, ?loop=1 plays planet → dive → emerge on repeat, ?aspect= letterboxes the picture to
// that aspect ratio, ?guides=1 marks the menu column's edge and the caption's band. window.__dune.set({ dive, moon,
// spin, freeze, loop }) changes them live. The opening's near stars and dust are there too, as on the menu.
import { Renderer3D } from '../render/renderer.js';
import { PlanetShot, menuShare, planetFraming } from '../render/planet.js';
import { SpaceTravel } from '../render/space-travel.js';
import { travelCorridor } from '../game/intro-timeline.js';
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';

const LOOP = { planet: 10, dive: 4, hold: 1, emerge: 3.5 };   // the menu backdrop's timings, with a beat at the seam

/** Where the loop stands at time t: the dive value and the moon time the menu backdrop would give the planet. */
function loopAt(t) {
  const total = LOOP.planet + LOOP.dive + LOOP.hold + LOOP.emerge;
  let u = t % total;
  if (u < LOOP.planet) return { dive: 0, moon: u };
  u -= LOOP.planet;
  if (u < LOOP.dive) return { dive: u / LOOP.dive, moon: LOOP.planet + u };
  u -= LOOP.dive;
  if (u < LOOP.hold) return { dive: 1, moon: LOOP.planet + LOOP.dive };
  u -= LOOP.hold;
  return { dive: 1 - u / LOOP.emerge, moon: u - LOOP.emerge };
}

function letterbox(app, aspect) {
  const fit = () => {
    const w = Math.min(innerWidth, innerHeight * aspect), h = w / aspect;
    Object.assign(app.style, { inset: 'auto', left: `${(innerWidth - w) / 2}px`, top: `${(innerHeight - h) / 2}px`, width: `${w}px`, height: `${h}px` });
  };
  fit();
  addEventListener('resize', fit);
}

function drawGuides(canvas) {
  const w = (canvas.width = canvas.clientWidth), h = (canvas.height = canvas.clientHeight);
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255, 80, 200, 0.8)';
  g.setLineDash([6, 6]);
  const menu = 0.07 * w + 380;   // .mm-title-screen padding + the nav's width, as if the picture were the window
  g.beginPath(); g.moveTo(menu, 0); g.lineTo(menu, h); g.stroke();
  const caption = h - 0.06 * h;   // .mb-caption: bottom 6vh, about 36px tall
  g.strokeRect(w / 2, caption - 36, w / 2, 36);
}

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const aspect = params.num('aspect');
  if (aspect > 0) letterbox(document.getElementById('app'), aspect);
  const r3d = new Renderer3D(document.getElementById('gl'), settings.quality);
  const seed = params.num('seed', 1);
  const planet = new PlanetShot({ seed });
  planet.attach(new SpaceTravel({ seed, corridor: travelCorridor(planetFraming(r3d.width / r3d.height, undefined, menuShare(r3d.width)).distance) }));
  const spin = params.num('spin');
  if (spin !== null) planet.spin.rotation.y = spin;
  const state = { dive: Math.min(1, Math.max(0, params.num('dive', 0))), freeze: params.bool('freeze'), loop: params.bool('loop') };
  planet.startPass(params.num('moon', 0));
  if (params.bool('guides')) { drawGuides(document.getElementById('overlay')); addEventListener('resize', () => drawGuides(document.getElementById('overlay'))); }
  const draw = (dt, t) => {
    let k = state.dive;
    if (state.loop) { const at = loopAt(t); k = at.dive; planet.startPass(at.moon); }
    planet.update(state.freeze ? 0 : dt, { dive: k, aspect: r3d.width / r3d.height, menu: menuShare(r3d.width), pixelRatio: r3d.renderer.getPixelRatio() });
    r3d.render(planet.scene, planet.camera);
  };
  /** Live changes from the console or a script: { dive, moon, spin, freeze, loop }; draws at once. */
  const set = ({ dive, moon, spin: turn, freeze, loop } = {}) => {
    if (dive !== undefined) state.dive = Math.min(1, Math.max(0, dive));
    if (moon !== undefined) planet.startPass(moon);
    if (turn !== undefined) planet.spin.rotation.y = turn;
    if (freeze !== undefined) state.freeze = !!freeze;
    if (loop !== undefined) state.loop = !!loop;
    draw(0, 0);
  };
  let last = 0, t = 0;
  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    draw(dt, t);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame((now) => {
    last = now;
    r3d.compile(planet.scene, planet.camera);
    draw(0, 0);
    window.__dune = { ready: true, scene: 'planet', planet, set };
    requestAnimationFrame(frame);
  });
}
