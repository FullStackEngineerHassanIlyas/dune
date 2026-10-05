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
| `src/ui/campaign/mentat-face-rigs.js` | the three Mentats' rigs on the baked art (the face-art step): `MENTAT_RIGS`, `rigFor(house)`; the stand-in rigs of the first engine step are retired |

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

The first engine step ran on stand-in rigs (`mentat-face-standin.js`: vector mouths drawn in SVG over the fb05319 paintings).
They were fitted to paintings that no longer exist, so the face-art step retired them: the real rigs
(`mentat-face-rigs.js`) are on the new sculpted paintings, and the engine's tests run on them (see "Face art").

## Rig format and how to fill it

A rig is plain data (it can be JSON), one per Mentat. Every box is `[x, y, width, height]` in the portrait's frame
(the portrait's frame, `400 x 500`: the same units as `PORTRAITS[house].layers` in `portraits-layers.js`).
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
    jaw: [1, 1.1],                 // scale y of the mouth, quiet … loud (the sprites carry their own gap; the baked rigs use 1.1)
    lift: 2, widen: 0.05,          // the corners' params on the sprites: units of skew lift, width for a smile
    raster: 5,                     // optional: px a unit for vector (SVG) sprites drawn into bitmaps
  },
  jaw:     { box, feather: .6, drop: 2.7 },          // optional part: the chin, moved down `drop` units at full open
  brows:   { left: { box, src, base: { src, box }, origin: [x, y] }, right: { … }, raise: 3, furrow: 7, inward: 1.2 },
                                   // parts: raised `raise` units at ±1, rolled `furrow` degrees about `origin`
                                   // (default: the brow's outer end), moved `inward` units, at furrow ±1; the baked
                                   // rigs' brows are cut-outs (`src`) over a bare patch of head (`base`), see "Face art"
  corners: { left: { box, feather: .55 }, right: { … }, lift: 2.2 },   // parts: the mouth's corners, up/down
  lids:    { left: { src, box, open: [top, bottom] }, right: { … }, soft: .1 },
                                   // the closed eyes, one sprite per eye (its `box`); the eye opening's top and
                                   // bottom (y): an upper lid falls from `top` and covers it all at 1. (Or one layer
                                   // for both: `src` and `box` of lids, each eye's `box` inside it, no `src` per eye)
  expressions: { neutral: {…}, grave: {…}, pleased: {…}, warning: {…}, angry: {…}, sly: {…}, sad: {…} },
  motion:  { ease, headEase, mouthEase, jawEase, sharpen, hold, release, speakNod, swayTilt, swayNod, flash,
             blink: { min, max, double, close, hold, open, seed } },   // optional: DEFAULT_MOTION in the rig module
}
```

A **part** (`jaw`, each brow, each corner) is `{ box, feather?, src?, base? }`: with `src` it is a sprite of its own,
drawn at `box` and moved (no mask unless `feather` is given), over `base` (`{ src, box }`, the head without the part,
which stays) when it has one; without `src` it is a **warp**: the head layer cut to `box` with its edges faded over
`feather` of its half size, the picture moving. The brows, corners and jaw are optional;
a rig with a mouth and expressions only runs.

**Expression parameters** (`PARAMS`, ranges in `PARAM_RANGE`; L and R are the viewer's left and right; a missing
one is 0, the painting): `browL`, `browR` −1..1 (up +); `furrow` −1..1 (+ inner ends down and in: anger,
gravity; − inner ends up: concern, sorrow); `lidL`, `lidR` 0..1 (upper lid down); `cornerL`, `cornerR` −1..1
(up +); `tilt` −6..6 degrees (+ clockwise); `nod` −4..4 units (+ chin down); `jaw` 0..1 (hanging a little open
while he speaks). Every one of the seven expressions must be given (the voice tags: Cyril grave, warning, sad,
pleased, neutral; Radnor adds angry and sly; Ammon sly). The sets in `mentat-face-rigs.js` are in character
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
6. Check: `validateRig(rig)` (tests: `tests/mentat-face-motion.test.mjs` and `tests/mentat-face-rigs.test.mjs` do it for the three rigs), then look at
   it on the briefing (below). `face.debug()` shows the frame, the weights, the expression and the pose.

A quick way to see the sprites over the painting before the game: `bake.mjs --mouth --preview <dir>` writes each shape
as a crop (and `--scale 6` for a close-up); to see it on the real page, attach it as below.

## How to hook it into mentatStage

In `src/ui/campaign/stage.js` (the stage keeps `voice` beside `portrait` for this):

```js
import { attachMentatFace } from './mentat-face.js';
import { rigFor } from './mentat-face-rigs.js';             // the baked rigs

