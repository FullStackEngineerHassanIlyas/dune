# Phase 2 — sandworms and spice blooms (spec §4.8)

Branch `phase2/worms`, from `improve/visibility` (`5719049`). Research read first: units.md
"Sandworm", mechanics-campaign.md §1.3 and §6, visual-units.md §2.22, audio-ui-controls.md (the
wormsign line). Where the brief and the original differ, the brief's reading is noted below.

## Plan (each step with its proof)

1. Simulation: `src/sim/worm.js`, `src/sim/bloom.js`, wired into `world.js` and `combat.js` —
   `tests/worm.test.mjs`, `tests/bloom.test.mjs` (and a mutation pass: ten deliberate breaks of the
   rules, each caught by a failing test).
2. Announcer: every worm warned about on first sight — `tests/announcer.test.mjs`.
3. Sound: four synth recipes and their cues — `tests/synth.test.mjs`, `tests/cues.test.mjs`, loudness
   and length measured (below).
4. Pictures: `src/render/worm-views.js`, `bloom-views.js`, `sand-fx.js`, through `battle-stage.js` —
   `tests/worm-views.test.mjs`, then real-GPU screenshots.
5. Showcase: `scene=battle&worms=few|many`, smoke scenario `battle-worms` — run on the real GPU.

All done; `npm test` 738/738.

## The worm (sim/worm.js)

- A worm is a unit in `world.units` (type `sandworm`, 1000 HP, the units.md row) of the pseudo-house
  `WORM_HOUSE = 'worm'`, which is not in `world.houses` (no fog layer, no stats, no AI, no victory
  check; the original files worms under its non-playable Fremen house). It **holds no tile**
  (`World.spawnUnit` skips `map.unit` for it), moves over the original's SLITHER ground only (sand,
  dune, spice — the terrain table already had the column) and is moved by its own update, not by
  `movement.js`: paths from the world's A* queue with corners cut where the sand runs straight, and
  a straight dash at prey within three tiles.
