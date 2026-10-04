# Art — the screens after a mission (victory card, score screen, password, defeat)

Branch `phase3/art-results` (from `578beeb`). Research `p3map/research.md` §5 (the Sega result screens: a still
"Victory" picture after every won mission; the score screen's gold backdrop with line art of a tank, a soldier or
an Ornithopter behind SCORE / TIME / RANK and the You/Enemy bar rows; the password screen) and §6. The manager
said the screens after a mission had "very low-quality background objects/units". They were flat SVG shapes:
stick-figure troopers by a flag, a grey lozenge for the Frigate, a tank drawn in eleven strokes.

## What it does

- **Pictures rendered from the game's own models.** `src/ui/campaign/results-render.js` builds Three.js scenes
  from `src/render/models` (structures, tanks, infantry, Carryall, Frigate, Ornithopter, with the house paint
  ramp), the game's terrain (`Heightfield` + `TerrainView`) and its particle pools (`Effects`), lights them,
  renders them supersampled 2x through bloom and a finishing pass (contrast, lift/gain, vignette, film grain, a
  shade over the foreground) and scales them down. `assets/campaign/results/make.mjs` opens
  `make.html` in headless Chrome on the real GPU and writes the nine WebP files beside it. Rendering is seeded
  (Math.random is swapped for a fixed generator while a scene runs), so a re-render comes out the same.
  Nothing renders in the game: the screens only load the files (1.5 MB in all, each under 220 KB).
  - `victory-<house>` (1920x1080): the house's base on a rock plateau at the golden hour under a teal sky (a nod
    to the Sega's light-green one), the CHOAM Frigate coming down over the Starport with dust thrown up under it,
    a chevron of seven Carryalls in the house colour crossing the sky (the Sega flies seven over in a V at the end
    of a mission), tanks drawn up on the right, a squad round a house banner on the left (a swallow-tailed
    gonfalon in the house colour with a gold lozenge: a plain heraldic device, not the house crest), and an enemy
    tank burnt out on the near ground. Soldiers for Atreides and Ordos, Troopers for the Harkonnen (their WOR).
  - `defeat-<house>` (1920x1080): the same view at dusk after the battle: the Starport and the Palace gone,
    the Construction Yard, Refinery, Heavy Factory and Outpost sunk askew and burning, tall oil-smoke columns,
    embers, the tanks burnt out where the victory's stood, the banner fallen, the enemy house's tanks rolling in.
  - `line-tank`, `line-soldier`, `line-ornithopter` (1600x1000): engraved line art (see Review fixes for the
    current drawing pipeline). The model is drawn once
    into a float target carrying its view normal, a wrapped light term and depth; a second pass inks the
    silhouette heavier (2.2 px) and the creases and overlaps finer (1.1 px), and hatches the shading: strokes
    run one way on faces turned up and another on faces turned left or right, thicken as the face darkens and
    cross in the deep shade; lit faces stay bare. Dark ink on white, opaque (small as WebP).
- **The victory card** (`victoryCard`): the picture full-bleed (slow 9 s settle, as before), VICTORY in the
  red-gold letters over a dark band at the top, the mission line on a dark plaque with gold diamonds, a floor of
  shade under Continue. Same stages, keys, timer and Continue.
- **The score screen** (`scoreScreen`): a plate of hammered gold (an feTurbulence grain over a gradient, a
  vignette, a double engraved frame line) with the line art cut into it at the right — multiplied into the gold,
  with an inverted copy screened 1-2 px lower as the lit edge of the grooves. Mission 1, 4, 7 a Combat Tank;
  2, 5, 8 a Soldier; 3, 6, 9 an Ornithopter (`scoreSubject`). The gold is burnished under the card so the art never
  crosses the bars at full strength. SCORE and TIME set as small spaced labels beside large serif numbers
  (tabular), a rule under them; the rank in deep red between two engraved rules; rows divided by fine engraved
  lines; the bars run in channels cut into the plate (inset shadow, a pale lower lip) and fill with lit enamel
  marked off in segments. Same rows (no structures row in mission 1), same step-by-step fill, same numbers.
