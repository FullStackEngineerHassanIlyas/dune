# Phase 3 art round — one shared, deep announcer (stream "announcer")

Branch `phase3/art-announcer` (from `578beeb`). The manager: "do not make the voice lighter; in the
original every house had the same voice, and a heavy one — confirm it."

## What the originals did (confirmed, with sources)

| release | announcer | source |
|---|---|---|
| PC, 1992 (*Dune II: The Building of a Dynasty*) | **three**, one per house: the contextual lines load a different file per house (`A…`/`H…`/`O…` prefixes, e.g. `AENEMY.VOC` / `HENEMY.VOC` / `OENEMY.VOC`, from `ATRE.PAK`, `HARK.PAK`, `ORDOS.PAK`); the unit replies (`Z…`) are shared | OpenDUNE `src/table/sound.c` (via `docs/research/raw/audio-ui-controls.md` §A.1); [Sega-16 review](https://www.sega-16.com/2005/08/dune-the-battle-for-arrakis/): "The PC version had three announcer voices depending on your house" |
| Mega Drive / Genesis, 1994 (*Dune: The Battle for Arrakis*) | **one** for every house, male, fewer lines | Sega-16, same review: "but this Genesis cart only has one (and he doesn't talk as much.) … the voices that were kept in sound great"; research.md §7 "one shared announcer, fewer samples" |
| who spoke it | Genesis credits: "Voices Frank Klepacki (house voices), Glenn Sperry (units)"; Klepacki's own credits list for *Dune II* (PC and Sega Genesis / Mega Drive): "Voices of House Harkonnen & Emperor" | research.md §6 (the cartridge's credits); [frankklepacki.com/credits](https://www.frankklepacki.com/credits); IMDb lists him as "House Voices" ([imdb.com/title/tt0183020/characters/nm0459295](https://www.imdb.com/title/tt0183020/characters/nm0459295)); the PC cast also had Donna J. Bundy, Eric Shults, Glenn Sperry and Julie Stainer (IMDb full credits, roles not stated) |

**Finding.** The manager is right for the game we remaster: on the Mega Drive every house hears the same
male announcer, and the man credited for it is Frank Klepacki, the PC game's Harkonnen voice. On the PC
each house had its own announcer, so "the same voice for every house" is the Sega release, not the PC.
"Heavy" is not written anywhere I could reach: it follows from the Harkonnen connection and from the
manager's own memory (no source describes the Genesis voice's timbre; Sega Retro and MobyGames refused
automated fetches). Nothing found contradicts the manager, so the shared voice is the default.

## What changed

- **A shared announcer set** `announcer` (`assets/voice/announcer/*.ogg`, 63 files: the 62 announcements
  and "Reinforcements have arrived."), rendered with Kokoro by `scripts/voices/generate.py --sets announcer`;
  the manifest names it `"shared": "announcer"`. Every other file under `assets/voice/` is byte-identical.
- **Options → Announcer**: "One voice (original)" (the default, `announcer: 'one'`) / "Each house"
  (`'house'`, the three house announcers as before). Saved like every option; `?announcer=house` in the
  URL overrides it. The row sits right above Voices.
- `src/audio/voice.js`: `announcerSet(manifest, house, mode)` picks the set (shared ↔ the house's own,
  each falling back to the other, then to Atreides'); `WebVoiceOutput` takes `{ announcer }` (default: the
  saved option, `savedAnnouncer()`), and `setAnnouncer(mode)` switches mid-battle, letting go of lines
  decoded in the old voice. With the player's original PC files on, the original clips still win (each
  house's own, as the PC game had them); a line they cannot make keeps the voice the option chose.
- `src/game/announcer.js`: the debug status (`__dune.voice()`) also reports the option (`announcer`) and
  the set the lines come from (`set`).

## The voice (chosen by measurement and a Whisper check; nobody has listened yet)

