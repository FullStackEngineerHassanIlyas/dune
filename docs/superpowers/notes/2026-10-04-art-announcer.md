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
  saved option, `savedAnnouncer()`), and `setAnnouncer(mode)` switches mid-battle, letting go of the lines
  whose voice changed. With the player's original PC files on, the original clips still win: under "Each
  house" each house's own, as the PC game had them; under "One voice" the PC's Harkonnen clips (Frank
  Klepacki's) for every house, still naming the player's own house (review round); a line they cannot make
  keeps the voice the option chose.
- `src/game/announcer.js`: the debug status (`__dune.voice()`) also reports the option (`announcer`) and
  the set the lines come from (`set`).

## The voice (chosen by measurement and a Whisper check; a person still has to listen)

Shipped since the review round (see "Review fixes"): blend **0.6 `am_fenrir` + 0.4 `am_onyx`**, Kokoro
speed 1.08, played at 83 % like a slowed tape (so it lasts about as long as before), then a clean chain:
high-pass 75 Hz, −3 dB at 300 Hz (mud), +6.5 dB at 2.6 kHz and +3.5 dB at 4.5 kHz (presence, so the deep
voice stays clear), compression 3.5:1, the short console room the house sets use; **no clipper** (the
Harkonnen set's grit is that house's character, not the original's). `am_fenrir` is the Harkonnen set's
voice, a fitting root for a voice the Mega Drive gave to the PC's Harkonnen actor. Round 1 shipped C3
below (0.7 / 0.3, speed 1.0, tape 88 %, +5 / +2.5 dB).

Round 1, twelve probe lines per candidate (construction complete, unit ready, insufficient funds, base attack,
Harkonnen approaching, Sardaukar structure destroyed, wormsign, mission accomplished, reinforcements,
radar, frigate, cannot build there). Pitch = median F0 of voiced frames (autocorrelation, `pitch.py`, 16 kHz;
its figures run a few Hz under the full-set meter below, so compare them within this table only); bands = share
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
| **C3 = C2 + presence chain (round 1's)** | **124 Hz** | **32.3 / 46.7 / 17.8 / 3.1 %** | **1.57 s** | heavier chest than Harkonnen, clear, no grit |
| C4 = C2 + more presence | 125 Hz | 27.7 / 46.1 / 22.7 / 3.5 % | 1.57 s | as bright as Harkonnen: loses the weight |
| D `am_onyx`, tape 0.9 | 83 Hz | — | 2.14 s | rumbling, muffled (centroid 367 Hz), too slow for battle news |
| E 0.6 fenrir + 0.4 michael, tape 0.88 | 127 Hz | — | 1.57 s | fine, less authority than C |
| F `am_michael`, tape 0.86 | 107 Hz | — | 1.80 s | slow; peaks −0.5 dBFS |
| G 0.75 fenrir + 0.25 onyx, tape 0.86 | 121 Hz | — | 1.58 s | same as C2 |

### The shipped set, all 63 lines (measured on the files in `assets/voice/announcer/`)

One meter for every pitch figure from here on (the reviewer's `measure.py`): median F0 of every voiced
frame of all 63 lines (40 ms frames, normalised autocorrelation, 60–400 Hz, 24 kHz).

| set | F0 median (p10–p90) | under Harkonnen | chest / body / presence / air | centroid | mean length |
|---|---|---|---|---|---|
| Harkonnen (the floor) | 146 Hz (102–180) | — | 26.0 / 50.0 / 19.8 / 4.2 % | 907 Hz | 1.38 s |
| round 1, C3 | 126 Hz (88–158) | 2.5 semitones | 31.2 / 48.3 / 17.2 / 3.3 % | 790 Hz | 1.49 s |
| **shipped, K2** | **113 Hz (80–141)** | **4.4 semitones** | **34.4 / 45.5 / 17.1 / 2.9 %** | **765 Hz** | **1.55 s** |

- **Deeper, line by line**: every one of the 63 lines is under its Harkonnen twin, by 2.6 to 7.5 semitones
  (median 4.3); against C3 61 of 63 are deeper (median 1.9 semitones), two within 0.3. Presence holds at
  C3's share (17.1 %), so the extra depth did not cost clarity by this measure; air/grit stays low (clean).
- **Loudness**: −17.0 to −15.2 LUFS integrated (target −16, like every set); true peak at most −1.3 dBFS.
- **Length**: 0.84–2.44 s, mean 1.55 s (C3 1.49 s, Harkonnen 1.38 s); the last 120 ms at least 19 dB
  under the loudest part (no stray syllable or breath).
- **Size**: 424,522 bytes for the 63 files; `assets/voice/` in all 2,130,937 bytes (380 lines and the
  manifest), under the 2.5 MB budget in `tests/voice.test.mjs`.
- **Whisper round trip** (`small.en`): 52 of 63 exactly (C3: 50). The other 11: nine names it cannot spell
  ("A tradie's", "Harkening", "Harken and", "Ordo's", "orthostructure", "Sardicar", "worm sign"), and
  "Frigate" heard "Forget" in both frigate lines (C3 lost one of them, the Harkonnen set "frigate fully
  loaded" too). "Upgrading." is now heard right.
- **Determinism and the other files**: the shipped files are byte-identical to the K2 probes; a checksum of
  the 317 other files under `assets/voice/` before and after: all identical; in `manifest.json` only the
  `announcer` set changed (voice `am_fenrir*0.6+am_onyx*0.4`, the lengths).
- **Browser, real GPU, round 1** (dune-shot, Linux Chrome): `?scene=battle&idle=1` → `__dune.voiceCheck()` 191
  lines, 191 decoded at 48 kHz, none missing, 0.67–2.34 s, `__dune.voice()` `announcer: 'one'`, `set:
  'announcer'`; `?scene=mission&house=ordos&mission=1&announcer=house` → 191 decoded, `set: 'ordos'`;
  no console errors. Options: clicking "Each house" saves `announcer: 'house'` and swaps the note.
- **Browser, real GPU, review round** (the shipped K2 set): `?scene=mission&house=ordos&mission=1` →
  `__dune.voiceCheck()` 191 lines, 191 decoded at 48 kHz, none missing, longest 2.44 s (the new set's
  longest line), `announcer: 'one'`, `set: 'announcer'`; `…&house=atreides&announcer=house` → 191
  decoded, `set: 'atreides'`; no console errors either time.

## Review fixes

1. **"Nobody has listened; heavy is only a measurement"** (important). An agent still cannot listen, so
   two things: (a) the shipped voice is now clearly deeper than round 1's, since the manager's word was
   "heavy" and C3 sat only 2.5 semitones under the Harkonnen set, at ordinary male speaking pitch (126 Hz).
   Five new probe candidates (12 lines each, same meter as above): H (0.7/0.3, speed 1.08, tape 82 %)
   112 Hz; J (0.7/0.3, 1.10, 80 %) 112 Hz; K (0.6/0.4, 1.08, 83 %) 106 Hz; I (0.55/0.45, 1.05, 85 %)
   104 Hz; K2 = K with 1.5 dB / 1 dB more presence, 107 Hz, presence back to C3's share (K lost 3 points).
   Whisper scored all five alike (9–10 of 12; every miss a name, plus "Forget" for "Frigate" in K2), mean
   length 1.58–1.66 s. Shipped K2: 4.4 semitones under the Harkonnen set over all 63 lines, about as clear
   as C3 by presence share and Whisper, and about as long (Kokoro speaks 8 % quicker before the tape slows
   it). D (`am_onyx`, 83 Hz) stays rejected: muffled and slow. (b) A page for a person to judge it:
   **https://claude.ai/artifact/Ce6HP21sYELqiWvLAUauAA** (private until shared) plays the twelve probe lines in the
   Harkonnen set, C3, H, K2 (shipped, highlighted) and I side by side, deepest to the right. The decision
   is still a person's: if K2 is not heavy enough, I (or deeper) is one `generate.py --sets announcer` away;
   if it is muffled or slow, H.
2. **Changing Announcer in the battle's menu applies only from the next battle** (minor): the fix is two
   lines in `src/game/game-view.js`, not this stream's file; see "Integration notes" (unchanged). It works
   better now than before: `setAnnouncer()` keeps everything that did not change (item 5).
3. **"One voice" with the player's PC files gave each house its own voice** (minor). Fixed in
   `src/audio/voice.js`: `originalLine(id, house, mode, has)` resolves an announcement under 'one' from the
   Harkonnen clips (`ONE_VOICE`: Frank Klepacki's, the voice the Mega Drive's one announcer is credited to),
   still naming the player's own house ("Atreides unit deployed" in that voice: HATRE + HUNIT + HDEPLOY);
   where those clips are missing, the house's own clips; the units' replies are shared anyway. A mid-battle
   switch re-resolves the original lines too. The row's note ("One deep voice speaks for every house") is
   true again either way. Test: `"One voice" with the player's original clips …` in
   `tests/announcer-shared.test.mjs`.
4. **Pitch figures disagreed; a spacing slip** (minor). One meter everywhere now (the reviewer's
   `measure.py`, stated above the table): 113 Hz against 146 Hz, 4.4 semitones; `generate.py` says "about
   4.4 semitones under the Harkonnen set" and names the meter; round 1's table says its meter differs.
   `tmp =os.path.join` → `tmp = os.path.join`.
5. **`setAnnouncer()` dropped every decoded line** (minor). It now compares each decoded (or missing)
   line's source (`sourceOf(id)`: the original clip names or the file) before and after, lets go only of
   those that changed, and decodes the commonest of them again at once when the output was warm. A decode
   still on its way keeps its result only if its file is still the line's source, so a stale voice never
   lands. Test: `switching the announcer lets go only of the lines whose voice changed …`.

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
- Listening: https://claude.ai/artifact/Ce6HP21sYELqiWvLAUauAA (the Harkonnen set, round 1's voice, the
  shipped one and two others, twelve lines each); round 1's every candidate: the session scratchpad's
  `art-announcer/audition.html` (outside the repo).
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
