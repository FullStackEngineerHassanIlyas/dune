# Talking Mentat: the hook-up (phase3/mentat-talk)

The Mentat's face is hooked into every Mentat screen and has been checked on the real GPU with the real clips for all
three houses (below, "Real GPU check"): lips in sync, 60 fps while he speaks, no console messages, three look-and-fix
rounds (cfe750c, 728b759, 80ad881). The hook-up itself was the build agent's (workflow run wf_4641467b-363, stopped
mid-work and committed as WIP in d874596); b4356d8 fixed Options → Mentat voice Off. A report-only review of the
hook-up followed; its findings are fixed (5c09ea4 … 75f465a, below, "Review fixes").

Branch: phase3/mentat-talk = phase3/mentat-voice (incl. voice fix 329cdf2) + phase3/mentat-face-art 8bdfae9, with
phase3/integration merged in (21f8539: the original-figure hook in stage.js).

## What is done
- stage.js: mentatStage attaches the face (attachMentatFace(stage, figure ? originalMentatRig(house) : rigFor(house),
  { warm: true })) when its voice will speak (`voice.enabled`, b4356d8); stage.face; faceOptions for tests.
- index.js: quiet() destroys the face; the screen keeps this.face = stage.face.
- mentat-face.js: warm() builds the face and decodes the rig's pictures before the first line (once the head painting
  has loaded or failed; a picture that will not load is said once); look() reads the voice `motion.lead` (0.07 s since
  cfe750c) ahead; the first frame of a line catches up the time heard (not the look ahead), also for a line that starts
  while the face is awake; each face starts at its own place in its Mentat's seeded blinks (728b759); reduced motion
  switched while he is on screen is followed at once; nothing in the frame passes or returns a number (no allocation
  whatever the optimiser inlines).
- mentat-face-motion.js: springIn() and swayIn() (the frame's forms of springStep() and sway(): their numbers in
  typed arrays).
- mentat-face-rig.js: rigFiles(rig) (every part's sprite and bare patch); mouthEase 0.05, sharpen 3, lead 0.07.
- mentat-face-rigs.js: stronger brows for all three Mentats.
- mentat-face-svg.js: headImageOf(art); willReadFrequently canvas for the patches; setActive() hands the eyes over
  when only the blinks' owner changes.
- scripts/voices/mentat.py, assets/voice/mentat/{atreides,ordos}/ending.json: the last words' thanks are 'pleased' (80ad881).
- tests: mentat-face-fakes.mjs (shared fakes, moved out of mentat-face.test.mjs), mentat-talk.test.mjs (new: the stage,
  live reduced motion, and CampaignScreens through the real main menu), mentat-face-sync.test.mjs (the GPU rounds: lead,
  first frame, blinks per screen; a real MentatLine), mentat-lines.test.mjs (the ending's thanks).

## The runaway test (fixed)
The WIP's "Options → Mentat voice Off" test grew to about 14 GB until the kernel killed it. Two things together:
mentatStage gave a face to any voice, Off or not, so the test's `assert.equal(stage.face, null)` failed; and a failed
`assert.equal` in Node 22 prints both sides with `inspect` (depth 1000, getters on) and diffs the printed lines in
typed arrays outside the V8 heap, so `--max-old-space-size` does not bound it. A face printed that way is the whole fake
page again through every element's `ownerDocument` and `parentNode`: measured on 21f8539, a built face against null
reached 9.7 GB in 25 s, one element of it against null 2 GB in 1.2 s, even with a message given (Node 22 adds the diff
to it). Fixed by:
- b4356d8: the hook gives no face to a voice that will not speak (`voice.enabled`).
- 5c09ea4: every comparison of an element, a face or a frame callback in the face tests is an identity check
  (`assert.ok(a === b)`); the fakes' ways back up are not enumerable, so even a check written the old way prints an
  element's own subtree (the same element against null: 78 kB in 23 ms); the talk tests' stages leave the page after
  each test instead of piling up on one fake page.
Run tests under a cgroup cap, which does bound it: `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 npm test`.

## Review fixes
A report-only review (21f8539) found these; each fix makes a mutation of it fail a test.
- 5c09ea4: tests that could still run away (above).
- cc4a668: "the frame loop allocates nothing" failed 3-6 runs in 8 (on a4fca8c too). Not the measurement: each process
  grew either 2.5 kB per 10k frames or a steady 160-450 kB (16-45 bytes a frame), the allocation profile put it in
  update(), and `--trace-turbo-inlining` showed TurboFan's budget for update() running out at a different call in
  different runs; a spring step not inlined boxed the numbers it was passed. The frame now passes no number to a call
  (springIn, swayIn, the rates worked out once, the clamps in place): twelve fresh processes all 2.5-5 kB, 10 of 10 alone.
- a8573f7: the original figure's stage test checks the face's rig is the figure's (the merge's
  `figure ? originalMentatRig(house) : rigFor(house)`), and a figure without a rig has no face.
- 28960c2: a line that starts while the face is awake (Advice right after the briefing) catches up a late first frame
  too; the lead and the catch-up are tested on a real MentatLine.
- fc90329: reduced motion switched while he is on screen is followed at once (the map and the portrait's CSS already
  did): his mouth alone from then on, the portrait's own eyes back; all of him again when switched back.
- 38043b5: warm()'s wait for the head painting (load or error) is tested, and lets the other listener go.
- 1d28ee9: CampaignScreens' half of the hook-up (stage.face kept, ended by quiet() on a screen change, the voice let
  go) is tested through the real main menu.
