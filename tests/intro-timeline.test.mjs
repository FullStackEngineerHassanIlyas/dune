// The opening's clock (src/game/intro-timeline.js): the marks the music is written to, what shows when, the camera's
// drift and stop, and when the opening plays at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTRO_MARKS, CARDS, SHIP_TIME, DRIFT_SPEED, introLength, introPhase, blackAt, cardAt, titleAt, travelLeft, travelOffset,
  travelCorridor, backdropWork, introRule, returningFromBattle, shipAt, nebulaAt,
} from '../src/game/intro-timeline.js';
import { planetFraming } from '../src/render/planet.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ≠ ${b} ± ${eps}`);
const H = 1e-4;

test('the marks are contract C6\'s, to the tenth of a second', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(INTRO_MARKS)), { credits: 4.0, present: 10.0, planet: 16.0, stop: 17.8, ships: [18.8, 20.3, 21.8], title: 26.5, menu: 30.0 });
  assert.ok(Object.isFrozen(INTRO_MARKS) && Object.isFrozen(INTRO_MARKS.ships));
  assert.equal(introLength(), 30);
  assert.equal(introLength({ reduced: true }), 6);
});

test('the phases follow one another in the Sega order, each once', () => {
  const seen = [];
  for (let t = 0; t <= 31; t += 0.01) { const p = introPhase(t); if (seen.at(-1) !== p) seen.push(p); }
  assert.deepEqual(seen, ['stars', 'credits', 'present', 'drift', 'arrival', 'ships', 'planet', 'title', 'done']);
  assert.equal(introPhase(INTRO_MARKS.credits - 0.01), 'stars');
  assert.equal(introPhase(INTRO_MARKS.credits), 'credits');
  assert.equal(introPhase(INTRO_MARKS.planet), 'arrival');
  assert.equal(introPhase(INTRO_MARKS.ships[0]), 'ships');
  assert.equal(introPhase(INTRO_MARKS.title), 'title');
  assert.equal(introPhase(INTRO_MARKS.menu), 'done');
  const reduced = [];
  for (let t = 0; t <= 7; t += 0.01) { const p = introPhase(t, { reduced: true }); if (reduced.at(-1) !== p) reduced.push(p); }
  assert.deepEqual(reduced, ['credits', 'title', 'done']);
});

test('the stars come up out of black at the gesture', () => {
  assert.equal(blackAt(0), 1);
  assert.equal(blackAt(1.2), 0);
  let last = 1;
  for (let t = 0; t <= 2; t += 0.05) { const b = blackAt(t); assert.ok(b <= last); last = b; }
  assert.equal(blackAt(0.8, { reduced: true }), 0);
});

test('our own credit lines, then one word, fade in and out between the marks; nothing over the planet', () => {
  assert.equal(cardAt(INTRO_MARKS.credits - 0.01), null);
  assert.equal(cardAt(5).card.id, 'remake');
  assert.equal(cardAt(8).card.id, 'after');
  assert.equal(cardAt(11).card.id, 'present');
  assert.equal(cardAt(5).opacity, 1);
  for (let t = 13.4; t < 31; t += 0.05) assert.equal(cardAt(t), null, `a card at ${t}`);
  for (const card of CARDS) {
    near(cardAt(card.from + 1e-9).opacity, 0, 1e-6, card.id);
    near(cardAt(card.to - 1e-9).opacity, 0, 1e-6, card.id);
  }
  assert.equal(CARDS[2].from, INTRO_MARKS.present);
  assert.ok(CARDS.every((c) => c.lines.every((l) => !/sega|virgin|electronic arts|licen[cs]ed|official/i.test(l.text))), 'nothing that implies an affiliation');
  assert.equal(cardAt(1, { reduced: true }).card.id, 'remake');
});

test('the title fades in at 26.5 and stays', () => {
  assert.equal(titleAt(INTRO_MARKS.title - 0.01), 0);
  assert.ok(titleAt(INTRO_MARKS.title + 0.3) > 0 && titleAt(INTRO_MARKS.title + 0.3) < 1);
  assert.equal(titleAt(INTRO_MARKS.title + 0.6), 1);
  assert.equal(titleAt(INTRO_MARKS.menu), 1);
  assert.equal(titleAt(3, { reduced: true }) > 0, true);
});

test('the drift: steady until the planet, then eased to a stop at 17.8 with no jump in position, speed or acceleration', () => {
  const pos = (t) => travelLeft(t);
  near((pos(5) - pos(5 + H)) / H, DRIFT_SPEED, 1e-6, 'steady speed');
  for (const at of [INTRO_MARKS.planet, INTRO_MARKS.stop]) {
    const [l, m, r] = [pos(at - H), pos(at), pos(at + H)];
    near(l, r, 2 * DRIFT_SPEED * H + 1e-9, `position at ${at}`);
    near((m - l) / H, (r - m) / H, 1e-3, `speed at ${at}`);
  }
  // acceleration: second differences either side of the planet mark agree
  const acc = (t) => (pos(t + 1e-3) - 2 * pos(t) + pos(t - 1e-3)) / 1e-6;
  near(acc(INTRO_MARKS.planet - 2e-3), acc(INTRO_MARKS.planet + 2e-3), 0.1, 'acceleration at 16.0');
  let last = Infinity;
  for (let t = 0; t <= 20; t += 0.01) { const p = pos(t); assert.ok(p <= last + 1e-12, `backwards at ${t}`); last = p; }
  assert.equal(pos(INTRO_MARKS.stop), 0);
  assert.deepEqual(travelOffset(25), { x: -0, y: 0, z: 0 });
  assert.equal(travelLeft(3, { reduced: true }), 0);
});