- **The password** (`passwordReveal`): the house's victory picture blurred and darkened to night behind a dark
  panel with a gold double frame; the ten gold plates turn over one after another (45 ms apart).
- **The Mentat's stages after a mission** (`.cp-win`, `.cp-defeat` in index.js): the victory or defeat picture
  as a deep-shaded backdrop behind the Mentat and the map (left and top scrims keep his words on near-black).
- **`defeatCard`** (new export, not yet shown: index.js is not this stream's): the burning base full-bleed with
  DEFEAT in fire-coloured letters and "House X · mission n failed". See integration notes.
- `art.js` keeps only the flat map (its victory and tank drawings are gone).

## Skill guidance used

- **ui-ux-pro-max**: `--design-system "retro sci-fi desert strategy game, 16-bit console remaster, dark gold"`
  suggested an immersive pattern with the HUD/Sci-Fi FUI style (Share Tech Mono / Fira Code, star-white and
  launch-blue). We kept the game's own type (Times New Roman serif titles, Trebuchet labels, Consolas numbers)
  and its gold-on-black palette instead: its *consistency* rule outranks a new look on three screens, and web
  fonts would be a new dependency. Taken from it: the pattern's "skip, keyboard, reduced-motion paths and
  preserve the final state" (every card keeps Continue and Esc; under reduced motion the cards, title and tiles
  do not animate and the bars show full at once, as before); UX *contrast 4.5:1* and the text-over-image check
  (scrims and plaques: plaque 9:1, score text 8:1, password text 15:1); *animate 1–2 key elements per view*
  (card: settle + title; score: the bars; password: the tiles); *stagger 30–50 ms per item* (tiles 45 ms);
  *image optimisation* (WebP, sizes in the brief's budget); *responsive* (checked at 1920x1080, 1366x768,
  420x860). Style search (`retro game console 16-bit`): pixel art and retro-futurism were rejected for a
  painted-engraving look that sits with the 3D game.
- **design** (banner rules): critical content inside the central 70–80% (the title and the plaque; the picture's
  subjects sit so a narrow window's crop keeps the base), one call to action bottom-right, 44 px high.
- **brand**: the house colours are the game's own (`HOUSES`): Atreides blue, Ordos green, Harkonnen red; gold
  trim and the dark-brown ink are the campaign screens' existing tokens. No paid or cloud image API was used.

## Before and after (real GPU, `dune-shot`; scratch, not committed)

`scratchpad/shots/art-results-before-*` against `art-results-r1-*`, `-r2-*`, `-r3-*`. Renders between rounds:
`scratchpad/art-results/r1…r5`.

1. Render round 1 — flat pale sky taking half the frame, the map's edge visible as a wall on the horizon, the
   base tiny, the flag an unlit rectangle, Carryalls off frame; the defeat smoke grey balloons; the line art a
   uniform halftone screen. Fixed: mountain ridge along the north edge, a deeper teal-to-amber sky with cirrus,
   a camera composed in its own frame (`cardShot().spot(u, d)` places things by screen position), wind and low
   drag for tall leaning smoke columns, a face-oriented hatch with bare lit faces.
2. Render round 2–3 — squad cut off at the frame's foot, the Carryall V read as a staggered line, the banner a
   flag on a pole that reads as a national flag, zero-width strokes leaving a grey grid on lit faces, the trooper
   cropped. Fixed: the squad further in, a swallow-tailed house gonfalon turned to the wind, a chevron set out
   in screen space, strokes fade out with their width, wider line-art framing.
3. Render round 4–5 — empty near ground, the burnt tank still showing its lamps (read as a live black tank),
   flames like light bulbs. Fixed: a burnt enemy tank drawn as a wreck (its glowing parts hidden), a shade over
   the foreground, smaller flame tongues, fewer, shorter-lived smoke sources.
4. Screens round 1 (1920x1080) — the score screen's tank crossing the bars at full strength; the password
   backdrop too muddy; the defeat backdrop almost black. Fixed: a burnished field under the card, brighter night,
   lighter scrims.
5. Screens round 2 (1920, 1366x768, 420x860) — the burnish hid the art's best half (the Ornithopter's nose);
   the night behind the password a grey-brown murk; on a tall window the plaque's diamonds hung at the ends of a
   wrapped line and the picture showed the wreck, not the house. Fixed: the art moved down and right so it rises
   out of the corner, a cool night wash, no diamonds when the line wraps, a tall window frames the banner and squad.
