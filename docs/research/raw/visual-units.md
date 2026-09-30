# Units — visual reference for 3D modelling (Genesis first, PC as fallback)

Scope: every unit of Dune II, described so a modeller can rebuild it as a detailed procedural Three.js
model that reads like the 1993/94 Sega Mega Drive / Genesis sprite ("Dune: The Battle for Arrakis").
The PC/DOS "Dune II" (1992) is used where the Genesis version has no such unit, where no Genesis
image could be found, and for side/rear profiles (the Genesis in-game sprites are top-down only).

All descriptions are my own, taken from the images listed per unit. Private copies of the images live in
`docs/research/refs/` (gitignored, never distribute; see `refs/INDEX.md` for source URLs).

Confidence tags: **[H]** high (seen directly, several sources agree), **[M]** medium (seen once or from a
very small sprite), **[L]** low (interpretation, or invented to fill a gap).

Units of measure: 1 map tile = 1 world unit (u) = **16 Genesis pixels** (verified: the VGMaps full-map
rips are 1024 px for a 64-tile map). "px" below always means native Genesis pixels (320×224 screen).
Sprite sizes include the 1-px black outline, so the solid body is roughly 2 px (0.12 u) smaller.
Model axes follow the project: unit faces **+x** (forward), +y up, +z to the unit's left or right as
convenient; "front/rear/left/right" are from the driver's point of view.

---

## 0. Read this first

### 0.1 Findings that change the brief

1. **Genesis units are painted in the house colour almost everywhere — the hull, the turret, the cab,
   even the harvester's whole body.** Metal (grey/white) is reserved for barrels, missiles, wheels,
   track ends, the MCV crane, the Carryall airframe and the Death Hand. Nothing on a Genesis ground
   unit is sand-coloured. [H] (The sand/tan colour exists only in the *production/info-card* art,
   which is a side-view painting, not the unit you see on the map.)
2. **The house colour is a three-tone ramp with a hue shift, not one colour darkened.** Atreides goes
   navy → royal blue → *cyan*; Harkonnen goes near-black maroon → red → *amber/orange*; Ordos goes
   near-black green → green → *yellow-lime*; the Emperor/Sardaukar goes near-black purple → violet →
   bright violet. The light tone sits on upper-left-facing bevels and small glints. Getting this hue
   shift right is the single biggest step towards "looks like the Genesis". [H]
3. **Genesis units are big.** Sprite footprints: Combat Tank ≈ 1.0 × 1.1 tiles, Siege Tank ≈ 1.3 × 1.25,
   Harvester ≈ 1.1 × **1.95**, MCV ≈ 0.95 × 1.5, Carryall ≈ 1.75 × 2.0, Ornithopter span ≈ 1.5. The
   current models are much smaller (tank chassis 0.64 × 0.46, harvester 0.8 × 0.58). If gameplay needs
   smaller units, keep the *relative* sizes in §1.2 and apply one global scale factor. [H]
4. **User screenshot 4 (the Atreides line-up with four bird-shaped aircraft) is not the retail game.**
   The top-left "356 / 88" counter box is not part of the retail HUD, and the hawk-shaped aircraft, the
   round multi-legged vehicle, the tracked drum vehicle and the large hooded infantryman match no
   retail sprite (retail sheets, the in-game tutorial line-up and a 5-hour longplay were checked). It is
   almost certainly a ROM hack (for example the "Dune – Rebuild" hack, which adds Fremen/Sardaukar houses
   and new units). Several of its tanks *are* retail sprites. Do not model the hawk aircraft as the
   Ornithopter. See §0.2 and `refs/genesis-unit-userimg4-nonretail-comparison.png`. [H for "non-retail",
   M for which hack]
5. **The retail Genesis tutorial shows every unit side by side in one frame** (Harkonnen colours) —
   `refs/genesis-unit-lineup-tutorial-native.png` / `-4x.png`. This is the best single reference in
   the folder: Harvester, MCV, Soldier, Trooper, Trike, Quad, Missile Tank (row 1); Combat Tank, Siege
   Tank, Carryall, Ornithopter, Sonic Tank, Death Hand, Devastator (row 2). [H]
6. **Genesis has no separate sprites for Raider Trike, Deviator, Fremen or Sardaukar.** Raider Trike =
   Trike sprite in Ordos green; Deviator = Missile Tank sprite in Ordos green; Fremen = the Trooper squad
   sprite in Atreides blue; the Emperor's forces use the ordinary unit sprites in a fourth, purple
   palette. [H for Raider/Deviator (sheet titles), M for Fremen, H for purple Emperor units]
7. **On Genesis the Devastator's guns and the Missile Tank's rack are fixed to the hull** (only 8 whole-
   vehicle frames exist), while the Combat Tank and Siege Tank have separately rotating turrets (every
   hull × turret direction combination is drawn). The PC version gives the Devastator and Launcher
   rotating turrets. [H]

### 0.2 The five user screenshots — what is in them

| Image | Content (units only) | Confidence |
|---|---|---|
| 1 | Blue **Harvester** parked N-facing on a Refinery pad (key-shaped deck glyph visible); a green **Siege Tank** (Ordos) facing east (twin barrels, corner outriggers) at the left edge. | H / M |
| 2 | Top-left blue **Combat Tank** (round dome turret, single barrel, facing NE); two blue **Missile Tanks** top centre; big blue diagonal "wedge" = **Harvester** (NE frame); small red **Quad** (Harkonnen) on a slab; blue **Quad** lower left; blue **Missile Tank** facing east bottom-left; red **Combat Tank** diagonal with turret pointing west; a burning unit bottom right. | H |
| 3 | Five blue **Missile Tanks** (mixed facings) among rocket turrets. | H |
| 4 | **Non-retail (hack) line-up.** Row 1 (left→right): Quad N [H]; terrain/craters (not a unit); 8-wheeled vehicle with round cab = probably **MCV** (retail-like) [M]; round body with 8 legs/wheels and a green zig-zag crown = unknown hack unit [—]; boxy tracked vehicle with a drum on top = unknown hack unit [—]; small 4-wheeler NE = **Quad** or **Trike** [M]; large hooded rifleman = hack infantry (retail infantry is 6–8 px) [—]. Row 2: **Trike** NE [H]; **Missile Tank** N [H]; Missile Tank/Deviator variant with one missile column showing [M]; **Devastator** N (twin barrels, boxy, no round turret) [M]; **Siege Tank** N (round turret, twin barrels, corner outriggers) [H]; tank with single barrel = **Combat Tank** or hack variant [L]; tank facing east with a white crescent dish = **Sonic Tank** [M]. Top row: four **hawk-shaped aircraft — not the retail Ornithopter**. | see text |
| 5 | Two blue **Missile Tanks** (diagonal), blue **Quad** facing east, blue **Combat Tank** (diagonal hull, turret east). | H |

### 0.3 Sources that worked (and where things are)

