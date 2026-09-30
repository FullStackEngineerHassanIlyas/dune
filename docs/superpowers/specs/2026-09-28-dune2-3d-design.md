# Dune II 3D — design spec

Date: 2026-09-28 · Status: draft for manager review · Research: `docs/research/README.md`

## 1. Understanding

**What the manager asked for**

- A web version of Sega's *Dune II: The Battle for Arrakis*, built with Three.js.
- Comprehensive web research on the game first (done: `docs/research/`).
- Gameplay like Westwood's later Command & Conquer games: mouse-driven.
- Buildings, units and graphics should copy the original game's designs, but as a real 3D
  game with good graphics and rich gameplay. It must not look 2D.
- Sounds and music may be the old game's.

**Assumptions (to be confirmed or corrected)**

1. Single player against computer opponents. No online multiplayer.
2. Content follows Dune II: three houses, the full unit and structure roster, the tech tree and
   factory upgrades, 9-mission campaigns, spice economy, sandworms, spice blooms, Starport,
   Palace weapons. Numbers come from the original tables (OpenDUNE), converted to real time.
3. The PC tech tree is used (House of IX, separate Light and Heavy Factory, Starport), because it
   gives more strategy than the simplified Genesis tree. The Sega influence shows in the look:
   bold house colours, chunky readable silhouettes, the Genesis name "Missile Tank".
4. C&C conveniences are added on top of the Dune II rules: multi-select, control groups, sell,
   rally points, production queues, attack-move.
5. Original audio is EA copyright and cannot be downloaded legitimately, so the game ships its own
   synthesized effects, an original FM-synth soundtrack in the Mega Drive style, and its own
   announcer voice. If the manager owns the original PC game, the game can read its `.PAK` files
   in the browser and play the original voices and effects; MP3/OGG music files can be assigned to
   the menu, peace and battle playlists. No original asset is committed to the repo.
6. Target: desktop Chrome/Firefox on the manager's laptop (Intel Alder Lake UHD iGPU, 16 GB),
   1080p at 60 fps on the Medium preset.
7. In-game text is English, like the original.

**Success criteria**

- `npm start` serves the game; no build step.
- Skirmish works end to end: choose house, deploy the MCV, build a base from the C&C sidebar,
  harvest spice, build an army, survive worms, destroy 1–3 AI opponents.
- Campaign works end to end for all three houses: house choice, Mentat briefing, territory map,
  9 missions, score and rank screen, progress saved.
- Every Dune II unit and structure exists as a recognisable, house-coloured, animated 3D model
  that follows the original design (Mentat art and in-game sprites in `docs/research/refs/`).
- The world reads as 3D: lit and shadowed dunes, rock plateaus and mountains, particles, fire,
  smoke, dynamic lights. Nothing looks like a flat sprite.
- 60 fps on Medium with about 150 units on the manager's laptop.

## 2. Approaches considered

| Option | Verdict |
|---|---|
| **Plain ES modules + vendored Three.js, no build step** | **Chosen.** Same setup as the SF2 project: runs from a tiny static server, `node --test` for the simulation, headless-Chrome smoke screenshots. |
| Vite + TypeScript | Better typing and hot reload, but adds an install/build step. The sim/render split plus JSDoc gives enough structure. |
| A heavier engine (Babylon, PlayCanvas) | Rejected: Three.js was requested. |

| Art option | Verdict |
|---|---|
| **Procedural models written in code** (primitives, lathe, extrude, tubes, merged per material, vertex colours, PBR materials, canvas-generated detail textures) | **Chosen.** One consistent style, trivial house recolouring, no asset pipeline, easy to iterate against the reference images. |
| Hand-modelled glTF files | No Blender here, slow iteration, and the result would still need recolouring logic. |

## 3. Architecture

```
index.html ── src/main.js ── scene router (title, menus, briefing, map, game, end screen)
                                  │
         ┌────────────────────────┼─────────────────────────┐
     input/ (mouse, keys,      sim/ (pure JS, no DOM,     render/ (Three.js)
     camera control,           no Three.js)               terrain, models, fx,
     command builder) ──cmds──▶ world.step() @ 20 Hz ──▶  overlay (brackets, bars),
                                  │ events               placement ghost, icons
     ui/ (sidebar, radar,  ◀──────┤                           ▲
     messages, menus)             └──── events ──▶ audio/ ─────┘ (sfx, music, voice)
```

- **Simulation** (`src/sim/`): deterministic fixed-step world at 20 ticks/s with a seeded RNG.
  It owns the map, houses, units, structures, projectiles, production, economy, fog, AI and
  win/lose. It never touches the DOM or Three.js, so it runs under Node for tests and soak runs.
