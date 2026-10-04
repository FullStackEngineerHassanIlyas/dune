# Art — the three Mentat portraits, painted and lit

Branch `phase3/art-portraits` (from `578beeb`). The manager: "the briefing character models (the Mentat
portraits) are very low quality … use the ui-ux-pro-max skill to design or build them." Research
`p3map/research.md` §4 (the Mentats' looks: Cyril, Radnor, Ammon). Reference images were looked at for
mood only; nothing is traced or copied (CLAUDE.md lessons: our own art, facts only).

## What changed

- **Before**: `portraits.js` drew each Mentat as ~40 flat SVG shapes (one gradient per part, outlined
  features, a cartoon look).
- **After**: each Mentat is a 3D figure of our own (since Review fixes; first a 2.5D painting), shown as four
  baked WebP layers stacked in the frame the briefing already sizes (400 x 500, fitted whole and standing on
  the bottom edge, class `cp-mentat-art`; first an SVG, now HTML images in a container-query frame;
  `mentatSvg(house)` keeps its name and contract, so `stage.js`/`index.js` are untouched):
  - `<house>-back.webp` — the house's chamber behind him, soft-focus, fading out at the sides and top:
    Caladan (a stone hall, an arched window on a blue-green sea, a warm lamp), Giedi Prime (a foundry hall,
    a furnace grate, iron pillars, embers), the Ordos (an ice hall, frosted pillars, a cold light, snow).
  - `-body` — the cloak or robe, collar, hands, props; `-head` — head and hair (it sways about the neck);
    `-lids` — the closed eyes only, shown for a blink.
- **Idle life** (CSS in the SVG, no JavaScript per frame): a slow breath (the body lifts from its bottom
  edge, the head rises with it), a slight turn of the head (about 1°, 12–15 s), and blinks (one, then a
  double, every 10–12 s). Each Mentat keeps his own pace (Radnor slowest). Under `prefers-reduced-motion`
  nothing moves and the eyes stay open.
- **Looks** (research.md §4, our own drawing): **Cyril** young, calm, swept-back blond hair, blue eyes, a
  high-collared navy cloak with a gold-trimmed lining, a round gold pendant with a blue stone, a red book in
  his hand. **Radnor** bald and heavy, thick brows drawn down over deep-set, heavy-lidded eyes looking up at
  you, a one-sided smirk, jowls, hands clasped with the fingers laced, a dark red-brown robe with a rolled
  cowl. **Ammon** narrow face, high cheekbones, slicked-back dark-brown hair, one brow raised and a closed,
  satisfied smile, a dark green robe over a teal high collar, an olive sash, a diamond pendant with a green
  stone, a ringed hand laid on his chest. One light rig for all three (warm or cold key light from the upper
  left, as the Sega screens; the chamber's light as a rim from behind on his right), so they read as a set.

## How the paintings were first made (round 1–3; replaced, see Review fixes)

Hand-placed soft shading (round 1–2) topped out at "airbrushed vector": the faces had no believable form.
So each Mentat is now built the way a 2.5D game artist works:

1. **Colour** (albedo) painted in layered SVG: flat local colours with soft colour zones (warm cheeks, nose
   and ears, cooler jaw), tapered hair locks and strands, eyes (shaded whites, iris fibres, limbal ring,
   lash line, lid crease), brows strand by strand, cloth grain, gold trim. `portraits-paint.js` is the kit
   (soft shapes, `strands`, `locks`, `eye`, `capsule` fingers, grain).
2. **Form**: a height field built from simple forms — the skull and the jaw as two smoothly joined domes, the
   brow ridge, eye sockets and eyeballs, the nose's bridge, tip and wings, lips, chin, cheekbones, folds; each
   outline (hair, collar, fingers, book) inflated into a rounded slab; hair locks as ridges; cloth weave as
   fine noise (`portraits-light.js` `addForms`).
3. **Light** (`shade`): a key light with a soft wrap and a warm subsurface band at the skin's terminator,
   cast shadows marched through the height field (the nose, brow, hair and chin throw real shadows), ambient
   occlusion in the hollows, warm bounce light in shaded skin, a dim fill, a rim light from behind that only
   reaches the silhouette, specular sheen from a material map (wet eyes, lips, gold, satin, hair).
4. **Finish**: a Kuwahara filter (blended 65 %) breaks the smooth CG gradients into small flat strokes, like
   a digital painting; a fine grain on skin and cloth.
5. **Bake** (`assets/campaign/portraits/bake.mjs`, headless Chrome): colour and material maps are rendered
   at twice the size, lit, finished, scaled down to 2.4 px per unit (sharp at 600 CSS px tall on a 2x
   screen; the chamber at 1.2), cropped and encoded as WebP; the layer boxes and head pivots go to the
   generated `src/ui/campaign/portraits-layers.js`. The game only loads the images (`portraits.js`).

## Design-skill guidance used

- **ui-ux-pro-max** design system for "retro sci-fi desert strategy game, 16-bit console remaster, dark
  gold": pattern *Immersive/Interactive Experience* (provide reduced-motion paths, preserve the final state
  when motion is reduced); style *HUD / Sci-Fi FUI* (dark, glow used sparingly). Style search
  ("dark fantasy game character art"): Dark Mode (OLED) — deep blacks, minimal glow; Pixel Art rejected (we
  remaster the look, we do not pixelate it). UX searches: *Reduced Motion* (High) → `prefers-reduced-motion`
  turns every idle animation off; *Excessive Motion* (High) → only one element moves and very little (a
  breath, ~1° of head turn, blinks); *Duration Timing* → each motion has its own slow period, none shared.
  Performance rules → WebP, fixed frame (no layout shift when the images arrive), no per-frame scripting.
- **Consistency** (brand skill's consistency checklist, "Imagery: consistent editing/filters"): one framing,
  one light rig, one finish and one layer structure for the three; colour accents by house (Atreides blue and
  gold, Harkonnen red-brown and fire, Ordos green, teal and gold).
- The design skill's logo/illustration routes need paid image APIs; none was used.

## Before / after

Screenshots (real GPU, `dune-shot` and a one-session multi-shot) in the session scratchpad `shots/`:
before — `art-portraits-before-atreides.png`, `-before-harkonnen.png` (1920x1080), `-before-ordos.png`
(1366x768), `art-portraits-before-sheet-1080.png`; after — `art-portraits-r1-*` (first bake, in game),
`art-portraits-r2-*` (second), `art-portraits-r3-*` (final), `art-portraits-r2-sheet-1080.png` (the three
at 1:1). Previews of every painting iteration (composed PNGs and face crops) in `art-portraits/p1 … p10`,
grey sculpt renders `art-portraits/clay-*.png`.

## Rounds (art director's critique)

1. Flat-vector repaint with soft shading: helmet hair, plastic faces, paper collars, pinstripe cloth, tiny
   fingers → switch to colour + form + light.
2. First lit render: mask-like faces (steep slab edges), blocky nose shadows, a big hair shadow on the
   forehead → deeper head volumes off-centre for the three-quarter turn, softer penumbras, a smooth union.
3. Grey-blue streaks down noses and temples: the "rim" light was really a side light → moved it behind the
   figure and occluded it through the height field; warm bounce light in shaded skin; shadow depth 0.72–0.78.
4. Radnor's egg-shaped skull, sausage fingers with ear-like thumbs → broader cranium, sleeve cuffs, varied
   finger lengths, nails and creases; Ammon's fist → an open hand on his chest; the backdrop's rounded
   vignette → straight soft fades at the sides and top.
5. In game, round 1 (1920x1080, 1366x768, 800x1000): Cyril's long, giraffe-like neck → a gold-trimmed high
   neckband under the collar; the lit skin clipped to white beside a dark nose flank that read as a dirty
   stripe (it measured warm brown, 114/83/70 — a contrast problem, not a hue one) → a lower key light, more
   bounce and shadow fill, wider nose ridges; closed eyes looked like sunken almonds → the blink's lid is one
   smooth, softly painted surface.
6. In game, round 2 (all three at 1920x1080, 1366x768, 420x860, 1280x540, the join and defeat stages): a
   seam where the lit side of the face met dark hair at the temple → a temple shadow in the paint and wispy
   sideburn strands across the edge.

## Measured

- Files: 12 WebP, about 370 KB together (largest 60 KB; every one under 300 KB).
- (Corrected in Review fixes: the SVG idle motion was not free. It forced about 60 style recalculations and
  layouts a second and repainted the four images every frame. The layers are now HTML images moved by
  transform and opacity only.)
- The blink, breath and turn run (their transforms change between samples); the four images load (non-zero
  boxes); no console errors on any screen shot.

## Layout seen (stage CSS is not this stream's)

- 1920x1080: the portrait (480 x 600 px) sits bottom-left in its 31 % column, the chamber fading into the
  stage; 1366x768: 390 px wide, fine; 800x1000: under the map beside the buttons; 1280x540: cut to 46vh,
  the bust still reads.
- 420x860 (phone): the Mentat is about 130 px wide beside the buttons, with ~100 px of empty space between
  the map and the foot — the stage could let him grow there (integration note).

## How to test

- `node --test tests/portraits.test.mjs`: the frame contract (fills its box, 400 x 500 frame fitted whole and
  standing on the bottom edge), the four layers per house (files exist, each < 300 KB, all < 2 MB, boxes in the
  frame, lids on the head), the face map (mouth, brows, eyes on the head and in order, the blink covering both
  eyes), compositor-only keyframes (transform and opacity, literal values) and the reduced-motion rule, the
  **neck seam**: the bake's decoded masks (hash-checked against the WebP files) show that the swaying head
  hides the body's neck root at rest, at both turn extremes and at the top of the breath. Also the scenes
  (every part present, deterministic), the camera, the hand rig and the finish passes.
- Bake again after changing a figure (about 1.5 min on the iGPU):
  `flock /tmp/dune-chrome.lock node assets/campaign/portraits/bake.mjs`
  (`--preview <dir> [--only house] [--crop x,y,w,h --scale 6] [--defines CLAY,NO_HAIR]` writes PNGs instead).
- Look: `?scene=menu&intro=0&screen=campaign-briefing&house=<atreides|harkonnen|ordos>&mission=1`.

## For the README

> **Mentat portraits.** Cyril, Radnor and Ammon are our own 3D figures, sculpted in signed distance fields
> (skull, jaw, nose, lips, ears, hair on the skull, hands posed joint by joint) and raymarched on the GPU at
> bake time with a dramatic key light, soft shadows, skin scattering, a rim light and ambient occlusion, then
> given a painterly finish (an anisotropic Kuwahara filter) and baked to WebP layers by
> `assets/campaign/portraits/bake.mjs`. On the briefing he breathes, turns his head a little and blinks
> (compositor-only; still under reduced motion), before his house's chamber: Caladan's sea window, the
> Harkonnen foundry, the Ordos ice hall.

## Review fixes

The review (7 findings) said the faces read as CG masks with Cyril and Ammon sharing one face, Radnor's neck
showed a box seam, the hands and bodies were off-model, the idle motion was not free, the portrait read as a
rectangular card, the closed lids looked pasted on, and the tests guarded structure only. The 2.5D relief
(flat outlines inflated into a height field) could not fix the first three, so the figures were rebuilt in 3D.

**Method.** `portraits-sdf.js` (GLSL kit, camera, hand rig, renderer) and `portraits-head.js` (a head blocked in
like a sculptor's: cranium with flat temples, frontal bone, cheekbones and arches, upper and lower jaw, the soft
cheek, sockets under the brow ridge, eyeballs with lids that close by turning a plane, a crease over each lid,
nose with bridge, tip, wings, nostrils and its crease, lips round the teeth with the nasolabial fold, ears; hair
as a shell on the skull with a hairline traced round the head, combed in ridges; the face's colour zones, brows
hair by hair, lash lines, age lines, stubble). Each Mentat file sets his own numbers and forms; the bake
raymarches body, head and closed-eyed head in GPU Chrome, then the anisotropic Kuwahara finish
(`portraits-finish.js`, three GPU passes) turns smooth CG shading into strokes that follow the forms.

| Finding | Fix |
| --- | --- |
| Radnor's box neck (important) | Necks are real columns with cords, in the head layer; the body keeps only a thinner stub inside it, hidden by the collar. A test decodes the baked masks and checks the head covers the stub at rest, at both turn extremes and at the top of the breath (≤ 0.1 % of stub pixels may show, 2 px edge slack). |
| Masks; Cyril and Ammon one face (important) | Three different skulls and faces from one anatomy: **Cyril** a lean counsellor past his first youth, swept-back blond hair greying at the temples, blue eyes, nasolabial lines; **Radnor** a domed bald skull, heavy brow ridge with thick brows pulled down to the nose, deep-set hooded eyes, fleshy hooked nose, jowls, a smirk lifting one corner, head lowered and turned to the map, lit from below by the furnace; **Ammon** a narrow long face, aquiline nose, high flat cheekbones, slicked dark hair from a widow's peak, chin lifted, a thin half smile. Noses have bridge, wings and cast shadows; ears and turned jaws come from the geometry; irises are smaller under shadowing lids. Light: a hard key from the map side (soft shadows), a dim warm or cold fill, a rim from behind, a dark shadow side. |
| Hands and bodies off-model (important) | Hands posed joint by joint (palm with tendons and knuckles, three bones per finger, thumb, wrist into a sleeve): Cyril's left hand over the book's cover, fingers together, thumb under; Radnor's fingers laced and opaque, forearms in wide sleeves; Ammon's right hand flat on his heart. Bodies have the trapezius slope, deltoids under the cloth, a chest, folds hanging from the shoulders; Radnor's collar is a low roll with lapels. |
| Idle motion not free (minor) | `portraits.js` now stacks HTML `<img>` layers in a container-query frame (same contract: fills `.cp-mentat-art`, frame fitted whole, bottom-centred) and animates transform and opacity only, with literal keyframe values and `will-change`. Measured (review's `perf.mjs`, 1920x1080, map running): style recalcs only (≈60/s, 0.07–0.09 s per 4 s), no layout from the portrait, TaskDuration 0.34–0.67 s running vs 0.33–0.53 s paused, average frame 16.6–17.1 ms vs 16.7–16.9 ms. Reduced motion (emulated): 0 running animations, lids hidden. |
| Rectangular card (minor) | The chamber fades radially into the stage (no bright pillar or window at the frame's edges) and the body fades out toward the sides and the bottom edge in the bake. |
| Pasted lids (minor) | The closed eyes are the same head rendered with the lids down (same light, same finish), cut round each eye with a soft mask sized from the eye's box: crease and lash line, no halo. |
| Tests structure only (minor) | Seam coverage test (above), the face map test, the compositor-only motion test, scene and rig tests. |

**Rounds** (scratch shots `shots/art-portraits-f2…f7-*`): f2 first full bake (faces read, but plastic and the
neck stub showed: seam test caught it, stub made thinner); f3 the anisotropic Kuwahara finish (strokes along the
forms); f4 matte cloth with uneven dye, Cyril's gold piping, the collar's own material; f5–f6 painterly skin
zones (yellow forehead, red cheeks, cool jaw, violet sockets), warm translucent cast shadows on skin, Radnor
heavier brows and smirk, finer slick hair for Ammon; f7 Cyril aged a little (deeper folds, grey temples).
Checked on the real GPU at 1920x1080 and 1366x768 for all three houses, a 420x860 window, the join and
defeat stages, and the blink forced on with the head at its turn extreme: no console errors.

**Where the face's moving parts sit** (for the agent animating mouth and expressions). The generated
`src/ui/campaign/portraits-layers.js` has `features` per Mentat in frame units (400 x 500); here they are as
pixel boxes `x, y, w, h` inside the baked layers (2.4 px per frame unit; left and right as seen). The eyes'
boxes include both lids; the closed lids live in `<house>-lids.webp`.

| Mentat (head layer) | Mouth (head px) | Brows L / R (head px) | Eyes L / R (head px) | Eyes L / R (lids px) |
| --- | --- | --- | --- | --- |
| Cyril (`atreides-head.webp`) | 158, 393, 121, 74 | 110, 215, 115, 51 / 250, 226, 89, 43 | 127, 250, 73, 57 / 260, 257, 72, 56 | 18, 19, 73, 57 / 151, 26, 72, 56 |
| Radnor (`harkonnen-head.webp`) | 157, 445, 156, 84 | 117, 229, 136, 86 / 279, 249, 114, 68 | 134, 270, 87, 65 / 294, 282, 86, 65 | 19, 20, 87, 65 / 179, 32, 86, 65 |
| Ammon (`ordos-head.webp`) | 155, 386, 121, 61 | 76, 191, 119, 45 / 224, 190, 101, 39 | 99, 228, 75, 57 / 241, 223, 74, 57 | 18, 24, 75, 57 / 160, 19, 74, 57 |

The head layer is separable: it turns about `pivot` (frame units) and can take extra layers on top inside
`.cpm-sway` (the lids already sit there). For new mouth shapes or brow poses the cleanest path is to bake
them as further head variants: `headGLSL` takes `mouth.open`, `mouth.smirk`, `eye.up` (and the brows' `tilt`
and `arch` in `faceColourGLSL`), and the bake's lids pass shows how a variant is cut out with a soft mask.

**Not fixed / limits.** The faces are now three distinct, lit sculptures with a painted finish, but they still
read as stylised 3D renders rather than hand-painted illustration; a further step would be hand-placed
highlight and colour strokes on top of the bake. The finish and the raymarch run only at bake time (the game
loads 348 KB of WebP).
