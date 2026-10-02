# Phase 2 — options stream: quality presets, frame-time monitor, menus, modern controls

Branch `phase2/options` (from `5719049`, improve/visibility's tip). Spec §5.7, §5.8, §6 (original files entry), §8.

## Plan (each step with its proof)

1. Presets exactly as spec §8 — `tests/quality-presets.test.mjs` checks the table; real-GPU screenshots of each preset.
2. Renderer applies a preset and can switch live — screenshots; live High → Medium → Low in a battle, canvas
   buffer 1328 → 996 px, no console errors.
3. Frame-time monitor — `tests/perf-monitor.test.mjs` (decision logic, pauses, dismissals, start-up rules);
   real-GPU screenshot of the prompt; Switch clicked twice live.
4. Settings and menus — `tests/options-settings.test.mjs`, `tests/menu-entries.test.mjs` (fake DOM);
   the new `scripts/e2e-menu.mjs` lines run on their own (SwiftShader, as the real run does): 11/11 ok.
5. Controls audit against the §5.7 table — `tests/controls-scheme.test.mjs` (Alt force move with a real crush,
   Space to the last alert, radar rally, the controls screen naming every row).
6. Frame times per preset on the real GPU — table below.

## Quality presets (spec §8)

| Preset | Shadows | Anti-aliasing | Bloom | Particles | Pixel ratio |
|---|---|---|---|---|---|
| Low | off | FXAA | off | 1500 | 0.75 |
| Medium | 1024, one map that follows the camera (one cascade), PCF radius 1 | FXAA | first blur level at half the frame | 4000 | 1 |
| High | 2048, PCF radius 3 (soft) | MSAA 4× | first blur level at the full frame | 8000 | device, max 2 |

Gaps found and fixed:
- High's shadows were not soft: r186 dropped PCFSoftShadowMap; its PCF is a 5-tap Vogel disk whose spread is
  `shadow.radius`, now 3 texels on High (no visible dithering at 2048).
- Medium and High had the same bloom. UnrealBloomPass blurs from half of the size it is given, so Medium (the
  look the bloom was tuned with) keeps feeding it the frame, and High feeds it twice the frame: High's halo is
  full resolution and a little tighter.
- Presets were only read at construction. `Renderer3D.setQuality(name)` now rebuilds shadows (map disposed and
  resized), the composer (MSAA target or FXAA, bloom on/off) and the pixel ratio; other passes put in the
  composer (the menu backdrop's dust) are kept. Particle pools, flash lights and terrain detail are built with
  the battle and follow in the next one.
- `pixelRatioFor`, `bloomSize`, `lowerQuality`, `QUALITY_ORDER` in `quality.js`, pure and tested.

## Frame-time monitor (`src/ui/perf-monitor.js`)

- `FrameWatch` judges one-second samples of play: it flags when 12 of the last 15 seconds were under 40 fps
  and their mean too. Paused (P, game menu, lost context), hidden and finished battles are not judged; the
  first 8 seconds of play (shaders, uploads) and 3 seconds after every pause are skipped; a single frame over
  1 s (tab switch, breakpoint) counts as a pause, not as slowness. No allocation per frame (a Float32Array ring).
- `PerfMonitor` offers the next lower preset than the one the renderer runs (not the saved one). Switch saves it
  and applies it live through `r3d.setQuality`; the message bar says "Graphics set to Medium. Particle detail
  follows in the next battle." It keeps watching, so Medium can still lead to Low. Not now: no more prompts this
  battle. Don't ask again: `perfCheck` saved off (Options → Frame-rate check turns it back on). Nothing below Low.
- The prompt is a small `.dm-panel` card at the battlefield's lower right, `role="status"`; it never takes focus,
  so the keyboard stays with the battle. Styled inline: `menu.css` belongs to no stream.
- `main.js` starts it for skirmish, base and battle scenes (not the galleries or the stress test), on its own
  animation frames, after the scene has started.
- Headless browsers (user agent `HeadlessChrome`, or `navigator.webdriver`) skip it, so smoke and e2e
  screenshots and clicks stay clean on slow SwiftShader. `?perfCheck=1` forces it on; `perfFps` and `perfSeconds`
  change the threshold and the stretch for testing, e.g.
  `?scene=battle&perfCheck=1&perfFps=1000&perfSeconds=3` shows the prompt after about 11 s.

## Settings and menus

- `musicVolume` (0..1, 0 = off, default 0.5) and an Options row "Music" after Voices (contract 2). Volumes now
  stop at 1 in `sanitize` (they could be stored up to 4 before; no slider ever went past 1).
- `perfCheck` (default on) and an Options row "Frame-rate check" under Graphics.
- Main menu entry "Original Game Files" after Options (spec §5.8), and a "Game files" row on the Options page in
  both menus; both open `(await import('./original-files.js')).originalFilesPanel(settings, { onBack })`
  (contract 3) through `originalFilesPage()` in `options.js`. If the import fails, the export is missing, it
  throws or returns no element, the page says "Not available" with a Back button. Esc goes back to the page that
  opened it (Options or the title). A late answer never replaces a screen the player has left.
- `MainMenu` takes `onSettings(key, value)`, called on every option change (for the music's live volume).

## Controls audit (spec §5.7 table)

| Row | Before | Now |
|---|---|---|
| Left / right click, drag, Shift, double click | as the table | unchanged |
| Ctrl + click force fire | both schemes | unchanged |
| Alt + click force move | missing | Alt + the order click (Classic left; Modern right, or left as with Ctrl) moves onto whatever is there: no attack, harvest, lift or selection; tracks crush enemy soldiers (test runs the crush) |
| Ctrl + 1–9 · 1–9 · double tap | yes | unchanged |
| A · S · G · X · D | yes | unchanged |
| H / Home | yes | unchanged |
| Space: last alert | missing | `Controller.noteEvent(e)` keeps where the latest "base under attack", "harvester under attack" or "structure destroyed" happened (the enemy hit just before the line), or any `eva` line that carries `x`, `y`; Space looks there |
| Sidebar left / right / Shift | yes (sidebar.js) | unchanged |
| Radar | Classic left orders with a selection, Modern right orders (radar.js) | Modern right click with only a factory selected now moves its rally point (`Controller.orderTile`) |
| Esc · P | yes (GameView) | unchanged |

Radar (`src/ui/radar.js`, opponents') matches the table; no change needed there. The controls screen lists every
row in the chosen scheme's words (Deploy · destruct, Force fire · force move, Centre on base · last alert, Radar).

## Frame times on the real GPU

Intel ADL GT2 (Mesa, ANGLE/GL), headless Chrome 154, 1920×1080 window (battlefield 1648×1080 CSS px). GPU time
is per game frame from `EXT_disjoint_timer_query_webgl2` (immune to CPU load); the frame interval is rAF to rAF,
measured while the machine's load average was 19–25 on 12 cores (other streams' tests), so it is pessimistic.
20 s after a 6 s warm-up.

| Scene | Preset | GPU ms mean (p95) | Frame ms mean (p95) | Draws · triangles |
|---|---|---|---|---|
| stress, 200 units fighting, 128 map | Low | 17.3 (32.0) | 34.0 (66.6) | 119 · 568k |
| | Medium | 34.2 (51.0) | 52.3 (83.3) | 253 · 1.20M |
| | High | 69.1 (110.9) | 90.4 (149.9) | 243 · 1.27M |
| battle, 14 units with specials and air | Low | 12.1 (20.1) | 49.3 (66.6)* | 119 · 116k |
| | Medium | 14.0 (17.5) | 23.0 (33.4) | 235 · 251k |
| | High | 33.4 (40.9) | 44.1 (50.1) | 234 · 252k |
| base, a whole built base | Low | 8.7 (11.2) | 17.1 (16.8) | 180 · 297k |
| | Medium | 18.4 (22.6) | 27.7 (33.4) | 329 · 696k |
| | High | 39.8 (47.6) | 50.6 (66.7) | 328 · 696k |

\* one 3.5 s stall at the start of the run (shader compile while the machine was loaded).

Reading: on this GPU Medium is fill-bound — about twice Low's GPU time, mostly from 1.78× the pixels plus the
shadow pass (which doubles the triangles). A built base on Medium needs ~18 ms of GPU, just over a 60 Hz frame, so
it lands near 30–50 fps; a 200-unit battle on Medium is ~29 fps on the GPU alone, and the monitor will offer Low
there. Low holds 60 fps in a base and ~58 fps of GPU headroom in the 200-unit battle. High is 2–4× Medium and is
for discrete GPUs.

## How to test

- `npm test` (all), or `node --test tests/quality-presets.test.mjs tests/perf-monitor.test.mjs tests/options-settings.test.mjs tests/menu-entries.test.mjs tests/controls-scheme.test.mjs`.
- Prompt: `?scene=battle&perfCheck=1&perfFps=1000&perfSeconds=3`, wait ~11 s, click Switch (twice for Low).
- Menus: main menu → Original Game Files (Not available until original-files.js lands); Options → Music, Game files.
- Controls: select a tank, Alt + click an enemy soldier (it drives over him); get the base shot at, Space.

## Open questions

- Medium is the spec's default for this laptop but is fill-bound here; if the prompt shows too often in normal
  play, lowering Medium's cost (or Low as the laptop's default) is the manager's call.
- High's bloom is full resolution and its halo a little tighter than Medium's; tuned by eye only on Medium.
