# Phase 3 — missions stream (run a campaign mission)

Branch `phase3/missions`, from `phase3/integration` at dc2061e (the seams commit). Spec §7, §4.10, §4.11;
research `p3map/research.md` §1-2, §5-6 and `p3map/battle-flow.md` (§7 lists the gotchas this stream answers).
Contracts: C1 (mission data, consumed), C2 (launch and result), C9 (the 'reinforcements' line), C10 (Sega tech
rule, set), C11 (score inputs).

## Plan (each step with its proof) — all done

1. One alliance predicate, asked at every site where a house picks a foe or a target — `tests/alliance.test.mjs`
   (written failing first: 9 of 10 failed with a predicate that never allies).
2. Per-mission AI parameters and garrisons — `tests/mission-ai.test.mjs` (3 of 5 failed first).
3. `setupMission(def, { seed })` and `sampleMission(house, n)` — `tests/mission-setup.test.mjs`.
4. `createMission(world, def)`: objectives, the loss, the minimum time, reinforcements, standing orders, score
   inputs, the end message, the HUD line — `tests/mission-objectives.test.mjs`, `mission-reinforcements`,
   `mission-score`.
5. HUD objective line, end screen and game-menu words, the debug seam, the fly-over, the scene —
   `tests/hud.test.mjs`, `end-screen.test.mjs`, `mission-flyover.test.mjs`, `mission-scene.test.mjs`.
6. Real GPU: the HUD line at the start, a reinforcement coming down, the fly-over, the end screen, the in-game
   menu, the hand-off through the menu shell (a win with a handler, a loss without one).

## Design and decisions

- **Where it lives.** Mission rules are in `src/game/mission.js` (tests/voice.test.mjs scans `src/sim` for announcer
  keys), set-up in `src/game/mission-setup.js`; both Node-runnable. `world.mission.update(world)` runs inside
  `World.step` every five ticks, so a mission is as deterministic as the rest of the simulation (no clocks, no
  `Math.random`; Sets iterate in insertion order). `world.rules.victory` stays false: the mission owns the outcome
  and ends it once through `finishGame` (sim/victory.js).
- **Alliances (`src/sim/alliance.js`).** `world.teams` maps a house to its side, `null` (every skirmish) meaning a
  free-for-all; `friendly(world, a, b)` is true for the same house or one side. Asked in: combat targeting
  (`findTarget`, `validTarget`), retaliation and kill counts, explicit attack orders (unless forced), crushing,
  Deviator gas, sabotage, capture, damage/kill alerts, the AI's rivals, nearest target, intruders, walls, Palace
  and Saboteur targets, fog (allies share sight), a Carryall's close-combat check, and the skirmish victory rule
  (allies left alone together have won). Splash and the Death Hand still hurt everyone, as before. Every soak
  stays green: with `teams` null the predicate is plain equality.
- **AI parameters.** `createBrain(world, house, difficulty, mission)` puts `firstAttack`, `attackEvery` (→ waveEvery),
  `buildSpeed`, `incomeRate`, `passive` into `brain.params` over the difficulty's own; the six read sites go through
  one `tuning(house)`. The exported `DIFFICULTY` keeps exactly easy/normal/hard (the skirmish screen lists its keys).
  `passive` = builds and defends, no waves. Units a mission posts (`guard`, `areaGuard`, `ambush`) carry
  `u.garrison` and stay out of the attack waves; the AI's defence may still pull them, and the mission sends them
  back to their posts once they are idle.
- **Standing orders (C1).** guard = a guard order at the unit's tile; areaGuard = a guard order with its own
  `radius` 6 and `leash` 12 (combat.js reads `order.radius`/`order.leash`, default the old 3/6); ambush = a guard
  order with radius and leash 0 (it shoots only what its gun reaches) that springs into a hunt when an enemy ground
  unit comes within max(sight, range + 3) tiles or when it is hit; hunt = once a second an idle hunter gets an
  attack-move to `nearestEnemyTarget` (alliance-aware). Harvesters, MCVs and aircraft keep their own behaviour.
