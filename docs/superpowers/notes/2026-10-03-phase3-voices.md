# Phase 3 — a voice for each kind of unit, and the missions' announcer line

Branch `phase3/voices` (from `phase3/integration` at `dc2061e`). Spec §6 Announcer; research
`p3map/voices.md` §8–§12 (Plan A), OpenDUNE's reply rules (unit.c `Unit_Select`, gui/viewport.c,
gui/widget_click.c, table/actioninfo.c) for the original-files mapping. The manager asked for different
voices for different kinds of units; the Mega Drive release credits one unit voice (Glenn Sperry) and the
PC game shares one reply set, so per-kind voices go beyond both originals by request.

## What it does

- **Ten voice groups** (`src/data/unit-voices.js`): `grunt` (Light Infantry, Infantry Squad), `trooper`
  (Heavy Trooper, Trooper Squad), `scout` (Trike, Raider Trike, Quad), `tanker` (Combat, Siege, Missile
  Tank and the Sonic Tank, Deviator, Devastator), `harvester`, `carryall`, `mcv`, `ornithopter`,
  `saboteur`, `fremen` (selection only: they take no orders). The Frigate and the sandworm are listed
  silent (nobody's to select). 119 lines, 1–4 words each, our own wording, in `scripts/voices/lines.json`
  under `"unitVoices"`; ids `unit.<group>.<kind>.<n>`, files `assets/voice/<group>/<kind>.<n>.ogg`.
- **Kinds** per sim command and unit (`replyKind`): select, move, attack, attackMove (unarmed units: move),
  guard, scatter, capture (the four capturing infantry types), sabotage, harvest, return (Harvester's
  returnToBase), repair (ground vehicles to a Repair Facility), deploy (MCV), destruct (Devastator, also its
  D), and the Carryall's own: lift, duty (G), drop (D), deliver (returnToBase/repairAt with a load), move.
  Stop and every production or structure order stay unanswered; a Fremen ordered about says nothing. A kind
  a group has no words for borrows the nearest (`voicedKind`: scatter → move, guard → select, …); a test
  pins that the telling ones (attack, harvest, deploy, lift, sabotage, …) are always the group's own.
- **Who speaks** (`src/game/announcer.js`): for an order, the first of the player's own units in the command
  that takes it (not inside a bay or Carryall, not a visiting Carryall, not counting down to self-destruct;
  with D and an MCV along, the MCV, as `deployOrDestruct` deploys it and blows nothing up); for a selection,
  one of the freshly selected units at random. Never the same variant twice running per group and kind
  (`pickVariant`). When the voice output lacks the unit's line, the old shared reply stands in
  (`ackForCommand(cmd, rng)` and `SELECT_ACKS`, unchanged). On a group's first selection its move and attack
  lines are decoded in the background (`WebVoiceOutput.prefetch`).
- **Queue classes** (`src/audio/voice.js`): `select` (maxAge 0.7 s, cooldown 0.8 s) and `order` (maxAge
  1.2 s, cooldown 1.2 s), both priority 0 and spoken at once. An order's answer replaces a selection answer
  still waiting, and cuts short one being spoken (as the original's equal-priority replies replaced each
  other); it never cuts the announcer or another order answer. The legacy `ack` class (0.7 s / 1.4 s) stays
  for the old shared lines. `ACK_LINES`, `SELECT_ACKS`, `ackForCommand` and `summarize()`'s fields are as
  before.
- **Original-files mode** (`src/formats/dune2-sounds.js`): `UNIT_CLIPS` (beside `ACK_CLIPS`, which is
  unchanged) maps every unit line to the PC reply clip the original plays in that place: selecting a man on
  foot REPORT1, a vehicle REPORT2; an order to a man on foot his action's clip (move and capture MOVEOUT;
  attack, attack-move, guard, scatter OVEROUT; sabotage REPORT3); an order to a vehicle REPORT3 or AFFIRM,
  alternating by variant (the original drew them 50/50). So with the player's files on, no Kokoro line is
  mixed into the replies. Lines sharing a clip share one decoded buffer.
- **Reinforcements (contract C9)**: `'reinforcements'` → "Reinforcements have arrived." in `EVA_LINES`
  (class news), rendered for the three house announcers with their own voices and chains. Original mode
  keeps our voice for it (no PC clip is known for it).

## Voices (chosen by grade, contrast and a Whisper check; see "Measurements")