- 4fba140: rigFiles() lists the corners' and the jaw's own sprites and bare patches too.
- 75f465a: warm() says which of the rig's pictures would not load, once per file.

## Still to do (from the brief in the workflow script)
1. Done (b4356d8; checked on the GPU below): Options "Mentat voice: Off" (still portrait, no mouth) and reduced motion.
2. Done (below, "Real GPU check"): real GPU, real audio, all three houses, sync, 60 fps, console, three rounds.
3. Done: full suite green under a 3 GB cgroup, twice (below, "Tests"); "For the README" below, and in README.md.
4. Done: report-only review, then fixes (above, "Review fixes").
5. Merge into phase3/integration: done the other way round — phase3/integration (a4fca8c) was merged in at 21f8539,
   keeping the original-figure hook (`figure ? originalMentatRig(house) : rigFor(house)`), so this branch is a
   fast-forward of it. Every suite passes at the head (below, "Tests"). Not done: the GPU check with the real PAKs
   (no Dune II files on this machine) — the original figure is covered by tests/original-pictures.test.mjs only.

## Real GPU check with the real voice (2026-10-05)

**How.** Headless Chrome 154 with `--use-angle=gl --ignore-gpu-blocklist --enable-gpu --enable-gpu-rasterization
--autoplay-policy=no-user-gesture-required --mute-audio`, 1920 x 1080, dpr 1; the page reports the renderer "ANGLE (Intel,
Mesa Intel(R) Iris(R) Xe Graphics (ADL GT2), OpenGL ES 3.2)" (not SwiftShader). The AudioContext runs on the real output
device (48 kHz, outputLatency 40-48 ms, its clock stepping 10.7/21.3 ms); only the tab's output is muted. The worktree is
served by `serve.mjs`; the screens are opened by address (`?scene=menu&intro=0&screen=…`, as scripts/scenarios/campaign.mjs)
and, for the player's own path, by real clicks in one page (join pages → Next → Yes → briefing → Advice; the victory card
→ Continue → win lines). Per house: the briefing (Atreides 3, Harkonnen 5, Ordos 4) and its advice, a win (4, 2, 6), a
lose (5, 3, 2), the ending, the four join pages, the last win with the ending: 17 lines a house, 628 s of speech in the
final run. The harness is in the session scratchpad, `gpu/` (cdp-gpu.mjs, recorder.js, measure.mjs, analyze.mjs,
strip.mjs, compose.mjs, checks.mjs, expr.mjs, blinks.mjs, trace.mjs).

After each of the face's own frames the page records the rAF time, the line's time and `t0`, the AudioContext's
`getOutputTimestamp()` and the face (the frame it read, the seven mouth weights, the jaw, the expression springs, the
blink, the pose). What is heard at a frame is `contextTime + (rAF time − performanceTime) − t0`, the audio output's own
account. The sound is the line's own decoded AudioBuffer (`line.parts[k].buffer`): RMS over 30 ms, on the tracks' scale
(−42..0 dB of the 95th percentile). Lags by cross-correlation in 5 ms steps; a shape change is the face's largest weight
passing to the track's new shape (interpolated between frames) against that shape's time in the track; a word after a
pause (≥ 120 ms) opens the mouth when 1 − rest crosses 0.5, against the sound's −30 dB rise. All times below are at the
frame's rAF time; a frame reaches the screen one or two refreshes (17-33 ms) later (headless has no screen: assumed).

