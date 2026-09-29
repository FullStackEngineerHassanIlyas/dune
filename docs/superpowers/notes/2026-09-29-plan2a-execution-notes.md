# Plan 2a execution notes (factory upgrades, Repair Facility, capture)

Branch `feat/plan2a-upgrades-repair-capture`, 10 tasks, one fix found by the smoke screenshots and one
review fix pass, merged into master.

What landed:
- Factory upgrades: bought from the structure strip and paid and timed like a build on the improved
  factory's own line. They gate the Quad, the squads, the MCV, the Missile and Siege Tanks, the Large
  Concrete Slab and the Rocket Turret. The computer buys them too.
- The Repair Facility: model, bay, welding sparks, mouse orders and panel details. The computer builds
  one and sends worn vehicles to it.
- Infantry capture of badly damaged enemy buildings. A docked harvester or the vehicle in the bay changes
  hands with the building.

Verification:
- npm test 342/342.
- npm run smoke: 32 scenes, among them the new `base-repair` (a tank on the pad under the hoist), with
  upgrade icons in `icons-*`.
- npm run e2e 23/23, including "clicking the Heavy Factory upgrade icon upgrades it", "a damaged tank
  clicked onto the Repair Facility goes in and comes out repaired" and "infantry clicked onto a ruined
  enemy silo capture it".
- Fresh whole-branch review (Opus): verdict "with fixes". No Critical findings; 2 Important fixed, and 1
  Minor re-graded to Important and fixed. The reviewer also soaked 36 AI-versus-AI games with 362 bay
  cycles.

## Rulings made during execution

- Task 4: Ruling: test 'only damaged vehicles of the owner go in' passed before the implementation (an unknown command also leaves orders idle) — added a damaged own tank to the same order as a positive control, so the test proves the filter — cost if wrong: none, one extra assertion.
- Task 5: Ruling: weld test expected sparks gone after one update(0.4), but pools show every particle for at least one frame (plan 1c fix) — the test updates once more before asserting — cost if wrong: none.
- Task 5: Ruling: the wider gallery (21 tiles) cut the Repair Facility and the Yard at the frame edges — default gallery distance 13 → 15.5 so every structure is in the shot — cost if wrong: smaller models in the gallery screenshots.
- Task 8: Ruling: test 'a building still too strong…' checked the order before the command had been applied (runUntil tests before stepping, so 'idle' already passed as 'not capture') — the test steps once first — cost if wrong: none.
- Task 10: Ruling: the base-repair smoke shot showed the bay empty — its south entrance was an open tile boxed in by neighbouring buildings, so the tank's path failed and it gave up. Vehicles now go to the nearest free, reachable tile beside the facility (entrance preferred) and leave the way they came in (tests 'with the entrance walled in…' RED→GREEN; 'a unit parked on the entrance…' now asserts only that others still get in, since no nudge is needed) — cost if wrong: a vehicle may enter from the side, sliding across the building's edge.
- Task 10: Ruling: AI test 'the AI builds a repair facility…' went red after that change — the tank now reaches the bay later in the crowded base and the AI had spent every credit, so the repair paused; the test keeps the AI's credits topped up while it waits (it tests the repair, not the wallet) — cost if wrong: an AI that is always broke repairs slowly (true of production too).
- Task 10: Ruling: the base scene's demo tank was spawned by findFreeTile into a one-tile pocket between buildings (the packed layout leaves them), so it could never move — it now starts on a free tile right beside the Repair Facility — cost if wrong: none (showcase only).
- Final: Ruling: an upgrade clicked behind a held current unit waits behind it — upgrades go ahead of the queue, not of the item in hand; the player can cancel the held item — cost if wrong: a click more.
- Final: Ruling: attack-move onto a capturable building sends infantry to capture — a context order, same as a plain click; other units attack — cost if wrong: infantry walk in instead of shooting.
- Final: Ruling: vehicles entering from the sides slide across the building edge — accepted in the Task 10 ruling; the south entrance is preferred — cost if wrong: a visual oddity.
- Final: Ruling: a broke AI's stalled bay holds up the vehicles behind it — the same pause rule as production — cost if wrong: slower AI repairs when broke.
- Final: Ruling: factory spawns can still pick a pocket tile via exitTile — pre-existing (plan 1b), out of this plan's scope; the bay now avoids it — cost if wrong: a rare stuck new unit, as before.
- Final: Ruling: a Construction Yard level-2 upgrade in progress is cancelled (refunded) when the last Wind Trap goes — its extra prerequisite is the Rocket Turret's (original rule), refunds are full — cost if wrong: the player re-buys it.
- Final: Ruling: an upgrade put in front of a full unit queue makes it ten long — upgrades are special-cased by design — cost if wrong: none.
- Final: Ruling: capture's besideTile has no reachability filter — infantry cross rough ground and walls block only 1 tile; the reviewer found no failing case; give-up after 8 tries covers it — cost if wrong: a squad gives up on a walled-in target.
- Final: Ruling: a harvester in the bay keeps its field claim — the same as any suspended harvester (plan 1b) — cost if wrong: another harvester skips that field for half a minute.
- Final: Ruling: smoke and e2e were not run by the reviewer — they ran here: 32 scenes; e2e 23/23 before and after the fixes — cost if wrong: none.

## Review fixes

- Final: fixed a repaired vehicle driving out into a closed pocket (exit now only onto ground connected to its way in) — 'a repaired vehicle never drives out into a closed pocket' RED→GREEN, suite 342/342
- Final: fixed a harvester losing its routine when the repair trip ends early, when pushed out of a sold bay, or when nudged while driving out — 'a harvester sent for repairs goes back to harvesting however the trip ends' and 'a vehicle driving out of the bay is not nudged off its way' RED→GREEN, suite 342/342
- Final: fixed (re-graded Minor → Important: a player can paralyse the AI's base defence by parking a vehicle in a captured bay) the AI taking a vehicle in a repair bay for an intruder — 'the AI does not take a vehicle in a repair bay for an intruder' RED→GREEN, suite 342/342; e2e 23/23 after the fixes

## Deferred minors (carried into plan 2b)

- Final: minor (deferred): shells already in flight can still hit a vehicle just after it drives into the bay (combat.js impact)
- Final: minor (deferred): the AI's defence can re-task a worn vehicle it just sent for repairs in the same think (ai.js sendForRepairs/defend)
- Final: minor (deferred): a released vehicle idles on the tile it left by; with only one way in, the next vehicle gives up after 12 s (no rally point can be set on the facility from the UI)
- Final: minor (deferred): a captured outlying building vanishes from its former owner's view until they see it again (fog seenBy bit not set on transfer)
- Final: minor (deferred): a crowded base can make a vehicle wander for tens of seconds before it finds a free side of the bay (seen in the AI test trace)
