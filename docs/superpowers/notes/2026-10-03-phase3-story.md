# Phase 3 — the campaign's words (story stream, contract C4)

`src/data/story.js` holds every line the campaign shows; `tests/story.test.mjs` holds it to the rules.
Nothing else changed.

## What is in it

| Export | Shape | Content |
|---|---|---|
| `MENTATS` | `{ atreides: { name: 'Cyril' }, harkonnen: { name: 'Radnor' }, ordos: { name: 'Ammon' } }` | as `src/data/houses.js` names them |
| `HOUSE_PAGES[house]` | 3 pages, each an array of 2-3 lines | tradition, ruler, homeworld (Caladan, Giedi Prime, an unnamed frozen world) |
| `joinQuestion(house)` | string, `null` for a house the player cannot join | "Will you stand with House Atreides?", "Will you serve House Harkonnen?", "Will you sign on with House Ordos?" |
| `BRIEFINGS[house][n - 1]` | `{ briefing, advice, win, lose }`, string arrays | 27 missions; briefing 5-8 lines, advice 3-5, win and lose 2 each |
| `ENDINGS[house]` | 5-8 lines | the Mentat's last words after mission 9 |
| `MAP_CAPTIONS[house][step]` | 10 strings | step 0 = before mission 1, step n = after mission n is won |
| `CREDITS` | `[{ role, names: [] }]` | 8 entries: the remake, "After Westwood Studios' Dune: The Battle for Arrakis for the Sega Mega Drive", what was made for it, Kokoro-82M (Apache-2.0) via kokoro-onnx (MIT), the ymfm YM2612 port (Aaron Giles, BSD-3-Clause), three.js (MIT), rights and no affiliation, a closing line |

385 briefing lines in all; every line at most 56 characters, plain ASCII (straight apostrophes), no markup.

## Decisions

- **The Sega mission table rules** (research §6), not the spec §7 table: mission 9 is the Emperor's two
  Sardaukar bases only, so mission 9 briefings name no rival House; mission 8 names both rivals; the two-base
  missions say "two" or "both". Mission 1 is the 1000-credit quota with enemy patrols and no base; mission 2 is
  2700 credits *or* the enemy base; 3-9 are "destroy".
