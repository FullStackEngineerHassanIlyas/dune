# Dune II / Dune: The Battle for Arrakis — Mechanics, Campaign, AI & Genesis Research

Scope: game **systems** (map/terrain, economy, power, production, combat, sandworms, fog of war,
orders/AI, enemy AI, campaign, Genesis port, history). Per-unit and per-structure stat sheets and
audio are covered by other research files — numbers here are quoted only to illustrate a *system*.

Primary source for exact numbers: the **OpenDUNE** reverse-engineering project
(github.com/OpenDUNE/OpenDUNE), which is a line-for-line reconstruction of the original 1992
DOS executable (confirmed against `src/table/*.c` data tables and `src/*.c` game logic, retrieved
2026-09-28 from the `master` branch). Where OpenDUNE's own "ENHANCEMENT" comments mark a
deliberate deviation from the original, that is called out explicitly — the un-enhanced branch is
what's described unless noted. Secondary sources (manual text, wikis, reviews) fill in campaign
lore, Genesis-specific facts, and reception, and are cited per section. Facts I could not pin to a
primary source are marked **(?)**.

Many reference sites (segaretro.org, GameFAQs, MobyGames, Fandom wikis) are behind bot-blocking
(Anubis/Cloudflare challenges) that this research session's fetch tools could not pass; where a
fact rests only on a search-engine snippet of such a page rather than a direct read, that is noted.

---

## 1. Map & Terrain

Source: `src/map.c`, `src/map.h`, `src/table/landscapeinfo.c`, `src/tile.c` (OpenDUNE, github.com/OpenDUNE/OpenDUNE).

### 1.1 Map size

The internal map is always a **64×64 tile grid** (`g_map[64*64]`), but each scenario only exposes
a rectangular playable window of it via `g_mapInfos[3]` (`src/map.c` lines 55-61):

| Scale index | Size | Origin offset |
|---|---|---|
| 0 | **62×62** | (1,1) |
| 1 | **32×32** | (16,16) |
| 2 | **21×21** | (21,21) |

A scenario's `.INI` picks one via `BASIC/MapScale` (0/1/2; `src/scenario.c`). Community mapping
of actual campaign files indicates the first mission(s) of each house use the small **32×32**
scale as a simple tutorial map, with most of the campaign using the full **62×62** scale (?) —
the 1-tile border on all sides of the 64×64 grid is an invisible buffer used for off-map unit
movement (e.g. ornithopters/Carryalls entering/leaving). Tile coordinates are packed as a single
`uint16` (`Tile_PackXY`), and each `Tile` struct is 4 bytes: ground sprite id, overlay id,
owning house, `isUnveiled`, `hasUnit`, `hasStructure`, `hasAnimation`, `hasExplosion`, and an
object index.
Source: `src/map.c:55-61`, `src/map.h` (`MapInfo`, `Tile`).

### 1.2 Terrain types and movement

`LandscapeType` enum (`src/map.h`) has 15 values: `NORMAL_SAND, PARTIAL_ROCK, ENTIRELY_DUNE,
PARTIAL_DUNE, ENTIRELY_ROCK, MOSTLY_ROCK, ENTIRELY_MOUNTAIN, PARTIAL_MOUNTAIN, SPICE,
THICK_SPICE, CONCRETE_SLAB, WALL, STRUCTURE, DESTROYED_WALL, BLOOM_FIELD`.

Each has a `movementSpeed[6]` array, one entry per `MovementType` (`FOOT, TRACKED, HARVESTER,
WHEELED, WINGER, SLITHER`), out of 255 = that unit type's own full speed (255 ≈ 100%, 0 =
impassable). `SLITHER` is the Sandworm's movement type — it doubles as the "can a worm reach this
tile" column. Source: `src/table/landscapeinfo.c` (full table below), `src/unit.h` (`MovementType`
enum: `FOOT=0, TRACKED=1, HARVESTER=2, WHEELED=3, WINGER=4, SLITHER=5`).

| Terrain | Foot | Tracked | Harvester | Wheeled | Winger (air) | Slither (worm) | Buildable? | Sand (spice-growable)? |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Normal Sand | 112 | 112 | 112 | 160 | 255 | 192 | No | Yes |
| Partial Rock (rock edge, mostly sand) | 160 | 112 | 112 | 64 | 255 | 0 | No | No |
| Entirely Dune | 112 | 160 | 160 | 160 | 255 | 192 | No | Yes |
| Partial Dune | 112 | 160 | 160 | 160 | 255 | 192 | No | Yes |
| Entirely Rock | 112 | 160 | 160 | 112 | 255 | 0 | **Yes** | No |
| Mostly Rock (rock edge, mostly rocky) | 160 | 160 | 160 | 160 | 255 | 0 | **Yes** | No |
| Entirely Mountain | 64 | 0 | 0 | 0 | 255 | 0 | No | No |
| Partial Mountain | 64 | 0 | 0 | 0 | 255 | 0 | No | No |
| Spice | 112 | 160 | 160 | 160 | 255 | 192 | No | Yes |
| Thick Spice | 112 | 160 | 160 | 160 | 255 | 192 (wobbles) | No | Yes |
| Concrete Slab | 255 | 255 | 255 | 255 | 255 | 0 | **Yes** | No |
| Wall | 0 | 0 | 0 | 0 | 255 | 0 | No | No |
| Structure (occupied tile) | 0 | 0 | 0 | 0 | 255 | 0 | No | No |
| Destroyed Wall (rubble) | 160 | 160 | 160 | 160 | 255 | 0 | **Yes** | No |
| Bloom Field (hides a spice bloom) | 112 | 112 | 112 | 160 | 255 | 192 | No | Yes |

Notes:
- Mountains are **impassable to all ground vehicles** (Tracked/Harvester/Wheeled = 0) and merely
  slow for infantry (64); only Ornithopters/Carryalls (Winger, always 255) cross freely.
- **Sandworms can only travel on sand-family tiles** (Normal Sand, Dune, Partial Dune, Spice,
  Thick Spice, Bloom Field, Normal Sand) — `SLITHER` speed is 0 on every rock/mountain/concrete/
  wall tile. This is the source-verified basis for "rock is safe from worms."
  Source: `src/table/landscapeinfo.c`.
- `letUnitWobble` is true on Partial Rock, Entirely Rock, Mostly Rock, Mountain tiles and Thick
  Spice — units visually "wobble" walking on rough terrain.
- Buildability has two flags: `isValidForStructure` (true only for Entirely Rock, Mostly Rock,
  Concrete Slab, Destroyed Wall — i.e. normal rocky/paved ground) and `isValidForStructure2`
  (structures whose `notOnConcrete` flag is set, e.g. Concrete Slabs themselves, can also go on
  Entirely Rock/Mostly Rock/Destroyed Wall). **Sand, dune, spice and mountain are never
  buildable.** A structure placed off Concrete is still allowed (with a warning) but is
  immediately flagged to structurally decay — see §4.4.
  Source: `src/structure.c` `Structure_Place` (`validBuildLocation` handling).
- `craterType` (0 none / 1 sand crater / 2 concrete-crack crater) drives which scorch-mark
  decal an explosion leaves.
- Radar/minimap colour and the on-map sprite id per terrain are also part of this table
  (columns `radarColour`, `spriteID`), useful directly for a remake's minimap palette.

### 1.3 Spice, blooms, and regeneration

- Spice fields are simply Sand/Dune tiles whose type has been switched to `LST_SPICE` /
  `LST_THICK_SPICE`; `canBecomeSpice` is true for every sand-family tile, false for rock/mountain/
  concrete/wall.
- **Spice blooms**: `Map_Bloom_ExplodeSpice(packed, houseID)` — triggered by a unit or bullet
  hitting a `LST_BLOOM_FIELD` tile — removes whatever unit is standing on it, restores the
  underlying ground sprite, spawns an `EXPLOSION_SPICE_BLOOM_TREMOR` visual/sound, and then calls
  `Map_FillCircleWithSpice(packed, 5)`: **every tile within radius 5** (Chebyshev-ish, using
  packed-tile distance) that isn't already `LST_SPICE` is converted to spice, with a coin-flip
  chance to skip tiles exactly on the radius edge (soft/organic circle edge). A second special
  bloom type, `Map_Bloom_ExplodeSpecial`, exists for scripted "special" blooms (e.g. inserted
  by a scenario) with different fill behaviour.
  Source: `src/map.c:669-710` (`Map_Bloom_ExplodeSpice`, `Map_FillCircleWithSpice`).
- **Spice regrowth**: a destroyed Harvester spills its unconsumed load back onto the sand —
  `Map_FillCircleWithSpice(pos, unit->amount / 32)` (radius scales with how full it was, max
  amount 100 → radius ~3). Beyond that, I did not find a periodic/ambient "spice regrows over
  time" tick in the reachable source in this session **(?)** — the commonly repeated claim that
  spice fields slowly regenerate may only be true via blooms and harvester spillage, not ambient
  growth; OpenDUNE's own `Map_ChangeSpiceAmount` is called (radius search) when a Harvester
  depletes a tile, decrementing it, but no symmetric ambient increment was located in the files
  fetched this session.

### 1.4 Map generation algorithm (`Map_CreateLandscape`, `src/map.c:1441-1620`)

