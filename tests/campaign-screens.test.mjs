// The campaign screens in the main menu, through a fake DOM (contract C3 screen names; C2 launch and result; C4
// words, C1 mission list, C5 atlas and C6 music moods injected or missing): the whole Sega flow by clicks and keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, FakeEl, press, settle, memoryStore, byAct, keyListeners } from './campaign-dom.mjs';

installDom();
const { MainMenu, MENU_ITEMS } = await import('../src/ui/main-menu.js');
const { DEFAULTS } = await import('../src/core/settings.js');
const { KEY, VERSION } = await import('../src/campaign/progress.js');

const nine = (house) => Array.from({ length: 9 }, (_, i) => ({ briefing: [`${house} briefing ${i + 1}`], advice: [`${house} advice ${i + 1}`], win: [`${house} win ${i + 1}`], lose: [`${house} lose ${i + 1}`] }));
const STORY = {
  MENTATS: { atreides: { name: 'Cyril' }, harkonnen: { name: 'Radnor' }, ordos: { name: 'Ammon' } },
  HOUSE_PAGES: Object.fromEntries(['atreides', 'ordos', 'harkonnen'].map((id) => [id, [[`${id} page one a`, `${id} page one b`], [`${id} page two`], [`${id} page three`]]])),
  joinQuestion: (house) => `Join ${house}?`,
  BRIEFINGS: { atreides: nine('atreides'), ordos: nine('ordos'), harkonnen: nine('harkonnen') },
  ENDINGS: { ordos: ['The Ordos own Dune now.'] },
  MAP_CAPTIONS: { ordos: ['Caption step 0', 'Caption step 1'] },
  CREDITS: [],
};
const MISSIONS = { missionDef: (house, n) => (n >= 1 && n <= 9 ? { id: `${house}-${n}`, house, mission: n, title: `Title ${house} ${n}`,
  objective: n === 1 ? { kind: 'quota', quota: 1000 } : n === 2 ? { kind: 'quotaOrDestroy', quota: 2700 } : { kind: 'destroy' }, enemies: n === 9 ? ['sardaukar'] : ['harkonnen'] } : null) };
const RESULT = (house, mission, won, extra = {}) => ({ dune: 'missionEnd', house, mission, won, draw: false, seconds: 14 * 60 + 5,
  stats: { won, rows: [{ label: 'Spice harvested', you: 7014, enemy: 1553 }, { label: 'Units destroyed', you: 35, enemy: 6 }, { label: 'Units lost', you: 6, enemy: 35 },
    { label: 'Buildings destroyed', you: 4, enemy: 0 }, { label: 'Buildings lost', you: 0, enemy: 4 }] },
  score: { minutes: 15, credits: 2712, survivingValue: 31, killedValue: 9, lostValue: 0 }, ...extra });

/** A menu wired to a fake shell, music and backdrop; everything they are asked is in `calls`. */
function rig({ store = memoryStore(), story = STORY, missions = MISSIONS, atlas = null, moods = true, ending = null } = {}) {
  keyListeners.length = 0;   // only this menu hears the keys
  const calls = { launch: [], quit: [], moods: [], briefing: [], paused: [], started: 0, ending: [] };
  const handlers = new Map();
  let menu = null;
  const shell = { launch: (q) => { calls.launch.push(q); menu.hide(); }, quit: (screen) => { calls.quit.push(screen); menu.show(screen); }, on: (type, fn) => handlers.set(type, fn) };
  const music = moods ? { mood: (n) => calls.moods.push(n), briefing: (h) => calls.briefing.push(h) } : { briefing: (h) => calls.briefing.push(h) };
  const backdrop = { setPaused: (p) => calls.paused.push(p), start: () => { calls.started++; }, stop() {} };
  const load = {
    story: async () => { if (!story) throw new Error('no story yet'); return story; },
    missions: async () => { if (!missions) throw new Error('no mission list yet'); return missions; },
    atlas: atlas ?? (async () => { throw new Error('no atlas yet'); }),
    ending: ending ?? (async () => ({ playEnding: async (ctx) => { calls.ending.push(ctx.house); } })),
  };
  menu = new MainMenu(new FakeEl('div'), { settings: { ...DEFAULTS }, onStart() {}, onFullscreen() {}, music, shell, backdrop, campaign: { store, load } });
  return { menu, calls, store, post: (message) => handlers.get('missionEnd')(message) };
}
const spoken = (menu) => menu.el.find((el) => el.className === 'cp-sr')?.textContent ?? null;
const field = (menu, name) => menu.el.find((el) => el.dataset?.field === name);
async function open(menu, screen = 'campaign') { menu.go(screen); await settle(); }

