# Structures — visual reference for 3D modelling (Genesis first, PC as fallback)

Scope: every buildable structure, described so a modeller can rebuild it as a detailed procedural
Three.js model that reads like the 1993/94 Sega Mega Drive / Genesis sprite ("Dune: The Battle for
Arrakis"). The PC/DOS "Dune II" (1992) is used only where the Genesis version has no such building or
where the PC art explains a form the Genesis sprite only hints at.

All descriptions are my own, taken from the reference images listed per structure (private copies
live in `docs/research/refs/`, gitignored; see `refs/INDEX.md` for source URLs).

Confidence tags: **[H]** high (directly seen in several sources), **[M]** medium (seen once, or inferred
from a small sprite), **[L]** low (interpretation or invented to fill a gap).

---

## 0. Read this first

### 0.1 Three findings that change the brief

1. **The gold domes are Wind Traps, and the navy "intake" buildings are Spice Silos.** [H]
   The user's guess was the other way round. Evidence:
   - In user image 1 the selected gold-dome building shows the Wind Trap portrait (a gold ribbed
     arched hall), a green damage bar and a **blue** bar. The Genesis FAQ says the blue bar (power
     demand) belongs to Wind Traps; Silos and Refineries show an orange spice bar.
   - In the longplay, the red "lightning" (low power) status icon is drawn over the gold-dome
     buildings. The FAQ says that icon appears on Wind Traps.
   - An independent Genesis sprite extraction (GitHub `A1z3n/dune2`) names this sprite `power.png`.
   - The layout matches the PC Wind Trap sprite: three arched intakes in a triangle, with dark
     mouths facing south-east.
   - Among the six Genesis 2×2 building sprites, the navy block with two white-rimmed discs is the
     only one left, so it is the Silo. The discs are the roofs of two round tanks, and the PC Silo
     sprite is also two round tanks.
2. **The Genesis port has only 15 structure types.** [H] (Ledmeister's Genesis FAQ has a structure
   table.) The list is Barracks, Concrete, Construction Yard, Hi-Tech, Outpost, Palace, Refinery,
   Repair Facility, Rocket Turret, Silo, Starport, Turret, Vehicle Factory, Wall and Wind Trap.
   - It has **no WOR, no House of IX, and no Light/Heavy factory split.** One 3×2 "Vehicle
     Factory" builds every ground vehicle and looks the same for every house.
   - The soldier barracks and trooper barracks look identical on the map.
   - These project structures have no Genesis art: WOR, IX, Light Factory and Heavy Factory.
     §2 proposes Genesis-style designs for them.
3. **Some Genesis footprints differ from the project data.** [H]
   - Hi-Tech is **2×2** on Genesis; PC and the project use 3×2.
   - Concrete is built as a 2×2 but placed tile by tile, so each quadrant is an ordinary 1×1 tile.
   - All other footprints match the project (`src/data/structures.js`).

### 0.2 The five user screenshots — what is in them

| Image | Structures identified (confidence) |
|---|---|
| 1.png | About 14 **Wind Traps** (gold cowls on red brick, blue orb in the SW corner of each) [H]. **Starport** at top-left (navy floor, brass L-blocks, black lens "eyes", grey landing pad with a plus-shaped pattern of dark circles and triangles) [H]. **Construction Yard** on the right (navy yard, orange girder shapes, yellow crane and bulldozer) [H]. Two **Refineries** at the bottom; the second has a blue harvester docked on its pad [H]. Olive **concrete** tiles [H]. The hammer icon means the selected Wind Trap is being repaired. |
| 2.png | **Refinery** in the centre [H]. **Vehicle Factory** at bottom-left (four prongs on the west side, concentric-ring fan, navy bay holding two vehicles) [H]. This is the building the user called "a big block with a concentric-circle fan"; it stands in for both Light and Heavy Factory. **Wall** corner and straight pieces [H]. 1×1 and 2×2 **slabs** [H]. |
| 3.png | About 16 **Rocket Turrets** (dome, long barrel and two side pods) on 1×1 slabs [H]. One **Gun Turret** at bottom-right (single barrel facing north) [H]. **Radar Outpost** (dish plus four-petal dome, blue orb) [H]. **Construction Yard** at bottom-left [H]. **Wind Traps** along the bottom [H]. A scorched crater in the middle [M]. |
| 4.png | Unit line-up, plus Gun Turrets (single barrel) and one Rocket Turret on slabs [H]. |
| 5.png | Two **Spice Silos** at the top (navy block, two white-rimmed tank tops, rivets, fin clusters, blue orb) [H by elimination]. **Refinery** at top-left, partly visible [H]. **Construction Yard** in the centre (selected) [H]. Three **Rocket Turrets** [H]. **Wind Traps** below [H]. **Vehicle Factory** at bottom-right, partly visible [M-H]. **Hi-Tech** at bottom-left, partly visible [M]. |

### 0.3 Coordinates used in this document

- The Genesis sprites are top-down with **north up**, and every structure has a fixed orientation.
  1 map tile = **32×32 sprite pixels** on Genesis and 16×16 on PC. The Genesis art therefore has
  four times the pixels per tile, which is why it is so much richer.
- Plan positions are given as **(x, z) in tiles from the footprint's NW corner**, with x pointing
  east and z pointing south, matching the project.
- For a model centred on its footprint (as `slab(b, w, h)` does), use world = (x − W/2, z − H/2).
- ASCII plans use cells of **0.25 × 0.25 tile**, each drawn as two characters. The legend follows
  every plan. Exact numbers are in the component tables.
- Heights are **my estimates in tile units**. The sprites are orthographic top views, so heights
  come from cast-shadow lengths, perspective hints and PC art. Treat them as starting values.

### 0.4 Sources that were used

- **Genesis "Buildings" sheet from The Spriters Resource**, obtained through the Wayback Machine
  (TSR itself blocks bots). It is complete: every building, 12 wall pieces, 8 facings for each
  turret type, and animation frames for the Refinery and Starport pads.
  Files: `genesis-structure-sheet-buildings.png`, the per-structure `-sprite` and `-grid8x` crops
  (the grid crops have a 1-tile red grid and a ¼-tile cyan grid drawn over them).
- **GitHub `A1z3n/dune2`** (a Unity remake of the Genesis game using extracted art). It provided
  the house beacon in four colours with 8 frames each, the "under construction" images, the
  production portraits and a rubble tile.
- **Mega Drive Longplay #468 on archive.org**: about 460 frames covering all three campaigns.
  Useful for house colours, status icons, construction stage, rubble and animation states.
- **Ledmeister's Genesis FAQ** (GameFAQs, retrieved through the Wayback Machine): structure list,
  sizes, beacon, fire/smoke and pad lights.
- **PC**: the dune2k.com info cards (painted art with an in-game sprite inset), the PC Longplay #086
  on archive.org (Harkonnen campaign), and the Dune Dynasty README screenshots.

---

## 1. Global Genesis structure style

### 1.1 Projection, light and shading conventions [H]

- **Top-down orthographic.** Tops of objects are what you see. South faces barely show; a few
  items get a slight 3/4 hint:
  - the pistons show white caps,
  - the palace gate is drawn on the south side of the dome,
  - the bulldozer is seen a little from the side.
- **Light comes from the NW, top-left.**
  - Top and left edges of every raised element get a 1-px highlight: white on metal, khaki on
    concrete, mortar colour on brick.
  - Bottom and right edges get a 1-px dark line.
  - Round objects have their specular spot at upper-left and their terminator toward lower-right.
- **Cast shadows are solid black (#000000) and fall to the SE.** They have 45° diagonal ends and are
  drawn over whatever lies below. Their length reveals height:
  - Wall: about 4 px (0.125 tile).
  - Barracks bunkers: about 8 px (0.25 tile).
  - Repair gantry: about 8–10 px.
  - Starport blocks: about 6–8 px.
- **Outlines.** Machinery has a 1-px black or navy outline. Concrete and brick use their own dark
  edge colour instead of black.
- **Ramps.** Each material uses a flat 3–5 tone ramp with no smooth gradients. Gold domes, the
  palace dome and the Construction Yard "net" use checkerboard **dithering** for mid-tones.
- **Colour depth.** The Genesis palette is 9-bit: 8 levels per channel, which appear as
  00/21/4A/6B/94/B5/DE/FF in this rip. The turret rows and starport frames use the equivalent
  00/20/40/60/80/A0/C0/E0 scale, and emulator captures (the longplay) shift values slightly
  (for example olive #434325). Use the table below as the canonical palette.

**3D translation**
- Key light from the NW and high: azimuth from −x,−z toward +x,+z, about 50–60° elevation, so
  cast shadows fall south-east as in the sprites.
- Keep shadows dark (fill light low) to keep the sprite's contrast.
- Bevel or chamfer the top edges of blocks, so the lit NW edges catch a highlight line and the SE
  edges go dark. That reproduces the 1-px rim convention.
- An optional thin dark outline pass (inverted hull or edge-detect) gets closest to the sprite
  look. Flat or low-roughness shading beats heavy PBR noise.

### 1.2 Palette (sampled from the sprite sheet)

| Role | Hex ramp (dark → light) | Where |
|---|---|---|
| Concrete / olive plate | #212100 edge-shadow · **#4a4a21** face · **#b5b594** lit rim | slabs, olive building floors, wall base, turret slab |
| Khaki / wall | #4a4a21 shaded bevel · **#b5b594** face · #ffffff lit bevel | walls, barracks bunkers, palace gate frame |
| Navy (dark metal, yards, recesses) | #000000 · **#21214a** (also #222244 / #151537) · #9494b5 rim | CY and Barracks yard floors, Starport floor, Silo block, Vehicle Factory bay, Repair work floor, Palace conduits |
| Lavender machinery (default metal) | #000000 outline · #21214a shade · **#9494b5** face (#8080a0 on turret rows) · #ffffff highlight | dome, pipes, tanks, gantries, factory blocks, pads |
| Pad plate (landing / docking) | #6e6e99 · **#8888aa**–#9494b5 · #aaaad4 | Refinery pad, Starport pad |
| Pad markers | circles and triangles #404020 / #55552a with #000000 rims and #e0e0e0 highlight | same |
| Pad lights (lit state) | **#e0a000** amber with #e0e0e0 core | Refinery and Starport, animated |
| Gold (domes, heavy yellow machines) | #4a2100 · #944a00 · #b56b00 · **#ffb500 / #ffde00** · #ffdeb5 · #ffffff | Palace domes, CY crane and bulldozer |
| Wind Trap gold cowl | #000000 mouth · #6b4a00 / #946b21 collar · **#ffb500** shell · #ffffff glints | Wind Trap |
| Red brick | #210000 joint shadow · **#4a2121** brick · **#deb56b** mortar and lit edge | Wind Trap floor |
| Crates / cargo | #4a2100 · **#944a00** · #ffdeb5 lit corner | CY, Repair |
| Orange grille / girders | **#de6b00** · **#b52100** (checker) | Refinery ports, CY girder shapes |
| Brass (Starport) | #613f00 · #886622 · **#bf994c** · white edge highlight | Starport buildings |
| Maroon inserts | #2e0c1d · #442222 · #482626 | Starport panels |
| Small lights | blue **#004ade** + cyan **#00ffff**; yellow **#ffde00** | Refinery machine light, Hi-Tech windows, factory slits, bulldozer cab; repair rail lights, outpost gauges |
| Turret body | #202000 · **#404020** · #a0a080 rim · #e0e0e0 glint | turrets |
| Turret barrel and pods | #202040 outline · **#8080a0** · #e0e0e0 | turrets |
| Rocket tips | #402000 · **#a06000** · #e0c0a0 | rocket turret |

Comparison with `src/render/models/palette.js`, which already holds a "Genesis structure palette":
- `slab` (0x4c4e2e) and `grille` are close to the sprite colours.
- `slabRim` (0x8a8b68) and `machine` (0x6c6d92) are much darker than the sprite rim (#b5b594) and
  machinery face (#9494b5).
- `navy` (0x222339) is less saturated than the sprite's blue-violet #21214a.
- `brick` (0x6c3326) is lighter and redder than the sprite's #4a2121. That is fine for a lit 3D
  floor if the mortar lines stay light (#deb56b).
- The sprite gold is more saturated than `gold` (0xe3b24c).

### 1.3 Foundations and floors [H]

- **Concrete tile (1×1)**
  - Fill #4a4a21, 1-px #b5b594 highlight along the top and left edges, 1-px #212100 along the
    bottom and right edges. No texture and no cracks.
  - A 2×2 slab is simply four such tiles, so the seams between tiles are visible (each tile has its
    own rim).
  - 3D: a thin plate about 0.04–0.06 high with a small chamfer. Colour the NW chamfer lighter and
    the SE chamfer darker, per tile.
- **Every building sprite fills its whole footprint with its own floor.** There are three kinds:
  - **Olive plate**: Radar Outpost, Refinery, Vehicle Factory, Repair, Hi-Tech, Palace, and the
    margin around the Silo block. It looks like one big concrete slab the size of the footprint:
    one continuous rim, with no seams at tile boundaries.
  - **Navy yard**: Construction Yard, Barracks, Starport. The yard has a 1-px lavender rim on the
    top and left edges and black on the bottom and right. It reads as a dark, slightly sunken
    service yard.
  - **Red brick**: Wind Trap only. The pattern repeats every half tile: one 0.5×0.25 brick above
    two 0.25×0.25 bricks. Each brick has light mortar on its top and left and a dark joint on its
    bottom and right.
- 3D:
  - Give each building one footprint-sized base plate, with the same bevel convention as concrete.
    Sink it slightly into the terrain.
  - Build navy yards as a plate with a shallow raised lip, or a plate about 0.02 lower than an
    olive plate.
  - Model the brick floor as geometry (thin raised bricks) or as a canvas texture. The bricks
    should be about 0.25 tile, so they read from the game camera.

### 1.4 The house beacon (the glowing orb) [H]

- **What it is.** A separate round sprite laid over most buildings. The FAQ calls it "a rotating
  light beacon ... [whose] color will be the House color". It is the **only** house-coloured part
  of a Genesis structure (§1.5).
- **Where.**
  - It sits at the **SW (bottom-left) corner of the footprint**, inset about 1 px.
  - Its centre is about **(0.25, H − 0.25)** tiles from the NW corner, i.e. a quarter tile in from
    both the west and south edges.
  - Seen on every 2×2, 3×2 and 3×3 building: CY, Wind Trap, Silo, Outpost, Barracks, Hi-Tech,
    Refinery, Repair, Vehicle Factory, Starport, Palace.
  - **Not** on turrets, walls or concrete.
  - The FAQ text says "near their southeast corner", but every screenshot of all four houses shows
    SW. Follow the screenshots.
- **Size.** A 14-px disc on a 32-px tile, i.e. a **diameter of about 0.44 tile**. That is large, as
  big as a turret dome. The current `beacon()` in `common.js` is a 0.03-radius sphere; its radius
  is about 7 times too small, and its area about 40 times.
- **Look.** A glossy sphere with three bands:
  - a dark rim (almost black, tinted by the house colour),
  - a saturated body,
  - a small bright glint (white core with a pale-tint surround).
  The glint **travels around the rim over 8 frames**, which is the "rotation".
- **Colours per house** (from the extracted beacon sprites):

  | House | Rim | Body | Glint |
  |---|---|---|---|
  | Atreides | #000029 | #0059f7 | #00ffff + #ffffff |
  | Harkonnen | #290000 | #e70018 | #ffe321 (yellow) + #ffffff |
  | Ordos | #002c00 | #00e300 | #ffff18 (yellow) + #ffffff |
  | Sardaukar | #44002a | #d300d4 | #5100d4 + #d4d4d4 |

  The Genesis sheet's own red beacon strip uses #200000 / #a00000 / #c15858 / #ebc158. Fremen and
  mercenary buildings are not seen on Genesis; use the house colour from `houses.js`.
- **3D.**
  - A sphere of radius about **0.18–0.2**, sitting on a small dark collar or socket ring (radius
    about 0.22, height 0.05).
  - Sphere centre at about 0.2–0.25 above the plate, at (−W/2 + 0.25, +H/2 − 0.25).
  - Use an emissive house-colour material with a darker rim: a fresnel-darkened edge, or a slightly
    larger dark back-shell.
  - Add a small bright "glint" sprite or point light that orbits the sphere, roughly one turn per
    second.
  - It must stay readable at the game's zoom. It is the only house marker.

### 1.5 How house colour is used [H]

- On Genesis, **structures are house-neutral.** The same art is used for Atreides, Harkonnen,
  Ordos and Sardaukar; compare the Palace, Vehicle Factory, Refinery and Barracks across the three
  campaigns. House identity comes from:
  - the beacon orb,
  - house-coloured units on the structure: a harvester docked on the Refinery pad takes the
    house colour.
- On PC, by contrast, a magenta "remap" colour is painted onto flags, small lights, the Refinery
  pad's diamonds and the Starport pad's chevrons. PC Heavy Factory, Palace and IX carry a small
  house flag.
- **Recommendation.** Faithful to Genesis: no house paint on walls, roofs or bands. Make the orb
  big and bright. If playtesting shows the orb alone is not enough, add one small PC-style accent
  (a pennant on the tallest point, or pad lights tinted by house) rather than stripes. Remove the
  existing `MAT.HOUSE` bands on roofs if Genesis fidelity is the goal.

### 1.6 Material language and recurring greebles (the "kit") [H]

The Genesis structures are assembled from a small, consistent kit. Build these once and reuse them.

| Kit piece | Look | Used on |
|---|---|---|
| **Rivet ball / bollard** | Lavender sphere (dia 0.08–0.12) with a white spec at upper-left and a black SE shadow | CY (3 singles + a cluster of 3), Silo (6 in a column), Outpost, Refinery (2), Hi-Tech (1) |
| **Pipe** | Lavender or white tube with a navy outline, dia about 0.08–0.12, bends at right angles or in loops | Refinery (long pipe along the north edge, loop), Outpost, Repair, Palace conduits (thicker, navy) |
| **Piston / hydraulic post** | Short vertical cylinder, lavender body, white cap, often in a row of 2–3 | Outpost (2), Refinery (3, lying), Repair (3) |
| **Fin cluster** | 3–5 parallel vertical plates or pipes with white tips and dark gaps, like a comb or radiator | Silo (2 clusters), Hi-Tech (1). Possibly ladders or valve banks |
| **Round port** | Navy ring with lavender radial spokes and a coloured centre | Refinery (orange checker centre), Vehicle Factory fan (navy concentric rings), Hi-Tech turntable (white cross) |
| **Dot-grid pad** | Light lavender plate with dark olive discs (white rim at upper-left, black at lower-right) and dark triangles pointing inward at the corners | Refinery (docking), Starport (landing) |
| **Crate** | Brown box, cream lit corner, about 0.2 × 0.2 × 0.12 | CY (4), Repair (2 + box) |
| **Bevelled bunker wall** | Khaki-rimmed olive wall with a white inner highlight, firing slits, porthole bolts | Barracks, and the Wall itself |
| **Blue slit light** | 2–4 px blue + cyan diagonal slot, emissive | Vehicle Factory (2), Hi-Tech windows (3), Refinery machine (1 square) |
| **Gold dome** | Saturated gold sphere-cap, dithered, white spec at NW, small dark slit window at SE | Palace (1 big + 5 small); Wind Trap cowls use the same gold |

### 1.7 States: construction, damage, destruction, status icons

- **Being built / placed** [H] (image `genesis-structure-construction-stages.png`, longplay
  `…ordos-construction-stage.png`).
  - While a new building appears, the sprite flickers between the finished art and an "interim"
    image.
  - The interim image is an olive plate (the footprint size, with the usual rim) strewn with parts:
    - pairs of horizontal lavender pipes,
    - grey rivet balls,
    - brown crates,
    - stacks of three vertical pipes.
  - There is one version per footprint class (2×2, 3×2, 3×3).
  - 3D: show a parts-strewn plate, then rise or scale the model into place, or cross-fade.
- **Damaged** [M]. FAQ: "If fire and smoke plumes appear over a building, it has been attacked and
  is at least 50% damaged." There is no separate damaged sprite; damage is shown by fire and smoke
  overlays. I did not capture a Genesis frame of it. The PC longplay shows small flame tongues with
  grey smoke puffs on the roof (`pc-screenshot-longplay-burning-buildings.png`).
  - 3D: at 50% damage or more, add 1–3 fire and smoke emitters at random roof points, and optionally
    darken a few panels.
- **Destroyed** [H]. The building is replaced by **rubble ground**:
  - dark brown dithered soil (#6c4a04, #946e24, #4c2624),
  - small grey or white debris chunks (#9492b4 with white glints),
  - a scorched crater for large buildings (user image 3).
  3D: an explosion, then a rubble decal plus a few low debris meshes over the footprint.
- **Status icons** [H]. Drawn centred over a building, as a round badge about 0.6 tile wide:
  - "OK" (CY or Palace ready),
  - a white hammer on a white disc (being repaired),
  - a yellow lightning bolt on a red disc (low power; seen over Wind Traps).
  These belong to the UI or billboard layer, not the model.

### 1.8 Height and readability rules for the game camera

- The sprite's **top-view layout is the identity**; the camera (from the south, 45–60°) mainly sees
  roofs. Keep most heights at or below about 0.7 tile and put the detail on top faces.
- Let only one or two "hero" elements rise higher: CY crane, Palace dome, Repair gantry, Outpost
  dish, Wind Trap cowls.
- South faces **are** visible in 3D but not in the sprites. Give them believable but quiet detail:
  panel lines, a door, vents in the darker shade of the material. Do not invent loud new colours.
- Reproduce each sprite's **black SE shadow** by giving the object real height, so the NW key
  light casts it. If shadows are off, add a dark ambient-occlusion skirt on the SE side.
- Keep the **1-px lit NW rims** with chamfers. They separate buildings from each other and from
  the olive concrete.

---

## 2. Structures

Each section gives: footprint, the references used, a plan, a component table, silhouette cues,
Genesis vs PC, and modelling advice. Heights (h) are in tiles, measured from the top of the base
plate.

---

### 2.1 Construction Yard — 2×2

**References.** Genesis `genesis-structure-construction-yard-sprite.png` / `-grid8x.png`,
`…-user-crop.png` (image 5), longplay `…atreides-cy-turrets.png` (crane animation state),
`…atreides-base-hitech.png`. PC `pc-structure-construction-yard.gif`.

**Plan** (cell = 0.25 tile)
```
x→      0.0         0.5         1.0         1.5        2.0
z 0.00  GG  GG  GG  GG  ··  ··  CC  CC
  0.25  GG  GG  GG  GG  bb  ·/  CC  CC
  0.50  GG  GG  GG  GG  //  NN  bb  bb
  0.75  GG  GG  GG  bb  /N  NN  bb  bb
  1.00  KK  KK  KK  ··  NN  NN  NN  kk
  1.25  KK  KK  KK  DD  DD  D|  NN  kk
  1.50  OO  OO  ··  DD  DD  D|  NN  kk
  1.75  OO  OO  kk  kk  kk  kk  kk  kk
G girders/parts laid out · C crane cab on its base · / boom · N dithered net/heap · b rivet balls
K crates · D bulldozer (| = blade, facing east) · k low kerb wall · O beacon · background = navy yard
```

| # | Component | Position / size (tiles) | h | Colours | Notes |
|---|---|---|---|---|---|
| 1 | Navy yard floor | whole 2×2, lavender rim N+W, black S+E | 0.03 | #21214a, rim #9494b5 | the construction yard's working floor |
| 2 | Girders and parts laid out | NW quadrant x 0.04–0.94, z 0.04–0.94 | 0.02–0.06 | orange-red blocks #de6b00 / #b52100 with cream/white edges; thin frames outlined white and yellow | orange L-shapes and bars plus thin outlined "H/A/II"-like frames, i.e. prefab girders and frames on the ground. Model as flat I-beams and square frames |
| 3 | Crane cab | on an olive square base x 1.4–1.88, z 0.08–0.5; round cab dia 0.3 centred (1.68, 0.23) | base 0.1, cab 0.5–0.7 (mast) | yellow #ffde00 / #ffb500 / #b56b00, white window with a black pupil | a round yellow slewing cab with one big white window, in the NE corner |
| 4 | Crane boom | lattice, about 0.12 wide, from (1.56, 0.23) to (1.05, 0.84), angled down to the SW | rises from about 0.7 at the cab to about 0.35 at the tip, or stays level | yellow with black diamond holes | **animated**: boom length and angle change; a yellow frame piece hangs mid-air in some frames |
| 5 | Dithered "net" | x 0.94–1.84, z 0.43–1.72 | 0.05–0.15 | olive / black checker | reads as a camouflage net, a spoil heap, or a scaffold under construction [L]. Model a low heap of scaffold and parts under a net |
| 6 | Rivet balls | (1.07, 0.31), (0.82, 0.82), cluster of 3 at x 1.64–1.93, z 0.64–0.9 | 0.08 | lavender + white spec | kit piece |
| 7 | Crates | 4 boxes at x 0.04–0.66, z 1.03–1.45 | 0.12 | #944a00, cream #ffdeb5 corner | stacked in a small L |
| 8 | Bulldozer | body x 0.66–1.29, z 1.25–1.6; blade at the east end x 1.21–1.31 | 0.22 | yellow body, blue cab window #004ade + cyan, black tracks with grey links | faces east; a cylindrical yellow hood, two tracks, a tall vertical blade |
| 9 | Kerb | along the S edge x 0.5–1.92, z 1.8–1.95, and the E edge x 1.8–1.95, z 0.98–1.95 | 0.1 | olive blocks with khaki tops | segmented low wall, 6–7 blocks per run |
| 10 | Beacon | (0.25, 1.75) | — | house | see §1.4 |

- **Silhouette cues.** Dark navy yard; a yellow crane in the NE with its boom over the middle; a
  yellow bulldozer in the south; bright orange girders in the NW.
- **Genesis vs PC.** PC's painted art has the same props: a tracked bulldozer with a blade, a crane
  hook and a chain-link fence. The PC sprite is a dark machinery block. **Follow Genesis.** PC art
  can supply a chain-link fence on the kerb and the hook detail on the boom.
- **3D advice.**
  - Give the crane a real mast about 0.8 tall. Rotate the cab and boom slowly and swing a hook, or
    a girder on a cable, as idle animation. This replaces the sprite's frame changes.
  - Everything else stays low (≤ 0.25), so the yard reads as open ground.
  - South face: the kerb can carry a short chain-link fence (thin posts plus a transparent mesh
    texture).
  - Do not build a closed hall; the current model's "assembly hall" contradicts the Genesis
    open-yard read.

---

### 2.2 Concrete Slab — 1×1 and 2×2

**References.** Genesis `genesis-structure-slab-and-windtrap-brick-tile-sprite.png`,
`genesis-structure-concrete-slab-2x2-sprite.png`, `…wall-slab-user-crop.png`, every base
screenshot. PC `pc-structure-concrete-slab.gif`.

**Plan.** A 1×1 tile is a single plate. A 2×2 is four plates:
```
+-------+-------+     each tile: face #4a4a21
|       |       |     1-px lit rim #b5b594 on N and W edges
+-------+-------+     1-px dark rim #212100 on S and E edges
|       |       |     → visible seams between the four tiles
+-------+-------+
```

| Component | Size | h | Colours |
|---|---|---|---|
| Plate | 1.0 × 1.0 per tile | 0.04–0.06, chamfer 0.015 | face #4a4a21; NW chamfer #b5b594; SE chamfer #212100 |

- **Silhouette cues.** A dark olive, perfectly flat square with a crisp light edge at top-left.
  Laid on rock it reads as a tiled floor.
- **Genesis vs PC.** PC is a flatter grey-olive texture. **Follow Genesis.**
- **3D advice.**
  - Build the 2×2 from four separate 1×1 plates; do not make one big plate.
  - Keep plates matte and flat. Very subtle noise at most; the sprite has none.
  - Plates must sit slightly above the terrain to avoid z-fighting, and the bevel must survive at
    the game's distance (use vertex colours on chamfers rather than tiny normals).
  - Buildings' own base plates (§1.3) use the same look, but one plate per footprint.

---

### 2.3 Wind Trap — 2×2 (the gold cowls)

**References.** Genesis `genesis-structure-windtrap-sprite.png` / `-grid8x.png`,
`…windtrap-user-crop.png` (image 5), user image 1 (about 14 of them, one selected with the blue
power bar), longplay `…late-base-status-icons.png` (lightning icons). Production portrait in
`genesis-structure-build-icons.png` (gold ribbed arched hall). PC `pc-structure-windtrap.jpg`
(painted: ribbed parabolic arches with a turbine wheel; sprite: three arched intakes with
dark-blue ribbed mouths), `pc-screenshot-longplay-ix-windtrap-barracks.png`.

**Plan**
```
x→      0.0         0.5         1.0         1.5        2.0
z 0.00  ▒▒  AA  AA  ▒▒  ▒▒  ▒▒  ▒▒  ▒▒
  0.25  AA  AA  Aa  f▒  ▒▒  ▒▒  ▒▒  ▒▒
  0.50  AA  Aa  aa  ▒▒  BB  BB  BB  f▒
  0.75  ▒▒  aa  ▒▒  ▒▒  BB  BB  Bb  ▒▒
  1.00  ▒▒  ▒▒  CC  CC  Bb  bb  bb  ▒▒
  1.25  ▒▒  ▒▒  CC  CC  Cc  f▒  ▒▒  ▒▒
  1.50  OO  OO  CC  Cc  cc  ▒▒  ▒▒  ▒▒
  1.75  OO  OO  ▒▒  cc  ▒▒  ▒▒  ▒▒  ▒▒
▒ red-brick floor · A/B/C gold cowl shell (upper case = lit NW half, lower case = dark SE mouth)
f small lavender bracket/valve · O beacon
```

| # | Component | Position / size | h | Colours | Notes |
|---|---|---|---|---|---|
| 1 | Brick floor | whole 2×2 | 0.04 | brick #4a2121, mortar #deb56b (N/W edges), joints #210000 (S/E edges) | half-tile module: one long brick above two short ones |
| 2 | Cowl A | collar ring centre (0.47, 0.45), outer dia 0.75 | 0.5–0.6 | shell #ffb500 dithered with #6b4a00; white glints; collar #6b4a00 / #946b21 | a gold **half-dome wind-catcher** whose **SE half is open**: a black mouth (#000000) with a crisp diagonal edge |
| 3 | Cowl B | centre (1.42, 0.8), dia 0.85 | 0.55–0.65 | same | same, a little bigger |
| 4 | Cowl C | centre (1.0, 1.4), dia 0.82 | 0.55–0.65 | same | same |
| 5 | Collar rings | around each cowl, width about 0.06 | 0.06 | #6b4a00 / #946b21, thin dark outline | a turntable or socket the cowl sits in |
| 6 | Brackets | at the NE of each cowl: (0.95, 0.3), (1.93, 0.5), (1.43, 1.25) | 0.1 | lavender #9494b5 | small F-shaped clamp or valve; an L-shaped fitting sits at the SE of each collar [L: purpose] |
| 7 | Beacon | (0.25, 1.75) | — | house | — |

- **What the cowl is.** Reading the Genesis shading together with the PC art: a ribbed, rounded
  hood (like a Quonset half-dome) that is lit and gold on its NW back, and open on its SE face,
  showing a dark ribbed intake. The black half is the **mouth**, not merely a shadow [M].
- **Silhouette cues.**
  - Three shiny gold hoods in a triangle, all gaping toward the SE (toward the camera's
    lower-right).
  - A dark red brick floor.
  - It is the warmest-coloured building in a base, and bases contain many of them.
- **Genesis vs PC.** Same concept: three arched intakes in a triangle facing SE. PC colours them
  lavender with blue mouths, and its art adds a spinning turbine wheel at the side.
  **Follow Genesis** for colours and layout. Use PC for the ribbing: 6–8 arch ribs on the shell and
  horizontal louvres inside the mouth.
- **3D advice.**
  - Each cowl: a half-sphere, or a better parabolic hood (a sphere segment of about 200–220°
    around the vertical axis) opening to the SE (yaw 135°, i.e. facing +x,+z). Ribs as thin tori
    following the shell.
  - Inside the mouth: a dark recess with 5–7 horizontal louvre slats and a small fan or turbine
    hub. A slow spin is a good idle animation and matches the PC "turbine".
  - Seat each cowl in a raised collar ring on the brick.
  - Optionally let all three cowls yaw a few degrees together, as if tracking the wind.
  - Keep the brick floor visible between cowls; do not add a machinery block. The current
    windtrap model (steel half-domes and a machinery block to the north) should be replaced.

---

### 2.4 Spice Refinery — 3×2

**References.** Genesis `genesis-structure-refinery-sprite-frames.png` (4 frames),
`…refinery-grid8x.png`, `…refinery-user-crop.png` (image 2), user images 1 and 5, longplay
`…atreides-refineries-docked.png`, `…harkonnen-refinery-dock.png`. PC
`pc-structure-spice-refinery.jpg` (4 grey tank domes plus a pad with magenta house diamonds).

**Plan**
```
x→      0.0         0.5         1.0         1.5         2.0         2.5        3.0
z 0.00  ··  PP  PP  PP  PP  PP  PP  PP  PP  PP  PP  ··
  0.25  ··  bb  g1  g1  ··  TT  TT  TT  TT  TT  TT  ss
  0.50  cc  bb  g1  g1  ··  ··  ··  ··  ··  ··  ··  ss
  0.75  ··  ··  g2  g2  MM  MM  MM  MM  ◤●  ●●  ●●  ●◥
  1.00  ··  ··  g2  g2  MM  M*  MM  MM  ··  ●●  ●●  ··
  1.25  ··  ··  g3  g3  MM  MM  MM  MM  ●●  ●●  ●●  ●●
  1.50  OO  OO  g3  g3  MM  MM  MM  MM  ··  ●●  ●●  ··
  1.75  OO  OO  ··  ~~  pp  pp  pp  ··  ◣●  ●●  ●●  ●◢
P pipe along the N edge · g1–g3 orange grille ports · b rivet balls · c control panel · T ribbed tank on clamps
s striped post · M processing machine (* = blue light) · p pistons · ~ pipe loop · O beacon
right-hand block = docking pad (light lavender) with a cross of dark circles and corner triangles
```
Docking-pad markers, exactly (pad x 2.0–3.0, z 0.75–2.0):
```
row z≈0.88   ◤  ●  ●  ◥      columns x ≈ 2.11 | 2.38 | 2.64 | 2.89
row z≈1.13      ●  ●
row z≈1.39   ●  ●  ●  ●
row z≈1.64      ●  ●
row z≈1.89   ◣  ●  ●  ◢      (12 circles, dia ≈ 0.18; 4 corner triangles)
```

| # | Component | Position / size | h | Colours | Notes |
|---|---|---|---|---|---|
| 1 | Olive base plate | 3×2 | 0.04 | §1.3 | — |
| 2 | North pipe | x 0.31–2.7, z 0.06–0.2; turns south at the W end to z 0.25 | 0.3 on small posts | navy #21214a tube, white top highlight | a big header pipe |
| 3 | Grille ports ×3 | centres x 0.84, z 0.33 / 0.84 / 1.35; dia about 0.45 | 0.25–0.35 | navy ring, lavender spokes, orange checker core #de6b00 / #b52100 | short cylinders with an **orange grille top**: intakes or furnace vents. The most recognisable detail |
| 4 | Rivet balls | (0.33, 0.31), (0.33, 0.57) | 0.08 | lavender | — |
| 5 | Control panel | x 0–0.2, z 0.51–0.72 | 0.15 | grey box, 2 orange lights | on the west edge |
| 6 | Ribbed tank | x 1.33–2.7, z 0.31–0.51 (dia about 0.2) | axis at 0.2 | white / lavender, navy outline, end caps | a lying cylinder on four pairs of clamp legs |
| 7 | Striped post | x 2.75–2.91, z 0.31–0.74 | 0.35 | white with brown bands | a gauge or marker post [L] |
| 8 | Processing machine | x 1.0–1.95, z 0.74–1.76; its navy body also runs west behind the grilles | 0.5–0.55 | lavender faces, navy sides, white edge; **blue light** #004ade / cyan at (1.44, 1.06) | angular, helmet-like block with a pointed or chevron top, the "domed machine with a blue light" |
| 9 | Pistons | 3 short horizontal tubes, x 1.13 / 1.37 / 1.64, z 1.64–1.84, joined by a pipe | 0.1 | white | feed rams to the pad side |
| 10 | Pipe loop | from under g3 (0.8, 1.55) to (1.05, 1.72) | 0.1 | white | — |
| 11 | **Docking pad** | x 2.0–3.0, z 0.75–2.0 | 0.04 | plate #9494b5 / #8888aa; markers #404020 with black and white rims | circles are lamp sockets |
| 12 | Pad lights | the 12 circles (plus triangles) | — | off = dark olive; on = amber **#e0a000** with #e0e0e0 core | **animated**, 4 frames: all off → outer ring and triangles on → middle ring → centre pair. A "converging" docking guide that plays while a harvester is due |
| 13 | Docked harvester | on the pad | — | house colour | the unit is drawn on the pad while unloading |
| 14 | Beacon | (0.25, 1.75) | — | house | — |

- **Silhouette cues.**
  - Three orange discs stacked on the west side.
  - A long pipe and a white tank along the north edge.
  - A chunky lavender machine with a single blue eye.
  - A big pale pad on the east third with a cross of dark dots; the pad is the brightest
    rectangle in a base.
- **Genesis vs PC.** PC uses four grey domed tanks plus a house-coloured diamond pad. Only the idea
  (processing block plus pad on the east) is shared. **Follow Genesis.**
- **3D advice.**
  - The pad must be almost flush (≤ 0.05) so the harvester can drive onto it.
  - Pad lights: emissive discs driven by the 4-step sequence.
  - The grille tops can be real radial slats over an emissive orange core. Glow when refining
    spice.
  - The north pipe and tank at about 0.2–0.35 height form a low "back wall" that frames the
    building when seen from the south.
  - Give the machine's south face a hatch where the pistons meet it.

---

### 2.5 Spice Silo — 2×2 (the navy block with two tank tops)

**References.** Genesis `genesis-structure-spice-silo-sprite.png` / `-grid8x.png`,
`…spice-silo-user-crop.png` (image 5, two silos). Production portrait: grey tanks with a ladder,
in `genesis-structure-build-icons.png`. PC `pc-structure-spice-silo.jpg` (painted: tall cylindrical
tanks with low conical roofs, ladders and pipes; sprite: two round tanks).

**Plan**
```
x→      0.0         0.5         1.0         1.5        2.0
z 0.00  ░░  ░░  ░░  ░░  ░░  ░░  ░░  ░░
  0.25  ≈≈  T1  T1  T1  ≈≈  rr  rr  ≈≈
  0.50  T1  T1  T1  T1c ≈≈  rr  rr  ≈≈
  0.75  T1  T1  T1  T1  //  ≈≈  rr  ≈≈
  1.00  FF  //  T2  T2  T2  T2  rr  ≈≈
  1.25  FF  ≈≈  T2  T2  T2  T2  T2c ≈≈
  1.50  OO  OO  T2  T2  T2  T2  ≈≈  ≈≈
  1.75  OO  OO  FF  FF  ≈≈  ≈≈  ≈≈  ░░
░ olive plate margin · ≈ navy raised block · T1/T2 cylindrical tank (c = small C-clip hatch on its east side)
r rivet/valve balls · F fin cluster · / cast shadow of tank 1 across the block · O beacon
```

| # | Component | Position / size | h | Colours | Notes |
|---|---|---|---|---|---|
| 1 | Olive plate | 2×2, visible only as a thin margin | 0.04 | §1.3 | — |
| 2 | Navy block | x 0.12–1.9, z 0.12–1.9 | 0.2–0.25 | #21214a, lavender #9494b5 lit rim with white on N and W, black on S and E | a low tank plinth |
| 3 | Tank 1 | centre (0.55, 0.59), outer dia 0.92, roof disc dia 0.72 | 0.6–0.7 (roof) | roof: white #ffffff disc, lavender inner ring, navy band, lavender outer rim | a cylinder whose top shows as white-rimmed rings: a flat or slightly domed roof with a raised edge and a hatch ring. Its shadow falls diagonally SE across the block |
| 4 | Tank 2 | centre (1.12, 1.38), outer dia 0.95, roof disc dia 0.8 | 0.6–0.7 | same | same |
| 5 | C-clips | east side of each tank: (0.98, 0.6), (1.5, 1.35) | at the roof | dark olive / black | a small hatch or valve handle on the rim |
| 6 | Rivet / valve balls ×6 | a 2×2 block at x 1.33 / 1.56, z 0.33 / 0.57, then two more at x 1.56, z 0.82 / 1.05 | 0.08 on the block | lavender + white spec | a valve manifold |
| 7 | Fin clusters ×2 | W edge x 0.04–0.47, z 1.02–1.41; SW x 0.51–0.94, z 1.52–1.95 | 0.2–0.3 | white / lavender plates, dark gaps | read as ladders or pipe manifolds hanging over the block edge [M] |
| 8 | Beacon | (0.25, 1.75) | — | house | — |

- **Silhouette cues.** A dark navy square carrying two big pale **round tank tops** set diagonally
  (NW and SE), with a column of little balls on the east side. From the camera: two squat, pale
  grey-violet tanks on a dark block.
- **Genesis vs PC.** Same concept: two round tanks. PC's art shows tall tanks with vertical
  ribbing, ladders, a top rail and low cone roofs. **Follow Genesis** for layout and colours
  (lavender tanks, white roofs, navy plinth). Use PC for tank-wall detail: vertical seams, a caged
  ladder (the "fin" clusters could be ladders), a thin top railing.
- **3D advice.**
  - Tanks: 16–24-sided cylinders about 0.45 tall above the plinth, with a white roof disc, two
    concentric grooves and a small hatch.
  - The south faces of the tanks and the block are visible, so add vertical seam lines and one
    ladder per tank on the south-west.
  - Optional: a spice-level strip or glow on each tank's south face.
  - No house paint; the beacon carries the house.

---

### 2.6 Radar Outpost — 2×2

**References.** Genesis `genesis-structure-radar-outpost-sprite.png` / `-grid8x.png`,
`…radar-outpost-user-crop.png` (image 3), longplay `…sardaukar-radar.png`,
`genesis-screenshot-build-menu-outpost.png` (portrait: grey building with dishes and antennas).
PC `pc-structure-radar-outpost.jpg` (painted: long low grey block with a big dish and a second
dish; sprite: flat khaki roof with a small dish).

**Plan**
```
x→      0.0         0.5         1.0         1.5        2.0
z 0.00  ··  ··  ··  ··  RR  RR  RR  ··
  0.25  ··  dd  dd  nn  RR  RR  RR  RR
  0.50  kk  dY  dd  ··  RR  R+  RR  RR
  0.75  kk  dd  dd  ··  RR  RR  RR  RR
  1.00  ··  ww  pp  pp  RR  RR  RR  ··
  1.25  ··  yy  pp  pp  Ho  Hg  Hg  ··
  1.50  OO  OO  ··  bb  Hv  HH  HH  ··
  1.75  OO  OO  ··  ··  ··  ··  ··  ··
d satellite dish (Y = yellow feed) · k small grey blocks · n neck block to the dome · R four-petal dome (+ = centre)
w white pipe · p pistons · y yellow bar · H housing (o porthole, g gauges, v vent) · b rivet ball · O beacon
```

| # | Component | Position / size | h | Colours | Notes |
|---|---|---|---|---|---|
| 1 | Olive plate | 2×2 | 0.04 | §1.3 | — |
| 2 | Satellite dish | bowl x 0.23–0.78, z 0.23–0.98, facing up and to the W/NW | on a mast, rim top about 0.6 | bowl navy / lavender with a white rim; feed struts **yellow** (Y shape) | the second hero element; its yellow Y feed is a strong cue |
| 3 | Small blocks | x 0.06–0.2, z 0.5–0.66 and 0.76–0.92 | 0.12 | lavender | cable boxes |
| 4 | White pipe | from the dish base (0.23, 0.94) curving east to (1.05, 1.0) | 0.08 | white | links the dish to the dome |
| 5 | Neck block | x 0.8–1.04, z 0.18–0.39 | 0.3 | lavender | joins the dish side to the dome |
| 6 | **Four-petal dome** | octagon x 1.04–1.84, z 0.12–1.13, centre (1.44, 0.62) | 0.55 | lavender #9494b5 petals, navy #21214a seams, dark rivets (4 per petal), black centre dot | an octagonal radome split into four petals by a cross of seams. The key silhouette |
| 7 | Housing | x 1.02–1.8, z 1.13–1.72 | 0.3 | lavender, navy details | on its top/south face: round dark porthole (1.11, 1.37); **two gauges with yellow needles** (1.37, 1.41), (1.6, 1.41); small square vent (1.13, 1.6) |
| 8 | Pistons ×2 | x 0.55–0.94, z 1.05–1.4 | 0.25 | lavender, white caps | — |
| 9 | Yellow bar | x 0.23–0.5, z 1.17–1.23 | 0.05 | #ffde00 | a warning bar or handrail |
| 10 | Rivet ball | (0.84, 1.58) | 0.08 | lavender | — |
| 11 | Beacon | (0.25, 1.75) | — | house | — |

- **Silhouette cues.** A bulbous lavender radome with a cross of seams, beside a tilted dish with a
  yellow feed. Everything else is low.
- **Genesis vs PC.** PC is a long flat bunker with a dish on top. **Follow Genesis.** The dish on
  PC rotates, which is a good idle animation.
- **3D advice.**
  - Dome: 8-sided, slightly flattened hemisphere on a short drum. Cut four petals with recessed
    seam grooves; add studs.
  - Dish: shallow paraboloid about 0.55 across, tilted about 35° toward the W/NW. Yellow tripod
    feed. Slow yaw rotation as idle animation (360° in about 8 s).
  - The housing's south face faces the camera: put the porthole and the two gauges there, as round
    insets with yellow needles.

---

### 2.7 Barracks — 2×2

**References.** Genesis `genesis-structure-barracks-sprite.png` / `-grid8x.png`, longplay
`…sardaukar-barracks.png` (purple beacon). PC `pc-structure-barracks.gif` (painted: an open-roofed
khaki concrete compound with soldiers drilling in the courtyard and flagpoles; sprite: khaki walled
rooms with magenta flags).

**Plan**
```
x→      0.0         0.5         1.0         1.5        2.0
z 0.00  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈
  0.25  ≈≈  11  11  11  22  22  22  22
  0.50  ≈≈  11  ≈≈  ≈≈  ≈≈  ≈≈  22  22
  0.75  ≈≈  11  ≈≈  ≈≈  ≈≈  ≈≈  22  22
  1.00  ≈≈  33  33  ≈≈  ≈≈  ≈≈  22  22
  1.25  ≈≈  33  ≈≈  ≈≈  ≈≈  ≈≈  44  44
  1.50  OO  OO  ≈≈  55  ≈≈  44  44  44
  1.75  OO  OO  ≈≈  55  ≈≈  44  44  44
≈ navy courtyard · 1–5 olive bunker walls · O beacon
```

| # | Component | Position / size | h | Colours | Notes |
|---|---|---|---|---|---|
| 1 | Navy courtyard | whole 2×2 | 0.03 | #21214a, lavender rim N and W | open parade ground |
| 2 | Bunker 1 (NW corner L) | x 0.25–0.82, z 0.25–0.8, arms 0.24 thick (north arm across; west arm down) | 0.3 | top #4a4a21, rim #b5b594, inner white highlight, black SE shadow | 2 firing slits down the west arm, porthole bolt at the corner |
| 3 | Bunker 2 (NE, long, reversed L) | x 1.0–1.82, z 0.25–1.05: north arm z 0.25–0.51; east arm x 1.5–1.82 down to z 1.05 | 0.3 | same | 4 slits down the east arm; a small "E"-shaped vent at its NE; porthole bolt |
| 4 | Bunker 3 (W pillbox) | x 0.25–0.55, z 1.02–1.31 | 0.3 | same | porthole bolt |
| 5 | Bunker 4 (SE corner L) | x 1.25–1.82, z 1.25–1.82: east arm and south arm | 0.3 | same | porthole bolt |
| 6 | Bunker 5 (S pillbox) | x 0.76–1.05, z 1.5–1.82 | 0.3 | same | porthole bolt |
| 7 | Beacon | (0.25, 1.75) | — | house | — |

- **Silhouette cues.** A dark courtyard ringed by broken olive L-shaped bunkers with light rims and
  long black SE shadows. It reads as a fortified drill yard, with no roof.
- **Genesis vs PC.** Same concept on both: an open walled compound. PC adds soldiers, flags and
  stairs. **Follow Genesis.** Worthwhile PC additions:
  - a couple of tiny soldier figures drilling in the yard (idle animation),
  - stairs on the inside of one bunker,
  - one or two thin flag poles (could carry the house pennant, §1.5).
- **3D advice.**
  - Walls are boxes about 0.3 tall with a khaki cap chamfer (lit NW) and slit windows on their
    **outer** faces (dark recessed slots).
  - Porthole bolts: small lavender discs on the tops.
  - Leave the courtyard empty or lightly populated so its navy colour reads from the camera.

---

### 2.8 WOR (Heavy Trooper facility) — 2×2 — no Genesis equivalent

**References.** PC `pc-structure-wor.gif`: painted as a sand-coloured adobe or Moorish fortress
with round towers, a row of arches, a dome and an antenna. The sprite inset is brown walls with a
round yellow dome in the SE and a grey turret. PC longplay `…palaces-heavy-factory-wor.png`
(bottom-left, brown walled block with a red flag). Genesis: none (FAQ, and the trooper barracks
looks like the Barracks).

**Proposed Genesis-style design** [L, invented to fit the style]
```
x→      0.0         0.5         1.0         1.5        2.0
z 0.00  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈
  0.25  ≈≈  TT  11  11  11  11  TT  ≈≈
  0.50  ≈≈  11  ≈≈  ≈≈  ≈≈  ≈≈  22  ≈≈
  0.75  ≈≈  11  ≈≈  aa  aa  ≈≈  22  ≈≈
  1.00  ≈≈  11  ≈≈  aa  aa  GG  GG  ≈≈
  1.25  ≈≈  11  ≈≈  ≈≈  ≈≈  GG  GG  ≈≈
  1.50  OO  OO  33  33  ≈≈  GG  GG  ≈≈
  1.75  OO  OO  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈
T round corner towers · 1–3 bunker walls (Barracks kit, closed ring with a south gate) · a antenna mast on a small block
G gold dome (the trooper hall) · O beacon
```
- Reuse the Barracks kit (§2.7), but close the ring more:
  - Two round corner towers (dia 0.3, h 0.45) at the NW and NE.
  - A gold dome (Palace gold, dia 0.55, h 0.35) in the SE quadrant, taken from the PC WOR's dome.
  - A lavender antenna mast with a small dish in the middle, taken from the PC art.
- Colours stay Genesis: olive and khaki bunkers, a navy yard, gold dome, lavender mast.
- **Distinguishing cue versus the Barracks:** the gold dome and the towers.

---

### 2.9 Light Factory — 2×2 — no Genesis equivalent

**References.** Genesis Vehicle Factory (§2.10, same visual family). PC
`pc-structure-light-factory.gif`: painted as a trike or quad hoisted by a crane in a factory
yard; the sprite inset is a dark building with a red light.

**Proposed design:** a 2×2 cut-down of the Genesis Vehicle Factory [L]
```
x→      0.0         0.5         1.0         1.5        2.0
z 0.00  ··  ··  BB  vv  vv  BB  BB  ··
  0.25  FF  FF  ff  ff  ff  ff  BB  ··
  0.50  FF  FF  ff  ◎◎  ◎◎  ff  BB  ··
  0.75  FF  FF  ff  ◎◎  ◎◎  ff  ss  ··
  1.00  ··  ··  BB  BB  YY  YY  YY  ··
  1.25  ··  ··  BB  BB  YY  V1  YY  ··
  1.50  OO  OO  SS  SS  YY  YY  YY  ··
  1.75  OO  OO  ··  ··  ··  ··  ··  ··
F prongs · B lavender block · f fan housing · ◎ concentric fan · v vents · s shadow line
Y navy bay with one small vehicle V1 (trike/quad) · S ribbed stack · O beacon
```
- Same materials as §2.10. Keep the square fan housing and the western prongs; they are the family
  cues. Drop the long pointed east roof: that difference separates Light from Heavy at a glance.
- The bay holds **one** small vehicle (a trike) instead of two.
- Optional PC cue: a small yellow jib crane over the bay with a hook (h about 0.6).

---

### 2.10 Heavy Factory — 3×2 — the Genesis "Vehicle Factory"

**References.** Genesis `genesis-structure-vehicle-factory-sprite.png` / `-grid8x.png`,
`…vehicle-factory-user-crop.png` (image 2), longplay `…atreides-repair-walled.png`,
`…ordos-base.png`, `…harkonnen-refinery-dock.png`. PC `pc-structure-heavy-factory.jpg` (painted:
a huge grey stepped hangar with a tank on the line; sprite: grey block with a big red light),
`pc-screenshot-longplay-heavy-factory.png` (a ribbed half-cylinder hangar plus a crane arm and flag).

**Plan**
```
x→      0.0         0.5         1.0         1.5         2.0         2.5        3.0
z 0.00  ··  ··  BB  vv  vv  vv  rr  rr  rr  rr  BB  ··
  0.25  FF  FF  f*  ff  ff  ff  BB  BB  BB  BB  BB  ··
  0.50  FF  FF  ff  ◎◎  ◎◎  ff  EE  EE  EE  EE  E>  ··
  0.75  FF  FF  ff  ◎◎  ◎◎  ff  ss  ss  ss  ss  ss  ··
  1.00  FF  FF  ff  ff  ff  f*  YY  YY  YY  V2  V2  ··
  1.25  ··  ··  BB  BB  SS  SS  YY  V1  V1  V2  YY  ··
  1.50  OO  OO  BB  BB  SS  SS  YY  V1  V1  YY  YY  ··
  1.75  OO  OO  ··  ··  ··  ··  ··  ··  ··  ··  ··  ··
F four prongs · B lavender main block · f square fan housing (* = blue slit light) · ◎ concentric-ring fan
v roof vents · r ribbed roof units · E long east roof with a pointed east end (>) · s black shadow under the roof edge
Y open navy bay · V1, V2 vehicles being built · S stepped ribbed stack · O beacon
```

| # | Component | Position / size | h | Colours | Notes |
|---|---|---|---|---|---|
| 1 | Olive plate | 3×2 | 0.04 | §1.3 | — |
| 2 | Prongs ×4 | x 0.16–0.51, centres z 0.32 / 0.57 / 0.83 / 1.08, each 0.14 thick | 0.15–0.2 | lavender, white top, dark tip dot | horizontal rails or exhaust pipes sticking out west. A strong silhouette cue |
| 3 | Main block | x 0.51–2.73, z 0.12–0.98, plus a W leg x 0.51–1.48 down to z 1.8 (an L around the bay) | 0.5 | lavender #9494b5 faces, white edges, navy #21214a recesses, black outline | the factory hall |
| 4 | Fan housing | square x 0.59–1.41, z 0.37–1.07 | 0.55 (raised rim) | lavender frame with white inner highlight | — |
| 5 | **Concentric fan** | dia 0.58, centre (1.0, 0.76) | recessed 0.1 into the housing | navy disc with 4–5 black concentric rings | the "concentric-circle fan": the building's logo. A slowly rotating turbine works well |
| 6 | Blue slit lights | at (0.74, 0.29) and (0.8, 1.17), the housing's NW and SW corners | — | #004ade + cyan, emissive | — |
| 7 | Roof vents | x 0.9–1.41, z 0.08–0.23 | 0.55 | alternating dark and white slats | — |
| 8 | Ribbed roof units | x 1.52–2.42, z 0.12–0.31 | 0.55–0.6 | pairs of lavender rings and white boxes | a radiator bank |
| 9 | East roof | x 1.48–2.73, z 0.37–0.74, ending in a chevron point x 2.54–2.73 | 0.55 | lavender with white highlight stripes | overhangs the bay; casts the black band z 0.74–0.98 |
| 10 | **Open bay** | x 1.5–2.73, z 0.98–1.76 | floor 0.02 | navy #21214a | open to the south and east. Vehicles exit here |
| 11 | Vehicles in bay | V1 x 1.8–2.19, z 1.25–1.6; V2 x 2.3–2.7, z 1.04–1.37 | 0.12 | olive-brown bodies, black wheels, white glints | neutral colour (not house), shown as if on the assembly line [M: may be decoration only] |
| 12 | Stepped stack | x 1.02–1.48, z 1.13–1.76 | 0.35 | 4 lavender bars with white tops | a stair-like or conveyor structure next to the bay |
| 13 | Beacon | (0.25, 1.75) | — | house | — |

- **Silhouette cues.**
  - A big lavender L-shaped hall.
  - A square frame holding a **black-ringed round fan**.
  - Four prongs pointing west.
  - An arrow-pointed east roof.
  - A dark bay in the SE with small vehicles.
- **Genesis vs PC.** PC splits Light and Heavy. The Heavy Factory is a large grey hangar (a ribbed
  half-cylinder) with a crane arm and a flag. **Follow Genesis.** This is also what the user
  pointed at in image 2.
- **3D advice.**
  - The bay should be a real opening under the east roof, lit dark navy, with the roof on 2–3 thin
    columns at the south edge.
  - Add a roll-up door or light strip at the bay's south mouth; vehicles roll out southward.
  - The fan can spin while producing.
  - South face of the W leg: ribbed stack and panel lines.
  - Keep the hall at 0.5–0.6; nothing needs to be taller.

---

### 2.11 High-Tech Factory — 2×2 on Genesis (the project uses 3×2)

**References.** Genesis `genesis-structure-hitech-factory-sprite.png` / `-grid8x.png`, longplay
`…atreides-base-hitech.png` (selected; carryall in production), `…late-base-status-icons.png`
(four of them). User image 5 (partial). PC `pc-structure-hightech-factory.gif` (painted: white
futuristic hangar with tall white pylons carrying orange flame marks, ornithopters, a big white
sphere; sprite 3×2).

**Plan (Genesis 2×2)**
```
x→      0.0         0.5         1.0         1.5        2.0
z 0.00  ·C  CC  ··  BB  BB  BB  BB  ··
  0.25  CC  CC  k·  BB  BB  BB  B)  ··
  0.50  CC  ■C  ##  ##  ##  ··  bb  ··
  0.75  CC  ■C  ##  ##  ##  ··  ··  ··
  1.00  CC  ■C  k#  ##  TT  TT  TT  ··
  1.25  CC  CC  u·  ··  TT  T+  TT  ··
  1.50  OO  OO  FF  FF  TT  TT  TT  ··
  1.75  OO  OO  FF  FF  ··  ··  ··  ··
C oval capsule (■ = blue windows) · k clamps · B long beam/wing (rounded east end) · # lattice deck
b rivet ball · T turntable (+ = white cross) · u small canister · F fin cluster · O beacon
```

| # | Component | Position / size | h | Colours | Notes |
|---|---|---|---|---|---|
| 1 | Olive plate | 2×2 | 0.04 | §1.3 | — |
| 2 | **Oval capsule** | x 0.15–0.65, z 0.1–1.45 (long axis N–S) | 0.35 | lavender body, white rim highlight on the W, navy outline; **3 blue windows** on its centre line at z about 0.5 / 0.75 / 1.0 | an aircraft fuselage or pod being built (the building makes carryalls and ornithopters) |
| 3 | Clamps | x 0.6–0.75 at z 0.3 and 1.13 | 0.2 | white / lavender ribs | hold the capsule |
| 4 | Beam / wing | x 0.78–1.84, z 0.08–0.47, rounded east end | 0.55 (on supports) | lavender, white top stripe, row of dark slots | an overhead gantry or a wing section |
| 5 | Lattice deck | x 0.66–1.29, z 0.5–1.17 | 0.05–0.2 | lavender bars, olive showing through | open grating, about 8×8 cells |
| 6 | Rivet ball | (1.56, 0.82) | 0.08 | lavender | — |
| 7 | **Turntable / hatch** | centre (1.38, 1.38), dia 0.68 | 0.06 | lavender rim, navy ring with radial ticks, white cross in the centre | a round launch plate. Can rotate |
| 8 | Canister | x 0.55–0.7, z 1.2–1.45 | 0.2 | lavender | — |
| 9 | Fin cluster | x 0.5–0.98, z 1.5–1.95 | 0.25 | white / lavender | kit piece |
| 10 | Beacon | (0.25, 1.75) | — | house | — |

- **Silhouette cues.** A long rounded capsule with blue portholes along the west side, a gantry
  beam across the top, see-through lattice, and a round plate with a cross. It is the most
  "sci-fi" building.
- **Genesis vs PC.** PC's 3×2 is a white hangar with pylons, a dome and parked ornithopters.
  **Follow Genesis** for components and palette.
- **3D advice for the project's 3×2 footprint** [L]:
  - Keep the Genesis 2×2 composition in the west two tiles.
  - Stretch the beam across the full width (x 0.78–2.84) on 3 thin supports.
  - Move the turntable to the east tile as a **landing pad** (centre about (2.4, 1.3), dia 0.8),
    so the new third tile has a purpose: aircraft leave from it.
  - Add a second, smaller capsule or a parked ornithopter shape on the lattice.
  - Optional PC cue: two slim white pylons (h 0.8) at the NE corner with orange stripes.
- Capsule windows glow blue (emissive). The capsule's south end faces the camera; give it a
  nose-cone or door.

---

### 2.12 Repair Facility — 3×2

**References.** Genesis `genesis-structure-repair-facility-sprite.png` / `-grid8x.png`, longplay
`…atreides-repair-walled.png` (walled repair facility), `…ordos-base.png`. PC
`pc-structure-repair-facility.jpg` (painted: a tank lifted in an overhead gantry bay while a
mechanic works; sprite: grey machinery and a big ribbed drum).

**Plan**
```
x→      0.0         0.5         1.0         1.5         2.0         2.5        3.0
z 0.00  ··  ··  ··  ··  ··  ··  ··  ··  ··  ··  ··  ··
  0.25  ··  cc  cc  ww  ≈≈  gg  gg  ≈≈  GG  GG  ▓▓  ··
  0.50  ··  gg  gg  ≈≈  oo  ≈≈  aa  aa  GG  GG  ▓▓  ··
  0.75  ··  ww  ≈≈  ≈≈  oo  ≈≈  aa  aa  G□  G□  ▓▓  ··
  1.00  ··  PP  PP  PP  RR  RR  RR  RR  GG  GG  ▓▓  ··
  1.25  ··  PP  PP  PP  RR  RR  RR  RR  G□  G□  ▓▓  ··
  1.50  OO  OO  uu  uu  LL  LL  LL  LL  GG  GG  ▓▓  ··
  1.75  OO  OO  ··  ··  ··  ··  ··  ··  ··  ··  ▓▓  ··
≈ navy work floor · c crates · g gold bars / barrels · w wrenches · o box + hex nut · a white arms from the gantry
G tall white gantry (□ = sockets) · ▓ its black shadow · P three pistons · u pump/linkage
R long white rail · L four yellow lights under the rail · O beacon
```

| # | Component | Position / size | h | Colours | Notes |
|---|---|---|---|---|---|
| 1 | Olive plate | 3×2 | 0.04 | §1.3 | — |
| 2 | Navy work floor | x 0.25–1.76, z 0.25–0.98 | 0.02 (sunken) | #21214a | the workshop floor carrying spare parts |
| 3 | Crates ×2 | x 0.25–0.68, z 0.25–0.43 | 0.12 | #944a00, cream corner | — |
| 4 | Gold bars / barrels | x 0.25–0.68, z 0.51–0.68 and x 1.25–1.72, z 0.27–0.43 | 0.08 | gold / orange stripes #ffde00 / #b56b00 | 3 lying cylinders or ingots per stack |
| 5 | Tools | wrenches at (0.84, 0.35) and (0.37, 0.82); diagonal bar (0.8, 0.5)→(1.05, 0.9); orange box (1.11, 0.62); hex nut (1.11, 0.88) | 0.03–0.08 | white / lavender tools, orange box and nut | flat props |
| 6 | Arms | x 1.48–2.0 at z 0.6 and 0.83 | 0.4 | white tubes | robot arms reaching from the gantry over the floor |
| 7 | **Gantry** | x 2.0–2.5, z 0.25–1.76 | 0.7–0.8 | white #ffffff face stripe, lavender sides, navy outline | the tallest part; 2 square sockets with brown tool marks at z 0.76–1.0 and 1.27–1.5; casts a long black shadow east |
| 8 | Pistons ×3 | x 0.37 / 0.62 / 0.86, z 1.02–1.41 | 0.3 | lavender, white caps | lifting rams |
| 9 | Pump / linkage | x 0.51–0.98, z 1.48–1.84 | 0.15 | lavender | — |
| 10 | **Rail / bay front** | x 1.0–2.0, z 1.02–1.48, bright white core z 1.25–1.45 | 0.25 | white / lavender | the long white bar the user sees: the front beam of the repair bay |
| 11 | Yellow lights ×4 | at z 1.56, x 1.15 / 1.39 / 1.64 / 1.89, in dark slots on the rail's south face | — | #ffde00, emissive | could blink while repairing [L] |
| 12 | Beacon | (0.25, 1.75) | — | house | — |

- **Silhouette cues.** A tall white **gantry** on the east side with a long white rail running west
  from its foot (an L of white). Four yellow lights under the rail. A cluttered dark workshop floor
  in the NW.
- **Genesis vs PC.** PC's art (a unit hoisted under an overhead gantry) matches the Genesis gantry
  and rail idea. PC's sprite differs. **Follow Genesis.** Use PC for the gantry form: an overhead
  bridge with a hoist.
- **3D advice.**
  - Make the gantry a real portal: two white uprights (at z about 0.3 and 1.7) with a top beam at
    0.75, spanning the east side.
  - The rail becomes a low platform edge. The repaired unit parks between the rail and the gantry,
    around (1.8, 1.3) [L].
  - The arms can swing over the parked unit.
  - The project's `pad: [1.5, 1]` / `entrance: [1, 2]` fit this layout.

---

### 2.13 House of IX (IX Research Center) — 2×2 — no Genesis equivalent

**References.** PC `pc-structure-ix-research.gif`: painted as stacked blue saucer tiers with green
lights and an antenna; the sprite is three blue faceted domes. PC longplay
`pc-screenshot-longplay-ix-windtrap-barracks.png` (clear in-game view: three stepped blue domes,
each with a white antenna spike, on a grey plate with white corner triangles, and a red flag in the
SE). Genesis: none.

**Proposed design, PC form in Genesis colours** [M for form, L for colours]
```
x→      0.0         0.5         1.0         1.5        2.0
z 0.00  ◤·  ··  ··  ··  ··  ··  ··  ·◥
  0.25  ··  ▲1  ▲1  ▲1  ▲2  ▲2  ▲2  ··
  0.50  ··  ▲1  ▲1  ▲1  ▲2  ▲2  ▲2  ··
  0.75  ··  ▲1  ▲1  ▲3  ▲3  ▲2  ··  ··
  1.00  ··  ··  ··  ▲3  ▲3  ▲3  ··  ··
  1.25  ··  ··  ▲3  ▲3  ▲3  ▲3  ··  ··
  1.50  OO  OO  ··  ▲3  ▲3  ··  ··  ··
  1.75  OO◣ OO  ··  ··  ··  ··  ··  ·◢
▲1–▲3 stepped (tiered) domes · ◤◥◣◢ light corner triangles on the plate · O beacon
```
- Three **stepped domes**, each 3–4 stacked discs of shrinking radius topped by a small cap and a
  white antenna spike:
  - dome 1 centre about (0.55, 0.55), dia 0.8,
  - dome 2 centre about (1.45, 0.5), dia 0.8,
  - dome 3 centre about (1.0, 1.25), dia 0.85.
- Heights: total about 0.55–0.65 plus a 0.15 antenna.
- Colours:
  - tiers Genesis blue #004ade to #0059f7, with cyan #00ffff rim highlights,
  - navy #21214a gaps between tiers,
  - white antenna,
  - olive base plate with khaki rims,
  - four small khaki or white corner triangles (a PC cue that echoes the Genesis pad triangles).
- Optional: small green emissive dots around each tier, from the PC painted art.
- Keep it clearly **blue**: that is its identity in PC and it contrasts with every Genesis building.

---

### 2.14 Starport — 3×3

**References.** Genesis `genesis-structure-starport-sprite-frames.png` (4 frames),
`…starport-grid8x.png`, `…starport-user-crop.png` (image 1), longplay
`…harkonnen-palace-starport.png`. PC `pc-structure-starport.gif` (painted: tan adobe towers with
mushroom caps and a frigate; sprite: grey pad with magenta house chevrons, a tan tower, round radar
domes).

**Plan (cell = 0.25; 12 × 12)**
```
x→      0.0         0.5         1.0         1.5         2.0         2.5        3.0
z 0.00  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈
  0.25  ≈≈  L1  L1  L1  L1  L1  ≈≈  L2  L2  L2  L2  ≈≈
  0.50  ≈≈  L1  gd  gd  e1  e1  ≈≈  ≈≈  ≈≈  L2  h2  ≈≈
  0.75  ≈≈  L1  gd  gd  e1  e1  ≈≈  ≈≈  e2  e2  L2  ≈≈
  1.00  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  cc  cc  e2  e2  L2  ≈≈
  1.25  ≈≈  e3  e3  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  mm  mm  ≈≈
  1.50  ≈≈  e3  e3  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈  ≈≈
  1.75  ≈≈  L3  L3  L3  L3  L3  ≈≈  ◤▫  ▫●  ▫▫  ●▫  ▫◥
  2.00  ≈≈  Lw  L3  L3  L3  ★3  ≈≈  ▫▫  ◢▫  ●▫  ▫◣  ▫▫
  2.25  ≈≈  ≈≈  ≈≈  L3  L3  L3  ≈≈  ●▫  ●●  ●●  ●●  ▫●
  2.50  ≈≈  ≈≈  ≈≈  L3  bx  L3  ≈≈  ▫▫  ◥▫  ●▫  ▫◤  ▫▫
  2.75  OO  OO  ≈≈  L3  L3  L3  ≈≈  ◣▫  ▫●  ▫▫  ●▫  ▫◢
≈ navy apron · L1–L3 brass L-shaped buildings · e1–e3 black glass "eye" lenses in gold rings · gd gold dithered dome
h2 small hatch · c brass capsule · m maroon insert · Lw white window · bx light-grey box · ★ gold star emblem
▫ light landing pad (x 1.76–3.0, z 1.76–3.0) with a plus-shaped cross of 9 dark circles, 4 corner triangles
and 4 inner diagonal triangles · O beacon
```
Landing-pad markers, exactly (pad x 1.76–3.0, z 1.76–3.0; circle dia about 0.16):
```
 corner ◤ at (1.86,1.88)          ●(2.36,1.88)           corner ◥ at (2.87,1.88)
            inner ◢ (2.11,2.11)   ●(2.36,2.11)   inner ◣ (2.62,2.11)
 ●(1.88,2.36) ●(2.11,2.36) ●(2.36,2.36) ●(2.62,2.36) ●(2.87,2.36)
            inner ◥ (2.11,2.62)   ●(2.36,2.62)   inner ◤ (2.62,2.62)
 corner ◣ at (1.86,2.87)          ●(2.36,2.87)           corner ◢ at (2.87,2.87)
```

| # | Component | Position / size | h | Colours | Notes |
|---|---|---|---|---|---|
| 1 | Navy apron | whole 3×3, lavender rim N and W | 0.03 | #222244 / #151537 | — |
| 2 | Brass block L1 (NW) | L-shape: x 0.51–1.35, z 0.25–0.51 (north arm), plus a small block x 0.25–0.51, z 0.51–0.98 | 0.4 | brass #bf994c, white edge highlights, black SE shadow | control building |
| 3 | Gold dome | centre (0.9, 0.66), dia 0.45 | 0.3 above L1 | dithered gold | partly behind lens e1 |
| 4 | Lens e1 | centre (1.4, 0.6), dia 0.53 | 0.25 above roof | black glass, white glint, gold ring | an observation dome or radar eye. **Signature element** |
| 5 | Brass block L2 (NE) | north arm x 1.78–2.73, z 0.25–0.51; east arm x 2.25–2.73, z 0.51–1.5 | 0.4 | brass | small hatch h2 at (2.5, 0.47); maroon insert at x 2.34–2.7, z 1.17–1.5 |
| 6 | Lens e2 | centre (2.4, 0.9), dia 0.55 | — | same as e1 | — |
| 7 | Capsule | x 1.5–1.91, z 1.04–1.29 | 0.15 | brass, dark slot | a fuel pod or beacon housing |
| 8 | Lens e3 | centre (0.64, 1.37), dia 0.55 | — | same as e1 | on a short brass collar |
| 9 | Brass block L3 (SW) | north arm x 0.25–1.48, z 1.76–2.2; east arm x 0.74–1.48 down to z 2.73 | 0.4 | brass, maroon panel inset, white window (0.4–0.63, 1.97–2.07), grey box (0.92–1.13, 2.42–2.54), gold star (1.35, 2.15) | the "terminal" |
| 10 | **Landing pad** | x 1.76–3.0, z 1.76–3.0 | 0.04 | plate #8888aa; markers #404020 / #55552a with black and white rims | — |
| 11 | Pad lights | the circles and triangles | — | amber **#e0a000** + #e0e0e0 when lit | **animated**, 4 frames. Lights converge inward while a frigate is expected (same scheme as the Refinery) |
| 12 | Beacon | (0.25, 2.75) | — | house | — |

- **Silhouette cues.**
  - A dark apron with warm **brass-gold L-buildings** carrying three big black glass "eyes" in gold
    rings.
  - A pale square pad in the SE with a plus-shaped dot pattern.
  - The only building with brass trim.
- **Genesis vs PC.** PC is tan adobe towers with mushroom caps and a house-coloured chevron pad.
  **Follow Genesis.** An optional PC-style mushroom-capped control tower could sit on L2 if more
  height is wanted.
- **3D advice.**
  - Lenses: hemispheres of glossy black glass (high specular, env reflection) inside gold torus
    rings, about 0.25 above the brass roofs.
  - Brass blocks: chamfered boxes with white-highlighted top edges and recessed maroon panels.
  - Pad: flush, with emissive markers running the converging sequence. The frigate (a unit) lands
    at the pad centre (2.38, 2.38).
  - The south faces of L3 are fully visible: doors and windows (the white window and grey box).

---

### 2.15 Palace — 3×3

**References.** Genesis `genesis-structure-palace-sprite.png` / `-grid8x.png`, longplay
`…harkonnen-palace-starport.png`, `…ordos-palace-hammer.png`,
`genesis-screenshot-palace-production-portrait.png` (portrait: golden gate). PC
`pc-structure-palace.jpg` (painted: stone gatehouse with an ornate golden door and gold onion
domes; sprite: big gold dome with 4–5 small domes, a flag and a curved wall),
`pc-screenshot-longplay-palaces-heavy-factory-wor.png`.

**Plan (12 × 12)**
```
x→      0.0         0.5         1.0         1.5         2.0         2.5        3.0
z 0.00  ··  d1  d1  d1  ··  ··  ··  d2  d2  vv  vv  ··
  0.25  cc  d1  d1  DD  DD  DD  DD  d2  d2  vv  vv  pp
  0.50  pp  ··  DD  DD  DD  DD  DD  DD  d3  d3  d3  ··
  0.75  ··  ··  DD  DD  DD  DD  DD  DD  d3  d3  d3  ··
  1.00  ··  ··  DD  DD  DD  *D  DD  DD  ··  ··  nn  ··
  1.25  ··  ff  DD  DD  DD  DD  DD  DD  ··  ··  nn  ··
  1.50  ··  ff  DD  DD  DD  DD  DD  DD  ··  ··  nn  ··
  1.75  pp  ff  nn  gg  gg  gg  ··  ··  d4  d4  d4  ··
  2.00  ··  d5  d5  nn  ··  ··  ··  ··  d4  d4  d4  ··
  2.25  ··  d5  d5  nn  ##  ##  ··  nn  nn  ··  ··  ··
  2.50  ··  ··  ··  NB  ··  ··  ··  NB  ··  ··  pp  ··
  2.75  OO  OO  ··  ··  •·  ··  •·  ··  •·  ··  •·  ··
D main gold dome (* = dark slit window) · d1–d5 small gold domes · v round navy vent with white grille · c control box
n navy conduits (NB = conduit end-blocks with square holes) · f navy fins · g gate (khaki zig-zag frame, dark inside)
# barred grille · p lavender/white pedestal posts · • white floor dots · O beacon
```

| # | Component | Position / size | h | Colours | Notes |
|---|---|---|---|---|---|
| 1 | Olive plate | 3×3 | 0.04 | §1.3 | — |
| 2 | **Main dome** | centre (1.18, 1.04), dia 1.5 (x 0.41–1.95, z 0.31–1.76) | 0.9–1.0 (hemisphere on a short drum) | gold ramp #944a00 / #b56b00 / #ffb500 / #ffde00, dithered, white spec at NW (1.05, 0.82) | geodesic facet lines; a small dark slit window near the top (1.29, 1.09); darker brown band around its base |
| 3 | Gate | x 0.84–1.6, z 1.68–1.95, on the dome's south side | 0.4 | khaki #b5b594 zig-zag (M/W) frame, dark interior | the palace entrance, facing the camera. The Genesis portrait shows a golden door |
| 4 | Grille | x 1.02–1.48, z 2.17–2.34 | 0.05 | dark vertical bars | a floor grate or steps in front of the gate |
| 5 | Small domes ×5 | d1 (0.6, 0.34), d2 (1.85, 0.34), d3 (2.36, 0.85), d4 (2.36, 1.85), d5 (0.6, 2.1); dia 0.57 each | 0.35–0.4 | same gold, white spec at NW, small dark slit on the SE side | a ring of turret domes around the big one |
| 6 | NE vent | centre (2.48, 0.31), dia 0.4 | 0.2 | navy disc, white grille bars | intake |
| 7 | Navy conduits | east run from the vent down x 2.5–2.73 (z 0.5–1.65), then SW to an end-block at (1.6–1.84, 2.27–2.5); west run from (0.45, 1.3) down to an end-block at (0.74–0.98, 2.27–2.5) | 0.2 | navy #21214a with lavender highlights | thick curved ducts or covered walkways linking the domes [M: purpose] |
| 8 | Fins | x 0.35–0.51, z 1.29–1.84 | 0.25 | navy spikes | antennae or buttresses on the dome's west side |
| 9 | Pedestal posts ×4 | (0–0.23, 0.51–0.72), (0–0.23, 1.76–1.97), (2.73–2.97, 0.25–0.47), (2.5–2.73, 2.5–2.73) | 0.2 | lavender / white, bevelled | lamp or guard posts |
| 10 | Control box | (0.04–0.23, 0.25–0.39) | 0.12 | grey, orange dots | — |
| 11 | Floor dots | z 2.79 at x 0.9 / 1.39 / 1.89 / 2.38 | — | white | marker lights along the south edge |
| 12 | Beacon | (0.25, 2.75) | — | house | — |

- **Silhouette cues.** One big shining **gold dome** with five smaller gold domes around it, joined
  by dark navy ducts. The tallest and brightest object in any base.
- **Genesis vs PC.** Same concept: a cluster of gold domes. PC's domes are dull olive-gold, with
  a curved grey rampart, grey towers, a house flag on the main dome and a small gate. **Follow
  Genesis** colours and layout. Use the PC painted art for the gate (ornate golden door in a tall
  stone arch) on the south face.
- **3D advice.**
  - Main dome: a geodesic hemisphere (or an icosphere cut) with faint facet lines and a strong NW
    specular highlight. Metallic gold.
  - Small domes: plain spheres cut at about 60% on short drums.
  - The south gate faces the camera: a golden door with a khaki zig-zag frame, 0.4 high.
  - Conduits: thick tubes (dia about 0.2) following the plan curves.
  - A thin house pennant on the main dome's top is optional (PC), §1.5.

---

### 2.16 Gun Turret — 1×1

**References.** Genesis `genesis-structure-turrets-sprite-rotations.png` (top row: 8 facings plus
firing frames), `…turrets-user-crop.png`, user images 3 and 4. PC `pc-structure-gun-turret.jpg`
(painted: a khaki concrete bunker with a meander band and a gun on a low turret; the sprite is a
grey round turret with one barrel).

**Plan (cell = 0.125 tile, 8 × 8, facing south)**
```
x→    0 .125 .25 .375 .5 .625 .75 .875 1.0
z 0   ▒▒ ▒▒ ▒▒ ▒▒ ▒▒ ▒▒ ▒▒ ▒▒
.125  ▒▒ ▒▒ ▒▒ ▒▒ ▒▒ ▒▒ ▒▒ ▒▒
.25   ▒▒ ▒▒ ((  ◠◠ ◠◠ ))  ▒▒ ▒▒      ( ) ◠ = dome with khaki rim highlights on N and W
.375  ▒▒ ((  ●● ▬▬ ▬▬ ●●  )) ▒▒      ▬ = dark slot band across the dome
.5    ▒▒ ((  ●● ●● ●● ●●  █) ▒▒      █ = black shadow on the SE of the dome
.625  ▒▒ ((  ●● ║║ ║║ ██  █) ▒▒      ║ = barrel (lavender/white core, navy outline)
.75   ▒▒ ▒▒ ((  ║║ ║║ ██  ▒▒ ▒▒
.875  ▒▒ ▒▒ ▒▒ ║║ ║║ ▒▒ ▒▒ ▒▒
▒ olive 1×1 slab
```

| Component | Size | h | Colours | Notes |
|---|---|---|---|---|
| Slab | 1×1 | 0.04 | §1.3 (turret row: #404020 / #a0a080 / #202000) | — |
| Dome | dia about 0.7, centred | 0.3 | olive #404020, khaki rim #a0a080 with white dots on the N arc, black SE side | a low armoured cupola; a dark horizontal slot crosses its middle (the gun mantlet gap) |
| Barrel | 0.125 wide, from the dome centre to the tile edge (length about 0.47) | axis at 0.22 | navy outline #202040, lavender #8080a0, white #e0e0e0 highlight | 8 facings; placed facing north; "fidgets" in guard mode; firing frames add a muzzle flash |

- **Silhouette cues.** A small olive dome with one long pale barrel reaching the edge of the tile.
  No beacon.
- **Genesis vs PC.** PC art sits the gun on a tall khaki bunker with a meander band. **Follow
  Genesis** for the top view, but use the PC bunker idea for the side walls. From the camera, the
  slab-mounted dome is too flat; a short octagonal plinth (h 0.15, khaki, chamfered) under the
  dome gives it presence without changing the top view.
- **3D advice.** Put the yaw pivot at the dome centre. Barrel with a slight muzzle ring. Keep the
  whole turret ≤ 0.45 tall.

---

### 2.17 Rocket Turret — 1×1

**References.** Same sheet, bottom row; user image 3 (about 16 of them). PC
`pc-structure-rocket-turret.jpg` (the same bunker, with twin 2×3 red-tipped rocket pods beside
the gun).

| Component | Size | h | Colours | Notes |
|---|---|---|---|---|
| Slab, dome, barrel | as the Gun Turret | — | — | the same base and central barrel |
| Rocket pods ×2 | each about 0.19 wide × 0.4 long, one on each side of the dome (S-facing frame: x 0.03–0.22 and 0.78–0.97, z 0.28–0.69) | axis at 0.25 | lavender #8080a0 box, white #e0e0e0 top edge, navy outline | box launchers flanking the gun, parallel to the barrel |
| Rocket tips | 3 per pod, a row at the muzzle end | — | #402000 / #a06000 / #e0c0a0 (orange-brown warheads) | visible as an orange dotted end. PC shows red tips |

- **Silhouette cues.** A dome with the long barrel **plus two chunky side pods** with orange noses:
  a "twin-barrel" look from afar.
- **Genesis vs PC.** Same idea. **Follow Genesis** proportions.
- **3D advice.**
  - The pods yaw with the barrel.
  - Give each pod a 3×1 or 2×3 grid of rocket tubes with orange cones.
  - Recoil the pods when a rocket fires.

---

### 2.18 Wall — 1×1, auto-joining

**References.** Genesis `genesis-structure-wall-sprite-pieces.png` (12 pieces: post, two
straights, four corners, four T-junctions, cross), `…wall-slab-user-crop.png`, longplay
`…atreides-repair-walled.png`, `…sardaukar-radar.png`, `…rubble-explosion.png`. PC
`pc-structure-wall.gif` (tall khaki concrete panels with a Greek-key meander band along the top).

**Section across a straight run** (sprite: 32 px tile, wall body 16 px wide, centred)
```
 tile edge                                   tile edge
 |  concrete  |  WALL (0.5 tile wide)  |  concrete |▓ shadow (0.125) on S / E
              ┌───────────────────────┐
              │  white lip / khaki    │  ← outer lip: white (#ffffff) on N/W, khaki (#b5b594)
              │   ╱─────────────╲     │  ← N/W slopes lit (white), S/E slopes shaded (olive #4a4a21)
              │  ╱   flat top    ╲    │     flat ridge top 0.125 wide, khaki
              │  ─────────────────    │
              └───────────────────────┘
```
Plan pieces: a post is a 0.5×0.5 square block. Straights, corners and tees extend the 0.5-wide
body to the tile edge on each connected side.

| Component | Size | h | Colours | Notes |
|---|---|---|---|---|
| Base plate | 1×1 concrete (§2.2) under each wall tile | 0.04 | olive | always present under walls |
| Wall body | 0.5 wide, centred; runs to the tile edge on connected sides | 0.25 | khaki #b5b594 sides; 1-px white lip N and W; olive groove inside the lip | a chunky, bevelled rampart |
| Ridge cap | a hipped or frustum ridge along the wall's axis, bottom width about 0.36, top flat 0.125 wide | +0.15 (total about 0.4) | top khaki; N and W slopes near-white; S and E slopes olive #4a4a21 | this bevel is what makes Genesis walls look "extruded" |
| Cast shadow | 0.125 to the S and E | — | black | from real height |

- **Silhouette cues.** Pale khaki bars half a tile wide with a raised central ridge, strong white
  top-left bevels and black shadows to the south-east. Joined runs form long "picture-frame"
  rings around buildings.
- **Genesis vs PC.** PC walls are taller, flat khaki panels with a meander band. **Follow Genesis**
  proportions: 0.5 wide and about 0.4 tall, not a thin tall wall. The PC meander could be a subtle
  relief band on the outer faces.
- **3D advice.** Build from 16 connection cases (N/E/S/W bitmask). Model a centre block plus up to
  four arm blocks, each with the ridge. At T and cross junctions, mitre the ridges into a hipped
  crossing, as the sprite shows.

---

## 3. Open questions and low-confidence points

1. **Silo identity is by elimination.** [H but indirect] I never caught the navy tank building
   selected with its orange spice bar in a frame. The Wind Trap evidence is direct (blue bar,
   lightning icon, extracted file name); the Silo follows from it.
2. **Wind Trap cowl: an open mouth or a shadow?** [M] I read the black SE half as the open intake,
   based on PC's arched intakes and the Genesis portrait. It could be pure shading of a closed
   dome. The mouth reading gives a more interesting model and matches the PC design.
3. **Beacon corner.** Every screenshot shows the SW corner; the Genesis FAQ says "near their
   southeast corner". Screenshots win.
4. **Damaged state on Genesis** was not captured in any frame. Only the FAQ description (fire and
   smoke plumes at 50% damage or more) and PC frames were used.
5. **Heights are estimates.** They come from shadow lengths and PC art, and are meant to keep top
   views readable from a 45–60° camera.
6. **Animations seen in the Genesis data:**
   - beacon (8 frames),
   - Refinery and Starport pad lights (4 frames each, converging amber sequence),
   - turret facings and firing,
   - Construction Yard crane (boom changes; exact frame set unknown).

   No animation was seen for the Outpost dish, Vehicle Factory fan, Hi-Tech turntable, Wind Trap or
   Repair gantry. The ones proposed in this document are optional additions (PC animates the
   Outpost dish and the Wind Trap turbine).
7. **Vehicle Factory bay vehicles.** Unknown whether they are fixed decoration or show production.
   On the sheet they are part of the static sprite.
8. **Repair Facility.** Where the unit sits during repair is unknown; I propose between the rail
   and the gantry.
9. **Construction Yard "net"** (dithered olive/black area): could be a net, a heap of fill, or
   the shadow of an unfinished frame. I propose a low scaffold under a net.
10. **Palace navy conduits and fins, Silo fin clusters, Wind Trap brackets.** Purpose uncertain;
    shapes are reliable.
11. **No Genesis source** for the WOR, Light Factory and House of IX. The designs in §2.8, §2.9 and
    §2.13 are proposals that combine PC cues with Genesis materials. The Hi-Tech 3×2 extension
    (§2.11) is also invented.
12. **Colour values.**
    - The sprite-sheet rip uses the 00/21/4A/…/FF scale; the turret and starport rows use
      00/20/40/…/E0.
    - Emulator captures differ slightly again.
    - The existing `palette.js` "Genesis" tokens are darker for rims and machinery than the sprite.
    - Decide on one set and tune under the actual scene lighting.
13. **Lightning icon.** On the silos-and-windtraps frames it sits over Wind Traps, which is
    consistent with the FAQ. It is a UI overlay, not part of the model.

## 4. Note for the units research

- **User image 4** is a line-up of almost every Genesis unit sprite in Atreides blue.
- The Spriters Resource **Genesis unit sheets** are available through the Wayback Machine. Asset
  ids:
  - 141659 Harvester, 141660 Carryall,
  - 169099 Soldier, 169128 Trooper, 169129 Trike, 169130 Quad,
  - added in 2026: 550028 Ornithopter, 550030 Siege Tank, 550031 Sandworm, 550032 Devastator,
    550068 MCV, 550136 Starport ship (frigate), 550380 Missile Tank / Deviator.
  Use the CDX API
  (`https://web.archive.org/cdx/search/cdx?url=www.spriters-resource.com/media/assets/530/<id>*`,
  or `resources/sheets/…` for older ids), then fetch with an `im_` timestamp.
- **GitHub `A1z3n/dune2`** has `Assets/Sprites/Units/*` (quad, soldier, trike, trooper, harvester)
  and `carryall.png`.
- The **Mega Drive longplay** on archive.org can be frame-sampled with ffmpeg over HTTP. Use the
  direct data-node URL: `archive.org/download/...` redirects, and parallel requests get throttled.
