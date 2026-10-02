# Phase 2 — opponents stream (up to three AI opponents, skirmish set-up)

Branch `phase2/opponents`, from `improve/visibility` (5719049). Spec §5.8, §4.10, §4.11.

## Plan (each step with its proof)

1. Houses that can hold a skirmish base, sub-house rosters, tech level notes — `tests/opponents.test.mjs` (rosters, tech gating per level).
2. `setupSkirmish({ opponents, techLevel, worms })`, URL codec — tests: three opponents get four distinct corners and houses; old `enemy`/`difficulty` still work; worms and tech pass through.
3. Free-for-all AI targeting — tests: an AI's wave goes for another AI; a house that hit the base is paid back first.
4. Victory, end statistics per house, `houseDefeated` names the house — tests: FFA win, the player out while computers fight on, draw.
5. Radar colours — test: every skirmish house distinct from the others and from the ground it sits on.
6. Set-up screen and scene — `tests/menu.test.mjs`: cleaning, migration of old set-ups, URL round trip, the opponent cap.
7. Timed 4-house AI game, 20 game minutes on a 128 map, in Node.
8. Real-GPU look: set-up screen, a four-house battle and its radar, the end screen.