const quiet = async (fn) => { const warn = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = warn; } };

test('Campaign is the title\'s first entry, enabled; Original Game Files still follows Options', () => {
  assert.equal(MENU_ITEMS[0][0], 'campaign');
  assert.ok(!MENU_ITEMS[0][3], 'not disabled');
  const acts = MENU_ITEMS.map(([act]) => act);
  assert.equal(acts.indexOf('original-files'), acts.indexOf('options') + 1);
  const { menu } = rig();
  assert.ok(byAct(menu.el, 'campaign'));
  assert.ok(menu.el.find((el) => el.tagName === 'H1' && el.textContent === 'Dune'), 'the Sega lockup: DUNE');
  assert.match(menu.el.find((el) => el.tagName === 'FOOTER').textContent, /Non-commercial fan remake.*Westwood Studios’ 1992 game/);
});

test('the hub: new campaign and password, nothing to continue at first; Back and Esc return to the title', async () => {
  const { menu } = rig();
  byAct(menu.el, 'campaign').click();
  await settle();
  assert.equal(menu.screen, 'campaign');
  assert.ok(byAct(menu.el, 'new'));
  assert.ok(byAct(menu.el, 'password'));
  assert.equal(byAct(menu.el, 'continue'), null);
  byAct(menu.el, 'back').click();
  assert.equal(menu.screen, 'title');
  await open(menu);
  press('Escape');
  assert.equal(menu.screen, 'title');
});

test('a new campaign: crests in the Sega order, three pages and yes, the briefing, the region, then the mission', async () => {
  const { menu, calls, store } = rig();
  await open(menu);
  byAct(menu.el, 'new').click();
  assert.equal(menu.screen, 'campaign-house');
  assert.deepEqual(menu.el.findAll((el) => el.dataset?.act === 'house').map((el) => el.dataset.house), ['atreides', 'ordos', 'harkonnen']);
  assert.ok(calls.moods.includes('houseSelect'));
  assert.equal(calls.paused.at(-1), true, 'the backdrop holds still behind a full-screen stage');
  byAct(menu.el, 'house', { house: 'ordos' }).click();
  assert.equal(menu.screen, 'campaign-join');
  assert.equal(spoken(menu), 'ordos page one a ordos page one b');
  byAct(menu.el, 'next').click();
  assert.equal(spoken(menu), 'ordos page two');
  byAct(menu.el, 'next').click();
  byAct(menu.el, 'next').click();
  assert.equal(spoken(menu), 'Join ordos?');
  assert.equal(store.data[KEY], undefined, 'nothing saved before yes');
  byAct(menu.el, 'join').click();
  assert.equal(menu.screen, 'campaign-briefing');
  assert.equal(spoken(menu), 'ordos briefing 1');
  assert.ok(menu.el.textContent.includes('Title ordos 1'));
  assert.ok(menu.el.textContent.includes('Objective: Harvest 1,000 credits of spice.'));
  assert.ok(calls.moods.includes('briefing:ordos'));
  assert.equal(JSON.parse(store.data[KEY]).houses.ordos.mission, 1, 'joining saves');
  byAct(menu.el, 'advice').click();
  assert.equal(spoken(menu), 'ordos advice 1');
  byAct(menu.el, 'advice').click();
  assert.equal(spoken(menu), 'ordos briefing 1');
  byAct(menu.el, 'proceed').click();
  assert.equal(menu.screen, 'campaign-region');
  assert.equal(calls.moods.at(-1), 'region');
  assert.ok(menu.el.textContent.includes('Caption step 0'));
  await quiet(() => settle());
  byAct(menu.el, 'start').click();
  assert.deepEqual(calls.launch, ['scene=mission&house=ordos&mission=1']);
  assert.equal(menu.el.hidden, true);
});

test('the region zoom launches the mission by itself when the map\'s zoom ends', async () => {
  let zoomed = null;
  const atlas = async () => ({ createAtlas: () => ({ show() {}, zoomTo: (opts) => { zoomed = opts; return Promise.resolve(); }, conquer: async () => {}, resize() {}, dispose() {} }) });
  const { menu, calls } = rig({ atlas });
  menu.go('campaign-briefing');
  await settle();
  byAct(menu.el, 'proceed').click();
  await settle();
  assert.deepEqual(zoomed, { house: 'atreides', mission: 1, seconds: 7 });
  assert.deepEqual(calls.launch, ['scene=mission&house=atreides&mission=1']);
});

