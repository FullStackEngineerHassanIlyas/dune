# Phase 2 — the FM soundtrack

Branch `phase2/music` (from `improve/visibility` tip `5719049`). Spec §6 *Music*; research
`docs/research/raw/audio-ui-controls.md` §A.2 and OpenDUNE's `opendune.c` / `unit.c` for what plays when.
Everything heard is synthesized by our own code from our own compositions: no Westwood data, melody or
recording is in the repo.

## What there is

`src/audio/music/`:

| File | What it does |
|---|---|
| `fm.js` | The YM2612-style voice: 4 sine operators, the chip's 8 algorithms, operator 1 feedback, per-operator envelopes on the chip's scales (rates 0–31, release 0–15, total level 0–127 in 0.75 dB steps, sustain 0–15 in 3 dB steps, key scaling, a full-scale modulator swinging its carrier ±4 cycles), a per-voice LFO for vibrato and tremolo (with a delay), portamento. |
| `drums.js` | 14 synthesized kit pieces (kick, war drum, boom, toms, snare, clap, hats, tambourine, frame drum, tek, crash, anvil): a pitch-falling sine, filtered noise, an FM "metal" pair, soft saturation. |
| `patches.js` | 14 instruments: drone, bass, drive (battle bass), ney, reed, strings, choir, brass, stab, oud, kanun, bell, lead, arp. |
| `score.js` | The pattern format (below), `compile()` and `checkTrack()`. |
| `deck.js` | One track playing: events on their exact sample, swing, intro once then the loop body for ever or for N passes, a tempo-synced ping-pong echo, then a ring-out. |
| `mixer.js` | Tracks by id, crossfades, a queued next track that starts on the sample the last one ends, a 40 Hz high-pass (DC from 1:1 FM, sub-bass no laptop plays), a soft ceiling. Same code in the worklet, the worker and Node. |
| `worklet.js` | The AudioWorklet processor (`dune-music`): the mixer on the audio thread, 128 samples at a time; reports its own share of the thread. |
| `worker.js` + `output.js` | Without AudioWorklet (plain http on a LAN): a worker renders 2048-sample blocks on request and the page keeps ~0.4 s queued. `output.js` is the Web Audio side: the music's own gain into the game's master, the synth, the player's files through a media element, a debug level meter. |
| `director.js` | The battle's mood: peace / battle / over / victory / defeat, and `threatNear()`. |
| `music.js` | `Conductor` (mood → playlist or FM pool, shuffle, queueing, volume, playlists), `BattleMusic`, `MenuMusic` + `MenuAudio`. |
| `songs/` | The 12 tracks and the pools. |
| `render-wav.mjs` | Dev tool, Node only: `node src/audio/music/render-wav.mjs <ids|all> <seconds|full> <dir> [rate]` writes WAVs and prints the CPU it took. |

Wiring: `src/game/game-view.js` (a `BattleMusic` per battle: events, a `frame()` every frame, pause,
the result screen, `__dune.music`), `src/scenes/menu.js` (a `MenuMusic`: title after the first gesture,
rests while a battle is in the frame, `?music=<id>` plays any track, `__dune.music`).

## The pattern format

A track: `bpm`, `beat` (steps per beat, 4), `bar` (steps per bar, 16; `lanterns` is 12/8 with 3 and 12),
`swing`, `root` + `mode`, `gain` (dB, sets it to −18 LUFS), `passes` (loop passes before the next track;
0 = for ever), `echo`, `channels` (an FM patch with `voices`, `res`, `vol` dB, `pan`, `echo`, `glide`,
`gate`, or `drums: true`), `patterns` (each `bars` long), `intro` and `loop` (order lists; `A+1` plays A a
semitone up).

A melodic line is one token per `res` steps: `d4`, `f#3`, `bb2`; chords `d3+f#3+a3` on a channel with
voices; `-` holds; `.` lets go; `~` slides without a new attack; `!` accent, `?` soft; `*n` stretches a
token over n slots; `|` is only for reading; a leading `@n` sets the slot to n steps. Drum lanes are one
character per step: `x`, `X` accent, `g` ghost, `.`. `checkTrack()` rejects unknown patches, lines of the
wrong length, a loop body that is not whole bars, and any note outside the pattern's mode.

## The tracks (all original)