| Source | What it gave | Status |
|---|---|---|
| **Wayback Machine copies of The Spriters Resource** (`web.archive.org/web/<ts>id_/https://www.spriters-resource.com/resources/sheets/…` and `…/media/assets/530/…`) | Genesis sprite sheets: Combat Tank, Siege Tank, Devastator, Missile Tank/Deviator, Sandworm (2026 rips by "Arima", every direction, all 4 house palettes, damage states, projectiles, explosions); Harvester, Carryall, Quad, Trike/Raider Trike, Soldier/Infantry, Trooper/Troopers (2020/22 rips, with the Genesis side-view info art). PC sheets: tanks, siege, devastator, harvester, MCV, trike, quad, carryall, ornithopter, sandworm, infantry, troopers. | **Worked** (the live site is Cloudflare-blocked; the Wayback CDX API lists what was captured). Genesis Ornithopter, MCV and Starport Ship sheets were *not* captured. |
| **archive.org "Mega Drive Longplay [468] Dune The Battle for Arrakis"** (three 5-hour 640×448 videos: Atreides, Harkonnen, Ordos) | Real retail frames, grabbed remotely with `ffmpeg -ss … -i <url>` (no full download). The Atreides video's tutorial at ≈3:09 shows all units in one line-up. Late missions show Fremen squads, purple Emperor units, Sonic Tank waves, carryalls carrying. | **Worked** (≈20 s per frame). |
| **VGMaps** (`vgmaps.com/Atlas/Genesis/Dune-BattleForArrakis-<House>-Level<n>.png`) | 27 full-map rips of every mission at native resolution with all starting units and bases, exact Genesis colours. Used to measure sprites pixel-exactly and to sample the palette. **Rich in structures too.** | **Worked** (plain HTTP). |
| **gamesdatabase.org** Genesis manual PDF (`/Media/SYSTEM/Sega_Genesis//Manual/formated/Dune_2_-_Battle_For_Arrakis_-_1994_-_Virgin.pdf`) | Genesis manual scan: unit list, per-house unit tables (confirms Fremen, Saboteur, Raider Trike, Deviator, Death Hand exist on Genesis; no Troopers for Atreides). Unit icons are tiny greyscale side views. | **Worked** |
| **dune2k.com** | PC info cards for every unit incl. Fremen, Saboteur, Sardaukar, Raider Trike, Frigate, Death Hand. | Worked |
| archive.org "Dune II Manual" (PC/Amiga) | 59-page scan (text; not needed further). | Worked |
| GitHub: `nicklockwood/Swune` | Redrawn PC-style 16×16 trike/harvester sprites (blue/red). Minor value. | Worked |
| GitHub `OpenDUNE` houseinfo table | PC house palette slots (Harkonnen 144, Atreides 160, Ordos 176, Fremen 192, Sardaukar 208, Mercenary 224) — no RGB. | Worked |
| emu-land.net, Hidden Palace, romhacking.net, strategywiki (thumbnails only), GitHub search API (rate-limited) | Hack screenshots / prototype info; nothing needed. | Partial |
| Spriters Resource (live), Fandom, MobyGames, GameFAQs, Sega Retro, TCRF, ModDB, romhacking.net | — | Bot-blocked |

---

## 1. Global Genesis unit style

### 1.1 Projection, facings and animation budget [H]

- Straight top-down view with a **light from the upper left (north-west)**. Every sprite keeps that light
  whatever way the unit faces (each facing is a separate drawing), so upper-left edges are always
  bright and lower-right edges always dark. In 3D: one key light from the NW, high elevation; the
  shading must be computed from *world* normals, never baked in model space.
- Very slight "south-tilted" view: south-facing vertical faces show as 1–2 px bands (dark rear band on
  the N-facing harvester, near-side track band on E-facing vehicles). A 45–60° game camera will show
  much more side than the sprites do, so the sides need their own detail (see per-unit notes, taken
  from the side-view info art).
- **Facings:** tanks, harvester, MCV, carryall, launcher, devastator: 8 directions (N, NE, E, SE … with
  3 unique drawings N/NE/E mirrored for harvester and carryall). Trike and Quad: 16 directions (5 unique
  drawings mirrored). Tank turrets: 8 directions, independent of the hull (all 64 combinations drawn).
- **Animation in the retail sprites is minimal:** no wheel spin, no track scroll frames, no rotor/wing
  flap, no carryall claw animation. What *is* animated: turret rotation, a 1-px **recoil** of the whole
  turret on firing (≈0.06 u backwards), small muzzle flashes, infantry walk cycles (3 frames), infantry
  death splat, harvester **dust puff** while harvesting (3 frames), **damage smoke** (three
  escalating states: a small grey puff → a tall dark-grey column with an orange flame at its base; drawn
  over the hull centre), explosions, sandworm mouth sequence, sonic wave, deviator gas cloud.
  In 3D we can and should add track scroll, wheel spin, gentle hover/bob for aircraft, etc. — just keep
  the silhouettes.

### 1.2 Footprints (Genesis, measured) and recommended 3D sizes

Measured from the retail sprites (N-facing, including outline). "3D L×W" is the suggested body size in
world units at Genesis scale; H is from the side-view art (Genesis info art and PC cards) as a ratio of
length. Apply one global factor if the game needs smaller units — keep the ratios.

| Unit | Sprite W×L px | ≈ tiles | 3D body L × W (u) | Height (u) | PC sprite (px) |
|---|---|---|---|---|---|
| Soldier (one figure) | 6–8 × 7–8 | 0.4–0.5 | figure 0.28 wide | 0.32–0.36 tall | 8×8 |
| Infantry / Troopers squad (3 figures) | 13 × 14 | 0.8 × 0.9 | 3 figures in a 0.8-u triangle | 0.34 | 16×16 |
| Trike | 13 × 15 | 0.8 × 0.95 | 0.85 × 0.75 (rear axle) | 0.30 (gun top) | 12×13 |
| Quad | 14 × 14 | 0.9 × 0.9 | 0.85 × 0.80 (wheel track) | 0.26 | 14×14 |
| Combat Tank | hull 16 × 18, +3 px barrel | 1.0 × 1.1 | hull 1.0 × 0.88, barrel +0.2 | deck 0.19, turret top 0.30 | hull 12×12 |
| Siege Tank | hull 22 × 20 (with outriggers), +2 px barrels | 1.38 × 1.25 | hull 1.18 × 1.05 (+0.12 outriggers each side), barrels +0.15 | deck 0.17, turret top 0.32 | 13×13 |
| Missile Tank / Deviator | 15 × 18 | 0.95 × 1.1 | 1.05 × 0.85 | deck 0.20, rack top 0.36 | 12×12 + rack |
| Sonic Tank | 15 × 18 (tutorial 15×20) | 0.95 × 1.15 | 1.05 × 0.85 | deck 0.20, dish top 0.40 | 12×12 + dish |
| Devastator | 19 × 22 (≈4 px is barrels) | 1.2 × 1.4 | hull 1.12 × 1.08, barrels +0.28 | 0.42 | 13×15 |
| Harvester | 18 × 31 | 1.1 × 1.95 | 1.85 × 1.0 | 0.65 (PC ratio would give 0.8; see §2) | 15×21 |
| MCV | 15 × 24 | 0.95 × 1.5 | 1.45 × 0.85 (wheel track) | 0.36 (crane stowed) | 16×22 |
| Carryall | 28 × 32 | 1.75 × 2.0 | 1.9 × 1.65 (pod span) | 0.34 fuselage | 20×18 |
| Ornithopter | span 24 × length 19 | 1.5 × 1.2 | 1.15 long, span 1.45 | 0.22 | ≈15×16 |
| Death Hand (in flight) | 9 × 14 (+4 px flame) | 0.55 × 0.9 | 0.85 long, fins 0.5 | body Ø 0.18 | — |
| Sandworm (head/mouth) | ≈31 Ø | 1.95 Ø | mouth Ø 1.8 | — | 22×20 |

