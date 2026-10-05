// The Mentat portraits (research.md §4): each Mentat is a 3D figure of our own (portraits-cyril/radnor/ammon.js,
// sculpted in signed distance fields), baked once to WebP layers; the briefing stacks them as images in the old
// 400 x 500 frame, pinned to the bottom. He breathes, turns his head a touch and blinks, with transforms and opacity
// only, and keeps still when the player asks for less motion. The bake also records where the body shows the root
// of the neck and where the head covers: the swaying head must hide that root in every pose (no seam, no box).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const { mentatSvg, mentatFiles, PACE, LAYERS } = await import('../src/ui/campaign/portraits.js');
const { PORTRAITS } = await import('../src/ui/campaign/portraits-layers.js');
const { MENTATS } = await import('../src/ui/campaign/portraits-mentats.js');
const { fragmentShader, frameOf, project, posedHand } = await import('../src/ui/campaign/portraits-sdf.js');
const { FINISH, FINISH_SST, FINISH_BLUR, FINISH_AKF } = await import('../src/ui/campaign/portraits-finish.js');

const NAMES = { atreides: ['Cyril', 'Atreides'], harkonnen: ['Radnor', 'Harkonnen'], ordos: ['Ammon', 'Ordos'] };
const DIR = new URL('../assets/campaign/portraits/', import.meta.url);
const SEAMS = JSON.parse(readFileSync(new URL('seams.json', DIR), 'utf8'));
const inFrame = ([x, y, w, h]) => x >= -0.5 && y >= -0.5 && w > 0 && h > 0 && x + w <= 400.5 && y + h <= 500.5;
const inside = ([x, y, w, h], [X, Y, W, H], m = 0.5) => x >= X - m && y >= Y - m && x + w <= X + W + m && y + h <= Y + H + m;

