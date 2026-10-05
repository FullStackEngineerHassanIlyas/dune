# Phase 3: what is left (hand-off, 2026-10-05)

State: phase3/integration (PR #24) has everything except the talking Mentat's hook-up. npm test on it: 1516 pass, 0 fail,
1 skipped. The hook-up is WIP on phase3/mentat-talk (d874596, pushed, not merged). No agent is running.

## Remaining
1. Talking Mentat hook-up — branch phase3/mentat-talk (worktree .claude/worktrees/wf_4641467b-363-5, or
   `git switch phase3/mentat-talk` anywhere). Done/left/broken: docs/superpowers/notes/2026-10-05-mentat-talk.md on
   that branch. First fix: tests/mentat-talk.test.mjs "Options → Mentat voice Off" runs away to ~14 GB and is
   OOM-killed (stage.js attaches a face even when the voice is Off). Do not run the full suite with it until fixed.
   Proof: that file passes alone, then the full suite.
2. Real-GPU check with the real audio for all three houses (briefing, advice, win, lose, ending): lips in sync,
   60 fps, no console errors, 3 look-and-fix rounds. Proof: frame series + sync measurement in the notes.
3. Report-only review of phase3/mentat-talk, then fixes. Proof: each finding's evidence passes.
4. Merge phase3/mentat-talk into phase3/integration. stage.js conflicts: keep the original-figure hook
   (`figure ? originalMentatRig : rigFor(house)`). Proof: npm test, e2e, e2e:menu, e2e:intro, e2e:campaign, smoke all
   pass; on the GPU with the real PAKs (original/dune2) the original Mentat's mouth moves with the voice.
5. Push to PR #24, notify the manager. Merge order on GitHub (manager's call): #23, then #24.
- Older open items (2026-10-04 08:0x: worm bankrupts the Harkonnen AI in Atreides mission 3; victory fanfare restarts
  on results) look fixed by 0eb2e78 / 99b7b90 / 24bcb7b — confirm in play.