Each scenario stores only a 32-bit **seed** (`MAP/Seed` in the `.INI`); the actual tile layout is
procedurally generated at load time. High-level algorithm (mirrors the original DOS binary):
1. Seed the game's RNG (`Tools_Random_Seed(seed)`).
2. Fill a coarse **16×16 grid of "height" values 0–10** (one sample every 4 tiles) with random
   noise, then apply 1–16 random "hill" blotches and 1–4 random "flatten" blotches by nudging a
   21-point neighbourhood stencil (`around[]`, a plus/diamond/knight's-move pattern) around
   random centers.
3. Write those 256 samples onto the 64×64 grid at every 4th tile, then **linearly interpolate**
   the missing tiles between grid points (a diamond-square-like midpoint averaging pass using a
   fixed per-parity offset table `_offsetTable`).
4. Run a **9-neighbour box-blur** over the entire 64×64 grid (averaging each tile with its 8
   neighbours, clamped at map edges) to smooth the noise into continuous terrain.
5. **Threshold** the smoothed height value into terrain classes: pick two random cut points
   (`spriteID1` clamped 8–12, `spriteID2` a few steps below it) — height ≥ spriteID1+4 → Mountain,
   ≥ spriteID1 → Rock, ≤ spriteID2 → Dune, else → plain Sand. This is why rock/mountain always
   forms smooth blob "islands" inside a sand field: it's literally a filtered heightmap.
6. **Sprinkle spice**: 0–47 random spice "seed" tiles are chosen (must land on a tile whose type
   `canBecomeSpice`), then around each seed, 0–31 more nearby tiles (random walk offsets) are
   spice-ified via `Map_AddSpiceOnTile` — this is what produces the characteristic spice-field
   "blobs" rather than a uniform scatter.
7. A final smoothing/edge-detection pass recomputes the correct tile-transition sprite (which of
   the 4 neighbours match, to pick the right edge/corner graphic) for every tile.
Structures, units, and the special "thick spice" core of each field are placed separately by the
scenario file after this base landscape exists.
Source: `src/map.c:1441-1620` (`Map_CreateLandscape`).

Sources for §1: OpenDUNE `src/map.c`, `src/map.h`, `src/table/landscapeinfo.c`
(github.com/OpenDUNE/OpenDUNE); community confirmation of the 64×64/62×62 relationship:
https://github.com/gameflorist/dunedynasty/discussions/16 and https://dune2themaker.fundynamic.com/2021/04/20/devlog-bigger-smaller-maps/ ;
early-mission map-scale note from a Dune II Map Seed thread, https://forum.dune2k.com/topic/19548-dune-2-seed-file-map-codes/ (?).

---

## 2. Economy

Source: OpenDUNE `src/house.c`, `src/script/structure.c`, `src/structure.c`, `src/table/structureinfo.c`, `src/gui/gui.c`; manual text via https://dune2k.com/Duniverse/Games/DuneII/Manual and https://archive.org/stream/dune-ii-manual/Dune%20II%20Manual_djvu.txt.

### 2.1 Harvesting → credits conversion

- A Harvester's fullness is tracked as a single byte **`amount`, 0–100** (not a literal spice
  count). While sitting on a `LST_SPICE`/`LST_THICK_SPICE` tile with `amount < 100` it gains
  `Random(0-1)` amount per script tick (i.e. average +0.5/tick, so filling up is somewhat slow and
  randomized) and there's a 1-in-32 chance each tick that the tile's spice is also decremented by
  1 (`Map_ChangeSpiceAmount`) — thick spice depletes slower/differently in practice because those
  tiles hold more spice per decrement. Source: `src/script/unit.c` `Script_Unit_Harvest`
  (lines 1640-1670).
- **Unloading/refining** happens continuously while the Harvester is docked/linked to a Refinery
  (`Script_Structure_RefineSpice`, `src/script/structure.c:105-152`):
  - `harvesterStep = (refinery.hitpoints * 256 / refinery.maxHitpoints) * 3 / 256` — i.e. **3
    "amount" points per refine tick at full Refinery health**, scaled down proportionally if the
    Refinery is damaged (a damaged refinery processes spice slower).
  - `creditsStep = 7 * harvesterStep` for the player; for an AI house a small random ±1 jitter is
    applied to the base "7" first.
  - The refine tick repeats every 6 game-ticks (`s->o.script.delay = 6`).
  - **Net result: a full 100-amount Harvester load is worth ≈700 credits** (100/3 ≈ 34 ticks ×
    21 credits), delivered in ~21-credit increments roughly every 6 ticks rather than as one lump
    sum — this matches the commonly-quoted "700 credits per harvester load" figure exactly.
  - Community walkthrough confirmation: "every load brings in 700 credits" — https://strategywiki.org/wiki/Dune_II:_The_Building_of_a_Dynasty/Mission_1 .

### 2.2 Storage (Refinery + Silo) and overflow

- Each structure that can store spice has a static `creditsStorage`; a house's total capacity is
  the **sum over all its structures** (recomputed every time a building is added/lost):
  **Refinery = 1005, Spice Silo = 1000** (each). Source: `src/table/structureinfo.c`.
- Global cap enforcement (`src/house.c` `GameLoop_House`, lines ~185-215): every house tick, if
  `credits > creditsStorage`, the excess is **destroyed outright** (`credits = creditsStorage`);
  for the human player this pops the message *"Insufficient spice storage available, available
  spice is lost."* There is no partial refund or spillback — it is a hard clamp.
  - The player also gets a warning at 200%+ of an about-to-overflow state: *"Spice storage
    capacity low, build more Silos"* once stored credits exceed 200/256 (~78%) of capacity
    (from campaign mission 2 onward), and a low-funds nag *"Credits are low, harvest spice for
    more credits"* below 100 credits.
- **"Free" storage before you own any Silo**: `g_playerCreditsNoSilo` is initialised to the
  mission's **starting credits** value at scenario load (`src/scenario.c:78`). Until your built
  storage (`creditsStorage`) exceeds that starting amount, the effective cap used is
  `max(creditsStorage, g_playerCreditsNoSilo)` — i.e. **your starting stash also acts as your
  initial storage ceiling**, so you are not instantly capped near-zero before your first
  Refinery/Silo exists. This buffer is permanently revoked (set to 0) the moment your built
  capacity exceeds it, or if you ever lose every structure you own.
  Source: `src/house.c:185-215, 524-526`.
- **Destroying an enemy Refinery/Silo drains their bank**: on structure destruction, the owner's
  credits are cut by the same *fraction* of their total that structure's storage represented:
  `credits -= (credits * 256/creditsStorage) * destroyedStructure.creditsStorage / 256`. This is
  literal spice loss (spilled/ruined), not just lost future capacity — a nice raid incentive.
  For AI-owned structures only, from mission 8 onward the AI also receives an
  insurance-like credit refund of `buildCredits × 1.5` when one of its buildings is destroyed
  (`buildCredits + buildCredits/2` if `campaignID > 7`, else just `buildCredits`) — a
  late-campaign rubber-band that keeps the AI solvent. Source: `src/structure.c` `Structure_Destroy` (~line 1005-1024).

### 2.3 Starting credits / quota

Per-mission, per-house starting `Credits` and win-`Quota` are plain fields in each scenario
`.INI` (`[House]` section) — there is no single global constant. Mission 1 (all houses,
commonly) starts with **1000 credits** and a **1000-credit accumulation quota**
(`WinFlags` bit 0x4, see §10). Source: `src/scenario.c:67-69` (`Credits`, `Quota`,
`MaxUnit` keys, default `MaxUnit=39` if unspecified); mission-1 numbers cross-checked at
https://strategywiki.org/wiki/Dune_II:_The_Building_of_a_Dynasty/Mission_1 .

### 2.4 Selling / repair cost

- **Dune II (1992) has no "sell structure for a refund" command** — confirmed absent from the
  entire OpenDUNE source (`grep -i sell` returns nothing in `structure.c`/`gui/*.c`) and
  explicitly stated by community sources: selling buildings was introduced later, in *Dune 2000*
  (1998), not the original. A remake aiming for 1992 fidelity should **not** include a sell
  button. (?) confidence: high, based on absence-of-evidence in a full engine reimplementation
  plus consistent secondary-source agreement.
- **Structure self-repair** (via the wrench/repair toggle): cost per tick ≈
  `2 × buildCredits / maxHitpoints`, restoring **+5 HP/tick** if the owner is the player (or any
  AI from campaign mission 3 onward) or **+3 HP/tick** for AI in missions 1-2. Net effect: fully
  repairing a structure from 0 HP costs roughly **40% of its original build price**
  (`2×buildCredits/5`, algebraically). Repair auto-pauses ("on hold") if funds run out and
  auto-resumes once the house has any credits again. Source: `src/structure.c:146-166`.
- **Unit repair at the Repair Pad**: cost is computed the same way factories cost out production
  (`buildCredits × 256 / buildTime`, scaled by the Repair Pad's own build-speed factor — see
  §4.2) but **divided by 4** — repairing is roughly a quarter the pro-rated cost of building new,
  paid progressively while the unit sits on the pad; also pauses on insufficient funds. Source:
  `src/structure.c:266-296` (the two adjacent, differently-scaled repair code paths — structure
  self-repair vs. Repair-Pad unit repair — are easy to conflate; both are cited above from their
  distinct line ranges).

### 2.5 Starport pricing

- The Starport catalogue re-rolls a **randomised price** for every unit type each time it is
  computed: `price = (buildCredits/10)×4 + (buildCredits/10)×(rand(0-6)+rand(0-6))`, i.e. roughly
  40%–160% of the unit's normal build cost (centered a bit above 100%, since the two dice average
  3+3), capped at 999. Source: `src/gui/gui.c:2726` (`GUI_FactoryWindow_CalculateStarportPrice`).
- Per-mission unit **availability** at the Starport (which types can be bought at all, and how
  many units of stock exist before running out) is scenario-defined via a `[CHOAM]`
  `.INI` section (`Scenario_Load_Choam`, `src/scenario.c`) populating `g_starportAvailable[type]`;
  buying decrements the stock and it goes to "sold out" (`-1`) at zero, independent of the price
  re-roll. Source: `src/scenario.c` (`Scenario_Load_Choam`), `src/structure.c:1626-1629`.
- Ordered units are created immediately but held (linked-list on the Starport) until a **Frigate**
  is spawned and lands after `starportDeliveryTime` ticks (10 for Atreides/Harkonnen/Ordos, 0 for
  the "instant" AI-only houses) — see House table in §10.2. Source: `src/house.c:216-243`,
  `src/table/houseinfo.c`.
- Buying at the Starport (unlike regular factories) can create **many units in a single
  transaction**, bypassing the normal "one at a time" factory rule — see §4.1.

