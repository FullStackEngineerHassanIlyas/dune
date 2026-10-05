# Talking Mentat: the hook-up (phase3/mentat-talk) — WORK IN PROGRESS

The build agent (workflow run wf_4641467b-363, "build:mentat-talk") stopped at 10:06 PKT on 2026-10-05 mid-work.
Its uncommitted changes were committed as they were (WIP) so the work can carry on elsewhere. Not reviewed.

Branch: phase3/mentat-talk = phase3/mentat-voice (incl. voice fix 329cdf2) + phase3/mentat-face-art 8bdfae9.

## What is done (in the WIP commit)
- stage.js: mentatStage attaches the face (attachMentatFace(stage, rigFor(house), { warm: true })) when it has a
  voice; stage.face; faceOptions for tests.
- index.js: quiet() destroys the face; the screen keeps this.face = stage.face.
- mentat-face.js: warm() builds the face and decodes the rig's pictures before the first line; look() reads the
  voice `motion.lead` (0.04 s) ahead; the first frame of a line catches up the time the voice has already run.
- mentat-face-rig.js: rigFiles(rig); mouthEase 0.05, sharpen 3, lead 0.04.
- mentat-face-rigs.js: stronger brows for all three Mentats.
- mentat-face-svg.js: headImageOf(art); willReadFrequently canvas for the patches.
- tests: mentat-face-fakes.mjs (shared fakes, moved out of mentat-face.test.mjs), mentat-talk.test.mjs (new).

## Known broken — fix first
- `tests/mentat-talk.test.mjs`, test "Options → Mentat voice Off" (line 131): the process grows to ~14 GB and the
  kernel OOM-kills it (seen 2026-10-05 12:30). Do NOT run the full suite until this is fixed (it can hang the PC).
  Run the file alone with a memory cap: `node --max-old-space-size=2048 --test tests/mentat-talk.test.mjs`.
- Likely cause: stage.js attaches the face whenever `voice` is set; it does not check `voice.enabled`, so the
  "Off" stage gets a face (the test expects stage.face === null). Fix the hook, then find the runaway loop.
- The first three tests of the file pass; the last four (Off, reduced motion, setting read, no-Mentat house) have
  not been seen passing. tests/mentat-face.test.mjs passes.

## Still to do (from the brief in the workflow script)
1. Honour Options "Mentat voice: Off" (still portrait, no mouth) and reduced motion in the hook.
2. Real GPU, real audio: all three houses, several missions (briefing, advice, a win, a lose, the ending): frame
   series during speech, sync measured (mouth openness vs the audio envelope, viseme changes vs word starts),
   no console errors, steady 60 fps. At least three look-and-fix iterations (popping, seams, expressions).
3. Full suite green under the lock. This file: add "## For the README".
4. Report-only review, then fixes.
5. Merge into phase3/integration: stage.js conflicts with the original-figure hook there (a793ac3 / 4602786) —
   keep it: `figure ? originalMentatRig : rigFor(house)`. Then every suite and a GPU check with the real PAKs.