6. Screens round 3 (the defeat card mounted by `--eval`) — DEFEAT drawn as a solid gradient bar: a `background`
   shorthand on the letters reset their text clip. Fixed (`background-image`), and a test now guards it.

## Integration (index.js is not this stream's)

- To show the defeat card before the Mentat's lose lines, as the victory card leads the won results: in
  `CampaignMenu.defeat()` keep a stage counter like `results()` (`['card', 'mentat']`); on `card` set
  `this.advance` to the step, call `this.shown(next, VICTORY_CARD_MS)` and return
  `defeatCard(house, mission, { onContinue: next })` (import it from `./results.js`); `next` re-renders
  `campaign-defeat` on the Mentat's stage. Esc on the card should step to the Mentat (today Esc on the defeat
  screen means Try again). Until then the defeat shows its picture as the Mentat stage's backdrop.
- README: the "For the README" paragraph below.

## How to test

- `node --test tests/results-art.test.mjs` (pictures present, WebP at size, under 300 KB each and 2 MB in all;
  the stylesheet names only existing pictures and gives every house and subject its own; card, score and
  password elements), `tests/campaign-screens.test.mjs`, `tests/campaign-stage.test.mjs`.
- Look: `?scene=menu&intro=0&screen=campaign-results&house=<h>&mission=<n>&stage=victory|score|password&won=1`,
  and `screen=campaign-defeat&house=<h>&mission=<n>`.
- Re-render after a model changes: `node assets/campaign/results/make.mjs [name …]` (`--ss 1 --png --out <dir>`
  for a quick preview). Under the shared machine's locks: `flock /tmp/dune-heavy.lock flock /tmp/dune-chrome.lock …`.

## For the README

The screens after a mission show pictures rendered from the game's own 3D models: your house's base at the golden
hour with the Frigate coming down and a V of Carryalls overhead after a victory, the same base burning at dusk
after a defeat, and on the score screen a tank, a soldier or an ornithopter engraved into the gold plate, as the
Sega release draws one of the three there. `node assets/campaign/results/make.mjs` renders them again.

## Review fixes (2026-10-05)

The review (scratchpad `review-art-results/`) found the map's box cutting the Mentat stages' pictures, the score
line art running under the numbers, crude soldier and ornithopter drawings, live-looking wrecks, a loud defeat
banner, a stiff victory squad and a few layout slips. Real-GPU shots: `scratchpad/art-results/fix/` (`sA/`, `sB/`,
`sC/`; `before/` holds the pictures as they were, `p1`…`p4` the render previews).

- **The Mentat's stages after a mission** (`.cp-win`, `.cp-defeat`): the map's opaque canvas is faded into the
  picture by an intersected pair of linear masks (5 % at the sides, 20 % top and bottom, where the board never
  reaches), so no hard-edged dark box cuts the banner or the tanks any more. The picture is enlarged
  (`auto max(100%, 84vw)`) and set to the right, so the squad and banner fall off the left edge and only dark
  base sits behind the Mentat's head. Shots at 1920, 1366, 420 for every house.
