// The Sega-style opening before the title (spec §5.8; phase 3 research §8, measured frame by frame from the Mega Drive
// release): pure functions of the time since the player's key or click, so the picture, the music (contract C6: the
// score's 'opening' and the player's own Sega 'Opening' are timed to the same marks) and the tests agree.
//   0     pale stars fade in from black, drifting right to left with parallax: the camera travels sideways
//   4.0   our own credit lines (the Sega shows its, Virgin's and Westwood's logos here), then one word, as the Sega's
//         "PRESENT"
//   16.0  a blue dust nebula and Arrakis slide in from the right; the drift eases out and stops at 17.8: the camera
//         "stops at the planet", in exactly the menu backdrop's framing shot
//   18.8  three house ships, 1.5 s apart (one bar of the music): each enters near a screen edge, arcs towards the
//         planet, shrinking as it recedes, and sinks into it
//   26.5  the title fades in over the planet; 30.0 the menu takes over, the backdrop carrying straight on.
// Under reduced motion a short version holds the framing shot still and crossfades the words and the title.
// Units: seconds; the planet scene's world (planet radius 1, the framing camera on +z looking at its centre).

/** Seconds after the opening's gesture (contract C6): the score's 'opening' is written to these. */
export const INTRO_MARKS = Object.freeze({ credits: 4.0, present: 10.0, planet: 16.0, stop: 17.8, ships: Object.freeze([18.8, 20.3, 21.8]), title: 26.5, menu: 30.0 });
const REDUCED_MARKS = { credits: 0.4, title: 2.8, menu: 6.0 };

const FADE_IN = 1.2;      // black to the starfield (reduced: to the still planet in 0.8 s)
const CARD_FADE = 0.35;   // each card fades in and out over this
const TITLE_FADE = 0.6;   // the title fades in over this (the Sega's takes about half a second)
export const SHIP_TIME = 1.4;   // seconds each ship is on screen (1.3-1.5 s in the Sega release)

/** The words before the planet: our own (no logos, nothing that implies an affiliation), in the Sega's pixel capitals. */
export const CARDS = [
  { id: 'remake', from: INTRO_MARKS.credits, to: 6.6, lines: [{ text: 'A FAN REMAKE', size: 'big' }] },
  { id: 'after', from: 6.9, to: 9.5, lines: [{ text: "AFTER WESTWOOD STUDIOS'", size: 'small' }, { text: '1992 GAME', size: 'small' }] },
  { id: 'present', from: INTRO_MARKS.present, to: 13.3, lines: [{ text: 'IN 3D', size: 'big' }] },
];
const REDUCED_CARD = { id: 'remake', from: REDUCED_MARKS.credits, to: 2.4,
  lines: [{ text: 'A FAN REMAKE', size: 'big' }, { text: "AFTER WESTWOOD STUDIOS'", size: 'small' }, { text: '1992 GAME', size: 'small' }] };

/** The order the ships arrive in, as in the Sega release: blue, red, green lamps. */
export const SHIP_HOUSES = ['atreides', 'harkonnen', 'ordos'];
/**
 * Each ship's flight, authored on screen against the framing shot so it fits any window: it enters at `from` (NDC, just
 * past an edge), a little in front of the camera, and arcs (`bend`: the bulge, as a share of the way, to the left of
 * its heading) to `to`, a point on the planet's visible face given in planet radii from the disc's centre, about 0.6
 * out as in the Sega release; `bank` rolls it into the turn (radians).
 */
export const SHIPS = [
  { house: 'atreides', from: [-1.12, 0.8], to: [0.46, 0.46], bend: 0.18, bank: -0.45 },    // top left, arcing right and down onto the upper right
  { house: 'harkonnen', from: [-1.12, -0.86], to: [-0.44, 0.42], bend: -0.22, bank: 0.4 },  // bottom left, climbing up and right onto the upper left
  { house: 'ordos', from: [1.14, 0.86], to: [0.5, -0.36], bend: -0.2, bank: 0.5 },          // top right, swooping down and left onto the night side
];
/**
 * What the ships sound like (synth recipes shipPass and shipEntry): each sweeps past as it enters, panned to the side it
 * comes from, and meets the atmosphere with a far-off boom as it sinks into the planet, which sits right of centre.
 */
