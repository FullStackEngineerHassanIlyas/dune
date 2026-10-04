// The painted Mentat portraits (research.md §4): the briefing's figure gets one SVG in the old frame (400 x 500,
// pinned to the bottom), stacking the baked layers (the chamber, the body, the head, the closed eyes); it breathes,
// turns its head a touch and blinks, and keeps still when the player asks for less motion. The paintings behind
// the images are our own code (portraits-cyril/radnor/ammon.js), lit by portraits-light.js, and bake the same every
// time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { mentatSvg, mentatFiles } = await import('../src/ui/campaign/portraits.js');
const { PORTRAITS } = await import('../src/ui/campaign/portraits-layers.js');
const { MENTAT_PAINTINGS } = await import('../src/ui/campaign/portraits-mentats.js');
const { field, addForms, shade, rasterizePathJS, painterly, rigToPx } = await import('../src/ui/campaign/portraits-light.js');

const MENTATS = { atreides: ['Cyril', 'Atreides'], harkonnen: ['Radnor', 'Harkonnen'], ordos: ['Ammon', 'Ordos'] };
const LAYERS = ['back', 'body', 'head', 'lids'];

test('each house\'s Mentat comes in the frame the briefing sizes: 400 x 500, pinned to the bottom, named for readers', () => {
  for (const [house, [name, label]] of Object.entries(MENTATS)) {
    const svg = mentatSvg(house);
    assert.match(svg, /^<svg class="cp-mentat-art /, house);
    assert.match(svg, /viewBox="0 0 400 500"/, house);
    assert.match(svg, /preserveAspectRatio="xMidYMax meet"/, house);
    assert.match(svg, new RegExp(`role="img" aria-label="${name}, Mentat of House ${label}"`), house);
    assert.equal(PORTRAITS[house].name, name, house);
  }
  assert.equal(mentatSvg('sardaukar'), '', 'no Mentat, no portrait');
  assert.deepEqual(mentatFiles('fremen'), []);
});

test('the portrait stacks its four baked layers, each a small WebP inside the frame', () => {
  let total = 0;
  for (const house of Object.keys(MENTATS)) {
    const svg = mentatSvg(house);
    const files = mentatFiles(house);
    assert.equal(files.length, 4, house);
    LAYERS.forEach((layer, i) => {
      assert.ok(files[i].endsWith(`assets/campaign/portraits/${house}-${layer}.webp`), files[i]);
      assert.ok(svg.includes(`href="${files[i]}"`), `${house} shows its ${layer}`);
      const bytes = statSync(fileURLToPath(files[i])).size;
      assert.ok(bytes > 1000 && bytes < 300 * 1024, `${house}-${layer}.webp is ${bytes} bytes`);
      total += bytes;
      const [x, y, w, h] = PORTRAITS[house].layers[layer];
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 400.5 && y + h <= 500.5, `${house} ${layer} box ${[x, y, w, h]}`);
    });
    const order = LAYERS.map((l) => svg.indexOf(`${house}-${l}.webp`));
    assert.deepEqual([...order].sort((a, b) => a - b), order, `${house}: chamber, body, head, then the closed eyes on top`);
    const [hx, hy, hw, hh] = PORTRAITS[house].layers.head, [lx, ly, lw, lh] = PORTRAITS[house].layers.lids;
    assert.ok(lx >= hx - 1 && ly >= hy - 1 && lx + lw <= hx + hw + 1 && ly + lh <= hy + hh + 1, `${house}: the closed eyes lie on the head`);
    const [px, py] = PORTRAITS[house].pivot;
    assert.ok(px > hx && px < hx + hw && py > hy, `${house}: the head turns about its neck`);
  }
  assert.ok(total < 2 * 1024 * 1024, `all the portraits together are ${total} bytes`);
});

