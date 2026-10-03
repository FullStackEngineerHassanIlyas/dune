// The campaign's words (src/data/story.js, contract C4): every house and mission has its four sections, every
// line fits the Mentat screen, each briefing names exactly the enemies the Sega mission table gives (phase 3
// research §6), the advice names what the Sega tech ladder adds, and nothing is copied from the original. Once
// the other streams' data is merged, the words are held to it: the missions place what the briefings promise
// (src/data/campaign.js), the advice's factories are the ladder's (src/data/sega-tech.js) and the map captions
// name the houses the atlas takes land from (src/data/territory.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { HOUSES } from '../src/data/houses.js';
import { MENTATS, HOUSE_PAGES, joinQuestion, BRIEFINGS, ENDINGS, MAP_CAPTIONS, CREDITS } from '../src/data/story.js';

const HOUSE_IDS = ['atreides', 'ordos', 'harkonnen'];
const MAX = 56;

// The Sega mission table (research §6): who each briefing sends the player against, and how many enemy bases
// stand on the map (0 = units only). Sardaukar Troopers drop in by Carryall from mission 4 on; the Emperor's
// two Sardaukar bases are the whole of mission 9.
const SEGA = {
  atreides: [
    [['ordos'], 0], [['ordos'], 1], [['harkonnen'], 1], [['harkonnen', 'sardaukar'], 1], [['ordos', 'sardaukar'], 1],
    [['harkonnen', 'sardaukar'], 1], [['ordos', 'sardaukar'], 2], [['ordos', 'harkonnen', 'sardaukar'], 2], [['sardaukar'], 2],
  ],
  ordos: [
    [['harkonnen'], 0], [['harkonnen'], 1], [['atreides'], 1], [['atreides', 'sardaukar'], 1], [['harkonnen', 'sardaukar'], 2],
    [['atreides', 'sardaukar'], 2], [['harkonnen', 'sardaukar'], 2], [['atreides', 'harkonnen', 'sardaukar'], 2], [['sardaukar'], 2],
  ],
  harkonnen: [
    [['atreides'], 0], [['atreides'], 1], [['ordos'], 1], [['ordos', 'sardaukar'], 1], [['atreides', 'sardaukar'], 1],
    [['ordos', 'sardaukar'], 2], [['atreides', 'sardaukar'], 2], [['atreides', 'ordos', 'sardaukar'], 2], [['sardaukar'], 2],
  ],
};

// What the Sega ladder adds at each mission, which that mission's advice must name (research §6 tech and units on sale).
const ADVICE = {
  atreides: [
    [/concrete/i, /Wind Trap/, /Refinery/], [/Silo/, /Barracks/, /Trike/], [/Quad/], [/Combat Tank/, /Wall/],
    [/Carryall/, /Repair Facility/, /Missile Tank/], [/Rocket Turret/, /Starport/, /Siege Tank/], [/Sonic Tank/, /Ornithopter/],
    [/Palace/, /Fremen/], [/Death Hand/],
  ],
  ordos: [
    [/concrete/i, /Wind Trap/, /Refinery/], [/Silo/, /Barracks/, /Raider/], [/Quad/], [/Combat Tank/, /Wall/, /Trooper/],
    [/Carryall/, /Repair Facility/], [/Rocket Turret/, /Starport/], [/Deviator/, /Siege Tank/, /Ornithopter/],
    [/Palace/, /Saboteur/], [/Death Hand/],
  ],
  harkonnen: [
    [/concrete/i, /Wind Trap/, /Refinery/], [/Silo/, /WOR/], [/Heavy Factory/, /Quad/], [/Combat Tank/, /Wall/],
    [/Carryall/, /Repair Facility/, /Missile Tank/], [/Rocket Turret/, /Starport/, /Siege Tank/], [/Devastator/],
    [/Palace/, /Death Hand/], [/Death Hand/],
  ],
};
const SPECIAL = { atreides: 'Sonic Tank', ordos: 'Deviator', harkonnen: 'Devastator' };

// Lines of the original game quoted in the research only to sense its tone: none of them may come back.
const ORIGINAL = [
  'fair and just', 'rules seem to have changed', 'cartel of wealthy', 'friend and foe', 'fanatical pursuit',
  'i am your mentat', 'sabotage and terrorism', 'little conscience', 'purging this planet', 'a cruel people',
  'controls the spice', 'rules of engagement', 'no set territories', 'only one will prevail', 'land of sand',
  'spice melange', 'three houses have come', 'select your next region', 'successfully completed your mission',
  'failed your mission', 'battle for dune begins', 'do you wish to join',
  // the PC intro's premise: "The Emperor has proposed a challenge to each of the Houses. The House that
  // produces the most Spice will control Dune."
  'proposed a challenge', 'produces the most spice', 'will control dune',
];
// The same premise with its words swapped for synonyms: "the House that <verb>s (the) most ... will <rule> it".
const PREMISE = /\b(the house|whoever|whichever house)\b[^.]{0,30}\bmost\b[^.]{0,30}\b(will (rule|control|own|keep|have)|keeps|rules|owns)\b/i;