- **Commands**: the player's input and the AI both produce the same command objects
  (`move`, `attackMove`, `attack`, `guard`, `stop`, `scatter`, `harvest`, `returnToBase`,
  `deploy`, `destruct`, `repairAt`, `capture`, `sabotage`, `setRally`, `build`, `hold`, `cancel`,
  `place`, `sell`, `repair`, `upgrade`, `superweapon`, `starportOrder`). They are applied at the
  start of the next tick.
- **Events**: each tick the sim appends events (`fired`, `impact`, `explosion`, `died`,
  `structurePlaced`, `productionReady`, `eva`, `wormEmerged`, `bloom`, `crushed`, ...). The
  renderer and audio drain them every frame.
- **Rendering** (`src/render/`) keeps a view object per sim entity id and interpolates between the
  previous and current tick, so animation is smooth at any frame rate.
- **Data** (`src/data/`): houses, units, structures, weapons, terrain movement table, tech levels,
  upgrades, missions, and one `tuning.js` holding every conversion constant.
- **Loop**: `requestAnimationFrame`; the sim catches up at most 5 ticks per frame; a hidden tab
  pauses the game.

Planned layout:

```
index.html  serve.mjs  package.json  vendor/three/ (three.module.js + used addons, MIT)
src/main.js
src/core/      loop, rng, events, settings, storage (localStorage / IndexedDB)
src/data/      houses, units, structures, weapons, terrain, tech, missions, tuning
src/sim/       world, map, mapgen, occupancy, pathfind, movement, combat, projectiles,
               production, economy, power, fog, sandworm, bloom, carryall, starport,
               palace, capture, orders, victory, ai/ (brain, build, army, defense)
src/render/    renderer, camera, sky, lighting, postfx, terrain (+ shader), decals,
               models/ (kit, materials, units/*, structures/*, instancer),
               fx/ (particles, explosions, projectiles, sonic, gas, worm, bloom, deathhand),
               overlay (brackets, health bars, drag box), placement, icons
src/input/     mouse, keyboard, camera-control, controller, groups
src/ui/        sidebar, radar, hud (credits, power, messages), cursors, menus, briefing,
               territory map, end screen, options, styles.css
src/audio/     engine, sfx (synth recipes), music (FM synth + sequencer), songs/,
               voice, original/ (pak, voc, loader)
tests/         node:test suites     scripts/ smoke.mjs, e2e.mjs (Chrome DevTools Protocol)
```

## 4. Game rules

All base numbers are in `docs/research/raw/units.md` and `raw/structures.md`; `src/data/`
copies them verbatim and `tuning.js` converts them.

### 4.1 Time and speed conversion (tunable)

| Quantity | Conversion |
|---|---|
| Ground speed (tiles/s) | `(0.25 + speedFactor / 24) × terrain / 192` — terrain value from the original movement table (sand 112–160, rock 112–160, concrete 255, mountain 64 for infantry, 0 = blocked). Keeps infantry from being unbearably slow while preserving the original order. |
| Air speed (tiles/s) | `speedFactor / 40` (Carryall 5, Ornithopter 3.75, Frigate 3.25) |
| Fire delay (s) | `fireDelay / 40` (Combat Tank 2.0 s, Soldier 1.1 s, Launcher 3.0 s) |
| Build time (s) | `buildTime × 0.45` at Normal speed (Wind Trap ≈ 22 s, Combat Tank ≈ 29 s, Heavy Factory ≈ 65 s) |
| Sight radius | original `fogUncoverRadius + 1` for units, original value for structures |
| Game speed | Slowest 0.5 · Slow 0.75 · Normal 1 · Fast 1.25 · Fastest 1.5 |

### 4.2 Map and terrain

- Tile grid; one tile = one world unit. Campaign maps 32–64 tiles square; skirmish 64 (classic),
  96 or 128.
- Terrain types from the original table: sand, dunes, rock, rock edge, mountain, spice, thick
  spice, bloom mound, concrete, wall, destroyed wall. Movement per type and movement class
  (foot, tracked, harvester, wheeled, air, worm) uses the original speed table.
- Generator follows the original algorithm (seeded noise → blur → threshold into
  sand/dune/rock/mountain → spice blobs with thick cores → bloom mounds) plus guarantees for
  playability: each start has a rock plateau of at least 12×12 tiles, all starts are connected for
  tracked units, spice lies within 15 tiles of every start, starts are spread evenly.
