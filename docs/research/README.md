# Dune II research — index and key findings

Research done 2026-09-28 for the Three.js remake. Five parallel passes; the raw reports are
long and source-cited, this page is the map.

| File | Covers |
|---|---|
| `raw/units.md` | Every unit: cost, HP, speed, turret, weapon, range, fire delay, sight, house availability, special behaviour, visual notes, projectiles, Sega vs PC |
| `raw/structures.md` | Every structure: footprint, cost, HP, power, storage, prerequisites, upgrades, tech tree, turrets, starport, palace, placement and concrete rules, Sega vs PC |
| `raw/mechanics-campaign.md` | Terrain table and map generator, economy, power, production, combat, sandworms, fog, orders, enemy AI, campaign, Mentats, scoring/ranks, Sega Genesis port, history |
| `raw/audio-ui-controls.md` | Voice lines and SFX, music (32 PC tracks, peace/battle pools), PAK/VOC/ADL formats, C&C 1995 sidebar, production flow, cursors, hotkeys, EVA lines, control-scheme history, copyright |
| `refs/INDEX.md` | 47 private reference images (not shipped): Mentat info cards for every unit and structure, Genesis and PC gameplay screenshots, house emblems, Mentat/map screens |

Primary hard-data source: the OpenDUNE decompilation (`src/table/unitinfo.c`,
`structureinfo.c`, `houseinfo.c`, `landscapeinfo.c`, `unit.c`, `structure.c`, `house.c`),
cross-checked with Dune Legacy, Ledmeister's PC and Genesis FAQs, the Genesis manual, and
EA's 2025 GPL release of the C&C Tiberian Dawn source for the interface.

## Findings that shape the design

1. **Stats are exact.** HP, cost, build time, damage, range, fire delay, sight and speed for all
   23 units and 19 structures come straight from the original tables.
2. **No armour classes.** Damage is a flat number subtracted from HP. Only the Saboteur,
   Death Hand, Devastator self-destruct and exploding vehicles do splash damage. Rockets
   (Launcher, Deviator, Trooper long-range, Death Hand) scatter; cannons and guns always hit.
3. **Tracked vehicles crush infantry** outright. Infantry and Trooper squads (3 figures) drop to
   a single figure below 50 % HP.
4. **Economy.** A full Harvester load is worth 700 credits. Refinery stores 1005, Silo 1000;
   spice beyond storage is lost. Destroying storage burns a proportional share of the owner's
   credits. Spice blooms erupt and fill a radius-5 circle with spice. A dead Harvester spills
   its load.
5. **Power.** Only Wind Traps produce (100 each, scaled by their HP). A deficit turns off radar
   and, in the original, grinds every building down towards 50 % HP.
6. **Concrete.** Building on bare rock starts the structure at 50 % HP (linear in the share of
   footprint tiles without concrete). The original has no sell command; C&C added it.
7. **Tech tree** is gated by mission number (1–9) plus prerequisites and factory upgrades
   (Construction Yard ×2, Barracks, WOR, Light Factory, Heavy Factory ×3, Hi-Tech).
   House of IX unlocks Sonic Tank / Devastator / Deviator / Ornithopter.
8. **House rosters differ:** Atreides — Barracks infantry, Trike, Sonic Tank, Ornithopter,
   Fremen. Harkonnen — WOR Troopers, no Trike, Devastator, no Ornithopter, Death Hand.
   Ordos — both infantry kinds, Raider Trike, Deviator, no Launcher (Starport only), Saboteur.
9. **Sandworms** travel only on sand, prefer wheeled vehicles, then tracked/Harvesters, then
   infantry; each worm eats exactly 3 units and then leaves. Rock is safe.
10. **Fog.** Explored terrain stays revealed; enemy units are only visible inside current sight.
    Radar (minimap) needs an Outpost and non-negative power.
11. **Campaign:** 9 missions per house chosen on a territory map of Arrakis; Mentats Cyril
    (Atreides), Radnor (Harkonnen), Ammon (Ordos); mission 1 is "harvest 1000 credits"; the
    final mission pits the player against the Emperor's Sardaukar and the rival houses;
    12 ranks from Sand Flea to Emperor.
12. **Sega Genesis port:** gamepad cursor with pop-up menus, one shared announcer, about five
    music tracks (Klepacki, re-arranged for YM2612 FM), bigger and more colourful sprites with
    vivid house colours, passwords instead of saves, single Palace; House of IX and the
    Light/Heavy Factory split are reportedly simplified (unconfirmed).
13. **C&C 1995 interface:** right-hand sidebar with radar, credits, power bar, two build strips
    (structures / units) with clock-wipe progress; left-click is context-sensitive (select,
    move, attack, harvest, deploy); right-click cancels then deselects; right-click on a build
    icon holds, a second right-click cancels with full refund; drag-box select; Ctrl+number
    groups; H/Home, S, G, X hotkeys.
14. **Copyright:** EA owns the Dune II and C&C assets; nothing from the original files may be
    shipped. Loading files the player already owns (PAK archives with 8-bit VOC samples) is
    the standard, low-risk pattern used by OpenDUNE and Dune Legacy.

## Known gaps

Fandom, Spriters Resource, Sega Retro, MobyGames and GameFAQs were behind bot walls, so there
are no full sprite sheets; the Mentat info cards plus the small in-game icons in their corners
are the visual reference. Genesis-specific numbers (build speed, IX removal, merged factory)
remain single-source and are flagged `(?)` in the raw files.
