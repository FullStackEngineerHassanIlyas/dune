# Plan 2d execution notes (House specials, Palace weapons) — status and what remains

Branch `feat/plan2d-specials-palace`. It holds 11 task commits on top of master `53fd841`
(`88627d9`..`21e1d93`). The plan is
`docs/superpowers/plans/2026-09-30-plan2d-specials-palace.md`.

**Status: all 11 tasks are done and committed. The final whole-branch review, its fix pass and the
merge into master have not been done.** The manager paused the work at this point and asked for the
remaining steps to be written down. Those steps are listed below under "What remains".

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

## What remains (in order)

1. **Final whole-branch review.**
   - Regenerate the review package: `git diff 53fd841..21e1d93` (~256 KB). The copy under the
     git-ignored `.superpowers/sdd/2026-09-30-plan2d-specials-palace/` is not in the repo.
   - Hand it to a fresh Opus reviewer together with the plan and spec §4.6, §4.7, §4.10, §5.3, §5.4,
     §5.6 and §6.
   - The review can be split across 3 Opus reviewers running in parallel:
     - sim: `src/sim/specials.js`, `src/sim/palace.js`, walls and the Saboteur's movement;
     - AI: `src/sim/ai.js`;
     - UI, render, fx and audio.
   - Estimate: ~15–20 min with one reviewer, ~8–10 min with three.
2. **Fix pass.** Each Critical or Important finding gets a failing test first (RED), then the fix
   (GREEN). Record each one below as "Review fixes", in the format of the plan 2c notes. Minors are
   either fixed or carried into plan 2e as "Deferred minors". Estimate: ~15–25 min.
3. **Re-verify** on the fixed branch.
   - Run `npm test`, `npm run smoke` and `E2E_PORT=8479 npm run e2e`.
   - Do not run e2e while another worktree's Chrome runs are going. Under load the timing checks
     flake.
4. **Finish these notes.** Add the review outcome, the fixes and the verification numbers.
5. **Merge into master** as a fast-forward, if master has not moved. Then push master.
6. **Manager checks still open since plan 1b/1d.** A headless machine cannot do these:
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

## Review fixes

None yet: the review has not run.

## Deferred minors (carried into plan 2e)

None yet: to be filled in from the review.
