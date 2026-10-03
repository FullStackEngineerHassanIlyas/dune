# Phase 3 — campaign stream (the campaign in the menu shell)

Branch `phase3/campaign`, from `phase3/integration` at dc2061e (the seams commit). Spec §5.8, §7, §12;
research.md §4-§6 (Sega flow, Mentats, passwords, ranks, score screen), battle-flow.md §2-§3 (menu and shell).

## What it does

Main menu → **Campaign** (now the first entry) → the hub: *Continue · House X* (one row per house with a saved
campaign, the house played last first), *New campaign*, *Enter password*, and *Ending · House X* for a house that
has won. New campaign → **Select your House**: three gold-framed crests, left to right Atreides, Ordos, Harkonnen
as on the Sega screen (music `houseSelect`) → the house's Mentat on his stage with the map behind him: the house's
pages (three on the Sega), then "Do you wish to join House X?" Yes/No → the **briefing**: the Mentat's words typed
two lines at a time, *Proceed* and *Advice*, the mission's title and objective, the territory map behind (music
`briefing:<house>`) → **region zoom** (`atlas.zoomTo`, music `region`, 7 s or Enter/click) → the mission in the
shell's frame (`scene=mission&house=<h>&mission=<n>`, contract C2).

The battle posts `missionEnd`; the campaign saves and calls `shell.quit('campaign-results')`. A win: the
**Victory** card (6 s of drawn frames, or Continue) → the Mentat's win lines while the map takes the new land
(`atlas.conquer`) → the **score screen** (SCORE n, TIME h:mm, "You have attained the rank of …", Spice harvested /
Units destroyed / Structures destroyed by You (red) and Enemy (blue), bars filling row by row; no structures row in
mission 1) → the **password** for the next mission (music turns to the Mentat's theme here, as on the Sega) → the
next briefing. A loss: the Mentat's lose lines (music `defeat:<house>`) → *Try again* → the same briefing. Mission
9 won: victory, the Mentat's win lines and final words (`ENDINGS`), score → `playEnding` (C12) → the title; the
hub's *Ending · House X* shows the final words again, then the ending. A password for a mission before the saved
one is a replay: the briefing says so and the save stays where it was (a won Arrakis stays won).
Quitting a mission (`{ dune: 'quit', screen: 'campaign' }`) comes back to its briefing.

The title wears the Sega lockup: DUNE in widely spaced dark-red serif capitals with a metallic sheen and a dark
rim, "The Battle for Arrakis" in a plain light serif below; the menu column stays left, the planet right. The
footer says: non-commercial fan remake, not affiliated with Electronic Arts or Sega, after Westwood Studios' 1992
game as released on the Sega Mega Drive.

## Files

- `src/campaign/` (pure, Node-tested): `progress.js` (save/load, per house), `score.js` (C11 score, nine ranks,
  h:mm), `passwords.js` (the 24 Sega words), `result.js` (the missionEnd message read defensively, a sample result
  for development shots), `flow.js` (the screen flow as `step(progress, state, action)`, the launch query,
  `resolveScreen`, Back targets).
- `src/ui/campaign/`: `index.js` (the controller MainMenu delegates the nine campaign screens to), `stage.js` (the
  Mentat's stage and the two-lines typer), `results.js` (victory card, score screen, password), `map.js` (the atlas
  wrapper with the flat-map fallback), `words.js` (story and mission-list lookups with fallbacks), `portraits.js`,
  `crests.js`, `art.js` (all pictures: our own SVG).
- `src/ui/main-menu.js` (Campaign entry, delegation, `show(screen)`, the lockup), `src/ui/menu.css` (lockup, the
  title column fits 720 px), `src/ui/campaign.css`.
- Tests: `tests/campaign-score.test.mjs`, `campaign-progress`, `campaign-flow`, `campaign-screens` (the whole flow
  through a fake DOM), `campaign-stage` (typer and bars on a hand-turned clock); helper `tests/campaign-dom.mjs`.
- `scripts/e2e-campaign.mjs`, `scripts/scenarios/campaign.mjs` (12 smoke scenes).

## Decisions

- **Progress** lives under `localStorage['dune2-3d.campaign']` = `{ version: 1, house, houses: { <house>: { mission
  (next to play, 10 = won), best: { <n>: score } } }, last }`. Anything else (corrupt JSON, another version, junk
  fields) reads as an empty campaign or is cleaned field by field; a blocked or full store never throws, the game
  goes on for the visit and the hub says progress is not kept. The Sega had no saves, only passwords; the spec asks
  for localStorage, so both exist.
- **New campaign** for a house that has a saved game starts that house again at mission 1 (the Sega's "pick
  another house" did the same); the join question says so and points at Continue. Other houses keep their place.
- **Passwords**: completing mission n shows the word for mission n+1 (research.md §6: "your password for
  completing House X mission n"); entry is case-insensitive and keeps letters only, ten at most, typed or picked on
  a Sega-like letter grid. Debug words (DUNEFINALE …) are not supported.
- **Score and ranks** exactly as C11; the three highest thresholds are estimates (research.md §5).
- **The results screen name**: the contract's `quit('campaign-results')` is used for wins and losses alike; the
  menu turns a lost result into `campaign-defeat` (`resolveScreen`).
- **The backdrop** is held still (`setPaused(true)`: no frames, no CPU or GPU work) behind every full-screen
  campaign stage and handed back (as the player's Pause setting has it, and started if it was stopped) on the hub,
  the password entry and the title. The atlas is disposed whenever no screen shows it (hub, password, the score and
  password parts of the results, the title, and before a mission starts), so the battle gets the shared graphics
  memory back.
- **The victory card** counts its six seconds in drawn frames: on the way back from a battle the menu restores
  its WebGL context, which took seven seconds in the SwiftShader e2e run, and a plain timer skipped the card.
- **Fallbacks while the other streams land**: no story → "Briefing not available." and plain house/join lines; no
  mission list → "Mission n of 9" and no objective line; no atlas (or no WebGL) → a flat coloured map of 24 cells
  (the player's land spreading from its corner, the Sardaukar holding a corner before the last mission) whose
  region zoom is a 7 s CSS zoom onto the target cell; no `music.mood` → `briefing(house)` / `briefing(null)`.
- **Mentats, crests, victory card, score line art**: our own SVG drawings after research.md §4's descriptions;
  nothing traced or copied. Crest motifs: hawk, serpent, ram (spec §5.8).
- **Keyboard**: every button has `data-act`; Enter and Space work on the focused button, arrow keys move between
  the crests, Space or → reads on in the Mentat's words, Esc steps back (join → houses → hub → title, region →
  briefing) or on (results parts, defeat → retry, ending → plays it). The first crest, the primary button or the
  password field takes the focus on each screen. The whole of the Mentat's words is in a polite live region.

## How to test

- Unit: `node --test tests/campaign-*.test.mjs tests/menu-entries.test.mjs` (76 tests).
- End to end: `flock /tmp/dune-chrome.lock env E2E_CAMPAIGN_PORT=8620 node scripts/e2e-campaign.mjs` (25 checks).
- Smoke: `flock /tmp/dune-chrome.lock env SMOKE_PORT=8623 node scripts/smoke.mjs campaign-hub campaign-house
  campaign-join campaign-briefing campaign-region campaign-victory campaign-win campaign-score
  campaign-password-reveal campaign-password campaign-defeat campaign-ending`.
- Any screen by address: `?scene=menu&intro=0&screen=<campaign screen>&house=<h>&mission=<n>`; for the results
  also `&stage=victory|mentat|score|password` and `&won=0` (a sample result is shown, never saved).

## Measurements

- Full unit suite 956/956 (under the npm-test lock); campaign e2e 25/25; the 12 smoke scenes pass without console
  errors.
- Looked at on the real GPU (Chrome, ANGLE/GL) at 1600x900, 1280x720, 1024x520, 800x900 and 420x860: title, hub,
  houses, join, briefing, region (start and mid-zoom), victory, win lines, score, password reveal, password entry,
  defeat, ending. At 1280x720 the title column now fits: the footer ends at 691 px of 720 (it was cut off at the
  window's edge; by the CSS the old lockup's column was as tall). On the briefing the menu backdrop reports
  paused (held still) behind the stage.
- The campaign screens draw nothing per frame of their own: static SVG and CSS; the typer and the score bars run
  on timers of 26-45 ms only while text or bars move.

## Open questions

- The real atlas, story words, mission list and music moods were not available on this branch; every call is
  against the contracts and covered by injected fakes in the tests. Check after the merge: the atlas canvas inside
  `.cp-map` (moved between screens; `resize()` after each move), `MAP_CAPTIONS[house][step]` with step = missions
  won before the zoom (0-8), `ENDINGS[house]` as the Mentat's final words before the ending.
- Whether `music.mood('menu')` restarts the title theme when it is already playing (the campaign asks for it once
  when the player goes back to the title or the hub after another mood).

## Review fixes

From the review of this branch (each reproduced by a test that failed first, then fixed):

- **A password no longer lowers a save** (important). `jumpTo` and `recordResult` never move a house's saved
  mission back: a password for mission 2 with a save at 7 (or a won Arrakis) plays mission 2 onwards as a replay,
  and the save moves only once the replay passes it. The briefing's note says "A replay: your saved game stays at
  mission 7." Tests: `campaign-progress` (replay, won house), `campaign-flow` (password → win → next), and
  `campaign-screens` (the note, the save left at 7).
- **Yes on a won house** keeps the win: a house record gains `won: true` once Arrakis is won (an older save at
  mission 10 reads as won), kept when the house starts again, so the hub still offers its ending; the join screen
  now says "Yes starts House X again at mission 1; Arrakis stays won in your record."
- **A failed save is told where it matters**: the Mentat's stage shows the hub's warning once a save has failed, and
  the password screen says "This browser is not keeping your progress: note this password." instead of claiming
  the progress is saved.
- **After mission 9** the Mentat's win lines and final words come before the score, and the score leads straight
  to the ending (flow step `next` returns `ending: true`); `campaign-ending` remains the hub's replay of it.
- **Atlas load race**: a map closed while the atlas module was still loading no longer leaves the next map screen
  on the flat stand-in; a load begun before a dispose creates nothing and the next screen starts its own
  (`tests/campaign-map.test.mjs`).
- **e2e after a reload**: every click now waits until the element is what a click at its centre hits, and the
  title must be visible (the merged intro's `#app.intro-checked` gate) before the first click after a load; the
  screen waits allow 20 s for the first load of the words and the mission list.
- **Victory card**: the words sit higher (top 5vh, title 10vw) and the subtitle has a soft parchment band, so the
  flag's knob and the frigate's glow no longer touch it at 16:9; on narrow windows the words start below the Full
  screen button. Looked at on the real GPU at 1280x720, 1600x900 and 390x844.
- **Three enemies** read "House Ordos, House Harkonnen and the Emperor's Sardaukar."
- Not changed: this notes file lies outside the stream's listed files (the lead decides whether per-stream notes
  under `docs/superpowers/notes/` are blessed).

Measured after the fixes: full unit suite 966/966 (under the npm-test lock), campaign tests 76/76, campaign e2e
25/25 on the branch, the 12 smoke scenes pass.

## For the README

Status (replace the Phase 3 sentence): Phase 3 brings the campaign of the Sega Mega Drive release: choose Atreides,
Ordos or Harkonnen, hear your Mentat's briefing over the map of Arrakis, fight nine missions, and after each win
see the victory card, the score and rank screen and the mission's password; a lost mission is briefed again.
Progress is saved in the browser, and the Sega passwords take you to any mission.

New section **Campaign**:

> Main menu → Campaign. *New campaign* picks a house (Atreides, Ordos, Harkonnen) and starts at mission 1;
> *Continue* goes back to the next mission of a house you have played; *Enter password* takes a ten-letter Sega
> password (case does not matter) to that house and mission. In a briefing, *Advice* shows the Mentat's tip and
> *Proceed* starts the mission after a look at its region (Enter skips the zoom). After a mission: the score
> (enemy buildings destroyed, minus your own lost, plus what still stands, a point per 100 credits and a bonus for
> finishing under 45 minutes a mission) and your rank, from Sand Snake to Ruler of Arrakis. Progress is kept in
> this browser under `dune2-3d.campaign`.
>
> Development: `?scene=menu&intro=0&screen=campaign-briefing&house=ordos&mission=3` opens any campaign screen
> (`campaign`, `campaign-house`, `campaign-join`, `campaign-briefing`, `campaign-region`, `campaign-results`
> with `&stage=victory|mentat|score|password`, `campaign-password`, `campaign-defeat`, `campaign-ending`);
> `npm run e2e:campaign` runs the campaign end to end.