/** A text's sentences, joined across line breaks as the Mentat reads them. */
const sentences = (lines) => lines.join(' ').split(/(?<=[.!?])\s+/);
/** A sentence that only warns of what may happen; the rest state facts the mission must bear out. */
const HEDGE = /\b(if|should|may|might|would|could|perhaps|yet)\b/i;

const NAMES = { atreides: /\bAtreides\b/, harkonnen: /\bHarkonnen\b/, ordos: /\bOrdos\b/, sardaukar: /\bSardaukar\b/ };
/** The houses a text names, besides the player's own. */
const named = (lines, own) => Object.keys(NAMES).filter((id) => id !== own && lines.some((l) => NAMES[id].test(l))).sort();

/** Every line of the module with where it comes from, for the rules that hold for all of them. */
function allLines() {
  const out = [];
  for (const h of HOUSE_IDS) {
    HOUSE_PAGES[h].forEach((page, i) => page.forEach((l) => out.push([`HOUSE_PAGES.${h}[${i}]`, l])));
    out.push([`joinQuestion(${h})`, joinQuestion(h)]);
    BRIEFINGS[h].forEach((m, i) => {
      for (const part of ['briefing', 'advice', 'win', 'lose']) m[part].forEach((l) => out.push([`${h} ${i + 1} ${part}`, l]));
    });
    ENDINGS[h].forEach((l) => out.push([`ENDINGS.${h}`, l]));
    MAP_CAPTIONS[h].forEach((l, step) => out.push([`MAP_CAPTIONS.${h}[${step}]`, l]));
  }
  for (const c of CREDITS) {
    out.push(['CREDITS role', c.role]);
    c.names.forEach((l) => out.push([`CREDITS ${c.role}`, l]));
  }
  return out;
}

test('the Mentats are the ones houses.js names', () => {
  for (const h of HOUSE_IDS) {
    assert.equal(MENTATS[h].name, HOUSES[h].mentat, h);
    assert.ok(BRIEFINGS[h][0].briefing.some((l) => l.includes(MENTATS[h].name)), `${h}: the first briefing introduces ${MENTATS[h].name}`);
  }
});

test('every house has its three pages and a yes-or-no question', () => {
  for (const h of HOUSE_IDS) {
    assert.equal(HOUSE_PAGES[h].length, 3, h);
    for (const page of HOUSE_PAGES[h]) assert.ok(page.length >= 1 && page.length <= 4, `${h}: a page has 1-4 lines`);
    const q = joinQuestion(h);
    assert.ok(q.includes(HOUSES[h].name) && q.endsWith('?'), `${h}: ${q}`);
  }
  assert.equal(joinQuestion('fremen'), null);
});

test('every house and mission has a briefing, advice, a win and a loss of the right length', () => {
  const range = { briefing: [4, 10], advice: [2, 6], win: [2, 4], lose: [2, 4] };
  for (const h of HOUSE_IDS) {
    assert.equal(BRIEFINGS[h].length, 9, h);
    BRIEFINGS[h].forEach((m, i) => {
      for (const [part, [lo, hi]] of Object.entries(range)) {
        assert.ok(Array.isArray(m[part]) && m[part].length >= lo && m[part].length <= hi, `${h} ${i + 1} ${part}: ${m[part]?.length} lines`);
      }
    });
    assert.ok(ENDINGS[h].length >= 4 && ENDINGS[h].length <= 8, `${h} ending`);
    assert.equal(MAP_CAPTIONS[h].length, 10, `${h}: a caption for each map step 0-9`);
  }
});

