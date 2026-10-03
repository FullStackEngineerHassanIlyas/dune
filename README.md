# Dune II 3D — fan remake

A browser remaster of Westwood's 1992 RTS as released on the Sega Mega Drive, *Dune: The Battle for
Arrakis*, built with Three.js and played with a Command & Conquer style mouse interface. The intro and the
campaign follow the Sega release; the skirmish keeps the additions the original should have had (the PC
game's House of IX, up to three opponents, modern controls). Every model, texture, sound, melody and line
of text is made from scratch in code; no original game files are included.

    npm install     # dev dependency only: three (Node tests + vendoring)
    npm start       # http://localhost:8080 — the main menu (PORT=8090 npm start if 8080 is taken)
    npm test        # simulation, data and render-logic tests (Node)
    npm run smoke   # screenshots of the test scenes via headless Chrome → screenshots/
    npm run shot -- windtrap "scene=model&id=windtrap"   # screenshot any scene URL → screenshots/windtrap.png
    npm run e2e     # plays the opening of a skirmish with real mouse input
    npm run e2e:menu  # main menu, in-game menu, edge and right-drag scrolling in real Chrome
    npm run e2e:intro     # the opening and the ending in real Chrome
    npm run e2e:campaign  # the campaign from the menu through a mission's result in real Chrome

## Status

Phase 1 is complete: a full skirmish against a computer opponent on Easy, Normal or Hard — build a
base, harvest spice, raise an army, fight with the original weapons and win or lose — with sound
effects synthesized in code, placed in stereo around the camera. Phase 2 is complete: factory
upgrades, the Repair Facility, infantry capture, aircraft (Carryall, Ornithopter), the Starport and
the House of IX with its specials, the Palace with its weapons, each house's announcer voice,
sandworms and spice blooms, up to three computer opponents (free-for-all), an FM soundtrack, the
player's own original Dune II sounds (optional) and the graphics presets with a frame-rate check.
Phase 3 brings the campaign of the Sega Mega Drive release: choose Atreides, Ordos or Harkonnen, hear your
Mentat's briefing over the map of Arrakis, fight nine missions, and after each win see the victory card, the
score and rank screen and the mission's password; a lost mission is briefed again. Progress is saved in the
browser, and the Sega passwords take you to any mission. The game opens like the Sega release, with its
ships arriving at Arrakis before the title. The main menu: campaign, skirmish set-up (house, up to three
opponents with house and difficulty, tech level, worms, visibility, map size and seed, credits, speed),
options, controls, original game files, credits and full screen; Esc in battle opens the game menu.

## The opening

The main menu starts like the Mega Drive release: a black screen asks for a key or a click (browsers only
allow sound after one), then stars drift past, our own credit lines show, Arrakis and a blue nebula slide in
and the camera stops on the planet, the Atreides, Harkonnen and Ordos ships fly in one by one and sink into it,
and the title appears before the menu fades in over the same picture. The music's opening cue is started by
that key and the pictures are timed to it. Any key or click skips to the title. It plays once per visit; turn
it off in Options (Intro) or with `?intro=0`; `?intro=1` forces it (automated browsers skip it otherwise),
`?introAt=<seconds>` holds it at a moment for screenshots. With reduced motion (or the background paused) a
short still version plays. The campaign's ending turns the planet into the victor's colour and rolls the
credits: see it on its own with `?scene=ending&house=ordos` (`&at=<seconds>` to hold).

## Campaign

Main menu → Campaign. *New campaign* picks a house (Atreides, Ordos, Harkonnen) and starts at mission 1;
*Continue* goes back to the next mission of a house you have played; *Enter password* takes a ten-letter Sega
password (case does not matter) to that house and mission. In a briefing, *Advice* shows the Mentat's tip and
*Proceed* starts the mission after a look at its region (Enter skips the zoom). After a mission: the score
(enemy buildings destroyed, minus your own lost, plus what still stands, a point per 100 credits and a bonus
for finishing under 45 minutes a mission) and your rank, from Sand Snake to Ruler of Arrakis. Progress is
kept in this browser under `dune2-3d.campaign`.

Three houses, nine missions each, as the Sega Mega Drive release runs them: mission 1 asks for 1000 credits
of spice against roaming patrols, mission 2 for 2700 credits or the enemy's small base, and from mission 3
every enemy base must go — two bases of one house in the later missions, two houses at once in mission 8 and
the Emperor's Sardaukar in mission 9. The first two missions are played on small 32-tile maps, the rest on 64;
worms appear from mission 3, the Emperor drops Sardaukar Troopers from mission 4, and the computer builds
faster, earns more and attacks sooner as the campaign goes on. Each mission opens the buildings and units of
the Mega Drive's tech ladder: one large concrete slab, the vehicle factory from mission 2 (Harkonnen 3), Quad,
Harvester and Combat Tank, MCV, Missile and Siege Tank through its upgrades, the Hi-Tech Factory, Repair
Facility and Gun Turret at 5, Starport and Rocket Turret at 6, the house's special tank and the Ornithopter
(from the Hi-Tech) at 7 and the Palace at 8. There is no House of IX in the campaign (the skirmish keeps it).

In a mission the objectives are the Sega's: store a credit quota, or destroy every enemy building (turrets,
walls and slabs do not count; captured ones do); you lose when you have no building left — an MCV does not
save you — and nothing is decided in the first two minutes. Every computer house is allied with every other
against you. Reinforcements arrive on schedule by Carryall or over a map edge ("Reinforcements have arrived."
— Space jumps there). The objective line under the message bar shows how far along you are. A win ends with
seven Carryalls in your house colour flying over the battlefield in a V. The in-game menu says Restart mission
and Quit mission.