| id | Title | Pool | Mode | Tempo | Intro + loop |
|---|---|---|---|---|---|
| title | Arrakis | menu | D Phrygian dominant | 80 | 12 + 60 s |
| atreides | Banner of Caladan | briefing | D Dorian | 88 | 5.5 + 43.6 s |
| harkonnen | Furnace of Giedi Prime | briefing | C Phrygian, B section Locrian | 72 | 6.7 + 53.3 s |
| ordos | Ledger of Shadows | briefing | E Hungarian minor | 100 | 4.8 + 28.8 s |
| erg | The Open Erg | peace | D Phrygian dominant, maqsum frame drums | 96 | 5 + 70 s |
| dawn | Harvester at Dawn | peace | A harmonic minor, kanun ostinato | 104 | 4.6 + 64.6 s |
| lanterns | Sietch Lanterns | peace | E Phrygian, 12/8 | 54 (dotted ¼) | 8.9 + 71.1 s |
| assault | Sand Assault | battle | D Phrygian dominant, climbs a semitone half-way | 144 | 3.3 + 40 s |
| iron | Iron Dunes | battle | E Phrygian, toms + arpeggio | 150 | 3.2 + 32 s |
| shieldwall | Shield Wall | battle | C harmonic minor, taiko half-time | 132 | 3.6 + 36.4 s |
| victory | Banners over the Dunes | victory | D Mixolydian fanfare + march | 108 | 4.4 + 17.8 s |
| defeat | Dust and Silence | defeat | D Phrygian lament | 66 | 3.6 + 29.1 s |

Peace tracks play 2 passes (~2.5 min) and battle tracks 2–3 (~1.5 min) before the next shuffled pick;
title, victory and defeat loop for as long as their screen stays.

## When what plays (following the original)

OpenDUNE: the mission starts a random peace track; `g_musicInBattle` is set when an enemy unit comes
into the player's sight (`Unit_HouseUnitCount_Add`, behind the "enemy approaching" cool-down) or a worm
appears, and a random battle track plays; peace again when it ends; `Music_Play(0)` when the level ends.

Here: peace tracks shuffle (never the same twice running); **battle** when an enemy or a sandworm the
player can see is within 12 tiles of one of their buildings or 8 of their units (checked once a second
of battle time), or when the player's forces fire, are damaged or lose something to another house.
**Peace** returns after 25 s of battle time without any of that, once the battle track has had 30 s.
Battle takes over at once (1.2 s fade, the battle track's own drum intro); peace comes back gently
(3 s fade out, 1.5 s pause, 2 s fade in). **Game over**: the music fades out over 2 s (the original
stops it), then the result screen plays victory or defeat (a draw counts as defeat). Everything is
timed on `world.time`, so a paused game holds every timer.

Not the original, kept as small extras: the music dips ~4.4 dB while the announcer speaks; the house
briefing themes exist but nothing in the game plays them yet (see integration).

## Volume, pause, playlists

- Contract 2: the music's gain = `settings.musicVolume ?? 0.5` (clamped 0–1), read every frame (battle)
  or every 250 ms (menu), so the Options row works live without a callback. At 0 the worklet node is
  disposed (nothing runs on the audio thread) and comes back with the current mood when raised.
- The gain feeds the battle's `SoundEngine.master` (M mute and the master volume act on it; the
  limiter guards it). Pausing (game menu, P, hidden tab) suspends that context, which holds the FM
  music exactly; a player's file is paused explicitly. Muted (M, Sound off) the synth is held too
  (`hold`: nothing rendered) and carries on from the same place when the sound comes back.
- The menu has its own small context (`MenuAudio`, Options volume and Sound on/off, a limiter), opened
  by the first click or key, because the backdrop's own engine sleeps whenever the backdrop is paused.
  It is suspended while a battle is in the frame and while the page is hidden.
- Contract 4: `playlistTracks('menu' | 'peace' | 'battle')` from `src/core/user-files.js`, imported
  lazily (3 s at most is waited for). A non-empty list takes over that mood: files shuffled, one after
  another, through a media element (streamed, not decoded whole). A file that will not play is skipped;
  if none plays, the FM music returns. A missing module or empty list keeps the FM music.

## Measurements

Loudness and peaks, rendered with `render-wav.mjs all full` (intro + 2 passes + ring-out, 48 kHz) and
measured with ffmpeg `ebur128=peak=true` and `astats`:

| Track | Integrated | LRA | True peak | Sample peak |
|---|---|---|---|---|
| title | −18.0 LUFS | 3.5 LU | −0.9 dBTP | −0.9 dBFS |
| atreides | −18.0 | 2.7 | −4.4 | −4.4 |
| harkonnen | −18.0 | 3.7 | −3.4 | −3.6 |
| ordos | −18.0 | 3.5 | −0.3 | −0.4 |
| erg | −18.0 | 5.0 | −3.5 | −3.5 |
| dawn | −18.0 | 1.7 | −1.3 | −1.3 |
| lanterns | −18.0 | 0.8 | −5.5 | −5.6 |
| assault | −18.0 | 2.8 | −4.2 | −4.2 |
| iron | −18.0 | 1.4 | −3.6 | −3.7 |
| shieldwall | −18.0 | 6.8 | −5.3 | −5.4 |
| victory | −18.0 | 2.9 | −3.4 | −3.8 |
| defeat | −18.0 | 2.0 | −6.7 | −6.7 |

DC offset 0.000000 on every track. At the default music volume (0.5, −6 dB) and master 0.8 the music
sits near −26 LUFS, under the effects (a rifle beside the camera peaks around −26 LUFS short-term,
explosions −19 to −22). Laptop speakers: the first battle renders had 60–75 % of their energy under
150 Hz; after brightening the patches, lifting the drums' fundamentals and pulling the battle drums and
basses down, the battle tracks carry 21–30 % there and 11–15 % in 1–6 kHz. The peace pieces are
deliberately darker (ney, drone, choir: most energy 150–1000 Hz).

CPU (the manager's laptop, i7-1255U, shared with four other streams, load average 8–12): best of 3
renders of 30 s at 48 kHz in 128-sample blocks under Node (V8, as in Chrome): **mean 2.2 %, max 2.7 %
of one core** (title 2.4, atreides 1.8, harkonnen 1.9, ordos 1.8, erg 2.4, dawn 1.4, lanterns 2.1,
assault 2.3, iron 2.6, shieldwall 2.4, victory 2.7, defeat 2.6). In headless Chrome the worklet's own
clock (it includes being pre-empted on the loaded machine) read 4–6 % of the audio thread during the
title and a battle track. Nothing runs while the context is suspended (paused, hidden tab, the menu
behind a battle), while the game is muted, or at music volume 0. No objects are allocated per block on
the audio thread.

Real Chrome (GPU, `scene=menu` and `scene=base&house=atreides`, driven over CDP with real clicks):
title after the first click (worklet up, −28 to −34 dB RMS after the music gain), suspended behind a
skirmish and back on quit; a battle starts in peace (`lanterns`/`dawn` with the next queued), four
Harkonnen tanks by the construction yard switch it to a battle track within ~1 s together with the
"Harkonnen unit approaching" warning (level 0.3: ducked under the line), P holds the context, music
volume 0 takes the synth down and 0.8 brings a battle track back; M holds the synth (silent, no load
reports) and M again resumes the same track; a forced game over fades to silence
and the result screen plays `victory`; with `AudioWorkletNode` removed the worker fallback plays the
title. No console errors.

## How to test

- `node --test tests/music-synth.test.mjs tests/music-score.test.mjs tests/music-play.test.mjs`
  (synth maths and envelopes, determinism, every patch and drum; the format, sample-exact sequencing
  with swing over 40 passes, every track valid/in mode/whole bars, −18 ± 2 LUFS and under full scale,
  no click at any loop seam, steady level pass to pass, queued tracks sample-exact; the director, the
  threat check, shuffle, contracts 2 and 4 with fakes, the worker fallback's gapless queue, the menu).
- Listen: `node src/audio/music/render-wav.mjs all full /tmp/music` and play the WAVs, or open
  `?scene=menu&music=<id>` and click once (any track id from the table).
- In a battle: `__dune.music` → `{ mood, playing, track, queued, synth, level, load, context, meter(),
  settings }`; `__dune.music.settings.musicVolume = 0.2` acts as the Options row will.

## Open questions

- Where should the house briefing themes play? The original plays them on the Mentat briefing; there
  is no briefing screen yet. `MenuMusic.briefing(house)` is ready for one (or for the skirmish set-up's
  house choice).
- The original plays a random battle track again on its statistics screen; here the result screen has
  its own victory/defeat themes as the brief asked. Easy to switch if the manager prefers the original.
- Peace/battle switching uses the original's trigger (an enemy in sight near the player) plus the
  player's forces fighting; if it switches too eagerly in practice, `CALM`/`MIN_BATTLE`/`NEAR_*` in
  `director.js` are the knobs.
