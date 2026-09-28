# Dune II: The Battle for Arrakis — Structures Research (PC/DOS 1992 + Sega Genesis 1993/94)

Implementation-grade reference for a faithful 3D remake. Primary hard-data source is the
**OpenDUNE** decompilation/reimplementation (`src/table/structureinfo.c`, `src/structure.c`,
`src/house.c`, `src/table/houseinfo.c`, `src/table/unitinfo.c`, `src/table/animation.c`,
`src/script/structure.c`), which encodes the original DOS engine's exact tables. Community
FAQs (Ledmeister's PC and Genesis "Extended Reference Text" guides, GRomaine's FAQ, DKennedy's
Genesis FAQ) are used to cross-check and to fill in behaviour the source alone doesn't make
obvious (real-time superweapon recharge, turret scan-range shape, placement-grid colours).
Where sources disagree the discrepancy is stated explicitly and marked `(?)`.

Units of measure: **cost** = spice credits; **build time** = internal game-time units (engine
ticks scaled by `buildTime*256`, decremented per tick — see §"Build speed & ticks"; commonly
treated by the community as ≈seconds at Normal speed, but this is an approximation, not exact,
so treat build time as a relative/ordering value, not a literal stopwatch second); **HP** =
hitpoints as stored in `structureinfo.c` (a second, larger "Shield" number appears in some fan
FAQs — see per-structure notes, likely a different game patch/version, kept as `(?)` alt-value);
**power** = flat rate, positive = consumption, negative = production; **sight/fog radius** =
`fogUncoverRadius` in tiles, the radius of fog cleared around the building (not a combat vision
range); **footprint** = width×height in tiles.

## Combined summary table

| Structure | Footprint | Cost | Build time | HP | Power | Storage | Fog radius | Prereq structures | Houses | Tech (1st mission) | Conquerable |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Concrete Slab (1x1) | 1×1 | 5 | 16 | 20 | 0 | – | 1 | none | all | 1 | No |
| Large Concrete Slab (2x2) | 2×2 | 20 | 16 | 20 | 0 | – | 1 | none (Construction Yard upgrade lvl 1) | all | 4 | No |
| Wall | 1×1 | 50 | 40 | 50 | 0 | – | 1 | Outpost + Wind Trap | all | 4 | No |
| Wind Trap | 2×2 | 300 | 48 | 200 | **−100** (produces) | – | 2 | none | all | 1 | Yes |
| Spice Refinery | 3×2 | 400 | 80 | 450 | 30 | 1005 | 4 | Wind Trap | all | 1 | Yes |
| Spice Silo | 2×2 | 150 | 48 | 150 | 5 | 1000 | 2 | Refinery + Wind Trap | all | 2 | Yes |
| Outpost (Radar) | 2×2 | 400 | 80 | 500 | 30 | – | 10 | Wind Trap | all | 2 | **No** |
| Barracks | 2×2 | 300 | 72 | 300 | 10 | – | 2 | Outpost + Wind Trap | Atreides, Ordos (+Fremen/Sardaukar/Mercenary) | 2 | **No** |
| WOR (trooper facility) | 2×2 | 400 | 104 | 400 | 20 | – | 3 | Outpost + Barracks + Wind Trap | Harkonnen (+Fremen/Sardaukar/Mercenary) | 5 | **No** |
| Light Factory | 2×2 | 400 | 96 | 350 | 20 | – | 3 | Refinery + Wind Trap | all | 3 | Yes |
| Heavy Factory | 3×2 | 600 | 144 | 200 | 35 | – | 3 | Outpost + Wind Trap + Light Factory | all | 4 | Yes |
| High-Tech Factory | 3×2 | 500 | 120 | 400 | 35 | – | 3 | Outpost + Wind Trap + Light Factory | all | 5 | Yes |
| Repair Facility | 3×2 | 700 | 80 | 200 | 20 | – | 3 | Outpost + Wind Trap + Light Factory | all | 5 | Yes |
| House of IX | 2×2 | 500 | 120 | 400 | 40 | – | 3 | Refinery + Starport + Wind Trap | all | 7 | **No** |
| Starport | 3×3 | 500 | 120 | 500 | 50 | – | 6 | Refinery + Wind Trap | all | 6 | Yes |
| Palace | 3×3 | 999 | 130 | 1000 | 80 | – | 5 | Starport | all | 8 | **No** |
| Gun Turret | 1×1 | 125 | 64 | 200 | 10 | – | 2 | Outpost + Wind Trap | all | 5 | Yes |
| Rocket Turret | 1×1 | 250 | 96 | 200 | 25 | – | 5 | Outpost + Wind Trap (+ Construction Yard upgrade lvl 2) | all | gated by CY upgrade, not campaign | Yes |
| Construction Yard | 2×2 | 400(?, MCV-deployed = free) | 80 | 400 | 0 | – | 3 | none (never built from menu; comes from deploying an MCV) | all | 1 | Yes |

Sources: OpenDUNE `src/table/structureinfo.c` (all rows) — see full citation in Sources section.
"Conquerable" = can be reduced to critical HP and captured by infantry (`conquerable` flag).

## Tech tree (text diagram)

```
MCV (vehicle, deployed by player)
 └─▶ Construction Yard  ── upgrade lvl 1 ($200) ──▶ unlocks Large (2x2) Concrete Slab
                         └─ upgrade lvl 2 ($200, needs Outpost+Wind Trap already built) ──▶ unlocks Rocket Turret

Construction Yard ──▶ Concrete Slab (1x1)         [no prereq]
Construction Yard ──▶ Wind Trap                    [no prereq]

Wind Trap ──▶ Refinery
Wind Trap ──▶ Outpost (Radar)

Refinery + Wind Trap ──▶ Spice Silo
Refinery + Wind Trap ──▶ Starport
Refinery + Wind Trap ──▶ Light Factory

Outpost + Wind Trap ──▶ Barracks (Atreides/Ordos)         ─▶ WOR needs Barracks too, Harkonnen-only, see note
Outpost + Wind Trap ──▶ Wall
Outpost + Wind Trap ──▶ Gun Turret
Outpost + Wind Trap ──▶ (Rocket Turret — gated by CY upgrade lvl 2, see above)

Outpost + Wind Trap + Barracks ──▶ WOR (Harkonnen; Harkonnen campaign override removes the
                                          Barracks requirement from mission 1 onward — see WOR §)

Outpost + Wind Trap + Light Factory ──▶ Heavy Factory
Outpost + Wind Trap + Light Factory ──▶ High-Tech Factory
Outpost + Wind Trap + Light Factory ──▶ Repair Facility

Refinery + Starport + Wind Trap ──▶ House of IX  ──▶ (unlocks, when combined with Heavy Factory
                                                       and/or High-Tech Factory) Devastator,
                                                       Deviator, Sonic Tank, Ornithopter
                                                       [OpenDUNE unitinfo.c: these 4 units all
                                                       carry structuresRequired = HOUSE_OF_IX]

Starport ──▶ Palace  ──▶ unlocks house superweapon (Death Hand / Fremen / Saboteur)
```
Generic minimum-mission gates (`availableCampaign`, i.e. "tech level"), before any per-house
override: Concrete Slab 1, Wind Trap 1, Refinery 1, Large Slab 4, Barracks 2, Outpost 2, Silo 2,
Light Factory 3, Heavy Factory 4, Wall 4, WOR 5, High-Tech 5, Repair 5, Turret 5, Starport 6,
House of IX 7, Palace 8. Rocket Turret has no campaign gate of its own (`availableCampaign=0`);
it is unlocked purely by Construction Yard upgrade level 2. Construction Yard's own
`availableCampaign=99` is a sentinel meaning "not offered through the normal build menu" (it
only ever arrives via MCV deployment). [OpenDUNE structureinfo.c]

Two documented per-house exceptions to the generic gates: (1) Harkonnen's WOR drops the
Barracks prerequisite and its tech gate becomes mission 2 instead of 5, specifically for
Harkonnen from `campaignID >= 1`; (2) for every house except Harkonnen, Light Factory's
effective gate is forced to mission 2 (not 3). [OpenDUNE `structure.c`, `Structure_GetBuildable()`]

## General mechanics (apply to most/all structures)

### Placement & concrete
- A structure may be placed if every footprint tile is valid ground (rock, or rock+concrete for
  structures that require concrete) **and** is empty, **and** (except for the Construction Yard)
  at least one of the ~16 tiles ringing the footprint belongs to the player: another player
  structure, or player-owned concrete/wall. I.e. new buildings must be adjacent to your existing
  base. You cannot place on top of enemy concrete or enemy structures, but you *can* place
  adjacent to enemy concrete/structures/walls (or on the rubble left by a destroyed one) as long
  as the adjacency-to-your-own-base rule is also satisfied. [OpenDUNE `structure.c`
  `Structure_IsValidBuildLocation()`; Ledmeister PC FAQ §26]
- **Concrete Slab placement (Construction Yard menu):** the 2×2 slab's placement cursor shows 4
  quadrants; **green** quadrant = valid rock, **red** = obstruction/invalid. Pressing confirm
  places concrete on every green quadrant and skips red ones; if all 4 are red you must relocate.
  A slab purchase always consumes its full ~15-credit unit cost even if only 1 of 4 quadrants is
  actually placed (no partial refund). [Ledmeister PC FAQ §12 "Concrete"]
