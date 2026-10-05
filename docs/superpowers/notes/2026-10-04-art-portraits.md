# Art — the three Mentat portraits, painted and lit

Branch `phase3/art-portraits` (from `578beeb`). The manager: "the briefing character models (the Mentat
portraits) are very low quality … use the ui-ux-pro-max skill to design or build them." Research
`p3map/research.md` §4 (the Mentats' looks: Cyril, Radnor, Ammon). Reference images were looked at for
mood only; nothing is traced or copied (CLAUDE.md lessons: our own art, facts only).

## What changed

- **Before**: `portraits.js` drew each Mentat as ~40 flat SVG shapes (one gradient per part, outlined
  features, a cartoon look).
- **After**: each Mentat is a painting with real form, shown as four baked WebP layers stacked in the same
  SVG frame the briefing already sizes (`viewBox 0 0 400 500`, `preserveAspectRatio xMidYMax meet`, class
  `cp-mentat-art`; `mentatSvg(house)` keeps its name and contract, so `stage.js`/`index.js` are untouched):
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

## How the paintings are made (and why)

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
- The idle motion costs nothing measurable: on the briefing (WebGL map running) the average frame was
  17.2 ms with it and 19.4 ms with every portrait animation switched off (noise; p95 16.8 ms, 60 fps).
- The blink, breath and turn run (their transforms change between samples); the four images load (non-zero
  boxes); no console errors on any screen shot.

## Layout seen (stage CSS is not this stream's)

- 1920x1080: the portrait (480 x 600 px) sits bottom-left in its 31 % column, the chamber fading into the
  stage; 1366x768: 390 px wide, fine; 800x1000: under the map beside the buttons; 1280x540: cut to 46vh,
  the bust still reads.
- 420x860 (phone): the Mentat is about 130 px wide beside the buttons, with ~100 px of empty space between
  the map and the foot — the stage could let him grow there (integration note).

## How to test

- `node --test tests/portraits.test.mjs` — the frame contract, the four layers per house (files exist,
  each < 300 KB, all < 2 MB, boxes inside the frame, lids on the head), the idle classes and the
  reduced-motion rule, the paintings deterministic and well formed (unique ids, no NaN), the light (a dome lit
  from the upper left, its cast shadow), the outline fill and the painter's finish.
- Bake again after changing a painting:
  `flock /tmp/dune-heavy.lock flock /tmp/dune-chrome.lock node assets/campaign/portraits/bake.mjs`
  (`--preview <dir>` writes composed PNGs instead; `--only <house>` bakes one).
- Look: `?scene=menu&intro=0&screen=campaign-briefing&house=<atreides|harkonnen|ordos>&mission=1`.

## For the README

> **Mentat portraits.** Cyril, Radnor and Ammon are our own paintings: each is drawn in layered SVG
> (colour), modelled as a height field (form) and lit like a sculpture (key light, cast shadows, skin
> scattering, rim light), then finished with a painterly filter and baked to WebP layers by
> `assets/campaign/portraits/bake.mjs`. On the briefing he breathes, turns his head a little and blinks
> (still under reduced motion), before his house's chamber: Caladan's sea window, the Harkonnen foundry,
> the Ordos ice hall.