Current project defaults for comparison: `tankChassis` 0.64 × 0.46, harvester 0.8 × 0.58.

### 1.3 Palette [H]

The Genesis stores colours as 3 bits per channel (levels 0–7). The VGMaps rips encode them as
00/21/4a/6b/94/b5/de/ff, the TSR sheets (Gens emulator) as 00/20/40/60/80/a0/c0/e0/f8. Both are the same
underlying colours; the hex below uses the VGMaps encoding (closer to real hardware brightness).

| Role | Atreides | Harkonnen | Ordos | Emperor / Sardaukar |
|---|---|---|---|---|
| House **light** (lit bevels, glints, ornithopter wings) | `#00ffff` (0,7,7) cyan | `#ffb500` (7,5,0) amber | `#deff00` (6,7,0) lime-yellow | `#9400de` (4,0,6) bright violet |
| House **mid** (main body) | `#004ade` (0,2,6) royal blue | `#b50000` (5,0,0) red | `#00b500` (0,5,0) green | `#4a0094` (2,0,4) violet |
| House **dark** (shadowed faces, crevices) | `#000021` (0,0,1) | `#210000` (1,0,0) | `#002100` (0,1,0) | `#210021` (1,0,1) |

| Neutral role | Colour | Used for |
|---|---|---|
| Outline / deep gaps | `#000000` | 1-px silhouette outline, gaps between hull and tracks, turret-ring shadow, missile-rack gaps |
| Metal dark | `#21214a` (1,1,2) blue-black | tyres, track ends/sprockets, carryall panel lines, gun barrel outlines |
| Metal light | `#9494b5` (4,4,5) lavender grey | hubs, barrel sides, crane, carryall mid-tone, missile bodies |
| White | `#ffffff` | barrel cores, specular glints on domes, carryall highlights, Death Hand |

There is **no separate "sand" or "khaki" colour on any Genesis unit**. The Fremen have no palette of their
own on Genesis (they appear in Atreides blue); there are no Mercenaries on Genesis. PC colours for
comparison (sampled from the PC tank sheet): Atreides `#5179d7 / #283c9a / #18207d`, Harkonnen
`#d40000 / #980000 / #7c0000`, Ordos `#4dd74d / #249a24 / #187d18`, PC metal `#9c9cb8 / #686c98 /
#404058`. PC Fremen, Sardaukar and Mercenary RGB could not be sampled (see §3).

