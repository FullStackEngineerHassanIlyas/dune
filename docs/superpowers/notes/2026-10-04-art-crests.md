# Art pass — crests stream (the house crests)

Branch `phase3/art-crests`, from 578beeb. The manager: the house logos looked very low quality. Research.md §4
(the emblems: Atreides gold-framed shield with a blue-green hawk, Ordos green serpent on a pale shield, Harkonnen
ram's head; the Sega house selection frames them in three ornate gold frames, left to right Atreides, Ordos,
Harkonnen). Reference images were looked at for mood only; nothing was traced or copied.

## What changed

`crestSvg(house)` keeps its name and its contract (an `<svg class="cp-crest-art" role="img" aria-label>` string
for innerHTML, filling its box), so `src/ui/campaign/index.js` and the house selection work unchanged. Inside, the
crest is now premium heraldry drawn procedurally and lit from the top left:

- **Frame**: a carved gold moulding (mitred sides with a profiled gradient: lip, groove, rounded torus with a cable
  twist, a row of pearls at the sight edge, fine metal grain), scallop-shell corners with C-scrolls running along
  the sides, a shell cartouche mid-side, and cabochon jewels in beaded bezels in the house colour (sapphire,
  emerald, ruby; amethyst, citrine, amber for the minor houses). Right and bottom sides sit in shadow.
- **Field**: house-coloured enamel with a diaper lattice, a vignette and the frame's shadow falling on it.
- **Shield**: a heater shield with a bevelled steel rim (dark iron for Harkonnen) and 24 rivets, a gold fillet, the
  enamel recessed under a glassy sheen over engine-turned (guilloché) lines: a sunburst for Atreides and the
  Sardaukar, a rosette for Ordos and the Fremen, rings for Harkonnen and the Mercenaries. Harkonnen's crimson has
  a black border.
