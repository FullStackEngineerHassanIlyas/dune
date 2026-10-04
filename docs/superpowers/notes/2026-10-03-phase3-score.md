# Phase 3 — the score (stream `score`)

Branch `phase3/score` (from `phase3/integration` at `dc2061e`). Spec §6 *Music*; research.md §8 (the Sega intro)
and §9 (the 22-track Sega soundtrack and where each cue plays); music.md §1 (synth, sequencer, tests); contracts
C6 (INTRO_MARKS) and C7 (song ids). Everything heard is synthesized by our code from our own compositions: no
Westwood melody, harmony, rhythm or recording is in the repo. The Sega renders in scratch were only *measured*
(length, tempo, loudness curve, density, register), never transcribed.

## What the manager asked, and what there is now

The built-in FM soundtrack (what plays when the player has not loaded the original Sega files) now has a cue for
every role the Sega game has, in the Mega Drive's colours — FM power brass and slap bass, choir and swelling pads,
sampled-sounding ("PCM") drums, desert modes, driving ostinati and dramatic builds. The old menu theme (a ney over
frame drums, which "did not match the game's theme") is replaced.

| id (C7) | Title | Sega role it fills (research §9) | Key / mode | Tempo | Intro + loop | Plays |
|---|---|---|---|---|---|---|
| `opening` | Approach to Arrakis | Opening (boot → title) | D harmonic minor → D Phrygian dominant | 120 → 160 | 16.0 + 18.0 s | **once**, then `title` |
| `title` | Dunes of Arrakis | the Opening's loop under the menu | D Phrygian dominant | 80 | 6.0 + 48.0 s | loops |
| `houseSelect` | Three Banners | Chosen Destiny | D: Phrygian dominant / Dorian / Hungarian minor / Phrygian | 84 | 2.9 + 45.7 s | loops |
| `region` | Into the Region | Evasive Action | E Phrygian | 136 | 7.1 s | **once** |
| `victory-atreides` | The Duke's Banner | Conquest | D major | 132 | 3.6 + 21.8 s | loops |
| `victory-harkonnen` | Iron Heel | Harkonnen Rules | C Phrygian, B section Locrian | 100 | 2.4 + 38.4 s | loops |
| `victory-ordos` | The Silent Partner | Slitherin | E Hungarian minor, swung | 92 | 5.2 + 41.7 s | loops |
| `defeat-atreides` | The Fallen Banner | Atreides Dirge | D Aeolian | 68 | 17.6 s | loops |
| `defeat-harkonnen` | Ashes of the Furnace | Harkonnen Dirge | C Phrygian | 54 | 17.8 s | loops |
| `defeat-ordos` | The Ledger Closed | Ordos Dirge | E Hungarian minor | 68 | 17.6 s | loops |
| `finale` | Arrakis Reborn | Finale | D Phrygian dominant → D Mixolydian | 100 | 4.8 + 57.6 s | one pass |
| `credits` | Songs of the Spice | Credit Roll | D, a medley through the houses' modes | 120 | 4.0 + 80.0 s | loops |
| `harvest` | Spice Harvest | an in-game tune (peace pool) | G Dorian | 104 | 4.6 + 73.8 s | loops in the shuffle |
| `stormfront` | Storm Front | an in-game tune (battle pool) | A Phrygian | 140 | 3.4 + 34.3 s | loops in the shuffle |

Kept unchanged: the three briefing themes (`atreides`, `harkonnen`, `ordos`), the six phase 2 peace and battle
tracks, `victory` and `defeat`. The Sega's in-game tunes are bass-led rock in FM (a picked bass in eighths, bright
synth brass, sampled drums), so each pool gained one original piece of that kind: `harvest` (a slap-bass groove
under a power-brass tune, a reed bridge over a kanun) and `stormfront` (the bass hammering the Phrygian half step,
brass riffs in fifths, a tom-and-choir breakdown). 25 tracks in all.

### The house characters

- **Atreides** — noble and heroic: horn calls with rising fourths and fifths, D Dorian (briefing, house select) and
  D major (victory), a snare march; the dirge is a horn lament in D Aeolian over a muffled snare and timpani.
