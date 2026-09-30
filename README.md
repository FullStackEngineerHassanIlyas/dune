# Dune II 3D — fan remake

A browser remake of Westwood's *Dune II: The Battle for Arrakis* (1992 PC, 1993 Sega Mega Drive)
built with Three.js and played with a Command & Conquer style mouse interface. Every model, texture,
sound, melody and line of text is made from scratch in code; no original game files are included.

    npm install     # dev dependency only: three (Node tests + vendoring)
    npm start       # http://localhost:8080 — the main menu (PORT=8090 npm start if 8080 is taken)
    npm test        # simulation, data and render-logic tests (Node)
    npm run smoke   # screenshots of the test scenes via headless Chrome → screenshots/
    npm run shot -- windtrap "scene=model&id=windtrap"   # screenshot any scene URL → screenshots/windtrap.png
    npm run e2e     # plays the opening of a skirmish with real mouse input
    npm run e2e:menu  # main menu, in-game menu, edge and right-drag scrolling in real Chrome

## Status

Phase 1 is complete: a full skirmish against a computer opponent on Easy, Normal or Hard — build a
base, harvest spice, raise an army, fight with the original weapons and win or lose — with sound
effects synthesized in code, placed in stereo around the camera. Phase 2 is under way: factory
upgrades, the Repair Facility, infantry capture, aircraft (Carryall, Ornithopter), the Starport and
the House of IX with its specials and the Palace with its weapons are in; sandworms, music and
announcer voices follow; phase 3 brings the campaign. The main menu is in already: skirmish set-up
(house, opponent, difficulty, map size and seed, credits, fog, speed), options, controls, credits and
full screen, over a slow flight across the dunes; Esc in battle opens the game menu.

## Controls (Classic scheme, like C&C 1995)

| Input | Action |
|---|---|
| Left click | Select a unit; with units selected, order them by context (move, attack) |
| Left click the selected MCV | Deploy it into a Construction Yard |
| Right click | Deselect |
| Left drag | Box select; Shift adds |
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
credits, Refineries and Silos store them. Selling refunds half the price times the health left;
repairs cost up to 40 % of the price. An Outpost with enough power turns the radar on. Explored ground
stays visible; enemies show only inside your units' and buildings' sight.

Factory upgrades show up at the end of the structure strip with a gold arrow and the level they reach:
they are paid and timed like a build on the factory's own line and open better units (Quad, squads,
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

## The computer opponent

`?ai=easy|normal|hard` (default Normal). The computer deploys its MCV, builds in its house's order,
keeps its power up, runs two harvesters per refinery, defends its base and sends growing attack waves
— the first after about eight minutes on Easy, five on Normal and three and a half on Hard, where it
also builds faster and earns half again as much from spice. Like the original, it ignores fog of war.
The game ends when one side has no buildings and no MCV left.

## Sound

Every sound — rifles, machine guns, cannons, rockets, explosions, construction and the interface — is
synthesized in the browser at start-up; nothing is loaded from files. Browsers only allow sound after
a click or key press, so the game is silent until then. Sounds are panned towards where they happen
and fade with distance from the camera; what fog hides is not heard.

## Scenes and URL flags

Scenes: `?scene=menu` (the default with no query) · `skirmish` (the default when the query names no scene) · `base` (a built-up base: `?scene=base&house=harkonnen&fps=1`; `&palace=1` charges the Palace)
· `battle` (two armies fighting; `&idle=1` waits for orders, `&ticks=300` skips ahead, `&specials=1` brings in the House of IX tanks) · `structures` (every structure model) · `icons` (sidebar icon sheet) · `stress` (200 units,
`&fps=1` for the meter) · `terrain` · `gallery` (unit models) · `model` (one model from four sides with its
triangle count: `?scene=model&id=combatTank`; `&houses=1` in each house's colours, `&views=1–4`, `&dist=`, `&pitch=`,
`&yaw=`, `&lift=0.9` for aircraft, `&set=warn:1.2` sets animation params) · `render-test`.

Flags: `seed=11` · `size=64` · `house=atreides|harkonnen|ordos` · `enemy=…` ·
`quality=low|medium|high` · `scheme=classic|modern` · `dist=30` (camera distance) · `deploy=1`
(skirmish starts with the MCV deployed) · `fog=0` (no fog of war) · `credits=5000` · `gameSpeed=slowest…fastest` ·
`debug=1` (invariant checks) · `fps=1` (frame meter) · `ai=easy|normal|hard` · `focus=rival` (camera on the computer's base) · `sound=0` (start muted) · `volume=0.5`.

## Docs

Research: `docs/research/` (the models follow the Genesis sprites analysed in `raw/visual-structures.md` and
`raw/visual-units.md`) · design: `docs/superpowers/specs/` · plans: `docs/superpowers/plans/`.
Three.js 0.186.1 (MIT) is vendored in `vendor/three/`.
