# Main menu backdrop: Arrakis from space, then a battle — design

Status: approved 2026-09-30. Replaces the dune flyover behind the main menu (spec §5.8).

## Goal

The main menu's 3D backdrop becomes a loop, in the spirit of the Command & Conquer: Generals
shell map:

1. **Planet** — Arrakis turning in space, as in the Dune II intro, with the caption
   *"The planet Arrakis, known as Dune."*
2. **Dive** — the camera pushes into the planet; a sand-coloured haze fills the screen.
3. **Battle** — the haze clears onto a live battle between two random houses, seen from a camera
   that descends from high above and then circles the fighting.
4. **Rise** — the camera lifts away, the picture fades to black, and the loop returns to the planet
   with a new battle waiting.

Everything is made in code, like the rest of the remake; no original intro frames are used.

## Timeline (one loop ≈ 60 s)

| Phase | Length | Picture |
|---|---|---|
| Planet | 10 s | Planet on the right of the frame (the menu sits on the left), partly cropped, lit from the upper left with the terminator on the right. It turns slowly. The caption fades in after 1.5 s and fades out before the dive. |
| Dive | 3 s | The camera pushes towards the planet until it fills the frame; the haze fades in over the last 0.8 s. |
| Battle | 45 s | The haze fades out onto the battle. The camera starts high and descends, then orbits the hotspot slowly and cuts to a new angle about every 12 s (a short dip to haze at each cut). |
| Rise | 2 s | The camera climbs and the picture fades to black. This is shorter than the dive (exits are faster than entrances). |

The next battle's world, terrain and views are built during the planet phase, and the world is
simulated a few seconds ahead, so the battle is already under way when it appears and the swap
has no hitch.

**Reduced motion** (`prefers-reduced-motion: reduce`): the dive and rise become plain crossfades
without camera travel, the battle camera holds one wide angle (no orbit, no cuts), there is no
camera shake, and the planet turns more slowly.

**Interruptible**: starting a skirmish during any phase stops the backdrop at once and sets the
fade layer to its end state directly. Nothing waits on `transitionend`. Returning to the menu
restarts the loop at the planet.

## Components

### `BattleStage` — `src/game/battle-stage.js` (new, extracted from `GameView`)

Everything between a `World` and the picture that is not input or HUD:

- the `Heightfield`, `TerrainView` (with decals), `UnitViews`, `StructureViews`, `Effects` and
  `MissileViews`;
- event handling for effects and sound cues (`onEvent`, `onFired`), `combatEffects`, `ambient`,
  `constructionDust` and the fog-aware `seen(x, z)`;
- `sync(world, alpha, dt, now)` for the per-frame view update, and `dispose()`.

All of its scene objects hang under one root `THREE.Group`, so `dispose()` can remove them and free
their geometries, materials and textures in one pass.

`GameView` keeps input, HUD, sidebar, radar, menus, the fixed-step loop and the camera rig. It hands
the views, effects and event handling to a `BattleStage`. The game must behave exactly as before;
the existing unit tests and both e2e suites are the check.

### `ShowcaseDirector` — `src/game/showcase-director.js` (new, simulation only)

Builds and runs the battle for one loop. It has no rendering or DOM code, so it runs under Node.

- **Map**: 64 × 40, a fresh seed every loop. Open rock in the middle where the armies meet, dunes
  and sand around it (for dust and tracks), and a little spice.
- **Houses**: two different houses picked at random from Atreides, Harkonnen and Ordos. The world
  runs with `rules.victory` off (the default), so there is never a game over. The computer
  base-building AI is not used; the director gives every order.
- **Armies**: 10–14 units per side, drawn from the units the house can build (`UNITS[*].houses`):
  tanks, quads or trikes, infantry or troopers, missile or siege tanks. Behind each side, as
  scenery: a Construction Yard, a Windtrap, a turret and a few wall segments, plus a Palace when
  that side fires the loop's Death Hand.
- **Reinforcements**: every ~8 s, a side with fewer than 10 units gets 3–4 new ones at its back
  edge. They are given an attack-move towards the enemy's back line.