// in mentatStage(), once `stage` is made (before `return stage`):
stage.face = voice ? attachMentatFace(stage, rigFor(house)) : null;
```

That is all: the face starts with the stage's first spoken line, sleeps between lines, and ends itself when the
stage's section leaves the page (index.js renders a new screen) — nothing to call on leaving. `stage.face` is for
tests and debugging (`face.debug()`, `face.destroy()`). Options:
`attachMentatFace(stage, rig, { reducedMotion, raf, caf })` (the frame scheduler for tests). The portrait is the
HTML one of `portraits.js` (`.cp-mentat-art`, `.cpm-sway` holding the head `<img>` and the `.cpm-blink` lids): the
renderer wraps the sway's children in two boxes of its own (nod, roll about the pivot) and lays one small SVG over
the head, so the CSS sway and breath carry the face (see "Face art" for what the art step changed in the engine). A test for the hook, in the style of `tests/mentat-face.test.mjs` (a fake voice emitting `'line'`, a
hand-cranked `raf`): a briefing stage built by `mentatStage(house, { voice })` gets `stage.face`, and the first
line builds `.cpmf-head` inside the portrait.

To look at it on the real GPU before the hook (as this stream did), attach from the page, with the campaign's
own voice once the clips are committed:

```
dune-shot --root <worktree> --query 'scene=menu&intro=0&screen=campaign-briefing&house=ordos&mission=2' \
  --out <png> --eval "Promise.all([import('/src/ui/campaign/mentat-face.js'), import('/src/ui/campaign/mentat-face-rigs.js')]).then(([f, r]) => {
    const voice = __dune.menu.campaign.voice, el = document.querySelector('.cp-mentat-stage');
    window.__face = f.attachMentatFace({ el, portrait: el.querySelector('.cp-mentat'), voice }, r.rigFor('ordos'));
    return { running: __face.running, line: voice.debug().line };
  })" --wait 1500 --eval2 "__face.debug()" --shots 4 --every 450