export const SHIP_SOUNDS = Object.freeze(SHIPS.flatMap((ship, i) => [
  { at: INTRO_MARKS.ships[i], id: 'shipPass', pan: Math.sign(ship.from[0]) * 0.6, house: ship.house },
  { at: INTRO_MARKS.ships[i] + SHIP_TIME * 0.8, id: 'shipEntry', pan: Math.max(-0.6, Math.min(0.6, 0.3 + 0.25 * ship.to[0])), house: ship.house },
]).sort((a, b) => a.at - b.at));

/** The ship sounds whose moment falls in (from, to]: none for a jump backwards or a still picture. */
export function shipSoundsBetween(from, to) {
  return to > from ? SHIP_SOUNDS.filter((s) => s.at > from && s.at <= to) : [];
}
const SHIP_DEPTH = 0.95;   // how far in front of the camera a ship enters (planet radii)
const SHIP_SIZE = 0.2;     // its width on entry, as a share of the window's height (the smaller side's, on a tall window)
const SHIP_SPAN = 1;       // the model's width at scale 1 (render/models/units/house-ship.js)
const TURN_TO_HEADING = 0.45;   // how far a ship turns from the line of sight towards its heading
const NOSE_UP = 0.42;           // radians its nose is raised, so its back shows behind the lamps
const _ahead = [0, 0, 0];

// The drift: the camera travels sideways (and a little forwards) at a steady speed, then eases to a stop on the framing
// shot. ARRIVE is how far left of its stop the camera is when the planet starts to slide in, enough to keep the disc and
// its rim just off the right edge until then on any window (2.4 radii at 16:9, 3.1 on a tall one).
const ARRIVE = 3.3;
const EASE = INTRO_MARKS.stop - INTRO_MARKS.planet;    // the planet's slide-in: speed eases out (smoothstep) to zero
const DOLLY = (8 * Math.PI) / 180;                     // the way runs this much into the picture: the stars spread a little
export const DRIFT_SPEED = ARRIVE / (0.5 * EASE * Math.cos(DOLLY));   // planet radii per second until 16.0

// The backdrop builds its next battle while the opening holds still, never while something moves across the screen:
// the build (one long frame) once the camera has stopped and before the first ship, the run-ahead and the shader
// compile after the last ship, before the title.
const BUILD_AT = [INTRO_MARKS.stop + 0.05, INTRO_MARKS.ships[0] - 0.3];
const WORK_AFTER = INTRO_MARKS.ships[2] + SHIP_TIME + 0.1;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ramp = (t, a, b) => clamp01((t - a) / (b - a));
const smoothstep = (a, b, x) => { const u = ramp(x, a, b); return u * u * (3 - 2 * u); };

/** Seconds from the gesture to the menu. */
export function introLength({ reduced = false } = {}) {
  return reduced ? REDUCED_MARKS.menu : INTRO_MARKS.menu;
}

/** What the opening shows at t: 'stars', 'credits', 'present', 'drift', 'arrival', 'ships', 'planet', 'title', 'done' (reduced: 'credits', 'title', 'done'). */
export function introPhase(t, { reduced = false } = {}) {
  if (reduced) return t < REDUCED_MARKS.title ? 'credits' : t < REDUCED_MARKS.menu ? 'title' : 'done';
  const m = INTRO_MARKS;
  if (t < m.credits) return 'stars';
  if (t < m.present) return 'credits';
  if (t < CARDS[2].to + 0.2) return 'present';
  if (t < m.planet) return 'drift';
  if (t < m.ships[0]) return 'arrival';
  if (t < m.ships[2] + SHIP_TIME) return 'ships';
  if (t < m.title) return 'planet';
  if (t < m.menu) return 'title';
  return 'done';
}

/** The black over the picture: the stars (reduced: the still planet) come up out of it. */
export function blackAt(t, { reduced = false } = {}) {
  return 1 - ramp(t, 0, reduced ? 0.8 : FADE_IN);
}

/** The card showing at t and its opacity, or null. */
export function cardAt(t, { reduced = false } = {}) {
  for (const card of reduced ? [REDUCED_CARD] : CARDS) {
    if (t < card.from || t >= card.to) continue;
    return { card, opacity: Math.min(ramp(t, card.from, card.from + CARD_FADE), 1 - ramp(t, card.to - CARD_FADE, card.to)) };
  }
  return null;
}

