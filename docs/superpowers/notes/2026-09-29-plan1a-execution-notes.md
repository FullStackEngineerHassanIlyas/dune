# Plan 1a — execution notes

Plan: docs/superpowers/plans/2026-09-28-plan1a-engine-core.md · executed inline (executing-plans) · merged to master 2026-09-29.

Verification: npm test 108/108 · npm run smoke 16 scenes, no errors · npm run e2e 7/7 · fresh whole-branch review (Opus): 1 Critical + 5 Important fixed, 4 minors raised to Important and fixed.

## Rulings

- Setup: Ruling: work in place on branch feat/plan1a-engine-core instead of a separate worktree — manager asked not to be stopped with questions and wants files visible in /home/hassan/games/Dune; master stays clean until a local merge — cost if wrong: none (branch merges locally).
- Task 9: Ruling: edge-height test tolerance 1e-9 → 1e-6 — heightAt clamps to vw-1.0001, leaking ~3e-8 of the neighbouring vertex at the far edge; visually zero — cost if wrong: none
- Task 9: Ruling: apron changed from a full plane at y=-0.015 (showed through sand dips) to a ring of four quads around the map at y=0; terrain colours converted from sRGB-authored to linear (pow 2.2) and mountain strata toned down — plan step 7 allows colour tuning; the ring is the smallest geometry fix — cost if wrong: none
- Task 9: Ruling: relief tuned for readability — ROCK_HEIGHT 0.34→0.42, mountain blend smooth(0.12,0.6) and height 0.5+2.3·ridged, rock mottling from fbm — small mountain clusters were barely visible; plan step 7 allows tuning — cost if wrong: taller mountains can hide units behind them (camera can rotate)
- Task 12: Ruling: visual tuning after gallery review — rock cracks masked to sparse patches and thinned (were contour-like lines everywhere), detail texture panel grid replaced by soft grime streaks (tiled visibly on every face), sand paint darkened (washed out) — plan step 9 asks to fix proportions/colours — cost if wrong: none (art values)
- Task 15: Ruling: art pass after first skirmish screenshots — default camera distance 24→16 (units were ~35 px), infantry figures ×1.35, rock grain moved from procedural value noise (read as camouflage) to a generated tileable rock detail texture (src/render/terrain-textures.js) sampled twice to hide repeats, spice slightly desaturated — readability of units and terrain is a spec success criterion — cost if wrong: art values only
- Final: Ruling: pathfind test "budget exhaustion" maxNodes 50→10 — the stronger heuristic reaches a 39-step diagonal within 50 expansions, so 50 no longer exercises exhaustion — cost if wrong: none
- Final: Ruling: retargeted goals break distance ties toward the unit's side (movement test expected the near side of an enclosed ring) — cost if wrong: none
- Final: Ruling: production/combat/economy/fog/radar/AI/sound absent — phase scope (plans 1b–3) — cost if wrong: none
- Final: Ruling: attack cursor over enemies without an attack — combat arrives in 1b; the cursor already shows intent — cost if wrong: brief confusion until 1b
- Final: Ruling: infantry ~0.3 tiles/s — spec §4.1 formula, original game is slow too — cost if wrong: tune in tuning.js
- Final: Ruling: mountains ~3.3 high, rock 0.42 vs spec "about 2.5/0.35" — Task 9 relief ruling for readability — cost if wrong: art values
- Final: Ruling: sun elevation ~52° — art direction — cost if wrong: none
- Final: Ruling: bloom mounds generated but not drawn — blooms are phase-2 gameplay — cost if wrong: none
- Final: Ruling: decal map and shroud textures built but unused — used by 1b effects and fog — cost if wrong: none
- Final: Ruling: Esc/P/Space/A/Ctrl-click/Alt-click not wired — outside the 1a selection/move subset; 1b/2 — cost if wrong: none
- Final: Ruling: selecting structures and edge-scroll cursors not wired — 1b sidebar/structure work — cost if wrong: none
- Final: Ruling: saveSettings never called — Options menu is plan 2 — cost if wrong: none
- Final: Ruling: float determinism across browsers — single player, no lockstep/replays — cost if wrong: none now
- Final: Ruling: window.__dune exposes the live world — deliberate test hook, read-only helpers — cost if wrong: players could cheat from devtools in a single-player game
- Final: Ruling: Ctrl+digit may be taken by the browser — README documents Ctrl+Shift+digit — cost if wrong: players must learn the alternative
- Final: Ruling: google-chrome hard-coded in scripts/cdp.mjs — dev tooling on this machine — cost if wrong: env var needed elsewhere
- Final: Ruling: model fidelity to the reference art — reviewed by eye in Task 12 against the Mentat cards — cost if wrong: art polish later
- Final: Ruling: nudging overwrites a parked unit's order and emits arrived — harmless until guard stances/acknowledgement voices exist (plan 2) — cost if wrong: revisit then
- Final: Ruling: draw-call headroom for 1b structures — measure in 1b stress scene — cost if wrong: instancing already bounds it
- Finish: Ruling: merged feat/plan1a-engine-core into master locally (fast-forward) without presenting the menu — the manager explicitly chose 'continue through plans 1b/2/3 without asking' and approved local commits; nothing pushed, fully reversible — cost if wrong: none

