# Genesis-detail models — execution notes

Branch `feat/detailed-models` (from master `b1182f3`). Brief:
`docs/superpowers/specs/2026-09-30-genesis-detail-models.md`. Research:
`docs/research/raw/visual-structures.md`, `docs/research/raw/visual-units.md` (reference images in
`docs/research/refs/`, private and gitignored). Uncommitted at the time of writing.

## What changed

- **Every unit and structure model was rebuilt** after the Mega Drive sprites: layout, palette and
  silhouette from the sprite, real 3D sides, three levels of detail (masses, secondary forms,
  greebles). 38 models; the Sandworm has a model now (registered, not yet spawned by the sim).
- **Kit** (`kit.js`): `cbox` (chamfered box), `hull` (convex hull, vendored `ConvexGeometry`),
  `frustum`, `ring`, `geodesic`, `place`; `ModelBuilder.build({ shade })` bakes contact shading into
  the vertex colours (side faces darken near the ground; `shade: false` for aircraft).
- **Shared pieces** (`detail.js`): foundation plate, the house orb with its circling glint (on the
  `fan` param), pipes with flanges, grilles, round grilles, louvres, ladders, railings, hazard bands,
  stud grids, bolts, wheels, track units, `halfArc`. `structures/common.js` is gone.
- **Materials**: triplanar model-space grime on lit materials; the HOUSE material paints the Genesis
  three-tone ramp (`HOUSE_RAMP` in `palette.js`, picked by the instance's house colour and lit from
  the north-west in world space; a vertex colour above white lifts a part to the highlight tone, as on
  the Ornithopter's wings); tread links take a vertex colour and are Genesis blue-black.
- **Terrain**: placed concrete slabs are Genesis olive plates with a lit NW / dark SE bevel. Off the
  map, the apron's shroud now averages a wider stretch of the edge the farther out it lies; before, the
  line between an explored and an unexplored edge tile ran on to the horizon as a hard black curtain.
- **Game side**: muzzle flashes start at each model's `muzzle`; selection brackets size from the
  model's radius; wheels spin by each model's `wheelRadius`; `AIR.cargoDrop` 0.35 → 0.42 so carried
  units clear the bigger Carryall.
- **Tools**: `?scene=model&id=…` (one model from four sides or in each house, with its triangle
  count and `&set=` params) and `npm run shot -- <name> "<query>"` (screenshot any scene URL).

## Decisions worth knowing

- The gold domes on red brick are **Wind Traps** and the navy blocks with two tank tops are **Spice
  Silos** (the Genesis structure-portrait, power bar and sprite names agree).
- Genesis structures are house-neutral; the only house colour is the orb in the south-west corner.
  The Barracks flag cloth and a thin stripe on the Frigate are the only other house accents.
- WOR, House of IX and Light Factory have no Genesis art: they are Genesis-style designs from the PC
  cues. The Heavy Factory is the Genesis Vehicle Factory; the Hi-Tech's 2×2 sprite is extended to 3×2.
- Units are built at about 0.8 × their Genesis size, inside the 1.1 × 0.8 envelope the tests check
  (tanks 0.85–1.0 long, the Harvester 1.1).
- The user's image of hawk-shaped aircraft is a ROM hack; the Ornithopter follows the retail sprite
  (a straight-winged plane in the house colour, flapping outer panels).
- The scene light stays where it was (from the west-south-west); the sprites' south-east shadows come
  only where it happens to agree.

## Open follow-ups

- Pad lights (Refinery, Starport) cannot switch off at rest: the `padLights` scale node can only
  pulse. A light-intensity param would let the idle pads go dark as in the sprites.
- Structure damage states (fire and smoke at ≥ 50 %), the Genesis "under construction" plate, and
  rubble are not modelled.
- Sibling models share helpers by importing each other (heavy → light factory, barracks → WOR); fine
  while they stay pairs.
