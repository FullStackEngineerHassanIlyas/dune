# The Mentats speak (part 2 of 2, built ahead: the face engine)

Branch `phase3/mentat-face-engine` (from `aef4217`, the voice, with `fb05319`, the painted portraits, merged in).
The manager (Roman Urdu, translated): the briefing Mentat should speak his on-screen text "with facial
expressions". Part 1 (`phase3/mentat-voice`, notes `2026-10-05-mentat-voice.md`) gives every line a voice and the
timings a face needs; the portraits stream (`phase3/art-portraits`, notes `2026-10-04-art-portraits.md`) repaints
Cyril, Radnor and Ammon as baked WebP layers. This stream built the face engine before the face art exists, so the
face-art step only has to bake sprites, fill a rig and add two lines to `mentatStage`. A talking Mentat is an
addition the original should have had: neither the Sega nor the PC briefings moved their lips.

Names: `story.js` and the paintings have Radnor as the Harkonnen Mentat and Ammon as the Ordos one (the brief had
them the other way round). The characters follow the house: the Harkonnen Mentat sneers, the Ordos Mentat's
smile is the sly half-smile, Cyril's face is kindly concern.

## Engine (built ahead)

Files (all new; nothing of the voice's, the portraits' or the stage's was changed):

| File | What it is |
|---|---|
| `src/ui/campaign/mentat-face.js` | `MentatFace`, `createMentatFace(opts)`, `attachMentatFace(stage, rig, opts)`: the loop and its life |
| `src/ui/campaign/mentat-face-svg.js` | the renderer: builds the face into the portrait's SVG, writes a pose each frame, puts the SVG back |
| `src/ui/campaign/mentat-face-motion.js` | springs, mouth-shape weights and stacking, the blink schedule, the speaking sway (pure) |
| `src/ui/campaign/mentat-face-rig.js` | the rig format: `PARAMS`, `validateRig`, `assertRig`, `compileRig`, defaults |
| `src/ui/campaign/mentat-face-standin.js` | stand-in rigs on today's paintings (fb05319): `standInRig(house)`, `standInRigs()` |

What a frame does (`MentatFace.update` → `compose` → renderer `write`), at the display's rate:

- **Reads the voice**: `voice.now(frame)` into one `restFrame()` made at the start (the contract of part 1).
  Speaking means a line is `playing` and the frame says `speaking`; anything else is silence.
- **Mouth**: the voice's `(from, shape, mix)` gives target weights for the seven visemes; each weight follows a
  critically damped spring settling in 75 ms (`motion.mouthEase`), so a shape never pops in or out, even when the
  voice's shapes come faster than its own 60 ms blend or the line ends mid-shape (the voice's frame jumps by a
  whole shape then; the face moves at most 0.42 of one per 60 fps frame). The sprites are drawn in viseme order,
  each at `w[k] / (w[0] + … + w[k])`, which composites to exactly the weighted average (the "over" operator; the
  painting's own mouth at rest counts as sprite 0). The **jaw** follows the voice's loudness (`open`, a 60 ms
  spring) times the shapes' openness (`mouth.open`: closed lips stay shut however loud an M is): the mouth group
  scales vertically about the lip line (`mouth.hinge`) from `mouth.jaw[0]` to `jaw[1]`, and the chin (`jaw` part)
  drops `jaw.drop` units with it. Silence: every target is rest and the jaw 0, so the mouth closes in ~75 ms.
- **Expression**: the sentence's expression (held by the voice between sentences and after the last) picks the
  Mentat's target parameters; each eases on its own critically damped spring, 200 ms for the face (`ease`) and
  350 ms for the heavier head (`headEase`), never overshooting. After the line ends the look is held `hold`
  (1.4 s), then eased back to the painting over `release` (0.6 s), and the loop sleeps.
- **Blinks**: the engine blinks while it runs (and hides the portrait's CSS blink meanwhile; the CSS blinks again
  when it sleeps): a seeded schedule per Mentat (`motion.blink`: every `min`..`max` s, sometimes twice), brought
  forward to a sentence's start unless he blinked in the last 1.2 s. A blink closes the lids over an expression's
  half-lowered ones (`lid = lidExpr + (1 - lidExpr) · blink`).
- **Speaking life**: while he speaks the head sways a little (two slow sines a axis, `swayTilt` degrees, `swayNod`
  units), dips with the voice's slow loudness (`speakNod`) and the brows lift a touch on a loud syllable (`flash`),
  all scaled by how much he is speaking (a 0.5 s spring), so they fade out when he stops.
- **Writes** only what changed, and only strings made once: every transform and opacity is quantised (1/32 unit,
  1/50 degree, 1/256 of a scale, 1/255 of an opacity, all far under a pixel) and looked up in a table; a part that
  would only repaint the painting (a warp at rest, a lid open, a mouth shape at 0) is out of the picture
  (`display="none"`). Vector sprites (SVG) are drawn once into bitmaps (5 px a unit) in the browser.
- **Allocates nothing**: no objects, arrays, closures or strings per frame, and no number crosses a call that V8
  might not inline (it would box it): the per-frame numbers live in typed arrays. Measured (tests): 10k frames
  leave the young heap where it was (under 24 kB, the test's own loop being recompiled; one boxed number a frame
  would be 160 kB), make no element and write no string but the tables'. The voice's own `line.now()` boxes about
  one number a frame in V8 (its `time` getter and `track.at(t)`): harmless, but a note for part 1.

Its life:

- `attachMentatFace(stage, rig)` subscribes to the voice and touches nothing until a line plays (`voice.on('line')`
  starts it; a face made while a line is playing starts at once). The face's DOM is built at the first line.
- It stops on the voice's `'end'` (after the hold and the release, then sleeps until the next `'line'`), for good
  when `stage.el` leaves the page (seen at the next frame or the next line: the voice is let go and the portrait's
  SVG put back exactly as `portraits.js` made it), or on `face.destroy()`.
- **Options → Mentat voice: Off** (or Sound off, Voices 0, no clip): `MentatVoice.say()` gives null, no `'line'`
  ever comes, so the portrait stays the still painting with its own closed mouth and its CSS idle.
- **prefers-reduced-motion** (read at attach; `{ reducedMotion }` overrides): the mouth alone moves (shapes and
  jaw); brows, lids, corners and head keep the painting, the engine does not blink (the CSS keeps the eyes open).

Measured on the real GPU (headless Chrome, ANGLE/GL, `dune-shot`, the briefing with the WebGL map, the stand-in
rig, a real `MentatVoice` playing a real timing track over a synthetic voice on Web Audio): the engine's own work
0.14 ms a frame (p95 0.3 ms); the page 16.7 ms a frame (p95 16.8), as without the face. Before the bitmap fix the
stand-in's vector sprites cost the page 19-26 ms frames; hiding the mouth alone gave 60 fps back, which found it.
The lifecycle on the page: `voice.stop()` closes the mouth at once; 3.2 s later the loop sleeps (`display="none"`,
the CSS blink back); the next line wakes it; *Back* (the stage leaves) destroys it. With `mentatVoice=0` no line,
no frame, no DOM change. Screenshots: session scratchpad `shots/face-engine-{atreides,harkonnen,ordos}-sheet.png`
(four moments each, face crops), `face-engine-harkonnen-cmp.png` (painting alone beside the face).

The stand-in rigs (`mentat-face-standin.js`), so the engine runs end to end today: each Mentat's mouth shapes are
drawn in SVG over his painted lips (lips, the mouth's inside, teeth and tongue, in colours sampled from the baked
head, under a soft patch of skin; rest is the painting's own mouth); brows, mouth corners and chin are warps of the
head painting; the lids are the baked closed eyes drawn down over each eye. Their spots (`FACE_SPOTS`) were read
off the fb05319 paintings; the `e519bac` re-sculpt on `phase3/art-portraits` moves the features, so the stand-in
is for fb05319 only — the art step's rig replaces it.

## Rig format and how to fill it

A rig is plain data (it can be JSON), one per Mentat. Every box is `[x, y, width, height]` in the portrait's frame
(the SVG's viewBox, `400 x 500` today: the same units as `PORTRAITS[house].layers` in `portraits-layers.js`).
`validateRig(rig)` returns `{ ok, errors }` with one sentence per bad field; `createMentatFace` throws a
`TypeError` listing them; `attachMentatFace` warns and returns null (the briefing never breaks for its face).

```js
{
  v: 1, house: 'harkonnen', name: 'Radnor', frame: [400, 500],
  head:  { src: '<…>/harkonnen-head.webp', box: PORTRAITS.harkonnen.layers.head, pivot: [210, 360] },
                                   // the head layer (warps copy it) and the point the head tilts about
  mouth: {
    box: [x, y, w, h],             // where every viseme sprite is drawn (all the same box)
    hinge: 284.6,                  // y of the lip line: the jaw opens below it (scale y about it)
    center: 215, halfWidth: 27.7,  // the corners' skew pivot and the mouth's half width (default: box centre, 0.36 w)
    sprites: { rest: null, MBP: url, FV: url, A: url, E: url, O: url, L: url },   // null: the painting shows
    open: { rest: 0, MBP: 0, FV: .2, A: 1, E: .55, O: .75, L: .6 },               // optional: how far the jaw may open
    jaw: [1, 1.3],                 // scale y of the mouth, jaw shut … fully open
    lift: 2, widen: 0.05,          // the corners' params on the sprites: units of skew lift, width for a smile
    raster: 5,                     // optional: px a unit for vector (SVG) sprites drawn into bitmaps
  },
  jaw:     { box, feather: .6, drop: 2.7 },          // optional part: the chin, moved down `drop` units at full open
  brows:   { left: { box, origin: [x, y], feather: .5 }, right: { … }, raise: 3, furrow: 7, inward: 1.2 },
                                   // parts: raised `raise` units at ±1, rolled `furrow` degrees about `origin`
                                   // (default: the brow's outer end), moved `inward` units, at furrow ±1
  corners: { left: { box, feather: .55 }, right: { … }, lift: 2.2 },   // parts: the mouth's corners, up/down
  lids:    { src: '<…>/harkonnen-lids.webp', box: PORTRAITS.harkonnen.layers.lids,
             left: { box, open: [top, bottom] }, right: { … }, soft: .12 },
                                   // the closed eyes; per eye the box it may show in and the eye opening's top
                                   // and bottom (y): an upper lid falls from `top` and covers it all at 1
  expressions: { neutral: {…}, grave: {…}, pleased: {…}, warning: {…}, angry: {…}, sly: {…}, sad: {…} },
  motion:  { ease, headEase, mouthEase, jawEase, hold, release, speakNod, swayTilt, swayNod, flash,
             blink: { min, max, double, close, hold, open, seed } },   // optional: DEFAULT_MOTION in the rig module
}
```

A **part** (`jaw`, each brow, each corner) is `{ box, feather?, src? }`: with `src` it is a sprite of its own,
drawn at `box` and moved (no mask unless `feather` is given); without `src` it is a **warp**: the head layer seen
through a soft mask over `box` (opaque in the middle, fading over `feather` of its half size), the picture moving
inside a mask that stays put — so a warp moves the painted brow itself. The brows, corners and jaw are optional;
a rig with a mouth and expressions only runs.

**Expression parameters** (`PARAMS`, ranges in `PARAM_RANGE`; L and R are the viewer's left and right; a missing
one is 0, the painting): `browL`, `browR` −1..1 (up +); `furrow` −1..1 (+ inner ends down and in: anger,
gravity; − inner ends up: concern, sorrow); `lidL`, `lidR` 0..1 (upper lid down); `cornerL`, `cornerR` −1..1
(up +); `tilt` −6..6 degrees (+ clockwise); `nod` −4..4 units (+ chin down); `jaw` 0..1 (hanging a little open
while he speaks). Every one of the seven expressions must be given (the voice tags: Cyril grave, warning, sad,
pleased, neutral; Radnor adds angry and sly; Ammon sly). The stand-in sets (`EXPRESSION_SETS`) are in character
and a good start: Cyril's concern lifts his inner brows (`furrow` < 0) and his smile is even; Radnor's sneer is
one-sided (`cornerR` up, `cornerL` down) under drawn-down brows and a lowered lid; Ammon raises his right brow and
smiles on one side with his lids a little down.

**How to fill it** (the face-art step):

1. Bake, with the head, one mouth sprite per viseme (MBP, FV, A, E, O, L; WebP like the layers) into one box
   around the mouth, the lip line at the same `hinge` in each, drawn with the jaw shut (the engine opens it: up to
   `jaw[1]` × the sprite's height below the hinge, and `jaw.drop` for the chin). Each sprite covers the painted
   lips (or bake the head without a mouth and give `rest` a sprite too). The shapes are part 1's: rest; M B P
   lips pressed; F V upper teeth on the lower lip; A open; E wide (I, and t d n s z k g); O round (U, w, r, sh);
   L the tongue up (and th).
2. Brows: either bake them out of the head and give each a sprite (`src`, with its box), or leave them in the head
   and give warp boxes that hold each brow with a margin, stopping above the upper lid. Same for the corners and
   the chin (warps work well on the painting).
3. Lids: the `-lids` layer is there; give each eye's box inside it and the eye opening's `[top, bottom]`.
4. Pivot: `PORTRAITS[house].pivot` (the CSS sway's), so the face's tilt and the portrait's sway turn together.
5. Expressions: start from `EXPRESSION_SETS[house]`; check each against its sentences (`--retag` in part 1's
   `mentat.py` lists which sentences carry which).
6. Check: `validateRig(rig)` (a test: `tests/mentat-face-motion.test.mjs` does it for the stand-ins), then look at
   it on the briefing (below). `face.debug()` shows the frame, the weights, the expression and the pose.

A quick way to see the sprites over the painting before the game: the scratch preview the stand-in was tuned with
draws each viseme over the head crop (an SVG per shape, `<image>` of the head plus the sprite at `mouth.box`,
scaled about `hinge` for an open jaw).

## How to hook it into mentatStage

In `src/ui/campaign/stage.js` (the stage keeps `voice` beside `portrait` for this):

```js
import { attachMentatFace } from './mentat-face.js';
import { MENTAT_RIGS } from './mentat-face-rigs.js';        // the baked rigs (until then: standInRig(house))

// in mentatStage(), once `stage` is made (before `return stage`):
stage.face = voice ? attachMentatFace(stage, MENTAT_RIGS[house]) : null;
```

That is all: the face starts with the stage's first spoken line, sleeps between lines, and ends itself when the
stage's section leaves the page (index.js renders a new screen) — nothing to call on leaving. `stage.face` is for
tests and debugging (`face.debug()`, `face.destroy()`). Options:
`attachMentatFace(stage, rig, { reducedMotion, raf, caf })` (the frame scheduler for tests). If the art step
changes `portraits.js`, the renderer needs the head group `.cpm-sway` holding the head `<image>` and the
`.cpm-blink` lids group; it wraps the sway's children in its own head group, so the CSS sway and breath carry the
face. A test for the hook, in the style of `tests/mentat-face.test.mjs` (a fake voice emitting `'line'`, a
hand-cranked `raf`): a briefing stage built by `mentatStage(house, { voice })` gets `stage.face`, and the first
line builds `.cpmf-head` inside the portrait.

To look at it on the real GPU before the hook (as this stream did), attach from the page, with the campaign's
own voice once the clips are committed:

```
dune-shot --root <worktree> --query 'scene=menu&intro=0&screen=campaign-briefing&house=ordos&mission=2' \
  --out <png> --eval "Promise.all([import('/src/ui/campaign/mentat-face.js'), import('/src/ui/campaign/mentat-face-standin.js')]).then(([f, s]) => {
    const voice = __dune.menu.campaign.voice, el = document.querySelector('.cp-mentat-stage');
    window.__face = f.attachMentatFace({ el, portrait: el.querySelector('.cp-mentat'), voice }, s.standInRig('ordos'));
    return { running: __face.running, line: voice.debug().line };
  })" --wait 1500 --eval2 "__face.debug()" --shots 4 --every 450
```

(The clips were not yet committed on `aef4217`, so this stream fed a real `MentatVoice` a real timing track,
`atreides/m1-advice`, and a synthetic voice through its `fetch` option.)

## Tests

- `tests/mentat-face-motion.test.mjs`: the spring settles within 5 % in its time, never overshoots and is exact at
  any frame length; a voice frame's shape weights (and silence as rest); stacked sprites composite to the weighted
  average; blinks on a seeded schedule within their interval, shutting fully, doubles now and then, a sentence's
  nudge (not right after a blink); the stand-in rigs valid on the paintings' layers with every viseme and
  expression; the expressions in character; the stand-in sprites well-formed SVG; a bad rig named field by field.
- `tests/mentat-face.test.mjs` (a counting fake DOM built from the real `mentatSvg()` markup, voices playing real
  `MentatTrack`s on a hand-cranked clock): nothing happens before a line, then the face is built inside the head's
  sway, over the head and under the blink; the shape held is the sprite shown and the jaw opens on A but not on
  M/B/P; nothing pops at 60, 30 or 144 fps (mouth, jaw, brows, head); expressions ease in 200 ms (the head 350)
  without overshoot and hold between sentences while the mouth closes; blinks while speaking, the lids drawn fully;
  the line's end: mouth shut, look held, eased back, the loop asleep and the CSS blink back; the next line wakes
  it; the stage leaving, `destroy()`, a line for a stage already gone: the voice let go and the portrait put back
  exactly; voice Off; a bad rig (null and a warning, or a throw); reduced motion (the mouth alone, the rest out of
  the picture); 10k frames: no young-heap growth, no element made, no string but the tables'.

Run: `node --test tests/mentat-face-motion.test.mjs tests/mentat-face.test.mjs` (19 tests, about a second).

## For the README

In "Campaign", after the Mentats' voice paragraph (part 1's), add:

> The Mentat's face follows his voice: his lips take the shape of each sound and his jaw opens with it, his brows,
> eyes and mouth take the mood of each sentence — Cyril's kindly concern, Radnor's sneer, Ammon's sly half-smile —
> and he blinks and moves his head a little as he talks. With the voice off he is the still painting; with
> reduced motion only his mouth moves.