- **Who each briefing names** (this is what C1's `enemies` should hold; the test encodes it):

  | M | Atreides | Ordos | Harkonnen |
  |---|---|---|---|
  | 1 | ordos | harkonnen | atreides |
  | 2 | ordos | harkonnen | atreides |
  | 3 | harkonnen | atreides | ordos |
  | 4 | harkonnen, sardaukar | atreides, sardaukar | ordos, sardaukar |
  | 5 | ordos, sardaukar | harkonnen (2 bases), sardaukar | atreides, sardaukar |
  | 6 | harkonnen, sardaukar | atreides (2 bases), sardaukar | ordos (2 bases), sardaukar |
  | 7 | ordos (2 bases), sardaukar | harkonnen (2 bases), sardaukar | atreides (2 bases), sardaukar |
  | 8 | ordos, harkonnen, sardaukar | atreides, harkonnen, sardaukar | atreides, ordos, sardaukar |
  | 9 | sardaukar (2 bases) | sardaukar (2 bases) | sardaukar (2 bases) |

  Missions 4-8 name the Sardaukar because the brief says their Troopers drop in "from mission 4". Mission 4 says
  they have arrived; 5-8 warn that they *may* come again, so the words stay true whether or not the scenarios
  stream drops Sardaukar in every one of those missions (the PC drops them in 4 and 8 only).
- **The advice follows the Sega ladder** (research §6 tech, upgrades and units on sale): 1 concrete, Wind Trap,
  Spice Refinery; 2 Silos (only stored spice counts), Radar Outpost, Barracks and Trikes (Atreides), Barracks,
  capturing with Infantry and Raider Trikes (Ordos), WOR and Troopers (Harkonnen, whose vehicle factory waits
  for mission 3); 3 Quads (Harkonnen: the Heavy Factory itself), worms; 4 Combat Tanks, Walls, Trooper upgrades;
  5 Hi-Tech and Carryalls, Repair Facility, Missile Tanks (Atreides upgrade, Harkonnen already have them; Ordos
  get Gun Turrets instead); 6 Rocket Turrets, Starport, Siege Tanks (Ordos: Missile Tanks from the Starport and
  Trooper squads); 7 the house tank (Sonic Tank, Devastator with its self-destruct, Deviator), Ornithopters for
  Atreides and Ordos, Siege Tanks for Ordos; 8 the Palace (needs a Starport) and its weapon; 9 the Sardaukar
  Palace's Death Hand and flank raids. No Harkonnen Ornithopters, no House of IX, no Light Factory.
- **Building and unit names are this game's menu names** (`src/data/structures.js`, `units.js`): Wind Trap,
  Spice Refinery, Spice Silo, Radar Outpost, Heavy Factory (the one vehicle factory), WOR, Hi-Tech Factory,
  Repair Facility, Gun Turret, Rocket Turret, Construction Yard. If a name changes there, the advice must follow.
- **Voices.** Cyril: calm, courteous, credits the player, "the Duke". Radnor: sneers, threatens with "the Baron",
  enjoys cruelty, praises grudgingly. Ammon: short sentences, ledgers, contracts, margins, "the Council".
- **Endings** follow research §6's fates: the Atreides make the Emperor give up his throne and stand trial; the
  Harkonnen kill him; the Ordos leave him on his throne as their puppet.
- **Original text.** Nothing is copied. The few original lines the research quotes (and the PC intro captions)
  are in the test as forbidden phrases, checked per line and across line breaks.
- **Lines and pages.** The Sega screen types two lines at a time; sections of odd length (25 of 108) leave one
  line on their last page, and sentences may run across a page break, as in the original. Rewriting for even
  pages is a cheap follow-up if the campaign screen looks better that way.
- **Credits** name no person: the brief asked for the project, the borrowed parts and the attribution. The lead
  may add a "Made by" entry.

## How to test

- `node --test tests/story.test.mjs` — 11 tests: Mentat names, pages and question, section lengths, 56-character
  plain lines, no line used twice, the enemy table above, the objectives (1000, 2700 or the base, destroy), the
  advice per mission, the original-phrase guard, the credits' required names and the no-affiliation line.
- The last test cross-checks `src/data/campaign.js` (scenarios stream) once it is merged and skips until then:
  every enemy in `missionDef(h, n).enemies` must be named in that briefing, the briefing may name no Great House
  the mission lacks (Sardaukar warnings are allowed), and a quota must appear as "<quota> credits". I ran it
  against a throwaway stub of the table above: it passes with or without `sardaukar` listed for missions 4-8 and
  fails, as meant, if mission 9 lists the rival Houses.
- Full suite under the lock: 907 pass, 1 skipped (that cross-check), 0 fail.

## Measurements

27 briefings, 385 lines; the longest briefing line is 55 characters (the limit is 56). No GPU or audio involved.

## What a person should proofread

1. Read one mission per house aloud (say 1, 5 and 9): does each Mentat sound like himself all the way through?
2. Radnor's jokes at the player's expense (Harkonnen losses 1, 5, 7): funny, or too much?
3. The facts in the advice against the game once the Sega ladder (scenarios stream) is merged: which upgrade
   unlocks what, Harkonnen Missile Tanks already available in mission 5, Ordos Missile Tanks only from the
   Starport, a Palace needing a Starport, the Devastator's self-destruct.
4. Whether the missions really drop Sardaukar where the briefing warns of them (4 says they have come).
5. That mission 9's map really is two Sardaukar bases and no rival House.
6. Map captions against the atlas once it shows real territory (they name no compass directions on purpose).

## Open questions and integration

- The scenarios stream's `missionDef(h, n).enemies` should match the table above; the cross-check test catches
  any mismatch at integration.
- Who shows the house pages (the Mentat or a narrator) is the campaign screen's choice; the Atreides pages are
  in the third person, the Harkonnen and Ordos pages say "we", as the Sega lines quoted in the research do.

## For the README

Under the campaign section:

> Every word of the campaign is written for this remake (`src/data/story.js`): three pages and a question for
> each house, the Mentats' briefing, advice, victory and defeat lines for the nine missions of each house —
> Cyril of House Atreides fair and calm, Radnor of House Harkonnen cruel and sly, Ammon of House Ordos
> mercantile and curt — their last words after the final battle, a caption for each step of the territory map
> and the credits roll. The missions follow the Sega Mega Drive campaign: who each briefing sends you against and
> what each piece of advice offers match its mission table and tech ladder.
