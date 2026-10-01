# Dune II / Dune: The Battle for Arrakis — Complete Unit Reference

Compiled for a faithful 3D (Three.js) remake. Hard numeric data is taken verbatim from the **OpenDUNE** decompilation/reimplementation of the original 1992 DOS game (`src/table/unitinfo.c`, `src/table/houseinfo.c`, `src/table/structureinfo.c`, `src/unit.c`, `src/script/unit.c`, `src/structure.c`, `src/table/explosion.c`), which is widely regarded as a byte-accurate reconstruction of the original game logic. Cross-checked against **Dune Legacy** (C++ reimplementation) and web sources (dune.fandom.com, dunerts.wiki.gg, moddingwiki.shikadi.net, segaretro.org, the official Genesis manual, Ledmeister's Genesis technical reference). Uncertain/unconfirmed values are marked **(?)**.

## Legend / units of measure (all from OpenDUNE source, "Normal" game speed)

- **HP** = `hitpoints` — raw hit points, directly comparable across units.
- **Cost** = `buildCredits` — in-game Solaris credits.
- **Build** = `buildTime` — internal build-tick constant fed into `buildCost = credits×256/buildTime` per production tick; higher = longer. Not converted to seconds here (depends on game-speed setting and structure health); use the raw constant for relative pacing.
- **Sight/Fog** = `fogUncoverRadius` — radius (in tiles) of fog-of-war cleared around the unit.
- **Move** = `movementType`: Foot / Tracked / Harvester / Wheeled / Winged / Slither (six enum values, `src/unit.h`).
- **Speed** = `movingSpeedFactor` — internal factor where **256 = "full" reference speed**; actual pixel speed is this × terrain speed table × ~0.75 (non-scenario units are scaled ×192/256 in `Script_Unit_SetSpeed`) × game-speed adjustment. Harvesters additionally slow down as they fill (`speed = (255‑amount)×speed/256`, so a full load is noticeably slower).
- **Turn** = `turningSpeed` — facing-change rate per tick. 0 = fixed heading (only bullets), 1 = slowest (heavy tracked vehicles), 2 = medium (wheeled/winged), 3 = fastest (infantry, Sandworm), up to 8 for homing turret rockets.
- **Turret** = does the unit have an independently-aiming turret (`flags.hasTurret`)? If false, weapon is hull-fixed and the *whole vehicle* must turn to aim (confirmed for Devastator and Sonic Tank).
- **Dmg / Range** = `damage` / `fireDistance`. Range is in whole tiles — the engine compares `fireDistance×256` against sub-tile distance directly. Note several "carrier" units store `damage=0` in the table because the real effect is non-damage (Deviator) or is recomputed dynamically (Sonic Blast).
- **Fire Delay** = `fireDelay` — ticks between shots, doubled and speed-adjusted at runtime (`Tools_AdjustToGameSpeed(fireDelay×2, …)`); units that `firesTwice` fire a fast second shot ~5 ticks later, but **only while above 50% HP** (`fireTwice = flags.firesTwice && hp > maxHp/2` in `Script_Unit_Fire`) — a damaged multi-barrel unit visibly fires from only one barrel.
- **House flags**: Harkonnen, Atreides, Ordos are the three playable Houses. Fremen, Sardaukar, Mercenary are non-playable "sub-houses" used by the campaign AI and for the Atreides/Harkonnen/Ordos special weapons respectively.
- Source tags used inline: **[OD:unitinfo]**, **[OD:houseinfo]**, **[OD:structinfo]**, **[OD:unit.c]**, **[OD:script/unit.c]**, **[OD:structure.c]**, **[OD:explosion.c]** = OpenDUNE source files (see Sources); **[DL]** = Dune Legacy source; **[Manual]**, **[Wiki]**, **[Genesis]** = web/manual research (full URLs in Sources).

---

## Summary Table

Built-at column shows *Structure — upgrade level (campaign mission that level unlocks)*, reconstructed from `structureinfo.c`'s `buildableUnits[]`, each structure's own `upgradeCampaign[]` mission gates, and each unit's `upgradeLevelRequired`/`structuresRequired`/`availableHouse`. This schedule is identical for all three main houses' campaigns in OpenDUNE's data (one shared mission-number ladder, reskinned per house).

| # | Unit (PC name) | Houses (of Hark/Atr/Ord) | Built at (upgrade, mission) | Cost | Build | HP | Move | Speed | Turn | Turret | Dmg | Rng | Fire Delay | Sight |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Soldier | Atr, Ord (not Hark) | Barracks L0 (M2) | 60 | 32 | 20 | Foot | 8 | 3 | No | 3 | 2 | 45 | 1 |
| 2 | Infantry (squad) | Atr, Ord (not Hark) | Barracks L1 (M2) | 100 | 32 | 50 | Foot | 5 | 3 | No | 3 | 2 | 45 | 1 |
| 3 | Trooper | Hark, Ord (not Atr) | WOR L0 (M5) | 100 | 56 | 45 | Foot | 15 | 3 | No | 5 | 5 | 50 | 1 |
| 4 | Troopers (squad) | Hark, Ord (not Atr) | WOR L1 (M6) | 200 | 56 | 110 | Foot | 10 | 3 | No | 5 | 5 | 50 | 1 |
| 5 | Saboteur | Ord only | Palace special weapon (M8) | 120(?) | 48 | 10 | Foot | 40 | 3 | No | 2 | 2 | 45 | 1 |
| 6 | Trike | Atr only (of 3 main) | Light Fctry L0 (M3) | 150 | 40 | 100 | Wheeled | 45 | 2 | No | 5 | 3 | 50 | 2 |
| 7 | Raider Trike | Ord only | Light Fctry L0 (M3) | 150 | 40 | 80 | Wheeled | 60 | 2 | No | 5 | 3 | 50 | 2 |
| 8 | Quad | Hark, Atr, Ord | Light Fctry L1 (M3) | 200 | 48 | 130 | Wheeled | 40 | 2 | No | 7 | 3 | 50 | 2 |
| 9 | Combat Tank | Hark, Atr, Ord | Heavy Fctry L0 (M4) | 300 | 64 | 200 | Tracked | 25 | 1 | **Yes** | 25 | 4 | 80 | 3 |
| 10 | Siege Tank | Hark, Atr, Ord | Heavy Fctry L3 (M6) | 600 | 96 | 300 | Tracked | 20 | 1 | **Yes** | 30 | 5 | 90 | 4 |
| 11 | Launcher | Hark, Atr (not Ord) | Heavy Fctry L2 (M5) | 450 | 72 | 100 | Tracked | 30 | 1 | **Yes** | 75 | 9 | 120 | 5 |
| 12 | Deviator | Ord only | Heavy Fctry + IX (M7) | 750 | 80 | 120 | Tracked | 30 | 1 | **Yes** | 0* | 7 | 180 | 5 |
| 13 | Sonic Tank | Atr only | Heavy Fctry + IX (M7) | 600 | 104 | 110 | Tracked | 30 | 1 | No (fixed) | 60 | 8 | 80 | 4 |
| 14 | Devastator | Hark only | Heavy Fctry + IX (M7) | 800 | 104 | 400 | Tracked | 10 | 1 | No (fixed) | 40 | 5 | 100 | 4 |
| 15 | Harvester | Hark, Atr, Ord | Heavy Fctry L0 (M4) | 300 | 64 | 150 | Harvester | 20 | 1 | No | — | — | — | 2 |
| 16 | MCV | Hark, Atr, Ord | Heavy Fctry L1 (M4) | 900 | 80 | 150 | Tracked | 20 | 1 | No | — | — | — | 2 |
| 17 | Carryall | Hark, Atr, Ord | Hi-Tech Fctry L0 (M5) | 800 | 64 | 100 | Winged | 200 | 3 | No | — | — | — | 0 |
| 18 | Ornithopter | Atr, Ord (not Hark) | Hi-Tech Fctry L1 + IX (M7) | 600 | 96 | 25 | Winged | 150 | 2 | No | 50×2 | 50 | 50 | 5 |
| 19 | Frigate | (all, non-interactive) | auto — Starport built (M6) | — | — | 100 | Winged | 130 | 2 | No | — | — | — | 0 |
| 20 | Death Hand (missile) | Hark (+Sardaukar) | Palace special weapon (M8) | — | — | 70 | Winged | 250 | 2 | No | 100** | 15 | — | 0 |
| 21 | Sandworm | (Fremen-tagged, wild) | n/a — map hazard, from M3 | — | — | 1000 | Slither | 35 | 3 | No | insta-kill | 0*** | 20 | 0 |
| 22 | Fremen (call-in) | Atr special | Palace special weapon (M8) | — | — | =Trooper/Troopers | Foot | 10–15 | 3 | No | =Trooper/Troopers | 3–5 | 50 | 1 |
| 23 | Sardaukar (enemy) | Hark-aligned AI | campaign AI, from ~M4 | — | — | =Trooper/Troopers | Foot | 10–15 | 3 | No | =Trooper/Troopers | 3–5 | 50 | 1 |

\* Deviator's table `damage` is 0 — its gas warhead doesn't deal HP damage, it flips allegiance in a radius (see below). \*\* Death Hand's table `damage=100` is a nominal value; the actual warhead detonates as a 17-point cluster pattern, each point independently dealing 200 damage (see Death Hand section). \*\*\* Sandworm has no ranged "fire distance" — it attacks by direct-contact swallow.

---

## Infantry

### Soldier (light infantry)
- **Names**: PC internal name "Soldier" [OD:unitinfo], abbreviation string `STR_SOLDIER`, full name "Infantry Soldier". Genesis manual: "Soldier" — unchanged [Genesis].
- **Houses / building**: Atreides, Ordos (+Fremen/Sardaukar/Mercenary AI); **not Harkonnen**. Built at **Barracks**, upgrade level 0 (available the instant Barracks exists), Barracks itself unlocks campaign **mission 2** [OD:structinfo].
- **Cost/Build/HP**: 60cr / 32 ticks / 20 HP, fog radius 1 [OD:unitinfo].
- **Movement**: Foot, speed factor 8 (slowest infantry), turning speed 3 (fastest turn class). `canWobble=true` — visibly weaves slightly while moving [OD:unitinfo].
- **Weapon**: Bullet, damage 3, range 2 tiles, fire delay 45 ticks. Does **not** fire twice (`firesTwice=false`). Manual: 9mm "RP" armour-piercing assault rifle [Manual].
- **Visual**: Tiny biped sprite — one of the smallest in the game (~8×6 px at native resolution, requiring 2× upscaling in at least one faithful fan remake to stay legible) [Wiki: dune-ii.blogspot.com]. Carries a rifle; no resolvable armor detail at native res. 3-frame directional walk cycle (`DISPLAYMODE_INFANTRY_3_FRAMES`) [OD:unitinfo]. House-color remap applied to a small palette band (exact sub-part not documented) (?). 8-direction facing via pre-drawn sprites, not real rotation [Wiki].
- **Special behavior**: Idle units occasionally get a random idle sprite offset and re-orient (`Script_Unit_IdleAction`) — a "fidget" while standing guard [OD:script/unit.c]. On death, ~1% chance-based extra Soldier can spawn from certain source units (`spawnChance` field is 0 for Soldier itself, but Soldier is the unit *spawned* by other units' `Script_Unit_RandomSoldier` — e.g. some structures/units eject a Soldier survivor on destruction) [OD:script/unit.c].
- **Sources**: [OD:unitinfo] entry 4; [Manual] archive.org Dune II manual; dunerts.wiki.gg; dune-ii.blogspot.com (2006/11 spritesheets post).

### Infantry (squad of 3)
- **Names**: PC "Infantry", full "Light Infantry Squad".
- **Houses/building**: same as Soldier (Atreides, Ordos, not Harkonnen). Barracks **upgrade level 1**, unlocked mission 2 (upgrade purchasable as soon as Barracks itself exists) [OD:structinfo].
- **Cost/Build/HP**: 100cr / 32 ticks / 50 HP, fog 1.
- **Movement**: Foot, speed 5 (slower than lone Soldier — squad drag), turn 3. `canWobble=false`.
- **Weapon**: Bullet, damage 3, range 2, fire delay 45, and critically **`firesTwice=true`** — the squad's three riflemen effectively double fire rate versus a lone Soldier (each half fires, alternating), dropping to single-shot once below 50% HP [OD:unitinfo, OD:script/unit.c].
- **Visual**: Same base rifleman art as Soldier, instanced **three times** and moved as one unit in loose formation (formation shape not documented — commonly a loose cluster/triangle, unconfirmed (?)) [Wiki: cnc.fandom.com via search]. At ≤50% HP, **two of the three figures are removed** from the sprite, visually reducing to a single Soldier-like figure — confirmed directly for the heavy-infantry equivalent (Troopers) on dunerts.wiki.gg and understood to apply identically to Infantry [Wiki: dunerts.wiki.gg/wiki/Trooper_(Dune_II)]. Uses `DISPLAYMODE_INFANTRY_4_FRAMES` (4-frame walk cycle) vs. Soldier's 3-frame — a real, source-confirmed sprite difference between the two [OD:unitinfo].
- **Sources**: [OD:unitinfo] entry 2; dunerts.wiki.gg; cnc.fandom.com (Light Infantry, via search snippet).

### Trooper (heavy infantry, single)
- **Names**: PC "Trooper", full "Heavy Trooper". **Genesis interface explicitly labels the Trooper/Troopers production icon differently once WOR is upgraded** (see Sega section).
- **Houses/building**: Harkonnen, Ordos (+AI sub-houses); **not Atreides**. Built at **WOR** (Trooper Facility), upgrade level 0, WOR unlocks mission 5 [OD:structinfo].
- **Cost/Build/HP**: 100cr / 56 ticks / 45 HP, fog 1.
- **Movement**: Foot, speed 15 (fast for infantry), turn 3, `canWobble=true`.
- **Weapon**: Bullet, damage 5, range 5, fire delay 50, `targetAir=true` (can shoot at Ornithopters/Carryalls — a real point of difference from light infantry). **`firesTwice=false`** for the solo Trooper. At range **> 2 tiles (512 sub-tile units)**, the game engine automatically switches its projectile to the **MiniRocket** (`UNIT_MISSILE_TROOPER`) homing projectile instead of a plain Bullet, at **25% reduced damage** (`damage -= damage/4`) — i.e. Troopers/Trooper snipe at range with a weaker homing mini-rocket and only use the full-damage bullet up close [OD:script/unit.c, `Script_Unit_Fire`].
- **Visual**: Manual describes Trooper as wearing a "heavy, mechanised power suit" firing "10mm Rotary Cannons... AND FS rockets" [Manual via dunerts.wiki.gg] — implies a visually bulkier silhouette than Soldier (not pixel-confirmed, (?)). Shares its base figure with the Sardaukar sprite (see Sardaukar). Genesis technical reference notes the Trooper/Troopers production-screen icon literally changes art style once available [Genesis: ledmeister.com].
- **Sources**: [OD:unitinfo] entry 5; dunerts.wiki.gg/wiki/Trooper_(Dune_II); archive.org manual.

### Troopers (squad of 3 heavy troopers)
- **Names**: PC "Troopers", full "Heavy Trooper Squad".
- **Houses/building**: Harkonnen, Ordos; WOR **upgrade level 1**, unlocked mission 6 [OD:structinfo].
- **Cost/Build/HP**: 200cr / 56 ticks / 110 HP, fog 1.
- **Movement**: Foot, speed 10, turn 3.
- **Weapon**: same as Trooper (damage 5, range 5, fire delay 50, targetAir=true, long-range MiniRocket switch) but **`firesTwice=true`** — squad fires faster than the solo Trooper, again halving to single-fire below 50% HP.
- **Visual**: Same 3-figure-squad / reduce-to-1-at-50%HP mechanic as Infantry, confirmed directly: "A Trooper squad consists of three individual soldiers... When the squad reaches 50% health, two soldiers are eliminated visually, leaving a single trooper unit" [Wiki: dunerts.wiki.gg/wiki/Trooper_(Dune_II)]. Spriters-Resource hosts a dedicated "Troopers" sheet (not directly viewable in this research pass — 403'd to automated fetch) [Wiki: spriters-resource.com/fullview/194547].
- **Sources**: same as Trooper.

### Saboteur (Ordos infiltrator)
- **Names**: PC "Saboteur". Genesis: identical name [Genesis].
- **Houses/building**: **Ordos only**. **Not present in any structure's `buildableUnits[]` list** [OD:structinfo] — it is obtained exclusively via the Ordos **Palace special weapon** (`specialWeapon=3` in houseinfo.c), i.e. never queued at a factory. Palace (and thus this power) unlocks campaign **mission 8** [OD:structinfo]. The `buildCredits=120` recorded in the data table [OD:unitinfo] may be a vestigial/AI-valuation field rather than an actual charge — the Genesis manual/community reference lists its purchase **Cost as 0**, gated purely by the Palace's recharge timer instead [Genesis: ledmeister.com].
- **Cost/Build/HP**: 120cr(?)/48/10 HP (very fragile), fog 1.
- **Movement**: Foot, speed **40** (fastest foot unit in the game bar none), turn 3. Notably, `Unit_Move`'s speed-on-wall-tiles special-case sets Saboteur speed to 255 when crossing walls — **Saboteurs can walk through/over enemy Walls at full speed**, and per `unit.c` "Saboteur can always enter houses" — it ignores the normal structure-entry restrictions [OD:unit.c ~line 677, 1093].
- **Weapon**: nominal Bullet, damage 2, range 2, fire delay 45 — a weak sidearm used only if it can't reach its target.
- **Special behavior**: `actionAI = ACTION_SABOTAGE`; AI `priorityTarget=700` (extremely high — the AI treats loose Saboteurs as top threats). **On death by any means, it always detonates**: `Script_Unit_Die` explicitly checks `if (u->o.type == UNIT_SABOTEUR) Map_MakeExplosion(EXPLOSION_SABOTEUR_DEATH, position, 300, 0)` — a radius/damage-300 blast [OD:script/unit.c]. Reaching its target structure triggers the same `EXPLOSION_SABOTEUR_DEATH` at damage 500 [OD:unit.c ~line 1475]. The explosion animation itself is a distinct 4-frame burst (sprites 203–207, ~13 ticks total) [OD:explosion.c]. An "ENHANCEMENT" comment notes original-behavior Saboteurs can "forget their goal" depending on terrain/game speed [OD:unit.c].
- **Visual**: Confirmed as **infantry**, not a vehicle (one low-quality source conflated it with the Raider Trike — disregard) [Wiki, cross-checked]. Manual: "trained in the art of espionage and terrorism at the Palace" [Manual]. A "stealth/invisible plasma pistol" characterization found in some search results is very likely misattributed from the 1998 remake *Dune 2000* and should **not** be assumed for the 1992 sprite (?). Always renders in Ordos green.
- **Sources**: [OD:unitinfo] entry 6; [OD:unit.c]; [OD:script/unit.c]; [OD:explosion.c]; dunerts.wiki.gg/wiki/Saboteur_(Dune_II); archive.org manual.

### Fremen (Atreides call-in, not directly buildable)
- **Not a distinct `UnitType`** in the engine — Fremen reinforcements are literally **Trooper/Troopers units** (`UNIT_TROOPER`/`UNIT_TROOPERS`) spawned under House **Fremen** (`HOUSE_FREMEN`, toughness 10, `specialWeapon=2`, `specialCountDown=300` ticks) [OD:houseinfo]. Confirmed independently: "the actual in-game units are simply Troopers" [Wiki: dunerts.wiki.gg/wiki/Fremen_(Dune_II)].
- **Trigger**: Atreides Palace special weapon, unlocked mission 8 [OD:structinfo] (Genesis manual independently states Fremen become available "from Mission 8" [Genesis]). Genesis manual: summons 0–5 unit-groups at a random location (or targeted at "targets of opportunity"); once summoned they are **fully autonomous** — the player cannot re-order them; max 7 Fremen units on the field at once; 3-Fremen squads fire twice as often as solo Fremen (mirrors the Trooper/Troopers `firesTwice` split) [Genesis: US manual p.24, ledmeister.com].
- **Stats**: identical to Trooper/Troopers (HP45/110, dmg5, range5, speed15/10) since it's the same unit type, just houseID=Fremen.
- **Visual**: Trooper/Troopers sprite recolored under the Fremen house palette. Exact in-game hue is **not confirmed** by any Dune-II-1992-specific source (?); later fan-extension mods that add Fremen as a full 6th house use orange (*Super Dune 2*) or brown (*Dune 2 eXtended*) — suggestive of a warm sand/khaki family but not proof of the original's exact remap color.
- **Sources**: [OD:houseinfo]; dunerts.wiki.gg/wiki/Fremen_(Dune_II); Genesis US manual p.24 via ledmeister.com.

### Sardaukar (Emperor's elite, enemy-only)
- **Not a distinct `UnitType`** either — reuses Trooper/Troopers/Soldier/Infantry art under House **Sardaukar** (`HOUSE_SARDAUKAR`, toughness 10, `specialWeapon=1`=Death Hand, `specialCountDown=600`, prefixChar 'H' — i.e. engine treats Sardaukar as Harkonnen-aligned) [OD:houseinfo]. A dune.fandom.com gallery image is explicitly captioned "Sardaukar Heavy Trooper (Dune II)", confirming the Heavy Trooper rig is reused, recolored [Wiki, via search].
- **Appearance in campaign**: per the Genesis manual/technical reference, Sardaukar "first appear in mission 4 as trooper units transported by carryall. In later missions, Sardaukar units may be of any unit type available to any House, excluding Deviators, Fremen, MCVs, raider trikes and saboteurs," and "before mission 9 the Sardaukar will have no base located on the battlefield" — mission 9 (final mission, all three houses) pits the player against 2 Sardaukar bases [Genesis: ledmeister.com dunexref §55, §4]. This structure is very likely shared with the PC original given it is core campaign design, not a platform-specific feature, but was not independently re-derived from OpenDUNE's campaign scripts this session (?).
- **Visual**: Boxy, rectangular helmets with **green-tinted view-ports**, heavier armor than regular Trooper-class infantry — a specific, well-cited detail [Wiki: allthetropes.org "Space Marine" trope]. House color remap: **deep royal purple** — notably *not* the grey/black of Sardaukar's literary/film canon, likely chosen so they read distinctly from Harkonnen red on screen [Wiki: allthetropes.org, cross-referenced against nahoo.net on canon colors]. Move in groups of three [Wiki: duneii.nahoo.net/special].
- **Sources**: [OD:houseinfo]; dune.fandom.com (Sardaukar Heavy Trooper, via search); allthetropes.org/wiki/Dune_II; duneii.nahoo.net/special/; Genesis manual via ledmeister.com.

---

## Light/medium vehicles

### Trike
- **Names**: PC "Trike", full "Light Attack Trike".
- **Houses/building**: **Atreides only** among the three main houses (also Mercenary/Sardaukar/Fremen AI) — **Harkonnen and Ordos cannot build the standard Trike at all** [OD:unitinfo entry 13: `availableHouse = MERCENARY|SARDAUKAR|FREMEN|ATREIDES`]. Built at **Light Vehicle Factory**, upgrade level 0, unlocked mission 3 [OD:structinfo].
- **Cost/Build/HP**: 150cr / 40 / 100 HP, fog 2.
- **Movement**: Wheeled, speed 45, turn 2, `canWobble=true`.
- **Weapon**: Bullet, damage 5, range 3, fire delay 50, `firesTwice=true` (drops to single shot <50% HP). `canBePickedUp=true`, `explodeOnDeath=true`.
- **Visual**: "A lightly armoured, three-wheeled vehicle" [Manual]. Exact wheel arrangement (2 front/1 rear vs. 1 front/2 rear) **not confirmed** by any source (?). A claim of "dual 20mm cannons, crew of 2" found in one low-confidence secondary source is likely contaminated from *Dune 2000* stats — disregard (?). No visible driver is likely (no Dune II vehicle sprite shows visible crew at native resolution) (?). Standard house-color remap (blue for Atreides). No confirmed wheel-spin animation — more likely uses only static per-direction sprites like other small vehicles (?).
- **Sources**: [OD:unitinfo] entry 13; archive.org manual; cnc.fandom.com/wiki/Trike_(Dune_II) (snippet).

### Raider Trike (Ordos)
- **Names**: PC "Raider Trike", full "Fast Raider Trike".
- **Houses/building**: **Ordos only**. Same Light Vehicle Factory, upgrade level 0, mission 3 [OD:unitinfo entry 14, OD:structinfo].
- **Cost/Build/HP**: 150cr / 40 / **80 HP** (20 less than Trike — the speed/armor tradeoff), fog 2.
- **Movement**: Wheeled, speed **60** (the fastest ground vehicle among the buildable light/medium classes), turn 2.
- **Weapon**: identical to Trike (damage 5, range 3, fire delay 50, firesTwice).
- **Visual**: **Confirmed pixel-identical to the standard Trike** — "It has the same in-game appearance as the ordinary Trike" [Wiki: dunerts.wiki.gg/wiki/Raider_Trike_(Dune_II)]. The only distinguishing factor is the Ordos-green house remap; no unique paint job, spikes, or shape exists. **Model this as one Trike mesh reused with a different material**, not a separate model.
- **Sources**: [OD:unitinfo] entry 14; dunerts.wiki.gg/wiki/Raider_Trike_(Dune_II).

### Quad
- **Names**: PC "Quad", full "Heavy Attack Quad".
- **Houses/building**: **All three main houses** — the only light vehicle Harkonnen can build. Light Vehicle Factory, upgrade level **1**, unlocked mission 3 (same mission as level-0 Trike/Raider — the upgrade purchase is available immediately) [OD:unitinfo entry 15, OD:structinfo].
- **Cost/Build/HP**: 200cr / 48 / 130 HP, fog 2.
- **Movement**: Wheeled, speed 40, turn 2, `canWobble=true`.
- **Weapon**: Bullet, damage 7, range 3, fire delay 50, `firesTwice=true`.
- **Visual**: "A lightly armoured, four-wheeled vehicle," visually and statistically heavier than the Trike (more armor, more firepower, slightly slower) [Manual]. Barrel count not specified by any primary source for the 1992 game; a "dual 30mm cannons" claim found in search results is unverified and possibly *Dune 2000*-derived (?). Standard 3-house remap; same reasoning as Trike re: no confirmed wheel-spin animation or visible driver (?).
- **Sources**: [OD:unitinfo] entry 15; archive.org manual; dunerts.wiki.gg/wiki/Quad_(Dune_II).

---

## Tanks & artillery

### Combat Tank (house-variant main battle tank)
- **Names**: PC internal "Tank", full "Combat Tank". Genesis manual: "Combat Tank" — unchanged.
- **Houses/building**: **All three main houses build their own house-colored variant.** Heavy Vehicle Factory, upgrade level 0, unlocked mission 4 [OD:unitinfo entry 9, OD:structinfo].
- **Cost/Build/HP**: 300cr / 64 / 200 HP, fog 3.
- **Movement**: Tracked, speed 25, turn 1 (slow to reorient, matching a heavy hull).
- **Turret**: **Yes** (`hasTurret=true`) — turret sprite ID 116/146 range, aims independently of hull heading; hull and turret are two separately-drawn, separately-rotating sprites [OD:unitinfo; Wiki: dune-ii.blogspot.com generic engine mechanism].
- **Weapon**: Bullet, damage 25, range 4, fire delay 80. Not `firesTwice`.
- **Visual**: Tracked hull + independently-rotating turret with a single forward gun barrel; one aggregate fan description calls it a "155mm gun" [Wiki: duneii.nahoo.net/units, unverified precision]. **No shape/geometry difference between the Atreides/Harkonnen/Ordos versions has been documented anywhere** — multiple independent sources (dunerts.wiki.gg's per-house sprite images, the general remap-table mechanism itself) indicate the three "variants" are the **same mesh/sprite, palette-swapped only** [Wiki: dunerts.wiki.gg/wiki/Combat_Tank_(Dune_II); TV Tropes "every basic unit... looks the same... differ in color"]. **Recommendation for the remake: one Combat Tank mesh, three material variants (blue/red/green).**
- **Sources**: [OD:unitinfo] entry 9; dunerts.wiki.gg/wiki/Combat_Tank_(Dune_II); duneii.nahoo.net/units/.

### Siege Tank
- **Names**: PC "Siege Tank", full "Heavy Siege Tank".
- **Houses/building**: All three main houses. Heavy Vehicle Factory, upgrade level **3** (the factory's highest tier), unlocked mission 6 [OD:unitinfo entry 10, OD:structinfo].
- **Cost/Build/HP**: 600cr / 96 / 300 HP, fog 4.
- **Movement**: Tracked, speed 20 (slower than Combat Tank), turn 1.
- **Turret**: Yes, larger turret (sprite 126) on a bigger hull (`dimension=24` vs Combat Tank's 16 — a full size class larger).
- **Weapon**: Bullet, damage 30, range 5, fire delay 90, **`firesTwice=true`** — fires two rounds in quick succession, consistent with community descriptions of "dual 155mm cannons"/"twice the firepower" [Manual; dunerts.wiki.gg]; drops to single-shot below 50% HP.
- **Visual**: Same tracked-hull-plus-turret family as Combat Tank but larger, described as having twin cannon barrels side by side. dunerts.wiki.gg's page again shows three house-specific sprite images with no shape distinction claimed — same shared-mesh/remap-color pattern as Combat Tank (?, extrapolated from the same evidence).
- **Sources**: [OD:unitinfo] entry 10; archive.org manual; dunerts.wiki.gg/wiki/Siege_Tank_(Dune_II).

### Launcher (rocket-launcher vehicle)
- **Names**: PC internal name "Launcher", full string "Rocket Launcher". **Genesis manual/UI names it "Missile Tank"** — a real naming divergence (see Sega section).
- **Houses/building**: Harkonnen, Atreides (**not Ordos** — Ordos gets the Deviator on the same chassis instead). Heavy Vehicle Factory, upgrade level 2, unlocked mission 5 [OD:unitinfo entry 7, OD:structinfo].
- **Cost/Build/HP**: 450cr / 72 / 100 HP, fog 5. `canBePickedUp=true`, `explodeOnDeath=true`.
- **Movement**: Tracked, speed 30, turn 1.
- **Turret**: Yes (turret/pod sprite 146) — same hull/turret sprite IDs as Combat Tank's turret slot family (111/146), i.e. shares its base hull graphic with other tracked units, topped with a distinct rocket-pod turret.
- **Weapon**: fires the **Rocket** projectile (`UNIT_MISSILE_ROCKET`), damage 75, range **9** (longest of any directly-built ground vehicle), fire delay 120, `firesTwice=true`, `targetAir=true` (can engage aircraft).
- **Visual**: Tracked chassis with a turret-mounted rocket rack; manual: "fires a battle support missile... launching two missiles simultaneously" for area coverage at reduced accuracy [Manual]. Whether the pod reads visually as one box or two distinct tubes is unconfirmed (?); whether the rack traverses like a turret or is fixed is also not independently confirmed by prose sources, though the `hasTurret=true` flag from source settles it: **it does independently traverse**.
- **Sources**: [OD:unitinfo] entry 7; archive.org manual; ledmeister.com (Genesis reference, "LAUNCHER" label on purchase screen); dunerts.wiki.gg/wiki/Missile_Tank_(Dune_II).

### Deviator (Ordos)
- **Names**: PC "Deviator", full "Deviator Launcher".
- **Houses/building**: **Ordos only**, no AI sub-house sharing (`availableHouse = FLAG_HOUSE_ORDOS` alone) [OD:unitinfo entry 8]. Requires **Heavy Vehicle Factory + House of IX**, both effectively gating it to mission 7 (IX unlocks mission 7) [OD:structinfo].
- **Cost/Build/HP**: 750cr / 80 / 120 HP, fog 5.
- **Movement**: Tracked, speed 30, turn 1. Same hull/turret sprite IDs as Launcher (111/146) — **visually the same vehicle**.
- **Turret**: Yes.
- **Weapon**: fires the **GRocket** gas-missile (`UNIT_MISSILE_DEVIATOR`), table `damage=0` (it deals no HP damage — see Special Behavior), range 7, fire delay **180** (slowest reload of any vehicle weapon).
- **Special behavior — deviation mechanic (exact, from source)**: On impact, `Unit_Deviate()` is called; if the target isn't flagged `isNotDeviatable` (only a handful of unit types — aircraft, MCV, Harvester's cargo, other Deviators, Sandworm — are immune), the unit's `deviated` counter is set to **120** and `deviatedHouse` is set to the Deviator's house [OD:unit.c `Unit_Deviate`, line ~1241-1262]. This counter ticks down by 1 (or by the controlling house's `toughness` value if hit again) every **60 game ticks** (`Unit_Deviation_Decrease`) [OD:unit.c line ~166-235] — i.e. **deviation lasts 120×60 = 7200 ticks**, decaying faster if the deviated unit is a tougher house or if it fires/moves (each shot fired also reduces deviation by 20, each generic hit by 10) [OD:unit.c/script line ~677, 1120]. While deviated, the unit is fully controllable by the deviating player and **its sprite recolors to the deviating house's color**, reverting when the effect expires [Genesis manual, ledmeister.com — confirmed for Genesis, consistent with PC engine design]. Critically, the impact is **not a single-target effect**: `Map_DeviateArea(explosionType, position, 32, houseID)` is called with a **radius of 32** (sub-tile units, i.e. an area effect covering nearby units too), meaning a well-placed shot can flip a small cluster of units at once [OD:unit.c line ~1441-1442].
- **Visual**: **Confirmed pixel-identical to the Launcher/Missile Tank** — "Deviators are identical in-game appearance to Missile Tanks, hence the difference in House colours and exclusivity to House Ordos are the identifying factors" [Wiki: dunerts.wiki.gg/wiki/Deviator_(Dune_II), independently corroborated by a second search pass]. **Reuse the Launcher mesh entirely**; the only intended visual differentiator is the always-Ordos-green paint and a distinct green gas-cloud impact VFX (see Projectiles → GRocket).
- **Sources**: [OD:unitinfo] entry 8; [OD:unit.c]; dunerts.wiki.gg/wiki/Deviator_(Dune_II); Genesis manual via ledmeister.com.

### Sonic Tank (Atreides)
- **Names**: PC "Sonic Tank", full "Sonic Wave Tank".
- **Houses/building**: **Atreides only**. Heavy Vehicle Factory + House of IX, mission 7 [OD:unitinfo entry 12, OD:structinfo].
- **Cost/Build/HP**: 600cr / 104 / 110 HP, fog 4.
- **Movement**: Tracked, speed 30, turn 1.
- **Turret**: **No** (`hasTurret=false`) — despite having a distinct "turret" sprite slot (141, the dish/emitter), the whole hull must turn to aim, exactly like the Devastator. Confirmed at the code level: aiming code selects `orientation[hasTurret?1:0]`, so Sonic Tank always aims via its body orientation [OD:script/unit.c `Script_Unit_Fire`/`Script_Unit_Rotate`].
- **Weapon — Sonic Blast**: `sonicProtection=true` (the ONLY unit immune to its own weapon type), fires the **Sonic Blast** projectile, listed damage 60, range 8, fire delay 80. **Exact mechanic from source** (`src/unit.c` bullet-movement handler for `UNIT_SONIC_BLAST`): the blast is a *travelling* entity created with its own "hitpoints" set to the firer's damage (60) and a lifetime counter set to the firer's `fireDistance` (8 ticks of travel). **Each tick it moves one step and deals `(current_hitpoints/4)+1` damage to whatever unit occupies that tile** — regardless of house allegiance, with the **sole exemption of units flagged `sonicProtection`** (i.e., only other Sonic Tanks). It also damages structures and interacts with walls. Its own hitpoints tick down by 1 each step (so damage very gradually decays over its ~8-tile travel), and it disappears when hitpoints hit 0 or its travel-tick counter expires [OD:unit.c ~line 1360-1397]. **This is the exact source-confirmed mechanic behind "the sonic wave damages everything in its path, including friendly units"** — there is no ally check at all, only the `sonicProtection` type check. The projectile also sets a "big" visual flag while its remaining power is above half of the firer's damage stat, i.e. **it visibly shrinks as it loses power along its path**.
- **Visual**: Distinct dish/emitter component on the hull (turret sprite 141) instead of a barrel — independently corroborated by a fan LEGO reconstruction that specifically called the dish shape the hardest part to replicate [Wiki: Rebrickable MOC]. The wave itself: **no source describes its on-screen look in prose** (a genuine documentation gap even after extensive searching) — most plausible 1992-hardware implementation (not confirmed, **(?)**) is a light-colored (white/pale-yellow) rippling/pulsating band extending rapidly to full range then fading, given `blurTile`-style effects used elsewhere in the engine for distortion. Recommend checking the actual "Sonic Blast" SHP/animation data directly.
- **Sources**: [OD:unitinfo] entry 12; [OD:unit.c] (bullet-movement handler); dune.fandom.com/wiki/Sonic_tanks (via search); wiki.dune2k.com; Rebrickable MOC build (fan reconstruction, corroborating detail only).

### Devastator (Harkonnen)
- **Names**: PC "Devastator", full "Devastator Tank".
- **Houses/building**: **Harkonnen only** among the three main houses. Heavy Vehicle Factory + House of IX, mission 7 [OD:unitinfo entry 11, OD:structinfo].
- **Cost/Build/HP**: 800cr / 104 / **400 HP** (tankiest ground vehicle in the game), fog 4.
- **Movement**: Tracked, speed **10** — the **slowest vehicle in the game** (excluding the Harvester's load-dependent slowdown), turn 1.
- **Turret**: **No** — fixed-forward twin cannons; the whole hull must turn to aim. Independently confirmed: TV Tropes' "Fixed Forward-Facing Weapon" page cites the Devastator's twin plasma cannons by name as an example of a hull-locked (non-turreted) mount [Wiki: tvtropes.org/pmwiki/pmwiki.php/Main/FixedForwardFacingWeapon].
- **Weapon**: Bullet, damage 40, range 5, fire delay 100, `firesTwice=true` (twin cannons — drops to firing from one barrel below 50% HP, a nice visual tell already built into the base mechanic).
- **Special behavior — self-destruct**: its `actionsPlayer` list includes **`ACTION_DESTRUCT`** as the player-orderable "3rd action" slot (replacing the normal Retreat order that most vehicles have) [OD:unitinfo entry 11]. The manual: "nuclear powered, and may become unstable in combat... capable of self-destruction when in critical state or when ordered to" [Manual, via Wiki]. The most likely underlying implementation is the generic `Script_Unit_ExplosionMultiple` routine also used for the Death Hand's own detonation core: **1 center explosion (25–50 random damage) plus 7 more explosions scattered randomly within a given radius (75–150 random damage each)** — i.e. an 8-point mini-nuke pattern [OD:script/unit.c `Script_Unit_ExplosionMultiple`, moderate confidence this is what backs Devastator's self-destruct specifically since no other unit type in the game has a comparable "explode into several pieces" order — **(?)** exact linkage not 100% verified by name in the excerpts read]. No source could confirm any pre-detonation visual warning (flashing/glowing) for the *1992 original* specifically — do not assume one without a direct screenshot/video check; it may be a later-remake embellishment.
- **Visual**: Twin-barrel heavy tank, described consistently as "dual 190mm guns"/"dual plasma charges" across independent sources [dunerts.wiki.gg; archive.org manual; a fan walkthrough]. On death, uses the heavier "5-frame random explosion" pool reserved for heavy vehicles rather than the 2-frame light-vehicle explosion [Wiki: dune-ii.blogspot.com]. Always Harkonnen red/maroon.
- **Sources**: [OD:unitinfo] entry 11; [OD:script/unit.c]; dunerts.wiki.gg/wiki/Devastator_(Dune_II); tvtropes.org Fixed Forward-Facing Weapon; archive.org manual.

---

## Support vehicles

### Harvester
- **Names**: PC "Harvester", full "Spice Harvester".
- **Houses/building**: All three main houses. Heavy Vehicle Factory, upgrade level 0, mission 4 [OD:unitinfo entry 16, OD:structinfo]. Also automatically granted/replaced by the AI/scenario system, and can be ordered from the Starport.
- **Cost/Build/HP**: 300cr / 64 / 150 HP, fog 2. `canBePickedUp=true`, `explodeOnDeath=true`.
- **Movement**: dedicated `MOVEMENT_HARVESTER` type, speed factor 20 **when empty**, scaling down as it fills: `speed = (255 − amount) × speed / 256` where `amount` is its 0–100 fill percentage [OD:unit.c `Unit_SetSpeed`] — a full Harvester is visibly more sluggish than an empty one.
- **Harvesting mechanic (exact, from source)**: `Script_Unit_Harvest` runs each tick while parked on a Spice/Thick-Spice tile: `amount += Tools_Random_256() & 1` (i.e., +0 or +1, ~50% chance each tick, capped at 100) [OD:script/unit.c]. So fill rate is stochastic, averaging +0.5/tick while actively harvesting. Additionally there's a **1-in-32 chance per tick** that the spice tile itself is depleted by one unit (`Map_ChangeSpiceAmount(packed, -1)`) — spice fields visibly shrink as they're worked. The unit's `amount` field (0–100) is displayed directly as "X% full" in the in-game status text [OD:unit.c `Unit_DisplayStatusText`]. **Exact spice-to-credits conversion / real capacity in raw spice units is not in the excerpts read from source** — commonly cited across the community as **≈700 spice per full load (?, unconfirmed against source in this pass)**; treat the engine's native 0–100 "amount" percentage as authoritative and pick your own credit-per-load constant for the remake, or verify against `Refinery`/`Structure_Get` unload code directly.
- **Special behavior**: On death, **spills its carried spice back onto the map** as a spice field: `Map_FillCircleWithSpice(position, amount/32)` [OD:unit.c line ~1557] — a killed, loaded Harvester visibly creates a small spice patch. Auto-returns to the closest Refinery via `Unit_FindClosestRefinery`; if none is idle/available, waits. **Sandworms strongly prefer attacking Harvesters** — see Sandworm targeting-priority formula below (tracked/harvester-class targets score 10× higher than foot infantry).
- **Visual**: Large, tracked, boxy, heavily-armored vehicle. Confirmed via in-fiction Mentat lines: "large, slow, and barely manoeuvrable" (Harkonnen Mentat) / "well armored"/"iron clad" (Atreides Mentat), and capable of visibly "crushing infantry beneath their treads" [Wiki: dunerts.wiki.gg/wiki/Harvester_(Dune_II)]. A front intake/scoop is functionally certain but **no source explicitly describes its geometry in prose** for the 1992 sprite (?) — very commonly reproduced as an angled wedge/scoop front end in fan 3D reconstructions, which is circumstantial supporting evidence only. Three house-specific color variants confirmed to exist [Wiki: duneii.nahoo.net/units]. No confirmed distinct "intake" animation while harvesting (?).
- **Sources**: [OD:unitinfo] entry 16; [OD:unit.c]; [OD:script/unit.c]; dunerts.wiki.gg/wiki/Harvester_(Dune_II); archive.org manual.

### MCV (Mobile Construction Vehicle)
- **Names**: PC "MCV", full "Mobile Const. Vehicle".
- **Houses/building**: All three main houses. Heavy Vehicle Factory, upgrade level **1**, mission 4 [OD:unitinfo entry 17, OD:structinfo]. Also the unit every house starts most missions with.
- **Cost/Build/HP**: 900cr (most expensive directly-buildable unit) / 80 / 150 HP, fog 2. `canBePickedUp=true`, `explodeOnDeath=true`.
- **Movement**: Tracked, speed 20, turn 1. No weapon.
- **Special behavior — deploy (exact, from source)**: player order `ACTION_DEPLOY` runs `Script_Unit_MCVDeploy`, which tries **four fixed tile offsets relative to the MCV's current tile — `{0, −1, −64, −65}`** (current tile, one west, one north, one northwest — i.e. it tries to seat the new 2×2 Construction Yard footprint with the MCV's tile as each of the four possible corners in turn) [OD:script/unit.c]. The first offset that successfully places a `STRUCTURE_CONSTRUCTION_YARD` succeeds; the MCV unit is removed and replaced in-place by the new Construction Yard. If all four fail (insufficient clear space), the order is refused with "Unit is unable to deploy here" and the MCV remains intact. Dune Legacy's independent reimplementation gives a citable real-time figure: **~4.5 seconds to deploy at normal game speed**, and requires the MCV be positioned so a 2×2 area of rock/concrete is available in the top-left-quadrant sense [Wiki: dunerts.wiki.gg/wiki/Mobile_Construction_Vehicle_(Dune_II)] (this specific timing is Dune-Legacy-sourced, not independently re-derived from OpenDUNE timers — **(?)** for exact 1992 parity).
- **Visual**: Tracked, boxy, unarmed hull (no source gives exact proportions beyond "boxy" — **(?)** reasonable inference). The literal on-screen transform from vehicle sprite to building sprite (fade/morph/instant swap) is not confirmed for the 1992 original; **do not** backport the drill/dig-in deploy animation from *Emperor: Battle for Dune* (2001) — that is a different, fully-3D game in the series and its deploy sequence is unrelated to this sprite-based original. Three house-color variants exist [Wiki: duneii.nahoo.net/units].
- **Sources**: [OD:unitinfo] entry 17; [OD:script/unit.c]; dunerts.wiki.gg/wiki/Mobile_Construction_Vehicle_(Dune_II); archive.org manual.

---

## Aircraft

### Carryall
- **Names**: PC "Carryall", full "All-Purpose Carryall".
- **Houses/building**: All three main houses. **Hi-Tech Factory**, upgrade level 0, mission 5 [OD:unitinfo entry 0, OD:structinfo].
- **Cost/Build/HP**: 800cr / 64 / 100 HP, fog **0** (doesn't reveal fog itself). `mustStayInMap=true` (bounces off map edges rather than leaving), `isNotDeviatable=true`, unarmed.
- **Movement**: Winged, speed **200** (2nd fastest unit after Death Hand), turn 3.
- **Special behavior — auto pickup/delivery (exact, from source)**: Two distinct pickup paths, both in `src/script/unit.c`:
  - **`Script_Unit_Pickup` from a structure** — used when a factory finishes a new vehicle: the Carryall collects the freshly-built unit and flies it to that unit's `targetLast` position, or (for AI-owned Harvesters) searches for the nearest spice within 20 tiles to drop it directly onto a spice field.
  - **`Script_Unit_Pickup` from a mid-map unit** — this is the **repair-ferry mechanic**: given a target unit, it searches for the closest **idle structure** that is (a) an idle **Refinery**, if the target is a Harvester, or (b) an idle **Repair Facility**, for **any other unit type**, that isn't already reserved by another Carryall. **This confirms, directly from source, that Carryall auto-pickup-to-repair works for any damaged ground vehicle, not just Harvesters** — matching the task's premise exactly.
  - **`Script_Unit_TransportDeliver`** handles the drop-off: lands, hands the carried unit to the destination structure (`Unit_EnterStructure`) or places it gently at a tile, clearing all transport flags.
  - **`Script_Unit_MoveToTarget`** (explicitly commented "wise to only use... on Carry-Alls") implements the smooth flight approach: full speed until within 0.5 tiles of target, then decelerating and snapping into a landing position within 0.125 tiles — the basis of its smooth landing animation.
  - A unit can "call" a Carryall to itself via `Script_Unit_CallUnitByType`, but only if it has `canBePickedUp=true` and isn't currently deviated.
  [All: OD:script/unit.c]
- **Visual**: Large, boxy, wide-bodied aircraft — the single largest sprite footprint of any non-Sandworm unit (a ripped DOS sprite sheet crop measures 198×112px, dwarfing the multi-frame Tanks sheet crop of 88×92px) [Wiki: spriters-resource.com asset 141543]. Casts a moving ground shadow while flying (`hasShadow=true` in source) [OD:unitinfo]. Likely has twin engine nacelles and a flat cargo belly (general knowledge, **(?)** not independently prose-confirmed); the carried unit is most likely drawn as a separate sprite beneath/behind the Carryall's body rather than an animated claw/grapple part on the Carryall itself (?) — verify directly against the SHP frames.
- **Sources**: [OD:unitinfo] entry 0; [OD:script/unit.c]; spriters-resource.com (asset listing only); wiki.dune2k.com.

### Ornithopter ('Thopter)
- **Names**: PC internal abbreviation "'Thopter", full "All-Purpose Ornithipter" [sic, `STR_ORNITHIPTER` in source — a genuine typo baked into the original string table] [OD:unitinfo entry 1].
- **Houses/building**: Atreides, Ordos (+AI sub-houses); **not Harkonnen**. Hi-Tech Factory upgrade level 1 + House of IX, mission 7 [OD:unitinfo entry 1, OD:structinfo]. Cross-confirmed independently by the Genesis manual: "Atreides & Ordos only, NOT Harkonnen" [Genesis].
- **Cost/Build/HP**: 600cr / 96 / **25 HP** (very fragile), fog 5.
- **Movement**: Winged, speed 150, turn 2, `mustStayInMap=true`.
- **Weapon**: fires the **MiniRocket** projectile always (`bulletType = UNIT_MISSILE_TROOPER`), damage 50, range 50(!) (its huge `fireDistance` reflects that it's not player-aimed — see below), fire delay 50, **`firesTwice=true`** (two rockets per attack run, one from each wing, dropping to one below 50% HP).
- **Special behavior**: **Not directly player-controllable for combat** — `actionAI=ACTION_STOP` and `tabSelectable=false`; per multiple sources it launches automatically on an attack run against enemy targets and cannot be manually ordered to attack, only observed [Wiki: hardcoregaming101.net; wiki.dune2k.com]. `DISPLAYMODE_ORNITHOPTER` is its own display mode (distinct from `DISPLAYMODE_UNIT`), described in source comments as "N, NE, E; 3 frames per direction" [OD:unit.h] — i.e. **a genuine 3-frame wing-flap animation cycle per facing**, confirmed independently as a notable design point: "aircraft that use actual flapping wings to achieve flight" [Wiki: allthetropes.org "Cool Plane"]. `animationSpeed=7` ticks per frame.
- **Visual**: House-colored variants confirmed to exist for Atreides/Ordos [Wiki: dunerts.wiki.gg/wiki/Ornithopter_(Dune_II)]; exact color placement on the sprite not documented (?). Ripped DOS sheet is a wide 240×82px strip, consistent with a short horizontal run of wing-position frames [Wiki: spriters-resource.com asset 141546].
- **Sources**: [OD:unitinfo] entry 1; [OD:unit.h]; hardcoregaming101.net; wiki.dune2k.com; allthetropes.org; dunerts.wiki.gg/wiki/Ornithopter_(Dune_II); Genesis manual.

### Frigate
- **Names**: PC "Frigate" (no full-name string; `stringID_abbrev`/`stringID_full` both `STR_NULL` — **it has no in-game display name at all** [OD:unitinfo entry 26]).
- **Houses/building**: not buildable; auto-associated with the **Starport** (unlocks mission 6). Represents the CHOAM cargo ship that delivers Starport orders.
- **Cost/Build/HP**: n/a (not purchasable) / 100 HP, fog 0.
- **Movement**: Winged, speed 130, turn 2. `hasShadow=true`.
- **Special behavior**: `tabSelectable=false`, `actionAI=ACTION_INVALID`, `isNormalUnit=false` — **confirmed non-interactive on both platforms**: the Genesis manual explicitly documents that the Frigate is never referenced in tutorial/gameplay text or given a unit-table entry despite being visible in-game, and it cannot be clicked, targeted, or ordered [Genesis: ledmeister.com dunexref §35] — this matches the PC source flags exactly, so it is **not** a Genesis-specific omission, both versions treat it purely as a scripted delivery visual/logic object. Independent evidence it is a real simulated map entity (not just a UI abstraction) comes from the faithful open-source remake *Dune II — The Maker*: a documented bug describes the Frigate "continuing on its way and getting stuck above the place where your Starport was" if the Starport is destroyed mid-flight, and a fix makes it "drop each purchased unit at a random point on the battlefield" instead [Wiki: github.com/stefanhendriks/Dune-II---The-Maker issues #215, #46] — i.e. it really flies in from off-map to the Starport and back out.
- **Visual**: **Not confirmed** — does not appear in the Spriters-Resource DOS unit-sheet listing (Carryall, Devastator, Harvester, Infantry, MCV, Ornithopter, Quad, Sandworm, Siege Tank, Tanks, Trike, Troopers are listed; Frigate is absent) [Wiki: spriters-resource.com/pc_computer/duneiithebuildingofadynasty]. Recommend checking the `UNIT_FRIGATE` draw call directly in OpenDUNE — its `wsa` field is `NULL` in the data table [OD:unitinfo entry 26], suggesting it may not even use a normal directional SHP sprite and could instead be drawn via a WSA animation or a simple placeholder graphic over the Starport. If a placeholder is needed: a neutral, non-house-colored dark cargo-ship silhouette, larger than the Carryall, is a reasonable design assumption but is pure speculation **(?)**.
- **Sources**: [OD:unitinfo] entry 26; Genesis manual via ledmeister.com; github.com/stefanhendriks/Dune-II---The-Maker (independent remake bug reports, corroborating behavior only).

---

## Special / unique units

### Death Hand missile
- **Names**: PC internal name literally "Death Hand" in the `name` field, but no display string (`stringID_abbrev`/`_full` = `STR_NULL`) [OD:unitinfo entry 18].
- **Houses**: `availableHouse = FLAG_HOUSE_HARKONNEN` in the unit table [OD:unitinfo], and per `houseinfo.c`, **Sardaukar also has `specialWeapon=1`** (the same Death Hand code) — so both Harkonnen and Sardaukar can call it in campaign [OD:houseinfo]. Trigger: Palace special weapon, mission 8 [OD:structinfo].
- **Stats**: HP70 (as a projectile-entity, i.e. its own "durability" while in flight), fog 0, dimension 32, Winged movement, speed 250 (2nd fastest entity in the game after nothing — actually the single fastest, faster than Carryall's 200), turn 2, range 15, table `damage=100`.
- **Special behavior — exact warhead pattern**: On arrival, `Unit_CreateBullet`'s `UNIT_MISSILE_HOUSE` case detonates a **17-point cluster explosion pattern** at fixed offsets forming a diamond/hex shape out to 2 tiles from the impact point (`offsetX/offsetY` tables with 17 entries, e.g. {0,0}, {0,±256}, {±200,±200}, {±256,0}, {0,±512}, {±400,±400}, {±512,0} in sub-tile units), **each point independently dealing 200 damage** [OD:unit.c line ~1424-1437]. This is far more devastating than the generic 8-point self-destruct pattern used elsewhere (see Devastator) — the Death Hand is a genuinely different, larger explosion routine. In-universe flavor text: "capable of being targeted for long range strikes. Just prior to impact it releases a series of explosive fingers that spread destruction over a wide area" [Wiki: dunerts.wiki.gg/wiki/Death_Hand_(Dune_II)] — a direct narrative match for the 17-point "fingers" pattern found in source. Manual-cited scale: **8.12 meters long** [Wiki: dunerts.wiki.gg, manual paraphrase]. A distinct "Death hand explode" animation asset exists separate from generic explosions [Wiki: lilura1.blogspot.com]. Recharge: `specialCountDown=600` ticks (Harkonnen and Sardaukar) [OD:houseinfo] — Genesis-observed real time ≈11–12 minutes (Harkonnen) vs ≈15–16 minutes (Sardaukar) despite the identical tick constant, an unresolved discrepancy **(?)**; both versions apparently let you reset the cooldown by destroying and immediately rebuilding your Palace [Genesis: ledmeister.com].
- **Visual**: Ballistic missile in flight, arcing toward its target with a smoke/fire trail (general convention, **(?)** not independently confirmed for this game specifically); developers reportedly avoided true "atomic" framing in the fiction despite community shorthand of "nuclear cluster missile" [Wiki: hardcoregaming101.net vs dune.fandom.com dev-intent note]. Whether the final explosion forms a rising mushroom-cloud shape or a large radial fireball is **not confirmed** (?) — check the dedicated "Death hand explode" SHP/animation frames directly.
- **Sources**: [OD:unitinfo] entry 18; [OD:unit.c]; [OD:houseinfo]; dunerts.wiki.gg/wiki/Death_Hand_(Dune_II); lilura1.blogspot.com; Genesis manual via ledmeister.com.

### Sandworm (Shai-Hulud)
- **Names**: PC "Sandworm", full string `STR_SANDWORM2`.
- **Houses**: `availableHouse = FLAG_HOUSE_FREMEN` [OD:unitinfo entry 25] — an engine bookkeeping association (Fremen are the desert natives who "control" worms lore-wise), not a playable unit; it's a neutral map hazard that attacks everyone. Present from campaign mission 3 onward per the Genesis manual/reference; missions 1–2 have none [Genesis: ledmeister.com dunexref §54] (very likely identical on PC, not independently re-derived from OpenDUNE scenario data this session — **(?)**).
- **Stats**: HP **1000** (by far the tankiest entity in the game), dimension 24, movement type **Slither** (its own dedicated enum value, `MOVEMENT_SLITHER`), speed 35, turn 3, fire delay 20, table `damage=300`. `tabSelectable=true` and `priority=true` despite not being player-buildable — it can be selected/inspected. `blurTile=true` — triggers the engine's tile-distortion rendering flag, the technical basis of its sand "shimmer" trail.
- **Special behavior — eating (exact, from source)**: created with **`amount = 3`** hardcoded at spawn (`src/pool/unit.c`: `if (type == UNIT_SANDWORM) u->amount = 3;`) [OD:pool/unit.c]. Each successful attack in `Script_Unit_Fire`'s `UNIT_SANDWORM` case **completely removes the target unit from the game in one hit** (no HP roll — instant kill regardless of target's remaining HP), plays a distinct "swallow" sound and the `EXPLOSION_SANDWORM_SWALLOW` animation, decrements `amount`, and **when `amount` reaches 0 after the third swallow, the worm itself is immediately ordered to `ACTION_DIE`** (it dies/dives away permanently) [OD:script/unit.c `Script_Unit_Fire`]. **This precisely confirms: a Sandworm eats exactly 3 units and then disappears.**
- **Special behavior — targeting priority (exact formula, from source)**, `Unit_Sandworm_GetTargetPriority`: only considers targets that are (a) on an unveiled/visible tile and (b) standing on **sand terrain** (units on rock/concrete are immune) [OD:unit.c]. Base priority by movement type: **Foot = 100, Tracked = 1000, Harvester = 1000, Wheeled = 5000**, everything else (aircraft, etc.) = 0 (untargetable) — i.e. **wheeled vehicles (Trike/Raider/Quad) are the worm's single most preferred prey, 50× more attractive than infantry**, with Harvesters/tanks a strong second choice at 10× infantry. This base score is **quadrupled** if the target is currently moving or has a nonzero fire-delay (i.e., mid-action), divided by distance to the worm, and **doubled again** if within 2 tiles. [OD:unit.c `Unit_Sandworm_GetTargetPriority`/`Unit_Sandworm_FindBestTarget`]. If it can find no path to its chosen target, it waits 720 ticks before retrying (a long "dive and reconsider" pause) [OD:script/unit.c `Script_Unit_CalculateRoute`].
- **Visual**: A chain of dark tan/brown segmented body rings breaking the sand surface in a curving line as it swims (general knowledge from widely-viewed gameplay footage, **(?)** not found in prose form despite searching). A moving sand-ripple/shimmer disturbance traces its underground path ahead of surfacing — the open-source *Dune Legacy* reimplementation renders this explicitly as a dedicated shimmer texture blended over the sand with an 8-step horizontal offset table cycling each frame, confirming the shimmer effect is a real, intentional rendering technique worth replicating in 3D (as a UV-scrolling distortion/heat-haze shader) [DL: `SandWorm.cpp` shimmer rendering, house-independent, `ObjPic_SandwormShimmerTemp`/`ObjPic_SandwormShimmerMask` textures — note this is Dune Legacy's own reimplementation, not extracted 1992 source, so treat exact shimmer parameters as inspiration rather than ground truth]. Attack surfacing/mouth-opening is confirmed to be treated as a distinct, deliberately-tuned multi-frame animation sequence by at least one other faithful remake's dev-log, though the original's exact frame count/timing is not given [Wiki: dune2themaker.fundynamic.com/2021/09/02/sandworms]. Ripped DOS sprite sheet is a short 126×26px strip [Wiki: spriters-resource.com asset 141549] — likely incomplete (only a handful of body-segment frames), since separate WSA-format animation data likely covers the shimmer trail and swallow attack rather than the SHP sprite sheet.
- **Sources**: [OD:unitinfo] entry 25; [OD:unit.c] (`Unit_Sandworm_GetTargetPriority`, `Unit_Sandworm_FindBestTarget`); [OD:pool/unit.c]; [OD:script/unit.c]; [DL] `src/units/SandWorm.cpp`; spriters-resource.com; dune2themaker.fundynamic.com; Genesis manual via ledmeister.com.

---

## Projectiles

All are `UnitType` entries in `unitinfo.c` with `flags.isBullet=true` (except Sonic Blast and Sandworm's own bulletType, which are handled as special cases in the bullet-movement code). None are player-buildable; all inherit `movementType=Winged` regardless of what fired them, since they fly.

| Name (internal) | Used by | Dim | Speed | Turn | Range | Table Dmg | Explosion | Notes |
|---|---|---|---|---|---|---|---|---|
| Rocket (`UNIT_MISSILE_ROCKET`) | Launcher | 16 | 200 | 2 | 8 | 75 | Impact-Explode | `notAccurate=true`, `hasAnimationSet=true` (likely a smoke-trail frame set), `impactOnSand=true` (leaves a crater on a sand miss) |
| ARocket (`UNIT_MISSILE_TURRET`) | Rocket Turret (defense structure) | 16 | 160 | **8** | 60 | 75 | Impact-Explode | `notAccurate=false` — the **only accurate/true-homing** projectile in the game (very high turn rate); actual engagement range set by the Rocket Turret structure, not this base value |
| GRocket (`UNIT_MISSILE_DEVIATOR`) | Deviator | 16 | 200 | 2 | 7 | 75 (irrelevant — see Deviator) | **Deviator Gas** | Its own explosion type is the dedicated `EXPLOSION_DEVIATOR_GAS` sequence — 5 sprite frames (208–212) at 15 ticks each ≈ a slow, ~75-tick-long dissipating gas-cloud animation with its own sound cue [OD:explosion.c]. Actual gameplay effect is the area deviation described under Deviator, not damage |
| MiniRocket (`UNIT_MISSILE_TROOPER`) | Trooper/Troopers (long range only, >2 tiles) and Ornithopter (always) | **8** (smallest projectile) | 180 | 5 | 3 | 0 (overridden by firer; −25% when fired by Trooper/Troopers specifically) | Mini-Rocket | Small, homing (`notAccurate=false`) |
| Bullet (`UNIT_BULLET`) | Soldier, Infantry, Trooper/Troopers (short range), Combat Tank, Siege Tank, Devastator | 8 | **250** (near-instantaneous) | 0 (flies dead straight) | — | 0 (overridden by firer) | Impact-Small | `hitpoints=1` — a single hit destroys it; effectively a hitscan-style tracer given its speed and 0 turn rate |
| Sonic Blast (`UNIT_SONIC_BLAST`) | Sonic Tank | 32 (largest small-arms-class projectile) | 200 | 0 | 10 | 25 (table value; real per-tick damage is dynamic, see Sonic Tank) | none (self-consumed) | `blurTile=true` — engine distortion-rendering flag, consistent with a rippling wave visual; travels through units/terrain rather than stopping on first hit |

**Death Hand** and **Sandworm's own "bulletType"** are documented in their unit sections above rather than here, since both are full unit entries with their own hit-point pools and behavior rather than simple fire-and-forget bullets.

No prose source describes the pixel appearance of Rocket/ARocket/GRocket/MiniRocket/Bullet — every dedicated wiki search for these returned function-only descriptions. The following is genre/engine-convention inference only, **(?)** throughout: small missile-shaped sprites (short body, pointed nose, tail fins) with a brief smoke/flame trail for the Rocket family, and a minimal bright pixel-cluster with a 1-frame muzzle flash / impact spark for the plain Bullet, reflecting 1992-era sprite budgets. Recommend checking the actual SHP frames via OpenDUNE tooling (already available to the team) rather than trusting this inference.

---

## Sega Genesis vs. PC differences

> **Remake note (2026-10-01):** the remake follows the Genesis on factories: every "Light Vehicle
> Factory" and "Heavy Vehicle Factory" unit above is built at its single Heavy Factory, whose upgrade
> levels are 1 Quad, 2 MCV, 3 Launcher (Missile Tank), 4 Siege Tank (spec §4.5).

Comparing OpenDUNE's exact PC/DOS values (`src/table/unitinfo.c`) against the official 1993 Sega Genesis "Dune: The Battle for Arrakis" NTSC manual and Ledmeister's cartridge-verified technical reference (the two most detailed and mutually-consistent Genesis sources found).

### Roster / naming
- **No units removed or added.** Every PC unit type (Soldier, Infantry, Trooper, Troopers, Saboteur, Trike, Raider Trike, Quad, Combat Tank, Siege Tank, Launcher, Deviator, Sonic Tank, Devastator, Harvester, MCV, Carryall, Ornithopter, Death Hand, Sandworm, Fremen) is present on Genesis. Saboteur, Deviator, Sonic Tank, Devastator, and Raider Trike are all confirmed present and correctly house-exclusive (Ordos/Ordos/Atreides/Harkonnen/Ordos respectively) [Genesis: US manual pp.22–27].
- **Naming**: PC internal name **"Launcher"** (display string "Rocket Launcher") is called **"Missile Tank"** throughout the Genesis manual and most wiki treatments, though the Genesis purchase-screen icon itself is apparently still labeled "LAUNCHER" per one technical source — a minor internal inconsistency even within Genesis documentation, not a clean PC-vs-Genesis rename [Genesis: ledmeister.com]. All other unit names are unchanged.
- **Frigate**: confirmed non-interactive/undocumented as a "unit" in the Genesis manual, but this exactly matches the PC data table's own flags (`tabSelectable=false`, `actionAI=ACTION_INVALID`) — **not a Genesis-specific omission**.
- **Houses**: same three playable houses (Harkonnen/Atreides/Ordos); Sardaukar and Fremen appear identically as non-playable campaign/special-weapon entities on both platforms per the engine's shared house table. **Mercenary's in-campaign visibility could not be confirmed for Genesis** by the research pass (the word doesn't appear in the Genesis manual or the ~220KB Ledmeister technical reference) — since Mercenary exists as House index 5 in the PC's own `houseinfo.c` with a full house-info entry (toughness 0, specialWeapon 3 = Saboteur, its own voice file), it is at minimum present in the shared engine on both platforms; whether it's actually reachable/visible in either version's stock campaign is unresolved **(?)**.
- Genesis has **no multiplayer at all** (single controller port only) — moot for "sub-houses used in multiplayer" since PC Dune II (1992) itself predates any multiplayer mode in the series (multiplayer/skirmish arrived later, with *Dune 2000*) — this is not a version difference.

### Stat differences (Genesis manual/cartridge numbers vs. OpenDUNE PC values)

Genesis "Arms" (community-reference damage rating) reads **consistently ≈1.5× higher** than OpenDUNE's raw PC `damage` field across nearly every unit (Soldier 4 vs 3, Trooper/Troopers 8 vs 5, Quad 10 vs 7, Combat Tank 38 vs 25, Siege Tank 45 vs 30, Devastator 60 vs 40, Sonic Tank 90 vs 60, Launcher 112 vs 75 — ratios cluster at 1.33–1.6×). This is too uniform to be coincidental, but **it is not clear whether this reflects an actual Genesis balance change or a different metric definition** in the Genesis-side community reference (e.g. a derived "effective power" rating rather than raw per-shot damage) — flagged **(?)**, worth a direct ROM-side check before assuming Genesis units really hit ~50% harder.

**Hit points match exactly** between PC and Genesis for the great majority of units (Soldier 20, Infantry 50, Trooper 45, Troopers 110, Trike 100, Raider Trike 80, Quad 130, Combat Tank 200, Siege Tank 300, Devastator 400, Deviator 120, Harvester 150, MCV 150, Carryall 800(cost, matches)/100(HP, matches), Death Hand 70) — **with two notable, clearly-documented exceptions**:
- **Saboteur: PC HP 10 vs. Genesis HP 40** — a genuine 4× toughness difference.
- **Ornithopter: PC HP 25 vs. Genesis HP 5** (per the values actually used by the Genesis cartridge's own production/Starport screens; the Genesis *manual* misprints this as 3) — Genesis Ornithopters are dramatically more fragile, about 1/5 the PC's hit points.

**Cost values are identical** across every unit checked (Soldier 60, Infantry 100, Trooper 100, Troopers 200, Trike 150, Raider 150, Quad 200, Combat Tank 300, Siege 600, Launcher 450, Devastator 800, Deviator 750, Sonic Tank 600, Harvester 300, MCV 900, Carryall 800, Ornithopter 600) — no economic rebalancing.

**Range**: Trooper and Troopers show PC `fireDistance=5` vs. Genesis-documented `Range=3` — a plausible real difference, though it comes with a caveat: the Genesis manual itself independently prints Trooper/Troopers **speed** values backwards (swapping the two units' speed stats relative to what the cartridge actually does, per Ledmeister's own direct comparison of manual-vs-cartridge behavior), so Trooper/Troopers documentation on Genesis is demonstrably error-prone — treat the range difference as likely-real but **(?)** pending a cleaner source. All other ranges checked (Soldier/Infantry 2, Trike/Quad 3, Combat Tank 4, Siege 5, Launcher 9, Deviator 7, Sonic Tank 8, Devastator 5, Saboteur 2) **match exactly**.

**Build times**: no numeric Genesis source found; only a qualitative claim that "construction doesn't take nearly as long on Genesis" [Sega-16 review] with no figures to compare against OpenDUNE's tick constants — unresolved **(?)**.

**Special-weapon recharge**: PC `specialCountDown` is 600 ticks for Death Hand (Harkonnen and Sardaukar alike) and 300 ticks for the Fremen-call/Saboteur-call powers [OD:houseinfo]. Genesis real-time observations are ~11–12 min (Harkonnen Death Hand), ~15–16 min (Sardaukar Death Hand — different from Harkonnen despite an identical PC tick constant), ~4 min (Fremen), ~6–7 min (Saboteur — again different from Fremen's identical 300-tick constant) [Genesis: ledmeister.com]. The mismatches between identical tick constants and different observed real-world minutes are unexplained — could be Genesis-specific tuning, measurement variance, or an artifact of how "ticks" convert to real time at different points in the campaign; flagged **(?)**.

### Graphics
- Reviewers consistently describe Genesis unit/building sprites as **bigger and more "cartoony"** than the PC originals, with "fairly different... graphics" overall [Wikipedia; Sega-16 review; dune2k.com] — a genuine art-direction difference, not just a palette/hardware artifact, though no pixel-level side-by-side comparison source was found to quantify it further.
- Deviated units recolor to the deviating house's color and revert when the effect ends, and this is shown on the radar too — documented for Genesis [ledmeister.com] and consistent with (likely shared with) the PC engine's house-remap mechanism described in the Deviator section above.
- Carryalls are described as "white, trimmed with the House color of the side controlling it" [Genesis: ledmeister.com] — a specific, useful color-callout not found in any PC-specific source; worth adopting for the remake's Carryall material (base white/grey hull + house-color trim) pending direct sprite verification.

### Controls (context, not a unit stat difference)
Genesis replaces the mouse with a single D-pad-driven 8-direction cursor (speed-boostable by holding a button) and **orders units strictly one at a time** — there is no drag-box/multi-unit selection, only a pairwise "Escort" order as the closest thing to group behavior [Genesis: US manual pp.4–5, 17; ledmeister.com; Sega-16 review]. This is **very likely not a Genesis-specific limitation**: the 1992 PC original is itself widely understood to lack drag-box multi-selection (that innovation is credited to Command & Conquer, 1995, Westwood's next engine) — so single-unit ordering was probably the baseline experience on **both** platforms, just executed via mouse-click on PC vs. D-pad-cursor+button on Genesis. Treat any "Genesis can't multi-select" framing as describing the genre/era baseline, not a cartridge-specific handicap, unless the OpenDUNE UI code shows otherwise.

### Campaign structure
Both platforms give each of the three houses a full independent 9-mission campaign with the same shaped mission ladder (spice-quota or single-base missions early, multi-base and dual-house missions later, culminating in mission 9's "2 Sardaukar bases" finale for all three houses) [Genesis: ledmeister.com dunexref §4]. This mission-number-gated tech ladder matches almost exactly what this document independently reconstructed from OpenDUNE's PC-side `structureinfo.c` (e.g. both sources agree the Palace/special-weapons unlock at **mission 8**) — strong cross-platform (and cross-source-method) agreement that the campaign progression schedule is shared, not Genesis-specific.

---

## Sources

**Primary (hard data, exact values)**
- OpenDUNE source (github.com/OpenDUNE/OpenDUNE, `master` branch, fetched via raw.githubusercontent.com): `src/table/unitinfo.c`, `src/table/houseinfo.c`, `src/table/structureinfo.c`, `src/table/explosion.c`, `src/table/movementtype.c`, `src/unit.c`, `src/unit.h`, `src/house.c`, `src/house.h`, `src/structure.c`, `src/structure.h`, `src/script/unit.c`, `src/script/general.c`, `src/pool/unit.c`.
  - https://github.com/OpenDUNE/OpenDUNE
  - https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/unitinfo.c
  - https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/houseinfo.c
  - https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/structureinfo.c
  - https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/explosion.c
  - https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/unit.c
  - https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/unit.h
  - https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/house.c / src/house.h
  - https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/structure.c
  - https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/script/unit.c
  - https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/pool/unit.c

**Secondary (cross-check / behavior corroboration)**
- Dune Legacy, philippkeller/dunelegacy fork (the "Dune-Legacy/dunelegacy" GitHub org referenced in the task brief no longer resolves; this is the original author's canonical fork with the most complete per-unit C++ source): https://github.com/philippkeller/dunelegacy — files read: `include/ObjectData.h`, `src/ObjectData.cpp`, `src/units/{Harvester,MCV,Carryall,Devastator,Deviator,SonicTank,SandWorm,Saboteur,Trooper,InfantryBase,AirUnit,Frigate,Ornithopter}.cpp`. Note: this fork's actual balance numbers live in a compiled `ObjectData.ini` packed inside `data/LEGACY.PAK`, not available as plaintext in the repo — only behavior code was cross-checked, not tunable numbers.

**Web / manual research (visual descriptions, Sega differences, naming) — gathered via three parallel research passes**
- dune.fandom.com (Dune Wiki, various unit pages, largely via search snippets — direct fetch returned HTTP 402 in this session)
- dunerts.wiki.gg (Dune II unit pages — Trooper, Saboteur, Combat Tank, Siege Tank, Deviator, Devastator, Harvester, MCV, Ornithopter, Fremen, Sardaukar, Death Hand, Dune II manual page)
- cnc.fandom.com (C&C Wiki also covers Dune II units, via search snippets)
- moddingwiki.shikadi.net (`Westwood_SHP_Format_(Dune_II)`, `Dune_II` — house-color remap-table technical mechanism)
- allthetropes.org/wiki/Dune_II (house base-colors, Sardaukar helmet/visor detail, Harkonnen smokestacks, Ordos retractable turrets)
- tvtropes.org (`Fixed_Forward_Facing_Weapon`, `VideoGame/DuneII`)
- duneii.nahoo.net (units/, special/, houses/) and nahoo.net/games/dune-2/
- spriters-resource.com (DOS and Genesis Dune II sprite-sheet indexes — listing/dimensions only, image fetch blocked)
- dune-ii.blogspot.com (2006/11 post — technical sprite/animation reverse-engineering notes from a fan remake)
- dune2themaker.fundynamic.com (2021 dev-log posts on Sandworm animation and Starport/Frigate behavior fixes)
- github.com/stefanhendriks/Dune-II---The-Maker (issues #215, #46 — Frigate behavior)
- archive.org (hosted text of the original Dune II DOS manual)
- hardcoregaming101.net/dune-ii-the-building-of-a-dynasty/
- wiki.dune2k.com (`Dune_II_units`) and dune2k.com/Duniverse pages
- **Sega Genesis**: segaretro.org (manual PDF: `Dune2_MD_US_Manual.pdf`), Wikipedia `Dune_II`, sega-16.com review, Ledmeister's extended technical reference (https://ledmeister.com/dunexref.htm / .txt) and combat-efficiency table (https://ledmeister.com/dunepowr.htm / .txt) — the single most detailed Genesis-specific source found, cross-validated directly against the official manual's own printed unit tables, tasvideos.org Genesis resource page.

**Notes on source access**: Fandom-hosted wikis (dune.fandom.com, cnc.fandom.com) returned HTTP 402 to direct automated fetches throughout this research and had to be used via search-result snippets only. spriters-resource.com and romhacking.net returned HTTP 403 to direct fetches (listing pages/metadata were still visible via search). segaretro.org's wiki *article* pages were blocked by an anti-bot wall, but the manual **PDF** hosted on the same domain was fetchable directly and was the single richest Genesis source used. Where a claim rests only on a search-engine snippet rather than a fully-loaded page, or where two sources disagree, this is flagged inline with **(?)**.