test('a won mission: saved, then the victory card, the Mentat, the score, the password and the next briefing', async () => {
  const { menu, calls, store, post } = rig();
  await open(menu);
  post(RESULT('ordos', 1, true));
  assert.deepEqual(calls.quit, ['campaign-results']);
  assert.equal(menu.screen, 'campaign-results');
  assert.equal(JSON.parse(store.data[KEY]).houses.ordos.mission, 2, 'saved before the screens');
  assert.ok(menu.el.find((el) => el.className.split(' ').includes('cp-victory')));
  assert.equal(calls.moods.at(-1), 'victory:ordos');
  byAct(menu.el, 'continue').click();
  assert.equal(spoken(menu), 'ordos win 1');
  byAct(menu.el, 'continue').click();
  assert.equal(field(menu, 'score').textContent, String(9 + 31 + 27 + (45 - 15)));
  assert.equal(field(menu, 'time').textContent, '0:14');
  assert.equal(field(menu, 'rank').textContent, 'Desert Mongoose');
  assert.deepEqual(menu.el.findAll((el) => el.dataset?.row).map((el) => el.dataset.row), ['spice', 'units'], 'no structures row in mission 1');
  byAct(menu.el, 'continue').click();
  assert.equal(field(menu, 'password').getAttribute('aria-label'), 'DOMINATION');
  assert.match(menu.el.textContent, /completing House Ordos mission 1 is/);
  assert.equal(calls.moods.at(-1), 'briefing:ordos', 'the Mentat\'s theme from the password on');
  byAct(menu.el, 'continue').click();
  assert.equal(menu.screen, 'campaign-briefing');
  assert.equal(spoken(menu), 'ordos briefing 2');
});

test('the score screen shows the structures row from mission 2, and Esc moves the results on', async () => {
  const { menu, post } = rig();
  await open(menu);
  post(RESULT('harkonnen', 4, true));
  press('Escape');
  press('Escape');
  assert.deepEqual(menu.el.findAll((el) => el.dataset?.row).map((el) => el.dataset.row), ['spice', 'units', 'structures']);
  press('Escape');
  assert.equal(field(menu, 'password').getAttribute('aria-label'), 'DARKHUNTER', 'completing mission 4 gives the word for mission 5');
  press('Escape');
  assert.equal(menu.screen, 'campaign-briefing');
  assert.equal(spoken(menu), 'harkonnen briefing 5');
});

test('a lost mission: the Mentat\'s lose lines, then the same briefing to try again', async () => {
  const { menu, calls, store, post } = rig();
  await open(menu);
  post(RESULT('atreides', 3, false));
  assert.deepEqual(calls.quit, ['campaign-results'], 'the contract\'s screen name; the menu turns it into the defeat');
  assert.equal(menu.screen, 'campaign-defeat');
  assert.equal(spoken(menu), 'atreides lose 3');
  assert.equal(calls.moods.at(-1), 'defeat:atreides');
  assert.equal(JSON.parse(store.data[KEY]).houses.atreides.mission, 3);
  byAct(menu.el, 'retry').click();
  assert.equal(menu.screen, 'campaign-briefing');
  assert.equal(spoken(menu), 'atreides briefing 3');
});

test('quitting a mission comes back to its briefing', async () => {
  const { menu, calls } = rig();
  menu.go('campaign-briefing');
  await settle();
  byAct(menu.el, 'proceed').click();
  byAct(menu.el, 'start').click();
  assert.equal(calls.launch.length, 1);
  menu.show('campaign');   // the shell, on { dune: 'quit', screen: 'campaign' }
  assert.equal(menu.screen, 'campaign-briefing');
  assert.equal(spoken(menu), 'atreides briefing 1');
});

test('the last mission won: the results without a password, the Mentat\'s final words, the ending, then the title', async () => {
  const { menu, calls, post, store } = rig();
  await open(menu);
  post(RESULT('ordos', 9, true));
  byAct(menu.el, 'continue').click();
  byAct(menu.el, 'continue').click();
  assert.ok(field(menu, 'score'));
  byAct(menu.el, 'continue').click();
  assert.equal(menu.screen, 'campaign-ending');
  assert.equal(spoken(menu), 'The Ordos own Dune now.');
  byAct(menu.el, 'ending').click();
  await settle();
  assert.deepEqual(calls.ending, ['ordos']);
  assert.equal(menu.screen, 'title');
  assert.equal(menu.el.hidden, false);
  assert.equal(JSON.parse(store.data[KEY]).houses.ordos.mission, 10);
  assert.equal(calls.moods.at(-1), 'menu', 'the title theme returns');
  await open(menu);
  assert.ok(byAct(menu.el, 'ending', { house: 'ordos' }), 'a won house can watch its ending again');
  assert.equal(byAct(menu.el, 'continue'), null);
});