- Only rock, concrete and destroyed wall are buildable. Sand, dunes, spice and mountains are not.

### 4.3 Economy

- Harvester fills 0–100 %; a full load is worth 700 credits; about 20 s of harvesting on spice,
  about 5 s to unload at a Refinery. Loaded Harvesters are slower (original formula).
- Spice per tile: spice 250 credits, thick spice 750 (drops to spice, then sand, as it is mined).
- Storage: Refinery 1005, Silo 1000. The mission's starting credits count as storage until the
  built capacity exceeds them. Over-capacity spice is lost with a warning; losing a Refinery or
  Silo burns its share of the stored credits.
- Every Refinery arrives with a free Harvester, flown in by a Carryall from the map edge.
- A destroyed Harvester spills its load as a spice patch.
- Sell (C&C addition): refund `50 % × cost × HP %`, with a reverse-construction animation.
- Structure repair (C&C wrench): original cost model, about 40 % of the build price for a full
  repair from zero, paid per HP while repairing; pauses when credits run out.

### 4.4 Power

- Wind Trap produces 100 × its HP fraction, never below 50 when standing. Every other structure
  consumes its original `powerUsage`.
- Deficit: radar goes offline (static animation), production slows to the
  production/consumption ratio (minimum 25 %), turrets fire at half rate. The original's slow
  decay of all buildings is left out on purpose: it punishes without teaching.
- Sidebar power bar: green when production ≥ use, amber when short, red when use > 2× production.

### 4.5 Construction, production and tech

- **Placement**: every footprint tile must be buildable and free of units, and at least one tile
  must touch (8-neighbour) an own structure, concrete or wall. Concrete matters as in Dune II: the
  structure starts at `100 % − 50 % × (tiles not on concrete / footprint tiles)` HP. The ghost
  preview shows green (concrete), yellow (bare rock, HP penalty) and red (invalid) cells.
- **Production lines** (C&C sidebar): structures (Construction Yard); infantry (Barracks / WOR);
  light vehicles (Light Factory); heavy vehicles (Heavy Factory); aircraft (Hi-Tech Factory);
  Starport orders. Lines run in parallel; each line builds one item at a time with a queue of up
  to 9. Cost is paid progressively; with no credits the line pauses ("Insufficient funds").
  Each extra factory of a line's type adds 25 % speed (cap 2×).
- **Upgrades** (Dune II): appear as their own icons in the structure strip and are paid and timed
  like a build.

