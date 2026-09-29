# Plan 1b execution notes (base building and economy)

Branch `feat/plan1b-base-economy`, 17 tasks plus one review fix pass, merged into master.

Verification: npm test 215/215 · npm run smoke 27 scenes, no errors · npm run e2e 14/14 (builds, places
and sells a Wind Trap with real mouse input) · fresh whole-branch review (Opus): 1 Critical and
3 Important fixed, one Minor re-graded to Important and fixed; the harvest soak test now guards the
economy loop (four generated maps, ten game minutes each).

## Rulings made during execution

- Task 1: Ruling: maxHeight tracked the float64 h while data is Float32Array — track the stored float32 value — test 'maxHeight is the highest vertex' needs exact equality — cost if wrong: none
- Task 1: Ruling: FpsMeter timed the loop's capped dt (≤0.1 s) and stayed blank on slow software GL — it now times real frame intervals and shows 'measuring…' first — spec §10 wants honest fps — cost if wrong: none
- Task 1: Ruling: GameView passed dt capped at 0.1 s to FixedLoop, so at ~2 fps (headless software GL) the sim ran 5-10x slow and e2e 'moves the tank' timed out — the loop now gets the raw interval (FixedLoop caps stalls at 0.25 s / 5 ticks itself); camera/HUD keep the 0.1 s cap — cost if wrong: weak devices catch up up to 5 ticks per frame, as FixedLoop was designed to
- Task 3: Ruling: test 'placement must touch the house's own base' used (7,7) for diagonal contact with a yard at (4,4) — that leaves a one-tile gap; diagonal contact is (6,6). Test now checks (6,6) ok and (7,7) notAdjacent — cost if wrong: none
- Task 5: Ruling: three production tests built units with no Wind Trap, so the spec'd power deficit (ratio 0 → 25 % speed) slowed them 4x — tests now add a Wind Trap where they expect full speed; the low-power case keeps none — cost if wrong: none
- Task 7: Ruling: test 'a manual move suspends harvesting…' waited for state === 'harvesting', which is still true (stale) while suspended, so runUntil returned 0 — the test now waits for the load to grow; the stale state is handled in the selection panel (Task 15 shows the order, not the routine state, when the order is not 'harvest') — cost if wrong: none
- Task 7: Ruling: giveUp() on a nudge move left a harvester idle forever (resumeOrder only restored on arrive) — the harvester brain now restores a saved harvest routine when it finds the unit idle; test 'a harvester whose nudge move failed picks its routine up again' RED→GREEN — cost if wrong: none
- Task 9: Ruling: the structures gallery placed models at y = 0 while rock terrain stands ~0.35 high, burying slabs, pads and tank bodies — models now stand on hf.heightAt(centre) like StructureViews — cost if wrong: none
- Task 10: Ruling: plan-1a test 'structure views sit on the footprint centre…' used v.handle and instant removal; Task 10 moved views to handles[] with a 0.7 s sink-away — test updated to handles[0] and removal after the sink — cost if wrong: none
- Task 11: Ruling: part geometry lives in node space (pivot applied by the instancer), so icons drawn with one root matrix showed legs, turrets and barrels detached — added nodeLocal()/nodeMatricesAtRest() to instancer.js (update() now shares nodeLocal) and icons/modelBounds use the rest pose; test 'bounds and icons use every node's rest pose' RED→GREEN. The placement ghost (Task 12) needs the same — cost if wrong: none
- Task 12: Ruling: the placement ghost built meshes without node transforms (same defect as icons) — it now applies nodeMatricesAtRest; added a turret-ghost assertion to tests/placement-ghost.test.mjs (RED before, GREEN after) — cost if wrong: none
- Task 13: Ruling: slab icons showed the grey placeholder box — added concreteSlab(1|2) models (structures/concrete.js) mapped for concrete/concrete4; catalog test now lists them (RED→GREEN) — cost if wrong: none
- Task 15: Ruling: the panel showed the paused harvest routine ('Harvesting') for a harvester sent elsewhere — it now shows the order text unless the order is 'harvest'; test 'a harvester sent elsewhere shows its order…' RED→GREEN — cost if wrong: none
- Task 16: Ruling: e2e waited 30 s for a Wind Trap (21.6 s build); headless software GL runs ~1.7 fps and the loop catches up at most 0.25 s per frame, so the build takes ~50 s real time — READY wait raised to 120 s — cost if wrong: slower e2e only
- Task 16: Ruling: a full smoke run crashed after writing all 27 screenshots because cdp close() removed the Chrome profile 300 ms after kill while Chrome still wrote to it (ENOTEMPTY) — close() now waits for the exit and rm retries — cost if wrong: none (tooling)
- Task 16: Ruling: the base showcase placed everything on bare rock (50 % HP by the concrete rule), so wind traps gave half power and the showcase sat in low power with the radar off — the scene now repairs its own structures before running — cost if wrong: none (showcase only)
- Task 16: Ruling: the apron beyond the map edge ignored the shroud (constant 0.62), framing a black unexplored map in bright sand — terrainShroud now samples the clamped edge tile for the apron too; test 'the apron beyond the map edge follows the shroud…' RED→GREEN — cost if wrong: none
- Final: Ruling: plan conflict Focus 2 (exact refunds) vs Focus 5 (never more than storage) — resolved for the storage invariant; refunds are exact whenever there is room — cost if wrong: a player cancelling at full storage loses the overflow (warned)
- Final: Ruling: declined-to-judge items (enemy structures 'as last seen' when destroyed unseen, carryall delivery, turrets/half rate, spilled spice, voice EVA, Esc menu/P pause, sell reverse-construction animation, e2e attack flow, pathfinding perf, plan-1a minor #14) — all belong to plans 1c/2/3 as the reviewer noted; visual fidelity was reviewed from screenshots; real-GPU fps needs the manager's laptop — cost if wrong: none now

## Review fixes

- Critical dock livelock (fallback dock moved when a harvester stood on it; parked units/idle harvesters blocked the pad) — tests 'a refinery whose pad tile is covered by a silo…', 'a mountain on the pad tile…', 'a tank parked on the dock…', 'when the field runs dry…' RED→GREEN, suite 215/215
- Important head-on dance (pre-existing plan-1a movement, now on the harvest path) — tests 'two units meeting head-on in open ground…', '…in a two-lane pass…' and tests/soak.test.mjs (tight layout, 4 seeds, 10 min) RED→GREEN, suite 215/215; throwaway sweep 120/120 swaps resolve
- Important fog leak through structure picking/overlay/panel — tests 'structures the player has not seen cannot be hovered or selected', 'an enemy structure shows only its name and hit points' RED→GREEN, suite 215/215
- Important refunds above storage — cancel/revalidate/sell refunds go through addCredits (overflow lost with the storage warning); test 'a cancel refund never lifts credits above storage…', 'selling at full storage warns…' RED→GREEN, suite 215/215
- minor re-graded Important: READY structure stranded when the yard is lost (credits locked) — test 'a READY structure is refunded when the Construction Yard is lost' RED→GREEN, suite 215/215
- cosmetic two-statements-on-one-line in game-view.js (formatting only, no behaviour)

## Deferred minors (carried into plan 1c)

- placement ghost turns every cell red on any failure (can't see which cell is blocked)
- start-buffer storage revoked lazily — selling a silo leaves different credits depending on timing
- loaded harvesters are not slower (spec §4.3)
- 'Wind Trap implied for all' prerequisites not enforced (spec §4.5)
- build tooltip lists no prerequisites (spec §5.6)
- context loss auto-reloads on restore, no reload button if it never returns (spec §9)
- first 3-4 frames of a skirmish show the map unshrouded (fog computed on the first tick)
- stats.spiceHarvested counts spice lost to full storage
- radar.resize() reads clientWidth every frame (forced layout)
- orderPlace does not check integer coordinates (hardening for AI/network commands)
- plan-1a #14 (units on mirrored diagonal steps can pass through each other) — still open
- headless Chrome renders at ~1.7 fps (software GL); real-GPU frame rate of `?scene=stress&fps=1` and
  `?scene=base&fps=1` still needs a check on the target laptop