- **Charges** (cast-metal relief from a lighting filter whose height map is the drawing's brightness plus its
  outline, so engraved lines read as grooves; an inner shadow, highlight and thin rim light give the bodies
  volume):
  - Atreides: a gold hawk displayed — 17 flight feathers per wing fanned from the arm, rows of coverts, scalloped
    breast feathers, a barred tail, talons, a falcon's head in profile with a hooked beak and the malar stripe.
  - Ordos: a green serpent rearing in an S over its coiled tail — a tapering scaled tube, yellow belly scutes,
    dark diamonds down the back, a viper's head with brow scale, slit eye, fangs and a forked tongue.
  - Harkonnen: a ram's head full face — warm dark-iron horns as tapering spirals with doubled growth rings, a
    steel face with wool curls, a dark mask round burning orange eyes.
  - Sardaukar (the Emperor's): a gold lion's face in a mane of flame-like locks on purple.
  - Mercenaries: crossed steel swords over a gold coin on black.
  - Fremen: a crysknife in a sandworm's maw (two rows of curved teeth round a dark throat) on sand.
- **Two variants**: `framed` (default, the house selection, anything from ~120 px) and `shield` (`{ variant:
  'shield' }`, 4:5, the shield alone without engraving, for badges down to 48 px). `detail` overrides the
  engraving either way. `crestArt(house, opts)` returns the standalone SVG document (unique ids per call, so it can
  go inline too); `svgDataUrl(svg)`, `CREST_HOUSES`, `CREST_STYLES`, `VIEWBOX` are exported.

Files: `src/ui/campaign/crests.js` (styles per house, the public API), `crests-frame.js` (filters, gradients,
frame, field, shield), `crests-charges.js` (the six charges), `crests-geometry.js` (smooth paths, spline sampling,
tubes, feathers, spirals, mirror, colour shading). Tests: `tests/crests.test.mjs`.

## Decisions

- **Vector SVG, not a pre-rendered bitmap or a Three.js emblem.** It stays sharp at every size and zoom, needs no
  asset files (each crest is 41-80 KB of markup, no images), and works in Node tests. The lighting filters give it
  the cast-metal look a 3D render would.
- **The art is an image inside the crest's `<svg>`** (a `data:` URL in an `<image>`). Measured in Chrome on the
  house selection at 1366x768 while the cards hover (transform + drop-shadow change each frame): inline SVG
  re-ran every filter on every frame (median 34-58 ms a frame, p90 65-143 ms); as an image the browser rasterises
  each crest once and reuses it (steady median 16.7-18 ms, the same as a plain rectangle). The first raster of the
  three crests costs a few hundred ms once (more under heavy load). The outer `<svg>` keeps class, role and label,
  so CSS (`.cp-crest svg`) and the screen reader see the same element as before.
- **Fewer filter passes**: the frame's ornaments, cartouches and corners share one relief pass; rivets share the
  rim's; brushed-steel noise was dropped (it did not show at display size). Guilloché uses `<circle>` elements
  and each body outline is defined once and reused by its fill, clip and shading (Ordos fell from 124 KB to
  53 KB). Framed crests are 41-80 KB of markup, bare shields 15-47 KB.
- **Consistency across houses**: one frame, one shield shape, one light direction, one relief filter; houses
  differ in enamel, jewels, rim metal and charge material (gold hawk, green-and-yellow serpent, iron ram).
- **Heraldic placement**: every charge stays inside its shield (the hawk's wingtips touch the rim), centred
  optically; the shield sits in the frame with room for its shadow.
- **Small sizes**: the `shield` variant leaves out rivets, feather veins, breast scales, horn rings and engine
  turning, which turn to mush below ~96 px; at 46x58 px the hawk, ram and serpent still read (shot below).
- **No animation** was added (nothing to reduce for `prefers-reduced-motion`); hover effects stay in campaign.css.

## Design guidance used (skills)

- **ui-ux-pro-max**: `--design-system "retro sci-fi desert strategy game, 16-bit console remaster, dark gold"`
  returned *Immersive/Interactive* + *HUD / Sci-Fi FUI*; the FUI look (wireframe, neon) suits HUDs, not heraldry,
  so for the crests I took the style domain's **3D & Hyperrealism** entry (gaming; skeuomorphic, realistic
  lighting, layered shadows; gold, silver, burgundy, navy) and the colour domain's *dark + gold accent* palettes.
  UX rules applied: meaningful images keep a text alternative (role="img" + aria-label per crest); image
  performance (rasterise once, no per-frame work, markup budget tested); consistency of style across items;
  reduced motion (no motion added); responsive (checked at 1920x1080, 1366x768 and badge size). Typography: the
  crests carry no text (the plaque is HTML, styled by campaign.css).
- **design** (logo reference, logo style guide): *Emblem* and *Crest/Heraldic* styles (shield, enclosed symbol,
  metallic accents) with *Luxury/Premium* finish (foil, emboss); its **scalability checklist** (recognisable small,
  no tiny details that vanish when scaled) led to the `shield` variant without engraving. No AI or paid image API
  was used; everything is our own procedural drawing.
- **brand** (consistency checklist): one palette per house used everywhere (jewels, enamel, field), consistent
  logo versions (framed / shield), clear space inside the frame.

## Art-director rounds (screenshots in the scratchpad, not committed)

Scratch dir: `/tmp/claude-1000/-home-hassan-games-Dune/4a2127ac-cad7-477b-b1e2-a8fc90205fa5/scratchpad/`.

- Before: `shots/art-crests-before-1920.png` — flat shapes: a stick-figure blue bird, an S with dashes, a red
  ram outline, a plain gold square frame with dots. Before/after side by side: `shots/art-crests-before-after-1920.png`.
- Round 1 (`art-crests/g1.png`, `g1-at.png`): lighting filters in; critique: thin frame with spiky sun corners,
  steel rim reads as white plastic, parrot-headed hawk with stick feathers, cartoon serpent, horse-faced ram.
- Round 2 (`g2*.png`): chunkier frame, chrome-like rim, guilloché, falcon head, viper head, shorter ram face;
  critique: corners look cheap (spiky leaves, arrowheads, wormy tendrils), pineapple breast scales, the serpent's
  tail spills over the rim.
- Round 3 (`g3*.png`, Chrome `shots/art-crests-r3-1920.png`): scallop-shell corners and cartouches, luminance-based
  relief on ornaments, finer breast feathers, 17 overlapping flight feathers, more metal contrast; critique: the
  serpent and the ram's face read flat, horns and face the same grey.
- Round 4 (`g6*.png`, `g7-minor.png`, Chrome `shots/art-crests-r4-1920.png`, `-1366.png`): inner shadow and
  highlight on the bodies, warm dark-iron horns, the minor houses' crests reworked (a worm's maw, a lion with
  pupils); then a thin rim light. Final: `shots/art-crests-final-1920.png`, `shots/art-crests-final-1366.png`.