Shipped: blend **0.7 `am_fenrir` + 0.3 `am_onyx`**, Kokoro speed 1.0, played at 88 % like a slowed tape,
then a clean chain: high-pass 75 Hz, −3 dB at 300 Hz (mud), +5 dB at 2.6 kHz and +2.5 dB at 4.5 kHz
(presence, so the deep voice stays clear), compression 3.5:1, the short console room the house sets use;
**no clipper** (the Harkonnen set's grit is that house's character, not the original's). `am_fenrir` is
the Harkonnen set's voice, a fitting root for a voice the Mega Drive gave to the PC's Harkonnen actor.

Twelve probe lines per candidate (construction complete, unit ready, insufficient funds, base attack,
Harkonnen approaching, Sardaukar structure destroyed, wormsign, mission accomplished, reinforcements,
radar, frigate, cannot build there). Pitch = median F0 of voiced frames (autocorrelation); bands = share
of energy (chest 60–250 Hz, body 250 Hz–1 kHz, presence 1–4 kHz, air/grit 4–12 kHz). Whisper `small.en`:
every candidate heard every probe word for word except three spellings it cannot know ("Harkening",
"Sardicar", "worm sign").

| candidate | F0 median | chest / body / presence / air | mean length | verdict |
|---|---|---|---|---|
| Harkonnen set (shipped, for comparison) | 143 Hz | 27.9 / 47.4 / 20.6 / 3.8 % | 1.45 s | the floor: nothing lighter |
| A `am_fenrir` ×0.96, tape 0.88, first clean chain | 142 Hz | 39.0 / 42.4 / 15.6 / 3.0 % | 1.48 s | same pitch as Harkonnen: no heavier |
| B `am_fenrir`, tape 0.85 | 137 Hz | — | 1.50 s | barely deeper |
| C 0.7 fenrir + 0.3 onyx ×0.96, tape 0.88 | 119 Hz | — | 1.62 s | deep, a little slow |
| C2 same at ×1.0 | 122 Hz | 41.5 / 44.4 / 11.8 / 2.3 % | 1.57 s | deep but dull: presence half Harkonnen's |
| **C3 = C2 + presence chain (shipped)** | **124 Hz** | **32.3 / 46.7 / 17.8 / 3.1 %** | **1.57 s** | heavier chest than Harkonnen, clear, no grit |
| C4 = C2 + more presence | 125 Hz | 27.7 / 46.1 / 22.7 / 3.5 % | 1.57 s | as bright as Harkonnen: loses the weight |
| D `am_onyx`, tape 0.9 | 83 Hz | — | 2.14 s | rumbling, muffled (centroid 367 Hz), too slow for battle news |
| E 0.6 fenrir + 0.4 michael, tape 0.88 | 127 Hz | — | 1.57 s | fine, less authority than C |
| F `am_michael`, tape 0.86 | 107 Hz | — | 1.80 s | slow; peaks −0.5 dBFS |
| G 0.75 fenrir + 0.25 onyx, tape 0.86 | 121 Hz | — | 1.58 s | same as C2 |

### The shipped set, all 63 lines (measured on the files in `assets/voice/announcer/`)

- **Deeper than the Harkonnen set, not lighter**: median pitch 131 Hz against 151 Hz over all 63 lines
  (−2.4 semitones; p10 92 / 106 Hz); chest band 31.2 % against 25.9 %; air/grit band 3.3 % against 4.2 %
  (clean); presence 17.2 % against 19.8 % (the Harkonnen set's includes its clipper's overtones).
- **Loudness**: −16.8 to −15.2 LUFS integrated (target −16, like every set); true peak −3.0 to −1.6 dBFS.
- **Length**: 0.79–2.34 s, mean 1.49 s (Harkonnen 1.38 s); speech starts 0.06–0.11 s in; the last 120 ms
  sit 19–32 dB under the loudest part (no stray syllable or breath).
- **Size**: 404,742 bytes for the 63 files (3.4–10.7 kB each); `assets/voice/` in all 2,111,157 bytes
  (380 lines and the manifest), under the 2.5 MB budget in `tests/voice.test.mjs`.
- **Whisper round trip**: 50 of 63 exactly. Of the other 13, ten are names Whisper cannot spell
  ("A trade ease", "Harkening", "Harken and", "Ordo's", "Sardicar"/"Sardikar", "worm sign"); two it hears
  the same way in the shipped Harkonnen set ("forget fully loaded", "orthostructure destroyed" — checked
  on those files); one is a near miss, "Upgrading." heard "Upgradings" (its tail decays smoothly, −42 dB
  at the end: the room's echo, not a sound after the word).
- **Determinism and the other files**: the shipped files are byte-identical to the C3 probes rendered
  earlier; a checksum of every older file under `assets/voice/` before and after: all 317 identical, only
  `manifest.json` changed, and in it only `"shared"` and the new set (the 14 older sets compare equal).
- **Browser, real GPU** (dune-shot, Linux Chrome): `?scene=battle&idle=1` → `__dune.voiceCheck()` 191
  lines, 191 decoded at 48 kHz, none missing, 0.67–2.34 s, `__dune.voice()` `announcer: 'one'`, `set:
  'announcer'`; `?scene=mission&house=ordos&mission=1&announcer=house` → 191 decoded, `set: 'ordos'`;
  no console errors. Options: clicking "Each house" saves `announcer: 'house'` and swaps the note.

## Design guidance used (ui-ux-pro-max)

This stream's only interface is one Options row. Searched `--domain ux` ("segmented control option labels",
"helper text setting description"): visible label beside the control (the row's "Announcer"), an accessible
name for the button group (`role=group`, `aria-label`, `aria-pressed` per choice, as every row has), helper
text under it that changes with the choice, and labels that reflow instead of clipping. The row reuses the
Options page's own segmented control, so it matches every other row; no new styles.

Screenshots (scratch, not committed): `shots/art-announcer-options-1366.png` (1366×768, the row
above Voices: "One voice (original)" pressed, its note under it), `shots/art-announcer-options-house-1920.png` (1920×1080, "Each house" chosen and its note). Before: no such row.

## How to test

- `node --test tests/announcer-shared.test.mjs tests/voice.test.mjs tests/options-settings.test.mjs tests/announcer.test.mjs tests/original-sounds.test.mjs`
- Browser: `?scene=battle&idle=1` then `await __dune.voiceCheck()`; the house's lines come from
  `announcer/…` by default, from `<house>/…` with `&announcer=house`.
- Listening: the audition page in the session scratchpad (`art-announcer/audition.html`, outside the repo)
  has the Harkonnen set, every candidate and the shipped set side by side.
- Reproduce the set: `generate.py --models <dir> --sets announcer` (see its header); the other sets'
  files are not touched, and the manifest only gains `"shared"` and the new set.

## Integration notes

- `src/game/game-view.js` (not this stream's): pass the option and follow it live —
  `new WebVoiceOutput(this.sound, house, { announcer: settings.announcer })` and in `applySetting`
  `else if (key === 'announcer') this.announcer.player.output.setAnnouncer(value);`. Without it the battle
  still uses the saved option (read at its start), and a change in the in-game menu applies from the next battle.

## For the README

In "Announcer voices", replace the first sentence ("Like the original, each Great House has its own
announcer — Atreides calm and clear, Harkonnen deep and harsh, Ordos cool and precise — and the player's
house decides which one speaks:") with:

> As on the Mega Drive, one deep announcer speaks for every house; Options → Announcer → "Each house"
> gives each Great House its own instead, as the PC game did — Atreides calm and clear, Harkonnen deep
> and harsh, Ordos cool and precise (`announcer=house` in the URL). The announcer says:

In the files paragraph: "317 short Ogg Opus lines (about 1.7 MB)" → "380 short Ogg Opus lines (about
2.1 MB)", and the voice list starts "voices a blend of `am_fenrir` and `am_onyx` slowed like a tape
(the shared announcer), `af_heart` (Atreides), …".