Between missions a tilted relief map of Arrakis — sand seas, rock lands, mountain ranges and both ice caps —
shows 27 regions in the houses' colours (Atreides blue, Harkonnen red, Ordos green, the Emperor's Sardaukar
purple). As on the Sega game the territories grow with every mission won: the land taken floods in the house's
colour, the region of the next mission pulses, and after the briefing the view dives onto it. Who holds what
after each mission follows the original game's region data; the map itself is drawn by the game.

Every word of the campaign is written for this remake (`src/data/story.js`): three pages and a question for
each house, the Mentats' briefing, advice, victory and defeat lines for the nine missions of each house —
Cyril of House Atreides fair and calm, Radnor of House Harkonnen cruel and sly, Ammon of House Ordos mercantile
and curt — their last words after the final battle, a caption for each step of the map and the credits roll.

Development: `?scene=mission&house=atreides&mission=3` plays one mission on its own (`seed=` changes the map);
`?scene=atlas&house=ordos&step=3&zoom=4` shows the map; `?scene=menu&intro=0&screen=campaign-briefing&house=ordos&mission=3`
opens any campaign screen (`campaign`, `campaign-house`, `campaign-join`, `campaign-briefing`, `campaign-region`,
`campaign-results` with `&stage=victory|mentat|score|password`, `campaign-password`, `campaign-defeat`,
`campaign-ending`).

## Controls (Classic scheme, like C&C 1995)

| Input | Action |
|---|---|
| Left click | Select a unit; with units selected, order them by context (move, attack) |
| Left click the selected MCV | Deploy it into a Construction Yard |
| Right click | Deselect |
| Left drag | Box select; Shift adds (a box round the army leaves out the Carryalls waiting on duty above it) |
| Double click | Select all visible units of that type |
| Ctrl + 1–9 (or Ctrl + Shift + 1–9) | Assign a control group |
| 1–9, tap twice | Select a group, centre on it |
| S · G · X · D | Stop · guard · scatter · deploy (a Devastator: Destruct) |
| H · Home | Centre on the Construction Yard · reset the camera and centre |
| Screen edges, arrow keys, middle drag | Scroll; a pointer pushed out past the edge keeps scrolling until it comes back |
| Hold the right button and pull | Scroll that way, faster the further you pull (a still right click is still a right click) |
| Mouse wheel · Alt + middle drag | Zoom · rotate and tilt |
| Sidebar icon: left click | Build; resume when on hold; place when READY |
| Sidebar icon: right click | Put on hold; a second right click cancels with a full refund |
| Sidebar icon: Shift + left click | Queue five units |
| Repair / Sell buttons | Toggle repair or sell mode; click own structures; right click or Esc leaves the mode |
| Click a factory, then the ground | Set its rally point (Modern: right click); double-click a factory to make it primary |
| Radar | Left click or drag jumps the camera; with own units selected a left click (Modern: right click) orders them there |
| Left click an enemy (with units selected) | Attack it (Modern: right click) |
| Left click an own Repair Facility (damaged vehicles selected) | Drive in for repairs, one at a time (Modern: right click) |
| Left click a badly damaged enemy building (infantry selected) | Capture it — the cursor shows a flag; other units attack |
| Carryall selected: left click an own vehicle · the ground · the Repair Facility or a Refinery | Lift it · fly there, or set the load down there · deliver the load (Modern: right click); S holds it off duty, G returns it to duty, D drops the load |
| A, then click | Attack-move: go there and fight whatever is met on the way |
| Ctrl + click | Force fire at a unit, building or the ground |
| Alt + click | Force move: drive there, over enemy soldiers (Modern: Alt + left or right click) |
| Space | Jump to the last alert (a base or harvester under attack, a structure lost, wormsign) |
| G | Area guard: engage what comes near, then return |
| Esc · F10 · sidebar Menu | Game menu: resume, options, controls, full screen, restart, quit (Esc first leaves a mode) |
| Alt + Enter · sidebar ⛶ | Full screen (hold Esc to leave it) |
| P | Pause and resume |
| M | Sound on and off |