- **One special per loop**, chosen at random from those the two houses can field: a Sonic Tank pair,
  a Deviator, a Devastator that destructs, a Death Hand strike, or an Ornithopter attack.
- **Hotspot**: a smoothed point where most of the recent firing happened (from `fired` events over
  the last ~3 s), for the camera to follow. It falls back to the middle of the map when nobody is
  firing.

### `ShowcaseCamera` — `src/game/showcase-camera.js` (new, pure math)

Given the time within the battle phase, the hotspot and the reduced-motion flag, returns the camera
target, distance, pitch and yaw: the descent, the slow orbit, and where the cuts fall. It has no
Three.js state, so it runs under Node.

### `PlanetShot` — `src/render/planet.js` (new)

Its own `THREE.Scene` and camera:

- the planet: a sphere with an equirectangular canvas texture made in code — sand oranges and
  browns, darker rock patches and dune streaks from layered value noise;
- a Fresnel atmosphere shell, blue and additive, brighter on the lit side;
- about 1,500 stars (points of varied size and brightness) and a faint blue nebula;
- `update(dt, dive)`, where `dive` (0..1) drives the push-in, and `dispose()`.

### `MenuBackdrop` — `src/scenes/menu.js`

Replaces `flyover()`. It runs the phase state machine, owns the single `Renderer3D` and renders
either the planet scene or the battle scene each frame, so bloom lights the atmosphere too. It
drives the fade layer and the caption, builds the next battle during the planet phase, disposes
the last one, and keeps `start()` / `stop()` for the skirmish launch and quit. `Renderer3D` gains a
way to render a given scene and camera through its composer.

### Styles — `src/ui/menu.css`

The caption, the fade layer, and a darker left-hand scrim during the battle phase.

## Look

- **Planet**: as in the reference image — orange-brown, heavily lit on the left, a thin blue rim of
  atmosphere, deep black space with stars and a blue haze in one corner.
- **Caption**: red like the original, bright enough for at least 4.5:1 contrast on the black
  background. Georgia serif, which the menu subtitle already uses; the project loads no web
  fonts. Bottom right, below the planet. `aria-hidden="true"`: it is decoration, repeated on every
  loop.
- **Menu legibility**: the battle is brighter and busier than the dunes, so the scrim behind the
  menu (left side) deepens during the battle phase. Menu text keeps at least 4.5:1 contrast.

## Sound

The backdrop has its own `SoundEngine` at 30 % of the Options volume, and none when sound is off in
Options. Space is silent; battle sound fades in during the dive. Cues come from `cueFor` with a
viewer that is neither side, so there are no announcements or interface beeps. As everywhere,
browsers only allow sound after the first click or key press.

## Performance

- The loop stops when the tab is hidden and whenever a skirmish frame is open.
- Each finished battle is disposed: its geometries, materials and textures are freed.
- The Options quality preset applies (shadows, particles, pixel ratio capped as today).
- Star count stays within 1,000–3,000 particles.

## Failure

The backdrop is built inside a `try`, as today. If the battle cannot be built, the loop shows the
planet only; if the planet cannot be built either, the old dune flyover runs. The menu itself
never depends on the backdrop.

## Testing

- **Node unit tests**:
  - `ShowcaseDirector`: the houses differ, both sides keep units across a long run,
    reinforcements arrive on schedule, the chosen special fires, and nothing throws over thousands
    of ticks.
  - `ShowcaseCamera`: phase boundaries, the cut schedule, and the reduced-motion path.
  - The backdrop phase timeline.
- **Regression**: `npm test`, `npm run e2e` and `npm run e2e:menu` pass unchanged after the
  `BattleStage` extraction.
- **Menu e2e**: the backdrop reaches the battle phase and comes back to the planet; launching a
  skirmish stops it.
- **Smoke**: screenshots `menu-planet` and `menu-battle`. A `backdrop=planet|battle` URL flag holds
  one phase, for screenshots.
