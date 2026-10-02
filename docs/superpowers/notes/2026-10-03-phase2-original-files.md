# Phase 2 — the player's original game files

Branch `phase2/original-files` (from `improve/visibility`'s tip `5719049`). Spec §6 "Original files
(optional)"; research `docs/research/raw/audio-ui-controls.md` §A.1 (VOC list, house voice sets, word
clips strung into sentences) and §A.3 (PAK and VOC layouts).

## What it does

- **Options → Original Game Files** (`src/ui/original-files.js`, `originalFilesPanel(settings, { onBack })`,
  contract 3): the player picks the `.PAK` files of their own Dune II PC copy (several at once; loose
  `.VOC` files work too). The page lists what each file gave (clips, damaged clips skipped, "no sound
  clips in it", "not a .PAK or .VOC file"), what was found (announcer lines per house, unit replies,
  effects, clip count and source files), an On/Off switch "Original sounds", and "Forget the game
  files" (asks for a second click). Below it, **Your music**: MP3/OGG/WAV tracks for the Menu, Peace and
  Battle playlists, with add, list (name, size) and remove. The page says nothing is uploaded and none
  of it becomes part of the game; where the browser keeps no site data it says the files last only
  until the page closes.
- **Parsers** (`src/formats/pak.js`, `src/formats/voc.js`): the version-2 PAK index (uint32 offset +
  NUL-terminated name, ended by a zero offset; sizes from the next offset or the end of the file) and
  Creative Voice files (header check, block types 1/2/3 as Dune II uses them, 8 and 9 as later tools
  write them, markers/text/repeats skipped; time constants 0xA5/0xA6 → 11025 Hz and 0xD2/0xD3 →
  22050 Hz exactly, as Dune Legacy reads them). Damaged input throws `PakError`/`VocError` naming the file
  and what is wrong at which byte; a wrong VOC checksum alone is a warning. Fuzzed in the tests.
- **Storage** (`src/core/user-files.js`): IndexedDB `dune2-3d.user-files` with stores `clips` (decoded
  8-bit PCM and rate per clip, keyed by name), `tracks` (playlist entries, the music kept as a Blob so
  listing never reads it) and `meta` (the switch, the source files). Without IndexedDB (blocked site data,
  private modes that refuse it) the same API runs on maps kept on the top window, so the battle's frame
  sees what the menu read. Importing switches the original sounds on. `playlistTracks(name)` returns
  `[{ name, type, data: ArrayBuffer }]` for `'menu' | 'peace' | 'battle'` (contract 4). Tracks are
  recognised by their first bytes (ID3 or an MPEG frame sync, OggS, RIFF…WAVE), not by their names. A full
  browser is reported as "not enough storage space left in this browser". After a track is added the store
  asks `navigator.storage.persist()` (best effort).
- **Use** (`src/audio/voice.js`, `src/audio/engine.js`): both ask the store for the clips when they are
  made (a dynamic import, so nothing loads unless used) and *follow* it: switching the originals on or
  off, importing or forgetting applies at once, mid-battle included. Followers are held through
  `WeakRef`, so finished battles' engines are not kept alive.
  - The announcer builds each original line from the house's word clips back to back, as the original
    did (`Sound_Output_Feedback` → 5-slot queue): "Warning" + "Harkonnen" + "unit" + "approaching". House
    letters A/H/O (Fremen use O, Sardaukar H, Mercenary M); the replies are the shared Z set, also found
    without the Z (1.07 US data) and with F/G (French/German). A line whose words are not all there, and
    every line the original never spoke (building, on hold, insufficient funds, …), keeps the Kokoro
    voice. With the manifest unreachable, the originals alone still make the voice live.
  - The engine plays an original effect instead of the synthesized one where the files have it; the
    rest stays synthesized.