## Review fixes

- fixed #1 group moves abandoned (one failed crowd replan ended the order; stuck clock never reset on progress) — tests "thirty tanks on open sand…", "twenty tanks squeeze through a two-tile gap…", "group orders on generated maps…", "head-on tanks in a corridor settle within five seconds…" RED→GREEN, suite 102/102
- fixed #2 path budget stalls (40k expansions/tick ≈ 50 ms) — budget 6000/tick + 10000 cap per search, heuristic at sand/rock cost, reachability areas retarget unreachable goals — tests "unreachable goals are retargeted…", "a big group order never spends much more than the per-tick search budget" RED→GREEN, suite 102/102
- fixed #3 group slots spread through walls/mountains — test "group destinations stay on the group's side of a ridge and off mountains" RED→GREEN, suite 102/102
- fixed #9 turrets keep their spawn direction — test "turrets swing back in line with the hull" RED→GREEN, suite 102/102
- fixed #4 no camera reset (spec §5.5 Home resets view; plan mapped Home to centre only) — test "Home resets the view and centres on the base; H only centres" RED→GREEN, suite 108/108
- fixed #5 structures float/sink off-plateau — test "flattening under a structure updates the terrain geometry in place" RED→GREEN (skirmish flattens on structurePlaced), suite 108/108
- fixed #6 dev server exposed .git and private refs on the LAN — test "server refuses dot-folders and the private reference images, and binds to localhost by default" RED→GREEN, suite 108/108
- fixed #10 game fails to start when site data is blocked — test "settings survive a browser that blocks site storage" RED→GREEN, suite 108/108
- fixed #12 quick double-click on the selected MCV selected all MCVs instead of deploying — test "a quick second click on the selected MCV deploys it…" RED→GREEN, suite 108/108
- fixed #13 vehicles tilted up to 82° beside cliffs — test "vehicles never tilt more than 25 degrees, even beside cliffs" RED→GREEN (test first corrected to probe the tank's own row, it had passed vacuously), suite 108/108

## Deferred minors (carried into plan 1b)

- #7 PCFSoftShadowMap is deprecated in r186 (three warns, falls back to PCF) — switch in plan 1b renderer work
- #8 cursor shows no-move over mountains/structures while a click still moves the group to the nearest spot
- #11 held hotkeys auto-repeat (scatter re-issued; digit repeat triggers centring)
- #14 two units on mirrored diagonal steps can pass through each other (rare)
- #15 terrain uses the quality preset's vertex density on every map size (spec wants 3 per tile above 64)
- #16 WebGL context loss shows a message but does not pause or restore
- #17 an exception inside a frame stops the loop without an error screen
- #18 spec items not yet built: colour grading + vignette, debug-mode invariant checks, ?fps=1 overlay and stress scene — schedule in plan 1b
- #19 test gaps: controller click beyond the map edge; picking max terrain height 3.5 vs generated peaks ~3.3