test('a password: letters only, a wrong word says so, a right one opens its mission and is saved', async () => {
  const { menu, store } = rig();
  await open(menu);
  byAct(menu.el, 'password').click();
  assert.equal(menu.screen, 'campaign-password');
  const input = () => byAct(menu.el, 'password-input');
  input().value = 'spice-dance 9x';
  input().dispatch('input');
  assert.equal(input().value, 'SPICEDANCE');
  byAct(menu.el, 'letter', { letter: 'Q' }).click();
  assert.equal(input().value, 'SPICEDANCE', 'ten letters at most');
  byAct(menu.el, 'delete').click();
  byAct(menu.el, 'letter', { letter: 'Q' }).click();
  input().dispatch('keydown', { key: 'Enter' });
  assert.equal(menu.screen, 'campaign-password');
  assert.match(menu.el.textContent, /That password opens no mission/);
  assert.equal(input().value, 'SPICEDANCQ', 'the word stays to be corrected');
  byAct(menu.el, 'delete').click();
  byAct(menu.el, 'letter', { letter: 'E' }).click();
  byAct(menu.el, 'submit').click();
  assert.equal(menu.screen, 'campaign-briefing');
  assert.equal(spoken(menu), 'atreides briefing 3');
  const saved = JSON.parse(store.data[KEY]);
  assert.equal(saved.house, 'atreides');
  assert.equal(saved.houses.atreides.mission, 3);
});

test('progress survives a reload: the hub offers to continue where the player left off', async () => {
  const store = memoryStore();
  const first = rig({ store });
  await open(first.menu);
  first.post(RESULT('harkonnen', 2, true));
  const { menu } = rig({ store });
  await open(menu);
  const cont = byAct(menu.el, 'continue');
  assert.equal(cont.dataset.house, 'harkonnen');
  assert.match(cont.textContent, /Mission 3: Title harkonnen 3/);
  cont.click();
  assert.equal(menu.screen, 'campaign-briefing');
  assert.equal(spoken(menu), 'harkonnen briefing 3');
});

test('corrupt or blocked storage: an empty campaign that still plays, and the hub says progress is not kept', async () => {
  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
  const { menu } = rig({ store: blocked });
  await open(menu);
  assert.equal(byAct(menu.el, 'continue'), null);
  byAct(menu.el, 'new').click();
  byAct(menu.el, 'house', { house: 'atreides' }).click();
  for (let i = 0; i < 3; i++) byAct(menu.el, 'next').click();
  byAct(menu.el, 'join').click();
  assert.equal(menu.screen, 'campaign-briefing');
  menu.go('campaign');
  assert.match(menu.el.textContent, /will not keep your progress/);
  assert.ok(byAct(menu.el, 'continue'), 'this visit still remembers');
  const junk = rig({ store: memoryStore({ [KEY]: '{"version":' }) });
  await open(junk.menu);
  assert.equal(byAct(junk.menu.el, 'continue'), null);
});

test('Esc steps back along the chain: join to houses to hub to title; region back to the briefing', async () => {
  const { menu, calls } = rig();
  await open(menu);
  byAct(menu.el, 'new').click();
  byAct(menu.el, 'house', { house: 'harkonnen' }).click();
  press('Escape');
  assert.equal(menu.screen, 'campaign-house');
  press('Escape');
  assert.equal(menu.screen, 'campaign');
  assert.equal(calls.paused.at(-1), DEFAULTS.menuMotion === false, 'the backdrop moves again behind the hub');
  press('Escape');
  assert.equal(menu.screen, 'title');
  menu.go('campaign-briefing');
  await settle();
  byAct(menu.el, 'proceed').click();
  press('Escape');
  assert.equal(menu.screen, 'campaign-briefing');
  assert.equal(calls.launch.length, 0);
});

test('arrow keys move between the crests', async () => {
  const { menu } = rig();
  await open(menu, 'campaign-house');
  assert.equal(globalThis.document.activeElement?.dataset.house, 'atreides', 'the first crest has the focus');
  press('ArrowRight');
  assert.equal(globalThis.document.activeElement?.dataset.house, 'ordos');
  press('ArrowLeft');
  press('ArrowLeft');
  assert.equal(globalThis.document.activeElement?.dataset.house, 'harkonnen', 'round from the first to the last');
});