- Badge size on real screens (injected at run time, no file of another stream changed):
  `shots/art-crests-skirmish-badge-1366.png` (46x58 px in the skirmish house cards),
  `shots/art-crests-join-badge-1920.png` (40x50 px beside the join page's kicker).

## How to test

- `node --test tests/crests.test.mjs` (9 tests: every house, both variants, well-formed art, every `url(#id)` and
  `href="#id"` resolved, unique ids, colours per house, caching, markup budget, data URL escaping, geometry).
- The full suite: `flock /tmp/dune-npmtest.lock npm test` (1354/1354 at cc45421, the last code commit).
- Look: `?scene=menu&intro=0&screen=campaign-house` at 1920x1080 and 1366x768; hover each card (the glow and lift
  stay smooth).

## For the README

- The house selection's crests are our own procedural heraldry: a carved gold frame with shell corners and
  jewels in the house colour, a steel-rimmed heater shield over engine-turned enamel, and the house's charge in
  cast-metal relief lit from the top left: the Atreides gold hawk on blue-green, the Ordos green serpent on a pale
  field, the Harkonnen iron ram on crimson. The Sardaukar (lion), the Mercenaries (crossed swords) and the Fremen
  (a crysknife in a sandworm's maw) have crests too, and every crest has a small shield-only version for badges.

## Review fixes

The review (shots in `scratchpad/review-art-crests/`) found block-shaped render glitches at HiDPI and large sizes,
and four art weaknesses. Shots of this round: `scratchpad/art-crests/fix/`.

- **Glitches (important), fixed by baking.** Reproduced on the real GPU (Chrome, ANGLE/GL): at 600 px the ram's horn
  curls and the frame showed grey and red blocks and small dark "L" marks (`before-600.png`, `c-ram-600.png`); in
  software raster (`--disable-gpu`) the same art is clean (`t1-sw-600.png`), so it is Chrome's GPU raster of SVG
  filters, not the art. Steps tried:
  1. The reviewer's fix: the charge's contact shadow is no longer a filter wrapped round its relief filter but a
     blurred, offset copy of the charge beside it (`<use href=#charge filter=shade>` under `<g filter=relief><use
     href=#charge>`; a test keeps any filter from wrapping the relief). The charges came out clean (`v1-great-600.png`),
     but the frame's "L" marks and a grey smear beside the ram's shield remained, at 600 px and at DPR 2 on the house
     selection (`v1-zoom.png`, `v1-h2-ram.png`): the GPU raster also mangles the frame's and rim's lighting filters.
     (Folding the shadow into the relief filter instead made it far worse: `e1-600.png`.)
  2. Baking in the page on a CPU canvas was clean (`v2-baked-600.png`) but took 1-10 s of main thread per crest (the
     software lighting and turbulence filters at 800 px): dropped.
  3. Kept: the crests are baked once, offline, to WebP (`assets/campaign/crests/bake.mjs`, software raster in headless
     Chrome, drawn at 2x and scaled down, 1.6 px per unit: 640 px framed, 397x496 shield), listed with their art's
     fingerprint in `src/ui/campaign/crests-baked.js`. `crestSvg` keeps its contract (an `<svg class role
     aria-label>` with the picture as an `<image>`); the picture is now the baked WebP, so nothing on the page runs
     a filter at all (hover stays a plain bitmap). Looks that are not baked (`detail` against the default) still
     show the vector art. `tests/crests-baked.test.mjs` fails when the art changes without a new bake, and checks
     the files and the size budget. This replaces the first pass's decision to ship the crests as vector only.
     The twelve pictures are 900 KB in all (framed 109-118 KB, shields 29-43 KB).
  Confirmed on the real GPU with the baked crests: 600 px at DPR 1 and 2 (`v3-live-600.png`, `-dpr2.png`), the
  house selection at 1920x1080 and 1440x900 at DPR 2 and at 1920x1080 and 1366x768 at DPR 1 (`v3-house-*.png`):
  no blocks, smears or marks; zoomed where they were (`v3-zoom.png`).
- **Ram (minor), fixed.** Dark iron face, a short wedge with a Roman-nose ridge, a heavy ridged brow sloping to the
  nose, narrow slit eyes that glow (drawn over the relief light with a soft halo), two rows of heavy layered locks
  on the poll, slit nostrils on a blunt dark muzzle. Before `review-art-crests/zoom-1920-2.png`, after
  `fix/c-ram1c.png` and `fix/v2-h1920-crop.png`.
- **Ordos (minor), fixed.** Ivory enamel (`#f2f0d8`/`#d0dabf`) instead of white; the rosette engraved in dark green
  at a visible strength, its plain heart (the "sheen blob": the rosette's circles left an empty disc) filled with a
  small rosette; the serpent 15 % larger on a new spine that fills the shield (neck high to the right, body across
  to the left, the tail coiled where the shield narrows), slim behind the head and swelling to mid-body before it
  tapers. Before `review-art-crests/zoom-1920-1.png`, after `fix/ff-or2.png`.
- **Hawk (minor), fixed.** Breast feathers in bowed rows that grow from the throat to the belly; a ruff of hackles
  at the neck; the legs tucked under the body (feathered thighs, feet gripping, talons curled); the wing's leading
  edge bows up from the shoulder, its lesser coverts small rounded feathers instead of a zig-zag. Before
  `fix/c-hawk0.png`, after `fix/c-hawk1.png`.
- **Sardaukar and Mercenary (minor), the cheap part fixed.** The lion's face is stern (brows drawn down, a closed
  muzzle with whisker pads and down-turned corners) in a heavier mane of three rows of locks swept down the sides,
  longer towards the chin (`fix/ff-lion3.png`); the shield version's sword blades are broader so the swords still
  read at 48 px (`fix/ff-small.png`).
- **Narrow screens (minor), not mine to fix**: index.js and campaign.css belong to the campaign stream; the change is
  under integration notes below, tried at 390 px by injecting it at run time (`fix/v3-house-390.png`: the
  shields are 121x151 px, the charges about twice as wide as in the framed crest).

### Integration notes (for the owners of index.js, campaign.css, serve.mjs)

- House selection on narrow screens (index.js:282 and campaign.css): put both looks in each card and let CSS pick
  the bare shield at 620 px and below, where a card is ~120 px and the frame would take half of it:
  `art.innerHTML = crestSvg(id) + crestSvg(id, { variant: 'shield' });` and
  `.cp-crest .cp-crest-shield { display: none; }` plus, inside `@media (max-width: 620px)`,
  `.cp-crest { aspect-ratio: 4 / 5; } .cp-crest .cp-crest-art:not(.cp-crest-shield) { display: none; }
  .cp-crest .cp-crest-shield { display: block; }`.
- serve.mjs has no `.webp` type, so it serves the crests (and the portraits) as `application/octet-stream`;
  browsers sniff images so they show, but `'.webp': 'image/webp'` belongs in its TYPES.

### How to test (after the review)

- `node --test tests/crests.test.mjs tests/crests-baked.test.mjs` (15 tests; new: no filter wraps the relief, the
  ram's glow, the baked pictures are listed, fresh, WebP and within budget, and the game shows them).
- After changing a crest's art: `flock /tmp/dune-chrome.lock flock /tmp/dune-heavy.lock node assets/campaign/crests/bake.mjs`
  (about 30 s; `--only <house>`, `--preview <dir>`).
- The full suite: 1360/1360 (`flock /tmp/dune-npmtest.lock npm test`).

Design guidance this round: ui-ux-pro-max style search (`"3D hyperrealism skeuomorphic gaming"` returned *3D &
Hyperrealism*, as in the first pass; `"heraldic emblem metallic emboss"` returned Y2K, off-topic, not used) and its
UX entries *Image Optimization* (WebP, the right size: 1.6 px a unit for a card of at most 300 CSS px at 2x) and
*Image Scaling* (the pictures fill their box at any width).
