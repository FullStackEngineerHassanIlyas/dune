# Genesis-detail models — brief for the model rebuild

The first-pass models (plan 1a–2d) are simple primitives: toy-like, low in detail and not much like
the original. The Mega Drive sprites of *Dune: The Battle for Arrakis* draw every structure on 32×32 px
tiles with dense, readable machinery; our 3D models must show at least that much detail and match the
sprites' layout, palette and silhouette, while being real 3D volumes you can look at from any side.

References: `docs/research/raw/visual-structures.md` and `docs/research/raw/visual-units.md`
(component-by-component analysis of the Genesis sprites, PC fallback), images in `docs/research/refs/`
(private, gitignored — never ship or commit them; `genesis-structure-sheet-buildings.png` is the whole
Genesis building sheet, `*-grid8x.png` are enlarged crops with a tile grid). Read the section for your
model and look at the images it cites before building. The reference implementation of the style is
`src/render/models/structures/refinery.js`.

## Look

- **Follow the Genesis sprite's plan view.** The camera looks from the south at about 55°, like the
  sprite's view, so place each component where the sprite has it on the footprint (x east, z south,
  1 tile = 1 unit, origin at the footprint centre), then give it believable height and sides.
- **Structures** follow visual-structures.md. Each fills its footprint with its own floor: the olive
  plate `foundation(b, w, h)` (top at `FOUNDATION_TOP`), a navy yard (Construction Yard, Barracks,
  Starport: `foundation(b, w, h, { plate: PAL.navy, rim: PAL.machine })` or your own sunken yard) or
  red brick (Wind Trap). They are built from the Genesis palette in `palette.js`: lavender machinery
  (`machine`, `machineLight`, `machineDark`), navy recesses (`navy`, `navyLight`), white highlights,
  orange grilles, gold, brick, brass, crates, amber pad lights. **Genesis structures are
  house-neutral: the only house colour is the beacon orb** — `houseOrb(b, -w / 2 + 0.25, T, h / 2 - 0.25)`
  in the south-west corner of every 2×2 and larger structure (not on turrets, walls or slabs). No house
  bands or stripes on structures. Small lights are blue/cyan, yellow or amber as the sprite has them.
- **Structures without Genesis art** (WOR, House of IX, Light Factory — dropped on 2026-10-01 when the factories merged) and the Hi-Tech Factory (2×2 on
  the Genesis, 3×2 here) follow the Genesis-style proposals in visual-structures.md; the Heavy Factory
  is the Genesis Vehicle Factory. Light comes from the north-west in the sprites; our scene light is
  fixed (do not change the renderer), so model real height and chamfers and let the scene light them.
