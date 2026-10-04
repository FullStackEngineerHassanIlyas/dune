# Phase 3 — intro stream: the Sega-style opening before the title, and the campaign's ending

Branch `phase3/intro` (from `dc2061e`, the phase 3 seams). Spec §5.8 (screens), §6 (music), §12 (IP); phase 3
research §8 (the Mega Drive intro measured frame by frame), §9 (Finale, Credit Roll); contracts C6 (menu music),
C12 (ending), C4 (story's CREDITS).

## Plan (each step with its proof)

1. A pure clock for the opening (`src/game/intro-timeline.js`) — `tests/intro-timeline.test.mjs`: the marks equal
   C6's INTRO_MARKS, every phase once in order, the drift's position, speed and acceleration run on at 16.0 and
   17.8, the planet stays off screen until 16.0 at 16:9, 4:3, 21:9 and 9:16, the play rules, the backdrop's
   background work only while nothing moves.
2. The ships (`src/render/models/units/house-ship.js`, flights in the timeline) — `tests/intro-ships.test.mjs`:
   staggered starts, never two at once, each enters past a screen edge close to the camera, recedes and shrinks
   all the way, lands on the visible face 0.5-0.75 radii out inside the disc on every aspect; the model builds.
3. Space for the opening (`src/render/space-travel.js`) and the camera it needs (`src/render/planet.js`, additive
   `update()` options) — `tests/planet.test.mjs` (+4): travel at no offset is the framing shot exactly (position,
   orientation, lens shift, altitude) — the hand-over pose; travel, centred, tint, a layer's fade, the star budget,
   no near star can cover the planet.
4. Warm start and lending (`src/scenes/menu-backdrop.js`) — e2e: the backdrop runs in its planet phase with the fade
   layer at 0 at 0, 120 and 400 ms after the hand-over.
5. The opening and the ending (`src/scenes/menu-intro.js`, `src/game/ending-timeline.js`, `src/scenes/ending.js`,
   `src/ui/intro.css`) — `tests/intro-gate.test.mjs` (pixel font covers every word, the keys that count as a gesture,
   runIntro's ways out, a failure warns and shows the title), `tests/ending-timeline.test.mjs`, `scripts/e2e-intro.mjs`
   (28 checks), smoke stills, real-GPU screenshots and frame rates below.

## What it does

- **Gate.** Sound needs a user gesture, so the page opens on black with a blinking `PRESS ANY KEY` in pixel capitals
  (our own 5 × 7 face, drawn on a canvas, `image-rendering: pixelated`). `music.prime?.()` runs as runIntro starts (page
  load); `music.intro?.()` runs inside the pointerdown or keydown handler, a window listener in the bubbling phase that
  never stops the event, so the music's own unlock listeners (registered earlier) see it first. Escape and modifier keys
  alone cannot unlock audio: Esc at the gate goes straight to the title, Shift and the like are ignored. The picture
  waits at black until `music.intro()` resolves (audible, or false when muted) or 1.6 s, so picture and music start
  together; without the method it starts at once, silent.
- **The opening** (seconds after the gesture, INTRO_MARKS): 0 stars fade in from black (1.2 s); the camera drifts
  sideways and a little forwards at 3.7 planet radii a second, so 600 near stars along its way slide right to left with
  parallax at the Sega's pace (see Review fixes) while the 2,400-star shell stays faint until the planet comes; 4.0-6.6 `A FAN REMAKE`, 6.9-9.5 `AFTER WESTWOOD STUDIOS'` / `1992 GAME`,
  10.0-13.3 `IN 3D` (in place of the Sega's logos and its "PRESENT"; nothing that implies an affiliation); 13.5-16 empty
  stars; from 15 the nebulae fade in and from 16.0 the planet and the blue dust behind it slide in from the right as the
  drift eases out (1 - smoothstep speed) to a stop at 17.8 on exactly the menu's framing shot; 18.8, 20.3, 21.8 the
  Atreides, Harkonnen and Ordos ships enter past the top-left, bottom-left and top-right edges, arc in, recede and
  shrink to nothing on the upper right, upper left and night side of the disc (1.4 s each); the planet alone; 26.5 the
  title fades in (0.6 s) — widely spaced dark red serif `DUNE` with a metallic gradient and a shadow copy, `The Battle
  for Arrakis` in white serif — centred on what lies right of the menu column; 30.0 the hand-over.
- **Hand-over.** The last frame is the framing shot; the moon has been run so its time reaches the backdrop's 0 at
  30.0; `startBackdrop({ warm: true })` restarts the loop's clock without the cold flag (no fade in from black);
  `menu.show()` and `#app.intro-reveal` fade the menu in over 0.9 s while the opening's `DUNE` glides into the menu's
  own lockup and gives way to it as it lands (see Review fixes).
- **Skips.** From the gesture on, any key (but Alt+Enter, which stays full screen) or click skips to the title: the key
  is consumed in the capture phase and its repeats and release are swallowed until keyup, so the Skirmish button the
  menu focuses never sees it; a click's release is eaten by the fading layer. `music.skipIntro?.()` is called. The
  browser's own keys (F1-F12, anything with Ctrl, Meta or Alt) skip too but keep their default, so F5 still reloads.
- **When not.** Once per page load (back from a battle in the frame shows the title; a battle on its own page that quits
  back to the menu is recognised by its referrer); not with the Intro setting off (`?intro=0`), a held backdrop
  (`?backdrop=`), `?screen=`, an automated browser (navigator.webdriver, or HeadlessChrome — headless Chrome under CDP
  does not set webdriver) unless `?intro=1`, or when the backdrop fell back to the dune flight. Under reduced motion or
  with the background paused: a 6 s still version (the framing shot fades up, the words beside the planet, the title,
  the menu). If anything throws: `console.warn('intro: …')`, the layer goes, the title shows.
- **Background work.** The backdrop's first battle is built, run ahead and compiled behind the gate's black, a slice a
  frame, while the page waits for the key. What a quick player leaves undone still waits for the old moments: the build
  at 17.85 s (the camera has stopped), the run-ahead and compile from 23.3 s (the ships have landed).
- **Ending** (`playEnding({ house, app, backdrop, menu, music })`, C12): the backdrop is lent (its loop stops, overlays
  cleared); the planet eases to the middle and 0.55 radii nearer over 3 s while the victor's colour sweeps across it
  from the lit limb on a ragged, sparkling front (2.5-12.5 s; music `finale`); from 13 s the planet eases back to the
  right and the credits — story's `CREDITS` when `src/data/story.js` exists, else a short list of our own — roll up the
  left at 6 % of the window's height a second (music `credits`); in the 2.5 s after the last line the colour draws back
  the way it came, then the layer fades, the backdrop starts warm, the title shows and the mood goes back to `menu`. A
  skip eases the planet back to the framing shot and tan in 0.8 s before the backdrop takes over. Any key or click skips (consumed the same way). Reduced
  motion: no camera move, the credits a group at a time. Without the planet (dune-flight fallback) it rolls on black.

## Decisions

- **Option B** of the intro map (a player of its own on the backdrop's renderer and planet) rather than a pre-roll inside
  `MenuBackdrop`: the seam already asks for `runIntro` before `startBackdrop`, and the backdrop's clock and its 19 tests
  stay untouched. The backdrop only gained `start({ warm })`, `lend()` and `drawSpace()`.
- **Wall clock**, held while the page is hidden (the menu music suspends its context then): the picture never falls
  behind the music on a slow frame; it drops frames instead.
- **The near star corridor and the dust stay in the planet scene for good**, also when the opening does not play, so the
  backdrop's planet shot is always the opening's last frame. The far nebula cannot slide (it is 690 away), so it fades in
  with the planet; the near dust slides in with it.
- **Ships show their stern all the way**, as the Sega sprite does: they point along the line of sight, turned 0.45 of the
  way to their heading, nose up 0.42 rad so their back shows, banked into the turn. Painted materials only: the planet
  scene has no environment for metal to mirror. Lit by a sun along the planet's light and a blue/sand hemisphere fill.
- **No landing flash**: the Sega ships just shrink to a dot and are gone.
- **Credit words** live in `CARDS` (intro-timeline.js); the lead may change them.

## Measurements (real GPU: Intel ADL GT2 / Mesa, headless Chrome ANGLE GL, 1600 × 900, dpr 1, 2.5 s windows)

| Stretch | Medium fps (p95 ms, worst ms) | Low fps (p95 ms, worst ms) |
|---|---|---|
| stars 1-3.7 s | 56.0 (33.3, 33.4) | 60.0 (16.7, 16.8) |
| arrival 16.2-18.9 s (battle build at 17.85) | 44.1 (33.3, **266.6**) | 52.8 (16.8, **233.3**) |
| ships 18.9-21.5 s | 60.0 (16.8, 16.8) | 60.0 (16.7, 16.8) |
| planet alone 23.3-26 s (run-ahead and compile) | 39.7 (33.3, **799.9**) | 45.3 (16.8, **616.7**) |
| title 26-28.5 s | 59.6 (16.7, 33.4) | 54.0 (33.3, 50.1) |

Measured before the review fixes. The two long frames were the backdrop's next battle being built and compiled; that
work now runs behind the gate's black (Review fixes has the frame times since). Without the
opening the same work lands in the menu's first planet phase, with the menu up. The ship model is 3,492 triangles
(three instances, one draw call per part).

## Review fixes (2026-10-04)

The report-only review proved ten findings; all are fixed except the stray notes file (the lead's call).

- **Music told on every way past the opening** (important). With the opening off (Intro off, `?screen=`, back from a
  battle, an automated browser, or a failure), and with Esc or the debug skip at the gate, runIntro now calls
  `music.skipIntro?.()` (in try/catch) after `prime()`; `finish(skipped)` does it for every skip. Before, the first click
  on a still title started the 30 s `opening` cue. Proof: `tests/intro-opening.test.mjs`, `tests/intro-gate.test.mjs`;
  in a scratch merge of phase3/music + score + this branch the first click after `intro=0`, after Esc at the gate and
  after a skip all play the `title` track (`mood: menu`).
- **Enter works on the title again** (important). intro.css's first-paint guard hid the menu with `visibility: hidden`,
  so MainMenu's `focus()` was refused and Enter did nothing; the keyframes are now `opacity: 0; pointer-events: none`.
  Real Chrome, `intro=0` and headless: the first button has the focus and Enter opens Skirmish.
- **Stars at the Sega's pace** (important). The near stars lie 0.87-1.93 framing distances in front of the camera's way
  (3.6-8 radii on a wide window, was 4-64), so they cross at 0.47-0.72 screen widths a second (research §8); the
  keep-clear rule is now the stopped shot itself (no star nearer than the planet's far side inside it), so the field
  does not thin out before the planet comes; the far shell is at 8 % in the empty stars and comes up with the nebula,
  so what the eye follows moves; the near stars are a touch brighter. `tests/intro-stars.test.mjs` pins the median
  (0.47-0.72), the slowest tenth (≥ 0.3), the count in view (20-140) on four laptop windows and three seeds, and that
  the stopped shot has near stars around the planet but none in front of it. On the GPU, frame-exact stills 0.1 s
  apart: matched near stars move at a median 0.54-0.61 widths a second.
- **A music that throws never holds the gate** (minor): `intro()` is called in try/catch, the opening plays silent.
- **Still version holds the moon** at the backdrop's moon time 0 (minor); the planet's spin and twinkle were already still.
- **The title glides into the menu's lockup** (minor). At the hand-over the opening's `DUNE` moves and scales onto the
  menu's `.mm-brand h1` (its first word), its letters spreading to that one's spacing, in 0.8 s; its subtitle fades on
  the way; the lockup (intro.css `#app.intro-glide .mm-brand`) fades in over the last 0.3 s as the opening's fades out.
  Checked with the campaign's lockup (a scratch merge) and the base one. The Sega keeps the title where it is: if the
  lead wants that, the campaign's title screen would put its lockup over the planet and the glide becomes a crossfade.
- **The ending hands back tan** (minor): the colour draws back over the tail, and a skip settles it.
- **No stall at 24 s** (minor). Real GPU, 1600 × 900, Medium, three runs (load average 6-10): no frame over 90 ms Since the final review the backdrop readies its first battle a slice a frame (finishSlice), so a quick key at the gate no longer leaves a 0.3-0.8 s frame at 23.5 s.
  between the gesture and the hand-over, against 300 ms at 17.86 s, 150 ms at 18.35 s and 667 ms at 23.66 s for the
  code before, in one run under the same load. Low: none either. Every stretch runs at 54-60 fps on both (Medium's
  arrival 49). Left: the first frame after the gesture (100-150 ms, still black) and one frame at the hand-over
  (100-167 ms in four of six Medium runs, none in two); the main thread does about 7 ms there (backdrop start 1.4 ms,
  menu 5.3 ms, backdrop frames 1 ms), so it is the browser drawing the menu in, not our work.
- **F5 and the browser's other keys** (minor): see Skips.
- **Notes file outside the ownership list**: left for the lead (other phase 3 streams add the same kind of notes).

## How to test

- Unit: `node --test tests/intro-*.test.mjs tests/ending-timeline.test.mjs tests/planet.test.mjs` (the opening and the
  ending at work on a DOM stand-in: `tests/intro-opening.test.mjs`; the stars' pace: `tests/intro-stars.test.mjs`).
- E2E (SwiftShader, holds the Chrome lock): `flock /tmp/dune-chrome.lock env E2E_INTRO_PORT=8610 node scripts/e2e-intro.mjs`
  — 28 checks, screenshots in `screenshots/e2e-intro/`.
- Smoke stills: `flock /tmp/dune-chrome.lock env SMOKE_PORT=8611 node scripts/smoke.mjs intro-stars intro-credits
  intro-present intro-arrival intro-ship-atreides intro-ship-harkonnen intro-ship-ordos intro-title ending-shimmer ending-credits`.
- By hand: `?scene=menu&intro=1` (forced, also in automated browsers), `?scene=menu&introAt=19.4` (held),
  `window.__dune.intro.seek(t)` / `.step(dt)` / `.skip()`; `?scene=ending&house=ordos` (`&at=9` held), `__dune.ending.seek(t)`.

## Open questions

- The moon's pass (the backdrop's, pinned by the planet tests) puts it just above the `D U` of the title at the
  hand-over. The title sits at 33vh to clear it; moving the moon's pass would be a backdrop change.
- The campaign stream restyles the menu's own title lockup "the same way": `.intro-dune` / `.intro-sub` in
  `src/ui/intro.css` are the reference (font stack, the gradient, letter-spacing .42em balanced by padding-left, and the
  shadow as a second copy underneath — a `filter: drop-shadow` or `text-shadow` on `background-clip: text` renders a
  pixelated ghost copy in Chrome).
- `playEnding` does not show story's `ENDINGS[house]` (the Mentat's closing words): the campaign's ending screen should,
  before calling it. It ends on the title with the `menu` mood; a caller that wants another screen goes there after.

## For the README

**The opening.** The main menu now starts like the Mega Drive release: a black screen asks for a key or a click (browsers
only allow sound after one), then stars drift past, our own credit lines show, Arrakis and a blue nebula slide in and
the camera stops on the planet, the Atreides, Harkonnen and Ordos ships fly in one by one and sink into it, and the title
appears before the menu fades in over the same picture. The music's opening cue is started by that key and the pictures
are timed to it. Any key or click skips to the title. It plays once per visit; turn it off in Options (Intro) or with
`?intro=0`; `?intro=1` forces it (automated browsers skip it otherwise), `?introAt=<seconds>` holds it at a moment for
screenshots. With reduced motion (or the background paused) a short still version plays. The campaign's ending turns
the planet into the victor's colour and rolls the credits: see it on its own with `?scene=ending&house=ordos`
(`&at=<seconds>` to hold). `npm run e2e:intro` checks both in Chrome (port `E2E_INTRO_PORT`, 8610).
