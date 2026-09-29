# Plan 1c execution notes (combat and the computer opponent)

Branch `feat/plan1c-combat-ai`, 13 tasks plus one review fix pass, merged into master.

Verification: npm test 268/268 (including a fifteen-minute AI-versus-AI soak and the plan-1b harvest
soak) · npm run smoke 31 scenes, no errors · npm run e2e 18/18 (real mouse: build/place/sell a Wind
Trap, attack an enemy tank, pause) · fresh whole-branch review (Opus): 1 Critical and 3 Important fixed,
one Minor re-graded to Important and fixed.

AI-versus-AI games (Normal, seeds 3/7/11) run the full fifteen minutes: both sides build 20+ structures,
harvest 21–27k credits, send four waves and trade 25–40 units; defended bases hold. Against an
undefended base the Hard AI's first wave (3.5 min) wins in under five minutes.

## Rulings made during execution

- Task 3: Ruling: the crush test's 'corridor' only walled rows 7 and 9, so the tank drove round via row 10 — the wall now closes every row but 8 for x 4–8 — cost if wrong: none
- Task 4: Ruling: three orders-combat tests asserted too early or under fog — the attack test now steps once before expecting idle, the unreachable test steps once so the order applies before waiting for idle, and the guard test switches fog off (a guard engages only what its side sees; sight 4 < guard radius 7) — cost if wrong: none
- Task 4: Ruling: a guard scanned for targets around itself, so each time the leash dropped a fleeing target it re-acquired it a few tiles further on and ran off (x 23 vs leash 15) — guards now scan around their post; test 'a guard chases intruders no further than its leash…' RED→GREEN — cost if wrong: none
- Task 8: Ruling: scenes that simulate ahead (?ticks=) handed GameView every explosion at once, drawing one giant cloud on the first frame — the first frame now draws scorch marks and flattening but no particles for the backlog — cost if wrong: none
- Task 11: Ruling: setupSkirmish now gives the rival a brain, so the plan-1b harvest soak (a logistics test) lost its harvesters to AI attacks — the soak switches the rival's brain off — cost if wrong: none (combat is covered by the AI-vs-AI soak in Task 12)
- Task 11: Ruling: the skirmish-ai-base screenshot looked at the player's corner — skirmish.js gains focus=rival (camera on the computer's start) for that scenario — cost if wrong: none
- Task 12: Ruling: the e2e battle check waited 30 s while the tanks start 26 tiles apart and headless GL simulates ~0.4 s per second — the battle page runs at gameSpeed=fastest and waits up to 120 s — cost if wrong: slower e2e only
- Task 12: Ruling: in the battle e2e our tank sat at screen x=4, where edge scrolling moved the camera between mouse-move and click — the check now centres the camera on each unit before clicking it — cost if wrong: none
- Final: Ruling: declined-to-judge items (sound/dust, plan-2 specials, phase-2 AI extras like concrete on Hard and repair retreats, ranks, harvester non-crushing, balance numbers, stance design for snipers and chases, force-fire persistence, accurate shots vs moving targets, turrets ignoring fog, commands queued while paused, storage-limited AI refunds, particles ignoring scene fog, nudged units after failed nudges, attack cursor for unarmed selections, large explosion for walls, unarmed units in mixed attack selections) all stand as plan design or later phases — cost if wrong: small, revisitable in plans 1d/2

## Review fixes

- Critical walls keep a house alive and stop AI waves — tests 'walls alone do not keep a house in the game', 'an AI wave breaks through a wall ring to reach the buildings inside' RED→GREEN, suite 268/268
- Important attack-move/guard re-acquiring unreachable targets forever (sticky give-up, 90 s) — tests 'attack-move past an unreachable enemy still arrives', 'a guard does not keep chasing an enemy it cannot reach' RED→GREEN; soak stuck detector tightened (position-based, 90 s), suite 268/268
- Important units driving on to a dead target's tile — test 'an attack whose target died elsewhere stops the chase' RED→GREEN, suite 268/268
- Important destroyed stores burning credits held by the starting allowance — test 'a destroyed store does not burn credits the starting allowance is holding' RED→GREEN, suite 268/268
- minor re-graded Important: below ~25 fps tracers and muzzle flashes were culled before their first draw — test 'short-lived flashes are drawn at least once even at low frame rates' RED→GREEN, suite 268/268
- cosmetic two-statements-on-one-line in game-view.js (formatting only)

## Deferred minors (carried into plan 1d)

- the AI builds silos without limit (hoards credits once the army cap is reached)
- the AI never replaces a lost Construction Yard (no MCV in its roster)
- a draw announces "Mission failed." to both sides while the end screen says Draw
- end-screen figures are read 2.5 s after the end (use the outcome tick)
- defeat is checked once a second, so near-simultaneous last losses can become a draw
- other message-bar text replaces the "Paused" notice
- particle buffers upload every frame even when empty; trail density depends on frame rate
- unused retaliation flag; ignoreFog not applied to structures before this pass (now applied)
