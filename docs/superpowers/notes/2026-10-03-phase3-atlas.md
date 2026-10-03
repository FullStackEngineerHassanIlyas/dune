# Phase 3 — the territory map of Arrakis (spec §5.8, contract C5)

Branch `phase3/atlas`, from `phase3/integration` (`dc2061e`). Research read first: research.md §3 (the PC
region data) and §6 (the Sega map: a tilted 3D map of Arrakis whose three coloured territories grow with
progress, no choice; after the briefing an about 7 s zoom onto the target region), and the two Sega screenshots
`genesis-screenshot-mentat-*-map.png`. The numbers come from the PC's REGIONA/H/O.INI on the open mirror
(github.com/katlogic/dunelegacy, `data/`); no text, picture or shape of the original is in the repo.

## Plan (each step with its proof)

1. `src/data/territory.js` facts: who holds which region after each mission, each mission's region —
   `tests/atlas-territory.test.mjs`.
2. `src/data/territory.js` shapes: 27 region polygons of our own — `tests/atlas-geometry.test.mjs`.
3. Pure render helpers: `src/render/atlas/raster.js` (region ids, border distance field) and
   `camera-path.js` (overview, zoom, drift) — `tests/atlas-raster.test.mjs`, `tests/atlas-camera.test.mjs`.
4. `src/render/atlas/index.js` + `shaders.js`: `createAtlas` — real-GPU screenshots, frame times, context loss,
   dispose and reduced motion checked in Chrome.
5. `src/scenes/atlas.js` dev scene + `scripts/scenarios/atlas.mjs` — the six smoke scenes pass.

All done; atlas tests 22/22, `npm test` 919/919.

## Data (src/data/territory.js)

- `MAP` = 200 × 100 map units (x east, y south). `REGIONS[i]` = `{ id, polygon, centre, area, neighbours, pole }`.
- **Shapes**: a Voronoi partition of 27 hand-placed centres whose layout follows the PC map's order of the land
  (Harkonnen north, Atreides west and south-west, Ordos east and south-east; regions 1–6 along the north pole,
  20–24, 26, 27 along the south), every shared border replaced by the same meandering polyline seen from both
  sides (an envelope that tapers to the corners, so borders never cross). Generated at import (< 5 ms), pure.
  Not a tracing of the original bitmap: only the region numbers' rough order comes from the data.
- **Steps count missions won** (0–9). Step 0 is the opening map: the houses' first claims (PC `[GROUP1]`).
  Step s applies `[GROUP1]`..`[GROUPs]` cumulatively. Two consequences of the data, kept as they are:
  - step 1 = step 0 (mission 1 is fought at home and takes no land), so `conquer({ step: 1 })` resolves at once;
  - step 9 = step 8 (there is no `[GROUP9]`): only the Emperor's region stands against the player (A 6, H 15,
    O 4). The final victory belongs to the ending (the planet turns the victor's colour, C12).
- `ownership(house, step)` → `{ atreides, harkonnen, ordos, sardaukar }` id lists; `ownerOf(house, step, id)`;
  `changes(house, step)` → `[{ id, from, to }]` (for captions); `HOME`; `regionAt(x, y)`; `STEPS`.
- `targetRegion(house, mission)`: mission 1 = the house's first home region (the first of its opening claim:
  A 13, H 6, O 19). Missions 2–9 = the first REG choice of the previous step's group **that a rival holds**,
  else the first choice. Only one mission differs from "the first REG choice": the Atreides' mission 2 is
  region 23 (Ordos-held, the third choice) rather than 8 (unclaimed) — the Sega's mission-2 enemy is the
  Ordos, and the zoom then lands on their colour. The Harkonnen's and the Ordos's mission-2 choices are all
  unclaimed land, so their targets (1 and 15) are plain sand. From mission 3 on every target is held by one of
  that Sega mission's enemies (tested against research.md §6's table); mission 9 is the Sardaukar's region.

