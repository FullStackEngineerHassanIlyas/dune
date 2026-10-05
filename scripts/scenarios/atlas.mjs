// Smoke scenes of the phase 3 atlas stream (that stream owns this file): { name: { query, settleMs?, timeoutMs? } }.
// The territory map on its own (scene=atlas): each house's opening map, a mid-campaign map, the zoom landed on a
// mission's region, a conquest finished and the reduced-motion picture.
export default {
  'atlas-atreides-0': { query: 'scene=atlas&house=atreides&step=0', settleMs: 800 },
  'atlas-harkonnen-4': { query: 'scene=atlas&house=harkonnen&step=4', settleMs: 800 },
  'atlas-ordos-8': { query: 'scene=atlas&house=ordos&step=8', settleMs: 800 },
  'atlas-zoom': { query: 'scene=atlas&house=ordos&step=3&zoom=4&seconds=2', settleMs: 2800 },
  'atlas-conquer': { query: 'scene=atlas&house=atreides&step=2&conquer=1', settleMs: 4500 },
  'atlas-still': { query: 'scene=atlas&house=harkonnen&step=6&zoom=7&still=1&quality=low', settleMs: 800 },
};
