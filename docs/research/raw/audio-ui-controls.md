# Dune II Audio & Command \& Conquer (1995) Interface — Research Notes

Compiled 2026-09-28 for the Three.js Dune II remake (C&C95-style mouse interface).

**Methodology / confidence key.** Facts are graded by source type, most reliable first:
1. **Source-code-derived** — read directly out of open-source reimplementations that parse the *real* original data files (OpenDUNE, Dune Legacy) or out of EA's own 2025 GPL release of the actual 1995 Command & Conquer: Tiberian Dawn engine source. These are cited with the specific file (e.g. `SIDEBAR.CPP`).
2. **Specialist wiki / preservation site** — moddingwiki.shikadi.net (binary format specs), VGMPF (soundtrack credit database), StrategyWiki, Command & Conquer Wiki.
3. **Secondary/community** — Wikipedia, MobyGames, forums, Steam Community threads, review sites.
Anything not corroborated by at least one of the above, or that is the researchers' own inference/ear-based judgment, is flagged **(?)**.

---

## Copyright / IP status (read first — governs what this project may ship)

- **Dune II (1992) code, art, and audio**: originally developed by **Westwood Studios**, published by **Virgin Games/Virgin Interactive**. Westwood was acquired by **Electronic Arts** in 1998 and shut down in 2003; EA is Westwood's legal successor and holds the copyright on the actual Dune II software, artwork, and sound recordings today. EA has not commercially re-released Dune II (no remaster, unlike C&C). [Wikipedia – Dune II](https://en.wikipedia.org/wiki/Dune_II), [Wikipedia – Westwood Studios](https://en.wikipedia.org/wiki/Westwood_Studios)
- **The "Dune" trademark/literary property** is separate from the 1992 game's copyright and is owned by **Herbert Properties LLC** (Frank Herbert's estate). Herbert Properties licensed game rights (alongside film licensor Legendary Entertainment) to **Funcom** in a multi-year deal signed **26 Feb 2019**, which is why new "Dune" games (*Dune: Spice Wars*, *Dune: Awakening*) exist today under Funcom, not EA. [Funcom press release](https://www.mynewsdesk.com/funcom-oslo-as/pressreleases/funcom-delves-into-the-dune-universe-with-a-gaming-deal-with-legendary-entertainment-and-herbert-properties-llc-2841008), [Shacknews](https://www.shacknews.com/article/110176/conan-exiles-dev-funcom-strikes-deal-to-create-new-dune-games). EA's own game-license to use the "Dune" name apparently lapsed after *Emperor: Battle for Dune* (2001) **(?)** — no primary source confirms the lapse explicitly, but no EA-published Dune game has appeared since, and the franchise license has since moved to Funcom. [Steam Community discussion (secondary)](https://steamcommunity.com/app/1605220/discussions/0/4297070247696596041/), [List of games based on Dune](https://en.wikipedia.org/wiki/List_of_games_based_on_Dune)
- **Command & Conquer IP** is wholly EA-owned (Westwood's own original creation, not third-party-licensed). In **February 2025**, EA open-sourced the engine source code for **four** classic titles — **Tiberian Dawn, Red Alert, Renegade, and Generals** — under a GPL license, developed in partnership with Petroglyph (many ex-Westwood staff). [github.com/electronicarts/CnC_Tiberian_Dawn](https://github.com/electronicarts/CnC_Tiberian_Dawn), [github.com/electronicarts/CnC_Red_Alert](https://github.com/electronicarts/CnC_Red_Alert), [Engadget](https://www.engadget.com/gaming/pc/ea-releases-source-code-for-four-command--conquer-games-223425774.html), [Phoronix](https://www.phoronix.com/news/EA-Open-Source-CnC-Red-Alert), [AlternativeTo](https://alternativeto.net/news/2025/3/ea-open-sources-four-command-and-conquer-games-and-boosts-modding-with-steam-workshop-support). **Important nuance: this release is source code only.** The shipped art, sprites, video, and audio assets are explicitly **not** included and remain fully proprietary/copyrighted by EA (?exact license text not re-read in this pass, but this is the consistent characterization across all coverage found).
- **Practical takeaway for this project**: game *rules/mechanics* (sidebar layout, click semantics, production flow) are not copyrightable subject matter and are freely usable as design reference — this document treats them that way. The actual *bytes* (VOC/PAK/SHP/ADL/XMI files, sprites, music recordings) from either Dune II or C&C are copyrighted by EA and **must not be redistributed** with the remake. This matches the project's stated plan: ship only original code/assets, and have the loader read data files the *player* already owns and supplies locally — a standard, low-risk pattern (same one DOSBox, ScummVM, OpenRA, OpenDUNE, and Dune Legacy all use). Consumer-level legal risk of a player using their own legally-obtained copy this way is low, but redistributing extracted assets or using the word "Dune"/C&C trademarks in the product's branding would raise separate trademark questions **(?)** — not resolved here, flagging for legal review if branding is ever a concern.

---

# PART A — Dune II Audio

## A.1 Voice lines & sound effects

**Key structural fact**: most "lines" you hear are not single voice recordings — the engine concatenates up to 5 short word/phrase VOC clips at runtime into a spoken sentence (`Sound_Output_Feedback()` loads indices into a 5-slot queue `s_spokenWords[]` from a 94-entry table `g_feedback[]`; `Sound_StartSpeech()` plays them back-to-back). [OpenDUNE `src/audio/sound.c`](https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/audio/sound.c), [OpenDUNE `src/table/sound.c`](https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/sound.c)

**Filename prefix convention** (stripped by the loader before building the real 8.3 filename) — this directly answers "which lines vary per house":

| Prefix | Meaning |
|---|---|
| `+` | Universal system/acknowledgement clip — loaded with a fixed letter **`Z`** (English), `F` (French) or `G` (German) — **not** a house letter, i.e. identical across all three houses |
| `%c` | House/faction-specific — `%c` substituted at runtime with `A` (Atreides), `H` (Harkonnen, also reused for Sardaukar missions), `O` (Ordos, also reused for Fremen missions), `M` (Mercenary) |
| `-` | Only loaded for the special "Game End" voice set (credits narration fragments) |
| `/` | Only loaded for the "Game Intro" voice set (intro-cinema SFX) |
| `?` | Loaded on demand rather than preloaded |

Source: [OpenDUNE `src/table/sound.c`](https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/sound.c) (131-entry `g_table_voices[]`).

**Order-acknowledgement clips ARE shared across all three houses** — confirmed at the code level: AFFIRM, REPORT1/2/3, OVEROUT, and MOVEOUT all load with the `+` prefix (fixed `Z`), so "Affirmative", "Reporting", "Over and out", "Moving out" sound identical regardless of house chosen. A source comment notes a real data-file quirk: in "1.07US" data, these five ship with **no prefix at all** (`MOVEOUT.VOC`, not `ZMOVEOUT.VOC`), and the loader falls back accordingly. [OpenDUNE `sound.c`](https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/audio/sound.c). By contrast, the longer contextual-announcer set (enemy warnings, house names, unit/harvester deployed, construction, radar, frigate, missile, win/lose, wormsign, attack) genuinely loads a **different physical file per house** (e.g. `AENEMY.VOC` / `HENEMY.VOC` / `OENEMY.VOC`). Independent human-listening confirmation: *"The original had three announcer voices depending on your house"* — [Sega-16 review](https://www.sega-16.com/2005/08/dune-the-battle-for-arrakis/), written in direct comparison to the PC version. No source found describes each house announcer's specific accent/character — treat any such claim as **(?)**.

**Decoded event → spoken-sequence table** (cross-referencing the `g_feedback[]` index table against `g_table_voices[]`, both in [`table/sound.c`](https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/sound.c) / [`sound.c`](https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/audio/sound.c)):

| In-game event | Decoded spoken sequence | Feedback index |
|---|---|---|
| Building finishes | "Construction [complete]" | 0 |
| Enemy sighted (direction known) | "Warning, Enemy unit approaching" [+ N/E/S/W variant] | 1–5 |
| Enemy sighted (house known) | "Warning, Harkonnen/Atreides/Ordos/Fremen unit approaching"; "Warning, Sardaukar approaching"; "Warning, Saboteur approaching" | 6–12 |
| Kill confirmed | "Enemy/Harkonnen/Atreides/Ordos/Fremen unit destroyed"; "Sardaukar destroyed" | 13–19 |
| Building destroyed | "[House] structure destroyed" | 21–27 |
| Radar toggled | **"Radar On" / "Radar Off"** (code-decoded; exact English wording not independently transcript-confirmed beyond the filenames — **(?)**) | 28 / 29 |
| Unit built | "Harkonnen/Atreides/Ordos/Fremen unit deployed"; "Sardaukar deployed"; generic "Unit deployed" | 30–35 |
| Sandworm detected | **"Warning! Wormsign!"** (a full two-word bark, not just "Wormsign") | 37 |
| Naval reinforcement arrives | "Frigate has arrived" | 38 |
| Rocket/superweapon fired | "Missile launched" (generic, house-voiced; no separate "…approaching" clip found) | 42 |
| Base attacked | single word **"Attack"** — the fuller "Our base is under attack" wording is on-screen banner text, not the spoken audio | 48 |
| Harvester built | "Harkonnen/Atreides/Ordos/Fremen/Sardaukar harvester deployed" | 68–73 |
| Mission won | plays `WIN.VOC` alongside the "successfully completed your mission" modal text | 40 |
| Mission lost | plays `LOSE.VOC` alongside the "failed your mission" modal text | 41 |

**Correction**: the task brief associates "Death Hand missile" with Ordos — it's actually the **Harkonnen** Palace superweapon; Ordos's Palace special is the **Saboteur**, Atreides's is a Fremen airlift. [Dune Wiki – Death Hand](https://dune.fandom.com/wiki/Death_Hand). No distinct spoken "Death Hand" line or "missile approaching" clip was found in the tables — "Missile launched" (above) is the best candidate **(?)**.

**Selected sound-effect / voice filenames** (from the 131-entry table; prefix already stripped):

| Filename | Meaning |
|---|---|
| CONST.VOC | "Construction complete" |
| DEPLOY.VOC | "…deployed" |
| ENEMY.VOC / APPRCH.VOC | "Enemy … approaching" |
| WARNING.VOC | "Warning" |
| WORMY.VOC | "Wormsign" |
| ATTACK.VOC | "Attack" |
| RADAR.VOC / ON.VOC / OFF.VOC | "Radar" + "On"/"Off" |
| FRIGATE.VOC / ARRIVE.VOC | "Frigate" + "has arrived" |
| MISSILE.VOC / LAUNCH.VOC | "Missile" + "launched" |
| WIN.VOC / LOSE.VOC | mission-won / mission-lost stings |
| AFFIRM / REPORT1-3 / OVEROUT / MOVEOUT .VOC | order-acknowledgement set (shared across houses, see above) |
| HARK/ATRE/ORDOS/FREMEN/SARD.VOC | spoken house names |
| NORTH/EAST/SOUTH/WEST.VOC | compass callouts |
| VSCREAM1–5, EXSAND/EXSMALL/EXMED/EXLARGE/EXCANNON/EXGAS/EXDUD, GUN/GUNMULTI, CRUMBLE, SQUISH2 | generic death screams / explosions / gunfire, no house prefix |
| 3HOUSES, ANDNOW, ARRIVED, BATTLE, BEGINS, BLDING, DUNE, DYNASTY, EMPIRE, MELANGE, PLANET, SPICE, PROPOSED... (~44 files, `-` prefix) | fragments of the end-game/credits narration monologue, concatenated in sequence |
| BLASTER, GLASS6, LIZARD1, FLESH, CLICK, EXTINY (`/` prefix) | intro-cinematic-only sound effects |

Source for all filenames: [OpenDUNE `src/table/sound.c`](https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/sound.c).

**Sega Genesis version — DOES have digitized speech (contrary to a "beeps only" assumption), just less of it**:
- *"The Genesis adaptation ... [had] digitized speech, music, and fun gameplay"* — [Wikipedia, Dune II](https://en.wikipedia.org/wiki/Dune_II)
- Direct contemporary confirmation: *"The original had three announcer voices depending on your house, but this Genesis cart only has one (and he doesn't talk as much.) ... many of the speech samples were left out ... [but] the voices that were kept in sound great."* — [Sega-16](https://www.sega-16.com/2005/08/dune-the-battle-for-arrakis/)
- So the Genesis version plays sampled/digitized PCM speech (the Genesis's YM2612 DAC channel supports this natively, standard for the platform), but Westwood cut it to **one shared announcer voice** for all houses and trimmed the total sample count — plausibly due to cartridge ROM budget versus the PC's floppy/HDD install.
- **Gap**: Sega Retro (segaretro.org) and VGMRips.net were unreachable in this research pass — both sit behind a JavaScript proof-of-work bot-wall ("Anubis") that blocked automated fetches, including via the Wayback Machine. A proper Genesis-side deep-dive (exact sample list, ROM credits screen) would need a real browser session or the ROM itself. Treat §A.1/§A.2's Genesis claims as solid-but-not-triple-sourced.

## A.2 Music

**Composer/arranger split — corrects a common assumption.** It is not "Klepacki did the action tracks, Okahara did the rest" — MobyGames' official DOS credits and VGMPF agree the split is by **role**, not by track: **Frank Klepacki composed the entire 32-track soundtrack**; **Dwight (Kenichi) Okahara** arranged the MIDI/XMI versions (Roland MT-32, Roland SC-55, Tandy 3-voice, PC Speaker); **Paul S. Mudra** arranged the OPL2/AdLib version and is separately credited as "Musical Lead and Sound Effect Verification." [VGMPF – Dune II (DOS)](https://www.vgmpf.com/Wiki/index.php/Dune_II:_The_Building_of_a_Dynasty_(DOS)), MobyGames DOS credits (archive.org cache of `mobygames.com/game/241/dune-ii-the-building-of-a-dynasty/credits/dos/`).

**Full PC track list** (source: [VGMPF](https://www.vgmpf.com/Wiki/index.php/Dune_II:_The_Building_of_a_Dynasty_(DOS)); data-file numbering runs 1–100 = Roland MT-32 versions, 200–299 = General MIDI, 300–399 = AdLib):

| # | Track | Composer | Arranger |
|---|---|---|---|
| 1 | Westwood Associates Logo | Klepacki | Okahara (MIDI) / Mudra (AdLib) |
| 2 | Introduction | Klepacki | Okahara / Mudra |
| 3 | Choose Your House | Klepacki | Okahara / Mudra |
| 4 | The Building of a Dynasty | Klepacki | Okahara / Mudra |
| 5 | Defeat | Klepacki | Okahara / Mudra |
| 6 | Dark Technology | Klepacki | Okahara / Mudra |
| 7 | Rulers of Arrakis | Klepacki | Okahara / Mudra |
| 8 | Desert of Doom | Klepacki | Okahara / Mudra |
| 9 | Faithful Warriors | Klepacki | Okahara / Mudra |
| 10 | Spice Melange | Klepacki | Okahara / Mudra |
| 11 | Arid Sands | Klepacki | Okahara / Mudra |
| 12 | The Council | Klepacki | Okahara / Mudra |
| 13 | Disturbed Thoughts | Klepacki | Okahara / Mudra |
| 14 | Hope Fades | Klepacki | Okahara / Mudra |
| 15 | Victory | Klepacki | Okahara / Mudra |
| 16 | Victory 2 | Klepacki | Okahara / Mudra |
| 17 | The Prophecy – Part I | Klepacki | Okahara / Mudra |
| 18 | The Prophecy – Part II | Klepacki | Okahara / Mudra |
| 19 | Into the Heat | Klepacki | Okahara / Mudra |
| 20 | Epic War | Klepacki | Okahara / Mudra |
| 21 | Humans Fall | Klepacki | Okahara / Mudra |
| 22 | Adrenaline Rush | Klepacki | Okahara / Mudra |
| 23 | Only the Strongest Survives | Klepacki | Okahara / Mudra |
| 24 | Marching Towards the End | Klepacki | Okahara / Mudra |
| 25 | Destructive Minds | Klepacki | Okahara / Mudra |
| 26 | The Long Sleep | Klepacki | Okahara / Mudra |
| 27 | Abuse | Klepacki | Okahara / Mudra |
| 28 | For Those Fallen | Klepacki | Okahara / Mudra |
| 29 | Noble Atreides | Klepacki | Okahara / Mudra |
| 30 | Insidious Ordos | Klepacki | Okahara / Mudra |
| 31 | Evil Harkonnen | Klepacki | Okahara / Mudra |
| 32 | Credits (quotes "Evil Harkonnen"/"Faithful Warriors") | Klepacki | Okahara / Mudra |

**What plays when — mechanism confirmed directly from `opendune.c`'s game loop** [OpenDUNE `src/opendune.c`](https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/opendune.c), [`src/table/sound.c`](https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/table/sound.c) (`g_table_musics[]`, 38 entries; ID 0 = silence):

| Moment | Trigger | Effect |
|---|---|---|
| Level ends (win or lose) | `Music_Play(0)` | music stops |
| Before intro cinematic | `Music_Play(0)` then fade-out | silence, then intro's own audio track |
| After intro / main menu | `Music_Play(28)` | menu/house-select theme |
| House-pick screen | `Music_Play(28)` | same theme |
| Mission starts | `Music_Play(random(0,8) + 8)` | random pick from a **9-track "peace" pool** (IDs 8–16) |
| Combat detected (`g_musicInBattle` flag flips) | `Music_Play(random(0,5) + 17)` | random pick from a **6-track "combat" pool** (IDs 17–22); flag latches so it isn't re-rolled every frame |
| No battle, current peace track ends | new random peace-pool pick | loops the peaceful pool |
| Mission won/lost stings | not a music cue — `WIN.VOC`/`LOSE.VOC` voice clips (§A.1) fire alongside the result modal | — |
| Credits | Track #32, "Credits" | — |

This is the actual "threat-level switches music" mechanism: a two-pool random shuffle keyed by a tri-state flag (peace / just-triggered / already-in-combat), not a hand-authored transition system.

Each `.ADL`/XMI base file is itself a multi-song container: OpenDUNE caps the song sub-index at 0–120 [`driver.c`](https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/audio/driver.c), and moddingwiki independently states Westwood's ADL format holds "120 (8-bit) primary song indexes" — [moddingwiki ADL Format](https://moddingwiki.shikadi.net/wiki/ADL_Format) — two unrelated sources agreeing on the same number.

**Sega Genesis music**: **not a straight port**. Frank Klepacki is directly credited for "Dune: The Battle for Arrakis (Genesis) – 1993" on his own VGMPF page [VGMPF – Frank Klepacki](https://www.vgmpf.com/Wiki/index.php/Frank_Klepacki), so composition stayed with Klepacki, but the Genesis cart plays only **about five music tracks total** versus the PC's 32 — a contemporary reviewer explicitly wished for "the old PC tunes mixed in," implying a distinct, much-reduced arrangement rather than a reproduction. [Sega-16](https://www.sega-16.com/2005/08/dune-the-battle-for-arrakis/). Paul Mudra's own VGMPF credit list does **not** include a Genesis entry (only an Amiga version, role unspecified) — a claim that Mudra co-arranged the Genesis version could not be corroborated and should be treated as **(?)**. Sound hardware: Yamaha YM2612 (6-channel, 4-operator FM) plus SN76489 PSG — standard Genesis audio hardware. Wikipedia dates Genesis street release as May 1994 (NA)/June 1994 (EU) while VGMPF's credit metadata says 1993 — likely copyright-year-vs-release-date discrepancy, both given. **Gap**: could not reach Sega Retro/VGMRips (bot-walled) for a full Genesis track list or confirmed arranger — this is the weakest-sourced sub-claim in the whole document **(?)**.

**Musical style — for composing an original, non-infringing soundtrack "in a similar style".** Formal music-theory analysis of this OST is thin online; what exists:
- A forum thread titled "Dune 2 – what scale is this?" on the film/game-scoring forum VI-Control references **Lydian Dominant** as "one of the favorite scales from the Dune 2 soundtrack" — but the full thread 403'd on fetch, so which track(s) this refers to, and the reasoning, could not be confirmed. Single unverified forum opinion **(?)**. [VI-Control thread](https://vi-control.net/community/threads/dune-2-what-scale-is-this.149602/)
- No citable BPM table or dedicated video-essay breakdown was found. The following is the researchers' own ear/description-based characterization — explicitly **(?)**, uncorroborated by formal theory sources, but useful as compositional direction:
  - **Tempo**: two bands — slower/sparser "peace" cues (~90–110 BPM feel) vs. faster, more percussive "combat" cues (~130–150 BPM feel), consistent with the sourced peace/combat pool split above.
  - **Harmony/scale**: natural/harmonic minor and Middle-Eastern-flavored modes — Phrygian dominant is commonly associated with this game's sound in fan discussion, alongside the one sourced Lydian Dominant mention — used to evoke a desert/Arabian setting without quoting a specific real-world piece.
  - **Instrumentation**: MT-32-style patches (synth strings, reed/shakuhachi-like lead patches, gated brass stabs, electronic toms), doubled by the OPL2/AdLib version's 2-operator FM-patch equivalents; hand/frame-drum-style percussion loops under both peace and combat cues; combat tracks add faster arpeggiated bass ostinatos and war-drum-like percussion layers; peace/build tracks are sparser, a lead melody over a slow pad/drone.
  - **Mood mapping**: peace/build tracks are contemplative and spacious (matches slow base-building pacing); combat tracks are driving and tense, built from repetitive rhythmic ostinati rather than complex harmonic movement — a style Klepacki continued and which is far more thoroughly documented in his later C&C/Red Alert work.
  - **Hardware timbre reference points**: Roland MT-32 (composition target) vs. AdLib/OPL2 (2-operator FM, Sound Blaster–compatible) on PC; Genesis's YM2612 (4-operator FM) + PSG gives a generally "brighter/harder" FM character than MT-32/OPL2 — useful as two distinct sonic palettes if the remake wants period-authentic synthesis rather than modern sample-based orchestration.

## A.3 File formats (precise enough to write a loader)

### Westwood PAK archive

Cross-verified by two independent sources — moddingwiki's format spec and OpenDUNE's actual parser code — which agree exactly:

- **No magic number.** The file starts immediately with an index.
- Index is a flat, repeating sequence of: **`uint32` offset (little-endian, 4 bytes)** followed by a **NUL-terminated ASCII filename** (variable length, 8.3-style).
- **Termination**: after each filename, read one more `uint32` offset; when that offset is **`0`**, the index is finished (moddingwiki calls this the "Version 2" PAK layout — the version Dune II and Kyrandia 1 use; other Westwood games used "Version 1" — ends when file position equals the first offset — or "Version 3" — adds an explicit empty-name terminator entry for exact last-file sizing).
- **File size derivation**: `size = nextEntry.offset − thisEntry.offset`; for the **last** entry, `size = totalArchiveFileSize − thisEntry.offset`.
- Data for each file begins at its stored offset, runs `size` bytes; offsets are absolute from the start of the PAK file.
- No compression, no per-file checksum, no directory nesting — a flat archive. Max 65,536 files (moddingwiki). Moddingwiki also warns that in Version-1-era PAKs, roughly half have garbage end-offsets and the games instead use hardcoded file-size tables — a V1-specific gotcha that does **not** apply to Dune II's V2 format.

Loader pseudocode:
```
pos = 0
read u32 offset (LE)
while offset != 0:
    read NUL-terminated filename starting at pos+4
    pos = position after filename's NUL byte
    read next u32 offset (LE) at pos
    size = (nextOffset != 0) ? nextOffset - offset : fileLength - offset
    record {filename, offset, size}
    pos += 4
    offset = nextOffset
```

Sources: [moddingwiki – PAK Format (Westwood)](https://moddingwiki.shikadi.net/wiki/PAK_Format_(Westwood)), [OpenDUNE `src/file.c`](https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/file.c) (`_File_Init_ProcessPak`), Dune Legacy's writer side (`Pakfile.cpp`, symmetric confirmation) — [github.com/philippkeller/dunelegacy](https://github.com/philippkeller/dunelegacy/blob/master/src/FileClasses/Pakfile.cpp) **(?** exact current canonical repo for Dune Legacy — this is reported as a GitHub mirror of the original SourceForge project **)**.

### Creative Voice File (VOC) format

**General spec** (moddingwiki):

Header (26 bytes total):

| Offset | Size | Field | Notes |
|---|---|---|---|
| 0 | 19 bytes | `"Creative Voice File"` magic (minus one char — 19 literal ASCII bytes) | |
| 19 | 1 byte | `0x1A` (Ctrl-Z) | second signature byte |
| 20 | uint16 LE | header size | "usually 0x001A" (26) |
| 22 | uint16 LE | version | `0x010A` = old format, `0x0114` = new format |
| 24 | uint16 LE | checksum | must equal `~version + 0x1234` |

All multi-byte fields little-endian.

Data block header: `[1-byte type][3-byte LE length, excludes the 4-byte header]`, followed by `length` bytes of payload. Block types:

| Type | Purpose |
|---|---|
| 0 | Terminator (no size field) |
| 1 | Sound data with type/codec byte (older format, superseded by 9) |
| 2 | Sound data continuation (reuses codec from the preceding type-1 block) |
| 3 | Silence |
| 4 | Marker |
| 5 | Text (NUL-terminated string) |
| 6 | Repeat start |
| 7 | Repeat end (no data) |
| 8 | Extra information (older format, superseded by 9) |
| 9 | Sound data, new format (explicit rate/bits/channels/codec fields) |

Type-1 codec byte: `0x00` 8-bit unsigned PCM, `0x01`/`0x02`/`0x03` Creative ADPCM (4/3/2-bit-to-8), `0x04` 16-bit signed PCM, `0x06` A-law, `0x07` µ-law, `0x0200` 4-to-16-bit Creative ADPCM (type-9 payloads only).

Sample-rate formulas — cross-verified identically by moddingwiki (general spec) and Dune Legacy's C++ loader (Dune-II-specific implementation):
- **Type 1 (old format)**: `sample_rate = 1,000,000 / (256 − time_constant_byte)`, 8-bit mono.
- **Type 8 (extended)**: `sample_rate = 256,000,000 / ((numChannels+1) × (65536 − frequency_divisor))`.
- **Type 9 (new format)**: explicit `uint32` rate field, no formula needed; struct = `{uint32 rate, uint8 bits, uint8 numChannels, uint16 codec, uint32 reserved(=0), data[]}`.

**What Dune II actually uses** (Dune Legacy's Dune-II-specific VOC reader, [`Vocfile.cpp`](https://github.com/philippkeller/dunelegacy/blob/master/src/FileClasses/Vocfile.cpp)): only **Type 1**, with codec/packing byte `0` (raw 8-bit unsigned PCM, mono), occasionally **Type 3** (silence), terminated by **Type 0**. The loader special-cases time-constant bytes `0xA5`/`0xA6` → exactly 11025 Hz and `0xD2`/`0xD3` → exactly 22050 Hz, because the naive formula rounds those two standard rates to 11111/22222 Hz — a known general VOC-format quirk (inherited from ScummVM's shared decoder), not Dune-II-specific.

Sources: [moddingwiki – VOC Format](https://moddingwiki.shikadi.net/wiki/VOC_Format) (fetched directly, general spec above), [Dune Legacy `Vocfile.cpp`](https://github.com/philippkeller/dunelegacy/blob/master/src/FileClasses/Vocfile.cpp) (Dune-II-specific subset), Wikipedia's [Creative Voice file](https://en.wikipedia.org/wiki/Creative_Voice_file) page as a clean plain-English summary.

### Which PAK contains what

Confirmed real archive names from Dune Legacy's file manager (which explicitly separates the original game's files from its own 3 additions — `LEGACY.PAK`, `OPENSD2.PAK`, `GFXHD.PAK`, excluded from the table below) — [`FileManager.cpp`](https://github.com/philippkeller/dunelegacy/blob/master/src/FileClasses/FileManager.cpp):

| PAK file | Contents | Confidence |
|---|---|---|
| DUNE.PAK | Core engine data — fonts, UI graphics, tilesets | filename confirmed; content generic per [moddingwiki Dune II page](https://moddingwiki.shikadi.net/wiki/Dune_II) |
| SCENARIO.PAK | Mission/scenario `.INI` definitions | filename confirmed |
| MENTAT.PAK | Mentat advisor briefing graphics/animation | filename confirmed |
| VOC.PAK | Shared, non-house-specific SFX + the `Z`-prefixed universal acknowledgement clips | filename confirmed; content inferred from §A.1 prefix logic **(?)** |
| MERC.PAK | Mercenary-house-specific assets | filename confirmed |
| FINALE.PAK | Ending-cinematic assets, likely incl. the `-`-prefixed "Game End" narration fragments | filename confirmed; content inferred **(?)** |
| INTRO.PAK | Intro-cinematic graphics/animation | filename confirmed |
| INTROVOC.PAK | Intro-cinematic voice/SFX, likely the `/`-prefixed clips | filename confirmed; content inferred **(?)** |
| SOUND.PAK | Music files | **explicitly confirmed**: "The game's music was extracted from the SOUND.PAK file" — [VGMPF](https://www.vgmpf.com/Wiki/index.php/Dune_II:_The_Building_of_a_Dynasty_(DOS)) |
| ENGLISH.PAK / FRENCH.PAK / GERMAN.PAK | Text strings | filename confirmed |
| ATRE.PAK, HARK.PAK, ORDOS.PAK | Each house's `%c`-prefixed voice files (§A.1) plus house-specific text — the engine's own file manager literally groups these together with the language paks as `LanguagePakFiles = "ENGLISH.PAK,HARK.PAK,ATRE.PAK,ORDOS.PAK"`, i.e. "which house" is loaded the same way as "which language" | filename + grouping confirmed from source |

No literal byte-for-byte directory dump of any one PAK's contents was found in reachable sources — the "contents" column is a reasoned synthesis of real filenames plus loader logic, not a directly observed listing, flagged **(?)** where noted.

### Music formats: ADL, XMI, and "C55"

- **ADL** — Westwood's own proprietary OPL2 register-dump format (authored in "AdLib Visual Composer" as `.ROL`, converted to `.ADL`). Layout per moddingwiki: 5 sequential sections — (1) song index table, (2) track-pointer array, (3) instrument-pointer array, (4) track data, (5) instrument data; pointers relative to the index-block size. Dune II specifically uses **120 8-bit song-index entries, 250 16-bit track pointers, 250 16-bit instrument pointers** — the same layout as Eye of the Beholder II and Kyrandia 1. This matches OpenDUNE's own 0–120 song-index cap in `driver.c`/`sound.c` — two unrelated sources agreeing. [moddingwiki – ADL Format](https://moddingwiki.shikadi.net/wiki/ADL_Format)
- **XMI** ("Extended MIDI") is Miles Sound System/AIL's (Audio Interface Library, John Miles) MIDI-derivative container format — general format knowledge, corroborated by the Mindwerks/wildmidi XMI documentation.
- **".C55" is real, not a misremembering.** OpenDUNE's `Drivers_GenerateFilename()` builds the music filename as `<basename>.<3-letter driver extension>`, with the extension set per audio driver at init time, falling back to `.XMI` if a device-specific file is absent [`driver.c`](https://raw.githubusercontent.com/OpenDUNE/OpenDUNE/master/src/audio/driver.c). Dune II therefore ships **one XMI-format song per target device, distinguished purely by file extension**: `.XMI` (general MIDI/MT-32), **`.C55`** (Roland SC-55/Sound Canvas), `.TAN` (Tandy 3-voice), `.PCS` (PC Speaker) — all musically equivalent (not identical) arrangements of the same Klepacki composition, matching Okahara's credit as arranger "for Roland MT-32, SC-55, Tandy 3 Voice and PC Speaker." ADL/AdLib is the separate, non-XMI format above, arranged by Mudra.
- The base resource name (e.g. `DUNE1`) plus the song sub-index from `g_table_musics[]` (§A.2) selects which embedded song plays; the file extension selects which target device's arrangement plays it.

### Existing JS/web tooling that could be reused

| Need | Option | Notes |
|---|---|---|
| OPL2/OPL3 FM synthesis in-browser | [`@malvineous/opl`](https://github.com/Malvineous/opljs) (opljs) | Web-Audio-based OPL emulator; still need something to feed it Westwood-ADL-derived register writes |
| Playing Westwood `.ADL` directly | [AdPlug](https://github.com/adplug/adplug) (C++, many AdLib formats incl. Westwood ADL) compiled to WASM as ["AdLibido"](https://palxex.github.io/adplug-emscripten) | Most direct existing reuse path for ADL |
| Broader DOS game-music format library | [Camoto libgamemusic](https://github.com/Malvineous/libgamemusic), Emscripten-compilable, [live demo](http://camoto.shikadi.net/libgamemusic) | Does not explicitly list Westwood ADL in its README — unconfirmed coverage **(?)** |
| XMI parsing/reference | [Mindwerks/wildmidi XMI wiki](https://github.com/Mindwerks/wildmidi/wiki/XMI); VGMPF notes the community already converts Dune II's XMI to Standard MIDI via a tool called "MIDIPLEX" | Pragmatic path: convert XMI→MID offline once, then play as ordinary MIDI with any off-the-shelf JS MIDI+soundfont player |
| VOC decoding | No dedicated npm/JS package found | Format is simple enough to hand-roll (~100–250 lines per Dune Legacy's reference); decoded 8-bit PCM can be pushed straight into a Web Audio `AudioBuffer` (no container-format decoding needed) |
| PAK (Westwood) decoding | No dedicated npm/JS package found | Trivial to hand-roll from the pseudocode above; note C&C's *MIX* archive format is a different, hash-indexed design — don't assume a JS C&C loader is reusable for Dune II's PAK format **(?** not independently verified this session **)** |
| Full-emulation fallback | [js-dos](https://js-dos.com) can run the original `DUNE2.EXE` unmodified, including its real audio, inside a browser | A completely different strategy (emulation vs. native Three.js asset loader) — flagged as a known alternative, not evaluated in depth |

---

# PART B — Command & Conquer (1995) Interface & Controls

**Primary source**: EA's February 2025 GPL release of the actual 1995 Tiberian Dawn engine source — [github.com/electronicarts/CnC_Tiberian_Dawn](https://github.com/electronicarts/CnC_Tiberian_Dawn) (files cited by name: `DEFINES.H`, `MOUSE.H`, `SIDEBAR.H/.CPP`, `FACTORY.H/.CPP`, `POWER.CPP`, `RADAR.CPP`, `DISPLAY.CPP`, `CONQUER.CPP`, `BUILDING.CPP`, `HOUSE.CPP`, `EVENT.CPP`, `TECHNO.CPP`). This is the real shipped game logic, not a fan reconstruction, and it corrects several commonly-repeated wiki claims below. Secondary sources (StrategyWiki, Command & Conquer Wiki, ModEnc, Steam Community, GameReplays) are used for visual/asset description and historical context and are cited inline.

## B.1 Sidebar layout

| Element | Detail | Source |
|---|---|---|
| Radar panel | Top of sidebar. Requires a Communications Center (or Advanced Comm Center) and sufficient power; otherwise goes inactive/dark. | [cnc.fandom.com/wiki/Radar](https://cnc.fandom.com/wiki/Radar); `RADAR.CPP` (`IsRadarActive` gating) |
| Radar click, nothing selected | Left-click recenters the tactical view on that map location (jump-scroll); cursor is a dedicated radar cursor | `RADAR.CPP` `TacticalClass::Action` |
| Radar click, units selected | Left-click **issues Move/Attack/Enter/Capture/Sabotage orders directly** — the radar is a fully functional click-to-command mini-map, not just a scroll-jump tool (non-obvious, code-confirmed) | `RADAR.CPP`, same function |
| Map/radar toggle button | A "Map" button (internal name `Zoom`) sits with Repair/Sell at the sidebar top; enabled only if radar exists or in special game modes | `SIDEBAR.CPP` `Init_IO`; asset `MAP.SHP` |
| Credits counter | Tape/LED-style readout on the sidebar. Exact pixel position not verified from source **(?)** | general knowledge |
| Power bar | Vertical bar near the radar. **Three color states, source-confirmed** (not a simple binary): green when Power ≥ Drain; amber/yellow when Drain > Power; red when Drain > 2× Power | `POWER.CPP` `PowerClass::Draw_It` (thresholds source-confirmed; color names are near-universal community convention) |
| Build strips | Exactly **2 columns** (`COLUMNS = 2`) — left = structures (`RTTI_BUILDINGTYPE`), right = everything from unit factories (infantry/vehicles/aircraft), confirming the assumed structures-vs-units split | `SIDEBAR.H` enum; `Which_Column()` in `SIDEBAR.CPP` |
| Visible slots / scroll arrows | **4 slots visible per strip** (`MAX_VISIBLE = 4`); up/down scroll-arrow buttons appear per strip; max 30 trackable buildable types per strip (`MAX_BUILDABLES = 30`) | `SIDEBAR.H` |
| "Clock wipe" progress | A translucent `CLOCK.SHP` overlay is drawn on the icon; its frame index advances as production completes — the literal radial-shading effect | `SIDEBAR.CPP` `StripClass::Draw_It` |
| "Ready" indicator | A small graphical pip/badge (`PIP_READY`), **not text**, stamped on the completed icon. (An earlier text-based "Ready" label existed in constants but its draw path is commented out — replaced by the pip.) | `SIDEBAR.CPP` `Draw_It` |
| "On Hold" indicator | A graphical pip (`PIP_HOLDING`) plus a frozen (non-advancing) clock overlay, shown whenever a factory exists but isn't actively building | `SIDEBAR.CPP` `Draw_It` |
| Busy/unavailable items | Sibling icons in the same production category are **darkened** (clock frame 0 ghosted) while one item in that category is mid-build. Items with unmet prerequisites simply **don't appear** in the strip at all (rather than greyed) until unlocked. | `SIDEBAR.CPP` (`isbusy`/`darken` logic); `StripClass::Add()` |
| Repair / Sell / Map buttons | **Repair** (`REPAIR.SHP`, wrench), **Sell** (internally still named "Upgrade" — a leftover from a cut prototype button — uses `SELL.SHP` art), **Map** (`MAP.SHP`) | `SIDEBAR.CPP` `Init_IO`; [cnc.fandom.com – 1995 manual](https://cnc.fandom.com/wiki/Command_%26_Conquer_(1995)_manual) (prerelease "Upgrade" button note) |
| Primary building ("star") | A per-building `IsLeader` flag toggled by `BuildingClass::Toggle_Primary()`; setting a new primary auto-unsets any other building of the same type (mutually exclusive per type). Speaks "Primary building selected." Trigger gesture is commonly cited as double-click **(?** no call site found in the inspected files, only the underlying flag logic — right-click is fully consumed by cancel/deselect, so it can't also mean this **)** | `BUILDING.CPP` `Toggle_Primary`; mechanism claim from Steam Community thread |
| Rally points | **Did not exist in original C&C95** — no waypoint/rally code found in `FACTORY.CPP`/`BUILDING.CPP`; new units simply exit adjacent to the factory. Added in later titles. | Steam Community: ["Waypoints for production facilities?"](https://steamcommunity.com/app/1213210/discussions/0/2275953283831311074) |

## B.2 Production flow

**Exact interaction model**, source-confirmed (`SIDEBAR.CPP` `SelectClass::Action`; `FACTORY.CPP` `Set`/`Suspend`/`Start`/`Abandon`) — **note this table corrects a commonly assumed mapping**:

| Input | Factory state | Result | EVA line |
|---|---|---|---|
| Left-click a new icon | none building | Starts production | "Building" |
| Left-click the SAME icon again | actively building | **Nothing but a scold** — does *not* toggle hold | "Unable to comply, building in progress" |
| Left-click a different icon in the same strip | another item in that strip already has a factory | Rejected | "Unable to comply, building in progress" |
| Left-click a finished icon | ready | Building → placement/ghost mode; Vehicle/Aircraft/Infantry → exits factory automatically | (silent) |
| Left-click while on hold | suspended | Resumes | "Building" |
| **Right-click** icon | actively building | Puts on **hold** (no refund yet) | "On hold" |
| **Right-click** icon again | already on hold | **Cancels** — refunds money, destroys the pending object | "Cancelled" |

So **right-click is the pause/cancel control** (two-stage: first press = hold, second = cancel with refund) and **left-clicking the busy icon again does not pause it**. This matches StrategyWiki's summary and is now confirmed at the source level. [StrategyWiki – Controls](https://strategywiki.org/wiki/Command_%26_Conquer/Controls)

- **Refund is 100% of money spent so far** on cancel (`Cost_Of() − Balance`), not a partial refund. The 50%-back rule is a *different* mechanic — selling an already-completed structure via the Sell button.
- **No true queue.** Each strip slot holds at most one in-progress item; starting a new one while one exists in that slot force-abandons the old one. No queue-count badge, no stacking. Confirmed absent both in source (`FACTORY.H/.CPP`) and by a 2020 Remastered Collection patch note that explicitly *added* queuing/stacking on top of the original's single-slot design while keeping the same two-stage hold→cancel gesture. [Steam Community – "Can't queue units"](https://steamcommunity.com/app/1213210/discussions/0/2290590708546965370)
- **"Unable to comply, building in progress"** fires in exactly the two busy-click scenarios above — confirmed in `DEFINES.H` and `SIDEBAR.CPP`.
- **"Construction complete" vs. "Unit ready" — non-obvious, source-confirmed split**: "Construction complete" fires for completed **Buildings, Vehicles, and Aircraft**; "Unit ready" fires **only for Infantry** — the opposite of what many fans assume. `SIDEBAR.CPP` `StripClass::AI`.
- **"New construction options"** fires when a new buildable type unlocks (suppressed at mission load to avoid spam). `SIDEBAR.CPP` `StripClass::Add`.
- **"Insufficient funds"** — the line/enum exists in `DEFINES.H`, but no call site was found across `SIDEBAR.CPP`, `FACTORY.CPP`, `HOUSE.CPP`, `EVENT.CPP`, `BUILDING.CPP`, `TECHNO.CPP`. Mid-production funds shortfalls are instead handled **silently** — production just stalls a step and retries. Possibly unused in the base single-player game, or wired from code outside what was inspected. **(?)**
- **Structure placement**: footprint preview grid with valid/invalid cell shading and an adjacency-to-existing-friendly-building rule are well-documented, standard C&C1 mechanics; exact placement-cell colors (commonly recalled as white/green valid, red invalid) were **not independently re-verified from source** this pass. **(?)** [StrategyWiki – Controls](https://strategywiki.org/wiki/Command_%26_Conquer/Controls)

## B.3 Selection & commands

**Right-click — precise semantics**, quoted directly from `DISPLAY.CPP` `Mouse_Right_Press`: *"A right mouse button press cancels the current action or selection... If there is nothing to cancel, then it will default to unselecting any units that might be currently selected."* Exact priority order: (1) cancel pending building placement, else (2) cancel Repair mode, else (3) cancel Sell mode, else (4) cancel superweapon targeting, else (5) **deselect all**. So right-click's real job is "universal cancel/back-out," and deselection is only its *fallback* behavior — a more precise finding than the usual one-line wiki summary. This is the **opposite** of Red Alert 2/modern C&C/StarCraft/AoE, where right-click is the universal contextual move/attack/enter/gather command.

**Left-click** is context-sensitive based on an `ActionType` computed from selection + hover target: select (nothing selected, hover friendly unit) / move (empty ground) / attack or harvest (enemy or resource) / enter or capture (transport/structure). Same button, different outcomes depending on context. `DISPLAY.CPP`.

**Modifier keys — Ctrl/Alt force-fire/force-move are CONFIRMED ABSENT from the 1995 original.** A targeted grep of `CONQUER.CPP` (main input loop) and `TECHNO.CPP` (click-context logic) found no Ctrl/Alt force-attack or force-move handling anywhere in core click resolution — the only Ctrl/Alt/Shift uses are team-group and view-bookmark keys (below). Force-fire/force-move were introduced later (Red Alert/Tiberian Sun era or after), not in the original.

**Hotkeys**, all confirmed from `CONQUER.CPP`'s keyboard switch:

| Key | Action | Note |
|---|---|---|
| `Home` | Center map on current selection | falls back to `H` behavior if nothing selected |
| `H` | Select and center on the Construction Yard (or MCV if no Con Yard) | matches task assumption exactly |
| `N` / `Shift+N` | Select next/previous object, cycling through units | not asked about, found incidentally |
| `S` | Selected units → Stop (Idle) | |
| `X` | Selected units → Scatter | |
| `G` | Selected units (that can move+fire) → Guard Area | |
| `1`–`9`, `0` | Plain press = toggle-select team; `Shift`+num = additive select; `Ctrl`+num = assign current selection to that team number | Ctrl+number = today's "assign control group," confirmed present |
| `Alt`+`1`-`9`/`0` | Select team **and** recenter view on it | **Correction**: this is Alt+number, not double-tap — double-tap-to-center is a later-game convention, not C&C95's |
| `F7`–`F10` | 4 view bookmarks: plain press = jump to slot; Shift/Ctrl/Alt+press = record current view into that slot | not F1–F4 (F1 is reserved for multiplayer chat/player list) |
| `Esc`/`Spacebar` | Opens the Options menu | **not** a "jump to last event/radar ping" hotkey in this source — no evidence of that feature in Tiberian Dawn; likely a later-game convention conflated with C&C95 **(?)** |

**Double-click "select all of type on screen"**: searched all inspected source files for double-click detection and **found none** — strongly suggesting this shortcut, common in later RTS, was **not** present in original C&C95. **(?** absence inferred from source silence, not a documented negative **)**

**Drag-box multi-select and Shift-click add/remove**: both present; rubber-band selection is explicit in `DISPLAY.CPP` (`Map.IsRubberBand`). Shift-click add/remove corroborated by community sources rather than directly traced in code this pass. **(?)**

**Deploying the MCV**: uses the `ACTION_SELF` → deploy-cursor path — select the MCV, then left-click the MCV itself (context action), rather than a separate sidebar "Deploy" button. `DISPLAY.CPP`.

**Sell/Repair mode**: entered via the sidebar Repair/Sell buttons, then click a building on the map; cursor changes depending on hover validity (§B.4). Sell mode auto-cancels if nothing sellable remains. `DISPLAY.CPP`, `HOUSE.CPP`.

**Harvester manual targeting**: selecting a Harvester and left-clicking a Tiberium field issues a harvest order that uses the **same cursor as Attack** — a specific, non-obvious detail. `DISPLAY.CPP`.

## B.4 Cursor types

Confirmed via the actual 34-entry `MouseType` enum (`DEFINES.H`) and the `ActionType → MouseType` mapping in `DISPLAY.CPP`, which gives exact trigger conditions. Visual shape/color descriptions beyond the logical name are community knowledge unless noted — flagged **(?)**.

| Cursor | Appearance (?) | Trigger |
|---|---|---|
| `MOUSE_NORMAL` | Standard arrow | Default / no action available |
| `MOUSE_N`…`MOUSE_NW` (8 dirs) | Directional scroll arrow | Cursor at screen edge, that direction scrollable |
| `MOUSE_NO_N`…`MOUSE_NO_NW` (8 dirs) | Directional arrow with "blocked" mark (?) | Cursor at screen edge, map boundary already reached |
| `MOUSE_CAN_MOVE` | Move indicator | Valid ground destination; default when a unit is selected |
| `MOUSE_NO_MOVE` | "No entry" style | Invalid destination (e.g. aircraft can't land there) |
| `MOUSE_CAN_SELECT` | Selection reticle (?) | Hovering a selectable friendly unit |
| `MOUSE_CAN_ATTACK` | Crosshair/target | Attack target, **and** ordering a Harvester onto a resource field |
| `MOUSE_ENTER` | Arrow/door icon (?) | Infantry entering a transport/structure, or engineer capturing a building |
| `MOUSE_DEPLOY` | Deploy icon (?) | MCV deploy / unit self-action |
| `MOUSE_SELL_BACK` | Dollar sign (?) | Sell mode, hovering a sellable owned building |
| `MOUSE_SELL_UNIT` | Dollar sign variant (?) | Sell mode, hovering a sellable owned unit (e.g. in a Repair Facility) |
| `MOUSE_NO_SELL_BACK` | Dollar sign + "no" mark (?) | Sell mode, hovering something not sellable — doubles as the "can't sell this" cursor |
| `MOUSE_REPAIR` | Wrench | Repair mode, hovering a damaged owned building |
| `MOUSE_NO_REPAIR` | Wrench + "no" mark (?) | Repair mode, non-repairable target |
| `MOUSE_RADAR_CURSOR` | Distinct pointer (?) | Hovering the radar panel, nothing selected (jump-scroll) |
| `MOUSE_ION_CANNON` | Targeting reticle (?) | GDI Ion Cannon target-picking |
| `MOUSE_NUCLEAR_BOMB` | Targeting reticle (?) | Nod Nuclear Missile target-picking |
| `MOUSE_AIR_STRIKE` | Targeting reticle (?) | Air-strike support-power targeting |
| `MOUSE_DEMOLITIONS` | Sabotage icon (?) | Engineer/infantry sabotage action |
| `MOUSE_AREA_GUARD` | Shield/guard icon (?) | Matches the `G` Guard Area hotkey |

No separate "can't sell this" cursor exists beyond `MOUSE_NO_SELL_BACK`. Icon pixel/color specifics would require inspecting the actual `.SHP` cursor sprite sheet directly (not done this pass). Sources: `DEFINES.H`, `DISPLAY.CPP`; [ModEnc – Cursor](https://modenc.renegadeprojects.com/Cursor) (confirms the series-wide single-cursor-sheet convention).

## B.5 EVA voice lines

From the shipped `VoxType` enum in `DEFINES.H`, which pairs each internal name with the designers' own inline description — likely the most complete and accurate list obtainable short of the audio files themselves.

| EVA line | Internal name | Confirmed trigger |
|---|---|---|
| "Mission accomplished" | `VOX_ACCOMPLISHED` | Mission win |
| "Your mission has failed" | `VOX_FAIL` | Mission loss |
| "Unable to comply, building in progress" | `VOX_NO_FACTORY` | §B.2 |
| "Construction complete" | `VOX_CONSTRUCTION` | Building/Vehicle/Aircraft finished (§B.2) |
| "Unit ready" | `VOX_UNIT_READY` | Infantry finished (§B.2) |
| "New construction options" | `VOX_NEW_CONSTRUCT` | New sidebar item unlocked |
| "Cannot deploy here" | `VOX_DEPLOY` | Failed deploy attempt |
| "GDI/Nod unit destroyed", "civilian killed" | `VOX_DEAD_GDI`/`VOX_DEAD_NOD`/`VOX_DEAD_CIV` | Faction-specific unit-lost lines |
| "Insufficient funds" | `VOX_NO_CASH` | Defined; no live call site found (§B.2) **(?)** |
| "Battle control terminated" | `VOX_CONTROL_EXIT` | Likely mission/multiplayer handoff **(?)** |
| "Reinforcements have arrived" | `VOX_REINFORCEMENTS` | Reinforcement delivery |
| "Cancelled" | `VOX_CANCELED` | Cancel a held production (§B.2) |
| "Building" | `VOX_BUILDING` | Start/resume production (§B.2) |
| "Low power" | `VOX_LOW_POWER` | Power fraction < 100% and owns Construction Yard, cooldown-limited (`HOUSE.CPP`) |
| "Insufficient power" | `VOX_NO_POWER` | Firing a superweapon without enough power (`HOUSE.CPP`) |
| "Need more funds" | `VOX_NEED_MO_MONEY` | Distinct from "Insufficient funds"; exact call site not traced **(?)** |
| "Our base is under attack" | `VOX_BASE_UNDER_ATTACK` | `HouseClass::Attacked()`, cooldown-limited, player house only — exact wording confirmed (`HOUSE.CPP`) |
| "Incoming missile" / "Enemy planes approaching" / "Nuclear warhead approaching" | `VOX_INCOMING_MISSILE`/`VOX_ENEMY_PLANES`/`VOX_INCOMING_NUKE` | Threat-warning lines |
| "Unable to build more" | `VOX_UNABLE_TO_BUILD` | Build-limit reached **(?)** |
| "Primary building selected" | `VOX_PRIMARY_SELECTED` | Toggling primary (§B.1), `BUILDING.CPP` |
| "Nod building captured" / "GDI building captured" | `VOX_NOD_CAPTURED`/`VOX_GDI_CAPTURED` | Faction-specific — **not** a generic "Building captured" as some fan wikis phrase it |
| "Ion cannon charging" / "Ion cannon ready" | `VOX_ION_CHARGING`/`VOX_ION_READY` | Superweapon status (`HOUSE.CPP`) |
| "Nuclear weapon available" / "launched" | `VOX_NUKE_AVAILABLE`/`VOX_NUKE_LAUNCHED` | Superweapon status (`HOUSE.CPP`) |
| "Unit lost" / "Structure lost" | `VOX_UNIT_LOST`/`VOX_STRUCTURE_LOST` | Player loses a unit/structure |
| "Need harvester" | `VOX_NEED_HARVESTER` | Harvester-related warning; exact trigger not traced **(?)** |
| "Select target" | `VOX_SELECT_TARGET` | Entering superweapon targeting mode (`SIDEBAR.CPP`) |
| "Airstrike ready" / "Not ready" | `VOX_AIRSTRIKE_READY`/`VOX_NOT_READY` | Support-power status |
| "Nod transport sighted" / "loaded" | `VOX_TRANSPORT_SIGHTED`/`VOX_TRANSPORT_LOADED` | Mission-specific triggers |
| "Enemy approaching" | `VOX_PREPARE` | Threat warning |
| "Silos needed" | `VOX_NEED_MO_CAPACITY` | Tiberium storage nearly full, owns Refinery/Con Yard, cooldown-limited — exact wording+trigger confirmed (`HOUSE.CPP`) |
| "On hold" | `VOX_SUSPENDED` | Right-click a building item (§B.2) |
| "Repairing" | `VOX_REPAIRING` | Repair confirmed/in progress |
| "Enemy/GDI/Nod structure destroyed", "Enemy unit destroyed" | various | Combat-log-style announcements |
| *(defined but disabled/unused in shipped TD)* "Affirmative", "Negative", "Upgrade complete", "Repairs completed", "Structure sold", "Radiation levels…", multiplayer color-coded (gold/red/grey/orange/green/blue) lines | various, commented out | Vestigial — likely from Sole Survivor / early multiplayer design, or reused later in Red Alert |

Cross-check: [cnc.fandom.com/wiki/EVA](https://cnc.fandom.com/wiki/EVA) lists a broadly similar set but aggregates across the *entire series*; several of its generic-sounding lines (plain "Building captured," "Structure sold," "Vehicle stolen") are actually faction-specific or disabled/absent in the original 1995 Tiberian Dawn source per the table above — a correction the wiki's series-wide framing obscures.

## B.6 Historical control-scheme evolution + recommendation

**Chronology** (secondary sources — dates/firsts are commonly-cited community consensus, flagged **(?)** where a single game's priority is disputable):
- **Warcraft II (1995)**: pioneered right-click as the universal contextual command (harvest/attack/move all via right-click) — same year as C&C95, opposite philosophy. [jonashietala.se – Evolution of RTS games](https://jonashietala.se/blog/2010/04/23/evolution_of_rts_games)
- **Command & Conquer (1995)**: left-click for everything (context-sensitive), right-click = universal cancel/deselect (§B.3); inherited the sidebar from Dune II (1992); an early, non-modern form of numbered team-select (plain-number toggle-select, not a true "control group assign" as primary gesture).
- **Total Annihilation (1997)**: Ctrl+number creates a group, number recalls it — much closer to the modern convention than C&C95's toggle-select model; right-click sets factory rally points.
- **Age of Empires (1997)**: Shift+drag to group, Ctrl+number to assign, number to recall — shipped without hold-position/patrol/waypoints at launch.
- **StarCraft (1998)**: popularized **attack-move** (press `A`, then click — units move there but auto-engage anything encountered en route). [starcraft.fandom.com – Attack move](https://starcraft.fandom.com/wiki/Attack_move)
- **Early 2000s convergence** (Red Alert 2, Age of Empires II, StarCraft): industry-standard right-click-universal-command, Ctrl+number assign / number recall control groups, dedicated attack-move key, rally points as baseline. C&C's own later titles (Red Alert 2 onward) adopted right-click-as-command, abandoning C&C95's original model.
- **2020 C&C Remastered Collection** ships **both** as a toggle: "Legacy" preserves the original left-click-for-everything model; "Modern" enables right-click move/attack. It also *added* genuine production queuing/stacking while keeping the original's two-stage hold-then-cancel gesture. [Steam Community – Legacy vs Modern](https://steamcommunity.com/app/1213210/discussions/0/3030299766079626899)

**Recommendation for a Dune II remake wanting "C&C95 feel, modern comfort"** (researchers' own analysis, not sourced):
1. Make **right-click the universal contextual command** (move/attack/enter/harvest) and **drop right-click-to-deselect**. This is the single highest-value modernization — muscle memory since 1997–98 expects it, and it's the biggest thing that reads as "clunky" about the original, not the sidebar.
2. **Keep the C&C-style sidebar wholesale** — two build strips, clock-wipe progress, Ready/On-Hold pips, Repair/Sell/Map buttons. Strongest nostalgia signal, costs nothing against modern mouse conventions.
3. **Add real production queuing** (stack multiples, count badge) — the original's single-slot limit was a 1995 technical constraint, not a beloved feature; the 2020 Remaster proved removing it has no downside.
4. **Keep the two-stage "click to hold, click again to cancel-with-refund" gesture**, remapped to left-click on the sidebar icon (since right-click is now freed for the game world) — a good, safe pattern worth preserving verbatim.
5. **Add attack-move on `A`** (StarCraft-style) — cheap, universally expected, no conflicts with the C&C-style sidebar.
6. **Adopt modern control groups**: Ctrl+number assign, number select, double-tap-number to center (rather than C&C95's Alt+number) — double-tap is now the more universal convention and frees Alt as a general modifier.
7. **Add force-attack/force-move modifiers** even though C&C95 never had them — low-cost, high value for veteran players.
8. **Keep G/S/X (Guard/Stop/Scatter) and Home/H (center-on-base) verbatim** — already ergonomic and match modern conventions closely enough.
9. **Add rally points** for production structures — absent from both Dune II and C&C95, but now a baseline expectation with no nostalgia cost.
10. Treat C&C95's Alt+number, absent double-click-select-all, and absent force-fire as **deliberate omissions to skip**, not features to resurrect — they were mostly artifacts of 1994–95 engine limitations (single global click handler, no gesture-timing infrastructure) rather than intentional design.

---

## Appendix: notable gaps / unresolved (?)

- **Sega Genesis audio**: Sega Retro and VGMRips.net were unreachable both times (JS proof-of-work bot-wall blocked automated fetches, including via Wayback Machine). No confirmed full Genesis music track list or arranger credit beyond Klepacki himself; exact Genesis voice-sample list unconfirmed.
- Dune II per-house announcer **accent/character** (e.g. "Harkonnen sounds gruffer") — no source found; the *fact* that houses differ is confirmed, the *character* of the difference is not.
- Exact wording of "Radar On"/"Radar Off" and "Our base is under attack" banner text are filename/code-decoded, not transcript-confirmed against actual audio playback.
- Formal music-theory analysis of the Dune II OST is thin online; §A.2's scale/tempo/instrumentation description beyond the one sourced Lydian Dominant / 120-song-index facts is the researchers' own ear-based judgment, explicitly flagged.
- C&C95: exact call site (if any) for `VOX_NO_CASH` ("Insufficient funds") not found; exact placement-cell colors (white/green vs red) and credits-counter screen position not re-verified from source; cursor *visual* appearance (vs. logical trigger, which is source-confirmed) is community knowledge, not asset-verified.
- Dune II PAK content mapping (which files live inside ATRE.PAK/HARK.PAK/etc.) is inferred from filenames + loader logic, not an observed directory listing.
- Copyright section: whether EA's original Dune-license (via Virgin, pre-dating Herbert Properties' 2019 Funcom deal) formally lapsed, or simply wasn't renewed, is not confirmed by a primary legal source.