**Colour coverage per sprite** (share of the sprite's pixels, retail Atreides frames):

| Sprite | House light+mid+dark | Black | Metal dark / light | White |
|---|---|---|---|---|
| Combat Tank hull alone | 6 + 60 + 13 = **79 %** | 15 % | 3 / 1 % | 1 % |
| Combat Tank turret (with barrel) | 10 + 27 + 8 = 45 % | 39 % | 10 / 1 % | 6 % |
| Combat Tank complete | 52 % | 34 % | 8 / 2 % | 4 % |
| Siege Tank complete | 45 % | 32 % | 14 / 3 % | 6 % |
| Missile Tank | 55 % | 31 % | 4 / 5 % | 5 % |
| Sonic Tank | 57 % | 23 % | 7 / 6 % | 7 % |
| Devastator | 57 % | 23 % | 8 / 6 % | 6 % |
| Harvester | **88 %** | 9 % | 0 % | 2 % |
| MCV | 37 % | 30 % | 18 / 10 % | 5 % |
| Quad / Trike | 34–36 % | 35–40 % | 14 / 6–9 % | 6–8 % |
| Soldier | 33 % | 59 % (outline dominates at 6 px) | 0 % | 8 % |
| Ornithopter | **84 %** (35 % light tone on the wings, 38 % dark tone used as its outline) | 4 % | 6 / 5 % | 2 % |
| Carryall | 18 % | 1 % | 36 / 23 % | 23 % |
| Death Hand | 0 % | 0 % | 47 / 35 % | 19 % |

Read "black" mostly as *outline + shadow gaps*; in 3D those become dark seams, the underside and the
track/wheel shadows. On the visible top and sides of a 3D tank, aim for ≈70–80 % house colour.

### 1.4 How to reproduce the look in Three.js

- **House materials as a 3-band ramp**, not a single albedo: shade by `dot(worldNormal, L)` with L from
  the NW and high, and map the result to *dark → mid → light* using the exact three house colours of
  §1.3 (a custom `onBeforeCompile` on `MeshStandardMaterial`/`MeshLambertMaterial`, or a small
  `ShaderMaterial`). Band thresholds around 0.25 / 0.75 keep most of a flat deck at *mid* and only
  upper-left bevels at *light*. A plain lit `MeshStandardMaterial` with the mid colour will never produce
  the cyan/amber/lime highlights and will look "wrong" next to the sprites.
- **Bevel every visible edge** (chamfer 0.02–0.04 u) so that the ramp produces the bright upper-left rim
  and the dark lower-right rim the sprites show on every hull.
- **Metal** uses the same trick with the neutral ramp `#21214a → #9494b5 → #ffffff`: barrels and missile
  noses should read *white*, tyres and track ends *blue-black*, never neutral grey.
- **Glints:** most domes (turrets, cockpits, the harvester hood) carry a 2–3 px white/light-house "glint"
  at the upper left. A tiny white specular (high shininess, small lobe) or a painted light patch does it.
- **Outline:** optional thin dark outline (inverted-hull, 0.01–0.015 u, `#000000`) makes units pop against
  sand like the sprites do. Worth trying on vehicles; skip on infantry (too thin).
- **No emissive lights** on ground units: the Genesis sprites have none. The only glows are effects (muzzle
  flash, Death Hand flame, sonic wave, explosions, damage fire).
- **Shadows:** no drop shadows were seen under Genesis units, not even under the aircraft in the tutorial
  line-up [M] (the PC draws shadows for aircraft). A soft contact/blob shadow is fine for 3D; keep it
  subtle.
- **Damaged state:** reuse one smoke/fire emitter at the hull centre with three intensities (matches the
  three "heavily damaged" sprite states).

### 1.5 Tracks versus wheels [H]

- **Tracks** are almost hidden in the top view: the hull overhangs them, so they show only as 1–2 px dark
  strips along the hull sides plus **four protruding corner blocks** (sprocket/idler ends) drawn in
  metal-dark with a single metal-light glint. Along the lit (left) side there is a row of light dots
  (track guard bolts / link highlights). From the side (info art) the tracks are low (≈10–12 % of the
  vehicle length tall) with 6–10 small road wheels, a raised front idler and a partial skirt.
  3D: track units ≈0.16–0.20 u wide, ≈0.12 u tall, hull deck overhanging them by ≈0.05 u; make the four
  corner sprockets/idlers visibly stick out past the hull corners (0.03–0.05 u) — they are the "four
  nubs" that identify a Genesis tank from above. Track colour `#21214a` with `#9494b5` link highlights.
- **Wheels** (Trike, Quad, MCV) are big, chunky and outside the body: dark `#21214a` tyres, a `#9494b5`
  hub/tread highlight, black outline. Quad wheels ≈28 % of vehicle length in diameter, Trike rear wheels
  ≈30 %, MCV wheels ≈16 %. Knobbly tread pattern (PC and Genesis side art) — model 10–12 tread lugs.
  Wheels are never house-coloured.

### 1.6 Genesis versus PC — the general rule

| Aspect | Genesis (follow this) | PC (fallback only) |
|---|---|---|
| Hull paint | full house colour, three-tone with hue-shifted highlight | house colour on the deck only, grey tracks/sides |
| Turrets | house colour domes | grey metal |
| Barrels / missiles | white-grey | grey |
| Carryall / Ornithopter | carryall white with house trim; ornithopter **house-coloured straight-wing plane** | both white with house trim; ornithopter an insect-like flapping craft |
| Devastator / Launcher turret | fixed to hull | rotating turret |
| Info art (side view) | tan/pink redraw of the PC cards | tan/brown painted cards |

Use the info-card art only for **shapes and side profiles**; take **colours** from the in-game sprites.

---

## 2. Units

Each section: references → silhouette and size → components (front to back) → colours → animation →
recognition cues → Genesis vs PC → modelling advice. Hex colours are given for Atreides; swap the three
house tones for other houses.

### 2.1 Soldier (single light infantry)

**Refs:** `genesis-unit-sheet-soldier-infantry.png`, `genesis-unit-plate-infantry.png`,
`genesis-unit-lineup-tutorial-4x.png` (row 1, 3rd), `pc-unit-sheet-infantry.png`,
`pc-unit-light-infantry.jpg`, `genesis-manual-units-p22.jpg`.

**Silhouette [H]:** a 6–8 px figure: round head with a white glint, broad shoulders, body and legs in house
colour, a 1–2 px grey rifle held to one side. Walk frames show a side profile with a leg stride; front and
back frames show both arms out. Death = a small red splat (the sheet shows it red in the Harkonnen
palette; whether it is blood-red for every house is unconfirmed).

**Components:** helmet/head (house light + white glint) → torso armour (house mid) → belt/legs (house dark)
→ boots (black) ; rifle (metal light with a white tip) carried diagonally across the body.

**Info art (Genesis and PC):** helmeted soldiers with red visors/goggles, tan fatigues, backpacks, compact
rifles.

**Advice:** height 0.32–0.36 u (slightly heroic so it reads at 45–60°), shoulder width 0.16, head sphere
Ø 0.09 with a visor band. Paint armour/helmet in house colour (not tan — the in-game sprite is house
coloured), legs one step darker, visor black or dark, rifle 0.2 u long in metal light with a white muzzle
tip. Walk cycle: 3-pose leg swing. Keep a small backpack block for silhouette.

### 2.2 Infantry (squad of three soldiers)

**Refs:** as Soldier; the squad frames in `genesis-unit-plate-infantry.png`.

**Layout [H]:** three soldier figures in a triangle — two side by side in front and one centred behind
(from the north-facing frame: two at the top, one below), figures ≈8 px (0.5 u) apart, the whole group
13×14 px (≈0.85 u). All three animate in step. PC is identical in layout.

**Advice:** instance three soldiers at local offsets ≈(+0.18, ±0.22) and (−0.22, 0); add ±0.02 u jitter and
a small per-figure phase offset in the walk cycle. When the squad is below half health drop to one figure
(gameplay note in `units.md`).

### 2.3 Trooper (single heavy infantry)

**Refs:** `genesis-unit-sheet-trooper-troopers.png`, `genesis-unit-plate-infantry.png`,
`genesis-unit-lineup-tutorial-4x.png` (row 1, 4th), `pc-unit-sheet-troopers.png`, `pc-unit-trooper.jpg`.

**Silhouette [H]:** the Soldier figure plus a **long white/grey launcher tube**. In walk frames the tube lies
across the shoulders and sticks out ≈2 px beyond each side (a horizontal white bar with grey ends); in
the front/back frames it is carried upright beside the body as a vertical white bar with a black
backing. This bar is the only difference from the Soldier on Genesis.

**Info art:** bulky powered-armour suits (rounded shoulder pauldrons, domed helmets), carrying heavy
machine guns/rocket launchers. PC in-game: a grey L-shaped weapon pack.

**Advice:** same body as the Soldier but 10–15 % bulkier (bigger shoulder pads, domed helmet). Add a
launcher tube 0.32 u long, Ø 0.05–0.06, white with metal-light end caps, resting on the right shoulder
and pointing forward-up ≈10°; a small box magazine at its rear. House colour on armour; tube stays
white — it is the recognition cue.

### 2.4 Troopers (squad of three)

**Refs:** as Trooper. Same triangle layout as §2.2 [H]. Instance three troopers.

### 2.5 Saboteur (Ordos palace unit)

**Refs:** `pc-unit-saboteur.jpg`, `genesis-manual-units-p24.jpg` (icon), `units.md`.

**Genesis [L]:** exists (manual lists it for Ordos, cost 0, launched from the Palace) but it was **not seen** in
any retail capture and has no sprite sheet online. Most likely it uses the Soldier sprite in Ordos green.
The manual icon is the PC art: a lean dark-clad figure.

**PC [M]:** a slim figure in a dark, close-fitting suit with a satchel/charge, leaping; in-game it uses the
infantry sprite.

**Advice:** Soldier rig, slimmer (no backpack, no rifle), a satchel charge on the hip, hood/cowl instead of
helmet; body in Ordos dark green with lime highlights. Needs to read "different from a soldier" at zoom:
give it a crouched running pose and the bright satchel.

### 2.6 Fremen (Atreides palace call-in)

**Refs:** `genesis-unit-fremen-squads-1.png`, `genesis-unit-sonic-wave-fremen-sardaukar-1.png`,
`pc-unit-fremen.gif`, manual p24.

**Genesis [M]:** in the Atreides campaign's last missions, squads of three **trooper-shaped figures in
Atreides blue** (launcher bar across the shoulders) appear after the Palace is built; Atreides cannot
build Troopers on Genesis (manual unit table), so these are the Fremen. There is no Fremen palette.

**PC [H]:** desert fighters in brown/tan hooded robes and stillsuits with long rifles, lying prone or
kneeling (info card). PC in-game uses the trooper sprite with the Fremen palette slot.

**Advice:** Trooper rig with a hood and a knee-length cloak over the armour, long rifle instead of the
launcher tube. Colour: follow Genesis (Atreides blue ramp) for the armour; the cloak can be a dark
desert brown (`#4a2100`/`#944a00`, both Genesis terrain colours) so it still reads as Fremen — mark as a
design choice. Always three figures.

### 2.7 Sardaukar (Emperor's troops)

**Refs:** `genesis-unit-sardaukar-purple-1.png`, `-2.png`, `genesis-unit-sonic-wave-fremen-sardaukar-1.png`,
`pc-unit-sardaukar.gif`, `units.md`.

**Genesis [H]:** the Emperor is a fourth house with the **purple palette** (§1.3) applied to the normal units:
purple Combat Tanks, Siege Tanks, Harvesters, Carryalls and infantry/trooper figures were all seen in the
late-mission frames. No Sardaukar-specific sprite shapes.

**PC [M]:** heavy troopers in bulky rounded armour, boxy helmets with green view-ports (per `units.md`), a big
multi-barrel gun with red lights (card). PC house colour purple (not sampled).

**Advice:** Trooper rig in the purple ramp. Optionally give them the PC's boxier helmet and a chunkier
rotary gun so the elite troops read differently; keep squads of three.

### 2.8 Trike

**Refs:** `genesis-unit-sheet-trike-raider-trike.png`, `genesis-unit-plate-harvester-carryall-quad-trike.png`
(bottom right), `genesis-unit-lineup-tutorial-4x.png` (row 1, 5th), `genesis-unit-sideart-infocards.png`,
`pc-unit-trike.jpg`, `pc-unit-sheet-trike.png`.

**Silhouette [H]:** a **Y/T shape** from above: one narrow front wheel at the nose, a long thin body, and a
wide rear axle with two big wheels (13 px across the rear, 15 px long). Wheel layout confirmed: **1 front,
2 rear**.

**Components (front → back):**
- Front wheel + fork: small (≈3 px), drawn as a white/metal tip; in the side art the front wheel is smaller
  than the rear and sits on a long raked fork like a motorbike (≈0.23 L diameter).
- Nose/body spine: 3–4 px wide (≈0.22 u) in house colour with a light-tone stripe on the left.
- Cockpit/gun mount at mid-body: a 3–4 px white/light block (reads as the rider's canopy or the gun
  mount); in the side art a short gun barrel points forward over the front wheel.
- Rear axle and two big rear wheels: ≈4×4 px each (≈0.3 L Ø), metal-dark tyres with metal-light hubs,
  set well outboard; body narrows between them.

**Colours:** body house mid with light/white highlights and dark underside; tyres `#21214a` / `#9494b5`.

**Animation:** none on Genesis besides facing. Add wheel spin and a slight lean in turns.

**Recognition:** the lone front wheel + wide rear pair, and the small white canopy spot.

**Genesis vs PC:** same configuration. PC card shows a boxy rear body with a cab block and a gun on top;
Genesis side art is a redraw of it.

**Advice:** L 0.85, rear track 0.75, rear wheels Ø 0.26 × 0.12 wide, front wheel Ø 0.2 × 0.07 on a fork raked
≈25°. Body: a tapered box 0.22 wide at the nose widening to 0.35 over the rear axle, deck 0.18 high, a
small canopy/roll-cage over the seat, a twin-barrel light gun 0.18 long on the nose. House colour on the
body panels only.

### 2.9 Raider Trike (Ordos)

**Refs:** same Trike sheet (titled "Trike/Raider Trike"), Genesis side art (green camouflage version),
`pc-unit-raider-trike.jpg`.

**[H]** identical sprite to the Trike, Ordos green palette. The Genesis *info art* paints it in green/yellow
camouflage and the PC card shows grey-green snow camouflage, but in game it is just the green Trike.
**Advice:** reuse the Trike mesh; optional camo decal only if a distinction is wanted (not in the sprite).

### 2.10 Quad

**Refs:** `genesis-unit-sheet-quad.png`, plate (quad N/NNE/NE/E), tutorial line-up (row 1, 6th), side art,
`pc-unit-quad.jpg`, `pc-unit-sheet-quad.png`.

**Silhouette [H]:** a square-ish buggy (14×14 px) with **four big wheels at the corners** sticking out past the
body; wheels ≈4×4 px each.

**Components:**
- Front: a white arc/bar across the front third (roll bar / windscreen frame / twin gun barrels — reads as a
  white "U" over the cabin) with light-tone pixels either side.
- Body: house mid, a central raised cabin with a dark roof (PC and side art show a dark, rounded cab roof).
- Rear: flat engine deck, light-tone highlight on the left.
- Wheels: four large knobbly tyres, metal-dark with metal-light hubs, wheelbase ≈ body length.

**Side profile (side art/PC):** long low body with a sloped nose, huge wheels (Ø ≈0.28 L), a squat dark
roof, a long gun barrel along the right side pointing forward, a boxy rear.

**Advice:** L 0.85, W over wheels 0.8, wheels Ø 0.24, 0.13 wide; body 0.7 × 0.42, deck 0.14, cab roof 0.24;
twin light guns 0.2 long at the front corners of the cab. Paint body house colour, roof dark house tone,
guns and front bar white-grey.

### 2.11 Combat Tank (all houses)

**Refs:** `genesis-unit-sheet-combat-tank.png` (every hull × turret direction, 4 palettes, idle/fire, damage
states), `genesis-unit-plate-tanks.png` (top block), tutorial line-up (row 2, 1st), `pc-unit-combat-tank.jpg`,
`pc-unit-sheet-tanks.png`, side art.

**Silhouette [H]:** a near-square hull (16×18 px) with **four protruding corner nubs**, a **big round dome
turret** (≈12 px Ø — three-quarters of the hull width) roughly centred, and **one white barrel** that
overhangs the hull front by ≈3 px.

**Components (front → back):**
- **Barrel:** single, 2 px wide (Ø ≈0.08 u), ≈7 px from turret centre (0.45 u); white core, metal-light
  sides, metal-dark outline. PC/side art: a thick muzzle brake with fins at the tip.
- **Turret:** a smooth dome, slightly flattened at the front where a short mantlet (house light) holds the
  barrel; big white/cyan glint at its upper left; a black ring below it (turret-ring shadow).
  PC/side art turret is a long flat box with a raised front collar and 4 vertical vent slits — Genesis
  reads as a dome from above; model a low rounded turret (dome-topped cylinder with a flat mantlet).
- **Hull deck:** plain house-mid slab; bright left/front bevel (cyan row), dark right/rear bevel; a column
  of light dots on the left side (bolts/track guard).
- **Tracks:** hidden except thin side strips and the four corner blocks (§1.5).
- **Side (art):** long low hull with ≈8 road wheels, a sloped glacis, a short sloped rear, and a painted
  diagonal stripe marking on the hull side (blue/white on the PC card).

**Proportions (3D):** hull 1.0 L × 0.88 W, deck 0.19; turret Ø 0.62, height 0.1 above deck, centre 0.05
behind hull centre; barrel axis 0.25 high, barrel tip 0.2 past the hull front; track units 0.18 W × 0.12 H.

**Per-house differences [H]:** none on Genesis (the sheet's four house blocks are the same drawings in four
palettes). The PC also uses one shape. One mesh, house material swap.

**Animation:** turret yaw (independent), recoil 0.06 u on firing, small muzzle flash; track scroll (3D only).

**Recognition:** dome + single white barrel + four corner nubs. At zoom the dome glint and the barrel are
the cues — keep the barrel bright.

### 2.12 Siege Tank

**Refs:** `genesis-unit-sheet-siege-tank.png`, `genesis-unit-plate-tanks.png` (2nd block), tutorial line-up
(row 2, 2nd), `pc-unit-siege-tank.jpg`, `pc-unit-sheet-siege-tank.png`, side art.

**Silhouette [H]:** bigger and squarer than the Combat Tank (hull 22×20 px) with **track outriggers at all
four corners that stick out sideways** (grey tips), a **notched rear block**, an oval turret and **two
parallel white barrels**.

**Components (front → back):**
- **Twin barrels:** two 2-px white barrels ≈5 px apart (0.3 u centre to centre), ≈8 px long, joined at the
  turret by a dark bridge; slightly elevated (the side art shows the gun raised ≈8–10°).
- **Turret:** wide oval dome (14 px wide) with a cyan/white "eye" ring in the middle (sight/hatch) and a
  dark rim.
- **Hull:** broad deck in house mid; long light bevel on the left; the rear third drops to a separate
  engine block with three dark vertical slots (the "|_|_|" notch pattern), a light ledge above it.
- **Tracks/outriggers:** four corner track pods that protrude ≈2 px (0.12 u) beyond the hull sides, each
  with a grey tip; long dark track strips between them.
- **Side (art/PC):** a very long vehicle with 6 large road wheels, a long sloping superstructure that rises
  towards the front, and a long gun reaching well past the front.

**Proportions (3D):** hull 1.18 L × 1.05 W (+0.12 outriggers each side), deck 0.17; turret 0.8 W × 0.65 L,
top 0.32; barrels Ø 0.08, 0.5 long from the turret face, 0.3 apart, pitched +8°.

**Animation:** turret yaw, recoil 0.06 u (both barrels), paired muzzle flashes.

**Recognition:** twin barrels + corner outriggers + notched rear.

### 2.13 Missile Tank / Launcher

**Refs:** `genesis-unit-sheet-missile-tank-deviator.png` (8 directions × 4 palettes, damage states,
rockets in 16 directions, gas-cloud frames), `genesis-unit-plate-tanks.png` (4th block), tutorial line-up
(row 1, 7th), user images 2/3/5, `pc-unit-launcher.jpg`, side art.

**Silhouette [H]:** a compact 15×18 px hull almost filled by the **launcher rack**: two long missile banks
running front-to-back with **white arrow-shaped warheads** in the middle, and a **glossy rounded cab**
(cyan/white bubble) at the front. Rack is fixed to the hull on Genesis.

**Components (front → back):**
- **Cab:** a rounded canopy hump at the front-left/centre (cyan and white glint) — the driver's cab. In the
  side art the cab is a separate sloped block at the front of the hull.
- **Rack:** two parallel missile bays, each with 2–3 visible missiles; warhead tips white pointing forward;
  rack frame house mid with light edges and black gaps between tubes.
- **Hull and tracks:** like the Combat Tank (corner nubs, dark side strips) but narrower.
- **Side (art/PC):** the rack sits on the rear half, raised on a pivot and **pitched up ≈20° pointing
  forward**, overhanging the cab; 2 rows × ≈5 missile tubes; the hull is long and low with ≈7 road wheels.

**Proportions (3D):** hull 1.05 L × 0.85 W, deck 0.2; cab 0.3 L × 0.45 W, top 0.28, at the front; rack box
0.55 L × 0.6 W × 0.16 H on a pivot 0.25 behind centre, pitched +18°, top ≈0.36; missiles Ø 0.07 with white
conical noses.

**Rockets (projectile) [H]:** slim orange rockets with white noses and small fins, drawn in 16 directions;
two per salvo.

**Animation:** rack elevation (3D), hide the fired missiles and restore them on reload (user image 4 shows a
rack with one column missing — possibly a reload state [L]).

**Recognition:** the white arrowheads on a blocky rack + the round cab bubble.

**Genesis vs PC:** PC has a rotating launcher turret; Genesis rack is fixed. For gameplay a rotating rack is
fine; keep it looking like part of the hull.

### 2.14 Deviator (Ordos)

**Refs:** same sheet (titled "Missile Tank/Deviator"), side art (grey-white camo with green patches),
`pc-unit-deviator.jpg`.

**[H]** identical sprite to the Missile Tank, Ordos green palette. Its missiles burst into a **house-coloured
gas cloud** (5 frames: small splat → spreading blob → large billowing cloud → dithered fade; green for
Ordos). **Advice:** reuse the Missile Tank mesh; optionally tint the missile warheads lime. Build the gas as
a cluster of translucent green spheres that expand and dither out.

### 2.15 Sonic Tank (Atreides)

**Refs:** tutorial line-up (row 2, 5th), `genesis-unit-plate-tanks.png` (5th block, from VGMaps),
`genesis-unit-sonic-wave-fremen-sardaukar-1.png`, `pc-unit-sonic-tank.jpg`, user image 4 row 2 last.

**Silhouette [M]:** Missile-Tank-sized hull (15×18 px) carrying a **wide forward-facing dish/horn**: from
above, a white-grey curved bar (the dish rim) spanning ≈65 % of the hull width across the front third,
a grey neck behind it, and a **round drum** with a cyan rim in the rear centre (the resonator housing).
From the side (W frame) the emitter shows as a grey tube along the front half with a white vertical bar
at the nose (the dish face).

**Components:** dish (metal, white rim, mouth facing forward) → neck/boom → round resonator drum (house
colour with cyan rim) → hull with dark side strips and corner nubs.

**PC card:** a big golden trumpet/horn on a tall mount at mid-hull, mouth forward and slightly up; green
camo hull.

**Sonic wave [H]:** a straight line of large translucent **dithered bubbles** (≈1 tile each, cyan and white
checker with a dotted house-blue rim), overlapping and extending from the dish towards the target.

**Advice:** emitter as a lathe-built horn (mouth Ø 0.45, length 0.45) on a short pivot, pitched +10°, with a
white rim torus; resonator drum Ø 0.3 behind it. Wave: additive translucent spheres/rings (cyan→white)
spawned along the ray, with a noise/dither mask.

### 2.16 Devastator (Harkonnen)

**Refs:** `genesis-unit-sheet-devastator.png` (8 directions × 4 palettes, damage, big explosion),
`genesis-unit-plate-tanks.png` (3rd block), tutorial line-up (row 2, last), `pc-unit-devastator.gif`,
`pc-unit-sheet-devastator.png`, side art.

**Silhouette [H]:** the biggest, most armoured tank: a tall rectangular hull (19×22 px including ≈4 px of
barrel) with **heavy side sponsons**, **big dark corner track blocks**, and **two long parallel white
barrels** fixed forward. More metal and dark than the other tanks.

**Components (front → back):**
- **Twin heavy guns:** two 2-px white/grey barrels with ≈3 px gap, starting at mid-hull and projecting
  ≈4–5 px past the front; a dark gun housing between them.
- **Central superstructure:** a raised block with a square hatch/panel (cyan rim) and panel lines.
- **Side sponsons:** large house-colour blocks along both sides at mid-length, light top edges.
- **Rear deck:** grille/vent pattern ("E"-shaped slots) and exhaust stubs.
- **Tracks:** wide, dark, with big corner blocks (larger than on the Combat Tank).
- **Side (PC/side art):** a multi-deck box, tall (height ≈0.38 of length), guns on the top deck at the rear
  pointing forward, a long track with ≈10 road wheels, a chevron marking and a house emblem on the side.

**Proportions (3D):** hull 1.12 L × 1.08 W, track units 0.24 W × 0.16 H, deck 0.26, superstructure top 0.42;
barrels Ø 0.1, 0.3 apart, tips 0.28 past the hull front.

**Animation:** guns fixed on Genesis (PC has a turret); recoil; self-destruct = the largest explosion in the
game (white-yellow flash → orange rings → dithered cloud).

**Recognition:** twin long barrels on a big square body, darker overall. Always Harkonnen red on Genesis
(a purple Emperor version also exists in the sheet).

### 2.17 Harvester

**Refs:** `genesis-unit-sheet-harvester.png` (N/NE/E × 3 houses + 3 dust frames),
`genesis-unit-plate-harvester-carryall-quad-trike.png` (top), `genesis-unit-harvester-ingame-1.png`,
tutorial line-up (row 1, 1st), user images 1 and 2, `pc-unit-harvester.gif`, `pc-unit-sheet-harvester.png`.

**Silhouette [H]:** a **long rounded capsule, twice as long as wide** (18×31 px; ≈1.1 × 1.95 tiles) —
by far the biggest ground unit — painted **entirely in the house colour** (88 %). Rounded front hood,
squared rear.

**Components (front → back):**
- **Front hood/intake:** a semicircular, domed front end with a white/cyan rim glint; in the E-facing frame a
  smaller rounded snout (the intake/cutter head) sticks out ahead of the hood by ≈3 px.
- **Deck:** a recessed, black-outlined **key/"7" shape** (a long duct running aft with a hook at its front
  end, plus a small square hatch) on the front half — the spice hopper hatch and chute; two short
  horizontal **vent slots** ("=") on the rear half.
- **Long edges:** strongly rounded — a bright cyan band down the whole left side, a dark navy band down the
  right side.
- **Rear:** a dark band (rear face + track ends).
- **Tracks:** only visible as the dark band along the near side in side-facing frames.
- **Dust:** while harvesting, a sand-coloured dust puff (3 frames, own sprite) billows at one end — behind
  the vehicle in the two E-facing captures [M]; a purple harvester seen diagonally has it at the rounded
  end, so the attachment point is not certain [L]. Emitting dust at both the intake and the rear is safe.
- **PC card (side):** a tall armoured box on tracks with an **angled plough/prow plate at the front
  bottom**, small cyan lights on the front face, heavy side panels with bolted edges; very tall
  (height ≈0.42 of length).

**Proportions (3D):** body 1.85 L × 1.0 W; height 0.65 (PC ratio would give 0.8 — too tall for the camera;
0.6–0.7 reads well); long edges filleted with radius ≈0.15; front hood a half-cylinder/dome; tracks 0.2 W
mostly hidden under side skirts; intake: a dark horizontal slot 0.7 W × 0.1 H under the hood with a
rotating toothed drum just visible inside.

**Animation:** intake drum spin (3D), dust particles while harvesting, gentle track scroll; no
turret.

**Recognition:** size, the uniform house colour, the rounded nose and the key-shaped deck glyph.

**Genesis vs PC:** follow Genesis (house-coloured capsule). The current sand-coloured wedge with an exposed
drum is PC-flavoured and should change.

### 2.18 MCV (Mobile Construction Vehicle)

**Refs:** tutorial line-up (row 1, 2nd), `genesis-unit-plate-mcv-ornithopter-deathhand-sonic.png` (first),
`pc-unit-mcv.jpg`, `pc-unit-sheet-mcv.png`, user image 2 (production icon). No Genesis sheet online.

**Silhouette [M]:** a long narrow truck (15×24 px) with **eight big wheels (4 axles) outside the body**, a
cab at the front and a **grey crane boom lying along the rear half**.

**Components (front → back):**
- **Cab:** front block in house colour with a white/light windscreen glint.
- **Chassis/bed:** narrow (≈7–8 px ≈0.45 u) house-colour spine between the wheels.
- **Crane:** a white/grey boom folded along the centreline of the rear half, ending at the rear in a hook or
  cradle; grey base plate.
- **Wheels:** four pairs at ≈10 %, 33 %, 58 %, 83 % of the length, dark tyres with grey hubs.
- **PC card (side):** a heavy 5-axle truck, low flat bed with equipment boxes, cab at the front, a lattice
  crane arm (raised in the card); top-down PC sprite shows the crane lying back along the body.

**Proportions (3D):** L 1.45, W over wheels 0.85, chassis 0.5 W, deck 0.2, cab 0.32 L × 0.5 W, top 0.36;
wheels Ø 0.22 × 0.12; crane boom 0.75 long, 0.07 thick, stowed along the deck with a hook block at the rear.

**Animation:** wheel spin; for deployment, raising the crane and lowering stabiliser legs would be a nice
3D touch (not in the sprites). **Recognition:** eight wheels + the grey boom.

### 2.19 Carryall (empty and carrying)

**Refs:** `genesis-unit-sheet-carryall.png` (N/NE/E empty and carrying, 3 houses),
`genesis-unit-plate-harvester-carryall-quad-trike.png` (middle), `genesis-unit-carryall-carrying-1.png`,
tutorial line-up (row 2, 3rd), `pc-unit-carryall.gif`, `pc-unit-sheet-carryall.png`.

**Silhouette [H]:** a large **white airframe** (28×32 px ≈1.75 × 2 tiles) like a cross or anchor from above:
a long central spine, a rounded nose hood at the front, **two engine pods** out at the sides at mid-length
and a **wide flat tail bar** at the rear. House colour only as trim.

**Components (front → back):**
- **Nose:** a semicircular hood/cockpit (≈10 px wide) — white rim with a dark interior (glazing) and a few
  house-colour pixels.
- **Spine:** a narrow fuselage (≈4 px, 0.25 u) running the full length with a **house-colour stripe** down
  its centre.
- **Wing roots/struts:** forward-swept white struts from the spine to the pods, with house-colour edging.
- **Engine pods:** two short fat cylinders (≈7 px wide × 10 px long ≈0.45 × 0.6 u), white with a
  house-colour band round the middle and dark end caps.
- **Tail:** a wide flat bar across the rear (≈22 px, 1.4 u) with small house-colour tips and short fins —
  the rear frame/stabiliser (the PC card shows it as a tall square frame of plates).
- **Underside (PC card):** three or four hanging **grab claws** and thin landing legs.
- **Carrying:** the carried unit is drawn underneath, centred, visible between the struts (house colour
  showing through the frame). No claw animation.

**Colours:** white `#ffffff`, lavender grey `#9494b5`, blue-black panel lines `#21214a`; house trim.

**Proportions (3D):** L 1.9, pod span 1.65, fuselage 0.28 W × 0.3 H; pods Ø 0.35 × 0.55 L; tail bar 1.35 W ×
0.2 L; cruise height ≈1.0–1.5 u above ground; claws 0.2 long under the fuselage centre.

**Animation:** hover bob, engine glow optional, claws closing on pickup (3D addition), cargo attached under
the belly.

**Recognition:** big white cross shape with two pods — the only large white unit.

### 2.20 Ornithopter (Atreides, Ordos)

**Refs:** tutorial line-up (row 2, 4th) and `genesis-unit-plate-mcv-ornithopter-deathhand-sonic.png`
(second) — Harkonnen palette; `pc-unit-ornithopter.gif`, `pc-unit-sheet-ornithopter.png`.

**Silhouette [M-H]:** on Genesis a **straight-wing aeroplane**: a 24-px straight wing (1.5 u span, ≈3 px chord)
set about a third of the way back from the nose, a small metal ball cockpit at the nose, a thin fuselage
and a small T-tail. The wing is painted in the **house light tone** (amber for Harkonnen → cyan for
Atreides, lime for Ordos) with a mid-tone leading/trailing edge and a *dark-house* outline instead of
black. No wing-flap frames were seen.

**Components (front → back):** cockpit sphere (metal grey/white, two small prongs ahead of it) → straight
wing (house light) with slightly squared tips → fuselage (3 px, house mid) → tailplane (≈7 px) with a
house-light fin tip.

**PC:** white insect-like craft with house trims; the card shows a long white body, a huge vertical
(flapping) wing and a long tail; the PC sprite has three wing positions per facing (flapping).

**Non-retail warning:** the hawk/bird-shaped aircraft in user screenshot 4 are *not* this unit (§0.1-4).

**Proportions (3D):** fuselage L 1.15, Ø 0.14; wing span 1.45, chord 0.2, 0.02 thick, root 0.35 from the nose;
cockpit sphere Ø 0.2; tailplane span 0.45; flight height ≈1.0 u.

**Animation:** Genesis static; add a small, fast wing flap (±8°) to justify the name, plus bank on turns.

### 2.21 Frigate (Starport delivery ship)

**Refs:** `pc-unit-frigate.gif` only. TSR lists a Genesis "Starport Ship" sheet (asset 550136) but it was never
archived; the ship was not seen in the sampled longplay frames.

**PC [M]:** a very large white/grey transport: wedge-shaped nose, heavy ribbed hull with round ports, thick
landing legs with hydraulic struts, cargo ramp; neutral colours (CHOAM, no house colour).

**Advice [L]:** 3.0 L × 2.2 W × 0.9 H, white-grey panels with blue-black seams (same neutral ramp as the
Carryall so it belongs to the family), four landing legs that deploy over the Starport pad, a descending
landing animation with engine glow. Check the Genesis sheet if it ever becomes reachable.

### 2.22 Sandworm

**Refs:** `genesis-unit-sheet-sandworm.png` (6 frames, ≈31 px), `pc-unit-sheet-sandworm.png`,
`pc-unit-sandworm.jpg`.

**Genesis [H]:** the worm is shown only as a **round mouth breaking the sand** (≈2 tiles across), never as a
long body. The 6-frame sequence:
1. a dithered sand-coloured mound (the worm under the surface),
2. the head rising — a khaki/brown fleshy ring with a grey three-lobed rim,
3. the **closed maw**: three glossy blue-black lobes meeting in a "Y", each with white/lavender
   highlights (reads like a closed three-part beak seen from above),
4. the maw opening (black centre, lobes pulled back),
5. sinking — a smaller dark maw inside a churned sand ring,
6. a sand swirl that fades.
Colours: maw `#202040`/`#000000` with `#8080a0`/`#f8f8f8` highlights; flesh/rim `#a08040`, `#806020`,
`#604000`; sand ring `#c0a060`.

**PC [H]:** the same idea (5 mouth frames, brown/khaki). The info card shows a huge segmented brown worm
with a round gaping mouth rising from the sand.

**Advice:** model the head as a thick cylinder (Ø 1.8) with a slightly domed top split into **three lobed jaw
plates** that open outward (animated), dark glossy material with bright specular, surrounded by a torus of
ridged brown flesh; spawn a crater/sand-ring decal and sand particles. Show at most one or two body ring
segments behind the head when it lunges. Underground travel: a moving sand ripple/mound (frame 1).

### 2.23 Death Hand missile (Harkonnen palace)

**Refs:** tutorial line-up (row 2, 6th), `genesis-unit-plate-mcv-ornithopter-deathhand-sonic.png` (third),
`genesis-unit-sardaukar-purple-2.png` (a small rocket in flight for comparison), `pc-unit-death-hand.jpg`,
`genesis-unit-sheet-devastator.png` (header: large explosion frames).

**Genesis [H]:** a slim **white/grey missile** (9×14 px): pointed nose cone, cylindrical body ≈3 px wide, two
or three swept fins at the base, blue-black outline, and an **orange-yellow exhaust flame** (≈4 px). No house
colour. Noticeably bigger than an ordinary rocket (≈5 px wide).

**PC card:** a large silver ICBM on an inclined launch rail beside a radar dish.

**Advice:** body L 0.85, Ø 0.16, ogive nose, 3 fins (span 0.5), white with a metal-light band and dark seams;
additive flame cone + smoke trail. Arc high (ballistic), then a large explosion (white core → orange
fireball → expanding dark ring, 1.5–2 u radius).

---

## 3. Open questions / low-confidence points

1. **Genesis Ornithopter** — only one retail image (tutorial, N-facing, Harkonnen colours). Other facings,
   any wing animation and the true Atreides/Ordos look are unconfirmed. The TSR Genesis ornithopter sheet
   (asset 550028) exists but was not archived.
2. **Genesis MCV** — only the tutorial N sprite; wheel count (4 axles) and the crane layout are read from a
   15×24 px sprite. TSR asset 550068 not archived.
3. **Genesis Frigate / Starport ship** — not found at all (TSR asset 550136 not archived); PC used.
4. **Genesis Saboteur** — exists per manual, never seen in captures; appearance assumed (Soldier sprite,
   Ordos green).
5. **Fremen on Genesis** — identified as blue trooper squads by elimination (Atreides cannot build troopers);
   not confirmed by a label. No Fremen palette exists on Genesis.
6. **PC house colours for Fremen, Sardaukar, Mercenary** — palette slots known (192/208/224) but no RGB was
   sampled (no PC palette file available here). Sardaukar = purple is widely reported; Fremen/Mercenary
   colours unknown.
7. **Sonic Tank emitter** — Genesis dish/horn shape read from 15×18 px frames (no sheet); whether it rotates
   independently of the hull is unknown.
8. **Missile Tank reload** — whether the rack visibly empties after firing (user image 4 suggests so, but that
   image is from a hack).
9. **Blood colour** of the infantry death splat for non-Harkonnen houses.
10. **User screenshot 4 provenance** — clearly non-retail; the exact hack/version was not identified.
11. **Heights** — all heights come from side-view paintings (not to scale with the map sprites). Treat them
    as ratios and tune for the 45–60° camera.
12. **Emulator colour variance** — the same Genesis colour is rendered ±10 % differently by different
    emulators (VGMaps vs Gens). The hex values above use the VGMaps encoding.
