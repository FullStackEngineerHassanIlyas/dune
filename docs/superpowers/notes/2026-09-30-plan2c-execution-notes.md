# Plan 2c execution notes (Starport, Frigate, House of IX)

Branch `feat/plan2c-starport-ix`, 8 tasks and one review fix pass, merged into master.

What landed:
- **The Starport market.** Each house's standard vehicles and aircraft are on sale; the Ordos also get
  the Missile Tank.
  - Stock starts at 2–6 and grows by 1 per type every 90 s, up to 10.
  - Prices are re-rolled every minute to 40–160 % of the cost.
  - Orders are paid at once. A right-click cancels one for a refund until the Frigate lands.
- **The Frigate.** It lands the whole batch on the pad 30 s after the first order and says "Frigate has
  arrived." It still lands where a lost Starport stood, and it looks further out when the pad is hemmed in.
- **The House of IX** opens the Ornithopter.
- **The computer** raises its turrets first, then a Starport and a House of IX when IX opens something
  for it. It never shops at the Starport.
- **Plan 2b's minors are closed:** the cursor over aircraft, homing at lifted units, and wave aircraft
  that end on guard.

Verification:
- `npm test`: 402/402.
- `npm run smoke`: 35 scenes, among them `base-frigate` (the Frigate on the pad).
- `npm run e2e`: 27/27, including "buying a Quad at the Starport brings it by Frigate".
- A fresh whole-branch review (Opus) found no Critical issues. Its 2 Important findings are fixed, and
  2 Minors were re-graded to Important and fixed. The reviewer's soak placed random orders in 10
  AI-versus-AI games and found every paid unit delivered, cancelled or aboard.

## Rulings made during execution

- Task 3: Ruling: test 'a cancel that empties the batch sends the Frigate away' expected the Frigate to take time to leave, but it is cancelled the tick it appears at the map edge and leaves at once — `>= 0` — cost if wrong: none.
- Task 4: Ruling: the gallery's bottom row is narrower in perspective and cut the Starport at 1,9 — the Starport and the House of IX sit at 8,9 and 12,9 — cost if wrong: none (showcase framing).
- Final: Ruling: the AI Ornithopter test now removes the AI's ground army after IX stands — with turrets first, the army reaches its cap (20) before IX in an enemy-free test, and a real game's losses are what make room — cost if wrong: none (test models losses).
- Final: Ruling: the review's point that the Task 3 turn-back test proved nothing is answered by a new test cancelling a Frigate halfway (passes on the existing code: the behaviour was right, the old test was weak) — cost if wrong: none.
- Final: Ruling: a cancel refund is capped by storage, like production cancels (plan 1b rule) — consistent economy — cost if wrong: a rare lost refund when storage filled meanwhile.
- Final: Ruling: a Frigate delivering to a defeated house, an MCV aboard not counting as alive — §4.11 "no structures and no MCV"; the AI never buys — cost if wrong: an edge case at game end.
- Final: Ruling: the loser's units unloaded into the capturer's base — the plan's "lands where it stood" — cost if wrong: a gift to the captor.
- Final: Ruling: Ornithopters, Siege Tanks and MCVs on sale without IX, upgrades or tech — §4.5 wording and the ware list — cost if wrong: an early power spike for Starport buyers.
- Final: Ruling: no rally point for Starport deliveries — spec silent, original has none — cost if wrong: units gather at the pad.
- Final: Ruling: the Frigate uncovers fog on its way — Carryall deliveries do too — cost if wrong: a little free scouting.
- Final: Ruling: an Ornithopter can lead an AI wave, so the wall-break check looks around it — AI tuning (plan 2e) — cost if wrong: a wave hunts instead of breaking a wall.
- Final: Ruling: models, starportOf scan cost and save/replay assumptions accepted as reviewed — cost if wrong: none now.

## Review fixes

- Final: fixed a Starport purchase giving no feedback (players would buy twice) — eva 'ordered' ("Order placed.") and a count badge from one — 'an order says so; a malformed ware is refused…' RED→GREEN, suite 402/402
- Final: fixed the AI spending ~1000 credits and ~110 s of yard time on a Starport and House of IX before its turrets (first turret 150–250 s later, sometimes never) — Starport/IX only after the turrets and only when IX opens something for the house — 'the AI puts its turrets up before a Starport…' RED→GREEN, suite 402/402
- Final: fixed (re-graded Minor → Important: breaks the "commands are validated" constraint and corrupts credits to NaN, stranding the Frigate) prototype keys accepted as wares — Object.hasOwn — same test RED→GREEN
- Final: fixed (re-graded Minor → Important: paid units stuck aboard for ever with no cancel on cramped maps) the Frigate waiting for ever when the ring round the pad is full — it looks up to 12 tiles out after 5 s — 'when the ring round the pad is full, the Frigate looks further out after a while' RED→GREEN, suite 402/402; e2e 27/27 after the fixes

## Deferred minors (carried into plan 2d)

- Final: minor (deferred): a batch stays tied to a lost Starport when the house holds another (captured) one — orders join it and land at the old spot; the standing Starport's pad stays dark
- Final: minor (deferred): stale entry 'frigate' in DEFERRED; tooltip text (price, stock, ETA) goes stale while hovering; a right-click after landing gives no message