Browsers may keep Ctrl + digit for switching tabs; Ctrl + Shift + digit always works.
`?scheme=modern` swaps to right-click orders.

## Base building

Deploy the MCV to get a Construction Yard; its sidebar strip then offers what the tech tree allows.
Structures go on rock next to your base; tiles without your concrete cost hit points (the ghost shows
green = concrete, yellow = bare rock, red = blocked). Wind Traps power the base — short power slows
production and switches the radar off. Every Refinery comes with a Harvester; full loads are worth 700
credits, Refineries and Silos store them. A Harvester drives into its Refinery's docking pad to unload
(one at a time, the others wait by the entrance), then backs out and returns to the field. Selling refunds half the price times the health left;
repairs cost up to 40 % of the price. An Outpost with enough power turns the radar on. Explored ground
stays visible; enemies show only inside your units' and buildings' sight.

Vehicles come from one factory, as on the Genesis: the Heavy Factory, on offer as soon as a Refinery
stands, builds trikes and quads as well as tanks, Harvesters and the MCV, one at a time from one strip.
A second Heavy Factory speeds that line up by a quarter; vehicles leave by the primary one.

Factory upgrades show up at the end of the structure strip with a gold arrow and the level they reach:
they are paid like a build on the factory's own line, take five seconds and start at once — the item in
hand steps aside, keeping its clock, and carries on afterwards — and open better units (Quad, squads,
MCV, Missile and Siege Tanks) and the Large Concrete Slab and Rocket Turret. A Repair Facility fixes one
vehicle at a time for a quarter of its price by the damage; badly damaged enemy buildings (red health)
can be captured by walking infantry in — except Barracks, WOR, Outposts, the House of IX and Palaces.

The Hi-Tech Factory builds Carryalls — unarmed lifters that fly each new Refinery's Harvester in from the
map edge and, on duty, wait over the Refineries and the Repair Facility, ferry Harvesters on trips of ten
tiles or more (and to distant spice when none is near), and lift vehicles at half health or worse off the
battlefield to the Repair Facility, sending them back afterwards; the player can also fly one somewhere,
have it lift and set down an own vehicle, or hold it off duty — and, with its upgrade and a House of IX,
Ornithopters that hunt on their own and take attack and move orders.
Only Troopers, Missile Tanks and turrets can shoot at aircraft.

A Starport sells the house's vehicles and aircraft at prices that change every minute (40–160 % of
the usual cost) while stock lasts; orders are paid at once, a Frigate lands them on the pad 30 s after
the first order, and right-clicking an order before it lands cancels it for a refund. A House of IX
opens the Ornithopter.

The House of IX opens each house's special tank. The Atreides Sonic Tank sends a wave eight tiles out
that hurts everything on its path — your own units too — except Sonic Tanks and walls. The Ordos
Deviator's gas turns enemy ground units to your side for 40 seconds (not aircraft, Harvesters or
MCVs). The Harkonnen Devastator is the toughest tank; its Destruct order (D or the panel button) glows
for three seconds, then blows it apart in eight blasts.

The Palace adds its house weapon at the top of the sidebar, with a charging clock. The Harkonnen Death
Hand (every 7 minutes) is a missile that comes down near where you click in 17 blasts; the Atreides
call five Fremen squads out of the sand near where you click (every 4 minutes) — they hunt on their
own; the Ordos get a Saboteur by the Palace (every 4 minutes) that walks over walls and blows up the
building you send it into. The computer uses its Palace as soon as it is charged.