- **Concrete penalty formula (bare-rock construction):** any non-slab, non-wall structure can be
  placed directly on rock without concrete, but starts damaged. Damage % =
  `50 − ((50 / tilesInFootprint) × tilesNotOnConcrete)`. A structure placed entirely on rock
  (0 concrete tiles) starts at exactly 50% damage; fully concreted starts at 0% (undamaged).
  Verified identical in OpenDUNE source (`Structure_Place()`:
  `hitpoints -= (maxHP/2) * tilesWithoutSlab / totalTiles`) and in Ledmeister's independent
  community FAQ (same formula, worked example: a 2×2 Wind Trap on 1 concrete tile starts at
  37.5% damage). [OpenDUNE `structure.c`; Ledmeister PC/Genesis FAQ §10 — **identical wording in
  both the PC and the "Genesis" edition of the FAQ**, i.e. this formula is not a PC-only rule]
- **"Construction" placement animation:** when a building is placed, "there is a moment where the
  graphics will flicker, alternating between showing a completed building and an interim stage.
  Even before the image finalizes, the building may be selected, fixed, targeted, etc." — i.e. the
  original engine does **not** do an elaborate "rises from the ground" reveal (that is a Dune
  2000/C&C-era convention); it is a brief 2-frame flicker between a construction-in-progress tile
  and the finished tile, and the building is already fully functional/selectable during it.
  [Ledmeister PC/Genesis FAQ §10] Any unrevealed fog at the build site is cleared the instant the
  structure is placed. [OpenDUNE `structure.c` `Tile_RemoveFogInRadius`]
- Building/unit **house colours**: Harkonnen = red, Atreides = blue, Ordos = green, Sardaukar =
  purple. (Fremen/Mercenary minimap colours not separately documented in this pass — `(?)`.)
  [Ledmeister PC FAQ glossary]
- Per-mission **combined building cap**: 68–70 total buildings (player + computer combined,
  varies slightly by mission). Once hit, only Concrete Slabs and Wall sections can still be
  built until something is destroyed. [Ledmeister PC/Genesis FAQ §10]

### Status icons & damage feedback
- Three overlay symbols can appear centred on a player building: **"OK"** (construction
  yard/palace awaiting an order), **lightning bolt** (a Wind Trap failing to meet power demand),
  **hammer** (building currently under repair). Stacking priority: OK > hammer > lightning-bolt.
  [Ledmeister PC/Genesis FAQ §10, §26]
- **Fire/smoke plumes** appear over a building once it is ≥50% damaged (single threshold, not a
  multi-stage smoke→fire progression). [Ledmeister PC/Genesis FAQ §10]
- Many buildings show a small **rotating light beacon** near their south-east corner, coloured in
  the controlling house's colour — a cheap, always-on "which house owns this" tell worth
  reproducing in 3D. [Ledmeister PC/Genesis FAQ §10]
- When a building is destroyed: any unit docked inside (harvester unloading, unit under repair)
  is destroyed with its cargo; a carryall/ornithopter caught directly above is also destroyed;
  credits mid-construction or mid-repair are refunded, credits already spent on an in-progress
  **upgrade** are **not** refunded. Exploding buildings damage any building/wall/unit
  orthogonally adjacent (chain-reaction risk). [Ledmeister PC/Genesis FAQ §10]
- No literal "rubble stays forever, infantry eject" mechanic exists for regular destruction — see
  "Absent mechanics" below.

### Deterioration / power shortage
- Structures decay over time only from **mission 2 onward** (`g_campaignID > 1`), on a fixed
  timer (`Tools_AdjustToGameSpeed(10800, 5400, 21600)` game ticks depending on game-speed
  setting), and **only while above 50% of max HP** — decay halts at the 50% floor. Damage per
  tick = house-specific `degradingAmount`: Harkonnen 3, Ordos 2, everyone else (Atreides, Fremen,
  Sardaukar, Mercenary) 1. [OpenDUNE `structure.c` + `table/houseinfo.c`]
- Surprising engine quirk confirmed directly in source: in the **unmodified original game**,
  buildings placed **fully on concrete still degrade** — the `degrades` flag is set to `true`
  unconditionally unless running OpenDUNE's optional "enhanced" bug-fix mode. Concrete's real
  benefit is avoiding the placement-time 50%-damage penalty (and, per community reports, reduced
  repair cost from starting healthier) — it does not stop the slow background decay in vanilla
  1992/1993 Dune II. Wikipedia's Dune II article independently confirms this exact behaviour
  ("Structures will still gradually decay over time regardless of the presence of concrete
  slabs, but they save repair costs in the long run"). [OpenDUNE `structure.c` comment marked
  `ENHANCEMENT`; Wikipedia "Dune II"]
- **Power shortage directly damages buildings**, it isn't just a slowdown: each house's
  `powerProduction/powerUsage` ratio scales every structure's *effective max HP* down (floor
  50% of nominal); if current HP now exceeds the new (lower) max, the engine calls
  `Structure_Damage(1)` on it repeatedly until it settles at the new max. Net effect: insufficient
  power slowly grinds every building with <100% power coverage down to 50% HP, exactly mirroring
  the concrete-decay floor. Independently confirmed by Ledmeister's FAQ: "When windtraps are not
  supplying enough power, all friendly buildings which are less than 50% damaged will begin to
  slowly deteriorate to a 50%-damaged status." Buildings already ≥50% damaged are unaffected by
  the power deficit. A structure's power *draw* does not change with its own damage state — only
  Wind Trap *output* scales with the Wind Trap's own HP (linearly with HP%, per Ledmeister/tasvideos;
  OpenDUNE's non-enhanced formula floors production at 50% once the Wind Trap itself drops ≤50% HP,
  "enhanced" mode makes it strictly linear). Power is base-wide, not grid-connected — destroying
  concrete/walls/buildings between a Wind Trap and the rest of the base does not cut power.
  [OpenDUNE `structure.c` `Structure_CalculateHitpointsMax()`, `house.c`
  `House_CalculatePowerAndCredit()`; Ledmeister PC/Genesis FAQ §25 "Windtrap"; tasvideos.org
  Dune2 page]
- Damage slows down (never stops) these structures' output, scaling with current HP ÷ max HP:
  Barracks/WOR/Light/Heavy/High-Tech factories (slower unit production), Construction Yard
  (slower structure production), Refinery (slower spice unload/refine), Repair Facility (slower
  vehicle repair — note: *repair cost is not reduced*, so a damaged Repair Facility is strictly
  worse, slower and no cheaper). [OpenDUNE `structure.c`; Ledmeister PC/Genesis FAQ §10]

