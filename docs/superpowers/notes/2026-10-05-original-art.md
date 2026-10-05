# The original game's pictures, from the player's own files

Branch `phase3/original-art` (from `de586bd`, the Mentats' voice, with `763e1ab`, the face engine, merged in).
The manager (Roman Urdu, translated) on our painted Mentats: "The face art is still very ugly. Better to use the
original game's low-quality pictures; they are still much better." The repository is public, so no Westwood/EA
picture is committed or shipped: as the sounds already do (notes `2026-10-03-phase2-original-files.md`), the
pictures are read in the browser from the player's own Dune II PC .PAK files and kept there.

## What it does

- **Options → Original Game Files**: the .PAK files the player picks (or, on a local server, the copy in the
  git-ignored `original/` or `original/dune2/`) now also give their pictures. The page lists them ("Pictures: Mentat
  portraits: 3 (Atreides, Harkonnen, Ordos), house emblems: 3, from DUNE.PAK, ENGLISH.PAK"), has an **Original
  pictures** On/Off switch beside Original sounds (On when pictures are found), and "Forget the game files" forgets
  clips and pictures (the music stays). A file's report line says how many picture files it gave and what was wrong
  with a damaged one.
- **The briefing's Mentat** (every Mentat stage: house pages, join, briefing, advice, win and lose lines, ending):
  with the switch on, Cyril, Radnor and Ammon as the PC game drew them — his room cut to where he sits, enlarged by
  whole pixels and drawn without smoothing (`image-rendering: pixelated`; the PNGs are also enlarged 4x so a browser
  that smooths still stays sharp). As the original moved him (OpenDUNE `gui/mentat.c`, `GUI_Mentat_Animation`):
  - silent, his eyes look ahead, left, right and down and shut on the original's own rules and timings (a seeded
    90-second cycle of the eye frames as a CSS animation; shutting passes "down" for a tick, side to side passes
    ahead), Cyril's book and Ammon's ring move through their frames and back on the original's timings;
  - speaking, his mouth follows our voice: a face-engine rig (format v1) whose mouth sprites are the original's five
    mouth frames, each of the voice's seven shapes on the frame that fits (below), and whose lids are his original
    shut eyes, so he blinks with them; nothing tilts, nods, warps or scales (pixel art does not bend). Reduced
    motion: the mouth alone moves. Mentat voice off: the still picture with the silent eye animation.
- **The house selection**: each house's piece of the original house selection screen (banner, chains and name
  plate; the screen's black around it see-through), in place of our crest; the card's own name plate steps aside while
  it shows, as the piece names the house.
- Without the files, or with the switch off, every screen keeps this game's own art. Switching, reading new files or
  forgetting them applies from the next screen drawn.

## Files

| File | What it is |
|---|---|
| `src/formats/picture-error.js` | `PictureError` (names the file and the byte), `bytesOf` |
| `src/formats/pal.js` | `.PAL` (768 bytes of 6-bit VGA colours, widened `v << 2 \| v >> 4`), `toRgba` |
| `src/formats/format80.js` | Format80/LCW unpacking (all six commands, overlapping repeats, stops at the end mark or when full) |
| `src/formats/format40.js` | Format40 XOR deltas (short and long skips, XOR strings, XOR runs) |
| `src/formats/cps.js` | CPS screens (packing 0 or 4, optional palette) |
| `src/formats/shp.js` | Dune II shapes, 1.07 (32-bit offsets from byte 2) and 1.0 (16-bit), packed or plain, 16-colour tables, see-through runs |
| `src/formats/wsa.js` | WSA animations, 1.07 (flags, palette) and 1.0, looping; refuses one that continues another animation |
| `src/formats/png.js` | PNG writer (palette PNG up to 256 colours, else RGBA; deflated by `CompressionStream`, else stored; enlargement while writing) |
| `src/formats/dune2-pictures.js` | which files hold what and where: `MENTATS`, `MENTAT_SHAPES`, `HERALD`, `PICTURE_FILES`, `extractPictures`, `summarizePictures` |
| `src/core/user-files.js` | the `pictures` store (database version 2), import, switch, forget, `importLocalPaks` |
| `src/ui/original-files.js` | the page: Pictures line, Original pictures switch, report lines |
| `src/ui/campaign/original-mentat-art.js` | pure: figure crop, eye and book schedules, mouth measure and viseme map, figure markup, rig, emblem markup |
| `src/ui/campaign/original-pictures.js` | `loadOriginalPictures()` (made once a session, again when the store changes), `currentPictures()`, `originalEmblem(house)` |
| `src/ui/campaign/original-mentat.js` | `originalMentatFigure(house)`, `originalMentatRig(house)` for `mentatStage` |

The decoders are written from the published format descriptions (ModdingWiki: Westwood LCW, XOR Delta, CPS, Dune II
SHP, WSA); OpenDUNE was read for which file holds what and where it is drawn (`sprites.c` Sprites_Init: MENSHPH/A/O
are shapes 387-431, 15 a house; `gui/mentat.c`: `s_mentatSpritePositions`, the shapes' order, the animation rules;
`gui.c` GUI_PickHouse: the herald's boxes; IBM.PAL is the screens' palette, BENE.PAL the Bene Gesserit's). No code
was copied.

## Which picture is where (the PC files, as read)

- `MENTATA.CPS`, `MENTATH.CPS`, `MENTATO.CPS` (DUNE.PAK): each house's room with its Mentat, 320 x 200, through
  IBM.PAL. The screen beside him (x 128..312, y 48..160) is black: the original plays a WSA there.
- `MENSHPA/H/O.SHP` (DUNE.PAK, 1.07 format), 15 shapes each, drawn at `s_mentatSpritePositions`: 0-4 eyes (ahead,
  left, right, down, shut), 5-9 mouth (shut, then four open), 10 the right shoulder (in front of the screen), 11-14
  the "other". As found: Cyril eyes 48x16 at (40,80), mouth 48x40 at (40,96), shoulder 24x32 at (128,128), book
  96x48 x2 at (72,152) plus two 1x1 fillers; Radnor eyes 48x24 at (32,88), mouth 56x40 at (32,104), shoulder 16x56
  at (128,104), four 1x1 fillers (no "other"); Ammon eyes 56x16 at (16,80), mouth 64x40 at (16,96), shoulder 24x32,
  ring 16x16 x4 at (88,144). A 1x1 filler leaves the frame before on the screen, so the book shows its second frame
  through them (`otherSchedule`).
- The figure is cut from the left edge to his shoulder or book, 4 wide by 5 high where the room allows: Cyril 168 x
  200 (his book reaches x 168), Radnor 144 x 180 from y 20, Ammon 152 x 190 from y 10. The edge of the black screen
  beside him stays in the picture, next to our map, where the original had its screen.
- The mouth frames for the voice's shapes (`mouthVisemes`): each open frame's opening is measured — the pixels darker
  than the shut mouth's at the same place, their count and box — and A takes the most open, F V the least, then O the
  roundest, E the widest for its height and L the one nearest halfway, each from the frames not yet taken; rest and
  M B P are the shut mouth. On the real files: Cyril FV 4 (teeth together), A 1, E 2, O 3, L 3; Radnor FV 4, A 2,
  E 1, O 3, L 1; Ammon FV 2, A 3, E 1, O 1, L 1 (his fifth frame opens no darker than the shut one, so it is not
  used).
- `HERALD.ENG` (ENGLISH.PAK; `HERALD.CPS` in 1.0): the house selection; the pieces in 96 x 104 boxes at x 16
  (Atreides), 112 (Ordos), 208 (Harkonnen), y 56; banner, chains and plate fill the top 89 rows.

Offered by the PC files and not used (no clear fit with our screens): `FARTR/FHARK/FORDOS.WSA` (MENTAT.PAK, the
emblem beside the house's turning home world: the original's "join?" screen, where ours shows the map), the Bene
Gesserit `MENTATM.CPS`/`MENSHPM.SHP`, `PLANET.CPS`, `DUNEMAP.CPS`, `DUNERGN.CPS`, `MAPMACH.CPS`, `RGNCLK.CPS` (the
PC's map screen; ours is the 3D atlas), `FAME.CPS` (the PC's gold score screen with its stat bands fixed in the
picture; ours lays out its own bars over Sega-style line art), `WIN1/WIN2/LOSTBILD/LOSTVEHC.WSA` (the Mentat's
screen after a mission), `TITLE.ENG`, `CHOAM.CPS`, the intro and finale WSAs, the units' and buildings' WSAs of
MENTAT.PAK. The readers take all of them (below); only the table in `dune2-pictures.js` would grow.

## Storage

IndexedDB `dune2-3d.user-files` version 2 adds the store `pictures` (key `name`): `mentat:<house>` { kind, house,
mentat, width, height, rgba (320 x 200 x 4), parts: { eyes[5], mouth[5], shoulder, other[4] } each { x, y, width,
height, rgba } }, and `emblem:<house>` { width, height, rgba }. Pictures are kept as ImageBitmap-ready RGBA; the
campaign makes PNG data: URLs from them once a session. Meta keys: `usePictures` (the switch), `pictureSources`,
`pictureFiles` (the raw picture files read so far, so pictures whose files come from different archives read at
different times are made once all are there), `localPaks` (the stamp of the local copy). A version-1 database opens
with its clips; the memory fallback (no site data) keeps pictures too. A browser too full to keep them says so on
the file's line, and nothing half-kept is switched on.

`importLocalPaks()`: a server lists no folder, so each PC archive name (DUNE, ENGLISH, ATRE, HARK, ORDOS, MENTAT,
VOC, SOUND, INTRO, INTROVOC, FINALE, MERC, HERC, XTRE, SCENARIO) is asked for with HEAD in `original/` and
`original/dune2/`, upper and lower case (the dev server answers 204 for a missing file there); found files are read
only when their size or date changed. It imports sounds and pictures alike, as the page does.

## Real check

The manager's files arrived during this stream: 13 archives in `/home/hassan/games/Dune/original/dune2/` (and the
same in `Dune-p3/original/dune2/`), English 1.07. They were read through a symlink in this worktree's git-ignored
`original/` and never committed.

- Every picture file in them decodes: 118 of 124 (CPS, SHP, PAL, the .ENG pictures, WSA); the 6 refused are WSAs
  that continue another animation (HFINALC, OFINALB, OFINALC, INTRO7B, INTRO8B, INTRO8C: "it carries on from another
  animation (no first frame)"), which nothing here needs. FARTR.WSA (30 frames, looping) and HARVEST.WSA decode to
  the right pictures frame after frame (contact sheets in the scratchpad).
- Real GPU (headless Chrome, `dune-shot`, the hook applied locally and reverted): the local import read the 13
  archives in 0.9 s (223 clips, 6 pictures, no errors); briefings for all three houses
  (`?scene=menu&intro=0&screen=campaign-briefing&house=<house>&mission=<n>`) show the original Mentat, crisp; while
  he speaks the face engine shows the original mouth frames (Radnor over 2 s: E, A and L frames, his shut eyes for a
  blink, the silent eye animation hidden meanwhile); voice off: no face, the eyes look about (left, down, shut) and
  Cyril's book moves; the switch Off gives the painting at the next screen and On the original again; Forget (two
  clicks) leaves "Nothing yet." and the switch disabled; the house selection shows the three herald pieces; the
  defeat stage and a 390 x 844 phone layout look right; no console errors anywhere. The briefing ran at 16.7 ms a
  frame (p95 16.8) while he spoke. Making the pictures takes about 0.2 s once a session (in parallel with the words).
- Screenshots (session scratchpad `shots/`): `orig-briefing-atreides.png`, `orig-briefing-harkonnen-{1,2,3}.png`,
  `orig-harkonnen-faces.png` (face crops: a blink with his own shut eyes, mouth frames), `orig-briefing-ordos-{1..4}.png`,
  `orig-ordos-faces.png`, `orig-house-select.png`, `orig-files-page.png`, `orig-voice-off.png`, `orig-defeat-ordos.png`,
  `orig-narrow.png`, `orig-scale1-face.png` (a 1x PNG stays sharp: Chrome honours `pixelated` on SVG images).
- Not checked on the GPU: prefers-reduced-motion (the markup's rule is tested), the menu's own auto-import (it is
  skipped in automated runs; `importLocalPaks()` was called directly).

## Hook for the lead

Three files; tests pass with it (campaign-screens, campaign-stage, campaign-flow, menu, menu-entries, mentat-face,
phase3-seams, campaign-map, imports: 86/86).

`src/ui/campaign/stage.js`:

```js
import { attachMentatFace } from './mentat-face.js';                       // (there once the face-art step lands)
import { originalMentatFigure, originalMentatRig } from './original-mentat.js';

// in mentatStage(), in place of `portrait.innerHTML = mentatSvg(house);`
const figure = originalMentatFigure(house);
portrait.innerHTML = figure ?? mentatSvg(house);

// before `return stage;` — the rig goes with the figure (the original's rig is drawn in its frame, not the painting's)
stage.face = voice ? attachMentatFace(stage, figure ? originalMentatRig(house) : MENTAT_RIGS[house]) : null;
// without the face-art step's MENTAT_RIGS yet: stage.face = voice && figure ? attachMentatFace(stage, originalMentatRig(house)) : null;
```

`src/ui/campaign/index.js` (the pictures are made while the words load, so the first screen already has them; and
the house page's crests):

```js
import { loadOriginalPictures, originalEmblem } from './original-pictures.js';

// ensureWords():
this.wordsLoading = Promise.all([loadWords(this.load), loadOriginalPictures().catch(() => null)]).then(([w]) => {

// houses():
art.innerHTML = originalEmblem(id) ?? crestSvg(id);
```

`src/scenes/menu.js` (the local copy, beside the local soundtrack):

```js
import('../core/user-files.js').then((m) => Promise.all([
  m.importLocalMusic().catch((err) => console.warn('local music:', err)),
  m.importLocalPaks().catch((err) => console.warn('local game files:', err)),
])).catch((err) => console.warn('local files:', err));
```

Optional, `src/ui/main-menu.js` line 17: the entry's note "Voices and music from your own Dune II" could say
"Voices, Mentats and music from your own Dune II".

A test for the hook, as `tests/original-pictures.test.mjs` "the briefing (mentatStage with the lead's hook)" does
by hand: `loadOriginalPictures({ files: fakeStore })` with pictures from `fakeDunePak()` (tests/original-art-fakes.mjs),
then `mentatStage(house, { voice })` puts `cpo-<house>` markup in `stage.portrait.innerHTML` and `stage.face` is set;
with `resetOriginalPictures()` it is the painting again.

## Integration notes

- The switch lives in the store (`usePictures`), as "Original sounds" does; `settings.js` and `options.js` are
  unchanged.
- `user-files.js` `notify('pictures')` calls followers' `picturesChanged()`; the sounds' followers are not woken by
  pictures, nor the campaign's by clips.
- The face-art step's painted rigs and this rig never meet: `originalMentatRig(house)` is null unless the original
  figure is there. The rig validates (`validateRig`) and uses only the mouth, the lids and the motion; its
  expressions are all empty (the original had none).
- "Forget the game files" keeps the local copy's stamp, so a copy still in `original/` is not read again until it
  changes.
- Our own `.cpm-*` rules from `portraits.js` are global once a painting is on the page; the figure's own `<style>`
  turns them off for itself (`.cpo .cpm-sway, .cpo .cpm-blink`).

## How to test

`node --test tests/formats-pictures.test.mjs tests/original-pictures.test.mjs tests/original-files.test.mjs` —
the readers (round trips through writers of our own in `tests/original-art-fakes.mjs`, every command used, every
damage case naming file and byte, fuzzing), the PNG writer read back with zlib, what is made from which file, the
store (import, switch, forget, archives read at different times, a damaged file, a full browser, the version-1
database, memory), the local import (once, again when changed, both cases of a name read once), the eye and book
schedules by the original's rules, the mouth map, the figure and its rig (`validateRig`), the campaign's loader
following the switch, the briefing with the hook and the face engine on the original figure (a fake SVG DOM and a
voice holding an A: the A sprite is the original's most open frame). No original data is in the repository.

## For the README

In "Original game files", after the sounds:

> Your own copy's pictures too: with "Original pictures" on, the campaign's Mentats are the ones the PC game drew —
> Cyril, Radnor and Ammon in their rooms, sharp pixel art at any size — their eyes glancing about and blinking as in
> 1992, their mouths moving with the Mentat's voice frame by frame, and the house selection shows the original
> house banners. Like the sounds, the pictures are read in your browser from your .PAK files and never uploaded.