```

(The clips were not yet committed on `aef4217`, so this stream fed a real `MentatVoice` a real timing track,
`atreides/m1-advice`, and a synthetic voice through its `fetch` option.)

## Tests

- `tests/mentat-face-motion.test.mjs`: the spring settles within 5 % in its time, never overshoots and is exact at
  any frame length; a voice frame's shape weights (and silence as rest); stacked sprites composite to the weighted
  average; blinks on a seeded schedule within their interval, shutting fully, doubles now and then, a sentence's
  nudge (not right after a blink); the three rigs valid on the baked layers with every viseme and expression; the
  expressions in character and never past a lid a third down; a bad rig named field by field.
- `tests/mentat-face.test.mjs` (a counting fake DOM built from the real `mentatSvg()` markup, voices playing real
  `MentatTrack`s on a hand-cranked clock): nothing happens before a line, then the head's two boxes and the face's SVG
  are built inside the sway, over the head painting and under the CSS blink; the shape held is the sprite shown and the
  jaw opens on A but not on M/B/P; nothing pops at 60, 30 or 144 fps (mouth, jaw, brows, head); expressions ease in
  the rig's time (the head's longer) without overshoot and hold between sentences while the mouth closes; blinks while
  speaking, the lids drawn fully; the line's end; the stage leaving, `destroy()`, a line for a stage already gone: the
  voice let go and the portrait put back exactly; voice Off; a bad rig; reduced motion; 10k frames: no young-heap
  growth, no element made, no string but the tables'; each corner moves its own half of the mouth; a brow is a cut-out
  over a bare patch, the lids a sprite per eye.
- `tests/mentat-face-rigs.test.mjs`: every face file (36) on disk at the pixel size its box declares, on the head
  layer's pixel grid, the module's bytes and hashes equal the files', no stale file in the folder; the art lies on the
  head where the sculpt's features are; the lot under 40 KB a file and 1.5 MB together (257 KB); the rigs valid and
  naming the baked files, every part where the art is.
- `tests/portraits-face.test.mjs`: the mouth poses (rest changes nothing, M B P shut, each shape its own, each Mentat's
  measure), the regions on the pixel grid, the sculpt's pose uniforms and that the bake is deterministic (pure
  regions and poses; with `DUNE_BAKE_CHECK=1`, under the chrome lock, a fresh GPU bake equals the committed files byte for
  byte: `DUNE_BAKE_HOUSE=<house>` picks the Mentat, default ordos).

Run: `node --test tests/mentat-face-motion.test.mjs tests/mentat-face.test.mjs tests/mentat-face-rigs.test.mjs tests/portraits-face.test.mjs`.

## Face art

Branch `phase3/mentat-face-art` (the engine, `763e1ab`, with the painted portraits, `1703eea`, merged in). The art step
made the rigs real for the sculpted paintings, and had to bring the engine to them: the portrait is no longer an SVG.

**What was baked, from the very sculpt of the head** (`assets/campaign/portraits/bake.mjs --mouth`; one bake,
about 10 s on the GPU; 36 WebP files, 257 KB, the largest 12 KB; `mentat-face-art.js` is generated and says where each
lies, with bytes and hashes):

| Files per Mentat | What |
|---|---|
| `<house>-mouth-<MBP, FV, A, E, O, L>.webp` | the head's own render with the mouth in that shape: lips, the inside, teeth, tongue, shadow and skin as painted; rest is the painting itself |
| `<house>-brow-<left, right>.webp` and `-browbase-<left, right>.webp` | each brow as a cut-out (alpha from the difference between the head with and without the brow's hair) and the head without it, which stays under it |
| `<house>-lid-<left, right>.webp` | the eye shut, brows off, in a soft ellipse round the eye |

How the sprites sit on the painting without a halo, a seam or a pasted look: the head's sculpt (`portraits-head.js`) got a
**mouth pose** (uniforms `uMouthA/B/C`: the gap between the lips, corners apart or together, the lower lip tucked
under the upper teeth, the tongue raised, lips pursed, the upper lip raised, pressed lips, teeth shown, brows taken
off) with a hole through the lips, the chamber behind it, teeth and tongue (materials 4 to 6), all gated on the pose so zeros give the
sculpt as it was; the bake renders a crop round the mouth **on the head layer's own pixel grid with its own film grain**
(`uPixOff` offsets the grain's hash to the frame's pixels) through the same painter's finish, so outside the lips a
sprite *is* the head layer (checked: mean difference about 1 level of 255 in the opaque core, which is the WebP's own
loss; the head layer's files and `seams.json` are untouched). A sprite is opaque in an ellipse and fades to nothing
toward its box, over the very same picture. The shapes (`portraits-mouth.js`: `SHAPES`, scaled per Mentat by
`CHARACTER`: Cyril opens most, Ammon least) are modest, a counsellor's: A a gap of 1.1 cm, never a shout.

**What the engine needed** (these are changes to `mentat-face*.js`, which the notes above describe as built; the
hook for `mentatStage` is the same two lines):

- *The HTML portrait.* The head `<img>` and the CSS blink go inside two boxes (CSS transforms nod and roll about the
  pivot) and one small SVG, covering only the face (every part's box, with room), lies over the head painting as a
  layer of its own. `attachMentatFace` finds `.cp-mentat-art`.
- *Brows as cut-outs.* A part with `src` and `base` is a cut-out over a bare patch of the head (`brows.left = { box,
  src, base: { src, box } }`): it can lift, roll and lower freely and leaves no ghost and no box edge. The patches are
  drawn first, the brows last (over the lids: a brow that comes down passes over the eyelid). The first try, warps of
  the head under soft masks, left a ghost of the old brow wherever it lay in the faded edge and cost the page 1.5 to
  3 ms a frame, because an SVG mask makes a layer the size of its element, here the whole head image, for every part.
  Warps that remain (the corners, the chin) are cut from the head once into a small faded patch (a canvas, from the
  `<img>` already on the page); without a canvas (tests) the masks serve.
- *Per-eye lids.* `lids.left = { src, box, open }`: one shut-eye sprite per eye (the portrait's own lids layer has the
  brows baked in, which ghost once a brow has moved). The lowered lid is the sprite drawn down to an edge.
- *Each corner of the mouth on its own.* The sprites are drawn once in a stack and shown as two halves, each skewed by
  its own corner's lift (`pose.mouthSkew`, `mouthSkewR`): a smile, a frown or a one-sided sneer shows while he speaks,
  not only at rest. The halves are added with `mix-blend-mode: plus-lighter` under complementary masks: two ordinary
  half-covered layers leave a hairline (and a darker stripe while sprites cross-fade) where they meet.
- *A cross-fade along an S* (`motion.sharpen`, 2): the sprites' weights are raised to a power before they are stacked, so
  the two-mouths-at-once ghost of a half-way shape is seen for fewer frames.
- `validateRig`: `part.base`, `lids.left/right.src`. `mentat-face-standin.js` is gone.

**Characters** (`EXPRESSIONS` in `mentat-face-rigs.js`; every number was looked at on the page): Cyril's kindly
concern (inner brows up and a drooping lid for grief, brows drawn together and a lowered head for gravity, an even warm
smile, never angry for long), Radnor's sneer (a heavy, slow face: heavier head easing, one corner lifted at rest, anger
a scowl with the head down, `sly` one brow up and the smirk's side up to a grin), Ammon's sly half-smile (a brow
always a little raised, the smile deepening on one side). Lids never go more than a third down (Radnor's eyes are
already slits); heads never roll more than 2 degrees nor nod more than 2.5 units.

**Proof on the real GPU** (`dune-shot`'s Chrome, ANGLE/GL, the briefing page with the WebGL map; the face attached from the
page with a dynamic import and a controllable voice; frames cut out of the page at its own pixels). Screenshots, in the
session scratchpad `shots/`: `face-art-<house>-<1920x1080|1366x768>-sheet.png` (every viseme, two half-way
cross-fades, every expression at rest and speaking, two blink positions) and `-real.png` (a real timing track,
`atreides/m1-advice`, played through a real `MentatTrack`), the 247 single frames in `shots/face-art-frames/`.
Checks: with the CSS animations paused and the neutral look zeroed, the face at rest is **pixel-identical** to the bare
painting (no difference at all in the face crop); the page's frame time with the face speaking through every viseme and
expression against the face asleep, alternated over 18 s: 16.7 / 16.8 ms (Cyril), 16.7 / 16.9 (Radnor), 16.7 / 16.7
(Ammon) at 1920x1080 and 16.7 / 16.7 (Radnor) at 1366x768, p95 18.2 to 19.1 ms, the engine's own work 0.2 ms a frame;
no console errors on any run.

**Rounds of looking** (each on the page, at both sizes): 1 the first frames: seams down the mouth's middle where two
half-covered halves met, brows with ghosts of themselves, the head's silhouette smudged dark beside the chin (a sprite's
fade had replaced the render's own alpha instead of multiplying it), expressions too faint to read; 2 soft rectangular
masks, a Mentat-by-Mentat strengthening of the numbers, a held lid test; 3 the perf finding above and the brows
rebuilt as cut-outs, which also showed the lids layer's baked brow, so the eyes became per-eye sprites; 4 lids too far
down on Radnor's and Cyril's small eyes (a third of an eye is most of it), the half-way mouths' ghosts and hairline
(plus-lighter halves, the S cross-fade), a firmer M B P.

**Limits.** The faces are still stylised renders; the mouth's dissolve between two open shapes shows a grey ghost for
two or three frames at speech rate (the S shortens it; a hard cut would be worse). The lids are one soft edge across a
shut-eye sprite, a little coarse on the largest eyes at a hold of a quarter or more. The jaw is a chin patch that
drops a few units with the mouth, not a rebuilt jawline. Re-bake with
`flock /tmp/dune-heavy.lock flock /tmp/dune-chrome.lock node assets/campaign/portraits/bake.mjs --mouth`
(changing a shape: `--mouth --preview <dir> --scale 6 --only <house>` shows the crops, `--shapes '{"A":{"open":1.2}}'`
tries numbers out) and commit the files and `mentat-face-art.js` together.

## For the README

In "Campaign", after the Mentats' voice paragraph (part 1's), add:

> The Mentat's face follows his voice: his lips take the shape of each sound (the sprites are rendered from the very
> sculpt of his head, so teeth, lips and shadow are the painting's own) and his jaw opens with it; his brows, eyes and
> mouth take the mood of each sentence — Cyril's kindly concern, Radnor's sneer, Ammon's sly half-smile — and he
> blinks and moves his head a little as he talks. With the voice off he is the still painting; with reduced motion
> only his mouth moves. The face art is baked by `assets/campaign/portraits/bake.mjs --mouth` (36 WebP files, about
> 250 KB) and checked on the real GPU at 60 fps.
