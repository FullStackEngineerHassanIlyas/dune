# Plan 2b execution notes (air power: Hi-Tech Factory, Carryall, Ornithopter, anti-air)

Branch `feat/plan2b-air` was merged into master. It held 10 tasks and one review fix pass.

What landed:
- **Hi-Tech Factory.** Its upgrade goes on sale only once it opens something: the Ornithopter needs the
  House of IX, which comes in plan 2c.
- **Carryall.**
  - It flies each new Refinery's Harvester in from the map edge.
  - It ferries Harvesters on trips of 16 tiles or more.
  - It flies damaged vehicles to a distant Repair Facility.
  - Its load dies with it.
- **Ornithopter.**
  - Left to itself, it hunts.
  - A move order makes it guard the spot it is sent to.
  - It makes attack passes, turning out and coming round at close targets.
- **Anti-air.** Troopers, Missile Tanks and both turrets can shoot at aircraft. Their shots home in;
  loose rockets hit half the time, and the misses burst in the air.
- **The computer** builds a Hi-Tech Factory, keeps exactly one Carryall and will fly Ornithopters once
  the House of IX exists.
- **Plan 2a's minors** are closed.

Verification:
- `npm test`: 378/378.
- `npm run smoke`: 34 scenes, including `battle-air` (three Ornithopters over the battle) and `base-air`
  (a Carryall bringing a Harvester in).
- `npm run e2e`: 26/26. New checks: a paused drag box picks up the Ornithopters, and Ornithopters sent at
  a tank strafe it.
- Fresh whole-branch review (Opus), verdict "with fixes":
  - 1 Critical and 2 Important findings, all fixed;
  - 1 Minor re-graded to Important and fixed;
  - the reviewer ran 18 AI-versus-AI games of 25 minutes with Carryall ferries; invariants held.

## Rulings made during execution

- Task 3: Ruling: the plan's impact 'alt' test `victim && !victim.isGround` would treat every structure hit as an aerial hit (structures have no isGround) — the check is `victim.kind === 'unit' && !victim.isGround` — cost if wrong: none.
- Task 5: Ruling: test 'an idle Carryall ferries a harvester…' asserted harvesting later than the set-down tick, but the harvester (later in the unit loop) starts harvesting in the same tick it is set down — `>= 0` — cost if wrong: none.
- Task 5: Ruling: test 'a Carryall sets down only on a free tile' gave the tank a move order with no path, which ends at once and cancelled the pickup (a changed order) — the tank stays idle as ordered when the ferry is called — cost if wrong: none.
- Task 6: Ruling: the galleries cut the new models at the frame edge — the Hi-Tech Factory moves to 18,5 on a 22-wide gallery seen from 17 tiles, the flying row starts at x 5 — cost if wrong: none (showcase framing).
- Task 9: Ruling: plan 2a's test 'a damaged tank drives into the bay…' expected the released tank idle; with no rally point it now drives clear of the doorway (this task's change), so it expects a move order — cost if wrong: none.
- Task 10: Ruling: in the battle scene the Harkonnen anti-air (Troopers, Missile Tank, Rocket Turret) shoots every 25-HP Ornithopter down within ~8 s, so the planned shot at tick 150 showed none and the e2e strafe check would be a coin toss — the showcase shoots at tick 80 and the e2e page adds aa=0 (a new scene flag: Harkonnen without anti-air) — cost if wrong: the e2e does not cover strafing under fire (unit tests cover anti-air).
- Task 10: Ruling: the e2e drag box (tiles 0,0–9,7) caught 2 of 3 Ornithopters — their guard loops swing up to ~4 tiles east of the post — the box reaches x 13 (still clear of the ground army at y ≥ 9) — cost if wrong: none.
- Task 10: Ruling: a tile-based box still missed the northernmost Ornithopter (drawn 1.6 tiles up, above the box) — the box is drawn around the aircraft's own screen positions with a wide margin, as the ground drag check already does — cost if wrong: none.
- Task 10: Ruling: even a box drawn round the aircraft missed one — they fly ~2 tiles between reading their positions and releasing the drag at headless frame rates — the check pauses the game (P) for the drag and resumes after — cost if wrong: none.
- Final: Ruling: Carryalls fly straight over enemy anti-air — the spec is silent and the original does the same — cost if wrong: more Carryall losses.
- Final: Ruling: the AI's defence ignores intruders in the air; only anti-air already in range answers — AI tuning for plan 2d — cost if wrong: Ornithopter raids meet little response.
- Final: Ruling: the set-down search does not check the tile is connected to the destination — no stranded unit in ~1,400 soak set-downs — cost if wrong: a rare stranded unit.
- Final: Ruling: a Carryall with no free tile within 4 of its drop point retries every tick — no stall seen in soaks — cost if wrong: a hovering Carryall.
- Final: Ruling: trikes/tanks stuck on refinery docks in a few soaks are the pre-existing factory-exit pocket issue (plan 2a ruling) — cost if wrong: as before.
- Final: Ruling: delivered Harvesters wait in seek when no spice lies within 32 tiles — the existing search radius — cost if wrong: an idle Harvester on a spice-poor map.
- Final: Ruling: Ornithopter attack orders keep chasing targets out of sight — the same as ground units — cost if wrong: none new.
- Final: Ruling: Stop keeps an Ornithopter's current target — the same as ground units — cost if wrong: one more pass.
- Final: Ruling: Carryall banking wobbles while hovering over a moving unit — cosmetic — cost if wrong: a visual jitter.
- Final: Ruling: smoke and e2e were not run by the reviewer — run here: 34 scenes; e2e 26/26 before and after the fixes — cost if wrong: none.

## Review fixes

- Final: fixed (Critical) an Ornithopter circling a target inside its turning circle for ever without firing — 'a target inside its turning circle is still hit…' and 'it works through a pack of targets…' RED→GREEN, suite 378/378
- Final: fixed an anti-air shot landing on the ground below when its aircraft died first — 'a shot at an aircraft that is gone before it lands bursts in the air' RED→GREEN, suite 378/378
- Final: fixed a pending Carryall pickup ignoring a new order of the same kind (overriding the player's harvest order, lifting a harvester mid-unload) — 'a new order drops a pending pickup, even one of the same kind' RED→GREEN, suite 378/378
- Final: fixed (re-graded Minor → Important: a skirmish player could pay 250 for an upgrade whose tooltip promises Ornithopters and gets nothing) the Hi-Tech upgrade on sale while its unlock needs the deferred House of IX — upgrades are on sale only when they open something — 'the Hi-Tech upgrade waits until it opens something…' RED→GREEN, suite 378/378; e2e 26/26 after the fixes

## Deferred minors (carried into plan 2c)

- Final: minor (deferred): AI Ornithopters end an attack-move on guard and are never re-tasked by the wave logic (matters once plan 2c makes them buildable)
- Final: minor (deferred): with only units that cannot shoot upwards selected, the cursor over an enemy aircraft shows "attack" but the click does nothing
- Final: minor (deferred): a homing Rocket Turret rocket keeps following a unit lifted by a Carryall and lands below it