test('he breathes, turns his head a touch and blinks, and keeps still when the player asks for less motion', () => {
  const svg = mentatSvg('harkonnen');
  for (const cls of ['cpm-breathe', 'cpm-rise', 'cpm-sway', 'cpm-blink']) assert.ok(svg.includes(`class="${cls}"`), cls);
  assert.match(svg, /@keyframes cpm-blink\{0%\{opacity:0\}/, 'the eyes are open most of the time');
  assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{\.cpm-breathe,\.cpm-rise,\.cpm-sway,\.cpm-blink\{animation:none\}\.cpm-blink\{opacity:0\}\}/);
  assert.match(svg, /style="filter:none;/, 'no drop shadow to redraw while he moves: the chamber frames him');
  const turn = Number(svg.match(/--cpm-turn:([\d.]+)deg/)[1]);
  assert.ok(turn > 0 && turn <= 1.5, `a slight turn (${turn} degrees)`);
});

test('the paintings are our own drawings, the same every bake, and well formed', () => {
  for (const [house, m] of Object.entries(MENTAT_PAINTINGS)) {
    assert.equal(m.name, MENTATS[house][0]);
    const docs = [m.paint('back'), m.paint('lidsmask')];
    for (const layer of ['body', 'head']) for (const blink of [false, true]) {
      const L = m.layer(layer, { blink });
      docs.push(L.albedo, L.mat, ...(L.overlay ? [L.overlay] : []));
      assert.deepEqual(m.layer(layer, { blink }), L, `${house} ${layer}: the same every time`);
      for (const f of L.forms) {
        for (const [k, v] of Object.entries(f)) {
          if (typeof v === 'number') assert.ok(Number.isFinite(v), `${house} ${layer} ${f.t}.${k}`);
        }
      }
    }
    for (const doc of docs) {
      assert.match(doc, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 400 500"/);
      assert.ok(doc.endsWith('</svg>'));
      assert.doesNotMatch(doc, /NaN|undefined|Infinity/, `${house}: no broken numbers`);
      const ids = [...doc.matchAll(/ id="([^"]+)"/g)].map((r) => r[1]);
      assert.equal(new Set(ids).size, ids.length, `${house}: every id once`);
      for (const [, ref] of doc.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref), `${house}: #${ref} is defined`);
    }
  }
});

test('the light: a dome lit from the upper left is bright on its left and dark on its right, and casts a shadow', () => {
  const w = 120, h = 80, f = field(w, h);
  addForms(f, [{ t: 'dome', cx: 40, cy: 40, rx: 25, ry: 25, h: 25 }], 1);
  const albedo = new Uint8ClampedArray(w * h * 4).fill(200);
  const rig = rigToPx({
    key: { dir: [-0.7, -0.3, 0.5], color: [1, 1, 1], i: 1.5 }, fill: { dir: [1, 0, 1], color: [0, 0, 0], i: 0 },
    rim: { dir: [1, 0, 0], color: [0, 0, 0], i: 0 }, sky: [0.05, 0.05, 0.05], ground: [0.05, 0.05, 0.05], sss: [0, 0, 0],
    ao: { r: 4, k: 0 }, shadow: { len: 60, soft: 1, bias: 0.3, depth: 1 }, spec: { power: 20, i: 0 },
  }, 1);
  const out = shade({ w, h, albedo, height: f, rig });
  const lum = (x, y) => out[(y * w + x) * 4];
  assert.ok(lum(24, 40) > lum(56, 40) + 60, `left ${lum(24, 40)} vs right ${lum(56, 40)}`);
  assert.ok(lum(75, 50) < lum(100, 50) - 40, `the dome's shadow falls to its lower right (${lum(75, 50)} vs ${lum(100, 50)})`);
});

test('the outline fill covers what it should, and the painter\'s finish keeps a hard edge', () => {
  const cov = rasterizePathJS('M2 2 L8 2 L8 6 L2 6Z', 10, 8, 1, [0, 0]);
  const area = cov.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(area - 24) < 0.01, `area ${area}`);
  assert.equal(cov[3 * 10 + 5], 1);
  assert.equal(cov[0], 0);
  const px = new Uint8ClampedArray(8 * 8 * 4);
  for (let i = 0; i < 64; i++) { px[i * 4] = i % 8 < 4 ? 20 : 220; px[i * 4 + 3] = 255; }
  const out = painterly(px, 8, 8, 2, 1);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((x) => out[(4 * 8 + x) * 4]), [20, 20, 20, 20, 220, 220, 220, 220]);
});