test('the camera\'s offset runs on smoothly in 3D, ending exactly on the framing shot', () => {
  const at = (t) => travelOffset(t);
  for (let t = 0.05; t < 20; t += 0.05) {
    const a = at(t - H), b = at(t + H);
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) <= 2 * H * DRIFT_SPEED + 1e-9, `jumps at ${t}`);
    assert.ok(a.x <= 0 && a.z >= 0, 'always left of the framing shot and behind it');
  }
  const end = at(INTRO_MARKS.stop);
  assert.deepEqual([end.x, end.y, end.z].map(Math.abs), [0, 0, 0]);
});

test('the nebulae stay out of the empty stars and come in with the planet', () => {
  assert.equal(nebulaAt(10), 0);
  assert.equal(nebulaAt(INTRO_MARKS.planet - 1), 0);
  assert.ok(nebulaAt(INTRO_MARKS.planet + 0.5) > 0);
  assert.equal(nebulaAt(INTRO_MARKS.stop), 1);
  assert.equal(nebulaAt(29), 1, 'all there for the hand-over: the backdrop shows them');
  assert.equal(nebulaAt(0, { reduced: true }), 1);
});

/** NDC x of the planet's disc edges, rim included, seen from the travelling camera at t (it looks straight along -z). */
function discX(t, aspect) {
  const f = planetFraming(aspect), o = travelOffset(t), T = Math.tan((19 * Math.PI) / 180);
  const depth = f.distance + o.z, half = 1.1 / Math.sqrt(depth * depth - 1.21) * depth;   // the rim's outline, at the centre's depth
  const centre = -o.x / (depth * T * aspect) + f.shiftX, r = half / (depth * T * aspect);
  return { left: centre - r, right: centre + r };
}

test('the planet stays off screen until 16.0, then slides in from the right and stops in the framing shot', () => {
  for (const aspect of [16 / 9, 4 / 3, 21 / 9, 9 / 16]) {
    assert.ok(discX(INTRO_MARKS.planet - 0.05, aspect).left > 1, `${aspect}: in view before 16.0`);
    assert.ok(discX(INTRO_MARKS.planet + 0.9, aspect).left < 1, `${aspect}: not in by 16.9`);
    let last = Infinity;
    for (let t = INTRO_MARKS.planet; t <= INTRO_MARKS.stop; t += 0.05) { const x = discX(t, aspect).left; assert.ok(x <= last + 1e-9); last = x; }
  }
  const c = travelCorridor(4.142);
  assert.deepEqual(c.to, [0, 0, 4.142]);
  assert.ok(c.from[0] < -50 && c.from[2] > 4.142, 'the way starts far to the left and a little back');
});

test('the backdrop builds its next battle only while nothing moves on screen', () => {
  for (let t = 0; t <= 31; t += 0.01) {
    const work = backdropWork(t);
    if (!work) continue;
    assert.ok(travelLeft(t) === 0, `${work} at ${t} while the camera moves`);
    assert.ok([0, 1, 2].every((i) => shipAt(i, t) === null), `${work} at ${t} while a ship flies`);
  }
  assert.equal(backdropWork(18), 'build');
  assert.equal(backdropWork(24), 'run');
  assert.equal(backdropWork(INTRO_MARKS.ships[2] + SHIP_TIME / 2), null);
});

test('when the opening plays', () => {
  assert.deepEqual(introRule({}), { play: true, forced: false, frozen: false, at: null, reduced: false });
  assert.equal(introRule({ setting: false }).reason, 'setting');
  assert.equal(introRule({ hold: 'planet' }).reason, 'backdrop');
  assert.equal(introRule({ screen: 'options' }).reason, 'screen');
  assert.equal(introRule({ automated: true }).reason, 'automated');
  assert.equal(introRule({ returning: true }).reason, 'returning');
  assert.equal(introRule({ planet: false, param: '1' }).reason, 'no planet');
  assert.equal(introRule({ automated: true, param: '1' }).play, true, '?intro=1 forces it in a headless run');
  assert.equal(introRule({ automated: true, hold: 'battle', param: '1' }).forced, true);
  assert.deepEqual(introRule({ automated: true, at: 19.4 }), { play: true, forced: true, frozen: true, at: 19.4, reduced: false });
  assert.equal(introRule({ reduced: true }).reduced, true, 'reduced motion: the short still version');
  assert.equal(introRule({ still: true }).reduced, true, 'a paused background: the short still version');
  assert.equal(introRule({ at: 20, reduced: true }).reduced, false, 'a held moment is the full version');
});

test('a battle on its own page quitting to the menu does not bring the opening back', () => {
  const origin = 'http://localhost:8000';
  assert.equal(returningFromBattle(`${origin}/?scene=skirmish&house=ordos`, origin), true);
  assert.equal(returningFromBattle(`${origin}/?seed=4`, origin), true, 'no scene: a skirmish');
  assert.equal(returningFromBattle(`${origin}/?scene=mission&house=atreides&mission=2`, origin), true);
  assert.equal(returningFromBattle(`${origin}/`, origin), false);
  assert.equal(returningFromBattle(`${origin}/?scene=menu`, origin), false);
  assert.equal(returningFromBattle('https://example.com/?scene=skirmish', origin), false);
  assert.equal(returningFromBattle('', origin), false);
});
