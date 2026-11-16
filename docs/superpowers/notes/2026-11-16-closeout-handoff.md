# Closeout, November 2026: where it stopped (hand-off, 2026-11-16)

State: branch `closeout/2026-11` is master `141d9c5` (the engine audit, PR #26) plus the commits below. Work
stopped here at the manager's request on 2026-11-16, about 16:45 UTC. Nothing on this branch is half-done, and
Claude has no agent running. The one piece of work still open, three-house games, is not on this branch (item 1
under "Left").

## Done on this branch

| What the player or the code gets | Commit | Proof |
|---|---|---|
| The mission 3 worm test also checks Atreides mission 3, the mission it used to skip | `7100088` | 10 seeds × 30 game-minutes: on the old code the Harkonnen went without a Harvester for up to 27 minutes in 6 seeds; on the new code for 15 s at most, while it built 12–24 units and made 4–5 attacks. Missions 1–3 of all three houses pass. |
| The original Mentat's picture is enlarged in a Worker | `75d3f09` | With the CPU slowed 4× and 6×, the picture never holds the page for more than 50 ms (before: 207–383 ms). Pixels match master. Without Workers it is drawn the old way. |
| The sun is in the north-west, where the Genesis sprites are lit from | `1c4055d` | Cast shadows fall south-east, towards the camera, so they show. The menu planet and the intro are unchanged. |
| `createEnvironment()` disposes its sky sphere and material after the bake | `9173aba` | The audit finding (PR #26). |
| A seeded, headless harness that plays computer against computer in parallel processes | `5d0a3e8` | `scripts/measure-ai.mjs`, with its tests. |
| The measured AI trade-offs and their receipts | `64b93fa` | `docs/research/ai-closeout-2026-11-16.md`. |
| In a four-house skirmish a computer answers the house whose wave is coming at it, or else opens a front no other army is on (Variant 2) | `44a4113` | Four-house games that open with two waves on one house: 21/21 → 0/21. Default seeds with every house still in at 12 minutes: 0/12 → 9/12 (the gate was 10/12; why V2 was still chosen is in the research doc). Games ending in 20–40 minutes: 24/40 before and after; under 20 minutes: 4 → 2. Two- and three-house games, three campaign missions and the allied game keep identical state hashes. |

Tests on `44a4113`: `npm test` 1700 tests, 0 fail, 1 skipped; `e2e` 30/30; `e2e:menu`, `e2e:intro` and
`e2e:campaign` pass; `smoke` 77 screenshots with no errors. This note adds no code.

## Decided (the audit's open decisions, PR #26)

- **Shadows:** the sun moved to the north-west (above).
- **Graphics default stays Medium.** On this machine's GPU (Intel Iris Xe), in a 200-unit battle, Low gives 60 fps,
  Medium 51 (lowest 42.5) and High 29. The frame-rate check speaks only below 40 fps and offers one step down, so
  Medium stays clear of it and High would trip it in a new player's first big battle.
- **Pacing:** the four long games (large map, four houses, hard) stay as they are.
- **Early eliminations:** fixed in how a computer picks whom to attack, not by retuning numbers. Variant 2 ships
  for four-house games only.
- **Ear check:** closed on the measurement, since the manager did not answer: 123 Mentat lines at −19.8 to −19.5
  LUFS, all music at −18 LUFS, no clipping. For a listen later: `assets/voice/mentat/ordos/m4-briefing.ogg`,
  `m5-advice.ogg`, `ending.ogg`, and any Mentat saying "Sardaukar".

## Left

1. **Three-house games still open with both rivals' first waves on one base.** Variant 2 is gated to four
   houses. In the matrix, Atreides falls to both rivals' openings at 6.92 and 6.70 minutes in the hard 64- and
   128-tile three-house games. With a player who gives no orders, two opening waves reach the player in 7 of 12
   seeds, on normal and on hard. V2 cannot simply be widened: with three computers, a house that answers its
   attacker can join the wave a third house already sent to the same base.
   - Codex was working on it when the work stopped, on the local branch `fix/ai-closeout` (not pushed).
     `ae0c86c` adds a passive-player suite to `scripts/measure-ai.mjs` (not yet reviewed). A first three-house rule
     and its tests were uncommitted in `src/sim/ai.js` and `tests/ai-ffa.test.mjs`, under measurement.
     Codex's ledger and report go to `/tmp/dune-closeout/reports/ai-3house-progress.md` and `ai-3house.md`
     (local files).
   - Done means: none of the matrix's nine three-house games opens with two waves on one house; every
     passive-player seed (3 and 4 houses, 64 tiles, normal and hard, seeds 1–12) has at most one opening wave on
     the player; four-house games no worse than V2 (0/21 pile-ons, at least 9/12 default seeds with every house
     in at 12 minutes); at least 24/40 games in 20–40 minutes; two-house games, Atreides 3, Harkonnen 6, Ordos 9
     and the allied game keep identical hashes; the soak tests and `npm test` pass. If no rule meets all of it,
     leave three-house games on the old path and report the trade-off table.
   - It goes into this PR if the PR is still open, or into a new one.
2. **Audit leftovers not in this round:** the menu keeps about 0.4 MB after every battle, and the slowest tick
   on the largest four-house map is 18.8 ms.
3. **After merge:** remove the worktrees `agent-a88a0fdff024ae327`, `agent-ae0e06058c19a0874`, `m3-worm` and
   `mentat-talk` (their work is in master or on this branch), then `closeout-2026-11`; remove `ai-closeout` once
   item 1 is done.
