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
  parallax over the static 2,400-star shell; 4.0-6.6 `A FAN REMAKE`, 6.9-9.5 `AFTER WESTWOOD STUDIOS'` / `1992 GAME`,
  10.0-13.3 `IN 3D` (in place of the Sega's logos and its "PRESENT"; nothing that implies an affiliation); 13.5-16 empty
  stars; from 15 the nebulae fade in and from 16.0 the planet and the blue dust behind it slide in from the right as the
  drift eases out (1 - smoothstep speed) to a stop at 17.8 on exactly the menu's framing shot; 18.8, 20.3, 21.8 the
  Atreides, Harkonnen and Ordos ships enter past the top-left, bottom-left and top-right edges, arc in, recede and
  shrink to nothing on the upper right, upper left and night side of the disc (1.4 s each); the planet alone; 26.5 the
  title fades in (0.6 s) — widely spaced dark red serif `DUNE` with a metallic gradient and a shadow copy, `The Battle
  for Arrakis` in white serif — centred on what lies right of the menu column; 30.0 the hand-over.
- **Hand-over.** The last frame is the framing shot; the moon has been run so its time reaches the backdrop's 0 at
  30.0; `startBackdrop({ warm: true })` restarts the loop's clock without the cold flag (no fade in from black);
  `menu.show()` and `#app.intro-reveal` fade the menu in over 0.9 s while the title lockup fades out.
- **Skips.** From the gesture on, any key (but Alt+Enter, which stays full screen) or click skips to the title: the key
  is consumed in the capture phase and its repeats and release are swallowed until keyup, so the Skirmish button the
  menu focuses never sees it; a click's release is eaten by the fading layer. `music.skipIntro?.()` is called.
- **When not.** Once per page load (back from a battle in the frame shows the title; a battle on its own page that quits
  back to the menu is recognised by its referrer); not with the Intro setting off (`?intro=0`), a held backdrop
  (`?backdrop=`), `?screen=`, an automated browser (navigator.webdriver, or HeadlessChrome — headless Chrome under CDP
  does not set webdriver) unless `?intro=1`, or when the backdrop fell back to the dune flight. Under reduced motion or
  with the background paused: a 6 s still version (the framing shot fades up, the words beside the planet, the title,
  the menu). If anything throws: `console.warn('intro: …')`, the layer goes, the title shows.
- **Background work.** The backdrop's next battle is built at 17.85 s (the camera has stopped, the first ship is a
  second away) and run ahead and compiled from 23.3 s (the ships have landed, the title is three seconds off), so the
  menu does not stall once it is up.
- **Ending** (`playEnding({ house, app, backdrop, menu, music })`, C12): the backdrop is lent (its loop stops, overlays
  cleared); the planet eases to the middle and 0.55 radii nearer over 3 s while the victor's colour sweeps across it
  from the lit limb on a ragged, sparkling front (2.5-12.5 s; music `finale`); from 13 s the planet eases back to the
  right and the credits — story's `CREDITS` when `src/data/story.js` exists, else a short list of our own — roll up the
  left at 6 % of the window's height a second (music `credits`); 2.5 s after the last line it fades, the backdrop starts
  warm, the title shows and the mood goes back to `menu`. Any key or click skips (consumed the same way). Reduced
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

The two long frames are the backdrop's next battle being built and compiled; they are placed where the picture stands
still (only the slow spin and the twinkle stop for that moment) and the music, on its own thread, plays on. Without the
opening the same work lands in the menu's first planet phase, with the menu up. The ship model is 3,492 triangles
(three instances, one draw call per part).

## How to test

- Unit: `node --test tests/intro-*.test.mjs tests/ending-timeline.test.mjs tests/planet.test.mjs`.
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