Sources for §2: OpenDUNE (`src/house.c`, `src/script/structure.c`, `src/structure.c`,
`src/table/structureinfo.c`, `src/gui/gui.c`, `src/scenario.c`); manual text
(https://dune2k.com/Duniverse/Games/DuneII/Manual, https://archive.org/stream/dune-ii-manual/Dune%20II%20Manual_djvu.txt);
StrategyWiki Mission 1 walkthrough (https://strategywiki.org/wiki/Dune_II:_The_Building_of_a_Dynasty/Mission_1).

---

## 3. Power

Source: `src/house.c` (`House_CalculatePowerAndCredit`), `src/structure.c`
(`Structure_CalculateHitpointsMax`, `House_UpdateRadarState`), `src/table/structureinfo.c`.

### 3.1 Production & consumption

- Every structure has a single `powerUsage` field: **positive = consumes**, **negative =
  produces**. Recomputed from scratch every house-tick by summing over all owned, placed
  structures. Only the **Windtrap** produces power (`powerUsage = -100`), and only at full
  health — see below. Representative consumption figures (see full cost table in §4.3): Palace 80,
  Outpost (radar) 30, Starport 50, IX Research 40, Heavy Factory 35, Hi-Tech Factory 35, Repair
  Pad 20, Light Factory 20, Barracks/WOR 20/10, Rocket Turret 25, Turret 10, Refinery 30, Silo 5,
  Wall/Slabs/Construction Yard 0.
- **A damaged Windtrap produces proportionally less power**, not a cliff: at full HP it
  contributes its full 100; below full HP it contributes `100 × currentHP/maxHP` — *except* the
  original (non-enhanced) game additionally clamps this at a **hard 50% floor**: if HP ≤ 50% of
  max, production is exactly half (100×0.5=50) regardless of how much further damaged it is
  (OpenDUNE calls this "silly" and only removes the floor in its own "enhanced" mode — the 1992
  original behaves this way). Source: `src/house.c:497-516`.

### 3.2 Effects of a power deficit

There is **no "brownout slows down build speed" effect** in the original engine (a common
misconception) — the actual, code-verified low-power penalty is **structural decay**:
- Every structure's *effective max HP* is recomputed as
  `hitpointsMax = baseHitpoints × (powerProduction×256/powerUsage) / 256`, floored at 50% of
  base. When production ≥ usage this ratio is capped at 256 (100%, i.e. no bonus for surplus
  power). Source: `src/structure.c:623-657` (`Structure_CalculateHitpointsMax`).
- If a structure's *current* HP now exceeds this newly-lowered max, it is immediately dealt 1
  damage per check (i.e. **existing buildings visibly crumble/spark down to the new lower ceiling**
  when you go into deficit) until it settles at the reduced max. Walls, slabs and the structure
  actively being checked are the only exemptions.
- The player also gets a one-shot text warning, *"Insufficient power, windtrap is needed,"*
  whenever `powerUsage > powerProduction` is (re)detected.
- **Radar/minimap requires both an Outpost and powerProduction ≥ powerUsage simultaneously** —
  losing either (destroy the Outpost, or let power go into deficit) blacks out the radar/minimap
  with an animated "static" transition (`STATIC.WSA`); regaining both re-activates it the same
  way. This is a strictly player-house-only mechanic (AI doesn't use a UI radar).
  Source: `src/house.c:371-420` (`House_UpdateRadarState`).
- Net design intent: building more power-hungry structures than you have Windtraps for doesn't
  stop production outright, it makes your *entire base* slowly rot until it re-balances at a
  lower total HP ceiling (and, incidentally, blinds your radar).

Sources for §3: OpenDUNE `src/house.c`, `src/structure.c`, `src/table/structureinfo.c` (github.com/OpenDUNE/OpenDUNE).

---

## 4. Production

Source: `src/structure.c` (`GameLoop_Structure`, `Structure_BuildObject`, `Structure_AI_PickNextToBuild`, `Structure_CancelBuild`), `src/gui/gui.c`, `src/table/structureinfo.c`, `src/table/unitinfo.c`.

### 4.1 One item at a time, queueing, and Starport bulk-buy

- Structurally, a factory building has exactly **one `linkedID` slot** — only one unit/structure
  is ever "actively" under construction per factory at a time.
- The build-selection UI (`g_factoryWindowItems[25]`) lets the player queue **up to 25 distinct
  order-lines** (clicking the same item repeatedly increments its count rather than adding a new
  line), which the factory then works through **one at a time, in list order**, automatically
  starting the next once the current item completes. This matches the commonly-cited "25 items"
  UI limit. Source: `src/gui/gui.c` (`FactoryWindowItem g_factoryWindowItems[25]`), corroborated
  by a strategy FAQ: https://strategygamers.com/walkthrough/dune-2-battle-for-arrakis (via search
  synthesis; direct fetch of the underlying cnc.fandom.com manual page was blocked, HTTP 402).
- **The Starport is the one exception to "one at a time":** a Starport order can create every
  purchased unit **simultaneously** the moment payment clears, each queued onto a shared delivery
  linked-list and flown in together by a single Frigate once it lands. Source: `src/structure.c:1578-1629`.
- Switching a factory's in-progress order to a different item **cancels** the old one and refunds
  the *unspent* fraction of its cost — `refund = buildCredits × (buildTime - elapsedTime)/buildTime`
  (i.e. you get back exactly the proportion of cost you hadn't paid yet, not a flat percentage).
  Source: `src/structure.c:1405-1429` (`Structure_CancelBuild`).

### 4.2 Build time & progressive cost deduction

- Nominal per-tick cost is `buildCredits × 256 / buildTime` (fixed-point, 256 = ×1). This is then
  scaled by a **`buildSpeed`** factor (also out of 256):
  - `buildSpeed = factory.hitpoints × 256 / factory.maxHitpoints` — a damaged factory builds
    (and therefore spends money) proportionally slower.
  - **Additionally capped at `min(buildSpeed, campaignMissionNumber × 20 + 95)`** — i.e. even a
    perfectly healthy factory cannot exceed `(20×N+95)/256` of full speed on mission `N`. This
    means mission 1 factories run at only **~45%** of their eventual top speed, climbing roughly
    linearly until the cap stops mattering around mission 7-8 (`20×8+95=255≈256`). This is a
    deliberate, code-verified **pacing ramp that speeds up construction as the campaign
    progresses**, wholly separate from any per-structure stat. Source: `src/structure.c:175-201`.
  - The Repair Pad's unit-repair cost additionally divides the resulting per-tick cost by 4
    (see §2.4).
- Cost is paid **progressively, every tick**, not upfront or only on completion: each tick,
  `buildCost/256` credits (plus a carried sub-credit remainder, `buildCostRemainder`, so fractional
  cost isn't lost to rounding) are deducted and `countDown` (ticks remaining, in the same 256×
  fixed-point units) is reduced by `buildSpeed`. If the house can't afford the next tick's slice,
  the build **pauses ("on hold")** with the message *"Insufficient funds, construction is
  halted"* and silently resumes the instant funds allow. Source: `src/structure.c:175-220`.
- **Upgrades** (the arrow icon on a factory once a higher tier exists) cost
  `(buildCredits + buildCredits/32768) / 2` — i.e. essentially half the structure's build price —
  and tick down over a fixed **100** countdown ticks once started; an AI house that starts an
  upgrade completes every pending upgrade level **instantly** rather than waiting out the timer.
  One quirk: the Ordos Heavy Vehicle (Factory) upgrade's *final* level is free.
  Source: `src/structure.c:141, 405-424, 1462-1468`.

### 4.3 Tech unlocked by mission number

Every **structure type** carries a static `availableCampaign` (the minimum mission number, 1-9,
at which it enters the build menu) and an `availableHouse` bitmask. Crucially, **units carry no
such field** (`availableCampaign` is 0/unused for every entry in `unitinfo.c`) — unit access is
gated indirectly, by whichever structures/houses can build them, plus whatever a given mission's
own scenario file additionally restricts. So the **campaign-wide structure unlock schedule below
is the same for all three houses** (only the building's reskin/name differs per house), and is
the real backbone of "tech available per mission":

| Unlocks at mission ≥ | Structures |
|---|---|
| 1 | Windtrap, Refinery, Concrete (1×1 slab) |
| 2 | Barracks *or* WOR (house-dependent, see below), Spice Silo, Outpost (radar) |
| 3 | Light Vehicle Factory |
| 4 | Heavy Vehicle Factory, Wall, Concrete-4 (2×2 slab) |
| 5 | Hi-Tech Factory, the *other* infantry building, Repair Pad, Turret |
| 6 | Starport |
| 7 | IX Research Center |
| 8 | Palace |
| never (99) | Construction Yard (only obtained by deploying an MCV, never itself "built") |

Rocket Turret is flagged `availableCampaign = 0` (no mission gate) **(?)** — it more likely gates
via its `structuresRequired` (needs IX Research + a regular Turret) than via mission number; not
fully traced this session.

**Infantry-building split by house** (from `availableHouse` on the `Barracks` vs `WOR`
structures): **Atreides** and **Ordos** can build a `Barracks`; **Harkonnen** and **Ordos** can
build a `WOR`; **Harkonnen has no `Barracks`** (cannot build light Infantry — Troopers only) and
**Atreides has no `WOR`** (cannot build heavy Troopers — Infantry only); **Ordos uniquely can
build both**. This lines up with the flavour text ("Atreides are fair," "Harkonnen are brutal,"
"Ordos are flexible") and with the vehicle roster split also visible in `unitinfo.c`: **Atreides
get the Trike; Ordos get the (faster) Raider Trike instead; Harkonnen get neither** (jump straight
to Quad). Source: `src/table/structureinfo.c`, `src/table/unitinfo.c` `availableHouse` fields.
Marked **(?)** only insofar as a specific scenario's own building list could theoretically
override this global table — not independently confirmed.

### 4.4 How units exit factories; Carryall delivery

- Infantry/light vehicles built at Barracks/WOR/Light Factory simply spawn and walk/drive out
  onto a free adjacent tile.
- Heavy Factory output (Siege Tank, Missile Tank, Devastator, MCV, Harvester) is picked up by a
  **Carryall** and flown to a clear drop point near the factory if the house owns one; otherwise
  it exits under its own power **(?)** (behaviour inferred from the Carryall's general "ferry
  newly-built heavy units and returning/full Harvesters" role — confirmed generally via
  https://strategygamers.com/walkthrough/dune-2-battle-for-arrakis , which notes "Carryall
  behavior: cannot be directly ordered; prioritizes damaged vehicles" for repair-pad ferrying —
  but the exact trigger condition for factory-output pickup was not traced in source this
  session).
- If a house has no free unit slot to spawn into (`unitCountMax`, default 39; see §2.3) the
  attempted build is refunded to the owner (`credits += buildCredits`) and the player sees
  *"Unable to create more [units]."* Source: `src/structure.c:1604-1616`.
- Hi-Tech Factory (which "produces" Carryalls) is special-cased in the AI: an AI house is only
  allowed to have the AI auto-queue a replacement Carryall if it currently owns **zero**; it
  won't stockpile spares this way. Source: `src/structure.c:2005-2016`
  (`Structure_AI_PickNextToBuild`).

Sources for §4: OpenDUNE `src/structure.c`, `src/gui/gui.c`, `src/table/structureinfo.c`,
`src/table/unitinfo.c` (github.com/OpenDUNE/OpenDUNE); Carryall/queue behaviour cross-check via
https://strategygamers.com/walkthrough/dune-2-battle-for-arrakis .

---

## 5. Combat

Source: `src/unit.c` (`Unit_Damage`, `Unit_CreateBullet`, `Unit_Move`), `src/script/unit.c` (`Script_Unit_Attack`), `src/map.c` (`Map_MakeExplosion`), `src/table/unitinfo.c`, `src/table/houseinfo.c`.

### 5.1 Damage/armor model

- **There is no armor-type/damage-type multiplier system at all** (nothing like C&C's
  light/heavy/wood armor vs. different warhead types). Damage is a flat integer subtracted
  directly from the target's `hitpoints`: `Unit_Damage(unit, damage, range)`. Every unit type
  simply has its own flat HP pool and its own flat weapon `damage` value — the "rock-paper-
  scissors" feel of the game comes entirely from raw HP/damage/range/speed/cost numbers (covered
  in the per-unit stat sheet, not here), not from a hidden armor-class table. Source:
  `src/unit.c:1530-1600`, `src/unit.h` `UnitInfo.damage`.
- On death, a Harvester spills `amount/32` radius worth of spice back onto the sand (§2.2); most
  units simply play a death animation/sound (throttled — the "unit destroyed" feedback sound is
  suppressed on saboteurs, and after mission 3 always plays the owning house's own destruction
  jingle rather than a generic one). Source: `src/unit.c:1553-1566`.

### 5.2 Splash / area damage

Ordinary weapons (tank cannons, machine-gun infantry, base Rocket Launcher hits, Turret fire) deal
damage **only to the single unit/structure directly struck** — `Map_MakeExplosion(type, pos, 0,
range)` is called with **zero** splash-hitpoints for a normal hit, purely for the visual/sound
effect (`EXPLOSION_IMPACT_SMALL` if damage<25 else `EXPLOSION_IMPACT_MEDIUM`). **True radial
splash damage exists only for a few special cases**, all of which pass a non-zero `hitpoints`
into `Map_MakeExplosion`, which then damages **every unit within a `reactionDistance`** (16 tiles
normally, 32 for the Death Hand) with damage falling off by distance
(`hitpoints >> (distance-in-tiles/4)`, i.e. halving roughly every 4 tiles closer to the edge):

| Source of splash | Damage | Radius |
|---|---|---|
| Saboteur reaching its target and detonating | 500 | 16 tiles (falloff) |
| Saboteur killed before reaching target | 300 | 16 tiles (falloff) |
| Harkonnen **Death Hand** missile, primary impact | random 25–50 | 32 tiles (falloff) |
| Harkonnen Death Hand, secondary blast (offset nearby) | random 75–150 | 32 tiles (falloff) |
| A unit with `explodeOnDeath` dying | its own remaining HP | 16 tiles (falloff) |

An explosion of this kind also has an AI side-effect: any enemy **Team** currently in the
"Staging" state (mustering before an attack, see §9) that takes splash damage immediately
**breaks staging and switches to Hunt** — i.e. shelling a mustering enemy squad provokes an
early, possibly premature, attack. Source: `src/map.c:403-460` (`Map_MakeExplosion`); call sites
in `src/unit.c:1412-1444`, `src/script/unit.c:520,539,560-563`.

The **Sonic Blast** (Atreides Sonic Tank weapon) is a distinct case: it's a slow-moving
projectile that damages **every unit it passes over along its travel line** (`unit.hitpoints/4 +
1` per tile entered), except units flagged `sonicProtection` — a line-AoE rather than a radial
one. Source: `src/unit.c:1360-1382`.

### 5.3 Rocket / missile inaccuracy

Any bullet type flagged `notAccurate` (the Rocket Launcher's missile, the House "Death Hand"-class
missile, the Deviator dart, the Trooper's long-range mini-rocket) does **not** aim at the exact
target tile: 15/16 of the time its impact point is nudged by a random offset scaled to
**range/256 + 8** tiles (so long shots scatter more than short ones); the remaining 1/16 of shots
get an even larger, near-fully-random offset. Direct-fire weapons (tank cannon, machine gun,
Turret) have no such flag and always hit their exact target (subject only to the normal
line-of-sight/firing-arc gate). Source: `src/unit.c:1954-1998` (`Unit_CreateBullet`).

### 5.4 Infantry crushing

Any unit flagged `isTracked` (tank-tread units — the per-unit list is out of scope here, but
includes at least the Combat/Siege Tank family) that moves within 48 distance-units of a tile
occupied by a **`MOVEMENT_FOOT`** unit (Infantry/Troopers/Saboteur/Sardaukar, etc.) **instantly
kills it** by squashing — no damage roll, straight to the death state (with a distinct
"crushed" flag so the corpse can render as a flattened sprite rather than the normal death
animation). Wheeled and Harvester movement types do **not** crush. Source: `src/unit.c:1322-1333`.

### 5.5 Wounded-infantry downgrade, retreat, and "toughness"

- When an `Infantry` (3-man squad) or `Troopers` (3-man heavy squad) unit's HP drops below 50% of
  its type max, it doesn't just get weaker — its unit *type* is switched (`type += 2`) to a
  distinct single-man "wounded/crawling" unit (`Infantry→Soldier`, `Troopers→Trooper`, based on
  the table's consecutive enum ordering), which then has its own (lower) HP pool.
- At that same moment, there's a `Random(0-255) < houseInfo.toughness` chance the unit
  automatically switches to the **Retreat** order. `toughness` is a per-house constant:
  **Harkonnen 200, Ordos 128, Atreides 77**, (AI-only: Fremen/Sardaukar 10, Mercenary 0) — i.e.
  Harkonnen wounded troops are, counter-intuitively, the *most* likely to flee once hurt (≈78% of
  the time) while Atreides infantry mostly fight on (≈30%). This is the game's only
  veterancy-adjacent stat; there is **no experience/rank-up system** for units at all (units never
  get stronger from kills — unlike later C&C games). Source: `src/unit.c:1585-1595`,
  `src/table/houseinfo.c`.
- Any tracked/wheeled/Harvester unit below 50% HP also sets `isSmoking = true`, which drives a
  persistent smoke-trail visual until repaired or destroyed. Source: `src/unit.c:1595-1600`.
- **"Retreating to repair"**: a unit given the `Retreat` order moves back toward its
  original/rally position (not specifically to a Repair Pad); actually healing back up requires
  manually docking at a Repair Pad (§2.4) — retreat itself only removes the unit from danger.

### 5.6 Friendly fire

The manual is explicit that manual targeting is unrestricted: *"Targeting allows attacking units,
structures, or terrain. This includes friendly units and structures as well."* — i.e. the game
will not stop a player from ordering an Attack on their own units/buildings; it only prevents
**automatic** target acquisition (Guard/Hunt/AI auto-fire) from picking allied targets
(`House_AreAllied` gates in `src/unit.c:754-756`). Source: manual, quoted via
https://dune2k.com/Duniverse/Games/DuneII/Manual .

Sources for §5: OpenDUNE `src/unit.c`, `src/script/unit.c`, `src/map.c`, `src/table/unitinfo.c`,
`src/table/houseinfo.c` (github.com/OpenDUNE/OpenDUNE); manual (dune2k.com).

---

## 6. Sandworms

Source: `src/script/unit.c`, `src/unit.c`, `src/table/landscapeinfo.c`, `src/table/houseinfo.c`, `src/house.c`.

- **Ownership/spawn**: Sandworm is a unit type restricted to a special, non-playable pseudo-house,
  `HOUSE_FREMEN` (`availableHouse = FLAG_HOUSE_FREMEN` in `unitinfo.c`). No dedicated
  "spawn a worm every N ticks" global routine was found in the files fetched this session; worms
  appear to be introduced the same way as any other scripted reinforcement (the `Reinforcement`
  struct's `timeLeft`/`timeBetween`/`repeat` fields, `src/scenario.h`), i.e. **spawn timing and
  count are defined per-scenario, not by one hardcoded global rule (?)**.
- **Terrain restriction**: worms use `MOVEMENT_SLITHER`, whose speed is 0 on every Rock, Mountain,
  Concrete Slab and Wall tile and a brisk 192/255 on every sand/dune/spice/bloom tile (§1.2 table)
  — this is the exact, quantified basis for "worms can't cross rock and are fast in open sand."
  Community/manual confirmation: *"Sand Worms will eat anything on the sand, so try to have your
  units move on rock as much as possible"* (manual, via dune2k.com).
- **Attraction**: the manual states worms are *"attracted by vibrations"* from units/combat on
  sand; the precise targeting/attraction algorithm was not located in the files read this session
  **(?)** — likely a noise/weight system scanning nearby moving or shooting units, analogous to
  how Teams pick targets, but not directly confirmed from source in this pass.
- **Eating and departure**: a worm's `amount` field means *"units to eat before disappearing"*.
  Each successful swallow (`UNIT_SANDWORM` case inside the generic attack-resolution script,
  `src/script/unit.c:631-656`) removes the victim from the game entirely (no wreckage), plays a
  swallow sound/animation, decrements `amount` by 1, and imposes a 12-tick cooldown before it can
  attack again; **once `amount` drops below 1, the worm submerges and dies (`ACTION_DIE`)** —
  i.e. every worm can only eat a fixed, finite number of victims before it goes away for good
  (exact starting `amount` value not located in the fetched source — commonly cited community
  figure is small, on the order of a handful of units **(?)**). Separately, if a worm simply
  finishes travelling with no target, it goes dormant for **720 ticks** before it will look for a
  new destination (`src/script/unit.c:1327-1329`).
- **Damage to worms**: worms are a `UNIT_SANDWORM`, processed by the same `Unit_Damage` path as
  any other unit and can be attacked/killed like anything else (the manual: *"attack it by
  targeting the distortion in the sand, and if you hurt it enough it will go away"*) — but they
  are frequently described (manual, wikis) as extremely tanky ("almost impossible to destroy")
  rather than truly invincible.
- **"Wormsign"**: I could not confirm the literal word **"Wormsign"** is used as on-screen UI
  text in the 1992 original — that term is well documented for *Dune 2000* (1998) and the Dune
  novels. What Dune II **does** do, code-confirmed: the first time the player's house becomes
  aware of a Sandworm unit, it plays a distinct alert sound (`Sound_Output_Feedback(37)`) and
  (English builds only) shows a one-time hint box, *"Warning! Sandworms (Shai-Hulud) roam Dune,
  devouring anything on the sand!"* with an 8-tick minimum interval before it can re-trigger.
  Source: `src/unit.c:2699-2711` (`STR_WARNING_SANDWORMS_SHAIHULUD_ROAM_DUNE_DEVOURING_ANYTHING_ON_THE_SAND`).
- **Safe units/terrain**: Ornithopters/Carryalls (Winger movement, always 255 regardless of
  terrain) are never in danger from worms; anything standing on Rock, Mountain, Concrete Slab,
  or inside/behind a Wall is safe, per the terrain table in §1.2.

Sources for §6: OpenDUNE `src/script/unit.c`, `src/unit.c`, `src/table/landscapeinfo.c`,
`src/table/houseinfo.c` (github.com/OpenDUNE/OpenDUNE); manual text (dune2k.com,
archive.org); general Wormsign background (not Dune-II-specific): https://dune.fandom.com/wiki/Wormsign (search-snippet only, direct fetch blocked, HTTP 402).

---

## 7. Shroud / Fog of War

Source: `src/map.c` (`Map_UnveilTile`), `src/unit.c` (`Unit_RemoveFog`), `src/house.c` (`House_UpdateRadarState`).

- Each tile has a single persistent bit, `Tile.isUnveiled`. `Map_UnveilTile(packed, houseID)`
  only ever **sets** this bit to true (for the human player's house) — nothing in the engine
  ever clears it back to false. **Terrain, once revealed, is revealed forever for the rest of the
  mission** — there is no "shroud re-forms after you leave" behavior for the ground/static
  layer. Source: `src/map.c:1339-1360`.
- What *does* stay dynamic is the visibility of **mobile things** (enemy units, and — via the
  `seenByHouses` bitmask on each unit/structure object — even standing structures' owner-colour
  reveal): a moving unit continuously calls `Tile_RemoveFogInRadius` around itself
  (`fogUncoverRadius`, a per-unit-type constant) each tick, so enemy units only show up while
  currently within some friendly unit/structure's sight radius; they simply aren't drawn once
  nothing of yours can currently see that tile, even though the ground beneath them stays
  visible. This is the classic "explored-terrain-permanent, units-need-current-sight"
  two-layer model, just without the engine giving the terrain layer a name distinct from "fog."
  Source: `src/unit.c:1219-1230` (`Unit_RemoveFog`).
- **Radar/minimap**: requires an Outpost structure *and* a non-negative power balance
  simultaneously (§3.2); when active it presumably mirrors the unveiled-tile bitmap (not directly
  traced this session, but consistent with `g_dirtyMinimap`/`g_displayedMinimap` buffers in
  `map.h`). Losing either condition greys/blacks the minimap out via an animated transition
  rather than an instant cut.
- Structures also get an immediate radius of vision cleared around them the moment they're placed
  (`fogUncoverRadius` per structure type, e.g. Refinery/Outpost use larger radii than a Wall),
  independent of any unit's movement.

Sources for §7: OpenDUNE `src/map.c`, `src/unit.c`, `src/house.c` (github.com/OpenDUNE/OpenDUNE).

---

## 8. Unit Orders & AI States

Source: `src/unit.h` (`ActionType`, `MovementType`), `src/team.h` (`TeamActionType`), `src/script/unit.c`.

### 8.1 Player-issuable orders (`ActionType` enum, `src/unit.h`)

| Order | Effect (source-derived / manual) |
|---|---|
| **Attack** | Move to and engage a specific target (unit, structure, or bare tile — friendly-fire is allowed, §5.6). |
| **Move** | Travel to a location, engaging nothing unless something engages it first. |
| **Retreat** | Return toward the unit's last rally/home position; also auto-triggered by the wounded-infantry roll (§5.5). |
| **Guard** | Hold position, auto-engage anything that comes within weapon range. |
| **Area Guard** | As Guard, but actively range out to intercept threats in a wider area rather than waiting in place (exact radius not traced this session) **(?)**. |
| **Harvest** | (Harvester only) Move onto spice and begin filling up (§2.1). |
| **Return** | (Harvester) head back to a Refinery to unload; also reused generically for "return to base" semantics. |
| **Stop** | Halt and await new orders, engaging nothing. |
| **Ambush** | Hold position/hidden until an enemy is within range, then attack (used heavily by scripted AI "ambush" teams; a unit ordered to Ambush that takes damage switches straight to Attack, §5.1). |
| **Sabotage** | (Saboteur only) Move to a target structure and self-detonate for large splash damage on arrival (500 dmg) or on premature death (300 dmg) — §5.2. |
| **Die** | Internal-only terminal state (plays death anim/sound, applies crush flag etc.) — not player-selectable. |
| **Hunt** | Roam and proactively seek out and attack any enemy found — the default aggressive AI state; also what a Staging team collapses into when disturbed (§5.2, §9). |
| **Deploy** | (MCV only) Transform in place into a Construction Yard. |
| **Destruct** | (Devastator only) Self-destruct for an area-damage blast (§5.2's `explodeOnDeath` path). |

The manual additionally notes the UI convention that **the first letter of each command word is
its keyboard shortcut** (A/M/R/G/H/S/etc.), and that damage-state colour coding (green/yellow/red)
on a target structure is what determines whether Infantry/Troopers can **capture** it (must be
beaten down to "red" first, then walked into by infantry) **(?; not source-verified this
session, from** https://strategygamers.com/walkthrough/dune-2-battle-for-arrakis **and the
manual**).

### 8.2 Team-level AI behaviour states (`TeamActionType`, `src/team.h`)

Scripted/AI unit groups ("Teams") — not individual units — carry one of five behaviours,
authored per-scenario alongside each team's composition:

| TeamAction | Meaning |
|---|---|
| **Normal** | Baseline behaviour; largely defers to individual unit orders. |
| **Staging** | Muster/wait near a rally point until the team reaches its configured size before moving out — can be broken early by taking splash damage, which forces an immediate switch to Hunt (§5.2). |
| **Flee** | Retreat/disengage. |
| **Kamikaze** | Suicide-attack posture (no self-preservation — used for e.g. scripted rush teams). |
| **Guard** | Hold and defend an area. |

A team's scenario definition line is `House, TeamActionType, MovementType, minMembers,
maxMembers` (`src/scenario.c` `Scenario_Load_Team`) — e.g. an all-`WHEELED` team of 3-6 units
with `Kamikaze` behaviour. Movement-type-homogeneity per team (all-foot, all-tracked, etc.)
appears to be an engine assumption, not just a convention. Source: `src/team.h`,
`src/scenario.c:400-465`.

Sources for §8: OpenDUNE `src/unit.h`, `src/team.h`, `src/scenario.c`, `src/script/unit.c`
(github.com/OpenDUNE/OpenDUNE); capture-mechanic secondary source:
https://strategygamers.com/walkthrough/dune-2-battle-for-arrakis (redirect target of the-spoiler.com's old walkthrough).

---

## 9. Enemy AI Behaviour

Source: `src/structure.c` (`Structure_AI_PickNextToBuild`), `src/house.c` (`House_EnsureHarvesterAvailable`, `GameLoop_House`), `src/scenario.c`, `src/team.c`.

### 9.1 Building & rebuilding

- Generic factories (Light/Heavy Vehicle Factory, Barracks, WOR, Hi-Tech): each time the AI's
  factory sits idle, `Structure_AI_PickNextToBuild` scans its currently-buildable unit list and,
  for each candidate in turn, has a **25% chance** (`Random(0-3)==0`) to select it, overwriting
  the previous candidate — net effect is a semi-random pick weighted toward whichever buildable
  type it last rolled true (not a clean uniform choice, an artifact of the loop-and-overwrite
  implementation). Heavy Factory AI selection explicitly excludes Harvester and MCV from this
  generic pool (those are handled by the dedicated harvester-replacement logic below). Hi-Tech
  Factory AI will only queue a Carryall if the house currently owns **zero**. Source:
  `src/structure.c:1980-2030`.
- **Construction Yard rebuilding**: every house keeps a **5-slot memory of destroyed structures**
  (`House.ai_structureRebuild[5][2]`, storing type + position) and its Construction Yard will
  preferentially rebuild from that list before doing anything else, dropping the new structure
  back at the same spot once it's queued and completed; if it ever runs out of remembered
  slots for a completed rebuild, it just refunds the credits instead of placing it. Source:
  `src/structure.c:239-260, 1993-2003`.
- **Harvester replacement**: independent of the above, every house (AI or player) is checked
  every 900 ticks — if it doesn't currently have a Harvester linked to any Heavy Factory / in
  production anywhere, one is forced into the queue (or delivered by Carryall if idle capacity
  allows). This is why the AI (and the player) is never permanently harvester-less for long.
  Source: `src/house.c:298-330` (`House_EnsureHarvesterAvailable`), called from `GameLoop_House`.
- **Structure repair**: an AI-owned structure automatically starts self-repairing the instant its
  HP drops below 50%, provided the house has any credits at all. Source: `src/structure.c:305-311`.
- Damaged-Windtrap-driven decay (§3.2) and the mission-number build-speed ramp (§4.2) apply
  identically to AI houses — meaning the AI's own economy/production genuinely gets faster and
  its buildings sturdier as the campaign mission number increases, independent of anything the
  player does.

### 9.2 Attacking (team/wave logic)

Enemy offense is entirely **Team**-driven (§8.2): a scenario pre-authors a roster of teams (house,
behaviour, movement-type, min/max size), and the AI assembles/launches them according to that
behaviour — e.g. a "Staging" team quietly musters near the AI base until it reaches its minimum
size, then moves out to Hunt; a "Kamikaze" team throws itself at the nearest target without
regard for losses. There is no separate global "wave timer" found in the files read this session
beyond what's implied by team composition and the `timerUnitAttack`/`timerSandwormAttack`/
`timerStructureAttack` cool-downs, which only gate **how often the player is re-warned** about an
ongoing attack, not the AI's actual decision cadence **(?)**.

### 9.3 Palace special weapons

Every house has a `specialCountDown` (recharge time, in ticks) and a `specialWeapon` id:

| House | specialWeapon | Meaning | Recharge |
|---|---|---|---|
| Harkonnen | 1 | Death Hand missile (two-stage splash, §5.2) | 600 ticks |
| Sardaukar (AI-only) | 1 | Death Hand missile | 600 ticks |
| Atreides | 2 | Call in Fremen reinforcements | 300 ticks |
| Fremen (AI-only) | 2 | (Fremen calling Fremen; effectively unused) | 300 ticks |
| Ordos | 3 | Saboteur | 300 ticks |
| Mercenary (AI-only) | 3 | Saboteur | 300 ticks |

Once a Palace's countdown hits zero, an **AI**-controlled house fires it automatically the very
same tick (`Structure_ActivateSpecial`); the human player instead gets a ready-to-fire UI
prompt. Source: `src/table/houseinfo.c`, `src/structure.c:105-118`.

### 9.4 Harvesting

AI harvesting uses the exact same Harvester/Refinery scripts as the player (§2.1) — there is no
special-cased "cheating" AI economy located in the files read this session; its advantage instead
comes from the guaranteed-harvester-replacement logic above and (in the original, unmodified
game) from the flat, non-scaling `toughness`/build-speed constants that make it fight (and
rebuild) more efficiently at higher mission numbers, not from bonus resources **(?
not exhaustively verified — a hidden AI resource multiplier can't be ruled out from the files
read this session, but none was found**).

### 9.5 Difficulty settings

**Dune II (1992) has no explicit difficulty-level menu.** Instead, "difficulty" is produced by
two independent, code-confirmed mechanisms:
1. **Per-scenario authored parameters** — each mission's `.INI` fixes the enemy house(s)' starting
   `Credits`, win `Quota`, `MaxUnit` cap, and team rosters; picking a different node on the
   Arrakis region map (§10.3) simply loads a different, differently-tuned scenario file.
2. **Global mission-number scaling built into the engine itself**, applying automatically as
   `g_campaignID` (current mission number, 1-9) climbs, regardless of which regional path was
   taken: factory build-speed cap rises from ~45% to 100% (§4.2), AI structure self-repair rate
   rises from +3 HP/tick to +5 HP/tick after mission 3, structures stop being exempt from decay
   after mission 1 (§4.4 note in §3.2 / structure decay only triggers `campaignID > 1`), and AI
   structure-loss "insurance" refunds jump from 100% to 150% of build cost after mission 7. In
   effect, **mission 9 is a mechanically harder game to play than mission 1 even holding the map
   constant.**
Game **speed** (separate from "difficulty") is a 5-position, player-selectable option — Very
Slow/Slow/Normal/Fast/Very Fast — implemented as `g_gameConfig.gameSpeed` (0-4) feeding
`Tools_AdjustToGameSpeed`, which is what the various "ticks between checks" constants throughout
this document (e.g. the 900-tick harvester check, the 10800-tick structure-decay check) actually
scale by. Source: `src/tools.c:20-40` (`Tools_AdjustToGameSpeed`); the "Very Slow...Very Fast"
naming is corroborated by the copy-protection quiz's own answer set (§10.4) at
https://strategywiki.org/wiki/Dune_II:_The_Building_of_a_Dynasty/Mission_1 .

Sources for §9: OpenDUNE `src/structure.c`, `src/house.c`, `src/scenario.c`, `src/team.c`,
`src/table/houseinfo.c`, `src/tools.c` (github.com/OpenDUNE/OpenDUNE).

---

## 10. Campaign

Sources: `src/opendune.c` (win/lose/level-end flow), `src/gui/gui.c` (scoring/rank), manual text
(dune2k.com, archive.org), Wikipedia (https://en.wikipedia.org/wiki/Dune_II), StrategyWiki
(https://strategywiki.org/wiki/Dune_II:_The_Building_of_a_Dynasty), Hardcore Gaming 101
(https://www.hardcoregaming101.net/dune-ii-the-building-of-a-dynasty/, fetched via summarising
tool).

### 10.1 Framing story — the Emperor

Emperor **Frederick IV Corrino** reclaimed the throne after the "Years of Treason" but is deep in
debt to **CHOAM** (the Intergalactic Merchants' Guild) — reportedly **over three billion Solaris
(K units)**. To raise spice revenue (and, unofficially, to weaken the Great Houses by pitting them
against each other), he opens a three-way contest: whichever of House **Atreides**, **Harkonnen**,
or **Ordos** delivers the most spice from Arrakis wins governorship of the planet and its tax
revenue. A narrating **Bene Gesserit** voice frames each briefing and notes suspicion that "the
Emperor may have certain favorites in this competition" — foreshadowing his secret Sardaukar
backing of Harkonnen. Source: manual, quoted via
https://dune2k.com/Duniverse/Games/DuneII/Manual .

### 10.2 The three Houses and their Mentats

| House | Homeworld | Mentat | Personality (manual) | Special Palace weapon | Signature unit(s) |
|---|---|---|---|---|---|
| **Atreides** | Caladan | **Cyril** | Fair, just, diplomatic; tries reason first ("a strategy which will undoubtedly fail on Dune") | Call Fremen reinforcements | Sonic Tank, Trike |
| **Harkonnen** | Giedi Prime | **Radnor** | Unstable/unpredictable; got the job by assassinating the previous Mentat; "most savage House in the universe," rules by fear | Death Hand missile | Devastator |
| **Ordos** | (cold/industrial world; non-canonical to the novels, invented for this game — only otherwise referenced in the non-canon *Dune Encyclopedia*) | **Ammon** | Amoral merchant cartel; wins by sabotage, trickery, deception | Saboteur | Deviator, Raider Trike |

Source: manual via https://dune2k.com/Duniverse/Games/DuneII/Manual and
https://dunerts.wiki.gg/wiki/Dune_II_manual ; Ordos non-canon note also at
https://www.hardcoregaming101.net/dune-ii-the-building-of-a-dynasty/ .

Per-house audio/music/AI-tuning constants (all from `src/table/houseinfo.c`, cross-referenced
in §2/§5/§9): `toughness` (Harkonnen 200 / Ordos 128 / Atreides 77), `specialCountDown`
(Harkonnen 600 / Atreides & Ordos 300), `starportDeliveryTime` 10 ticks for all three,
`prefixChar` used in internal file naming (`H`/`A`/`O`), and a distinct win/lose/briefing music
cue index per house.

### 10.3 Mission structure

- Each house's campaign is **9 missions** long (`g_campaignID` runs 1→9; reaching 9 ends the
  game — `src/opendune.c:295-303`). Regardless of house, the player fights across
  **nine "territories."**
- Between missions, a **map of Arrakis** is shown (`GUI_StrategicMap_Show`) divided into regions;
  the player picks the next territory to attack from **2-3 currently available choices**, which
  primarily determines *which enemy house* (and which of that region's map variants) the next
  mission uses — "the plot remains the same no matter what choices the player makes"
  (StrategyWiki). Because of this branching, there are reportedly **up to 22 distinct maps per
  house (~66 total)** despite only 9 missions being played in any one campaign run. Source:
  https://strategywiki.org/wiki/Dune_II:_The_Building_of_a_Dynasty ; branching-map count via
  search synthesis of https://dunerts.wiki.gg/wiki/Dune_II_campaign (?) and
  https://tasvideos.org/GameResources/DOS/Dune2/AtreidesMaps .
- **Mission 1** (all houses, effectively an economy tutorial): reach **1000 credits** in the
  bank; starting force typically 2 light vehicles + 3 infantry, 1000 starting credits; only
  scattered, mostly-idle enemy patrols present (optional to fight). Source:
  https://strategywiki.org/wiki/Dune_II:_The_Building_of_a_Dynasty/Mission_1 .
- **Missions 2 onward**: shift from pure economy toward destroying the enemy's base outright,
  layered on top of the fixed tech-unlock schedule in §4.3 (e.g. you can't field a Siege Tank
  before mission 4's Heavy Factory, can't get a Palace/special weapon before mission 8, etc.).
- **Win/lose conditions** are bitflags per scenario (`WinFlags`/`LoseFlags`, `src/opendune.c:120-243`):
  bit 0x1 = enemy structure count hits 0, bit 0x2 = your structure count hits 0, bit 0x4 = reach
  your `creditsQuota`, bit 0x8 = survive/hit a `TimeOut` tick count. **No mission can be won in
  under 7200 game ticks**, a hard floor regardless of how fast the objective is otherwise met.
  Source: `src/opendune.c:120-181`.
- **Final mission (9)**: both surviving rival Houses *and* the **Emperor's Sardaukar** attempt to
  wipe the player out simultaneously — the endgame explicitly reveals the Emperor's hidden
  backing and turns it into a free-for-all against the player. Source:
  https://www.hardcoregaming101.net/dune-ii-the-building-of-a-dynasty/ (summarised).
- **Endings** (per house, distinct FMV/epilogue): **Atreides** force the Emperor to abdicate;
  **Harkonnen** kill the Emperor outright (violently); **Ordos** blackmail/coerce him into being
  their puppet ruler. Source: https://www.hardcoregaming101.net/dune-ii-the-building-of-a-dynasty/ .

### 10.4 Copy-protection "security" quiz

At the transition into mission 2 and again into mission 8 (`g_campaignID == 1 || g_campaignID ==
7`, checked right after a win, `src/opendune.c:316-320`), the DOS release shows a `GUI_Security_
Show()` challenge — quitting the whole game if failed/declined. Per community walkthroughs, its
questions draw from the printed manual and are always one of three categories: unit/building
**full names** (e.g. "Windtrap Power Center," "House Palace"), **speed class** (Very Slow / Slow /
Medium / Fast / Very Fast), or **armor class** (Very Light / Light / Medium / Heavy / Very Heavy) —
the in-game Mentat can also be consulted for hints in later replays. Source:
https://strategywiki.org/wiki/Dune_II:_The_Building_of_a_Dynasty/Mission_1 .

### 10.5 Scoring screen

At the end of a won mission, `GUI_EndStats_Show` displays three You-vs-Enemy bar comparisons —
**spice harvested**, **units destroyed**, and (from mission 2 on; mission 1 has no enemy base)
**buildings destroyed** — each value capped for display at 65000, plus elapsed play time
(`(ticks)/3600` hours:minutes) and a running numeric **Score**. `Update_Score` adds
`buildCredits/100` for every surviving player structure on top of the scenario's base score
before display. The score then maps to a military **rank** title shown as *"You have attained the
rank of ___"*:

| Score ≥ | Rank |
|---|---|
| 25 | Sand Flea |
| 50 | Sand Snake |
| 100 | Desert Mongoose |
| 150 | Sand Warrior |
| 200 | Dune Trooper |
| 300 | Squad Leader |
| 400 | Outpost Commander |
| 500 | Base Commander |
| 700 | Warlord |
| 1000 | Chief Warlord |
| 1400 | Ruler of Arrakis |
| 1800 | Emperor |

Source: `src/gui/gui.c:75-91` (`_rankScores`), `1428-1450` (`Update_Score`), `1614-1650`
(`GUI_EndStats_Show`). Community strategy notes add that capturing (rather than destroying)
enemy buildings does not help score, and that losing your own troops doesn't directly hurt it,
though finishing quickly appears to grant a bonus **(?** not verified in the source read this
session, from https://strategywiki.org/wiki/Dune_II:_The_Building_of_a_Dynasty/Mission_1 **)**.

Sources for §10: OpenDUNE `src/opendune.c`, `src/gui/gui.c`, `src/scenario.c`,
`src/table/houseinfo.c`; manual (dune2k.com, archive.org); Wikipedia
(https://en.wikipedia.org/wiki/Dune_II); StrategyWiki
(https://strategywiki.org/wiki/Dune_II:_The_Building_of_a_Dynasty and its Mission_1 subpage);
Hardcore Gaming 101 (https://www.hardcoregaming101.net/dune-ii-the-building-of-a-dynasty/).

---

## 11. Sega Genesis / Mega Drive Version — Differences from PC

North American title: **"Dune: The Battle for Arrakis"** (the numeral "II" was dropped, per
Wikipedia, reportedly because Virgin/Westwood wanted to distance the console SKU from the
unrelated, poorly-received Cryo Interactive *Dune* adventure game that had confused the "II"
naming to begin with on PC). Developer: **Westwood Studios**; Publisher: **Virgin
Interactive/Virgin Games**. I could not confirm (segaretro.org, MobyGames, and GameFAQs are all
behind bot-challenges this session's tools couldn't solve) whether Westwood ported it in-house or
contracted an outside studio — treat the port team's identity as **(?)**.

### 11.1 Release dates

| Region | Date | Source |
|---|---|---|
| North America | **May 1, 1994(?)** | search-synthesized from Wikipedia; TASvideos/RAM-map site corroborates a 1994 NA cart |
| Europe | **June 1994(?)** | as above |
| Japan | **No release located** — likely never released in Japan (?) | absence of evidence only |

These dates rest on search-engine synthesis of Wikipedia's article rather than a directly-read
citation and should be treated as **(?)** pending a clean primary-source confirmation; internally
consistent across multiple independent search queries this session, and an archive.org EU
Genesis ROM listing is dated 1994, which is at least consistent.
(https://en.wikipedia.org/wiki/Dune_II ; https://archive.org/details/sg_Dune_The_Battle_for_Arrakis_1994_Virgin_Westwood_Studios_EU_en)

### 11.2 Interface / controls

- No mouse; the DOS sidebar-and-cursor UI is replaced by a **full-screen, gamepad-driven,
  context-sensitive cursor** — moving the D-pad drives a cursor at one of **3 selectable
  speeds**, and available commands change based on what's under the cursor rather than being
  fixed sidebar buttons. The PC's permanent sidebar/status bar is removed entirely to maximize
  the viewport on a TV screen.
- Building/unit **menus were consolidated into full-screen pop-up panels** with smaller icons,
  reportedly styled to look like a hand-held radio/transmitter interface.
- Structures were **visually enlarged** for TV legibility; unit sprite sizes stayed close to the
  PC originals.
- **A tutorial mode replaces the PC's Mentat advice screen** for teaching new players controls —
  but Mentat *mission-briefing* portraits/voice between levels are still present per at least one
  reviewer, and per-house intro/epilogue cutscenes are also confirmed present (differing in
  content per house) — this appears to **contradict** other summaries claiming cutscenes were cut
  outright; most likely what was actually removed/shortened is the PC's opening long-form FMV
  intro reel, while the short per-mission Mentat-briefing "screen" survived in an adapted form.
  Flagging this contradiction explicitly as **(?)** rather than resolving it — sources disagree.
- The single-unit-selection limitation ("impossible to select multiple units together") is
  **not** Genesis-specific — see §12; it's inherited unchanged from the PC original.

### 11.3 Features retained / changed

- **Concrete Slabs, Spice Silos, and the Starport are all present** on Genesis (contrary to a
  plausible assumption that console simplification removed them). One concrete example found:
  the Genesis Concrete Slab is sold only as a **2×2 block for 15 credits** (no separate cheap 1×1
  option like the PC's 5-credit slab) **(?** single-source, from a community building-list
  aggregation, not independently verified against a ROM disassembly**)**; the Genesis **Starport
  unlocks at mission 8** rather than the PC's mission 6 **(?** same caveat**)**.
- **Mission count matches the PC campaign**: 9 missions per house, reached via the same
  Arrakis-region branching-map structure (so, per §10.3, up to that many distinct map variants
  exist) — multiple independent sources (TASvideos RAM map showing a "current level 1-9" byte;
  password lists keyed to levels 2-9 per house) agree on 9. One single reviewer's claim of "10
  levels" per house could not be corroborated elsewhere and is likely either counting the
  tutorial as a level or is simply inaccurate **(?)**.
- **No save-game system** — instead, pausing brings up a **password/access-code screen**; a
  distinct alphabetic password unlocks each level **2 through 9** per house (mission 1 is always
  the entry point). Example real passwords for the Atreides path include "Diplomatic,"
  "SpiceDance," "EternalSun," "DeftHunter," "FairMentat," "SonicBlast," "DuneRunner." Level-2
  examples across houses: Atreides "DIPLOMATIC," Ordos "DOMINATION," Harkonnen "DEMOLITION."
  Source: https://www.chaptercheats.com/cheat/genesis/9825/dune-the-battle-for-arrakis/pass/652 ,
  https://retromaggedon.com/index.php/dune-the-battle-for-arrakis-passwords-genesis/ (via search
  synthesis).
- A **music test option** was added to the main menu (not present on PC).
- Game **time/tick rate is explicitly tied to unit count** per the TASvideos technical notes:
  simulation "slows down with an increase in units on the battlefield, speeds up with a decrease,"
  and is fully suspended whenever the game screen isn't being displayed (e.g. paused at a menu) —
  i.e. the classic slowdown-under-load behaviour of the 68000-based hardware is a real, load-
  dependent frame-pacing effect rather than a fixed "game speed" option; **late missions with
  large unit counts are reported to slow down significantly**, which — combined with no mid-
  mission saves — makes them harder in practice than the PC version at equivalent unit counts.
  Source: https://tasvideos.org/GameResources/Genesis/DuneTheBattleForArrakis ,
  https://www.hardcoregaming101.net/dune-ii-the-building-of-a-dynasty/ (summarised).
- **No selectable difficulty setting found** beyond what's inherited from the PC design (§9.5)
  **(?)**.
- **Graphics**: redrawn building/unit art with a "more cartoony," bigger-looking art style; a
  different, Genesis-appropriate palette (exact palette/resolution values not independently
  confirmed this session — Genesis native resolution is 320×224 vs. DOS 320×200, but I did not
  verify Dune II Genesis actually runs at that resolution) **(?)**.
- **Audio**: music was **entirely re-arranged for the Genesis FM (YM2612) + PSG sound chips**
  while keeping the same underlying compositions/style as the Frank Klepacki (composer) / Dwight
  Okahara (arranger) PC soundtrack — no confirmed separate arranger credit found for the Genesis
  versions of the tracks **(?)**. The Genesis version is also reported to retain **substantial
  sampled speech** ("loads of sampled speech in game," per a reviewer) despite the platform's
  limited audio RAM, implying aggressive PCM compression versus the PC's `.VOC` house-specific
  voice packs (`nhark.voc`, `nattr.voc`, `nordo.voc`, etc. — `src/table/houseinfo.c`).
- Debug/cheat codes exist via the password screen for non-canonical effects: `LOOKAROUND` (reveal
  map), `SPLURGEOLA` (money), `PLAYTESTER` (invulnerability) — confirming a Game-Genie-friendly
  memory layout (credits at RAM offset `$D6C2`, current level at `$C04C`, values 1-9). Source:
  https://tasvideos.org/GameResources/Genesis/DuneTheBattleForArrakis .

### 11.4 Reception

| Outlet | Score |
|---|---|
| Mean Machines Sega | 93% |
| MegaTech | 91% |
| Mega Power | 87% |
| Retroheadz (retrospective, 2020s) | 75/100 |

The one recurring, load-bearing criticism across contemporary and retrospective reviews alike is
the **controller's inability to multi-select units**, making large-scale management "lots of
back and forth across the maps" — again a trait inherited from the PC design rather than
introduced by the port. It is frequently cited as **the only traditional real-time-strategy game
released natively on the Genesis/Mega Drive**. Source: search synthesis citing Mean
Machines Sega/MegaTech/Mega Power scores (direct outlet pages not independently reachable this
session); https://www.retroheadz.com/retro-games/dune2-megadrive-review/ (fetched directly).

Sources for §11: search-engine synthesis of Wikipedia (https://en.wikipedia.org/wiki/Dune_II) and
Hardcore Gaming 101 (https://www.hardcoregaming101.net/dune-ii-the-building-of-a-dynasty/);
https://www.retroheadz.com/retro-games/dune2-megadrive-review/ (direct fetch);
https://tasvideos.org/GameResources/Genesis/DuneTheBattleForArrakis (direct fetch);
https://dune2k.com/Duniverse/Games/DuneGenesis (direct fetch); password lists via
https://www.chaptercheats.com/cheat/genesis/9825/dune-the-battle-for-arrakis/pass/652 and
https://retromaggedon.com/index.php/dune-the-battle-for-arrakis-passwords-genesis/ (search
synthesis). **segaretro.org, MobyGames, and GameFAQs could not be fetched this session** (bot
challenges); anything above sourced only from search-snippets of those domains is flagged (?)
individually.

---

## 12. History, Influence, Quirks & Later Remakes

- **Origin**: Virgin Interactive VP Stephen Clarke-Willson identified Dune's spice-control
  conflict as inherently game-able; Westwood staffer Graeme Devine's championing of *Herzog Zwei*
  (1989, Sega Genesis) pushed the design toward real-time squad/base control instead of a turn-
  based strategy game. Producer Brett Sperry cites *Populous*, his own work on *Eye of the
  Beholder*, and a formative argument with colleague Chuck Kroegel as design influences, and
  specifically wanted the Mac-style context-sensitive interface metaphor brought into a game
  world. Lead programmer Joe Bostic: *"The mouse, and the direct control it allowed, was critical
  in making the RTS genre possible."* The "II" in the Western title is a naming-collision
  artifact — Virgin mistakenly believed Cryo Interactive's unrelated *Dune* adventure-game
  license had lapsed/been cancelled. Source: https://en.wikipedia.org/wiki/Dune_II (summarised).
- **Commercial/critical reception (PC)**: 250,000+ units sold by November 1996; *Computer Gaming
  World*'s 1993 Strategy Game of the Year; later named one of *Time*'s "100 Greatest Video Games
  of All Time" (2012) and inducted into GameSpy's Hall of Fame (2004). Source: as above.
- **Influence on Command & Conquer**: Westwood's own next RTS reused several ideas *first tried
  in the Genesis port specifically* — the music track-list/test-menu concept and, especially,
  **replacing fixed sidebar command buttons with a context-sensitive cursor** — showing a direct
  console-to-PC feedback loop, not just "Dune II → C&C" in the abstract. More broadly, Dune II is
  widely credited as the template-setter for the entire base-building/resource-harvesting/fog-of-
  war RTS genre that C&C, *Warcraft*, and their descendants formalized; Blizzard's original
  *Warcraft: Orcs & Humans* is reported to have initially reused Dune II artwork directly during
  early prototyping before full asset replacement. Chris Taylor (*Total Annihilation*) has cited
  both Dune II and C&C as direct inspirations. Source:
  https://en.wikipedia.org/wiki/Dune_II ,
  https://www.hardcoregaming101.net/dune-ii-the-building-of-a-dynasty/ (summarised).
- **Notable original-game quirks**:
  - **No multi-unit selection** — the player can only ever give an order to one unit (or one
    structure) at a time; there is no drag-select or shift-click grouping. This is a defining,
    frequently-cited limitation of the 1992 original *and* carries over unchanged into the 1994
    Genesis port (§11.4) — it was not a control-scheme regression specific to the console, it's
    baseline PC-original behaviour.
  - No sell-structure command (§2.4); no unit veterancy/rank-up (§5.5); fog of war never
    re-covers explored terrain (§7); maps are procedurally generated from a numeric seed rather
    than hand-painted per pixel (§1.4); a real, if primitive, multi-house diplomatic/alliance
    state exists (`House_AreAllied`) used mainly for scoring/AI-targeting rather than player-
    facing diplomacy.
- **Later official sequels**: *Dune 2000* (1998, Westwood/Intelligent Games) and *Emperor: Battle
  for Dune* (2001, Westwood) — both explicitly re-introduced/expanded features absent from the
  original, including a sell-structure command.
- **Fan reimplementations/remakes** and what each specifically changed versus the 1992 original:
  - **OpenDUNE** (github.com/OpenDUNE/OpenDUNE) — a from-scratch, behavior-matching
    reimplementation of the original DOS executable in portable C, explicitly aiming to be
    **functionally identical** to the original (its own "ENHANCEMENT"-tagged code paths, several
    quoted throughout this document, are opt-in and disabled by default) rather than to add
    features; this is *why* it is such a reliable primary source for exact 1992 numbers. Source:
    project source comments, github.com/OpenDUNE/OpenDUNE.
  - **Dune Legacy** (dunelegacy.sourceforge.net / github) — keeps the original balance/mission
    design but adds a modern interface: **multi-unit selection**, a **build queue**, zoomable
    graphics; a recent (per its own discussion board) release specifically **overhauled
    pathfinding** with a path cache keyed to destination + map-revision so idle squads stop
    recomputing identical paths every tick — a direct fix for the original's well-known
    unit-congestion/pathing slowness. Source:
    https://sourceforge.net/p/dunelegacy/discussion/263161/thread/58cf60791d/ (search synthesis),
    project pages.
  - **Dune Dynasty** (github.com/gameflorist/dunedynasty, a continuation of the original
    SourceForge project) — built directly on top of OpenDUNE's reimplementation and layers on a
    modern production sidebar, **context-sensitive mouse commands, multi-unit selection, build
    queues, and mouse-wheel zoom**. Source:
    https://github.com/gameflorist/dunedynasty (project README, search-summarised).
  - Common thread across all three actively-maintained remakes: **the single biggest
    quality-of-life gap they all independently chose to close first is multi-unit selection**,
    underscoring how central a limitation that single-select design is considered to be, in
    hindsight, versus the systems that actually made the genre work (economy loop, fog of war,
    context-driven orders).

Sources for §12: https://en.wikipedia.org/wiki/Dune_II ;
https://www.hardcoregaming101.net/dune-ii-the-building-of-a-dynasty/ (summarised via fetch tool);
github.com/OpenDUNE/OpenDUNE; github.com/gameflorist/dunedynasty; dunelegacy.sourceforge.net and
https://sourceforge.net/p/dunelegacy/discussion/263161/thread/58cf60791d/ (search synthesis).

---

## Appendix: raw structure cost/power/storage table (for cross-reference with §2-§4)

All figures from `src/table/structureinfo.c` (OpenDUNE), i.e. the 1992 PC values.

| Structure | HP | Build cost | Build time (ticks) | Power (+/-use, -/produce) | Credit storage | Unlocks at mission |
|---|---:|---:|---:|---:|---:|---:|
| Concrete (1×1 slab) | 20 | 5 | 16 | 0 | 0 | 1 |
| Concrete-4 (2×2 slab) | 20 | 20 | 16 | 0 | 0 | 4 |
| Windtrap | 200 | 300 | 48 | **-100 (produces)** | 0 | 1 |
| Refinery | 450 | 400 | 80 | 30 | 1005 | 1 |
| Spice Silo | 150 | 150 | 48 | 5 | 1000 | 2 |
| Outpost (radar) | 500 | 400 | 80 | 30 | 0 | 2 |
| Barracks | 300 | 300 | 72 | 10 | 0 | 2 |
| Light Vehicle Factory | 350 | 400 | 96 | 20 | 0 | 3 |
| Wall (per segment) | 50 | 50 | 40 | 0 | 0 | 4 |
| Heavy Vehicle Factory | 200 | 600 | 144 | 35 | 0 | 4 |
| Hi-Tech Factory | 400 | 500 | 120 | 35 | 0 | 5 |
| WOR (Trooper facility) | 400 | 400 | 104 | 20 | 0 | 5 |
| Repair Pad | 200 | 700 | 80 | 20 | 0 | 5 |
| Turret | 200 | 125 | 64 | 10 | 0 | 5 |
| Starport | 500 | 500 | 120 | 50 | 0 | 6 |
| IX Research Center | 400 | 500 | 120 | 40 | 0 | 7 |
| Palace | 1000 | 999 | 130 | 80 | 0 | 8 |
| Rocket Turret | 200 | 250 | 96 | 25 | 0 | 0 (?, likely upgrade-gated) |
| Construction Yard | 400 | 400 | 80 | 0 | 0 | never (MCV-deploy only) |

Source: `src/table/structureinfo.c` (github.com/OpenDUNE/OpenDUNE), extracted directly from the
struct literals for each structure.
