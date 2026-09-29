# Dune II 3D — fan remake

A browser remake of Westwood's *Dune II: The Battle for Arrakis* (1992 PC, 1993 Sega Mega Drive)
built with Three.js and played with a Command & Conquer style mouse interface. Every model, texture,
sound, melody and line of text is made from scratch in code; no original game files are included.

    npm install     # dev dependency only: three (Node tests + vendoring)
    npm start       # http://localhost:8080
    npm test        # simulation, data and render-logic tests (Node)
    npm run smoke   # screenshots of the test scenes via headless Chrome → screenshots/
    npm run e2e     # plays the opening of a skirmish with real mouse input

## Status

Plans 1a–1c are done: a full skirmish against a computer opponent on Easy, Normal or Hard — build a
base, harvest spice, raise an army, fight with the original weapons (cannons always hit, rockets
scatter, tanks crush infantry, turrets guard the base) and win or lose. Sound and more effects arrive
with plan 1d; the House of IX specials, air units, sandworms and the Palace with plan 2.

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
| S · G · X · D | Stop · guard · scatter · deploy |
| H · Home | Centre on the Construction Yard · reset the camera and centre |
| Screen edges, arrow keys, middle drag | Scroll |
| Mouse wheel · Alt + middle drag | Zoom · rotate and tilt |
| Sidebar icon: left click | Build; resume when on hold; place when READY |
| Sidebar icon: right click | Put on hold; a second right click cancels with a full refund |
| Sidebar icon: Shift + left click | Queue five units |
| Repair / Sell buttons | Toggle repair or sell mode; click own structures; right click or Esc leaves the mode |
| Click a factory, then the ground | Set its rally point (Modern: right click); double-click a factory to make it primary |
| Radar | Left click or drag jumps the camera; with own units selected a left click (Modern: right click) orders them there |
| Left click an enemy (with units selected) | Attack it (Modern: right click) |
| A, then click | Attack-move: go there and fight whatever is met on the way |
| Ctrl + click | Force fire at a unit, building or the ground |
| G | Area guard: engage what comes near, then return |
| P | Pause and resume |

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

## The computer opponent

`?ai=easy|normal|hard` (default Normal). The computer deploys its MCV, builds in its house's order,
keeps its power up, runs two harvesters per refinery, defends its base and sends growing attack waves
— the first after about eight minutes on Easy, five on Normal and three and a half on Hard, where it
also builds faster and earns half again as much from spice. Like the original, it ignores fog of war.
The game ends when one side has no buildings and no MCV left.

## Scenes and URL flags

Scenes: `?scene=skirmish` (default game) · `base` (a built-up base: `?scene=base&house=harkonnen&fps=1`)
· `battle` (two armies fighting; `&idle=1` waits for orders, `&ticks=300` skips ahead) · `structures` (every structure model) · `icons` (sidebar icon sheet) · `stress` (200 units,
`&fps=1` for the meter) · `terrain` · `gallery` (unit models) · `render-test`.

Flags: `seed=11` · `size=64` · `house=atreides|harkonnen|ordos` · `enemy=…` ·
`quality=low|medium|high` · `scheme=classic|modern` · `dist=30` (camera distance) · `deploy=1`
(skirmish starts with the MCV deployed) · `fog=0` (no fog of war) · `gameSpeed=slowest…fastest` ·
`debug=1` (invariant checks) · `fps=1` (frame meter) · `ai=easy|normal|hard` · `focus=rival` (camera on the computer's base).

## Docs

Research: `docs/research/` · design: `docs/superpowers/specs/` · plans: `docs/superpowers/plans/`.
Three.js 0.186.1 (MIT) is vendored in `vendor/three/`.