| Upgrade | Cost | Unlocks |
|---|---|---|
| Construction Yard 1 | 200 | Large concrete slab (2×2) |
| Construction Yard 2 | 200 | Rocket Turret |
| Barracks 1 | 150 | Infantry squad |
| WOR 1 | 200 | Trooper squad |
| Light Factory 1 | 200 | Quad (Harkonnen starts upgraded) |
| Heavy Factory 1 / 2 / 3 | 300 each | MCV / Missile Tank / Siege Tank (Ordos' third level is free) |
| Hi-Tech Factory 1 | 250 | Ornithopter (never for Harkonnen) |

- **Prerequisites** (Wind Trap implied for all): Refinery ← Wind Trap; Silo, Light Factory,
  Starport ← Refinery; Outpost ← Wind Trap; Barracks, WOR, Wall, Gun Turret ← Outpost;
  Heavy Factory, Hi-Tech, Repair Facility ← Light Factory + Outpost; House of IX ← Starport;
  Palace ← Starport; Rocket Turret ← Outpost + Construction Yard level 2.
- **Tech level** (campaign mission number, or a skirmish option 1–9) gates structures:
  1 Wind Trap, Refinery, Concrete · 2 Barracks/WOR, Silo, Outpost · 3 Light Factory ·
  4 Heavy Factory, Wall, large concrete · 5 Hi-Tech, Repair, Gun Turret, second infantry
  building · 6 Starport · 7 House of IX · 8 Palace.
- **House rosters**

| | Atreides | Harkonnen | Ordos |
|---|---|---|---|
| Infantry | Barracks: Soldier, Infantry | WOR: Trooper, Troopers | both |
| Light vehicles | Trike, Quad | Quad | Raider Trike, Quad |
| Heavy vehicles | Combat Tank, Missile Tank, Siege Tank, Harvester, MCV | same | Combat Tank, Siege Tank, Harvester, MCV (Missile Tank via Starport) |
| House special (needs IX) | Sonic Tank | Devastator | Deviator |
| Aircraft | Carryall, Ornithopter | Carryall | Carryall, Ornithopter |
| Palace | Fremen | Death Hand | Saboteur |

- **Starport**: sells standard vehicles and aircraft for the house; each type has stock (2–6,
  +1 every 90 s, cap 10) and a price re-rolled every 60 s with the original 40–160 % formula.
  Orders are paid immediately; a Frigate lands on the pad 30 s after the first order of a batch
  ("Frigate has arrived") and unloads everything.

### 4.6 Units and combat

- Flat damage, no armour classes (original). Cannons and guns always hit; rockets scatter by
  `range/256 + small` tiles as in the original, 1 in 16 wildly. Units that fire twice (squads,
  Trike, Quad, Siege Tank, Launcher, Devastator, Ornithopter) do so only above 50 % HP.
- Squads show three figures and drop to one below 50 % HP. Tracked vehicles crush enemy
  infantry they drive over. Vehicles below 50 % HP trail smoke. Harvesters, Trikes, Missile Tanks
  and MCVs explode on death with small splash.
- Turreted units (Combat, Siege, Missile Tank, Deviator) aim independently; Sonic Tank and
  Devastator turn the whole hull.
- **Special behaviour**

| Unit | Behaviour |
|---|---|
| MCV | Deploys into a Construction Yard (2×2) on a valid spot; "Unable to deploy here" otherwise. |
| Harvester | Auto-harvests the nearest spice, returns when full, remembers its field; a Carryall ferries it on long trips. |
| Carryall | Unarmed and not directly controlled: ferries Harvesters, delivers the free Harvester, carries damaged vehicles to a Repair Facility when told to repair. |
| Ornithopter | Fast, fragile air striker; hunts on its own when idle, accepts attack and move orders. |
| Sonic Tank | Wave travels 8 tiles, damaging everything on its path except Sonic Tanks and walls, weakening as it goes. Friendly fire is real. |
| Deviator | Gas missile turns enemy units in a small radius to the Ordos side for 40 s (tunable), then they revert. Aircraft, Harvesters, MCVs and worms are immune. |
| Devastator | Slowest, toughest tank; "Destruct" order: 3 s warning glow, then a centre blast plus 7 scattered blasts. |
| Infantry | Can capture an enemy structure below 25 % HP by walking in (Barracks, WOR, Outpost, IX and Palace cannot be captured). |
| Saboteur | Walks over walls; blows up the structure it reaches (500 damage plus splash) or 300 splash when killed. |
| Fremen / Sardaukar | Trooper-class infantry of their own sub-houses (sand brown / purple). |

- Stances: units auto-engage in weapon range when idle (Guard); `G` sets Area Guard (chase
  within a few tiles, then return); `A` attack-move; `S` stop; `X` scatter.

### 4.7 Palace weapons

The Palace adds a weapon icon with a charging clock at the top of the sidebar.

- **Death Hand** (Harkonnen): pick a target; a ballistic missile rises from the Palace and lands
  with scatter, then 17 blasts in a diamond out to 2 tiles, 150 damage each with falloff.
  Recharge 7 min.
- **Fremen** (Atreides): pick an area; five Fremen squads rise from the sand nearby and hunt on
  their own (uncontrollable, as in the original). Recharge 4 min.
- **Saboteur** (Ordos): one controllable Saboteur appears at the Palace. Recharge 4 min.
- AI Palaces fire automatically when charged.

### 4.8 Sandworms and spice blooms

- Worms spawn on large sand areas (skirmish setting: off / few / many; campaign from mission 3),
  roam unseen as a travelling sand ridge, and hunt using the original priority: wheeled 5000,
  tracked/Harvester 1000, infantry 100; ×4 if moving or firing, divided by distance, ×2 within
  2 tiles. Only units on sand are targets. A worm surfaces, swallows the unit whole, eats three
  units in total and then dives away. 1000 HP; after 400 damage it flees. First sighting plays
  "Warning! Wormsign!".
- Bloom mounds sit on the sand; a unit driving over or a shot hitting one erupts it (100 damage
  around it) and turns a radius of about 5 tiles into spice. New mounds appear over time so long
  games do not run dry.

### 4.9 Fog of war

- Unexplored tiles are black shroud with soft edges. Explored terrain stays revealed; enemy units
  are visible only inside current sight (original behaviour). Enemy structures stay as last seen.
- Radar (minimap) needs a powered Outpost; otherwise it shows "RADAR OFFLINE" static.

### 4.10 Enemy AI

One AI "brain" per computer house, thinking once per second:

- **Economy**: keep power positive, 1–2 Refineries, 2 Harvesters per Refinery (max 6), Silos
  when storage passes 80 %.
- **Base**: house-specific build order with priorities; placement search on rock near the base
  core; concrete under buildings on Hard; rebuild destroyed structures; turrets at approaches.
- **Army**: house roster mix per tech level; rally near base; attack waves whose size grows over
  time, aimed at the nearest player structure or at harvesters; damaged units retreat to repair.
- **Defence**: idle units and the nearest wave converge on attackers in the base.
- **Palace**: fires the house weapon at the most valuable visible cluster.
- **Difficulty**: Easy (70 % production speed, first attack after about 8 min, small waves),
  Normal (100 %, about 5 min), Hard (125 % production, +50 % harvest income, about 3.5 min,
  larger waves). The AI ignores fog, like the original.

### 4.11 Victory

A house is defeated when it has no structures and no MCV. Mission 1 is won by holding 1000
credits (or the mission quota). Skirmish ends when one side (the player, or all AIs) remains.

## 5. Presentation

### 5.1 Rendering

- WebGL2 renderer, ACES filmic tone mapping, sRGB output.
- Warm low sun with soft shadows that follow the camera (2048 High, 1024 Medium, off Low),
  hemisphere sky/sand bounce light, exponential haze in sand colour, gradient sky dome; the sand
  plane continues past the map edge so there is no void.
- Post-processing: MSAA render target (High) or FXAA (Medium), bloom tuned so only explosions,
  muzzle flashes and emissive lights glow, light colour grading and vignette.
- Draw calls kept under about 250: every unit and structure part is an `InstancedMesh` shared by
  all instances of that model; house colour comes from per-instance colour on "house paint"
  parts; per-instance attributes drive tread scrolling, light blinking and hit flashes.

### 5.2 Terrain

- Height field with 4 vertices per tile side on maps up to 64, 3 above: flat-ish sand with wind
  ripples, sculpted dunes, rock plateaus raised about 0.35 with sloped edges, jagged mountains up
  to about 2.5.
- Custom shading injected into `MeshStandardMaterial` (keeps PBR lights and shadows): blends
  sand, dune crests, rock with cracks and small craters, dark mountain strata, spice (orange-red,
  speckled, sparkling) and thick spice, concrete slabs with seams, bloom mounds; noise-perturbed
  borders so nothing is tile-blocky.
- Dynamic data textures: spice amount, concrete, shroud/visibility (soft-sampled), and a decal map
  (craters, scorch marks, tank tracks, harvest scars) painted on a canvas.

### 5.3 Models (after the Mentat art and in-game sprites)

Rebuilt after the Mega Drive sprites (`2026-09-30-genesis-detail-models.md`, research in
`docs/research/raw/visual-*.md`): units are painted in a three-tone house-colour ramp (navy → blue → cyan
for Atreides) with metal barrels, wheels and tracks; structures are house-neutral lavender machinery,
olive concrete, gold and brick on their own floors, with the house shown by a glowing orb in the
south-west corner. The tables below are the first-pass notes; the brief and research supersede them.

| Structure (tiles) | 3D design notes |
|---|---|
| Construction Yard (2×2) | Fenced yard, work platform, tall crane with swinging hook, bulldozer blade shapes |
| Concrete / large concrete | Flat grey slabs with seams |
| Wind Trap (2×2) | Two large ribbed half-dome air intakes with dark louvred mouths, pipes, a spinning turbine vent |
| Spice Refinery (3×2) | Cluster of domed cylindrical tanks and pipework plus a docking pad with house-colour chevron lights that pulse when a Harvester is due |
| Spice Silo (2×2) | Two big cylindrical tanks with domed caps, ladders, piping |
| Outpost (2×2) | Low bunker with a rotating radar dish on a mast and antennas |
| Barracks (2×2) | Walled compound, low buildings, stairs, flagpole with house flag |
| WOR (2×2) | Adobe fortress with arched windows, corner towers and a dome |
| Light Factory (2×2) | Hangar with open bay and gantry crane |
| Heavy Factory (3×2) | Large industrial hall, big bay door that opens when a vehicle rolls out, stacks and crane |
| Hi-Tech Factory (3×2) | White curved hangar with tall pylons and landing apron |
| Repair Facility (3×2) | Steel gantry frame over a repair pad, hoist arm working, sparks |
| House of IX (2×2) | Stepped blue-glass domes with green lights |
| Starport (3×3) | Landing pad with house-colour X and diamond lights, mushroom-shaped control towers, terminal |
| Palace (3×3) | Sand-stone palace with golden onion domes, ornate gold gate, towers |
| Gun Turret (1×1) | Round khaki bunker with a rotating long-barrel gun |
| Rocket Turret (1×1) | Same bunker with twin rocket pods |
| Wall (1×1) | Crenellated segments that auto-connect |

| Unit | 3D design notes |
|---|---|
| Soldier / Infantry | Stillsuit troopers with masks and rifles; squad of three |
| Trooper / Troopers | Bulky power-armour troopers with shoulder rocket launchers |
| Trike / Raider Trike | Three-wheeler with big rear wheels, front fork and twin guns |
| Quad | Four balloon-tyred buggy with dark canopy and twin guns |
| Combat Tank | Low tracked hull, rounded turret, single long barrel |
| Siege Tank | Longer, heavier hull, large turret with a heavy barrel |
| Missile Tank | Tracked hull with an angled twin rocket rack |
| Deviator | Same chassis with a single large gas missile on a rail |
| Sonic Tank | Tracked hull with a big golden horn-shaped emitter |
| Devastator | Huge twin-barrel tank on wide tracks |
| Harvester | Wedge-shaped armoured hopper on tracks, spinning front intake, spice dust while working |
| MCV | Long eight-wheeled carrier with a folded crane on top |
| Carryall | White long-fuselage lifter with jet pods, grapple claws and house-colour trim |
| Ornithopter | White dragonfly-winged craft with flapping wings and a pointed nose |
| Frigate | Large cargo ship that descends onto the Starport pad |
| Sandworm | Segmented ringed body, huge round maw lined with teeth, sand cascading off |
| Saboteur / Fremen / Sardaukar | Slim dark infiltrator / robed desert warriors / purple armoured elites |

Animations: turret aim, barrel recoil, wheels and scrolling treads, harvester intake, wing flap,
carryall claws, radar spin, turbine spin, crane swing, factory doors, pad lights; construction
rises out of scaffolding with dust (about 1 s); destroyed structures collapse into burning rubble.

### 5.4 Effects

GPU particle pools (additive fire/sparks, alpha smoke/dust/sand): muzzle flashes with short
lights, tracers, cannon shells, rockets with smoke trails, small/medium/large explosions with
debris and scorch decals, burning and smoking structures, vehicle dust trails, harvest dust,
sonic wave (travelling ripple), deviator green gas, Death Hand trail and cluster blast with
shockwave and camera shake, worm sand ridge and eruption, bloom eruption, construction dust.

### 5.5 Camera

Perspective RTS camera at about 55° pitch. Pan: screen edges, arrow keys, middle-mouse drag,
radar click. Mouse wheel zooms (close enough to admire models, far enough for battles).
Alt + middle-drag rotates and tilts; `Home` resets the view.

### 5.6 Interface

```
┌──────────────────────────────────────────────────┬───────────────────┐
│ message bar ("Construction complete.")            │ [Mentat][Options] │
│                                                   │ CREDITS  ▌▌ 2350  │
│                                                   │ ┌───────────────┐ │
│                 3D battlefield                    │ │ radar/minimap │ │
│                                                   │ └───────────────┘ │
│                                                   │ ▐ [Repair][Sell]  │
│                                                   │ ▐ [Palace weapon] │
│  selection panel: portrait, HP, orders            │ ▐ ┌─────┐┌─────┐  │
│  (Attack-move, Guard, Stop, Deploy/Destruct)      │ P │struct││units│  │
│                                                   │ o │icons ││icons│  │
│                                                   │ w │  ▲▼  ││  ▲▼ │  │
└──────────────────────────────────────────────────┴───────────────────┘
```

- Sidebar in the C&C layout: credits counter (rolling digits), radar, vertical power bar, Repair
  and Sell toggles, two strips (structures left, units right) with icons rendered from the real
  3D models, clock-wipe progress, READY / ON HOLD / queue-count badges, scroll arrows, hover
  tooltip with name, cost, build time and prerequisites.
- Styling after Dune II: dark bronze panels, gold trim, hazard-stripe rope borders, amber LED
  digits, house-colour accents.
- Overlay: C&C white corner brackets on selected units, health bars (selected, hovered, or damaged
  when enabled), group numbers, rally lines, drag box, placement grid.
- Cursors for select, move, no-move, attack, harvest, deploy, enter/capture, sabotage, sell,
  no-sell, repair, no-repair, target and edge scroll.

### 5.7 Controls

Default "Classic" scheme (C&C 1995), switchable to "Modern" in Options:

| Input | Classic | Modern |
|---|---|---|
| Left click | Select, or context order with a selection (move, attack, harvest, deploy by clicking the MCV, enter, capture) | Select |
| Right click | Cancel placement or mode, else deselect | Context order |
| Left drag | Box select | Box select |
| Shift + click / drag | Add or remove from selection | same |
| Double click | Select all of that type on screen | same |
| Ctrl + click | Force fire (ground or friendly) | same |
| Alt + click | Force move (crush through infantry) | same |
| Ctrl + 1–9 · 1–9 · double-tap | Assign group · select group · centre on group | same |
| A · S · G · X · D | Attack-move · Stop · Area Guard · Scatter · Deploy / Destruct | same |
| H / Home · Space | Centre on base · jump to last alert | same |
| Sidebar icon: left / right click | Start or resume, or place when READY / hold, then cancel with refund | same |
| Shift + left on icon | Queue five | same |
| Radar click | Jump camera; with a selection, order there (classic) | Left jumps, right orders |
| Esc · P | Menu · Pause | same |

Selected factory + click on ground sets a rally point; double-click a factory makes it primary.

### 5.8 Screens and flow

Title (live 3D flyover of dunes with a worm), main menu (Campaign, Skirmish, Options, Original
Game Files, Credits), house selection (original emblem artwork: hawk, ram, serpent), Mentat
screen, territory map, mission briefing, game, pause menu, mission result with statistics and
rank, skirmish setup (house, 1–3 AI opponents with house and difficulty, map size and seed,
starting credits, tech level, worms, fog, game speed).

## 6. Audio

- **Effects**: synthesized with Web Audio and rendered once into buffers at start: rifles,
  machine guns, cannons, rocket launch and whoosh, sonic hum, gas hiss, explosions in three sizes,
  crush, worm rumble and roar, bloom eruption, construction ratchet, placement clunk, sell,
  repair, UI clicks, error buzz, radar static, engine loops. Sounds are panned and attenuated by
  position relative to the camera, with a voice limit per sound type.
- **Announcer**: lines following the original's event list ("Construction complete",
  "Unit deployed", "Harvester deployed", "Enemy unit approaching", "Our base is under attack",
  "Warning! Wormsign!", "Radar activated/deactivated", "Frigate has arrived",
  "Missile launched", "Insufficient funds", "Building", "On hold", "Cancelled", "Unit lost",
  "Structure destroyed", "Mission accomplished", "Mission failed") plus acknowledgements
  ("Reporting", "Affirmative", "Moving out", "Acknowledged"). Pre-rendered once during
  development with an offline text-to-speech voice whose licence permits redistribution, given a
  radio filter, shipped as small audio files. Fallback: browser speech synthesis, then text only.
  Every line also appears in the message bar.