/** The title's opacity: in at 26.5 and there until the menu takes over (after which the menu's own lockup stands). */
export function titleAt(t, { reduced = false } = {}) {
  const from = reduced ? REDUCED_MARKS.title : INTRO_MARKS.title;
  return ramp(t, from, from + TITLE_FADE);
}

/** The nebulae's share: none in the empty stars, coming in with the planet from 16.0 (the dust near it slides in too). */
export function nebulaAt(t, { reduced = false } = {}) {
  return reduced ? 1 : smoothstep(INTRO_MARKS.planet - 1, INTRO_MARKS.stop, t);
}

/**
 * How far the camera still has to travel at t (planet radii, along its way): a steady drift, then from 16.0 the speed
 * eases out as 1 - smoothstep to nothing at 17.8, so position, speed and acceleration all run on without a jump.
 */
export function travelLeft(t, { reduced = false } = {}) {
  if (reduced) return 0;
  const V = DRIFT_SPEED, m = INTRO_MARKS;
  const easeTotal = 0.5 * V * EASE;
  if (t <= m.planet) return easeTotal + V * (m.planet - t);
  if (t >= m.stop) return 0;
  const u = (t - m.planet) / EASE;
  return V * EASE * (0.5 - (u - u * u * u + 0.5 * u * u * u * u));   // the integral of 1 - smoothstep from u to 1
}

/** The camera's offset from the framing shot at t (world): left of it and a little back, until it stops. */
export function travelOffset(t, out = {}, opts) {
  const r = travelLeft(t, opts);
  out.x = -r * Math.cos(DOLLY);
  out.y = 0;
  out.z = r * Math.sin(DOLLY);
  return out;
}

/** The camera's way through the stars (world positions), for the corridor of near stars along it. */
export function travelCorridor(framingDistance) {
  const s = travelOffset(0);
  return { from: [s.x, s.y, framingDistance + s.z], to: [0, 0, framingDistance] };
}

/** How far ship `index` is through its flight at t (0..1), or null when it is not in the air. */
export function shipAt(index, t) {
  const from = INTRO_MARKS.ships[index];
  return t >= from && t < from + SHIP_TIME ? Math.min((t - from) / SHIP_TIME, 1 - 1e-12) : null;
}

/** Screen position (NDC) along a ship's arc at w 0..1: a quadratic Bézier bulging to the left of its way by `bend`. */
function arcPoint(from, to, bend, w) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const cx = (from[0] + to[0]) / 2 - dy * bend, cy = (from[1] + to[1]) / 2 + dx * bend;
  const a = (1 - w) * (1 - w), b = 2 * (1 - w) * w, c = w * w;
  return [a * from[0] + b * cx + c * to[0], a * from[1] + b * cy + c * to[1]];
}

/**
 * Ship `index` at t for the framing { distance, shiftX, shiftY } at `aspect` (fov in degrees, as the planet camera's):
 * { visible, u, position, forward, up, scale } in world space, scale for a model SHIP_SPAN wide. On screen it runs along
 * its arc, fast at first and slowing as it recedes; its depth grows at a steady log-rate from SHIP_DEPTH to the landing
 * point's, and its size shrinks to nothing as it lands, so it sinks into the planet.
 */