- **Set-up order.** Houses (player first, slot 0), concrete (rock tiles only), structures (each in a try: a bad
  entry is reported in `problems`, never fatal), then units (a taken tile moves to the nearest free one).
  `rules.airDelivery` is off while the bases go up, so a Refinery's Harvester stands at its dock at t = 0 with no
  Carryall; its 'Harvester deployed' line is dropped from the queue (the 'structurePlaced' events stay: the battle
  stage flattens the ground under them). A prebuilt Palace charges from t = 0 (armPalace, as before).
- **The map (C10).** `generateMap({ w, h, seed, players, sites, spiceFields, blooms })`. If the generator honours the
  sites (starts at the site centres on rock) nothing else happens; while it does not (today's mapgen), each site
  gets a round rock plateau here (radius `r`, mountains near the rim worn to rock, spice and blooms cleared). The
  fallback is only a stand-in until the scenarios stream lands; it is checked by the sample mission and the tests.
- **Objectives and the loss.** quota: `floor(credits) >= quota` at that moment (spending counts against you);
  quotaOrDestroy: either; destroy: no structure of any computer house left that counts (walls, slabs and turrets do
  not; a captured building has changed hands). The loss is checked first (a mutual wipe-out is the computer's
  win): the player has no counting structure. An MCV does not save you, but deploying it before the check does —
  and the loss needs a base to have stood (`hadBase`), so a def that starts the player with only an MCV is not lost
  at minSeconds. Nothing ends before `minSeconds` (default 120, the original's 7200 ticks at 60 Hz). On a loss the
  winner is the first computer house still standing.
- **Reinforcements.** At `at` seconds each group comes in. `via: 'carryall'` (default): one visiting Carryall per
  unit from `from` (north/east/south/west, level with the destination) or the nearest edge, side by side two tiles
  apart; `deliverByAir` gained a `from` point and flies back out the way it came. `via: 'edge'`: the units appear on
  the edge and drive (the enemy's to the player's base attack-move). Destinations: 'home' (the house's Construction
  Yard, else any building, else its site), 'enemy' (the player's base for the computer, the nearest enemy base for
  the player), or `{ x, y }`; landing tiles are free, distinct and preferably in the open (no building beside them).
  The player's group is announced once, when every unit is down (or, by edge, on entry): `world.events.push('eva',
  { house, key: 'reinforcements', text: 'Reinforcements have arrived.', x, y })` (C9; x, y give Space a target). The
  enemy's arrive quietly; those dropped on the player's base hunt. Air units in a group are skipped.
- **Starport (C1 `starport.stock`).** When the player's market opens it sells exactly the listed wares the house
  can buy, so many of each; the rest are taken off (sim/starport.js restocks only what is listed). The AI never
  shops, as before.
- **Score inputs (C2).** `world.onStructureKilled` is wrapped: a destroyed structure of a hostile house adds
  `max(1, floor(cost/100))` to killedValue, one of the player's to lostValue; walls and slabs are left out.
  `score()` = { minutes: floor(seconds/60)+1, credits: floor(credits), survivingValue (the player's standing
  structures but walls and slabs, turrets included), killedValue, lostValue }. `result()` is the whole C2 message.
- **End hand-off (C2), in GameView.** On 'gameOver' a mission waits 1.5 s (win: "Mission accomplished" is said)
  or 2.5 s (loss). A win then flies seven Carryalls in the house colour in a V across the view (render/flyover.js:
  one InstancedModel, 4.2 s, from below the bottom of the screen through the point looked at to beyond the top, a
  gentle climb at the end; it follows the battle's clock, so pausing holds it). Then `postToShell(result)`; in the
  shell nothing else shows (the campaign's handler saves and moves on). If no handler took it within 5 s, or the
  mission runs on its own, the end screen shows the mission's title under the heading with Play again (reloads
  the same address, same seed) and Main menu. `music.end` only plays with the end screen; in the shell the
  campaign's own screens have the music.
- **Menus.** `menuWords({ mission, inShell })`: Restart mission / Quit mission; quit posts `{ dune: 'quit',
  screen: 'campaign' }` in the shell, else goes to the main menu. A skirmish keeps its words.
- **HUD line.** `Hud.objective(text)` is a second element, made on first use (a skirmish never has one), styled
  inline (styles.css belongs to nobody): top centre of the battlefield under the message bar. GameView refreshes it
  every five ticks from `mission.hudLine()`: "<title> · 640 / 1000 credits" / "· 5 enemy buildings left" /
  "· Mission accomplished".
- **Debug seam.** `__dune.scene` comes from GameView's new `scene` option ('mission' here); `__dune.mission()`
  returns the mission's `debug()` (objective and text, progress, next reinforcement, pending, landed groups, hunters,
  ambushes, posts, outcome, score) plus `handoff` ('flyover' | 'posted' | 'screen') and the fly-over's state.
- **The scene.** `?scene=mission&house=&mission=[&seed=]` imports `src/data/campaign.js` dynamically and plays
  `missionDef(house, n)`; when the module or the def is missing it plays `sampleMission(house, n)` (our own def:
  a 56×56 map, the player in the south-west, two allied computer outposts — one passive — every standing order,
  Carryall and edge reinforcements, worms) and says so with `console.info`. Dev flags: `ticks=`, `focus=<house>`,
  `visibility=revealed`, plus the usual `dist`, `quality`, `fps`, `debug`.

## Measurements

- Set-up of the sample (56×56, three houses): 27-29 ms in Node. 200 sim seconds of it: 343 ms (0.09 ms a tick);
  400 s: 705 ms.
- Full suite under the lock: 948/948 pass in 85 s (the soaks, including the 4-house free-for-all, unchanged).
- Real GPU (Intel ADL, headless Chrome, ANGLE/GL, 1920×1080, Medium): the mission 29.6 fps · 243 draws, during the
  fly-over 30.2 fps · 231 draws; a skirmish for comparison 28.1 fps — headless Chrome holds about 30 here, so the
  fly-over costs nothing measurable. It allocates nothing per frame.
- Screenshots (scratchpad `shots/missions-*.png`): start with the HUD line, reinforcements by Carryall and the
  announcement, the V mid-flight (paused), the stand-alone end screen, the menu shell receiving 'missionEnd'
  (keys, won, score), and a loss in the shell with no handler falling back to the end screen after 5 s.

## How to test

- `node --test tests/alliance.test.mjs tests/mission-*.test.mjs tests/hud.test.mjs tests/end-screen.test.mjs`
- Smoke: `flock /tmp/dune-chrome.lock env SMOKE_PORT=8630 node scripts/smoke.mjs mission-start mission-reinforcements mission-enemy-base`
- By hand: `?scene=mission&house=atreides&mission=3` (the sample until the campaign data lands). A quick win for a
  look at the fly-over: `?scene=mission&house=atreides&mission=3&ticks=2400`, then in the console
  `const c = await import('/src/sim/combat.js'); for (const s of [...__dune.world.structures.values()]) if (s.house !== 'atreides' && !s.type.weapon && !s.type.isWall) c.destroyStructure(__dune.world, s, { house: 'atreides', id: 0, kind: 'unit' });`

## Open questions

- The Sega ambush trigger is not documented; ours springs at max(sight, range + 3) tiles or when hit.
- Whether the Sega shows the mission's Carryall fly-over after a loss too (we show it only after a win, as the
  research describes the win).
- The music during the fly-over: the battle director falls silent on 'gameOver' and the shell's victory music
  follows the hand-off; if the Sega plays a sting over the Carryalls, the music stream can add it on 'gameOver'.

## For the README

**Campaign missions.** `?scene=mission&house=atreides&mission=3` plays one mission of the campaign (house
`atreides`, `ordos` or `harkonnen`, mission 1-9; `seed=` changes the map). Objectives as on the Sega: store a credit
quota, or destroy every enemy building (turrets, walls and slabs do not count; captured ones do); you lose when
you have no building left — an MCV does not save you — and nothing is decided in the first two minutes. Every
computer house is allied with every other against you. Reinforcements arrive on schedule by Carryall or over a
map edge ("Reinforcements have arrived." — Space jumps there). The objective line under the message bar shows how
far along you are. A win ends with seven Carryalls in your house colour flying over the battlefield in a V; in
the menu the campaign then takes over, on its own the end screen offers Play again and Main menu. The in-game
menu says Restart mission and Quit mission. Until the campaign's mission data is in place the scene plays a sample
mission of our own.