- **Music**: an FM synthesizer (YM2612-style operators and envelopes, noise drums) plays original
  compositions in the game's style (Phrygian-dominant and minor modes, drones, war drums): title,
  per-house briefing themes, three peace and three battle tracks, victory, defeat. Like the
  original, peace tracks shuffle and a battle track takes over when fighting starts near the
  player's forces.
- **Original files (optional)**: Options → *Original game files* lets the player pick the `.PAK`
  files from their own Dune II PC copy. They are parsed in the browser (PAK index, 8-bit VOC PCM),
  mapped to the same events (house-specific announcer voices, acknowledgements, effects) and cached
  in IndexedDB. MP3/OGG/WAV files can be assigned to the menu, peace and battle playlists the same
  way. Nothing is uploaded or committed.

## 7. Campaign

- Three houses, nine missions each; the territory map offers 2–3 regions per step, which choose
  the enemy house and map variant (as in the original).
- Mentats Cyril, Radnor and Ammon brief every mission with newly written text.

| # | Map | Objective | New technology | Opposition |
|---|---|---|---|---|
| 1 | 32 | Harvest 1000 credits | Wind Trap, Refinery, Concrete | Light patrols, no base |
| 2 | 40 | Destroy the enemy outpost | Barracks/WOR, Silo, Outpost | Small base |
| 3 | 48 | Destroy the base; worms appear | Light Factory | Small base |
| 4 | 56 | Destroy the base | Heavy Factory, Wall, large concrete, CY upgrade | Medium base; Sardaukar drops |
| 5 | 64 | Destroy the base | Hi-Tech, Repair, Gun Turret, second infantry building | Medium base |
| 6 | 64 | Destroy the base | Starport, Siege Tank | Large base |
| 7 | 64 | Destroy the base | House of IX, house tank, Ornithopter, Rocket Turret | Large base, harder AI |
| 8 | 64 | Destroy both rival houses | Palace | Two bases |
| 9 | 64 | Defeat the Emperor | everything | Two Sardaukar bases plus a rival house |