**What is good enough** (the contract in the voice notes and the engine's own aim): the face follows what is heard
(`smooth()`: output latency off, a few ms of jitter), its lips move before the voice, and on screen it stays inside the
ITU-R BT.1359 window (not noticed: sound up to 45 ms ahead of the picture, or up to 125 ms behind it); the mouth's
openness follows the sound (r ≥ 0.9 at the best lag).

**Lip sync per house** (the same 10 lines a house; before round 1 → after it):

| | speech | face's heard time vs the output's (median) | jaw vs sound: lead at best r, r there, r at 0 | a shape takes over vs its phoneme (median) | mouth opens vs sound onset after a pause | shapes shown |
|---|---|---|---|---|---|---|
| Cyril (Atreides) | 166 s | +6.7 ms | +50 → +80 ms, 0.97 → 0.97, 0.86 → 0.75 | −5 → −35 ms | −25 → −53 ms (54 words) | 99 % |
| Radnor (Harkonnen) | 145 s | +5.9 ms | +45 → +80 ms, 0.97 → 0.97, 0.89 → 0.82 | −5 → −36 ms | −6 → −26 ms (35) | 99 % |
| Ammon (Ordos) | 128 s | +6.0 ms | +45 → +78 ms, 0.96 → 0.96, 0.88 → 0.78 | −5 → −35 ms | +2 → −25 ms (42) | 98 % |

The clocks agree (p5..p95 about −1..+14 ms a line); the timing tracks' own 30 Hz envelope leads the decoded sound by
20 ms in every line (r 0.97-0.99: its frames are stamped at their start), and their word starts sit within a few tens of
ms of the sound (medians −6, +23, +19 ms after pauses in the final run; few words). Within a line the shape lag is tight (p10..p90
about −41..−30 ms after round 1). On screen, after round 1: shapes 2-18 ms before their sound, the jaw 47-63 ms ahead of
the loudness: all three Mentats meet the contract. Before it, the shapes reached the screen 12-28 ms after their sound
(the lips after the voice). The final run (all three rounds, 17 lines a house incl. the click flows) gives the same:
shapes −35/−34/−36 ms, jaw +80/+80/+75 ms (r 0.97/0.97/0.95). Mouth closed in every gap between sentences (1 − rest
0.00), closed within 9 ms of a sentence's end.

**Frame rate.** Every line, every house: median 16.7 ms, p95 16.8 ms. Frames over 20 ms: 13 of 13 989 (Cyril), 10 of
12 483 (Radnor), 10 of 11 208 (Ammon), worst 150, 83, 83 ms (1-min load average 1.7-8.1, other sessions at work). All of
them are in the first 0.3 s of the first line on a page's first map screen, or at the Advice click before its line; a
Chrome trace puts them in the territory map's WebGL start (shader compile and link, synchronous GPU waits from
render/atlas), not the face: the face's own work is 0.10 ms a frame (p95 0.2-0.3 ms) and its one-time build 21 ms,
about 175 ms before his first word. On the player's path (Yes → briefing, Next → the next page) the lines start without
a long frame.

**Console.** No console message of any level and no exception on any of the 40-odd pages (every screen above, the
checks, reduced motion, voice Off). The only browser log entry is the dev server's `favicon.ico` 404 (it has none).