### Repair, upgrade, capture — and the absence of "sell"
- **Repair ("Fix")**: cost per tick = `2 × buildCredits / hitpointsMax` credits (rounded;
  OpenDUNE's "enhanced" mode fixes a rounding bug from the 256-fixed-point original math), HP
  restored at 5/tick if the repairing house is the human player or `campaignID>=3`, else 3/tick
  for earlier-mission AI. Repairing can be toggled on/off any time and auto-resumes when funds
  return. A Palace repairs at ~0 net cost in practice (`2×999/1000 ≈ 2` credits, negligible) —
  independently corroborated by Ledmeister's FAQ stating outright "It costs no credits to repair
  a palace." [OpenDUNE `structure.c`; Ledmeister PC FAQ §16]
- **Upgrade**: cost to fully upgrade a level = `buildCredits / 2` (halved, with a negligible
  rounding term), deducted gradually at `buildCredits/40` credits per tick over a fixed
  countdown; upgrading and repairing are mutually exclusive states (starting one can
  pause/cancel the other, see the PC FAQ's "dual-order" table for exact interactions). Whether a
  structure can upgrade further, and how many levels it has, is driven by the per-structure
  `upgradeCampaign[3]` array (mission thresholds) cross-referenced against the current mission —
  **not** by a fixed level count. Two special-cased exceptions in source: Harkonnen never
  upgrades its High-Tech Factory; Ordos's Heavy Factory silently grants its 3rd/final upgrade
  level for free once mission-eligible. [OpenDUNE `structure.c` `Structure_IsUpgradable()`,
  `Structure_SetUpgradingState()`]
- **Capture**: only structures flagged `conquerable` (see summary table's last column) can be
  reduced to critical/red HP and captured by infantry (soldier/infantry/trooper/troopers doing a
  kamikaze/siege action) or a Saboteur. Non-conquerable structures (Barracks, WOR, Outpost,
  House of IX(?), Palace) can be sieged/damaged by infantry but never captured — they can only be
  destroyed. [OpenDUNE `structureinfo.c` `conquerable` flags; Ledmeister PC FAQ §51 "Capturing
  Buildings" cross-check table]
- **There is no "sell structure for a refund" command in Dune II.** Exhaustively confirmed
  absent: `src/structure.c`, `src/house.c` and `src/gui/widget_click.c` in OpenDUNE contain no
  `Structure_Sell`-equivalent function anywhere — the only toggleable structure states are
  Repair and Upgrade. A structure is only ever lost to destruction or (if conquerable) capture.
  The now-familiar "sell for ~50%" mechanic is a **Command & Conquer (1995) / Dune 2000 (1998)**
  convention retro-fitted onto the Westwood RTS formula later; do not add it expecting it to be
  period-accurate for 1992/1993 Dune II. Likewise, **structures do not eject surviving infantry
  when destroyed** — that is a later C&C-series feature (garrison-able civilian
  structures); Dune II's `Structure_Destroy()` only ever removes/destroys the one linked
  unit (docked harvester, unit-in-repair, or in-construction unit), it never spawns anything.
  [OpenDUNE full-file read of `structure.c`, `house.c`, `gui/widget_click.c` — absence
  verified by direct source inspection]

### Superweapons (Palace)
House → weapon mapping (from `houseinfo.c` `specialWeapon`): Harkonnen & Sardaukar → **Death
Hand** missile; Atreides & Fremen → **Fremen** warriors; Ordos & Mercenary → **Saboteur**.
- **Death Hand**: fires an unguided (player-aimed within a 7-second countdown window; AI just
  targets the first non-allied structure it can see) ballistic missile at a chosen point;
  accuracy is deliberately fuzzy and reportedly improves as more of the enemy's area has been
  revealed by radar. [OpenDUNE `structure.c` `Structure_ActivateSpecial()`; GRomaine PC FAQ Q17]
- **Fremen**: spawns 5 units at a random map location (mix of lone Trooper and Troopers squads),
  set to auto-hunt; entirely uncontrollable by the player.
- **Saboteur**: spawns one Saboteur adjacent to the Palace, auto-walks to sabotage (self-destruct
  inside) an enemy building.
- All three: the spawned/launched unit(s) do **not** count against the mission's unit cap.
  [Ledmeister PC FAQ §16]
- **Recharge**: internally a fixed tick countdown (`specialCountDown`: Harkonnen/Sardaukar = 600,
  Atreides/Ordos/Fremen/Mercenary = 300, decremented once every 60 game ticks), i.e. Death Hand
  takes exactly 2× as long to recharge as the other two weapons. In observed real time at Normal
  game speed with typical unit counts: **Harkonnen Death Hand ≈ 11–12 minutes, Sardaukar Death
  Hand ≈ 15–16 minutes** (same countdown value, different observed real time — game time itself
  runs at a variable rate tied to on-screen unit count), **Atreides Fremen ≈ 4 minutes**,
  **Ordos Saboteur ≈ 6–7 minutes**. Damage to the Palace does **not** slow the recharge.
  Destroying and immediately replacing your own Palace resets the weapon to instantly-ready
  (exploitable). A Palace cannot target itself. [OpenDUNE `houseinfo.c`, `structure.c`;
  Ledmeister PC FAQ §16 — real-time figures are Ledmeister's empirical measurement, mark as
  representative/approximate `(?)` for exact reproduction]

### Starport economy
- On first placement, stock quantities and per-unit prices are rolled randomly. Every 1800 game
  ticks, one random unit type's stock increases by 1 (cap 10; a type already at cap or not sold
  at the Starport at all just wastes the roll). [OpenDUNE `house.c` `GameLoop_House()`]
- Price formula, confirmed independently by two sources (tasvideos.org's technical page, quoting
  the actual code, and Ledmeister's/wiki.gg's empirical write-ups):
  `price = baseCost/10 × 4 + baseCost/10 × (rand(0..6) + rand(0..6))`, i.e. **40%–160% of normal
  cost, in ~10% increments**, re-rolled essentially every time you re-open the order screen
  (there's no persistent "current price" ticking down — every visit re-samples). [tasvideos.org
  Dune2 page quoting `Tools_RandomLCG_Range`; dunerts.wiki.gg Starport(Dune II) page]
- Buying multiple items in one order is allowed and paid up-front; a single **Frigate** delivers
  the whole order together after `starportDeliveryTime` (10 ticks × the 180-tick Starport
  house-loop interval ⇒ a fixed real interval per house, same 10-tick value for Atreides/
  Ordos/Harkonnen) counted from the first purchase in that batch; while a frigate is inbound the
  Starport cannot accept a second order. The Starport's landing pad flashes lights in a pattern
  while a frigate is expected (mirrors the Refinery's harvester-docking lights, see Refinery §).
  [OpenDUNE `house.c`; Ledmeister PC FAQ §21]
- Harkonnen Starports never stock Ornithopters. Computer-controlled (AI) bases never build or use
  Starports at all — Starports in the campaign are a player-only structure. [Ledmeister PC FAQ §21]

### Turrets — combat detail (Gun Turret & Rocket Turret)
- Both turret types are implemented as a **scripted weapon**, not as a generic "unit with a gun":
  `Script_Structure_Fire()` always fires a `UNIT_BULLET` doing **20 damage** at the same cadence
  as a Combat Tank's gun (`fireDelay=80` ticks) for any target inside 3 tiles. A **Rocket
  Turret** additionally engages targets between 3 and 8 tiles using a `UNIT_MISSILE_TURRET`
  projectile doing **30 damage** at the same cadence as the Missile Tank/Launcher
  (`fireDelay=120` ticks) — i.e. a Rocket Turret is strictly a superset of a Gun Turret (same
  close-range bullet, plus extra long-range rocket reach), not a different weapon entirely.
  [OpenDUNE `src/script/structure.c` `Script_Structure_Fire()`, cross-checked against
  `table/unitinfo.c` Tank/Launcher `fireDelay`]
- Max target-scan range: **Gun Turret = 5 tiles**, **Rocket Turret = 8 tiles** (rocket zone), with
  the inner ~3-tile core using the bullet instead of a rocket — this exactly matches the
  source's `distance >= 0x300` (3-tile) cutoff. Both diamond-shaped scan patterns (not square,
  not perfectly circular — a stepped rhombus) are documented tile-by-tile in Ledmeister's FAQ
  §19/§22 (reproduced faithfully, they are the authoritative shape reference for a 3D LOS/range
  re-implementation). Once fired, the projectile itself can travel past the scan range to reach
  its already-locked target. [Ledmeister PC FAQ §19, §22]
- Turrets/Rocket Turrets only ever target ground units and Ornithopters — never enemy structures,
  Death Hand missiles, or Frigates; a turret currently engaging an airborne target will keep
  ignoring ground targets until the air target dies; they never return fire if hit by friendly
  units; they keep functioning (and keep firing) while being repaired; they only ever engage one
  target at a time (a Rocket Turret does not fire both pods at once — one rocket per attack
  despite the twin-pod sprite). Cannon fire (not rockets) is blocked by mountains, enemy
  turrets/rocket turrets, and enemy walls; rockets ignore all of that and fly over everything.
  Spawn orientation is always facing north. In idle/Guard state both turret types occasionally
  "fidget" (rotate slightly at random) even with nothing to shoot at. [Ledmeister PC FAQ §19,
  §22, §10]

### Build speed & ticks
Factories/Construction Yard/Repair Facility progress a `countDown` that starts at
`buildTime × 256` and drops by up to 256 "points" per structure-tick (which itself fires every
30/15/60 real ticks depending on game speed), scaled down proportionally if the producing
building is damaged (`buildSpeed = currentHP×256/maxHP`) and, for AI-controlled houses in early
missions, additionally capped well below 100%. The Repair Facility's *production* cost-rate
(building new things, as opposed to repairing units) is divided by 4 relative to the naive
formula. [OpenDUNE `structure.c` `GameLoop_Structure()`]

---

## Per-structure sections

### Concrete Slab (1×1)
- **Stats**: 1×1, cost 5, build 16, HP 20, power 0, fog radius 1, prereq none, all houses,
  tech mission 1, sort priority 2 (near-lowest, built first). `notOnConcrete=true` (it *is* the
  concrete, obviously can't require itself). [OpenDUNE structureinfo.c]
- **Behaviour**: Foundation only — no HP-relevant function once placed beyond preventing the
  bare-rock damage penalty on whatever's built atop it and slowing/stopping decay in OpenDUNE's
  bug-fixed "enhanced" mode (see general mechanics; in the *unmodified* original it does not stop
  decay). Cannot be repaired, cannot be captured, doesn't appear on radar, can only be destroyed
  by Death Hand, a self-destructing Devastator, stray ordnance, or an attack on whatever sits on
  top of it. Clicking it with the selection cursor shows no ID/HP bar. [Ledmeister PC FAQ §12]
- **Visual (PC)**: a flat, roughly tan/grey cracked-concrete texture tile, no verticality, no
  house-colour tinting (it's terrain-like, not a "building"). WSA file `slab.wsa`. Animation
  program is a static single frame (`g_table_animation_structure[2]`: set tile, 300-tick pause,
  abort) — i.e. no real animation, it doesn't even flicker after placement. [OpenDUNE
  `table/animation.c`, `structureinfo.c` `wsa` field]
- **Sega**: no PC/Genesis functional difference documented; visuals generally redrawn bigger
  along with everything else (see Sega vs PC section). `(?)` exact sprite.
- Sources: OpenDUNE structureinfo.c/structure.c/animation.c; Ledmeister PC FAQ §12.

### Large Concrete Slab (2×2)
- **Stats**: 2×2, cost 20, build 16, HP 20, power 0, fog radius 1, tech mission 4, sort priority
  4. Internal name `Concrete4`, file `4slab.wsa`. Unique among all 19 structures in having
  `upgradeLevelRequired = 1` — it literally cannot be queued until the Construction Yard has
  been upgraded once (see Construction Yard §). [OpenDUNE structureinfo.c]
- **Behaviour**: identical to the 1×1 slab, just places a pre-fabricated 2×2 block in one order
  instead of four individual 1×1s — cheaper per-tile (20 for 4 tiles vs 5×4=20 for four
  singles, i.e. no discount, just a placement-order convenience once available). Same
  concrete-quadrant green/red placement rule as the small slab.
- **Visual**: same flat slab texture, larger tile; animation likewise static
  (`g_table_animation_structure[2]`).
- **Sega**: `(?)` not separately documented; StrategyWiki's building list treats concrete slabs
  as common to all versions with no callout of a Genesis difference.
- Sources: OpenDUNE structureinfo.c; Ledmeister PC FAQ §12, §26.

### Wall
- **Stats**: 1×1, cost 50, build 40, HP 50 (Ledmeister FAQ's alt "Shield" value: 140 `(?)`),
  power 0, fog radius 1, prereq Outpost+Wind Trap, tech mission 4, sort priority 16.
  [OpenDUNE structureinfo.c; Ledmeister PC FAQ §24]
- **Behaviour**: placement is capped only by available rock, not by the global building count.
  Auto-connects to orthogonally-adjacent wall segments (including ones straddling
  friendly/enemy ownership, and stubs left after a neighbouring wall/building was destroyed),
  re-tiling itself and its neighbours to the correct junction sprite from a 16-entry
  neighbour-bitmask lookup table (N/E/S/W presence × intact/destroyed). Immune to sonic-weapon
  damage; takes a randomized amount of damage before breaking; cannot be repaired; not clickable
  for an ID/HP readout; doesn't appear on radar; Saboteurs walk over enemy walls at full speed
  without being stopped. Not placed on concrete = not damaged (walls are simply not
  concrete-dependent at all — no bare-rock penalty applies to them). [OpenDUNE `structure.c`
  `Structure_ConnectWall()`; Ledmeister PC FAQ §24]
- **Visual (PC)**: crenellated rampart segments, auto-tiled corner/straight/T/cross pieces from a
  small tileset (`wall.wsa`); a "destroyed wall" rubble variant exists as a distinct landscape
  type (`LST_DESTROYED_WALL`) that still blocks wall-connection logic once broken. No dedicated
  animation (`animationIndex = 0xFF` for all 3 states — walls are handled purely via the
  ground-tile connect logic, not the generic structure-animation system).
- **Sega**: `(?)` no specific difference documented in sources reviewed.
- Sources: OpenDUNE structure.c/structureinfo.c; Ledmeister PC FAQ §24.

### Wind Trap
- **Stats**: 2×2, cost 300, build 48, HP 200, **power −100 (produces 100)**, fog radius 2,
  prereq none, all houses, tech mission 1, sort priority 6. `conquerable=true`.
  [OpenDUNE structureinfo.c]
- **Behaviour**: the sole power source. Output scales with the Wind Trap's own current HP
  (linear per Ledmeister/tasvideos; OpenDUNE's non-"enhanced" formula floors production at 50%
  once the trap itself is ≤50% HP, "enhanced" removes that floor and is strictly linear down to
  0). Not physically/grid-connected to what it powers — total house power production/consumption
  is summed globally every house-tick; destroying terrain between a Wind Trap and other
  buildings does nothing to their power. Losing your last Wind Trap restricts your Construction
  Yard to only building Concrete and (new) Wind Traps. Capturing an enemy Wind Trap immediately
  redirects its output to you. A lightning-bolt icon flashes on every Wind Trap that's part of a
  shortfall (never shown on AI-owned ones). [OpenDUNE `house.c`; Ledmeister PC FAQ §25]
- **Visual (PC)**: a beige/tan cylindrical duct/turbine housing with an exposed rotating fan
  visible from above; `windtrap.wsa`. Confirmed real animation: a plain 2-frame alternation
  (tiles "2"↔"3", 30-tick pause each, ping-pong) run continuously regardless of state — i.e. the
  original sprite's "spin" is a simple 2-frame flip, not a smooth multi-frame rotor animation.
  [OpenDUNE `table/animation.c` program 26, referenced by all 3 of Wind Trap's
  `animationIndex` slots] Manual flavour text: "large, above-ground ducts funnel wind currents
  underground into massive turbines which power generators and humidity extractors"; internal
  fluff part name "ESkort 650 hp EL-2A Dual Turbine". [Official manual, via dune2k.com/
  abandonwaredos mirrors]
- **Sega**: no stat difference found in either Genesis-specific FAQ (both list cost
  300/power+100/HP-proxy 400/2×2, identical to PC). Visuals redrawn/bigger like all Genesis
  sprites (general note, not Wind-Trap-specific). `(?)` exact frame count.
- Sources: OpenDUNE structureinfo.c/structure.c/house.c/animation.c; Ledmeister PC & Genesis FAQ
  §25 (verbatim-identical text in both editions); official manual text.

### Spice Refinery
- **Stats**: 3×2, cost 400, build 80, HP 450, power 30, **storage 1005**, fog radius 4, prereq
  Wind Trap only, all houses, tech mission 1, sort priority 8. `enterFilter = HARVESTER` (only
  harvesters can dock), `busyStateIsIncoming=true`. [OpenDUNE structureinfo.c]
- **Behaviour**: **comes with one free Harvester** the moment it (or any Refinery, if you already
  have one) is completed — the engine actively checks each house every house-tick and, if it has
  a Refinery but no Harvester (and none in transit/under repair), spawns one and carryall-delivers
  it. [OpenDUNE `house.c` `House_EnsureHarvesterAvailable()`] A docked Harvester unloads its
  spice cargo in chunks (up to 3 units of cargo per cycle, itself scaled by the Refinery's
  current HP%, minimum 1 while any cargo remains) once every 6 ticks, each cargo-unit worth 7
  credits (±1 for AI houses) — i.e. refining rate visibly slows when the Refinery is damaged.
  [OpenDUNE `script/structure.c` `Script_Structure_RefineSpice()`] Normally holds only 1
  Harvester at a time (edge case: two can overlap briefly if one is already leaving as another
  arrives — first-in, first-out). A Harvester actively unloading is **immune to damage** unless
  the Refinery itself is destroyed outright (which destroys the Harvester too, along with its
  cargo); capturing a Refinery with a Harvester docked captures the Harvester as well. All spice
  income is pooled and split evenly across every Refinery+Silo the house owns; refineries/silos
  nominally cap at 1000 each but the effective per-facility cap can read 1005 due to the
  `creditsStorage=1005` table value; total house-wide storage additionally hard-caps at 32000
  (`House_UpdateCreditsStorage`). If the Refinery is destroyed, whatever spice was inside is
  lost, and destroying *any* storage structure (Refinery or Silo) causes a proportional
  *immediate* credit loss equal to that structure's share of the house's total storage capacity
  — i.e. losing storage capacity doesn't just cap future spice, it actively docks currently-held
  credits. [OpenDUNE `structure.c` `Structure_Destroy()`; Ledmeister PC FAQ §17]
- **Visual (PC)**: the largest "industrial" footprint (3×2) — read from `refinery.wsa`; per the
  official manual, "the basis of all spice production," implying visible processing machinery,
  and per Ledmeister, it has a distinct **"docking bay" with lights that flash in a pattern
  whenever a Harvester is expected to arrive** — an explicit, source-confirmed pre-arrival
  landing/docking-light cue worth modelling as a real light-emitting element. Animation set:
  idle = 2-frame loop (tiles 2/3, 30-tick), **busy/unloading = a richer 4-step forward loop
  (tiles 2→5→6→7, 30-tick, looping)** — almost certainly the visible spice-processing/conveyor
  motion while a Harvester unloads — **ready = a distinct 2-frame loop on tiles 8/9** (plausibly
  the docking-bay light cue itself). [OpenDUNE `table/animation.c` programs 17/18/19, referenced
  by Refinery's `animationIndex`]
- **Sega**: no cost/HP/power difference found (identical 400/30/3×2 in both Genesis-specific
  FAQs). `(?)` exact sprite differences beyond the general "bigger, redrawn" note.
- Sources: OpenDUNE structureinfo.c/structure.c/house.c/script/structure.c/animation.c;
  Ledmeister PC FAQ §17; official manual text.

### Spice Silo
- **Stats**: 2×2, cost 150, build 48, HP 150, power 5, **storage 1000**, fog radius 2, prereq
  Refinery+Wind Trap, all houses, tech mission 2, sort priority 12. `conquerable=true`.
  [OpenDUNE structureinfo.c]
- **Behaviour**: pure storage add-on, same pooled-spice/proportional-loss-on-destruction rules as
  the Refinery (see above). Weakest of the economy buildings (150 HP) — advised to keep repaired.
  If a house's last storage facility of any kind is destroyed, credits crash to near-zero but a
  small residual can be recovered into the next facility built/captured. [OpenDUNE
  `structure.c`; Ledmeister PC FAQ §20]
- **Visual**: `storage.wsa`; manual/community flavour repeatedly describes it as a lighter,
  cheaper, weaker structure than the Refinery — consistent with a simple grain-silo/storage-tank
  massing (rounded dome or tank shape) rather than the Refinery's industrial-processing look;
  exact silhouette not independently confirmed from primary art — treat dome/tank shape as best
  general-knowledge inference, mark `(?)`. Animation: constant 2-frame loop (tiles 2/3, 30-tick)
  in all 3 states — no distinct "full vs. empty" visual variant found in the data.
  [OpenDUNE `table/animation.c` program 27]
- **Sega**: no stat delta found (150/−5/2×2 identical in both FAQs).
- Sources: OpenDUNE structureinfo.c/structure.c/animation.c; Ledmeister PC FAQ §20.

### Outpost (Radar)
- **Stats**: 2×2, cost 400, build 80, HP 500, power 30, fog radius **10** (by far the largest —
  it's a surveillance building), prereq Wind Trap only, all houses, tech mission 2, sort
  priority 10. `conquerable=false` — it can be sieged/damaged but never captured.
  [OpenDUNE structureinfo.c]
- **Behaviour**: gatekeeper for the whole mid/late tech tree (Barracks, WOR, Wall, both Turrets,
  Heavy Factory, High-Tech Factory, Repair Facility all require it) and, functionally, **turns
  on the minimap/radar** — `House_UpdateRadarState()` activates the radar overlay only when the
  house both owns an Outpost and has `powerProduction >= powerUsage` (i.e. a powered Outpost
  under a power deficit loses radar too, matching the "radar requires power" requirement
  precisely). Radar activation/deactivation plays a dedicated `STATIC.WSA` full-screen static
  wipe animation with its own sound cue. Losing your last Outpost also strips the ability for
  player-controlled factories to complete upgrades. [OpenDUNE `house.c`
  `House_UpdateRadarState()`; `structure.c`] On radar: Fremen units and sandworm mounds render as
  white dots; sand dunes/craters/concrete/walls never appear on radar regardless of Outpost
  status. [Ledmeister PC FAQ §8, §15]
- **Visual (PC)**: file `headqrts.wsa` (internal name literally "HQ"). Animation: a genuine
  4-frame forward loop (tiles 2→3→4→5, 30-tick pause each, then rewind) — this is almost
  certainly the **rotating radar dish** the brief calls for, distinct from every other
  structure's simpler 2-frame flicker. [OpenDUNE `table/animation.c` program 3, the *only*
  4-frame-loop-then-rewind program used by a non-factory structure]
- **Sega**: no stat delta found. `(?)` sprite specifics.
- Sources: OpenDUNE structureinfo.c/structure.c/house.c/animation.c; Ledmeister PC FAQ §8, §15.

### Barracks
- **Stats**: 2×2, cost 300, build 72, HP 300, power 10, fog radius 2, prereq Outpost+Wind Trap,
  **houses: Atreides & Ordos** (plus Fremen/Sardaukar/Mercenary sub-houses; explicitly **not**
  Harkonnen, who get WOR instead — see below), tech mission 2, sort priority 18. Builds
  Soldier → (after a $150 upgrade) Infantry (light infantry squad). `conquerable=false`.
  [OpenDUNE structureinfo.c]
- **Behaviour**: Ordos and Atreides both start with a "soldier barracks"; community-documented
  campaign data (not visible in the generic table alone) shows an **Ordos** barracks can be
  further upgraded in later missions to also produce Trooper-type units, on top of its own
  Infantry upgrade — apparently a per-mission/scripted exception layered on top of the generic
  Barracks unit list (`Soldier, Infantry` only) — treat as `(?)` mechanism, `confirmed` outcome.
  [Ledmeister PC FAQ §11, §27 mission-4+ upgrade tables] A barracks holding a freshly finished
  unit refuses new build orders until that unit is walked out. Cannot be captured under any
  circumstances (only Barracks/WOR carry `conquerable=false` among the "military production"
  group). On the Construction Yard's build menu, Atreides/Ordos soldier-barracks icon and
  Harkonnen trooper-barracks icon are visually distinct even though they occupy the "same slot."
  [Ledmeister PC FAQ §11]
- **Visual**: `barrac.wsa`; per Ledmeister, soldier-barracks and trooper-barracks are literally
  "identical in appearance" once actually placed on the Game Screen (only the Production-Screen
  icon differs) — i.e. do not model Barracks and WOR as visually distinct buildings, they may
  share (or very nearly share) a base mesh in-engine, differing mainly in unit roster/flavour.
  Animation: constant 2-frame loop (tiles 2/3, 30-tick) in all 3 states.
  [OpenDUNE `table/animation.c` program 28; Ledmeister PC FAQ §11]
- **Sega**: no stat delta found; identical 300/−10/2×2 in the Genesis-specific FAQ excerpt
  retrieved.
- Sources: OpenDUNE structureinfo.c/structure.c/animation.c; Ledmeister PC FAQ §11, §27.

### WOR (trooper facility)
- **Stats**: 2×2, cost 400, build 104, HP 400, power 20, fog radius 3, prereq
  Outpost+Barracks+Wind Trap, **houses: Harkonnen** (plus Fremen/Sardaukar/Mercenary;
  explicitly not Atreides/Ordos), tech mission 5 generically — but **overridden to mission 2 with
  no Barracks requirement specifically for Harkonnen** from `campaignID >= 1` onward. Sort
  priority 20. Builds Trooper → (after upgrade) Troopers (squad). `conquerable=false`.
  [OpenDUNE structureinfo.c, `structure.c` `Structure_GetBuildable()` Harkonnen special-case]
- **Behaviour**: mechanically Harkonnen's Barracks-equivalent — see Barracks § for the shared
  "same appearance, different production-screen icon" note and the build-lock-until-unit-leaves
  rule (applies identically). One extra documented special case: `Structure_IsUpgradable()`
  grants Harkonnen an additional WOR upgrade opportunity at upgrade-level 0 once
  `campaignID > 3`, outside the normal `upgradeCampaign` table lookup — exact gameplay effect not
  independently confirmed beyond the source flag; mark `(?)`. [OpenDUNE `structure.c`]
- **Visual**: `wor.wsa`; general knowledge (not independently source-confirmed for exact
  silhouette) suggests a harsher/more militarized reskin in keeping with Harkonnen's aesthetic —
  spikes/aggressive detailing would be in-theme but is **not** confirmed by any fetched source;
  mark `(?)`. Animation: constant 2-frame loop (tiles 2/3, 30-tick) in all 3 states, same pattern
  family as Barracks. [OpenDUNE `table/animation.c` program 21]
- **Sega**: neither Genesis-specific FAQ names "WOR" at all (both, like the PC FAQ, only ever say
  "Barracks (trooper)") — the underlying building clearly still exists functionally, this just
  reflects the FAQ authors' unified terminology, not a Sega removal.
- Sources: OpenDUNE structureinfo.c/structure.c/animation.c; Ledmeister PC FAQ §11 (as
  "Barracks, trooper").

### Light Factory
- **Stats**: 2×2, cost 400, build 96, HP 350, power 20, fog radius 3, prereq Refinery+Wind Trap,
  all houses (generic tech mission 3, but forced to mission 2 for every house except Harkonnen —
  see Tech tree § note), sort priority 14. Builds Trike (Ordos variant: Raider Trike) and Quad;
  one upgrade level (`upgradeCampaign[0]=3`) — cost = 400/2 = 200. `conquerable=true`.
  [OpenDUNE structureinfo.c, `structure.c` `Structure_GetBuildable()`]
- **Behaviour**: gateway structure for Heavy Factory, High-Tech Factory and Repair Facility (all
  three require it in addition to Outpost+Wind Trap). Harkonnen's Light Vehicle unlock is
  special-cased to `upgradeLevel=1` immediately at creation (`Structure_Create()`:
  `if (houseID==HARKONNEN && type==LIGHT_VEHICLE) upgradeLevel=1`), i.e. Harkonnen starts one
  upgrade tier ahead on this specific building. [OpenDUNE `structure.c`]
- **Visual**: `liteftry.wsa`. Animation set is the richest 3-state set seen among factories:
  idle/busy = 2-frame loop (tiles 2/3, 30-tick, both states share the same content), **ready = a
  distinct 7-step forward-then-loop sequence (2→5→3→4→2→5→4, 30-tick, looping over the last 4
  steps)** — plausibly a door-open/vehicle-rollout flourish distinct from its idle flicker.
  [OpenDUNE `table/animation.c` programs 14/15/16]
- **Sega**: per StrategyWiki's structure table, the **Light Vehicle Factory is exclusive to the
  MS-DOS and Amiga versions**; the Sega Genesis version instead has the Heavy Vehicle Factory
  alone build "light and heavy units" — i.e. Light + Heavy Factory appear to be **merged into one
  building on Genesis**. This is corroborated (not proven) by both Genesis-specific community
  FAQs consulted, which — unlike the PC FAQ's occasional per-house "Vehicle factory, Atreides/
  Harkonnen/Ordos" breakdown — consistently use only the single unqualified term "Vehicle
  Factory" throughout, and by neither Genesis FAQ ever using the term "Light Factory." No
  Genesis-specific cost/HP numbers for this merged building were recovered in this pass — the
  Genesis edition of Ledmeister's FAQ table (where fetched) shows the same $400/3×2/−20 numbers
  as the PC "Light Factory," which may simply mean the author didn't bother re-deriving separate
  numbers. Treat the *existence* of the merge as reasonably well supported and the *exact stats*
  of the merged Genesis factory as `(?)`. [StrategyWiki Dune II Buildings page; Ledmeister &
  DKennedy Genesis FAQs, negative evidence via consistent terminology]
- Sources: OpenDUNE structureinfo.c/structure.c/animation.c; Ledmeister PC FAQ §23; StrategyWiki.

### Heavy Factory
- **Stats**: 3×2, cost 600, build 144, HP 200, power 35, fog radius 3, prereq
  Outpost+Wind Trap+Light Factory, all houses, tech mission 4, sort priority 28. Builds Siege
  Tank, Launcher (Missile Tank), Harvester, (Combat) Tank, Devastator, Deviator, MCV, Sonic Tank
  — the last three/four gated by upgrade level and, for the three house-special vehicles, also by
  House of IX (see Tech tree §). Three upgrade levels (`upgradeCampaign = [4,5,6]`), cost 600/2 =
  300 each; Ordos receives its 3rd/final level free once eligible. `conquerable=true`.
  [OpenDUNE structureinfo.c, `structure.c`]
- **Behaviour**: highest-priority AI attack target alongside the Repair Facility, per community
  play testing (`priorityTarget=600`, tied for the single highest value in the whole
  structureinfo.c table alongside... actually Repair's `priorityTarget=600` too — both share the
  top AI-targeting priority). [OpenDUNE structureinfo.c `priorityTarget` field; dunerts.wiki.gg
  Heavy Factory page corroborates "highest attack priority of all player-owned buildings"]
  Damaged Heavy Factory slows unit production proportionally to HP%, per the general
  factory-slowdown rule.
- **Visual**: `hvyftry.wsa`. Animation: idle/busy states 11 and 12 are identical content
  (2-frame loop, tiles 2/3, 30-tick) — the interesting one is the **ready state (program 13): a
  continuous 4-step forward loop (tiles 4→5→6→7, 30-tick, looping)**, almost certainly the large
  vehicle-bay doors cycling open/closed as a finished vehicle rolls out.
  [OpenDUNE `table/animation.c` programs 11/12/13]
- **Sega**: see Light Factory § — probably absorbs Light Factory's role into one unified
  "Vehicle Factory" on Genesis; exact merged stats `(?)`.
- Sources: OpenDUNE structureinfo.c/structure.c/animation.c; Ledmeister PC FAQ §23; dunerts.wiki.gg.

### High-Tech Factory
- **Stats**: 3×2 (labelled 2×2 on one fan wiki, `(?)` — OpenDUNE's `layout` field is unambiguously
  `STRUCTURE_LAYOUT_3x2`, treated as authoritative), cost 500, build 120, HP 400, power 35, fog
  radius 3, prereq Outpost+Wind Trap+Light Factory, all houses, tech mission 5, sort priority 30.
  Builds Carryall and Ornithopter (Ornithopter additionally gated on House of IX being built —
  see Tech tree §). One upgrade level (`upgradeCampaign[0]=7`), cost 500/2 = 250 — **except
  Harkonnen, whose High-Tech Factory can never be upgraded at all**
  (`Structure_IsUpgradable()` hard-returns false for Harkonnen+HighTech). `conquerable=true`.
  [OpenDUNE structureinfo.c, `structure.c`]
- **Behaviour**: Carryalls produced here loiter near the factory until given a task; Ornithopters
  instead immediately patrol the whole battlefield hunting targets. If a house's only High-Tech
  Factory is lost, any special vehicle mid-production elsewhere (Devastator/Deviator/Sonic Tank)
  is cancelled and refunded, and those options vanish from the Heavy Factory's menu until another
  High-Tech (and House of IX) exists. On its own production screen the Ornithopter is labelled
  "THOPTER." [Ledmeister PC FAQ §14]
- **Visual**: `hitcftry.wsa`. Animation: idle/busy = 2-frame loop (tiles 2/3, 30-tick); the two
  richer states are **mirror-image 4-step loops** — program 9 runs tiles 7→6→5→4 (reverse) and
  program 10 runs 4→5→6→7 (forward), both looping at 30-tick — plausibly one is the
  landing/opening sequence and the other the departure/closing sequence for aircraft.
  [OpenDUNE `table/animation.c` programs 8/9/10]
- **Sega**: no stat delta documented. `(?)` sprite/animation specifics.
- Sources: OpenDUNE structureinfo.c/structure.c/animation.c; Ledmeister PC FAQ §14.

### Repair Facility
- **Stats**: 3×2, cost 700, build 80, HP 200 (Ledmeister's alt "Shield" value: 1800 `(?)`, by far
  the largest source discrepancy found — likely a different game patch/version, not reconciled
  in this pass), power 20, fog radius 3, prereq Outpost+Wind Trap+Light Factory, all houses, tech
  mission 5, sort priority 24. `enterFilter` covers essentially every ground vehicle (Harvester,
  Quad, Raider Trike, Trike, Sonic Tank, Devastator, Siege Tank, Tank, Deviator, Launcher).
  `conquerable=true`. [OpenDUNE structureinfo.c]
- **Behaviour**: repairs exactly 1 vehicle at a time; a second unit ordered in while one is
  inside will stop just outside and default to Guard (edge case: near-simultaneous entries can
  both succeed, with the *second* arrival released first). Infantry/soldier/trooper units cannot
  walk in under their own orders — only a carryall airlift can deliver them (or extract them once
  healed) if the facility is boxed in by other buildings/walls/units. Ground vehicles that are
  boxed in are airlifted in/out the same way; Harvesters and MCVs specifically can **never** be
  carryall-delivered *into* a Repair Facility (must path in on wheels/treads) but *can* be
  carryall-extracted if they get stuck inside. Repairing here costs credits for nearly every unit
  type regardless of damage level (documented minimums: Soldier 0, Infantry/Trike/Raider
  Trike/Quad/Trooper/Troopers 1, Harvester/Combat Tank 2, Missile Tank 3, Siege/Sonic Tank 5,
  Devastator/Deviator 6, MCV 9 credits) — the STOP command on the facility only halts repairs on
  the *building itself*, not the in-progress unit repair; friendly units can be ordered to
  attack-and-destroy any friendly structure **except** the Repair Facility (and Concrete). A
  Devastator that is primed to self-destruct remains primed after being repaired here. If
  destroyed while occupied, the unit inside (and anything it carried) dies with it; if captured
  while occupied, the unit inside is captured too. [OpenDUNE structureinfo.c `enterFilter`;
  Ledmeister PC FAQ §18]
- **Visual**: `repair.wsa`. Animation set runs at a noticeably **slower 60-tick pace** (vs. the
  30-tick pace used by almost every other structure) — idle/state-24 is a simple 2-frame loop
  (tiles 2/3, 60-tick), but states 23 and 25 are long **6-step sequences**
  (23: 8→9→6→5→2→3, forward-loop; 25: 2→5→6→9→8, forward-loop), the slowest, most elaborate
  animation cycle of any structure in the game — strongly suggestive of a visible mechanical
  repair arm/gantry working over the docked vehicle. [OpenDUNE `table/animation.c` programs
  23/24/25]
- **Sega**: no stat delta documented, `(?)` sprite specifics.
- Sources: OpenDUNE structureinfo.c/animation.c; Ledmeister PC FAQ §18.

### House of IX
- **Stats**: 2×2, cost 500, build 120, HP 400, power 40, fog radius 3, prereq
  Refinery+Starport+Wind Trap, all houses, tech mission 7, sort priority 34. No buildable units of
  its own, no upgrade levels. `conquerable=false`. [OpenDUNE structureinfo.c]
- **Behaviour**: does not itself build anything — it is a pure tech-unlock gate. Confirmed via
  `unitinfo.c`: exactly four units carry `structuresRequired = FLAG_STRUCTURE_HOUSE_OF_IX` —
  **Ornithopter, Deviator, Devastator, Sonic Tank**. In other words House of IX is required not
  only for the three per-house special combat vehicles (built at Heavy Factory, further gated by
  Heavy Factory upgrade level) but also for the Ornithopter (built at High-Tech Factory) — a
  detail easy to miss from the structure table alone. Losing your only House of IX immediately
  strips those unit options from the relevant factories' menus (with in-progress builds
  cancelled/refunded). [OpenDUNE `table/unitinfo.c` `structuresRequired` fields; Ledmeister PC
  FAQ §14 corroborates the Ornithopter/Hi-Tech interaction]
- **Visual**: `ix.wsa`. Manual flavour: "provides technology upgrades on structures and vehicles;
  special weapons and prototypes may become available" — general knowledge suggests a
  distinctive "high-tech/laboratory" massing (e.g. a glowing dome or antenna array) to visually
  separate it from the plainer production buildings, but this is not independently confirmed by
  any fetched primary source — mark exact silhouette `(?)`. Animation: constant 2-frame loop
  (tiles 2/3, 30-tick) in all 3 states, i.e. it "pulses" continuously regardless of activity
  (it has no busy/ready distinction to show, since it never produces anything itself).
  [OpenDUNE `table/animation.c` program 20]
- **Sega**: per StrategyWiki, **House of IX is "only featured in the MS-DOS and Amiga
  versions"** — i.e. likely absent entirely from the Sega Genesis port, with its unlock role
  probably folded directly into the High-Tech/Vehicle Factory (see DKennedy's Genesis FAQ Q8,
  which describes the High-Tech Factory alone as gating the House weapons and Ornithopters, never
  mentioning IX by name). Treat as a well-supported but not 100%-certain removal — mark `(?)` for
  final confirmation against an actual Genesis ROM/longplay. This is the single most
  consequential Sega-vs-PC structural difference found in this research pass.
  [StrategyWiki Dune II Buildings page; DKennedy Genesis FAQ Q8]
- Sources: OpenDUNE structureinfo.c/unitinfo.c/animation.c; official manual; StrategyWiki;
  DKennedy Genesis FAQ.

### Starport
- **Stats**: 3×3, cost 500, build 120, HP 500, power 50, fog radius 6, prereq Refinery+Wind Trap,
  all houses, tech mission 6, sort priority 32. `busyStateIsIncoming=true`, `conquerable=true`,
  no upgrade levels. [OpenDUNE structureinfo.c]
- **Behaviour**: see the dedicated "Starport economy" subsection above for the full price/stock/
  delivery model. Additional notes: once a house has a Starport, its Construction Yard(s) cannot
  produce a second one until the first is destroyed (same rule as Palace); if the Starport is
  destroyed while a Frigate is already inbound, that Frigate instead drops its cargo at a random
  point on the map rather than losing it outright; the Order Screen's STOP button only cancels
  Starport self-repair, never a pending delivery; the missile tank and Ornithopter are labelled
  "LAUNCHER" and "THOPTER" respectively on its order screen; **AI-controlled bases never build
  Starports in the campaign** — it is a player-exclusive economic tool. [Ledmeister PC FAQ §21]
- **Visual (PC)**: `starport.wsa`, the largest footprint tied with Palace (3×3) — read as a
  landing-pad/control-tower complex. Ledmeister explicitly documents a **"landing pad" with
  lights that flash in a pattern whenever a Frigate is expected**, the same mechanic as the
  Refinery's harvester-docking lights. Animation: idle/busy (programs 5/6) share identical
  content (2-frame loop, tiles 2/3, 30-tick); **ready (program 7) switches to a distinct 2-frame
  loop on tiles 8/9** — almost certainly the flashing landing-pad-lights cue itself.
  [OpenDUNE `table/animation.c` programs 5/6/7; Ledmeister PC FAQ §21]
- **Sega**: functionally different in a way that changes strategy, per DKennedy's Genesis FAQ:
  on PC the Starport is a *supplement* that lets you exceed the ~25-unit production quota by
  buying extra units; **on Genesis it explicitly does not lift that quota** — instead it behaves
  as "an alternative to the vehicle factory," useful mainly because (a) Ordos players *need* it
  to obtain Missile Launchers at all, and (b) it is a prerequisite to build a Palace (matching
  the PC's own Starport→Palace prerequisite, so not itself a new rule, but flagged there because
  the community treats it as the practical reason to build one on Genesis). [DKennedy Genesis
  FAQ Q1] Cost/HP/power numbers found in the Genesis FAQ table were identical to PC (500/−50/3×3)
  — `(?)` whether that's a real match or an un-updated copy from the PC source text.
- Sources: OpenDUNE structureinfo.c/animation.c; Ledmeister PC FAQ §21; tasvideos.org; DKennedy
  Genesis FAQ.

### Palace
- **Stats**: 3×3, cost 999, build 130, HP 1000, power 80, fog radius 5, prereq Starport, all
  houses, tech mission 8, sort priority 5 (very low number = drawn/considered early despite being
  a late-game structure — sort priority governs UI/processing order, not availability). No
  upgrade levels, `spawnChance=128` (its captured-unit spawn weight is nonzero, unlike most other
  non-military structures), `conquerable=false`. [OpenDUNE structureinfo.c]
- **Behaviour**: see "Superweapons" subsection above for the full Death Hand/Fremen/Saboteur
  breakdown. Additional Palace-specific notes: a new Palace's weapon is ready to fire
  immediately on placement (exploitable by scrap-and-rebuild for a fast recharge reset); having a
  Palace blocks producing a second one from the same Construction Yard until the first is lost;
  clicking a friendly Palace shows its weapon icon plus a countdown-to-ready bar in the Command
  Window; an Ordos Palace tightly boxed in by other buildings/walls/units may be unable to find a
  free tile to deploy its Saboteur. Losing your only Palace in the late campaign typically ends
  the mission. [OpenDUNE structureinfo.c; Ledmeister PC FAQ §16]
- **Visual (PC)**: `palace.wsa`, tied for the largest footprint (3×3) and by far the highest HP
  (1000) and cost (999) of any structure — read as an ornate fortress/keep, distinctly more
  decorated than the utilitarian production buildings, consistent with manual flavour ("awarded
  to chosen leaders... serves as command centre... many feature unique additional options" — i.e.
  each house's Palace is stated to look meaningfully different, not just recoloured).
  Animation: a constant 2-frame loop (tiles 2/3, 30-tick, ping-pong) in all 3 states — a subtle
  ambient flicker (banner/beacon-scale detail) rather than a large moving part.
  [OpenDUNE `table/animation.c` program 4; official manual text]
- **Sega**: **the Mega Drive version restricts the player to building only ONE Palace**, per
  Sega-16's retrospective review — a hard cap not present (or at least not emphasized) on PC,
  where the constraint is simply "can't build a 2nd while the 1st exists," functionally similar
  but the Sega source explicitly frames it as a fixed one-Palace limitation worth calling out.
  Treat as a genuine, source-flagged Sega difference; exact enforcement mechanism `(?)`.
  [Sega-16.com "Dune: The Battle for Arrakis" review, via search synthesis — recommend
  re-verifying directly against the ROM/longplay before hard-coding this into the remake]
- Sources: OpenDUNE structureinfo.c/structure.c/animation.c; Ledmeister PC FAQ §16; official
  manual; Sega-16.com review.

### Gun Turret
- **Stats**: 1×1, cost 125, build 64, HP 200, power 10, fog radius 2, prereq Outpost+Wind Trap,
  all houses, tech mission 5, sort priority 22, `priorityBuild=75` (AI build-priority weight, the
  only defensive structure with a nonzero `priorityBuild`, alongside Rocket Turret at 100).
  `conquerable=true`. [OpenDUNE structureinfo.c]
- **Combat**: see "Turrets — combat detail" above. In short: 20 damage per shot, Combat-Tank-rate
  fire cadence (`fireDelay=80` ticks), 5-tile diamond scan range, ground+Ornithopter targets
  only, never fires on structures/Death Hands/Frigates, no friendly-fire retaliation, keeps
  fighting while being repaired, spawns facing north, occasionally "fidgets" when idle.
  [OpenDUNE `script/structure.c`; Ledmeister PC FAQ §22]
- **Visual (PC)**: `turret.wsa`, single-tile emplacement with a rotating barrel/turret head — the
  turret's rotation is handled specially at creation
  (`rotationSpriteDiff = g_iconMap[...BASE_DEFENSE_TURRET...]`) and updated via the dedicated
  `Script_Structure_RotateTurret()` script call rather than through the generic
  `animationIndex` system (all three of its `animationIndex` slots are `0xFF`, i.e. no generic
  idle/busy/ready animation at all — 100% of its visible motion is the turn-to-face-target
  rotation). [OpenDUNE `structure.c` `Structure_Create()`; `script/structure.c`
  `Script_Structure_RotateTurret()`]
- **Sega**: no stat delta documented.
- Sources: OpenDUNE structureinfo.c/structure.c/script/structure.c; Ledmeister PC FAQ §22.

### Rocket Turret
- **Stats**: 1×1, cost 250, build 96, HP 200, power 25, fog radius 5, prereq Outpost+Wind Trap
  **plus Construction Yard upgrade level 2** (its actual gate — `availableCampaign=0` is a
  sentinel, campaign number is irrelevant, only `upgradeLevelRequired=2` matters), all houses,
  sort priority 26, `priorityBuild=100` (highest AI defensive build-priority in the table).
  `conquerable=true`. [OpenDUNE structureinfo.c]
- **Combat**: see "Turrets — combat detail" above. Superset of the Gun Turret: identical
  20-damage/80-tick bullet inside 3 tiles, **plus** a 30-damage/120-tick-cadence rocket
  (`UNIT_MISSILE_TURRET`) out to 8 tiles beyond that. Only one rocket fires per attack despite the
  twin-pod sprite. Rockets ignore line-of-sight obstructions entirely; the short-range cannon
  shot is blocked by mountains and enemy turrets/rocket turrets/walls.
  [OpenDUNE `script/structure.c` `Script_Structure_Fire()`; Ledmeister PC FAQ §19]
- **Visual (PC)**: `rturret.wsa`, same 1×1 single-tile-emplacement family as the Gun Turret, with
  a visibly different (twin-pod/launcher) turret head; same rotation-via-script mechanism, same
  `animationIndex = [0xFF,0xFF,0xFF]` (no generic animation beyond rotation).
  [OpenDUNE `structure.c`, `script/structure.c`]
- **Sega**: no stat delta documented.
- Sources: OpenDUNE structureinfo.c/structure.c/script/structure.c; Ledmeister PC FAQ §19.

### Construction Yard
- **Stats**: 2×2, cost effectively N/A (your very first one is free; additional ones only come
  from deploying a purchased/produced MCV, whose own cost varies by mission and by whether it
  was bought at a Starport or built at a Heavy Factory), build 80 (applies to the MCV→CY
  transformation), HP 400, power 0, fog radius 3, `structuresRequired = FLAG_STRUCTURE_NEVER`
  (cannot be queued from any build menu — it only ever comes from deploying an MCV),
  `availableCampaign=99` (sentinel, not a real mission gate), sort priority 0 (lowest — drawn/
  processed first). `conquerable=true` (capturing an enemy Construction Yard is a real, load-
  bearing tactic — see below). [OpenDUNE structureinfo.c]
- **Behaviour**: the hub that builds every other structure; has two upgrade levels
  (`upgradeCampaign = [4, 6]`, cost 400/2 = 200 each): **level 1 unlocks the Large (2×2) Concrete
  Slab**, **level 2 unlocks the Rocket Turret** (and additionally requires that the house already
  has Outpost+Wind Trap built, since those are Rocket Turret's own prerequisites — a belt-and-
  braces check in `Structure_IsUpgradable()`). Does not draw power from Wind Traps itself, but
  still takes power-shortage damage like everything else once the house-wide supply falls short;
  your very first Construction Yard specifically is immune to power-shortage damage until the
  first friendly Wind Trap is built or an enemy one is captured. New Construction Yards always
  start with Concrete pre-selected as their first build option. If a house's last Wind Trap is
  lost, player Construction Yards are restricted to only Concrete/Wind Trap options (AI-owned
  ones are exempt and can rebuild anything, anytime). **A captured enemy Construction Yard can
  only ever build structure types the capturing house already had access to** — e.g. a Harkonnen
  player capturing an Atreides Construction Yard immediately sees its Barracks option flip from
  Soldier-producing to Trooper-producing, and any Light-Vehicle-only option disappears if
  Harkonnen hadn't unlocked it yet. Mid-production orders can be swapped freely before the
  resulting structure is actually placed on the map, with a full refund of whatever was already
  spent. [OpenDUNE structureinfo.c/structure.c; Ledmeister PC FAQ §13, §26, §27]
- **Visual (PC)**: `construc.wsa`. Despite the intuitive expectation of a visible crane, the raw
  animation data shows only a **plain constant 2-frame loop (tiles 2/3, 30-tick, ping-pong)** in
  all three engine states — i.e. the original 1992 sprite very likely does **not** have an
  animated crane arm; that visual language (crane swinging, doors opening on delivery) is more
  associated with later Westwood titles (Dune 2000/C&C) and should not be assumed here without
  independent confirmation from the actual sprite sheet. Treat "no moving crane" as the current
  best reading of the primary data, `(?)` pending direct sprite-sheet inspection (blocked in this
  research pass — see Sources/gaps). [OpenDUNE `table/animation.c` program 22]
- **Sega**: no stat delta documented for the base building; general Sega visual differences apply
  (see Sega vs PC section).
- Sources: OpenDUNE structureinfo.c/structure.c/animation.c; Ledmeister PC FAQ §13, §26, §27.

---

## Sega Genesis vs PC/DOS — consolidated differences

Confidence varies per item; everything here is also repeated in its structure's own section with
full citation. Ranked roughly most‑ to least‑confident:

1. **Controls/placement UI, not stats**: Genesis replaces mouse-driven placement with a D-pad/
   gamepad "placement grid" cursor moved at 3 speeds (low/med/high depending on button hold);
   pressing B swaps between the placement grid and the normal selection cursor. Full-screen game
   view (no permanent status bar — context-sensitive controller UI instead), and the build menu
   is redesigned as a "radio transmitter"-styled single-screen icon grid instead of PC's sidebar.
   This context-sensitive-cursor approach was later reused (and refined) by Westwood for Command
   & Conquer. [Ledmeister Genesis FAQ §1; HG101; Wikipedia "Dune II"]
2. **Sprites redrawn and generally larger**, especially structures (units less so); music
   re-composed in a similar style rather than reused. [Sega-16.com review; HG101]
3. **Only one Palace can ever be built** on Genesis, vs. PC's "no 2nd while the 1st lives" rule
   (functionally close but explicitly called out as a hard single-Palace limitation for this
   port). [Sega-16.com review — recommend re-verifying against ROM]
4. **House of IX likely does not exist as a separate structure**; the High-Tech Factory (and/or
   the merged Vehicle Factory) appears to directly gate the special units and Ornithopter
   instead. Best-supported non-cosmetic structural difference found. [StrategyWiki; DKennedy
   Genesis FAQ Q8 — not confirmed against an actual ROM/longplay in this pass]
5. **Light Factory and Heavy Factory are likely merged into one "Vehicle Factory"** that builds
   both light and heavy vehicles from the start, rather than Light Factory gating Heavy Factory
   as a separate prerequisite. Supported by StrategyWiki plus the consistent absence of the term
   "Light Factory" in both Genesis-specific community FAQs reviewed, but exact merged-building
   cost/HP/power were not independently recovered (the one Genesis-labelled FAQ table found
   simply repeats the PC numbers, which may just mean the author didn't update it — `(?)`).
   [StrategyWiki; Ledmeister & DKennedy Genesis FAQs]
6. **Starport does not lift the ~25-unit production cap** on Genesis the way it does on PC; it's
   framed by the community as "an alternative to the vehicle factory" rather than a way to
   exceed quota, though it remains Ordos's only way to get Missile Launchers and is still the
   Palace prerequisite on both platforms. [DKennedy Genesis FAQ Q1]
7. **Concrete-penalty formula and power/decay mechanics are documented identically** between the
   PC and Genesis editions of Ledmeister's FAQ (verbatim-matching paragraphs), which is decent
   (though not conclusive) evidence that the core structure-decay, power-shortage, and
   bare-rock-damage math were **not** changed for the port. Treat "mechanics same, presentation
   different" as the working assumption unless/until contradicted. [Ledmeister PC & Genesis FAQ
   §10, §25, verbatim cross-check performed in this research pass]
8. Vaguer, unconfirmed claims seen in secondary web summaries but **not independently verified**
   in this pass: "changes to the tech tree," "construction doesn't take nearly as long," "unit
   costs differ." These may simply be describing items 4–6 above rather than additional changes.
   Mark all as `(?)` pending direct ROM/longplay inspection. [Sega-16.com review; general web
   search synthesis]

## Gaps / open questions for follow-up

- No pixel-accurate sprite sheets were obtainable in this pass — Fandom, Sega Retro, GameFAQs,
  StrategyWiki and The Spriters Resource all actively block automated fetching (402/403/Cloudflare
  "Anubis" bot-challenge responses on every direct attempt, including via `curl` with a browser
  UA and via Wayback Machine mirrors of some of them). Visual descriptions above are built from
  manual flavour text, community stat-wiki text descriptions, the OpenDUNE animation *tile-swap
  timing* data (exact), and general knowledge of the game's art direction — **shapes/domes/colour
  placement beyond what's explicitly cited should be treated as informed inference, not verified
  fact**, and should be checked against an actual emulator screenshot or ROM extraction before
  being treated as ground truth for modelling.
- "Shield" values from Ledmeister's FAQ diverge from OpenDUNE's `hitpoints` by inconsistent
  multipliers per structure (2× for some, up to 9× for Repair Facility) — most likely reflects a
  different game patch/version (Dune II had at least a 1.0 and a 1.07 revision with rebalanced
  numbers) rather than a simple unit-scale conversion. Not reconciled in this pass; OpenDUNE's
  numbers are used as primary per the task brief, Ledmeister's are kept as flagged alternates.
- Sega-specific numeric stats (cost/HP/power) for any merged/changed building were not
  independently recovered — only the PC-identical numbers from a same-author FAQ pair, which is
  weak evidence either way.
- Armor-*type* (as opposed to raw hitpoints) is not a field that exists in OpenDUNE's
  `structureinfo.c` — a couple of fan wikis label structures "Light/Medium/Heavy/Structure"
  armor, which looks like editorial categorization rather than a coded stat; do not implement a
  Dune-2000-style armor-class damage-multiplier system for Dune II structures without further
  verification.
- Exact real-time-to-game-tick conversion (how many wall-clock seconds one game tick represents
  at Normal speed) was not pinned down precisely; `buildTime`/tick-based figures throughout this
  document should be treated as correctly-ordered and internally consistent, but not validated
  against a stopwatch.

## Sources

- OpenDUNE (github.com/OpenDUNE/OpenDUNE), raw source, fetched via `raw.githubusercontent.com`:
  - `src/table/structureinfo.c` — https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/structureinfo.c
  - `src/structure.c` — https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/structure.c
  - `src/house.c` — https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/house.c
  - `src/table/houseinfo.c` — https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/houseinfo.c
  - `src/table/unitinfo.c` — https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/unitinfo.c
  - `src/table/animation.c` — https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/animation.c
  - `src/script/structure.c` — https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/script/structure.c
  - `src/gui/widget_click.c` — https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/gui/widget_click.c (checked for a sell/bulldoze function; none found — used as negative evidence)
  - Repository file tree — https://api.github.com/repos/OpenDUNE/OpenDUNE/git/trees/master?recursive=1
- tasvideos.org Dune II technical notes — https://tasvideos.org/GameResources/DOS/Dune2
- Ledmeister, "Dune II: The Building of a Dynasty" FAQ/reference (PC), via Wayback Machine —
  https://web.archive.org/web/20190511043114/https://gamefaqs.gamespot.com/pc/564691-dune-ii-the-building-of-a-dynasty/faqs/1520
- Ledmeister, "Dune: The Battle for Arrakis" FAQ/reference (Sega Genesis), via Wayback Machine —
  https://web.archive.org/web/20211129185412/https://gamefaqs.gamespot.com/genesis/586152-dune-the-battle-for-arrakis/faqs/1520
- GRomaine, Dune II PC strategy guide/FAQ, via Wayback Machine —
  https://web.archive.org/web/20211019221023/https://gamefaqs.gamespot.com/pc/564691-dune-ii-the-building-of-a-dynasty/faqs/1521
- DKennedy, "Dune: The Battle for Arrakis" (Genesis) FAQ, via Wayback Machine —
  https://web.archive.org/web/20210506135320/https://gamefaqs.gamespot.com/genesis/586152-dune-the-battle-for-arrakis/faqs/1519
- dunerts.wiki.gg (Dune RTS Wiki) per-structure "(Dune II)" pages: Turret, Rocket Turret,
  Wind Trap, Construction Yard, Silo, Outpost, Palace, Starport, Refinery, Heavy Factory,
  Barracks, Wall — https://dunerts.wiki.gg/wiki/<Name>_(Dune_II)
- Official Dune II manual text mirrors: https://duneii.nahoo.net/buildings/ and
  https://dune2k.com/Duniverse/Games/DuneII/Manual (abandonwaredos.com mirror blocked by
  Cloudflare in this pass and not used)
- StrategyWiki, "Dune II: The Building of a Dynasty/Buildings" (via Wayback Machine) —
  https://web.archive.org/web/20110604143459/http://strategywiki.org:80/wiki/Dune_II:_The_Building_of_a_Dynasty/Buildings
- Wikipedia, "Dune II" — https://en.wikipedia.org/wiki/Dune_II
- Hardcore Gaming 101, "Dune II: The Building of a Dynasty" — https://www.hardcoregaming101.net/dune-ii-the-building-of-a-dynasty/
- Sega-16.com, "Dune: The Battle for Arrakis" review — https://www.sega-16.com/2005/08/dune-the-battle-for-arrakis/ (accessed via search synthesis, not a direct fetch — re-verify before hard-coding the single-Palace claim)
- Explicitly attempted and **blocked/unusable** in this pass (bot protection or paywall — not
  cited for any specific fact above): dune.fandom.com (HTTP 402 on every page), segaretro.org
  (Anubis bot-challenge), www.spriters-resource.com (Cloudflare challenge), GameFAQs direct
  fetch (403; worked around via Wayback Machine + curl instead), strategywiki.org direct fetch
  (403; worked around via Wayback Machine), dune2k.com "Community/Articles/Melange/*" pages —
  **note for future researchers: this "Melange" content is a fan-made Dune-universe total-
  conversion mod (with a Corrino house, Shield Towers, Geothermal Stations, etc.), not the
  original 1992/1993 game — it was fetched once by mistake during this research, recognized as
  off-topic, and deliberately excluded from every fact and figure above.**