| group | Kokoro voice | delivery |
|---|---|---|
| grunt | am_michael ×1.08 | the old field radio: hiss, clipper, squelch |
| trooper | bm_george, tape ×0.94 | boxier, harder-clipped radio ("powered suit") |
| scout | am_puck ×1.04 | clean light radio, wind bed |
| tanker | bm_fable | tank intercom, small metal cabin, engine bed |
| harvester | af_sarah ×0.95 | cab speaker, machinery hum |
| carryall | af_kore | pilot's headset (400–3200 Hz), wind |
| mcv | bm_lewis ×0.97 | calm convoy radio |
| ornithopter | af_nova, tape ×1.05 | cockpit, rush of air |
| saboteur | af_nicole ×0.92 | close and dry, no radio |
| fremen | blend 0.6 bm_george + 0.4 am_fenrir, tape ×0.9 | open desert echo |

Ten different voices (the Fremen blend shares a parent with the Troopers but is lowered and blended).
House announcers unchanged; their 195 files are byte-identical (only new files were rendered; the
pipeline was first checked by rendering `units/reporting` and `atreides/unitReady` into scratch: both
came out byte-identical to the shipped files).

## How to test

- `node --test tests/unit-voices.test.mjs tests/voice.test.mjs tests/announcer.test.mjs tests/original-sounds.test.mjs tests/original-files.test.mjs`
- Browser (real GPU): `?scene=battle&idle=1&specials=1`, then `await __dune.voiceCheck()` decodes every
  line of the house (lines, decoded, missing); select units and read `__dune.voice().said`.
- Listening: the audition page
  `/tmp/claude-1000/-home-hassan-games-Dune/4a2127ac-cad7-477b-b1e2-a8fc90205fa5/scratchpad/voices/audition/index.html`
  (outside the repo; 166 players: three or four probe lines of every group in each candidate voice, and the
  whole scout set at the shipped ×1.04; regenerate with `generate.py --models <dir> --audition <dir> --sets
  <group> --voices a,b:speed:tape`) has a player per candidate voice and line.

## Measurements

All numbers from the shipped files (`assets/voice/`), measured with ffmpeg `ebur128` and Whisper `small.en`
(int8, 2 threads; `scratchpad/voices/judge.py`, results in `scratchpad/voices/final-judge.json` and
`scout-final.json`).

- **Size**: 317 lines, 1,656,147 bytes in all (budget in `tests/voice.test.mjs`: 2.5 MB, each file
  1–20 kB); the 119 unit lines are 545,354 bytes, the three reinforcements lines 6.3–7.0 kB.
- **Loudness**: unit lines −17.0 to −15.5 LUFS integrated (target −16), true peak at most −1.2 dBFS;
  reinforcements −16.0 / −16.5 / −16.1 LUFS, peak −1.7 / −5.3 / −1.3 dBFS (Atreides, Harkonnen, Ordos).
- **Duration**: unit lines 0.67–2.12 s (means per group: scout 0.90, grunt 0.99, ornithopter 1.04, saboteur
  1.02, mcv 1.06, tanker 1.09, harvester 1.14, trooper 1.34, fremen 1.58); speech starts within 0.16 s
  (most within 0.06 s); the last 120 ms sit at least 12.9 dB under the loudest part (no stray syllable).
  Reinforcements 1.65 / 1.70 / 1.52 s.
- **Whisper round trip** (does a listener hear the words?): 117 of 122 new lines exactly. Of the five
  others, three are spelling only ("Carry all", "Armor", "Thopter" → "Opta": a made-up word) and two
  are near misses a person will likely not notice: trooper "Locked on." → "Lockdown!", harvester
  "On our way." → "On our ways.". The scout set was at ×1.12 and lost three lines ("Strafing",
  "Scouting ahead", "Full throttle"); rendered again at ×1.04 with "Hitting the gas." it is 14/14.
  All three reinforcements lines heard word for word.
- **Determinism**: rendering the scout set twice gave byte-identical files; `units/reporting` and
  `atreides/unitReady` rendered into scratch are byte-identical to the shipped ones, and
  `git diff dc2061e --stat -- assets/voice` lists no change to any of the 195 older files.
