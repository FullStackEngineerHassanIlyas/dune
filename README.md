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

Plan 1a (engine core) is done: generated Arrakis maps in 3D, house-coloured 3D units, C&C-style
selection and movement, control groups and MCV deployment. Production, economy, combat, fog of war,
radar and the computer opponent arrive with plan 1b.

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

Browsers may keep Ctrl + digit for switching tabs; Ctrl + Shift + digit always works.
`?scheme=modern` swaps to right-click orders.

## URL flags

`?scene=skirmish|terrain|gallery|render-test` · `seed=11` · `size=64` ·
`house=atreides|harkonnen|ordos` · `enemy=…` · `quality=low|medium|high` · `scheme=classic|modern` ·
`dist=30` (camera distance)

## Docs

Research: `docs/research/` · design: `docs/superpowers/specs/` · plans: `docs/superpowers/plans/`.
Three.js 0.186.1 (MIT) is vendored in `vendor/three/`.