| Mission | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Atreides | 13 | 23 (O) | 1 (H) | 4 (H) | 17 (O) | 10 (H) | 19 (O) | 5 (H) | 6 (S) |
| Harkonnen | 6 | 1 (–) | 17 (O) | 25 (O) | 13 (A) | 24 (O) | 20 (A) | 16 (O) | 15 (S) |
| Ordos | 19 | 15 (–) | 14 (A) | 13 (A) | 11 (H) | 1 (A) | 10 (H) | 3 (A) | 4 (S) |

## Renderer (src/render/atlas/)

`createAtlas(container, { quality, reducedMotion?, inset?, measure? })` →
`{ show, zoomTo, conquer, resize, dispose, debug }` (C5) plus `hide()`, `setInset()`, `canvas`, `ready`.

- Its own canvas (`.atlas-canvas`, fills the container: give the container a size and a position) and its own
  `THREE.WebGLRenderer` (alpha, no tone mapping: the house colours stay as `HOUSES` gives them; the dark
  backdrop is CSS in `atlas.css`, so a screen can restyle it).
- **Relief**, baked once on the GPU: pass 1 computes the terrain (height, rock, canyon, ice) into a half-float
  target, pass 2 the colour with the sun's light (from the north-west, the map's top left), hollows darkened
  (a ring of eight samples) and the height in alpha, into an sRGB target with mipmaps. The surface is one grid
  mesh lifted by that height in the vertex shader: one draw call. Open sand with seas of dunes, rock lands with
  ridged mountain ranges and canyons, eroded ground everywhere, ice caps of ragged outline at both poles.
  - The noise is a 256² half-float texture of seeded random values (one filtered read per octave). A hashed
    gradient noise in code first took the driver 1.9 s to compile on the Intel GPU; the texture brings it to
    0.06–0.3 s, and `compileAsync` (KHR_parallel_shader_compile) keeps even that off the main thread.
