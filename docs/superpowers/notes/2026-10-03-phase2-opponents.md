# Phase 2 — opponents stream (up to three AI opponents, skirmish set-up)

Branch `phase2/opponents`, from `improve/visibility` (5719049). Spec §5.8, §4.10, §4.11.

## Plan (each step with its proof) — all done

1. Houses that can hold a skirmish base, sub-house rosters, tech level notes — `tests/opponents.test.mjs`.
2. `setupSkirmish({ opponents, techLevel, worms })`, URL codec — `tests/opponents.test.mjs`.
3. Free-for-all AI targeting — `tests/ai-ffa.test.mjs` (written failing first).
4. Victory, end statistics per house, `houseDefeated` names the house — `tests/victory.test.mjs`, `tests/end-screen.test.mjs`.
5. Radar colours — `tests/radar-model.test.mjs`.
6. Set-up screen and scene — `tests/menu.test.mjs` (cleaning, migration, URL round trip into a real world).
7. Timed 4-house AI game, 20 game minutes on a 128 map — `tests/soak-ffa.test.mjs`.
8. Real-GPU look: set-up screen (desktop and phone), a four-house battle with its radar, the end screen, a launch from the menu.

## Decisions

**Which houses can play (research: mechanics-campaign.md §9.3, §10.2; units.md, structures.md `availableHouse`).**
The original engine has six houses. The Sardaukar and the Mercenaries are full houses there: a Palace weapon
each (Sardaukar Death Hand, Mercenary Saboteur), toughness, and the shared buildings — both infantry buildings,
the Trike, the shared vehicles and aircraft, none of the House of IX specials. So either can hold a computer
base, which is what lets four houses play with no house twice.
The Fremen cannot: the Atreides Palace calls Fremen warriors drawn in the Fremen colour whoever owns them, and in
the original the Fremen house owns the sandworms (and is allied to the Atreides). Rule, enforced in
`cleanSetup`, the set-up screen and `setupSkirmish`:
- the player picks a Great House (Atreides, Harkonnen, Ordos);
- each opponent is Random, a Great House, the Sardaukar or the Mercenaries (`SKIRMISH_HOUSES`), and no house
  plays twice (the screen greys out houses already in the battle; a clash in a stored set-up or URL becomes
  Random, or the first free house in the simulation);
- Random rolls a free Great House first, then a sub-house.
Sub-house rosters live in `houses.js` (`SUB_HOUSE_UNITS`) and reach every roster check through `offered()` in
`tech.js`, so `structures.js`/`units.js` stay untouched. Mercenary colour: PC palette slot 224 was never sampled
(visual-units.md §3, "(?)"); gold `0xe1c814`, as remakes reading that slot show them. Their models use the
self-made ramp in `materials.js` (no `HOUSE_RAMP` entry — see integration notes).

**Free-for-all, and the original's alliances.** In the original (OpenDUNE `House_AreAllied`), every computer
house is allied with every other against the player, and the Fremen with the Atreides. The original has no
skirmish, though, and this phase's brief asks for a free-for-all, so a skirmish is every house for itself.
"Computers allied, as in the Dune II campaign" would be a natural option later; it needs an alliance test in
`combat.js` (auto-targeting, retaliation), `fog.js` and victory, most of which other streams own — open question
for the manager.

**Map sizes.** Corners give four starts. Small (48) holds three bases (two opponents); Medium and up hold four
(`maxOpponents`). The screen hides "Add opponent" at the cap; a stored set-up or URL is trimmed.

**Tech level** 1–9 (default 9) goes to every house. The screen says what the chosen level adds for the player's
house, from the data (`techOpens`): e.g. level 5 "Hi-Tech Factory, Repair Facility, Gun Turret, Missile Tank".
Level 1 has no factory at all: the opening forces fight it out.

**Worms** off/few/many (default few) → `world.rules.worms` (contract 1). The base showcase scene defaults to off.

**AI targeting** (`ai.js`). Every wave sizes up every house still in the game (`sizeUpRivals`: nearest building
or, failing that, ground unit; armed units and turrets valued at cost) and picks a foe:
`cost = distance × (0.5 + their force / (their force + the wave's))`, halved for a house that raided the base in
the last two minutes, × 0.8 for the current foe (no flip-flopping). Wave members that stop hunt the foe's nearest
building first; a beaten foe is dropped. Units the AI sends at an intruder no longer leave in a wave launched the
same second (a bug that showed with grudges). Rally points and turrets face the nearest rival. The AI still sees
through the shroud.

**Victory.** A house with no buildings and no MCV is out, and `houseDefeated` carries
`{ house, name, text }` ("House Ordos has been defeated.", "The Mercenaries have been defeated."). The battle
ends when at most one house stands (none: a draw), or when the human player is out while computers fight on —
"Mission failed", not a draw, and the end screen says who fights on; "Keep watching" lets them. A world of
computers only (`aiPlayer`) runs to the last house standing. The end screen has a column per house, the
player's first, with the winner and the time each house fell.

**Radar.** Each skirmish house has a radar pair (buildings, units), measured ≥ 90 apart (RGB distance) from
every other house and ≥ 60 from the ground under it. The Sardaukar move from the world purple to a brighter one
on the radar so they stay off the Atreides blue.

**URL.** `?scene=skirmish&house=harkonnen&opponents=ordos:hard,mercenary:easy&tech=6&worms=many&size=96&seed=42`.
Old `enemy=` and `ai=` still work; `focus=rival` or `focus=1..3` looks at an opponent's corner.

## Measurements

Node, 4 computer houses, 20 game minutes (24,000 steps), machine shared with four other streams (load ≈ 30):

| map | houses | mean step | wall time | notes |
|---|---|---|---|---|
| 128 | 4 | 1.4–2.4 ms | 33–57 s | 2-house baseline on 128: 0.9 ms; spikes > 30 ms appear in both (shared machine) |
| 64 | 4 | 1.7 ms | 40 s | no stuck units, invariants hold, everyone fights everyone |
| 48 | 3 | 0.3 ms (15 min) | 5 s | one house beaten at 6.5 min |

Computer-vs-computer kills in the 64 run: Harkonnen → Sardaukar 91, Sardaukar → Harkonnen 49, Ordos ↔ Atreides
66/59 and so on. The test asserts a mean below 6 ms.

## How to test

- `npm test` (new: `opponents`, `ai-ffa`, `soak-ffa` (≈ 40 s), more in `victory`, `menu`, `radar-model`, `end-screen`).
- Menu → Skirmish → Add opponent ×2, pick houses → Start battle.
- `?scene=skirmish&seed=5&house=atreides&opponents=harkonnen:normal,sardaukar:normal,mercenary:normal&visibility=revealed&ticks=4800&deploy=1&radar=1&focus=3`
  — four bases after four minutes, the radar online, looking at the Mercenaries.

## Open questions

- Should "Computers allied" (the original's rule) be offered as a set-up option? Needs combat/fog changes.
- Mercenary colour is a guess for an unsampled palette slot.
