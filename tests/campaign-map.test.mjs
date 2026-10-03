// The territory map's holder (src/ui/campaign/map.js): one atlas per campaign visit, loaded on first use (contract C5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, FakeEl } from './campaign-dom.mjs';

installDom();
const { CampaignMap } = await import('../src/ui/campaign/map.js');

const fakeAtlas = (log) => ({ show: (v) => log.push(['show', v.house, v.step]), zoomTo: async () => {}, conquer: async () => {}, resize() {}, dispose: () => log.push(['dispose']) });

test('closed while the atlas module is still loading: the next map screen still gets the atlas, not the flat map', async () => {
  const log = [];
  let created = 0;
  const load = () => new Promise((r) => setTimeout(() => r({ createAtlas: () => { created++; return fakeAtlas(log); } }), 30));
  const map = new CampaignMap({ load, later: (fn, ms) => setTimeout(fn, ms) });
  map.mount(new FakeEl('div'));
  const first = map.show({ house: 'ordos', step: 0 });    // the join screen
  map.dispose();                                            // Back before the module arrived
  map.mount(new FakeEl('div'));
  const second = map.show({ house: 'ordos', step: 1 });   // the house picked again
  await Promise.all([first, second]);
  assert.equal(created, 1, 'one atlas, for the screen on show');
  assert.deepEqual(log, [['show', 'ordos', 1]]);
  assert.equal(map.el.find((el) => (el.className ?? '').startsWith('cp-flat')), null, 'no flat stand-in');
  assert.equal(map.failed, false);
});

test('a load that fails after the map was closed does not mark the next visit failed', async () => {
  const warn = console.warn; console.warn = () => {};
  try {
    const log = [];
    let calls = 0;
    const load = () => new Promise((resolve, reject) => setTimeout(() => (++calls === 1 ? reject(new Error('offline')) : resolve({ createAtlas: () => fakeAtlas(log) })), 20));
    const map = new CampaignMap({ load, later: (fn, ms) => setTimeout(fn, ms) });
    map.mount(new FakeEl('div'));
    const first = map.show({ house: 'atreides', step: 0 });
    map.dispose();
    map.mount(new FakeEl('div'));
    await Promise.all([first, map.show({ house: 'atreides', step: 2 })]);
    assert.deepEqual(log, [['show', 'atreides', 2]]);
    assert.equal(map.failed, false);
  } finally { console.warn = warn; }
});

test('a load that throws at once falls back to the flat map', async () => {
  const warn = console.warn; console.warn = () => {};
  try {
    const map = new CampaignMap({ load: () => { throw new Error('no module'); }, later: (fn, ms) => setTimeout(fn, ms) });
    map.mount(new FakeEl('div'));
    await map.show({ house: 'harkonnen', step: 3 });
    assert.equal(map.failed, true);
    assert.ok(map.el.find((el) => (el.className ?? '').startsWith('cp-flat')));
  } finally { console.warn = warn; }
});