- **Harkonnen** — brutal and martial: brass in octaves hammering the Phrygian half step, a Locrian turn, war drums,
  an anvil on the backbeat; the dirge is low brass over a heartbeat drum at 54 bpm.
- **Ordos** — cold and scheming: a slithering slap bass through the augmented second of E Hungarian minor, bells,
  a reed, a tek and claps, swung; the dirge is reed and bell.

### The opening, second by second (contract C6)

Written to `INTRO_MARKS` = { credits 4.0, present 10.0, planet 16.0, stop 17.8, ships [18.8, 20.3, 21.8], title 26.5,
menu 30.0 } (seconds after the gesture). The first 16 s are written at 120 bpm (two-second bars, so 4.0, 10.0 and
16.0 fall on beats), the rest at 160 (1.5-second bars from the planet, so the title lands on a downbeat seven bars
later and each ship is one bar apart):

| s | music |
|---|---|
| 0.0 | the hit: orchestra-hit chord D–A–D, crash, boom, timpani (momentary −15 LUFS) |
| 0.5–4.0 | the dark: a drone, a pad at velocity 0.2–0.3, two bell glints (−31 LUFS) |
| 4.0 | **credits**: the choir enters; the pad climbs B-flat → G minor → D minor/A; bell "stars" |
| 10.0 | **present**: power brass swells (velocities 0.5 → 1.0) over B-flat, G minor, A major (the dominant) |
| 15.0–15.9 | a bell run up D harmonic minor falls on to the planet |
| 16.0 | **planet**: D major (the dominant resolved), crash + timpani, the drums and slap-bass eighths arrive |
| 18.81, 20.31, 21.81 | **ships**: a push on the last eighth of each bar (stab chord + crash + boom), 12 ms after each mark |
| 22.0–26.5 | the build: B-flat, C (borrowed from D Aeolian), toms, a snare roll, the brass climbing G–A–B-flat–C |
| 26.5 | **title**: the climax — hit, crash, timpani, and the title theme's first phrase on power brass |
| 29.5 | the theme's peak (F-sharp, the augmented second above E-flat) as the menu fades in at 30.0 |
| 31.75 | the Phrygian cadence E-flat → D, a last hit |
| 32.5–34.0 | the D major chord held; the sequence ends at 34.0 and `title` starts on that very sample |

The title theme then begins with its own quiet bed (a deliberate dip, as the Sega opening falls to a quiet bed
under its menu) and rebuilds; its pulse (sixteenths at 80) is the opening's (eighths at 160).

## Format and instrument changes (score.js, deck.js, drums.js, patches.js, songs/kit.js)