- **Mapping tables** (`src/formats/dune2-sounds.js`), after OpenDUNE's `g_table_voices`/`g_feedback` as
  the research decodes them:
  - Lines: Construction complete (CONST); "<own house> unit deployed" (`unitReady`) and "<own house>
    harvester deployed"; "<own house> unit/structure destroyed" for our losses; "<house|Enemy> unit/structure
    destroyed" for kills; "Warning, <house|Enemy> unit approaching" ("Warning, Sardaukar approaching");
    Radar on/off; "Warning, wormsign"; "Frigate has arrived"; "Missile launched"; base attacked = "Attack";
    WIN/LOSE. 32 lines.
  - The original has no "missile approaching": an enemy Death Hand is announced "Missile launched", as
    the original did. The base-attack line is the single spoken word "Attack" (the fuller wording was the
    banner), per research §A.1.
  - Replies: selection REPORT1/2/3 → reporting/standingBy/awaitingOrders; orders AFFIRM (affirmative,
    engaging, attacking), MOVEOUT (movingOut, onOurWay), OVEROUT (acknowledged).
  - Effects: GUN → rifle, GUNMULTI → mg, EXCANNON → cannon and heavyCannon, EXSAND → sandHit,
    EXSMALL/EXMED/EXLARGE → explosionSmall/Medium/Large (EXLARGE also Huge), EXGAS → gas, CRUMBLE →
    collapse, SQUISH2 → crush; read from their names only (?): ROCKET → rocket, MISLTINP → launchHeavy,
    BUTTON → click, STATICP → static. Not mapped (no sound of ours to replace): VSCREAM1–5, WORMET3P, EXDUD.

## Levels (measured)

Everything is measured with `synth.js`'s own meter (`loudness()`: loudest 400 ms, K-weighted) at 32 kHz.

- Kokoro lines (`assets/voice`, 195 files, decoded with ffmpeg): Atreides median -14.2 LUFS (-15.3…-13.2),
  Harkonnen -14.8 (-15.9…-13.7), Ordos -13.5 (-15.1…-12.5), unit replies -15.0; all -14.3. An original line is
  resampled to 32 kHz (linear: the clips are 8-bit 11 kHz, nothing to lose) and set to **-14.3** under the
  same soft ceiling (0.97) as the synth; gain is capped at +24 dB so a near-silent clip is not blown up.
- Synthesized effects (variation 0): rifle -20.2, mg -18.1, cannon -15.2, heavyCannon -14.2, rocket -15.0,
  sandHit -19.0, explosionSmall -14.1, Medium -13.1, Large -12.1, Huge -11.1, gas -19.0, collapse -15.0,
  crush -19.0, click -27.1, static -23.0, launchHeavy -13.0. Each original effect is set to the level of the
  sound it replaces (`EFFECT_CLIPS`); a test fails if synth.js drifts more than 3 dB from the table.
- In Chrome (real GPU, a skirmish, made-up clips imported mid-battle): the engine's overrides came out at
  cannon -15.2 / rifle -20.2 (synth cannon -15.2), the line "Atreides unit deployed" at -14.3 LUFS and
  0.952 s (three 0.317 s words), 41 original lines (32 announcer + 9 replies) next to the Kokoro ones, all
  71 lines decoded, no console errors; switching off cleared the overrides and the original lines at once.
- Cost: parsing is synchronous and linear; a full VOC.PAK-sized archive is a few MB. Lines are built
  on first use (a join, a resample and one loudness pass, ~ms); effects once per engine.

## How to test

- `node --test tests/original-files.test.mjs tests/original-sounds.test.mjs` — readers (round trips,
  every damage case, fuzzing), mapping completeness (every line is one of voice.js's, every reply covered,
  every effect a synth id at its measured level), storage on a fake IndexedDB (`tests/fake-indexeddb.mjs`:
  upgrade, key paths, auto-increment, commit/abort, quota), memory fallback, followers, playlists and
  contract 4's shape, the page's wording; the voice and engine override paths with fakes (lines strung
  from words, fallbacks per line and per house, live switching, stale answers, effects swapped and back).
  Every PAK and VOC is made up inside the tests.
- Real GPU: open the menu, then in the console
  `(await import('/src/ui/original-files.js')).originalFilesPanel(__dune.menu.settings, { onBack: () => __dune.menu.go('title') })`
  and put it in `.main-menu` (until the options stream's menu entry lands). Screenshots:
  `scratchpad/shots/original-files-panel-top.png`, `-panel-bottom.png`, `-panel-narrow.png` (made-up
  PAKs fed through the real file input with a DataTransfer), `-battle.png` (the measurement above).

## Open questions

- The meaning of ROCKET, MISLTINP, BUTTON and STATICP is read from their names; a player with the files
  can confirm by ear (a wrong guess only swaps one effect, and only for that player).
- The original's spoken base-attack line is per the research a single "Attack"; if it was in fact
  "Warning … attack", add WARNING in front in `LINE_WORDS.baseAttack`.
- Non-English data: the house sets of the French and German versions are not documented here; their
  shared clips (F/G) are read, their announcers fall back to Kokoro unless they use the A/H/O letters.
- Music from the original files (ADL/XMI in SOUND.PAK) is not played: it needs an OPL or MIDI synth;
  the playlists take the player's own MP3/OGG/WAV instead, as the spec says.
