# Phase 3 — scenarios stream (the 27 campaign missions, mission maps, the Sega tech ladder)

Branch `phase3/scenarios`, from `phase3/integration` at dc2061e. Contracts C1 (mission data) and C10 (Sega tech,
mapgen sites). Sources: research.md §2 (PC mission template) and appendix A (all 66 PC scenarios), §6 (the Mega
Drive campaign table, tech ladder, units on sale, upgrades); battle-flow.md §4 (the sim APIs the data must suit).

## Plan (each step with its proof) — all done

1. Skirmish maps pinned before touching mapgen (hashes of ground, spice, blooms, starts for six calls) —
   `tests/mapgen.test.mjs` "stay byte-identical".
2. `generateMap({ sites })`: plateaus at the sites, tracked connectivity, a spice field by every site —
   `tests/mapgen.test.mjs` (written failing first).
3. The Sega ladder in `src/data/sega-tech.js`, followed by `src/sim/tech.js` when `world.rules.tech === 'sega'` —
   `tests/sega-tech.test.mjs` (written failing first); the skirmish tests (tech, opponents, upgrades,
   one-factory, starport, sidebar-model, ai, production) unchanged and green.
4. The 27 definitions: `src/data/campaign.js` + `src/data/missions/*` — `tests/campaign-data*.test.mjs`.
5. A headless build of every mission's world with the real sim APIs, 60 game seconds, `checkInvariants` —
   `tests/scenarios-helpers.mjs` `buildMissionWorld`, run by the three house files.
6. Real-GPU look at representative missions (a scratch copy of the tree whose `mission` scene builds the
   world from the definition; the copy is not committed) — pictures below.

## What a definition holds (C1)

`missionDef(house, n)` returns a fresh plain-data copy (built once, then `structuredClone`d):
`{ id, house, mission, title, enemies, objective, minSeconds: 120, map: { w, h, seed, sites, spiceFields, blooms },
visibility: 'shroud', worms, rules: { tech: 'sega' }, techLevel: n, player, houses, reinforcements, starport }`.

- **Sites.** `map.sites[0]` is always the player (`id: 'player'`), then one site per computer base (`ordos`,
  `ordos-2`, ...), then mission 1's patrol outposts (`post-1..3`). `generateMap(def.map)` returns
  `starts` = the site centres in that order.
- **Player.** A Construction Yard on a 2x2 concrete pad in the middle of the player's site and the Mega Drive
  start force in front of it (heading towards the nearest enemy base). `upgrades` holds the house's start
  levels (the Harkonnen `{ heavyFactory: 1 }`, the Quad, as `houses.js` gives them).
- **Computer houses.** `houses` lists exactly `enemies`, in order. A house that holds bases has its
  structures (turrets included), concrete under every footprint, units with orders (`guard` for infantry,
  `areaGuard` for vehicles, `hunt` for the first one or two light vehicles from mission 2, `ambush`/`areaGuard`/
  `hunt` on the mission 1 outposts), `upgrades = segaUpgrades(id, n)` (every factory level its mission allows,
  so the AI can build its units), `techLevel: n`, `credits` and `ai`. A house without a base (mission 1's
  patrols, the Emperor's Troopers in 4 and 8) has `ai.passive: true`.
- **`ai`** — `difficulty` easy (2-3), normal (4-6), hard (7-9); `firstAttack` 420 → 210 s and `attackEvery`
  240 → 125 s falling, `buildSpeed` 0.6 → 1.3 and `incomeRate` 0.8 → 1.5 rising (PC: the factory speed cap
  rises with the mission, research §0.2). In mission 8 the second house attacks 60 s after the first.
- **Reinforcements** (PC timing, research §2; minutes × 60, sorted by `at`): the player's by Carryall `to: 'home'`
  from mission 3; the computer's by Carryall `to: 'enemy'` (the receiver's foe: they land in the player's base,
  as the PC "Enemybase" drops did) or by the map `edge`. `from` is the map side nearest the receiver's base (for
  the Sardaukar drops, the side opposite the player). The Emperor's four Trooper squads drop at 20 min in
  mission 4 and 30 min in mission 8 (`house: 'sardaukar'`).
