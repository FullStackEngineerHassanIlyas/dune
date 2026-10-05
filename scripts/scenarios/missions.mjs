// Smoke scenes of the phase 3 missions stream (that stream owns this file): { name: { query, settleMs?, timeoutMs? } }.
// A campaign mission (scenes/mission.js): the campaign's def when src/data/campaign.js has it, else the sample.
export default {
  // the player's base at the start, with the objective line under the message bar
  'mission-start': { query: 'scene=mission&house=atreides&mission=3', settleMs: 1500 },
  // 39 s in: the first reinforcements are on their way in by Carryall from the south
  'mission-reinforcements': { query: 'scene=mission&house=ordos&mission=3&ticks=780&dist=20', settleMs: 2500 },
  // a computer house's base: guards at their posts, its ally's outpost further on
  'mission-enemy-base': { query: 'scene=mission&house=harkonnen&mission=3&visibility=revealed&focus=atreides&dist=26', settleMs: 1500 },
};