- **Prey** (OpenDUNE `Unit_Sandworm_GetTargetPriority`): Foot/Saboteur 100, Tracked and Harvester
  1000, Wheeled 5000, everything else 0 (aircraft, worms); ×4 if the unit is moving or has a fire
  cooldown running; divided by the distance in tiles (the original's `max + min / 2`, rounded up); ×2
  within two tiles. Only a unit standing on sand or dunes counts (`map.isSand`: no slab, no building).
  The best over the whole map wins, as `Unit_Sandworm_FindBestTarget` does, but only among units on
  the worm's own stretch of sand (`world.reach`) — the original instead tried, failed to path and
  slept 720 ticks.
  - The brief's "×2 within 2 tiles" is read as rounded distance ≤ 2; OpenDUNE's code says `< 2`.
  - The original also ignores units on tiles the (single) human player has not uncovered. Our world
    has no single player, so that player-centred rule is left out.
- **Hunt and swallow**: within 0.9 tiles it surfaces (`wormSurfaced`), its head rising 0.6 s and
  tracking the prey; at the top the prey is swallowed whole — `killUnit(…, 'eaten')`, which skips
  the aftermath: no blast, no splash, no spilled spice, no wreck (the original removes the unit). It
  stays up 1.6 s and takes anything else on the sand in its maw (0.6 s apart: the original's
  12-tick cooldown), sinks in 0.7 s and digests 2.5 s before looking again. Lying still between
  wanders it still notices prey.
- **Three meals** (`amount = 3` in OpenDUNE pool/unit.c) and it leaves: dives, travels off under
  the sand along its longest open run for 5 s as a fading ridge, and is removed (`wormGone`, reason
  `dived`). **Flees** after 400 damage the same way (`wormFled`). It can be shot **only while up**
  (`u.submerged` makes `findTarget`/`validTarget` pass it over; stray shots and the sonic wave find a
  risen worm within 0.9 tiles of their landing point). Splash from aftermath/Death Hand can still
  reach one under the sand — not a shot, and those files are not this stream's.
- **The director** (`updateWorms`, once a second): `world.rules.worms` — 'off' 0, 'few' 1, 'many' 3
  at a time; anything else or missing reads 'few' (contract 1). The first comes 90–150 s in ('few')
  or 25–50 s ('many'); after one goes the next comes 90–180 s / 30–70 s later. Birthplace: a sand
  tile on a stretch of at least 150 tiles, 14 tiles from every building and MCV, 7 from other units,
  12 from other worms.
- **A bare `World` has `rules.worms = 'off'`** (like `rules.victory`): tests, the battle scene and
  the menu backdrop stay worm-free unless they ask. Skirmish and campaign set it.
- **Dice**: worms and blooms roll `world.wildRng`, seeded `seed ^ hashString('shai-hulud')`. Same seed,
  same worms (tested); and adding worms never reshuffles `world.rng`, so every other system's outcome
  in existing games and tests is unchanged (tested: `world.rng` reads the same with and without worms).

## Blooms (sim/bloom.js)

- `map.bloom` mounds (placed by mapgen) burst when a ground unit drives onto one
  (`World.onTileEntered`), when a shot lands on one, or when a sonic wave passes over it. Worms swim
  under them; aircraft never touch them.
- The burst (`Map_Bloom_ExplodeSpice`): 100 damage to every ground unit and building within 1.5 tiles
  (the brief; the original removes the unit on the tile), then every sand tile within distance 5
  (`max + min / 2`) becomes a spice field (`SPICE_PER_TILE`, thick spice kept), the outermost ring a
  coin flip each: 49 tiles certain, up to 24 more — about 60 tiles, ~15 000 credits.
- Regrowth: every 90–180 s, if the map has fewer mounds than it began with, one grows on open sand —
  no spice within 2 tiles, 8 from buildings, 3 from units. A map that began with none grows none.
  Blooms never burst on their own (that is Dune 2000); the spec's "long games do not run dry" comes
  from the regrowth plus players (and harvesters) setting them off.
- `world.bloomRevision` bumps on every burst and growth, for the views.

## Announcer

`announcer.js` now warns about each worm the first time the player sees it ("Warning: wormsign."),
even right after an approach warning (before, the 20-second throttle of approach warnings swallowed
it), and ahead of an enemy seen in the same look. Seen = the worm's tile in the player's fog: its
ridge where the player can see; in 'shroud' that is anywhere explored, in 'fog' only current sight,
in 'revealed' everywhere. (voice.js keeps its own 30 s limit on repeating the spoken line.)

## Pictures

- `render/worm-views.js`: under the sand, a ridge — one swell of churned sand over the head
  (0.85 × 0.72 tiles, 0.21 high, lobed and clodded geometry, coloured like the terrain's sand) and up
  to 14 smaller swells behind it that settle within 1.4 s; a bow wave of sand off its flanks, a
  darker furrow on the decal map, a low mound when it lies still, fading as it leaves. Up: the head
  model rises out of a collar burst and a churned crater mark, follows its prey, lunges (rises and
  tilts) as it swallows, sinks back in another burst; killed, it sinks for good in a big one. Drawn
  only where the viewer's fog shows. Unit views hand worms to it (picking positions included); a
  swallowed unit leaves no wreck and no falling figures.
- `render/bloom-views.js`: mounds as cracked rust-red blisters with bulbs, breathing slightly, shown
  where the viewer has explored. A burst: dust ring, sand and dark spice fountain, clods, glints, a
  crater; the dust cloud follows 0.9 s later (the shared pool draws in spawn order, so a cloud made
  at once hid the fountain).
- `render/sand-fx.js`: the particle recipes, spawned into the battle's shared pools — within the
  preset's particle budget and scaled by its detail. Draw calls added while worms/blooms exist: one
  for every swell, three for the head model (paint, dark, metal), one for every bloom mound.
- Nothing is allocated per frame (trail rings are typed arrays; matrices reused); a bloom burst
  allocates one small array for its delayed cloud.

## Sound

| Cue | When | Length | Loudness | Energy above 200 Hz |
|---|---|---|---|---|
| `wormRumble` | every 1.25 s while a visible ridge moves near the camera (overlapping 1.6 s rumbles) | 1.6 s | −22 LUFS | 40 % |
| `wormRoar` | surfacing, fleeing, dying | 1.8 s | −14 LUFS | 46 % |
| `wormGulp` | each swallow (crunch, gulp, growl) | 1.5 s | −15 LUFS | 50 % |
| `bloom` | a bloom bursting | 2.0 s | −14 LUFS | 51 % |

One variation each; the bank grows from 91.8 s to 98.6 s (its test limit went from 95 s to 100 s,
about +0.9 MB of float samples). Rendering them takes ~135 ms, in the synth worker. Eaten units make
no debris sound.

## How to look at it

- `?scene=battle&worms=many&dist=18` — the middle of the field becomes sand with dunes, two blooms
  lie on it (one on the armies' way: a quad sets it off at ~8 s), a worm comes from the south at once,
  surfaces at ~7.8 s and has eaten three units by ~15 s; more follow ('few' or 'many' as given).
  Add `&idle=1` to keep the armies home and watch a worm roam.
- Smoke: `flock /tmp/dune-chrome.lock env SMOKE_PORT=8593 node scripts/smoke.mjs battle-worms`.
- Skirmish (until setupSkirmish passes the setting): in the console,
  `__dune.world.rules.worms = 'many'`, or `(await import('/src/sim/worm.js')).spawnWorm(__dune.world, x, y)`.

## Measurements

- Real GPU (headless Chrome, ANGLE/GL): battle scene 50.3 fps without worms, 52.1 fps with a worm
  roaming in view — no measurable cost. No console errors in any capture.
- Simulation: 15-minute AI-vs-AI skirmishes (64×64), step average 0.13–0.18 ms with worms; 'few':
  one worm at 2.1 min, three meals by 12.8 min, gone; 'many': four worms, harvesters eaten in the
  first two minutes.

## Open questions and integration

- **Skirmish default and the long tests.** With `world.rules.worms = 'few'` in every setupSkirmish,
  five existing tests that run generated skirmishes for minutes fail (worms eat harvesters and
  soldiers): ai.test "first wave after the attack timer", "lost yard … redeploys", money.test
  "twelve game minutes without a credit made or lost", soak-ai "fifteen game minutes", harvest soak
  "every harvester keeps delivering". Either those tests pass `worms: 'off'`, or setupSkirmish
  defaults to 'off' and the skirmish menu/URL default to 'few'.
- The AI (ai.js `defend`, `nearestEnemyTarget`, `enemyCentre`) treats a worm as an enemy unit; it
  should skip `u.house === WORM_HOUSE` (or at least `u.submerged`), or it may order attacks that are
  dropped at once.
- The controller offers "attack" over a ridge; candidates could skip `u.submerged` (selecting a worm
  to look at it is fine, as in Dune II).
- The radar draws worms in its fallback white — what the original does; an explicit colour is up to
  radar-model.js.
- README: the battle flag `worms=few|many` and the smoke scenario `battle-worms`.
- The title screen's "flyover of dunes with a worm" (spec §5.8): the showcase world could set
  `rules.worms` or spawn one with `spawnWorm`.
- engine.js: `wormRoar` would sit well among the PRIORITY sounds.