- **Starport** from mission 6: the PC CHOAM counts for the Mega Drive wares (Siege Tank from 7, Ornithopter from
  8), kept to what the house may buy (the Ordos' Missile Tank through `STARPORT.extra`).

## Decisions

**Mega Drive first, PC where it is silent** (CLAUDE.md lesson). Objectives (1: store 1000; 2: store 2700 or destroy
the base; 3-9: destroy every base), enemies and the number of bases (Ordos 5: two Harkonnen bases; 6: two for
Ordos and Harkonnen; 7: two for everyone; 8: one base each of two houses; 9: two Sardaukar bases), map size
(32 for 1-2, 64 from 3), worms (none in 1-2, `few` from 3), starting credits and start forces come from the Mega
Drive table. Where it names no units (Atreides 3, Ordos 3-4, Harkonnen 3-4) the PC scenario's force is used, cut
to the Mega Drive unit count. Base sizes, enemy credits and the reinforcement lists follow the PC scenario of the
same mission, on the Mega Drive's single vehicle factory and without the House of IX. Mission 9 follows the
Mega Drive (two Sardaukar bases); the PC's two rival houses are not there.

**Seeds** are the PC scenarios' first-region seeds (appendix A) fed to our generator — a nod, not a copy; mission 9
uses 392 with no symmetry for every house, so the last battlefield is the same map for all three, as on the PC.

**Maps.** Four site arrangements (`plan.js ARRANGEMENTS`: three outposts on a 32 map; one base on 32; one base on
64 across the diagonal; two bases on 64 with the player between them) turned by one of the eight symmetries of
the square per house and mission, so no two missions share a map (tested). Mapgen stamps a rock plateau of the
site's radius (r 6-8 for the player, 7-12 for bases, 3 for outposts), connects the sites for tracked units and
opens a spice field at `siteSpiceSpot`: five tiles past the plateau's sure square towards the map centre, turned
aside when another site is in the way (the 32 maps), on a sand basin it opens if rock or mountain stands there.

**Layouts** (`layout.js`): the packer only uses the square a plateau is sure to cover with rock
(`plateauHalf(r)`), so every building is on rock whatever the seed does elsewhere. Turrets go first, spread along
the front edge; then each building takes the free spot nearest its anchor (yard in the middle, Refinery and Silos
towards the spice spot, factories and infantry buildings to the front, Wind Traps behind, Hi-Tech, Starport and
Palace to the back corners), always one free tile from every other building, so harvesters, exits and attackers
have lanes. Units take the free tiles in front on a loose chequer, never in a building's door row.

**Enemy forces by role** (`ROLES`): one soldier, a squad, the light vehicle, Quad, tank, missile, siege, special,
turned into each house's own unit. The Ordos "missile" is a Combat Tank (not their roster); the Sardaukar
"special" is a Siege Tank (their roster has no House special). Enemy units stay within the mission's ladder or one
step ahead (the Mega Drive itself gives the player a Quad in mission 2).

**The Sega ladder** (`sega-tech.js`, research §6): structures by mission (2x2 slab, Wind Trap, Refinery 1;
Outpost, Silo, Barracks/WOR 2; vehicle factory 2, Harkonnen 3; Wall 4; Hi-Tech, Repair, Turret 5; Rocket Turret,
Starport 6; Palace 8), no 1x1 slab and no House of IX; the factory ladders and their prices (yard 200 Rocket
Turret at 6; Barracks 150 Infantry at 2; WOR 200 Troopers at 4; vehicle factory 200 Quad at 3, 200 Harvester and
Combat Tank at 4, 300 MCV at 4, 300 Missile Tank at 5, 300 Siege Tank at 6 — the Ordos at 7; Hi-Tech 250
Ornithopter at 7, never the Harkonnen); the special tanks need the Hi-Tech and mission 7. A level that opens
nothing for a house is skipped by its purchase (the Ordos go from the MCV level straight to the Siege Tank).
`tech.js` reads it when `world.rules.tech === 'sega'`: `canBuild` and `buildOptions` mark the world's houses
(`house.techRules = 'sega'`) so the helpers that get a house alone (`upgradeCost`, `upgradeResult`) agree with
them; `applyTechRules(world)` does the same at once. New exports: `segaUpgrades(house, n)`, `segaOpens(n, house)`
(what a mission opens, for a briefing), `factoryOf(house, unit)`, `unitUpgrade(house, unit)`,
`maxUpgradeLevel(house, type)`, `starportSells(house, unit)`, `itemCost(house, item)`. Skirmish worlds
never get the mark and keep the PC tree.

**Deviations, on purpose:**
- The Mega Drive Ordos train Troopers through Barracks upgrades (150 Trooper at 4, 200 Troopers at 6).
  `production.js` spawns a unit at `units.js builtAt` (the WOR), so for now the Ordos may build a WOR from
  mission 4 and train Troopers there (Troopers squad at 6, 200 credits, as on the Mega Drive); Ordos bases from
  mission 4 hold a WOR. One switch, `ORDOS_TROOPERS_AT` in `sega-tech.js`, plus a one-line `production.js`
  change (below) gives the Mega Drive way; data and tests follow the switch.
- The 2x2 slab costs 15 on the Mega Drive; production and the sidebar read 20 from `structures.js` until they
  ask `itemCost(house, item)` (below).
- The Mega Drive Starport sells the Trike to the Ordos and Harkonnen; their `units.js` roster has no Trike, so
  their stock leaves it out.
- No walls in the prebuilt bases (the PC had some from mission 4): they would close lanes the packer keeps open.

## How to test

- `node --test tests/mapgen.test.mjs tests/sega-tech.test.mjs tests/campaign-data.test.mjs tests/campaign-data-atreides.test.mjs tests/campaign-data-ordos.test.mjs tests/campaign-data-harkonnen.test.mjs`
  (about 6 s; each house file runs its nine worlds for a game minute).
- `tests/scenarios-helpers.mjs`: `buildMissionWorld(def)` (the world as mission-setup should build it) and
  `checkMission(def)` (every C1 field, types and rosters on the Sega ladder, rock, overlaps, concrete, free
  passable unit tiles, tracked reach from the player to every site, building and enemy vehicle, spice by the
  player and every Refinery); a test feeds it broken definitions to prove it catches them.
- Look: once the missions stream's scene lands, `?scene=mission&house=ordos&mission=5`.

## Measurements (Node 24, this machine, other streams running)

- Importing `campaign.js` 67 ms (it pulls the sim's tech and mapgen); building all 27 definitions 164 ms
  (about 6 ms each, once — then cached).
- `generateMap` of all 27 mission maps 275 ms (about 10 ms for a 64 map); building the 27 worlds 259 ms;
  60 game seconds of all 27 with AI 6.3 s (worst Ordos 8, 0.48 s).
- Biggest worlds: mission 9, 45 structures and 28 units at the start; mission 6, 27-31 structures, 29-31 units.
- Full suite under the lock: 948/948 pass, 61 s; after the review fixes 951/951, 78 s.

## Pictures (real GPU, scratch preview scene)

`scratchpad/shots/scenarios-a6-base.png` (Atreides 6, the Harkonnen base: 19 buildings on concrete, turrets on
the front edge, Refineries by the spice), `scenarios-o2.png` (Ordos 2 on the 32 map), `scenarios-h9.png`
(a Sardaukar base of the shared last map), `scenarios-a1.png` (mission 1: the yard and three rock outposts),
`scenarios-o5-wide.png` (Ordos 5 whole: two Harkonnen bases north, the player south, spice between).

## Open questions and integration

- **production.js:154** (nobody's file): `spawnFromFactory` filters factories by `s.typeId === t.builtAt`; use
  `factoryOf(house, typeId)` from `tech.js` instead, then set `ORDOS_TROOPERS_AT = 'barracks'` in
  `src/data/sega-tech.js` for the Mega Drive's Barracks Troopers. Not needed for anything to work today.
- **ui/sidebar-model.js:52** (nobody's file): pass `house` instead of `houseId` to `upgradeUnlocks` so a Sega
  upgrade's tooltip names what the Sega level opens (today it names the skirmish level's units); and at :46
  `cost: itemCost(house, typeId)` (the Sega slab shows 15).
- **ui/selection-panel.js:23** (nobody's file): ``const top = maxUpgradeLevel(world.houses.get(houseId), s.typeId);
  if (top) details.push(`Upgrade level ${...} of ${top}`)`` — today a Sega mission-6 factory reads "level 5 of 4" and
  the yard "level 1 of 2".
- **sim/production.js:36** (nobody's file): `cost: itemCost(house, typeId)` in `makeItem`, so the Sega slab costs 15.
- **sim/starport.js:35** (nobody's file): `for (const t of wares(house.id).filter((t) => starportSells(house, t)))`
  in `market()`, so a Sega Starport never offers a Siege Tank before 7, an Ornithopter before 8 or a Carryall
  (skirmish unchanged: `starportSells` is always true there, the rolls stay the same). The missions stream's
  `stockStarport` already trims the player's market to `def.starport.stock`; this also covers the computer's.
  All four lines were tried together on a scratch copy: the reviewer's probes pass and the sidebar, selection
  panel, Starport, production, upgrade and one-factory tests stay green (73/73).
- **sim/ai.js:464** (missions): `UNITS.mcv.upgrade` → `unitUpgrade(house, 'mcv')`, so a computer that lost its
  yard on the Sega ladder buys the right level for an MCV (prebuilt bases from mission 4 already hold it).
- **sim/ai.js:288** (missions): `ixOpensSomething` should be false on the Sega ladder (`house.techRules === 'sega'`):
  there is no House of IX, so a computer would otherwise put up a Starport it never uses (it never shops).
- **game/mission-setup.js** (missions): set `world.rules.tech = def.rules.tech` (or call `applyTechRules(world)`
  after adding the houses); `Object.assign(house.upgrades, h.upgrades)`; paint `concrete` (slot + 1), then
  `spawnStructure` every structure (with `rules.airDelivery` off while building, each Refinery's free Harvester
  appears at its dock instead of flying in), then `spawnUnit`s; seed the player's Starport market from
  `def.starport.stock`; ally every computer house (`setAlliances(world, [computers])`, `sim/alliance.js`, C1).
  `tests/scenarios-helpers.mjs buildMissionWorld` is a working reference: it allies them too once `alliance.js`
  is there (a dynamic import; on this branch alone the computers still fight each other in the 60 s runs).
- Is a Trike for the Ordos and Harkonnen at the Starport wanted (a `STARPORT.extra` entry, lead's file)?

## Review fixes

- Sega worlds: `tech.js` exports `maxUpgradeLevel` (the selection panel's "of n"), `starportSells` (the Mega Drive
  wares by mission) and `itemCost` (the Sega upgrade prices and the 15-credit slab); the files that should call
  them are nobody's, so the one-line changes are listed above. Tests in `tests/sega-tech.test.mjs`.
- The prebuilt bases of missions 8 and 9 start on full power: two more Wind Traps each (M8 500/455 and 500/385,
  M9 900/720 at the start; before 300/455, 300/385 and 500/720, turrets at half rate).
- Mission 3's base holds 10 armed units, below the easy AI's cap of 12 (was 14, so it built nothing for six
  minutes and banked 3000-4700 credits; now it trains Quads, Troopers and infantry within those six minutes).
- `checkMission` now also fails a computer base short of power or starting at its difficulty's army cap; it
  caught exactly the nine M3, M8 and M9 cases on the old data.
- `tests/sega-tech.test.mjs` prices follow `ORDOS_TROOPERS_AT` (Barracks 150, 150, 200 once it is
  `'barracks'`): with that switch and the `production.js` change the suite stays green.
- `buildMissionWorld` allies the computer houses through `sim/alliance.js` when present. With the missions
  branch's `alliance.js`, `combat.js` and `ai.js`, Harkonnen 8 has no computer-on-computer kills in six game
  minutes (before: 33 Ordos units, 27 Atreides units and 4 buildings).
- This notes file sits in `docs/superpowers/notes/` like the Phase 2 streams' notes; the lead keeps it or moves
  it into the PR text.

## For the README

### The campaign

Three houses, nine missions each, as the Sega Mega Drive release runs them: mission 1 asks for 1000 credits of
spice against roaming patrols, mission 2 for 2700 credits or the enemy's small base, and from mission 3 every
enemy base must go — two bases of one house in the later missions, two houses at once in mission 8 and the
Emperor's Sardaukar in mission 9. The first two missions are played on small 32-tile maps, the rest on 64; worms
appear from mission 3, the Emperor drops Sardaukar Troopers from mission 4, and the computer builds faster,
earns more and attacks sooner as the campaign goes on. Each mission opens the buildings and units of the Mega
Drive's tech ladder: one large concrete slab, the vehicle factory from mission 2 (Harkonnen 3), Quad, Harvester
and Combat Tank, MCV, Missile and Siege Tank through its upgrades, the Hi-Tech Factory, Repair Facility and Gun
Turret at 5, Starport and Rocket Turret at 6, the house's special tank and the Ornithopter (from the Hi-Tech) at 7
and the Palace at 8. There is no House of IX.
