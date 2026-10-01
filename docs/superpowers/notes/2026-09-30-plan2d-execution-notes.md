# Plan 2d execution notes (House specials, Palace weapons)

Branch `feat/plan2d-specials-palace`, 11 task commits on top of master `53fd841`
(`88627d9`..`21e1d93`), merged into master without its final review (PR #1, `b1182f3`). The plan is
`docs/superpowers/plans/2026-09-30-plan2d-specials-palace.md`.

**Status: done.** The final whole-branch review and its fix pass ran afterwards on branch
`improve/review-2d` (from master `ca856c0`); see "Review" below. The steps that were still open are
listed under "What remains".

The branch also carries `feat/menu-controls`, merged in at `413a11e`. That work came from the Dune-ux
worktree: the main menu with skirmish set-up and options, C&C-style cursors, and edge scrolling. It
was verified at `64b1089` with unit 475/475, e2e 29/29 and `npm run e2e:menu` all passing. Merging
this branch into master brings that work in as well.

What landed:
- **The Sonic Tank.** Its wave travels up to 8 tiles and hurts everything on its path, friends
  included. Only Sonic Tanks and walls are spared.
- **The Deviator.** Its gas turns enemy ground units to the firer's side for 40 s. Harvesters, MCVs
  and aircraft are immune.
- **The Devastator.** Destruct is ordered with the D key or the panel button. A red light flashes for
  3 s, then eight blasts go off.
- **The Palace.** It charges its house weapon, and a sidebar weapon button shows the charge clock.
  - Harkonnen: the Death Hand falls near the chosen spot as 17 blasts.
  - Atreides: 5 Fremen squads rise from the sand and hunt on their own.
  - Ordos: the Saboteur walks over walls and blows up the building it reaches.
- **Models, effects and sounds.** New models for the Palace, the Saboteur, the Fremen and the Death
  Hand missile, plus the Destruct lights. New effects are the sonic ripple, the gas clouds and the
  missile in flight. New sounds are the sonic hum, the gas hiss and the alarm.
- **The computer** builds a Palace, fires it when charged and fields its house special.
- **Plan 2c's minors are closed.**
  - A tooltip refreshes while hovered.
  - A batch whose Starport is lost lands at another Starport of the house.
  - A right-click after landing says the Frigate is unloading.
  - The stale 'frigate' entry is gone from `DEFERRED`.

Verification at `21e1d93`:
- `npm test`: 456/456.
- `npm run smoke`: 38/38 scenes, among them `base-palace` and `battle-specials`.
- `E2E_PORT=8479 npm run e2e`: 29/29.
  - Earlier runs failed 2–5 timing checks. At those times the Dune-ux worktree's e2e and smoke runs
    were loading the machine to 25–30.
  - A different port keeps the two servers apart.
- Diagnostic 25-minute AI-versus-AI runs covered 3 pairings. Every AI built Starport → IX → Palace
  (at ~15–20 min), fired its Palace weapon and fielded specials.

## Review

A fresh whole-branch review (Opus) of `git diff 53fd841..21e1d93` against the plan and spec §4.6,
§4.7, §4.10, §5.3, §5.4, §5.6 and §6, plus the later master merges that touch 2d code (the menu
battle's showcase director, the BattleStage refactor, the Genesis model rebuild). It ran on branch
`improve/review-2d` from master `ca856c0`.
- **No Critical issues.** Nothing throws, the simulation stays deterministic (no `Math.random` or
  `Date` in `src/sim`), and the plan's five review-focus points hold.
- **2 Important findings, both fixed:** the computer fired its Death Hand into its own army and base,
  and Deploy with an MCV selected blew up the Devastators beside it.
- **8 Minors fixed** (they were cheap; one is a spec gap, "Missile launched"), **6 deferred** to
  plan 2e.
- Findings were confirmed with probes before fixing: a scripted game, a live skirmish in headless
  Chrome, and a chaos soak.
  - The chaos soak ran 5 seeds × 300 s with three houses. Random orders every half second
    (Destruct, Sabotage, Palace at random spots, repair, attack) produced ~50–90 deviations and ~12
    Palace shots per seed. Invariants were checked every second: 0 exceptions and 0 problems, before
    and after the fixes.

Verification on `improve/review-2d`:
- `npm test`: 542/542 (533 before the review, and 9 new tests).
- Smoke scenes `base-palace` and `battle-specials`: pass. The full `npm run smoke` and `npm run e2e`
  are the lead's to run after merging (the machine is shared).
- Live skirmish in headless Chrome (`seed=11`, Atreides against a Harkonnen computer). The computer
  had its Palace charged, 4 of its tanks in the player's base, and a column of 3 player Siege Tanks
  in the open.
  - It fired the Death Hand at the column, 29 tiles from its nearest tank, well out of the blast's
    reach.
  - The column's Siege Tanks lost 165–253 of their 300 hit points each.
- In the browser, a click on the charging Death Hand button shows "The Death Hand is not ready." in
  the message bar.

## What remains

1. The review, its fix pass and these notes are done (above). Plan 2d itself was merged into master
   with PR #1. `improve/review-2d` goes in with the other improvement branches, and the lead runs the
   full smoke and e2e checks after that merge.
2. **Manager checks still open since plan 1b/1d.** A headless machine cannot do these:
   - the fps number at `http://localhost:8080/?scene=base&fps=1` on a real GPU;
   - listening to the sound at `http://localhost:8080/?scene=battle` (one click turns it on).

After that comes plan 2e, per the spec: sandworms, the full AI, FM music and the announcer.

## Rulings made during execution

- Task 2: Ruling: tests/tech.test.mjs "plan-2 items stay hidden" built its world with a House of IX, so the un-deferred Sonic Tank now shows — renamed it "…the House of IX specials included", added 'sonicTank' to the Atreides heavy list and moved the "needs a House of IX" check to a world without one — the plan only changed the message; the spec wants the special once IX stands — cost if wrong: one test line.
- Task 3: Ruling: the tech roster test (world with a House of IX) now also lists 'deviator' for the Ordos — same reason as the Task 2 ruling — cost if wrong: one test line.
- Task 7: Ruling: the views test block re-imported runUntil (already imported mid-file) — dropped the duplicate import line — plan defect, no behaviour change — cost if wrong: none.
- Task 7: Ruling: added smoke scene 'gallery-infantry' (close-up of the Saboteur and Fremen figures) to scripts/scenarios.mjs — the plan's look-check scenes do not frame the new figures — cost if wrong: one extra screenshot per smoke run.
- Task 11: Ruling: the plan's e2e block declared `spot`, already declared earlier in the same scope (SyntaxError) — renamed it `call` — plan defect — cost if wrong: none.
- Task 11: Ruling: the e2e tooltip check waited for the Frigate countdown to move, which depends on how fast a loaded headless Chrome runs the game — it now right-clicks the ware (cancel) while hovering and expects the tooltip to drop "Frigate in"; the stale tooltip bug would still fail it — cost if wrong: none (stricter and deterministic).
- Task 11: Ruling: e2e base-page clicks raced the sidebar strip's 0.15 s slide and camera moves (a probe showed a left click on the Quad's reported rect buying a Combat Tank under load) — the e2e now emulates prefers-reduced-motion (a new CSS media rule drops the sidebar slide/fill transitions, also an accessibility gain) and waits for screen positions to settle before clicking — cost if wrong: reduced-motion users see strips jump instead of slide.
- Task 11: Ruling: showTip now refreshes every frame while hovered, so it writes the tooltip text/position only when they change (no per-frame DOM churn) — cost if wrong: none.
- Final: Ruling: the plan 2d test 'D on a Devastator means Destruct; an MCV still deploys' pinned one command doing both — rewritten as 'D (or Deploy) with an MCV selected deploys it and spares the Devastators; on Devastators alone it means Destruct' — the panel's Deploy button sends the same command, and a button labelled Deploy must not blow anything up — cost if wrong: a player who wants both presses Destruct as well.
- Final: Ruling: the computer's Death Hand passes over any spot within its reach (2 scatter + 2.2 pattern + 1 falloff ≈ 5.2 tiles) of an own unit or building, rather than weighing own losses against enemy value — simple and safe; with no clear spot it keeps the charge and asks again in 10 s — cost if wrong: a computer whose army is everywhere fires later.
- Final: Ruling: "Missile launched" goes to every house, not only the launcher — spec §6 lists the line, the research found no separate "approaching" clip, and the player needs the warning most when the computer fires — cost if wrong: one extra message line for the player.
- Final: Ruling: the Saboteur's death blast is credited to its own house, so a tank killed by crushing one counts for the Saboteur's side — its charge did the killing (plan ruling, aftermath.js) — cost if wrong: a kill in the stats.
- Final: Ruling: sabotage and capture orders accept a building by id without a fog check — the interface only offers buildings the player sees, and the AI sees all — cost if wrong: a scripted client could send a Saboteur at a building it has not found.

## Review fixes

- Final: fixed (Important) the computer firing its Death Hand at the richest enemy spot regardless of its own units — it hit its own attack wave, and enemy raiders at its own Palace's door drew the missile onto its base — spots within the missile's reach of anything of its own are passed over — 'the Death Hand spares the computer's own: it goes for a spot clear of its army and its base' RED→GREEN, suite 534/534
- Final: fixed (Important) Deploy with an MCV and Devastators selected (D, or the panel's Deploy button) deploying the MCV and starting every Devastator's Destruct — a selection with an MCV only deploys; D without one still means Destruct — 'D (or Deploy) with an MCV selected deploys it and spares the Devastators…' RED→GREEN (the plan 2d test rewritten, see rulings), suite 535/535
- Final: fixed (Minor) a Devastator counting down being nudged off its tile by a friend driving past (the plan's "keeps its tile") — it no longer takes nudges — 'a Devastator counting down keeps its tile: friends cannot nudge it aside' RED→GREEN, suite 535/535
- Final: fixed (Minor) only as many Fremen squads rising as there were free sand tiles within reach (one tile meant one squad) — sand first, then open ground nearby makes up the five — 'with little sand near the spot, the rest of the five squads rise from open ground' RED→GREEN
- Final: fixed (Minor) a Deviator shot by a turret driving in and gassing it for ever (retaliation skipped the "no gas on buildings or the immune" check of attack orders) — 'a Deviator shot by a turret does not answer with gas it cannot use' RED→GREEN, suite 537/537
- Final: fixed (Minor) the panel showing D on both Deploy and Destruct for a mixed selection — Destruct shows no key when an MCV is selected — 'with an MCV in the selection D means Deploy: the Destruct button shows no key' RED→GREEN, suite 538/538
- Final: fixed (Minor) the computer's Saboteur always going for the most expensive building, so an enemy Palace (1000 hit points against a 500 blast) drew every Saboteur and survived — the most valuable building the blast brings down comes first — 'the computer's Saboteur goes for the most valuable building its blast can bring down' RED→GREEN, suite 539/539
- Final: fixed (Minor) a click on the charging Palace weapon doing nothing (the Palace refused an unaimed request before looking at the charge) — the click now asks and the Palace answers "The Death Hand is not ready." — 'asked before any aim (the sidebar button while it charges), a charging weapon says it is not ready' RED→GREEN, suite 540/540; checked in the browser
- Final: fixed (Minor, spec gap) no "Missile launched" line when a Death Hand goes up (spec §6 announcer list) — eva 'missileLaunched' to every house — 'a Death Hand launch is announced to every house…' RED→GREEN, suite 541/541
- Final: fixed (Minor) the sonic wave bending near the map's edge (its end was clamped one axis at a time, so a target up and to the left of a tank on the west edge was missed) and fading over the shortened length — it stops where its own line leaves the map and fades over its full 8 tiles — 'by the map edge the wave still runs straight at its target, only shorter' RED→GREEN, suite 542/542

## Deferred minors (carried into plan 2e)

- Final: minor (deferred): the Palace's Saboteur cannot appear on a wall tile beside the Palace although it walks over walls (exitTile skips structure tiles); a Palace ringed by walls refuses the launch, which the test 'a Palace that cannot fire is not asked again every second' relies on
- Final: minor (deferred): a computer Saboteur whose target cannot be reached gives up after 8 tries and is sent again the next second, for ever (harmless churn, one 'moveFailed' per round)
- Final: minor (deferred): the sonic ripple and the rocket, gas and Death Hand trails emit particles every rendered frame, so their density follows the frame rate (effects workstream)
- Final: minor (deferred): while aiming the Palace weapon, a click on the radar moves the camera instead of aiming there
- Final: minor (deferred): a unit deviated away from the player stays in the player's selection and control groups (orders skip it; it comes back on revert)
- Final: minor (deferred): the Death Hand's 17 blasts each raise a large explosion, sound and scorch mark in the same tick (voice limits and particle budgets cap the cost; one merged effect would look and sound cleaner)
