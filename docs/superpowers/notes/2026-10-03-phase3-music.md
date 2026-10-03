# Phase 3 — the music around the soundtrack

Branch `phase3/music` (from `phase3/integration` at `dc2061e`). Spec §6 *Music* and *Original files*; research
`p3map/music.md` (the plan), `p3map/research.md` §8 (the Sega intro) and §9 (where each Sega track plays).
Contracts: C6 (menu music, the intro), C7 (song ids, consumed), C8 (VGM core, consumed), plus the slots and the
Music Test. Nothing of the original game is in the repo: the Sega soundtrack plays only from the player's own
files, read in their browser and kept there.

## What changed

| File | What it does now |
|---|---|
| `src/audio/music/music.js` | `Conductor` resolves a **mood** to its music: the player's files in the mood's slot, else the game's FM tracks for that role, else the nearest role (table below). Items are FM ids, media files or VGM files. A synth item queued behind another starts on the sample it ends; a media item starts when the one before it ends. The music already sounding carries on when the next mood's music is the same. `MenuMusic` gains `prime()`, `intro()`, `skipIntro()`, `mood(name)`; `BattleMusic` gains the Sega mode and `reroll()`. |
| `src/audio/music/sega-tracks.js` (new) | The one list of 18 slots, their labels, the selector's choices, and the Sega soundtrack table (research §9) with `autoSlots(title, fileName)`, `segaTrack`, `isGerman`, `normaliseTitle`. Pure data. |
| `src/audio/music/mixer.js` | VGM registry (`{ cmd: 'vgm', id, data }`), VGM decks through the contract's `VgmDeck` (handed in, or `globalThis.duneVgmDeck`), `error` events (a deck that will not read, throws, or stops with `error` set), `next` with no id clears the queue, a one-time warm-up of the VGM player while nothing plays, `VGM_GAIN`. |
| `src/audio/music/output.js` | `playVgm` / `queueVgm` (data sent once per synth, again after a restart), the VGM player loaded into the worklet only when the first VGM is to play (a one-line blob module that imports `vgm-deck.js` and puts the class on the worklet's global scope), commands queued in order behind it; `kick()` for a media file the browser held back before a gesture. |
| `src/audio/music/worker.js` | Imports `vgm-deck.js` the first time a VGM is registered; messages wait behind it in order. |
| `src/audio/music/worklet.js` | Comment only: the VGM player is not imported statically. |
| `src/core/user-files.js` | Slots = `SLOTS`; a track keeps `lists` (its slots) in the same `tracks` store (no version bump; a first-version record's `list` still counts); `importMusic()` (.vgm, .vgz, .zip, MP3/OGG/WAV; VGMs inflated here with `src/formats/vgm.js` and kept plain with `meta { title, game, seconds, loopSeconds, chips, version }`; Sega auto-assign; German left out; no duplicates), `assignTrack`, `trackData`, `playlists()` (every slot in one read, a track in two slots one object), `audition(on)`. `addTracks` kept for MP3/OGG/WAV into one slot. |
| `src/ui/original-music.js` (new) | The page's music section: the picker, the import report, the **Music Test** (title, file, length, loop, a slot selector, Play/Stop, Remove), the coverage line, and `MusicTest` (plays a track on a context of its own; the menu's music makes way). |
| `src/ui/original-files.js` | Mounts the music section in place of the three per-playlist rows. |

### Moods (contract C6)

| Mood | Player's slot | Game's FM (C7) | Nearest | How |
|---|---|---|---|---|
| `intro` | intro | `opening` | menu | once; the menu follows on the sample it ends; the same music in both: plays on for good |
| `menu` | menu | `title` (or `?music=`) | — | loops |
| `houseSelect` | houseSelect | `houseSelect` | menu | loops |
| `briefing:<house>` | briefing-<atreides\|harkonnen\|ordos> | the house theme (BRIEFINGS: Fremen → Atreides, Sardaukar → Harkonnen, Mercenary → Ordos) | menu | loops; `briefing(house)` is an alias |
| `region` | region | `region` | the last briefing (else menu) | once, then quiet (the Sega game: silence while the mission loads) |
| `victory:<house>` / `defeat:<house>` | victory-/defeat-<house> | `victory-<house>` / `defeat-<house>` (VICTORY/DEFEAT) | `victory` / `defeat` | on the menu: loops under the results (the Sega game's did); in a battle: once and rings out |
| `finale` | finale | `finale` | credits | loops |
| `credits` | credits | `credits` | menu | loops |
| `ingame` (battle, Sega mode) | ingame | every peace + battle track | the player's peace + battle files come before ours | shuffled, never twice running |
| `peace` / `battle` (adaptive) | peace / battle | as phase 2 | — | as phase 2 |
| `over` | — | — | — | silence |

### Decisions

- **The intro starts at once.** `prime()` (page load) makes the menu's context — suspended, and suspended again if
  the browser let it run — loads the worklet and queues the cue in it; the worklet takes commands while suspended
  (measured: the cue's `started` came back 0.5–1.5 s before the click). `intro()` inside the gesture resumes it.
  It resolves `true` when the context runs, the synth has the cue and nothing waits in front of it (or the media
  element plays); `false` at once with Sound off, volume 0, music volume 0, a hidden page or no Web Audio; `false`
  after 1.5 s in any other case. If the store has not answered when `intro()` is called, the game's cue goes ahead
  after 0.4 s and a late menu file is still queued behind it (the intro is never restarted by a late list).
- **The hand-over** is the mixer's queued `next` (to the sample) when both are synth items, else the end of one
  starts the other. When the intro's music is also the menu's (the Sega Opening auto-assigned to both slots) it is
  played once from the top with passes 0 and is the menu's music from the start: skip, `mood('menu')` and the end
  of the intro change nothing.
- **The Sega battle mode** plays the five Sega tunes (the player's `ingame` slot), else the player's peace and battle
  files, else all six of our FM peace and battle tracks; random order, never the same twice running; no peace/battle
  switching; a new tune on `reroll()` (the game menu closing — wiring below). The director still runs for the end.
  In the Sega mode the once-a-second threat look is skipped (it only drives the adaptive mode). Switching modes is
  live; a tune that belongs to both moods carries on.
- **The player's peace/battle files before ours in the Sega mode** (not in the brief's letter): a phase-2 player with
  MP3 playlists keeps hearing them now that 'sega' is the default.
- **VGM loudness:** the rip through `vgm-deck.js` at its native scale measured −34 to −37 dB RMS (peaks 0.05–0.15)
  against our FM tracks' −19 to −21 dB; one `VGM_GAIN` of 5 (+14 dB) for every track brings them to −20 to −23 dB,
  peaks ≤ 0.74 (under the ceiling's 0.8 knee), and keeps the original's balance between tracks.
- **The VGM player is loaded lazily** into the worklet (a blob module importing `vgm-deck.js`), so the FM-only
  worklet stays small and loads fast for the intro, and this branch works before the vgm stream's files exist.
  A missing player only turns each VGM into an `error` → the conductor leaves that file out and moves on (to the
  next file or the FM). The same for a file that will not read or breaks while playing.
- **Warm-up:** the first VGM registered while nothing plays runs a throwaway deck for 64 blocks. In Node the real
  deck's first block went from 24 ms (cold) to 12 ms; in Chrome the primed hand-over intro was heard 131 ms after
  the click instead of 195 ms.
- **Starport** (the Sega tutorial's loop) is imported but plays nowhere until the player picks a slot; the two German
  tracks are left out with a note (English only).
- **Music Test:** one context of its own per page (created by the Play click), the Options volume, the music volume
  (0.5 when the music is off, so a track can be heard), loops a track with a loop point; the menu's (or battle's)
  conductor holds while it plays (`user-files audition()` → `auditionChanged`). It stops on Stop, Remove, Back, or
  when the page is gone (checked twice a second while playing).

## How to test

- Unit: `node --test tests/music-play.test.mjs tests/music-intro.test.mjs tests/music-moods.test.mjs
  tests/music-sega.test.mjs tests/music-vgm.test.mjs tests/music-slots.test.mjs tests/music-page.test.mjs
  tests/original-files.test.mjs` (stand-ins in `tests/music-fakes.mjs`: a window with Web Audio and timers on a
  clock, a `VgmDeck` with the contract's shape, a VGM reader for made-up 'Vgm ' + JSON files).
- In Chrome (what was run, on the real GPU, default autoplay policy, real clicks): a scratch copy of this branch with
  the vgm stream's `src/formats/vgm.js`, `src/audio/music/vgm-deck.js` and `chips/` copied in, and a scratch
  `menu-intro.js` calling `music.prime()` at load and `music.intro()` on the first pointerdown. Then: the Original
  Game Files page, `DOM.setFileInputFiles` with the player's `dune_emu.zip`, the Music Test, a skirmish.
- `__dune.music` (menu and battle): `mood`, `playing`, `track`, `source` ('fm'|'vgm'|'file'), `from` (the role whose
  music plays), `queued`, `held`, `synth`, `load`, `context`, `meter()`; on the menu also `primed` and `introDelay`;
  in a battle `mode`.

## Measurements (Chrome headless on the GPU, this laptop's i7-1255U)

| What | Result |
|---|---|
| Intro, game's FM cue, primed | heard 71–78 ms after the click (`intro()` true at 69–78 ms) |
| Intro, not primed (context made by the click) | 1.1–1.2 s |
| Intro, the player's Sega Opening (VGM), primed | 131–149 ms (first blocks of the VGM player; see open questions) |
| Intro → menu hand-over | Ordos Dirge as the intro (18 s), the Opening as the menu: after it, `mood` 'menu', `track` the Opening, gapless (queued to the sample) |
| Import of the whole rip (zip, 22 files, 18 MB) | 20 tracks kept, each in its research §9 slots, 2 German left out; the menu switched to the Opening at once: `synth` 'worklet', `source` 'vgm', meter −37 dB after the gain (−50 dB before) |
| Music Test | Play on Harkonnen Rules: the menu's music `held`, meter −120 dB; Stop: back, −47 dB; no console errors |
| Skirmish, Sega mode, rip imported | `mood` 'ingame', Spice Trip playing, Command Post queued, `source` 'vgm', meter −27 dB |
| Audio thread (worklet's own clock) | FM title ~2–6 % (phase 2); a VGM 7–16 % (the vgm stream's chips) |

## Open questions / for other streams

- **vgm:** `VgmDeck`'s first render takes 12–24 ms (Node; budget 2.7 ms per block), which delays a VGM intro and
  can click at a track's start; its constructor runs while the context is suspended at prime, so moving that work
  into the constructor would make a primed VGM start as clean as the FM one. VGM playback costs 7–16 % of the audio
  thread here. If its output scale changes, `VGM_GAIN` (mixer.js) must be measured again.
- **intro:** call `music.prime?.()` at the start of `runIntro` and `music.intro?.()` inside the gesture that starts
  the intro; `music.skipIntro?.()` when it is skipped. Expect a console warning from Chrome at prime ("The
  AudioContext was not allowed to start"): the context is made before any gesture on purpose.
- **missions** (`src/game/game-view.js`): in `setMenuOpen(open)`, `if (!open) this.music.reroll?.();`.
- **campaign:** `music.mood('houseSelect' | 'briefing:<house>' | 'region' | 'victory:<house>' | 'defeat:<house>' |
  'finale' | 'credits' | 'menu')` per screen.
- Firefox and Safari were not tried: a blob module through `audioWorklet.addModule`, a context made before a gesture.

## For the README

Replace the two paragraphs "Music comes from an FM synthesizer…" and "Original game files (optional)…" with:

> Music comes from an FM synthesizer in the Mega Drive manner (four-operator voices, noise drums) playing newly
> written tracks in the game's style. In a battle the Sega game's way is the default: the in-game tunes play one
> after another in random order, never the same twice running, and a new one starts when you close the game menu;
> Options → Battle music → Adaptive switches to peace tracks that give way to battle tracks when fighting starts
> near your forces. Each house has its own briefing, victory and defeat music. Options → Music sets the volume
> (0 turns it off). `?scene=menu&music=<track>` plays one track; `node src/audio/music/render-wav.mjs <ids|all>
> <seconds|full> <dir>` renders tracks to WAV files.
>
> Original game files (optional): Main menu or Options → Original Game Files lets you pick the `.PAK` files from your
> own Dune II PC copy (the original announcer, unit replies and sound effects replace the generated ones) and the
> Mega Drive game's soundtrack from your own copy as VGM files (`.vgm`, `.vgz` or the `.zip` they came in), or MP3,
> OGG or WAV tracks. Each Sega track plays where the Sega game played it — the Opening under the intro and the
> title, the Mentats' themes at the briefings, the five in-game tunes in every mission, a victory theme and a dirge
> per house — and the Music Test on that page plays any of them and lets you choose where each one plays. Your
> files are read in your browser only and kept in its storage: nothing is uploaded or committed.