**The face's life** (`checks.mjs`, `measure.mjs`), all three houses: after every line the hold and release, then asleep
(`display="none"`, the portrait's CSS blink back); Advice and Briefing switched mid-word: the same face carries on, one
listener each; Back mid-word: the face destroyed, the portrait's own markup back (head and lids), the voice let go and
silent; the briefing opened again: a fresh face; the results' Continue mid-word: destroyed. Asleep against the face taken
out: 4-7 levels of 255 at most, on 4-12 % of the crop's pixels (the head in a compositor layer of its own): invisible.
Options → Mentat voice Off (`mentatVoice=0`): no face, no face DOM, no line, no AudioContext made, the words typed, the
still painting. prefers-reduced-motion (emulated): the mouth opens to 1.0 while brows, lids, corners, head and skew stay
at exactly 0 and the engine does not blink (6 lines).

**Rounds** (looked at in the strips, measured, fixed, measured again):

1. *The lips came after the voice* (cfe750c). The engine aims to show the mouth before its sound (`lead`), but at 40 ms
   the 60 ms blend and the 50 ms springs used it all up: a shape took over at its phoneme's start at rAF time, so after
   the refresh it showed 12-28 ms late. `lead` 0.07: the table above. The first frame of a line also caught up the
   look-ahead time as if the voice had run it (a jump to his first shape); it now catches up only the time heard.
   Strips: `s0` (before) and `s1` (after) frame by frame on the same stretch: the shapes come two frames sooner.
2. *The same blinks on every screen* (728b759). Every face started its Mentat's seeded blinks at the top: five screens
   in one page, Cyril blinked at 0.65-0.73 s and 3.7 s every time, Radnor at 2.65-2.75 s, Ammon at 0.72-0.80 s. Each face
   now starts at its own place in the table (89 places on): the first blinks of the same five screens came at 2.38, 1.72,
   2.02, 1.08, 2.30 s (Cyril), 2.88-1.87-2.43-3.18-2.78 s (Radnor), 1.33-1.92-2.43-2.97-1.92 s (Ammon).
3. *Cyril thanked the Commander with a frown* (80ad881). His whole ending was tagged 'grave', so "Thank you. It has been
   an honour to serve with you." came with lowered brows and drawn-down corners. An ending's thanks and honour are
   'pleased' now (`WARM` in mentat.py, retagged; Ammon's "The Council thanks you." too; the retag with the old rules gives
   the shipped tracks byte for byte). Sheet: `r3/strip-r3-thanks.png`, `r3/strip-r3-ordos-thanks.png`.

**Looked at and not changed.** The mouth's in-between frame: 72 % of the shape changes show exactly one frame where the
second sprite has a quarter or more (an open mouth's interior half faded, greyish, for 16.7 ms), 1 % two or three, the
rest are cuts (sharpen 3); a hard cut everywhere would remove it, and the face-art rounds judged that worse. No seam at
the mouth, lid or brow patches in the zoomed strips; every expression reads in character (sheets `e0`). The lids'
edge falls from the eye's top to the foot of the lid sprite's box, not to the eye's bottom (`open[1]` is not used), so
the eye is shut at about 0.4 of a blink and an expression's lid of 0.2 covers about half an eye: the expressions were
tuned by eye with it, and it looks right, but the rig's doc says otherwise. The map's start-up frames (above) are the
map's.

**Not checked here.** The player's own Dune II Mentat (the original figure): no PAK files on this machine, so only the
tests (`tests/original-pictures.test.mjs`, 19 of 19, with the engine on the original figure and the real stage hook; its
rig takes the new lead too). Nobody listened (the output was muted) and the refresh latency is assumed; Safari, other
GPUs and a 30 Hz display were not tried.

**Frame strips** (session scratchpad `/tmp/claude-1000/-home-purelogics-3621-games-dune/947a7f90-ae44-4be3-8a3e-e0c9a848ec06/scratchpad/gpu/`):
`strips/s1/strip-<house>-fbf-mouth.png` (12 consecutive 60 fps frames through a change of shapes, × 6, after round 1;
`strips/s0/` the same stretch before it), `strips/s0/strip-<house>-fbf-face.png` (the whole face, × 3),
`strips/s1/strip-<house>-live-mouth.png` and `strips/s0/strip-<house>-live-eyes.png` (captures while he speaks),
`strips/e0/sheet-<house>-expressions.png` (every expression his lines give him, speaking), `strips/s0/strip-<house>-rest.png`
(asleep against the face taken out), `strips/rm3/strip-<house>-live-face.png` (reduced motion), `checks/c0/sheet-voice-off.png`,
`strips/r3/` (round 3). Numbers: `runs/r0`, `r1`, `r3` (raw), `r0-summary.json`, `r1-summary.json`, `r3-summary.json`.

**Tests.** Full suite under a 3 GB cgroup (`systemd-run --user --scope -p MemoryMax=3G -p MemorySwapMax=0 npm test`),
after the review fixes, twice: 1533 of 1534 pass and 1 is skipped (the portrait bake check, which needs the GPU Chrome),
both times; "the frame loop allocates nothing" passes both times (it was the one failure before cc4a668).
`npm run e2e:campaign` passes (all campaign checks, no console errors).
At the final head, each under a cgroup cap: npm test 1533 of 1534 (1 skipped), `npm run e2e` 29/29, `e2e:menu`,
`e2e:intro` and `e2e:campaign` all checks, `npm run smoke` all 77 scenes. Smoke first ran out of an 8 GB cap after 33
scenes: `page.close()` in scripts/cdp.mjs only closed the DevTools socket, so every scene's tab stayed open and kept
drawing (harmless at 38 scenes, not at phase 3's 77). It now closes the tab; the run peaks at 1.1 GB.

## For the README

In "Campaign", after the Mentats' voice (the voice notes' "For the README", now in README.md as well):

> The Mentat's face moves with his voice: his lips take the shape of each sound a moment before you hear it, his jaw
> opens with its loudness, and his brows, eyes and mouth take each sentence's mood (Cyril's kindly concern, Radnor's
> sneer, Ammon's sly half-smile). He blinks and moves his head a little as he talks, and rests between lines. With
> Options → Mentat voice Off he is the still painting; with reduced motion only his mouth moves.