export function shipPose(index, t, { aspect = 16 / 9, framing, fov = 38 } = {}, out = { position: [0, 0, 0], forward: [0, 0, -1], up: [0, 1, 0] }) {
  const u = shipAt(index, t);
  out.visible = u !== null;
  out.u = u ?? (t < INTRO_MARKS.ships[index] ? 0 : 1);
  if (!out.visible) { out.scale = 0; return out; }
  const place = (k, p) => {
    const ship = SHIPS[index], T = Math.tan((fov * Math.PI) / 360), D = framing.distance;
    const ez = Math.sqrt(Math.max(0, 1 - ship.to[0] ** 2 - ship.to[1] ** 2));   // the landing point, on the visible face
    const landDepth = D - ez;
    const land = [ship.to[0] / (landDepth * T * aspect) + framing.shiftX, ship.to[1] / (landDepth * T) + framing.shiftY];
    const w = 1 - (1 - k) * (1 - k);
    const [nx, ny] = arcPoint(ship.from, land, ship.bend, w);
    const depth = SHIP_DEPTH * (landDepth / SHIP_DEPTH) ** k;
    p[0] = (nx - framing.shiftX) * depth * T * aspect;
    p[1] = (ny - framing.shiftY) * depth * T;
    p[2] = D - depth;
    return { depth, T };
  };
  const { depth, T } = place(u, out.position);
  // Like the Sega's sprite it shows the viewer its stern and lamps all the way: it points along the line of sight from the
  // camera, turned a little towards where it is heading, its nose raised so its back shows, banked into the turn.
  const p = out.position, ahead = _ahead;
  place(Math.min(1, u + 0.01), ahead);
  if (u > 0.99) { place(0.98, ahead); for (let i = 0; i < 3; i++) ahead[i] = 2 * p[i] - ahead[i]; }
  let vx = p[0], vy = p[1], vz = p[2] - framing.distance;
  const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
  let gx = ahead[0] - p[0], gy = ahead[1] - p[1], gz = ahead[2] - p[2];
  const gd = gx * vx + gy * vy + gz * vz;
  gx -= gd * vx; gy -= gd * vy; gz -= gd * vz;   // the heading's part across the line of sight
  const gl = Math.hypot(gx, gy, gz) || 1;
  let fx = vx + (TURN_TO_HEADING * gx) / gl, fy = vy + (TURN_TO_HEADING * gy) / gl, fz = vz + (TURN_TO_HEADING * gz) / gl;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  const sl = Math.hypot(fz, fx) || 1, sx = -fz / sl, sz = fx / sl;   // side = forward × world up (level)
  const ux = -sz * fy, uy = sz * fx - sx * fz, uz = sx * fy;          // up = side × forward
  const cp = Math.cos(NOSE_UP), sp = Math.sin(NOSE_UP);
  out.forward[0] = fx * cp + ux * sp; out.forward[1] = fy * cp + uy * sp; out.forward[2] = fz * cp + uz * sp;
  const px = ux * cp - fx * sp, py = uy * cp - fy * sp, pz = uz * cp - fz * sp;   // up, pitched with it (about the side)
  const roll = SHIPS[index].bank * Math.sin(Math.PI * Math.min(1, u * 1.4)), cr = Math.cos(roll), sr = Math.sin(roll);
  out.up[0] = px * cr + sx * sr; out.up[1] = py * cr; out.up[2] = pz * cr + sz * sr;
  const size = SHIP_SIZE * Math.min(1, aspect) * (1 - u) ** 1.5;
  out.scale = (size * depth * 2 * T) / SHIP_SPAN;
  return out;
}

/** What the menu backdrop may do towards its next battle at t: 'build' while the camera stands before the ships, 'run' once they have landed, else null. */
export function backdropWork(t, { reduced = false } = {}) {
  if (reduced) return t >= 0.9 && t < 1.6 ? 'build' : t >= 1.6 ? 'run' : null;
  if (t >= BUILD_AT[0] && t < BUILD_AT[1]) return 'build';
  return t >= WORK_AFTER ? 'run' : null;
}

/** Came back to the menu from a battle that ran on its own page (its Quit reloads the menu): the opening has been seen. */
export function returningFromBattle(referrer, origin) {
  try {
    const from = new URL(referrer);
    if (from.origin !== origin || !from.search) return false;
    return (from.searchParams.get('scene') ?? 'skirmish') !== 'menu';
  } catch { return false; }
}

/**
 * Whether the opening plays (spec §5.8), from the page's state: { play, reason, forced, frozen, at, reduced }.
 * ?introAt=<s> holds it at that moment (screenshots) and ?intro=1 forces it; otherwise not with the Intro setting off
 * (?intro=0), a held backdrop (?backdrop=), a menu screen asked for (?screen=), an automated browser, or on the way back
 * from a battle; and never without the planet to show (the backdrop fell back to the dune flight). Reduced motion, or a
 * paused background, plays the short still version.
 */
export function introRule({ setting = true, param = null, at = null, hold = null, screen = null, automated = false, returning = false, planet = true, reduced = false, still = false } = {}) {
  if (!planet) return { play: false, reason: 'no planet' };
  if (at !== null && Number.isFinite(at)) return { play: true, forced: true, frozen: true, at: Math.max(0, at), reduced: false };
  const forced = param === '1' || param === 'true';
  if (!forced) {
    const reason = !setting ? 'setting' : hold ? 'backdrop' : screen ? 'screen' : automated ? 'automated' : returning ? 'returning' : null;
    if (reason) return { play: false, reason };
  }
  return { play: true, forced, frozen: false, at: null, reduced: !!(reduced || still) };
}
