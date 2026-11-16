# Four-house AI closeout — 16 November 2026

## Verdict: no accepted gameplay change

Five target-choice-only variants were measured. None meets both required gates: all houses survive 12 minutes in at least 10/12 default seeds, and at least the baseline number of 40 games finish in 20–40 minutes. Per the delegated stop condition, shipping `src/sim/ai.js` and `tests/ai-ffa.test.mjs` were restored byte-for-byte to `141d9c5`. No wave sizes, timers, costs, health, alliances, missions or other worktrees changed. No push, merge or PR was made.

The useful deliverables are the deterministic harness (commit `e5e8846`), measured receipts, and replayable experimental patches. **Do not treat the patches as accepted fixes.** Claude owns the requested trade-off decision. Variant 2 is the closest natural alternative, but it still fails the survival gate; the recommendation is not to merge a gameplay change under the current acceptance criteria.

## Frozen measurement design

`scripts/measure-ai.mjs` runs real `setupSkirmish`/`world.step` at 20 Hz, in separate bounded child processes. The 40 cases were fixed before tuning:

- 12 default four-house normal games: 64×64, seeds 1–12.
- 27 cells: sizes 64/96/128 × 2/3/4 houses × easy/normal/hard, seeds 13–39 in that loop order.
- One 32×32, two-house easy game, seed 40.

Every skirmish house is computer-controlled, including Atreides. Other defaults remain unchanged (3000 credits, technology 9, shroud, worms off, computers not allied). The 12 default games are included in the 40, not an extra denominator. Runs stop at victory or 60 game-minutes. A censored run has `endSeconds: null`; it is known to exceed 40 minutes, not an invented 60-minute win. Elimination times come from `house.defeatedAt`, independently of game end. The survival gate examines the earliest elimination, **not** end time.

The historical audit's harness, exact matrix and six short-case seeds were not saved. Therefore its 30/40 figure cannot be used as this experiment's baseline, nor can its unidentified six cases be individually diagnosed. This is a reproducible new before/after matrix, not a claim to reproduce the old one.

## Measured trade-offs

| Rule | Default first elimination ≥12m | <20m | 20–40m | Completed >40m | Censored at 60m |
|---|---:|---:|---:|---:|---:|
| Baseline | 0/12 | 4 | 24 | 5 | 7 |
| V1: prefer an uncontested front | 5/12 | 3 | 26 | 4 | 7 |
| V2: V1 + answer an incoming rival first | 9/12 | 2 | 24 | 5 | 9 |
| V3: V2 + nearest enemy for the opening | 9/12 | 2 | 21 | 11 | 6 |
| V4: V2 + nearest enemy for every wave | 9/12 | 2 | 18 | 14 | 6 |
| V5: V2 + nearby military threat for the opening | 8/12 | 2 | 20 | 11 | 7 |

V1 considers a front contested when another independent house has a living, still-owned wave assigned there. If every front is contested, original scoring remains available. V2 prioritizes a house whose living wave is assigned to our base; otherwise V1 applies. Both keep the original distance/army/grudge/last-foe score within the candidate set. V3 replaces that score with distance only for `brain.waves === 0`; V4 does so for every wave. V5's opening uses `distance / (rivalArmy + 1)`, then restores original scoring. Existing grudge and last-foe multipliers remain. All variants are gated to non-campaign, unallied games initially containing four houses; two/three-house games keep their original path.

Long hard games were not separately tuned. Their observed results are included in the receipts; changed four-house targeting can change their outcomes. No claim is made that unidentified historical hard-case timelines stayed identical.

### Earliest elimination by default seed, game-minutes

| Seed | Baseline | V1 | V2 | V3 | V4 | V5 |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 7.129 | 20.408 | 20.408 | 20.408 | 20.408 | 22.383 |
| 2 | 7.271 | 7.442 | 21.167 | 23.329 | 23.329 | 23.329 |
| 3 | 7.713 | 22.596 | 22.596 | 26.604 | 26.604 | 26.604 |
| 4 | 7.550 | 7.796 | 7.796 | 9.046 | 9.046 | 9.046 |
| 5 | 7.617 | 24.721 | 24.721 | 22.642 | 22.642 | 22.642 |
| 6 | 7.708 | 7.808 | 17.917 | 17.917 | 17.917 | 17.917 |
| 7 | 7.708 | 19.554 | 19.554 | 19.554 | 19.554 | 11.408 |
| 8 | 7.450 | 23.262 | 23.262 | 23.262 | 31.604 | 23.137 |
| 9 | 7.821 | 11.883 | 11.883 | 11.883 | 11.883 | 11.883 |
| 10 | 10.667 | 11.004 | 21.950 | 21.950 | 21.950 | 36.383 |
| 11 | 7.929 | 8.287 | 15.904 | 15.904 | 15.904 | 15.904 |
| 12 | 7.775 | 11.983 | 11.983 | 11.983 | 11.983 | 11.983 |

Do not round seed 12's 11.983 minutes into a 12-minute pass. In V2, seed 4 still loses Atreides at 7.796 minutes even though first-wave targets are split into A↔O and H↔S; removing shared opening targets is not sufficient to meet the numerical survival gate. That game's end is also censored at 60 minutes. This does not prove a pathfinding stall or establish which individual units delivered each hit.

### The four short cases in this baseline