- **Score screen line art**: the art is now clipped inside the engraved frame (`inset: 16px; overflow: hidden`:
  no clip-path or mask on the box, which would isolate the blend modes) and each subject has its own size and place
  (`--art-size`, `--art-at`): on a wide screen (1720 px and up) the soldier stands in the right margin, the tank
  and the ornithopter sit in the bottom-right corner, all clear of the numbers and of Continue. The burnish is now a
  solid field over the whole card, numbers included, fading softly past its edges (a box-shadow, not a radial
  fade that left the number column bare). Narrower (the 1366x768 laptop) there is no margin to hold the art, so
  it is drawn whole (`contain`) and faint behind the card, as the Sega draws it, the burnish thinner so it reads
  through; nothing crosses a number at strength (checked at 1366, 1600, 420).
- **Short windows** (max-height 560): the card is made compact (heading capped at 32 px, tighter rows, thinner
  bars), `overflow: hidden auto` (no sideways scroll), 80 px kept under the card for Continue, and the art left out.
  At 900x500 and 1280x540 the whole card now clears the button (it ended under it before).
- **The line art, redrawn** (`results-render.js`): the model is drawn into a float target with its view normal
  octahedral-encoded (no direction lost) and its view depth; the outline pass inks folds wherever the face normal
  turns by more than ~30°, lit or not, and overlaps from the second difference of 1/depth (zero across any plane,
  so only true depth jumps ink, at a threshold that no longer depends on the model's size); a print pass wipes
  outline ink with too little ink round it (the specks), and lays a hairline hatch even on the lit faces so no
  large area is blank. The light is set in view space from the viewer's upper left, so the faces turned to us are
  mostly light and the shade reads as form instead of a blanket crosshatch. Poses: the score screen's infantryman
  is now the **Soldier** (`line-soldier`, subject `soldier`), side-on mid-stride with his rifle levelled (the
  Trooper's pauldrons read as a second head in profile); the Ornithopter flies level, three-quarters from above.
  All three face left, into the screen.
- **Wrecks**: a wreck model's every part is burnt to char (one matte near-black, its lamps out), so no clean
  barrel or bright wheel survives; wrecks sit a little sunk; the victory's wreck smoulders (embers, a faint glow).
- **Defeat banner**: smaller, further back, fallen back across the ground (the cloth draped where it meets the
  sand), in shade, its colour dulled and smoke-dark, the trim tarnished, the swallowtail burnt away to a ragged
  scorched edge with holes burnt through.
- **Victory**: the squad gathers round the banner (two at the pole turned to it, the rest in a loose ring, in
  stride or turned to the camera, two nearer the camera); the Carryalls' hulls are painted in the house colour;
  the V is brought in from the left edge; each house's own heavy unit (Sonic Tank, Deviator, Devastator) heads its
  tanks. A model tinted or burnt keeps its own materials (capacity 12, so it is never grown back to the shared ones).
- **Password**: less blur (1.5 px), a cooler night wash and a stronger vignette: the base reads under a night sky.
- **Housekeeping**: `defeatCard`'s comment matches what it draws; the stylesheet tests read rules through a small
  CSS parser instead of matching exact formatting.

Skill guidance used here: ui-ux-pro-max UX rules *contrast 4.5:1 / text over images needs a scrim* (the solid
burnish under the numbers; the faint art under the card at narrow widths), *no horizontal scroll* (short windows,
the art box no longer overhangs the stage), *responsive breakpoints* (wide / laptop / short / phone each checked).

Not done: the victory's empty foreground sand stays (it is the floor the Continue button and the shade sit on;
filling it would crowd the card); the password keeps the day picture darkened rather than a separately rendered
night (three more files would take the folder past its 2 MB budget).

Integration (in addition to the above): `results-render.js` and `make.html`/`make.mjs` are build tools the game
never loads; at integration they can move to `scripts/` (or `tools/`), with `make.html`'s import path adjusted.