- **Browser, real GPU** (`?scene=battle&idle=1&specials=1`, Linux Chrome via dune-shot):
  `__dune.voiceCheck()` → 191 lines for the house (its announcer, the 119 unit lines, the 9 old replies),
  191 decoded at 48 kHz, none missing, 0.67–2.25 s; no console errors. Selecting each unit type in turn
  gives its own group: soldier/infantry `unit.grunt.select.*`, trooper/troopers `unit.trooper.*`, Fremen
  `unit.fremen.*`, Saboteur `unit.saboteur.*`, trike/raider/quad `unit.scout.*`, the six tanks
  `unit.tanker.*`, harvester, MCV, Carryall, Ornithopter their own; orders: harvest
  `unit.harvester.harvest.2`, Carryall G `unit.carryall.duty.2`, Troopers attack `unit.trooper.attack.3`,
  Saboteur move, Quad move `unit.scout.move.3`, Ornithopter move then G (`move.*`, `guard.*`), MCV D
  `unit.mcv.deploy.2` then the announcer's `yardDeployed`; Fremen ordered: nothing. A Combat Tank selected
  and moved 0.3 s later: `unit.tanker.select.1` then `unit.tanker.move.1` (the order's answer cut the
  selection's short). Selecting the same type twice never gave the same variant twice running.
- Kokoro on this laptop with ten streams running (load average ~30): 2–5 s a line, 14 lines in ~2 min.

## Decisions

- Plan A (10 groups, 119 lines), not the IX split: the Sonic Tank, Deviator and Devastator speak as
  tank crews (the Devastator keeps "Self-destruct armed." / "Detonation set." for its D).
- Stop stays silent, as before; vehicles do answer panel orders (guard, scatter, deploy), unlike the PC
  original which kept them quiet — the reply confirms the click.
- Unit voices are house-independent (units are shared by the houses; the announcer is the house's).
- Unit lines are trimmed of Kokoro's own silence before shaping (judged in the 300 Hz–4 kHz band:
  bm_fable murmurs under 300 Hz for up to 0.6 s after its last word), so replies start about 40 ms in.
- Wording changed after the Whisper check: "Course set." was heard as "Core set" in all three headset
  voices tried, so the Carryall says "Heading out." and the Ornithopter "On approach."; the scout's
  "Full throttle." (heard "Cool throttle" at both speeds tried) became "Hitting the gas.", and the scout
  voice was slowed from ×1.12 to ×1.04.
- The interrupted first run left the rendered files uncommitted with the Whisper check half done; the
  continuation committed them unchanged, ran the check on all 122 new files, and re-rendered only the
  scout set.

## Pitfalls for the next run

- Keep the Python venv on a short path (e.g. `/tmp/tts`): the espeak-ng inside espeakng-loader ignores
  a data directory longer than 160 characters and exits looking for its build machine's
  `/home/runner/.../phontab`. `uv venv --python 3.12` (uv's default 3.14 is refused by kokoro-onnx 0.6.1).
- Kokoro takes 2–5 s per short line on this laptop while other jobs run (2 threads); ~0.5 GB resident.

## Open questions

- Nobody has listened yet: the choices rest on the model card's grades, objective checks and Whisper.
  The audition page has the candidates side by side for the manager's ear.
- The Mega Drive's own unit replies are undocumented here; if a person compares, the grunt voice is the
  closest to "one soldier on a radio".

## For the README

Replace the paragraph "Units answer their orders …" in "Announcer voices" with:

> Every kind of unit answers in a voice of its own when it is selected or given an order: foot soldiers
> on a field radio ("Reporting", "Moving out", "Taking the building"), Heavy Troopers in their powered
> suits, Trike and Quad riders on the wind, tank crews on the intercom ("Target acquired"), the Harvester
> driver ("Heading to the spice"), the Carryall and Ornithopter pilots in their headsets, the MCV's
> driver, the Saboteur close and quiet, and the Fremen far out in the desert. The first unit that takes
> the order answers, never with the same words twice running; an order's answer cuts short a unit still
> reporting in. With the original game files on, every reply is the original's own clip, chosen as the
> original chose it.

and in the files paragraph: "195 short Ogg Opus lines (about 1.1 MB)" → "317 short Ogg Opus lines
(about 1.7 MB)", and the voice list → "voices `af_heart` (Atreides), `am_fenrir` slowed like a tape
(Harkonnen), `af_bella` (Ordos) and, for the units, `am_michael`, `bm_george`, `am_puck`, `bm_fable`,
`af_sarah`, `af_kore`, `bm_lewis`, `af_nova`, `af_nicole` and a blend of `bm_george` and `am_fenrir`".
Also: the announcer says "Reinforcements have arrived." when a mission's reinforcements land.