## The computer opponents

Up to three, each with its own house and difficulty (skirmish set-up, or
`?opponents=harkonnen:hard,ordos:normal,sardaukar:easy`; houses atreides, harkonnen, ordos, sardaukar,
mercenary; the old `enemy=` and `ai=easy|normal|hard` still work). Every house fights every other one,
and the last house standing wins. The computer deploys its MCV, builds in its house's order,
keeps its power up, runs two harvesters per refinery, defends its base and sends growing attack waves
— the first after about eight minutes on Easy, five on Normal and three and a half on Hard, where it
also builds faster and earns half again as much from spice. Like the original, it ignores the shroud and fog of war.
The game ends when one side has no buildings and no MCV left.

## Sound

Every sound — rifles, machine guns, cannons, rockets, explosions and their debris, collapsing
buildings, construction, the interface and the desert wind — is synthesized in the browser at
start-up, in a background thread; nothing is loaded from files. Each is built in layers (a crack, a
body, a tail) and set to a designed loudness, and most come in several variations played at slightly
different pitches, so a battle never sounds like one sample repeating. Browsers only allow sound after
a click or key press, so the game is silent until then. Sounds are panned towards where they happen;
further from the camera they grow quieter, duller and more echoing in a soft desert reverb; what fog
hides is not heard. A hidden tab is silent, and the menu's own sound sleeps while a battle is open.

Music comes from an FM synthesizer in the Mega Drive manner (four-operator voices, sample-and-held "PCM"
drums) playing newly written tracks in the style of the Sega soundtrack: an opening cue timed to the intro, a
title theme, house selection and region music, a briefing theme, a victory fanfare and a dirge for each house,
four peace and four battle tracks, a finale and the credits. In a battle the Sega game's way is the default: the
in-game tunes play one after another in random order, never the same twice running, and a new one starts when
you close the game menu; Options → Battle music → Adaptive switches to peace tracks that give way to battle
tracks when fighting starts near your forces. Options → Music sets the volume (0 turns it off).
`?scene=menu&music=<track>` plays one track (opening, title, houseSelect, region, atreides, harkonnen, ordos,
erg, dawn, lanterns, harvest, assault, iron, shieldwall, stormfront, victory, defeat, victory-atreides,
victory-harkonnen, victory-ordos, defeat-atreides, defeat-harkonnen, defeat-ordos, finale, credits);
`node src/audio/music/render-wav.mjs <ids|all> <seconds|full> <dir>` renders tracks to WAV files.

Original game files (optional): Main menu or Options → Original Game Files lets you pick the `.PAK` files
from your own Dune II PC copy (the original announcer, unit replies and sound effects replace the generated
ones) and the Mega Drive game's soundtrack from your own copy as VGM files (`.vgm`, `.vgz` or the `.zip` they
came in), or MP3, OGG or WAV tracks. Each Sega track plays where the Sega game played it — the Opening under
the intro and the title, the Mentats' themes at the briefings, the five in-game tunes in every mission, a
victory theme and a dirge per house — and the Music Test on that page plays any of them and lets you choose
where each one plays. VGM files are replayed through an emulated YM2612 and PSG in the browser
(`node scripts/vgm-info.mjs <files or zip>` shows what is inside a rip). Your files are read in your browser
only and kept in its storage: nothing is uploaded or committed.

## Announcer voices