- **Units** follow visual-units.md: on the Genesis they are painted in the house colour almost
  everywhere (hull, turret, cab, the whole harvester); metal is kept for barrels, missiles, wheels,
  track ends, cranes; the Carryall is white with house trim; nothing is sand-coloured. MAT.HOUSE now
  paints the Genesis three-tone ramp by itself (`HOUSE_RAMP` in palette.js: e.g. navy → blue → cyan for
  Atreides, picked from the instance's house colour): tops take the body tone, north-west-facing bevels
  and slopes the hue-shifted highlight, south and east faces the shadow tone. So model the ramp with
  geometry — chamfer every visible edge (0.02–0.04) so the NW rims catch the highlight — and use a grey
  vertex colour on HOUSE parts only to darken recesses (0.5–0.8). Metal: barrels and missile noses read
  near-white (`PAL.white`/`machineLight`), tyres and track ends blue-black (`PAL.navy`), hubs lavender
  (`PAL.machine`). No emissive lights on ground units except where the game needs them (the
  Devastator's `warn` node).
- **Unit size:** Genesis units are about a tile long (visual-units.md §1.2). Build them at about 0.8 ×
  the Genesis sizes in §1.2, capped by the envelope the tests enforce (root parts within 1.1 long along
  x and 0.8 wide along z; turrets and barrels on child nodes may reach further forward). Keep the
  relative sizes between units.
- **Three levels of detail** on everything: primary masses (hull, halls, tanks), secondary forms
  (hatches, vents, pipes, panels, tracks with road wheels, grilles, pads), tertiary greebles (bolts,
  rails, ladders, lamps, antennae, hazard bands). Detail must still read at game zoom (camera distance
  12–30): prefer a few strong forms plus crisp greebles over noise.
- Machined metal gets chamfered edges (`cbox`, `hull`) — they catch the light like the sprites'
  highlight pixels. Avoid `rbox` except for soft or organic shapes. Flat-shaded `hull` is ideal for
  sloped armour, angular roofs, wedges and turrets.

## Kit

- `kit.js`: `box`, `cbox` (chamfered), `hull` (convex hull of points), `frustum`, `ring`, `cyl`,
  `sphere`, `dome`, `cone`, `torus`, `lathe`, `prism`, `tube`, `place` (move shaped geometry, e.g. a
  group built in local space). `ModelBuilder.build({ radius, shade })` bakes contact shading (side faces
  darken near the ground); pass `shade: false` for aircraft.
- `detail.js`: `foundation`, `houseOrb` (radius 0.16 by default; its glint circles on the `fan` param), `shadeOrb` (painted shading for unlit spheres), `rod`, `pipe`
  (flanged runs with joints), `bolts`, `grille`, `roundGrille`, `louvres`, `ladder`, `railing`,
  `hazard`, `studGrid`, `wheel` (lugged tyre, rim, hub, bolts), `trackUnit` (tread belt with rounded
  ends, road wheels, sprocket, idler). Write local helpers in your model file when you need more; move a
  helper to `detail.js` only if two models share it.
- Materials: PAINT (painted metal), HOUSE (house colour), METAL (bare steel, shiny), DARK (rubber,
  recesses), TREAD (scrolling track), GLASS, LIGHT and HOUSE_LIGHT (unlit, bloom). All lit materials
  get triplanar grime automatically. Each distinct node × material pair is one draw call per model
  type, so keep a model to about 10 parts.

## Contracts (tests and views depend on them — keep them)

- Node names, params and kinds: turret/barrel (combat, siege; barrel slides on x for recoil),
  turret/launcher (missile tank, deviator), drum (harvester), wheel* with param `wheel` (trike: wheelL,
  wheelR, wheelF; quad: wheel0–3), legL/legR (all infantry), clawF/clawB with params claws/clawsB
  (carryall), wingL/wingR with params flap/flapR (ornithopter), warn (devastator; scale, value 0),
  crane (construction yard), fan (windtrap), dish (outpost), padLights (refinery, repair, starport),
  door (heavy factory; slides up on y by 0.4 when a vehicle rolls out), flag (barracks), turret and
  barrel (gun turret), turret (rocket turret), arm (repair; slides on z by ±0.3). New animated nodes
  may reuse these params (e.g. another `fan` or `dish`); a new param needs a line in the views.
- `common.js` (`slab`, `beacon`, `halfArc`) is legacy: use `foundation` and `houseOrb` instead
  (`halfArc` is still handy for arches).
- Units face +x, stand on y = 0 and fit a tile (root parts within 1.1 × 0.8, nothing below y = −0.01);
  guns fire from about 0.25–0.4 up; return an accurate `muzzle` [x, y, z] in model space (the game
  will place muzzle flashes from it). Squads draw three figures. A carried unit hangs 0.42 below its
  Carryall's origin, so the Carryall's claws reach down to about y = −0.06 and its belly sits near y = 0.
- Structures stay inside their footprint (root parts within w × h + 0.01). Anchors: the repair pad top
  is 0.066 high at the footprint centre, where vehicles stand, and the welding head hangs from the arm
  node to 0.37 above the base; the refinery's harvester docks on the tile south of the east column;
  the Frigate lands over the Starport's centre; the Heavy Factory door is on the south face; walls are
  about 0.36 high (Saboteurs walk on top); turret heads rest facing east (+x).
- Keep the `muzzle` and `radius` extras each model already returns (update the numbers if the model
  changes size).

## Budgets

Triangles per model: infantry figure ≤ 800, light vehicles ≤ 3000, tanks, harvester, MCV ≤ 4500,
aircraft ≤ 4000, Frigate ≤ 7000, 1×1 structures ≤ 5000, 2×2 ≤ 14000, 3×2 ≤ 18000, 3×3 ≤ 24000.
The model scene prints the count. Use modest segment counts (8–12 on small cylinders, 16–24 on big
round forms).

## Process

1. Read your models' sections in the research docs and look at every cited image (crop and enlarge
   them, e.g. with Pillow in a throwaway venv).
2. Sketch the plan: components with footprint coordinates and heights.
3. Build, then look: `node scripts/shot.mjs <name> "scene=model&id=<modelId>"` writes
   `screenshots/<name>.png` (add `&views=1..4`, `&houses=1`, `&dist=`, `&pitch=`, `&yaw=` in degrees,
   `&lift=0.9` for aircraft). Check it at game zoom too (`scene=structures`, `scene=gallery`,
   `scene=base&fog=0`, `scene=battle&dist=22&ticks=300`). Compare side by side with the reference and
   iterate until it reads as the original — several rounds, not one.
4. `npm test` must pass (at least `node --test tests/models-*.test.mjs tests/icons.test.mjs`).
5. Report what you built, triangle counts, what differs from the sprite and why.
