# Plan 1d execution notes (sound and polish) — end of phase 1

Branch `feat/plan1d-sound-polish`, 8 tasks plus one review fix pass, merged into master. Phase 1 of the
spec is complete: a skirmish against a computer opponent, start to finish, with sound.

Verification: npm test 301/301 · npm run smoke 31 scenes, no errors · npm run e2e 19/19 (including "the
first click starts the sound engine with every effect ready") · fresh whole-branch review (Opus):
no Critical, 3 Important fixed, three Minors re-graded to Important and fixed.

Open for the manager: real-GPU frame rate (`?scene=stress&fps=1`, `?scene=base&fps=1`) and a listen in a
real browser (`?scene=battle`, click once) — headless Chrome renders at ~2 fps and cannot judge either.

## Rulings made during execution

- Task 3: Ruling: added a read-only debug hook __dune.sound() and an e2e check that the first click opens the AudioContext with all 18 buffers (the plan only checked for errors) — cost if wrong: none
- Task 5: Ruling: the plan-1b test 'the sidebar reads storage…' set startBuffer before placing a refinery; with eager revocation the simulation now ends the allowance at placement, so the test sets it afterwards to keep checking only that the sidebar never mutates it; also 'structures are placed on whole tiles only' already passed before the fix (fractional indices were blocked cells) — the explicit integer check stays as hardening — cost if wrong: none
- Task 6: Ruling: the appended AI test used runUntil, which ai.test.mjs did not import — added it to the import line — cost if wrong: none
- Final: Ruling: declined-to-judge items (phase-2 audio and menus, phase-2 unit sounds, missing engine loops, distance fade taste, loudness balance, lo-fi aliasing, permanent tracks, spice statistic including the Hard bonus) stand as plan design or later phases — cost if wrong: small

## Review fixes

- Important AI MCV rebuild stalling behind army production — test 'an AI that loses its yard mid-game orders a new MCV at once and redeploys' RED→GREEN, suite 301/301
- Important mix clipping in big battles (VOICE_GAIN 0.5 + DynamicsCompressor limiter) — test 'the mix runs through a limiter and a battle keeps headroom before it' RED→GREEN, suite 301/301
- Important sound=0 disabling the engine for the session — test 'starting muted still lets M turn sound on' RED→GREEN, suite 301/301
- minor re-graded Important: an AudioContext created suspended (first key not a user activation) never resumed and held all voices — test 'a context that starts suspended resumes on a later real gesture…' RED→GREEN, suite 301/301
- minor re-graded Important: losing the last Wind Trap cancelled ready or in-progress structures (implied rule applied in revalidation) — test 'losing the last Wind Trap does not cancel a structure that is ready' RED→GREEN, suite 301/301
- minor re-graded Important: dust and tread marks for vehicles far from the camera re-uploaded the whole track canvas — nearCamera() + test 'ambient effects are only made near what the camera looks at', suite 301/301

## Deferred minors (carried into phase 2)

- interface sounds can be starved when combat voices fill the global cap (reserve voices for non-positional sounds)
- volume flag range (0, 4] — volume=0 gives 0.8, >1 clips before the limiter; clamp to [0, 1]
- some events play two sounds at once (MCV deploy: two clunks; construction complete: beep + ready chime)
- e2e runs Chrome with --autoplay-policy=no-user-gesture-required; __dune.sound() does not report the context state; no test for a context that throws on creation
- nits — render buffers at start-up instead of the first click, onended does not disconnect nodes (Safari), mute without a ramp, pitch variation on interface chimes, MCV price hard-coded in the AI