| Case | End | Opening evidence / disposition |
|---|---:|---|
| `default-2`, 64, four-house normal, seed 2 | 18.683m | Atreides and Harkonnen both select Sardaukar at 300.55s; Sardaukar eliminated at 7.271m. V2 splits the opening; first elimination becomes 21.167m and end 35.308m. |
| `default-7`, 64, four-house normal, seed 7 | 19.204m | Atreides and Harkonnen both select Ordos at 300.55s; Ordos eliminated at 7.708m. V2 first elimination 19.554m, end 32.917m. |
| `matrix-64-2-hard`, seed 15 | 17.763m | Two-house duel: third-party pile-on is impossible. Preserved exactly rather than retuned to lengthen it. |
| `small-2-easy`, 32, seed 40 | 19.171m | Two-house duel: third-party pile-on is impossible. Preserved exactly. |

The first two support the pile-on diagnosis; no separate small defect was established in the other two. Recorded targets are not a complete per-hit causality trace. The original audit's other unidentified cases remain unverified.

## Regression and guard evidence

- A small four-house fixture reproduced two independent opening waves choosing the same exposed Ordos base: `assert.notEqual` failed on the baseline. V1 fixes that fixture. A second fixture showed a house ignoring an incoming Sardaukar wave for a weaker Ordos bystander: it failed on V1 and passes on V2. The replayable V2 patch includes both tests.
- V2 focused run: 11/11 tests. Full V2 run: **1685 pass, 1 skip, 0 fail** (1686 total, 44.95s), including `soak-ai.test.mjs` (15-minute AI-vs-AI movement/stuck guard) and `soak-ffa.test.mjs` (20-minute 128-map combat/invariants/performance guard).
- V1, V2 and V5 each independently match the baseline for **7/7 guard fixtures and all 135 minute-checkpoints**, plus final hashes, ends, winners and elimination maps. Fixtures: two-house seeds 1/7/13; Atreides mission 3, Harkonnen mission 6, Ordos mission 9; four-house allied-computers seed 7. Guards run for 30 minutes or until outcome. Hashes are SHA-256 of the exact snapshot fields used by `tests/mission-setup.test.mjs:13-18` (not every internal field).
- All five matrices preserve every two/three-house final state hash; raw minute-checkpoints were compared too. Every matrix has zero recorded invariant failures (sampled every five game-minutes).
- Restored shipping AI plus committed harness: final `npm test -- --test-concurrency=4` gives **1683 pass, 1 skip, 0 fail** (1684 total, 26.63s). The baseline AI SHA-256 is again `7971b8bd1cacbfefeb85040a4efdf1f3fecc54f591c3f5d8177cbe53f7d117a5`.

These do not prove absence of every stuck unit in all 240 matrix runs. `moveFailed` is an event count, not a sustained-stall detector. The named soak guards passed on V2; browser play, visual/audio QA, and human-controlled four-house play were not performed. No campaign tuning or unit-stat fix was attempted.

## Portable receipts and replay

The adjacent [`ai-closeout-2026-11-16/`](ai-closeout-2026-11-16/) folder contains:

- `baseline.json`, `variant1.json` … `variant5.json`: settings, every house's elimination time, actual end/winner, final state hash, first waves, last-wave time, movement-failure count and invariant results for all 40 games. Top-level metadata identifies tested AI SHA, Git revision and full raw JSONL checksum.
- `baseline-guards.json`, `variant1-guards.json`, `variant2-guards.json`, `variant5-guards.json`: portable guard hashes/checkpoints.
- `variant1.patch` … `variant5.patch`: experimental AI diffs against the base, not active code. `variant2-with-tests.patch` additionally carries the two regressions. Apply only one alternative at a time to a clean base, and only after choosing it.

Baseline used revision `141d9c5`; later runs used `e5e8846` plus the stated uncommitted experimental AI diff. Therefore Git HEAD alone is not the tested code identity: use `aiSha256` and the matching patch. The harness was unchanged across comparisons. Full raw waves/checkpoints/logs remain at `/tmp/dune-closeout/reports/*-matrix.jsonl`, `*-guards.jsonl`, `*-focused.log`, the RED logs, `variant2-full-tests.log`, and `final-tests.log`; `/tmp` is temporary, while the portable receipts are tracked here.

From this worktree, with no other game processes running:

```sh
nice -n 10 node scripts/measure-ai.mjs --suite=matrix --jobs=8 --minutes=60 > baseline.jsonl
# Optional: only after selecting V2; this changes the review worktree.
/usr/bin/git -C /home/purelogics-3621/games/dune/.claude/worktrees/ai-closeout apply docs/research/ai-closeout-2026-11-16/variant2-with-tests.patch
node --test tests/ai-ffa.test.mjs tests/ai-measure.test.mjs
nice -n 10 node scripts/measure-ai.mjs --suite=matrix --jobs=6 --minutes=60 > after.jsonl
nice -n 10 node scripts/measure-ai.mjs --suite=guards --jobs=2 --minutes=30 > guards.jsonl
nice -n 10 npm test -- --test-concurrency=4
```

The matrix and guards may share the eight-worker allowance as 6+2; do not run an additional suite concurrently at that limit. No thresholds were relaxed and no seed was removed after seeing results. The gameplay fix is **not complete**; this report is the requested stop-and-choose handoff.