Like the original, each Great House has its own announcer — Atreides calm and clear, Harkonnen deep
and harsh, Ordos cool and precise — and the player's house decides which one speaks: construction
complete, unit ready, building, training, on hold, cancelled, upgrade complete, insufficient funds,
unit lost, structure destroyed, "Harkonnen unit destroyed", our base is under attack, enemy unit
approaching, radar activated, frigate has arrived, missile launched, mission accomplished and the rest.
Every kind of unit answers in a voice of its own when it is selected or given an order: foot soldiers on a
field radio ("Reporting", "Moving out", "Taking the building"), Heavy Troopers in their powered suits, Trike
and Quad riders on the wind, tank crews on the intercom ("Target acquired"), the Harvester driver ("Heading to
the spice"), the Carryall and Ornithopter pilots in their headsets, the MCV's driver, the Saboteur close and
quiet, and the Fremen far out in the desert. The first unit that takes the order answers, never with the same
words twice running; an order's answer cuts short a unit still reporting in. With the original game files on,
every reply is the original's own clip, chosen as the original chose it. In a mission the announcer also says
"Reinforcements have arrived." Alerts go before routine news, one line at a time, and
the message bar still shows every line. Options → Voices sets their volume (`voiceVolume=0` in the URL
turns them off); M mutes them with everything else.

Unlike the effects, the voices are files: 317 short Ogg Opus lines (about 1.7 MB) in `assets/voice/`,
listed in `assets/voice/manifest.json`. They were rendered offline by `scripts/voices/generate.py` from
the lines in `scripts/voices/lines.json` (its header says how to rerun it), with the
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) neural text-to-speech model (weights and voices
Apache-2.0) run through [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT), voices
`af_heart` (Atreides), `am_fenrir` slowed like a tape (Harkonnen), `af_bella` (Ordos) and, for the units,
`am_michael`, `bm_george`, `am_puck`, `bm_fable`, `af_sarah`, `af_kore`, `bm_lewis`, `af_nova`, `af_nicole` and a
blend of `bm_george` and `am_fenrir`, then shaped
with ffmpeg (band-limit, presence, compression, a short console room or a field radio, loudness
normalised to −16 LUFS). espeak-ng (GPL-3.0) turned the text into phonemes at generation time only; it is
not part of the game. The generated lines are distributed with this project under the same terms as its
code. No original game audio is used.

## Scenes and URL flags

Scenes: `?scene=menu` (the default with no query) · `skirmish` (the default when the query names no scene) · `base` (a built-up base: `?scene=base&house=harkonnen&fps=1`; `&palace=1` charges the Palace)
· `mission` (one campaign mission: `?scene=mission&house=ordos&mission=5`) · `atlas` (the territory map) · `ending` (the campaign's ending) · `planet`
· `battle` (two armies fighting; `&idle=1` waits for orders, `&ticks=300` skips ahead, `&specials=1` brings in the House of IX tanks) · `structures` (every structure model) · `icons` (sidebar icon sheet) · `stress` (200 units,
`&fps=1` for the meter) · `terrain` · `gallery` (unit models) · `model` (one model from four sides with its
triangle count: `?scene=model&id=combatTank`; `&houses=1` in each house's colours, `&views=1–4`, `&dist=`, `&pitch=`,
`&yaw=`, `&lift=0.9` for aircraft, `&set=warn:1.2` sets animation params) · `render-test`.

Flags: `seed=11` · `size=64` · `house=atreides|harkonnen|ordos` · `enemy=…` ·
`quality=low|medium|high` · `scheme=classic|modern` · `dist=30` (camera distance) · `deploy=1`
(skirmish starts with the MCV deployed) · `visibility=shroud|fog|revealed` (Dune II shroud, the default · C&C fog of war · whole map; `fog=0` also reveals) · `credits=5000` · `gameSpeed=slowest…fastest` ·
`opponents=house:difficulty,…` (up to three) · `tech=1…9` · `worms=off|few|many` (skirmish default few; `scene=battle&worms=many&idle=1` shows a worm hunting; `base` default off) · `focus=rival|1…3` ·
`intro=0|1` · `introAt=<seconds>` · `screen=<menu screen>` · `musicMode=sega|adaptive` · `perfCheck=0` (no frame-rate check) · `perfFps=40` · `perfSeconds=…` · `musicVolume=0.5` ·
`debug=1` (invariant checks) · `fps=1` (frame meter) · `ai=easy|normal|hard` · `focus=rival` (camera on the computer's base) · `sound=0` (start muted) · `volume=0.5` · `voiceVolume=0.5` (0: no voices).

## Docs

Research: `docs/research/` (the models follow the Genesis sprites analysed in `raw/visual-structures.md` and
`raw/visual-units.md`) · design: `docs/superpowers/specs/` · plans: `docs/superpowers/plans/`.
Three.js 0.186.1 (MIT) is vendored in `vendor/three/`. The YM2612 emulation of the VGM player
(`src/audio/music/chips/ym2612.js`) is a JavaScript port of [ymfm](https://github.com/aaronsgiles/ymfm) by
Aaron Giles, BSD-3-Clause; its licence is kept in the file header. The PSG is our own code.