- Missions are generated from fixed seeds and parameters, with pre-placed enemy bases, starting
  forces, scripted reinforcements and worm settings. The AI gets harder with mission number (build
  speed and wave size, as the original scaled with mission number).
- End screen: spice harvested, units and buildings destroyed (player vs enemy), time, score, and
  the original 12 ranks from Sand Flea to Emperor. Progress is saved in localStorage.

## 8. Quality presets

| Preset | Shadows | Anti-aliasing | Bloom | Particles | Pixel ratio |
|---|---|---|---|---|---|
| Low | off | FXAA | off | 1500 | 0.75 |
| Medium (default on the manager's laptop) | 1024, 1 cascade | FXAA | on (half res) | 4000 | 1 |
| High | 2048, soft | MSAA 4× | on | 8000 | device (max 2) |

A frame-time monitor suggests a lower preset if the game stays under 40 fps.

## 9. Error handling

- No WebGL2: a clear message screen instead of a blank page.
- Audio blocked by autoplay rules: start the audio context on the first click; the title screen
  says "click to start".
- Speech synthesis missing: text messages only.
- Original files: unreadable or unknown files are skipped with a per-file report; IndexedDB
  unavailable (private mode) means loading still works for the session.
- Pathfinding: no path → nearest reachable tile; a unit with no progress for 5 s re-plans, then
  gives up and goes idle; path requests are budgeted per tick so big groups never stall a frame.
- Simulation invariants (no NaN positions, occupancy matches units) are checked in debug mode and
  in tests.
- WebGL context loss: pause and offer a reload.

## 10. Testing

- `npm test` (Node, no browser): data integrity (rosters, prerequisites acyclic, every reference
  valid), map generator guarantees, pathfinding, occupancy, production (progressive payment, hold,
  cancel refund, insufficient funds, prerequisites, upgrades), economy (700 per load, storage
  overflow, storage loss), power, combat (damage, fire-twice, scatter, crush, squads), specials
  (worm eats three then leaves, bloom fill, deviator conversion and revert, sonic path and immunity,
  capture, saboteur, Death Hand), fog, victory, campaign data, and a 15-minute AI-vs-AI soak with no
  exceptions, no NaNs, no stuck units, and both AIs building, harvesting and attacking.
- `npm run smoke`: headless Chrome screenshots of fixed scenes (title, skirmish start, structure
  gallery, unit gallery per house, battle, worm attack, fog, sidebar states, briefing, territory
  map, end screen), reviewed by eye against the reference images.
- `npm run e2e`: Chrome DevTools Protocol script plays the opening of a skirmish through real mouse
  events (select MCV, deploy, build and place a Wind Trap and Refinery, harvest, train a unit, move,
  attack) and checks the world state through a debug hook.
- Performance: `?fps=1` overlay and a 200-unit stress scene on the manager's GPU.

## 11. Delivery phases

Each phase ends with a working, tested game and its own implementation plan.

1. **Core and playable skirmish**: scaffold, all data tables, map generator, terrain, camera,
   lighting, sim core (occupancy, pathfinding, movement, commands), placement and concrete,
   production and sidebar, power, economy and Harvesters, standard units and turrets, combat and
   projectiles, fog and radar, selection and classic controls, groups and hotkeys, basic AI,
   models for all standard units and structures, basic effects and sounds. Factory upgrades count
   as already bought until phase 2 adds them. Result: skirmish against one AI, start to finish.
2. **All Dune II systems and audio**: House of IX specials, Ornithopter, Carryall behaviour,
   Starport and Frigate, Palace weapons, upgrades, walls, repair, sell, capture, rally points,
   sandworms and blooms, full AI with difficulties and up to three opponents, complete effects,
   FM music, announcer voices, original-file loader, options and quality presets, modern controls.
3. **Campaign and presentation**: title flyover, menus, house selection, Mentats, territory map,
   27 missions, reinforcements and objectives, results and ranks, saved progress, balance and
   performance passes on the manager's laptop, QA checklist, README.

Work happens in a local git repository with small commits (no remote, nothing pushed).

## 12. Intellectual property

Dune II code, art and audio belong to Electronic Arts; the Dune name to Herbert Properties. This is
a non-commercial fan remake: every model, texture, sound, melody, emblem and text is newly made,
and original files are only read from the player's own copy at runtime. The title screen says
"fan remake" and credits Westwood's original.