test('without the words, the mission list and the atlas: plain fallbacks and the flat map', async () => {
  await quiet(async () => {
    const { menu } = rig({ story: null, missions: null });
    await open(menu, 'campaign-briefing');
    assert.equal(spoken(menu), 'Briefing not available.');
    assert.ok(menu.el.textContent.includes('Mission 1 of 9'));
    await settle();
    assert.ok(menu.el.find((el) => el.className.startsWith('cp-flat')), 'a flat coloured map instead of the atlas');
    menu.go('campaign-join');
    assert.match(spoken(menu), /House Atreides/);
    for (let i = 0; i < 5 && !byAct(menu.el, 'join'); i++) byAct(menu.el, 'next')?.click();
    assert.equal(spoken(menu), 'Do you wish to join House Atreides?');
  });
});

test('the atlas is shown the territories, takes the new land after a win, and is disposed when a mission starts', async () => {
  const log = [];
  const atlas = async () => ({ createAtlas: (el, opts) => { log.push(['create', opts.quality]); return {
    show: (v) => log.push(['show', v.house, v.step]), zoomTo: () => new Promise(() => {}), conquer: (v) => { log.push(['conquer', v.house, v.step]); return Promise.resolve(); },
    resize() {}, dispose: () => log.push(['dispose']) }; } });
  const { menu, post } = rig({ atlas });
  await open(menu, 'campaign-briefing');
  await settle();
  assert.deepEqual(log.slice(0, 2), [['create', DEFAULTS.quality], ['show', 'atreides', 0]]);
  byAct(menu.el, 'proceed').click();
  await settle();
  byAct(menu.el, 'start').click();
  assert.deepEqual(log.at(-1), ['dispose'], 'the battle gets the graphics memory');
  post(RESULT('atreides', 1, true));
  byAct(menu.el, 'continue').click();
  await settle();
  await new Promise((r) => setTimeout(r, 900));
  assert.deepEqual(log.filter(([k]) => k === 'show' || k === 'conquer').slice(-2), [['show', 'atreides', 0], ['conquer', 'atreides', 1]]);
  byAct(menu.el, 'continue').click();
  assert.deepEqual(log.at(-1), ['dispose'], 'the score screen has no map');
});

test('without mood() the music falls back to briefing(house) and briefing(null)', async () => {
  const { menu, calls } = rig({ moods: false });
  await open(menu, 'campaign-briefing');
  assert.deepEqual(calls.briefing, ['atreides']);
  menu.go('title');
  assert.deepEqual(calls.briefing, ['atreides', null]);
});

test('a broken result message goes back to the hub and changes nothing', async () => {
  await quiet(async () => {
    const { menu, calls, post, store } = rig();
    await open(menu);
    post({ dune: 'missionEnd', house: 'fremen', mission: 2, won: true });
    assert.deepEqual(calls.quit, ['campaign']);
    assert.equal(store.data[KEY], undefined);
  });
});

test('development shots: ?screen= opens a campaign screen with the house, mission and stage from the address', async () => {
  globalThis.location = { search: '?scene=menu&intro=0&screen=campaign-results&house=harkonnen&mission=6&stage=score' };
  try {
    const { menu, store } = rig();
    await open(menu, 'campaign-results');
    assert.equal(menu.screen, 'campaign-results');
    assert.ok(field(menu, 'score'), 'the score stage, of a sample result');
    assert.equal(menu.el.find((el) => el.className.includes('cp-score'))?.dataset.house, 'harkonnen');
    assert.equal(store.data[KEY], undefined, 'a sample is never saved');
    globalThis.location = { search: '?screen=campaign-defeat&house=ordos&mission=2&won=0' };
    const other = rig();
    await open(other.menu, 'campaign-defeat');
    assert.equal(other.menu.screen, 'campaign-defeat');
    assert.equal(spoken(other.menu), 'ordos lose 2');
  } finally { delete globalThis.location; }
});

test('a saved campaign is saved in the versioned shape', async () => {
  const { menu, store } = rig();
  await open(menu, 'campaign-house');
  byAct(menu.el, 'house', { house: 'harkonnen' }).click();
  for (let i = 0; i < 3; i++) byAct(menu.el, 'next').click();
  byAct(menu.el, 'join').click();
  const saved = JSON.parse(store.data[KEY]);
  assert.equal(saved.version, VERSION);
  assert.deepEqual(saved.houses.harkonnen, { mission: 1, best: {} });
});