test('every line is plain text that fits the Mentat screen', () => {
  for (const [where, line] of allLines()) {
    assert.equal(typeof line, 'string', where);
    assert.ok(line.length > 0 && line.length <= MAX, `${where}: ${line.length} characters: ${line}`);
    assert.equal(line, line.trim(), `${where}: stray space`);
    assert.match(line, /^[\x20-\x7e]+$/, `${where}: plain ASCII`);
    assert.doesNotMatch(line, /[{}<>[\]_|\\$#@*]|\s{2}|TODO|TBD|XXX|lorem|\.\.\./i, `${where}: placeholder or markup: ${line}`);
  }
});

test('no line is used twice', () => {
  const seen = new Map();
  for (const [where, line] of allLines()) {
    if (CREDITS.some((c) => c.role === line || c.names.includes(line))) continue;
    assert.ok(!seen.has(line), `"${line}" in ${where} and ${seen.get(line)}`);
    seen.set(line, where);
  }
});

test('each briefing names exactly the enemies of the Sega mission', () => {
  for (const h of HOUSE_IDS) {
    SEGA[h].forEach(([enemies, bases], i) => {
      const n = i + 1, text = BRIEFINGS[h][i].briefing;
      assert.deepEqual(named(text, h), [...enemies].sort(), `${h} ${n}`);
      if (bases === 2) assert.ok(text.some((l) => /\b(two|both)\b/i.test(l)), `${h} ${n}: says there are two bases`);
    });
  }
});

test('the objectives match the Sega table: a quota, then a quota or the base, then bases to destroy', () => {
  for (const h of HOUSE_IDS) {
    const text = (n) => BRIEFINGS[h][n - 1].briefing.join(' ');
    assert.match(text(1), /\b1000 credits\b/, `${h} 1`);
    assert.match(text(2), /\b2700 credits\b/, `${h} 2`);
    assert.match(text(2), /\bbase\b/, `${h} 2: or the enemy base`);
    for (let n = 3; n <= 9; n++) assert.match(text(n), /\b(destroy|burn|wipe)/i, `${h} ${n}`);
    for (let n = 3; n <= 9; n++) assert.doesNotMatch(text(n), /\bquota\b/i, `${h} ${n}: no quota after mission 2`);
  }
});

test('the advice names what the Sega ladder adds', () => {
  for (const h of HOUSE_IDS) {
    ADVICE[h].forEach((wants, i) => {
      const text = BRIEFINGS[h][i].advice.join(' ');
      for (const re of wants) assert.match(text, re, `${h} ${i + 1} advice`);
    });
    const advice = BRIEFINGS[h].map((m) => m.advice.join(' ')).join(' ');
    for (const [other, unit] of Object.entries(SPECIAL)) if (other !== h) assert.ok(!advice.includes(unit), `${h} advice offers the ${unit}`);
  }
  // The Sega Harkonnen Hi-Tech is never upgraded: no Ornithopters for them.
  assert.ok(!BRIEFINGS.harkonnen.some((m) => m.advice.some((l) => /Ornithopter/.test(l))));
});

test('nothing is taken from the original game text', () => {
  for (const [where, line] of allLines()) {
    const plain = line.toLowerCase();
    for (const phrase of ORIGINAL) assert.ok(!plain.includes(phrase), `${where}: "${phrase}"`);
  }
  // joined across line breaks too, as the briefing reads aloud
  for (const h of HOUSE_IDS) {
    for (const m of BRIEFINGS[h]) {
      const plain = Object.values(m).flat().join(' ').toLowerCase();
      for (const phrase of ORIGINAL) assert.ok(!plain.includes(phrase), `${h}: "${phrase}"`);
    }
    BRIEFINGS[h].forEach((m, i) => assert.doesNotMatch(m.briefing.join(' '), PREMISE, `${h} ${i + 1}: the original's premise, reworded`));
  }
});

test('the credits name the remake, its borrowed parts and the original without claiming affiliation', () => {
  for (const c of CREDITS) assert.ok(typeof c.role === 'string' && c.names.length > 0, c.role);
  const text = CREDITS.flatMap((c) => [c.role, ...c.names]).join(' ');
  for (const want of ['fan remake', 'non-commercial', 'Kokoro-82M', 'Apache-2.0', 'ymfm', 'Aaron Giles', 'BSD-3-Clause',
    "Westwood Studios' Dune: The Battle for Arrakis", 'Sega Mega Drive', 'not affiliated']) {
    assert.ok(text.includes(want), want);
  }
});

test('the mission data, once merged, fights the houses its briefing names and places what it promises', async (t) => {
  if (!existsSync(new URL('../src/data/campaign.js', import.meta.url))) return t.skip('src/data/campaign.js is not on this branch');
  const { CAMPAIGN_HOUSES, MISSIONS, missionDef } = await import('../src/data/campaign.js');
  assert.deepEqual([...CAMPAIGN_HOUSES].sort(), [...HOUSE_IDS].sort());
  for (const h of CAMPAIGN_HOUSES) {
    assert.equal(BRIEFINGS[h].length, MISSIONS, h);
    for (let n = 1; n <= MISSIONS; n++) {
      const def = missionDef(h, n), text = BRIEFINGS[h][n - 1].briefing, says = named(text, h);
      for (const e of def.enemies) assert.ok(says.includes(e), `${h} ${n}: the mission has ${e}, the briefing does not say so`);
      // The briefing may warn of Sardaukar drops the map leaves out, but names no Great House that is not there.
      for (const e of says) if (e !== 'sardaukar') assert.ok(def.enemies.includes(e), `${h} ${n}: the briefing names ${e}`);
      if (def.objective.quota) assert.ok(text.join(' ').includes(`${def.objective.quota} credits`), `${h} ${n}: quota ${def.objective.quota}`);

      // What the words state as fact (not as a warning), the mission must hold.
      const facts = sentences([...text, ...BRIEFINGS[h][n - 1].advice]).filter((s) => !HEDGE.test(s));
      const dropsIn = def.reinforcements.some((r) => r.house === 'sardaukar' && r.via === 'carryall');
      // Mission 4 is where every briefing says the Sardaukar Troopers come down by Carryall.
      if (n === 4) assert.ok(dropsIn, `${h} 4: the briefing says Sardaukar drop in by Carryall; the mission has no such drop`);
      for (const s of facts.filter((s) => /Sardaukar/.test(s) && /Carryall|\bdrop/i.test(s))) assert.ok(dropsIn, `${h} ${n}: "${s}" but no Sardaukar drop`);
      const sardaukarPalace = def.houses.some((x) => x.id === 'sardaukar' && x.structures.some((b) => b.type === 'palace'));
      for (const s of facts.filter((s) => /Sardaukar/.test(s) && /Palace|Death Hand/.test(s))) assert.ok(sardaukarPalace, `${h} ${n}: "${s}" but the Sardaukar have no Palace`);
      for (const s of facts.filter((s) => /\bgift\b/i.test(s))) {
        assert.ok(def.player.structures.some((b) => b.type !== 'constructionYard'), `${h} ${n}: "${s}" but the player starts with the yard alone`);
      }
    }
  }
});

test('the advice, once the Sega ladder is merged, names the factories it uses', async (t) => {
  if (!existsSync(new URL('../src/data/sega-tech.js', import.meta.url))) return t.skip('src/data/sega-tech.js is not on this branch');
  const { segaUnit } = await import('../src/data/sega-tech.js');
  const FACTORY = { Barracks: 'barracks', WOR: 'wor' };
  const UNIT = { 'Missile Tank': 'missileTank', 'Combat Tank': 'combatTank', 'Siege Tank': 'siegeTank', Quad: 'quad', Trike: 'trike' };
  for (const h of HOUSE_IDS) {
    BRIEFINGS[h].forEach((m, i) => {
      for (const s of sentences(m.advice)) {
        // "the WOR for Trooper squads": Troopers are trained where the ladder trains them
        const factory = s.match(/\b(Barracks|WOR)\b/)?.[1];
        if (factory && /\bTrooper/.test(s)) {
          const id = /squad/.test(s) ? 'troopers' : 'trooper';
          assert.equal(FACTORY[factory], segaUnit(id, h)?.at, `${h} ${i + 1}: "${s}"`);
        }
        // "already builds Missile Tanks": the house starts with that factory level, no upgrade bought
        const already = s.match(/\balready (?:builds|makes) ([A-Z]\w+(?: [A-Z]\w+)?)s\b/)?.[1];
        if (already) {
          const u = segaUnit(UNIT[already], h);
          assert.ok(u && u.level <= (HOUSES[h].startUpgrades?.[u.at] ?? 0), `${h} ${i + 1}: "${s}" needs ${u?.at} level ${u?.level}`);
        }
      }
    });
  }
});

test('the map captions, once the atlas is merged, match the land that changes hands', async (t) => {
  if (!existsSync(new URL('../src/data/territory.js', import.meta.url))) return t.skip('src/data/territory.js is not on this branch');
  const { changes, ownership } = await import('../src/data/territory.js');
  for (const h of HOUSE_IDS) {
    // Mission 1 takes no land; from step 2 a rival the caption names is one the atlas takes a region from.
    for (let s = 2; s <= 8; s++) {
      const losers = new Set(changes(h, s).map((c) => c.from));
      for (const e of named([MAP_CAPTIONS[h][s]], h)) if (e !== 'sardaukar') assert.ok(losers.has(e), `${h} step ${s}: "${MAP_CAPTIONS[h][s]}" but the atlas takes nothing from ${e}`);
    }
    // While the atlas leaves the Emperor his region after mission 9, the caption says so.
    if (ownership(h, 9).sardaukar.length) assert.match(MAP_CAPTIONS[h][9], /Emperor|Sardaukar/, `${h} step 9`);
  }
});
