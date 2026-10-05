// The campaign's flow through the menu screens (spec §5.8, §7; research.md §6 describes the Sega order; screen
// names are contract C3): the hub (continue, new campaign, password) -> house selection -> the house's pages and
// "join?" -> the Mentat's briefing -> the region zoom -> the mission in the battle frame (C2) -> the results
// (victory card, Mentat, score, password) and the next briefing, or the defeat lines and the same briefing again;
// after mission 9 the victory card, the Mentat's last words and the score, then the ending at once and the title.
// A password for a mission before the saved one is a replay: the save stays (progress.js jumpTo). Pure:
// step(progress, state, action) returns the next state, the progress, whether to save it, for a launch the
// battle's query and, after the last score, ending: true (play the ending now).
import { CAMPAIGN_HOUSES, MISSIONS, missionNumber } from './result.js';
import { DONE, joinHouse, jumpTo, recordResult, continues } from './progress.js';
import { readPassword } from './passwords.js';

export const SCREENS = ['campaign', 'campaign-house', 'campaign-join', 'campaign-briefing', 'campaign-region', 'campaign-results',
  'campaign-password', 'campaign-defeat', 'campaign-ending'];
/** The house selection's order, left to right, as on the Sega screen. */
export const SEGA_ORDER = ['atreides', 'ordos', 'harkonnen'];

const BACK = { campaign: 'title', 'campaign-house': 'campaign', 'campaign-join': 'campaign-house', 'campaign-briefing': 'campaign',
  'campaign-region': 'campaign-briefing', 'campaign-password': 'campaign' };

/** Where Back and Esc lead from a campaign screen; null where the only way is on (results, defeat, ending). */
export function backOf(screen) { return BACK[screen] ?? null; }

/** The battle frame's address for a mission (C2). */
export function launchQuery(house, mission, seed = null) {
  if (!CAMPAIGN_HOUSES.includes(house) || !missionNumber(mission)) throw new Error(`no campaign mission ${house} ${mission}`);
  return `scene=mission&house=${house}&mission=${mission}${seed ? `&seed=${seed}` : ''}`;
}

/** The screen to draw for a screen the shell asks for: back from a mission it is that mission's briefing, and
 *  the results of a lost mission are the defeat screen. */
export function resolveScreen(screen, state, progress) {
  if (screen === 'campaign' && state?.screen === 'mission' && state.house) return 'campaign-briefing';
  if (screen === 'campaign-results' && progress?.last && !progress.last.won) return 'campaign-defeat';
  return screen;
}

const briefing = (house, mission) => ({ screen: 'campaign-briefing', house, mission });

/** One step: { progress, state, save?, launch? }. An action that does not fit the screen leaves everything as it was. */
export function step(progress, state, action) {
  const same = { progress, state };
  const { house, mission } = state;
  switch (action?.type) {
    case 'open': {   // a screen straight from a button: the hub, the password entry, a won house's ending again
      if (!SCREENS.includes(action.screen)) return same;
      const id = CAMPAIGN_HOUSES.includes(action.house) ? action.house : house;
      return { progress, state: { screen: action.screen, ...(id ? { house: id, mission: missionNumber(action.mission) ?? mission ?? null } : {}) } };
    }
    case 'new': return { progress, state: { screen: 'campaign-house' } };
    case 'pick': return CAMPAIGN_HOUSES.includes(action.house) ? { progress, state: { screen: 'campaign-join', house: action.house } } : same;
    case 'decline': return { progress, state: { screen: 'campaign-house' } };
    case 'join': {
      if (state.screen !== 'campaign-join' || !house) return same;
      return { progress: joinHouse(progress, house), state: briefing(house, 1), save: true };
    }
    case 'continue': {
      const id = action.house ?? continues(progress)[0]?.house ?? null;
      const next = progress.houses[id]?.mission;
      if (!next) return same;
      return { progress: { ...progress, house: id }, state: next >= DONE ? { screen: 'campaign-ending', house: id, mission: MISSIONS } : briefing(id, next) };
    }
    case 'proceed': return state.screen === 'campaign-briefing' ? { progress, state: { ...state, screen: 'campaign-region' } } : same;
    case 'launch': return house && mission ? { progress, state: { screen: 'mission', house, mission }, launch: launchQuery(house, mission, action.seed) } : same;
    case 'result': {
      const r = action.result;
      if (!r) return same;
      return { progress: recordResult(progress, r), state: { screen: r.won ? 'campaign-results' : 'campaign-defeat', house: r.house, mission: r.mission }, save: true };
    }
    case 'next':
      if (state.screen !== 'campaign-results') return same;
      return mission >= MISSIONS ? { progress, state: { screen: 'campaign-ending', house, mission }, ending: true } : { progress, state: briefing(house, mission + 1) };
    case 'retry': return state.screen === 'campaign-defeat' ? { progress, state: briefing(house, mission) } : same;
    case 'quit': return house && mission ? { progress, state: briefing(house, mission) } : same;
    case 'password': {
      const to = readPassword(action.text);
      if (!to) return { progress, state: { screen: 'campaign-password', error: 'unknown' } };
      return { progress: jumpTo(progress, to.house, to.mission), state: briefing(to.house, to.mission), save: true };
    }
    case 'done': return state.screen === 'campaign-ending' ? { progress, state: { screen: 'title' } } : same;
    case 'back': {
      const to = backOf(state.screen);
      if (!to) return same;
      return { progress, state: to === 'campaign-briefing' ? briefing(house, mission) : to === 'campaign-join' ? { screen: to, house } : { screen: to } };
    }
    default: return same;
  }
}
