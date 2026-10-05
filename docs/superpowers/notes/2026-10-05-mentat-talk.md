# Talking Mentat: the hook-up (phase3/mentat-talk)

The Mentat's face is hooked into every Mentat screen and has been checked on the real GPU with the real clips for all
three houses (below, "Real GPU check"): lips in sync, 60 fps while he speaks, no console messages, three look-and-fix
rounds (cfe750c, 728b759, 80ad881). The hook-up itself was the build agent's (workflow run wf_4641467b-363, stopped
mid-work and committed as WIP in d874596); b4356d8 fixed Options → Mentat voice Off.

Branch: phase3/mentat-talk = phase3/mentat-voice (incl. voice fix 329cdf2) + phase3/mentat-face-art 8bdfae9, with
phase3/integration merged in (21f8539: the original-figure hook in stage.js).

## What is done
- stage.js: mentatStage attaches the face (attachMentatFace(stage, figure ? originalMentatRig(house) : rigFor(house),
  { warm: true })) when its voice will speak (`voice.enabled`, b4356d8); stage.face; faceOptions for tests.
- index.js: quiet() destroys the face; the screen keeps this.face = stage.face.
- mentat-face.js: warm() builds the face and decodes the rig's pictures before the first line; look() reads the
  voice `motion.lead` (0.07 s since cfe750c) ahead; the first frame of a line catches up the time heard (not the look
  ahead); each face starts at its own place in its Mentat's seeded blinks (728b759).
- mentat-face-rig.js: rigFiles(rig); mouthEase 0.05, sharpen 3, lead 0.07.
- mentat-face-rigs.js: stronger brows for all three Mentats.
- mentat-face-svg.js: headImageOf(art); willReadFrequently canvas for the patches.
- scripts/voices/mentat.py, assets/voice/mentat/{atreides,ordos}/ending.json: the last words' thanks are 'pleased' (80ad881).
- tests: mentat-face-fakes.mjs (shared fakes, moved out of mentat-face.test.mjs), mentat-talk.test.mjs (new),
  mentat-face-sync.test.mjs (the GPU rounds: lead, first frame, blinks per screen), mentat-lines.test.mjs (the
  ending's thanks).

## Known broken — fix first
- `tests/mentat-talk.test.mjs`, test "Options → Mentat voice Off" (line 131): the process grows to ~14 GB and the
  kernel OOM-kills it (seen 2026-10-05 12:30). Do NOT run the full suite until this is fixed (it can hang the PC).
  Run the file alone with a memory cap: `node --max-old-space-size=2048 --test tests/mentat-talk.test.mjs`.
- Likely cause: stage.js attaches the face whenever `voice` is set; it does not check `voice.enabled`, so the
  "Off" stage gets a face (the test expects stage.face === null). Fix the hook, then find the runaway loop.
- The first three tests of the file pass; the last four (Off, reduced motion, setting read, no-Mentat house) have
  not been seen passing. tests/mentat-face.test.mjs passes.

## Still to do (from the brief in the workflow script)
1. Done (b4356d8; checked on the GPU below): Options "Mentat voice: Off" (still portrait, no mouth) and reduced motion.
2. Done (below, "Real GPU check"): real GPU, real audio, all three houses, sync, 60 fps, console, three rounds.
3. Full suite green under the lock. This file: add "## For the README".
4. Report-only review, then fixes.
5. Merge into phase3/integration: stage.js conflicts with the original-figure hook there (a793ac3 / 4602786) —
   keep it: `figure ? originalMentatRig : rigFor(house)`. Then every suite and a GPU check with the real PAKs.

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

**Tests.** Full suite under a 3 GB cgroup (`systemd-run --user --scope -p MemoryMax=3G -p MemorySwapMax=0 npm test`):
1525 of 1527 pass, 1 skipped, 1 fails: "the frame loop allocates nothing" in tests/mentat-face.test.mjs, which is flaky
on this machine and fails as often on 21f8539 (alone: 6 of 8 runs there, 5 of 8 here; the young heap's growth over 10k
frames). `npm run e2e:campaign` passes; the 12 campaign smoke scenes pass.