- **A pattern's own tempo**: `bpm` on a pattern stretches its steps onto the track's grid (events fall between
  whole steps; the deck already placed events by fractional step). It is what lets one cue follow a picture.
  `checkTrack` rejects a pattern tempo outside 40–220 and a pattern tempo in a swung track (swing is on the track's grid).
- **Velocity digits**: `d4:3` is velocity 0.3 (`!` stays 1, `?` 0.5), for crescendos written note by note.
- **PCM-style drums**: a drum channel with `crush: 13000` is sample-and-held at that rate and rounded to 8-bit steps
  — the gritty sound of the Mega Drive's DAC drums — and holds nothing once the hits have died.
  New kit pieces: big snare `P`, timpani `J`, mid tom `M`.
- **New FM instruments**: `hit` (orchestra hit), `slap` (picked/slapped bass with a 7:1 pop), `power` (bright
  saw-edged synth brass), `pad` (a swell that brightens as it grows).
- **Song helpers** (`songs/kit.js`): `at(line, n)` sets every note of a line to one velocity; `shift(line, semis)`
  moves a line by semitones.
- **`once: true`** marks a track that plays one pass and never loops (`opening`, `region`, both `passes: 1`).
  Looping tracks queued after another (`title`, `houseSelect`, the victories, the dirges, `credits`) default to
  `passes: 0`; `finale` plays one pass so the credits can follow it (in the game the ending moves to the credits
  at 13 s, so the finale's turn to major comes first, at 4.8 s; see Review fixes).

## songs/index.js (contract C7)

`TRACKS` (25), `POOLS` = { intro: ['opening'], menu: ['title'], houseSelect, region, peace (4), battle (4),
victory: ['victory'], defeat: ['defeat'], finale, credits }, `BRIEFINGS`, `VICTORY` and `DEFEAT`
(`{ atreides: 'victory-atreides', harkonnen: …, ordos: … }`, plus the Fremen/Sardaukar/mercenary aliases as
`BRIEFINGS` has them).

## How it was checked without ears

- `checkTrack`: every note of every pattern in its mode; lines the right length; whole bars.
- A semitone-clash scan (scratch `clash.mjs`): parts holding notes a minor second / major seventh apart for more
  than 0.2 s. Unintended clashes (drone pedals under chords that moved) were removed by making the pedals follow
  the harmony; the ones left are the style's own (the Phrygian half step over a pedal in the Harkonnen pieces, the
  raised fourth and sixth of the Hungarian minor in the Ordos pieces, passing tones).
- Per-channel loudness over time (scratch `stems.mjs`): each part rendered alone, so that the theme leads its
  accompaniment in every section (several were rebalanced: the title's lead was 4 dB under its horn at first).
- The Sega references, measured (not heard) with an onset/spectrum/loudness script, against our renders:

| Sega cue | centroid | < 150 Hz | LRA | ours | centroid | < 150 Hz | LRA |
|---|---|---|---|---|---|---|---|
| Opening | 502 Hz | 42 % | 6.1 | opening | 482 Hz | 34 % | 12.9 |
| Chosen Destiny | 596 | 20 % | 9.5 | houseSelect | 535 | 30 % | 2.4 |
| Evasive Action | 620 | 10 % | 6.0 | region | 507 | 30 % | 10.2 |
| Conquest | 876 | 19 % | 2.0 | victory-atreides | 778 | 31 % | 1.8 |
| Harkonnen Rules | 763 | 17 % | 1.3 | victory-harkonnen | 450 | 48 % | 1.7 |
| Slitherin | 323 | 65 % | 1.3 | victory-ordos | 511 | 52 % | 4.7 |
| Dirges | 285–311 | 49–57 % | 3.5–4.4 | defeat-* | 350–565 | 8–30 % | 1.2–4.4 |
| Finale | 761 | 18 % | 0.8 | finale | 839 | 25 % | 1.4 |
| Credit Roll | 421 | 52 % | 1.4 | credits | 575 | 36 % | 2.7 |

  (The Sega renders sit around −26 LUFS; ours are normalised to −18 like the rest of the soundtrack. Our dirges are
  brighter than the Sega's on purpose: a laptop speaker loses everything under 150 Hz.)

## Measurements

Loudness and peaks: rendered at 48 kHz (looping tracks: intro + two passes + ring-out; once-tracks: the cue + ring-
out), measured with ffmpeg `ebur128=peak=true` and `astats` (the last column: energy under a one-pole split at 150 Hz,
a gentler split than the FFT bands above). Every track: **−18.0 LUFS integrated**, DC 0.000000.

| Track | Integrated | First 24 s | LRA | True peak | Sample peak | < 150 Hz |
|---|---|---|---|---|---|---|
| opening | −18.0 | −19.3 | 12.9 LU | −1.2 dBTP | −1.3 dBFS | 35 % |
| title | −18.0 | −19.0 | 4.5 | −1.1 | −1.3 | 36 % |
| houseSelect | −18.0 | −18.3 | 2.4 | −3.3 | −3.5 | 31 % |
| region | −18.0 | −18.0 | 10.2 | −0.7 | −0.7 | 34 % |
| victory-atreides | −18.0 | −18.1 | 1.8 | −3.1 | −3.3 | 28 % |
| victory-harkonnen | −18.0 | −18.0 | 1.7 | −3.0 | −3.1 | 41 % |
| victory-ordos | −18.0 | −18.7 | 4.7 | −0.4 | −2.0 | 41 % |
| defeat-atreides | −18.0 | −17.9 | 4.4 | −4.5 | −4.5 | 24 % |
| defeat-harkonnen | −18.0 | −17.9 | 3.4 | −4.2 | −4.2 | 32 % |
| defeat-ordos | −18.0 | −18.0 | 1.2 | −3.6 | −3.6 | 19 % |
| finale | −18.0 | −18.4 | 1.5 | −2.8 | −2.9 | 25 % |
| credits | −18.0 | −18.3 | 2.7 | −1.8 | −1.9 | 36 % |
| harvest | −18.0 | −18.9 | 2.4 | −3.4 | −3.4 | 38 % |
| stormfront | −18.0 | −18.1 | 2.7 | −2.8 | −2.8 | 47 % |

The twelve phase 2 tracks re-measured unchanged at −18.0. The opening's shape (short-term loudness, 3 s): −31 after
the hit, −27 at 6 s, −22 at 12 s, −18 at 14 s, −16 with the planet, −16/−17 through the ships and the build, −16 on
the title; then the title's bed at −26 and its theme at −17 to −19.

CPU (Node, V8 as in Chrome, 48 kHz in 128-sample blocks, best of three 30 s renders; the machine was shared by ten
streams, load average 8–18 on 12 threads, so absolute numbers run high — compare with the two phase 2 tracks
measured in the same runs): opening 4.5 %, title 4.3 %, houseSelect 4.2 %, region ~4–6 % while it plays,
victory-atreides 4.4 %, victory-harkonnen 4.7 %, victory-ordos 2.4 %, the dirges 2.6–3.0 %, finale 4.8 %, credits
3.4 %; harvest 3.5 % and stormfront 3.4 % (6 and 7 voices at most) against iron 4.3 % and erg 3.5 % in a later run;
phase 2's iron 3.6 % and erg 2.8 % in the same runs (they measured 2.6 % and 2.4 % on a quieter machine).
The fullest cues (opening, title, finale) hold up to 10–14 FM voices against phase 2's 3–8; the sustained chord
parts (drone, pad, choir) are most of the cost, so the title keeps its pad for the intro only. The crush costs
nothing measurable. In real headless Chrome on the GPU (scene=menu, `?music=<id>`, after a click): the worklet
reported 5.6 % (opening), 7–12 % (title, two runs), 8.5 % (finale), 8.6 % (houseSelect) and 4.7–6.1 % (iron) of
the audio thread under the same load, and later harvest and stormfront 4.1 % each (median of 12); the menu ran with no console errors and `meter()` read −21 to −30 dB.
Nothing runs while the context is suspended, muted or at music volume 0 (unchanged).

## How to test

- `node --test tests/music-score.test.mjs tests/music-synth.test.mjs` — the format (pattern tempo, velocity digits),
  sequencing, every track valid and in its mode, 25 tracks, pools and VICTORY/DEFEAT, the once-through cues (single
  pass, the opening longer than the menu mark and at most 36 s, the region 7 ± 0.5 s, the dirges 18 ± 1 s), the
  opening's marks (a hit at 0, no drums before the planet, an accent at 16.0, each ship ± 30 ms and 26.5, the choir at
  4.0, the brass at 10.0, the theme on the title; it also checks `src/game/intro-timeline.js`'s INTRO_MARKS against
  the same numbers once that file exists), the hand-over (title starts on the opening's last sample), −18 ± 2 LUFS
  (once-tracks over the whole cue), peaks, loop seams, the crush, the new kit pieces.
- The full suite (`flock /tmp/dune-npmtest.lock npm test`) passed on this branch: 904 of 904.
- Listen in the game: `?scene=menu&intro=0&music=<id>` and click once.
- Render: `node src/audio/music/render-wav.mjs <ids|all> full <dir>` (for `opening`/`region` use a length in seconds,
  e.g. `node src/audio/music/render-wav.mjs opening 40 /tmp/music`: `full` renders two passes).

## Files to audition (rendered at 48 kHz, scratch only, never committed)

Render them with `node src/audio/music/render-wav.mjs all full <dir>`:

1. `opening-then-title.wav` — the boot as heard: the opening, the title following on its last sample (70 s).
   Listen for: does 0 s hit hard enough; does the rise feel like approaching a planet; do the drums at 16 s, the
   three pushes and the 26.5 s climax line up with the intro once the intro stream's picture is there?
2. `title.wav` — the new menu theme (intro + two passes). Does it now "match the game's theme"?
3. `houseSelect.wav`, `region.wav`.
4. `victory-atreides.wav`, `victory-harkonnen.wav`, `victory-ordos.wav` — is each house's character clear?
5. `defeat-atreides.wav`, `defeat-harkonnen.wav`, `defeat-ordos.wav`.
6. `finale.wav`, `credits.wav`.
7. `harvest.wav` (peace), `stormfront.wav` (battle) — do they sit with the phase 2 tracks of their pools?

I cannot hear: everything above was measured and checked structurally. The most likely things a listener will want
changed are balance details (a part too loud or too soft), the crushed drums' grit (`crush` per track: 11000 is
grittier, 16000 cleaner, 0 off) and the tempo of the title (80).

## Open questions

- The opening is 34 s with the title starting at 34.0; if the intro's picture changes, the cue follows by editing
  `patterns` in `songs/opening.js` (the first three patterns are at 120 bpm, the rest at 160) — the marks test says
  where it no longer lines up.
- Should the title's quiet bed after the opening be shorter? It is 6 s (two bars at 80).
- The pools now hold one bass-led rock-FM piece each (`harvest`, `stormfront`) beside phase 2's three; the
  stormfront has 47 % of its energy under 150 Hz (a bass-led piece, as the Sega's are) — on a laptop speaker it
  will sound lighter than in headphones. More of that kind could replace the gentler phase 2 pieces later.

## Integration notes (for the music stream / lead)

- Play `opening` with `passes: 1` (its own `passes`), and queue `title` with **`passes: 0`** (`next`) so the menu
  theme loops; `TRACKS.title.passes` is now 0, so `next { passes: TRACKS[id].passes }` does the right thing.
- `region` plays once (`passes: 1`), about 7 s, then rings out — no need to stop it.
- `once: true` on a track means it never loops; a single-track pool in `Conductor.start()` plays `passes: 0`
  unless the entrance has `once`, so the `intro` and `region` moods want `once: true` entrances.
- `MusicMixer` compiles a track on its first play, on the audio thread: the opening costs ~20–30 ms cold (JIT and
  compile) in Node — a prime() that compiles it while the context is still suspended would keep the first hit
  from stalling the first render quantum.

## Review fixes

- **The finale's turn to major was never heard** (the ending, `src/game/ending-timeline.js` on phase3/intro, moves to
  the credits' music at `ENDING.credits` = 13 s; the major theme began at 14.4 s). The loop is now
  `['B', 'C', 'A', 'D', 'B', 'F']`: the Phrygian hits (0–4.8 s), the theme in D major while the planet takes the
  victor's colour (4.8–14.4 s, its held tonic from 12.0 s, so the 13 s crossfade lands on it), the choir's climax, the
  theme as the menu knows it, the climb, the major theme again and the cadence. Same length (62.4 s), same gain.
  New test: the first Mixolydian pattern starts at least 6 s before `ENDING.credits` (read from the intro's module
  when it is there, else 13). Re-measured: −18.0 LUFS integrated, −18.4 over the first 13 s and the first 24 s,
  LRA 1.5 LU, true peak −2.8 dBTP, sample peak −2.9 dBFS, DC 0; 7.4 % of one core. Audition `finale.wav` again
  (the first 13 s are what the game plays).
- **This notes file sits outside the score stream's files** (docs/superpowers/notes/ belongs to nobody): kept, as the
  brief asks for notes; the lead accepts it at merge or moves its text (with "For the README") into the PR.

## For the README

Replace the music paragraph with:

> Music comes from an FM synthesizer in the Mega Drive manner (four-operator voices, sample-and-held "PCM" drums)
> playing newly written tracks in the style of the Sega soundtrack: an opening cue timed to the intro, a title
> theme, house selection and region music, a briefing theme, a victory fanfare and a dirge for each house, four
> peace and four battle tracks, a finale and the credits. Peace tracks shuffle; a battle track takes over when
> fighting starts near your forces and gives way after a calm spell. Options → Music sets its volume (0 turns it
> off). `?scene=menu&music=<track>` plays one track (opening, title, houseSelect, region, atreides, harkonnen,
> ordos, erg, dawn, lanterns, harvest, assault, iron, shieldwall, stormfront, victory, defeat, victory-atreides, victory-harkonnen,
> victory-ordos, defeat-atreides, defeat-harkonnen, defeat-ordos, finale, credits);
> `node src/audio/music/render-wav.mjs <ids|all> <seconds|full> <dir>` renders tracks to WAV files.
