// Smoke scenes of the phase 3 intro stream (that stream owns this file): { name: { query, settleMs?, timeoutMs? } }.
// ?introAt=<s> holds the opening at that moment (scenes/menu-intro.js); scene=ending&at=<s> the campaign's ending.
const at = (t, settleMs = 2500) => ({ query: `scene=menu&seed=5&introAt=${t}`, settleMs });
export default {
  'intro-stars': at(2.5),
  'intro-credits': at(5.2),
  'intro-present': at(11),
  'intro-arrival': at(17),
  'intro-ship-atreides': at(19.1),
  'intro-ship-harkonnen': at(20.6),
  'intro-ship-ordos': at(22.1),
  'intro-title': at(28),
  'ending-shimmer': { query: 'scene=ending&house=ordos&seed=5&at=7', settleMs: 2000 },
  'ending-credits': { query: 'scene=ending&house=atreides&seed=5&at=22', settleMs: 2000 },
};