- **Regions**: an id texture (scanline-filled from the polygons, nearest) and a distance field to the borders
  between regions (distances to the polygons' own edges, linear), both 2048 × 1024 (Low 1024 × 512), made once a
  page and kept for the next atlas. The shader tints each region by its owner (keeping the relief's light), draws
  dark borders at least a screen pixel wide and never thinner than a region texel (which hides the id texture's
  steps), and makes the target pulse: the whole region brightens and a gold rim runs inside its border.
- **Camera** (`camera-path.js`, pure): the overview fits the whole map (or the inset) and centres it; an idle
  drift (incommensurate slow waves, about ±3° of yaw) keeps it alive. The zoom eases in and out (cubic) from
  wherever the camera is onto the region's pose: the aim turns a little ahead of the dive, the distance closes
  geometrically.
  The drift's weight eases from 1 to 0.5 along the zoom, so nothing jumps. A region at the map's edge: the view
  slides inwards until the picture is all map, as far as keeps the region's centre within 0.6 of the middle.
- **Conquest**: each region that changes hands floods in its new owner's colour from the point of its outline
  nearest that owner's closest land (or its centre), a bright front leading; the player's gains first, 0.45 s
  apart, at 0.22 map heights a second (at least 1.1 s each); then a 0.6 s hold, and the next mission's region
  pulses.
- **Only while shown**: `show`/`zoomTo`/`conquer` start the frame loop, `hide()`/`dispose()` stop it; a hidden
  canvas (no size) is not drawn. Reduced motion (`prefers-reduced-motion`, or the option): no drift or pulse, the
  zoom cuts to the region (its promise still takes `seconds`), the conquest shows the new map at once (held
  0.8 s), and frames are drawn only when something changes.
- **Context loss**: the loop skips drawing while lost; on restore three.js re-uploads the data textures and the
  relief is baked again (checked with `WEBGL_lose_context`: the map comes back as before).
- `dispose()` cancels the loop, resolves pending promises with `false`, removes its listeners and observer, frees
  geometry, materials, textures and targets, disposes the renderer, drops the context and removes the canvas
  (checked: zoom promise → `false`, no `.atlas-canvas` left, no console errors).
- No per-frame allocation: poses, drift and flood state are written into objects made once; uniforms are
  updated in place.

## Measurements (Intel ADL GT2, Mesa, ANGLE/GL, headless Chrome, 1920 × 1080, 10 s after warm-up)

GPU time from `EXT_disjoint_timer_query_webgl2` (`?gpu=1`, `debug().gpuMs`); frame interval rAF to rAF.

| Preset | GPU ms mean (p95) | Frame ms mean (p95) | Draws · triangles | Textures | Pixel ratio |
|---|---|---|---|---|---|
| Medium | 2.31 (3.30) | 16.86 (16.8) | 1 · 65.5k | 2048 × 1024 | 1 |
| Low | 1.15 (2.07) | 17.19 (16.8) | 1 · 25.6k | 1024 × 512 | 0.75 |

Creation: region rasterisation 0.14–0.17 s of main-thread JS on the first atlas of a page (cached after);
shader compile 0.06–0.3 s off the main thread; the bake itself 35 ms + 24 ms of GPU (Medium, measured with
`gl.finish`), 24 + 12 ms (Low). GPU memory: Medium ≈ 16 MB (relief 11 MB with mipmaps, ids 2 MB, borders 2 MB),
Low ≈ 4 MB.

## How to test

- `node --test tests/atlas-*.test.mjs` (territory data, geometry, region textures, camera path).
- Dev scene: `?scene=atlas&house=ordos&step=3` (the map after 3 missions, mission 4's region pulsing);
  `&zoom=4` (the dive, `&seconds=`, `&hold=0.5` stops it half-way); `&conquer=1` (the land won at `step` floods
  in); `&inset=0.32,0,0.22,0` (left, right, top, bottom kept clear); `&still=1` (reduced motion); `&gpu=1` then
  `__dune.debug()` for GPU times; `&quality=low|medium|high`.
- Smoke: `SMOKE_PORT=8680 node scripts/smoke.mjs atlas-atreides-0 atlas-harkonnen-4 atlas-ordos-8 atlas-zoom
  atlas-conquer atlas-still`.

## For the campaign stream (how to use it)

```js
const atlas = createAtlas(mapElement, { quality: settings.quality });   // mapElement: positioned, sized
atlas.show({ house, step: mission - 1 });            // house page and briefing: the map after mission - 1 wins
await atlas.zoomTo({ house, mission });              // after the briefing: ~7 s onto the mission's region
await atlas.conquer({ house, step: mission });       // after a win: the land taken floods in
atlas.hide();                                        // leaving the map screens (or dispose())
```

`{ inset: { left, right, top, bottom } }` (or `setInset`) keeps the map clear of a Mentat portrait or text box,
as on the Sega screen. Pass `reducedMotion` if the game has a setting for it; the default follows the system.

## Open questions

- Step semantics: steps count missions won (so `step 9` = after the final mission = `step 8`, as the data has no
  ninth group). If the lead wants the final victory flooded on the map, `ownership(house, 9)` can hand the
  Emperor's region to the player (one line in `territory.js`, and the test that step 9 still shows it changes).
- The Sega's own territory layouts differ from the PC's (its screenshots show other placements per house); the
  brief asks for the PC groups, which are what is used.

## For the README

**Territory map.** Between missions the campaign shows a tilted relief map of Arrakis — sand seas, eroded rock
lands, mountain ranges and both ice caps — divided into 27 regions in the houses' colours (Atreides blue,
Harkonnen red, Ordos green, the Emperor's Sardaukar purple). As on the Sega game the territories grow with every
mission won: the land taken floods in the house's colour, the region of the next mission pulses, and after the
briefing the view dives onto it. Who holds what after each mission follows the original game's region data; the
map itself is drawn by the game. Open `?scene=atlas&house=ordos&step=3&zoom=4` to see it on its own.