test('each house\'s Mentat fills the frame the briefing sizes, named for readers', () => {
  for (const [house, [name, label]] of Object.entries(NAMES)) {
    const html = mentatSvg(house);
    assert.match(html, /^<div class="cp-mentat-art cpm /, house);
    assert.match(html, new RegExp(`role="img" aria-label="${name}, Mentat of House ${label}"`), house);
    // the 400 x 500 frame fits the box whole, centred, standing on its bottom edge (as an SVG's xMidYMax meet)
    assert.match(html, /container-type:size/);
    assert.match(html, /class="cpm-frame" style="position:absolute;left:50%;bottom:0;width:min\(100cqw,80cqh\);height:min\(125cqw,100cqh\);transform:translateX\(-50%\)"/);
    assert.equal(PORTRAITS[house].name, name, house);
    assert.equal(MENTATS[house].name, name, house);
  }
  assert.equal(mentatSvg('sardaukar'), '', 'no Mentat, no portrait');
  assert.deepEqual(mentatFiles('fremen'), []);
});

test('the portrait stacks its four baked layers, each a small WebP inside the frame', () => {
  let total = 0;
  for (const house of Object.keys(NAMES)) {
    const html = mentatSvg(house), files = mentatFiles(house), P = PORTRAITS[house];
    assert.equal(files.length, 4, house);
    LAYERS.forEach((layer, i) => {
      assert.ok(files[i].endsWith(`assets/campaign/portraits/${house}-${layer}.webp`), files[i]);
      assert.ok(html.includes(`src="${files[i]}"`), `${house} shows its ${layer}`);
      const bytes = statSync(fileURLToPath(files[i])).size;
      assert.ok(bytes > 1000 && bytes < 300 * 1024, `${house}-${layer}.webp is ${bytes} bytes`);
      total += bytes;
      assert.ok(inFrame(P.layers[layer]), `${house} ${layer} box ${P.layers[layer]}`);
    });
    const order = LAYERS.map((l) => html.indexOf(`${house}-${l}.webp`));
    assert.deepEqual([...order].sort((a, b) => a - b), order, `${house}: chamber, body, head, then the closed eyes on top`);
    assert.ok(inside(P.layers.lids, P.layers.head), `${house}: the closed eyes lie on the head`);
    const [px, py] = P.pivot, [hx, hy, hw, hh] = P.layers.head;
    assert.ok(px > hx && px < hx + hw && py > hy + hh * 0.75 && py < hy + hh + 12, `${house}: the head turns about the root of its neck`);
  }
  assert.ok(total < 2 * 1024 * 1024, `all the portraits together are ${total} bytes`);
});

test('the face\'s moving parts are mapped for whoever animates them: mouth under the eyes, brows over them, all on the head', () => {
  for (const house of Object.keys(NAMES)) {
    const { features: f, layers } = PORTRAITS[house];
    for (const k of ['mouth', 'browL', 'browR', 'eyeL', 'eyeR']) assert.ok(inside(f[k], layers.head), `${house} ${k} ${f[k]} on the head ${layers.head}`);
    for (const side of ['L', 'R']) {
      const eye = f[`eye${side}`], brow = f[`brow${side}`];
      assert.ok(brow[1] < eye[1], `${house}: the ${side} brow is above its eye`);
      assert.ok(f.mouth[1] > eye[1] + eye[3] - 2, `${house}: the mouth is below the ${side} eye`);
      assert.ok(inside(eye, layers.lids, 6), `${house}: the blink covers the ${side} eye`);
    }
    assert.ok(f.eyeL[0] < f.eyeR[0] && f.browL[0] < f.browR[0], `${house}: left is left`);
    assert.deepEqual(f, MENTATS[house].features, `${house}: the baked map matches the figure`);
  }
});

test('he breathes, turns his head a touch and blinks with transforms and opacity only, and keeps still on request', () => {
  for (const house of Object.keys(NAMES)) {
    const html = mentatSvg(house), k = `cpm-${house}`;
    for (const cls of ['cpm-breathe', 'cpm-rise', 'cpm-sway', 'cpm-blink']) assert.ok(html.includes(cls), `${house} ${cls}`);
    const frames = [...html.matchAll(/@keyframes [\w-]+\{(.*?)\}\}/g)].map((m) => m[1]);
    assert.equal(frames.length, 4, house);
    for (const body of frames) {
      for (const [, prop] of body.matchAll(/\{?([a-z-]+):/g)) assert.ok(['transform', 'opacity'].includes(prop), `${house}: only ${prop}?`);
      assert.doesNotMatch(body, /var\(/, `${house}: literal values, so the compositor can run them`);
    }
    assert.match(html, /will-change:transform/);
    assert.match(html, new RegExp(`@keyframes ${k}-blink\\{0%\\{opacity:0\\}`), 'the eyes are open most of the time');
    assert.match(html, new RegExp(`@media \\(prefers-reduced-motion:reduce\\)\\{\\.${k} \\.cpm-breathe,\\.${k} \\.cpm-rise,\\.${k} \\.cpm-sway,\\.${k} \\.cpm-blink\\{animation:none\\}\\.${k} \\.cpm-blink\\{opacity:0\\}\\}`));
    assert.match(html, /style="filter:none;/, 'no drop shadow to redraw while he moves: the chamber frames him');
    assert.ok(PACE[house].turn > 0 && PACE[house].turn <= 1.5, `a slight turn (${PACE[house].turn} degrees)`);
  }
});

/** A run-length mask from the bake ([w, h, runs...], runs alternate off and on, starting off) as a bit array. */
function unpack([w, h, ...runs]) {
  const bits = new Uint8Array(w * h);
  let i = 0, on = 0;
  for (const n of runs) { if (on) bits.fill(1, i, i + n); i += n; on ^= 1; }
  assert.equal(i, w * h, 'the mask covers the frame');
  return { w, h, bits };
}

test('the swaying head always hides the root of the neck: no seam, no box, in every pose', () => {
  for (const house of Object.keys(NAMES)) {
    const S = SEAMS[house], P = PORTRAITS[house], pace = PACE[house];
    // the masks belong to the images on disk
    for (const layer of LAYERS) {
      const hash = createHash('sha256').update(readFileSync(new URL(`${house}-${layer}.webp`, DIR))).digest('hex').slice(0, 16);
      assert.equal(hash, S.hashes[layer], `${house}-${layer}.webp was baked with its seam masks`);
    }
    const neck = unpack(S.neck), head = unpack(S.head);
    const n = neck.bits.reduce((a, b) => a + b, 0);
    assert.ok(n > 500, `${house}: the body shows the root of the neck (${n} px), for the head to cover`);
    const s = S.scale, [px, py] = P.pivot.map((v) => v * s);
    const rise = (500 - P.pivot[1]) * 0.009 * s;
    // the poses: rest; the breath's top (the body grows from its bottom edge, the head rises with it); the turn's two
    // extremes, with the breath at either end
    const covered = (x, y, r) => {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        const X = x + i, Y = y + j;
        if (X >= 0 && Y >= 0 && X < head.w && Y < head.h && head.bits[Y * head.w + X]) return true;
      }
      return false;
    };
    const poses = [];
    for (const breath of [0, 1]) for (const turn of [0, -pace.turn, pace.turn * 0.6]) poses.push({ breath, turn, dx: turn ? Math.sign(turn) * 0.0012 * 400 * s : 0 });
    for (const { breath, turn, dx } of poses) {
      const a = (-turn * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
      let missed = 0;
      for (let y = 0; y < neck.h; y++) for (let x = 0; x < neck.w; x++) {
        if (!neck.bits[y * neck.w + x]) continue;
        // where the body's pixel is shown, then where that is in the head's own image (undo rise, shift and turn)
        const bx = 200 * s + (x - 200 * s) * (1 + 0.004 * breath), by = 500 * s - (500 * s - y) * (1 + 0.009 * breath);
        const ux = bx - dx - px, uy = by + rise * breath - py;
        const hx = Math.round(px + ux * c - uy * sn), hy = Math.round(py + ux * sn + uy * c);
        // a pixel the head misses by a sliver (the head's edge cut by the collar moves over the collar's own edge) is
        // skin beside skin; a pixel with no head anywhere near is a seam
        if (!covered(hx, hy, 0) && !covered(hx, hy, 2)) missed++;
      }
      assert.ok(missed <= n * 0.001, `${house}: ${missed} of ${n} neck pixels show past the head (breath ${breath}, turn ${turn})`);
    }
  }
});

test('each figure is a well-formed scene: the shader has every part, and the same numbers every time', async () => {
  for (const [house, m] of Object.entries(MENTATS)) {
    const src = fragmentShader(m.scene);
    for (const fn of ['vec2 mapHead(vec3 p)', 'vec2 mapBody(vec3 p)', 'vec3 albedo(', 'vec3 grade(', 'vec2 headLocal(vec3 q)']) assert.ok(src.includes(fn), `${house}: ${fn}`);
    assert.doesNotMatch(src, /NaN|undefined|Infinity/, `${house}: no broken numbers`);
    const again = (await import(`../src/ui/campaign/portraits-mentats.js?again=${house}`)).MENTATS[house];
    assert.equal(again.scene, m.scene, `${house}: the same figure every time`);
    assert.ok(m.eyes.every(([x, y]) => x > 0 && x < 400 && y > 0 && y < 500), `${house}: his eyes are in the frame`);
  }
});

test('the camera: a point on the window lands where the window says, nearer points spread out from the centre', () => {
  const F = frameOf({ cam: [0, 10, 170], top: 30, height: 50 });
  assert.deepEqual(project(F, [F.x0, 30, 0]).map((v) => Math.round(v * 1000) / 1000), [0, 0]);
  assert.deepEqual(project(F, [F.x0 + F.w, 30 - 50, 0]).map((v) => Math.round(v * 1000) / 1000), [400, 500]);
  const far = project(F, [10, 10, 0]), near = project(F, [10, 10, 20]);
  assert.ok(near[0] > far[0], 'nearer to the camera, further from the centre');
});

test('a posed hand has a palm, four fingers of three bones and a thumb, and curls toward its palm', () => {
  const M = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const flat = posedHand({ at: [0, 0, 0], M, curls: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] });
  const fist = posedHand({ at: [0, 0, 0], M, curls: [[60, 80, 50], [60, 80, 50], [60, 80, 50], [60, 80, 50]] });
  assert.equal(flat.bones.length, 15);
  const tip = (h) => h.bones[5][1];
  assert.ok(tip(flat)[1] > 15, 'a flat hand reaches up');
  assert.ok(tip(fist)[2] < -2 && tip(fist)[1] < tip(flat)[1] - 6, 'a fist curls toward its palm (behind the back of the hand)');
  for (const [a, b, ra, rb] of fist.bones) for (const v of [...a, ...b, ra, rb]) assert.ok(Number.isFinite(v));
});

test('the painter\'s finish: three GPU passes with the inputs the bake gives them', () => {
  for (const [src, names] of [[FINISH_SST, ['uSrc']], [FINISH_BLUR, ['uSrc', 'uDir', 'uSigma']], [FINISH_AKF, ['uSrc', 'uTensor', 'uRadius', 'uQ', 'uAlpha']]]) {
    assert.match(src, /^#version 300 es/);
    for (const n of names) assert.match(src, new RegExp(`uniform [\\w ,]*\\b${n}\\b`), n);
  }
  assert.match(FINISH_AKF, /o = vec4\([^;]*self\.a\);/, 'the alpha stays as it was (the seams depend on it)');
  assert.ok(FINISH.radius > 0 && FINISH.q > 0 && FINISH.alpha > 0 && FINISH.sigma > 0);
});
